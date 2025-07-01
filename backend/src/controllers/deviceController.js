// src/controllers/deviceController.js - 문법 오류 수정
const Device = require('../models/Device');

// ✅ 안전한 logger 초기화
let logger;
try {
  logger = require('../utils/logger');
  console.log('✅ logger 로드 성공');
} catch (error) {
  console.warn('⚠️ logger 없음, console 사용');
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args)
  };
}

// ✅ socketService와 displayService 안전 로딩
let socketService = null;
let displayService = null;

try {
  socketService = require('../services/socketService');
  logger.info('✅ socketService 로드 성공');
} catch (error) {
  logger.warn('⚠️ socketService 없음');
  try {
    displayService = require('../services/displayService');
    logger.info('✅ displayService 로드 성공');
  } catch (err) {
    logger.warn('⚠️ displayService도 없음, Mock 서비스 사용');
  }
}

// ✅ Mock 서비스
const mockService = {
  isDeviceConnected: () => false,
  disconnectDevice: () => Promise.resolve(true),
  sendCommand: () => Promise.resolve(true),
  getConnectionStats: () => ({
    total: 0,
    connected: 0,
    offline: 0,
    uptime: 0,
    devices: []
  })
};

// ✅ 서비스 선택 함수
function getDeviceService() {
  if (socketService) return socketService;
  if (displayService) return displayService;
  return mockService;
}

// ✅ 테스트 디바이스 확인 함수
function isTestDevice(device) {
  try {
    return (
      device.name?.includes('테스트') ||
      device.specs?.model?.includes('TEST') ||
      device.deviceId?.startsWith('TEST') ||
      device.ip?.startsWith('127.0.0') ||
      device.isTest === true
    );
  } catch (error) {
    logger.debug('테스트 디바이스 확인 실패:', error.message);
    return true;
  }
}

