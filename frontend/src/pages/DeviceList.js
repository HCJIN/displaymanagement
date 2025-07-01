// src/pages/DeviceList.js - 최소한의 수정 (기존 코드 보존)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  Avatar,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  DevicesOther,
  Settings,
  PowerSettingsNew,
  Wifi,
  WifiOff,
  MoreVert,
  Send,
  Clear,
  Refresh,
  Add,
  Edit,
  Delete,
  Visibility,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Science,
  Speed,
  Memory,
  Thermostat,
  Psychology,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
// ✅ 기존 import 방식 유지 (api → apiService로만 변경)
import apiService, { apiUtils } from '../services/api';

// 전광판 카드 컴포넌트
const DeviceCard = ({ device, onConnect, onDisconnect, onControl, onDelete, hasControlPermission }) => {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'connecting': return 'warning';
      case 'maintenance': return 'info';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return '온라인';
      case 'offline': return '오프라인';
      case 'connecting': return '연결중';
      case 'maintenance': return '점검중';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircle />;
      case 'offline': return <WifiOff />;
      case 'connecting': return <Wifi />;
      case 'error': return <ErrorIcon />;
      default: return <Warning />;
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect(device.id);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleControl = () => {
    navigate(`/devices/${device.id}`);
    handleMenuClose();
  };

  const isTestDevice = device.name?.includes('테스트') || device.specs?.model?.includes('TEST') || device.isTest;

  return (
    <Card sx={{
      height: '100%',
      position: 'relative',
      border: isTestDevice ? '2px dashed #ff9800' : 'inherit',
      bgcolor: isTestDevice ? 'rgba(255, 152, 0, 0.05)' : 'inherit'
    }}>
      {isConnecting && <LinearProgress />}

      {/* 🆕 테스트 디바이스 배지 */}
      {isTestDevice && (
        <Chip
          icon={<Science />}
          label="테스트"
          size="small"
          color="warning"
          sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
        />
      )}

      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Avatar sx={{
            bgcolor: isTestDevice ? 'warning.light' : 'primary.light',
            width: 56,
            height: 56
          }}>
            {isTestDevice ? <Science /> : <DevicesOther />}
          </Avatar>
          <Box display="flex" alignItems="center" gap={1}>
            {/* 🔍 연결 상태를 보여주는 핵심 부분 */}
            <Chip
              icon={getStatusIcon(device.status)}
              label={getStatusText(device.status)}
              color={getStatusColor(device.status)}
              size="small"
            />
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              disabled={isConnecting}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="h6" component="div" gutterBottom noWrap>
          {device.name}
        </Typography>

        <Typography variant="body2" color="textSecondary" gutterBottom>
          {device.location?.address}
        </Typography>

        <Box mb={2}>
          <Typography variant="caption" color="textSecondary" display="block">
            📡 IP: {device.ip}:{device.port}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block">
            🖥️ 모델: {device.specs?.model} ({device.specs?.size})
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block">
            📐 해상도: {device.specs?.resolution?.width}x{device.specs?.resolution?.height}
          </Typography>
        </Box>

        {/* 🔍 온라인 상태일 때만 보여지는 실시간 정보 */}
        {device.status === 'online' && device.systemInfo && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'success.50' }}>
            <Typography variant="caption" color="success.dark" display="block" fontWeight="bold">
              📊 실시간 상태
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <Thermostat fontSize="small" color="info" />
              <Typography variant="caption" color="textSecondary">
                {device.systemInfo.temperature}°C
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Speed fontSize="small" color="primary" />
              <Typography variant="caption" color="textSecondary">
                밝기: {device.config?.brightness?.current}/{device.specs?.maxBrightness}
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary" display="block">
              💓 마지막 하트비트: {new Date(device.connectionInfo?.lastHeartbeat).toLocaleTimeString()}
            </Typography>
          </Paper>
        )}

        {device.connectionInfo?.lastError && (
          <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
            ❌ {device.connectionInfo.lastError}
          </Alert>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        {/* 🔍 연결 상태에 따른 버튼 변경 */}
        {device.status === 'online' ? (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<WifiOff />}
            onClick={() => onDisconnect(device.id)}
            disabled={!hasControlPermission || isConnecting}
          >
            연결 해제
          </Button>
        ) : (
          <Button
            size="small"
            variant="contained"
            startIcon={<Wifi />}
            onClick={handleConnect}
            disabled={!hasControlPermission || isConnecting}
          >
            연결
          </Button>
        )}

        <Button
          size="small"
          variant="outlined"
          startIcon={<Settings />}
          onClick={handleControl}
          disabled={isConnecting}
        >
          제어
        </Button>
      </CardActions>

      {/* 컨텍스트 메뉴 */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleControl}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>전광판 제어</ListItemText>
        </MenuItem>

        {hasControlPermission && (
          <>
            <MenuItem onClick={() => navigate(`/messages/send?deviceId=${device.id}`)}>
              <ListItemIcon>
                <Send fontSize="small" />
              </ListItemIcon>
              <ListItemText>메시지 전송</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => onControl(device.id, 'clear_messages')}>
              <ListItemIcon>
                <Clear fontSize="small" />
              </ListItemIcon>
              <ListItemText>메시지 삭제</ListItemText>
            </MenuItem>

            <Divider />

            <MenuItem onClick={() => onControl(device.id, 'restart')}>
              <ListItemIcon>
                <PowerSettingsNew fontSize="small" />
              </ListItemIcon>
              <ListItemText>재시작</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => navigate(`/devices/${device.id}/edit`)}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              <ListItemText>설정 수정</ListItemText>
            </MenuItem>

            <Divider />

            <MenuItem onClick={() => onDelete(device.id)} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>삭제</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Card>
  );
};

