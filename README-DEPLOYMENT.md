# 🚀 배포 가이드

## GitHub Actions CI/CD 설정

이 프로젝트는 GitHub Actions를 사용하여 자동화된 CI/CD 파이프라인을 제공합니다.

### 🔧 설정된 워크플로우

#### 1. CI Pipeline (`.github/workflows/ci.yml`)
- **트리거**: `main`, `develop` 브랜치에 push 또는 PR
- **작업**:
  - Node.js 16.x, 18.x, 20.x 매트릭스 테스트
  - 의존성 설치
  - ESLint 실행
  - Jest 테스트 실행
  - 애플리케이션 빌드
  - 보안 감사 실행
  - 빌드 아티팩트 저장

#### 2. CD Pipeline (`.github/workflows/cd.yml`)
- **트리거**: CI 성공 후 `main` 브랜치
- **작업**:
  - Docker 이미지 빌드
  - GitHub Container Registry에 푸시
  - 다양한 플랫폼 배포 지원 (AWS, Heroku, DigitalOcean)

#### 3. Release Pipeline (`.github/workflows/release.yml`)
- **트리거**: `v*` 태그 생성
- **작업**:
  - 릴리스 아카이브 생성
  - 변경사항 자동 생성
  - GitHub Release 생성

### 🐳 Docker 설정

#### 프로덕션 배포
```bash
# 프로덕션 빌드 및 실행
docker-compose up -d

# 또는 직접 Docker 실행
docker build -t display-management .
docker run -p 3001:3001 display-management
```

#### 개발 환경
```bash
# 개발 환경 실행
docker-compose --profile dev up -d

# MQTT 브로커 포함
docker-compose --profile dev --profile mqtt up -d
```

### 🌐 배포 플랫폼 설정

#### 1. AWS ECS
```yaml
# .github/workflows/cd.yml에서 활성화
- name: Deploy to AWS ECS
  if: true # false에서 true로 변경
```

필요한 GitHub Secrets:
- `ECS_CLUSTER`: ECS 클러스터 이름
- `ECS_SERVICE`: ECS 서비스 이름
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키

#### 2. Heroku
```yaml
# .github/workflows/cd.yml에서 활성화
- name: Deploy to Heroku
  if: true # false에서 true로 변경
```

필요한 GitHub Secrets:
- `HEROKU_API_KEY`: Heroku API 키
- `HEROKU_APP_NAME`: Heroku 앱 이름
- `HEROKU_EMAIL`: Heroku 계정 이메일

#### 3. DigitalOcean App Platform
```yaml
# .github/workflows/cd.yml에서 활성화
- name: Deploy to DigitalOcean App Platform
  if: true # false에서 true로 변경
```

필요한 GitHub Secrets:
- `DIGITALOCEAN_APP_NAME`: DigitalOcean 앱 이름
- `DIGITALOCEAN_ACCESS_TOKEN`: DigitalOcean 액세스 토큰

### 🔐 환경 변수 설정

#### GitHub Repository Secrets
다음 secrets를 GitHub 리포지토리에 설정해야 합니다:

```
# 공통
JWT_SECRET=your-production-jwt-secret
MQTT_BROKER_URL=mqtt://your-mqtt-broker:1883

# AWS (선택사항)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
ECS_CLUSTER=your-ecs-cluster
ECS_SERVICE=your-ecs-service

# Heroku (선택사항)
HEROKU_API_KEY=your-heroku-api-key
HEROKU_APP_NAME=your-heroku-app-name
HEROKU_EMAIL=your-heroku-email

# DigitalOcean (선택사항)
DIGITALOCEAN_ACCESS_TOKEN=your-digitalocean-token
DIGITALOCEAN_APP_NAME=your-digitalocean-app-name
```

### 🚀 배포 실행

#### 1. 자동 배포
```bash
# main 브랜치에 push하면 자동으로 CI/CD 실행
git push origin main
```

#### 2. 릴리스 생성
```bash
# 태그 생성 및 푸시
git tag v1.0.0
git push origin v1.0.0
```

#### 3. 수동 배포
```bash
# 로컬에서 Docker 이미지 빌드
npm run docker:build

# 프로덕션 배포
npm run docker:up
```

### 📊 모니터링

#### 헬스 체크
- 엔드포인트: `GET /health`
- Docker 컨테이너 자동 헬스 체크 설정됨

#### 로그 확인
```bash
# Docker 로그 확인
docker-compose logs -f

# 또는 직접 로그 파일 확인
tail -f logs/app.log
```

### 🔧 트러블슈팅

#### 1. CI/CD 실패 시
- GitHub Actions 탭에서 로그 확인
- 테스트 실패 시 로컬에서 `npm test` 실행
- 빌드 실패 시 로컬에서 `npm run build` 실행

#### 2. Docker 빌드 실패 시
- Docker 이미지 레이어 확인
- 로컬에서 `docker build .` 실행
- `.dockerignore` 파일 확인

#### 3. 배포 실패 시
- 환경 변수 설정 확인
- 네트워크 연결 확인
- 플랫폼별 로그 확인

### 📝 추가 설정

#### 브랜치 보호 규칙
GitHub에서 다음 설정을 권장합니다:
- `main` 브랜치 보호 활성화
- PR 리뷰 필수
- CI 통과 후 머지 허용

#### 알림 설정
- Slack/Discord 웹훅 설정
- 이메일 알림 설정
- 배포 상태 알림 설정 