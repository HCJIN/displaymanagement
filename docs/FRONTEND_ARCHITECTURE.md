# 프론트엔드 아키텍처

## 📋 개요

React 18 기반의 모던 웹 애플리케이션으로, Material-UI를 사용한 반응형 디자인과 실시간 통신을 지원합니다.

## 🏗️ 아키텍처 패턴

### 1. 컴포넌트 기반 아키텍처
```
App.js (Root)
├── AuthProvider (Context)
├── SocketProvider (Context)
├── ThemeProvider (MUI)
└── Router
    ├── Public Routes
    │   └── Login
    └── Private Routes
        ├── Layout (공통 레이아웃)
        └── Pages
```

### 2. 상태 관리 패턴
- **React Context**: 전역 상태 관리
- **useState/useEffect**: 로컬 상태 관리
- **Custom Hooks**: 비즈니스 로직 분리

## 📁 디렉토리 구조

```
src/
├── components/           # 재사용 가능한 컴포넌트
│   ├── auth/            # 인증 관련 컴포넌트
│   ├── common/          # 공통 컴포넌트
│   │   ├── Layout.js         # 메인 레이아웃
│   │   ├── PrivateRoute.js   # 보호된 라우트
│   │   └── MessagePreview.js # 메시지 미리보기
│   ├── devices/         # 디바이스 관련 컴포넌트
│   └── messages/        # 메시지 관련 컴포넌트
├── context/             # React Context
│   ├── AuthContext.js        # 인증 상태 관리
│   └── SocketContext.js      # 실시간 통신 관리
├── hooks/               # 커스텀 훅
│   ├── useAuth.js           # 인증 훅
│   ├── useBackendStatus.js  # 백엔드 상태 확인
│   ├── useDevices.js        # 디바이스 관리
│   └── useSocket.js         # 소켓 통신
├── pages/               # 페이지 컴포넌트
│   ├── Login.js             # 로그인 페이지
│   ├── Dashboard.js         # 대시보드
│   ├── DeviceList.js        # 디바이스 목록
│   ├── DeviceControl.js     # 디바이스 제어
│   ├── AddDevice.js         # 디바이스 추가
│   ├── MessageSend.js       # 메시지 전송
│   ├── MessageHistory.js    # 메시지 이력
│   ├── Settings.js          # 설정
│   └── UserManagement.js    # 사용자 관리
├── services/            # API 서비스
│   ├── api.js              # 메인 API 서비스
│   ├── auth.js             # 인증 API
│   ├── devices.js          # 디바이스 API
│   └── messages.js         # 메시지 API
├── styles/              # 스타일 관련
│   ├── globals.css         # 전역 스타일
│   └── theme.js            # MUI 테마 설정
└── utils/               # 유틸리티
    ├── constants.js        # 상수 정의
    ├── helpers.js          # 헬퍼 함수
    └── validators.js       # 유효성 검증
```

## 🔧 주요 컴포넌트

### 1. App.js - 루트 컴포넌트
```javascript
// 전체 애플리케이션의 진입점
// - AuthProvider로 인증 상태 관리
// - SocketProvider로 실시간 통신 관리
// - ThemeProvider로 Material-UI 테마 적용
// - 라우팅 설정
```

### 2. Layout.js - 메인 레이아웃
```javascript
// 공통 레이아웃 구성 요소
// - 상단 AppBar (로고, 사용자 정보, 알림)
// - 사이드 Drawer (네비게이션 메뉴)
// - 메인 콘텐츠 영역
// - 반응형 디자인 지원
```

### 3. PrivateRoute.js - 보호된 라우트
```javascript
// 인증이 필요한 페이지 보호
// - JWT 토큰 확인
// - 권한 기반 접근 제어
// - 로딩 상태 처리
// - 미인증 시 로그인 페이지로 리다이렉트
```

## 📡 상태 관리

### 1. AuthContext - 인증 상태 관리
```javascript
const AuthContext = {
  // 상태
  user: null,                    // 현재 사용자 정보
  isAuthenticated: false,        // 인증 상태
  isLoading: true,              // 로딩 상태
  error: null,                  // 오류 상태
  
  // 액션
  login: (credentials) => {},    // 로그인
  logout: () => {},             // 로그아웃
  refreshToken: () => {},       // 토큰 갱신
  clearError: () => {},         // 오류 클리어
  
  // 권한 검사
  hasPermission: (permission) => {},
  hasRole: (role) => {}
}
```

### 2. SocketContext - 실시간 통신 관리
```javascript
const SocketContext = {
  // 상태
  socket: null,                 // Socket.IO 인스턴스
  isConnected: false,          // 연결 상태
  
  // 이벤트 리스너
  onDeviceStatusUpdate: () => {},
  onMessageStatusUpdate: () => {},
  onSystemNotification: () => {},
  
  // 액션
  connect: () => {},           // 소켓 연결
  disconnect: () => {},        // 소켓 해제
  emit: (event, data) => {}    // 이벤트 전송
}
```

## 🎨 UI/UX 설계

### 1. Material-UI 테마
```javascript
// theme.js
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },    // 메인 색상
    secondary: { main: '#dc004e' },  // 보조 색상
    error: { main: '#f44336' },      // 오류 색상
    warning: { main: '#ff9800' },    // 경고 색상
    success: { main: '#4caf50' }     // 성공 색상
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
  },
  components: {
    // 커스텀 컴포넌트 스타일
  }
})
```

