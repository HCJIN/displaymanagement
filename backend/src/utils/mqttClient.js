const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// MQTT 브로커 설정 (EMQX 클라우드)
const MQTT_BROKER_HOST = process.env.MQTT_BROKER_HOST || 'o6e6b9b6.ala.asia-southeast1.emqxsl.com';
const MQTT_BROKER_PORT = parseInt(process.env.MQTT_BROKER_PORT || '8883');
const MQTT_USERNAME = process.env.ADMIN_MQTT_USERNAME || 'admin_mvp_user';
const MQTT_PASSWORD = process.env.ADMIN_MQTT_PASSWORD || 'noa12345';

// 클라이언트 ID를 고유하게 생성 (중복 연결 방지)
const MQTT_CLIENT_ID = process.env.ADMIN_MQTT_CLIENT_ID
  ? `${process.env.ADMIN_MQTT_CLIENT_ID}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  : `backend_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// MQTT 통신 설정 (안정성 강화)
const MQTT_QOS = parseInt(process.env.MQTT_QOS || '1');
const MQTT_RETAIN = process.env.MQTT_RETAIN !== 'false'; // 기본값을 true로 변경
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'display';

// 연결 안정성을 위한 조정된 타이밍 설정
const MQTT_RECONNECT_PERIOD = parseInt(process.env.MQTT_RECONNECT_PERIOD || '10000'); // 10초로 증가
const MQTT_CONNECT_TIMEOUT = parseInt(process.env.MQTT_CONNECT_TIMEOUT || '60000'); // 60초로 증가
const MQTT_KEEP_ALIVE = parseInt(process.env.MQTT_KEEP_ALIVE || '300'); // 5분으로 증가
const MQTT_PING_TIMEOUT = parseInt(process.env.MQTT_PING_TIMEOUT || '30000'); // 핑 타임아웃 추가

// TLS 설정
const MQTT_USE_TLS = process.env.MQTT_USE_TLS !== 'false';
const MQTT_REJECT_UNAUTHORIZED = process.env.MQTT_REJECT_UNAUTHORIZED === 'true';

// 디버그 설정
const DEBUG_MQTT = process.env.DEBUG_MQTT === 'true';
const DEBUG_MQTT_MESSAGES = process.env.DEBUG_MQTT_MESSAGES === 'true';

let client = null;
let isConnecting = false;
let connectionPromise = null;
let reconnectAttempts = 0;
let isShuttingDown = false;
let heartbeatInterval = null;
let connectionCheckInterval = null;
const maxReconnectAttempts = parseInt(process.env.MQTT_MAX_RECONNECT_ATTEMPTS || '5');

// 연결 통계
let connectionStats = {
  totalConnections: 0,
  totalDisconnections: 0,
  lastConnectTime: null,
  lastDisconnectTime: null,
  connectionDuration: 0
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [MQTT-${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage, data || '');
  } else if (level === 'warn') {
    console.warn(logMessage, data || '');
  } else if (level === 'debug' && DEBUG_MQTT) {
    console.log(logMessage, data || '');
  } else if (level === 'info') {
    console.log(logMessage, data || '');
  }
}

