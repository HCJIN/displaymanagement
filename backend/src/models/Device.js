// src/models/Device.js - 전체 수정된 코드 (하트비트 문제 해결)
const { v4: uuidv4 } = require('uuid');

// ✅ ID 기반 디바이스 저장소 (기존 데이터 유지하면서 deviceId 추가)
let devices = [
  {
    id: '000000000001',
    name: '송학 동편 (1)',
    deviceId: 'C16LD25001EA', // ✅ 후이두 컨트롤러 ID 추가
    controllerType: 'HUIDU', // ✅ 컨트롤러 타입
    // ✅ 기존 IP/Port 유지 (하위 호환성을 위해)
    ip: '192.168.11.103',
    port: 7200,
    location: {
      address: '울산광역시 남구 송학동',
      coordinates: { lat: 35.9403100, lng: 126.9271374 },
      description: '송학동 주민센터 앞'
    },
    specs: {
      model: '노아LED',
      size: '2X10',
      resolution: { width: 320, height: 160 },
      maxBrightness: 15,
      supportedFormats: ['text', 'image', 'mixed'],
      pixelPitch: 10, // mm
      maxFileSize: 5242880 // 5MB
    },
    status: 'offline',
    connectionInfo: {
      connected: false,
      lastHeartbeat: null,
      connectionAttempts: 0,
      lastError: null,
      uptime: 0,
      // ✅ ID 기반 연결 정보
      deviceIdVerified: false, // 디바이스 ID 검증 상태
      protocolVersion: 'new', // 신프로토콜/구프로토콜
      lastProtocolCheck: null
    },
    config: {
      brightness: {
        day: 15,
        night: 8,
        current: 12,
        autoAdjust: true
      },
      schedule: {
        onTime: '06:00',
        offTime: '23:00',
        timezone: 'Asia/Seoul',
        enabled: true
      },
      display: {
        defaultFontSize: 12,
        scrollSpeed: 'normal',
        transitionEffect: 'slide_left',
        backgroundColor: '#000000',
        defaultTextColor: '#FFFFFF'
      },
      network: {
        timeout: 5000,
        retryAttempts: 3,
        heartbeatInterval: 30000,
        serverPort: 7200 // 서버 포트
      }
    },
    systemInfo: {
      temperature: null,
      powerStatus: 'unknown',
      memoryUsage: null,
      errorCount: 0,
      lastMaintenance: null,
      firmwareVersion: '1.0.0'
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastActiveAt: null
  },
  {
    id: '000000000002',
    name: '송학 서편 (2)',
    deviceId: 'C16LD25002EA', // ✅ 후이두 컨트롤러 ID 추가
    controllerType: 'HUIDU',
    // ✅ 기존 IP/Port 유지 (하위 호환성을 위해)
    ip: '192.168.12.103',
    port: 7200,
    location: {
      address: '울산광역시 남구 송학동',
      coordinates: { lat: 35.9411726, lng: 126.9229806 },
      description: '송학동 상가 앞'
    },
    specs: {
      model: '노아LED',
      size: '2X10',
      resolution: { width: 320, height: 160 },
      maxBrightness: 15,
      supportedFormats: ['text', 'image', 'mixed'],
      pixelPitch: 10,
      maxFileSize: 5242880
    },
    status: 'offline',
    connectionInfo: {
      connected: false,
      lastHeartbeat: null,
      connectionAttempts: 0,
      lastError: null,
      uptime: 0,
      deviceIdVerified: false,
      protocolVersion: 'new',
      lastProtocolCheck: null
    },
    config: {
      brightness: {
        day: 15,
        night: 8,
        current: 12,
        autoAdjust: true
      },
      schedule: {
        onTime: '06:00',
        offTime: '23:00',
        timezone: 'Asia/Seoul',
        enabled: true
      },
      display: {
        defaultFontSize: 12,
        scrollSpeed: 'normal',
        transitionEffect: 'slide_left',
        backgroundColor: '#000000',
        defaultTextColor: '#FFFFFF'
      },
      network: {
        timeout: 5000,
        retryAttempts: 3,
        heartbeatInterval: 30000,
        serverPort: 7200
      }
    },
    systemInfo: {
      temperature: null,
      powerStatus: 'unknown',
      memoryUsage: null,
      errorCount: 0,
      lastMaintenance: null,
      firmwareVersion: '1.0.0'
    },
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
    lastActiveAt: null
  }
];

// 디바이스 상태 열거형
const DeviceStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  ERROR: 'error',
  MAINTENANCE: 'maintenance',
  CONNECTING: 'connecting'
};

