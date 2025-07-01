# 개발 가이드

## 📋 개요

전광판 관리 시스템의 개발 환경 설정, 설치 방법, 개발 워크플로우를 설명합니다.

## 🛠️ 개발 환경 요구사항

### 시스템 요구사항
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **Node.js**: 16.0.0 이상
- **npm**: 8.0.0 이상
- **메모리**: 최소 4GB RAM
- **저장공간**: 최소 2GB 여유 공간

### 필수 도구
- **Git**: 버전 관리
- **Visual Studio Code**: 권장 IDE
- **Postman**: API 테스트
- **MQTT Explorer**: MQTT 디버깅

## 🚀 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd display-management-system
```

### 2. 백엔드 설정
```bash
# 백엔드 디렉토리로 이동
cd backend

# 의존성 설치
npm install

# 환경 변수 설정 (선택사항)
cp .env.example .env
# .env 파일 편집

# 개발 서버 실행
npm run dev
# 또는
npm start
```

### 3. 프론트엔드 설정
```bash
# 새 터미널에서 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm start
```

### 4. 접속 확인
- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001 (또는 5002)
- **기본 로그인**: admin / admin123

## 🔧 개발 환경 설정

### VS Code 확장 프로그램
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode-remote.remote-containers"
  ]
}
```

### ESLint 설정 (.eslintrc.js)
```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'react-app',
    'react-app/jest'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'prefer-const': 'error'
  }
}
```

### Prettier 설정 (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## 📁 프로젝트 구조 이해

### 백엔드 구조
```
backend/
├── src/
│   ├── controllers/    # 요청 처리 로직
│   ├── middleware/     # 인증, 에러처리 등
│   ├── models/         # 데이터 모델
│   ├── routes/         # API 라우트 정의
│   ├── services/       # 비즈니스 로직
│   └── utils/          # 유틸리티 함수
├── logs/              # 로그 파일
├── images/            # 업로드된 이미지
├── package.json       # 의존성 관리
└── server.js         # 서버 진입점
```

### 프론트엔드 구조
```
frontend/
├── public/            # 정적 파일
├── src/
│   ├── components/    # 재사용 컴포넌트
│   ├── pages/         # 페이지 컴포넌트
│   ├── context/       # React Context
│   ├── hooks/         # 커스텀 훅
│   ├── services/      # API 서비스
│   ├── styles/        # 스타일 파일
│   └── utils/         # 유틸리티 함수
├── package.json       # 의존성 관리
└── README.md         # 프로젝트 설명
```

## 🔄 개발 워크플로우

### 1. 기능 개발 프로세스
```
1. 이슈 생성 → 2. 브랜치 생성 → 3. 개발 → 4. 테스트 → 5. PR 생성 → 6. 코드 리뷰 → 7. 머지
```

### 2. Git 브랜치 전략
```
main                    # 프로덕션 브랜치
├── develop            # 개발 브랜치
├── feature/login      # 기능 브랜치
├── feature/device-mgmt
├── hotfix/bug-fix     # 핫픽스 브랜치
└── release/v1.0.0     # 릴리즈 브랜치
```

### 3. 커밋 메시지 컨벤션
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드 추가
chore: 빌드 관련 업데이트

예시:
feat: 디바이스 연결 테스트 기능 추가
fix: 토큰 만료 처리 버그 수정
docs: API 문서 업데이트
```

## 🧪 테스트 가이드

### 백엔드 테스트
```bash
# 단위 테스트 실행
npm test

# 테스트 커버리지 확인
npm run test:coverage

# API 테스트
npm run test:api
```

### 프론트엔드 테스트
```bash
# 단위 테스트 실행
npm test

# E2E 테스트 실행
npm run test:e2e

# 테스트 감시 모드
npm run test:watch
```

### 테스트 작성 예제
```javascript
// 백엔드 테스트 예제
describe('Device API', () => {
  test('GET /api/devices should return device list', async () => {
    const response = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
  })
})

// 프론트엔드 테스트 예제
import { render, screen } from '@testing-library/react'
import DeviceList from '../pages/DeviceList'

test('renders device list', () => {
  render(<DeviceList />)
  const linkElement = screen.getByText(/디바이스 목록/i)
  expect(linkElement).toBeInTheDocument()
})
```

## 🐛 디버깅 가이드

### 백엔드 디버깅
```javascript
// VS Code launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

### 로그 확인
```bash
# 백엔드 로그 실시간 확인
tail -f backend/logs/application-2025-06-27.log

# 에러 로그만 확인
tail -f backend/logs/error-2025-06-27.log | grep ERROR
```

### MQTT 디버깅
```javascript
// MQTT 메시지 로깅 활성화
process.env.DEBUG_MQTT = 'true'
process.env.DEBUG_MQTT_MESSAGES = 'true'
process.env.DEBUG_MQTT_TOPICS = 'true'
```

## 🔧 환경 변수 설정

