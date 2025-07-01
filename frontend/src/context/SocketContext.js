// src/context/SocketContext.js - Socket.IO 컨텍스트
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// 컨텍스트 생성
const SocketContext = createContext();

// 커스텀 훅
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// 프로바이더 컴포넌트
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const { isAuthenticated, token, user } = useAuth();

  // 소켓 연결
  const connectSocket = useCallback(() => {
    if (!isAuthenticated || !token || socket) return;

    console.log('소켓 연결 시도...');

    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 5000,
      retries: 3
    });

    // 연결 이벤트
    newSocket.on('connect', () => {
      console.log('소켓 연결됨:', newSocket.id);
      setIsConnected(true);

      // 사용자 정보 전송
      newSocket.emit('user:join', {
        userId: user?.id,
        username: user?.username,
        role: user?.role
      });
    });

    // 연결 해제 이벤트
    newSocket.on('disconnect', (reason) => {
      console.log('소켓 연결 해제:', reason);
      setIsConnected(false);
    });

    // 연결 오류 이벤트
    newSocket.on('connect_error', (error) => {
      console.error('소켓 연결 오류:', error);
      setIsConnected(false);
    });

    // 재연결 이벤트
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('소켓 재연결됨:', attemptNumber);
      setIsConnected(true);
    });

    // 인증 오류 이벤트
    newSocket.on('auth_error', (error) => {
      console.error('소켓 인증 오류:', error);
      disconnectSocket();
    });

    // 일반 메시지 수신
    newSocket.onAny((eventName, ...args) => {
      console.log('소켓 이벤트 수신:', eventName, args);
      setLastMessage({ event: eventName, data: args, timestamp: new Date() });
    });

    setSocket(newSocket);
  }, [isAuthenticated, token, user, socket]);

  // 소켓 연결 해제
  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('소켓 연결 해제...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  // 메시지 전송
  const emit = useCallback((event, data, callback) => {
    if (socket && isConnected) {
      socket.emit(event, data, callback);
    } else {
      console.warn('소켓이 연결되지 않았습니다.');
    }
  }, [socket, isConnected]);

  // 이벤트 리스너 등록
  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
    return () => { };
  }, [socket]);

  // 이벤트 리스너 제거
  const off = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  // 일회성 이벤트 리스너
  const once = useCallback((event, callback) => {
    if (socket) {
      socket.once(event, callback);
    }
  }, [socket]);

  // 인증 상태 변화 시 소켓 연결/해제
  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, token]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  // 컨텍스트 값
  const value = {
    // 상태
    socket,
    isConnected,
    lastMessage,

    // 메서드
    emit,
    on,
    off,
    once,
    connect: connectSocket,
    disconnect: disconnectSocket,

    // 편의 메서드들
    joinRoom: (roomId) => emit('room:join', { roomId }),
    leaveRoom: (roomId) => emit('room:leave', { roomId }),

    // 디바이스 관련 이벤트
    subscribeToDeviceUpdates: (callback) => on('device:status_changed', callback),
    subscribeToMessageUpdates: (callback) => on('message:status_changed', callback),

    // 실시간 알림
    subscribeToNotifications: (callback) => on('notification:new', callback),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};