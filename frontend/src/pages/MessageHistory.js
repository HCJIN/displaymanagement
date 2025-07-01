// src/pages/MessageHistory.js - 메시지 이력 보존 버전
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Room as RoomIcon,
  Speed as SpeedIcon,
  ExpandMore,
  FilterList,
  Clear,
  Info,
  Alarm,
  Assignment,
  Archive,
  History,
  ClearAll,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// 표시효과 이름 매핑
const DISPLAY_EFFECTS = {
  1: '바로표시', 2: '좌측스크롤', 3: '위로스크롤', 4: '아래스크롤',
  5: '레이저효과', 6: '중심벌어짐', 7: '중심모여듬', 8: '문자회전',
  9: '회전라인', 10: '문자회전변경', 11: '회전라인변경', 12: '위아래이동1',
  13: '위아래이동2', 14: '역상느리게', 15: '역상빠르게', 16: '현재시간', 17: '좌측전체스크롤'
};

const END_EFFECTS = {
  1: '위로스크롤', 2: '아래스크롤', 3: '중심벌어짐', 4: '중심모여듬',
  5: '바로사라짐', 6: '문자회전사라짐', 7: '좌측스크롤', 8: '화면반전',
  9: '좌우확대사라짐', 10: '중심축소사라짐', 11: '좌우역상확대사라짐'
};

