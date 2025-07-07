# 전광판 관리 시스템

🚀 **CI/CD 파이프라인 설정 완료!** - 이제 코드를 push하면 자동으로 빌드하고 배포됩니다.

## 개요
전광판(LED Display) 장치를 원격으로 제어하고 관리할 수 있는 웹 기반 시스템입니다.

## ⚡ 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/display-management-system.git
cd display-management-system

# 2. 환경변수 설정
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# .env 파일들을 편집하여 실제 값으로 설정

# 3. 의존성 설치 및 실행
cd backend && npm install && npm start &
cd frontend && npm install && npm start
```

**⚠️ 중요**: 실제 사용하기 전에 [SETUP_GUIDE.md](SETUP_GUIDE.md)를 반드시 확인하세요!

## 🌟 주요 기능

- ✅ **재해문자전광판 신프로토콜 (2023.3) 완전 지원**
- 🔄 **MQTT 기반 실시간 통신**
- 🖼️ **텍스트-이미지 자동 변환**
- 📱 **반응형 웹 인터페이스**
- 🔒 **보안 강화 (환경변수 기반 설정)**
- 🌐 **다중 디바이스 관리**
- 📊 **실시간 상태 모니터링**

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│    Backend      │◄──►│  MQTT Broker    │
│   (React)       │    │   (Node.js)     │    │                 ├────┐
└─────────────────┘    └─────────────────┘    └─────────────────┘    │
                                │                                     │
                                ▼                                     │
                    ┌─────────────────┐                              │
                    │  File Storage   │                              │
                    │   (Images)      │                              │
                    └─────────────────┘                              │
                                                                     │
┌──────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LED Display   │    │   LED Display   │    │   LED Display   │
│    Device 1     │    │    Device 2     │    │    Device N     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 기술 스택

### Backend
- **Node.js** + **Express.js** - 서버 프레임워크
- **MQTT** - IoT 디바이스 통신
- **재해문자전광판 신프로토콜** - 표준 프로토콜 지원

### Frontend  
- **React** - 사용자 인터페이스
- **Material-UI** - UI 컴포넌트
- **Socket.io** - 실시간 통신

### Communication
- **MQTT over TLS** - 보안 통신
- **Binary Protocol** - 효율적인 데이터 전송
- **RESTful API** - 웹 인터페이스

## 📋 시스템 요구사항

- **Node.js** 16.x 이상
- **npm** 8.x 이상  
- **MQTT Broker** (EMQX, Mosquitto 등)
- **네트워크**: 포트 5002, 7200, 8883

## 🚀 설치 및 설정

상세한 설치 가이드는 **[SETUP_GUIDE.md](SETUP_GUIDE.md)**를 참조하세요.

### 환경변수 설정

1. **백엔드 환경변수**:
   ```bash
   cp backend/.env.example backend/.env
   # MQTT 브로커, 네트워크 설정 등을 실제 값으로 변경
   ```

2. **프론트엔드 환경변수**:
   ```bash
   cp frontend/.env.example frontend/.env  
   # 백엔드 서버 주소를 실제 값으로 변경
   ```

## 🔒 보안 고려사항

- ✅ **환경변수 기반 설정** - 민감한 정보 분리
- ✅ **TLS 암호화** - MQTT 통신 보안
- ✅ **입력값 검증** - XSS, 인젝션 공격 방지
- ✅ **접근 제어** - 역할 기반 권한 관리

## 📖 문서

- 📘 [설치 가이드](SETUP_GUIDE.md)
- 📗 [API 문서](docs/API.md)  
- 📙 [프로토콜 명세](docs/PROTOCOL.md)
- 📕 [시스템 개요](docs/SYSTEM_OVERVIEW.md)
- 📓 [개발 가이드](docs/DEVELOPMENT_GUIDE.md)

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 새로운 기능 브랜치를 만드세요 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성하세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🆘 지원 및 문의

- 🐛 **버그 리포트**: [Issues](https://github.com/your-username/display-management-system/issues)
- 💡 **기능 요청**: [Feature Requests](https://github.com/your-username/display-management-system/issues/new?template=feature_request.md)
- 📧 **직접 문의**: your-email@example.com

---

⭐ **이 프로젝트가 도움이 되셨다면 스타를 눌러주세요!**
