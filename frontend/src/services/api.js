// src/services/api.js - 실제 백엔드 메시지 전송 활성화 + TCP/IP 통신
import axios from 'axios';

// API 기본 URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// 🆕 실제 백엔드 메시지 전송 활성화
const USE_REAL_BACKEND_FOR_MESSAGES = true; // 실제 백엔드 사용
const BACKEND_IP = process.env.REACT_APP_BACKEND_HOST || '192.168.0.58';
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || '5002';

// 🔧 토큰 만료 시 자동 로그아웃 처리
const handleTokenExpiration = (error) => {
  if (error.response && error.response.status === 401) {
    console.log('🔐 토큰 만료 감지, 자동 로그아웃 처리');
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    // 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return true;
  }
  return false;
};

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Mock 상태 관리 (디바이스별 독립 메모리 저장)
let mockState = {
  messages: [],
  users: [],
  devices: [],
  initialized: false
};

// ✅ Mock 상태 초기화 (디바이스별 완전 독립)
const initializeMockState = () => {
  if (!mockState.initialized) {
    console.log('🔧 Mock 상태 초기화 시작 (디바이스별 완전 독립)');

    // 🔧 초기 메시지 데이터 - 각 디바이스별로 독립적인 방번호 할당
    mockState.messages = [
      {
        id: 'device1-room6-initial',
        deviceId: 'mock-device-1',
        deviceName: '테스트 전광판 1',
        content: '디바이스 1 - 방번호 6번 초기 메시지',
        status: 'sent',
        priority: 'NORMAL',
        urgent: false,
        roomNumber: 6, // 디바이스1의 독립적인 6번 방
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        createdBy: 'system'
      },
      {
        id: 'device2-room6-initial',
        deviceId: 'mock-device-2',
        deviceName: '테스트 전광판 2',
        content: '디바이스 2 - 방번호 6번 초기 메시지',
        status: 'sent',
        priority: 'NORMAL',
        urgent: false,
        roomNumber: 6, // 디바이스2의 독립적인 6번 방
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        createdBy: 'system'
      }
    ];

    mockState.users = createMockData.users();
    mockState.devices = createMockData.devices();
    mockState.initialized = true;

    console.log('🔧 Mock 상태 초기화 완료 (디바이스별 독립):', {
      메시지수: mockState.messages.length,
      사용자수: mockState.users.length,
      디바이스수: mockState.devices.length,
      디바이스별방번호현황: mockState.messages.reduce((acc, msg) => {
        const key = `${msg.deviceId}:${msg.roomNumber}`;
        acc[key] = msg.content.substring(0, 30);
        return acc;
      }, {})
    });
  }
};

