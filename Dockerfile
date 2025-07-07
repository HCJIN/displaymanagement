# 멀티스테이지 빌드 - 프론트엔드 빌드
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --omit=dev

COPY frontend/ ./
RUN npm run build

# 멀티스테이지 빌드 - 백엔드 설정
FROM node:18-alpine AS backend-build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./

# 최종 프로덕션 이미지
FROM node:18-alpine

# 보안 강화
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 필요한 패키지 설치
RUN apk add --no-cache dumb-init

WORKDIR /app

# 백엔드 파일 복사
COPY --from=backend-build --chown=nodejs:nodejs /app/backend ./
COPY --from=frontend-build --chown=nodejs:nodejs /app/frontend/build ./public

# 로그 디렉토리 생성
RUN mkdir -p logs images && chown -R nodejs:nodejs logs images

USER nodejs

# 포트 노출
EXPOSE 3001

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 애플리케이션 실행
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"] 