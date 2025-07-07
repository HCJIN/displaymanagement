// MQTT 모니터링 클라이언트
const mqtt = require('mqtt');
const protocolConverter = require('./backend/src/utils/protocolConverter');

// MQTT 브로커 설정 (환경변수 또는 기본값)
const MQTT_CONFIG = {
  host: process.env.MQTT_BROKER_HOST || 'o6e6b9b6.ala.asia-southeast1.emqxsl.com',
  port: parseInt(process.env.MQTT_BROKER_PORT || '8883'),
  protocol: 'mqtts',
  username: process.env.ADMIN_MQTT_USERNAME || 'admin_mvp_user',
  password: process.env.ADMIN_MQTT_PASSWORD || 'noa12345',
  clientId: 'monitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  clean: true,
  keepalive: 60,
  connectTimeout: 30000,
  rejectUnauthorized: false
};

console.log('🔍 MQTT 메시지 모니터링 시작');
console.log('='.repeat(60));
console.log('브로커:', `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`);
console.log('클라이언트 ID:', MQTT_CONFIG.clientId);
console.log('='.repeat(60));

// MQTT 클라이언트 연결
const client = mqtt.connect(MQTT_CONFIG);

// 모니터링할 토픽 패턴들
const topicsToMonitor = [
  'display/+/message',      // 메시지 토픽
  'display/+/image',        // 이미지 토픽
  'display/+/command',      // 명령 토픽
  'display/+/response',     // 응답 토픽
  'display/+/status',       // 상태 토픽
  'display/+/heartbeat',    // 하트비트 토픽
  '+/message',              // 단순 형태
  '+',                      // 모든 단일 레벨
  '#'                       // 모든 토픽 (와일드카드)
];

let messageCount = 0;

client.on('connect', () => {
  console.log('✅ MQTT 브로커에 연결됨');
  console.log('');

  // 모든 토픽 구독
  topicsToMonitor.forEach(topic => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ 토픽 구독 실패: ${topic}`, err.message);
      } else {
        console.log(`📡 토픽 구독 성공: ${topic}`);
      }
    });
  });

  console.log('');
  console.log('🎯 메시지 수신 대기 중...');
  console.log('Ctrl+C로 종료하세요');
  console.log('='.repeat(60));
});

client.on('message', (topic, message, packet) => {
  messageCount++;
  const timestamp = new Date().toISOString();

  console.log(`\n📨 메시지 #${messageCount} 수신 [${timestamp}]`);
  console.log(`📍 토픽: ${topic}`);
  console.log(`📦 QoS: ${packet.qos}, Retain: ${packet.retain}`);
  console.log(`📏 크기: ${message.length} bytes`);

  // 메시지 타입 감지
  let messageType = 'UNKNOWN';
  let isHexString = false;
  let isBinary = false;
  let isJson = false;

  try {
    // JSON 파싱 시도
    const jsonData = JSON.parse(message.toString());
    messageType = 'JSON';
    isJson = true;

    console.log('📋 JSON 데이터:');
    console.log(JSON.stringify(jsonData, null, 2));

  } catch (jsonError) {
    // 16진수 문자열 확인
    const messageStr = message.toString();
    if (/^[0-9A-Fa-f]+$/.test(messageStr) && messageStr.length > 10) {
      messageType = 'HEX_STRING';
      isHexString = true;

      console.log('🔢 16진수 문자열:');
      console.log(`길이: ${messageStr.length} 문자`);
      console.log(`내용: ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);

      // 16진수를 바이너리로 변환하여 프로토콜 파싱 시도
      try {
        const binaryBuffer = Buffer.from(messageStr, 'hex');
        console.log('🔧 바이너리 변환 성공:', binaryBuffer.length, 'bytes');

        // 프로토콜 파싱 시도
        const parsedResult = protocolConverter.parseProtocolPacket(binaryBuffer);
        const jsonResult = protocolConverter.convertParsedDataToJson(parsedResult);

        console.log('✅ 프로토콜 파싱 성공!');
        console.log('📋 프로토콜 정보:', jsonResult.protocol);
        console.log('📋 헤더:', jsonResult.header);
        console.log('📋 디바이스 ID:', jsonResult.device.id);

        if (jsonResult.messageInfo) {
          console.log('📨 메시지 정보:');
          console.log(`- 방번호: ${jsonResult.messageInfo.roomNumber}`);
          console.log(`- 표시효과: ${jsonResult.messageInfo.displayEffect}`);
          console.log(`- 싸이렌: ${jsonResult.messageInfo.sirenOutput}`);
          console.log(`- 메시지 타입: ${jsonResult.messageInfo.messageType}`);
          if (jsonResult.messageInfo.imageUrl) {
            console.log(`- 이미지 URL: ${jsonResult.messageInfo.imageUrl}`);
          }
        }

      } catch (protocolError) {
        console.log('❌ 프로토콜 파싱 실패:', protocolError.message);
      }

    } else {
      // 바이너리 데이터 확인
      messageType = 'BINARY';
      isBinary = true;

      // Raw bytes 형태로 깔끔하게 출력 (Python bytes 스타일)
      const rawBytes = Array.from(message)
        .map(byte => `\\x${byte.toString(16).padStart(2, '0')}`)
        .join('');

      console.log('🔧 Raw Bytes:');
      console.log(`'${rawBytes}'`);

      // 길이가 길면 잘라서 표시
      if (message.length > 100) {
        const truncated = rawBytes.substring(0, 300); // 약 100바이트 분량
        console.log('🔧 Raw Bytes (요약):');
        console.log(`'${truncated}...'`);
      }

      // 바이너리 데이터로 프로토콜 파싱 시도
      try {
        const parsedResult = protocolConverter.parseProtocolPacket(message);
        const jsonResult = protocolConverter.convertParsedDataToJson(parsedResult);

        console.log('✅ 바이너리 프로토콜 파싱 성공!');
        console.log('📋 프로토콜 정보:', jsonResult.protocol);
        console.log('📋 헤더:', jsonResult.header);
        console.log('📋 디바이스 ID:', jsonResult.device.id);

      } catch (protocolError) {
        console.log('❌ 바이너리 프로토콜 파싱 실패:', protocolError.message);
      }
    }
  }

  console.log(`🏷️  메시지 타입: ${messageType}`);
  console.log('-'.repeat(60));
});

client.on('error', (error) => {
  console.error('❌ MQTT 연결 오류:', error.message);
});

client.on('close', () => {
  console.log('🔌 MQTT 연결 종료');
});

client.on('reconnect', () => {
  console.log('🔄 MQTT 재연결 시도');
});

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n👋 모니터링 종료 중...');
  client.end();
  process.exit(0);
});

// 주기적 상태 출력
setInterval(() => {
  if (client.connected) {
    console.log(`\n💡 상태: 연결됨 | 수신 메시지: ${messageCount}개 | 시간: ${new Date().toLocaleTimeString()}`);
  }
}, 30000); // 30초마다 