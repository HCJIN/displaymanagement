// src/routes/messages.js - 수정된 메시지 라우터 (연결 확인 로직 개선)
const express = require('express');
const { authenticate, authorize, authorizeDeviceAccess } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

// 모델들을 안전하게 로드
let Message, Device, displayService, logger;

try {
  Message = require('../models/Message');
  console.log('✓ Message 모델 로드 성공');
} catch (error) {
  console.error('❌ Message 모델 로드 실패:', error.message);
  Message = {
    findAll: () => [],
    findById: () => null,
    findByDeviceId: () => [],
    findByRoomNumber: () => [],
    getUsedRoomNumbers: () => [],
    delete: () => true,
    deleteByRoomNumber: () => 0,
    getActiveMessages: () => [],
    getStats: () => ({ total: 0 }),
    Priority: { NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT' },
    DisplayEffect: { DIRECT: 'DIRECT' },
    EndEffect: { DIRECT_DISAPPEAR: 'DIRECT_DISAPPEAR' },
    ProtocolCommand: {
      DELETE_ROOM: 'DELETE_ROOM',
      REQUEST_ROOM_INFO: 'REQUEST_ROOM_INFO'
    }
  };
}

try {
  Device = require('../models/Device');
  console.log('✓ Device 모델 로드 성공');
} catch (error) {
  console.error('❌ Device 모델 로드 실패:', error.message);
  Device = {
    findById: () => null,
    findAll: () => []
  };
}

try {
  displayService = require('../services/displayService');
  console.log('✓ DisplayService 로드 성공');
} catch (error) {
  console.error('❌ DisplayService 로드 실패:', error.message);
  console.error('📋 DisplayService 오류 스택:', error.stack);

  // ⚠️ 로드 실패 시 프로세스 중단 (모킹 사용하지 않음)
  console.error('🚨 DisplayService는 필수 서비스입니다. 서버를 중단합니다.');
  process.exit(1);
}

try {
  logger = require('../utils/logger');
  console.log('✓ Logger 로드 성공');
} catch (error) {
  console.error('❌ Logger 로드 실패:', error.message);
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    device: (id, msg) => console.log(`Device ${id}: ${msg}`)
  };
}

const router = express.Router();

// ✅ 수정: 디바이스 연결 상태 확인 함수 개선 (온라인 상태면 무조건 전송)
function checkDeviceConnection(deviceId) {
  try {
    // 1. 디바이스 존재 확인
    let device = Device.findById(deviceId);

    // 2. 디바이스가 없으면 실제 디바이스로 가정하고 처리
    if (!device) {
      logger.warn(`디바이스를 찾을 수 없음: ${deviceId}, 실제 디바이스로 처리`);

      // 실제 디바이스 객체 생성
      device = {
        id: deviceId,
        deviceId: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        status: 'offline',
        isTest: false,
        specs: {
          model: 'REAL-LED',
          resolution: { width: 1920, height: 1080 }
        }
      };
    }

    // 3. 테스트 디바이스 확인 (여러 조건으로 확인)
    let isTestDevice = false;

    try {
      // displayService에서 먼저 확인
      isTestDevice = displayService.isTestDevice(device);
    } catch (serviceError) {
      logger.warn('displayService.isTestDevice 호출 실패, 수동 확인');
    }

    // displayService가 실패하면 수동으로 확인
    if (!isTestDevice) {
      isTestDevice = (
        device.name?.includes('테스트') ||
        device.name?.includes('TEST') ||
        device.name?.includes('test') ||
        device.specs?.model?.includes('TEST') ||
        device.deviceId?.startsWith('TEST') ||
        device.ip?.startsWith('127.0.0') ||
        device.isTest === true ||
        // 추가 조건: 일반적인 테스트 디바이스 패턴
        device.name?.includes('전광판') && device.id?.length < 20
      );
    }

    logger.info(`테스트 디바이스 확인: ${deviceId} = ${isTestDevice}`, {
      deviceName: device.name,
      deviceModel: device.specs?.model,
      isTestFlag: device.isTest,
      ip: device.ip
    });

    // 4. 연결 상태 확인 (중요: 온라인 상태면 연결된 것으로 처리)
    let isConnected = false;

    // 우선 디바이스 상태가 온라인인지 확인
    if (device.status === 'online') {
      isConnected = true;
      logger.info(`디바이스 상태가 온라인이므로 연결된 것으로 처리: ${deviceId}`);
    } else {
      // 상태가 온라인이 아니면 displayService에서 확인
      if (isTestDevice) {
        try {
          isConnected = displayService.isDeviceConnected(deviceId);
        } catch (error) {
          logger.warn('테스트 디바이스 연결 상태 확인 실패, true로 설정');
          isConnected = true; // 테스트 디바이스는 항상 연결 가능
        }

        logger.info(`테스트 디바이스 연결 상태: ${deviceId} = ${isConnected}`);
      } else {
        try {
          isConnected = displayService.isDeviceConnected(deviceId);
        } catch (error) {
          logger.warn('실제 디바이스 연결 상태 확인 실패, false로 설정');
          isConnected = false;
        }

        logger.info(`실제 디바이스 연결 상태: ${deviceId} = ${isConnected}`);
      }
    }

    return {
      device: device,
      isConnected: isConnected,
      isTestDevice: isTestDevice,
      exists: !!Device.findById(deviceId) // 원본 디바이스 존재 여부
    };
  } catch (error) {
    logger.error(`디바이스 연결 상태 확인 실패: ${deviceId}`, error.message);

    // 오류 시 기본값 반환 (테스트로 가정하여 연결 가능하게)
    return {
      device: {
        id: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        status: 'online', // 오류 시 온라인으로 처리
        isTest: true
      },
      isConnected: true, // 오류 시 연결된 것으로 처리
      isTestDevice: true,
      exists: false,
      error: error.message
    };
  }
}

