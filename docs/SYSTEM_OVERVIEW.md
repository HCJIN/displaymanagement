# 전광판 관리 시스템 - 시스템 개요

## 📋 프로젝트 개요

### 🎯 목적
재해문자전광판을 포함한 다양한 LED 디스플레이 장비를 중앙에서 관리하고 제어할 수 있는 웹 기반 통합 관리 시스템

### 🔧 주요 기능
- **디바이스 관리**: 전광판 등록, 연결 테스트, 상태 모니터링
- **메시지 전송**: 텍스트/이미지 메시지 실시간 전송
- **사용자 관리**: 역할 기반 접근 제어 (RBAC)
- **실시간 모니터링**: WebSocket을 통한 실시간 상태 업데이트
- **프로토콜 지원**: 재해문자전광판 신프로토콜 및 MQTT 통신

## 🏗️ 시스템 아키텍처

### 전체 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Express.js    │    │ • MQTT Broker   │
│ • Material-UI   │    │ • Socket.IO     │    │ • LED Displays  │
│ • Socket.IO     │    │ • JWT Auth      │    │ • File Storage  │
│ • Axios         │    │ • MQTT Client   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 통신 흐름
```
사용자 → React Frontend → Express API → MQTT Broker → LED 전광판
     ←                  ←              ←             ←
```

## 📁 프로젝트 구조

```
display-management-system/
├── frontend/                 # React 프론트엔드
│   ├── public/              # 정적 파일
│   └── src/
│       ├── components/      # 재사용 컴포넌트
│       ├── pages/          # 페이지 컴포넌트
│       ├── context/        # React Context
│       ├── hooks/          # 커스텀 훅
│       ├── services/       # API 서비스
│       └── utils/          # 유틸리티
├── backend/                 # Node.js 백엔드
│   └── src/
│       ├── controllers/    # 비즈니스 로직
│       ├── middleware/     # 미들웨어
│       ├── models/         # 데이터 모델
│       ├── routes/         # API 라우터
│       ├── services/       # 핵심 서비스
│       └── utils/          # 유틸리티
├── docs/                   # 문서
└── logs/                   # 로그 파일
```

## 🔄 주요 워크플로우

### 1. 사용자 인증
```
Login Page → JWT Token → Protected Routes → Dashboard
```

### 2. 디바이스 관리
```
Device List → Add Device → Connection Test → Device Control
```

### 3. 메시지 전송
```
Message Send → Text/Image → Protocol Conversion → MQTT Publish → LED Display
```

## 🛠️ 기술 스택

### Frontend
- **React 18**: 모던 React 기능 활용
- **Material-UI 5**: Google Material Design
- **React Router 6**: SPA 라우팅
- **Socket.IO Client**: 실시간 통신
- **Axios**: HTTP 클라이언트

### Backend
- **Node.js**: JavaScript 런타임
- **Express.js**: 웹 프레임워크
- **Socket.IO**: 실시간 통신
- **MQTT**: IoT 디바이스 통신
- **JWT**: 인증/인가
- **Winston**: 로깅

### 통신 프로토콜
- **HTTP/HTTPS**: REST API
- **WebSocket**: 실시간 데이터
- **MQTT**: IoT 디바이스 통신
- **재해문자전광판 신프로토콜**: 전광판 제어

## 🔐 보안 기능

### 인증/인가
- JWT 토큰 기반 인증
- 역할 기반 접근 제어 (RBAC)
- API 엔드포인트 보호
- 토큰 만료 자동 처리

### 보안 미들웨어
- Helmet: HTTP 헤더 보안
- CORS: 교차 출처 리소스 공유 제어
- Rate Limiting: API 호출 제한
- Input Validation: 입력값 검증

## 📊 모니터링 & 로깅

### 로깅 시스템
- **Winston**: 구조화된 로깅
- **일별 로그 로테이션**: 자동 로그 관리
- **레벨별 로깅**: error, warn, info, debug

### 실시간 모니터링
- 디바이스 연결 상태
- 메시지 전송 성공률
- 시스템 리소스 사용량
- 오류 발생 현황

## 🚀 배포 환경

### 개발 환경
- Frontend: `localhost:3000`
- Backend: `localhost:3001` 또는 `localhost:5002`
- MQTT Broker: 외부 클라우드 브로커

### 프로덕션 환경
- Docker 컨테이너 지원
- 환경 변수 기반 설정
- 로드 밸런싱 지원

## 📈 확장성

### 수평 확장
- 마이크로서비스 아키텍처 준비
- MQTT 브로커 클러스터링
- 로드 밸런서 지원

### 기능 확장
- 플러그인 아키텍처
- 다양한 디스플레이 프로토콜 지원
- 클라우드 서비스 연동

## 🔧 주요 특징

### 1. 실시간 통신
- WebSocket을 통한 즉시 상태 업데이트
- MQTT를 통한 IoT 디바이스 제어

### 2. 프로토콜 변환
- JSON → 재해문자전광판 신프로토콜 변환
- 다양한 디스플레이 프로토콜 지원

### 3. 이미지 처리
- 텍스트 → 이미지 자동 변환
- 캔버스 기반 이미지 생성
- 해상도별 최적화

### 4. 사용자 경험
- 반응형 디자인
- 직관적인 UI/UX
- 실시간 피드백

이 시스템은 현대적인 웹 기술과 IoT 통신 프로토콜을 결합하여 안정적이고 확장 가능한 전광판 관리 솔루션을 제공합니다. 