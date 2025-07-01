// src/pages/AddDevice.js - ID 기반 연결로 수정된 전광판 추가 페이지
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import {
  Save,
  Cancel,
  DevicesOther,
  ExpandMore,
  Sensors,
  Settings,
  LocationOn,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AddDevice = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // 🔧 ID 기반 연결로 변경된 폼 데이터
  const [formData, setFormData] = useState({
    // 기본 정보 - ID 기반으로 변경
    name: '',
    description: '',
    deviceId: '', // ✅ IP/Port 대신 Device ID 사용
    controllerType: 'HUIDU', // 후이두 컨트롤러 타입

    // 위치 정보
    location: {
      address: '',
      building: '',
      floor: '',
      room: '',
      coordinates: {
        latitude: '',
        longitude: ''
      }
    },

    // 사양 정보
    specs: {
      model: '',
      manufacturer: '',
      size: '',
      resolution: {
        width: 1920,
        height: 1080
      },
      maxBrightness: 100,
      colorDepth: 24
    },

    // 설정
    config: {
      brightness: {
        current: 80,
        auto: true,
        schedule: []
      },
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      powerSchedule: {
        enabled: false,
        onTime: '09:00',
        offTime: '18:00'
      }
    },

    // 고급 설정
    advanced: {
      connectionTimeout: 30,
      heartbeatInterval: 60,
      retryAttempts: 3,
      enableLogging: true
    }
  });

  const [errors, setErrors] = useState({});

  // 권한 확인
  if (!hasPermission('device_control')) {
    return (
      <Box>
        <Alert severity="error">
          전광판을 추가할 권한이 없습니다. 관리자에게 문의하세요.
        </Alert>
      </Box>
    );
  }

  // 입력값 변경 처리
  const handleChange = (field, value, nested = null) => {
    setFormData(prev => {
      if (nested) {
        return {
          ...prev,
          [nested]: {
            ...prev[nested],
            [field]: value
          }
        };
      } else if (field.includes('.')) {
        const keys = field.split('.');
        const newData = { ...prev };
        let current = newData;

        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;

        return newData;
      } else {
        return {
          ...prev,
          [field]: value
        };
      }
    });

    // 에러 제거
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // 유효성 검사 - ID 기반으로 수정
  const validateForm = () => {
    const newErrors = {};

    // 필수 필드 검사
    if (!formData.name.trim()) {
      newErrors.name = '전광판 이름을 입력하세요.';
    }

    // ✅ Device ID 유효성 검사 (IP 대신)
    if (!formData.deviceId.trim()) {
      newErrors.deviceId = 'Device ID를 입력하세요.';
    } else if (!/^[A-Za-z0-9]+$/.test(formData.deviceId)) {
      newErrors.deviceId = '올바른 Device ID 형식을 입력하세요. (영문, 숫자만 허용)';
    } else if (formData.deviceId.length < 8 || formData.deviceId.length > 20) {
      newErrors.deviceId = 'Device ID는 8~20자 사이여야 합니다.';
    }

    if (!formData.specs.model.trim()) {
      newErrors['specs.model'] = '모델명을 입력하세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🔧 실제 장비 연결 테스트
  const handleTestConnection = async () => {
    if (!formData.deviceId) {
      showSnackbar('Device ID를 먼저 입력하세요.', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 실제 장비 연결 테스트 시작:', {
        deviceId: formData.deviceId,
        controllerType: formData.controllerType
      });

      // 🔧 실제 백엔드 연결 테스트 API 호출
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5002'}/api/devices/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: formData.deviceId,
          controllerType: formData.controllerType
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ 연결 테스트 성공:', result);

        showSnackbar(
          `✅ ${result.message} (응답시간: ${result.connectionTime}ms)`,
          'success'
        );

        // 🔧 연결 성공 시 장비 정보 자동 입력 (선택사항)
        if (result.deviceInfo && !formData.name) {
          setFormData(prev => ({
            ...prev,
            name: `전광판 ${formData.deviceId.slice(-4)}` // Device ID 뒷 4자리로 기본 이름 설정
          }));
        }

      } else {
        console.warn('❌ 연결 테스트 실패:', result);

        let errorMessage = result.message || '연결 테스트에 실패했습니다.';
        if (result.suggestions && result.suggestions.length > 0) {
          errorMessage += '\n\n확인사항:\n' + result.suggestions.join('\n');
        }

        showSnackbar(errorMessage, 'error');
      }

    } catch (error) {
      console.error('연결 테스트 API 호출 오류:', error);

      let errorMessage = '연결 테스트 중 오류가 발생했습니다.';

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '백엔드 서버에 연결할 수 없습니다. 서버 상태를 확인하세요.';
      } else if (error.message.includes('401')) {
        errorMessage = '인증이 필요합니다. 다시 로그인하세요.';
      }

      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 전광판 추가
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showSnackbar('입력 정보를 확인하세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.devices.create(formData);

      showSnackbar('전광판이 성공적으로 추가되었습니다!', 'success');

      // 전광판 목록으로 이동
      setTimeout(() => {
        navigate('/devices');
      }, 1500);

    } catch (error) {
      console.error('전광판 추가 실패:', error);
      showSnackbar(
        error.response?.data?.message || '전광판 추가에 실패했습니다.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          전광판 추가
        </Typography>
        <Typography variant="body2" color="textSecondary">
          새로운 전광판을 시스템에 등록하고 Device ID로 연결 설정을 구성하세요.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* 기본 정보 */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <DevicesOther sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">기본 정보</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="전광판 이름 *"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      error={!!errors.name}
                      helperText={errors.name || '예: 본관 1층 로비 전광판'}
                      placeholder="전광판 이름을 입력하세요"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="설명"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="전광판에 대한 설명 (선택사항)"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* ✅ 연결 정보 - ID 기반으로 변경 */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Sensors sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">연결 정보</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Device ID *"
                      value={formData.deviceId}
                      onChange={(e) => handleChange('deviceId', e.target.value.toUpperCase())}
                      error={!!errors.deviceId}
                      helperText={errors.deviceId || '예: C16LD25004EA (후이두 컨트롤러 ID)'}
                      placeholder="C16LD25004EA"
                      inputProps={{
                        style: { fontFamily: 'monospace', fontSize: '14px' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>컨트롤러 타입</InputLabel>
                      <Select
                        value={formData.controllerType}
                        onChange={(e) => handleChange('controllerType', e.target.value)}
                        label="컨트롤러 타입"
                      >
                        <MenuItem value="HUIDU">후이두 (HUIDU)</MenuItem>
                        <MenuItem value="LINSN">린선 (LINSN)</MenuItem>
                        <MenuItem value="NOVASTAR">노바스타 (NOVASTAR)</MenuItem>
                        <MenuItem value="OTHER">기타</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={isLoading ? <CircularProgress size={16} /> : <Sensors />}
                      onClick={handleTestConnection}
                      disabled={isLoading || !formData.deviceId}
                      color={isLoading ? "inherit" : "primary"}
                    >
                      {isLoading ? '연결 테스트 중...' : '실제 장비 연결 테스트'}
                    </Button>
                  </Grid>
                </Grid>

                {/* 🔧 실제 연결 테스트 안내 */}
                <Box mt={2}>
                  <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                    <Typography variant="caption" display="block">
                      <strong>실제 장비 연결 테스트:</strong><br />
                      • MQTT 브로커를 통한 실제 통신<br />
                      • 장비 응답 시간 측정<br />
                      • 연결 실패 시 구체적인 원인 제공<br />
                      • 실제 전광판이 켜져있어야 성공
                    </Typography>
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 위치 정보 */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center">
                  <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">위치 정보</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="주소"
                      value={formData.location.address}
                      onChange={(e) => handleChange('address', e.target.value, 'location')}
                      placeholder="서울시 강남구 테헤란로 123"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="건물명"
                      value={formData.location.building}
                      onChange={(e) => handleChange('building', e.target.value, 'location')}
                      placeholder="본관동"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="층"
                      value={formData.location.floor}
                      onChange={(e) => handleChange('floor', e.target.value, 'location')}
                      placeholder="1층"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="호실"
                      value={formData.location.room}
                      onChange={(e) => handleChange('room', e.target.value, 'location')}
                      placeholder="로비"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* 사양 정보 */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center">
                  <Settings sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">사양 정보</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="모델명 *"
                      value={formData.specs.model}
                      onChange={(e) => handleChange('specs.model', e.target.value)}
                      error={!!errors['specs.model']}
                      helperText={errors['specs.model']}
                      placeholder="LED-P10-320x160"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="제조사"
                      value={formData.specs.manufacturer}
                      onChange={(e) => handleChange('specs.manufacturer', e.target.value)}
                      placeholder="노아LED"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="크기"
                      value={formData.specs.size}
                      onChange={(e) => handleChange('specs.size', e.target.value)}
                      placeholder="2X10 (가로2m x 세로1m)"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="가로 해상도"
                      type="number"
                      value={formData.specs.resolution.width}
                      onChange={(e) => handleChange('specs.resolution.width', parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="세로 해상도"
                      type="number"
                      value={formData.specs.resolution.height}
                      onChange={(e) => handleChange('specs.resolution.height', parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="최대 밝기"
                      type="number"
                      value={formData.specs.maxBrightness}
                      onChange={(e) => handleChange('specs.maxBrightness', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 15 }}
                      helperText="1~15 (전광판 기준)"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="현재 밝기"
                      type="number"
                      value={formData.config.brightness.current}
                      onChange={(e) => handleChange('config.brightness.current', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 15 }}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* 버튼 */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={() => navigate('/devices')}
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<Save />}
                disabled={isLoading}
              >
                {isLoading ? '추가 중...' : '전광판 추가'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>

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

export default AddDevice;