// ✅ Mock 데이터 생성 함수들 (디바이스별 독립)
const createMockData = {
  // ✅ Mock 사용자 데이터 (백엔드 구조에 맞게 수정)
  users: () => [
    {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      active: true, // ✅ active 필드 사용
      createdAt: '2025-01-01T00:00:00Z',
      profile: {
        firstName: '관리자',
        lastName: '시스템',
        department: 'IT',
        phone: '010-0000-0000'
      },
      settings: {
        theme: 'light',
        language: 'ko',
        notifications: true,
        autoLogout: 30,
        refreshInterval: 30
      }
    },
    {
      id: 2,
      username: 'operator1',
      email: 'operator1@test.com',
      role: 'operator',
      active: true,
      createdAt: '2025-01-02T00:00:00Z',
      profile: {
        firstName: '운영자',
        lastName: '1',
        department: '운영팀',
        phone: '010-1111-1111'
      },
      settings: {
        theme: 'dark',
        language: 'ko',
        notifications: false,
        autoLogout: 60,
        refreshInterval: 20
      }
    },
    {
      id: 3,
      username: 'viewer1',
      email: 'viewer1@test.com',
      role: 'viewer',
      active: true,
      createdAt: '2025-01-03T00:00:00Z',
      profile: {
        firstName: '관람자',
        lastName: '1',
        department: '모니터링팀',
        phone: '010-2222-2222'
      },
      settings: {
        theme: 'auto',
        language: 'en',
        notifications: true,
        autoLogout: 15,
        refreshInterval: 60
      }
    }
  ],

  // Mock 디바이스 데이터 (테스트 디바이스 3개)
  devices: () => [
    {
      id: 'mock-device-1',
      name: '테스트 전광판 1',
      ip: '127.0.0.1',
      port: 5002,
      status: 'offline', // ✅ 기본적으로 오프라인으로 시작
      isTest: true,
      location: { address: '서울시 강남구 테헤란로 123', building: '테스트 빌딩', floor: '1층' },
      specs: {
        model: 'TEST-LED-001',
        resolution: { width: 1920, height: 1080 },
        size: '55인치',
        maxBrightness: 100
      },
      config: {
        brightness: { current: 10 },
        schedule: {
          onTime: '06:00',
          offTime: '23:00',
          enabled: true
        }
      },
      connectionInfo: {
        connected: false, // ✅ 오프라인 상태
        lastHeartbeat: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5분 전
        lastError: null
      }
    },
    {
      id: 'mock-device-2',
      name: '테스트 전광판 2',
      ip: '127.0.0.2',
      port: 5003,
      status: 'offline', // ✅ 기본적으로 오프라인으로 시작
      isTest: true,
      location: { address: '서울시 서초구 서초대로 456', building: '테스트 빌딩', floor: '2층' },
      specs: {
        model: 'TEST-LED-002',
        resolution: { width: 1920, height: 1080 },
        size: '43인치',
        maxBrightness: 80
      },
      config: {
        brightness: { current: 8 },
        schedule: {
          onTime: '07:00',
          offTime: '22:00',
          enabled: true
        }
      },
      connectionInfo: {
        connected: false, // ✅ 오프라인 상태
        lastHeartbeat: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10분 전
        lastError: 'Connection timeout'
      }
    }
  ],

  // 🔧 방번호 정보 조회 - 완전한 디바이스별 독립
  roomInfo: (deviceId) => {
    initializeMockState();

    console.log('🔧 방번호 정보 조회 시작 (디바이스별 독립):', {
      deviceId,
      전체메시지수: mockState.messages.length
    });

    // 🔧 핵심: 해당 디바이스의 메시지만 필터링
    const deviceMessages = mockState.messages.filter(msg =>
      msg.deviceId === deviceId &&
      msg.roomNumber != null &&
      ['pending', 'sending', 'sent', 'active'].includes(msg.status)
    );

    console.log('🔧 디바이스별 메시지 필터링 결과:', {
      deviceId,
      전체메시지: mockState.messages.length,
      해당디바이스메시지: deviceMessages.length,
      메시지상세: deviceMessages.map(m => ({
        id: m.id,
        roomNumber: m.roomNumber,
        content: m.content.substring(0, 20),
        createdAt: m.createdAt
      }))
    });

    // 🔧 Set과 Map을 사용한 강력한 중복 제거 (디바이스별)
    const roomNumbersSet = new Set();
    const roomMessagesMap = new Map();

    // 최신순으로 정렬 후 처리
    deviceMessages
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(msg => {
        const roomNum = parseInt(msg.roomNumber);
        if (!isNaN(roomNum) && roomNum >= 1 && roomNum <= 100) {
          // Set에 추가 (자동 중복 제거)
          roomNumbersSet.add(roomNum);

          // 각 방번호별로 최신 메시지만 유지
          if (!roomMessagesMap.has(roomNum)) {
            roomMessagesMap.set(roomNum, [msg]);
          }
        }
      });

    // Set을 배열로 변환하고 정렬
    const usedRooms = Array.from(roomNumbersSet).sort((a, b) => a - b);

    // Map을 객체로 변환
    const roomMessages = {};
    roomMessagesMap.forEach((messages, roomNum) => {
      roomMessages[roomNum] = messages;
    });

    console.log('🔧 최종 방번호 현황 (디바이스별 독립 완료):', {
      deviceId,
      usedRooms,
      roomCount: usedRooms.length,
      roomMessages: Object.keys(roomMessages).reduce((acc, room) => {
        acc[room] = roomMessages[room].length;
        return acc;
      }, {})
    });

    return {
      success: true,
      usedRooms: usedRooms, // 해당 디바이스에서만 사용 중인 방번호
      roomMessages: roomMessages,
      availableRooms: {
        urgent: [1, 2, 3, 4, 5].filter(num => !usedRooms.includes(num)),
        normal: Array.from({ length: 95 }, (_, i) => i + 6).filter(num => !usedRooms.includes(num))
      }
    };
  },

  // 🔧 새 메시지 추가 함수 (디바이스별 독립 덮어쓰기)
  addMessage: (messageData) => {
    initializeMockState();

    const roomNumber = parseInt(messageData.roomNumber);

    console.log('🔧 메시지 추가 시작 (디바이스별 독립):', {
      deviceId: messageData.deviceId,
      roomNumber: roomNumber,
      content: messageData.content?.substring(0, 30),
      기존메시지수: mockState.messages.length
    });

    // 🔧 해당 디바이스의 기존 방번호 메시지만 삭제 (디바이스별 독립)
    if (roomNumber && !isNaN(roomNumber)) {
      const deleteBefore = mockState.messages.length;

      // 🔧 정확한 매칭: 같은 디바이스 + 같은 방번호
      mockState.messages = mockState.messages.filter(msg =>
        !(msg.deviceId === messageData.deviceId && parseInt(msg.roomNumber) === roomNumber)
      );

      const deletedCount = deleteBefore - mockState.messages.length;
      console.log('🔧 기존 메시지 삭제 (디바이스별 독립):', {
        deviceId: messageData.deviceId,
        roomNumber,
        삭제된수: deletedCount,
        남은메시지수: mockState.messages.length
      });
    }

    // 🔧 방번호 자동 할당 (디바이스별 독립)
    let finalRoomNumber = roomNumber;
    if (!finalRoomNumber) {
      const roomInfo = createMockData.roomInfo(messageData.deviceId);
      const usedRooms = roomInfo.usedRooms; // 해당 디바이스에서만 사용 중인 방번호

      if (messageData.urgent) {
        // 긴급 메시지: 해당 디바이스의 1-5번 방 중 빈 방 찾기
        for (let i = 1; i <= 5; i++) {
          if (!usedRooms.includes(i)) {
            finalRoomNumber = i;
            break;
          }
        }
        if (!finalRoomNumber) finalRoomNumber = 1; // 모두 사용중이면 1번 덮어쓰기
      } else {
        // 일반 메시지: 해당 디바이스의 6-100번 방 중 빈 방 찾기
        for (let i = 6; i <= 100; i++) {
          if (!usedRooms.includes(i)) {
            finalRoomNumber = i;
            break;
          }
        }
        if (!finalRoomNumber) finalRoomNumber = 6; // 모두 사용중이면 6번 덮어쓰기
      }

      console.log('🔧 자동 방번호 할당 (디바이스별 독립):', {
        deviceId: messageData.deviceId,
        urgent: messageData.urgent,
        해당디바이스사용중인방: usedRooms,
        할당된방번호: finalRoomNumber
      });
    }

    // 새 메시지 생성
    const newMessage = {
      id: `msg-${messageData.deviceId}-${finalRoomNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceId: messageData.deviceId,
      deviceName: mockState.devices.find(d => d.id === messageData.deviceId)?.name || '알 수 없는 디바이스',
      content: messageData.content || '테스트 메시지',
      status: 'sent',
      priority: messageData.priority || 'NORMAL',
      urgent: messageData.urgent || false,
      roomNumber: finalRoomNumber,
      createdAt: new Date().toISOString(),
      createdBy: 'user'
    };

    mockState.messages.push(newMessage);

    // 🔧 추가 후 중복 검증 (해당 디바이스만)
    const deviceMessages = mockState.messages.filter(m =>
      m.deviceId === messageData.deviceId && m.roomNumber != null
    );
    const roomCounts = {};
    deviceMessages.forEach(msg => {
      const room = parseInt(msg.roomNumber);
      roomCounts[room] = (roomCounts[room] || 0) + 1;
    });

    console.log('🔧 새 메시지 추가 완료 (디바이스별 독립):', {
      messageId: newMessage.id,
      deviceId: messageData.deviceId,
      roomNumber: newMessage.roomNumber,
      총메시지수: mockState.messages.length,
      해당디바이스방별메시지수: roomCounts
    });

    // 🔧 중복이 발견되면 경고 (같은 디바이스 내에서만)
    Object.keys(roomCounts).forEach(room => {
      if (roomCounts[room] > 1) {
        console.warn(`⚠️ 디바이스 ${messageData.deviceId} 방번호 ${room}에 ${roomCounts[room]}개 메시지 발견! 중복 제거 필요`);
      }
    });

    return newMessage;
  },

  // 🔧 방번호 삭제 함수 (디바이스별 독립)
  deleteRoom: (deviceId, roomNumber) => {
    initializeMockState();
    const roomNum = parseInt(roomNumber);

    console.log('🔧 방번호 삭제 요청 (디바이스별 독립):', {
      deviceId,
      roomNumber: roomNum,
      삭제전메시지수: mockState.messages.length
    });

    // 🔧 해당 디바이스의 해당 방번호 메시지만 찾기
    const deletedMessages = mockState.messages.filter(msg =>
      msg.deviceId === deviceId && parseInt(msg.roomNumber) === roomNum
    );

    // 🔧 해당 디바이스의 해당 방번호 메시지만 삭제
    mockState.messages = mockState.messages.filter(msg =>
      !(msg.deviceId === deviceId && parseInt(msg.roomNumber) === roomNum)
    );

    // 🔧 삭제 후 해당 디바이스의 방번호 현황 확인
    const remainingDeviceMessages = mockState.messages.filter(m =>
      m.deviceId === deviceId && m.roomNumber != null
    );
    const remainingRooms = [...new Set(remainingDeviceMessages
      .map(m => parseInt(m.roomNumber))
      .filter(r => !isNaN(r))
    )].sort((a, b) => a - b);

    console.log('🔧 방번호 삭제 완료 (디바이스별 독립):', {
      deviceId,
      roomNumber: roomNum,
      삭제된메시지수: deletedMessages.length,
      삭제후전체메시지수: mockState.messages.length,
      해당디바이스남은방번호: remainingRooms
    });

    return deletedMessages.length;
  },

  // 🆕 개별 메시지 삭제 함수
  deleteMessage: (messageId) => {
    initializeMockState();

    console.log('🔧 개별 메시지 삭제 요청:', messageId);

    const messageToDelete = mockState.messages.find(msg => msg.id === messageId);
    if (!messageToDelete) {
      console.warn('삭제할 메시지를 찾을 수 없음:', messageId);
      return false;
    }

    // 메시지 삭제
    mockState.messages = mockState.messages.filter(msg => msg.id !== messageId);

    console.log('🔧 개별 메시지 삭제 완료:', {
      messageId,
      deletedMessage: {
        deviceId: messageToDelete.deviceId,
        roomNumber: messageToDelete.roomNumber,
        content: messageToDelete.content?.substring(0, 30)
      },
      남은메시지수: mockState.messages.length
    });

    return true;
  },

  // 🔧 Mock 상태 정리 함수 (디바이스별 강화된 중복 제거)
  cleanupMockState: () => {
    initializeMockState();

    console.log('🔧 Mock 상태 정리 시작 (디바이스별 독립):', {
      정리전메시지수: mockState.messages.length
    });

    // 🔧 디바이스별로 Map을 사용한 강력한 중복 제거
    const deviceMessageMap = new Map();

    // 최신순으로 정렬
    const sortedMessages = [...mockState.messages].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    sortedMessages.forEach(msg => {
      // 🔧 디바이스 + 방번호 조합으로 키 생성 (완전한 독립성 보장)
      const key = `${msg.deviceId}-${msg.roomNumber}`;

      // Map에는 각 키별로 하나의 값만 저장됨 (자동 중복 제거)
      if (!deviceMessageMap.has(key)) {
        deviceMessageMap.set(key, msg);
      }
    });

    // Map의 값들만 추출하여 새 배열 생성
    const cleanedMessages = Array.from(deviceMessageMap.values());

    const removedCount = mockState.messages.length - cleanedMessages.length;
    mockState.messages = cleanedMessages;

    // 🔧 디바이스별 방번호 현황 출력
    const deviceRoomStatus = {};
    cleanedMessages.forEach(m => {
      if (!deviceRoomStatus[m.deviceId]) {
        deviceRoomStatus[m.deviceId] = [];
      }
      if (m.roomNumber != null) {
        deviceRoomStatus[m.deviceId].push(m.roomNumber);
      }
    });

    // 각 디바이스별로 방번호 정렬 및 중복 제거
    Object.keys(deviceRoomStatus).forEach(deviceId => {
      deviceRoomStatus[deviceId] = [...new Set(deviceRoomStatus[deviceId])].sort((a, b) => a - b);
    });

    console.log('🔧 Mock 상태 정리 완료 (디바이스별 독립):', {
      제거된중복메시지: removedCount,
      남은메시지수: cleanedMessages.length,
      디바이스별방번호현황: deviceRoomStatus
    });

    return removedCount;
  }
};

// ✅ Mock 응답 생성 함수 (디바이스별 독립 지원 + 완전한 인증 + 이미지 변환)
const getMockResponse = (config) => {
  const url = config.url;
  const method = config.method?.toUpperCase();
  console.warn('🚧 Mock API 응답 (이미지 변환 및 TCP/IP 통신 지원):', method, url);

  // 🆕 텍스트를 이미지로 변환하여 전송하는 Mock 응답 (핵심 기능!)
  if (url.includes('/messages/text') && method === 'POST') {
    return new Promise(async (resolve) => {
      try {
        const messageData = JSON.parse(config.data);

        console.log('🔧 텍스트→이미지 변환 및 실제 백엔드 전송 시작:', {
          deviceId: messageData.deviceId,
          content: messageData.content?.substring(0, 50),
          tcpTarget: messageData.tcpTarget
        });

        // 1. 선택된 디바이스 정보 조회
        initializeMockState();
        const device = mockState.devices.find(d => d.id === messageData.deviceId);
        if (!device) {
          resolve({
            data: {
              success: false,
              message: '디바이스를 찾을 수 없습니다.'
            },
            status: 404,
            config
          });
          return;
        }

        // 2. 텍스트를 이미지로 변환 (미리보기와 동일한 로직)
        const deviceResolution = messageData.conversionInfo?.deviceResolution || device.specs?.resolution || { width: 1920, height: 1080 };

        // Canvas 생성 및 이미지 변환
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = deviceResolution.width;
        canvas.height = deviceResolution.height;

        ctx.fillStyle = messageData.displayOptions?.backgroundColor || '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const lines = messageData.content.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 0) {
          const maxLines = lines.length;

          // 🔧 미리보기와 정확히 동일한 폰트 크기 계산
          const userFontSize = messageData.displayOptions?.fontSize || 16;

          // 미리보기 크기 설정 (미리보기와 동일한 로직)
          const aspectRatio = canvas.width / canvas.height;
          let displayWidth, displayHeight;
          if (aspectRatio > 3) {
            displayWidth = 720;
            displayHeight = 240;
          } else if (aspectRatio > 2) {
            displayWidth = 600;
            displayHeight = 300;
          } else if (aspectRatio > 1.5) {
            displayWidth = 560;
            displayHeight = 315;
          } else {
            displayWidth = 400;
            displayHeight = 400;
          }

          // 미리보기와 동일한 스케일 계산
          const baseScale = Math.min(displayWidth / canvas.width, displayHeight / canvas.height);
          let fontSize = userFontSize * baseScale;

          // 🔧 폰트 크기 변화가 잘 보이도록 제한 완화
          const maxByHeight = displayHeight / maxLines * 0.8; // 0.6 → 0.8로 증가
          const longestLine = lines.reduce((max, line) => line.length > max.length ? line : max, '');
          const maxByWidth = longestLine.length > 0 ? displayWidth / longestLine.length * 1.2 : fontSize; // 0.8 → 1.2로 증가

          // 🔧 폰트 크기 변화가 더 잘 보이도록 제한 로직 수정
          const minUserSize = userFontSize * baseScale * 0.3; // 사용자 크기의 최소 30%는 보장
          const maxSize = Math.max(maxByHeight, maxByWidth, minUserSize); // 가장 큰 값을 기준으로

          fontSize = Math.min(fontSize, maxSize);
          fontSize = Math.max(fontSize, 12); // 미리보기와 동일한 최소값

          // 🔧 실제 전광판 해상도에 맞게 최종 스케일링
          const finalScale = Math.min(canvas.width / displayWidth, canvas.height / displayHeight);
          fontSize = fontSize * finalScale;

          console.log('🔧 실제 이미지 폰트 크기:', {
            userFontSize,
            canvasSize: `${canvas.width}x${canvas.height}`,
            aspectRatio,
            previewSize: `${displayWidth}x${displayHeight}`,
            baseScale,
            beforeLimits: userFontSize * baseScale,
            afterLimits: Math.min(userFontSize * baseScale, maxByHeight, maxByWidth),
            finalScale,
            finalFontSize: fontSize
          });

          ctx.font = `bold ${fontSize}px "Malgun Gothic", "맑은 고딕", Arial, sans-serif`;
          ctx.fillStyle = messageData.displayOptions?.color || '#FFFFFF';
          ctx.textAlign = messageData.displayOptions?.position === 'left' ? 'start' :
            messageData.displayOptions?.position === 'right' ? 'end' : 'center';
          ctx.textBaseline = 'middle';

          let x;
          const margin = Math.max(canvas.width * 0.05, 20); // 미리보기와 동일한 여백
          if (messageData.displayOptions?.position === 'left') {
            x = margin;
          } else if (messageData.displayOptions?.position === 'right') {
            x = canvas.width - margin;
          } else {
            x = canvas.width / 2;
          }

          // 🔧 미리보기와 동일한 줄 간격
          const lineHeight = fontSize * 1.0; // 미리보기와 동일
          const totalTextHeight = lines.length * lineHeight;
          const startY = (canvas.height - totalTextHeight) / 2 + lineHeight / 2;

          lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);

            // 🔧 텍스트 외곽선 효과로 가독성 향상 (어두운 배경일 때)
            if (messageData.displayOptions?.backgroundColor === '#000000' && messageData.displayOptions?.color === '#FFFFFF') {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
              ctx.lineWidth = Math.max(fontSize * 0.02, 1);
              ctx.strokeText(line, x, y);
            }

            // 🔧 메인 텍스트 렌더링 (꽉 찬 크기)
            ctx.fillStyle = messageData.displayOptions?.color || '#FFFFFF';
            ctx.fillText(line, x, y);
          });
        }

        const base64Image = canvas.toDataURL('image/png', 1.0).split(',')[1];
        const fullBase64Data = canvas.toDataURL('image/png', 1.0);

        // 3. 이미지 웹서버 업로드 시뮬레이션
        const timestamp = Date.now();
        const fileName = `text-to-image-${messageData.deviceId}-${messageData.roomNumber || 'auto'}-${timestamp}.png`;
        const mockWebServerUrl = `http://${BACKEND_IP}:${BACKEND_PORT}/api/images/${fileName}`;

        console.log('🔧 Mock 이미지 URL 생성:', mockWebServerUrl);

        // 4. 실제 백엔드로 메시지 전송 (TCP/IP 통신 포함)
        const tcpTarget = messageData.tcpTarget || {
          host: BACKEND_IP,
          port: 7200
        };

        console.log('🔧 실제 백엔드로 메시지 전송 시작:', {
          target: `${tcpTarget.host}:${tcpTarget.port}`,
          imageUrl: mockWebServerUrl,
          deviceId: messageData.deviceId,
          roomNumber: messageData.roomNumber,
          backendUrl: `${API_BASE_URL}/api/messages/text`
        });

        // 실제 백엔드 API 호출
        try {
          const backendMessageData = {
            ...messageData,
            imageUrl: mockWebServerUrl,
            originalContent: messageData.content,
            messageType: 'text-to-image',
            tcpTarget: tcpTarget,
            conversionInfo: {
              ...messageData.conversionInfo,
              base64Data: fullBase64Data, // 미리보기와 동일한 폰트 크기로 생성된 이미지
              deviceResolution: deviceResolution
            }
          };

          console.log('🚀 실제 백엔드 API 호출:', {
            url: `${API_BASE_URL}/api/messages/text`,
            data: {
              deviceId: backendMessageData.deviceId,
              content: backendMessageData.content?.substring(0, 30),
              roomNumber: backendMessageData.roomNumber,
              tcpTarget: backendMessageData.tcpTarget
            }
          });

          // 실제 백엔드로 POST 요청
          const backendResponse = await fetch(`${API_BASE_URL}/api/messages/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
            },
            body: JSON.stringify(backendMessageData)
          });

          if (backendResponse.ok) {
            const backendResult = await backendResponse.json();

            console.log('✅ 실제 백엔드 메시지 전송 성공:', {
              messageId: backendResult.message?.id,
              roomNumber: backendResult.message?.roomNumber,
              tcpTarget: `${tcpTarget.host}:${tcpTarget.port}`,
              backendResponse: backendResult
            });

            resolve({
              data: {
                success: true,
                message: backendResult.message,
                imageUrl: mockWebServerUrl,
                tcpTarget: tcpTarget,
                tcpResult: {
                  success: true,
                  target: `${tcpTarget.host}:${tcpTarget.port}`,
                  protocol: 'TCP/IP',
                  sentAt: new Date().toISOString(),
                  deviceId: messageData.deviceId,
                  roomNumber: backendResult.message?.roomNumber,
                  imageUrl: mockWebServerUrl,
                  message: '실제 백엔드를 통한 TCP/IP 통신 완료'
                },
                uploadResult: {
                  success: true,
                  imageUrl: mockWebServerUrl,
                  fileName: fileName,
                  uploadedAt: new Date().toISOString(),
                  size: Math.floor(base64Image.length * 0.75),
                  message: '이미지 URL 생성 완료'
                },
                conversionInfo: {
                  originalContent: messageData.content,
                  deviceResolution: deviceResolution,
                  convertedToImage: true
                },
                protocolInfo: {
                  target: `${tcpTarget.host}:${tcpTarget.port}`,
                  protocol: 'TCP/IP',
                  sentAt: new Date().toISOString()
                },
                backendResponse: backendResult
              },
              status: 200,
              config
            });
          } else {
            const errorData = await backendResponse.json();
            console.error('❌ 백엔드 메시지 전송 실패:', {
              status: backendResponse.status,
              error: errorData
            });

            // 백엔드 실패 시 Mock으로 폴백
            console.log('🔄 백엔드 실패, Mock 모드로 폴백...');
            const newMessage = createMockData.addMessage({
              ...messageData,
              imageUrl: mockWebServerUrl,
              originalContent: messageData.content,
              messageType: 'text-to-image'
            });

            resolve({
              data: {
                success: true,
                message: newMessage,
                imageUrl: mockWebServerUrl,
                tcpTarget: tcpTarget,
                tcpResult: {
                  success: false,
                  target: `${tcpTarget.host}:${tcpTarget.port}`,
                  protocol: 'TCP/IP',
                  sentAt: new Date().toISOString(),
                  deviceId: messageData.deviceId,
                  roomNumber: newMessage.roomNumber,
                  imageUrl: mockWebServerUrl,
                  message: `백엔드 전송 실패, Mock 모드 사용: ${errorData.message || 'Unknown error'}`
                },
                uploadResult: {
                  success: true,
                  imageUrl: mockWebServerUrl,
                  fileName: fileName,
                  uploadedAt: new Date().toISOString(),
                  size: Math.floor(base64Image.length * 0.75),
                  message: 'Mock 환경: 이미지 URL 생성 완료'
                },
                conversionInfo: {
                  originalContent: messageData.content,
                  deviceResolution: deviceResolution,
                  convertedToImage: true
                },
                protocolInfo: {
                  target: `${tcpTarget.host}:${tcpTarget.port}`,
                  protocol: 'TCP/IP',
                  sentAt: new Date().toISOString()
                },
                backendError: errorData
              },
              status: 200,
              config
            });
          }
        } catch (backendError) {
          console.error('❌ 백엔드 API 호출 실패:', backendError);

          // 백엔드 연결 실패 시 Mock으로 폴백
          console.log('🔄 백엔드 연결 실패, Mock 모드로 폴백...');
          const newMessage = createMockData.addMessage({
            ...messageData,
            imageUrl: mockWebServerUrl,
            originalContent: messageData.content,
            messageType: 'text-to-image'
          });

          resolve({
            data: {
              success: true,
              message: newMessage,
              imageUrl: mockWebServerUrl,
              tcpTarget: tcpTarget,
              tcpResult: {
                success: false,
                target: `${tcpTarget.host}:${tcpTarget.port}`,
                protocol: 'TCP/IP',
                sentAt: new Date().toISOString(),
                deviceId: messageData.deviceId,
                roomNumber: newMessage.roomNumber,
                imageUrl: mockWebServerUrl,
                message: `백엔드 연결 실패, Mock 모드 사용: ${backendError.message}`
              },
              uploadResult: {
                success: true,
                imageUrl: mockWebServerUrl,
                fileName: fileName,
                uploadedAt: new Date().toISOString(),
                size: Math.floor(base64Image.length * 0.75),
                message: 'Mock 환경: 이미지 URL 생성 완료'
              },
              conversionInfo: {
                originalContent: messageData.content,
                deviceResolution: deviceResolution,
                convertedToImage: true
              },
              protocolInfo: {
                target: `${tcpTarget.host}:${tcpTarget.port}`,
                protocol: 'TCP/IP',
                sentAt: new Date().toISOString()
              },
              backendError: backendError.message
            },
            status: 200,
            config
          });
        }

      } catch (error) {
        console.error('텍스트→이미지 변환 및 백엔드 전송 실패:', error);

        resolve({
          data: {
            success: false,
            message: `텍스트→이미지 변환 실패: ${error.message}`,
            error: error.message
          },
          status: 500,
          config
        });
      }
    });
  }

  // 🆕 이미지 업로드 Mock 응답
  if (url.includes('/upload/message-image') && method === 'POST') {
    const uploadData = JSON.parse(config.data);

    console.log('🔧 이미지 업로드 Mock 응답:', {
      deviceId: uploadData.deviceId,
      roomNumber: uploadData.roomNumber,
      messageType: uploadData.messageType
    });

    const timestamp = Date.now();
    const fileName = `${uploadData.messageType}-${uploadData.deviceId}-${uploadData.roomNumber}-${timestamp}.png`;
    const mockImageUrl = `http://${BACKEND_IP}:${BACKEND_PORT}/api/images/${fileName}`;

    return Promise.resolve({
      data: {
        success: true,
        imageUrl: mockImageUrl,
        fileName: fileName,
        uploadedAt: new Date().toISOString(),
        message: 'Mock 환경: 이미지 업로드 시뮬레이션 완료'
      },
      status: 200,
      config
    });
  }

  // ✅ Mock 로그인 응답
  if (url.includes('/auth/login') && method === 'POST') {
    try {
      const { username, password } = JSON.parse(config.data || '{}');

      console.log('🔧 Mock 로그인 시도:', { username, password });

      if (username && password) {
        const mockToken = `mock-token-${username}-${Date.now()}`;
        const mockUser = {
          id: username === 'admin' ? 1 : username === 'operator' ? 2 : 3,
          username: username,
          email: `${username}@test.com`,
          role: username === 'admin' ? 'admin' : username === 'operator' ? 'operator' : 'viewer',
          active: true,
          createdAt: new Date().toISOString(),
          profile: {
            firstName: username === 'admin' ? '관리자' : username === 'operator' ? '운영자' : '사용자',
            lastName: username === 'admin' ? '시스템' : '1',
            department: username === 'admin' ? 'IT' : username === 'operator' ? '운영팀' : '일반',
            phone: '010-0000-0000'
          },
          settings: {
            theme: 'light',
            language: 'ko',
            notifications: true,
            autoLogout: 30,
            refreshInterval: 30
          }
        };

        console.log('🔧 Mock 로그인 성공:', mockUser);

        return Promise.resolve({
          data: {
            success: true,
            token: mockToken,
            user: mockUser,
            message: 'Mock 로그인 성공'
          },
          status: 200,
          config
        });
      } else {
        return Promise.resolve({
          data: {
            success: false,
            message: '사용자명과 비밀번호를 입력해주세요.'
          },
          status: 400,
          config
        });
      }
    } catch (error) {
      console.error('Mock 로그인 데이터 파싱 오류:', error);
      return Promise.resolve({
        data: {
          success: false,
          message: '로그인 데이터 오류'
        },
        status: 400,
        config
      });
    }
  }

  // ✅ Mock 사용자 정보 조회 응답
  if (url.includes('/auth/me') && method === 'GET') {
    const token = config.headers?.Authorization?.replace('Bearer ', '');

    if (token && token.startsWith('mock-token-')) {
      const username = token.split('-')[2];
      const mockUser = {
        id: username === 'admin' ? 1 : username === 'operator' ? 2 : 3,
        username: username,
        email: `${username}@test.com`,
        role: username === 'admin' ? 'admin' : username === 'operator' ? 'operator' : 'viewer',
        active: true,
        createdAt: new Date().toISOString(),
        profile: {
          firstName: username === 'admin' ? '관리자' : username === 'operator' ? '운영자' : '사용자',
          lastName: username === 'admin' ? '시스템' : '1',
          department: username === 'admin' ? 'IT' : username === 'operator' ? '운영팀' : '일반',
          phone: '010-0000-0000'
        },
        settings: {
          theme: 'light',
          language: 'ko',
          notifications: true,
          autoLogout: 30,
          refreshInterval: 30
        }
      };

      console.log('🔧 Mock 사용자 정보 조회 성공:', mockUser);

      return Promise.resolve({
        data: {
          success: true,
          user: mockUser
        },
        status: 200,
        config
      });
    } else {
      return Promise.resolve({
        data: {
          success: false,
          message: '인증이 필요합니다.'
        },
        status: 401,
        config
      });
    }
  }

  // ✅ Mock 로그아웃 응답
  if (url.includes('/auth/logout') && method === 'POST') {
    console.log('🔧 Mock 로그아웃');
    return Promise.resolve({
      data: {
        success: true,
        message: 'Mock 로그아웃 성공'
      },
      status: 200,
      config
    });
  }

  // ✅ 사용자 목록 조회 Mock 응답 (URL 패턴 수정)
  if (url.includes('/users') && method === 'GET' && !url.includes('/users/')) {
    initializeMockState();
    return Promise.resolve({
      data: {
        success: true,
        users: mockState.users,
        totalCount: mockState.users.length,
        stats: {
          total: mockState.users.length,
          active: mockState.users.filter(u => u.active).length,
          inactive: mockState.users.filter(u => !u.active).length,
          roles: mockState.users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {})
        }
      },
      status: 200,
      config
    });
  }

  // ✅ 사용자 생성 Mock 응답 (URL 패턴 수정)
  if (url.includes('/users') && method === 'POST' && !url.includes('/users/')) {
    const userData = JSON.parse(config.data);
    const newUser = {
      id: Math.max(...mockState.users.map(u => u.id)) + 1,
      ...userData,
      active: userData.active !== undefined ? userData.active : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: userData.settings || {
        theme: 'light',
        language: 'ko',
        notifications: true,
        autoLogout: 30,
        refreshInterval: 30
      }
    };

    initializeMockState();
    mockState.users.push(newUser);

    console.log('🔧 새 사용자 생성 Mock:', newUser);

    return Promise.resolve({
      data: {
        success: true,
        user: newUser,
        message: '사용자가 생성되었습니다.'
      },
      status: 201,
      config
    });
  }

  // ✅ 사용자 업데이트 Mock 응답 (설정 저장 핵심!, URL 패턴 수정)
  if (url.match(/^\/users\/\d+$/) && method === 'PUT') {
    const userId = parseInt(url.split('/').pop());
    const updateData = JSON.parse(config.data);

    initializeMockState();

    const userIndex = mockState.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return Promise.resolve({
        data: {
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        },
        status: 404,
        config
      });
    }

    const existingUser = mockState.users[userIndex];

    // ✅ 사용자 정보 업데이트 (settings와 profile 포함)
    const updatedUser = {
      ...existingUser,
      ...updateData,
      id: userId, // ID는 변경 불가
      updatedAt: new Date().toISOString(),
      // ✅ settings와 profile은 병합 처리
      settings: updateData.settings ? { ...existingUser.settings, ...updateData.settings } : existingUser.settings,
      profile: updateData.profile ? { ...existingUser.profile, ...updateData.profile } : existingUser.profile
    };

    mockState.users[userIndex] = updatedUser;

    console.log('🔧 사용자 업데이트 Mock 성공:', {
      userId,
      updateData,
      updatedUser: {
        settings: updatedUser.settings,
        profile: updatedUser.profile
      }
    });

    return Promise.resolve({
      data: {
        success: true,
        user: updatedUser,
        message: '사용자 정보가 수정되었습니다.'
      },
      status: 200,
      config
    });
  }

  // ✅ 사용자 삭제 Mock 응답 (URL 패턴 수정)
  if (url.match(/^\/users\/\d+$/) && method === 'DELETE') {
    const userId = parseInt(url.split('/').pop());

    initializeMockState();

    const userIndex = mockState.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return Promise.resolve({
        data: {
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        },
        status: 404,
        config
      });
    }

    const deletedUser = mockState.users.splice(userIndex, 1)[0];

    console.log('🔧 사용자 삭제 Mock 성공:', deletedUser);

    return Promise.resolve({
      data: {
        success: true,
        message: '사용자가 삭제되었습니다.'
      },
      status: 200,
      config
    });
  }

  // ✅ 디바이스 목록 조회 Mock 응답 (상태 동기화 개선)
  if (url.includes('/devices') && !url.includes('/test') && !url.includes('/stats') && method === 'GET' && !url.match(/\/devices\/[^\/]+$/)) {
    initializeMockState();

    // ✅ 모든 디바이스의 최신 상태 반영
    const devicesWithUpdatedStatus = mockState.devices.map(device => ({
      ...device,
      connected: device.status === 'online', // ✅ status와 connected 동기화
      isTest: device.isTest || device.name?.includes('테스트') || device.specs?.model?.includes('TEST')
    }));

    console.log('🔧 디바이스 목록 조회 - 최신 상태 반영:', {
      총디바이스: devicesWithUpdatedStatus.length,
      온라인: devicesWithUpdatedStatus.filter(d => d.status === 'online').length,
      오프라인: devicesWithUpdatedStatus.filter(d => d.status === 'offline').length
    });

    return Promise.resolve({
      data: {
        success: true,
        devices: devicesWithUpdatedStatus,
        total: devicesWithUpdatedStatus.length
      },
      status: 200,
      config
    });
  }

  // ✅ 개별 디바이스 조회 Mock 응답 - 핵심 수정! (URL 패턴 통일 및 응답 구조 개선)
  if (url.match(/\/devices\/[^\/]+$/) && method === 'GET' && !url.includes('/stats') && !url.includes('/test')) {
    initializeMockState();

    const deviceId = url.split('/').pop();
    console.log('🔧 개별 디바이스 조회 Mock 응답:', deviceId);

    // Mock 디바이스에서 찾기 (우선순위)
    let device = mockState.devices.find(d => d.id === deviceId);

    // 디바이스를 찾지 못한 경우, 동적으로 생성 (기존 ID 호환성)
    if (!device) {
      console.log('🔧 디바이스를 찾을 수 없음, 동적 생성:', deviceId);

      // 기존 디바이스 ID에 대한 호환성 처리
      device = {
        id: deviceId,
        name: `전광판 ${deviceId.slice(-4)}`,
        ip: '127.0.0.1',
        port: 5002,
        status: 'offline', // ✅ 고정값으로 변경 (랜덤 제거)
        isTest: true,
        location: {
          address: '서울시 강남구 테헤란로 123',
          building: '테스트 빌딩',
          floor: '1층',
          room: '로비'
        },
        specs: {
          model: 'TEST-LED-AUTO',
          manufacturer: 'TestCompany',
          size: '55인치',
          resolution: { width: 1920, height: 1080 },
          maxBrightness: 100
        },
        config: {
          brightness: { current: 10 },
          schedule: {
            onTime: '06:00',
            offTime: '23:00',
            enabled: true
          }
        },
        connectionInfo: {
          connected: false, // ✅ 고정값으로 변경 (랜덤 제거)
          lastHeartbeat: new Date().toISOString(),
          lastError: null
        },
        systemInfo: {
          temperature: 45,
          powerStatus: 'OFF' // ✅ 오프라인 상태에 맞게 OFF로 변경
        }
      };

      // Mock 상태에 추가
      mockState.devices.push(device);
      console.log('🔧 새 디바이스가 Mock 상태에 추가됨:', device.name);
    } else {
      // ✅ 기존 디바이스인 경우, 목록에서와 동일한 상태 유지
      console.log('🔧 기존 디바이스 발견:', device.name, '상태:', device.status);
    }

    // ✅ 연결 상태를 status와 일치시키기
    const isConnected = device.status === 'online';
    const isTest = device.isTest || device.name?.includes('테스트') || device.specs?.model?.includes('TEST');

    const deviceData = {
      ...device,
      connected: isConnected, // ✅ status와 동기화
      isTest: isTest,
      // ✅ 온라인 상태일 때만 systemInfo 제공
      ...(isConnected && {
        systemInfo: {
          temperature: 45 + Math.floor(Math.random() * 10),
          powerStatus: 'ON'
        }
      })
    };

    console.log('🔧 개별 디바이스 조회 응답:', {
      deviceId,
      name: device.name,
      status: device.status,
      connected: isConnected,
      isTest: isTest
    });

    return Promise.resolve({
      data: {
        success: true,
        device: deviceData
      },
      status: 200,
      config
    });
  }

  // 🆕 테스트 디바이스 생성 Mock 응답 (URL 패턴 수정)
  if (url.includes('/devices/test/create') && method === 'POST') {
    initializeMockState();

    console.log('🧪 테스트 디바이스 생성 Mock 응답');

    // 기존 테스트 디바이스 제거
    mockState.devices = mockState.devices.filter(device =>
      !device.name?.includes('테스트') &&
      !device.ip?.startsWith('127.0.0')
    );

    // 새로운 테스트 디바이스 3개 생성
    const newTestDevices = [
      {
        id: 'test-device-1',
        name: '테스트 전광판 1',
        ip: '127.0.0.1',
        port: 5002,
        status: 'offline',
        isTest: true,
        location: { address: '서울시 강남구 테헤란로 123', building: '테스트 빌딩', floor: '1층' },
        specs: {
          model: 'TEST-LED-001',
          resolution: { width: 1920, height: 1080 },
          size: '55인치',
          maxBrightness: 100
        },
        config: {
          brightness: { current: 10 },
          schedule: {
            onTime: '06:00',
            offTime: '23:00',
            enabled: true
          }
        },
        connectionInfo: {
          connected: false,
          lastHeartbeat: null,
          lastError: null
        }
      },
      {
        id: 'test-device-2',
        name: '테스트 전광판 2',
        ip: '127.0.0.2',
        port: 5003,
        status: 'offline',
        isTest: true,
        location: { address: '서울시 서초구 서초대로 456', building: '테스트 빌딩', floor: '2층' },
        specs: {
          model: 'TEST-LED-002',
          resolution: { width: 1920, height: 1080 },
          size: '43인치',
          maxBrightness: 80
        },
        config: {
          brightness: { current: 8 },
          schedule: {
            onTime: '07:00',
            offTime: '22:00',
            enabled: true
          }
        },
        connectionInfo: {
          connected: false,
          lastHeartbeat: null,
          lastError: null
        }
      }
    ];

    // 기존 디바이스 배열에 추가
    mockState.devices.push(...newTestDevices);

    console.log('🧪 테스트 디바이스 생성 완료:', newTestDevices.map(d => d.name));

    return Promise.resolve({
      data: {
        success: true,
        message: `테스트 디바이스 ${newTestDevices.length}개가 생성되었습니다! 각 디바이스의 '연결' 버튼을 눌러 테스트를 시작하세요.`,
        devices: newTestDevices,
        isTest: true
      },
      status: 200,
      config
    });
  }

  // 🆕 디바이스 연결 Mock 응답 - 핵심 수정! (상태 동기화)
  if (url.match(/\/devices\/[^\/]+\/connect$/) && method === 'POST') {
    const deviceId = url.split('/')[2]; // /devices/[deviceId]/connect
    initializeMockState();

    console.log(`🔧 디바이스 연결 요청: ${deviceId}`);

    const device = mockState.devices.find(d => d.id === deviceId);

    if (device) {
      // ✅ 상태를 일관되게 업데이트
      device.status = 'online';
      device.connectionInfo = {
        connected: true,
        lastHeartbeat: new Date().toISOString(),
        lastError: null
      };
      device.systemInfo = {
        temperature: 45 + Math.floor(Math.random() * 10),
        powerStatus: 'ON'
      };

      console.log(`🔧 디바이스 연결 성공: ${device.name} (상태: ${device.status})`);

      return Promise.resolve({
        data: {
          success: true,
          message: '디바이스 연결 성공',
          isTest: device.isTest || false,
          device: device // ✅ 업데이트된 디바이스 정보 반환
        },
        status: 200,
        config
      });
    }

    console.log(`❌ 디바이스를 찾을 수 없음: ${deviceId}`);
    return Promise.resolve({
      data: {
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      },
      status: 404,
      config
    });
  }

  // 🆕 디바이스 연결 해제 Mock 응답 - 핵심 수정! (상태 동기화)
  if (url.match(/\/devices\/[^\/]+\/disconnect$/) && method === 'POST') {
    const deviceId = url.split('/')[2]; // /devices/[deviceId]/disconnect
    initializeMockState();

    console.log(`🔧 디바이스 연결 해제 요청: ${deviceId}`);

    const device = mockState.devices.find(d => d.id === deviceId);

    if (device) {
      // ✅ 상태를 일관되게 업데이트
      device.status = 'offline';
      device.connectionInfo = {
        connected: false,
        lastHeartbeat: device.connectionInfo?.lastHeartbeat || new Date().toISOString(),
        lastError: null
      };
      delete device.systemInfo; // ✅ 오프라인시 시스템 정보 제거

      console.log(`🔧 디바이스 연결 해제 성공: ${device.name} (상태: ${device.status})`);

      return Promise.resolve({
        data: {
          success: true,
          message: '디바이스 연결 해제 성공',
          isTest: device.isTest || false,
          device: device // ✅ 업데이트된 디바이스 정보 반환
        },
        status: 200,
        config
      });
    }

    console.log(`❌ 디바이스를 찾을 수 없음: ${deviceId}`);
    return Promise.resolve({
      data: {
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      },
      status: 404,
      config
    });
  }

  // 🆕 디바이스 설정 업데이트 Mock 응답 (URL 패턴 수정)
  if (url.match(/^\/devices\/[^\/]+\/config$/) && method === 'PUT') {
    const deviceId = url.split('/')[2];
    const configData = JSON.parse(config.data);

    initializeMockState();
    const device = mockState.devices.find(d => d.id === deviceId);

    if (device) {
      // ✅ 설정을 깊은 병합으로 제대로 업데이트
      device.config = {
        ...device.config,
        brightness: {
          ...device.config.brightness,
          ...configData.brightness
        },
        schedule: {
          ...device.config.schedule,
          ...configData.schedule
        }
      };

      console.log(`🔧 디바이스 설정 업데이트: ${device.name}`, {
        입력된설정: configData,
        업데이트된설정: device.config
      });

      return Promise.resolve({
        data: {
          success: true,
          message: '설정이 업데이트되었습니다.',
          device: device, // ✅ 업데이트된 디바이스 전체 반환
          config: device.config, // ✅ 업데이트된 설정도 명시적으로 반환
          isTest: device.isTest || false
        },
        status: 200,
        config
      });
    }

    return Promise.resolve({
      data: {
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      },
      status: 404,
      config
    });
  }

  // 🆕 디바이스 전원 제어 Mock 응답 (URL 패턴 수정)
  if (url.match(/^\/devices\/[^\/]+\/power$/) && method === 'POST') {
    const deviceId = url.split('/')[2];
    const { action } = JSON.parse(config.data);
    const device = mockState.devices.find(d => d.id === deviceId);

    if (device) {
      console.log(`🔧 전원 제어: ${device.name} - ${action}`);

      if (action === 'RESTART') {
        // 재시작 시뮬레이션
        device.status = 'connecting';
        setTimeout(() => {
          device.status = 'online';
          device.connectionInfo = {
            connected: true,
            lastHeartbeat: new Date().toISOString(),
            lastError: null
          };
        }, 2000);
      } else if (action === 'OFF') {
        device.status = 'offline';
        device.connectionInfo = {
          connected: false,
          lastHeartbeat: device.connectionInfo?.lastHeartbeat || new Date().toISOString(),
          lastError: null
        };
      } else if (action === 'ON') {
        device.status = 'online';
        device.connectionInfo = {
          connected: true,
          lastHeartbeat: new Date().toISOString(),
          lastError: null
        };
      }

      return Promise.resolve({
        data: {
          success: true,
          message: `전원 ${action} 명령을 실행했습니다.`,
          isTest: device.isTest || false
        },
        status: 200,
        config
      });
    }

    return Promise.resolve({
      data: {
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      },
      status: 404,
      config
    });
  }

  // 🆕 디바이스 메시지 삭제 Mock 응답 (URL 패턴 수정)
  if (url.match(/^\/devices\/[^\/]+\/messages$/) && method === 'DELETE') {
    const deviceId = url.split('/')[2];
    const device = mockState.devices.find(d => d.id === deviceId);

    if (device) {
      // 해당 디바이스의 모든 메시지 삭제
      const deletedMessages = mockState.messages.filter(msg => msg.deviceId === deviceId);
      mockState.messages = mockState.messages.filter(msg => msg.deviceId !== deviceId);

      console.log(`🔧 디바이스 메시지 삭제: ${device.name} (${deletedMessages.length}개)`);

      return Promise.resolve({
        data: {
          success: true,
          message: `${deletedMessages.length}개의 메시지가 삭제되었습니다.`,
          deletedCount: deletedMessages.length,
          isTest: device.isTest || false
        },
        status: 200,
        config
      });
    }

    return Promise.resolve({
      data: {
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      },
      status: 404,
      config
    });
  }

  // ✅ 연결 통계 Mock 응답 (복수형/단수형 모두 처리, URL 패턴 수정)
  if ((url.includes('/devices/stats/connections') || url.includes('/devices/stats/connection')) && method === 'GET') {
    initializeMockState();

    const totalDevices = mockState.devices.length;
    const onlineDevices = mockState.devices.filter(d => d.status === 'online').length;
    const testDevices = mockState.devices.filter(d => d.isTest).length;

    return Promise.resolve({
      data: {
        success: true,
        stats: {
          total: totalDevices,
          connected: onlineDevices,
          offline: totalDevices - onlineDevices,
          test: testDevices,
          real: totalDevices - testDevices,
          uptime: totalDevices > 0 ? (onlineDevices / totalDevices * 100) : 0,
          devices: mockState.devices.map(device => ({
            id: device.id,
            name: device.name,
            status: device.status,
            connected: device.status === 'online',
            isTest: device.isTest || false
          }))
        }
      },
      status: 200,
      config
    });
  }

  // 🔧 메시지 관련 Mock 응답 (디바이스별 독립 자동 정리, URL 패턴 수정)
  if (url.includes('/messages') && !url.includes('/rooms') && method === 'GET') {
    initializeMockState();

    // 🔧 자동 정리 실행 (디바이스별 중복 메시지 제거)
    createMockData.cleanupMockState();

    const messages = mockState.messages;
    return Promise.resolve({
      data: {
        success: true,
        messages: messages,
        stats: {
          total: messages.length,
          byStatus: {
            sent: messages.filter(m => m.status === 'sent').length,
            active: messages.filter(m => m.status === 'active').length,
            failed: 0,
            pending: 0
          },
          byPriority: {
            URGENT: messages.filter(m => m.priority === 'URGENT').length,
            HIGH: messages.filter(m => m.priority === 'HIGH').length,
            NORMAL: messages.filter(m => m.priority === 'NORMAL').length,
            LOW: messages.filter(m => m.priority === 'LOW').length
          },
          byRoomNumber: messages.reduce((acc, msg) => {
            if (msg.roomNumber) {
              // 🔧 디바이스별로 통계 분리
              const key = `${msg.deviceId}:${msg.roomNumber}`;
              acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
          }, {})
        }
      },
      status: 200,
      config
    });
  }

  // 🔧 메시지 전송 Mock 응답 (디바이스별 독립 자동 할당, URL 패턴 수정)
  if ((url.includes('/messages/text') || url.includes('/messages/image') || url.includes('/messages/mixed')) && method === 'POST') {
    const messageData = JSON.parse(config.data);

    console.log('🔧 메시지 전송 요청 (디바이스별 독립):', messageData);

    // 🔧 자동 방번호 할당 로직 (디바이스별 독립)
    if (!messageData.roomNumber) {
      initializeMockState();

      // 🔧 해당 디바이스의 사용 중인 방번호만 조회
      const roomInfo = createMockData.roomInfo(messageData.deviceId);
      const usedRooms = roomInfo.usedRooms; // 해당 디바이스에서만 사용 중인 방번호

      console.log('🔧 자동 할당 - 현재 사용 중인 방번호 (디바이스별 독립):', {
        deviceId: messageData.deviceId,
        usedRooms
      });

      const availableRooms = messageData.urgent
        ? [1, 2, 3, 4, 5].filter(num => !usedRooms.includes(num))
        : Array.from({ length: 95 }, (_, i) => i + 6).filter(num => !usedRooms.includes(num));

      messageData.roomNumber = availableRooms[0] || (messageData.urgent ? 1 : 6);

      console.log('🔧 자동 할당된 방번호 (디바이스별 독립):', {
        deviceId: messageData.deviceId,
        roomNumber: messageData.roomNumber,
        urgent: messageData.urgent
      });
    }

    const newMessage = createMockData.addMessage(messageData);

    // 🔧 전송 후 자동 정리 실행 (디바이스별)
    createMockData.cleanupMockState();

    return Promise.resolve({
      data: {
        success: true,
        message: newMessage,
        isTest: true
      },
      status: 200,
      config
    });
  }

  // 🔧 방번호 관련 Mock 응답 (디바이스별 독립, URL 패턴 수정)
  if (url.includes('/messages/rooms/') && method === 'GET') {
    initializeMockState();

    // 🔧 조회 전 자동 정리 실행 (디바이스별)
    createMockData.cleanupMockState();

    const deviceId = url.split('/').pop();
    console.log('🔧 방번호 정보 요청 (디바이스별 독립):', deviceId);

    const roomInfo = createMockData.roomInfo(deviceId);

    // 🔧 응답 전 한 번 더 중복 검증 (해당 디바이스만)
    const uniqueRooms = [...new Set(roomInfo.usedRooms)].sort((a, b) => a - b);
    if (uniqueRooms.length !== roomInfo.usedRooms.length) {
      console.warn(`⚠️ 디바이스 ${deviceId} 응답에서 추가 중복 발견, 제거함:`, {
        원본: roomInfo.usedRooms,
        정리후: uniqueRooms
      });
      roomInfo.usedRooms = uniqueRooms;
    }

    return Promise.resolve({
      data: roomInfo,
      status: 200,
      config
    });
  }

  // 🔧 방번호 삭제 Mock 응답 (디바이스별 독립, URL 패턴 수정)
  if (url.includes('/messages/rooms/') && method === 'DELETE') {
    const urlParts = url.split('/');
    const roomNumber = urlParts.pop();
    const deviceId = urlParts.pop();

    const deletedCount = createMockData.deleteRoom(deviceId, roomNumber);

    return Promise.resolve({
      data: {
        success: true,
        message: `디바이스 ${deviceId} 방번호 ${roomNumber}의 메시지 ${deletedCount}개가 삭제되었습니다.`
      },
      status: 200,
      config
    });
  }

  // 🆕 개별 메시지 삭제 Mock 응답 (URL 패턴 수정)
  if (url.match(/\/messages\/[^\/]+$/) && method === 'DELETE') {
    const messageId = url.split('/').pop();
    const success = createMockData.deleteMessage(messageId);

    if (success) {
      return Promise.resolve({
        data: {
          success: true,
          message: '메시지가 삭제되었습니다.'
        },
        status: 200,
        config
      });
    } else {
      return Promise.resolve({
        data: {
          success: false,
          message: '메시지를 찾을 수 없습니다.'
        },
        status: 404,
        config
      });
    }
  }

  // 기본 Mock 응답
  return Promise.resolve({
    data: {
      success: false,
      message: 'Mock API - 지원하지 않는 요청',
      isMock: true
    },
    status: 404,
    config
  });
};

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('요청 오류:', error);
    return Promise.reject(error);
  }
);

