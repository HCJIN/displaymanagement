// src/middleware/errorHandler.js - 글로벌 에러 핸들러
const logger = require('../utils/logger');

// 커스텀 에러 클래스
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// JWT 에러 처리
const handleJWTError = () =>
  new AppError('유효하지 않은 토큰입니다. 다시 로그인해주세요.', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () =>
  new AppError('토큰이 만료되었습니다. 다시 로그인해주세요.', 401, 'TOKEN_EXPIRED');

// 검증 에러 처리
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `입력 데이터가 올바르지 않습니다: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

// 중복 키 에러 처리
const handleDuplicateKeyError = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `중복된 값이 존재합니다: ${value}. 다른 값을 사용해주세요.`;
  return new AppError(message, 400, 'DUPLICATE_KEY');
};

// 캐스트 에러 처리
const handleCastError = (err) => {
  const message = `유효하지 않은 ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'CAST_ERROR');
};

// 개발 환경 에러 응답
const sendErrorDev = (err, req, res) => {
  logger.error('개발 환경 에러:', {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

// 프로덕션 환경 에러 응답
const sendErrorProd = (err, req, res) => {
  // 운영 에러인 경우 (예상된 에러)
  if (err.isOperational) {
    logger.error('운영 에러:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }

  // 예상하지 못한 에러인 경우
  logger.error('예상하지 못한 에러:', {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 일반적인 에러 메시지만 전송
  return res.status(500).json({
    status: 'error',
    message: '서버 내부 오류가 발생했습니다.',
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
};

// 전광판 통신 에러 처리
const handleDisplayError = (err) => {
  const errorMessages = {
    'CONNECT_FAIL': '전광판 연결에 실패했습니다.',
    'AUTH_FAIL': '전광판 인증에 실패했습니다.',
    'DEVICE_NOT_FOUND': '전광판을 찾을 수 없습니다.',
    'DEVICE_BUSY': '전광판이 다른 작업을 수행 중입니다.',
    'DATA_ERROR': '전송 데이터에 오류가 있습니다.',
    'MEMORY_FULL': '전광판 메모리가 부족합니다.',
    'HARDWARE_ERROR': '전광판 하드웨어 오류가 발생했습니다.',
    'TIMEOUT': '전광판 응답 시간이 초과되었습니다.'
  };

  const message = errorMessages[err.code] || '전광판 통신 중 오류가 발생했습니다.';
  return new AppError(message, 400, err.code);
};

// 메인 에러 핸들러
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 에러 유형별 처리
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'CastError') error = handleCastError(err);

  // 전광판 통신 에러 처리
  if (err.code && ['CONNECT_FAIL', 'AUTH_FAIL', 'DEVICE_NOT_FOUND', 'DEVICE_BUSY',
    'DATA_ERROR', 'MEMORY_FULL', 'HARDWARE_ERROR', 'TIMEOUT'].includes(err.code)) {
    error = handleDisplayError(err);
  }

  // 기본 상태 코드 설정
  if (!error.statusCode) {
    error.statusCode = 500;
    error.status = 'error';
  }

  // 환경별 에러 응답
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

// 비동기 에러 캐처 래퍼
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  catchAsync
};