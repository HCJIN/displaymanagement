// src/services/displayService.js - MQTT 통신 기반 전체 코드 Part 1/4
const { EventEmitter } = require('events');
const axios = require('axios');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const Message = require('../models/Message');
const { AppError } = require('../middleware/errorHandler');
const protocolConverter = require('../utils/protocolConverter');
const { publishToMqtt, initMqttClient, isConnected, reconnect } = require('../utils/mqttClient');

class DisplayService extends EventEmitter {
  constructor() {
    super();

    // 연결 관리
    this.connections = new Map(); // deviceId -> MQTT connection info
    this.heartbeatIntervals = new Map(); // deviceId -> interval
    this.reconnectTimeouts = new Map(); // deviceId -> timeout
    this.commandQueue = new Map(); // deviceId -> command queue
    this.pendingResponses = new Map(); // deviceId -> pending response promises

    // 🆕 테스트 디바이스 관리
    this.testDevices = new Map(); // deviceId -> test device info
    this.testConnections = new Set(); // 연결된 테스트 디바이스 ID들

    // 🔧 MQTT 통신 설정
    this.mqttConfig = {
      enableMqtt: true, // MQTT 통신 활성화
      topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'display',
      qos: parseInt(process.env.MQTT_QOS) || 1,
      retain: process.env.MQTT_RETAIN !== 'false', // 기본값을 true로 변경
      timeout: parseInt(process.env.PROTOCOL_TIMEOUT) || 10000,
      retryAttempts: parseInt(process.env.PROTOCOL_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.PROTOCOL_RETRY_DELAY) || 1000,
      reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 5000,
      connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT) || 30000
    };