// 전원 상태 열거형
const PowerStatus = {
  ON: 'ON',
  OFF: 'OFF',
  STANDBY: 'STANDBY',
  UNKNOWN: 'UNKNOWN'
};

// ✅ 컨트롤러 타입 열거형
const ControllerType = {
  HUIDU: 'HUIDU',
  LINSN: 'LINSN',
  NOVASTAR: 'NOVASTAR',
  OTHER: 'OTHER'
};

class Device {
  constructor(deviceData) {
    Object.assign(this, deviceData);
    this.updatedAt = new Date();
  }

  // 디바이스 상태 업데이트
  updateStatus(status, error = null) {
    this.status = status;
    this.connectionInfo.lastError = error;
    this.updatedAt = new Date();

    if (status === DeviceStatus.ONLINE) {
      this.connectionInfo.connected = true;
      this.connectionInfo.lastHeartbeat = new Date();
      this.lastActiveAt = new Date();
    } else if (status === DeviceStatus.OFFLINE) {
      this.connectionInfo.connected = false;
    }

    return this.save();
  }

  // ✅ Device ID 검증 업데이트
  updateDeviceIdVerification(verified = false, protocolVersion = 'new') {
    if (!this.connectionInfo) {
      this.connectionInfo = {};
    }
    this.connectionInfo.deviceIdVerified = verified;
    this.connectionInfo.protocolVersion = protocolVersion;
    this.connectionInfo.lastProtocolCheck = new Date();
    this.updatedAt = new Date();
    return this.save();
  }

  // 🔧 수정된 하트비트 업데이트 (테스트 디바이스 지원)
  updateHeartbeat(systemInfo = {}) {
    this.connectionInfo.lastHeartbeat = new Date();
    this.lastActiveAt = new Date();

    // 시스템 정보 업데이트
    if (systemInfo.temperature !== undefined) {
      this.systemInfo.temperature = systemInfo.temperature;
    }
    if (systemInfo.powerStatus !== undefined) {
      this.systemInfo.powerStatus = systemInfo.powerStatus;
    }
    if (systemInfo.memoryUsage !== undefined) {
      this.systemInfo.memoryUsage = systemInfo.memoryUsage;
    }
    if (systemInfo.errorCount !== undefined) {
      this.systemInfo.errorCount = systemInfo.errorCount;
    }

    // 테스트 디바이스 확인
    const isTest = this.name?.includes('테스트') ||
      this.deviceId?.startsWith('TEST') ||
      this.ip?.startsWith('127.0.0') ||
      this.specs?.model?.includes('TEST');

    // 테스트 디바이스는 항상 온라인 상태 유지
    if (isTest && this.status !== DeviceStatus.ONLINE) {
      this.status = DeviceStatus.ONLINE;
      this.connectionInfo.connected = true;
    }

    this.updatedAt = new Date();
    return this.save();
  }

  // 설정 업데이트
  updateConfig(configData) {
    if (configData.brightness) {
      this.config.brightness = { ...this.config.brightness, ...configData.brightness };
    }
    if (configData.schedule) {
      this.config.schedule = { ...this.config.schedule, ...configData.schedule };
    }
    if (configData.display) {
      this.config.display = { ...this.config.display, ...configData.display };
    }
    if (configData.network) {
      this.config.network = { ...this.config.network, ...configData.network };
    }
    if (configData.protocol) {
      if (!this.config.protocol) this.config.protocol = {};
      this.config.protocol = { ...this.config.protocol, ...configData.protocol };
    }

    this.updatedAt = new Date();
    return this.save();
  }

