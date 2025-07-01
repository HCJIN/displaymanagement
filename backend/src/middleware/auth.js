// src/middleware/auth.js - 인증/인가 미들웨어 (완전 버전)
const jwt = require('jsonwebtoken');

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 모델들을 안전하게 로드
let User, logger, AppError;

try {
  User = require('../models/User');
} catch (error) {
  console.warn('User 모델 로드 실패, 임시 사용자 사용');
  // 임시 사용자 데이터
  User = {
    findById: (id) => {
      const tempUsers = [
        { id: 1, username: 'admin', role: 'admin', permissions: ['device_control', 'message_send', 'user_manage'], active: true },
        { id: 2, username: 'user', role: 'user', permissions: ['message_send'], active: true }
      ];
      return tempUsers.find(u => u.id === id);
    }
  };
}

try {
  logger = require('../utils/logger');
} catch (error) {
  logger = {
    auth: (status, user, msg) => console.log(`Auth ${status}: ${user} ${msg}`)
  };
}

try {
  AppError = require('../middleware/errorHandler').AppError;
} catch (error) {
  // 기본 에러 클래스 생성
  AppError = class AppError extends Error {
    constructor(message, statusCode, code = null) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  };
}

// JWT 토큰 생성
const signToken = (userId) => {
  return jwt.sign(
    { id: userId }, // User 모델과 맞추기 위해 id로 변경
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// JWT 토큰 검증
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// 인증 미들웨어
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.auth('FAILED', 'anonymous', '토큰이 제공되지 않음');
      return next(new AppError('로그인이 필요합니다.', 401, 'AUTHENTICATION_REQUIRED'));
    }

    const token = authHeader.substring(7); // 'Bearer ' 제거
    const decoded = verifyToken(token);

    // 사용자 정보 조회
    const user = User.findById(decoded.id);

    if (!user) {
      logger.auth('FAILED', decoded.id, '사용자를 찾을 수 없음');
      return next(new AppError('토큰에 해당하는 사용자가 존재하지 않습니다.', 401, 'USER_NOT_FOUND'));
    }

    if (!user.active) {
      logger.auth('FAILED', user.username, '비활성화된 사용자');
      return next(new AppError('계정이 비활성화되었습니다.', 401, 'ACCOUNT_DISABLED'));
    }

    req.user = user;
    logger.auth('SUCCESS', user.username, '인증 성공');
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.auth('FAILED', 'unknown', '유효하지 않은 토큰');
      return next(new AppError('유효하지 않은 토큰입니다.', 401, 'INVALID_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      logger.auth('FAILED', 'unknown', '만료된 토큰');
      return next(new AppError('토큰이 만료되었습니다.', 401, 'TOKEN_EXPIRED'));
    }
    return next(error);
  }
};

// 권한 확인 미들웨어
const authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('인증이 필요합니다.', 401, 'AUTHENTICATION_REQUIRED'));
    }

    // 관리자는 모든 권한 허용
    if (req.user.role === 'admin') {
      logger.auth('AUTHORIZED', req.user.username, `관리자 권한으로 접근 허용: ${permissions.join(', ')}`);
      return next();
    }

    // 필요한 권한이 있는지 확인
    const hasPermission = permissions.some(permission =>
      req.user.permissions && req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.auth('UNAUTHORIZED', req.user.username, `권한 부족: 필요 권한 [${permissions.join(', ')}]`);
      return next(new AppError('이 작업을 수행할 권한이 없습니다.', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    logger.auth('AUTHORIZED', req.user.username, `권한 확인 완료: ${permissions.join(', ')}`);
    next();
  };
};

// 본인 또는 관리자만 접근 가능한 리소스
const authorizeOwnerOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('인증이 필요합니다.', 401, 'AUTHENTICATION_REQUIRED'));
    }

    // 관리자는 모든 리소스 접근 가능
    if (req.user.role === 'admin') {
      return next();
    }

    // 본인의 리소스인지 확인
    const resourceUserId = req.params.id || req.body[resourceUserIdField] || req.user.id;
    if (req.user.id !== parseInt(resourceUserId)) {
      logger.auth('UNAUTHORIZED', req.user.username, `타인의 리소스 접근 시도: ${resourceUserId}`);
      return next(new AppError('자신의 정보만 접근할 수 있습니다.', 403, 'ACCESS_DENIED'));
    }

    next();
  };
};

// 역할 기반 접근 제어
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('인증이 필요합니다.', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (!roles.includes(req.user.role)) {
      logger.auth('UNAUTHORIZED', req.user.username, `역할 권한 부족: 필요 역할 [${roles.join(', ')}], 현재 역할 [${req.user.role}]`);
      return next(new AppError('이 작업을 수행할 역할 권한이 없습니다.', 403, 'ROLE_PERMISSION_DENIED'));
    }

    next();
  };
};

// 디바이스 접근 권한 확인
const authorizeDeviceAccess = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.params.id;

    if (!deviceId) {
      return next(new AppError('디바이스 ID가 필요합니다.', 400, 'DEVICE_ID_REQUIRED'));
    }

    // 관리자는 모든 디바이스 접근 가능
    if (req.user.role === 'admin') {
      return next();
    }

    // 사용자별 디바이스 접근 권한 확인
    if (req.user.permissions && (req.user.permissions.includes('device_control') || req.user.permissions.includes('message_send'))) {
      return next();
    }

    logger.auth('UNAUTHORIZED', req.user.username, `디바이스 접근 권한 없음: ${deviceId}`);
    return next(new AppError('이 디바이스에 접근할 권한이 없습니다.', 403, 'DEVICE_ACCESS_DENIED'));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  signToken,
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
  requireRole,
  authorizeDeviceAccess
};