// 탭 패널 컴포넌트
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`history-tabpanel-${index}`}
    aria-labelledby={`history-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const MessageHistory = () => {
  const { hasPermission } = useAuth();
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeTab, setActiveTab] = useState(0);

  // 상세 다이얼로그 상태
  const [detailDialog, setDetailDialog] = useState({ open: false, message: null });

  // 개별 메시지 삭제 다이얼로그
  const [deleteMessageDialog, setDeleteMessageDialog] = useState({
    open: false,
    messageId: null,
    messageContent: ''
  });

  // 방번호 관리 상태 (활성 방번호만 관리)
  const [roomManagement, setRoomManagement] = useState({
    selectedDevice: '',
    roomInfo: {
      activeRooms: [],  // 현재 활성 방번호만 저장
      roomMessages: {},
      loading: false
    },
    clearRoomDialog: { open: false, deviceId: '', roomNumber: null }
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: null,
    endDate: null,
    deviceId: '',
    roomNumber: '',
    priority: '',
    urgent: '',
    showArchived: true, // 아카이브된 메시지도 기본적으로 표시
  });

  // 통계 데이터
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {},
    byType: {},
    byPriority: {},
    byRoomNumber: {},
  });

  // 초기 데이터 로드
  useEffect(() => {
    fetchMessages();
    fetchDevices();
  }, []);

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 디바이스 목록 조회
  const fetchDevices = async () => {
    try {
      const response = await api.devices.getAll();
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('디바이스 목록 조회 실패:', error);
      showSnackbar('디바이스 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  // 🔧 메시지 목록 조회 (이력 보존 버전)
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.messages.getAll({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeStats: true,
        includeArchived: true // 아카이브된 메시지도 포함
      });

      if (response.data) {
        let messages = response.data.messages || [];

        console.log('🔧 메시지 이력 조회 결과 (이력 보존):', {
          총메시지수: messages.length,
          활성메시지: messages.filter(m => m.status !== 'archived').length,
          아카이브메시지: messages.filter(m => m.status === 'archived').length
        });

        // 🔧 이력은 모두 유지, 정렬만 수행
        messages.sort((a, b) => new Date(b.createdAt || b.sentAt) - new Date(a.createdAt || a.sentAt));

        setMessages(messages);
        setStats(response.data.stats || {
          total: messages.length,
          byStatus: {},
          byType: {},
          byPriority: {},
          byRoomNumber: {}
        });
      }
    } catch (error) {
      console.error('메시지 이력 조회 실패:', error);
      showSnackbar('메시지 이력을 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 활성 방번호 정보 로드 (현재 전광판에 표시 중인 것만)
  const fetchActiveRoomInfo = async (deviceId) => {
    if (!deviceId) return;

    setRoomManagement(prev => ({
      ...prev,
      roomInfo: { ...prev.roomInfo, loading: true }
    }));

    try {
      console.log('🔧 활성 방번호 정보 로드 시작:', deviceId);

      // 기존 API 사용
      const response = await api.messages.rooms.getDeviceRooms(deviceId);

      if (response.data && response.data.success) {
        // 🔧 현재 전광판에 사용 중인 방번호를 활성 방번호로 간주
        const rawUsedRooms = response.data.usedRooms || [];
        const activeRoomsSet = new Set();

        rawUsedRooms.forEach(room => {
          const roomNum = parseInt(room);
          if (!isNaN(roomNum) && roomNum > 0 && roomNum <= 100) {
            activeRoomsSet.add(roomNum);
          }
        });

        const activeRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);

        setRoomManagement(prev => ({
          ...prev,
          roomInfo: {
            activeRooms: activeRooms,
            roomMessages: response.data.roomMessages || {},
            loading: false
          }
        }));

        console.log('🔧 활성 방번호 로드 완료:', {
          deviceId,
          activeRooms
        });
      } else {
        // 🔧 API가 없는 경우 메시지에서 추출 (활성 상태만)
        console.warn('방번호 API가 준비되지 않음, 현재 메시지에서 추출');

        const deviceMessages = messages.filter(msg =>
          msg.deviceId === deviceId &&
          msg.roomNumber != null &&
          ['active', 'sent', 'pending'].includes(msg.status) // 활성 상태만
        );

        const activeRoomsSet = new Set();
        const roomMessagesMap = new Map();

        deviceMessages
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .forEach(msg => {
            const roomNum = parseInt(msg.roomNumber);
            if (!isNaN(roomNum) && roomNum > 0 && roomNum <= 100) {
              activeRoomsSet.add(roomNum);
              if (!roomMessagesMap.has(roomNum)) {
                roomMessagesMap.set(roomNum, [msg]);
              }
            }
          });

        const activeRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);
        const roomMessages = Object.fromEntries(roomMessagesMap);

        setRoomManagement(prev => ({
          ...prev,
          roomInfo: {
            activeRooms: activeRooms,
            roomMessages: roomMessages,
            loading: false
          }
        }));

        console.log('🔧 현재 메시지에서 활성 방번호 추출 완료:', {
          deviceId,
          activeRooms
        });
      }
    } catch (error) {
      console.error('활성 방번호 정보 로드 실패:', error);

      // 기본값으로 설정
      setRoomManagement(prev => ({
        ...prev,
        roomInfo: {
          activeRooms: [],
          roomMessages: {},
          loading: false
        }
      }));

      showSnackbar('활성 방번호 정보를 불러오는데 실패했습니다.', 'error');
    }
  };

  // 🔧 방번호 해제 (전광판에서만 삭제, 이력은 보존 - 개별 메시지 삭제와 구분)
  const handleClearRoom = async (deviceId, roomNumber) => {
    try {
      console.log('🔧 방번호 해제 시작 (이력 보존, 로컬 관리):', { deviceId, roomNumber });

      // 🔧 이력 보존을 위해 deleteRoom API 사용하지 않고 로컬 상태만 관리
      // 실제 전광판 제어가 필요한 경우에만 별도 API 호출

      try {
        // 방번호 해제 전용 API가 있다면 사용 (메시지 삭제하지 않음)
        const response = await api.messages.rooms.clearRoomDisplay?.(deviceId, roomNumber);
        if (response?.data?.success) {
          showSnackbar(response.data.message || `방번호 ${roomNumber}가 해제되었습니다.`, 'success');
        } else {
          showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
        }
      } catch (apiError) {
        console.log('전광판 제어 API 없음, 로컬에서만 관리:', apiError.message);
        showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
      }

      // 🔧 활성 방번호 목록에서만 제거 (메시지 이력은 건드리지 않음)
      const roomNum = parseInt(roomNumber);

      setRoomManagement(prev => {
        const currentActiveRooms = prev.roomInfo.activeRooms || [];
        const activeRoomsSet = new Set(currentActiveRooms);
        activeRoomsSet.delete(roomNum);

        const newActiveRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);

        console.log('🔧 활성 방번호 목록 업데이트 (이력 보존, 로컬만):', {
          roomNumber: roomNum,
          기존활성방번호: currentActiveRooms,
          새활성방번호: newActiveRooms
        });

        return {
          ...prev,
          roomInfo: {
            ...prev.roomInfo,
            activeRooms: newActiveRooms
          },
          clearRoomDialog: { open: false, deviceId: '', roomNumber: null }
        };
      });

      // 🔧 메시지 상태를 'archived'로 변경 (UI 표시용, 실제 삭제하지 않음)
      setMessages(prev => prev.map(msg => {
        if (msg.deviceId === deviceId && parseInt(msg.roomNumber) === roomNum) {
          return {
            ...msg,
            status: 'archived',
            archivedAt: new Date().toISOString()
          };
        }
        return msg;
      }));

    } catch (error) {
      console.error('방번호 해제 실패:', error);

      // 오류가 발생해도 로컬 상태는 업데이트 (이력 보존)
      const roomNum = parseInt(roomNumber);

      setRoomManagement(prev => {
        const activeRoomsSet = new Set(prev.roomInfo.activeRooms);
        activeRoomsSet.delete(roomNum);

        return {
          ...prev,
          roomInfo: {
            ...prev.roomInfo,
            activeRooms: Array.from(activeRoomsSet).sort((a, b) => a - b)
          },
          clearRoomDialog: { open: false, deviceId: '', roomNumber: null }
        };
      });

      // 메시지 상태를 archived로 변경
      setMessages(prev => prev.map(msg => {
        if (msg.deviceId === deviceId && parseInt(msg.roomNumber) === roomNum) {
          return {
            ...msg,
            status: 'archived',
            archivedAt: new Date().toISOString()
          };
        }
        return msg;
      }));

      showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
    }
  };

  // 🔧 개별 메시지 삭제 (이력에서 완전 삭제)
  const handleDeleteMessage = async (messageId) => {
    try {
      console.log('🔧 개별 메시지 삭제:', messageId);

      // 백엔드 API 호출
      try {
        const response = await api.messages.deleteMessage(messageId);
        if (response.data && response.data.success) {
          showSnackbar('메시지가 삭제되었습니다.', 'success');
        } else {
          showSnackbar('메시지가 삭제되었습니다.', 'success');
        }
      } catch (apiError) {
        // API 오류 시에도 로컬에서는 삭제 처리
        console.log('API 호출 실패, 로컬에서만 삭제:', apiError.message);
        showSnackbar('메시지가 삭제되었습니다. (로컬 처리)', 'success');
      }

      // 메시지 목록에서 완전 제거 (로컬 상태)
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      setDeleteMessageDialog({ open: false, messageId: null, messageContent: '' });

    } catch (error) {
      console.error('메시지 삭제 처리 실패:', error);

      // 오류가 발생해도 로컬에서는 삭제 처리
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setDeleteMessageDialog({ open: false, messageId: null, messageContent: '' });
      showSnackbar('메시지가 삭제되었습니다. (로컬 처리)', 'success');
    }
  };

  // 필터 적용
  useEffect(() => {
    let filtered = [...messages];

    // 아카이브 필터
    if (!filters.showArchived) {
      filtered = filtered.filter(message => message.status !== 'archived');
    }

    // 검색어 필터
    if (filters.search) {
      filtered = filtered.filter(message =>
        (message.content && message.content.toLowerCase().includes(filters.search.toLowerCase())) ||
        (message.deviceName && message.deviceName.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    // 상태 필터
    if (filters.status) {
      filtered = filtered.filter(message => message.status === filters.status);
    }

    // 방번호 필터
    if (filters.roomNumber) {
      filtered = filtered.filter(message =>
        message.roomNumber === parseInt(filters.roomNumber)
      );
    }

    // 우선순위 필터
    if (filters.priority) {
      filtered = filtered.filter(message => message.priority === filters.priority);
    }

    // 긴급 메시지 필터
    if (filters.urgent !== '') {
      filtered = filtered.filter(message =>
        message.urgent === (filters.urgent === 'true')
      );
    }

    // 날짜 필터
    if (filters.startDate) {
      filtered = filtered.filter(message =>
        new Date(message.createdAt || message.sentAt) >= filters.startDate
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(message =>
        new Date(message.createdAt || message.sentAt) <= filters.endDate
      );
    }

    // 디바이스 필터
    if (filters.deviceId) {
      filtered = filtered.filter(message => message.deviceId === filters.deviceId);
    }

    setFilteredMessages(filtered);
    setPage(0);
  }, [messages, filters]);

  // 필터 변경 핸들러
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: '',
      startDate: null,
      endDate: null,
      deviceId: '',
      roomNumber: '',
      priority: '',
      urgent: '',
      showArchived: true,
    });
  };

  // 페이지 변경
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 상태별 색상/텍스트
  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
      case 'active':
        return 'success';
      case 'pending':
      case 'sending':
        return 'warning';
      case 'failed':
      case 'error':
        return 'error';
      case 'expired':
        return 'default';
      case 'cancelled':
        return 'secondary';
      case 'archived':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'sending':
        return '전송중';
      case 'sent':
        return '전송완료';
      case 'active':
        return '표시중';
      case 'expired':
        return '만료됨';
      case 'failed':
        return '실패';
      case 'cancelled':
        return '취소됨';
      case 'archived':
        return '보관됨';
      default:
        return '알 수 없음';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'error';
      case 'HIGH': return 'warning';
      case 'NORMAL': return 'default';
      case 'LOW': return 'info';
      default: return 'default';
    }
  };

  // 데이터 내보내기
  const handleExport = () => {
    try {
      const csvHeaders = [
        '전송일시', '디바이스', '방번호', '메시지내용', '상태', '우선순위',
        '긴급여부', '표시효과', '완료효과', '전송자', '보관일시'
      ];

      const csvData = filteredMessages.map(message => [
        new Date(message.createdAt || message.sentAt).toLocaleString('ko-KR'),
        message.deviceName || message.deviceId,
        message.roomNumber || '',
        `"${(message.content || '').replace(/"/g, '""').substring(0, 50)}"`,
        getStatusText(message.status),
        message.priority || '',
        message.urgent ? '긴급' : '일반',
        DISPLAY_EFFECTS[message.displayOptions?.displayEffect] || '',
        END_EFFECTS[message.displayOptions?.endEffect] || '',
        message.senderName || message.createdBy,
        message.archivedAt ? new Date(message.archivedAt).toLocaleString('ko-KR') : ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `메시지이력_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSnackbar('데이터를 성공적으로 내보냈습니다.', 'success');
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
      showSnackbar('데이터 내보내기에 실패했습니다.', 'error');
    }
  };

  // 메시지 상세보기
  const handleViewDetail = (message) => {
    setDetailDialog({ open: true, message });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          메시지 전송 이력
        </Typography>

        {/* 권한 확인 */}
        {!hasPermission('message_view') && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            메시지 이력 조회 권한이 제한되어 있습니다. 일부 정보가 표시되지 않을 수 있습니다.
          </Alert>
        )}

        {/* 탭 네비게이션 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, value) => setActiveTab(value)}>
            <Tab
              label="메시지 이력"
              icon={<History />}
              iconPosition="start"
            />
            <Tab
              label="활성 방번호 관리"
              icon={<RoomIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* 로딩 표시 */}
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {/* 메시지 이력 탭 */}
            <TabPanel value={activeTab} index={0}>
              {/* 통계 카드 */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        총 메시지
                      </Typography>
                      <Typography variant="h4">
                        {stats.total?.toLocaleString() || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        활성 메시지
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {messages.filter(m => ['active', 'sent', 'pending'].includes(m.status)).length.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        보관된 메시지
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        {messages.filter(m => m.status === 'archived').length.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        전송실패
                      </Typography>
                      <Typography variant="h4" color="error.main">
                        {messages.filter(m => m.status === 'failed').length.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 필터 영역 */}
              <Accordion sx={{ mb: 3 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterList />
                    필터 및 검색 ({filteredMessages.length}개 표시)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="검색"
                        placeholder="메시지 내용, 디바이스명"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.disabled' }} />,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>디바이스</InputLabel>
                        <Select
                          value={filters.deviceId}
                          onChange={(e) => handleFilterChange('deviceId', e.target.value)}
                          label="디바이스"
                        >
                          <MenuItem key="filter-device-all" value="">전체</MenuItem>
                          {devices.map((device, index) => (
                            <MenuItem key={`filter-device-${device.id}-${index}`} value={device.id}>
                              {device.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>상태</InputLabel>
                        <Select
                          value={filters.status}
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                          label="상태"
                        >
                          <MenuItem key="filter-status-all" value="">전체</MenuItem>
                          <MenuItem key="filter-status-pending" value="pending">대기중</MenuItem>
                          <MenuItem key="filter-status-sending" value="sending">전송중</MenuItem>
                          <MenuItem key="filter-status-sent" value="sent">전송완료</MenuItem>
                          <MenuItem key="filter-status-active" value="active">표시중</MenuItem>
                          <MenuItem key="filter-status-expired" value="expired">만료됨</MenuItem>
                          <MenuItem key="filter-status-failed" value="failed">실패</MenuItem>
                          <MenuItem key="filter-status-cancelled" value="cancelled">취소됨</MenuItem>
                          <MenuItem key="filter-status-archived" value="archived">보관됨</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="방번호"
                        placeholder="1-100"
                        type="number"
                        value={filters.roomNumber}
                        onChange={(e) => handleFilterChange('roomNumber', e.target.value)}
                        inputProps={{ min: 1, max: 100 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>보관 메시지 표시</InputLabel>
                        <Select
                          value={filters.showArchived}
                          onChange={(e) => handleFilterChange('showArchived', e.target.value)}
                          label="보관 메시지 표시"
                        >
                          <MenuItem key="show-archived-all" value={true}>모든 메시지</MenuItem>
                          <MenuItem key="show-archived-active" value={false}>활성 메시지만</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>우선순위</InputLabel>
                        <Select
                          value={filters.priority}
                          onChange={(e) => handleFilterChange('priority', e.target.value)}
                          label="우선순위"
                        >
                          <MenuItem key="filter-priority-all" value="">전체</MenuItem>
                          <MenuItem key="filter-priority-urgent" value="URGENT">긴급</MenuItem>
                          <MenuItem key="filter-priority-high" value="HIGH">높음</MenuItem>
                          <MenuItem key="filter-priority-normal" value="NORMAL">보통</MenuItem>
                          <MenuItem key="filter-priority-low" value="LOW">낮음</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <DatePicker
                        label="시작일"
                        value={filters.startDate}
                        onChange={(date) => handleFilterChange('startDate', date)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <DatePicker
                        label="종료일"
                        value={filters.endDate}
                        onChange={(date) => handleFilterChange('endDate', date)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          onClick={handleResetFilters}
                          startIcon={<Clear />}
                        >
                          필터 초기화
                        </Button>
                        <Tooltip title="새로고침">
                          <IconButton onClick={fetchMessages}>
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="내보내기">
                          <IconButton onClick={handleExport}>
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* 메시지 테이블 */}
              <Paper>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>전송일시</TableCell>
                        <TableCell>디바이스</TableCell>
                        <TableCell>방번호</TableCell>
                        <TableCell>메시지 내용</TableCell>
                        <TableCell>상태</TableCell>
                        <TableCell>우선순위</TableCell>
                        <TableCell>효과</TableCell>
                        <TableCell>전송자</TableCell>
                        <TableCell>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMessages
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((message, index) => (
                          <TableRow
                            key={`message-history-${message.id}-${index}-${message.createdAt}`}
                            hover
                            sx={{
                              opacity: message.status === 'archived' ? 0.7 : 1,
                              backgroundColor: message.status === 'archived' ? 'action.hover' : 'inherit'
                            }}
                          >
                            <TableCell>
                              <Box>
                                <Typography variant="body2">
                                  {new Date(message.createdAt || message.sentAt).toLocaleString('ko-KR')}
                                </Typography>
                                {message.archivedAt && (
                                  <Typography variant="caption" color="textSecondary">
                                    보관: {new Date(message.archivedAt).toLocaleString('ko-KR')}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>{message.deviceName || message.deviceId}</TableCell>
                            <TableCell>
                              {message.roomNumber ? (
                                <Chip
                                  label={message.roomNumber}
                                  size="small"
                                  color={message.roomNumber <= 5 ? 'warning' : 'default'}
                                  icon={<RoomIcon />}
                                  variant={message.status === 'archived' ? 'outlined' : 'filled'}
                                />
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {message.content || ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip
                                  label={getStatusText(message.status)}
                                  color={getStatusColor(message.status)}
                                  size="small"
                                  icon={message.status === 'archived' ? <Archive /> : undefined}
                                />
                                {message.urgent && (
                                  <Chip
                                    label="긴급"
                                    color="error"
                                    size="small"
                                    icon={<Alarm />}
                                    variant={message.status === 'archived' ? 'outlined' : 'filled'}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {message.priority && (
                                <Chip
                                  label={message.priority}
                                  color={getPriorityColor(message.priority)}
                                  size="small"
                                  variant={message.status === 'archived' ? 'outlined' : 'filled'}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {message.displayOptions?.displayEffect && (
                                <Tooltip title={`표시: ${DISPLAY_EFFECTS[message.displayOptions.displayEffect] || ''} / 완료: ${END_EFFECTS[message.displayOptions.endEffect] || ''}`}>
                                  <Chip
                                    label={DISPLAY_EFFECTS[message.displayOptions.displayEffect] || '기본'}
                                    size="small"
                                    variant="outlined"
                                    icon={<SpeedIcon />}
                                  />
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>{message.senderName || message.createdBy}</TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5}>
                                <Tooltip title="상세보기">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewDetail(message)}
                                  >
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="메시지 삭제 (이력에서 완전 삭제)">
                                  <IconButton
                                    size="small"
                                    onClick={() => setDeleteMessageDialog({
                                      open: true,
                                      messageId: message.id,
                                      messageContent: message.content?.substring(0, 30) + '...'
                                    })}
                                    disabled={!hasPermission('message_delete')}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {filteredMessages.length === 0 && (
                  <Box textAlign="center" py={4}>
                    <Typography color="textSecondary">
                      표시할 메시지가 없습니다.
                    </Typography>
                  </Box>
                )}

                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  component="div"
                  count={filteredMessages.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="페이지당 행 수:"
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}-${to} / 총 ${count}개`
                  }
                />
              </Paper>
            </TabPanel>

            {/* 🔧 활성 방번호 관리 탭 */}
            <TabPanel value={activeTab} index={1}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <Info sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  여기서는 현재 전광판에 표시 중인 활성 방번호만 관리됩니다.
                  방번호를 해제해도 메시지 이력은 보존되며, 이력 탭에서 개별적으로 관리할 수 있습니다.
                </Typography>
              </Alert>

              <Grid container spacing={3}>
                {/* 디바이스 선택 */}
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        디바이스 선택
                      </Typography>
                      <FormControl fullWidth>
                        <InputLabel>전광판</InputLabel>
                        <Select
                          value={roomManagement.selectedDevice}
                          onChange={(e) => {
                            const deviceId = e.target.value;
                            setRoomManagement(prev => ({
                              ...prev,
                              selectedDevice: deviceId
                            }));
                            if (deviceId) {
                              fetchActiveRoomInfo(deviceId);
                            }
                          }}
                          label="전광판"
                        >
                          {devices.map((device, index) => (
                            <MenuItem key={`room-mgmt-device-${device.id}-${index}`} value={device.id}>
                              <Box display="flex" alignItems="center" gap={2} width="100%">
                                <Typography>{device.name}</Typography>
                                <Chip
                                  label={device.status === 'online' ? '온라인' : '오프라인'}
                                  color={device.status === 'online' ? 'success' : 'error'}
                                  size="small"
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 활성 방번호 현황 */}
                <Grid item xs={12} md={8}>
                  {roomManagement.selectedDevice && (
                    <Card>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">
                            활성 방번호 현황
                          </Typography>
                          {roomManagement.roomInfo.loading && <CircularProgress size={20} />}
                        </Box>

                        {/* 통계 */}
                        <Grid container spacing={2} mb={3}>
                          <Grid item xs={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">100</Typography>
                              <Typography variant="caption">총 방개수</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="error">
                                {roomManagement.roomInfo.activeRooms.length}
                              </Typography>
                              <Typography variant="caption">활성 방번호</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="success">
                                {100 - roomManagement.roomInfo.activeRooms.length}
                              </Typography>
                              <Typography variant="caption">사용가능</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="warning">
                                {roomManagement.roomInfo.activeRooms.filter(r => r <= 5).length}
                              </Typography>
                              <Typography variant="caption">긴급용</Typography>
                            </Paper>
                          </Grid>
                        </Grid>

                        {/* 활성 방번호 목록 */}
                        {roomManagement.roomInfo.activeRooms.length > 0 ? (
                          <List>
                            {roomManagement.roomInfo.activeRooms.map((roomNum, index) => (
                              <ListItem
                                key={`active-room-${roomManagement.selectedDevice}-${roomNum}-${index}`}
                                divider
                              >
                                <ListItemText
                                  primary={
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Chip
                                        label={`방번호 ${roomNum}`}
                                        color={roomNum <= 5 ? 'warning' : 'default'}
                                        size="small"
                                      />
                                      {roomNum <= 5 && (
                                        <Chip label="긴급용" color="error" size="small" />
                                      )}
                                    </Box>
                                  }
                                  secondary={
                                    <Typography variant="body2" color="textSecondary">
                                      활성 메시지 {roomManagement.roomInfo.roomMessages[roomNum]?.length || 0}개 •
                                      최근 업데이트: {
                                        roomManagement.roomInfo.roomMessages[roomNum]?.[0]?.createdAt ?
                                          new Date(roomManagement.roomInfo.roomMessages[roomNum][0].createdAt).toLocaleString() :
                                          '정보 없음'
                                      }
                                    </Typography>
                                  }
                                />
                                <ListItemSecondaryAction>
                                  <Tooltip title={`방번호 ${roomNum} 해제 (이력은 보존됨)`}>
                                    <IconButton
                                      edge="end"
                                      onClick={() => {
                                        setRoomManagement(prev => ({
                                          ...prev,
                                          clearRoomDialog: {
                                            open: true,
                                            deviceId: roomManagement.selectedDevice,
                                            roomNumber: roomNum
                                          }
                                        }));
                                      }}
                                      disabled={!hasPermission('message_send')}
                                    >
                                      <ClearAll />
                                    </IconButton>
                                  </Tooltip>
                                </ListItemSecondaryAction>
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Box textAlign="center" py={4}>
                            <Typography color="textSecondary">
                              활성 상태인 방번호가 없습니다.
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {!roomManagement.selectedDevice && (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <Typography color="textSecondary">
                        활성 방번호를 관리할 전광판을 선택해주세요.
                      </Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </TabPanel>
          </>
        )}

        {/* 메시지 상세보기 다이얼로그 */}
        <Dialog
          open={detailDialog.open}
          onClose={() => setDetailDialog({ open: false, message: null })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            메시지 상세 정보
          </DialogTitle>
          <DialogContent>
            {detailDialog.message && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>기본 정보</Typography>
                  <Box mb={2}>
                    <Typography variant="body2"><strong>메시지 ID:</strong> {detailDialog.message.id}</Typography>
                    <Typography variant="body2"><strong>전광판:</strong> {detailDialog.message.deviceName}</Typography>
                    <Typography variant="body2"><strong>방번호:</strong> {detailDialog.message.roomNumber || '미지정'}</Typography>
                    <Typography variant="body2"><strong>상태:</strong> {getStatusText(detailDialog.message.status)}</Typography>
                    <Typography variant="body2"><strong>우선순위:</strong> {detailDialog.message.priority}</Typography>
                    <Typography variant="body2"><strong>긴급 메시지:</strong> {detailDialog.message.urgent ? '예' : '아니오'}</Typography>
                  </Box>

                  <Typography variant="subtitle2" gutterBottom>시간 정보</Typography>
                  <Box mb={2}>
                    <Typography variant="body2">
                      <strong>생성일시:</strong> {new Date(detailDialog.message.createdAt).toLocaleString()}
                    </Typography>
                    {detailDialog.message.sentAt && (
                      <Typography variant="body2">
                        <strong>전송일시:</strong> {new Date(detailDialog.message.sentAt).toLocaleString()}
                      </Typography>
                    )}
                    {detailDialog.message.archivedAt && (
                      <Typography variant="body2">
                        <strong>보관일시:</strong> {new Date(detailDialog.message.archivedAt).toLocaleString()}
                      </Typography>
                    )}
                    <Typography variant="body2"><strong>전송자:</strong> {detailDialog.message.createdBy}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>표시 옵션</Typography>
                  <Box mb={2}>
                    {detailDialog.message.displayOptions && (
                      <>
                        <Typography variant="body2">
                          <strong>표시 효과:</strong> {DISPLAY_EFFECTS[detailDialog.message.displayOptions.displayEffect] || '기본'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>완료 효과:</strong> {END_EFFECTS[detailDialog.message.displayOptions.endEffect] || '기본'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>폰트 크기:</strong> {detailDialog.message.displayOptions.fontSize}px
                        </Typography>
                        <Typography variant="body2">
                          <strong>텍스트 색상:</strong> {detailDialog.message.displayOptions.color}
                        </Typography>
                        <Typography variant="body2">
                          <strong>싸이렌 출력:</strong> {detailDialog.message.displayOptions.sirenOutput ? '예' : '아니오'}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>메시지 내용</Typography>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                      {detailDialog.message.content || '내용 없음'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialog({ open: false, message: null })}>
              닫기
            </Button>
          </DialogActions>
        </Dialog>

        {/* 개별 메시지 삭제 확인 다이얼로그 */}
        <Dialog
          open={deleteMessageDialog.open}
          onClose={() => setDeleteMessageDialog({ open: false, messageId: null, messageContent: '' })}
        >
          <DialogTitle>메시지 삭제 확인</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              다음 메시지를 이력에서 완전히 삭제하시겠습니까?
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="textSecondary">
                "{deleteMessageDialog.messageContent}"
              </Typography>
            </Paper>
            <Alert severity="warning" sx={{ mt: 2 }}>
              이 작업은 되돌릴 수 없습니다. 메시지가 이력에서 완전히 삭제됩니다.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteMessageDialog({ open: false, messageId: null, messageContent: '' })}
            >
              취소
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleDeleteMessage(deleteMessageDialog.messageId)}
            >
              삭제
            </Button>
          </DialogActions>
        </Dialog>

        {/* 방번호 해제 확인 다이얼로그 */}
        <Dialog
          open={roomManagement.clearRoomDialog.open}
          onClose={() => setRoomManagement(prev => ({
            ...prev,
            clearRoomDialog: { open: false, deviceId: '', roomNumber: null }
          }))}
        >
          <DialogTitle>방번호 해제 확인</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              방번호 {roomManagement.clearRoomDialog.roomNumber}를 전광판에서 해제하시겠습니까?
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Box display="flex" alignItems="center">
                <Info sx={{ fontSize: 16, mr: 1 }} />
                <Typography variant="body2">
                  방번호가 해제되어도 메시지 이력은 보존됩니다.
                  해당 방번호의 메시지는 '보관됨' 상태로 변경되며, 이력 탭에서 확인할 수 있습니다.
                </Typography>
              </Box>
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setRoomManagement(prev => ({
                ...prev,
                clearRoomDialog: { open: false, deviceId: '', roomNumber: null }
              }))}
            >
              취소
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => handleClearRoom(
                roomManagement.clearRoomDialog.deviceId,
                roomManagement.clearRoomDialog.roomNumber
              )}
            >
              방번호 해제
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
    </LocalizationProvider>
  );
};

export default MessageHistory;