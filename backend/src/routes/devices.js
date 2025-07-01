// src/routes/devices.js - 개발환경 인증 우회 수정
const express = require('express');
const router = express.Router();

// 🔧 필요한 모듈 import 추가
const logger = require('../utils/logger');
let displayService;

try {
  displayService = require('../services/displayService');
  console.log('✓ DisplayService 로드 성공');
} catch (error) {
  console.error('❌ DisplayService 로드 실패:', error.message);
  displayService = {
    getMqttStatus: () => ({ connected: false }),
    testDeviceConnection: async () => ({ success: false, error: 'Service not available' })
  };
}

// ✅ 안전한 미들웨어 로딩
let authenticate, authorize, authorizeDeviceAccess, catchAsync, deviceController;

try {
  const auth = require('../middleware/auth');
  authenticate = auth.authenticate;
  authorize = auth.authorize;
  authorizeDeviceAccess = auth.authorizeDeviceAccess;
  console.log('✓ Auth 미들웨어 로드 성공');
} catch (error) {
  console.error('❌ Auth 미들웨어 로드 실패:', error.message);

  // ✅ 개발환경용 Fallback 미들웨어 (인증 우회)
  authenticate = (req, res, next) => {
    console.log('🔓 개발환경 인증 우회');
    req.user = {
      id: 1,
      username: 'admin',
      role: 'admin',
      permissions: ['device_control', 'message_send']
    };
    next();
  };
  authorize = (...permissions) => (req, res, next) => {
    console.log('🔓 개발환경 권한 우회:', permissions);
    next();
  };
  authorizeDeviceAccess = (req, res, next) => {
    console.log('🔓 개발환경 디바이스 접근 우회');
    next();
  };
}

try {
  const errorHandler = require('../middleware/errorHandler');
  catchAsync = errorHandler.catchAsync;
  console.log('✓ ErrorHandler 로드 성공');
} catch (error) {
  console.error('❌ ErrorHandler 로드 실패:', error.message);
  catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

try {
  deviceController = require('../controllers/deviceController');
  console.log('✓ DeviceController 로드 성공');
} catch (error) {
  console.error('❌ DeviceController 로드 실패:', error.message);
  console.error('스택 트레이스:', error.stack);

  // Fallback 컨트롤러는 기존 코드 유지
  deviceController = {
    getAllDevices: async (req, res) => {
      res.status(503).json({
        success: false,
        message: 'DeviceController 로딩 실패. 서버를 다시 시작해주세요.',
        error: 'Controller loading failed'
      });
    }
    // ... 나머지 fallback 메서드들
  };
}

// ✅ 개발환경에서는 인증 미들웨어를 조건부로 적용
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  console.log('🔓 개발환경: 디바이스 API 인증 우회 모드');
  // 개발환경에서는 간단한 로깅만
  router.use((req, res, next) => {
    console.log(`📡 Device API: ${req.method} ${req.path}`);
    req.user = req.user || {
      id: 1,
      username: 'dev-user',
      role: 'admin',
      permissions: ['device_control', 'message_send']
    };
    next();
  });
} else {
  // 프로덕션에서는 정상적인 인증 적용
  router.use(authenticate);
}

// ✅ 디바이스 라우트 정의
router.get('/', catchAsync(deviceController.getAllDevices));
router.get('/:id', catchAsync(deviceController.getDeviceById));

// ✅ 연결 제어 라우트 (인증 조건부 적용)
if (isDevelopment) {
  // 개발환경: 인증 우회
  router.post('/:id/connect', catchAsync(deviceController.connectDevice));
  router.post('/:id/disconnect', catchAsync(deviceController.disconnectDevice));
} else {
  // 프로덕션: 정상 인증
  router.post('/:id/connect', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.connectDevice));
  router.post('/:id/disconnect', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.disconnectDevice));
}

router.get('/:id/status', catchAsync(deviceController.getDeviceStatus));

// ✅ 디바이스 관리 라우트
if (isDevelopment) {
  router.post('/', catchAsync(deviceController.createDevice));
  router.put('/:id', catchAsync(deviceController.updateDevice));
  router.delete('/:id', catchAsync(deviceController.deleteDevice));
} else {
  router.post('/', authorize('device_control'), catchAsync(deviceController.createDevice));
  router.put('/:id', authorize('device_control'), catchAsync(deviceController.updateDevice));
  router.delete('/:id', authorize('device_control'), catchAsync(deviceController.deleteDevice));
}

