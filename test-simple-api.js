const http = require('http');

const postData = JSON.stringify({
  deviceId: "6881e6681b37",
  content: "🔴 retain=true 테스트 메시지 (EMQX 확인용)",
  priority: 'NORMAL',
  urgent: false,
  roomNumber: 6,
  displayOptions: {
    displayEffect: 0x01,
    displayEffectSpeed: 4,
    displayWaitTime: 1,
    endEffect: 0x05,
    endEffectSpeed: 4,
    sirenOutput: false,
    fontSize: 24,
    color: '#FFFFFF',
    backgroundColor: '#000000'
  },
  schedule: {
    duration: 30,
    repeatCount: 1
  }
});

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/messages/text',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📤 메시지 전송 시도...');

const req = http.request(options, (res) => {
  console.log(`✅ 응답 상태: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📨 응답 데이터:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});

req.write(postData);
req.end(); 