// ✅ 수정: 디바이스 자동 연결 시도 함수
async function attemptDeviceConnection(deviceId, device, isTestDevice) {
  try {
    if (isTestDevice) {
      logger.info(`🧪 테스트 디바이스 자동 연결 시도: ${deviceId}`);

      // 테스트 디바이스 자동 연결
      await displayService.connectDevice(deviceId);

      // 연결 확인
      const isNowConnected = displayService.isDeviceConnected(deviceId);

      if (isNowConnected) {
        logger.info(`✅ 테스트 디바이스 자동 연결 성공: ${deviceId}`);
        return { success: true, isTest: true };
      } else {
        logger.warn(`⚠️ 테스트 디바이스 자동 연결 실패: ${deviceId}`);
        return { success: false, isTest: true };
      }
    } else {
      // 실제 디바이스는 자동 연결하지 않음 (사용자가 수동으로 연결해야 함)
      logger.warn(`실제 디바이스는 수동 연결 필요: ${deviceId}`);
      return { success: false, isTest: false, needsManualConnection: true };
    }
  } catch (error) {
    logger.error(`디바이스 자동 연결 실패: ${deviceId}`, error.message);
    return { success: false, error: error.message, isTest: isTestDevice };
  }
}

// GET /api/messages - 인증 미들웨어 추가하고 안전한 기본 응답
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    deviceId,
    status
  } = req.query;

  console.log('메시지 목록 조회 요청:', {
    limit,
    sortBy,
    sortOrder,
    deviceId,
    status,
    user: req.user?.username || 'anonymous'
  });

  try {
    // 필터 옵션 설정
    const options = {
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    if (deviceId) options.deviceId = deviceId;
    if (status) options.status = Array.isArray(status) ? status : [status];

    // 권한에 따른 필터링 (안전하게 처리)
    if (req.user && req.user.role !== 'admin') {
      options.createdBy = req.user.id;
    }

    // 메시지 조회
    const messages = Message.findAll(options);

    // 디바이스 이름 추가 (안전하게 처리)
    const messagesWithDeviceNames = messages.map(message => {
      try {
        const device = Device.findById(message.deviceId);
        return {
          ...message.toJSON(),
          deviceName: device ? device.name : 'Unknown Device'
        };
      } catch (error) {
        return {
          ...message,
          deviceName: 'Unknown Device'
        };
      }
    });

    res.json({
      success: true,
      messages: messagesWithDeviceNames,
      totalCount: messagesWithDeviceNames.length,
      filters: options
    });

  } catch (error) {
    console.error('메시지 목록 조회 실패:', error);
    res.json({
      success: true,
      messages: [], // 에러 시 빈 배열 반환
      totalCount: 0,
      message: '메시지 목록을 불러올 수 없습니다.',
      error: error.message
    });
  }
}));

