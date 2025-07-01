// src/components/common/PrivateRoute.js - 보호된 라우트 컴포넌트
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const PrivateRoute = ({ children, requiredPermission = null, requiredRole = null }) => {
  const { isAuthenticated, isLoading, user, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // 로딩 중
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

  // 인증되지 않은 경우
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 특정 권한이 필요한 경우
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Box p={3}>
        <Alert severity="error">
          이 페이지에 접근할 권한이 없습니다. 필요한 권한: {requiredPermission}
        </Alert>
      </Box>
    );
  }

  // 특정 역할이 필요한 경우
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Box p={3}>
        <Alert severity="error">
          이 페이지에 접근할 권한이 없습니다. 필요한 역할: {requiredRole}
        </Alert>
      </Box>
    );
  }

  return children;
};

export default PrivateRoute;