// src/pages/MessageSend.js - TCP/IP 통신 및 이미지 변환 지원
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Send,
  Image,
  FormatColorText,
  Schedule,
  Settings,
  Delete,
  ExpandMore,
  Preview,
  DevicesOther,
  Refresh,
  Room,
  Speed,
  Info,
  Warning,
  Science,
  ClearAll,
  CloudUpload,
  NetworkCheck,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api, { apiUtils } from '../services/api';

// 표시효과 옵션 (PDF 프로토콜 기준)
const DISPLAY_EFFECTS = {
  0x01: { name: '바로 표시', icon: '📍' },
  0x02: { name: '좌측으로 스크롤', icon: '⬅️' },
  0x03: { name: '위로 스크롤', icon: '⬆️' },
  0x04: { name: '아래로 스크롤', icon: '⬇️' },
  0x05: { name: '레이저 효과', icon: '✨' },
  0x06: { name: '중심에서 상하로 벌어짐', icon: '📤' },
  0x07: { name: '상하에서 중심으로 모여듬', icon: '📥' },
  0x08: { name: '문자 회전 표시', icon: '🔄' },
  0x09: { name: '회전 라인 표시', icon: '🌀' },
  0x0A: { name: '문자 회전 변경', icon: '🔄' },
  0x0B: { name: '회전 라인 변경', icon: '🌀' },
  0x0C: { name: '문자 위아래 이동1', icon: '↕️' },
  0x0D: { name: '문자 위아래 이동2', icon: '↕️' },
  0x0E: { name: '역상 표시 (느리게)', icon: '🐌' },
  0x0F: { name: '역상 표시 (빠르게)', icon: '🐰' },
  0x10: { name: '현재시간 표시', icon: '🕐' },
  0x11: { name: '왼쪽으로 모두 스크롤', icon: '⬅️' },
};

// 완료효과 옵션
const END_EFFECTS = {
  0x05: { name: '바로 사라짐', icon: '💨' },
  0x07: { name: '좌측으로 스크롤', icon: '⬅️' },
  0x01: { name: '위로 스크롤', icon: '⬆️' },
  0x02: { name: '아래로 스크롤', icon: '⬇️' },
  0x03: { name: '중심에서 상하로 벌어짐', icon: '📤' },
  0x04: { name: '상하에서 중심으로 모여듬', icon: '📥' },
  0x06: { name: '문자회전하며 사라짐', icon: '🔄' },
  0x08: { name: '화면 반전', icon: '🔀' },
  0x09: { name: '좌우로 확대되면서 사라짐', icon: '📏' },
  0x0A: { name: '중심으로 축소되면서 사라짐', icon: '🔍' },
  0x0B: { name: '좌우역상으로 확대되면서 사라짐', icon: '📐' },
};