// 디바이스별 사용 중인 방번호 목록 조회
router.get('/rooms/:deviceId', authenticate, catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  console.log('🔧 방번호 조회 API 호출:', { deviceId });

  // 디바이스 존재 확인
  const device = Device.findById(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      message: '디바이스를 찾을 수 없습니다.'
    });
  }

  // 🔧 메시지 저장 상태 확인
  const allDeviceMessages = Message.findByDeviceId(deviceId);
  const activeMessages = allDeviceMessages.filter(m => ['pending', 'sending', 'sent', 'active'].includes(m.status));

  console.log('🔧 디바이스 메시지 상태 확인:', {
    deviceId: deviceId,
    전체메시지수: allDeviceMessages.length,
    활성메시지수: activeMessages.length,
    활성메시지목록: activeMessages.map(m => ({
      id: m.id,
      roomNumber: m.roomNumber,
      content: m.content?.substring(0, 20),
      status: m.status,
      urgent: m.urgent
    }))
  });

  const usedRooms = Message.getUsedRoomNumbers(deviceId);
  const availableRooms = [];

  // 사용 가능한 방번호 계산
  for (let i = 1; i <= 100; i++) {
    if (!usedRooms.includes(i)) {
      availableRooms.push(i);
    }
  }

  // 방번호별 메시지 정보
  const roomMessages = {};
  usedRooms.forEach(roomNumber => {
    const roomMessages_list = Message.findByRoomNumber(deviceId, roomNumber);
    roomMessages[roomNumber] = roomMessages_list.map(msg => ({
      id: msg.id,
      content: msg.content?.substring(0, 50) + (msg.content?.length > 50 ? '...' : ''),
      status: msg.status,
      createdAt: msg.createdAt,
      urgent: msg.urgent
    }));
  });

  console.log('🔧 방번호 조회 결과:', {
    deviceId: deviceId,
    사용중인방번호: usedRooms,
    긴급방번호: usedRooms.filter(r => r >= 1 && r <= 5),
    일반방번호: usedRooms.filter(r => r >= 6 && r <= 100),
    방별메시지수: Object.keys(roomMessages).map(room => ({
      방번호: room,
      메시지수: roomMessages[room].length
    }))
  });

  res.json({
    success: true,
    device: {
      ...device.toJSON(),
      isTest: displayService.isTestDevice(device),
      connected: displayService.isDeviceConnected(deviceId)
    },
    usedRooms,
    availableRooms: {
      urgent: availableRooms.filter(r => r >= 1 && r <= 5),      // 긴급용 (1-5)
      normal: availableRooms.filter(r => r >= 6 && r <= 100)     // 일반용 (6-100)
    },
    roomMessages,
    totalRooms: 100,
    usedCount: usedRooms.length,
    availableCount: availableRooms.length,
    // 🔧 디버깅 정보 추가
    debugInfo: {
      totalMessages: allDeviceMessages.length,
      activeMessages: activeMessages.length,
      messagesByStatus: allDeviceMessages.reduce((acc, msg) => {
        acc[msg.status] = (acc[msg.status] || 0) + 1;
        return acc;
      }, {}),
      roomNumberDistribution: usedRooms.reduce((acc, room) => {
        const type = room <= 5 ? 'urgent' : 'normal';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    }
  });
}));

// 특정 방번호의 메시지 조회
router.get('/rooms/:deviceId/:roomNumber', authenticate, catchAsync(async (req, res) => {
  const { deviceId, roomNumber } = req.params;

  const messages = Message.findByRoomNumber(deviceId, parseInt(roomNumber));

  // 권한 확인
  const filteredMessages = req.user.role === 'admin' ?
    messages :
    messages.filter(message => message.createdBy === req.user.id);

  const device = Device.findById(deviceId);

  res.json({
    success: true,
    device: device ? {
      ...device.toJSON(),
      isTest: displayService.isTestDevice(device),
      connected: displayService.isDeviceConnected(deviceId)
    } : null,
    roomNumber: parseInt(roomNumber),
    messages: filteredMessages.map(msg => msg.toJSON()),
    messageCount: filteredMessages.length
  });
}));

// 방번호별 메시지 삭제
router.delete('/rooms/:deviceId/:roomNumber', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId, roomNumber } = req.params;

  // 디바이스 존재 확인
  const device = Device.findById(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      message: '디바이스를 찾을 수 없습니다.'
    });
  }

  const roomNum = parseInt(roomNumber);

  // 해당 방의 메시지들 조회
  const roomMessages = Message.findByRoomNumber(deviceId, roomNum);

  if (roomMessages.length === 0) {
    return res.status(404).json({
      success: false,
      message: '해당 방번호에 메시지가 없습니다.'
    });
  }

  // 권한 확인: 자신이 생성한 메시지만 삭제 가능 (관리자는 모든 메시지)
  const canDeleteAll = req.user.role === 'admin' ||
    roomMessages.every(msg => msg.createdBy === req.user.id);

  if (!canDeleteAll) {
    return res.status(403).json({
      success: false,
      message: '이 방의 모든 메시지를 삭제할 권한이 없습니다.'
    });
  }

  // 전광판에 방정보 삭제 명령 전송 (연결된 경우만)
  if (displayService.isDeviceConnected(deviceId)) {
    try {
      await displayService.sendCommand(deviceId,
        Message.ProtocolCommand.DELETE_ROOM,
        { roomNumber: roomNum }
      );

      logger.info(`방정보 삭제 명령 전송 성공: ${device.name}, 방번호: ${roomNum}`);
    } catch (error) {
      logger.error(`전광판 방정보 삭제 실패: ${deviceId}, 방번호: ${roomNum}`, error);
      // 명령 전송이 실패해도 데이터베이스에서는 삭제 진행
    }
  } else {
    logger.warn(`디바이스가 연결되어 있지 않음: ${device.name}, 방번호: ${roomNum} (데이터베이스에서만 삭제)`);
  }

  // 데이터베이스에서 메시지 삭제
  const deletedCount = Message.deleteByRoomNumber(deviceId, roomNum);

  logger.info(`방정보 삭제: ${device.name}, 방번호: ${roomNum}, 삭제된 메시지: ${deletedCount}개 by ${req.user.username}`);

  res.json({
    success: true,
    message: `방번호 ${roomNum}의 메시지 ${deletedCount}개가 삭제되었습니다.`,
    deletedCount,
    roomNumber: roomNum,
    isTest: displayService.isTestDevice(device)
  });
}));

