// src/context/AuthContext.js - 설정 저장 및 자동 로그아웃 기능 완전 구현
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ✅ 자동 로그아웃 타이머 관리
  const logoutTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const throttleRef = useRef(null); // ✅ 스로틀링을 위한 ref

  // API 기본 URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

  // ✅ 자동 로그아웃 타이머 설정
  const setupAutoLogout = (isInitial = false) => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    if (state.user?.settings?.autoLogout) {
      const timeoutMinutes = state.user.settings.autoLogout;
      const timeoutMs = timeoutMinutes * 60 * 1000; // 분을 밀리초로 변환

      // ✅ 초기 설정이나 설정 변경 시에만 로그 출력
      if (isInitial) {
        console.log(`⏰ 자동 로그아웃 타이머 설정: ${timeoutMinutes}분`);
      }

      logoutTimerRef.current = setTimeout(() => {
        console.log('⏰ 자동 로그아웃 실행');
        logout();
      }, timeoutMs);
    }
  };

  // ✅ 사용자 활동 감지 및 타이머 재설정 (스로틀링 적용)
  const resetAutoLogoutTimer = () => {
    // ✅ 1초마다 한 번만 타이머 재설정 (스로틀링)
    if (throttleRef.current) {
      return;
    }

    throttleRef.current = setTimeout(() => {
      lastActivityRef.current = Date.now();
      setupAutoLogout(false); // 로그 출력하지 않음
      throttleRef.current = null;
    }, 1000); // 1초 스로틀링
  };

  // ✅ 사용자 활동 이벤트 리스너
  useEffect(() => {
    if (state.isAuthenticated && state.user?.settings?.autoLogout) {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

      const handleActivity = () => {
        resetAutoLogoutTimer();
      };

      events.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });

      setupAutoLogout(true); // ✅ 초기 타이머 설정 (로그 출력)

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
        if (logoutTimerRef.current) {
          clearTimeout(logoutTimerRef.current);
        }
        // ✅ 스로틀링 타이머도 정리
        if (throttleRef.current) {
          clearTimeout(throttleRef.current);
          throttleRef.current = null;
        }
      };
    }
  }, [state.isAuthenticated, state.user?.settings?.autoLogout]);

  // 초기 로드 시 토큰 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('userInfo');

    if (token && userInfo) {
      try {
        const user = JSON.parse(userInfo);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token }
        });
        console.log('✅ 로컬 스토리지에서 사용자 정보 복원:', user);
      } catch (error) {
        console.error('사용자 정보 파싱 오류:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        dispatch({ type: 'AUTH_FAILURE', payload: 'Invalid user data' });
      }
    } else if (token) {
      // 토큰만 있고 사용자 정보가 없으면 서버에서 확인
      verifyToken(token);
    } else {
      dispatch({ type: 'AUTH_FAILURE', payload: 'No token found' });
    }
  }, []);

  // 토큰 검증
  const verifyToken = async (token) => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // ✅ 사용자 정보를 localStorage에도 저장
          localStorage.setItem('userInfo', JSON.stringify(data.user));

          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: data.user,
              token: token,
            },
          });
        } else {
          throw new Error(data.message || 'Authentication failed');
        }
      } else {
        // 🔧 401 에러일 경우 토큰 만료로 간주하고 로그아웃
        if (response.status === 401) {
          console.log('🔐 토큰 만료, 자동 로그아웃 처리');
          logout();
          return;
        }
        throw new Error('Token verification failed');
      }
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
    }
  };

  // 로그인
  const login = async (username, password) => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // ✅ 토큰과 사용자 정보 모두 localStorage에 저장
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: data.user,
            token: data.token,
          },
        });

        console.log('✅ 로그인 성공, 사용자 정보 저장:', data.user);
        return { success: true };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      return { success: false, error: error.message };
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // 서버에 로그아웃 요청 (선택사항)
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // ✅ 모든 저장된 정보 제거
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');

      // ✅ 자동 로그아웃 타이머 정리
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }

      // ✅ 스로틀링 타이머도 정리
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }

      dispatch({ type: 'AUTH_LOGOUT' });
      console.log('✅ 로그아웃 완료');
    }
  };

  // 패스워드 변경
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true, message: data.message };
      } else {
        throw new Error(data.message || 'Password change failed');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ✅ 사용자 정보 업데이트 (localStorage 동기화 포함)
  const updateUser = (userData) => {
    console.log('🔄 사용자 정보 업데이트:', userData);

    // ✅ 현재 사용자와 새 데이터를 병합
    const updatedUser = { ...state.user, ...userData };

    // ✅ Redux 상태 업데이트
    dispatch({ type: 'AUTH_UPDATE_USER', payload: userData });

    // ✅ localStorage에도 저장
    localStorage.setItem('userInfo', JSON.stringify(updatedUser));

    console.log('✅ 사용자 정보 업데이트 완료:', updatedUser);

    // ✅ 설정이 변경되면 자동 로그아웃 타이머 재설정
    if (userData.settings?.autoLogout && userData.settings.autoLogout !== state.user?.settings?.autoLogout) {
      console.log('⏰ 자동 로그아웃 설정 변경됨:', userData.settings.autoLogout + '분');
      setupAutoLogout(true); // 설정 변경 시에만 로그 출력
    }
  };

  // 에러 초기화
  const clearError = () => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  // 권한 확인
  const hasPermission = (permission) => {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    return state.user.permissions && state.user.permissions.includes(permission);
  };

  // 역할 확인
  const hasRole = (role) => {
    if (!state.user) return false;
    return state.user.role === role;
  };

  const value = {
    ...state,
    login,
    logout,
    changePassword,
    updateUser,
    clearError,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};