function initMqttClient() {
  if (isShuttingDown) {
    return Promise.reject(new Error('MQTT 클라이언트가 종료 중입니다'));
  }

  if (client && client.connected) {
    log('info', 'MQTT 클라이언트가 이미 연결되어 있습니다.');
    return Promise.resolve(client);
  }

  if (isConnecting && connectionPromise) {
    log('info', 'MQTT 연결이 이미 진행 중입니다.');
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = new Promise((resolve, reject) => {
    const protocol = MQTT_USE_TLS ? 'mqtts' : 'mqtt';
    const brokerUrl = `${protocol}://${MQTT_BROKER_HOST}:${MQTT_BROKER_PORT}`;

    // 연결 안정성을 위한 강화된 옵션
    const options = {
      clientId: MQTT_CLIENT_ID,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true, // Clean session으로 이전 세션 정리
      reconnectPeriod: 0, // 자동 재연결 비활성화 (수동 제어)
      keepalive: MQTT_KEEP_ALIVE,
      connectTimeout: MQTT_CONNECT_TIMEOUT,
      reschedulePings: true, // 핑 재스케줄링 활성화
      protocolVersion: 4,
      protocolId: 'MQTT',

      // Will 메시지 설정
      will: {
        topic: `${MQTT_TOPIC_PREFIX}/system/disconnect`,
        payload: JSON.stringify({
          clientId: MQTT_CLIENT_ID,
          timestamp: new Date().toISOString(),
          reason: 'unexpected_disconnect',
          stats: connectionStats
        }),
        qos: MQTT_QOS,
        retain: false
      }
    };

    // TLS 설정 강화
    if (MQTT_USE_TLS) {
      options.rejectUnauthorized = MQTT_REJECT_UNAUTHORIZED;
      options.protocol = 'mqtts';
      options.secureProtocol = 'TLSv1_2_method';

      // 개발 환경에서는 인증서 검증 완화
      if (process.env.NODE_ENV === 'development') {
        options.rejectUnauthorized = false;
        options.checkServerIdentity = () => undefined; // 서버 ID 검증 무시
      }
    }

    log('info', '🔄 MQTT 브로커 연결 시도', {
      url: brokerUrl,
      clientId: MQTT_CLIENT_ID,
      keepalive: options.keepalive,
      connectTimeout: options.connectTimeout,
      useTLS: MQTT_USE_TLS,
      attempt: reconnectAttempts + 1
    });

    // 기존 클라이언트가 있다면 정리
    if (client) {
      try {
        client.removeAllListeners();
        client.end(true);
      } catch (e) {
        log('warn', '기존 클라이언트 정리 중 오류', e.message);
      }
      client = null;
    }

    client = mqtt.connect(brokerUrl, options);

    const connectTimeout = setTimeout(() => {
      if (!client || !client.connected) {
        log('error', '❌ MQTT 연결 타임아웃');
        isConnecting = false;
        connectionPromise = null;
        if (client) {
          client.end(true);
          client = null;
        }
        reject(new Error(`MQTT 연결 타임아웃 (${MQTT_CONNECT_TIMEOUT}ms)`));
      }
    }, MQTT_CONNECT_TIMEOUT);

    client.on('connect', (connack) => {
      clearTimeout(connectTimeout);
      isConnecting = false;
      connectionPromise = null;
      reconnectAttempts = 0;

      // 연결 통계 업데이트
      connectionStats.totalConnections++;
      connectionStats.lastConnectTime = new Date().toISOString();

      log('info', '✅ MQTT 브로커 연결 성공', {
        clientId: MQTT_CLIENT_ID,
        sessionPresent: connack.sessionPresent,
        returnCode: connack.returnCode,
        attempt: connectionStats.totalConnections
      });

      // 하트비트 시작
      startHeartbeat();

      // 연결 성공 알림 (간소화)
      const connectPayload = {
        clientId: MQTT_CLIENT_ID,
        timestamp: new Date().toISOString(),
        status: 'connected',
        stats: connectionStats
      };

      // 비동기로 알림 발송 (연결 성공을 지연시키지 않음)
      setTimeout(() => {
        if (client && client.connected) {
          client.publish(
            `${MQTT_TOPIC_PREFIX}/system/connect`,
            JSON.stringify(connectPayload),
            { qos: 0, retain: false }, // QoS 0으로 빠른 전송
            (err) => {
              if (err) {
                log('warn', '시스템 연결 알림 발송 실패', err.message);
              } else {
                log('debug', '시스템 연결 알림 발송 성공');
              }
            }
          );
        }
      }, 100);

      resolve(client);
    });

    client.on('error', (err) => {
      clearTimeout(connectTimeout);
      isConnecting = false;
      connectionPromise = null;

      log('error', '❌ MQTT 연결 오류', {
        message: err.message,
        code: err.code,
        attempt: reconnectAttempts + 1
      });

      // 클라이언트 정리
      if (client) {
        client.removeAllListeners();
        client.end(true);
        client = null;
      }

      reject(err);
    });

    client.on('close', () => {
      connectionStats.totalDisconnections++;
      connectionStats.lastDisconnectTime = new Date().toISOString();

      if (connectionStats.lastConnectTime) {
        const connectTime = new Date(connectionStats.lastConnectTime);
        const disconnectTime = new Date();
        connectionStats.connectionDuration = disconnectTime - connectTime;
      }

      log('info', '🔌 MQTT 연결 종료', {
        duration: connectionStats.connectionDuration,
        totalDisconnections: connectionStats.totalDisconnections
      });

      stopHeartbeat();
      isConnecting = false;
      connectionPromise = null;

      // 의도적인 종료가 아니라면 재연결 시도
      if (!isShuttingDown && reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      }
    });

    client.on('offline', () => {
      log('warn', '⚠️ MQTT 클라이언트 오프라인');
      stopHeartbeat();
    });

    client.on('disconnect', (packet) => {
      log('info', '📡 MQTT 서버에서 연결 해제', {
        reasonCode: packet.reasonCode,
        properties: packet.properties
      });
    });

    // 메시지 수신 핸들러 (간소화)
    client.on('message', (topic, message, packet) => {
      if (DEBUG_MQTT_MESSAGES) {
        log('debug', '📨 MQTT 메시지 수신', {
          topic,
          messageLength: message.length,
          qos: packet.qos
        });
      }
    });

    // 핑 응답 모니터링
    client.on('pingresp', () => {
      log('debug', '🏓 MQTT Ping 응답 수신');
    });
  });

  return connectionPromise;
}

// 하트비트 관리
function startHeartbeat() {
  stopHeartbeat(); // 기존 하트비트 정리

  const interval = parseInt(process.env.HEARTBEAT_INTERVAL || '60000');

  heartbeatInterval = setInterval(() => {
    if (client && client.connected) {
      const heartbeatPayload = {
        clientId: MQTT_CLIENT_ID,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stats: connectionStats
      };

      client.publish(
        `${MQTT_TOPIC_PREFIX}/system/heartbeat`,
        JSON.stringify(heartbeatPayload),
        { qos: 0, retain: false },
        (err) => {
          if (err) {
            log('warn', '하트비트 발송 실패', err.message);
          } else {
            log('debug', '💓 하트비트 발송 성공');
          }
        }
      );
    }
  }, interval);

  log('debug', `💓 하트비트 시작 (${interval}ms 간격)`);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log('debug', '💓 하트비트 중지');
  }
}

