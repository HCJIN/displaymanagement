# Display Management System - 설정 가이드

## 🚀 빠른 시작

### 1단계: 저장소 클론 및 의존성 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/display-management-system.git
cd display-management-system

# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치
cd ../frontend
npm install
```

### 2단계: 환경변수 설정

#### 백엔드 환경변수 설정

```bash
# backend/.env 파일 생성
cd backend
cp .env.example .env
```

`.env` 파일을 편집하여 다음 항목들을 실제 값으로 변경:

```env
# MQTT 브로커 설정
MQTT_BROKER_HOST=your-actual-mqtt-broker.com
MQTT_BROKER_PORT=8883

# MQTT 계정 정보
ADMIN_MQTT_USERNAME=your_admin_username
ADMIN_MQTT_PASSWORD=your_secure_password

# 네트워크 설정
WEB_SERVER_HOST=192.168.1.100  # 실제 서버 IP
WEB_SERVER_PORT=5002
```

#### 프론트엔드 환경변수 설정

```bash
# frontend/.env 파일 생성
cd frontend
cp .env.example .env
```

`.env` 파일을 편집하여 백엔드 서버 정보를 설정:

```env
# 백엔드 서버 설정
REACT_APP_API_URL=http://192.168.1.100:5002  # 실제 서버 IP
REACT_APP_SOCKET_URL=http://192.168.1.100:5002
REACT_APP_BACKEND_HOST=192.168.1.100
```

### 3단계: 애플리케이션 실행

#### 개발 환경에서 실행

```bash
# 백엔드 서버 시작 (터미널 1)
cd backend
npm start

# 프론트엔드 서버 시작 (터미널 2)
cd frontend
npm start
```

#### 운영 환경에서 실행

```bash
# 프론트엔드 빌드
cd frontend
npm run build

# 백엔드 서버만 실행 (정적 파일 서빙 포함)
cd backend
npm run prod
```

## 🔧 상세 설정

### MQTT 브로커 설정

클라우드 MQTT 서비스 권장:
- [EMQX Cloud](https://www.emqx.com/en/cloud)
- [AWS IoT Core](https://aws.amazon.com/iot-core/)
- [Azure IoT Hub](https://azure.microsoft.com/en-us/services/iot-hub/)

로컬 MQTT 브로커 설치 (Mosquitto):
```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# CentOS/RHEL
sudo yum install mosquitto mosquitto-clients

# macOS
brew install mosquitto
```

### 네트워크 설정

방화벽 포트 허용:
```bash
# 백엔드 서버 포트
sudo ufw allow 5002

# 소켓 서버 포트
sudo ufw allow 7200

# MQTT 포트 (로컬 브로커 사용시)
sudo ufw allow 1883
sudo ufw allow 8883
```

### 보안 설정

운영 환경에서는 다음 설정을 변경:

```env
# 강력한 비밀번호 사용
ADMIN_MQTT_PASSWORD=Very_Strong_Password_123!

# TLS 인증서 검증 활성화
MQTT_REJECT_UNAUTHORIZED=true

# 디버그 모드 비활성화
DEBUG_MQTT=false
DEVELOPMENT_MODE=false
```

## 🛠️ 트러블슈팅

### 연결 문제

1. **MQTT 브로커 연결 실패**
   ```bash
   # 연결 테스트
   mosquitto_pub -h your-broker-host -p 8883 -t test -m "hello"
   ```

2. **포트 충돌**
   ```bash
   # 포트 사용 확인
   netstat -tulpn | grep :5002
   ```

3. **방화벽 문제**
   ```bash
   # 방화벽 상태 확인
   sudo ufw status
   ```

### 로그 확인

```bash
# 백엔드 로그
tail -f backend/logs/app.log

# 시스템 로그
tail -f /var/log/syslog
```

## 📚 추가 문서

- [API 문서](docs/API.md)
- [프로토콜 문서](docs/PROTOCOL.md)
- [시스템 아키텍처](docs/SYSTEM_OVERVIEW.md)
- [개발 가이드](docs/DEVELOPMENT_GUIDE.md)

## 🔒 보안 주의사항

1. **환경변수 파일 보안**
   - `.env` 파일은 절대 Git에 커밋하지 마세요
   - 강력한 비밀번호를 사용하세요

2. **네트워크 보안**
   - 운영 환경에서는 HTTPS 사용
   - 방화벽 설정으로 불필요한 포트 차단

3. **접근 제어**
   - 관리자 계정 분리
   - 정기적인 비밀번호 변경

## 🆘 지원

문제가 발생하면 다음 정보와 함께 이슈를 생성해주세요:

- 운영체제 및 버전
- Node.js 버전
- 에러 메시지 및 로그
- 네트워크 구성도 