// 특정 메시지 조회
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const message = Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: '메시지를 찾을 수 없습니다.'
    });
  }

  // 권한 확인: 자신이 생성한 메시지만 조회 가능 (관리자는 모든 메시지)
  if (req.user.role !== 'admin' && message.createdBy !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: '이 메시지에 접근할 권한이 없습니다.'
    });
  }

  const device = Device.findById(message.deviceId);
  const messageWithDeviceName = {
    ...message.toJSON(),
    deviceName: device ? device.name : 'Unknown Device'
  };

  res.json({
    success: true,
    message: messageWithDeviceName
  });
}));

// 🔧 개선된 텍스트 메시지 전송
router.post('/text', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const {
    deviceId,
    content,
    priority,
    urgent,
    roomNumber,
    displayOptions,
    schedule,
    conversionInfo,
    imageUrl,
    tcpTarget
  } = req.body;

  // 입력값 검증
  if (!deviceId || (!content && !imageUrl)) {
    return res.status(400).json({
      success: false,
      message: '디바이스 ID와 메시지 내용 또는 이미지 URL이 필요합니다.'
    });
  }

  // 방번호 유효성 검증
  if (roomNumber && (roomNumber < 1 || roomNumber > 100)) {
    return res.status(400).json({
      success: false,
      message: '방번호는 1~100 사이여야 합니다.'
    });
  }

  // 긴급 메시지 방번호 검증
  if (urgent && roomNumber && (roomNumber < 1 || roomNumber > 5)) {
    return res.status(400).json({
      success: false,
      message: '긴급 메시지는 1~5번 방을 사용해야 합니다.'
    });
  }

  try {
    // 🔧 개선된 디바이스 연결 상태 확인
    const connectionInfo = checkDeviceConnection(deviceId);
    const { device, isConnected, isTestDevice, exists } = connectionInfo;

    logger.info(`디바이스 연결 확인 완료: ${deviceId}`, {
      exists: exists,
      isConnected: isConnected,
      isTestDevice: isTestDevice,
      deviceName: device.name,
      deviceStatus: device.status
    });

    // 🔧 연결되지 않은 경우 처리 (간소화)
    if (!isConnected) {
      logger.warn(`디바이스가 연결되어 있지 않음: ${deviceId} (테스트: ${isTestDevice})`);

      // 테스트 디바이스든 실제 디바이스든 자동 연결 시도
      try {
        const connectionResult = await attemptDeviceConnection(deviceId, device, isTestDevice);

        if (!connectionResult.success) {
          // 자동 연결 실패 시에도 강제로 MQTT 전송 시도 (온라인 상태라면)
          if (device.status === 'online') {
            logger.info(`디바이스가 온라인 상태이므로 연결 실패에도 불구하고 MQTT 전송 시도: ${deviceId}`);
          } else {
            return res.status(400).json({
              success: false,
              message: `디바이스 연결에 실패했습니다: ${connectionResult.error || '알 수 없는 오류'}`,
              isTest: isTestDevice,
              deviceId: deviceId,
              deviceName: device.name,
              suggestion: '디바이스 관리 페이지에서 수동으로 연결하거나 디바이스 상태를 확인해주세요.'
            });
          }
        } else {
          logger.info(`디바이스 자동 연결 성공: ${deviceId}`);
        }
      } catch (connectionError) {
        logger.error(`디바이스 자동 연결 중 오류: ${deviceId}`, connectionError.message);

        // 연결 오류가 있어도 온라인 상태라면 MQTT 전송 시도
        if (device.status !== 'online') {
          return res.status(400).json({
            success: false,
            message: `디바이스 연결 오류: ${connectionError.message}`,
            isTest: isTestDevice,
            deviceId: deviceId,
            deviceName: device.name
          });
        }
      }
    }

    // 메시지 데이터 구성
    const messageData = {
      deviceId,
      content: content || `이미지 메시지 (${imageUrl})`,
      priority: priority || Message.Priority.NORMAL,
      urgent: urgent || false,
      roomNumber: roomNumber,
      displayOptions: {
        displayEffect: Message.DisplayEffect.DIRECT,
        displayEffectSpeed: 0x04,
        displayWaitTime: 1,
        endEffect: Message.EndEffect.DIRECT_DISAPPEAR,
        endEffectSpeed: 0x04,
        sirenOutput: false,
        ...displayOptions
      },
      schedule: schedule || {},
      createdBy: req.user.id,
      conversionInfo,
      imageUrl,
      tcpTarget
    };

    // 메시지 전송
    console.log('🚨🚨🚨 라우터에서 displayService.sendTextMessage 호출 직전 🚨🚨🚨');
    console.log('🚨 메시지 데이터:', { deviceId, urgent: messageData.urgent, roomNumber: messageData.roomNumber });

    const result = await displayService.sendTextMessage(deviceId, messageData);

    console.log('🚨🚨🚨 displayService.sendTextMessage 호출 완료 🚨🚨🚨');
    console.log('🚨 결과:', { messageId: result.message?.id, roomNumber: result.message?.roomNumber });

    logger.info(`텍스트 메시지 전송 성공: ${device.name}, 방번호: ${result.message.roomNumber} by ${req.user.username}`, {
      content: (content || '이미지').substring(0, 50) + '...',
      roomNumber: result.message.roomNumber,
      isTest: isTestDevice,
      hasImageUrl: !!imageUrl,
      hasConversionInfo: !!conversionInfo,
      messageId: result.message.id
    });

    res.json({
      ...result,
      deviceName: device.name,
      isTest: isTestDevice,
      connectionInfo: {
        wasConnected: isConnected,
        isTestDevice: isTestDevice,
        autoConnected: isTestDevice && !isConnected
      }
    });

  } catch (error) {
    logger.error(`텍스트 메시지 전송 실패: ${deviceId}`, error);

    res.status(500).json({
      success: false,
      message: `메시지 전송에 실패했습니다: ${error.message}`,
      isTest: false,
      deviceId: deviceId,
      error: error.message
    });
  }
}));

