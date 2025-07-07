// 테스트 메시지 전송 스크립트
const axios = require('axios');

// 백엔드 서버 설정
const BACKEND_URL = 'http://localhost:5002';
const API_URL = `${BACKEND_URL}/api`;

// 테스트용 로그인 정보 (실제 사용자 정보로 변경 필요)
let authToken = null;

// 로그인 함수
async function login() {
  try {
    console.log('🔐 로그인 시도...');

    const response = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123!'  // 올바른 패스워드
    });

    if (response.data.success) {
      authToken = response.data.token;
      console.log('✅ 로그인 성공');
      return true;
    } else {
      console.error('❌ 로그인 실패:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 로그인 오류:', error.response?.data?.message || error.message);
    return false;
  }
}

// 디바이스 목록 조회
async function getDevices() {
  try {
    const response = await axios.get(`${API_URL}/devices`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('📱 사용 가능한 디바이스:');
      response.data.devices.forEach((device, index) => {
        console.log(`  ${index + 1}. ID: ${device.id}, 이름: ${device.name}, 상태: ${device.status}`);
      });
      return response.data.devices;
    }
    return [];
  } catch (error) {
    console.error('❌ 디바이스 목록 조회 실패:', error.response?.data?.message || error.message);
    return [];
  }
}

// 테스트 메시지 전송
async function sendTestMessage(deviceId, content, roomNumber = null) {
  try {
    console.log(`\n📤 테스트 메시지 전송 중...`);
    console.log(`디바이스 ID: ${deviceId}`);
    console.log(`내용: ${content}`);
    console.log(`방번호: ${roomNumber || '자동할당'}`);

    const messageData = {
      deviceId: deviceId,
      content: content,
      priority: 'NORMAL',
      urgent: false,
      roomNumber: roomNumber,
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
    };

    const response = await axios.post(`${API_URL}/messages/text`, messageData, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ 메시지 전송 성공!');
      console.log('📋 전송 결과:');
      console.log(`  - 메시지 ID: ${response.data.message?.id}`);
      console.log(`  - 방번호: ${response.data.message?.roomNumber}`);
      console.log(`  - 디바이스: ${response.data.deviceName}`);
      console.log(`  - 테스트 모드: ${response.data.isTest ? 'YES' : 'NO'}`);

      if (response.data.protocolInfo || response.data.mqtt) {
        console.log('📡 MQTT 전송 정보:');
        const mqttInfo = response.data.protocolInfo || response.data.mqtt;
        console.log(`  - 토픽: ${mqttInfo.topic || 'N/A'}`);
        console.log(`  - 프로토콜: ${mqttInfo.protocol || 'N/A'}`);
        console.log(`  - 바이너리 크기: ${mqttInfo.binarySize || 'N/A'} bytes`);
      }

      return response.data;
    } else {
      console.error('❌ 메시지 전송 실패:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 메시지 전송 오류:', error.response?.data?.message || error.message);
    return null;
  }
}

// 메인 테스트 함수
async function runTest() {
  console.log('🚀 MQTT 메시지 전송 테스트 시작');
  console.log('='.repeat(60));

  // 1. 로그인
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('로그인에 실패했습니다. 프로그램을 종료합니다.');
    return;
  }

  // 2. 디바이스 목록 조회
  const devices = await getDevices();
  if (devices.length === 0) {
    console.error('사용 가능한 디바이스가 없습니다.');
    return;
  }

  // 3. 첫 번째 디바이스로 테스트 메시지 전송
  const testDevice = devices[0];
  console.log(`\n🎯 테스트 대상 디바이스: ${testDevice.name} (${testDevice.id})`);

  // 4. 여러 테스트 메시지 전송
  const testMessages = [
    { content: '🚨 MQTT 테스트 메시지 #1', roomNumber: 1 },
    { content: '📡 재해문자전광판 프로토콜 테스트', roomNumber: 2 },
    { content: '🔧 바이너리 데이터 변환 테스트\n신프로토콜 2023.3', roomNumber: null }, // 자동할당
    { content: '⚡ 실시간 MQTT 모니터링 테스트', roomNumber: 3 }
  ];

  for (let i = 0; i < testMessages.length; i++) {
    const { content, roomNumber } = testMessages[i];

    console.log(`\n📨 테스트 메시지 ${i + 1}/${testMessages.length}`);
    console.log('-'.repeat(40));

    const result = await sendTestMessage(testDevice.id, content, roomNumber);

    if (result) {
      console.log('✅ 성공! MQTT 모니터링에서 확인하세요.');
    } else {
      console.log('❌ 실패');
    }

    // 메시지 간 간격
    if (i < testMessages.length - 1) {
      console.log('⏳ 3초 대기...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n✨ 모든 테스트 메시지 전송 완료!');
  console.log('📡 MQTT 모니터링 클라이언트에서 수신된 데이터를 확인하세요.');
  console.log('='.repeat(60));
}

// 스크립트 실행
if (require.main === module) {
  runTest().catch(error => {
    console.error('💥 테스트 실행 중 오류:', error.message);
    process.exit(1);
  });
}

module.exports = { sendTestMessage, login, getDevices }; 