// 🔧 응답 인터셉터 수정 (실제 백엔드 메시지 전송 우선)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('API 오류:', error);

    // 🔧 토큰 만료 처리를 최우선으로
    if (handleTokenExpiration(error)) {
      return Promise.reject(error);
    }

    // ✅ 메시지 전송은 실제 백엔드 우선, Mock 폴백 최소화
    if (error.config?.url?.includes('/messages/text') && USE_REAL_BACKEND_FOR_MESSAGES) {
      console.warn('🔄 메시지 전송 실패, 백엔드 서버 상태 확인 중...');

      try {
        // 백엔드 서버 연결 테스트
        const testResponse = await fetch(`http://${BACKEND_IP}:${BACKEND_PORT}/api/health`, {
          method: 'GET',
          timeout: 3000
        });

        if (testResponse.ok) {
          console.log('✅ 백엔드 서버 연결됨, 원본 오류 반환');
          return Promise.reject(error); // 원본 오류 반환 (재시도 가능)
        }
      } catch (healthCheckError) {
        console.warn('❌ 백엔드 서버 연결 실패, Mock 모드로 전환');
      }
    }

    // 🔧 메시지 전송이 아닌 경우에만 Mock 데이터 반환
    if (!error.config?.url?.includes('/messages/text')) {
      if (error.response?.status >= 400 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_BAD_REQUEST' ||
        error.code === 'NETWORK_ERROR') {

        console.warn('🚧 백엔드 서버 오류/연결 실패, Mock 데이터 사용:', {
          status: error.response?.status,
          code: error.code,
          url: error.config?.url,
          method: error.config?.method
        });

        return getMockResponse(error.config);
      }
    } else {
      // 메시지 전송의 경우 실제 오류를 그대로 반환 (Mock 폴백하지 않음)
      console.error('❌ 메시지 전송 실패 (실제 백엔드 오류):', {
        status: error.response?.status,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        message: error.message
      });
    }

    // 개발 환경에서는 로그인 페이지로 리다이렉트하지 않음 (Mock 사용)
    if (error.response?.status === 401 && process.env.NODE_ENV === 'production') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// API 서비스 객체
