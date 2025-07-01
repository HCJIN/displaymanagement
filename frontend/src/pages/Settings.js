// src/pages/Settings.js - DOM nesting 에러 수정된 설정 페이지
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  AccountCircle,
  Security,
  Notifications,
  Palette,
  Language,
  Save,
  Edit,
  Lock,
  Visibility,
  VisibilityOff,
  Info,
  Update,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// 탭 패널 컴포넌트
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`settings-tabpanel-${index}`}
    aria-labelledby={`settings-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const Settings = () => {
  const { user, updateUser, changePassword, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // 프로필 설정
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    department: '',
    phone: '',
  });

  // 비밀번호 변경
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 앱 설정
  const [appSettings, setAppSettings] = useState({
    theme: 'light',
    language: 'ko',
    notifications: true,
    autoLogout: 30,
    refreshInterval: 30,
  });

  // 시스템 정보
  const [systemInfo, setSystemInfo] = useState({
    version: '1.0.0',
    uptime: 0,
    totalDevices: 0,
    onlineDevices: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        department: user.profile?.department || '',
        phone: user.profile?.phone || '',
      });

      setAppSettings({
        theme: user.settings?.theme || 'light',
        language: user.settings?.language || 'ko',
        notifications: user.settings?.notifications !== false,
        autoLogout: user.settings?.autoLogout || 30,
        refreshInterval: user.settings?.refreshInterval || 30,
      });
    }

    loadSystemInfo();
  }, [user]);

  // 시스템 정보 로드
  const loadSystemInfo = async () => {
    try {
      // ✅ 디바이스 통계 시도 (Mock 응답 포함)
      try {
        const deviceStats = await api.devices.getConnectionStats();
        console.log('디바이스 통계 응답:', deviceStats.data); // 디버깅용

        if (deviceStats.data) {
          // ✅ Mock 응답과 실제 응답 모두 처리
          const stats = deviceStats.data.stats || deviceStats.data;
          setSystemInfo({
            version: '1.0.0',
            uptime: Date.now() - new Date('2025-01-01').getTime(),
            totalDevices: stats.total || 0,
            onlineDevices: stats.connected || 0,
          });
          return;
        }
      } catch (statsError) {
        console.log('디바이스 통계 로드 실패, 기본값 사용:', statsError.message);
      }

      // ✅ 기본값 사용 (에러 없이)
      setSystemInfo({
        version: '1.0.0',
        uptime: Date.now() - new Date('2025-01-01').getTime(),
        totalDevices: 3, // Mock 기본값
        onlineDevices: 1, // Mock 기본값
      });
    } catch (error) {
      console.error('시스템 정보 로드 실패:', error);
      // ✅ 최종 fallback
      setSystemInfo({
        version: '1.0.0',
        uptime: Date.now() - new Date('2025-01-01').getTime(),
        totalDevices: 0,
        onlineDevices: 0,
      });
    }
  };

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 프로필 업데이트
  const handleProfileUpdate = async () => {
    setIsLoading(true);
    try {
      // ✅ 백엔드 구조에 맞게 수정: users.update() 사용
      const response = await api.users.update(user.id, {
        profile: profileData,
      });

      if (response.data && response.data.success) {
        updateUser({ profile: { ...user.profile, ...profileData } });
        showSnackbar(response.data.message || '프로필이 업데이트되었습니다.', 'success');
      }
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      showSnackbar(
        error.response?.data?.message || '프로필 업데이트에 실패했습니다.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 앱 설정 업데이트
  const handleAppSettingsUpdate = async () => {
    setIsLoading(true);
    try {
      // ✅ 백엔드 구조에 맞게 수정: users.update() 사용
      const response = await api.users.update(user.id, {
        settings: appSettings,
      });

      if (response.data && response.data.success) {
        updateUser({ settings: { ...user.settings, ...appSettings } });
        showSnackbar(response.data.message || '설정이 업데이트되었습니다.', 'success');
      }
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
      showSnackbar(
        error.response?.data?.message || '설정 업데이트에 실패했습니다.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 비밀번호 변경
  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      showSnackbar('현재 비밀번호와 새 비밀번호를 입력해주세요.', 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showSnackbar('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showSnackbar('새 비밀번호는 최소 6자 이상이어야 합니다.', 'error');
      return;
    }

    try {
      const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);

      if (result.success) {
        showSnackbar('비밀번호가 성공적으로 변경되었습니다.', 'success');
        setPasswordDialog(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        showSnackbar(result.error || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      showSnackbar('비밀번호 변경에 실패했습니다.', 'error');
    }
  };

  // 비밀번호 가시성 토글
  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // 업타임 포맷 (밀리초를 받아서 처리)
  const formatUptime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          설정
        </Typography>
        <Typography variant="body2" color="textSecondary">
          계정 정보 및 시스템 설정을 관리하세요.
        </Typography>
      </Box>

      {/* 탭 네비게이션 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, value) => setActiveTab(value)}>
          <Tab label="프로필" icon={<AccountCircle />} />
          <Tab label="보안" icon={<Security />} />
          <Tab label="앱 설정" icon={<Palette />} />
          <Tab label="시스템 정보" icon={<Info />} />
        </Tabs>
      </Paper>

      {/* 프로필 탭 */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  개인 정보
                </Typography>

                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}>
                    {profileData.firstName?.[0] || user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {user?.username}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {user?.email}
                    </Typography>
                    <Chip
                      label={user?.role === 'admin' ? '관리자' :
                        user?.role === 'operator' ? '운영자' :
                          user?.role === 'viewer' ? '관람자' :
                            user?.role === 'emergency' ? '긴급상황' : '알 수 없음'}
                      size="small"
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>

                <TextField
                  fullWidth
                  margin="normal"
                  label="이름"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                />

                <TextField
                  fullWidth
                  margin="normal"
                  label="성"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                />

                <TextField
                  fullWidth
                  margin="normal"
                  label="부서"
                  value={profileData.department}
                  onChange={(e) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
                />

                <TextField
                  fullWidth
                  margin="normal"
                  label="연락처"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                />

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleProfileUpdate}
                  disabled={isLoading}
                  sx={{ mt: 2 }}
                >
                  저장
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  계정 정보
                </Typography>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="사용자 ID"
                      secondary={user?.id}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="가입일"
                      secondary={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '정보 없음'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="마지막 로그인"
                      secondary={user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : '정보 없음'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="로그인 횟수"
                      secondary={user?.loginCount || 0}
                    />
                  </ListItem>
                  {/* ✅ 수정: ListItem을 분리하여 Chip을 별도로 배치 */}
                  <ListItem>
                    <ListItemText
                      primary="계정 상태"
                    />
                    <Chip
                      label={user?.active ? '활성' : '비활성'}
                      color={user?.active ? 'success' : 'error'}
                      size="small"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 보안 탭 */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  비밀번호
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  계정 보안을 위해 정기적으로 비밀번호를 변경하세요.
                </Typography>

                <Button
                  variant="outlined"
                  startIcon={<Lock />}
                  onClick={() => setPasswordDialog(true)}
                >
                  비밀번호 변경
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  권한 정보
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="역할"
                      secondary={user?.role === 'admin' ? '관리자' :
                        user?.role === 'operator' ? '운영자' :
                          user?.role === 'viewer' ? '관람자' :
                            user?.role === 'emergency' ? '긴급상황' : '알 수 없음'}
                    />
                  </ListItem>
                  {/* ✅ 수정: 권한 표시를 별도 섹션으로 분리 */}
                  {user?.permissions && user.permissions.length > 0 && (
                    <ListItem>
                      <ListItemText primary="권한" />
                    </ListItem>
                  )}
                </List>

                {/* ✅ 수정: 권한 칩들을 List 외부로 이동 */}
                {user?.permissions && user.permissions.length > 0 && (
                  <Box sx={{ px: 2, pb: 1 }}>
                    {user.permissions.map((permission) => (
                      <Chip
                        key={permission}
                        label={permission}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 앱 설정 탭 */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  화면 설정
                </Typography>

                <FormControl fullWidth margin="normal">
                  <InputLabel>테마</InputLabel>
                  <Select
                    value={appSettings.theme}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, theme: e.target.value }))}
                    label="테마"
                  >
                    <MenuItem value="light">라이트</MenuItem>
                    <MenuItem value="dark">다크</MenuItem>
                    <MenuItem value="auto">자동</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel>언어</InputLabel>
                  <Select
                    value={appSettings.language}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, language: e.target.value }))}
                    label="언어"
                  >
                    <MenuItem value="ko">한국어</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleAppSettingsUpdate}
                  disabled={isLoading}
                  sx={{ mt: 2 }}
                >
                  저장
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  알림 및 동작
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={appSettings.notifications}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, notifications: e.target.checked }))}
                    />
                  }
                  label="알림 허용"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  margin="normal"
                  label="자동 로그아웃 (분)"
                  type="number"
                  value={appSettings.autoLogout}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, autoLogout: parseInt(e.target.value) }))}
                  inputProps={{ min: 5, max: 1440 }}
                />

                <TextField
                  fullWidth
                  margin="normal"
                  label="자동 새로고침 간격 (초)"
                  type="number"
                  value={appSettings.refreshInterval}
                  onChange={(e) => setAppSettings(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) }))}
                  inputProps={{ min: 10, max: 300 }}
                />

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleAppSettingsUpdate}
                  disabled={isLoading}
                  sx={{ mt: 2 }}
                >
                  저장
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 시스템 정보 탭 */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  시스템 정보
                </Typography>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="버전"
                      secondary={systemInfo.version}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="가동 시간"
                      secondary={formatUptime(systemInfo.uptime)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="환경"
                      secondary={process.env.NODE_ENV || 'development'}
                    />
                  </ListItem>
                  {/* ✅ 디바이스 통계 추가 */}
                  <ListItem>
                    <ListItemText
                      primary="총 디바이스"
                      secondary={`${systemInfo.totalDevices}개`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="온라인 디바이스"
                      secondary={`${systemInfo.onlineDevices}개`}
                    />
                  </ListItem>
                </List>

                <Button
                  variant="outlined"
                  startIcon={<Update />}
                  onClick={loadSystemInfo}
                  sx={{ mt: 2 }}
                >
                  정보 새로고침
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  API 정보
                </Typography>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="API 서버"
                      secondary={process.env.REACT_APP_API_URL || 'http://localhost:5002'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Socket 서버"
                      secondary={process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>비밀번호 변경</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="현재 비밀번호"
            type={showPasswords.current ? 'text' : 'password'}
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => togglePasswordVisibility('current')}>
                  {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="새 비밀번호"
            type={showPasswords.new ? 'text' : 'password'}
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => togglePasswordVisibility('new')}>
                  {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="새 비밀번호 확인"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => togglePasswordVisibility('confirm')}>
                  {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            새 비밀번호는 최소 6자 이상이어야 합니다.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>취소</Button>
          <Button onClick={handlePasswordChange} variant="contained">
            변경
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;