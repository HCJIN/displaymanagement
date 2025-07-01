// src/services/socketService.js - ID 기반 소켓 연결 서비스 (완전한 코드 - 하트비트 문제 해결)
const net = require('net');
const Device = require('../models/Device');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.server = null;
    this.clients = new Map(); // deviceId -> socket 매핑
    this.deviceSockets = new Map(); // socket -> deviceInfo 매핑
    this.testHeartbeatIntervals = new Map(); // 테스트 디바이스 하트비트 인터벌
    this.isRunning = false;
    this.port = process.env.SOCKET_PORT || 7200; // 프로토콜 문서의 포트
    this.eventEmitter = null; // 웹 클라이언트 이벤트용
  }

  // ✅ 웹 클라이언트 이벤트 발생기 설정
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }

  // ✅ 웹 클라이언트에 이벤트 발생
  emitToWeb(eventType, data) {
    if (this.eventEmitter) {
      this.eventEmitter(eventType, {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 🔧 서버 시작 (ID 기반 연결 대기)
  async start() {
    if (this.isRunning) {
      logger.warn('소켓 서비스가 이미 실행 중입니다.');
      return;
    }

    try {
      this.server = net.createServer((socket) => {
        this.handleNewConnection(socket);
      });

      this.server.listen(this.port, () => {
        logger.info(`🔌 ID 기반 소켓 서버 시작: 포트 ${this.port}`);
        this.isRunning = true;
      });

      this.server.on('error', (error) => {
        logger.error('소켓 서버 오류:', error);
        this.isRunning = false;
      });

    } catch (error) {
      logger.error('소켓 서버 시작 실패:', error);
      throw error;
    }
  }

  // 🔧 새 연결 처리 (ID 기반 인증)
  handleNewConnection(socket) {
    const clientInfo = {
      address: socket.remoteAddress,
      port: socket.remotePort,
      deviceId: null,
      verified: false,
      isTest: false,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    };

    logger.info(`🔗 새 연결: ${clientInfo.address}:${clientInfo.port}`);

    // 소켓 정보 저장
    this.deviceSockets.set(socket, clientInfo);

    // 이벤트 리스너 설정
    socket.on('data', (data) => {
      this.handleData(socket, data);
    });

    socket.on('close', () => {
      this.handleDisconnection(socket);
    });

    socket.on('error', (error) => {
      this.handleSocketError(socket, error);
    });

    // ✅ 연결 후 ID 확인 요청 (프로토콜에 따라)
    this.requestDeviceId(socket);
  }

  // 🔧 Device ID 요청 (프로토콜 0x10)
  requestDeviceId(socket) {
    try {
      // 신프로토콜 ID 요청 패킷 생성
      const idRequestPacket = this.createIdRequestPacket();
      socket.write(idRequestPacket);

      logger.debug('📤 Device ID 요청 전송');

      // 5초 후 응답 없으면 연결 종료
      setTimeout(() => {
        const clientInfo = this.deviceSockets.get(socket);
        if (clientInfo && !clientInfo.verified) {
          logger.warn('⏰ Device ID 응답 타임아웃, 연결 종료');
          socket.destroy();
        }
      }, 5000);

    } catch (error) {
      logger.error('Device ID 요청 실패:', error);
      socket.destroy();
    }
  }

  // 🔧 데이터 수신 처리
  handleData(socket, data) {
    try {
      const clientInfo = this.deviceSockets.get(socket);
      if (!clientInfo) return;

      // 패킷 파싱
      const packet = this.parsePacket(data);
      if (!packet) {
        logger.warn('잘못된 패킷 형식');
        return;
      }

      logger.debug('📥 수신된 패킷:', {
        command: packet.command.toString(16),
        length: packet.data ? packet.data.length : 0,
        deviceId: clientInfo.deviceId
      });

      // ✅ 명령어별 처리
      switch (packet.command) {
        case 0x10: // ID 전송 (최초 접속)
          this.handleDeviceIdResponse(socket, packet);
          break;
        case 0x03: // 시간 동기화 응답
          this.handleTimeSync(socket, packet);
          break;
        case 0x08: // 수신정보 이상 회신
          this.handleErrorResponse(socket, packet);
          break;
        default:
          logger.debug(`처리되지 않은 명령어: 0x${packet.command.toString(16)}`);
      }

      // 하트비트 업데이트
      clientInfo.lastHeartbeat = new Date();

    } catch (error) {
      logger.error('데이터 처리 오류:', error);
    }
  }

  // 🔧 Device ID 응답 처리 (테스트 디바이스 지원 강화)
  handleDeviceIdResponse(socket, packet) {
    try {
      const deviceId = packet.data.toString('ascii').trim();
      const clientInfo = this.deviceSockets.get(socket);

      logger.info(`🆔 Device ID 수신: ${deviceId}`);

      // Device ID 유효성 검사
      if (!this.isValidDeviceId(deviceId)) {
        logger.warn(`❌ 잘못된 Device ID 형식: ${deviceId}`);
        socket.destroy();
        return;
      }

      // 데이터베이스에서 디바이스 확인
      const device = Device.findByDeviceId(deviceId);
      if (!device) {
        logger.warn(`❌ 등록되지 않은 Device ID: ${deviceId}`);
        socket.destroy();
        return;
      }

      // ✅ 테스트 디바이스 확인
      const isTest = device.name?.includes('테스트') ||
        device.deviceId?.startsWith('TEST') ||
        device.ip?.startsWith('127.0.0') ||
        device.specs?.model?.includes('TEST');

      // ✅ 중복 연결 확인
      if (this.clients.has(deviceId)) {
        logger.warn(`⚠️ 중복 연결 시도: ${deviceId}, 기존 연결 종료`);
        const existingSocket = this.clients.get(deviceId);
        existingSocket.destroy();
        this.clients.delete(deviceId);
      }

      // 연결 등록
      clientInfo.deviceId = deviceId;
      clientInfo.verified = true;
      clientInfo.isTest = isTest; // 🆕 테스트 디바이스 플래그 추가
      this.clients.set(deviceId, socket);

      // 디바이스 상태 업데이트
      device.recordConnectionAttempt(true, null, true);
      device.updateDeviceIdVerification(true, 'new');

      // 🧪 테스트 디바이스는 즉시 하트비트 시작
      if (isTest) {
        device.updateHeartbeat({
          temperature: 25 + Math.random() * 10,
          powerStatus: 'ON',
          memoryUsage: 30 + Math.random() * 40,
          errorCount: 0
        });

        // 테스트 디바이스용 주기적 하트비트 시작
        this.startTestDeviceHeartbeat(deviceId);

        logger.info(`✅ 테스트 디바이스 연결 성공: ${device.name} (${deviceId})`);
      } else {
        logger.info(`✅ 실제 디바이스 연결 성공: ${device.name} (${deviceId})`);
      }

      // ✅ 웹 클라이언트에 연결 이벤트 발생
      this.emitToWeb('connected', {
        deviceId: deviceId,
        deviceName: device.name,
        isTest: isTest,
        status: 'online',
        connectedAt: new Date().toISOString()
      });

      // 연결 확인 응답 전송
      this.sendConnectionAck(socket);

      // 시간 동기화 전송
      this.sendTimeSync(socket);

    } catch (error) {
      logger.error('Device ID 응답 처리 실패:', error);
      socket.destroy();
    }
  }

  // 🆕 테스트 디바이스용 하트비트 관리
  startTestDeviceHeartbeat(deviceId) {
    // 기존 인터벌 정리
    this.stopTestDeviceHeartbeat(deviceId);

    const interval = setInterval(() => {
      const device = Device.findByDeviceId(deviceId);
      if (device && this.clients.has(deviceId)) {
        // 시뮬레이션 데이터로 하트비트 업데이트
        device.updateHeartbeat({
          temperature: 25 + Math.random() * 10,
          powerStatus: 'ON',
          memoryUsage: 30 + Math.random() * 40,
          errorCount: 0
        });

        console.log(`🧪 테스트 디바이스 하트비트: ${device.name}`);
      } else {
        // 디바이스가 없거나 연결이 끊어진 경우 인터벌 정리
        this.stopTestDeviceHeartbeat(deviceId);
      }
    }, 60000); // 1분마다

    // 인터벌 저장 (디바이스별 관리)
    this.testHeartbeatIntervals.set(deviceId, interval);
  }

  // 🆕 테스트 디바이스 하트비트 중지
  stopTestDeviceHeartbeat(deviceId) {
    if (this.testHeartbeatIntervals && this.testHeartbeatIntervals.has(deviceId)) {
      clearInterval(this.testHeartbeatIntervals.get(deviceId));
      this.testHeartbeatIntervals.delete(deviceId);
      console.log(`🧪 테스트 디바이스 하트비트 중지: ${deviceId}`);
    }
  }

  // 🔧 연결 해제 처리 (테스트 디바이스 하트비트 정리 추가)
  handleDisconnection(socket) {
    const clientInfo = this.deviceSockets.get(socket);

    if (clientInfo) {
      const { deviceId, address, port } = clientInfo;

      if (deviceId) {
        // 테스트 디바이스 하트비트 중지
        if (clientInfo.isTest) {
          this.stopTestDeviceHeartbeat(deviceId);
        }

        // 클라이언트 맵에서 제거
        this.clients.delete(deviceId);

        // 디바이스 상태 업데이트
        const device = Device.findByDeviceId(deviceId);
        if (device) {
          device.updateStatus('offline', 'Connection closed');

          // ✅ 웹 클라이언트에 연결 해제 이벤트 발생
          this.emitToWeb('disconnected', {
            deviceId: deviceId,
            deviceName: device.name,
            isTest: clientInfo.isTest || false,
            status: 'offline',
            reason: 'Connection closed',
            disconnectedAt: new Date().toISOString()
          });

          logger.info(`🔌 디바이스 연결 해제: ${device.name} (${deviceId})`);
        }
      } else {
        logger.info(`🔌 미인증 연결 해제: ${address}:${port}`);
      }
    }

    // 소켓 정보 제거
    this.deviceSockets.delete(socket);
  }

  // 🔧 소켓 오류 처리
  handleSocketError(socket, error) {
    const clientInfo = this.deviceSockets.get(socket);
    const deviceId = clientInfo?.deviceId || 'unknown';

    logger.error(`소켓 오류 (${deviceId}):`, error.message);

    if (clientInfo?.deviceId) {
      const device = Device.findByDeviceId(clientInfo.deviceId);
      if (device) {
        device.updateStatus('error', error.message);
      }
    }

    this.handleDisconnection(socket);
  }

  // 🔧 패킷 파싱 (프로토콜 문서 기반)
  parsePacket(buffer) {
    try {
      if (buffer.length < 4) return null;

      let offset = 0;

      // STX 확인
      const stx = buffer.readUInt8(offset++);
      if (stx !== 0x02) return null; // 신프로토콜 STX

      // LENGTH 읽기 (2 bytes)
      const length = buffer.readUInt16BE(offset);
      offset += 2;

      // COMMAND 읽기 (4 bytes for 신프로토콜)
      const command = buffer.readUInt32BE(offset);
      offset += 4;

      // DATA 읽기
      const dataLength = length - 6; // 4(COMMAND) + 1(CHECKSUM) + 12(ID)
      let data = null;

      if (dataLength > 0) {
        data = buffer.slice(offset, offset + dataLength);
        offset += dataLength;
      }

      return {
        stx,
        length,
        command,
        data
      };

    } catch (error) {
      logger.error('패킷 파싱 오류:', error);
      return null;
    }
  }

  // 🔧 ID 요청 패킷 생성
  createIdRequestPacket() {
    // 신프로토콜 ID 요청 패킷 (0x10)
    const buffer = Buffer.alloc(18);
    let offset = 0;

    // STX
    buffer.writeUInt8(0x02, offset++);

    // LENGTH
    buffer.writeUInt16BE(15, offset); // COMMAND(4) + CHECKSUM(1) + ID(12) - 2(LENGTH)
    offset += 2;

    // COMMAND
    buffer.writeUInt32BE(0x10, offset);
    offset += 4;

    // CHECKSUM (단순 계산)
    const checksum = 0x10 & 0xFF;
    buffer.writeUInt8(checksum, offset++);

    // ID (서버 ID - 빈 값)
    buffer.write('            ', offset, 12, 'ascii');
    offset += 12;

    // ETX
    buffer.writeUInt8(0x03, offset);

    return buffer;
  }

  // 🔧 연결 확인 응답 전송
  sendConnectionAck(socket) {
    try {
      // 간단한 ACK 응답
      const ackBuffer = Buffer.from([0x06]); // ACK
      socket.write(ackBuffer);
      logger.debug('📤 연결 확인 응답 전송');
    } catch (error) {
      logger.error('연결 확인 응답 전송 실패:', error);
    }
  }

  // 🔧 시간 동기화 전송
  sendTimeSync(socket) {
    try {
      const now = new Date();
      const buffer = Buffer.alloc(18);
      let offset = 0;

      // STX
      buffer.writeUInt8(0x02, offset++);

      // LENGTH
      buffer.writeUInt16BE(11, offset);
      offset += 2;

      // COMMAND (0x03 - 시간 전송)
      buffer.writeUInt32BE(0x03, offset);
      offset += 4;

      // DATE TIME (6 bytes)
      buffer.writeUInt8(now.getFullYear() - 2000, offset++); // 년
      buffer.writeUInt8(now.getMonth() + 1, offset++);       // 월
      buffer.writeUInt8(now.getDate(), offset++);            // 일
      buffer.writeUInt8(now.getHours(), offset++);           // 시
      buffer.writeUInt8(now.getMinutes(), offset++);         // 분
      buffer.writeUInt8(now.getSeconds(), offset++);         // 초

      // CHECKSUM
      const checksum = 0x03 & 0xFF;
      buffer.writeUInt8(checksum, offset++);

      // ETX
      buffer.writeUInt8(0x03, offset);

      socket.write(buffer);
      logger.debug('📤 시간 동기화 전송');

    } catch (error) {
      logger.error('시간 동기화 전송 실패:', error);
    }
  }

  // 🔧 디바이스에 명령 전송
  async sendCommand(deviceId, commandType, data = {}) {
    const socket = this.clients.get(deviceId);
    if (!socket) {
      throw new Error(`디바이스가 연결되지 않음: ${deviceId}`);
    }

    try {
      const packet = this.createCommandPacket(commandType, data);
      socket.write(packet);

      const device = Device.findByDeviceId(deviceId);
      logger.info(`📤 명령 전송: ${deviceId} - ${commandType}`);

      // ✅ 웹 클라이언트에 명령 전송 이벤트 발생
      this.emitToWeb('commandSent', {
        deviceId: deviceId,
        deviceName: device?.name,
        commandType: commandType,
        data: data,
        isTest: device?.name?.includes('테스트') || device?.deviceId?.startsWith('TEST'),
        sentAt: new Date().toISOString()
      });

      return true;

    } catch (error) {
      logger.error(`명령 전송 실패: ${deviceId}`, error);

      // ✅ 웹 클라이언트에 명령 전송 실패 이벤트 발생
      this.emitToWeb('commandFailed', {
        deviceId: deviceId,
        commandType: commandType,
        error: error.message,
        failedAt: new Date().toISOString()
      });

      throw error;
    }
  }

  // 🔧 명령 패킷 생성
  createCommandPacket(commandType, data) {
    // 명령 타입별 패킷 생성 로직
    switch (commandType) {
      case 'CLEAR_MESSAGES':
        return this.createClearMessagesPacket();
      case 'POWER_CONTROL':
        return this.createPowerControlPacket(data);
      case 'BRIGHTNESS_CONTROL':
        return this.createBrightnessPacket(data);
      default:
        throw new Error(`지원하지 않는 명령 타입: ${commandType}`);
    }
  }

  // 🔧 전체 삭제 패킷 생성
  createClearMessagesPacket() {
    const buffer = Buffer.alloc(7);
    let offset = 0;

    buffer.writeUInt8(0x02, offset++);     // STX
    buffer.writeUInt16BE(4, offset);       // LENGTH
    offset += 2;
    buffer.writeUInt32BE(0x15, offset);    // COMMAND (전체 삭제)
    offset += 4;
    buffer.writeUInt8(0x15, offset++);     // CHECKSUM
    buffer.writeUInt8(0x03, offset);       // ETX

    return buffer;
  }

  // 🔧 전원 제어 패킷 생성
  createPowerControlPacket(data) {
    const buffer = Buffer.alloc(15);
    let offset = 0;

    buffer.writeUInt8(0x02, offset++);     // STX
    buffer.writeUInt16BE(12, offset);      // LENGTH
    offset += 2;
    buffer.writeUInt32BE(0x0E, offset);    // COMMAND (환경감시기 동작 제어)
    offset += 4;

    // 전원 제어 데이터 (8 bytes)
    const powerValue = data.action === 'ON' ? 1 : 0;
    buffer.writeUInt8(powerValue, offset++); // Power 제어
    buffer.writeUInt8(0, offset++);          // Fan1 제어
    buffer.writeUInt8(0, offset++);          // Fan2 제어
    buffer.fill(0, offset, offset + 5);     // 미사용 5 bytes
    offset += 5;

    buffer.writeUInt8(0x0E, offset++);      // CHECKSUM
    buffer.writeUInt8(0x03, offset);        // ETX

    return buffer;
  }

  // 🔧 밝기 제어 패킷 생성
  createBrightnessPacket(data) {
    const buffer = Buffer.alloc(17);
    let offset = 0;

    buffer.writeUInt8(0x02, offset++);     // STX
    buffer.writeUInt16BE(14, offset);      // LENGTH
    offset += 2;
    buffer.writeUInt32BE(0xD1, offset);    // COMMAND (야간 시간 및 동작 시간 설정)
    offset += 4;

    // 밝기 설정 데이터 (10 bytes)
    buffer.writeUInt8(6, offset++);        // 시작 시간 (시)
    buffer.writeUInt8(0, offset++);        // 시작 시간 (분)
    buffer.writeUInt8(23, offset++);       // 완료 시간 (시)
    buffer.writeUInt8(0, offset++);        // 완료 시간 (분)
    buffer.writeUInt8(data.brightness || 10, offset++); // 주간 밝기
    buffer.writeUInt8(Math.floor((data.brightness || 10) * 0.6), offset++); // 야간 밝기
    buffer.writeUInt8(6, offset++);        // ON시간 (시)
    buffer.writeUInt8(0, offset++);        // ON시간 (분)
    buffer.writeUInt8(23, offset++);       // OFF시간 (시)
    buffer.writeUInt8(0, offset++);        // OFF시간 (분)

    buffer.writeUInt8(0xD1, offset++);     // CHECKSUM
    buffer.writeUInt8(0x03, offset);       // ETX

    return buffer;
  }

  // 🔧 시간 동기화 응답 처리
  handleTimeSync(socket, packet) {
    const clientInfo = this.deviceSockets.get(socket);
    if (clientInfo?.deviceId) {
      const device = Device.findByDeviceId(clientInfo.deviceId);
      if (device) {
        device.updateHeartbeat({ lastTimeSync: new Date() });
        logger.debug(`⏰ 시간 동기화 완료: ${clientInfo.deviceId}`);
      }
    }
  }

  // 🔧 오류 응답 처리
  handleErrorResponse(socket, packet) {
    const clientInfo = this.deviceSockets.get(socket);
    if (!clientInfo?.deviceId || !packet.data || packet.data.length < 2) return;

    const command = packet.data.readUInt8(0);
    const errorCode = packet.data.readUInt8(1);

    const errorMessages = {
      1: '방번호 이상',
      2: '표시효과 이상',
      3: '표시속도 이상',
      4: '완료효과 이상',
      5: '완료속도 이상',
      6: '문자 크기 이상',
      7: 'Command 이상',
      8: 'font 선택 이상',
      9: '방정보 없음'
    };

    const errorMessage = errorMessages[errorCode] || `알 수 없는 오류 (${errorCode})`;

    logger.warn(`⚠️ 디바이스 오류 (${clientInfo.deviceId}): 명령 0x${command.toString(16)} - ${errorMessage}`);

    // 디바이스 오류 카운트 증가
    const device = Device.findByDeviceId(clientInfo.deviceId);
    if (device) {
      device.systemInfo.errorCount += 1;
      device.save();

      // ✅ 웹 클라이언트에 디바이스 오류 이벤트 발생
      this.emitToWeb('deviceError', {
        deviceId: clientInfo.deviceId,
        deviceName: device.name,
        command: `0x${command.toString(16)}`,
        errorCode: errorCode,
        errorMessage: errorMessage,
        isTest: device.name?.includes('테스트') || device.deviceId?.startsWith('TEST'),
        errorAt: new Date().toISOString()
      });
    }
  }

  // 🔧 Device ID 유효성 검사
  isValidDeviceId(deviceId) {
    // Device ID 형식: 8-20자의 영문, 숫자
    const pattern = /^[A-Za-z0-9]{8,20}$/;
    return pattern.test(deviceId);
  }

  // 🔧 연결된 디바이스 확인
  isDeviceConnected(deviceId) {
    return this.clients.has(deviceId);
  }

  // 🔧 연결된 디바이스 목록
  getConnectedDevices() {
    return Array.from(this.clients.keys());
  }

  // 🔧 디바이스 강제 연결 해제
  async disconnectDevice(deviceId) {
    const socket = this.clients.get(deviceId);
    if (socket) {
      socket.destroy();
      this.clients.delete(deviceId);

      const device = Device.findByDeviceId(deviceId);
      if (device) {
        device.updateStatus('offline', 'Manually disconnected');
      }

      logger.info(`🔌 디바이스 강제 연결 해제: ${deviceId}`);
      return true;
    }
    return false;
  }

  // 🔧 연결 통계
  getConnectionStats() {
    const allDevices = Device.findAll();
    const connectedDeviceIds = this.getConnectedDevices();

    const stats = {
      total: allDevices.length,
      connected: connectedDeviceIds.length,
      offline: allDevices.length - connectedDeviceIds.length,
      uptime: allDevices.length > 0 ? (connectedDeviceIds.length / allDevices.length * 100) : 0,
      devices: allDevices.map(device => ({
        id: device.id,
        deviceId: device.deviceId,
        name: device.name,
        status: device.status,
        connected: connectedDeviceIds.includes(device.deviceId),
        verified: device.connectionInfo.deviceIdVerified,
        lastHeartbeat: device.connectionInfo.lastHeartbeat
      }))
    };

    return stats;
  }

  // 🔧 하트비트 체크 (주기적 실행) - 테스트 디바이스 지원
  startHeartbeatCheck() {
    setInterval(() => {
      console.log('🔍 하트비트 체크 시작...');

      // 실제 디바이스만 하트비트 체크 (테스트 디바이스 제외)
      const allDevices = Device.findAll();
      const expiredDevices = [];

      allDevices.forEach(device => {
        const isTest = device.name?.includes('테스트') ||
          device.deviceId?.startsWith('TEST') ||
          device.ip?.startsWith('127.0.0');

        if (isTest) {
          // 🧪 테스트 디바이스는 항상 온라인 유지
          if (device.status === 'online' && this.clients.has(device.deviceId)) {
            device.updateHeartbeat({
              temperature: 25 + Math.random() * 10,
              powerStatus: 'ON',
              memoryUsage: 30 + Math.random() * 40,
              errorCount: 0
            });

            console.log(`🧪 테스트 디바이스 하트비트 유지: ${device.name}`);
          }
        } else {
          // 실제 디바이스만 하트비트 만료 체크
          if (device.status === 'online' &&
            device.connectionInfo?.lastHeartbeat) {

            const now = new Date();
            const lastHeartbeat = new Date(device.connectionInfo.lastHeartbeat);
            const timeDiff = now - lastHeartbeat;

            // 5분(300초) 타임아웃으로 연장
            if (timeDiff > 300000) {
              console.warn(`💔 실제 디바이스 하트비트 만료: ${device.name} (${Math.round(timeDiff / 1000)}초)`);
              expiredDevices.push(device.deviceId);
            }
          }
        }
      });

      // 만료된 실제 디바이스만 연결 해제
      expiredDevices.forEach(deviceId => {
        const device = Device.findByDeviceId(deviceId);
        if (device && !device.name?.includes('테스트')) {
          logger.warn(`💔 하트비트 만료, 연결 해제: ${device.name} (${deviceId})`);

          // ✅ 웹 클라이언트에 하트비트 만료 이벤트 발생
          this.emitToWeb('heartbeatExpired', {
            deviceId: deviceId,
            deviceName: device.name,
            isTest: false,
            expiredAt: new Date().toISOString()
          });

          this.disconnectDevice(deviceId);
        }
      });

      // ✅ 주기적으로 연결 통계 업데이트 이벤트 발생 (30초마다)
      const stats = this.getConnectionStats();
      this.emitToWeb('statsUpdate', stats);

      console.log(`✅ 하트비트 체크 완료: 만료 ${expiredDevices.length}개, 총 ${allDevices.length}개`);

    }, 30000); // 30초마다 체크
  }

  // 🔧 Device ID 검증 체크 (주기적 실행)
  startDeviceIdVerificationCheck() {
    setInterval(() => {
      const unverifiedDevices = Device.checkDeviceIdVerification();

      unverifiedDevices.forEach(deviceInfo => {
        logger.warn(`🆔 Device ID 미검증: ${deviceInfo.name} (${deviceInfo.deviceId})`);

        // 재검증 시도
        const socket = this.clients.get(deviceInfo.deviceId);
        if (socket) {
          this.requestDeviceId(socket);
        }
      });
    }, 300000); // 5분마다 체크
  }

  // 🔧 서버 중지 (테스트 하트비트도 정리)
  async stop() {
    if (!this.isRunning) return;

    logger.info('🔌 소켓 서버 종료 중...');

    // 테스트 디바이스 하트비트 정리
    if (this.testHeartbeatIntervals) {
      for (const [deviceId, interval] of this.testHeartbeatIntervals) {
        clearInterval(interval);
      }
      this.testHeartbeatIntervals.clear();
    }

    // 모든 클라이언트 연결 해제
    for (const [deviceId, socket] of this.clients) {
      socket.destroy();
    }
    this.clients.clear();
    this.deviceSockets.clear();

    // 서버 종료
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.isRunning = false;
    logger.info('✅ 소켓 서버 종료 완료');
  }

  // 🔧 브로드캐스트 메시지 (모든 연결된 디바이스에 전송)
  async broadcast(commandType, data = {}) {
    const results = [];

    for (const [deviceId, socket] of this.clients) {
      try {
        await this.sendCommand(deviceId, commandType, data);
        results.push({ deviceId, success: true });
      } catch (error) {
        logger.error(`브로드캐스트 실패: ${deviceId}`, error);
        results.push({ deviceId, success: false, error: error.message });
      }
    }

    return results;
  }

  // 🔧 메시지 전송 (ID 기반)
  async sendMessage(deviceId, messageData) {
    const socket = this.clients.get(deviceId);
    if (!socket || socket.destroyed) {
      throw new Error(`Device ID ${deviceId}에 대한 연결을 찾을 수 없음`);
    }

    try {
      console.log('🚀 메시지 전송 시작:', {
        deviceId,
        messageType: messageData.type || 'text',
        roomNumber: messageData.roomNumber
      });

      // 모든 메시지에 대해 protocolConverter 사용
      const protocolConverter = require('../utils/protocolConverter');

      let packet;
      if (messageData.type === 'image' || messageData.imageUrl) {
        // 이미지 메시지는 protocolConverter 사용 (0x11 멀티메시지)
        packet = protocolConverter.convertToProtocolPacket(messageData, deviceId);
        console.log('🔧 이미지 메시지 패킷 생성:', {
          deviceId,
          packetSize: packet.length,
          hexDump: protocolConverter.bufferToHexString(packet)
        });
      } else {
        // 텍스트 메시지도 protocolConverter 사용 (0x11 멀티메시지로 통일)
        const textMessageData = {
          ...messageData,
          type: 'text',
          messageType: 1, // 텍스트/이미지
          imageUrl: '' // 텍스트의 경우 빈 URL
        };
        packet = protocolConverter.convertToProtocolPacket(textMessageData, deviceId);
        console.log('🔧 텍스트 메시지 패킷 생성:', {
          deviceId,
          packetSize: packet.length,
          hexDump: protocolConverter.bufferToHexString(packet)
        });
      }

      // 패킷 전송 전 최종 검증
      console.log('🚀 최종 패킷 전송:', {
        STX: '0x' + packet[0].toString(16).padStart(2, '0'),
        LENGTH: packet.readUInt16LE(1),
        COMMAND: '0x' + packet[3].toString(16).padStart(2, '0'),
        totalSize: packet.length
      });

      // 패킷 전송
      socket.write(packet);
      const result = { success: true, packetSent: packet.length };

      logger.info(`✅ 메시지 전송 성공: ${deviceId}`, {
        packetSize: packet.length,
        messageType: messageData.type || 'text'
      });

      return result;

    } catch (error) {
      logger.error(`❌ 메시지 전송 실패: ${deviceId}`, error);
      throw error;
    }
  }

  // ❌ 잘못된 패킷 생성 함수들 제거됨 - protocolConverter만 사용

  // 🔧 연결 상태 모니터링 (디버깅용)
  getDebugInfo() {
    const connectedSockets = Array.from(this.deviceSockets.entries()).map(([socket, info]) => ({
      socketId: socket.remoteAddress + ':' + socket.remotePort,
      deviceId: info.deviceId,
      verified: info.verified,
      isTest: info.isTest,
      connectedAt: info.connectedAt,
      lastHeartbeat: info.lastHeartbeat
    }));

    const connectedDevices = Array.from(this.clients.entries()).map(([deviceId, socket]) => ({
      deviceId,
      socketId: socket.remoteAddress + ':' + socket.remotePort,
      connected: !socket.destroyed
    }));

    return {
      serverRunning: this.isRunning,
      serverPort: this.port,
      totalSockets: this.deviceSockets.size,
      connectedDevices: this.clients.size,
      testHeartbeats: this.testHeartbeatIntervals.size,
      sockets: connectedSockets,
      devices: connectedDevices
    };
  }

  // 🔧 특정 디바이스 정보 조회
  getDeviceInfo(deviceId) {
    const socket = this.clients.get(deviceId);
    if (!socket) {
      return null;
    }

    const clientInfo = this.deviceSockets.get(socket);
    const device = Device.findByDeviceId(deviceId);

    return {
      deviceId: deviceId,
      deviceName: device?.name,
      socketAddress: socket.remoteAddress + ':' + socket.remotePort,
      connected: !socket.destroyed,
      verified: clientInfo?.verified,
      isTest: clientInfo?.isTest,
      connectedAt: clientInfo?.connectedAt,
      lastHeartbeat: clientInfo?.lastHeartbeat,
      status: device?.status,
      protocolVersion: device?.getProtocolVersion()
    };
  }

  // 🔧 메시지 큐 관리 (향후 확장용)
  async queueMessage(deviceId, messageData, priority = 'normal') {
    // TODO: 메시지 큐 구현
    // 현재는 즉시 전송
    return await this.sendMessage(deviceId, messageData);
  }

  // 🔧 디바이스 상태 강제 동기화
  async syncDeviceStatus(deviceId) {
    const device = Device.findByDeviceId(deviceId);
    if (!device) {
      throw new Error(`Device ID를 찾을 수 없음: ${deviceId}`);
    }

    const isConnected = this.isDeviceConnected(deviceId);

    if (isConnected !== device.connectionInfo.connected) {
      if (isConnected) {
        device.updateStatus('online');
        device.updateDeviceIdVerification(true, 'new');
      } else {
        device.updateStatus('offline', 'Connection lost');
        device.updateDeviceIdVerification(false);
      }

      logger.info(`🔄 디바이스 상태 동기화: ${device.name} (${deviceId}) - ${isConnected ? 'online' : 'offline'}`);
    }

    return device.toJSON();
  }

  // 🔧 전체 시스템 상태 리포트
  getSystemReport() {
    const allDevices = Device.findAll();
    const connectedCount = this.clients.size;
    const stats = Device.getStats();

    return {
      timestamp: new Date().toISOString(),
      server: {
        running: this.isRunning,
        port: this.port,
        uptime: this.isRunning ? Date.now() - this.startTime : 0
      },
      connections: {
        total: allDevices.length,
        connected: connectedCount,
        offline: allDevices.length - connectedCount,
        success_rate: allDevices.length > 0 ? (connectedCount / allDevices.length * 100) : 0
      },
      devices: {
        by_status: {
          online: stats.online,
          offline: stats.offline,
          error: stats.error,
          maintenance: stats.maintenance
        },
        by_controller: stats.controllers,
        verified_count: stats.deviceIdVerified,
        test_devices: stats.testDevices
      },
      recent_events: this.getRecentEvents()
    };
  }

  // 🔧 최근 이벤트 조회 (메모리 기반, 향후 DB 연동 가능)
  getRecentEvents(limit = 10) {
    // TODO: 이벤트 로그 구현
    return [];
  }
}

// 싱글톤 인스턴스
const socketService = new SocketService();

module.exports = socketService;