// 재연결 스케줄링
function scheduleReconnect() {
  if (isShuttingDown) return;

  reconnectAttempts++;
  const delay = Math.min(MQTT_RECONNECT_PERIOD * Math.pow(2, reconnectAttempts - 1), 30000); // 백오프, 최대 30초

  log('info', `🔄 ${delay}ms 후 재연결 시도 (${reconnectAttempts}/${maxReconnectAttempts})`);

  setTimeout(async () => {
    if (isShuttingDown) return;

    try {
      await initMqttClient();
      log('info', '✅ 재연결 성공');
    } catch (error) {
      log('error', '❌ 재연결 실패', error.message);

      if (reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      } else {
        log('error', '최대 재연결 시도 횟수 초과 - 재연결 중단');
      }
    }
  }, delay);
}

// 발행 함수 (안정성 강화)
function publishToMqtt(topic, payload, options = {}) {
  return new Promise(async (resolve, reject) => {
    if (isShuttingDown) {
      reject(new Error('MQTT 클라이언트가 종료 중입니다'));
      return;
    }

    try {
      // 클라이언트 연결 확인 및 초기화
      if (!client || !client.connected) {
        log('info', '🔄 MQTT 클라이언트 재초기화 중...');
        await initMqttClient();
      }

      if (!client || !client.connected) {
        throw new Error('MQTT 클라이언트 연결 실패');
      }

      const publishOptions = {
        qos: options.qos || MQTT_QOS,
        retain: true  // 강제로 true 설정 (EMQX 콘솔에서 확인하기 위해)
      };

      const fullTopic = topic.startsWith(MQTT_TOPIC_PREFIX)
        ? topic
        : `${MQTT_TOPIC_PREFIX}/${topic}`;

      // 🔧 Buffer 객체는 바이너리로, 나머지는 문자열로 처리
      let payloadToSend;
      if (Buffer.isBuffer(payload)) {
        payloadToSend = payload; // Buffer는 그대로 전송
        if (DEBUG_MQTT) {
          log('debug', '📦 Buffer 바이너리 데이터 전송', {
            topic: fullTopic,
            bufferLength: payload.length,
            hexPreview: payload.toString('hex').substring(0, 50) + (payload.length > 25 ? '...' : '')
          });
        }
      } else if (typeof payload === 'string') {
        payloadToSend = payload;
      } else {
        payloadToSend = JSON.stringify(payload);
      }

      // 타임아웃 설정
      const publishTimeout = setTimeout(() => {
        reject(new Error('MQTT 발행 타임아웃'));
      }, parseInt(process.env.MQTT_PUBLISH_TIMEOUT || '10000'));

      client.publish(fullTopic, payloadToSend, publishOptions, (err) => {
        clearTimeout(publishTimeout);

        if (err) {
          log('error', '❌ MQTT 발행 실패', {
            topic: fullTopic,
            error: err.message
          });
          reject(err);
        } else {
          if (DEBUG_MQTT) {
            log('info', '✅ MQTT 발행 성공', {
              topic: fullTopic,
              qos: publishOptions.qos,
              retain: publishOptions.retain
            });
          }
          resolve(true);
        }
      });
    } catch (error) {
      log('error', '❌ MQTT 발행 준비 실패', error.message);
      reject(error);
    }
  });
}

