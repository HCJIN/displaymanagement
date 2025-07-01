// src/app.js - Express 앱 설정 (라우터 로딩 문제 해결)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// 로거와 에러핸들러를 안전하게 로드
let logger, errorHandler;

try {
  logger = require('./utils/logger');
  console.log('✓ Logger 로드 성공');
} catch (error) {
  console.warn('⚠ Logger 로드 실패:', error.message);
  // 기본 로거 생성
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    auth: (status, user, msg) => console.log(`Auth ${status}: ${user} ${msg}`),
    device: (id, msg, data) => console.log(`Device ${id}: ${msg}`, data || ''),
  };
}

try {
  errorHandler = require('./middleware/errorHandler').errorHandler;
  console.log('✓ ErrorHandler 로드 성공');
} catch (error) {
  console.warn('⚠ ErrorHandler 로드 실패:', error.message);
  // 기본 에러핸들러 생성
  errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      message: '서버 내부 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  };
}

// ✅ 라우터를 안전하게 로드 (핵심 수정!)
let authRoutes, deviceRoutes, messageRoutes, userRoutes;

// ✅ deviceRoutes 우선 로드 (가장 중요)
try {
  deviceRoutes = require('./routes/devices');
  console.log('✓ Devices 라우터 로드 성공');
} catch (error) {
  console.error('❌ Devices 라우터 로드 실패:', error.message);
  console.error('스택 트레이스:', error.stack);

  // 최소한의 fallback 라우터 생성
  deviceRoutes = express.Router();
  deviceRoutes.get('/', (req, res) => {
    console.error('Devices API fallback 호출됨');
    res.status(503).json({
      success: false,
      message: 'Devices API가 일시적으로 사용할 수 없습니다. 서버를 다시 시작해주세요.',
      error: 'Device controller loading failed',
      timestamp: new Date().toISOString()
    });
  });
}

try {
  authRoutes = require('./routes/auth');
  console.log('✓ Auth 라우터 로드 성공');
} catch (error) {
  console.warn('⚠ Auth 라우터 로드 실패:', error.message);
  authRoutes = express.Router();
  authRoutes.post('/login', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Auth API - 일시적으로 사용할 수 없습니다',
      error: error.message
    });
  });
  authRoutes.get('/me', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Auth API - 일시적으로 사용할 수 없습니다'
    });
  });
}

try {
  messageRoutes = require('./routes/messages');
  console.log('✓ Messages 라우터 로드 성공');
} catch (error) {
  console.warn('⚠ Messages 라우터 로드 실패:', error.message);
  messageRoutes = express.Router();
  messageRoutes.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Messages API - 일시적으로 사용할 수 없습니다',
      error: error.message
    });
  });
}

try {
  userRoutes = require('./routes/users');
  console.log('✓ Users 라우터 로드 성공');
} catch (error) {
  console.warn('⚠ Users 라우터 로드 실패:', error.message);
  userRoutes = express.Router();
  userRoutes.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Users API - 일시적으로 사용할 수 없습니다',
      error: error.message
    });
  });
}

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: false, // 개발 환경에서는 비활성화
}));

// CORS 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 로깅 미들웨어
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// 바디 파서 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5002,
    routes: {
      devices: !!deviceRoutes,
      auth: !!authRoutes,
      messages: !!messageRoutes,
      users: !!userRoutes
    }
  });
});

