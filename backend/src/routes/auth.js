// src/routes/auth.js - 인증 관련 라우터
const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, authenticate } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// 로그인
router.post('/login', catchAsync(async (req, res) => {
  const { username, password } = req.body;

  // 입력값 검증
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '사용자명과 패스워드를 입력해주세요.'
    });
  }

  // 사용자 찾기
  const user = User.findByUsername(username);
  if (!user) {
    logger.auth('FAILED', username, '존재하지 않는 사용자');
    return res.status(401).json({
      success: false,
      message: '사용자명 또는 패스워드가 올바르지 않습니다.'
    });
  }

  // 패스워드 확인
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logger.auth('FAILED', username, '잘못된 패스워드');
    return res.status(401).json({
      success: false,
      message: '사용자명 또는 패스워드가 올바르지 않습니다.'
    });
  }

  // 계정 활성화 확인
  if (!user.active) {
    logger.auth('FAILED', username, '비활성화된 계정');
    return res.status(401).json({
      success: false,
      message: '계정이 비활성화되었습니다. 관리자에게 문의하세요.'
    });
  }

  // 토큰 생성
  const token = signToken(user.id);

  // 로그인 정보 업데이트
  user.updateLoginInfo();

  logger.auth('SUCCESS', username, '로그인 성공');

  res.json({
    success: true,
    message: '로그인 성공',
    token,
    user: user.toJSON()
  });
}));

// 로그아웃
router.post('/logout', authenticate, catchAsync(async (req, res) => {
  logger.auth('LOGOUT', req.user.username, '로그아웃');

  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
}));

// 현재 사용자 정보 조회
router.get('/me', authenticate, catchAsync(async (req, res) => {
  res.json({
    success: true,
    user: req.user.toJSON()
  });
}));

// 패스워드 변경
router.post('/change-password', authenticate, catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // 입력값 검증
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: '현재 패스워드와 새 패스워드를 입력해주세요.'
    });
  }

  // 새 패스워드 검증
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: '새 패스워드는 최소 6자 이상이어야 합니다.'
    });
  }

  // 현재 패스워드 확인
  const user = User.findById(req.user.id);
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);

  if (!isCurrentPasswordValid) {
    logger.auth('FAILED', user.username, '패스워드 변경 - 현재 패스워드 불일치');
    return res.status(400).json({
      success: false,
      message: '현재 패스워드가 올바르지 않습니다.'
    });
  }

  // 패스워드 변경
  await user.changePassword(newPassword);

  logger.auth('SUCCESS', user.username, '패스워드 변경 성공');

  res.json({
    success: true,
    message: '패스워드가 성공적으로 변경되었습니다.'
  });
}));

// 토큰 갱신
router.post('/refresh', authenticate, catchAsync(async (req, res) => {
  const newToken = signToken(req.user.id);

  res.json({
    success: true,
    token: newToken
  });
}));

module.exports = router;