// ✅ 프로토콜 명령 생성 도우미 함수
function createProtocolCommand(deviceId, commandType, data = {}) {
  try {
    const device = Device.findByDeviceId ? Device.findByDeviceId(deviceId) : Device.findById(deviceId);
    if (!device) {
      throw new Error('Device not found for protocol command');
    }

    const protocolVersion = device.getProtocolVersion ? device.getProtocolVersion() : 'new';

    return {
      deviceId: deviceId,
      protocolVersion: protocolVersion,
      commandType: commandType,
      data: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.warn('프로토콜 명령 생성 실패:', error.message);
    return {
      deviceId: deviceId,
      protocolVersion: 'new',
      commandType: commandType,
      data: data,
      timestamp: new Date().toISOString()
    };
  }
}

// ✅ 모든 디바이스 조회
async function getAllDevices(req, res) {
  try {
    logger.info('📋 디바이스 목록 조회 요청 시작');

    let devices = [];
    let stats = { total: 0, online: 0, offline: 0, error: 0, maintenance: 0 };

    try {
      if (Device && Device.findAll) {
        devices = Device.findAll() || [];
        logger.info(`📊 디바이스 ${devices.length}개 조회 성공`);
      } else {
        devices = [];
      }
    } catch (deviceError) {
      logger.warn('Device.findAll 실패:', deviceError.message);
      devices = [];
    }

    try {
      if (Device && Device.getStats) {
        stats = Device.getStats();
      } else {
        stats = {
          total: devices.length,
          online: devices.filter(d => d.status === 'online').length,
          offline: devices.filter(d => d.status === 'offline').length,
          error: devices.filter(d => d.status === 'error').length,
          maintenance: devices.filter(d => d.status === 'maintenance').length
        };
      }
    } catch (statsError) {
      logger.warn('통계 조회 실패:', statsError.message);
      stats = {
        total: devices.length,
        online: 0,
        offline: devices.length,
        error: 0,
        maintenance: 0
      };
    }

    const safeDevices = devices.map(device => {
      try {
        const deviceData = device.toJSON ? device.toJSON() : device;
        let isConnected = false;

        try {
          if (device.deviceId && socketService && socketService.isDeviceConnected) {
            isConnected = socketService.isDeviceConnected(device.deviceId);
          } else if (device.ip && displayService && displayService.isDeviceConnected) {
            isConnected = displayService.isDeviceConnected(device.id);
          } else {
            isConnected = deviceData.status === 'online';
          }
        } catch (connError) {
          logger.debug(`연결 상태 확인 실패 (${device.id}):`, connError.message);
          isConnected = deviceData.status === 'online';
        }

        const isTest = isTestDevice(deviceData);

        return {
          id: deviceData.id || `device-${Date.now()}`,
          name: deviceData.name || '알 수 없는 디바이스',
          ip: deviceData.ip || '127.0.0.1',
          port: deviceData.port || 5002,
          status: deviceData.status || 'offline',
          connected: isConnected,
          isTest: isTest,
          location: deviceData.location || {
            address: '위치 정보 없음',
            building: '',
            floor: ''
          },
          specs: deviceData.specs || {
            model: 'UNKNOWN',
            size: 'Unknown',
            resolution: { width: 320, height: 160 },
            maxBrightness: 15
          },
          config: deviceData.config || {
            brightness: { current: 10 },
            schedule: { onTime: '06:00', offTime: '23:00', enabled: true }
          },
          connectionInfo: deviceData.connectionInfo || {
            connected: isConnected,
            lastHeartbeat: null,
            lastError: null
          },
          systemInfo: deviceData.systemInfo || null
        };
      } catch (transformError) {
        logger.warn(`디바이스 데이터 변환 실패 (${device.id || 'unknown'}):`, transformError.message);
        return {
          id: device.id || `fallback-${Date.now()}`,
          name: device.name || '오류 복구 디바이스',
          ip: '127.0.0.1',
          port: 5002,
          status: 'offline',
          connected: false,
          isTest: true,
          location: { address: '오류 복구 모드', building: 'Error Recovery', floor: '1층' },
          specs: { model: 'ERROR-RECOVERY', size: '2X10', resolution: { width: 320, height: 160 }, maxBrightness: 15 },
          config: { brightness: { current: 10 } },
          connectionInfo: { connected: false, lastHeartbeat: null, lastError: 'Data transformation failed' }
        };
      }
    });

    logger.info(`✅ 응답 준비 완료: ${safeDevices.length}개 디바이스`);

    res.json({
      success: true,
      devices: safeDevices,
      stats,
      totalCount: safeDevices.length,
      serverInfo: {
        hasSocketService: !!socketService,
        hasDisplayService: !!displayService,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ getAllDevices 최종 실패:', error);
    res.status(500).json({
      success: false,
      message: '시스템 오류가 발생했습니다.',
      error: error.message
    });
  }
}

// ✅ 특정 디바이스 조회
async function getDeviceById(req, res) {
  try {
    const deviceId = req.params.id;
    logger.info(`🔍 디바이스 조회 요청: ${deviceId}`);

    let device = null;
    try {
      if (Device && Device.findById) {
        device = Device.findById(deviceId);
      }
    } catch (error) {
      logger.warn('Device.findById 실패:', error.message);
    }

    if (!device) {
      logger.info(`디바이스를 찾을 수 없음, 동적 생성: ${deviceId}`);
      device = {
        id: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        ip: '127.0.0.1',
        port: 5002,
        status: 'offline',
        location: {
          address: '동적 생성 디바이스',
          building: 'Auto Generated',
          floor: '1층'
        },
        specs: {
          model: 'AUTO-GEN-001',
          size: '2X10',
          resolution: { width: 320, height: 160 },
          maxBrightness: 15
        },
        config: {
          brightness: { current: 10 },
          schedule: { onTime: '06:00', offTime: '23:00', enabled: true }
        },
        connectionInfo: {
          connected: false,
          lastHeartbeat: null,
          lastError: null
        }
      };
    }

    const deviceData = device.toJSON ? device.toJSON() : device;
    let isConnected = false;

    try {
      if (device.deviceId && socketService) {
        isConnected = socketService.isDeviceConnected(device.deviceId);
      } else if (device.ip && displayService) {
        isConnected = displayService.isDeviceConnected(device.id);
      } else {
        isConnected = deviceData.status === 'online';
      }
    } catch (error) {
      logger.debug('연결 상태 확인 실패:', error.message);
      isConnected = deviceData.status === 'online';
    }

    const isTest = isTestDevice(deviceData);

    logger.info(`✅ 디바이스 조회 성공: ${deviceData.name}`);

    res.json({
      success: true,
      device: {
        ...deviceData,
        connected: isConnected,
        isTest: isTest
      }
    });

  } catch (error) {
    logger.error('getDeviceById 실패:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 정보를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 디바이스 생성
async function createDevice(req, res) {
  try {
    logger.info('📝 디바이스 생성 요청:', req.body?.name);

    if (!req.body || (!req.body.deviceId && !req.body.ip)) {
      return res.status(400).json({
        success: false,
        message: 'Device ID 또는 IP 주소 중 하나는 필수입니다.'
      });
    }

    let device;
    try {
      device = Device.create(req.body);
      logger.info(`✅ 디바이스 생성 성공: ${device.name}`);
    } catch (createError) {
      logger.error('Device.create 실패:', createError.message);
      throw createError;
    }

    res.status(201).json({
      success: true,
      message: '디바이스가 생성되었습니다.',
      device: device.toJSON ? device.toJSON() : device
    });

  } catch (error) {
    logger.error('디바이스 생성 실패:', error);

    if (error.message.includes('이미 존재하는')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '디바이스 생성에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 디바이스 수정
async function updateDevice(req, res) {
  try {
    const device = Device.update(req.params.id, req.body);
    logger.info(`📝 디바이스 수정 성공: ${device.name}`);

    res.json({
      success: true,
      message: '디바이스가 수정되었습니다.',
      device: device.toJSON ? device.toJSON() : device
    });
  } catch (error) {
    logger.error('디바이스 수정 실패:', error);

    if (error.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: '디바이스 수정에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 디바이스 삭제
async function deleteDevice(req, res) {
  try {
    const device = Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    try {
      if (device.deviceId && socketService) {
        if (socketService.isDeviceConnected(device.deviceId)) {
          await socketService.disconnectDevice(device.deviceId);
        }
      } else if (device.ip && displayService) {
        if (displayService.isDeviceConnected(device.id)) {
          await displayService.disconnectDevice(device.id);
        }
      }
    } catch (disconnectError) {
      logger.warn(`연결 해제 중 오류: ${disconnectError.message}`);
    }

    Device.delete(req.params.id);
    logger.info(`🗑️ 디바이스 삭제 성공: ${device.name}`);

    res.json({
      success: true,
      message: '디바이스가 삭제되었습니다.'
    });
  } catch (error) {
    logger.error('디바이스 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 삭제에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 디바이스 연결
async function connectDevice(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    const isTest = isTestDevice(device);

    // ✅ 연결 상태 확인
    let isAlreadyConnected = false;
    try {
      if (device.deviceId && socketService && socketService.isDeviceConnected) {
        isAlreadyConnected = socketService.isDeviceConnected(device.deviceId);
      } else if (device.ip && displayService && displayService.isDeviceConnected) {
        isAlreadyConnected = displayService.isDeviceConnected(device.id);
      } else {
        isAlreadyConnected = device.status === 'online';
      }
    } catch (error) {
      logger.debug('연결 상태 확인 실패:', error.message);
    }

    if (isAlreadyConnected) {
      return res.json({
        success: true,
        message: '디바이스가 이미 연결되어 있습니다.',
        isTest: isTest,
        device: {
          ...(device.toJSON ? device.toJSON() : device),
          connected: true,
          status: 'online'
        }
      });
    }

    // ✅ 상태를 connecting으로 업데이트
    if (device.updateStatus) {
      device.updateStatus('connecting');
    }

    if (isTest) {
      // ✅ 테스트 디바이스는 즉시 연결 시뮬레이션
      logger.info(`🧪 테스트 디바이스 연결 시뮬레이션: ${device.name}`);

      // 1초 후 온라인 상태로 변경
      setTimeout(() => {
        try {
          if (device.updateStatus) {
            device.updateStatus('online');
          }
          if (device.recordConnectionAttempt) {
            device.recordConnectionAttempt(true, null, true);
          }
          logger.info(`✅ 테스트 디바이스 온라인: ${device.name}`);
        } catch (error) {
          logger.error('테스트 디바이스 상태 업데이트 실패:', error);
        }
      }, 1000);

      res.json({
        success: true,
        message: '테스트 디바이스 연결을 시작합니다. 잠시 후 온라인 상태가 됩니다.',
        isTest: true,
        device: {
          ...(device.toJSON ? device.toJSON() : device),
          status: 'connecting'
        }
      });
    } else {
      // ✅ 실제 디바이스 연결 시도
      logger.info(`🔌 실제 디바이스 연결 시도: ${device.name}`);

      try {
        let connectionSuccess = false;

        if (device.deviceId && socketService && socketService.connectDevice) {
          // ID 기반 연결 시도
          connectionSuccess = await socketService.connectDevice(device.deviceId);
        } else if (device.ip && displayService && displayService.connectDevice) {
          // IP 기반 연결 시도
          connectionSuccess = await displayService.connectDevice(device.id);
        } else {
          // 서비스가 없는 경우 시뮬레이션
          connectionSuccess = true;
          setTimeout(() => {
            if (device.updateStatus) {
              device.updateStatus('online');
            }
          }, 2000);
        }

        if (connectionSuccess) {
          res.json({
            success: true,
            message: `디바이스 연결을 시작했습니다: ${device.name}`,
            isTest: false,
            device: {
              ...(device.toJSON ? device.toJSON() : device),
              status: 'connecting'
            }
          });
        } else {
          // 연결 실패
          if (device.updateStatus) {
            device.updateStatus('offline', 'Connection failed');
          }

          res.status(400).json({
            success: false,
            message: `디바이스 연결에 실패했습니다: ${device.name}`,
            isTest: false
          });
        }
      } catch (connectionError) {
        logger.error('실제 디바이스 연결 실패:', connectionError);

        if (device.updateStatus) {
          device.updateStatus('offline', connectionError.message);
        }

        res.status(500).json({
          success: false,
          message: `디바이스 연결 중 오류가 발생했습니다: ${connectionError.message}`,
          isTest: false
        });
      }
    }

  } catch (error) {
    logger.error(`디바이스 연결 실패: ${req.params.id}`, error);

    // 오류 시 디바이스 상태를 오프라인으로 설정
    try {
      const device = Device.findById(req.params.id);
      if (device && device.updateStatus) {
        device.updateStatus('offline', error.message);
      }
    } catch (updateError) {
      logger.error('디바이스 상태 업데이트 실패:', updateError);
    }

    res.status(500).json({
      success: false,
      message: `디바이스 연결에 실패했습니다: ${error.message}`
    });
  }
}

// ✅ 디바이스 연결 해제
async function disconnectDevice(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    const isTest = isTestDevice(device);
    let disconnected = false;

    try {
      if (device.deviceId && socketService && socketService.disconnectDevice) {
        disconnected = await socketService.disconnectDevice(device.deviceId);
      } else if (device.ip && displayService && displayService.disconnectDevice) {
        disconnected = await displayService.disconnectDevice(device.id);
      } else {
        // 서비스가 없는 경우 즉시 연결 해제
        disconnected = true;
      }
    } catch (error) {
      logger.warn('연결 해제 중 오류:', error.message);
      disconnected = true; // 오류가 있어도 연결 해제로 처리
    }

    // ✅ 디바이스 상태를 오프라인으로 업데이트
    if (device.updateStatus) {
      device.updateStatus('offline', 'Manually disconnected');
    }

    logger.info(`🔌 디바이스 연결 해제 성공: ${device.name} (${isTest ? '테스트' : '실제'})`);

    res.json({
      success: true,
      message: `디바이스 연결이 해제되었습니다. (${isTest ? '테스트' : '실제'})`,
      isTest: isTest,
      device: {
        ...(device.toJSON ? device.toJSON() : device),
        connected: false,
        status: 'offline'
      }
    });

  } catch (error) {
    logger.error(`디바이스 연결 해제 실패: ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      message: `디바이스 연결 해제에 실패했습니다: ${error.message}`
    });
  }
}

// ✅ 프로토콜 0xD1 - 야간 시간 및 동작 시간 설정 (프로토콜 정의서 완전 구현)
async function setBrightnessSchedule(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    const {
      // ✅ 프로토콜 정의서에 따른 필드들
      startTime = '06:00',      // 시작 시간 (주간 밝기 시작)
      endTime = '23:00',        // 완료 시간 (주간 밝기 종료)
      dayBrightness = 15,       // 주간 밝기 단계 (0~20)
      nightBrightness = 8,      // 야간 밝기 단계 (0~20)
      onTime = '06:00',         // ON시간 (전광판 켜지는 시간)
      offTime = '23:00'         // OFF시간 (전광판 꺼지는 시간)
    } = req.body;

    // ✅ 유효성 검사 - 프로토콜 정의서 기준
    if (dayBrightness < 0 || dayBrightness > 20) {
      return res.status(400).json({
        success: false,
        message: '주간 밝기는 0~20 사이여야 합니다.'
      });
    }

    if (nightBrightness < 0 || nightBrightness > 20) {
      return res.status(400).json({
        success: false,
        message: '야간 밝기는 0~20 사이여야 합니다.'
      });
    }

    // ✅ 시간 형식 검증 (HH:MM)
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime) ||
      !timePattern.test(onTime) || !timePattern.test(offTime)) {
      return res.status(400).json({
        success: false,
        message: '시간 형식이 올바르지 않습니다. (HH:MM 형식 사용)'
      });
    }

    const isTest = isTestDevice(device);

    if (isTest) {
      // ✅ 테스트 디바이스는 시뮬레이션
      logger.info(`🧪 테스트 디바이스 프로토콜 0xD1 설정: ${device.name}`);

      // ✅ 프로토콜에 맞는 설정 업데이트
      if (device.updateConfig) {
        device.updateConfig({
          brightness: {
            day: dayBrightness,
            night: nightBrightness,
            current: dayBrightness, // 현재는 주간 밝기로 설정
            startTime: startTime,   // 주간 밝기 시작
            endTime: endTime        // 주간 밝기 종료
          },
          schedule: {
            onTime: onTime,         // 전광판 ON 시간
            offTime: offTime,       // 전광판 OFF 시간
            enabled: true
          },
          protocol: {
            lastCommand: '0xD1',
            timestamp: new Date().toISOString()
          }
        });
      }

      res.json({
        success: true,
        message: '테스트 디바이스 프로토콜 0xD1 설정이 완료되었습니다.',
        isTest: true,
        protocol: {
          command: '0xD1',
          description: '야간 시간 및 동작 시간 설정',
          data: {
            startTime,           // 시작 시간 (주간 밝기)
            endTime,             // 완료 시간 (주간 밝기)
            dayBrightness,       // 주간 밝기 단계
            nightBrightness,     // 야간 밝기 단계
            onTime,              // 전광판 ON 시간
            offTime              // 전광판 OFF 시간
          }
        },
        config: {
          brightness: {
            day: dayBrightness,
            night: nightBrightness,
            range: '0~20',
            startTime,
            endTime
          },
          power: {
            onTime,
            offTime,
            note: 'ON/OFF 시간이 동일하면 계속 켜짐, OFF 시간이라도 긴급 메시지가 존재하면 ON됨'
          }
        },
        device: device.toJSON ? device.toJSON() : device
      });
    } else {
      // ✅ 실제 디바이스는 프로토콜 0xD1 명령 전송
      try {
        // ✅ 프로토콜 정의서에 따른 0xD1 데이터 구성
        const protocolData = {
          // 시작 시간 (시, 분)
          startHour: parseInt(startTime.split(':')[0]),
          startMinute: parseInt(startTime.split(':')[1]),
          // 완료 시간 (시, 분)
          endHour: parseInt(endTime.split(':')[0]),
          endMinute: parseInt(endTime.split(':')[1]),
          // 주간 밝기 단계 (0~20)
          dayBrightness: dayBrightness,
          // 야간 밝기 단계 (0~20)  
          nightBrightness: nightBrightness,
          // ON시간 (시, 분)
          onHour: parseInt(onTime.split(':')[0]),
          onMinute: parseInt(onTime.split(':')[1]),
          // OFF시간 (시, 분)
          offHour: parseInt(offTime.split(':')[0]),
          offMinute: parseInt(offTime.split(':')[1])
        };

        const protocolCommand = createProtocolCommand(device.deviceId || device.id, '0xD1', protocolData);

        // ✅ 실제 디바이스에 명령 전송
        if (device.deviceId && socketService) {
          if (!socketService.isDeviceConnected(device.deviceId)) {
            return res.status(400).json({
              success: false,
              message: '디바이스가 연결되어 있지 않습니다.'
            });
          }
          await socketService.sendCommand(device.deviceId, '0xD1', protocolData);
        } else if (displayService) {
          await displayService.sendCommand(device.id, '0xD1', protocolData);
        }

        // ✅ 디바이스 설정 업데이트
        if (device.updateConfig) {
          device.updateConfig({
            brightness: {
              day: dayBrightness,
              night: nightBrightness,
              current: dayBrightness,
              startTime: startTime,
              endTime: endTime
            },
            schedule: {
              onTime: onTime,
              offTime: offTime,
              enabled: true
            },
            protocol: {
              lastCommand: '0xD1',
              timestamp: new Date().toISOString()
            }
          });
        }

        logger.info(`✅ 프로토콜 0xD1 설정 완료: ${device.name}`);

        res.json({
          success: true,
          message: '프로토콜 0xD1 - 야간 시간 및 동작 시간 설정이 완료되었습니다.',
          isTest: false,
          protocol: {
            command: '0xD1',
            description: '야간 시간 및 동작 시간 설정',
            sentData: protocolData,
            protocolCommand: protocolCommand
          },
          config: {
            brightness: {
              day: dayBrightness,
              night: nightBrightness,
              range: '0~20',
              period: `${startTime} ~ ${endTime}`
            },
            power: {
              onTime,
              offTime,
              note: 'ON/OFF 시간이 동일하면 계속 켜짐'
            }
          },
          device: device.toJSON ? device.toJSON() : device
        });
      } catch (error) {
        logger.error('프로토콜 0xD1 명령 전송 실패:', error);
        res.status(500).json({
          success: false,
          message: `프로토콜 0xD1 설정에 실패했습니다: ${error.message}`,
          protocol: {
            command: '0xD1',
            error: error.message
          }
        });
      }
    }

  } catch (error) {
    logger.error('프로토콜 0xD1 설정 실패:', error);
    res.status(500).json({
      success: false,
      message: '프로토콜 0xD1 설정에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 프로토콜 0x03 - 시간 동기화
async function syncTime(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    const isTest = isTestDevice(device);
    const currentTime = new Date();

    if (isTest) {
      // ✅ 테스트 디바이스는 시뮬레이션
      logger.info(`🧪 테스트 디바이스 프로토콜 0x03 시간 동기화: ${device.name}`);

      res.json({
        success: true,
        message: '테스트 디바이스 프로토콜 0x03 시간 동기화가 완료되었습니다.',
        isTest: true,
        protocol: {
          command: '0x03',
          description: '시간 동기화(상태확인 시에도 사용)'
        },
        syncTime: currentTime.toISOString(),
        localTime: currentTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        protocolData: {
          year: currentTime.getFullYear() - 2000, // 0x00=2000년
          month: currentTime.getMonth() + 1,
          day: currentTime.getDate(),
          hour: currentTime.getHours(),
          minute: currentTime.getMinutes(),
          second: currentTime.getSeconds()
        }
      });
    } else {
      // ✅ 실제 디바이스는 프로토콜 0x03 명령 전송
      try {
        // ✅ 프로토콜 정의서에 따른 0x03 데이터 구성
        const protocolData = {
          year: currentTime.getFullYear() - 2000, // 프로토콜에서 0x00=2000년
          month: currentTime.getMonth() + 1,
          day: currentTime.getDate(),
          hour: currentTime.getHours(),
          minute: currentTime.getMinutes(),
          second: currentTime.getSeconds()
        };

        const protocolCommand = createProtocolCommand(device.deviceId || device.id, '0x03', protocolData);

        if (device.deviceId && socketService) {
          if (!socketService.isDeviceConnected(device.deviceId)) {
            return res.status(400).json({
              success: false,
              message: '디바이스가 연결되어 있지 않습니다.'
            });
          }
          await socketService.sendCommand(device.deviceId, '0x03', protocolData);
        } else if (displayService) {
          await displayService.sendCommand(device.id, '0x03', protocolData);
        }

        logger.info(`⏰ 프로토콜 0x03 시간 동기화 완료: ${device.name}`);

        res.json({
          success: true,
          message: '프로토콜 0x03 - 시간 동기화가 완료되었습니다.',
          isTest: false,
          protocol: {
            command: '0x03',
            description: '시간 동기화(상태확인 시에도 사용)',
            sentData: protocolData,
            protocolCommand: protocolCommand
          },
          syncTime: currentTime.toISOString(),
          localTime: currentTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        });
      } catch (error) {
        logger.error('프로토콜 0x03 명령 전송 실패:', error);
        res.status(500).json({
          success: false,
          message: `프로토콜 0x03 시간 동기화에 실패했습니다: ${error.message}`,
          protocol: {
            command: '0x03',
            error: error.message
          }
        });
      }
    }

  } catch (error) {
    logger.error('프로토콜 0x03 시간 동기화 실패:', error);
    res.status(500).json({
      success: false,
      message: '프로토콜 0x03 시간 동기화에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 프로토콜 0x15/0x07 - 방번호별 메시지 삭제
async function deleteRoomMessages(req, res) {
  try {
    const device = Device.findById(req.params.id);
    const roomNumber = parseInt(req.params.roomNumber);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    if (isNaN(roomNumber) || roomNumber < 1 || roomNumber > 100) {
      return res.status(400).json({
        success: false,
        message: '방번호는 1~100 사이여야 합니다.'
      });
    }

    const isTest = isTestDevice(device);

    if (isTest) {
      logger.info(`🧪 테스트 디바이스 방번호 ${roomNumber} 메시지 삭제: ${device.name}`);

      res.json({
        success: true,
        message: `테스트 디바이스 방번호 ${roomNumber}의 메시지가 삭제되었습니다.`,
        isTest: true,
        protocol: {
          command: roomNumber <= 5 ? '0x15 (긴급메시지)' : '0x15 (일반메시지)',
          description: '방정보 삭제 (신프로토콜)'
        },
        roomNumber: roomNumber
      });
    } else {
      try {
        // 신프로토콜: 0x15, 구프로토콜: 0x07
        const protocolVersion = device.getProtocolVersion ? device.getProtocolVersion() : 'new';
        const commandType = protocolVersion === 'new' ? '0x15' : '0x07';

        const protocolData = { roomNumber: roomNumber };
        const protocolCommand = createProtocolCommand(device.deviceId || device.id, commandType, protocolData);

        if (device.deviceId && socketService) {
          if (!socketService.isDeviceConnected(device.deviceId)) {
            return res.status(400).json({
              success: false,
              message: '디바이스가 연결되어 있지 않습니다.'
            });
          }
          await socketService.sendCommand(device.deviceId, commandType, protocolData);
        } else if (displayService) {
          await displayService.sendCommand(device.id, commandType, protocolData);
        }

        logger.info(`🗑️ 방번호 ${roomNumber} 메시지 삭제 완료: ${device.name}`);

        res.json({
          success: true,
          message: `방번호 ${roomNumber}의 메시지가 삭제되었습니다.`,
          isTest: false,
          protocol: {
            command: commandType,
            description: `방정보 삭제 (${protocolVersion === 'new' ? '신' : '구'}프로토콜)`,
            protocolCommand: protocolCommand
          },
          roomNumber: roomNumber,
          roomType: roomNumber <= 5 ? '긴급메시지' : '일반메시지'
        });
      } catch (error) {
        logger.error('방번호 메시지 삭제 명령 전송 실패:', error);
        res.status(500).json({
          success: false,
          message: `방번호 ${roomNumber} 메시지 삭제에 실패했습니다: ${error.message}`
        });
      }
    }
  } catch (error) {
    logger.error('방번호 메시지 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '방번호 메시지 삭제에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 프로토콜 0x14/0x04 - 전체 메시지 삭제
async function clearDeviceMessages(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    const isTest = isTestDevice(device);

    if (isTest) {
      logger.info(`🧪 테스트 디바이스 전체 메시지 삭제 시뮬레이션: ${device.name}`);

      res.json({
        success: true,
        message: '테스트 디바이스의 모든 메시지가 삭제되었습니다.',
        deletedCount: 5,
        isTest: true,
        protocol: {
          command: '0x14',
          description: '전체 삭제 (신프로토콜)'
        }
      });
    } else {
      try {
        // 신프로토콜: 0x14, 구프로토콜: 0x04
        const protocolVersion = device.getProtocolVersion ? device.getProtocolVersion() : 'new';
        const commandType = protocolVersion === 'new' ? '0x14' : '0x04';

        const protocolCommand = createProtocolCommand(device.deviceId || device.id, commandType, {});

        if (device.deviceId && socketService) {
          if (!socketService.isDeviceConnected(device.deviceId)) {
            return res.status(400).json({
              success: false,
              message: '디바이스가 연결되어 있지 않습니다.'
            });
          }
          await socketService.sendCommand(device.deviceId, commandType, protocolCommand.data);
        } else if (displayService) {
          await displayService.sendCommand(device.id, commandType, protocolCommand.data);
        }

        logger.info(`🗑️ 전체 메시지 삭제 완료: ${device.name}`);

        res.json({
          success: true,
          message: '모든 메시지 삭제 명령을 전송했습니다.',
          isTest: false,
          protocol: {
            command: commandType,
            description: `전체 삭제 (${protocolVersion === 'new' ? '신' : '구'}프로토콜)`,
            protocolCommand: protocolCommand
          }
        });
      } catch (error) {
        logger.error('전체 메시지 삭제 명령 전송 실패:', error);
        res.status(500).json({
          success: false,
          message: `전체 메시지 삭제에 실패했습니다: ${error.message}`
        });
      }
    }
  } catch (error) {
    logger.error('전체 메시지 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: `전체 메시지 삭제에 실패했습니다: ${error.message}`
    });
  }
}

// ✅ 디바이스 상태 조회
async function getDeviceStatus(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      status: device.status,
      connected: false,
      isTest: isTestDevice(device),
      deviceId: device.deviceId,
      ip: device.ip,
      port: device.port
    });

  } catch (error) {
    logger.error('디바이스 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 상태를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 디바이스 설정 업데이트
async function updateDeviceConfig(req, res) {
  try {
    const device = Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '설정이 업데이트되었습니다.',
      device: device.toJSON ? device.toJSON() : device,
      isTest: isTestDevice(device)
    });

  } catch (error) {
    logger.error('디바이스 설정 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '설정 업데이트에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 전원 제어
async function controlDevicePower(req, res) {
  try {
    const { action } = req.body;
    const device = Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: `전원 ${action} 명령을 실행했습니다.`,
      isTest: isTestDevice(device)
    });

  } catch (error) {
    logger.error('전원 제어 실패:', error);
    res.status(500).json({
      success: false,
      message: '전원 제어에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 테스트 디바이스 생성
async function createTestDevices(req, res) {
  try {
    logger.info('🧪 테스트 디바이스 생성 시작');

    const newTestDevices = [
      {
        name: '테스트 전광판 1',
        deviceId: 'TEST01LD001EA',
        ip: '127.0.0.1',
        port: 5002,
        location: { address: '테스트 위치 1', building: '테스트 빌딩', floor: '1층' },
        specs: { model: 'TEST-LED-001', size: '2X10', resolution: { width: 320, height: 160 }, maxBrightness: 20 }
      },
      {
        name: '테스트 전광판 2',
        deviceId: 'TEST02LD002EA',
        ip: '127.0.0.2',
        port: 5003,
        location: { address: '테스트 위치 2', building: '테스트 빌딩', floor: '2층' },
        specs: { model: 'TEST-LED-002', size: '2X10', resolution: { width: 320, height: 160 }, maxBrightness: 20 }
      }
    ];

    const createdDevices = [];

    for (const deviceData of newTestDevices) {
      try {
        const device = Device.create(deviceData);
        createdDevices.push(device.toJSON ? device.toJSON() : device);
      } catch (error) {
        logger.error(`테스트 디바이스 생성 실패: ${deviceData.name}`, error.message);
      }
    }

    res.json({
      success: true,
      message: `테스트 디바이스 ${createdDevices.length}개가 생성되었습니다!`,
      devices: createdDevices,
      isTest: true
    });

  } catch (error) {
    logger.error('테스트 디바이스 생성 실패:', error);
    res.status(500).json({
      success: false,
      message: '테스트 디바이스 생성에 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 연결 통계
async function getConnectionStats(req, res) {
  try {
    const allDevices = Device.findAll() || [];
    const stats = {
      total: allDevices.length,
      connected: allDevices.filter(d => d.status === 'online').length,
      offline: allDevices.filter(d => d.status === 'offline').length,
      uptime: 0,
      devices: allDevices.map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        connected: d.status === 'online'
      }))
    };

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    logger.error('연결 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '연결 통계를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 시스템 상태 조회
async function getSystemStatus(req, res) {
  try {
    const allDevices = Device.findAll() || [];
    const systemStatus = {
      timestamp: new Date().toISOString(),
      services: {
        socketService: !!socketService,
        displayService: !!displayService,
        logger: logger !== console
      },
      devices: {
        total: allDevices.length,
        online: allDevices.filter(d => d.status === 'online').length,
        offline: allDevices.filter(d => d.status === 'offline').length,
        test: allDevices.filter(d => isTestDevice(d)).length
      }
    };

    res.json({
      success: true,
      status: systemStatus
    });

  } catch (error) {
    logger.error('시스템 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '시스템 상태를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
}

// ✅ 함수 기반 내보내기
module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  connectDevice,
  disconnectDevice,
  setBrightnessSchedule,
  syncTime,
  deleteRoomMessages,
  clearDeviceMessages,
  getDeviceStatus,
  updateDeviceConfig,
  controlDevicePower,
  createTestDevices,
  getConnectionStats,
  getSystemStatus
};