// src/models/User.js - 사용자 데이터 모델 (메모리 기반)
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// 메모리 기반 사용자 저장소 (실제 환경에서는 데이터베이스 사용)
let users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@display.com',
    password: bcrypt.hashSync('admin123!', 10),
    role: 'admin',
    permissions: ['device_control', 'message_send', 'config_change', 'user_manage', 'view_logs'],
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastLogin: null,
    loginCount: 0,
    profile: {
      firstName: '관리자',
      lastName: '시스템',
      department: 'IT',
      phone: '010-0000-0000'
    }
  },
  {
    id: 2,
    username: 'operator1',
    email: 'operator1@display.com',
    password: bcrypt.hashSync('operator123!', 10),
    role: 'operator',
    permissions: ['message_send', 'device_control'],
    active: true,
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
    lastLogin: null,
    loginCount: 0,
    profile: {
      firstName: '운영자',
      lastName: '1',
      department: '운영팀',
      phone: '010-1111-1111'
    }
  },
  {
    id: 3,
    username: 'viewer1',
    email: 'viewer1@display.com',
    password: bcrypt.hashSync('viewer123!', 10),
    role: 'viewer',
    permissions: ['view_only'],
    active: true,
    createdAt: new Date('2025-01-03'),
    updatedAt: new Date('2025-01-03'),
    lastLogin: null,
    loginCount: 0,
    profile: {
      firstName: '관람자',
      lastName: '1',
      department: '모니터링팀',
      phone: '010-2222-2222'
    }
  }
];

// 사용자 ID 시퀀스
let userIdSequence = 4;

// 역할별 기본 권한 정의
const rolePermissions = {
  admin: ['device_control', 'message_send', 'config_change', 'user_manage', 'view_logs', 'system_control'],
  operator: ['message_send', 'device_control', 'view_logs'],
  viewer: ['view_only'],
  emergency: ['message_send'] // 긴급상황 전용 계정
};

class User {
  constructor(userData) {
    this.id = userData.id || userIdSequence++;
    this.username = userData.username;
    this.email = userData.email;
    this.password = userData.password;
    this.role = userData.role || 'viewer';
    this.permissions = userData.permissions || rolePermissions[this.role] || [];
    this.active = userData.active !== undefined ? userData.active : true;
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt || new Date();
    this.lastLogin = userData.lastLogin || null;
    this.loginCount = userData.loginCount || 0;
    this.passwordChangedAt = userData.passwordChangedAt || null;
    this.profile = userData.profile || {};
    this.settings = userData.settings || {
      theme: 'light',
      language: 'ko',
      notifications: true,
      autoLogout: 30 // 분
    };


  }

