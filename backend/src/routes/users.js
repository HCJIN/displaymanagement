// src/routes/users.js - 사용자 관리 라우터
const express = require('express');
const { authenticate, authorize, authorizeOwnerOrAdmin, requireRole } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// 모든 라우트에 인증 필요
router.use(authenticate);

// 사용자 목록 조회 (관리자만)
router.get('/', requireRole('admin'), catchAsync(async (req, res) => {
  const { active, role, page, limit, sortBy, sortOrder } = req.query;

  const options = {};
  if (active !== undefined) options.active = active === 'true';
  if (role) options.role = role;
  if (page) options.page = parseInt(page);
  if (limit) options.limit = parseInt(limit);
  if (sortBy) options.sortBy = sortBy;
  if (sortOrder) options.sortOrder = sortOrder;

  const users = User.findAll(options);
  const totalCount = User.count(options);
  const stats = User.getStats();

  res.json({
    success: true,
    users,
    totalCount,
    stats
  });
}));

// 특정 사용자 조회
router.get('/:id', authorizeOwnerOrAdmin(), catchAsync(async (req, res) => {
  const user = User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '사용자를 찾을 수 없습니다.'
    });
  }

  res.json({
    success: true,
    user: user.toJSON()
  });
}));

// 사용자 생성 (관리자만)
router.post('/', requireRole('admin'), catchAsync(async (req, res) => {
  const { username, email, password, role, permissions, profile } = req.body;

  // 입력값 검증
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: '사용자명, 이메일, 패스워드는 필수입니다.'
    });
  }

  // 패스워드 길이 검증
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '패스워드는 최소 6자 이상이어야 합니다.'
    });
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: '유효한 이메일 주소를 입력해주세요.'
    });
  }

  try {
    const userData = {
      username,
      email,
      password,
      role: role || 'viewer',
      permissions: permissions || User.getRolePermissions()[role || 'viewer'],
      profile: profile || {},
      active: true
    };

    const user = User.create(userData);

    logger.info(`새 사용자 생성: ${username} (${role || 'viewer'}) by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: '사용자가 생성되었습니다.',
      user: user.toJSON()
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// 사용자 정보 수정
router.put('/:id', authorizeOwnerOrAdmin(), catchAsync(async (req, res) => {
  const user = User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '사용자를 찾을 수 없습니다.'
    });
  }

  const { email, role, permissions, active, profile, settings } = req.body;

  // 본인이 아닌 경우 역할과 권한 변경 불가 (관리자 제외)
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    if (role || permissions || active !== undefined) {
      return res.status(403).json({
        success: false,
        message: '역할, 권한, 활성화 상태는 관리자만 변경할 수 있습니다.'
      });
    }
  }

  // 이메일 형식 검증
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '유효한 이메일 주소를 입력해주세요.'
      });
    }
  }

  const updateData = {};
  if (email) updateData.email = email;
  if (role && req.user.role === 'admin') updateData.role = role;
  if (permissions && req.user.role === 'admin') updateData.permissions = permissions;
  if (active !== undefined && req.user.role === 'admin') updateData.active = active;
  if (profile) updateData.profile = profile;
  if (settings) updateData.settings = settings;

  try {
    const updatedUser = user.update(updateData);

    logger.info(`사용자 정보 수정: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: '사용자 정보가 수정되었습니다.',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// 사용자 삭제 (관리자만, 본인 제외)
router.delete('/:id', requireRole('admin'), catchAsync(async (req, res) => {
  const targetUserId = parseInt(req.params.id);

  // 본인 삭제 방지
  if (req.user.id === targetUserId) {
    return res.status(400).json({
      success: false,
      message: '본인 계정은 삭제할 수 없습니다.'
    });
  }

  const user = User.findById(targetUserId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '사용자를 찾을 수 없습니다.'
    });
  }

  User.delete(targetUserId);

  logger.info(`사용자 삭제: ${user.username} by ${req.user.username}`);

  res.json({
    success: true,
    message: '사용자가 삭제되었습니다.'
  });
}));

// 사용자 비활성화/활성화 (관리자만)
router.patch('/:id/toggle-active', requireRole('admin'), catchAsync(async (req, res) => {
  const targetUserId = parseInt(req.params.id);

  // 본인 비활성화 방지
  if (req.user.id === targetUserId) {
    return res.status(400).json({
      success: false,
      message: '본인 계정의 활성화 상태는 변경할 수 없습니다.'
    });
  }

  const user = User.findById(targetUserId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '사용자를 찾을 수 없습니다.'
    });
  }

  const updatedUser = user.update({ active: !user.active });

  logger.info(`사용자 활성화 상태 변경: ${user.username} -> ${updatedUser.active ? '활성화' : '비활성화'} by ${req.user.username}`);

  res.json({
    success: true,
    message: `사용자가 ${updatedUser.active ? '활성화' : '비활성화'}되었습니다.`,
    user: updatedUser.toJSON()
  });
}));

// 사용자 역할 변경 (관리자만)
router.patch('/:id/role', requireRole('admin'), catchAsync(async (req, res) => {
  const { role } = req.body;

  if (!role || !Object.keys(User.getRolePermissions()).includes(role)) {
    return res.status(400).json({
      success: false,
      message: '유효한 역할을 제공해주세요.',
      availableRoles: Object.keys(User.getRolePermissions())
    });
  }

  const targetUserId = parseInt(req.params.id);
  const user = User.findById(targetUserId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '사용자를 찾을 수 없습니다.'
    });
  }

  // 본인 역할 변경 방지
  if (req.user.id === targetUserId) {
    return res.status(400).json({
      success: false,
      message: '본인의 역할은 변경할 수 없습니다.'
    });
  }

  const updatedUser = user.update({
    role,
    permissions: User.getRolePermissions()[role]
  });

  logger.info(`사용자 역할 변경: ${user.username} -> ${role} by ${req.user.username}`);

  res.json({
    success: true,
    message: '사용자 역할이 변경되었습니다.',
    user: updatedUser.toJSON()
  });
}));

// 사용자 통계 (관리자만)
router.get('/stats/overview', requireRole('admin'), catchAsync(async (req, res) => {
  const stats = User.getStats();
  const rolePermissions = User.getRolePermissions();
  const availablePermissions = User.getAvailablePermissions();

  res.json({
    success: true,
    stats,
    rolePermissions,
    availablePermissions
  });
}));

// 현재 사용자 프로필 업데이트
router.put('/profile/me', catchAsync(async (req, res) => {
  const { profile, settings } = req.body;

  const user = User.findById(req.user.id);
  const updateData = {};

  if (profile) updateData.profile = profile;
  if (settings) updateData.settings = settings;

  const updatedUser = user.update(updateData);

  logger.info(`프로필 업데이트: ${user.username}`);

  res.json({
    success: true,
    message: '프로필이 업데이트되었습니다.',
    user: updatedUser.toJSON()
  });
}));

// 사용자 검색 (관리자만)
router.get('/search/:query', requireRole('admin'), catchAsync(async (req, res) => {
  const query = req.params.query.toLowerCase();
  const allUsers = User.findAll();

  const matchingUsers = allUsers.filter(user =>
    user.username.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query) ||
    (user.profile.firstName && user.profile.firstName.toLowerCase().includes(query)) ||
    (user.profile.lastName && user.profile.lastName.toLowerCase().includes(query))
  );

  res.json({
    success: true,
    users: matchingUsers,
    totalCount: matchingUsers.length,
    query
  });
}));

module.exports = router;