// API 문서 엔드포인트
app.get('/api/docs', (req, res) => {
  res.json({
    title: '전광판 관리 시스템 API',
    version: '1.0.0',
    description: '전광판 장치 제어 및 메시지 관리를 위한 RESTful API',
    endpoints: {
      auth: {
        'POST /api/auth/login': '사용자 로그인',
        'POST /api/auth/logout': '사용자 로그아웃',
        'GET /api/auth/me': '현재 사용자 정보 조회',
        'POST /api/auth/refresh': '토큰 갱신'
      },
      devices: {
        'GET /api/devices': '전광판 목록 조회',
        'GET /api/devices/:id': '특정 전광판 조회',
        'POST /api/devices/:id/connect': '전광판 연결',
        'POST /api/devices/:id/disconnect': '전광판 연결 해제',
        'PUT /api/devices/:id/brightness': '휘도 스케줄 설정 (프로토콜 0xD1)',
        'POST /api/devices/:id/sync-time': '시간 동기화 (프로토콜 0x03)',
        'DELETE /api/devices/:id/messages/:roomNumber': '방번호별 삭제 (프로토콜 0x15/0x07)',
        'DELETE /api/devices/:id/messages': '전체 메시지 삭제 (프로토콜 0x14/0x04)',
        'PUT /api/devices/:id/config': '전광판 설정 변경',
        'POST /api/devices/:id/power': '전광판 전원 제어',
        'GET /api/devices/:id/status': '전광판 상태 조회',
        'POST /api/devices/test/create': '테스트 디바이스 생성'
      },
      messages: {
        'GET /api/messages': '메시지 목록 조회',
        'POST /api/messages/text': '텍스트 메시지 전송',
        'POST /api/messages/image': '이미지 메시지 전송',
        'POST /api/messages/mixed': '복합 메시지 전송',
        'DELETE /api/messages/:id': '메시지 삭제',
        'GET /api/messages/device/:deviceId': '장치별 메시지 조회'
      },
      users: {
        'GET /api/users': '사용자 목록 조회 (관리자)',
        'POST /api/users': '사용자 생성 (관리자)',
        'PUT /api/users/:id': '사용자 정보 수정',
        'DELETE /api/users/:id': '사용자 삭제 (관리자)'
      }
    },
    websocket: {
      '/socket.io': 'WebSocket 연결 (실시간 상태 업데이트)'
    },
    protocol: {
      supportedCommands: ['0x03', '0xD1', '0x14', '0x15', '0x04', '0x07'],
      brightnessRange: '0~20',
      roomNumbers: '1~100 (1~5: 긴급, 6~100: 일반)'
    }
  });
});

// ✅ API 라우터 등록 (디바이스 라우터를 가장 먼저 등록)
console.log('🔧 API 라우터 등록 시작...');

try {
  app.use('/api/devices', deviceRoutes);
  console.log('✓ /api/devices 라우터 등록 완료');
} catch (error) {
  console.error('❌ /api/devices 라우터 등록 실패:', error.message);
}

try {
  app.use('/api/auth', authRoutes);
  console.log('✓ /api/auth 라우터 등록 완료');
} catch (error) {
  console.error('❌ /api/auth 라우터 등록 실패:', error.message);
}

try {
  app.use('/api/messages', messageRoutes);
  console.log('✓ /api/messages 라우터 등록 완료');
} catch (error) {
  console.error('❌ /api/messages 라우터 등록 실패:', error.message);
}

try {
  app.use('/api/users', userRoutes);
  console.log('✓ /api/users 라우터 등록 완료');
} catch (error) {
  console.error('❌ /api/users 라우터 등록 실패:', error.message);
}

try {
  app.use('/api/images', require('./routes/images'));
  console.log('✓ /api/images 라우터 등록 완료');
} catch (error) {
  console.error('❌ /api/images 라우터 등록 실패:', error.message);
}

console.log('🎉 모든 API 라우터 등록 완료');

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    message: '전광판 관리 시스템 API 서버',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs',
    health: '/health',
    port: process.env.PORT || 5002,
    routes: {
      devices: '/api/devices',
      auth: '/api/auth',
      messages: '/api/messages',
      users: '/api/users'
    },
    protocol: {
      supportedCommands: ['0x03', '0xD1', '0x14', '0x15', '0x04', '0x07'],
      brightnessRange: '0~20',
      roomNumbers: '1~100'
    }
  });
});

// ✅ API 테스트 엔드포인트 (디버깅용)
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API 서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString(),
    routes: {
      devices: !!deviceRoutes,
      auth: !!authRoutes,
      messages: !!messageRoutes,
      users: !!userRoutes
    }
  });
});

// 404 에러 처리
app.use('*', (req, res) => {
  logger.warn(`404 에러: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  res.status(404).json({
    error: 'Not Found',
    message: `경로 ${req.originalUrl}를 찾을 수 없습니다.`,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      devices: '/api/devices',
      auth: '/api/auth',
      messages: '/api/messages',
      users: '/api/users',
      docs: '/api/docs',
      health: '/health'
    }
  });
});

// 글로벌 에러 핸들러
app.use(errorHandler);

module.exports = app;