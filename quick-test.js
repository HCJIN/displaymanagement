const axios = require('axios');

const BACKEND_URL = 'http://localhost:5002';
const API_URL = `${BACKEND_URL}/api`;

async function quickTest() {
  try {
    console.log('🔐 로그인 중...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123!'
    });

    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공');

    console.log('📤 MQTT 메시지 전송 중 (디바이스: 6881e6681b37)...');

    const messageData = {
      deviceId: "6881e6681b37",
      content: "🔴 EMQX 확인용 retain=true 테스트 메시지",
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
    };

    const response = await axios.post(`${API_URL}/messages/text`, messageData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ 메시지 전송 응답:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('🎉 성공! EMQX 클라우드 콘솔에서 확인하세요:');
      console.log('🔗 https://cloud-intl.emqx.com/console/deployments/o6e6b9b6/retained');
    }
  } catch (error) {
    console.error('❌ 오류:', error.response?.data || error.message);
  }
}

quickTest(); 