const apiService = {
  // 기본 HTTP 메서드
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  patch: (url, data, config) => api.patch(url, data, config),
  delete: (url, config) => api.delete(url, config),

  // 인증 관련
  auth: {
    login: (username, password) => api.post('/api/auth/login', { username, password }),
    logout: () => api.post('/api/auth/logout'),
    me: () => api.get('/api/auth/me'),
  },

  // 디바이스 관련
  devices: {
    getAll: async (params) => {
      // 실제 백엔드에서 디바이스 목록 가져오기
      try {
        console.log('🔧 실제 백엔드에서 디바이스 목록 조회 시도');
        const response = await fetch(`${API_BASE_URL}/api/devices`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 실제 백엔드 디바이스 목록 조회 성공:', result);
          return { data: result, status: 200 };
        } else {
          console.warn('⚠️ 백엔드 디바이스 목록 조회 실패, Mock 사용');
          return api.get('/api/devices', { params });
        }
      } catch (error) {
        console.warn('⚠️ 백엔드 디바이스 목록 조회 실패, Mock 사용:', error);
        return api.get('/api/devices', { params });
      }
    },
    getById: (id) => api.get(`/api/devices/${id}`),
    create: async (data) => {
      // 실제 백엔드로 디바이스 생성 요청
      try {
        console.log('🔧 실제 백엔드로 디바이스 생성 시도:', {
          deviceId: data.deviceId,
          name: data.name,
          backendUrl: `${API_BASE_URL}/api/devices`
        });

        const response = await fetch(`${API_BASE_URL}/api/devices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 실제 백엔드 디바이스 생성 성공:', result);
          return { data: result, status: 201 };
        } else {
          const errorData = await response.json();
          console.error('❌ 백엔드 디바이스 생성 실패:', errorData);
          throw new Error(errorData.message || '디바이스 생성 실패');
        }
      } catch (error) {
        console.error('❌ 백엔드 API 호출 실패:', error);
        throw error;
      }
    },
    update: (id, data) => api.put(`/api/devices/${id}`, data),
    delete: (id) => api.delete(`/api/devices/${id}`),

    // 🆕 디바이스 연결/제어 관련
    connect: (id) => api.post(`/api/devices/${id}/connect`),
    disconnect: (id) => api.post(`/api/devices/${id}/disconnect`),
    getStatus: (id) => api.get(`/api/devices/${id}/status`),
    updateConfig: (id, config) => api.put(`/api/devices/${id}/config`, config),
    controlPower: (id, action) => api.post(`/api/devices/${id}/power`, { action }),
    clearMessages: (id) => api.delete(`/api/devices/${id}/messages`),

    // 🆕 테스트 디바이스 관련
    createTestDevices: () => api.post('/api/devices/test/create'),
    getConnectionStats: () => api.get('/api/devices/stats/connections'),
  },

  // 메시지 관련 (디바이스별 독립 방번호)
  messages: {
    getAll: (params) => api.get('/api/messages', { params }),
    getById: (id) => api.get(`/api/messages/${id}`),
    sendText: async (data) => {
      console.log('🚀 텍스트→이미지 변환 및 백엔드 전송 시작:', {
        deviceId: data.deviceId,
        content: data.content?.substring(0, 30),
        conversionInfo: data.conversionInfo,
        hasConversionInfo: !!data.conversionInfo,
        backendUrl: `${API_BASE_URL}/api/messages/text`
      });

      try {
        // 🔧 텍스트를 이미지로 변환 (미리보기와 동일한 로직)
        const deviceResolution = data.conversionInfo?.deviceResolution || { width: 1920, height: 1080 };

        // Canvas 생성 및 이미지 변환
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = deviceResolution.width;
        canvas.height = deviceResolution.height;

        ctx.fillStyle = data.displayOptions?.backgroundColor || '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const lines = data.content.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 0) {
          const maxLines = lines.length;

          // 🔧 미리보기와 정확히 동일한 폰트 크기 계산
          const userFontSize = data.displayOptions?.fontSize || 16;

          // 미리보기 크기 설정 (미리보기와 동일한 로직)
          const aspectRatio = canvas.width / canvas.height;
          let displayWidth, displayHeight;
          if (aspectRatio > 3) {
            displayWidth = 720;
            displayHeight = 240;
          } else if (aspectRatio > 2) {
            displayWidth = 600;
            displayHeight = 300;
          } else if (aspectRatio > 1.5) {
            displayWidth = 560;
            displayHeight = 315;
          } else {
            displayWidth = 400;
            displayHeight = 400;
          }

          // 미리보기와 동일한 스케일 계산
          const baseScale = Math.min(displayWidth / canvas.width, displayHeight / canvas.height);
          let fontSize = userFontSize * baseScale;

          // 🔧 폰트 크기 변화가 더 잘 보이도록 제한 로직 수정
          const maxByHeight = displayHeight / maxLines * 0.8;
          const longestLine = lines.reduce((max, line) => line.length > max.length ? line : max, '');
          const maxByWidth = longestLine.length > 0 ? displayWidth / longestLine.length * 1.2 : fontSize;

          const minUserSize = userFontSize * baseScale * 0.3;
          const maxSize = Math.max(maxByHeight, maxByWidth, minUserSize);

          fontSize = Math.min(fontSize, maxSize);
          fontSize = Math.max(fontSize, 12);

          // 🔧 실제 전광판 해상도에 맞게 최종 스케일링
          const finalScale = Math.min(canvas.width / displayWidth, canvas.height / displayHeight);
          fontSize = fontSize * finalScale;

          console.log('🔧 실제 이미지 폰트 크기:', {
            userFontSize,
            canvasSize: `${canvas.width}x${canvas.height}`,
            aspectRatio,
            previewSize: `${displayWidth}x${displayHeight}`,
            baseScale,
            beforeLimits: userFontSize * baseScale,
            afterLimits: Math.min(userFontSize * baseScale, maxByHeight, maxByWidth),
            finalScale,
            finalFontSize: fontSize
          });

          ctx.font = `bold ${fontSize}px "Malgun Gothic", "맑은 고딕", Arial, sans-serif`;
          ctx.fillStyle = data.displayOptions?.color || '#FFFFFF';
          ctx.textAlign = data.displayOptions?.position === 'left' ? 'start' :
            data.displayOptions?.position === 'right' ? 'end' : 'center';
          ctx.textBaseline = 'middle';

          let x;
          const margin = Math.max(canvas.width * 0.05, 20);
          if (data.displayOptions?.position === 'left') {
            x = margin;
          } else if (data.displayOptions?.position === 'right') {
            x = canvas.width - margin;
          } else {
            x = canvas.width / 2;
          }

          // 🔧 미리보기와 동일한 줄 간격
          const lineHeight = fontSize * 1.0;
          const totalTextHeight = lines.length * lineHeight;
          const startY = (canvas.height - totalTextHeight) / 2 + lineHeight / 2;

          lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);

            // 🔧 텍스트 외곽선 효과로 가독성 향상
            if (data.displayOptions?.backgroundColor === '#000000' && data.displayOptions?.color === '#FFFFFF') {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
              ctx.lineWidth = Math.max(fontSize * 0.02, 1);
              ctx.strokeText(line, x, y);
            }

            // 🔧 메인 텍스트 렌더링
            ctx.fillStyle = data.displayOptions?.color || '#FFFFFF';
            ctx.fillText(line, x, y);
          });
        }

        const fullBase64Data = canvas.toDataURL('image/png', 1.0);

        // 🔧 conversionInfo에 base64 데이터 추가
        const enhancedData = {
          ...data,
          conversionInfo: {
            ...data.conversionInfo,
            base64Data: fullBase64Data,
            deviceResolution: deviceResolution,
            convertedToImage: true
          }
        };

        console.log('🔧 이미지 변환 완료, 백엔드 전송:', {
          base64Length: fullBase64Data.length,
          deviceResolution: deviceResolution
        });

        const response = await fetch(`${API_BASE_URL}/api/messages/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
          },
          body: JSON.stringify(enhancedData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 실제 백엔드 메시지 전송 성공:', result);
          return { data: result, status: 200 };
        } else {
          const errorData = await response.json();
          console.error('❌ 백엔드 메시지 전송 실패:', errorData);
          throw new Error(errorData.message || '메시지 전송 실패');
        }
      } catch (error) {
        console.error('❌ 텍스트→이미지 변환 또는 백엔드 전송 실패:', error);
        throw error;
      }
    },
    sendTextAsImage: (data) => api.post('/api/messages/text', data), // 🆕 추가된 메서드 (sendText와 동일)
    sendImage: (data) => api.post('/api/messages/image', data),
    sendMixed: (data) => api.post('/api/messages/mixed', data),
    update: (id, data) => api.put(`/api/messages/${id}`, data),
    delete: (id) => api.delete(`/api/messages/${id}`),

    // 🆕 개별 메시지 삭제 (명시적 함수명)
    deleteMessage: (id) => api.delete(`/api/messages/${id}`),

    // 🆕 TCP/IP 연결 테스트
    testTcpConnection: (host, port, testData) => api.post('/api/messages/test-tcp', { host, port, testData }),

    // 방번호 관리 (디바이스별 독립)
    rooms: {
      getDeviceRooms: (deviceId) => api.get(`/api/messages/rooms/${deviceId}`),
      getRoomMessages: (deviceId, roomNumber) => api.get(`/api/messages/rooms/${deviceId}/${roomNumber}`),
      deleteRoom: (deviceId, roomNumber) => api.delete(`/api/messages/rooms/${deviceId}/${roomNumber}`),

      // 방번호 해제 전용 메서드 (메시지는 보존)
      clearRoomDisplay: (deviceId, roomNumber) => api.patch(`/api/messages/rooms/${deviceId}/${roomNumber}/clear`),
    },
  },

  // 사용자 관리
  users: {
    getAll: (params) => api.get('/api/users', { params }),
    getById: (id) => api.get(`/api/users/${id}`),
    create: (data) => api.post('/api/users', data),
    update: (id, data) => api.put(`/api/users/${id}`, data),
    delete: (id) => api.delete(`/api/users/${id}`),
  },

  // 🔧 테스트 메서드 (디버깅용 - 디바이스별 독립)
  _testing: {
    getMockState: () => mockState,
    resetMockState: () => {
      mockState = {
        messages: [],
        users: [],
        devices: [],
        initialized: false
      };
      console.log('🧪 Mock 상태가 리셋되었습니다. (디바이스별 독립)');
    },
    cleanupMockState: () => createMockData.cleanupMockState(),
    printMockState: () => {
      initializeMockState();
      console.table(mockState.messages.map(m => ({
        id: m.id,
        deviceId: m.deviceId,
        roomNumber: m.roomNumber,
        content: m.content.substring(0, 20) + '...',
        createdAt: m.createdAt
      })));

      // 🔧 디바이스별 방번호 현황 출력
      const deviceRoomStatus = {};
      mockState.devices.forEach(device => {
        const roomInfo = createMockData.roomInfo(device.id);
        deviceRoomStatus[device.name] = {
          deviceId: device.id,
          usedRooms: roomInfo.usedRooms,
          roomCount: roomInfo.usedRooms.length,
          availableCount: 100 - roomInfo.usedRooms.length
        };
      });

      console.log('🔧 디바이스별 방번호 현황 (완전 독립):', deviceRoomStatus);

      return {
        총메시지: mockState.messages.length,
        디바이스별현황: deviceRoomStatus
      };
    },
    getMockRoomInfo: (deviceId) => createMockData.roomInfo(deviceId),
    addTestMessage: (deviceId, roomNumber, content) => {
      return createMockData.addMessage({
        deviceId,
        roomNumber: parseInt(roomNumber),
        content,
        priority: 'NORMAL',
        urgent: parseInt(roomNumber) <= 5
      });
    },
    // 🆕 실제 디바이스 등록 함수
    registerRealDevice: async (deviceId, deviceName) => {
      try {
        console.log('🔧 실제 디바이스 등록 시도:', { deviceId, deviceName });

        const deviceData = {
          id: deviceId,
          deviceId: deviceId,
          name: deviceName || `전광판 ${deviceId.slice(-4)}`,
          controllerType: 'HUIDU',
          ip: BACKEND_IP,
          port: 7200,
          location: {
            address: '테스트 위치',
            coordinates: { lat: 35.0, lng: 127.0 },
            description: '테스트용 전광판'
          },
          specs: {
            model: 'TEST-LED',
            size: '55인치',
            resolution: { width: 1920, height: 1080 },
            maxBrightness: 100,
            supportedFormats: ['text', 'image', 'mixed'],
            pixelPitch: 10,
            maxFileSize: 5242880
          }
        };

        const result = await apiService.devices.create(deviceData);
        console.log('✅ 실제 디바이스 등록 성공:', result);
        return result;
      } catch (error) {
        console.error('❌ 실제 디바이스 등록 실패:', error);
        throw error;
      }
    }
  }
};