// 🔧 개선된 이미지 메시지 전송
router.post('/image', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const {
    deviceId,
    imageData,
    priority,
    urgent,
    roomNumber,
    displayOptions,
    schedule
  } = req.body;

  // 입력값 검증
  if (!deviceId || !imageData) {
    return res.status(400).json({
      success: false,
      message: '디바이스 ID와 이미지 데이터가 필요합니다.'
    });
  }

  try {
    // 디바이스 연결 상태 확인
    const connectionInfo = checkDeviceConnection(deviceId);
    const { device, isConnected, isTestDevice } = connectionInfo;

    // 연결되지 않은 경우 처리
    if (!isConnected) {
      if (isTestDevice) {
        const connectionResult = await attemptDeviceConnection(deviceId, device, isTestDevice);
        if (!connectionResult.success) {
          return res.status(400).json({
            success: false,
            message: '테스트 디바이스 연결에 실패했습니다.',
            isTest: true
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: '디바이스가 연결되어 있지 않습니다.',
          isTest: false
        });
      }
    }

    const messageData = {
      deviceId,
      imageData,
      priority: priority || Message.Priority.NORMAL,
      urgent: urgent || false,
      roomNumber: roomNumber,
      displayOptions: {
        displayEffect: Message.DisplayEffect.DIRECT,
        displayEffectSpeed: 0x04,
        displayWaitTime: 1,
        endEffect: Message.EndEffect.DIRECT_DISAPPEAR,
        endEffectSpeed: 0x04,
        sirenOutput: false,
        ...displayOptions
      },
      schedule: schedule || {},
      createdBy: req.user.id,
      conversionInfo: req.body.conversionInfo,
      imageUrl: req.body.imageUrl,
      tcpTarget: req.body.tcpTarget
    };

    const result = await displayService.sendImageMessage(deviceId, messageData);

    logger.info(`이미지 메시지 전송 성공: ${device.name}, 방번호: ${result.message.roomNumber} by ${req.user.username}`);

    res.json({
      ...result,
      deviceName: device.name,
      isTest: isTestDevice
    });

  } catch (error) {
    logger.error(`이미지 메시지 전송 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: `이미지 메시지 전송에 실패했습니다: ${error.message}`,
      isTest: false
    });
  }
}));

// 복합 메시지 전송
router.post('/mixed', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const {
    deviceId,
    components,
    priority,
    urgent,
    roomNumber,
    displayOptions,
    schedule
  } = req.body;

  // 입력값 검증
  if (!deviceId || !components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({
      success: false,
      message: '디바이스 ID와 유효한 컴포넌트 배열이 필요합니다.'
    });
  }

  try {
    // 디바이스 연결 상태 확인
    const connectionInfo = checkDeviceConnection(deviceId);
    const { device, isConnected, isTestDevice } = connectionInfo;

    // 연결되지 않은 경우 처리
    if (!isConnected) {
      if (isTestDevice) {
        const connectionResult = await attemptDeviceConnection(deviceId, device, isTestDevice);
        if (!connectionResult.success) {
          return res.status(400).json({
            success: false,
            message: '테스트 디바이스 연결에 실패했습니다.',
            isTest: true
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: '디바이스가 연결되어 있지 않습니다.',
          isTest: false
        });
      }
    }

    const messageData = {
      deviceId,
      components,
      priority: priority || Message.Priority.NORMAL,
      urgent: urgent || false,
      roomNumber: roomNumber,
      displayOptions: {
        displayEffect: Message.DisplayEffect.DIRECT,
        displayEffectSpeed: 0x04,
        displayWaitTime: 1,
        endEffect: Message.EndEffect.DIRECT_DISAPPEAR,
        endEffectSpeed: 0x04,
        sirenOutput: false,
        ...displayOptions
      },
      schedule: schedule || {},
      createdBy: req.user.id,
      conversionInfo: req.body.conversionInfo,
      imageUrl: req.body.imageUrl,
      tcpTarget: req.body.tcpTarget
    };

    const result = await displayService.sendMixedMessage(deviceId, messageData);

    logger.info(`복합 메시지 전송 성공: ${device.name}, 방번호: ${result.message.roomNumber} by ${req.user.username}`, {
      components: components.length
    });

    res.json({
      ...result,
      deviceName: device.name,
      isTest: isTestDevice
    });

  } catch (error) {
    logger.error(`복합 메시지 전송 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: `복합 메시지 전송에 실패했습니다: ${error.message}`,
      isTest: false
    });
  }
}));

