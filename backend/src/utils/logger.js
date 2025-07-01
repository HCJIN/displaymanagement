// src/utils/logger.js - 로깅 유틸리티
const winston = require('winston');
const path = require('path');

// 로그 레벨 정의
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 로그 색상 정의
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// 파일 로그 포맷 (색상 제거)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
);

// 트랜스포트 정의
const transports = [
  // 콘솔 출력
  new winston.transports.Console({
    format: logFormat,
    level: process.env.LOG_LEVEL || 'info',
  }),

  // 일반 로그 파일
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'app.log'),
    format: fileLogFormat,
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // 에러 로그 파일
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    format: fileLogFormat,
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// 개발 환경에서만 디버그 파일 로그 추가
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'debug.log'),
      format: fileLogFormat,
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
}

// Winston 로거 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: fileLogFormat,
  transports,
  exitOnError: false,
});

// 커스텀 로깅 메서드 추가
logger.device = (deviceId, message, data = null) => {
  const logMessage = `[DEVICE:${deviceId}] ${message}`;
  logger.info(logMessage);
  if (data) {
    logger.debug(`[DEVICE:${deviceId}] Data:`, data);
  }
};

logger.socket = (event, message, data = null) => {
  const logMessage = `[SOCKET:${event}] ${message}`;
  logger.info(logMessage);
  if (data) {
    logger.debug(`[SOCKET:${event}] Data:`, data);
  }
};

logger.auth = (action, user, message) => {
  const logMessage = `[AUTH:${action}] User: ${user} - ${message}`;
  logger.info(logMessage);
};

logger.api = (method, endpoint, user, status, duration) => {
  const logMessage = `[API] ${method} ${endpoint} - User: ${user} - Status: ${status} - Duration: ${duration}ms`;
  logger.info(logMessage);
};

// 로그 디렉토리 생성
const fs = require('fs');
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

module.exports = logger;