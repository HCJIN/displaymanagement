// src/pages/Dashboard.js - 메시지 성공률 계산 완전 수정된 대시보드 페이지
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Divider,
  Button,
} from '@mui/material';
import {
  DevicesOther,
  Message,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Settings,
  People,
  Timeline,
  TrendingUp,
  Send,
  Visibility,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

// 통계 카드 컴포넌트
const StatCard = ({ title, value, icon, color, subtitle, trend }) => (
  <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="div" color={color} fontWeight="bold">
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
              <TrendingUp fontSize="small" color={trend.direction === 'up' ? 'success' : 'error'} />
              <Typography variant="body2" color={trend.direction === 'up' ? 'success.main' : 'error.main'} sx={{ ml: 0.5 }}>
                {trend.value}%
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light`, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

// 디바이스 상태 컴포넌트
const DeviceStatusCard = ({ devices, onRefresh, isLoading }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return '온라인';
      case 'offline': return '오프라인';
      case 'maintenance': return '점검중';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="div">
            전광판 상태
          </Typography>
          <Tooltip title="새로고침">
            <span>
              <IconButton onClick={onRefresh} disabled={isLoading}>
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        <List dense>
          {devices.map((device) => (
            <ListItem key={device.id} divider>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <DevicesOther />
                </Avatar>
              </ListItemAvatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" component="div">
                  {device.name}
                </Typography>
                <Typography variant="body2" color="textSecondary" component="div">
                  {device.location?.address}
                </Typography>
                <Typography variant="caption" color="textSecondary" component="div">
                  IP: {device.ip}:{device.port}
                </Typography>
              </Box>
              <Box display="flex" flexDirection="column" alignItems="flex-end">
                <Chip
                  label={getStatusText(device.status)}
                  color={getStatusColor(device.status)}
                  size="small"
                  sx={{ mb: 0.5 }}
                />
                {device.connectionInfo?.lastHeartbeat && (
                  <Typography variant="caption" color="textSecondary">
                    {new Date(device.connectionInfo.lastHeartbeat).toLocaleTimeString()}
                  </Typography>
                )}
              </Box>
            </ListItem>
          ))}
        </List>

        {devices.length === 0 && (
          <Typography color="textSecondary" textAlign="center" py={4}>
            등록된 전광판이 없습니다.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// 최근 메시지 컴포넌트
const RecentMessagesCard = ({ messages, isLoading }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle color="success" />;
      case 'sent': return <CheckCircle color="success" />;
      case 'expired': return <Warning color="warning" />;
      case 'failed': return <Error color="error" />;
      default: return <Message color="action" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'sending': return '전송중';
      case 'sent': return '전송완료';
      case 'active': return '표시중';
      case 'expired': return '만료됨';
      case 'failed': return '실패';
      case 'cancelled': return '취소됨';
      default: return '알 수 없음';
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" mb={2}>
          최근 메시지
        </Typography>

        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        <List dense>
          {messages.map((message) => (
            <ListItem key={message.id} divider>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'secondary.light' }}>
                  {getStatusIcon(message.status)}
                </Avatar>
              </ListItemAvatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" noWrap component="div">
                  {message.content || message.type}
                </Typography>
                <Typography variant="caption" color="textSecondary" component="div">
                  {message.deviceName} • {new Date(message.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Chip
                label={getStatusText(message.status)}
                size="small"
                variant="outlined"
              />
            </ListItem>
          ))}
        </List>

        {messages.length === 0 && (
          <Typography color="textSecondary" textAlign="center" py={4}>
            최근 메시지가 없습니다.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const { socket, isConnected } = useSocket();
  const [stats, setStats] = useState({
    devices: { total: 0, online: 0, offline: 0, uptime: 0 },
    messages: { total: 0, active: 0, sent: 0, failed: 0, successful: 0, successRate: 0 },
    users: { total: 0, active: 0 }
  });
  const [devices, setDevices] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // ✅ 완전히 수정된 안전한 통계 계산 함수들
  const calculateDeviceStats = (devices) => {
    const total = devices.length;
    const online = devices.filter(d => d.status === 'online').length;
    const offline = total - online;
    const uptime = total > 0 ? (online / total * 100) : 0;

    return {
      total,
      online,
      offline,
      uptime: Math.round(uptime)
    };
  };

  // ✅ 완전히 개선된 메시지 통계 계산 함수
  const calculateMessageStats = (messages, rawStats) => {
    const total = messages.length;

    console.log('📊 메시지 통계 계산 시작:', {
      total,
      messagesPreview: messages.slice(0, 3).map(m => ({
        id: m.id,
        status: m.status,
        content: m.content?.substring(0, 20),
        deviceName: m.deviceName
      })),
      rawStats
    });

    // ✅ 실제 메시지에서 상태별 개수 계산 (가장 정확한 방법)
    const statusCounts = messages.reduce((acc, message) => {
      const status = message.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 실제 메시지 상태별 개수:', statusCounts);

    // ✅ API 통계와 실제 데이터 비교
    const byStatus = rawStats?.byStatus || {};
    console.log('📊 API 통계 vs 실제 데이터:', {
      api: byStatus,
      actual: statusCounts
    });

    // ✅ 실제 메시지 기준으로 계산 (더 정확함)
    const sent = statusCounts.sent || 0;
    const active = statusCounts.active || 0;
    const failed = statusCounts.failed || 0;
    const pending = statusCounts.pending || 0;
    const cancelled = statusCounts.cancelled || 0;
    const expired = statusCounts.expired || 0;

    // ✅ 성공으로 간주할 상태들 정의
    const successStatuses = ['sent', 'active', 'delivered', 'completed'];
    const failureStatuses = ['failed', 'cancelled', 'expired', 'error'];

    // 성공한 메시지 수 계산
    const successful = messages.filter(m =>
      successStatuses.includes(m.status)
    ).length;

    // 실패한 메시지 수 계산
    const failedTotal = messages.filter(m =>
      failureStatuses.includes(m.status)
    ).length;

    // ✅ 안전한 성공률 계산
    let successRate = 0;
    if (total > 0) {
      successRate = Math.round((successful / total) * 100);
    }

    const result = {
      total,
      sent,
      active,
      failed: failedTotal,
      pending,
      cancelled,
      expired,
      successful,
      successRate,
      // ✅ 추가 통계 정보
      statusBreakdown: statusCounts,
      isHealthy: successRate >= 80
    };

    console.log('📊 최종 메시지 통계:', result);
    console.log('📊 성공률 계산 상세:', {
      successful,
      total,
      successRate: `${successful}/${total} = ${successRate}%`,
      successStatuses,
      successfulMessages: messages.filter(m => successStatuses.includes(m.status)).map(m => ({
        id: m.id,
        status: m.status,
        content: m.content?.substring(0, 15)
      }))
    });

    return result;
  };

  // ✅ 개선된 데이터 로드 함수
  const loadDashboardData = async (source = 'auto') => {
    setIsLoading(true);
    try {
      console.log(`🔄 대시보드 데이터 로드 시작 (${source})`);

      const [devicesRes, messagesRes] = await Promise.all([
        api.devices.getAll(),
        api.messages.getAll({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' })
      ]);

      console.log('📊 API 응답 상세:', {
        devices: {
          success: devicesRes.data?.success,
          deviceCount: devicesRes.data?.devices?.length,
          devices: devicesRes.data?.devices?.map(d => ({ id: d.id, name: d.name, status: d.status }))
        },
        messages: {
          success: messagesRes.data?.success,
          messageCount: messagesRes.data?.messages?.length,
          stats: messagesRes.data?.stats,
          messages: messagesRes.data?.messages?.map(m => ({
            id: m.id,
            status: m.status,
            content: m.content?.substring(0, 20)
          }))
        }
      });

      const devices = devicesRes.data?.devices || [];
      const messages = messagesRes.data?.messages || [];

      // ✅ 전역 변수로 디버깅 가능하게 설정
      window.currentDevices = devices;
      window.currentMessages = messages;
      window.currentRawStats = messagesRes.data?.stats;

      setDevices(devices);
      setRecentMessages(messages);

      // ✅ 안전한 통계 계산
      const deviceStats = calculateDeviceStats(devices);
      const messageStats = calculateMessageStats(messages, messagesRes.data?.stats);

      console.log('📊 계산된 통계 상세:', {
        deviceStats,
        messageStats,
        source
      });

      setStats({
        devices: deviceStats,
        messages: messageStats,
        users: { total: 0, active: 0 }
      });

      setLastUpdate(new Date());
      console.log('✅ 대시보드 데이터 로드 완료');

    } catch (error) {
      console.error('❌ 대시보드 데이터 로드 실패:', error);
      console.error('에러 상세:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });

      // ✅ 에러 시 기본값 설정
      setStats({
        devices: { total: 0, online: 0, offline: 0, uptime: 0 },
        messages: {
          total: 0,
          active: 0,
          sent: 0,
          failed: 0,
          successful: 0,
          successRate: 0
        },
        users: { total: 0, active: 0 }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    loadDashboardData('initial');
  }, []);

  // ✅ 브라우저 콘솔에서 디버깅할 수 있는 함수들 추가
  useEffect(() => {
    // 디버깅 함수들을 전역으로 등록
    window.debugDashboard = () => {
      console.log('🔍 === 현재 대시보드 상태 ===');
      console.log('Stats:', stats);
      console.log('Devices:', devices);
      console.log('Recent Messages:', recentMessages);
      console.log('Last Update:', lastUpdate);
      console.log('Is Loading:', isLoading);
      console.log('Socket Connected:', isConnected);
    };

    window.recalculateStats = () => {
      console.log('🔄 통계 재계산');
      const messageStats = calculateMessageStats(recentMessages, window.currentRawStats);
      console.log('📊 재계산된 메시지 통계:', messageStats);

      setStats(prev => ({
        ...prev,
        messages: messageStats
      }));
    };

    window.testApiCall = async () => {
      try {
        console.log('🧪 API 테스트 호출');
        const response = await api.messages.getAll({ limit: 5 });
        console.log('📊 API 테스트 응답:', response.data);
        return response.data;
      } catch (error) {
        console.error('❌ API 테스트 실패:', error);
        return null;
      }
    };

    window.forceRefresh = () => {
      console.log('🔄 강제 새로고침');
      loadDashboardData('manual');
    };

    window.checkMessageStatuses = () => {
      console.log('🔍 메시지 상태 상세 분석');
      const statuses = recentMessages.map(m => m.status);
      const uniqueStatuses = [...new Set(statuses)];
      console.log('모든 상태값:', statuses);
      console.log('고유 상태값:', uniqueStatuses);
      console.log('상태별 개수:', statuses.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}));
    };

    return () => {
      // cleanup
      delete window.debugDashboard;
      delete window.recalculateStats;
      delete window.testApiCall;
      delete window.forceRefresh;
      delete window.checkMessageStatuses;
    };
  }, [stats, devices, recentMessages, lastUpdate, isLoading, isConnected]);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (socket) {
      socket.on('deviceStatusChanged', (data) => {
        console.log('🔌 디바이스 상태 변경:', data);
        setDevices(prev => {
          const updated = prev.map(device =>
            device.id === data.deviceId
              ? { ...device, ...data.device }
              : device
          );

          // ✅ 디바이스 상태 변경 시 통계 재계산
          const deviceStats = calculateDeviceStats(updated);
          setStats(prevStats => ({
            ...prevStats,
            devices: deviceStats
          }));

          return updated;
        });
      });

      socket.on('messageStatusChanged', (data) => {
        console.log('📨 메시지 상태 변경:', data);
        setRecentMessages(prev => {
          const updated = prev.map(message =>
            message.id === data.messageId
              ? { ...message, ...data.message }
              : message
          );

          // ✅ 메시지 상태 변경 시 통계 재계산
          const messageStats = calculateMessageStats(updated);
          setStats(prevStats => ({
            ...prevStats,
            messages: messageStats
          }));

          return updated;
        });
      });

      return () => {
        socket.off('deviceStatusChanged');
        socket.off('messageStatusChanged');
      };
    }
  }, [socket]);

  // ✅ 페이지 포커스 시 자동 새로고침
  useEffect(() => {
    const handleFocus = () => {
      console.log('📱 페이지 포커스 감지, 대시보드 새로고침');
      loadDashboardData('focus');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 페이지 가시성 변경, 대시보드 새로고침');
        loadDashboardData('visibility');
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 자동 새로고침 (15초)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ 자동 새로고침 (15초)');
      loadDashboardData('auto');
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      {/* 헤더 */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          대시보드
        </Typography>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="textSecondary">
            안녕하세요, {user?.profile?.firstName || user?.username}님!
            전광판 시스템 현황을 확인하세요.
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={isConnected ? '실시간 연결됨' : '연결 끊김'}
              color={isConnected ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
            <Typography variant="caption" color="textSecondary">
              마지막 업데이트: {lastUpdate.toLocaleTimeString()}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={() => loadDashboardData('manual')}
              disabled={isLoading}
            >
              새로고침
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ✅ 개선된 에러 및 상태 알림 */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            실시간 연결이 끊어졌습니다. 데이터가 최신 상태가 아닐 수 있습니다.
          </Typography>
        </Alert>
      )}

      {stats.messages.total === 0 && !isLoading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            아직 전송된 메시지가 없습니다. 메시지를 전송해보세요.
          </Typography>
        </Alert>
      )}

      {/* ✅ 수정된 통계 카드 */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전광판"
            value={stats.devices.total}
            subtitle={`온라인: ${stats.devices.online} | 오프라인: ${stats.devices.offline}`}
            icon={<DevicesOther />}
            color="primary"
            trend={{ direction: 'up', value: stats.devices.uptime }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="활성 메시지"
            value={stats.messages.active || 0}
            subtitle={`총 메시지: ${stats.messages.total || 0}`}
            icon={<Message />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전송 성공률"
            value={`${stats.messages.successRate || 0}%`}
            subtitle={`성공: ${stats.messages.successful || 0}건 | 실패: ${stats.messages.failed || 0}건`}
            icon={<Send />}
            color={
              (stats.messages.successRate || 0) >= 80 ? "success" :
                (stats.messages.successRate || 0) >= 60 ? "warning" :
                  "error"
            }
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="시스템 가동률"
            value={`${stats.devices.uptime || 0}%`}
            subtitle="현재 온라인 비율"
            icon={<Timeline />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* 권한 알림 */}
      {!hasPermission('device_control') && !hasPermission('message_send') && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            현재 계정은 조회 권한만 있습니다. 전광판 제어나 메시지 전송을 위해서는 관리자에게 권한을 요청하세요.
          </Typography>
        </Alert>
      )}

      {/* 메인 콘텐츠 */}
      <Grid container spacing={3}>
        {/* 전광판 상태 */}
        <Grid item xs={12} md={6}>
          <DeviceStatusCard
            devices={devices}
            onRefresh={() => loadDashboardData('manual')}
            isLoading={isLoading}
          />
        </Grid>

        {/* 최근 메시지 */}
        <Grid item xs={12} md={6}>
          <RecentMessagesCard
            messages={recentMessages}
            isLoading={isLoading}
          />
        </Grid>

        {/* 빠른 작업 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" mb={2}>
                빠른 작업
              </Typography>
              <Grid container spacing={2}>
                {hasPermission('message_send') && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Send />}
                      href="/messages/send"
                      sx={{ py: 1.5 }}
                    >
                      메시지 전송
                    </Button>
                  </Grid>
                )}
                {hasPermission('device_control') && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Settings />}
                      href="/devices"
                      sx={{ py: 1.5 }}
                    >
                      전광판 관리
                    </Button>
                  </Grid>
                )}
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Visibility />}
                    href="/messages/history"
                    sx={{ py: 1.5 }}
                  >
                    메시지 이력
                  </Button>
                </Grid>
                {hasPermission('user_manage') && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<People />}
                      href="/users"
                      sx={{ py: 1.5 }}
                    >
                      사용자 관리
                    </Button>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ✅ 디버깅 정보 카드 (개발 환경에서만 표시) */}
        {process.env.NODE_ENV === 'development' && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="div" mb={2}>
                  🔧 개발자 디버깅 도구
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  브라우저 콘솔(F12)에서 다음 함수들을 사용할 수 있습니다:
                </Typography>
                <Box component="pre" sx={{
                  bgcolor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  fontSize: '12px',
                  overflow: 'auto'
                }}>
                  {`// 현재 상태 확인
window.debugDashboard()

// 통계 재계산
window.recalculateStats()

// API 테스트
await window.testApiCall()

// 강제 새로고침
window.forceRefresh()

// 메시지 상태 분석
window.checkMessageStatuses()`}
                </Box>
                <Typography variant="caption" color="textSecondary">
                  현재 메시지 수: {stats.messages.total} | 성공률: {stats.messages.successRate}% | 연결상태: {isConnected ? '연결됨' : '끊김'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;