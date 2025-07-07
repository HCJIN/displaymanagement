// 이전에 성공했던 디바이스 ID로 MQTT 테스트
const mqtt = require('mqtt');

// EMQX 클라우드 설정
const MQTT_CONFIG = {
  host: 'o6e6b9b6.ala.asia-southeast1.emqxsl.com',
  port: 8883,
  protocol: 'mqtts',
  username: 'admin_mvp_user',
  password: 'noa12345',
  clientId: 'working_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  clean: true,
  keepalive: 60,
  connectTimeout: 30000,
  rejectUnauthorized: false
};

console.log('🔍 성공했던 디바이스 ID로 MQTT 테스트');
console.log('='.repeat(60));
console.log('브로커:', `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`);
console.log('='.repeat(60));

// MQTT 클라이언트 연결
const client = mqtt.connect(MQTT_CONFIG);

client.on('connect', () => {
  console.log('✅ EMQX 클라우드에 연결 성공!');

  // 이전에 성공했던 디바이스 ID와 토픽으로 테스트
  const deviceId = "6881e6681b37";  // 이전 성공 디바이스
  const topic = `display/${deviceId}/message`;  // 이전 성공 토픽

  const testMessage = {
    deviceId: deviceId,
    content: "🟢 성공했던 디바이스로 재테스트 (retain=true)",
    timestamp: new Date().toISOString(),
    source: "working-device-test",
    messageId: "working_test_" + Date.now(),
    roomNumber: 6
  };

  console.log(`\n📤 성공했던 패턴으로 메시지 전송...`);
  console.log(`📍 토픽: ${topic}`);
  console.log(`🆔 디바이스: ${deviceId}`);
  console.log(`📦 QoS: 1, Retain: true`);

  client.publish(topic, JSON.stringify(testMessage), {
    qos: 1,
    retain: true
  }, (err) => {
    if (err) {
      console.error('❌ 메시지 전송 실패:', err.message);
    } else {
      console.log('✅ 메시지 전송 성공!');
      console.log('\n🎯 이제 다른 토픽들도 시도해보겠습니다...');

      // 다른 가능한 토픽 패턴들도 테스트
      const otherTopics = [
        `display/${deviceId}`,           // 단순 형태
        `${deviceId}/message`,           // display 없이
        `led/${deviceId}`,               // led 접두사
        `device/${deviceId}/cmd`,        // device/cmd 형태
        `${deviceId}`                    // 디바이스 ID만
      ];

      let topicIndex = 0;

      function sendToNextTopic() {
        if (topicIndex >= otherTopics.length) {
          console.log('\n🎉 모든 토픽 테스트 완료!');
          console.log('🔗 EMQX 콘솔에서 확인: https://cloud-intl.emqx.com/console/deployments/o6e6b9b6/retained');

          setTimeout(() => {
            client.end();
          }, 1000);
          return;
        }

        const testTopic = otherTopics[topicIndex];
        const topicMessage = {
          ...testMessage,
          messageId: `topic_test_${topicIndex}_${Date.now()}`,
          content: `🔸 토픽 테스트: ${testTopic}`,
          topicPattern: testTopic
        };

        console.log(`\n📤 추가 토픽 테스트 ${topicIndex + 1}/${otherTopics.length}:`);
        console.log(`📍 토픽: ${testTopic}`);

        client.publish(testTopic, JSON.stringify(topicMessage), {
          qos: 1,
          retain: true
        }, (err) => {
          if (err) {
            console.error(`❌ 토픽 ${testTopic} 전송 실패:`, err.message);
          } else {
            console.log(`✅ 토픽 ${testTopic} 전송 성공!`);
          }

          topicIndex++;
          setTimeout(sendToNextTopic, 500); // 0.5초 간격
        });
      }

      // 1초 후 다른 토픽들 테스트 시작
      setTimeout(sendToNextTopic, 1000);
    }
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