# 전광판 관리 시스템 - 문서 센터

## 📚 문서 개요

전광판 관리 시스템의 모든 기술 문서와 가이드를 제공합니다. 이 문서들은 시스템의 이해, 개발, 운영에 필요한 모든 정보를 포함합니다.

## 📋 문서 목록

### 🏗️ 시스템 아키텍처
- **[시스템 개요](./SYSTEM_OVERVIEW.md)** - 전체 시스템 구조와 기술 스택
- **[프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md)** - React 기반 클라이언트 구조
- **[백엔드 아키텍처](./BACKEND_ARCHITECTURE.md)** - Node.js 기반 서버 구조

### 📡 통신 및 프로토콜
- **[통신 프로토콜 가이드](./COMMUNICATION_PROTOCOLS.md)** - MQTT 및 재해문자전광판 프로토콜

### 🛠️ 개발 및 운영
- **[개발 가이드](./DEVELOPMENT_GUIDE.md)** - 개발 환경 설정 및 워크플로우

### 📖 기존 문서
- **[API 문서](./API.md)** - REST API 명세서
- **[프로토콜 문서](./PROTOCOL.md)** - 재해문자전광판 프로토콜 상세
- **[설치 가이드](./SETUP.md)** - 시스템 설치 및 설정

## 🎯 문서 사용 가이드

### 👨‍💻 개발자용
1. **시작하기**: [개발 가이드](./DEVELOPMENT_GUIDE.md) → [시스템 개요](./SYSTEM_OVERVIEW.md)
2. **프론트엔드 개발**: [프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md)
3. **백엔드 개발**: [백엔드 아키텍처](./BACKEND_ARCHITECTURE.md) → [API 문서](./API.md)
4. **통신 개발**: [통신 프로토콜 가이드](./COMMUNICATION_PROTOCOLS.md)

### 🏢 시스템 관리자용
1. **시스템 이해**: [시스템 개요](./SYSTEM_OVERVIEW.md)
2. **설치 및 설정**: [설치 가이드](./SETUP.md)
3. **프로토콜 이해**: [프로토콜 문서](./PROTOCOL.md)

### 🔧 운영자용
1. **기본 이해**: [시스템 개요](./SYSTEM_OVERVIEW.md)
2. **API 활용**: [API 문서](./API.md)
3. **문제 해결**: [개발 가이드](./DEVELOPMENT_GUIDE.md) - 트러블슈팅 섹션

## 🔍 주요 기능별 문서 참조

### 디바이스 관리
- **아키텍처**: [백엔드 아키텍처](./BACKEND_ARCHITECTURE.md) - Device 모델
- **API**: [API 문서](./API.md) - 디바이스 관련 API
- **UI**: [프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md) - 디바이스 관리 페이지

### 메시지 전송
- **프로토콜**: [통신 프로토콜 가이드](./COMMUNICATION_PROTOCOLS.md)
- **이미지 변환**: [프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md) - 텍스트→이미지 변환
- **MQTT 통신**: [백엔드 아키텍처](./BACKEND_ARCHITECTURE.md) - DisplayService

### 사용자 관리
- **인증/인가**: [백엔드 아키텍처](./BACKEND_ARCHITECTURE.md) - 보안 구현
- **권한 관리**: [프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md) - AuthContext
- **API**: [API 문서](./API.md) - 인증 관련 API

### 실시간 통신
- **WebSocket**: [시스템 개요](./SYSTEM_OVERVIEW.md) - 실시간 통신
- **MQTT**: [통신 프로토콜 가이드](./COMMUNICATION_PROTOCOLS.md) - MQTT 구조
- **Socket.IO**: [프론트엔드 아키텍처](./FRONTEND_ARCHITECTURE.md) - SocketContext

## 📊 시스템 구성 요약

### 기술 스택
```
Frontend: React 18 + Material-UI + Socket.IO
Backend:  Node.js + Express + MQTT + Socket.IO
Protocol: 재해문자전광판 신프로토콜 + MQTT
Database: In-Memory (확장 가능)
```

### 주요 컴포넌트
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │◄──►│   Express API   │◄──►│   MQTT Broker   │
│                 │    │                 │    │                 │
│ • 사용자 인터페이스  │    │ • REST API      │    │ • IoT 통신       │
│ • 실시간 업데이트   │    │ • WebSocket     │    │ • 프로토콜 변환   │
│ • 상태 관리       │    │ • 인증/인가      │    │ • 디바이스 제어   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 데이터 흐름
```
사용자 입력 → React → API → MQTT → 전광판
         ←        ←     ←      ←
```

## 🔄 최신 업데이트

### 주요 개선사항
- ✅ **실제 장비 연결 테스트**: MQTT를 통한 실제 하드웨어 연결 확인
- ✅ **텍스트→이미지 변환**: Canvas 기반 실시간 이미지 생성
- ✅ **프로토콜 변환**: JSON → 재해문자전광판 신프로토콜 변환
- ✅ **토큰 만료 처리**: 자동 로그아웃 및 토큰 갱신
- ✅ **성능 최적화**: 폰트 크기 계산 및 미리보기 정확도 개선

### 해결된 문제들
- 🔧 미리보기와 실제 이미지 크기 불일치 문제
- 🔧 폰트 크기 슬라이더 동작 문제
- 🔧 MQTT 연결 및 메시지 발행 문제
- 🔧 토큰 만료 시 에러 처리 문제

## 🚀 빠른 시작

### 1. 개발 환경 설정
```bash
# 프로젝트 클론
git clone <repository-url>
cd display-management-system

# 백엔드 실행
cd backend && npm install && npm start

# 프론트엔드 실행 (새 터미널)
cd frontend && npm install && npm start
```

### 2. 기본 사용법
1. **로그인**: http://localhost:3000 (admin/admin123)
2. **디바이스 추가**: 디바이스 목록 → 디바이스 추가
3. **메시지 전송**: 메시지 전송 → 텍스트 입력 → 전송

### 3. 테스트 방법
- **연결 테스트**: 디바이스 추가 시 연결 테스트 버튼 클릭
- **메시지 테스트**: 테스트 디바이스로 메시지 전송 확인
- **실시간 확인**: 대시보드에서 실시간 상태 모니터링

## 🔗 관련 링크

### 외부 문서
- [React 공식 문서](https://reactjs.org/docs)
- [Material-UI 문서](https://mui.com/getting-started/installation/)
- [Node.js 공식 문서](https://nodejs.org/en/docs/)
- [MQTT 프로토콜 명세](https://mqtt.org/mqtt-specification/)

### 개발 도구
- [Visual Studio Code](https://code.visualstudio.com/)
- [Postman](https://www.postman.com/)
- [MQTT Explorer](http://mqtt-explorer.com/)
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/)

## 📞 지원 및 문의

### 개발 지원
- **이슈 리포트**: GitHub Issues 활용
- **기능 요청**: GitHub Discussions 활용
- **코드 기여**: Pull Request 환영

### 문서 개선
- **오타 수정**: 직접 PR 생성
- **내용 추가**: Issue로 제안 후 논의
- **번역**: 다국어 지원 기여

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 LICENSE 파일을 참조하세요.

---

**💡 팁**: 문서를 읽기 전에 [시스템 개요](./SYSTEM_OVERVIEW.md)를 먼저 읽어보시면 전체적인 이해에 도움이 됩니다.

**🔄 업데이트**: 이 문서는 시스템 개발과 함께 지속적으로 업데이트됩니다. 