### 백엔드 환경 변수 (.env)
```bash
# 서버 설정
NODE_ENV=development
PORT=3001
HOST=localhost

# JWT 설정
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=24h

# MQTT 설정
MQTT_BROKER_HOST=o6e6b9b6.ala.asia-southeast1.emqxsl.com
MQTT_BROKER_PORT=8883
ADMIN_MQTT_USERNAME=admin_mvp_user
ADMIN_MQTT_PASSWORD=noa12345

# 로깅 설정
LOG_LEVEL=info
DEBUG_MQTT=false

# 파일 업로드 설정
UPLOAD_PATH=./images
MAX_FILE_SIZE=10485760

# 웹서버 설정
WEB_SERVER_HOST=192.168.0.58
WEB_SERVER_PORT=5002
WEB_SERVER_PROTOCOL=http

# 🔥 MQTT 바이너리 전송 설정 (파이썬 \x 형태)
MQTT_SEND_AS_BINARY=true
```

### 프론트엔드 환경 변수 (.env)
```bash
# API 설정
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=http://localhost:3001

# 기능 플래그
REACT_APP_ENABLE_MOCK=false
REACT_APP_ENABLE_DEBUG=true

# 테마 설정
REACT_APP_DEFAULT_THEME=light
```

## 📦 빌드 및 배포

### 개발 빌드
```bash
# 백엔드 - 개발 모드
cd backend
npm run dev

# 프론트엔드 - 개발 모드
cd frontend
npm start
```

### 프로덕션 빌드
```bash
# 프론트엔드 빌드
cd frontend
npm run build

# 빌드 결과 확인
npm run serve

# 백엔드 프로덕션 실행
cd backend
NODE_ENV=production npm start
```

### Docker 배포
```dockerfile
# Dockerfile.backend
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]

# Dockerfile.frontend
FROM node:16-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MQTT_BROKER_HOST=mqtt-broker
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/images:/app/images

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  mqtt-broker:
    image: eclipse-mosquitto:latest
    ports:
      - "1883:1883"
      - "8883:8883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
```

## 🔍 성능 모니터링

### 성능 메트릭 수집
```javascript
// 백엔드 성능 모니터링
const performanceMonitor = {
  requestCount: 0,
  responseTime: [],
  errorCount: 0,
  
  middleware: (req, res, next) => {
    const start = Date.now()
    
    res.on('finish', () => {
      const duration = Date.now() - start
      performanceMonitor.requestCount++
      performanceMonitor.responseTime.push(duration)
      
      if (res.statusCode >= 400) {
        performanceMonitor.errorCount++
      }
    })
    
    next()
  },
  
  getStats: () => ({
    totalRequests: performanceMonitor.requestCount,
    averageResponseTime: performanceMonitor.responseTime.reduce((a, b) => a + b, 0) / performanceMonitor.responseTime.length,
    errorRate: (performanceMonitor.errorCount / performanceMonitor.requestCount) * 100
  })
}
```

### 메모리 사용량 모니터링
```javascript
// 메모리 사용량 체크
setInterval(() => {
  const usage = process.memoryUsage()
  console.log('Memory Usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
  })
}, 60000) // 1분마다 체크
```

## 🚨 트러블슈팅

### 자주 발생하는 문제들

#### 1. MQTT 연결 실패
```bash
# 문제: MQTT 브로커 연결 실패
# 해결:
1. 네트워크 연결 확인
2. 브로커 주소/포트 확인
3. 인증 정보 확인
4. 방화벽 설정 확인
```

#### 2. 토큰 만료 에러
```bash
# 문제: JWT 토큰 만료로 API 호출 실패
# 해결:
1. 토큰 갱신 로직 확인
2. 토큰 만료 시간 설정 확인
3. 자동 로그아웃 처리 확인
```

#### 3. 이미지 업로드 실패
```bash
# 문제: 이미지 변환 또는 업로드 실패
# 해결:
1. 파일 크기 제한 확인
2. 디스크 용량 확인
3. 권한 설정 확인
4. 이미지 형식 확인
```

#### 4. 디바이스 연결 테스트 실패
```bash
# 문제: 실제 장비 연결 테스트 실패
# 해결:
1. MQTT 브로커 연결 상태 확인
2. 장비 네트워크 연결 확인
3. 장비 ID 정확성 확인
4. 프로토콜 설정 확인
```

### 로그 분석
```bash
# 에러 로그 분석
grep "ERROR" backend/logs/application-*.log | tail -20

# MQTT 관련 로그 확인
grep "MQTT" backend/logs/application-*.log | tail -20

# 성능 관련 로그 확인
grep "slow" backend/logs/application-*.log
```

## 🤝 기여 가이드

### Pull Request 프로세스
1. **Fork** 프로젝트
2. **Feature 브랜치** 생성
3. **개발 및 테스트**
4. **커밋 메시지** 작성
5. **Pull Request** 생성
6. **코드 리뷰** 대응
7. **머지** 완료

### 코드 리뷰 체크리스트
- [ ] 코드 스타일 가이드 준수
- [ ] 테스트 케이스 작성
- [ ] 문서 업데이트
- [ ] 성능 영향 검토
- [ ] 보안 취약점 검토
- [ ] 호환성 확인

이 개발 가이드를 통해 전광판 관리 시스템을 효율적으로 개발하고 유지보수할 수 있습니다. 