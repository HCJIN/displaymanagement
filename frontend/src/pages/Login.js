// src/pages/Login.js - 로그인 페이지
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  InputAdornment,
  IconButton,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AccountCircle,
  Lock,
  DisplaySettings,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // 에러 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 입력 시 에러 클리어
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(formData.username, formData.password);

      if (result.success) {
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('로그인 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  // 테스트 계정 정보
  const testAccounts = [
    { username: 'admin', password: 'admin123!', role: '관리자', permissions: '모든 권한' },
    { username: 'operator1', password: 'operator123!', role: '운영자', permissions: '메시지 전송, 디바이스 제어' },
    { username: 'viewer1', password: 'viewer123!', role: '관람자', permissions: '조회만 가능' },
  ];

  const handleTestLogin = (username, password) => {
    setFormData({ username, password });
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* 로고 및 제목 */}
          <Box textAlign="center" mb={4}>
            <DisplaySettings
              sx={{
                fontSize: 64,
                color: 'primary.main',
                mb: 2,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
              }}
            />
            <Typography variant="h4" component="h1" fontWeight="bold" color="primary" gutterBottom>
              전광판 관리 시스템
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Display Management System
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 로그인 폼 */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="username"
              label="사용자명"
              value={formData.username}
              onChange={handleInputChange}
              margin="normal"
              required
              autoComplete="username"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircle color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              name="password"
              label="패스워드"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              margin="normal"
              required
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePassword}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting || !formData.username || !formData.password}
              sx={{
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: 2,
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976d2 30%, #1cb5e0 90%)',
                },
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '로그인'
              )}
            </Button>
          </Box>

          {/* 테스트 계정 정보 */}
          <Box mt={4}>
            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="textSecondary">
                테스트 계정
              </Typography>
            </Divider>

            <Box display="flex" flexDirection="column" gap={2}>
              {testAccounts.map((account, index) => (
                <Card
                  key={index}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      transform: 'translateY(-1px)',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => handleTestLogin(account.username, account.password)}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {account.role}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {account.username} / {account.password}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {account.permissions}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Typography variant="caption" color="textSecondary" textAlign="center" display="block" mt={2}>
              테스트 계정을 클릭하면 자동으로 입력됩니다.
            </Typography>
          </Box>

          {/* 푸터 */}
          <Box textAlign="center" mt={4}>
            <Typography variant="body2" color="textSecondary">
              © 2025 전광판 관리 시스템. All rights reserved.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;