// 🆕 방정보 요구 API
router.post('/request-room-info/:deviceId/:roomNumber', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId, roomNumber } = req.params;

  // 디바이스 존재 확인
  const device = Device.findById(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      message: '디바이스를 찾을 수 없습니다.'
    });
  }

  const isTestDevice = displayService.isTestDevice(device);

  // 연결 상태 확인
  if (!displayService.isDeviceConnected(deviceId)) {
    return res.status(400).json({
      success: false,
      message: '디바이스가 연결되어 있지 않습니다.',
      isTest: isTestDevice
    });
  }

  const roomNum = parseInt(roomNumber);

  try {
    // 방정보 요구 명령 전송
    const result = await displayService.sendCommand(
      deviceId,
      Message.ProtocolCommand.REQUEST_ROOM_INFO,
      { roomNumber: roomNum }
    );

    logger.info(`방정보 요구 ${isTestDevice ? '(테스트)' : ''}: ${device.name}, 방번호: ${roomNum} by ${req.user.username}`);

    res.json({
      success: true,
      message: `방번호 ${roomNum}의 정보를 요청했습니다.`,
      result,
      isTest: isTestDevice
    });
  } catch (error) {
    logger.error(`방정보 요구 실패: ${deviceId}, 방번호: ${roomNum}`, error);
    res.status(500).json({
      success: false,
      message: '방정보 요구에 실패했습니다.',
      error: error.message,
      isTest: isTestDevice
    });
  }
}));

// 🆕 전체 메시지 삭제 API
router.delete('/all/:deviceId', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  // 디바이스 존재 확인
  const device = Device.findById(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      message: '디바이스를 찾을 수 없습니다.'
    });
  }

  // 해당 디바이스의 모든 메시지 조회
  const allMessages = Message.findByDeviceId(deviceId);

  // 권한 확인: 자신이 생성한 메시지만 삭제 가능 (관리자는 모든 메시지)
  const canDeleteAll = req.user.role === 'admin' ||
    allMessages.every(msg => msg.createdBy === req.user.id);

  if (!canDeleteAll) {
    return res.status(403).json({
      success: false,
      message: '모든 메시지를 삭제할 권한이 없습니다.'
    });
  }

  const isTestDevice = displayService.isTestDevice(device);

  try {
    // displayService를 통해 전체 삭제
    const result = await displayService.clearAllMessages(deviceId);

    logger.info(`전체 메시지 삭제 ${isTestDevice ? '(테스트)' : ''}: ${device.name}, 삭제된 메시지: ${result.deletedCount}개 by ${req.user.username}`);

    res.json({
      success: true,
      message: result.message,
      deletedCount: result.deletedCount,
      isTest: isTestDevice
    });

  } catch (error) {
    logger.error(`전체 메시지 삭제 실패: ${deviceId}`, error);

    // 연결되어 있지 않은 경우 데이터베이스에서만 삭제
    let deletedCount = 0;
    allMessages.forEach(message => {
      if (req.user.role === 'admin' || message.createdBy === req.user.id) {
        Message.delete(message.id);
        deletedCount++;
      }
    });

    res.json({
      success: true,
      message: `${deletedCount}개의 메시지가 데이터베이스에서 삭제되었습니다. (전광판 연결 오류)`,
      deletedCount,
      isTest: isTestDevice,
      warning: '전광판과의 통신 오류로 인해 데이터베이스에서만 삭제되었습니다.'
    });
  }
}));

// 메시지 수정
router.put('/:id', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const message = Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: '메시지를 찾을 수 없습니다.'
    });
  }

  // 권한 확인: 자신이 생성한 메시지만 수정 가능 (관리자는 모든 메시지)
  if (req.user.role !== 'admin' && message.createdBy !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: '이 메시지를 수정할 권한이 없습니다.'
    });
  }

  // 활성 상태인 메시지는 수정 불가
  if (['sending', 'active'].includes(message.status)) {
    return res.status(400).json({
      success: false,
      message: '전송 중이거나 활성 상태인 메시지는 수정할 수 없습니다.'
    });
  }

  const updatedMessage = Message.update(req.params.id, req.body);

  logger.info(`메시지 수정: ${req.params.id} by ${req.user.username}`);

  res.json({
    success: true,
    message: '메시지가 수정되었습니다.',
    data: updatedMessage.toJSON()
  });
}));

