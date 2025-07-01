// src/App.js - 동적 테마 지원 메인 React 앱 컴포넌트
import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/common/PrivateRoute';
import Layout from './components/common/Layout';

// 페이지 컴포넌트
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DeviceList from './pages/DeviceList';
import DeviceControl from './pages/DeviceControl';
import AddDevice from './pages/AddDevice';
import MessageSend from './pages/MessageSend';
import MessageHistory from './pages/MessageHistory';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';

// ✅ 동적 테마 생성 함수
const createAppTheme = (userTheme = 'light') => {
  // ✅ 시스템 다크 모드 감지
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // ✅ 테마 모드 결정
  let themeMode = 'light';
  if (userTheme === 'dark') {
    themeMode = 'dark';
  } else if (userTheme === 'auto') {
    themeMode = systemPrefersDark ? 'dark' : 'light';
  }

  console.log('🎨 테마 생성:', { userTheme, systemPrefersDark, themeMode });

  return createTheme({
    palette: {
      mode: themeMode,
      primary: {
        main: themeMode === 'dark' ? '#90caf9' : '#1976d2',
        light: themeMode === 'dark' ? '#e3f2fd' : '#42a5f5',
        dark: themeMode === 'dark' ? '#42a5f5' : '#1565c0',
      },
      secondary: {
        main: themeMode === 'dark' ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: themeMode === 'dark' ? '#121212' : '#f5f5f5',
        paper: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
      text: {
        primary: themeMode === 'dark' ? '#ffffff' : '#000000',
        secondary: themeMode === 'dark' ? '#b0b0b0' : '#666666',
      },
      error: {
        main: themeMode === 'dark' ? '#f44336' : '#f44336',
      },
      warning: {
        main: themeMode === 'dark' ? '#ff9800' : '#ff9800',
      },
      success: {
        main: themeMode === 'dark' ? '#4caf50' : '#4caf50',
      },
    },
    typography: {
      fontFamily: [
        'Noto Sans KR',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize: '2.125rem',
        fontWeight: 500,
      },
      h2: {
        fontSize: '1.75rem',
        fontWeight: 500,
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 500,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 500,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 500,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: themeMode === 'dark'
              ? '0 2px 8px rgba(0,0,0,0.3)'
              : '0 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: themeMode === 'dark'
              ? '0 1px 3px rgba(0,0,0,0.3)'
              : '0 1px 3px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
          },
        },
      },
    },
  });
};

// ✅ 테마를 적용하는 내부 컴포넌트
const ThemedApp = () => {
  const { user } = useAuth();

  // ✅ 사용자 설정에 따른 동적 테마 생성
  const theme = useMemo(() => {
    const userTheme = user?.settings?.theme || 'light';
    return createAppTheme(userTheme);
  }, [user?.settings?.theme]);

  // ✅ 시스템 테마 변경 감지 (auto 모드일 때)
  React.useEffect(() => {
    if (user?.settings?.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        // 테마가 auto일 때만 시스템 테마 변경에 반응
        console.log('🎨 시스템 테마 변경 감지:', mediaQuery.matches ? 'dark' : 'light');
        // React의 상태 변경을 트리거하기 위해 강제로 리렌더링
        window.dispatchEvent(new Event('resize'));
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [user?.settings?.theme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SocketProvider>
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Routes>
              {/* 로그인 페이지 */}
              <Route path="/login" element={<Login />} />

              {/* 보호된 라우트들 */}
              <Route
                path="/*"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Routes>
                        {/* 대시보드 */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />

                        {/* 디바이스 관리 - ⚠️ 순서가 중요! 구체적인 경로를 먼저 */}
                        <Route path="/devices" element={<DeviceList />} />
                        <Route
                          path="/devices/add"
                          element={
                            <PrivateRoute requiredPermission="device_control">
                              <AddDevice />
                            </PrivateRoute>
                          }
                        />
                        <Route path="/devices/:deviceId" element={<DeviceControl />} />

                        {/* 메시지 관리 */}
                        <Route path="/messages/send" element={<MessageSend />} />
                        <Route path="/messages/history" element={<MessageHistory />} />

                        {/* 사용자 관리 (관리자만) */}
                        <Route
                          path="/users"
                          element={
                            <PrivateRoute requiredPermission="user_manage">
                              <UserManagement />
                            </PrivateRoute>
                          }
                        />

                        {/* 설정 */}
                        <Route path="/settings" element={<Settings />} />

                        {/* 404 처리 */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Layout>
                  </PrivateRoute>
                }
              />
            </Routes>
          </Box>
        </Router>
      </SocketProvider>
    </ThemeProvider>
  );
};

// ✅ 메인 App 컴포넌트
function App() {
  return (
    <AuthProvider>
      <ThemedApp />
    </AuthProvider>
  );
}

export default App;