const DeviceList = () => {
  const { hasPermission } = useAuth();
  const { socket } = useSocket();
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, deviceId: null, deviceName: '' });
  const [isCreatingTestDevices, setIsCreatingTestDevices] = useState(false);

  const hasControlPermission = hasPermission('device_control');

  // ✅ 디바이스 목록 로드 - API 호출만 수정
  const loadDevices = async () => {
    setIsLoading(true);
    try {
      // ✅ apiService.devices.getAll 사용
      const response = await apiService.devices.getAll();
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('디바이스 목록 로드 실패:', error);
      showSnackbar('디바이스 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadDevices();
  }, []);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (socket) {
      socket.on('deviceStatusChanged', (data) => {
        setDevices(prev => prev.map(device =>
          device.id === data.deviceId
            ? { ...device, ...data.device }
            : device
        ));
      });

      return () => {
        socket.off('deviceStatusChanged');
      };
    }
  }, [socket]);

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // ✅ 테스트 디바이스 생성 - API 호출만 수정
  const handleCreateTestDevices = async () => {
    setIsCreatingTestDevices(true);
    try {
      // ✅ apiService.devices.createTestDevices 사용
      const response = await apiService.devices.createTestDevices();
      showSnackbar(
        `✅ ${response.data.message} 연결 테스트를 진행해보세요!`,
        'success'
      );
      await loadDevices(); // 목록 새로고침
    } catch (error) {
      console.error('테스트 디바이스 생성 실패:', error);
      showSnackbar(
        `❌ ${apiUtils.getErrorMessage(error)}`,
        'error'
      );
    } finally {
      setIsCreatingTestDevices(false);
    }
  };

  // ✅ 디바이스 연결 - API 호출만 수정
  const handleConnect = async (deviceId) => {
    try {
      // ✅ apiService.devices.connect 사용
      await apiService.devices.connect(deviceId);
      showSnackbar('🔄 디바이스 연결을 시도하고 있습니다...', 'info');

      // 상태 업데이트
      setDevices(prev => prev.map(device =>
        device.id === deviceId
          ? { ...device, status: 'connecting' }
          : device
      ));
    } catch (error) {
      console.error('디바이스 연결 실패:', error);
      showSnackbar(
        `❌ ${apiUtils.getErrorMessage(error)}`,
        'error'
      );
    }
  };

  // ✅ 디바이스 연결 해제 - API 호출만 수정
  const handleDisconnect = async (deviceId) => {
    try {
      // ✅ apiService.devices.disconnect 사용
      await apiService.devices.disconnect(deviceId);
      showSnackbar('✅ 디바이스 연결을 해제했습니다.', 'success');

      // 상태 업데이트
      setDevices(prev => prev.map(device =>
        device.id === deviceId
          ? { ...device, status: 'offline', connectionInfo: { ...device.connectionInfo, connected: false } }
          : device
      ));
    } catch (error) {
      console.error('디바이스 연결 해제 실패:', error);
      showSnackbar(
        `❌ ${apiUtils.getErrorMessage(error)}`,
        'error'
      );
    }
  };

  // ✅ 디바이스 제어 - API 호출만 수정
  const handleControl = async (deviceId, action) => {
    try {
      switch (action) {
        case 'clear_messages':
          // ✅ apiService.devices.clearMessages 사용
          await apiService.devices.clearMessages(deviceId);
          showSnackbar('🗑️ 모든 메시지를 삭제했습니다.', 'success');
          break;
        case 'restart':
          // ✅ apiService.devices.controlPower 사용
          await apiService.devices.controlPower(deviceId, 'RESTART');
          showSnackbar('🔄 디바이스를 재시작했습니다.', 'success');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('디바이스 제어 실패:', error);
      showSnackbar(
        `❌ ${apiUtils.getErrorMessage(error)}`,
        'error'
      );
    }
  };

  // 디바이스 삭제 확인
  const handleDeleteConfirm = (deviceId) => {
    const device = devices.find(d => d.id === deviceId);
    setDeleteDialog({
      open: true,
      deviceId,
      deviceName: device?.name || ''
    });
  };

  // ✅ 디바이스 삭제 - API 호출만 수정
  const handleDelete = async () => {
    try {
      // ✅ apiService.devices.delete 사용
      await apiService.devices.delete(deleteDialog.deviceId);
      setDevices(prev => prev.filter(device => device.id !== deleteDialog.deviceId));
      showSnackbar('🗑️ 디바이스를 삭제했습니다.', 'success');
    } catch (error) {
      console.error('디바이스 삭제 실패:', error);
      showSnackbar(
        `❌ ${apiUtils.getErrorMessage(error)}`,
        'error'
      );
    } finally {
      setDeleteDialog({ open: false, deviceId: null, deviceName: '' });
    }
  };

  // 통계 계산
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    error: devices.filter(d => ['error', 'maintenance'].includes(d.status)).length,
    test: devices.filter(d => d.name?.includes('테스트') || d.specs?.model?.includes('TEST') || d.isTest).length,
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          전광판 관리
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDevices}
            disabled={isLoading}
          >
            새로고침
          </Button>

          {/* 🆕 테스트 디바이스 생성 버튼 */}
          {hasControlPermission && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={isCreatingTestDevices ? <CircularProgress size={16} /> : <Science />}
              onClick={handleCreateTestDevices}
              disabled={isLoading || isCreatingTestDevices}
            >
              {isCreatingTestDevices ? '생성중...' : '테스트 디바이스 생성'}
            </Button>
          )}

          {hasControlPermission && (
            <Button
              variant="contained"
              startIcon={<Add />}
              href="/devices/add"
            >
              전광판 추가
            </Button>
          )}
        </Box>
      </Box>

      {/* 🔍 연결 상태 통계 - 테스트 디바이스 포함 */}
      <Box mb={3}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="primary">
                  {stats.total}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  전체
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="success.main">
                  {stats.online}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  온라인 (연결됨)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="error.main">
                  {stats.offline}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  오프라인 (연결 끊김)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="warning.main">
                  {stats.error}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  점검/오류
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="warning.main">
                  <Badge color="warning">
                    {stats.test}
                  </Badge>
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  테스트 디바이스
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* 권한 알림 */}
      {!hasControlPermission && (
        <Alert severity="info" sx={{ mb: 3 }}>
          현재 계정은 조회 권한만 있습니다. 전광판 제어를 위해서는 관리자에게 권한을 요청하세요.
        </Alert>
      )}

      {/* 🆕 테스트 안내 */}
      {hasControlPermission && stats.test === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            🧪 <strong>테스트 디바이스 생성</strong>을 클릭하여 가상의 전광판을 만들고 기능을 테스트해보세요!
          </Typography>
          <Typography variant="caption">
            테스트 디바이스는 실제 하드웨어 없이도 메시지 전송, 연결 관리 등 모든 기능을 체험할 수 있습니다.
          </Typography>
        </Alert>
      )}

      {/* 디바이스 목록 */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={60} />
        </Box>
      ) : devices.length === 0 ? (
        <Box textAlign="center" py={8}>
          <DevicesOther sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            등록된 전광판이 없습니다
          </Typography>
          <Typography variant="body2" color="textSecondary" mb={3}>
            새로운 전광판을 추가하거나 테스트 디바이스를 생성하여 시작하세요.
          </Typography>
          {hasControlPermission && (
            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Science />}
                onClick={handleCreateTestDevices}
                disabled={isCreatingTestDevices}
              >
                테스트 디바이스 생성
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                href="/devices/add"
              >
                전광판 추가
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {devices.map((device) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={device.id}>
              <DeviceCard
                device={device}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onControl={handleControl}
                onDelete={handleDeleteConfirm}
                hasControlPermission={hasControlPermission}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, deviceId: null, deviceName: '' })}
      >
        <DialogTitle>전광판 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            정말로 '{deleteDialog.deviceName}' 전광판을 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, deviceId: null, deviceName: '' })}>
            취소
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            삭제
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

export default DeviceList;