// 메시지 삭제
router.delete('/:id', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const message = Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: '메시지를 찾을 수 없습니다.'
    });
  }

  // 권한 확인: 자신이 생성한 메시지만 삭제 가능 (관리자는 모든 메시지)
  if (req.user.role !== 'admin' && message.createdBy !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: '이 메시지를 삭제할 권한이 없습니다.'
    });
  }

  // 활성 상태인 메시지는 전광판에서도 삭제
  if (['sending', 'active'].includes(message.status)) {
    if (displayService.isDeviceConnected(message.deviceId)) {
      try {
        // 방번호로 삭제 (개별 메시지 삭제는 방번호 단위로 처리)
        await displayService.sendCommand(
          message.deviceId,
          Message.ProtocolCommand.DELETE_ROOM,
          { roomNumber: message.roomNumber }
        );
      } catch (error) {
        logger.error(`전광판에서 메시지 삭제 실패: ${message.id}`, error);
      }
    }
  }

  Message.delete(req.params.id);

  logger.info(`메시지 삭제: ${req.params.id} by ${req.user.username}`);

  res.json({
    success: true,
    message: '메시지가 삭제되었습니다.'
  });
}));

// 디바이스별 메시지 조회
router.get('/device/:deviceId', authenticate, catchAsync(async (req, res) => {
  const { status, type, limit } = req.query;

  const options = {
    deviceId: req.params.deviceId
  };

  if (status) options.status = Array.isArray(status) ? status : [status];
  if (type) options.type = type;
  if (limit) options.limit = parseInt(limit);

  // 권한 확인: 자신이 생성한 메시지만 조회 가능 (관리자는 모든 메시지)
  if (req.user.role !== 'admin') {
    options.createdBy = req.user.id;
  }

  const messages = Message.findAll(options);
  const device = Device.findById(req.params.deviceId);

  res.json({
    success: true,
    device: device ? {
      ...device.toJSON(),
      isTest: displayService.isTestDevice(device),
      connected: displayService.isDeviceConnected(req.params.deviceId)
    } : null,
    messages,
    totalCount: messages.length
  });
}));

// 활성 메시지 조회
router.get('/active/:deviceId?', authenticate, catchAsync(async (req, res) => {
  const deviceId = req.params.deviceId;
  const activeMessages = Message.getActiveMessages(deviceId);

  // 권한 확인: 자신이 생성한 메시지만 조회 가능 (관리자는 모든 메시지)
  const filteredMessages = req.user.role === 'admin' ?
    activeMessages :
    activeMessages.filter(message => message.createdBy === req.user.id);

  // 디바이스 이름 추가
  const messagesWithDeviceNames = filteredMessages.map(message => {
    const device = Device.findById(message.deviceId);
    return {
      ...message.toJSON(),
      deviceName: device ? device.name : 'Unknown Device',
      isTest: device ? displayService.isTestDevice(device) : false
    };
  });

  res.json({
    success: true,
    messages: messagesWithDeviceNames,
    totalCount: messagesWithDeviceNames.length
  });
}));

// 메시지 통계
router.get('/stats/:deviceId?', authenticate, catchAsync(async (req, res) => {
  const deviceId = req.params.deviceId;
  const stats = Message.getStats(deviceId);

  res.json({
    success: true,
    stats
  });
}));