// 탭 패널 컴포넌트
const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`message-tabpanel-${index}`}
    aria-labelledby={`message-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const MessageSend = () => {
  const [searchParams] = useSearchParams();
  const { hasPermission, user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [previewDialog, setPreviewDialog] = useState(false);

  // 활성 방번호 관련 상태 (현재 전광판에 표시 중인 것만)
  const [roomInfo, setRoomInfo] = useState({
    activeRooms: [],  // 활성 방번호만 저장
    availableRooms: { urgent: [], normal: [] },
    roomMessages: {},
    loading: false
  });

  const [formData, setFormData] = useState({
    deviceId: searchParams.get('deviceId') || '',
    messageType: 'text',
    content: '',
    imageData: null,
    webServerUrl: '', // 웹서버 URL 추가
    components: [],
    priority: 'NORMAL',
    urgent: false,

    // 방번호 관련
    roomNumber: '',
    autoAssignRoom: true,

    displayOptions: {
      fontSize: 16, // 기본 폰트 크기 증가
      color: '#FFFFFF',
      backgroundColor: '#000000',
      scrollType: 'horizontal',
      scrollSpeed: 'normal',
      position: 'center',

      // 프로토콜 표시효과
      displayEffect: 0x01,
      displayEffectSpeed: 4,
      displayWaitTime: 1,
      endEffect: 0x05,
      endEffectSpeed: 4,
    },
    schedule: {
      startTime: '',
      endTime: '',
      duration: 10,
      repeatCount: 1,
    },

    // 🆕 MQTT 통신 설정
    mqttBroker: 'localhost:1883'
  });

  const hasMessagePermission = hasPermission('message_send');

  // 디바이스 목록 로드
  const loadDevices = async () => {
    try {
      const response = await api.devices.getAll();
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('디바이스 목록 로드 실패:', error);
      showSnackbar('디바이스 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  // 활성 방번호 정보 로드 (기존 API 사용하되 활성 상태만 필터링)
  const loadActiveRoomInfo = async (deviceId) => {
    if (!deviceId) return;

    setRoomInfo(prev => ({ ...prev, loading: true }));

    try {
      console.log('활성 방번호 정보 로드 시작 (이력과 분리):', deviceId);

      // 기존 API 사용
      const response = await api.messages.rooms.getDeviceRooms(deviceId);

      if (response.data && response.data.success) {
        // 모든 방번호에서 활성 상태인 것만 필터링
        const rawUsedRooms = response.data.usedRooms || [];
        const activeRoomsSet = new Set();

        // 활성 방번호만 Set에 추가 (여기서는 모든 usedRooms를 활성으로 간주)
        rawUsedRooms.forEach(room => {
          const roomNum = parseInt(room);
          if (!isNaN(roomNum) && roomNum > 0) {
            activeRoomsSet.add(roomNum);
          }
        });

        const activeRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);

        console.log('활성 방번호 로드 완료 (기존 API):', {
          원본: rawUsedRooms,
          활성방번호: activeRooms
        });

        setRoomInfo({
          activeRooms: activeRooms,
          availableRooms: response.data.availableRooms || { urgent: [], normal: [] },
          roomMessages: response.data.roomMessages || {},
          loading: false
        });
      } else {
        // API가 없는 경우: 기본적으로 빈 상태로 시작
        console.warn('방번호 API가 준비되지 않음, 기본 상태로 설정');

        setRoomInfo({
          activeRooms: [],  // 활성 방번호 없음으로 시작
          availableRooms: { urgent: [], normal: [] },
          roomMessages: {},
          loading: false
        });

        console.log('활성 방번호 기본 상태 설정:', {
          deviceId,
          activeRooms: []
        });
      }
    } catch (error) {
      console.error('활성 방번호 정보 로드 실패:', error);

      if (error.response?.status === 404) {
        // API가 없는 경우 기본 상태
        setRoomInfo({
          activeRooms: [],
          availableRooms: { urgent: [], normal: [] },
          roomMessages: {},
          loading: false
        });

        showSnackbar('방번호 관리 API가 준비되지 않아 기본 상태로 설정합니다.', 'info');
      } else {
        setRoomInfo(prev => ({ ...prev, loading: false }));
        showSnackbar('활성 방번호 정보를 불러오는데 실패했습니다.', 'error');
      }
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // 디바이스 변경 시 활성 방번호 정보 로드
  useEffect(() => {
    if (formData.deviceId) {
      loadActiveRoomInfo(formData.deviceId);
    }
  }, [formData.deviceId]);

  // 스낵바 표시
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 폼 데이터 업데이트
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // 표시 옵션 업데이트
  const updateDisplayOptions = (field, value) => {
    console.log(`🔧 표시 옵션 변경: ${field} = ${value}`); // 디버깅 로그
    setFormData(prev => ({
      ...prev,
      displayOptions: {
        ...prev.displayOptions,
        [field]: value,
      },
    }));
  };

  // 스케줄 업데이트
  const updateSchedule = (field, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [field]: value,
      },
    }));
  };

  // 긴급 메시지 설정 시 방번호 제한
  const handleUrgentChange = (urgent) => {
    updateFormData('urgent', urgent);

    if (urgent) {
      updateFormData('priority', 'URGENT');
      if (formData.roomNumber && parseInt(formData.roomNumber) > 5) {
        updateFormData('roomNumber', '');
        updateFormData('autoAssignRoom', true);
      }
    }
  };

  // 방번호 변경 핸들러 (활성 방번호 기준)
  const handleRoomNumberChange = (roomNumber) => {
    console.log('방번호 변경 (활성 기준):', {
      input: roomNumber,
      type: typeof roomNumber,
      urgent: formData.urgent,
      currentActiveRooms: roomInfo.activeRooms
    });

    if (roomNumber === '' || roomNumber == null) {
      updateFormData('roomNumber', '');
      updateFormData('autoAssignRoom', true);
      return;
    }

    const numValue = parseInt(roomNumber);
    if (isNaN(numValue)) {
      console.warn('Invalid room number:', roomNumber);
      return;
    }

    if (formData.urgent && (numValue < 1 || numValue > 5)) {
      showSnackbar('긴급 메시지는 1-5번 방만 사용할 수 있습니다.', 'warning');
      return;
    }

    if (!formData.urgent && numValue < 6) {
      showSnackbar('일반 메시지는 6번 이상의 방을 사용해야 합니다.', 'warning');
      return;
    }

    updateFormData('roomNumber', numValue);
    updateFormData('autoAssignRoom', false);
  };

  // 🔧 메시지 전송 (이미지 변환 및 TCP/IP 통신)
  const handleSendMessage = async () => {
    if (!formData.deviceId) {
      showSnackbar('전광판을 선택해주세요.', 'error');
      return;
    }

    if (formData.messageType === 'text' && !formData.content.trim()) {
      showSnackbar('메시지 내용을 입력해주세요.', 'error');
      return;
    }

    // 유효성 검사
    try {
      if (formData.messageType === 'text') {
        apiUtils.validateMessageContent(formData.content);
      }

      if (formData.imageData) {
        apiUtils.validateImageData(formData.imageData);
      }

      apiUtils.validateDisplayOptions(formData.displayOptions);
      apiUtils.validateSchedule(formData.schedule);

      if (!formData.autoAssignRoom && formData.roomNumber) {
        apiUtils.validateRoomNumber(formData.roomNumber, formData.urgent);
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
      return;
    }

    // 활성 방번호 중복 확인
    if (!formData.autoAssignRoom && formData.roomNumber && roomInfo.activeRooms.includes(parseInt(formData.roomNumber))) {
      const result = window.confirm(
        `방번호 ${formData.roomNumber}은(는) 현재 활성 상태입니다. 기존 메시지를 덮어쓰시겠습니까?`
      );
      if (!result) return;
    }

    setIsLoading(true);
    try {
      const selectedDevice = devices.find(d => d.id === formData.deviceId);
      if (selectedDevice?.status !== 'online') {
        const isTestDevice = selectedDevice?.name?.includes('테스트') || selectedDevice?.specs?.model?.includes('TEST');
        if (isTestDevice) {
          showSnackbar('⚠️ 테스트 디바이스입니다. 실제 전광판이 아니므로 메시지가 표시되지 않습니다.', 'warning');
        } else {
          showSnackbar('선택한 전광판이 온라인 상태가 아닙니다.', 'error');
          return;
        }
      }

      // 🔧 MQTT 통신으로 전광판에 전송
      let payload = {
        deviceId: formData.deviceId,
        priority: formData.priority,
        urgent: formData.urgent,
        roomNumber: formData.autoAssignRoom ? null : parseInt(formData.roomNumber),
        displayOptions: {
          ...formData.displayOptions,
        },
        schedule: formData.schedule,
        // 🔧 MQTT 통신 정보 추가 (localhost:1883)
        mqttBroker: 'localhost:1883',
        // 🔧 메시지 생성자 정보 추가
        createdBy: user?.username || 'system'
      };

      let endpoint;
      switch (formData.messageType) {
        case 'text':
          endpoint = 'sendText'; // 🔧 텍스트를 이미지로 변환하여 전송
          payload.content = formData.content;
          payload.originalContent = formData.content;
          payload.messageType = 'text-to-image';

          // 🔧 api.js에서 통합 처리하도록 기본 정보만 전달
          payload.conversionInfo = {
            originalContent: formData.content,
            deviceResolution: getDeviceResolution(),
            convertedToImage: true
            // base64Data는 api.js에서 생성
          };
          break;
        case 'image':
          endpoint = 'sendImage';
          if (formData.webServerUrl) {
            payload.webServerUrl = formData.webServerUrl;
          } else {
            payload.imageData = formData.imageData;
          }
          break;
        case 'mixed':
          endpoint = 'sendMixed';
          payload.components = formData.components;
          break;
        default:
          throw new Error('지원하지 않는 메시지 타입입니다.');
      }

      console.log('🔧 MQTT 통신 메시지 전송 요청:', {
        deviceId: payload.deviceId,
        content: payload.content?.substring(0, 30),
        roomNumber: payload.roomNumber,
        mqttBroker: 'localhost:1883',
        messageType: payload.messageType
      });

      // 🔧 실제 MQTT 통신 (백엔드에서 처리)
      const response = await api.messages[endpoint](payload);

      // 🔧 백엔드 응답 구조에 맞게 수정 - success 필드가 있으면 확인하고, 없으면 message 객체 존재로 판단
      console.log('🔧 백엔드 응답 확인:', response.data);

      const isSuccess = response.data.success !== undefined ?
        response.data.success :
        (response.data.message && response.data.message.id);

      if (isSuccess) {
        const mqttInfo = response.data.mqtt || response.data.protocolInfo || response.data.tcpResult;
        const imageInfo = response.data.conversionInfo;

        showSnackbar(
          `✅ MQTT 통신 완료! 메시지가 전광판으로 전송되었습니다. (방번호: ${response.data.message?.roomNumber || '자동할당'})`,
          'success'
        );

        // 상세 정보 로그
        console.log('🔧 전송 완료 상세 정보:', {
          mqttBroker: 'localhost:1883',
          roomNumber: response.data.message?.roomNumber,
          imageUrl: response.data.imageUrl,
          originalContent: formData.content,
          conversionInfo: imageInfo,
          mqttResult: mqttInfo
        });

        // 🔧 폼 완전 초기화 (방번호는 유지하고 내용만 초기화)
        console.log('🔧 폼 초기화 시작 (방번호 유지)');
        setFormData(prev => {
          console.log('🔧 이전 폼 데이터:', {
            content: prev.content,
            roomNumber: prev.roomNumber,
            autoAssignRoom: prev.autoAssignRoom
          });

          const newFormData = {
            ...prev,
            content: '',                // 텍스트 내용 초기화
            imageData: null,           // 이미지 데이터 초기화
            webServerUrl: '',          // 웹서버 URL 초기화
            components: [],            // 복합 컴포넌트 초기화
            // 🔧 방번호와 자동할당은 유지하여 연속 전송 시 편의성 제공
            roomNumber: prev.roomNumber, // 방번호 유지
            autoAssignRoom: prev.autoAssignRoom, // 자동할당 설정 유지
          };

          console.log('🔧 새 폼 데이터 (방번호 유지):', {
            content: newFormData.content,
            roomNumber: newFormData.roomNumber,
            autoAssignRoom: newFormData.autoAssignRoom
          });

          return newFormData;
        });

        // 🔧 방 정보 갱신 강화
        if (formData.deviceId) {
          console.log('🔧 방 정보 갱신 시작:', {
            deviceId: formData.deviceId,
            sentRoomNumber: response.data.message?.roomNumber,
            beforeActiveRooms: roomInfo.activeRooms
          });

          // 즉시 로컬 상태 업데이트 (서버 응답 전에)
          if (response.data.message?.roomNumber) {
            const newRoomNumber = response.data.message.roomNumber;
            setRoomInfo(prev => {
              const currentActiveRooms = prev.activeRooms || [];
              const activeRoomsSet = new Set(currentActiveRooms);
              activeRoomsSet.add(newRoomNumber);

              const newActiveRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);

              console.log('🔧 로컬 방 정보 즉시 업데이트:', {
                이전활성방번호: currentActiveRooms,
                추가된방번호: newRoomNumber,
                새활성방번호: newActiveRooms
              });

              return {
                ...prev,
                activeRooms: newActiveRooms
              };
            });
          }

          // 서버에서 최신 정보 다시 로드 (확인용)
          setTimeout(() => {
            console.log('🔧 서버에서 방 정보 재로드 시작');
            loadActiveRoomInfo(formData.deviceId).then(() => {
              console.log('🔧 서버에서 방 정보 재로드 완료');
            });
          }, 500); // 0.5초 후 재로드
        }
      } else {
        console.warn('🔧 백엔드에서 성공 응답이 아님:', response.data);
        showSnackbar('메시지 전송에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('MQTT 통신 실패:', error);
      showSnackbar(`❌ MQTT 통신 실패: ${apiUtils.getErrorMessage(error)}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 방번호 해제 (전광판에서만 제거, 이력 보존 - API 호출 없이 로컬 상태만 관리)
  const handleClearRoom = async (roomNumber) => {
    if (!window.confirm(`방번호 ${roomNumber}를 전광판에서 해제하시겠습니까? (메시지 이력은 보존됩니다)`)) {
      return;
    }

    try {
      console.log('방번호 해제 시작 (이력 보존, 로컬 관리):', roomNumber);

      // 전광판 상태 업데이트용 API 호출 (있는 경우)
      try {
        // 방번호 해제 전용 API가 있다면 사용 (메시지 삭제하지 않음)
        const response = await api.messages.rooms.clearRoomDisplay?.(formData.deviceId, roomNumber);
        if (response?.data?.success) {
          showSnackbar(response.data.message || `방번호 ${roomNumber}가 해제되었습니다.`, 'success');
        } else {
          // API가 없거나 실패한 경우 로컬에서만 처리
          showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
        }
      } catch (apiError) {
        // API 오류는 무시하고 로컬에서만 관리
        console.log('전광판 제어 API 없음, 로컬에서만 관리:', apiError.message);
        showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
      }

      // 로컬 활성 방번호 목록에서만 제거 (이력/메시지는 건드리지 않음)
      setRoomInfo(prev => {
        const currentActiveRooms = prev.activeRooms || [];
        const activeRoomsSet = new Set(currentActiveRooms);
        activeRoomsSet.delete(parseInt(roomNumber));

        const newActiveRooms = Array.from(activeRoomsSet).sort((a, b) => a - b);

        console.log('활성 방번호 목록 업데이트 (이력 보존, 로컬만):', {
          해제방번호: roomNumber,
          기존활성방번호: currentActiveRooms,
          새활성방번호: newActiveRooms
        });

        return {
          ...prev,
          activeRooms: newActiveRooms
        };
      });

    } catch (error) {
      console.error('방번호 해제 실패:', error);

      // 오류가 발생해도 로컬 상태는 업데이트
      setRoomInfo(prev => {
        const activeRoomsSet = new Set(prev.activeRooms);
        activeRoomsSet.delete(parseInt(roomNumber));

        return {
          ...prev,
          activeRooms: Array.from(activeRoomsSet).sort((a, b) => a - b)
        };
      });

      showSnackbar(`방번호 ${roomNumber}가 해제되었습니다. (로컬 관리)`, 'success');
    }
  };

  // 이미지 파일 선택
  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5242880) {
      showSnackbar('이미지 파일 크기는 5MB 이하여야 합니다.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      updateFormData('imageData', {
        base64: e.target.result.split(',')[1],
        filename: file.name,
        size: file.size,
        type: file.type,
      });
      // 이미지 업로드시 웹서버 URL 초기화
      updateFormData('webServerUrl', '');
    };
    reader.readAsDataURL(file);
  };

  // 복합 메시지 컴포넌트 추가
  const addComponent = (type) => {
    const newComponent = {
      id: Date.now(),
      type,
      content: type === 'text' ? '' : null,
      data: type === 'image' ? null : undefined,
      options: {
        fontSize: 16,
        color: '#FFFFFF',
        position: 'center',
      },
    };

    setFormData(prev => ({
      ...prev,
      components: [...prev.components, newComponent],
    }));
  };

  // 복합 메시지 컴포넌트 삭제
  const removeComponent = (componentId) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== componentId),
    }));
  };

  // 선택된 디바이스 정보
  const selectedDevice = devices.find(d => d.id === formData.deviceId);
  const isTestDevice = selectedDevice?.name?.includes('테스트') || selectedDevice?.specs?.model?.includes('TEST');

  // 선택된 전광판의 해상도 정보
  const getDeviceResolution = () => {
    if (!selectedDevice?.specs?.resolution) {
      return { width: 1920, height: 1080 };
    }
    return selectedDevice.specs.resolution;
  };

  // 전광판 크기에 따른 미리보기 스타일 (실제 표출 크기와 일치시킴)
  const getPreviewStyle = () => {
    const resolution = getDeviceResolution();
    const aspectRatio = resolution.width / resolution.height;

    let displayWidth, displayHeight;

    // 🔧 미리보기 크기를 더 크게 하여 실제 전광판과 비슷한 비율로 표시
    if (aspectRatio > 3) {
      displayWidth = 720;
      displayHeight = 240;
    } else if (aspectRatio > 2) {
      displayWidth = 600;
      displayHeight = 300;
    } else if (aspectRatio > 1.5) {
      displayWidth = 560;
      displayHeight = 315;
    } else {
      displayWidth = 400;
      displayHeight = 400;
    }

    // 🔧 간단하고 직관적인 폰트 크기 계산
    const userFontSize = formData.displayOptions.fontSize || 16;
    const lines = formData.content.split('\n').filter(line => line.trim() !== '');
    const maxLines = Math.max(lines.length, 1);

    // 선택된 전광판의 실제 해상도 기준으로 비례 계산
    const actualResolution = getDeviceResolution();
    const baseScale = Math.min(displayWidth / actualResolution.width, displayHeight / actualResolution.height);
    let adjustedFontSize = userFontSize * baseScale;

    // 🔧 폰트 크기 변화가 잘 보이도록 제한 완화
    const maxByHeight = displayHeight / maxLines * 0.8; // 0.6 → 0.8로 증가
    const longestLine = lines.reduce((max, line) => line.length > max.length ? line : max, '');
    const maxByWidth = longestLine.length > 0 ? displayWidth / longestLine.length * 1.2 : adjustedFontSize; // 0.8 → 1.2로 증가

    // 🔧 폰트 크기 변화가 더 잘 보이도록 제한 로직 수정
    const minUserSize = userFontSize * baseScale * 0.3; // 사용자 크기의 최소 30%는 보장
    const maxSize = Math.max(maxByHeight, maxByWidth, minUserSize); // 가장 큰 값을 기준으로

    adjustedFontSize = Math.min(adjustedFontSize, maxSize);
    adjustedFontSize = Math.max(adjustedFontSize, 12);

    console.log('🔧 미리보기 폰트 크기 (상세):', {
      사용자입력: userFontSize,
      실제해상도: `${actualResolution.width}x${actualResolution.height}`,
      미리보기크기: `${displayWidth}x${displayHeight}`,
      기본스케일: baseScale,
      제한전: userFontSize * baseScale,
      높이제한: maxByHeight,
      너비제한: maxByWidth,
      최소보장크기: minUserSize,
      최대허용크기: maxSize,
      제한후: adjustedFontSize,
      최종: adjustedFontSize
    });

    return {
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      bgcolor: formData.displayOptions.backgroundColor,
      color: formData.displayOptions.color,
      fontSize: `${adjustedFontSize}px`,
      textAlign: formData.displayOptions.position,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: isTestDevice ? '3px dashed #ff9800' : '3px solid #333',
      borderRadius: 1,
      overflow: 'hidden',
      padding: '10px', // 🔧 실제 변환과 동일한 여백 적용
      boxSizing: 'border-box',
      lineHeight: 1.0, // 🔧 실제 변환과 동일한 줄 간격
      position: 'relative',
      wordBreak: 'keep-all',
      whiteSpace: 'pre-wrap',
      fontWeight: 'bold', // 🔧 실제 변환에서 사용하는 bold 폰트 적용
      fontFamily: '"Malgun Gothic", "맑은 고딕", Arial, sans-serif', // 🔧 동일한 폰트 패밀리
    };
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          메시지 전송
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDevices}
          >
            디바이스 새로고침
          </Button>
          <Chip
            icon={<NetworkCheck />}
            label={`MQTT: ${process.env.REACT_APP_MQTT_BROKER_HOST || 'localhost'}`}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* 권한 확인 */}
      {!hasMessagePermission && (
        <Alert severity="error" sx={{ mb: 3 }}>
          메시지 전송 권한이 없습니다. 관리자에게 권한을 요청하세요.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 디바이스 선택 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                전광판 선택
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>전광판</InputLabel>
                <Select
                  value={formData.deviceId}
                  onChange={(e) => updateFormData('deviceId', e.target.value)}
                  label="전광판"
                  disabled={!hasMessagePermission}
                >
                  {devices.map((device, index) => {
                    const isTest = device.name?.includes('테스트') || device.specs?.model?.includes('TEST');
                    return (
                      <MenuItem key={`device-select-${device.id}-${index}`} value={device.id}>
                        <Box display="flex" alignItems="center" gap={2} width="100%">
                          {isTest ? <Science color="warning" /> : <DevicesOther />}
                          <Box flex={1}>
                            <Typography>
                              {device.name}
                              {isTest && <Chip label="테스트" size="small" color="warning" sx={{ ml: 1 }} />}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {device.location?.address} • {device.ip}:{device.port}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              🖥️ {device.specs?.resolution?.width}x{device.specs?.resolution?.height} • {device.specs?.size}
                            </Typography>
                          </Box>
                          <Chip
                            label={device.status === 'online' ? '온라인' : '오프라인'}
                            color={device.status === 'online' ? 'success' : 'error'}
                            size="small"
                          />
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {selectedDevice && (
                <Alert
                  severity={selectedDevice.status === 'online' ? 'success' : isTestDevice ? 'warning' : 'warning'}
                  sx={{ mt: 2 }}
                >
                  <Box>
                    <Typography variant="body2">
                      <strong>선택된 전광판:</strong> {selectedDevice.name}
                      {isTestDevice && <Chip label="테스트" size="small" color="warning" sx={{ ml: 1 }} />}
                    </Typography>
                    <Typography variant="body2">
                      <strong>해상도:</strong> {getDeviceResolution().width} x {getDeviceResolution().height}
                    </Typography>
                    <Typography variant="body2">
                      <strong>상태:</strong> {selectedDevice.status === 'online' ? '메시지 전송 가능' :
                        isTestDevice ? '테스트 디바이스 (실제 표시되지 않음)' : '오프라인 상태'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>MQTT 대상:</strong> {formData.mqttBroker}
                    </Typography>
                  </Box>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* MQTT 설정 */}
        {formData.deviceId && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <NetworkCheck sx={{ mr: 1, verticalAlign: 'middle' }} />
                  MQTT 통신 설정
                </Typography>

                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    메시지는 MQTT 프로토콜을 통해 전광판으로 전송됩니다.
                  </Typography>
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="MQTT 대상"
                      value={formData.mqttBroker}
                      onChange={(e) => updateFormData('mqttBroker', e.target.value)}
                      disabled={!hasMessagePermission}
                      helperText="전광판의 MQTT 주소"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    <strong>통신 프로세스:</strong>
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    1. 텍스트 메시지를 PNG 이미지로 변환 →
                    2. 이미지를 웹서버에 업로드 →
                    3. MQTT로 {formData.mqttBroker}에 전송
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 활성 방번호 관리 (이력과 분리) */}
        {formData.deviceId && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" gutterBottom>
                    <Room sx={{ mr: 1, verticalAlign: 'middle' }} />
                    활성 방번호 관리
                  </Typography>
                  {roomInfo.loading && <CircularProgress size={20} />}
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <Info sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    여기서는 현재 전광판에 활성 상태인 방번호만 표시됩니다.
                    방번호를 해제해도 메시지 이력은 보존되며, 메시지 이력 페이지에서 확인할 수 있습니다.
                  </Typography>
                </Alert>

                <Grid container spacing={2}>
                  {/* 방번호 선택 */}
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.autoAssignRoom}
                          onChange={(e) => updateFormData('autoAssignRoom', e.target.checked)}
                          disabled={!hasMessagePermission}
                        />
                      }
                      label="자동 방번호 할당"
                    />

                    {!formData.autoAssignRoom && (
                      <>
                        <FormControl fullWidth margin="normal">
                          <InputLabel>방번호 선택</InputLabel>
                          <Select
                            value={formData.roomNumber}
                            onChange={(e) => handleRoomNumberChange(e.target.value)}
                            label="방번호 선택"
                            disabled={!hasMessagePermission}
                          >
                            {/* 긴급 메시지용 방번호 (1-5) */}
                            <MenuItem key="urgent-header" disabled>
                              <Typography variant="caption" color="primary">
                                긴급 메시지용 (1-5번)
                              </Typography>
                            </MenuItem>
                            {[1, 2, 3, 4, 5].map(num => (
                              <MenuItem
                                key={`urgent-room-${num}-${formData.deviceId}`}
                                value={num}
                                disabled={!formData.urgent && roomInfo.activeRooms.includes(num)}
                              >
                                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                  <Typography>방번호 {num}</Typography>
                                  {roomInfo.activeRooms.includes(num) && (
                                    <Chip label="활성" color="error" size="small" />
                                  )}
                                  {!formData.urgent && (
                                    <Chip label="긴급전용" color="warning" size="small" />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}

                            {/* 일반 메시지용 방번호 (6-100) */}
                            <MenuItem key="normal-header" disabled>
                              <Typography variant="caption" color="text.secondary">
                                일반 메시지용 (6-100번)
                              </Typography>
                            </MenuItem>

                            {/* 6-30번 방번호 */}
                            {Array.from({ length: 25 }, (_, i) => i + 6).map(num => (
                              <MenuItem
                                key={`normal-low-room-${num}-${formData.deviceId}`}
                                value={num}
                                disabled={formData.urgent || roomInfo.activeRooms.includes(num)}
                              >
                                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                  <Typography>방번호 {num}</Typography>
                                  {roomInfo.activeRooms.includes(num) && (
                                    <Chip label="활성" color="error" size="small" />
                                  )}
                                  {formData.urgent && (
                                    <Chip label="일반전용" color="info" size="small" />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}

                            {/* 31-50번 중 일부 */}
                            <MenuItem key="normal-mid-header" disabled>
                              <Typography variant="caption" color="text.secondary">
                                31-50번 (선택 항목)
                              </Typography>
                            </MenuItem>
                            {[31, 35, 40, 45, 50].map(num => (
                              <MenuItem
                                key={`normal-mid-room-${num}-${formData.deviceId}`}
                                value={num}
                                disabled={formData.urgent || roomInfo.activeRooms.includes(num)}
                              >
                                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                  <Typography>방번호 {num}</Typography>
                                  {roomInfo.activeRooms.includes(num) && (
                                    <Chip label="활성" color="error" size="small" />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}

                            {/* 51-100번 중 일부 */}
                            <MenuItem key="normal-high-header" disabled>
                              <Typography variant="caption" color="text.secondary">
                                51-100번 (선택 항목)
                              </Typography>
                            </MenuItem>
                            {[51, 60, 70, 80, 90, 100].map(num => (
                              <MenuItem
                                key={`normal-high-room-${num}-${formData.deviceId}`}
                                value={num}
                                disabled={formData.urgent || roomInfo.activeRooms.includes(num)}
                              >
                                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                  <Typography>방번호 {num}</Typography>
                                  {roomInfo.activeRooms.includes(num) && (
                                    <Chip label="활성" color="error" size="small" />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        {/* 직접 방번호 입력 */}
                        {formData.urgent ? (
                          <TextField
                            fullWidth
                            margin="normal"
                            label="긴급 방번호 직접 입력 (1-5)"
                            type="number"
                            value={formData.roomNumber}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                handleRoomNumberChange('');
                              } else {
                                const numValue = parseInt(value);
                                if (numValue >= 1 && numValue <= 5) {
                                  handleRoomNumberChange(numValue);
                                } else {
                                  showSnackbar('긴급 메시지는 1-5번 방만 사용할 수 있습니다.', 'warning');
                                }
                              }
                            }}
                            inputProps={{ min: 1, max: 5 }}
                            disabled={!hasMessagePermission}
                            helperText="1-5 사이의 방번호를 직접 입력할 수 있습니다"
                          />
                        ) : (
                          <TextField
                            fullWidth
                            margin="normal"
                            label="일반 방번호 직접 입력 (6-100)"
                            type="number"
                            value={formData.roomNumber}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                handleRoomNumberChange('');
                              } else {
                                const numValue = parseInt(value);
                                if (numValue >= 6 && numValue <= 100) {
                                  handleRoomNumberChange(numValue);
                                } else {
                                  showSnackbar('일반 메시지는 6-100번 방을 사용해야 합니다.', 'warning');
                                }
                              }
                            }}
                            inputProps={{ min: 6, max: 100 }}
                            disabled={!hasMessagePermission}
                            helperText="6-100 사이의 방번호를 직접 입력할 수 있습니다"
                          />
                        )}
                      </>
                    )}

                    {formData.urgent && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <Box display="flex" alignItems="center">
                          <Info sx={{ fontSize: 16, mr: 1 }} />
                          <Typography variant="body2">
                            긴급 메시지는 1~5번 방을 사용합니다. 기존 활성 메시지를 덮어쓸 수 있습니다.
                          </Typography>
                        </Box>
                      </Alert>
                    )}

                    {!formData.urgent && !formData.autoAssignRoom && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <Box display="flex" alignItems="center">
                          <Info sx={{ fontSize: 16, mr: 1 }} />
                          <Typography variant="body2">
                            일반 메시지는 6~100번 방을 사용합니다. 드롭다운에서 선택하거나 직접 입력하세요.
                          </Typography>
                        </Box>
                      </Alert>
                    )}
                  </Grid>

                  {/* 활성 방번호 현황 */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      현재 활성 방번호 현황
                    </Typography>
                    <Box display="flex" gap={1} mb={1}>
                      <Chip label={`총 100개 방`} variant="outlined" />
                      <Chip label={`활성 ${roomInfo.activeRooms.length}개`} color="error" size="small" />
                      <Chip label={`사용가능 ${100 - roomInfo.activeRooms.length}개`} color="success" size="small" />
                    </Box>

                    {roomInfo.activeRooms.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 2, maxHeight: 150, overflow: 'auto' }}>
                        <Typography variant="caption" color="textSecondary">
                          활성 방번호:
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                          {roomInfo.activeRooms.map((roomNum, index) => (
                            <Tooltip
                              key={`active-room-${roomNum}-${formData.deviceId}-${index}`}
                              title={`방번호 ${roomNum} 해제 (이력 보존)`}
                            >
                              <Chip
                                label={roomNum}
                                size="small"
                                color={roomNum <= 5 ? 'warning' : 'default'}
                                onDelete={() => handleClearRoom(roomNum)}
                                deleteIcon={<ClearAll />}
                                disabled={!hasMessagePermission}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </Paper>
                    )}

                    {roomInfo.activeRooms.length === 0 && (
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="textSecondary">
                          현재 활성 상태인 방번호가 없습니다.
                        </Typography>
                      </Paper>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 메시지 타입 및 내용 */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                메시지 작성
              </Typography>

              {/* 메시지 타입 탭 */}
              <Tabs value={activeTab} onChange={(e, value) => setActiveTab(value)} sx={{ mb: 2 }}>
                <Tab
                  label="텍스트"
                  icon={<FormatColorText />}
                  onClick={() => updateFormData('messageType', 'text')}
                />
                <Tab
                  label="이미지"
                  icon={<Image />}
                  onClick={() => updateFormData('messageType', 'image')}
                />
                <Tab
                  label="복합"
                  icon={<Settings />}
                  onClick={() => updateFormData('messageType', 'mixed')}
                />
              </Tabs>

              {/* 텍스트 메시지 */}
              <TabPanel value={activeTab} index={0}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="메시지 내용"
                  value={formData.content}
                  onChange={(e) => updateFormData('content', e.target.value)}
                  placeholder="전송할 메시지를 입력하세요..."
                  disabled={!hasMessagePermission}
                />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {formData.content.length} / 1000자 (텍스트는 자동으로 이미지로 변환되어 전송됩니다)
                </Typography>
              </TabPanel>

              {/* 이미지 메시지 */}
              <TabPanel value={activeTab} index={1}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {/* 이미지 업로드 */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      이미지 파일 업로드
                    </Typography>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="image-upload"
                      type="file"
                      onChange={handleImageSelect}
                      disabled={!hasMessagePermission}
                    />
                    <label htmlFor="image-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<Image />}
                        disabled={!hasMessagePermission}
                      >
                        이미지 선택
                      </Button>
                    </label>

                    {formData.imageData && (
                      <Alert severity="success" sx={{ mt: 1 }}>
                        선택된 이미지: {formData.imageData.filename}
                        ({(formData.imageData.size / 1024 / 1024).toFixed(2)}MB)
                      </Alert>
                    )}
                  </Box>

                  <Divider>또는</Divider>

                  {/* 웹서버 URL 입력 */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      웹서버 이미지 URL
                    </Typography>
                    <TextField
                      fullWidth
                      label="웹서버 이미지 URL"
                      value={formData.webServerUrl}
                      onChange={(e) => {
                        updateFormData('webServerUrl', e.target.value);
                        // 웹서버 URL 입력시 업로드된 이미지 초기화
                        if (e.target.value) {
                          updateFormData('imageData', null);
                        }
                      }}
                      placeholder="http://example.com/image.bmp"
                      disabled={!hasMessagePermission}
                      helperText="프로토콜 정의서에 따른 웹서버 이미지 파일 URL을 입력하세요"
                    />

                    {formData.webServerUrl && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          <CloudUpload sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                          웹서버에서 이미지를 다운로드하여 전광판에 표시합니다.
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          URL: {formData.webServerUrl}
                        </Typography>
                      </Alert>
                    )}
                  </Box>

                  {(!formData.imageData && !formData.webServerUrl) && (
                    <Alert severity="info">
                      <Typography variant="body2">
                        이미지 파일을 직접 업로드하거나, 웹서버 URL을 입력하여 원격 이미지를 사용할 수 있습니다.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </TabPanel>

              {/* 복합 메시지 */}
              <TabPanel value={activeTab} index={2}>
                <Box display="flex" gap={1} mb={2}>
                  <Button
                    variant="outlined"
                    startIcon={<FormatColorText />}
                    onClick={() => addComponent('text')}
                    disabled={!hasMessagePermission}
                  >
                    텍스트 추가
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Image />}
                    onClick={() => addComponent('image')}
                    disabled={!hasMessagePermission}
                  >
                    이미지 추가
                  </Button>
                </Box>

                <List>
                  {formData.components.map((component, index) => (
                    <ListItem key={component.id} divider>
                      <ListItemText
                        primary={`${component.type === 'text' ? '텍스트' : '이미지'} 컴포넌트 ${index + 1}`}
                        secondary={component.type === 'text' ? component.content : '이미지 파일'}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => removeComponent(component.id)}
                          disabled={!hasMessagePermission}
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

                {formData.components.length === 0 && (
                  <Typography color="textSecondary" textAlign="center" py={4}>
                    컴포넌트를 추가해주세요.
                  </Typography>
                )}
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>

        {/* 설정 패널 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                전송 옵션
              </Typography>

              {/* 우선순위 */}
              <FormControl fullWidth margin="normal">
                <InputLabel>우선순위</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => updateFormData('priority', e.target.value)}
                  label="우선순위"
                  disabled={!hasMessagePermission}
                >
                  <MenuItem key="priority-low" value="LOW">낮음</MenuItem>
                  <MenuItem key="priority-normal" value="NORMAL">보통</MenuItem>
                  <MenuItem key="priority-high" value="HIGH">높음</MenuItem>
                  <MenuItem key="priority-urgent" value="URGENT">긴급</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.urgent}
                    onChange={(e) => handleUrgentChange(e.target.checked)}
                    disabled={!hasMessagePermission}
                  />
                }
                label="긴급 메시지"
                sx={{ mb: 2 }}
              />

              {formData.urgent && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center">
                    <Warning sx={{ fontSize: 16, mr: 1 }} />
                    <Typography variant="body2">
                      긴급 메시지는 기존 활성 메시지를 중단하고 즉시 표시됩니다.
                    </Typography>
                  </Box>
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />

              {/* 표시 효과 설정 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">
                    <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                    표시 효과
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>표시 효과</InputLabel>
                    <Select
                      value={formData.displayOptions.displayEffect}
                      onChange={(e) => updateDisplayOptions('displayEffect', e.target.value)}
                      label="표시 효과"
                      disabled={!hasMessagePermission}
                    >
                      {Object.entries(DISPLAY_EFFECTS).map(([value, effect]) => (
                        <MenuItem key={`display-effect-${value}`} value={parseInt(value)}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <span>{effect.icon}</span>
                            <span>{effect.name}</span>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box sx={{ mb: 2 }}>
                    <Typography gutterBottom>
                      표시 효과 속도: {formData.displayOptions.displayEffectSpeed}
                    </Typography>
                    <Slider
                      value={formData.displayOptions.displayEffectSpeed}
                      onChange={(e, value) => updateDisplayOptions('displayEffectSpeed', value)}
                      min={1}
                      max={8}
                      step={1}
                      marks={[
                        { value: 1, label: '빠름' },
                        { value: 4, label: '보통' },
                        { value: 8, label: '느림' }
                      ]}
                      disabled={!hasMessagePermission}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    margin="normal"
                    label="표시 완료 후 대기시간 (초)"
                    type="number"
                    value={formData.displayOptions.displayWaitTime}
                    onChange={(e) => updateDisplayOptions('displayWaitTime', parseInt(e.target.value))}
                    inputProps={{ min: 0, max: 60 }}
                    disabled={!hasMessagePermission}
                  />

                  <FormControl fullWidth margin="normal">
                    <InputLabel>완료 효과</InputLabel>
                    <Select
                      value={formData.displayOptions.endEffect}
                      onChange={(e) => updateDisplayOptions('endEffect', e.target.value)}
                      label="완료 효과"
                      disabled={!hasMessagePermission}
                    >
                      {Object.entries(END_EFFECTS).map(([value, effect]) => (
                        <MenuItem key={`end-effect-${value}`} value={parseInt(value)}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <span>{effect.icon}</span>
                            <span>{effect.name}</span>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </AccordionDetails>
              </Accordion>

              {/* 기본 표시 옵션 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">기본 표시 옵션</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Typography gutterBottom>폰트 크기: {formData.displayOptions.fontSize}px</Typography>
                    <Slider
                      value={formData.displayOptions.fontSize}
                      onChange={(e, value) => updateDisplayOptions('fontSize', value)}
                      min={8}
                      max={120}
                      step={2}
                      disabled={!hasMessagePermission}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    margin="normal"
                    label="텍스트 색상"
                    type="color"
                    value={formData.displayOptions.color}
                    onChange={(e) => updateDisplayOptions('color', e.target.value)}
                    disabled={!hasMessagePermission}
                  />

                  <TextField
                    fullWidth
                    margin="normal"
                    label="배경 색상"
                    type="color"
                    value={formData.displayOptions.backgroundColor}
                    onChange={(e) => updateDisplayOptions('backgroundColor', e.target.value)}
                    disabled={!hasMessagePermission}
                  />

                  <FormControl fullWidth margin="normal">
                    <InputLabel>텍스트 정렬</InputLabel>
                    <Select
                      value={formData.displayOptions.position}
                      onChange={(e) => updateDisplayOptions('position', e.target.value)}
                      label="텍스트 정렬"
                      disabled={!hasMessagePermission}
                    >
                      <MenuItem key="align-left" value="left">왼쪽 정렬</MenuItem>
                      <MenuItem key="align-center" value="center">가운데 정렬</MenuItem>
                      <MenuItem key="align-right" value="right">오른쪽 정렬</MenuItem>
                    </Select>
                  </FormControl>
                </AccordionDetails>
              </Accordion>

              {/* 스케줄 옵션 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">
                    <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                    스케줄 설정
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    margin="normal"
                    label="시작 시간"
                    type="datetime-local"
                    value={formData.schedule.startTime}
                    onChange={(e) => updateSchedule('startTime', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={!hasMessagePermission}
                  />

                  <TextField
                    fullWidth
                    margin="normal"
                    label="종료 시간"
                    type="datetime-local"
                    value={formData.schedule.endTime}
                    onChange={(e) => updateSchedule('endTime', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={!hasMessagePermission}
                  />

                  <TextField
                    fullWidth
                    margin="normal"
                    label="표시 시간 (초)"
                    type="number"
                    value={formData.schedule.duration}
                    onChange={(e) => updateSchedule('duration', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 3600 }}
                    disabled={!hasMessagePermission}
                  />
                </AccordionDetails>
              </Accordion>

              <Divider sx={{ my: 2 }} />

              {/* 전송 버튼 */}
              <Box display="flex" gap={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Preview />}
                  onClick={() => setPreviewDialog(true)}
                  disabled={!hasMessagePermission}
                >
                  미리보기
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Send />}
                  onClick={handleSendMessage}
                  disabled={!hasMessagePermission || isLoading || !formData.deviceId}
                >
                  {isLoading ? '전송중...' : 'MQTT 전송'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 미리보기 다이얼로그 (개선된 폰트 크기) */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          메시지 미리보기
          {selectedDevice && (
            <Typography variant="caption" color="textSecondary" display="block">
              {selectedDevice.name} ({getDeviceResolution().width} x {getDeviceResolution().height})
              {formData.roomNumber && ` • 방번호: ${formData.roomNumber}`}
              {isTestDevice && <Chip label="테스트" size="small" color="warning" sx={{ ml: 1 }} />}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" mb={3}>
            <Paper sx={getPreviewStyle()}>
              {formData.messageType === 'text' && formData.content ? (
                <Typography
                  sx={{
                    fontSize: 'inherit',
                    color: 'inherit',
                    padding: 1,
                    wordBreak: 'keep-all',
                    textAlign: 'inherit',
                    whiteSpace: 'pre-wrap',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: formData.displayOptions.position,
                  }}
                >
                  {formData.content}
                </Typography>
              ) : formData.messageType === 'image' && (formData.imageData || formData.webServerUrl) ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                  }}
                >
                  {formData.webServerUrl ? (
                    <Box textAlign="center">
                      <Image sx={{ fontSize: 48, mb: 1 }} />
                      <Typography variant="body2">웹서버 이미지</Typography>
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                        {formData.webServerUrl.substring(0, 50)}...
                      </Typography>
                    </Box>
                  ) : (
                    <Box textAlign="center">
                      <Image sx={{ fontSize: 48, mb: 1 }} />
                      <Typography variant="body2">{formData.imageData?.filename}</Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography color="textSecondary">
                  미리보기할 내용이 없습니다.
                </Typography>
              )}
            </Paper>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>전송 정보</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">전광판: {selectedDevice?.name}</Typography>
                <Typography variant="body2">해상도: {getDeviceResolution().width}x{getDeviceResolution().height}</Typography>
                <Typography variant="body2">우선순위: {formData.priority}</Typography>
                <Typography variant="body2">
                  방번호: {formData.autoAssignRoom ? '자동 할당' : formData.roomNumber || '미지정'}
                </Typography>
                <Typography variant="body2">
                  MQTT 대상: {formData.mqttBroker}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">긴급 메시지: {formData.urgent ? '예' : '아니오'}</Typography>
                <Typography variant="body2">폰트 크기: {formData.displayOptions.fontSize}px</Typography>
                <Typography variant="body2">표시 시간: {formData.schedule.duration}초</Typography>
                <Typography variant="body2">
                  표시 효과: {DISPLAY_EFFECTS[formData.displayOptions.displayEffect]?.name}
                </Typography>
                <Typography variant="body2">
                  완료 효과: {END_EFFECTS[formData.displayOptions.endEffect]?.name}
                </Typography>
                {formData.messageType === 'image' && formData.webServerUrl && (
                  <Typography variant="body2">
                    이미지 소스: 웹서버
                  </Typography>
                )}
                {formData.messageType === 'text' && (
                  <Typography variant="body2">
                    변환: 텍스트 → 이미지 → MQTT
                  </Typography>
                )}
              </Grid>
            </Grid>
            {formData.schedule.startTime && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                시작 시간: {new Date(formData.schedule.startTime).toLocaleString()}
              </Typography>
            )}
            {isTestDevice && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  🧪 테스트 디바이스입니다. 실제 전광판에는 표시되지 않지만 모든 기능을 체험할 수 있습니다.
                </Typography>
              </Alert>
            )}
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <NetworkCheck sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                텍스트는 자동으로 이미지로 변환되어 {formData.mqttBroker}로 MQTT 통신을 통해 전송됩니다.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>닫기</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPreviewDialog(false);
              handleSendMessage();
            }}
            disabled={!hasMessagePermission || !formData.deviceId}
            startIcon={<NetworkCheck />}
          >
            MQTT 전송하기
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

export default MessageSend;