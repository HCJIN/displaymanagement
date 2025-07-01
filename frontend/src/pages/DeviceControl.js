// src/pages/DeviceControl.js - 프로토콜 정의서 기준 완전 구현
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Paper,
} from '@mui/material';
import {
  DevicesOther,
  PowerSettingsNew,
  Brightness7,
  Send,
  Refresh,
  Settings,
  ArrowBack,
  Wifi,
  WifiOff,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiService from '../services/api';

const DeviceControl = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { socket } = useSocket();

  const [device, setDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [dialogs, setDialogs] = useState({
    power: false,
    brightness: false,
  });

  // ✅ 프로토콜 0xD1에 맞는 폼 데이터 구조
  const [formData, setFormData] = useState({
    // ✅ 프로토콜 0xD1 - 야간 시간 및 동작 시간 설정
    brightness: {
      dayBrightness: 15,        // 주간 밝기 단계 (0~20)
      nightBrightness: 8,       // 야간 밝기 단계 (0~20)
      startTime: '06:00',       // 시작 시간 (주간 밝기 시작)
      endTime: '23:00',         // 완료 시간 (주간 밝기 종료)
    },
    // ✅ 전광판 전원 ON/OFF 시간 (프로토콜 0xD1에 포함)
    power: {
      onTime: '06:00',          // ON시간
      offTime: '23:00',         // OFF시간
      action: 'RESTART'         // 전원 제어 동작
    },
    // 기존 필드들
    delaySeconds: 0,
    schedule: {
      onTime: '06:00',
      offTime: '23:00',
      enabled: true,
    },
  });

  const hasControlPermission = hasPermission('device_control');

  // ✅ loadDevice 함수 (useCallback으로 최적화)
  const loadDevice = useCallback(async () => {
    if (!deviceId) return;

    console.log('🔄 새로고침 - 디바이스 정보 로드:', deviceId);
    setIsLoading(true);

    try {
      const response = await apiService.devices.getById(deviceId);
      console.log('✅ 새로고침 완료:', response.data.device?.name);

      setDevice(response.data.device);

      // ✅ 프로토콜에 맞는 폼 데이터 초기화
      if (response.data.device) {
        setFormData(prev => ({
          ...prev,
          brightness: {
            dayBrightness: response.data.device.config?.brightness?.day || 15,
            nightBrightness: response.data.device.config?.brightness?.night || 8,
            startTime: response.data.device.config?.brightness?.startTime || '06:00',
            endTime: response.data.device.config?.brightness?.endTime || '23:00',
          },
          power: {
            onTime: response.data.device.config?.schedule?.onTime || '06:00',
            offTime: response.data.device.config?.schedule?.offTime || '23:00',
            action: 'RESTART'
          },
          schedule: {
            onTime: response.data.device.config?.schedule?.onTime || '06:00',
            offTime: response.data.device.config?.schedule?.offTime || '23:00',
            enabled: response.data.device.config?.schedule?.enabled || true,
          },
        }));
      }
    } catch (error) {
      console.error('❌ 새로고침 실패:', error);
      showSnackbar('디바이스 정보를 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // ✅ 초기 로드
  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      if (!deviceId || ignore) return;

      console.log('🚀 초기 로드 시작:', deviceId);
      setIsLoading(true);

      try {
        const response = await apiService.devices.getById(deviceId);

        if (ignore) {
          console.log('🚫 컴포넌트 언마운트됨, 상태 업데이트 취소');
          return;
        }

        console.log('✅ 초기 로드 완료:', response.data.device?.name);
        setDevice(response.data.device);

        // ✅ 프로토콜에 맞는 폼 데이터 초기화
        if (response.data.device) {
          setFormData(prev => ({
            ...prev,
            brightness: {
              dayBrightness: response.data.device.config?.brightness?.day || 15,
              nightBrightness: response.data.device.config?.brightness?.night || 8,
              startTime: response.data.device.config?.brightness?.startTime || '06:00',
              endTime: response.data.device.config?.brightness?.endTime || '23:00',
            },
            power: {
              onTime: response.data.device.config?.schedule?.onTime || '06:00',
              offTime: response.data.device.config?.schedule?.offTime || '23:00',
              action: 'RESTART'
            },
            schedule: {
              onTime: response.data.device.config?.schedule?.onTime || '06:00',
              offTime: response.data.device.config?.schedule?.offTime || '23:00',
              enabled: response.data.device.config?.schedule?.enabled || true,
            },
          }));
        }
      } catch (error) {
        if (!ignore) {
          console.error('❌ 초기 로드 실패:', error);
          showSnackbar('디바이스 정보를 불러오는데 실패했습니다.', 'error');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      ignore = true;
      console.log('🧹 DeviceControl cleanup - 요청 무시 설정');
    };
  }, [deviceId]);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (socket && deviceId) {
      const handleDeviceStatusChanged = (data) => {
        if (data.deviceId === deviceId) {
          console.log('📡 소켓 이벤트 - 디바이스 상태 변경:', data.device?.status);
          setDevice(prev => prev ? { ...prev, ...data.device } : null);
        }
      };

      socket.on('deviceStatusChanged', handleDeviceStatusChanged);

      return () => {
        socket.off('deviceStatusChanged', handleDeviceStatusChanged);
      };
    }
  }, [socket, deviceId]);

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 다이얼로그 열기/닫기
  const openDialog = (dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
  };

  const closeDialog = (dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: false }));
  };

  // ✅ 디바이스 연결/해제
  const handleConnection = async (action) => {
    try {
      let response;
      if (action === 'connect') {
        response = await apiService.devices.connect(deviceId);
        showSnackbar('연결을 시도하고 있습니다.', 'info');
      } else {
        response = await apiService.devices.disconnect(deviceId);
        showSnackbar('연결을 해제했습니다.', 'success');
      }

      if (response.data.device) {
        console.log('🔄 연결 상태 즉시 업데이트:', response.data.device.status);
        setDevice(prev => ({ ...prev, ...response.data.device }));
      }

      await loadDevice();
    } catch (error) {
      console.error('연결 작업 실패:', error);
      showSnackbar(
        error.response?.data?.message || '연결 작업에 실패했습니다.',
        'error'
      );
    }
  };

  // ✅ 전광판 설정 (기존 updateConfig 함수 사용) - 야간 시간 및 동작 시간 설정 함수
  const handleBrightnessAndScheduleControl = async () => {
    try {
      // ✅ 기존 updateConfig 함수 사용
      const configData = {
        brightness: {
          day: formData.brightness.dayBrightness,           // 주간 밝기 단계
          night: formData.brightness.nightBrightness,       // 야간 밝기 단계
          startTime: formData.brightness.startTime,         // 시작 시간 (주간 밝기)
          endTime: formData.brightness.endTime,             // 완료 시간 (주간 밝기)
        },
        schedule: {
          onTime: formData.power.onTime,                    // 전광판 ON시간
          offTime: formData.power.offTime,                  // 전광판 OFF시간
          enabled: true
        }
      };

      const response = await apiService.devices.updateConfig(deviceId, configData);

      showSnackbar('전광판 설정이 완료되었습니다.', 'success');
      closeDialog('brightness');

      // ✅ 서버 응답이 있으면 해당 데이터로 업데이트, 없으면 로컬 상태 유지
      if (response.data.device) {
        console.log('🔄 전광판 설정 후 서버 응답으로 업데이트:', response.data.device);
        setDevice(prev => ({
          ...prev,
          ...response.data.device,
          // ✅ config를 강제로 업데이트하여 폼 데이터와 동기화
          config: {
            ...prev.config,
            ...configData
          }
        }));
      } else {
        // ✅ 서버 응답이 없으면 로컬 상태만 업데이트
        console.log('🔄 전광판 설정 후 로컬 상태 업데이트:', configData);
        setDevice(prev => ({
          ...prev,
          config: {
            ...prev.config,
            ...configData
          }
        }));
      }

      // ✅ loadDevice() 호출 제거 - 폼 초기화 방지
      // await loadDevice(); // 이 줄을 제거하여 폼이 초기화되지 않도록 함

    } catch (error) {
      console.error('전광판 설정 실패:', error);
      showSnackbar(
        error.response?.data?.message || '전광판 설정에 실패했습니다.',
        'error'
      );
    }
  };

  // ✅ 전원 제어
  const handlePowerControl = async () => {
    try {
      const response = await apiService.devices.controlPower(deviceId, formData.power.action);
      showSnackbar(`전원 ${formData.power.action} 명령을 전송했습니다.`, 'success');
      closeDialog('power');

      if (response.data.device) {
        console.log('🔄 전원 제어 후 상태 즉시 업데이트:', response.data.device.status);
        setDevice(prev => ({ ...prev, ...response.data.device }));
      }

      await loadDevice();
    } catch (error) {
      console.error('전원 제어 실패:', error);
      showSnackbar(
        error.response?.data?.message || '전원 제어에 실패했습니다.',
        'error'
      );
    }
  };

  // 상태 아이콘
  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircle color="success" />;
      case 'offline': return <WifiOff color="error" />;
      case 'connecting': return <Wifi color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <Warning color="warning" />;
    }
  };

  // 상태 텍스트
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

  // 상태 색상
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'connecting': return 'warning';
      case 'maintenance': return 'info';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!device) {
    return (
      <Box p={3}>
        <Alert severity="error">
          디바이스를 찾을 수 없습니다.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* 헤더 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/devices')}
          >
            뒤로
          </Button>
          <Typography variant="h4" component="h1">
            {device.name}
          </Typography>
          {device.isTest && (
            <Chip
              label="테스트"
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDevice}
            disabled={isLoading}
          >
            새로고침
          </Button>
          <Button
            variant="outlined"
            startIcon={<Send />}
            onClick={() => navigate(`/messages/send?deviceId=${deviceId}`)}
          >
            메시지 전송
          </Button>
        </Box>
      </Box>

      {/* 권한 알림 */}
      {!hasControlPermission && (
        <Alert severity="info" sx={{ mb: 3 }}>
          현재 계정은 조회 권한만 있습니다. 디바이스 제어를 위해서는 관리자에게 권한을 요청하세요.
        </Alert>
      )}

      {/* 테스트 디바이스 안내 */}
      {device.isTest && (
        <Alert severity="info" sx={{ mb: 3 }}>
          🧪 <strong>테스트 디바이스</strong>입니다. 모든 프로토콜을 안전하게 테스트할 수 있습니다.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 디바이스 상태 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                디바이스 상태
              </Typography>

              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getStatusIcon(device.status)}
                <Chip
                  label={getStatusText(device.status)}
                  color={getStatusColor(device.status)}
                />
              </Box>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="IP 주소"
                    secondary={`${device.ip}:${device.port}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="모델"
                    secondary={`${device.specs?.model} (${device.specs?.size})`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="해상도"
                    secondary={`${device.specs?.resolution?.width}x${device.specs?.resolution?.height}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="최대 밝기"
                    secondary={`${device.specs?.maxBrightness || 20}/20`}
                  />
                </ListItem>
                {device.status === 'online' && device.systemInfo && (
                  <>
                    <ListItem>
                      <ListItemText
                        primary="온도"
                        secondary={`${device.systemInfo.temperature}°C`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="마지막 하트비트"
                        secondary={new Date(device.connectionInfo?.lastHeartbeat).toLocaleString()}
                      />
                    </ListItem>
                  </>
                )}
              </List>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" gap={1} flexWrap="wrap">
                {device.status === 'online' ? (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<WifiOff />}
                    onClick={() => handleConnection('disconnect')}
                    disabled={!hasControlPermission}
                  >
                    연결 해제
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Wifi />}
                    onClick={() => handleConnection('connect')}
                    disabled={!hasControlPermission}
                  >
                    연결
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ✅ 디바이스 제어 패널 (메시지 삭제 기능 제거) */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                디바이스 제어 패널
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<PowerSettingsNew />}
                    onClick={() => openDialog('power')}
                    disabled={!hasControlPermission}
                  >
                    전원 제어
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Brightness7 />}
                    onClick={() => openDialog('brightness')}
                    disabled={!hasControlPermission}
                  >
                    전광판 설정
                  </Button>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  💡 <strong>메시지 관리는 '메시지 전송' 페이지에서 하세요</strong><br />
                  방번호별 삭제, 전체 삭제 등의 메시지 관리 기능은 메시지 전송 페이지에서 제공됩니다.
                </Typography>
              </Alert>

              {/* ✅ 현재 설정 표시 */}
              <Typography variant="subtitle2" gutterBottom>
                현재 설정
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="주간 밝기"
                    secondary={`${device.config?.brightness?.day || 15}/20 (${device.config?.brightness?.startTime || '06:00'} ~ ${device.config?.brightness?.endTime || '23:00'})`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="야간 밝기"
                    secondary={`${device.config?.brightness?.night || 8}/20`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="전광판 동작 시간"
                    secondary={`${device.config?.schedule?.onTime || '06:00'} ~ ${device.config?.schedule?.offTime || '23:00'}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="마지막 프로토콜"
                    secondary={device.config?.protocol?.lastCommand ?
                      `${device.config.protocol.lastCommand} (${new Date(device.config.protocol.timestamp).toLocaleString()})` :
                      '없음'
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* 오류 정보 */}
        {device.connectionInfo?.lastError && (
          <Grid item xs={12}>
            <Alert severity="error">
              <Typography variant="subtitle2">마지막 오류:</Typography>
              {device.connectionInfo.lastError}
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* ✅ 전광판 설정 다이얼로그 */}
      <Dialog
        open={dialogs.brightness}
        onClose={() => closeDialog('brightness')}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          전광판 설정 - 야간 시간 및 동작 시간 설정
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>전광판 설정:</strong><br />
              • 주간/야간 밝기: 0~20 (숫자가 클수록 밝음)<br />
              • ON/OFF 시간이 동일하면 계속 켜짐<br />
              • OFF 시간이라도 긴급 메시지가 존재하면 ON됨
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            {/* 주간/야간 밝기 설정 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                밝기 설정 (0~20)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography gutterBottom>
                    주간 밝기: {formData.brightness.dayBrightness}
                  </Typography>
                  <Slider
                    value={formData.brightness.dayBrightness}
                    onChange={(e, value) => setFormData(prev => ({
                      ...prev,
                      brightness: { ...prev.brightness, dayBrightness: value }
                    }))}
                    min={0}
                    max={20}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 10, label: '10' },
                      { value: 20, label: '20' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography gutterBottom>
                    야간 밝기: {formData.brightness.nightBrightness}
                  </Typography>
                  <Slider
                    value={formData.brightness.nightBrightness}
                    onChange={(e, value) => setFormData(prev => ({
                      ...prev,
                      brightness: { ...prev.brightness, nightBrightness: value }
                    }))}
                    min={0}
                    max={20}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 10, label: '10' },
                      { value: 20, label: '20' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 주간 밝기 시간 설정 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                주간 밝기 시간
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="시작 시간 (주간 밝기 시작)"
                    type="time"
                    value={formData.brightness.startTime}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      brightness: { ...prev.brightness, startTime: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="완료 시간 (주간 밝기 종료)"
                    type="time"
                    value={formData.brightness.endTime}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      brightness: { ...prev.brightness, endTime: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 전광판 ON/OFF 시간 설정 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                전광판 동작 시간
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="ON 시간 (전광판 켜지는 시간)"
                    type="time"
                    value={formData.power.onTime}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      power: { ...prev.power, onTime: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="OFF 시간 (전광판 꺼지는 시간)"
                    type="time"
                    value={formData.power.offTime}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      power: { ...prev.power, offTime: e.target.value }
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 설정 미리보기 */}
            <Grid item xs={12}>
              <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  설정 미리보기
                </Typography>
                <Typography variant="body2" component="div">
                  • 주간 밝기: <strong>{formData.brightness.dayBrightness}</strong>
                  ({formData.brightness.startTime} ~ {formData.brightness.endTime})<br />
                  • 야간 밝기: <strong>{formData.brightness.nightBrightness}</strong><br />
                  • 전광판 동작: <strong>{formData.power.onTime} ~ {formData.power.offTime}</strong><br />
                  {formData.power.onTime === formData.power.offTime && (
                    <span style={{ color: 'orange' }}>⚠️ ON/OFF 시간이 동일하여 계속 켜져있습니다.</span>
                  )}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeDialog('brightness')}>
            취소
          </Button>
          <Button
            onClick={handleBrightnessAndScheduleControl}
            variant="contained"
            startIcon={<Settings />}
          >
            전광판 설정 적용
          </Button>
        </DialogActions>
      </Dialog>

      {/* 전원 제어 다이얼로그 */}
      <Dialog open={dialogs.power} onClose={() => closeDialog('power')}>
        <DialogTitle>전원 제어</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>전원 동작</InputLabel>
            <Select
              value={formData.power.action}
              onChange={(e) => setFormData(prev => ({ ...prev, power: { ...prev.power, action: e.target.value } }))}
              label="전원 동작"
            >
              <MenuItem value="ON">켜기</MenuItem>
              <MenuItem value="OFF">끄기</MenuItem>
              <MenuItem value="RESTART">재시작</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeDialog('power')}>취소</Button>
          <Button onClick={handlePowerControl} variant="contained">
            실행
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

export default DeviceControl;