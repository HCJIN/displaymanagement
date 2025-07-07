// 직접 MQTT 메시지 전송 테스트 (EMQX 클라우드)
const mqtt = require('mqtt');

// EMQX 클라우드 설정 (mqtt-monitor.js와 동일)
const MQTT_CONFIG = {
  host: 'o6e6b9b6.ala.asia-southeast1.emqxsl.com',
  port: 8883,
  protocol: 'mqtts',
  username: 'admin_mvp_user',
  password: 'noa12345',
  clientId: 'direct_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  clean: true,
  keepalive: 60,
  connectTimeout: 30000,
  rejectUnauthorized: false
};

console.log('🚀 EMQX 클라우드 직접 연결 테스트');
console.log('='.repeat(60));
console.log('브로커:', `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`);
console.log('클라이언트 ID:', MQTT_CONFIG.clientId);
console.log('='.repeat(60));

// MQTT 클라이언트 연결
const client = mqtt.connect(MQTT_CONFIG);

client.on('connect', () => {
  console.log('✅ EMQX 클라우드에 연결 성공!');

  // 테스트 메시지 전송 (retain=true)
  const testMessage = {
    deviceId: "6881e6681b37",
    content: "🔴 EMQX 확인용 retain=true 테스트 메시지",
    timestamp: new Date().toISOString(),
    source: "direct-mqtt-test",
    messageId: "test_" + Date.now()
  };

  const topic = `display/6881e6681b37/message`;
  const payload = JSON.stringify(testMessage);

  console.log(`\n📤 메시지 전송 중...`);
  console.log(`📍 토픽: ${topic}`);
  console.log(`📦 QoS: 1, Retain: true`);
  console.log(`📏 크기: ${payload.length} bytes`);

  client.publish(topic, payload, {
    qos: 1,
    retain: true  // 중요: retain=true로 설정
  }, (err) => {
    if (err) {
      console.error('❌ 메시지 전송 실패:', err.message);
    } else {
      console.log('✅ 메시지 전송 성공!');
      console.log('\n🎉 EMQX 클라우드 콘솔에서 확인하세요:');
      console.log('🔗 https://cloud-intl.emqx.com/console/deployments/o6e6b9b6/retained');
      console.log('\n📋 전송된 메시지:');
      console.log(JSON.stringify(testMessage, null, 2));
    }

    // 연결 종료
    setTimeout(() => {
      client.end();
    }, 1000);
  });
});

client.on('error', (error) => {
  console.error('❌ MQTT 연결 오류:', error.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('\n👋 연결 종료됨');
  process.exit(0);
}); 