  // 패스워드 검증
  async comparePassword(candidatePassword) {
    if (!this.password || !candidatePassword) {
      return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
  }

  // 패스워드 변경
  async changePassword(newPassword) {
    this.password = await bcrypt.hash(newPassword, 10);
    this.passwordChangedAt = new Date();
    this.updatedAt = new Date();
    return this.save();
  }

  // 로그인 정보 업데이트
  updateLoginInfo() {
    this.lastLogin = new Date();
    this.loginCount += 1;
    this.updatedAt = new Date();
    return this.save();
  }

  // 사용자 정보 업데이트
  update(updateData) {
    const allowedFields = ['email', 'role', 'permissions', 'active', 'profile', 'settings'];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'profile' || field === 'settings') {
          this[field] = { ...this[field], ...updateData[field] };
        } else {
          this[field] = updateData[field];
        }
      }
    });

    this.updatedAt = new Date();
    return this.save();
  }

  // 권한 확인
  hasPermission(permission) {
    return this.permissions.includes(permission) || this.role === 'admin';
  }

  // 역할 확인
  hasRole(role) {
    return this.role === role;
  }

  // 저장
  save() {
    const index = users.findIndex(user => user.id === this.id);
    if (index !== -1) {
      users[index] = this.toObject(true); // 패스워드 포함하여 저장
    } else {
      users.push(this.toObject(true)); // 패스워드 포함하여 저장
    }
    return this;
  }

  // 객체 변환 (패스워드 제외)
  toObject(includePassword = false) {
    const obj = { ...this };
    if (!includePassword) {
      delete obj.password;
    }
    return obj;
  }

  // JSON 변환 (패스워드 항상 제외)
  toJSON() {
    return this.toObject(false);
  }

  // 정적 메서드들
  static findAll(options = {}) {
    let result = users.map(userData => new User(userData));

    // 필터링
    if (options.active !== undefined) {
      result = result.filter(user => user.active === options.active);
    }

    if (options.role) {
      result = result.filter(user => user.role === options.role);
    }

    // 정렬
    if (options.sortBy) {
      result.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        if (options.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    // 페이지네이션
    if (options.page && options.limit) {
      const start = (options.page - 1) * options.limit;
      result = result.slice(start, start + options.limit);
    }

    return result;
  }

  static findById(id) {
    const userData = users.find(user => user.id === parseInt(id));
    return userData ? new User(userData) : null;
  }

  static findByUsername(username) {
    const userData = users.find(user => user.username === username);
    return userData ? new User(userData) : null;
  }

  static findByEmail(email) {
    const userData = users.find(user => user.email === email);
    return userData ? new User(userData) : null;
  }

  static create(userData) {
    // 중복 확인
    if (User.findByUsername(userData.username)) {
      throw new Error('이미 존재하는 사용자명입니다.');
    }

    if (User.findByEmail(userData.email)) {
      throw new Error('이미 존재하는 이메일입니다.');
    }

    // 패스워드 해시화
    if (userData.password) {
      userData.password = bcrypt.hashSync(userData.password, 10);
    }

    // 역할별 기본 권한 설정
    if (!userData.permissions && userData.role) {
      userData.permissions = rolePermissions[userData.role] || [];
    }

    const user = new User(userData);
    return user.save();
  }

  static update(id, updateData) {
    const user = User.findById(id);
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    return user.update(updateData);
  }

  static delete(id) {
    const index = users.findIndex(user => user.id === parseInt(id));
    if (index === -1) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    users.splice(index, 1);
    return true;
  }

  static count(options = {}) {
    let result = users;

    if (options.active !== undefined) {
      result = result.filter(user => user.active === options.active);
    }

    if (options.role) {
      result = result.filter(user => user.role === options.role);
    }

    return result.length;
  }

  // 통계 정보
  static getStats() {
    const total = users.length;
    const active = users.filter(user => user.active).length;
    const roles = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      active,
      inactive: total - active,
      roles
    };
  }

  // 역할 및 권한 정보
  static getRolePermissions() {
    return rolePermissions;
  }

  static getAvailablePermissions() {
    return [
      'device_control',    // 디바이스 제어
      'message_send',      // 메시지 전송
      'config_change',     // 설정 변경
      'user_manage',       // 사용자 관리
      'view_logs',         // 로그 조회
      'system_control',    // 시스템 제어
      'view_only'          // 조회만 가능
    ];
  }

  // 🔧 사용자 데이터 초기화 (패스워드 복구용)
  static initializeUsers() {
    console.log('🔧 사용자 데이터 초기화 시작...');

    // 기존 users 배열 확인
    const adminUser = users.find(u => u.username === 'admin');
    if (!adminUser || !adminUser.password) {
      console.log('⚠️ admin 사용자 패스워드 누락, 재초기화 중...');

      // users 배열 완전 재초기화
      users.length = 0; // 배열 클리어
      users.push(
        {
          id: 1,
          username: 'admin',
          email: 'admin@display.com',
          password: bcrypt.hashSync('admin123!', 10),
          role: 'admin',
          permissions: ['device_control', 'message_send', 'config_change', 'user_manage', 'view_logs'],
          active: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          lastLogin: null,
          loginCount: 0,
          profile: {
            firstName: '관리자',
            lastName: '시스템',
            department: 'IT',
            phone: '010-0000-0000'
          }
        },
        {
          id: 2,
          username: 'operator1',
          email: 'operator1@display.com',
          password: bcrypt.hashSync('operator123!', 10),
          role: 'operator',
          permissions: ['message_send', 'device_control'],
          active: true,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          lastLogin: null,
          loginCount: 0,
          profile: {
            firstName: '운영자',
            lastName: '1',
            department: '운영팀',
            phone: '010-1111-1111'
          }
        },
        {
          id: 3,
          username: 'viewer1',
          email: 'viewer1@display.com',
          password: bcrypt.hashSync('viewer123!', 10),
          role: 'viewer',
          permissions: ['view_only'],
          active: true,
          createdAt: new Date('2025-01-03'),
          updatedAt: new Date('2025-01-03'),
          lastLogin: null,
          loginCount: 0,
          profile: {
            firstName: '관람자',
            lastName: '1',
            department: '모니터링팀',
            phone: '010-2222-2222'
          }
        }
      );

      console.log('✅ 사용자 데이터 재초기화 완료');
    } else {
      console.log('✅ admin 사용자 패스워드 정상');
    }
  }
}

module.exports = User;