  // ✅ ID 기반 연결 시도 기록
  recordConnectionAttempt(success = false, error = null, deviceIdMatched = false) {
    this.connectionInfo.connectionAttempts += 1;

    if (success && deviceIdMatched) {
      this.connectionInfo.connectionAttempts = 0; // 성공 시 리셋
      this.connectionInfo.lastError = null;
      this.connectionInfo.deviceIdVerified = true;
      this.updateStatus(DeviceStatus.ONLINE);
    } else {
      this.connectionInfo.lastError = error;
      this.connectionInfo.deviceIdVerified = false;
      this.updateStatus(DeviceStatus.OFFLINE, error);
    }

    return this.save();
  }

  // 연결 상태 확인
  isOnline() {
    return this.status === DeviceStatus.ONLINE &&
      this.connectionInfo.connected;
  }

  // 🔧 수정된 하트비트 만료 확인 (테스트 디바이스 제외)
  isHeartbeatExpired(timeoutMs = 300000) { // 5분으로 연장
    if (!this.connectionInfo.lastHeartbeat) return true;

    const now = new Date();
    const lastHeartbeat = new Date(this.connectionInfo.lastHeartbeat);
    const timeDiff = now - lastHeartbeat;

    // 테스트 디바이스는 항상 유효한 것으로 처리
    const isTest = this.name?.includes('테스트') ||
      this.deviceId?.startsWith('TEST') ||
      this.ip?.startsWith('127.0.0') ||
      this.specs?.model?.includes('TEST');

    if (isTest) {
      return false; // 테스트 디바이스는 만료되지 않음
    }

    return timeDiff > timeoutMs;
  }

  // ✅ Device ID 유효성 검사 (안전하게)
  isValidDeviceId() {
    if (!this.deviceId) return false;

    // Device ID 형식 검증 (영문, 숫자, 8-20자)
    const deviceIdPattern = /^[A-Za-z0-9]{8,20}$/;
    return deviceIdPattern.test(this.deviceId);
  }

  // ✅ 프로토콜 버전 확인 (안전하게)
  getProtocolVersion() {
    return this.connectionInfo?.protocolVersion || 'new';
  }

  // ✅ 서버 포트 가져오기 (안전하게)
  getServerPort() {
    const protocolVersion = this.getProtocolVersion();
    // 프로토콜 문서에 따른 포트 설정
    if (protocolVersion === 'old') {
      return 7200; // 구프로토콜
    } else {
      return 7200; // 신프로토콜 (현재는 동일)
    }
  }

  // 운영 시간 확인
  isOperationalTime() {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM 형식

    const onTime = this.config.schedule.onTime;
    const offTime = this.config.schedule.offTime;

    if (!this.config.schedule.enabled) return true;

    // 24시간 형식으로 비교
    if (onTime <= offTime) {
      return currentTime >= onTime && currentTime <= offTime;
    } else {
      // 자정을 넘어가는 경우
      return currentTime >= onTime || currentTime <= offTime;
    }
  }

  // 저장
  save() {
    const index = devices.findIndex(device => device.id === this.id);
    if (index !== -1) {
      devices[index] = this.toObject();
    } else {
      devices.push(this.toObject());
    }
    return this;
  }

  // 객체 변환
  toObject() {
    return { ...this };
  }

  // JSON 변환
  toJSON() {
    return this.toObject();
  }

