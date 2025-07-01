// src/components/common/Layout.js - 메인 레이아웃 컴포넌트
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  DevicesOther,
  Send,
  History,
  People,
  Settings,
  AccountCircle,
  Logout,
  ChevronLeft,
  Notifications,
  DisplaySettings,
  Message,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const drawerWidth = 240;

const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { isConnected } = useSocket();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // 네비게이션 메뉴 아이템들
  const menuItems = [
    {
      text: '대시보드',
      icon: <Dashboard />,
      path: '/dashboard',
      permission: null
    },
    {
      text: '전광판 관리',
      icon: <DevicesOther />,
      path: '/devices',
      permission: null
    },
    {
      text: '메시지 전송',
      icon: <Send />,
      path: '/messages/send',
      permission: 'message_send'
    },
    {
      text: '메시지 이력',
      icon: <History />,
      path: '/messages/history',
      permission: null
    },
    {
      text: '사용자 관리',
      icon: <People />,
      path: '/users',
      permission: 'user_manage'
    },
    {
      text: '설정',
      icon: <Settings />,
      path: '/settings',
      permission: null
    }
  ];

  // 권한에 따른 메뉴 필터링
  const filteredMenuItems = menuItems.filter(item =>
    !item.permission || hasPermission(item.permission)
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const handleMenuItemClick = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // 사이드바 콘텐츠
  const drawer = (
    <Box>
      {/* 로고 및 제목 */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DisplaySettings color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h6" component="div" color="primary" fontWeight="bold">
          전광판 관리
        </Typography>
      </Box>

      <Divider />

      {/* 사용자 정보 */}
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {user?.profile?.firstName?.[0] || user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <Box flex={1}>
            <Typography variant="subtitle2" fontWeight="bold">
              {user?.profile?.firstName || user?.username}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {user?.role === 'admin' ? '관리자' :
                user?.role === 'operator' ? '운영자' : '관람자'}
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={isConnected ? '온라인' : '오프라인'}
            color={isConnected ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      <Divider />

      {/* 메뉴 목록 */}
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleMenuItemClick(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 'bold',
                  },
                },
              }}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* 앱바 */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {filteredMenuItems.find(item => item.path === location.pathname)?.text || '전광판 관리 시스템'}
          </Typography>

          {/* 알림 아이콘 */}
          <Tooltip title="알림">
            <IconButton color="inherit">
              <Badge badgeContent={0} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* 사용자 메뉴 */}
          <Tooltip title="사용자 메뉴">
            <IconButton
              color="inherit"
              onClick={handleUserMenuOpen}
              sx={{ ml: 1 }}
            >
              <AccountCircle />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => { handleUserMenuClose(); navigate('/settings'); }}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              <ListItemText>설정</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText>로그아웃</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* 사이드바 */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* 모바일 드로어 */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* 데스크톱 드로어 */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* 메인 콘텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar /> {/* 앱바 높이만큼 여백 */}
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;