// 🆕 TCP/IP 연결 테스트 API
router.post('/test-tcp', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { host, port, testData } = req.body;

  const testHost = host || process.env.WEB_SERVER_HOST || '192.168.1.100';
  const testPort = port || 7200;
  const testMessage = testData || 'TEST_MESSAGE';

  try {
    logger.info(`TCP/IP 연결 테스트 시작: ${testHost}:${testPort}`);

    // 간단한 테스트 프로토콜 데이터 생성
    const testProtocolData = Buffer.from(testMessage, 'utf8');

    const result = await displayService.sendTcpMessage(testHost, testPort, testProtocolData);

    logger.info(`TCP/IP 연결 테스트 성공: ${testHost}:${testPort}`);

    res.json({
      success: true,
      message: 'TCP/IP 연결 테스트 성공',
      target: `${testHost}:${testPort}`,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`TCP/IP 연결 테스트 실패: ${testHost}:${testPort}`, error.message);

    res.status(500).json({
      success: false,
      message: `TCP/IP 연결 테스트 실패: ${error.message}`,
      target: `${testHost}:${testPort}`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// 🆕 디바이스 연결 상태 확인 API (디버깅 강화)
router.get('/device-status/:deviceId', authenticate, catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  try {
    const connectionInfo = checkDeviceConnection(deviceId);

    // 추가 디버깅 정보
    const debugInfo = {
      originalDevice: Device.findById(deviceId),
      displayServiceMethods: {
        isTestDevice: typeof displayService.isTestDevice,
        isDeviceConnected: typeof displayService.isDeviceConnected,
        connectDevice: typeof displayService.connectDevice
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        debugMode: process.env.DEBUG_MQTT === 'true'
      }
    };

    res.json({
      success: true,
      deviceId: deviceId,
      ...connectionInfo,
      debugInfo: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`디바이스 상태 확인 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: '디바이스 상태 확인에 실패했습니다.',
      error: error.message,
      stack: error.stack
    });
  }
}));

// 🆕 MQTT 토픽 패턴 테스트 API
router.post('/test-mqtt-topics/:deviceId', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  try {
    logger.info(`MQTT 토픽 패턴 테스트 시작: ${deviceId}`);

    // displayService의 토픽 패턴 테스트 함수 호출
    const results = await displayService.testTopicPatterns(deviceId);

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.json({
      success: true,
      message: `MQTT 토픽 패턴 테스트 완료: ${successCount}/${totalCount} 성공`,
      deviceId: deviceId,
      results: results,
      successCount: successCount,
      totalCount: totalCount,
      successfulTopics: results.filter(r => r.success).map(r => r.topic),
      failedTopics: results.filter(r => !r.success).map(r => r.topic),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`MQTT 토픽 패턴 테스트 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: '토픽 패턴 테스트에 실패했습니다.',
      error: error.message
    });
  }
}));
router.post('/force-test-mode/:deviceId', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  try {
    const device = Device.findById(deviceId);

    if (device) {
      // 디바이스가 존재하면 테스트 모드로 설정
      device.isTest = true;
      device.specs = device.specs || {};
      device.specs.model = 'TEST_DEVICE';

      logger.info(`디바이스 강제 테스트 모드 설정: ${deviceId}`);
    }

    // 테스트 디바이스로 연결 시도
    const connectionResult = await attemptDeviceConnection(deviceId, device || {
      id: deviceId,
      name: `테스트 전광판 ${deviceId.slice(-4)}`,
      isTest: true,
      specs: { model: 'TEST_DEVICE' }
    }, true);

    res.json({
      success: true,
      message: `디바이스 ${deviceId}를 테스트 모드로 설정하고 연결을 시도했습니다.`,
      connectionResult: connectionResult,
      device: device
    });

  } catch (error) {
    logger.error(`강제 테스트 모드 설정 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: '강제 테스트 모드 설정에 실패했습니다.',
      error: error.message
    });
  }
}));

// 🆕 디바이스 수동 연결 API
router.post('/connect-device/:deviceId', authenticate, authorize('message_send'), catchAsync(async (req, res) => {
  const { deviceId } = req.params;

  try {
    const connectionInfo = checkDeviceConnection(deviceId);
    const { device, isConnected, isTestDevice } = connectionInfo;

    if (isConnected) {
      return res.json({
        success: true,
        message: '디바이스가 이미 연결되어 있습니다.',
        isTest: isTestDevice,
        device: device
      });
    }

    logger.info(`수동 디바이스 연결 시도: ${deviceId} (테스트: ${isTestDevice})`);

    const connectionResult = await attemptDeviceConnection(deviceId, device, isTestDevice);

    if (connectionResult.success) {
      res.json({
        success: true,
        message: `디바이스 연결 성공: ${device.name}`,
        isTest: isTestDevice,
        device: device,
        connectionMethod: isTestDevice ? '테스트 모드' : 'MQTT'
      });
    } else {
      res.status(400).json({
        success: false,
        message: `디바이스 연결 실패: ${connectionResult.error || '알 수 없는 오류'}`,
        isTest: isTestDevice,
        device: device
      });
    }

  } catch (error) {
    logger.error(`수동 디바이스 연결 실패: ${deviceId}`, error);
    res.status(500).json({
      success: false,
      message: '디바이스 연결에 실패했습니다.',
      error: error.message
    });
  }
}));

// ✅ 수정: 인증이 없는 기본 테스트 엔드포인트 추가
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Messages API 테스트 성공',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/messages - 메시지 목록 조회 (인증 필요)',
      'POST /api/messages/text - 텍스트 메시지 전송 (인증 필요)',
      'POST /api/messages/image - 이미지 메시지 전송 (인증 필요)',
      'GET /api/messages/test - API 테스트 (인증 불필요)',
      'GET /api/messages/device-status/:deviceId - 디바이스 상태 확인',
      'POST /api/messages/connect-device/:deviceId - 디바이스 수동 연결',
      'POST /api/messages/force-test-mode/:deviceId - 디바이스 강제 테스트 모드'
    ],
    debugCommands: [
      '다음 URL로 디바이스 상태 확인:',
      'http://localhost:5002/api/messages/device-status/33b6d78b3691',
      '',
      '다음 URL로 강제 테스트 모드 설정:',
      'http://localhost:5002/api/messages/force-test-mode/33b6d78b3691 (POST)',
      '',
      '브라우저 개발자 도구에서 다음 실행:',
      'fetch("/api/messages/force-test-mode/33b6d78b3691", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer YOUR_TOKEN"}})'
    ]
  });
});

module.exports = router;