  // 정적 메서드들
  static findAll(options = {}) {
    let result = devices.map(deviceData => new Device(deviceData));

    // 필터링
    if (options.status) {
      result = result.filter(device => device.status === options.status);
    }

    if (options.connected !== undefined) {
      result = result.filter(device => device.connectionInfo.connected === options.connected);
    }

    if (options.location) {
      result = result.filter(device =>
        device.location.address.includes(options.location)
      );
    }

    // ✅ Device ID로 필터링 (안전하게)
    if (options.deviceId) {
      result = result.filter(device =>
        device.deviceId && device.deviceId.includes(options.deviceId)
      );
    }

    // ✅ 컨트롤러 타입으로 필터링 (안전하게)
    if (options.controllerType) {
      result = result.filter(device => device.controllerType === options.controllerType);
    }

    // 정렬
    if (options.sortBy) {
      result.sort((a, b) => {
        let aVal = a[options.sortBy];
        let bVal = b[options.sortBy];

        // 중첩된 속성 처리
        if (options.sortBy.includes('.')) {
          const keys = options.sortBy.split('.');
          aVal = keys.reduce((obj, key) => obj?.[key], a);
          bVal = keys.reduce((obj, key) => obj?.[key], b);
        }

        if (options.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    return result;
  }

  static findById(id) {
    const deviceData = devices.find(device => device.id === id);
    return deviceData ? new Device(deviceData) : null;
  }

  // ✅ Device ID로 찾기 (안전하게)
  static findByDeviceId(deviceId) {
    if (!deviceId) return null;
    const deviceData = devices.find(device => device.deviceId === deviceId);
    return deviceData ? new Device(deviceData) : null;
  }

  // ✅ IP로 찾기 (하위 호환성 유지)
  static findByIp(ip) {
    const deviceData = devices.find(device => device.ip === ip);
    return deviceData ? new Device(deviceData) : null;
  }

  static create(deviceData) {
    // ID 생성 (없는 경우)
    if (!deviceData.id) {
      deviceData.id = uuidv4().replace(/-/g, '').substring(0, 12);
    }

    // ✅ Device ID가 있으면 검증, 없으면 기존 방식대로
    if (deviceData.deviceId) {
      // Device ID 형식 검증
      const deviceIdPattern = /^[A-Za-z0-9]{8,20}$/;
      if (!deviceIdPattern.test(deviceData.deviceId)) {
        throw new Error('Device ID는 8-20자의 영문, 숫자만 허용됩니다.');
      }

      // Device ID 중복 확인
      if (Device.findByDeviceId(deviceData.deviceId)) {
        throw new Error('이미 존재하는 Device ID입니다.');
      }
    }

    // 중복 확인
    if (Device.findById(deviceData.id)) {
      throw new Error('이미 존재하는 디바이스 ID입니다.');
    }

    // ✅ IP 중복 확인 (기존 로직 유지)
    if (deviceData.ip && Device.findByIp(deviceData.ip)) {
      throw new Error('이미 존재하는 IP 주소입니다.');
    }

    // 기본값 설정
    const defaultDevice = {
      controllerType: deviceData.controllerType || ControllerType.HUIDU, // ✅ 기본 컨트롤러 타입
      status: DeviceStatus.OFFLINE,
      connectionInfo: {
        connected: false,
        lastHeartbeat: null,
        connectionAttempts: 0,
        lastError: null,
        uptime: 0,
        // ✅ ID 기반 연결 정보
        deviceIdVerified: false,
        protocolVersion: 'new',
        lastProtocolCheck: null
      },
      config: {
        brightness: { day: 15, night: 8, current: 12, autoAdjust: true },
        schedule: { onTime: '06:00', offTime: '23:00', timezone: 'Asia/Seoul', enabled: true },
        display: {
          defaultFontSize: 12,
          scrollSpeed: 'normal',
          transitionEffect: 'slide_left',
          backgroundColor: '#000000',
          defaultTextColor: '#FFFFFF'
        },
        network: {
          timeout: 5000,
          retryAttempts: 3,
          heartbeatInterval: 30000,
          serverPort: 7200
        }
      },
      systemInfo: {
        temperature: null,
        powerStatus: PowerStatus.UNKNOWN,
        memoryUsage: null,
        errorCount: 0,
        lastMaintenance: null,
        firmwareVersion: '1.0.0'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: null
    };

    const mergedData = { ...defaultDevice, ...deviceData };
    const device = new Device(mergedData);
    return device.save();
  }

  static update(id, updateData) {
    const device = Device.findById(id);
    if (!device) {
      throw new Error('디바이스를 찾을 수 없습니다.');
    }

    // ✅ Device ID 변경 시 중복 확인 (안전하게)
    if (updateData.deviceId && updateData.deviceId !== device.deviceId) {
      const deviceIdPattern = /^[A-Za-z0-9]{8,20}$/;
      if (!deviceIdPattern.test(updateData.deviceId)) {
        throw new Error('Device ID는 8-20자의 영문, 숫자만 허용됩니다.');
      }

      if (Device.findByDeviceId(updateData.deviceId)) {
        throw new Error('이미 존재하는 Device ID입니다.');
      }
    }

    // ✅ IP 변경 시 중복 확인 (기존 로직 유지)
    if (updateData.ip && updateData.ip !== device.ip) {
      if (Device.findByIp(updateData.ip)) {
        throw new Error('이미 존재하는 IP 주소입니다.');
      }
    }

    // ✅ 허용된 필드만 업데이트 (IP도 유지)
    const allowedFields = ['name', 'deviceId', 'controllerType', 'ip', 'port', 'location', 'specs'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (typeof device[field] === 'object' && device[field] !== null) {
          device[field] = { ...device[field], ...updateData[field] };
        } else {
          device[field] = updateData[field];
        }
      }
    });

    device.updatedAt = new Date();
    return device.save();
  }

  static delete(id) {
    const index = devices.findIndex(device => device.id === id);
    if (index === -1) {
      throw new Error('디바이스를 찾을 수 없습니다.');
    }

    devices.splice(index, 1);
    return true;
  }

  static count(options = {}) {
    let result = devices;

    if (options.status) {
      result = result.filter(device => device.status === options.status);
    }

    if (options.connected !== undefined) {
      result = result.filter(device => device.connectionInfo.connected === options.connected);
    }

    // ✅ Device ID 검증 상태로 필터링 (안전하게)
    if (options.deviceIdVerified !== undefined) {
      result = result.filter(device =>
        device.connectionInfo?.deviceIdVerified === options.deviceIdVerified
      );
    }

    return result.length;
  }

  // 🔧 수정된 통계 정보 (테스트 디바이스 구분 추가)
  static getStats() {
    const total = devices.length;
    const online = devices.filter(device => device.status === DeviceStatus.ONLINE).length;
    const offline = devices.filter(device => device.status === DeviceStatus.OFFLINE).length;
    const error = devices.filter(device => device.status === DeviceStatus.ERROR).length;
    const maintenance = devices.filter(device => device.status === DeviceStatus.MAINTENANCE).length;

    // ✅ 테스트 디바이스 통계 추가
    const testDevices = devices.filter(device => Device.isTestDevice(device)).length;
    const realDevices = total - testDevices;
    const testOnline = devices.filter(device =>
      Device.isTestDevice(device) && device.status === DeviceStatus.ONLINE
    ).length;
    const realOnline = online - testOnline;

    // ✅ Device ID 검증 통계 (안전하게)
    const deviceIdVerified = devices.filter(device =>
      device.connectionInfo?.deviceIdVerified
    ).length;

    // ✅ 컨트롤러 타입별 통계 (안전하게)
    const controllerStats = devices.reduce((acc, device) => {
      const type = device.controllerType || 'UNKNOWN';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const modelStats = devices.reduce((acc, device) => {
      const model = device.specs?.model || 'Unknown';
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      online,
      offline,
      error,
      maintenance,
      deviceIdVerified,
      controllers: controllerStats,
      models: modelStats,
      uptime: total > 0 ? (online / total * 100) : 0,
      // 🆕 테스트/실제 디바이스 구분
      testDevices: {
        total: testDevices,
        online: testOnline,
        offline: testDevices - testOnline
      },
      realDevices: {
        total: realDevices,
        online: realOnline,
        offline: realDevices - realOnline
      }
    };
  }

  // 🔧 수정된 하트비트 체크 (테스트 디바이스 제외)
  static checkHeartbeats(timeoutMs = 300000) { // 5분으로 연장
    const expiredDevices = [];

    devices.forEach(deviceData => {
      const device = new Device(deviceData);

      // 🧪 테스트 디바이스 확인
      const isTest = device.name?.includes('테스트') ||
        device.deviceId?.startsWith('TEST') ||
        device.ip?.startsWith('127.0.0') ||
        device.specs?.model?.includes('TEST');

      // 테스트 디바이스는 하트비트 체크에서 제외
      if (!isTest && device.isOnline() && device.isHeartbeatExpired(timeoutMs)) {
        console.log(`💔 실제 디바이스 하트비트 만료: ${device.name} (${device.deviceId})`);
        device.updateStatus(DeviceStatus.OFFLINE, 'Heartbeat timeout');
        expiredDevices.push(device.id);
      }
    });

    return expiredDevices;
  }

  // 🆕 테스트 디바이스 하트비트 유지 메서드
  static maintainTestDeviceHeartbeats() {
    const testDevices = devices.filter(deviceData => {
      const device = new Device(deviceData);
      return device.name?.includes('테스트') ||
        device.deviceId?.startsWith('TEST') ||
        device.ip?.startsWith('127.0.0') ||
        device.specs?.model?.includes('TEST');
    });

    testDevices.forEach(deviceData => {
      const device = new Device(deviceData);
      if (device.status === DeviceStatus.ONLINE) {
        // 테스트 디바이스 하트비트 업데이트
        device.updateHeartbeat({
          temperature: 25 + Math.random() * 10,
          powerStatus: PowerStatus.ON,
          memoryUsage: 30 + Math.random() * 40,
          errorCount: 0
        });
      }
    });

    return testDevices.length;
  }

  // ✅ Device ID 검증이 필요한 디바이스 확인 (안전하게)
  static checkDeviceIdVerification() {
    const unverifiedDevices = [];

    devices.forEach(deviceData => {
      const device = new Device(deviceData);
      if (device.status === DeviceStatus.ONLINE &&
        device.deviceId &&
        !device.connectionInfo?.deviceIdVerified) {
        unverifiedDevices.push({
          id: device.id,
          deviceId: device.deviceId,
          name: device.name,
          lastProtocolCheck: device.connectionInfo?.lastProtocolCheck
        });
      }
    });

    return unverifiedDevices;
  }

  // 운영 시간 외 디바이스 확인
  static checkOperationalTime() {
    const results = {
      shouldBeOn: [],
      shouldBeOff: []
    };

    devices.forEach(deviceData => {
      const device = new Device(deviceData);
      const isOperational = device.isOperationalTime();

      if (isOperational && device.status === DeviceStatus.OFFLINE) {
        results.shouldBeOn.push(device.id);
      } else if (!isOperational && device.status === DeviceStatus.ONLINE) {
        results.shouldBeOff.push(device.id);
      }
    });

    return results;
  }

  // ✅ Device ID로 프로토콜 명령 생성 (안전하게)
  static generateProtocolCommand(deviceId, commandType, data = {}) {
    const device = Device.findByDeviceId(deviceId);
    if (!device) {
      throw new Error('Device ID를 찾을 수 없습니다.');
    }

    const protocolVersion = device.getProtocolVersion();

    // 프로토콜 문서에 따른 명령 생성
    const command = {
      deviceId: deviceId,
      protocolVersion: protocolVersion,
      commandType: commandType,
      data: data,
      timestamp: new Date().toISOString()
    };

    return command;
  }

  // 🆕 테스트 디바이스 여부 확인 정적 메서드
  static isTestDevice(device) {
    return device.name?.includes('테스트') ||
      device.deviceId?.startsWith('TEST') ||
      device.ip?.startsWith('127.0.0') ||
      device.specs?.model?.includes('TEST') ||
      device.isTest === true;
  }
}

// 상수 내보내기
Device.Status = DeviceStatus;
Device.PowerStatus = PowerStatus;
Device.ControllerType = ControllerType; // ✅ 컨트롤러 타입 추가

module.exports = Device;