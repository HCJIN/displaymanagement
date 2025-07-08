// server.js - 서버 시작점 (Socket.IO + ID 기반 전광판 소켓 통합 + 테스트 디바이스 하트비트 관리)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const aedes = require('aedes');
const net = require('net');
const app = require('./src/app');
const socketService = require('./src/services/socketService'); // ✅ ID 기반 소켓 서비스 추가
const Device = require('./src/models/Device'); // ✅ Device 모델 추가
const User = require('./src/models/User'); // ✅ User 모델 추가

// 포트 설정 - 5002로 변경
const PORT = process.env.PORT || 5002;

// MQTT 브로커 설정 및 실행 (aedes 사용)
const mqttBroker = aedes({
  id: 'display-mqtt-broker',
  heartbeatInterval: 60000,
  connectTimeout: 30000
});

// MQTT 서버 생성
const mqttServer = net.createServer(mqttBroker.handle);

// MQTT 브로커 이벤트 핸들러
mqttBroker.on('client', (client) => {
  console.log('📱 MQTT 클라이언트 연결됨:', client.id);
});

mqttBroker.on('clientDisconnect', (client) => {
  console.log('📱 MQTT 클라이언트 연결 해제됨:', client.id);
});

mqttBroker.on('publish', (packet, client) => {
  if (client && packet.topic && !packet.topic.startsWith('$SYS')) {
    console.log('📨 MQTT 메시지 발행:', {
      topic: packet.topic,
      clientId: client ? client.id : 'broker',
      payload: packet.payload.toString().substring(0, 100) + '...'
    });
  }
});

// MQTT 인증 (모든 연결 허용)
mqttBroker.authenticate = (client, username, password, callback) => {
  console.log('🔐 MQTT 인증 시도:', {
    clientId: client.id,
    username: username
  });
  callback(null, true);
};

// MQTT 서버 시작 (주석처리: 외부 EMQX Cloud 사용)
// mqttServer.listen(1883, () => {
//   console.log('🚀 MQTT 브로커가 시작되었습니다.');
//   console.log('   포트: 1883');
// });

// 서버 및 Socket.IO 생성
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO 연결 처리 (기존 웹 클라이언트용)
io.on('connection', (socket) => {
  console.log(`✅ 웹 소켓 연결됨: ${socket.id}`);

  // 사용자 참가
  socket.on('user:join', (data) => {
    console.log(`👤 사용자 참가: ${data.username} (${data.role})`);
    socket.userId = data.userId;
    socket.username = data.username;
    socket.role = data.role;

    // 사용자별 룸에 참가
    socket.join(`user:${data.userId}`);
    if (data.role === 'admin') {
      socket.join('admin');
    }

    // ✅ 연결된 전광판 정보 전송
    const connectedDevices = socketService.getConnectedDevices();
    socket.emit('devices:status', {
      connectedDevices,
      stats: socketService.getConnectionStats()
    });
  });

  // 디바이스 룸 참가
  socket.on('room:join', (data) => {
    socket.join(data.roomId);
    console.log(`📡 룸 참가: ${socket.username} -> ${data.roomId}`);
  });

  // 디바이스 룸 나가기
  socket.on('room:leave', (data) => {
    socket.leave(data.roomId);
    console.log(`📤 룸 나가기: ${socket.username} -> ${data.roomId}`);
  });

  // ✅ 전광판 상태 요청
  socket.on('devices:getStatus', () => {
    const stats = socketService.getConnectionStats();
    socket.emit('devices:status', stats);
  });

  // ✅ 전광판 메시지 전송 요청
  socket.on('device:sendMessage', async (data) => {
    try {
      const { deviceId, messageData } = data;

      if (socketService.isDeviceConnected(deviceId)) {
        await socketService.sendMessage(deviceId, messageData);

        // 성공 알림을 모든 관리자에게 브로드캐스트
        io.to('admin').emit('device:messageSuccess', {
          deviceId,
          messageData,
          timestamp: new Date().toISOString()
        });

        socket.emit('device:messageResult', {
          success: true,
          message: '메시지가 전송되었습니다.',
          deviceId
        });
      } else {
        socket.emit('device:messageResult', {
          success: false,
          message: '디바이스가 연결되어 있지 않습니다.',
          deviceId
        });
      }
    } catch (error) {
      socket.emit('device:messageResult', {
        success: false,
        message: error.message,
        deviceId: data.deviceId
      });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`❌ 웹 소켓 연결 해제: ${socket.id} (${socket.username || 'Unknown'})`);
  });
});

// app에 io 인스턴스 전달 (필요한 경우)
app.set('io', io);