    // 기본 설정
    this.config = {
      authKey: process.env.DISPLAY_AUTH_KEY || 'display_auth_2025',
      timeout: parseInt(process.env.DISPLAY_TIMEOUT) || 5000,
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 60000,
      heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT) || 300000,
      reconnectDelay: parseInt(process.env.CONNECTION_CHECK_INTERVAL) || 30000,
      maxReconnectAttempts: 5,
      commandTimeout: parseInt(process.env.PROTOCOL_TIMEOUT) || 10000,
      enableDebug: process.env.DEBUG_MQTT === 'true' || false,
      enableMessageDebug: process.env.DEBUG_MQTT_MESSAGES === 'true' || false,
      enableTopicDebug: process.env.DEBUG_MQTT_TOPICS === 'true' || false
    };

    // 🆕 MQTT 토픽 구조 정의
    this.MQTT_TOPICS = {
      // 디바이스별 토픽 구조
      COMMAND: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/command`,
      MESSAGE: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/message`,
      IMAGE: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/image`,
      MULTIMEDIA: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/multimedia`,
      STATUS: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/status`,
      HEARTBEAT: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/heartbeat`,
      ROOM_DELETE: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/room/delete`,
      ALL_DELETE: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/all/delete`,
      RESPONSE: (deviceId) => `${this.mqttConfig.topicPrefix}/${deviceId}/response`,

      // 공통 토픽
      BROADCAST: `${this.mqttConfig.topicPrefix}/broadcast`,
      SYSTEM: `${this.mqttConfig.topicPrefix}/system`,
      LOGS: `${this.mqttConfig.topicPrefix}/logs`
    };

    // 🆕 MQTT 메시지 타입
    this.MESSAGE_TYPES = {
      TEXT_MESSAGE: 'text_message',
      IMAGE_MESSAGE: 'image_message',
      MULTIMEDIA_MESSAGE: 'multimedia_message',
      MIXED_MESSAGE: 'mixed_message',
      DELETE_ROOM: 'delete_room',
      DELETE_ALL: 'delete_all',
      HEARTBEAT: 'heartbeat',
      COMMAND: 'command',
      STATUS_UPDATE: 'status_update',
      CONNECT: 'connect',
      DISCONNECT: 'disconnect',
      ROOM_INFO_REQUEST: 'room_info_request'
    };

    // 🆕 응답 코드 (MQTT용)
    this.RESPONSES = {
      OK: 'OK',
      CONNECT_FAIL: 'CONNECT_FAIL',
      AUTH_FAIL: 'AUTH_FAIL',
      DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
      DATA_ERROR: 'DATA_ERROR',
      DEVICE_BUSY: 'DEVICE_BUSY',
      MQTT_PUBLISH_FAIL: 'MQTT_PUBLISH_FAIL',
      MQTT_SUCCESS: 'MQTT_SUCCESS',
      TCP_BACKUP_SUCCESS: 'TCP_BACKUP_SUCCESS',
      WEBSERVER_DOWNLOAD_FAIL: 'WEBSERVER_DOWNLOAD_FAIL'
    };

    // 🆕 프로토콜 명령어 (기존 TCP/IP 호환)
    this.PROTOCOL_COMMANDS = {
      CONNECT: 'CONNECT',
      SEND_TEXT: 'SEND_TEXT',
      REQUEST_ROOM_INFO: 'REQUEST_ROOM_INFO',
      TIME_SYNC: 'TIME_SYNC',
      DELETE_ALL: 'DELETE_ALL',
      DELETE_ROOM: 'DELETE_ROOM',
      ERROR_RESPONSE: 'ERROR_RESPONSE',
      BRIGHTNESS_CONTROL: 'BRIGHTNESS_CONTROL',
      CHECK_EXTERNAL_MSG: 'CHECK_EXTERNAL_MSG',
      ENVIRONMENT_CONTROL: 'ENVIRONMENT_CONTROL',
      ENVIRONMENT_STATUS: 'ENVIRONMENT_STATUS',
      MULTIMEDIA_ROOM_INFO: 'MULTIMEDIA_ROOM_INFO',
      MULTIMEDIA_SPLIT_REQUEST: 'MULTIMEDIA_SPLIT_REQUEST',
      MULTIMEDIA_SPLIT_RESPONSE: 'MULTIMEDIA_SPLIT_RESPONSE',
      MULTIMEDIA_SPLIT_COMPLETE: 'MULTIMEDIA_SPLIT_COMPLETE',
      MULTIMEDIA_DELETE_ROOM: 'MULTIMEDIA_DELETE_ROOM',
      MULTIMEDIA_DELETE_ALL: 'MULTIMEDIA_DELETE_ALL',
      NIGHT_TIME_SETTING: 'NIGHT_TIME_SETTING'
    };

    // 🆕 웹서버 설정
    this.webServerConfig = {
      host: process.env.WEB_SERVER_HOST || '192.168.0.58', // 사용자 IP로 변경
      port: parseInt(process.env.WEB_SERVER_PORT) || 5002, // 백엔드 서버 포트로 변경
      protocol: process.env.WEB_SERVER_PROTOCOL || 'http',
      imagePath: process.env.IMAGE_UPLOAD_PATH || '/api/images',
      maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE) || 10485760 // 10MB
    };

    // MQTT 클라이언트 초기화
    this.mqttClient = null;
    this.initializeMqttClient();

    // 정기적인 작업들 시작
    this.startPeriodicTasks();

    logger.info('DisplayService 초기화 완료 (MQTT 통신, 이미지 변환 지원, TCP/IP 백업)', {
      mqttEnabled: this.mqttConfig.enableMqtt,
      topicPrefix: this.mqttConfig.topicPrefix,
      heartbeatInterval: this.config.heartbeatInterval
    });
  }

  // 🔧 MQTT 클라이언트 초기화
  async initializeMqttClient() {
    try {
      if (this.config.enableDebug) {
        logger.info('MQTT 클라이언트 초기화 시작');
      }

      this.mqttClient = await initMqttClient();

      if (this.mqttClient) {
        logger.info('MQTT 클라이언트 초기화 성공');
        this.setupMqttEventListeners();
      } else {
        logger.warn('MQTT 클라이언트 초기화 실패 - 환경 변수 확인 필요');
      }
    } catch (error) {
      logger.error('MQTT 클라이언트 초기화 오류:', error.message);
    }
  }

  // 🔧 MQTT 이벤트 리스너 설정
  setupMqttEventListeners() {
    if (!this.mqttClient) return;

    this.mqttClient.on('connect', () => {
      logger.info('MQTT 브로커 연결 성공');

      // 시스템 토픽 구독
      const systemTopics = [
        `${this.mqttConfig.topicPrefix}/+/response`,
        `${this.mqttConfig.topicPrefix}/+/status`,
        `${this.mqttConfig.topicPrefix}/system/+`
      ];

      systemTopics.forEach(topic => {
        this.mqttClient.subscribe(topic, { qos: this.mqttConfig.qos }, (err) => {
          if (err) {
            logger.error(`MQTT 토픽 구독 실패: ${topic}`, err);
          } else if (this.config.enableTopicDebug) {
            logger.info(`MQTT 토픽 구독 성공: ${topic}`);
          }
        });
      });
    });

    this.mqttClient.on('error', (error) => {
      logger.error('MQTT 연결 오류:', error.message);
      this.emit('mqttError', error);
    });

    this.mqttClient.on('close', () => {
      logger.warn('MQTT 연결 종료');
      this.emit('mqttDisconnected');
    });

    this.mqttClient.on('reconnect', () => {
      if (this.config.enableDebug) {
        logger.info('MQTT 재연결 시도');
      }
    });

    this.mqttClient.on('message', (topic, message) => {
      this.handleMqttMessage(topic, message);
    });

    this.mqttClient.on('offline', () => {
      logger.warn('MQTT 클라이언트 오프라인');
    });
  }

  // 🔧 MQTT 메시지 처리
  handleMqttMessage(topic, message) {
    try {
      if (this.config.enableMessageDebug) {
        logger.info(`MQTT 메시지 수신: ${topic}`, {
          messageLength: message.length,
          topicParts: topic.split('/').length
        });
      }

      const payload = JSON.parse(message.toString());
      const topicParts = topic.split('/');

      if (topicParts.length >= 3) {
        const deviceId = topicParts[1];
        const messageType = topicParts[2];

        switch (messageType) {
          case 'response':
            this.handleDeviceResponse(deviceId, payload);
            break;
          case 'status':
            this.handleDeviceStatus(deviceId, payload);
            break;
          case 'heartbeat':
            this.handleDeviceHeartbeat(deviceId, payload);
            break;
          default:
            if (this.config.enableDebug) {
              logger.info(`알 수 없는 MQTT 메시지 타입: ${messageType}`, { deviceId, topic });
            }
        }
      }
    } catch (error) {
      logger.error('MQTT 메시지 파싱 오류:', {
        topic,
        error: error.message,
        messagePreview: message.toString().substring(0, 100)
      });
    }
  }

  // 🔧 디바이스 응답 처리
  handleDeviceResponse(deviceId, payload) {
    const device = Device.findById(deviceId);
    if (device) {
      device.updateHeartbeat();
    }

    // 대기 중인 응답 처리
    const pendingResponse = this.pendingResponses.get(deviceId);
    if (pendingResponse) {
      pendingResponse.resolve(payload);
      this.pendingResponses.delete(deviceId);
    }

    this.emit('deviceMessage', { deviceId, message: payload, type: 'response' });

    if (this.config.enableDebug) {
      logger.device(deviceId, 'MQTT 응답 처리 완료', payload);
    }
  }

  // 🔧 디바이스 상태 처리
  handleDeviceStatus(deviceId, payload) {
    const device = Device.findById(deviceId);
    if (device) {
      device.updateHeartbeat();

      // 상태 정보 업데이트
      if (payload.status) {
        device.updateStatus(payload.status);
      }

      if (payload.systemInfo) {
        device.updateHeartbeat(payload.systemInfo);
      }
    }

    this.emit('deviceMessage', { deviceId, message: payload, type: 'status' });

    if (this.config.enableDebug) {
      logger.device(deviceId, 'MQTT 상태 업데이트', payload);
    }
  }

  // 🔧 디바이스 하트비트 처리
  handleDeviceHeartbeat(deviceId, payload) {
    const device = Device.findById(deviceId);
    if (device) {
      device.updateHeartbeat(payload.systemInfo);
    }

    this.emit('deviceMessage', { deviceId, message: payload, type: 'heartbeat' });

    if (this.config.enableDebug) {
      logger.device(deviceId, 'MQTT 하트비트 수신', payload);
    }
  }

  // 🔧 정기적인 작업들 시작
  startPeriodicTasks() {
    // 하트비트 확인
    setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);

    // 만료된 메시지 정리
    setInterval(() => {
      this.cleanupExpiredMessages();
    }, 60000); // 1분마다

    // 연결 상태 동기화 (5분마다)
    setInterval(() => {
      this.syncConnectionStates();
    }, 300000);

    // MQTT 연결 상태 확인 (30초마다)
    setInterval(() => {
      this.checkMqttConnection();
    }, 30000);
  }

  // 🔧 MQTT 연결 상태 확인
  checkMqttConnection() {
    if (!isConnected()) {
      logger.warn('MQTT 연결이 끊어짐, 재연결 시도');
    }
  }

  // 🔧 연결 상태 동기화
  syncConnectionStates() {
    try {
      if (this.config.enableDebug) {
        logger.info('연결 상태 동기화 시작');
      }

      const allDevices = Device.findAll();
      let syncCount = 0;

      allDevices.forEach(device => {
        const isTest = this.isTestDevice(device);
        const isConnected = this.isDeviceConnected(device.id);

        if (isTest) {
          // 테스트 디바이스: 등록되어 있으면 온라인 유지
          if (isConnected && device.status !== 'online') {
            device.updateStatus('online');
            syncCount++;
          }
        } else {
          // 실제 디바이스: MQTT 연결 상태 동기화
          if (isConnected && device.status !== 'online') {
            device.updateStatus('online');
            syncCount++;
          } else if (!isConnected && device.status === 'online') {
            device.updateStatus('offline', 'Connection lost during sync');
            syncCount++;
          }
        }
      });

      if (syncCount > 0) {
        logger.info(`연결 상태 동기화 완료: ${syncCount}개 업데이트`);
      }
    } catch (error) {
      logger.error('연결 상태 동기화 실패:', error.message);
    }
  }

  // 🔧 수정된 디바이스 연결 메서드 (MQTT용)
  async connectDevice(deviceId) {
    try {
      const device = Device.findById(deviceId);
      if (!device) {
        throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
      }

      // 🆕 테스트 디바이스 처리
      if (this.isTestDevice(device)) {
        logger.device(deviceId, `🧪 테스트 디바이스 연결: ${device.name}`);

        device.updateStatus('connecting');
        await new Promise(resolve => setTimeout(resolve, 500));

        device.updateStatus('online');
        device.updateHeartbeat({
          temperature: 25 + Math.random() * 10,
          powerStatus: 'ON',
          memoryUsage: 30 + Math.random() * 40,
          errorCount: 0,
          isTest: true
        });

        this.registerTestDevice(deviceId);

        return {
          success: true,
          message: '테스트 디바이스 연결 성공',
          isTest: true,
          deviceInfo: {
            name: device.name,
            model: device.specs?.model,
            resolution: device.specs?.resolution,
            connectionMethod: 'TEST'
          }
        };
      }

      // 실제 디바이스 MQTT 연결
      if (this.connections.has(deviceId)) {
        logger.device(deviceId, '이미 연결되어 있습니다.');
        return { success: true, message: '이미 연결되어 있습니다.' };
      }

      logger.device(deviceId, `MQTT 연결 시도`);
      device.updateStatus(Device.Status.CONNECTING);

      // MQTT 연결 정보 등록
      const connectionInfo = {
        connected: true,
        connectedAt: new Date(),
        topics: {
          command: this.MQTT_TOPICS.COMMAND(deviceId),
          message: this.MQTT_TOPICS.MESSAGE(deviceId),
          image: this.MQTT_TOPICS.IMAGE(deviceId),
          multimedia: this.MQTT_TOPICS.MULTIMEDIA(deviceId),
          status: this.MQTT_TOPICS.STATUS(deviceId),
          heartbeat: this.MQTT_TOPICS.HEARTBEAT(deviceId),
          response: this.MQTT_TOPICS.RESPONSE(deviceId)
        },
        method: this.mqttClient ? 'MQTT' : 'TCP_BACKUP'
      };

      this.connections.set(deviceId, connectionInfo);

      // 연결 확인 메시지 발행
      await this.publishMqttMessage(deviceId, this.MESSAGE_TYPES.CONNECT, {
        command: 'connect',
        deviceInfo: {
          name: device.name,
          model: device.specs?.model,
          ip: device.ip,
          port: device.port
        },
        connectionMethod: connectionInfo.method
      });

      device.updateStatus(Device.Status.ONLINE);
      device.updateHeartbeat();
      this.startHeartbeat(deviceId);

      logger.device(deviceId, 'MQTT 연결 성공');
      this.emit('deviceConnected', { deviceId, device: device.toObject() });

      return {
        success: true,
        message: 'MQTT 연결 성공',
        isTest: false,
        deviceInfo: {
          name: device.name,
          topics: connectionInfo.topics,
          connectionMethod: connectionInfo.method
        }
      };

    } catch (error) {
      logger.device(deviceId, 'MQTT 연결 중 오류', error.message);
      throw error;
    }
  }

  // 🔧 수정된 디바이스 연결 해제 (MQTT용)
  async disconnectDevice(deviceId) {
    try {
      const device = Device.findById(deviceId);
      if (!device) {
        throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
      }

      if (this.isTestDevice(device)) {
        this.unregisterTestDevice(deviceId);
        logger.device(deviceId, '🧪 테스트 디바이스 연결 해제 완료');
        return { success: true, message: '테스트 디바이스 연결 해제 완료', isTest: true };
      }

      // MQTT 연결 해제 메시지 발행
      if (this.connections.has(deviceId)) {
        try {
          await this.publishMqttMessage(deviceId, this.MESSAGE_TYPES.DISCONNECT, {
            command: 'disconnect',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.warn(`MQTT 연결 해제 메시지 발행 실패: ${deviceId}`, error.message);
        }
      }

      this.handleDisconnection(deviceId);
      device.updateStatus(Device.Status.OFFLINE);

      logger.device(deviceId, 'MQTT 연결 해제 완료');
      return { success: true, message: 'MQTT 연결 해제 완료', isTest: false };
    } catch (error) {
      logger.device(deviceId, 'MQTT 연결 해제 중 오류', error.message);
      throw error;
    }
  }

  // 🔧 웹서버에서 이미지 다운로드 (프로토콜 정의서 구현)
  async downloadImageFromWebServer(url) {
    try {
      logger.info('웹서버 이미지 다운로드 시작:', url);

      // URL 유효성 검사
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('HTTP 또는 HTTPS URL만 지원됩니다.');
      }

      // 이미지 다운로드
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'DisplayService/1.0',
          'Accept': 'image/*'
        }
      });

      // Content-Type 검사
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`유효하지 않은 이미지 타입: ${contentType}`);
      }

      // 파일 크기 검사
      const fileSize = Buffer.byteLength(response.data);
      if (fileSize > this.webServerConfig.maxImageSize) {
        throw new Error(`이미지 파일이 너무 큽니다: ${fileSize} bytes`);
      }

      logger.info('웹서버 이미지 다운로드 완료:', {
        url,
        contentType,
        size: fileSize
      });

      return {
        data: response.data,
        contentType,
        size: fileSize,
        url
      };
    } catch (error) {
      logger.error('웹서버 이미지 다운로드 실패:', error.message);
      throw new AppError(`웹서버 이미지 다운로드 실패: ${error.message}`, 400, 'WEBSERVER_DOWNLOAD_FAIL');
    }
  }

  // 🔧 이미지 URL 생성
  generateImageUrl(deviceId, roomNumber, messageType = 'text-to-image') {
    const timestamp = Date.now();
    const fileName = `${messageType}-${deviceId}-${roomNumber}-${timestamp}.png`;
    const imageUrl = `${this.webServerConfig.protocol}://${this.webServerConfig.host}:${this.webServerConfig.port}${this.webServerConfig.imagePath}/${fileName}`;

    if (this.config.enableDebug) {
      logger.info(`이미지 URL 생성: ${imageUrl}`, {
        deviceId,
        roomNumber,
        messageType,
        fileName
      });
    }

    return { imageUrl, fileName };
  }

  // 🔧 Base64 이미지 저장
  async saveBase64Image(base64Data, deviceId, roomNumber, messageType = 'text-to-image') {
    const fs = require('fs');
    const path = require('path');

    try {
      // 이미지 저장 디렉토리 설정
      const imagesDir = path.join(__dirname, '../../images');

      // 디렉토리가 없으면 생성
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Base64 데이터에서 헤더 제거
      const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Image, 'base64');

      const timestamp = Date.now();
      const fileName = `${messageType}-${deviceId}-${roomNumber}-${timestamp}.png`;
      const filePath = path.join(imagesDir, fileName);

      // 파일 저장
      fs.writeFileSync(filePath, imageBuffer);

      logger.info('Base64 이미지 저장 성공:', {
        fileName,
        size: imageBuffer.length,
        deviceId,
        roomNumber,
        filePath
      });

      return {
        success: true,
        fileName,
        filePath,
        size: imageBuffer.length
      };

    } catch (error) {
      logger.error('Base64 이미지 저장 실패:', error);
      throw new AppError(`Base64 이미지 저장 실패: ${error.message}`, 500, 'IMAGE_SAVE_FAILED');
    }
  }

  // 🔧 특정 파일명으로 Base64 이미지 저장
  async saveBase64ImageWithFileName(base64Data, fileName) {
    const fs = require('fs');
    const path = require('path');

    try {
      // 이미지 저장 디렉토리 설정
      const imagesDir = path.join(__dirname, '../../images');

      // 디렉토리가 없으면 생성
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Base64 데이터에서 헤더 제거
      const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Image, 'base64');

      const filePath = path.join(imagesDir, fileName);

      // 파일 저장
      fs.writeFileSync(filePath, imageBuffer);

      logger.info('Base64 이미지 저장 성공 (파일명 지정):', {
        fileName,
        size: imageBuffer.length,
        filePath
      });

      return {
        success: true,
        fileName,
        filePath,
        size: imageBuffer.length
      };

    } catch (error) {
      logger.error('Base64 이미지 저장 실패 (파일명 지정):', error);
      throw new AppError(`Base64 이미지 저장 실패: ${error.message}`, 500, 'IMAGE_SAVE_FAILED');
    }
  }

  // src/services/displayService.js - MQTT 통신 기반 전체 코드 Part 3/4

  // 🔧 수정된 텍스트 메시지 전송 (MQTT 통신)
  async sendTextMessage(deviceId, messageData) {
    let device = Device.findById(deviceId);

    // 디바이스를 찾지 못한 경우, 실제 디바이스로 처리
    if (!device) {
      logger.warn(`디바이스를 찾을 수 없음: ${deviceId}, 실제 디바이스로 처리`);

      device = {
        id: deviceId,
        deviceId: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        status: 'offline',
        isTest: false,
        specs: {
          model: 'REAL-LED',
          resolution: { width: 1920, height: 1080 },
          size: '55인치',
          maxBrightness: 100
        }
      };
    }

    const message = Message.create({
      deviceId,
      type: Message.Type.TEXT,
      content: messageData.content,
      priority: messageData.priority || Message.Priority.NORMAL,
      urgent: messageData.urgent || false,
      roomNumber: messageData.roomNumber || this.assignRoomNumber(deviceId, messageData.urgent),
      displayOptions: messageData.displayOptions,
      schedule: messageData.schedule,
      createdBy: messageData.createdBy
    });

    try {
      message.updateStatus(Message.Status.SENDING);

      const isTestDevice = this.isTestDevice(device);

      // 이미지 URL 처리
      let imageUrl = messageData.imageUrl;

      // 🔧 디버깅: 전달받은 imageUrl 확인
      console.log('🔧 전달받은 이미지 URL:', {
        messageDataImageUrl: messageData.imageUrl,
        webServerConfig: this.webServerConfig
      });

      // 🔧 디버깅: conversionInfo 확인
      console.log('🔧 conversionInfo 디버깅:', {
        hasConversionInfo: !!messageData.conversionInfo,
        conversionInfoKeys: messageData.conversionInfo ? Object.keys(messageData.conversionInfo) : null,
        hasBase64Data: !!(messageData.conversionInfo?.base64Data),
        base64DataLength: messageData.conversionInfo?.base64Data?.length,
        currentImageUrl: imageUrl
      });

      // conversionInfo가 있으면 이미지 URL 생성 및 저장
      if (messageData.conversionInfo && !imageUrl) {
        // 🔧 동일한 타임스탬프 사용
        const timestamp = Date.now();
        const fileName = `text-to-image-${deviceId}-${message.roomNumber}-${timestamp}.png`;
        imageUrl = `${this.webServerConfig.protocol}://${this.webServerConfig.host}:${this.webServerConfig.port}${this.webServerConfig.imagePath}/${fileName}`;

        // 실제 이미지 파일 저장 (base64 데이터가 있는 경우)
        if (messageData.conversionInfo.base64Data) {
          try {
            console.log('🔧 이미지 파일 저장 시작:', {
              deviceId,
              roomNumber: message.roomNumber,
              base64Length: messageData.conversionInfo.base64Data.length,
              imageUrl,
              fileName
            });

            // 🔧 파일명을 직접 전달하여 동일한 이름으로 저장
            await this.saveBase64ImageWithFileName(messageData.conversionInfo.base64Data, fileName);
            logger.info(`✅ 이미지 파일 저장 완료: ${imageUrl}`);

            console.log('🔧 이미지 파일 저장 성공:', {
              imageUrl,
              fileName
            });
          } catch (saveError) {
            logger.warn(`❌ 이미지 파일 저장 실패: ${saveError.message}`);
            console.error('🔧 이미지 저장 오류 상세:', saveError);
          }
        } else {
          console.warn('🔧 base64Data가 없어서 이미지 파일을 저장할 수 없음');
        }

        logger.info(`이미지 URL 생성: ${imageUrl}`, {
          deviceId: deviceId,
          roomNumber: message.roomNumber,
          originalContent: messageData.content?.substring(0, 50),
          hasBase64Data: !!(messageData.conversionInfo?.base64Data)
        });
      } else {
        console.log('🔧 이미지 URL 생성 조건 미충족:', {
          hasConversionInfo: !!messageData.conversionInfo,
          hasExistingImageUrl: !!imageUrl
        });
      }

      // MQTT 페이로드 구성
      const mqttPayload = {
        messageId: message.id,
        content: messageData.content,
        roomNumber: message.roomNumber,
        displayOptions: messageData.displayOptions || {},
        priority: message.priority,
        urgent: message.urgent,
        schedule: messageData.schedule || {},
        conversionInfo: messageData.conversionInfo,
        imageUrl: imageUrl,
        createdBy: messageData.createdBy,
        createdAt: message.createdAt,
        isTest: isTestDevice
      };

      // 🔧 중요: 테스트 디바이스든 실제 디바이스든 모두 MQTT 발행
      logger.device(deviceId, `🚀 MQTT 메시지 발행 시작: ${message.id} (${isTestDevice ? '테스트' : '실제'})`, {
        roomNumber: message.roomNumber,
        content: messageData.content?.substring(0, 50) + '...',
        hasImageUrl: !!imageUrl,
        isTest: isTestDevice
      });

      // 🆕 재해문자전광판 신프로토콜 변환
      let protocolPacket;
      let hexPayload = null;
      try {
        protocolPacket = protocolConverter.convertToProtocolPacket(mqttPayload, deviceId);
        protocolConverter.logPacketInfo(protocolPacket, mqttPayload);

        // 🔧 Buffer를 16진수 문자열로 변환
        hexPayload = protocolConverter.bufferToHexString(protocolPacket).replace(/ /g, '');

        console.log('🔧 신프로토콜 패킷 변환 성공:', {
          원본JSON크기: JSON.stringify(mqttPayload).length,
          바이너리패킷크기: protocolPacket.length,
          hexStringLength: hexPayload.length,
          hexPreview: hexPayload.substring(0, 50) + '...',
          deviceId: deviceId
        });
      } catch (protocolError) {
        logger.warn('프로토콜 변환 실패, JSON으로 전송:', protocolError.message);
        protocolPacket = null;
        hexPayload = null;
      }

      // 🔧 MQTT 메시지 발행 (16진수 문자열 우선, 실패시 JSON)
      let mqttResult;
      try {
        // 16진수 문자열이 있으면 그것을 전송, 없으면 JSON으로 전송
        const payloadToSend = hexPayload || mqttPayload;
        mqttResult = await this.directPublishToMqtt(deviceId, payloadToSend, isTestDevice);
      } catch (publishError) {
        // publishMqttMessage 함수 사용 시도
        logger.warn('직접 MQTT 발행 실패, publishMqttMessage 시도');
        mqttResult = await this.publishMqttMessage(
          deviceId,
          imageUrl ? this.MESSAGE_TYPES.IMAGE_MESSAGE : this.MESSAGE_TYPES.TEXT_MESSAGE,
          hexPayload || mqttPayload
        );
      }

      message.recordSendAttempt(true);
      message.updateStatus(Message.Status.ACTIVE);

      // 🔧 방 정보 저장 확인 및 로깅 강화
      console.log('🔧 메시지 저장 전 상태:', {
        messageId: message.id,
        roomNumber: message.roomNumber,
        deviceId: message.deviceId,
        status: message.status,
        urgent: message.urgent
      });

      const savedMessage = message.save();

      console.log('🔧 메시지 저장 후 상태:', {
        messageId: savedMessage.id,
        roomNumber: savedMessage.roomNumber,
        saved: !!savedMessage,
        status: savedMessage.status
      });

      const roomMessages = Message.findByRoomNumber(deviceId, message.roomNumber);
      const allDeviceMessages = Message.findByDeviceId(deviceId);
      const usedRoomNumbers = Message.getUsedRoomNumbers(deviceId);

      console.log('🔧 저장된 방번호별 메시지 확인:', {
        deviceId: deviceId,
        roomNumber: message.roomNumber,
        roomMessages: roomMessages.map(m => ({
          id: m.id,
          content: m.content?.substring(0, 20),
          status: m.status,
          createdAt: m.createdAt
        })),
        총방번호메시지수: roomMessages.length,
        전체디바이스메시지수: allDeviceMessages.length,
        사용중인방번호목록: usedRoomNumbers
      });

      logger.device(deviceId, `📋 방 기록 저장 완료: 방번호 ${message.roomNumber}`, {
        messageId: message.id,
        roomNumber: message.roomNumber,
        content: messageData.content?.substring(0, 30) + '...',
        totalRoomMessages: roomMessages.length,
        totalDeviceMessages: allDeviceMessages.length,
        usedRoomNumbers: usedRoomNumbers,
        messageStatus: message.status,
        savedAt: new Date().toISOString()
      });

      logger.device(deviceId, `✅ MQTT 메시지 발행 성공: ${message.id}, 방번호: ${message.roomNumber}`, {
        method: mqttResult.method || 'DIRECT',
        successCount: mqttResult.successCount || 1,
        totalTopics: mqttResult.totalTopics || 1,
        isTest: isTestDevice,
        imageUrl: imageUrl?.substring(0, 50)
      });

      return {
        success: true,
        message: message.toObject(),
        mqtt: mqttResult,
        imageUrl: imageUrl,
        conversionInfo: messageData.conversionInfo,
        isTest: isTestDevice,
        mqttSuccess: true,
        // 상세한 MQTT 정보 포함
        mqttDetails: {
          primaryTopic: mqttResult.primaryTopic || `display/${deviceId}/message`,
          successfulTopics: mqttResult.allTopics?.filter(t => t.success).map(t => t.topic) || [`display/${deviceId}/message`],
          failedTopics: mqttResult.allTopics?.filter(t => !t.success).map(t => t.topic) || [],
          totalAttempts: mqttResult.totalTopics || 1
        }
      };

    } catch (error) {
      message.recordSendAttempt(false, error.message);
      message.updateStatus(Message.Status.FAILED);

      logger.device(deviceId, `❌ MQTT 메시지 발행 실패: ${message.id}`, {
        error: error.message,
        stack: error.stack
      });

      // 오류 발생 시에도 상세 정보 포함
      throw new Error(`MQTT 메시지 발행 실패: ${error.message}`);
    }
  }

  // 🆕 직접 MQTT 발행 함수 (16진수 문자열 지원)
  async directPublishToMqtt(deviceId, payload, isTest = false) {
    const { publishToMqtt } = require('../utils/mqttClient');

    // 🔧 16진수 문자열인지 확인
    const isHexString = typeof payload === 'string' && /^[0-9A-Fa-f]+$/.test(payload);

    // 🆕 전송 방식 설정 (환경변수로 제어)
    const SEND_AS_BINARY = process.env.MQTT_SEND_AS_BINARY !== 'false'; // 기본값: true (바이너리)

    // 다양한 토픽 패턴 시도
    const topics = [
      `display/${deviceId}/message`,  // 주 토픽
      `display/${deviceId}/image`,    // 이미지 토픽
      deviceId,                       // 단순 형태
      `led/${deviceId}`,              // 기존 형태
      `device/${deviceId}/cmd`,       // 다른 형태
      `${deviceId}/message`           // 또 다른 형태
    ];

    const results = [];
    let successCount = 0;

    for (const topic of topics) {
      try {
        if (isHexString) {
          if (SEND_AS_BINARY) {
            // 🆕 16진수 문자열을 바이너리로 변환하여 전송
            const binaryBuffer = Buffer.from(payload, 'hex');
            await publishToMqtt(topic, binaryBuffer, { qos: 1, retain: true });
            console.log(`🔧 바이너리 MQTT 발행 성공: ${topic} (바이너리 크기: ${binaryBuffer.length}바이트)`);
            console.log(`🔧 원본 16진수: ${payload.substring(0, 100)}${payload.length > 50 ? '...' : ''}`);

            // 🔥 파이썬에서 받게 될 형태 표시
            const pythonBinaryFormat = binaryBuffer.toString('binary').split('').map(c =>
              c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126
                ? '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')
                : c
            ).join('');
            console.log(`🐍 파이썬 수신 형태: ${pythonBinaryFormat.substring(0, 100)}${pythonBinaryFormat.length > 50 ? '...' : ''}`);
          } else {
            // 🔧 16진수 문자열을 그대로 문자열로 전송 (기본값)
            await publishToMqtt(topic, payload, { qos: 1, retain: true });
            console.log(`🔧 16진수 문자열 MQTT 발행 성공: ${topic} (길이: ${payload.length}문자)`);
            console.log(`🔧 16진수 데이터: ${payload.substring(0, 100)}${payload.length > 50 ? '...' : ''}`);
          }
        } else {
          // 🔧 일반 JSON 객체인 경우 기존 방식
          await publishToMqtt(topic, payload, { qos: 1, retain: true });
          console.log(`🔧 JSON MQTT 발행 성공: ${topic}`);
        }

        results.push({
          topic,
          success: true,
          payloadType: isHexString ? (SEND_AS_BINARY ? 'binary' : 'hex_string') : 'json'
        });
        successCount++;
        const mode = isHexString ? (SEND_AS_BINARY ? '바이너리' : '16진수문자열') : 'JSON';
        logger.info(`✅ 직접 MQTT 발행 성공: ${topic} (${mode})`);
      } catch (error) {
        results.push({ topic, success: false, error: error.message });
        logger.warn(`❌ 직접 MQTT 발행 실패: ${topic}`, error.message);
      }
    }

    if (successCount === 0) {
      throw new Error('모든 토픽에서 MQTT 발행 실패');
    }

    return {
      success: true,
      method: 'DIRECT_PUBLISH',
      primaryTopic: topics[0],
      successCount: successCount,
      totalTopics: topics.length,
      allTopics: results,
      payloadType: isHexString ? (SEND_AS_BINARY ? 'binary' : 'hex_string') : 'json',
      sendMode: SEND_AS_BINARY ? 'BINARY' : 'HEX_STRING',
      timestamp: new Date().toISOString()
    };
  }

  // 🔧 수정된 이미지 메시지 전송 (MQTT 통신)
  async sendImageMessage(deviceId, messageData) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
    }

    // 🆕 웹서버에서 이미지 다운로드 처리
    let imageData = messageData.imageData;
    let downloadedImage = null;

    if (messageData.webServerUrl && !imageData) {
      try {
        downloadedImage = await this.downloadImageFromWebServer(messageData.webServerUrl);
        imageData = {
          base64: downloadedImage.data.toString('base64'),
          filename: 'downloaded_image.bmp',
          size: downloadedImage.size,
          type: downloadedImage.contentType,
          webServerUrl: messageData.webServerUrl
        };
      } catch (downloadError) {
        logger.error('웹서버 이미지 다운로드 실패:', downloadError.message);
        throw downloadError;
      }
    }

    const message = Message.create({
      deviceId,
      type: Message.Type.IMAGE,
      imageData: imageData,
      priority: messageData.priority || Message.Priority.NORMAL,
      urgent: messageData.urgent || false,
      roomNumber: messageData.roomNumber || this.assignRoomNumber(deviceId, messageData.urgent),
      displayOptions: messageData.displayOptions,
      schedule: messageData.schedule,
      createdBy: messageData.createdBy
    });

    try {
      message.updateStatus(Message.Status.SENDING);

      if (this.isTestDevice(device)) {
        logger.device(deviceId, `🧪 테스트 이미지 메시지 전송: ${message.id}`, {
          roomNumber: message.roomNumber,
          imageSize: imageData?.size
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        message.recordSendAttempt(true);
        message.updateStatus(Message.Status.ACTIVE);

        return {
          success: true,
          message: message.toObject(),
          response: {
            status: this.RESPONSES.OK,
            isTest: true
          },
          isTest: true
        };
      }

      // 🔧 실제 디바이스 MQTT 처리
      const mqttPayload = {
        messageId: message.id,
        imageData: imageData,
        roomNumber: message.roomNumber,
        displayOptions: messageData.displayOptions || {},
        priority: message.priority,
        urgent: message.urgent,
        schedule: messageData.schedule || {},
        webServerUrl: messageData.webServerUrl,
        downloadedImage: downloadedImage,
        createdBy: messageData.createdBy,
        createdAt: message.createdAt
      };

      // 🆕 재해문자전광판 신프로토콜 변환
      let protocolPacket;
      let hexPayload = null;
      try {
        console.log('🚨 displayService 프로토콜 변환 시작:', {
          deviceId,
          messageId: message.id,
          roomNumber: message.roomNumber,
          imageUrl: messageData.webServerUrl || mqttPayload.imageUrl
        });

        // 🔧 올바른 프로토콜 데이터 구성
        const protocolData = {
          messageId: message.id,
          roomNumber: message.roomNumber,
          imageUrl: messageData.webServerUrl || mqttPayload.imageUrl || '',
          type: 'image',
          displayOptions: messageData.displayOptions || {},
          schedule: messageData.schedule,
          urgent: message.urgent
        };

        protocolPacket = protocolConverter.convertToProtocolPacket(protocolData, deviceId);

        console.log('✅ displayService 프로토콜 변환 성공:', {
          packetSize: protocolPacket.length,
          STX: '0x' + protocolPacket[0].toString(16).padStart(2, '0'),
          ETX: '0x' + protocolPacket[protocolPacket.length - 1].toString(16).padStart(2, '0')
        });

        // 🔧 Buffer를 16진수 문자열로 변환
        hexPayload = protocolConverter.bufferToHexString(protocolPacket).replace(/ /g, '');

      } catch (protocolError) {
        console.error('❌ displayService 프로토콜 변환 실패:', protocolError.message);
        logger.warn('이미지 메시지 프로토콜 변환 실패, JSON으로 전송:', protocolError.message);
        protocolPacket = null;
        hexPayload = null;
      }

      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.IMAGE_MESSAGE,
        hexPayload || mqttPayload
      );

      message.recordSendAttempt(true);
      message.updateStatus(Message.Status.ACTIVE);

      logger.device(deviceId, `이미지 메시지 MQTT 전송 성공: ${message.id}, 방번호: ${message.roomNumber}`, {
        topic: mqttResult.topic,
        method: mqttResult.method
      });

      return {
        success: true,
        message: message.toObject(),
        mqtt: mqttResult,
        isTest: false
      };
    } catch (error) {
      message.recordSendAttempt(false, error.message);
      logger.device(deviceId, `이미지 메시지 MQTT 전송 실패: ${message.id}`, error.message);
      throw error;
    }
  }

  // 🔧 수정된 복합 메시지 전송 (MQTT 통신)
  async sendMixedMessage(deviceId, messageData) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
    }

    const message = Message.create({
      deviceId,
      type: Message.Type.MIXED,
      components: messageData.components,
      priority: messageData.priority || Message.Priority.NORMAL,
      urgent: messageData.urgent || false,
      roomNumber: messageData.roomNumber || this.assignRoomNumber(deviceId, messageData.urgent),
      displayOptions: messageData.displayOptions,
      schedule: messageData.schedule,
      createdBy: messageData.createdBy
    });

    try {
      message.updateStatus(Message.Status.SENDING);

      if (this.isTestDevice(device)) {
        logger.device(deviceId, `🧪 테스트 복합 메시지 전송: ${message.id}`, {
          roomNumber: message.roomNumber,
          components: messageData.components?.length
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        message.recordSendAttempt(true);
        message.updateStatus(Message.Status.ACTIVE);

        return {
          success: true,
          message: message.toObject(),
          response: {
            status: this.RESPONSES.OK,
            isTest: true
          },
          isTest: true
        };
      }

      // 🔧 실제 디바이스 MQTT 처리
      const mqttPayload = {
        messageId: message.id,
        components: messageData.components,
        roomNumber: message.roomNumber,
        displayOptions: messageData.displayOptions || {},
        priority: message.priority,
        urgent: message.urgent,
        schedule: messageData.schedule || {},
        createdBy: messageData.createdBy,
        createdAt: message.createdAt
      };

      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.MIXED_MESSAGE,
        mqttPayload
      );

      message.recordSendAttempt(true);
      message.updateStatus(Message.Status.ACTIVE);

      logger.device(deviceId, `복합 메시지 MQTT 전송 성공: ${message.id}, 방번호: ${message.roomNumber}`, {
        topic: mqttResult.topic,
        method: mqttResult.method
      });

      return {
        success: true,
        message: message.toObject(),
        mqtt: mqttResult,
        isTest: false
      };
    } catch (error) {
      message.recordSendAttempt(false, error.message);
      logger.device(deviceId, `복합 메시지 MQTT 전송 실패: ${message.id}`, error.message);
      throw error;
    }
  }

  // 🆕 멀티미디어 메시지 전송 (MQTT 기반)
  async sendMultimediaMessage(deviceId, messageData) {
    let device = Device.findById(deviceId);

    // 디바이스를 찾지 못한 경우, 실제 디바이스로 처리
    if (!device) {
      device = {
        id: deviceId,
        deviceId: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        status: 'offline',
        isTest: false,
        specs: {
          model: 'REAL-LED',
          resolution: { width: 1920, height: 1080 },
          size: '55인치',
          maxBrightness: 100
        }
      };
    }

    const message = Message.create({
      deviceId,
      type: Message.Type.MULTIMEDIA,
      content: messageData.content,
      priority: messageData.priority || Message.Priority.NORMAL,
      urgent: messageData.urgent || false,
      roomNumber: messageData.roomNumber || this.assignRoomNumber(deviceId, messageData.urgent),
      displayOptions: messageData.displayOptions,
      schedule: messageData.schedule,
      createdBy: messageData.createdBy
    });

    try {
      message.updateStatus(Message.Status.SENDING);

      // 이미지 URL 및 변환 정보 처리
      const imageUrl = messageData.imageUrl;
      const conversionInfo = messageData.conversionInfo;
      const roomNumber = message.roomNumber;
      const timestamp = Date.now();

      // 🔧 MQTT 페이로드 구성
      const mqttPayload = {
        messageId: message.id,
        imageUrl: imageUrl,
        deviceId: deviceId,
        conversionInfo: conversionInfo,
        roomNumber: roomNumber,
        timestamp: timestamp,
        content: messageData.content,
        displayOptions: messageData.displayOptions || {},
        priority: message.priority,
        urgent: message.urgent,
        schedule: messageData.schedule || {},
        createdBy: messageData.createdBy,
        createdAt: message.createdAt
      };

      logger.info(`MQTT 멀티미디어 메시지 전송 준비`, {
        deviceId: deviceId,
        messageId: message.id,
        imageUrl: imageUrl?.substring(0, 50),
        roomNumber: roomNumber
      });

      // 🆕 재해문자전광판 신프로토콜 변환
      let protocolPacket;
      let hexPayload = null;
      try {
        protocolPacket = protocolConverter.convertToProtocolPacket(mqttPayload, deviceId);
        protocolConverter.logPacketInfo(protocolPacket, mqttPayload);

        // 🔧 Buffer를 16진수 문자열로 변환
        hexPayload = protocolConverter.bufferToHexString(protocolPacket).replace(/ /g, '');

        console.log('🔧 멀티미디어 메시지 프로토콜 패킷 변환 성공:', {
          원본JSON크기: JSON.stringify(mqttPayload).length,
          바이너리패킷크기: protocolPacket.length,
          hexStringLength: hexPayload.length,
          hexPreview: hexPayload.substring(0, 50) + '...',
          deviceId: deviceId
        });
      } catch (protocolError) {
        logger.warn('멀티미디어 메시지 프로토콜 변환 실패, JSON으로 전송:', protocolError.message);
        protocolPacket = null;
        hexPayload = null;
      }

      // 🔧 MQTT 메시지 발행
      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.MULTIMEDIA_MESSAGE,
        hexPayload || mqttPayload
      );

      message.recordSendAttempt(true);
      message.updateStatus(Message.Status.ACTIVE);

      logger.device(deviceId, `멀티미디어 메시지 MQTT 전송 성공: ${message.id}`, {
        topic: mqttResult.topic,
        method: mqttResult.method,
        roomNumber: roomNumber
      });

      return {
        success: true,
        message: message.toObject(),
        mqtt: mqttResult,
        isTest: false,
        mqttSuccess: true
      };
    } catch (error) {
      message.recordSendAttempt(false, error.message);
      message.updateStatus(Message.Status.FAILED);

      logger.device(deviceId, `멀티미디어 메시지 MQTT 전송 실패: ${message.id}`, error.message);

      return {
        success: false,
        error: error.message,
        message: message.toObject(),
        isTest: false,
        mqttSuccess: false
      };
    }
  }

  // 🔧 수정된 명령 전송 (MQTT 통신)
  async sendCommand(deviceId, command, data = null) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
    }

    if (this.isTestDevice(device)) {
      logger.device(deviceId, '🧪 테스트 명령 전송', {
        command: command,
        data: data ? Object.keys(data).length : 0
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      return {
        status: this.RESPONSES.OK,
        command: command,
        data: data,
        isTest: true,
        timestamp: new Date()
      };
    }

    // 🔧 실제 디바이스 MQTT 명령 전송
    try {
      const mqttPayload = {
        command: command,
        data: data,
        timestamp: new Date().toISOString()
      };

      logger.device(deviceId, 'MQTT 명령 전송', {
        command: command,
        dataLength: data ? Object.keys(data).length : 0
      });

      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.COMMAND,
        mqttPayload
      );

      return {
        status: this.RESPONSES.MQTT_SUCCESS,
        command: command,
        data: data,
        mqtt: mqttResult,
        isTest: false,
        timestamp: new Date()
      };
    } catch (error) {
      logger.device(deviceId, 'MQTT 명령 전송 실패', error.message);
      throw error;
    }
  }

  // 🔧 수정된 전체 메시지 삭제 (MQTT 통신)
  async clearAllMessages(deviceId) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
    }

    try {
      if (this.isTestDevice(device)) {
        const activeMessages = Message.getActiveMessages(deviceId);

        logger.device(deviceId, `🧪 테스트 전체 메시지 삭제: ${activeMessages.length}개`);

        activeMessages.forEach(message => {
          message.updateStatus(Message.Status.CANCELLED);
        });

        return {
          success: true,
          message: '테스트 디바이스 전체 메시지 삭제 성공',
          deletedCount: activeMessages.length,
          isTest: true
        };
      }

      // 🔧 실제 디바이스 MQTT 처리
      const mqttPayload = {
        command: 'delete_all',
        timestamp: new Date().toISOString()
      };

      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.DELETE_ALL,
        mqttPayload
      );

      const activeMessages = Message.getActiveMessages(deviceId);
      activeMessages.forEach(message => {
        message.updateStatus(Message.Status.CANCELLED);
      });

      logger.device(deviceId, 'MQTT 전체 메시지 삭제 성공');

      return {
        success: true,
        message: 'MQTT 전체 메시지 삭제 성공',
        deletedCount: activeMessages.length,
        mqtt: mqttResult,
        isTest: false
      };
    } catch (error) {
      logger.device(deviceId, 'MQTT 전체 메시지 삭제 실패', error.message);
      throw error;
    }
  }

  // 🔧 수정된 방번호별 메시지 삭제 (MQTT 통신)
  async deleteRoomMessages(deviceId, roomNumber) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new AppError('디바이스를 찾을 수 없습니다.', 404, 'DEVICE_NOT_FOUND');
    }

    try {
      if (this.isTestDevice(device)) {
        logger.device(deviceId, `🧪 테스트 방번호 삭제: ${roomNumber}`);

        // 테스트 디바이스의 해당 방번호 메시지 삭제
        const roomMessages = Message.findByRoomNumber(deviceId, roomNumber);
        roomMessages.forEach(message => {
          message.updateStatus(Message.Status.CANCELLED);
        });

        return {
          success: true,
          message: `테스트 디바이스 방번호 ${roomNumber} 삭제 성공`,
          deletedCount: roomMessages.length,
          isTest: true
        };
      }

      // 🔧 실제 디바이스 MQTT 처리
      const mqttPayload = {
        command: 'delete_room',
        roomNumber: roomNumber,
        timestamp: new Date().toISOString()
      };

      const mqttResult = await this.publishMqttMessage(
        deviceId,
        this.MESSAGE_TYPES.DELETE_ROOM,
        mqttPayload
      );

      // 데이터베이스에서 해당 방번호 메시지 삭제
      const deletedCount = Message.deleteByRoomNumber(deviceId, roomNumber);

      logger.device(deviceId, `MQTT 방번호 삭제 성공: ${roomNumber}`, {
        deletedCount: deletedCount
      });

      return {
        success: true,
        message: `방번호 ${roomNumber} MQTT 삭제 성공`,
        deletedCount: deletedCount,
        mqtt: mqttResult,
        isTest: false
      };
    } catch (error) {
      logger.device(deviceId, `MQTT 방번호 삭제 실패: ${roomNumber}`, error.message);
      throw error;
    }
  }

  // src/services/displayService.js - MQTT 통신 기반 전체 코드 Part 4/4

  // 🔧 방번호 자동 할당 메서드
  assignRoomNumber(deviceId, isUrgent = false) {
    try {
      // 현재 디바이스의 활성 메시지들 조회
      const activeMessages = Message.findByDeviceId(deviceId).filter(msg =>
        msg.status === Message.Status.ACTIVE || msg.status === Message.Status.SENDING
      );

      // 사용 중인 방번호들 추출
      const usedRooms = activeMessages.map(msg => msg.roomNumber).filter(room => room != null);

      // 긴급 메시지 여부에 따라 할당 범위 결정
      let startRoom, endRoom;
      if (isUrgent) {
        startRoom = 1;
        endRoom = 5; // 긴급 메시지는 1-5번
      } else {
        startRoom = 6;
        endRoom = 100; // 일반 메시지는 6-100번
      }

      // 사용 가능한 방번호 찾기
      let availableRoom = startRoom;
      for (let i = startRoom; i <= endRoom; i++) {
        if (!usedRooms.includes(i)) {
          availableRoom = i;
          break;
        }
      }

      logger.info(`방번호 자동 할당: 디바이스 ${deviceId} → 방번호 ${availableRoom} (${isUrgent ? '긴급' : '일반'})`, {
        usedRooms: usedRooms,
        availableRoom: availableRoom,
        isUrgent: isUrgent,
        range: `${startRoom}-${endRoom}`
      });

      return availableRoom;
    } catch (error) {
      logger.error(`방번호 자동 할당 실패: ${deviceId}`, error.message);
      // 기본값으로 긴급 여부에 따라 반환
      return isUrgent ? 1 : 6;
    }
  }

  // 연결 해제 처리
  handleDisconnection(deviceId, error = null) {
    // MQTT 연결 정리
    this.connections.delete(deviceId);

    // 하트비트 중지
    this.stopHeartbeat(deviceId);

    // 재연결 타임아웃 정리
    const timeout = this.reconnectTimeouts.get(deviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(deviceId);
    }

    // 명령 큐 정리
    this.commandQueue.delete(deviceId);
    this.pendingResponses.delete(deviceId);

    // 디바이스 상태 업데이트
    const device = Device.findById(deviceId);
    if (device) {
      device.updateStatus(Device.Status.OFFLINE);
      if (error) {
        device.recordConnectionAttempt(false, error.message);
      }
    }

    this.emit('deviceDisconnected', { deviceId, error });

    logger.device(deviceId, 'MQTT 연결 해제 처리 완료', error?.message);
  }

  // 하트비트 시작
  startHeartbeat(deviceId) {
    this.stopHeartbeat(deviceId);

    const interval = setInterval(async () => {
      try {
        await this.publishMqttMessage(deviceId, this.MESSAGE_TYPES.HEARTBEAT, {
          timestamp: new Date().toISOString(),
          status: 'heartbeat'
        });

        const device = Device.findById(deviceId);
        if (device) {
          device.updateHeartbeat();
        }
      } catch (error) {
        logger.device(deviceId, 'MQTT 하트비트 실패', error.message);
      }
    }, this.config.heartbeatInterval);

    this.heartbeatIntervals.set(deviceId, interval);
  }

  // 하트비트 중지
  stopHeartbeat(deviceId) {
    const interval = this.heartbeatIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(deviceId);
    }
  }

  // 하트비트 확인
  checkHeartbeats() {
    // 실제 디바이스 하트비트 확인
    const expiredDevices = Device.checkHeartbeats(this.config.heartbeatTimeout);
    expiredDevices.forEach(deviceId => {
      if (!this.isTestDevice(deviceId)) {
        logger.device(deviceId, '하트비트 만료로 MQTT 연결 해제');
        this.handleDisconnection(deviceId, 'Heartbeat expired');
      }
    });
  }

  // 만료된 메시지 정리
  cleanupExpiredMessages() {
    const expiredMessages = Message.cleanupExpiredMessages();
    if (expiredMessages.length > 0) {
      logger.info(`만료된 메시지 ${expiredMessages.length}개 정리 완료`);
    }
  }

  // 연결된 디바이스 목록 반환
  getConnectedDevices() {
    const realDevices = Array.from(this.connections.keys());
    const testDevices = Array.from(this.testConnections);
    return [...realDevices, ...testDevices];
  }

  // 연결 통계 반환
  getConnectionStats() {
    const totalDevices = Device.count();
    const connectedReal = this.connections.size;
    const connectedTest = this.testConnections.size;
    const totalConnected = connectedReal + connectedTest;

    const devices = Device.findAll();

    return {
      total: totalDevices,
      connected: totalConnected,
      offline: totalDevices - totalConnected,
      test: connectedTest,
      real: connectedReal,
      uptime: totalConnected > 0 ? (totalConnected / totalDevices * 100) : 0,
      mqttInfo: {
        brokerHost: process.env.MQTT_BROKER_HOST || 'Not configured',
        brokerPort: process.env.MQTT_BROKER_PORT || 'Not configured',
        topicPrefix: this.mqttConfig.topicPrefix,
        qos: this.mqttConfig.qos,
        connected: !!(this.mqttClient && this.mqttClient.connected),
        enableBackup: false,
        backupTarget: null
      },
      protocolInfo: {
        protocol: 'MQTT',
        supportedMessageTypes: Object.values(this.MESSAGE_TYPES),
        supportedCommands: Object.values(this.PROTOCOL_COMMANDS),
        webServerDownload: true,
        textToImageConversion: true,
        backupProtocol: null
      },
      webServerInfo: {
        host: this.webServerConfig.host,
        port: this.webServerConfig.port,
        protocol: this.webServerConfig.protocol,
        imagePath: this.webServerConfig.imagePath,
        maxImageSize: this.webServerConfig.maxImageSize
      },
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        status: device.status,
        connected: this.isDeviceConnected(device.id),
        isTest: this.isTestDevice(device),
        lastHeartbeat: device.connectionInfo?.lastHeartbeat,
        mqttTopics: this.connections.has(device.id) ? this.connections.get(device.id).topics : null,
        connectionMethod: this.connections.has(device.id) ? this.connections.get(device.id).method : null
      }))
    };
  }

  // MQTT 연결 상태 반환
  getMqttStatus() {
    return {
      connected: isConnected(),
      client: !!this.mqttClient,
      config: {
        brokerHost: process.env.MQTT_BROKER_HOST,
        brokerPort: process.env.MQTT_BROKER_PORT,
        topicPrefix: this.mqttConfig.topicPrefix,
        qos: this.mqttConfig.qos,
        retain: this.mqttConfig.retain
      },
      topics: {
        MESSAGE: this.MQTT_TOPICS.MESSAGE('DEVICE_ID'),
        IMAGE: this.MQTT_TOPICS.IMAGE('DEVICE_ID'),
        MULTIMEDIA: this.MQTT_TOPICS.MULTIMEDIA('DEVICE_ID'),
        COMMAND: this.MQTT_TOPICS.COMMAND('DEVICE_ID'),
        STATUS: this.MQTT_TOPICS.STATUS('DEVICE_ID'),
        HEARTBEAT: this.MQTT_TOPICS.HEARTBEAT('DEVICE_ID'),
        RESPONSE: this.MQTT_TOPICS.RESPONSE('DEVICE_ID')
      }
    };
  }

  // 시스템 진단
  async performSystemDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      mqtt: {
        client: !!this.mqttClient,
        connected: isConnected(),
        error: null
      },
      devices: {
        total: Device.count(),
        online: 0,
        offline: 0,
        test: 0,
        real: 0
      },
      connections: {
        mqtt: this.connections.size,
        test: this.testConnections.size
      },
      messages: {
        active: Message.getActiveMessages().length,
        pending: 0,
        failed: 0
      },
      resources: {
        heartbeatIntervals: this.heartbeatIntervals.size,
        commandQueues: this.commandQueue.size,
        pendingResponses: this.pendingResponses.size
      }
    };

    // MQTT 연결 테스트
    if (this.mqttClient) {
      try {
        const testTopic = `${this.mqttConfig.topicPrefix}/system/diagnostics`;
        const testPayload = {
          test: true,
          timestamp: new Date().toISOString()
        };

        await publishToMqtt(testTopic, testPayload);
        diagnostics.mqtt.testPublish = true;
      } catch (error) {
        diagnostics.mqtt.error = error.message;
        diagnostics.mqtt.testPublish = false;
      }
    }

    // 디바이스 통계 수집
    const devices = Device.findAll();
    devices.forEach(device => {
      if (device.status === 'online') {
        diagnostics.devices.online++;
      } else {
        diagnostics.devices.offline++;
      }

      if (this.isTestDevice(device)) {
        diagnostics.devices.test++;
      } else {
        diagnostics.devices.real++;
      }
    });

    // 메시지 통계 수집
    const allMessages = Message.findAll();
    allMessages.forEach(message => {
      if (message.status === Message.Status.PENDING) {
        diagnostics.messages.pending++;
      } else if (message.status === Message.Status.FAILED) {
        diagnostics.messages.failed++;
      }
    });

    return diagnostics;
  }

  // 시스템 정리
  async cleanup() {
    logger.info('DisplayService 정리 시작');

    try {
      // 진행 중인 작업들 정리
      for (const [deviceId, queue] of this.commandQueue) {
        if (queue.length > 0) {
          logger.warn(`디바이스 ${deviceId}의 ${queue.length}개 명령이 정리됨`);
        }
      }

      // 대기 중인 응답들 정리
      for (const [deviceId, promise] of this.pendingResponses) {
        promise.reject(new Error('시스템 종료로 인한 응답 취소'));
      }

      // 타임아웃들 정리
      for (const timeout of this.reconnectTimeouts.values()) {
        clearTimeout(timeout);
      }

      logger.info('DisplayService 정리 완료');
    } catch (error) {
      logger.error('DisplayService 정리 중 오류:', error.message);
    }
  }

  // 서비스 종료
  shutdown() {
    logger.info('DisplayService 종료 중 (MQTT)...');

    // 테스트 디바이스 연결 해제
    for (const deviceId of this.testConnections) {
      this.unregisterTestDevice(deviceId);
    }

    // 실제 디바이스 연결 해제
    const disconnectPromises = [];
    for (const deviceId of this.connections.keys()) {
      disconnectPromises.push(this.disconnectDevice(deviceId).catch(err =>
        logger.error(`디바이스 ${deviceId} MQTT 연결 해제 실패:`, err)
      ));
    }

    // 하트비트 정리
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }

    // 타임아웃 정리
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }

    // MQTT 클라이언트 종료
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true); // 강제 종료
        logger.info('MQTT 클라이언트 종료됨');
      } catch (error) {
        logger.error('MQTT 클라이언트 종료 실패:', error.message);
      }
    }

    // 정리 작업
    this.cleanup();

    // 상태 초기화
    this.connections.clear();
    this.testConnections.clear();
    this.testDevices.clear();
    this.heartbeatIntervals.clear();
    this.reconnectTimeouts.clear();
    this.commandQueue.clear();
    this.pendingResponses.clear();
    this.removeAllListeners();

    return Promise.all(disconnectPromises).then(() => {
      logger.info('DisplayService 종료 완료 (MQTT 통신, 텍스트→이미지 변환 지원, TCP/IP 백업)');
    });
  }

  // 🆕 MQTT 재연결 시도
  async reconnectMqtt() {
    if (this.mqttClient && !this.mqttClient.connected) {
      try {
        logger.info('MQTT 수동 재연결 시도');
        this.mqttClient.reconnect();
        return true;
      } catch (error) {
        logger.error('MQTT 수동 재연결 실패:', error.message);
        return false;
      }
    }
    return false;
  }

  // 🆕 디바이스 상태 강제 동기화
  async forceDeviceSync(deviceId) {
    try {
      const device = Device.findById(deviceId);
      if (!device) {
        throw new Error('디바이스를 찾을 수 없습니다.');
      }

      if (this.isTestDevice(device)) {
        // 테스트 디바이스는 항상 온라인으로 설정
        if (!this.testConnections.has(deviceId)) {
          this.registerTestDevice(deviceId);
        }
        return { success: true, status: 'online', isTest: true };
      }

      // 실제 디바이스 상태 확인
      const isConnected = this.connections.has(deviceId);
      const shouldBeOnline = isConnected && this.mqttClient && this.mqttClient.connected;

      if (shouldBeOnline !== (device.status === 'online')) {
        device.updateStatus(shouldBeOnline ? 'online' : 'offline');
        logger.info(`디바이스 ${deviceId} 상태 동기화: ${device.status}`);
      }

      return {
        success: true,
        status: device.status,
        isTest: false,
        mqttConnected: !!(this.mqttClient && this.mqttClient.connected),
        deviceConnected: isConnected
      };
    } catch (error) {
      logger.error(`디바이스 상태 동기화 실패: ${deviceId}`, error.message);
      return { success: false, error: error.message };
    }
  }

  // 🆕 MQTT 토픽 정보 반환
  getTopicInfo(deviceId) {
    return {
      deviceId,
      topics: {
        command: this.MQTT_TOPICS.COMMAND(deviceId),
        message: this.MQTT_TOPICS.MESSAGE(deviceId),
        image: this.MQTT_TOPICS.IMAGE(deviceId),
        multimedia: this.MQTT_TOPICS.MULTIMEDIA(deviceId),
        status: this.MQTT_TOPICS.STATUS(deviceId),
        heartbeat: this.MQTT_TOPICS.HEARTBEAT(deviceId),
        response: this.MQTT_TOPICS.RESPONSE(deviceId),
        roomDelete: this.MQTT_TOPICS.ROOM_DELETE(deviceId),
        allDelete: this.MQTT_TOPICS.ALL_DELETE(deviceId)
      },
      config: {
        qos: this.mqttConfig.qos,
        retain: this.mqttConfig.retain,
        topicPrefix: this.mqttConfig.topicPrefix
      }
    };
  }

  // 🆕 테스트 디바이스 여부 확인
  isTestDevice(deviceId) {
    if (typeof deviceId === 'object') {
      const device = deviceId;
      // 명시적으로 테스트 모드로 설정된 디바이스만 테스트로 처리
      return device.isTest === true || device.specs?.model === 'TEST_DEVICE';
    } else {
      const device = Device.findById(deviceId);
      if (!device) return false;

      // 명시적으로 테스트 모드로 설정된 디바이스만 테스트로 처리
      return device.isTest === true || device.specs?.model === 'TEST_DEVICE';
    }
  }

  // 🆕 연결 상태 확인 (테스트 디바이스 지원)
  isDeviceConnected(deviceId) {
    if (this.isTestDevice(deviceId)) {
      return this.testConnections.has(deviceId);
    }
    return this.connections.has(deviceId);
  }

  // 🆕 테스트 디바이스 연결 등록
  registerTestDevice(deviceId) {
    const device = Device.findById(deviceId);
    if (!device) {
      throw new Error('디바이스를 찾을 수 없습니다.');
    }

    this.testConnections.add(deviceId);
    this.testDevices.set(deviceId, {
      connected: true,
      lastHeartbeat: new Date(),
      isTest: true,
      device: device
    });

    this.startTestHeartbeat(deviceId);

    logger.device(deviceId, `🧪 테스트 디바이스 연결 등록: ${device.name}`);
    this.emit('deviceConnected', { deviceId, device: device.toObject(), isTest: true });
  }

  // 🆕 테스트 디바이스 연결 해제
  unregisterTestDevice(deviceId) {
    this.testConnections.delete(deviceId);
    this.testDevices.delete(deviceId);
    this.stopTestHeartbeat(deviceId);

    const device = Device.findById(deviceId);
    if (device) {
      device.updateStatus('offline');
      logger.device(deviceId, `🧪 테스트 디바이스 연결 해제: ${device.name}`);
    }

    this.emit('deviceDisconnected', { deviceId, isTest: true });
  }

  // 🆕 테스트 디바이스 하트비트 시작
  startTestHeartbeat(deviceId) {
    this.stopTestHeartbeat(deviceId);

    const interval = setInterval(() => {
      const device = Device.findById(deviceId);
      if (device) {
        device.updateHeartbeat({
          temperature: 25 + Math.random() * 10,
          powerStatus: 'ON',
          memoryUsage: 30 + Math.random() * 40,
          errorCount: 0,
          isTest: true
        });

        if (this.config.enableDebug) {
          logger.device(deviceId, '🧪 테스트 하트비트 업데이트');
        }
      }
    }, this.config.heartbeatInterval);

    this.heartbeatIntervals.set(deviceId, interval);
  }

  // 🆕 테스트 디바이스 하트비트 중지
  stopTestHeartbeat(deviceId) {
    const interval = this.heartbeatIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(deviceId);
      if (this.config.enableDebug) {
        logger.device(deviceId, '🧪 테스트 하트비트 중지');
      }
    }
  }

  // 🔧 MQTT 메시지 발행 (다중 토픽 패턴)
  async publishMqttMessage(deviceId, messageType, payload, options = {}) {
    // MQTT 클라이언트 초기화 및 연결 확인
    if (!this.mqttClient) {
      logger.info('MQTT 클라이언트 초기화 시도');
      await this.initializeMqttClient();
    }

    if (!isConnected()) {
      logger.info('MQTT 재연결 시도');
      await reconnect();

      // 연결되지 않으면 오류 발생
      if (!isConnected()) {
        throw new AppError('MQTT 클라이언트 연결 실패', 500, 'MQTT_NOT_CONNECTED');
      }
    }

    // 🆕 다양한 토픽 패턴 정의 (실제 디바이스가 어떤 패턴을 사용하는지 모르므로)
    const topicPatterns = this.generateTopicPatterns(deviceId, messageType);

    const publishOptions = {
      qos: options.qos || this.mqttConfig.qos,
      retain: options.retain !== undefined ? options.retain : this.mqttConfig.retain
    };

    // 🔧 16진수 문자열인지 확인
    const isHexString = typeof payload === 'string' && /^[0-9A-Fa-f]+$/.test(payload);

    let payloadToSend;
    if (isHexString) {
      // 🔧 16진수 문자열을 그대로 문자열로 전송
      payloadToSend = payload;
      console.log(`🔧 publishMqttMessage: 16진수 문자열 전송 (${payload.length}문자)`);
    } else {
      // 🔧 일반 데이터인 경우 JSON 래핑
      payloadToSend = {
        messageType,
        deviceId,
        timestamp: new Date().toISOString(),
        qos: publishOptions.qos,
        retain: publishOptions.retain,
        ...payload
      };
    }

    // 🆕 모든 토픽 패턴에 발행
    const results = [];
    let successCount = 0;

    for (const topic of topicPatterns) {
      try {
        await publishToMqtt(topic, payloadToSend, publishOptions);
        results.push({ topic, success: true, payloadType: isHexString ? 'hex_string' : 'json' });
        successCount++;

        logger.info(`✅ MQTT 발행 성공: ${topic} (${isHexString ? '16진수문자열' : 'JSON'})`, {
          deviceId,
          messageType,
          payloadSize: isHexString ? payloadToSend.length : JSON.stringify(payloadToSend).length
        });
      } catch (error) {
        results.push({ topic, success: false, error: error.message });
        logger.warn(`❌ MQTT 발행 실패: ${topic}`, error.message);
      }
    }

    if (successCount === 0) {
      throw new AppError('모든 토픽 패턴에서 MQTT 발행 실패', 500, 'MQTT_PUBLISH_FAILED');
    }

    logger.info(`🎯 MQTT 다중 토픽 발행 완료: ${successCount}/${topicPatterns.length} 성공`, {
      deviceId,
      messageType,
      successfulTopics: results.filter(r => r.success).map(r => r.topic)
    });

    return {
      success: true,
      primaryTopic: topicPatterns[0], // 첫 번째 토픽을 주 토픽으로
      allTopics: results,
      successCount: successCount,
      totalTopics: topicPatterns.length,
      timestamp: new Date().toISOString(),
      method: 'MQTT_MULTI_TOPIC'
    };
  }

  // 🆕 토픽 패턴 생성 함수 (단순화)
  generateTopicPatterns(deviceId, messageType) {
    const patterns = [];

    // 주요 토픽만 사용 (성능과 명확성을 위해)
    switch (messageType) {
      case this.MESSAGE_TYPES.TEXT_MESSAGE:
      case this.MESSAGE_TYPES.MIXED_MESSAGE:
        patterns.push(`display/${deviceId}/message`);
        break;
      case this.MESSAGE_TYPES.IMAGE_MESSAGE:
        patterns.push(`display/${deviceId}/image`);
        break;
      case this.MESSAGE_TYPES.MULTIMEDIA_MESSAGE:
        patterns.push(`display/${deviceId}/multimedia`);
        break;
      case this.MESSAGE_TYPES.DELETE_ROOM:
        patterns.push(`display/${deviceId}/delete`);
        break;
      case this.MESSAGE_TYPES.DELETE_ALL:
        patterns.push(`display/${deviceId}/clear`);
        break;
      case this.MESSAGE_TYPES.HEARTBEAT:
        patterns.push(`display/${deviceId}/heartbeat`);
        break;
      case this.MESSAGE_TYPES.CONNECT:
      case this.MESSAGE_TYPES.DISCONNECT:
        patterns.push(`display/${deviceId}/status`);
        break;
      default:
        patterns.push(`display/${deviceId}/command`);
    }

    // 단순화: 주요 토픽 하나만 사용
    return patterns;
  }

  // 🆕 토픽 패턴 테스트 함수 (디버깅용)
  async testTopicPatterns(deviceId) {
    const patterns = this.generateTopicPatterns(deviceId, 'test');

    logger.info(`🧪 토픽 패턴 테스트 시작: ${deviceId}`, {
      totalPatterns: patterns.length,
      patterns: patterns
    });

    const testPayload = {
      messageType: 'test_message',
      deviceId: deviceId,
      timestamp: new Date().toISOString(),
      content: 'MQTT 토픽 패턴 테스트',
      test: true
    };

    const results = [];

    for (const topic of patterns) {
      try {
        await publishToMqtt(topic, testPayload, { qos: 1, retain: true });
        results.push({ topic, success: true });
        logger.info(`✅ 테스트 발행 성공: ${topic}`);
      } catch (error) {
        results.push({ topic, success: false, error: error.message });
        logger.warn(`❌ 테스트 발행 실패: ${topic}`, error.message);
      }
    }

    const successCount = results.filter(r => r.success).length;

    logger.info(`🧪 토픽 패턴 테스트 완료: ${successCount}/${patterns.length} 성공`, {
      successfulTopics: results.filter(r => r.success).map(r => r.topic)
    });

    return results;
  }

  // 🔧 실제 장비 연결 테스트 메서드
  async testDeviceConnection(deviceId, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || 10000;
    const retries = options.retries || 2;
    const controllerType = options.controllerType || 'HUIDU';

    logger.info(`🔍 장비 연결 테스트 시작: ${deviceId}`, {
      controllerType,
      timeout,
      retries
    });

    // 1. MQTT 연결 상태 확인
    if (!this.mqttClient || !this.mqttClient.connected) {
      return {
        success: false,
        error: 'MQTT_DISCONNECTED',
        details: 'MQTT 브로커에 연결되지 않음',
        responseTime: Date.now() - startTime
      };
    }

    // 2. 테스트 명령 생성
    const testCommand = {
      cmd: this.PROTOCOL_COMMANDS.CONNECT,
      deviceId: deviceId,
      timestamp: new Date().toISOString(),
      testMode: true,
      controllerType: controllerType,
      requestId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const mqttTopic = this.MQTT_TOPICS.COMMAND(deviceId);
    const responseTopic = this.MQTT_TOPICS.RESPONSE(deviceId);

    // 3. 응답 대기 설정
    return new Promise((resolve) => {
      let responseReceived = false;
      let attemptCount = 0;

      const attemptConnection = async () => {
        attemptCount++;
        logger.info(`🔍 연결 테스트 시도 ${attemptCount}/${retries + 1}: ${deviceId}`);

        // 응답 리스너 설정
        const responseHandler = (topic, payload) => {
          if (responseReceived) return;

          try {
            if (topic === responseTopic && payload.requestId === testCommand.requestId) {
              responseReceived = true;
              clearTimeout(timeoutHandler);

              const responseTime = Date.now() - startTime;

              if (payload.status === 'OK' || payload.success) {
                logger.info(`✅ 장비 연결 테스트 성공: ${deviceId}`, {
                  responseTime: `${responseTime}ms`,
                  deviceInfo: payload.deviceInfo
                });

                resolve({
                  success: true,
                  deviceInfo: payload.deviceInfo || {
                    deviceId: deviceId,
                    controllerType: controllerType,
                    status: 'online'
                  },
                  responseTime: responseTime,
                  mqttTopic: mqttTopic,
                  attempt: attemptCount
                });
              } else {
                logger.warn(`❌ 장비 응답 오류: ${deviceId}`, payload);

                if (attemptCount < retries + 1) {
                  setTimeout(attemptConnection, 1000);
                } else {
                  resolve({
                    success: false,
                    error: 'DEVICE_ERROR',
                    details: payload.error || '장비에서 오류 응답',
                    responseTime: responseTime,
                    attempt: attemptCount
                  });
                }
              }
            }
          } catch (error) {
            logger.error(`응답 처리 오류: ${deviceId}`, error);
          }
        };

        // 타임아웃 설정
        const timeoutHandler = setTimeout(() => {
          if (responseReceived) return;

          logger.warn(`⏰ 장비 연결 테스트 타임아웃: ${deviceId} (시도 ${attemptCount})`);

          if (attemptCount < retries + 1) {
            setTimeout(attemptConnection, 1000);
          } else {
            responseReceived = true;
            resolve({
              success: false,
              error: 'CONNECTION_TIMEOUT',
              details: `${timeout}ms 내에 응답 없음 (${retries + 1}회 시도)`,
              responseTime: Date.now() - startTime,
              attempt: attemptCount
            });
          }
        }, timeout);

        try {
          // 응답 토픽 구독
          if (this.mqttClient) {
            this.mqttClient.on('message', responseHandler);
          }

          // 테스트 명령 전송
          const publishResult = await this.publishMqttMessage(
            deviceId,
            this.MESSAGE_TYPES.COMMAND,
            testCommand,
            { qos: 1, retain: false }
          );

          if (!publishResult.success) {
            clearTimeout(timeoutHandler);

            if (attemptCount < retries + 1) {
              setTimeout(attemptConnection, 1000);
            } else {
              responseReceived = true;
              resolve({
                success: false,
                error: 'MQTT_PUBLISH_FAIL',
                details: 'MQTT 명령 전송 실패',
                responseTime: Date.now() - startTime,
                attempt: attemptCount
              });
            }
          }

        } catch (error) {
          clearTimeout(timeoutHandler);
          logger.error(`연결 테스트 명령 전송 오류: ${deviceId}`, error);

          if (attemptCount < retries + 1) {
            setTimeout(attemptConnection, 1000);
          } else {
            responseReceived = true;
            resolve({
              success: false,
              error: 'COMMAND_SEND_FAIL',
              details: error.message,
              responseTime: Date.now() - startTime,
              attempt: attemptCount
            });
          }
        }
      };

      // 첫 번째 시도 시작
      attemptConnection();
    });
  }
}

// 싱글톤 인스턴스
const displayService = new DisplayService();

module.exports = displayService;