// 🆕 백엔드 연결 상태 체크 함수
export const checkBackendConnection = async () => {
  try {
    const response = await fetch(`http://${BACKEND_IP}:${BACKEND_PORT}/api/health`, {
      method: 'GET',
      timeout: 5000
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 백엔드 서버 연결됨:', data);
      return { connected: true, data };
    }
  } catch (error) {
    console.warn('❌ 백엔드 서버 연결 실패:', error.message);
    return { connected: false, error: error.message };
  }
};

// 🆕 실제 메시지 전송 함수 (백엔드 사용)
export const sendRealMessage = async (messageData) => {
  try {
    console.log('🚀 실제 백엔드로 메시지 전송 시도:', {
      target: `${BACKEND_IP}:${BACKEND_PORT}`,
      deviceId: messageData.deviceId,
      content: messageData.content?.substring(0, 30)
    });

    const response = await api.post('/api/messages/text', messageData);

    if (response.data.success) {
      console.log('✅ 실제 메시지 전송 성공:', response.data);
      return response.data;
    } else {
      throw new Error(response.data.message || '메시지 전송 실패');
    }
  } catch (error) {
    console.error('❌ 실제 메시지 전송 실패:', error);

    // 실패시 Mock으로 폴백
    console.log('🔄 Mock 모드로 폴백...');
    return getMockResponse({
      url: '/api/messages/text',
      method: 'POST',
      data: JSON.stringify(messageData)
    }).then(mockResponse => mockResponse.data);
  }
};

// 유틸리티 함수들
export const apiUtils = {
  getErrorMessage: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return '알 수 없는 오류가 발생했습니다.';
  },

  validateRoomNumber: (roomNumber, isUrgent = false) => {
    const num = parseInt(roomNumber);

    if (isNaN(num) || num < 1 || num > 100) {
      throw new Error('방번호는 1~100 사이여야 합니다.');
    }

    if (isUrgent && (num < 1 || num > 5)) {
      throw new Error('긴급 메시지는 1~5번 방을 사용해야 합니다.');
    }

    if (!isUrgent && num < 6) {
      throw new Error('일반 메시지는 6번 이상의 방을 사용해야 합니다.');
    }

    return num;
  },

  validateMessageContent: (content) => {
    if (!content || content.trim().length === 0) {
      throw new Error('메시지 내용을 입력해주세요.');
    }

    if (content.length > 1000) {
      throw new Error('메시지 내용은 1000자 이하여야 합니다.');
    }

    return true;
  },

  validateImageData: (imageData) => {
    if (!imageData || !imageData.base64) {
      throw new Error('유효한 이미지 데이터가 필요합니다.');
    }

    if (imageData.size && imageData.size > 5242880) {
      throw new Error('이미지 파일 크기는 5MB 이하여야 합니다.');
    }

    return true;
  },

  validateDisplayOptions: (displayOptions) => {
    if (displayOptions?.fontSize && (displayOptions.fontSize < 8 || displayOptions.fontSize > 80)) {
      throw new Error('폰트 크기는 8px에서 80px 사이여야 합니다.');
    }
    return true;
  },

  validateSchedule: (schedule) => {
    if (schedule?.startTime && schedule?.endTime) {
      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);

      if (startTime >= endTime) {
        throw new Error('종료 시간이 시작 시간보다 늦어야 합니다.');
      }
    }
    return true;
  }
};

export default apiService;