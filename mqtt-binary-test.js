// 바이너리 프로토콜 데이터 직접 전송 테스트
const mqtt = require('mqtt');
const protocolConverter = require('./backend/src/utils/protocolConverter');

// EMQX 클라우드 설정
const MQTT_CONFIG = {
  host: 'o6e6b9b6.ala.asia-southeast1.emqxsl.com',
  port: 8883,
  protocol: 'mqtts',
  username: 'admin_mvp_user',
  password: 'noa12345',
  clientId: 'binary_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  clean: true,
  keepalive: 60,
  connectTimeout: 30000,
  rejectUnauthorized: false
};

console.log('🔧 바이너리 프로토콜 메시지 직접 전송 테스트');
console.log('='.repeat(60));
console.log('브로커:', `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`);
console.log('='.repeat(60));

// MQTT 클라이언트 연결
const client = mqtt.connect(MQTT_CONFIG);

client.on('connect', () => {
  console.log('✅ EMQX 클라우드에 연결 성공!');

  try {
    // 프로토콜 변환기로 바이너리 데이터 생성
    const testData = {
      messageId: "test_" + Date.now(),
      deviceId: "6881e6681b37",
      roomNumber: 6,
      content: "바이너리 프로토콜 테스트 메시지 (EMQX 확인용)",
      imageUrl: "http://192.168.0.58:5002/api/images/test.png",
      priority: 'NORMAL',
      urgent: false,
      displayOptions: {
        displayEffect: 0x01,
        displayEffectSpeed: 4,
        displayWaitTime: 1,
        endEffect: 0x05,
        endEffectSpeed: 4,
        sirenOutput: false
      }
    };

    console.log('\n🔄 프로토콜 변환 중...');
    const binaryData = protocolConverter.convertToProtocolPacket(testData, testData.deviceId);

    console.log(`✅ 바이너리 데이터 생성 완료: ${binaryData.length} bytes`);

    // Raw bytes 출력 (처음 50바이트만)
    const previewBytes = Array.from(binaryData.slice(0, 50))
      .map(byte => `\\x${byte.toString(16).padStart(2, '0')}`)
      .join('');
    console.log(`🔧 바이너리 미리보기: '${previewBytes}...'`);

    const topic = `display/6881e6681b37/message`;

    console.log(`\n📤 바이너리 메시지 전송 중...`);
    console.log(`📍 토픽: ${topic}`);
    console.log(`📦 QoS: 1, Retain: true`);
    console.log(`📏 크기: ${binaryData.length} bytes`);

    client.publish(topic, binaryData, {
      qos: 1,
      retain: true  // retain=true로 설정
    }, (err) => {
      if (err) {
        console.error('❌ 바이너리 메시지 전송 실패:', err.message);
      } else {
        console.log('✅ 바이너리 메시지 전송 성공!');
        console.log('\n🎉 EMQX 클라우드 콘솔에서 확인하세요:');
        console.log('🔗 https://cloud-intl.emqx.com/console/deployments/o6e6b9b6/retained');
        console.log('\n📋 이제 재해문자전광판 신프로토콜 2023.3 바이너리 데이터가 저장되었습니다!');
      }

      // 연결 종료
      setTimeout(() => {
        client.end();
      }, 1000);
    });

  } catch (error) {
    console.error('❌ 프로토콜 변환 실패:', error.message);
    client.end();
  }
});

client.on('error', (error) => {
  console.error('❌ MQTT 연결 오류:', error.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('\n👋 연결 종료됨');
  process.exit(0);
}); 