// 구독 함수 (개선)
function subscribeToMqtt(topic, callback, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!client || !client.connected) {
        await initMqttClient();
      }

      const subscribeOptions = { qos: options.qos || MQTT_QOS };
      const fullTopic = topic.startsWith(MQTT_TOPIC_PREFIX)
        ? topic
        : `${MQTT_TOPIC_PREFIX}/${topic}`;

      client.subscribe(fullTopic, subscribeOptions, (err) => {
        if (err) {
          log('error', '❌ MQTT 구독 실패', { topic: fullTopic, error: err.message });
          reject(err);
        } else {
          log('info', '✅ MQTT 구독 성공', { topic: fullTopic });

          const messageHandler = (receivedTopic, message, packet) => {
            if (receivedTopic === fullTopic ||
              (options.wildcardMatch && receivedTopic.match(new RegExp(fullTopic.replace(/\+/g, '[^/]+').replace(/#/, '.*'))))) {

              try {
                let payload;
                try {
                  payload = JSON.parse(message.toString());
                } catch {
                  payload = message.toString();
                }
                callback(receivedTopic, payload, packet);
              } catch (callbackErr) {
                log('error', '메시지 처리 오류', callbackErr.message);
              }
            }
          };

          client.on('message', messageHandler);
          resolve({ topic: fullTopic, unsubscribe: () => client.unsubscribe(fullTopic) });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 연결 상태 확인
function isConnected() {
  return client && client.connected && !isShuttingDown;
}

// 안전한 종료
function disconnect() {
  return new Promise((resolve) => {
    isShuttingDown = true;
    stopHeartbeat();

    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
      connectionCheckInterval = null;
    }

    if (client) {
      log('info', '🔌 MQTT 안전 종료 중...');

      const disconnectPayload = {
        clientId: MQTT_CLIENT_ID,
        timestamp: new Date().toISOString(),
        reason: 'graceful_shutdown',
        stats: connectionStats
      };

      client.publish(
        `${MQTT_TOPIC_PREFIX}/system/disconnect`,
        JSON.stringify(disconnectPayload),
        { qos: 0 },
        () => {
          client.end(false, {}, () => {
            log('info', '✅ MQTT 안전 종료 완료');
            client = null;
            resolve();
          });
        }
      );
    } else {
      resolve();
    }
  });
}

// 연결 상태 모니터링 (개선)
function startConnectionMonitoring() {
  const interval = parseInt(process.env.CONNECTION_CHECK_INTERVAL || '60000'); // 1분으로 증가

  log('info', `🔍 MQTT 연결 모니터링 시작 (${interval}ms 간격)`);

  connectionCheckInterval = setInterval(() => {
    if (isShuttingDown) return;

    if (!isConnected()) {
      log('warn', '⚠️ MQTT 연결 상태 확인 - 재연결 필요');
      if (reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      }
    } else {
      log('debug', '✅ MQTT 연결 상태 정상');
    }
  }, interval);

  // 프로세스 종료 시 안전 종료
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('uncaughtException', (err) => {
    log('error', '예상치 못한 오류', err.message);
    gracefulShutdown();
  });

  return connectionCheckInterval;
}

function gracefulShutdown() {
  log('info', '🛑 애플리케이션 종료 신호 수신');
  disconnect().then(() => {
    process.exit(0);
  });
}

// 연결 상태 및 통계
function getConnectionStatus() {
  return {
    connected: isConnected(),
    connecting: isConnecting,
    shuttingDown: isShuttingDown,
    brokerHost: MQTT_BROKER_HOST,
    brokerPort: MQTT_BROKER_PORT,
    clientId: MQTT_CLIENT_ID,
    reconnectAttempts: reconnectAttempts,
    maxReconnectAttempts: maxReconnectAttempts,
    stats: connectionStats
  };
}

module.exports = {
  initMqttClient,
  publishToMqtt,
  subscribeToMqtt,
  isConnected,
  disconnect,
  startConnectionMonitoring,
  getConnectionStatus,

  // 디버그 및 테스트
  testConnection: async () => {
    try {
      await initMqttClient();
      return { success: true, status: getConnectionStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};