// ✅ 전광판 이벤트를 웹 클라이언트에 브로드캐스트하는 함수
function broadcastDeviceEvent(eventType, data) {
  io.emit(`device:${eventType}`, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

// ✅ socketService에 이벤트 발생기 설정
socketService.setEventEmitter(broadcastDeviceEvent);

// ✅ 서버 시작 함수
async function startServer() {
  try {
    // 🔧 사용자 데이터 초기화 (패스워드 복구)
    User.initializeUsers();

    // Socket.IO 서버 시작 (모든 네트워크 인터페이스에서 접근 가능)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📋 API 문서: http://localhost:${PORT}/api/docs`);
      console.log(`❤️ 헬스 체크: http://localhost:${PORT}/health`);
      console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 Socket.IO 서버 활성화됨 (웹 클라이언트용)`);
      console.log(`🌐 외부 접근: http://192.168.0.58:${PORT}`);
    });

    // ✅ ID 기반 전광판 소켓 서비스 시작
    await socketService.start();
    console.log(`🎯 ID 기반 전광판 소켓 서비스 시작됨 (포트: ${socketService.port})`);

    // 하트비트 및 Device ID 검증 체크 시작
    socketService.startHeartbeatCheck();
    socketService.startDeviceIdVerificationCheck();
    console.log(`💓 하트비트 및 Device ID 검증 모니터링 시작됨`);

    console.log(`✨ 모든 서비스가 성공적으로 시작되었습니다!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📡 웹 클라이언트: ws://localhost:${PORT} (Socket.IO)`);
    console.log(`🎯 전광판 연결: tcp://localhost:${socketService.port} (ID 기반)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  } catch (error) {
    console.error('💥 서버 시작 실패:', error);
    process.exit(1);
  }
}

// ✅ 정기적으로 웹 클라이언트에 전광판 상태 업데이트 전송
setInterval(() => {
  const stats = socketService.getConnectionStats();
  io.emit('devices:statsUpdate', stats);
}, 30000); // 30초마다

// 🆕 테스트 디바이스 하트비트 유지 (별도 인터벌)
setInterval(() => {
  try {
    const maintainedCount = Device.maintainTestDeviceHeartbeats();
    if (maintainedCount > 0) {
      console.log(`🧪 테스트 디바이스 하트비트 유지: ${maintainedCount}개`);

      // 웹 클라이언트에 테스트 디바이스 상태 업데이트
      const stats = socketService.getConnectionStats();
      io.emit('devices:testHeartbeat', {
        maintainedDevices: maintainedCount,
        stats: stats,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('테스트 디바이스 하트비트 유지 실패:', error);
  }
}, 60000); // 1분마다

// 🆕 연결 상태 동기화 (5분마다)
setInterval(() => {
  try {
    console.log('🔄 연결 상태 동기화 시작...');

    // 모든 디바이스의 연결 상태 확인
    const allDevices = Device.findAll();
    let syncCount = 0;

    allDevices.forEach(device => {
      const isTest = Device.isTestDevice(device);

      if (isTest) {
        // 테스트 디바이스: socketService에 등록되어 있으면 온라인 유지
        if (socketService.isDeviceConnected(device.deviceId)) {
          if (device.status !== 'online') {
            device.updateStatus('online');
            syncCount++;
          }
        }
      } else {
        // 실제 디바이스: 연결 상태 동기화
        const isConnected = socketService.isDeviceConnected(device.deviceId);
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
      console.log(`✅ 연결 상태 동기화 완료: ${syncCount}개 업데이트`);

      // 동기화 후 상태 브로드캐스트
      const stats = socketService.getConnectionStats();
      io.emit('devices:statusSync', {
        syncedDevices: syncCount,
        stats: stats,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('연결 상태 동기화 실패:', error);
  }
}, 300000); // 5분마다

// 🆕 디바이스 상태 리포트 (10분마다)
setInterval(() => {
  try {
    const stats = Device.getStats();
    const systemReport = {
      timestamp: new Date().toISOString(),
      devices: {
        total: stats.total,
        online: stats.online,
        offline: stats.offline,
        test: stats.testDevices,
        real: stats.realDevices
      },
      connections: {
        socketConnections: socketService.clients.size,
        testHeartbeats: socketService.testHeartbeatIntervals ? socketService.testHeartbeatIntervals.size : 0
      }
    };

    console.log('📊 시스템 상태 리포트:', systemReport);

    // 관리자에게만 상세 리포트 전송
    io.to('admin').emit('system:report', systemReport);
  } catch (error) {
    console.error('시스템 리포트 생성 실패:', error);
  }
}, 600000); // 10분마다

// ✅ 우아한 종료 처리 (기존 + 전광판 소켓 서비스)
const gracefulShutdown = async () => {
  console.log('🔄 서버 종료 중...');

  try {
    // 전광판 소켓 서비스 종료
    await socketService.stop();
    console.log('🎯 전광판 소켓 서비스 종료됨');

    // Socket.IO 서버 종료
    io.close(() => {
      console.log('📡 Socket.IO 서버 종료됨');
    });

    // HTTP 서버 종료
    server.close(() => {
      console.log('✅ 서버가 정상적으로 종료되었습니다.');
      process.exit(0);
    });

  } catch (error) {
    console.error('💥 서버 종료 중 오류:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 예상치 못한 에러 처리
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ✅ 서버 시작
startServer();

module.exports = server;