### 2. 반응형 디자인
- **모바일 우선**: Mobile-first 접근법
- **브레이크포인트**: xs, sm, md, lg, xl
- **그리드 시스템**: Material-UI Grid 활용
- **유연한 레이아웃**: Flexbox 기반

### 3. 접근성 (Accessibility)
- **키보드 네비게이션**: Tab 키 지원
- **스크린 리더**: ARIA 레이블 적용
- **색상 대비**: WCAG 2.1 AA 준수
- **포커스 관리**: 명확한 포커스 표시

## 🔄 데이터 흐름

### 1. API 호출 패턴
```javascript
// services/api.js
const apiService = {
  // HTTP 클라이언트 설정
  client: axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    timeout: 10000
  }),
  
  // 인터셉터
  setupInterceptors: () => {
    // 요청 인터셉터: JWT 토큰 자동 첨부
    // 응답 인터셉터: 토큰 만료 처리
  },
  
  // API 메서드
  get: (url, config) => {},
  post: (url, data, config) => {},
  put: (url, data, config) => {},
  delete: (url, config) => {}
}
```

### 2. 실시간 데이터 업데이트
```javascript
// 소켓 이벤트 처리
useEffect(() => {
  socket.on('device:status:update', (data) => {
    // 디바이스 상태 업데이트
    setDevices(prev => prev.map(device => 
      device.id === data.deviceId 
        ? { ...device, status: data.status }
        : device
    ))
  })
  
  return () => socket.off('device:status:update')
}, [socket])
```

## 🧩 커스텀 훅

### 1. useAuth - 인증 관리
```javascript
const useAuth = () => {
  const context = useContext(AuthContext)
  
  // 로그인 처리
  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      localStorage.setItem('token', response.token)
      setUser(response.user)
      setIsAuthenticated(true)
    } catch (error) {
      setError(error.message)
    }
  }
  
  return { user, login, logout, hasPermission }
}
```

### 2. useBackendStatus - 백엔드 상태 확인
```javascript
const useBackendStatus = () => {
  const [status, setStatus] = useState({
    connected: false,
    checking: true
  })
  
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await api.get('/health')
        setStatus({ connected: true, checking: false })
      } catch {
        setStatus({ connected: false, checking: false })
      }
    }
    
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])
  
  return status
}
```

## 🎯 페이지별 기능

### 1. Dashboard - 대시보드
- **시스템 개요**: 디바이스 수, 연결 상태, 메시지 통계
- **실시간 차트**: 시간별 메시지 전송량, 성공률
- **최근 활동**: 최근 메시지, 디바이스 상태 변경
- **빠른 액션**: 긴급 메시지 전송, 시스템 상태 확인

### 2. DeviceList - 디바이스 목록
- **디바이스 테이블**: 이름, 상태, 마지막 연결 시간
- **필터링**: 상태별, 타입별 필터
- **검색**: 디바이스 이름, ID 검색
- **일괄 작업**: 다중 선택 및 일괄 제어

### 3. MessageSend - 메시지 전송
- **텍스트 입력**: 실시간 미리보기
- **이미지 변환**: 텍스트 → 이미지 자동 변환
- **디바이스 선택**: 단일/다중 디바이스 선택
- **스케줄링**: 예약 전송 기능

### 4. MessageHistory - 메시지 이력
- **메시지 목록**: 페이지네이션 지원
- **상세 필터**: 날짜, 디바이스, 상태별 필터
- **통계**: 성공률, 응답 시간 통계
- **내보내기**: CSV, Excel 내보내기

## 🔧 성능 최적화

### 1. 코드 분할 (Code Splitting)
```javascript
// 페이지별 lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DeviceList = lazy(() => import('./pages/DeviceList'))

// Suspense로 로딩 처리
<Suspense fallback={<CircularProgress />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</Suspense>
```

### 2. 메모이제이션
```javascript
// React.memo로 불필요한 리렌더링 방지
const DeviceCard = React.memo(({ device }) => {
  return <Card>...</Card>
})

// useMemo로 계산 결과 캐싱
const filteredDevices = useMemo(() => {
  return devices.filter(device => 
    device.name.includes(searchTerm)
  )
}, [devices, searchTerm])
```

### 3. 가상화 (Virtualization)
```javascript
// 대용량 리스트 성능 최적화
import { FixedSizeList as List } from 'react-window'

const VirtualizedList = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={80}
  >
    {({ index, style }) => (
      <div style={style}>
        {items[index]}
      </div>
    )}
  </List>
)
```

## 🧪 테스트 전략

### 1. 단위 테스트
- **Jest**: 테스트 프레임워크
- **React Testing Library**: 컴포넌트 테스트
- **MSW**: API 모킹

### 2. 통합 테스트
- **사용자 시나리오**: 로그인 → 디바이스 추가 → 메시지 전송
- **실시간 통신**: Socket.IO 이벤트 테스트

### 3. E2E 테스트
- **Cypress**: 엔드투엔드 테스트
- **사용자 워크플로우**: 실제 사용자 시나리오

이 프론트엔드 아키텍처는 확장 가능하고 유지보수하기 쉬운 구조로 설계되어, 복잡한 전광판 관리 기능을 직관적인 사용자 인터페이스로 제공합니다. 