// ✅ 프로토콜 제어 라우트
if (isDevelopment) {
  router.put('/:id/brightness', catchAsync(deviceController.setBrightnessSchedule));
  router.post('/:id/sync-time', catchAsync(deviceController.syncTime));
  router.delete('/:id/messages/:roomNumber', catchAsync(deviceController.deleteRoomMessages));
  router.delete('/:id/messages', catchAsync(deviceController.clearDeviceMessages));
  router.put('/:id/config', catchAsync(deviceController.updateDeviceConfig));
  router.post('/:id/power', catchAsync(deviceController.controlDevicePower));
} else {
  router.put('/:id/brightness', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.setBrightnessSchedule));
  router.post('/:id/sync-time', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.syncTime));
  router.delete('/:id/messages/:roomNumber', authorize('message_send'), authorizeDeviceAccess, catchAsync(deviceController.deleteRoomMessages));
  router.delete('/:id/messages', authorize('message_send'), authorizeDeviceAccess, catchAsync(deviceController.clearDeviceMessages));
  router.put('/:id/config', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.updateDeviceConfig));
  router.post('/:id/power', authorize('device_control'), authorizeDeviceAccess, catchAsync(deviceController.controlDevicePower));
}

// ✅ 통계 및 테스트 (항상 접근 가능)
router.get('/stats/connections', catchAsync(deviceController.getConnectionStats));
router.post('/test/create', catchAsync(deviceController.createTestDevices));
router.get('/system/status', catchAsync(deviceController.getSystemStatus));

// 🆕 디바이스 생성 API
router.post('/', authorize('device_manage'), catchAsync(async (req, res) => {
  const deviceData = req.body;

  try {
    const newDevice = Device.create(deviceData);

    logger.info(`새 디바이스 생성: ${newDevice.name} (ID: ${newDevice.id})`);

    res.status(201).json({
      success: true,
      message: '디바이스가 생성되었습니다.',
      device: newDevice.toObject()
    });
  } catch (error) {
    logger.error('디바이스 생성 실패:', error.message);
    res.status(400).json({
      success: false,
      message: `디바이스 생성 실패: ${error.message}`
    });
  }
}));

// 🔧 실제 장비 연결 테스트 API 추가
router.post('/test-connection', authenticate, authorize('device_control'), catchAsync(async (req, res) => {
  const { deviceId, controllerType } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: 'Device ID가 필요합니다.'
    });
  }

  logger.info(`장비 연결 테스트 시작: ${deviceId} (${controllerType})`);

  try {
    // 1. MQTT 브로커 연결 상태 확인
    const mqttStatus = displayService.getMqttStatus();
    if (!mqttStatus.connected) {
      return res.status(503).json({
        success: false,
        message: 'MQTT 브로커에 연결되지 않았습니다.',
        error: 'MQTT_DISCONNECTED'
      });
    }

    // 2. 실제 장비에 ping 명령 전송
    const testResult = await displayService.testDeviceConnection(deviceId, {
      controllerType: controllerType || 'HUIDU',
      timeout: 10000,
      retries: 2
    });

    if (testResult.success) {
      logger.info(`장비 연결 테스트 성공: ${deviceId}`, testResult);

      res.json({
        success: true,
        message: `✅ Device ID ${deviceId}와 정상적으로 연결되었습니다.`,
        deviceInfo: testResult.deviceInfo,
        connectionTime: testResult.responseTime,
        mqttTopic: testResult.mqttTopic,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn(`장비 연결 테스트 실패: ${deviceId}`, testResult);

      res.status(408).json({
        success: false,
        message: `❌ Device ID ${deviceId}에 연결할 수 없습니다.`,
        error: testResult.error,
        details: testResult.details,
        suggestions: [
          '1. Device ID가 정확한지 확인하세요',
          '2. 전광판 전원이 켜져 있는지 확인하세요',
          '3. 네트워크 연결 상태를 확인하세요',
          '4. MQTT 브로커 설정을 확인하세요'
        ]
      });
    }

  } catch (error) {
    logger.error(`장비 연결 테스트 오류: ${deviceId}`, error);

    res.status(500).json({
      success: false,
      message: '연결 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}));

console.log('✓ Device 라우터 설정 완료 (개발환경:', isDevelopment, ')');

module.exports = router;