# 통신 프로토콜 가이드

## 📋 개요

전광판 관리 시스템에서 사용하는 다양한 통신 프로토콜과 메시지 구조를 설명합니다.

## 🌐 프로토콜 계층 구조

```
┌─────────────────────────────────────┐
│        Application Layer            │  ← 재해문자전광판 신프로토콜
├─────────────────────────────────────┤
│        Transport Layer              │  ← MQTT (Message Queuing)
├─────────────────────────────────────┤
│        Network Layer                │  ← TCP/IP
├─────────────────────────────────────┤
│        Physical Layer               │  ← Ethernet/WiFi
└─────────────────────────────────────┘
```

## 🔄 MQTT 통신 구조

### 1. MQTT 브로커 설정
```javascript
// MQTT 브로커 연결 정보
const MQTT_CONFIG = {
  host: 'o6e6b9b6.ala.asia-southeast1.emqxsl.com',
  port: 8883,
  protocol: 'mqtts',
  username: 'admin_mvp_user',
  password: 'noa12345',
  clientId: 'backend_api_' + Date.now(),
  clean: true,
  keepalive: 300,
  connectTimeout: 60000,
  rejectUnauthorized: false
}
```

### 2. 토픽 구조 (Topic Structure)
```
display/                          # 루트 토픽
├── {deviceId}/                   # 디바이스별 토픽
│   ├── command                   # 명령 전송 (Backend → Device)
│   ├── message                   # 메시지 전송 (Backend → Device)
│   ├── image                     # 이미지 전송 (Backend → Device)
│   ├── multimedia                # 멀티미디어 전송 (Backend → Device)
│   ├── response                  # 응답 수신 (Device → Backend)
│   ├── status                    # 상태 업데이트 (Device → Backend)
│   └── heartbeat                 # 하트비트 (Device → Backend)
├── broadcast/                    # 브로드캐스트
├── system/                       # 시스템 메시지
└── logs/                        # 로그 수집
```

### 3. QoS 레벨 정책
- **QoS 0 (At most once)**: 하트비트, 상태 업데이트
- **QoS 1 (At least once)**: 일반 메시지, 명령
- **QoS 2 (Exactly once)**: 중요한 제어 명령, 긴급 메시지

## 📊 메시지 타입 및 구조

### 1. 텍스트 메시지 (TEXT_MESSAGE)
```json
{
  "messageType": "text_message",
  "deviceId": "C16LD25005EA",
  "messageId": "msg_20250627_001",
  "content": "긴급상황 발생",
  "roomNumber": 1,
  "priority": "URGENT",
  "displayOptions": {
    "startEffect": 1,
    "endEffect": 5,
    "displayTime": 4,
    "fontSize": 24
  },
  "schedule": {
    "startTime": "2025-06-27T10:00:00Z",
    "endTime": "2025-06-27T18:00:00Z"
  },
  "conversionInfo": {
    "base64Data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "width": 320,
    "height": 160,
    "fontSize": 24,
    "fileId": "text-to-image-563bb55c35d5-6"
  },
      "imageUrl": "http://192.168.0.58:5002/api/images/text-to-image-563bb55c35d5-6-1750999701993.png",
  "createdBy": "admin",
  "timestamp": "2025-06-27T10:00:00Z",
  "qos": 1,
  "retain": true
}
```

### 2. 이미지 메시지 (IMAGE_MESSAGE)
```json
{
  "messageType": "image_message",
  "deviceId": "C16LD25005EA",
  "messageId": "img_20250627_001",
      "imageUrl": "http://192.168.0.58:5002/api/images/emergency-alert.png",
  "roomNumber": 2,
  "priority": "HIGH",
  "displayOptions": {
    "displayTime": 10,
    "brightness": 80
  },
  "metadata": {
    "width": 320,
    "height": 160,
    "format": "PNG",
    "size": 15420
  },
  "timestamp": "2025-06-27T10:00:00Z"
}
```

### 3. 제어 명령 (COMMAND)
```json
{
  "messageType": "command",
  "deviceId": "C16LD25005EA",
  "command": "CONNECT",
  "data": {
    "testMode": true,
    "timeout": 10000
  },
  "requestId": "test_1735262101900_abc123def",
  "timestamp": "2025-06-27T10:00:00Z"
}
```

### 4. 디바이스 응답 (RESPONSE)
```json
{
  "messageType": "response",
  "deviceId": "C16LD25005EA",
  "requestId": "test_1735262101900_abc123def",
  "status": "OK",
  "data": {
    "deviceInfo": {
      "model": "HUIDU-C16",
      "firmware": "v2.1.0",
      "resolution": "320x160",
      "maxBrightness": 100
    },
    "systemInfo": {
      "temperature": 35.2,
      "powerStatus": "ON",
      "memoryUsage": 45,
      "errorCount": 0
    }
  },
  "responseTime": 1250,
  "timestamp": "2025-06-27T10:00:01Z"
}
```

### 5. 상태 업데이트 (STATUS_UPDATE)
```json
{
  "messageType": "status_update",
  "deviceId": "C16LD25005EA",
  "status": "online",
  "systemInfo": {
    "temperature": 34.8,
    "powerStatus": "ON",
    "memoryUsage": 42,
    "errorCount": 0,
    "uptime": 86400,
    "lastMessage": "2025-06-27T09:55:00Z"
  },
  "timestamp": "2025-06-27T10:00:00Z"
}
```

### 6. 하트비트 (HEARTBEAT)
```json
{
  "messageType": "heartbeat",
  "deviceId": "C16LD25005EA",
  "alive": true,
  "systemInfo": {
    "temperature": 34.5,
    "powerStatus": "ON",
    "memoryUsage": 40,
    "networkSignal": -45
  },
  "timestamp": "2025-06-27T10:00:00Z"
}
```

## 🔧 재해문자전광판 신프로토콜

### 1. 패킷 구조
```
┌─────┬─────┬─────┬─────┬─────────┬─────┬─────┐
│ STX │ LEN │ CMD │ ID  │  DATA   │ CHK │ ETX │
├─────┼─────┼─────┼─────┼─────────┼─────┼─────┤
│  1  │  2  │  1  │ 12  │    N    │  1  │  1  │
└─────┴─────┴─────┴─────┴─────────┴─────┴─────┘
```

### 2. 필드 정의
- **STX**: 시작 바이트 (0x02)
- **LEN**: 데이터 길이 (2 bytes, Little Endian)
- **CMD**: 명령 코드 (1 byte)
- **ID**: 디바이스 ID (12 bytes, ASCII)
- **DATA**: 가변 데이터
- **CHK**: 체크섬 (1 byte)
- **ETX**: 종료 바이트 (0x03)

### 3. 주요 명령 코드
```javascript
const PROTOCOL_COMMANDS = {
  ID: 0x10,              // 디바이스 ID 전송
  TEXT_MESSAGE: 0x01,    // 문구 전송
  ROOM_INFO_REQUEST: 0x02, // 방정보 요구
  TIME_SYNC: 0x03,       // 시간 동기화
  DELETE_ALL: 0x04,      // 전체 삭제
  DELETE_ROOM: 0x07,     // 방정보 삭제
  ERROR_RESPONSE: 0x08,  // 오류 응답
  BRIGHTNESS_CONTROL: 0x0C, // 휘도 조절
  EXTERNAL_MSG_CHECK: 0x0D, // 외부 메시지 확인
  ENV_CONTROL: 0x0E,     // 환경감시기 제어
  ENV_STATUS: 0x0E,      // 환경감시기 상태
  MULTIMEDIA_ROOM: 0x10, // 멀티미디어 방정보
  MULTIMEDIA_SPLIT_REQ: 0x11, // 분할 전송 요청
  MULTIMEDIA_SPLIT_RES: 0x12, // 분할 전송 응답
  MULTIMEDIA_COMPLETE: 0x13,  // 분할 전송 완료
  MULTIMEDIA_DEL_ROOM: 0x14,  // 멀티미디어 방삭제
  MULTIMEDIA_DEL_ALL: 0x15,   // 멀티미디어 전체삭제
  NIGHT_TIME_SETTING: 0x16    // 야간시간 설정
}
```

### 4. 멀티미디어 방정보 전송 (0x11) 데이터 구조
```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────────┬─────────┐
│Room │Efct1│Spd1 │Wait │Efct2│Spd2 │ StartTime │  EndTime  │Siren│Type │  Serial   │MsgSize│   URL   │FileID │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────────┼─────────┤
│  1  │  1  │  1  │  1  │  1  │  1  │  5  │  5  │  1  │  1  │  4  │  4  │  N  │  N  │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────────┴─────────┘
```

### 5. 프로토콜 변환 예제
```javascript
// JSON 메시지를 신프로토콜 패킷으로 변환
function convertToProtocolPacket(messageData, deviceId) {
  const packet = Buffer.alloc(256)
  let offset = 0
  
  // STX
  packet[offset++] = 0x02
  
  // LENGTH (나중에 계산)
  const lengthOffset = offset
  offset += 2
  
  // COMMAND (멀티미디어 방정보 전송)
  packet[offset++] = 0x11
  
  // 방번호
  packet[offset++] = messageData.roomNumber || 1
  
  // 표시효과
  packet[offset++] = messageData.displayOptions?.startEffect || 1
  
  // 표시효과속도
  packet[offset++] = messageData.displayOptions?.displayTime || 4
  
  // 대기시간
  packet[offset++] = 1
  
  // 완료효과
  packet[offset++] = messageData.displayOptions?.endEffect || 5
  
  // 완료효과속도
  packet[offset++] = 4
  
  // 시작시간 (5 bytes: YY MM DD HH MM)
  const startTime = new Date(messageData.schedule?.startTime || Date.now())
  packet[offset++] = startTime.getFullYear() - 2000
  packet[offset++] = startTime.getMonth() + 1
  packet[offset++] = startTime.getDate()
  packet[offset++] = startTime.getHours()
  packet[offset++] = startTime.getMinutes()
  
  // 종료시간 (5 bytes: YY MM DD HH MM)
  const endTime = new Date(messageData.schedule?.endTime || Date.now() + 3600000)
  packet[offset++] = endTime.getFullYear() - 2000
  packet[offset++] = endTime.getMonth() + 1
  packet[offset++] = endTime.getDate()
  packet[offset++] = endTime.getHours()
  packet[offset++] = endTime.getMinutes()
  
  // 싸이렌 출력 (F: 없음)
  packet[offset++] = 0x46
  
  // 멀티미디어 종류 (1: 텍스트/이미지)
  packet[offset++] = 1
  
  // 일련번호 (4 bytes)
  const serialNumber = parseInt(messageData.id?.replace(/\D/g, '').slice(-8) || Date.now().toString().slice(-8))
  packet.writeUInt32LE(serialNumber, offset)
  offset += 4
  
  // 메시지 크기 (4 bytes, 이미지 URL 사용시 0)
  packet.writeUInt32LE(0, offset)
  offset += 4
  
  // 다운로드 URL
  if (messageData.imageUrl) {
    const urlBuffer = Buffer.from(messageData.imageUrl, 'utf8')
    urlBuffer.copy(packet, offset)
    offset += urlBuffer.length
  }
  
  // 파일 ID
  const fileId = messageData.conversionInfo?.fileId || 'default'
  const fileIdBuffer = Buffer.from(fileId, 'utf8')
  fileIdBuffer.copy(packet, offset)
  offset += fileIdBuffer.length
  
  // ETX
  packet[offset++] = 0x03
  
  // LENGTH 필드 업데이트
  const totalLength = offset - 3
  packet.writeUInt16LE(totalLength, lengthOffset)
  
  return packet.slice(0, offset)
}
```

## 🔄 통신 흐름

### 1. 디바이스 연결 테스트
```
Backend                    MQTT Broker                    Device
   │                           │                           │
   ├─ PUBLISH ─────────────────┤                           │
   │  display/C16LD25005EA/    │                           │
   │  command                  │                           │
   │  { cmd: "CONNECT",        │                           │
   │    testMode: true }       │                           │
   │                           ├─ FORWARD ─────────────────┤
   │                           │                           │
   │                           │                           ├─ PUBLISH
   │                           ├─ FORWARD ─────────────────┤
   │                           │  display/C16LD25005EA/    │
   │                           │  response                 │
   ├─ SUBSCRIBE ───────────────┤  { status: "OK" }         │
   │  { success: true }        │                           │
```

### 2. 메시지 전송
```
Backend                    MQTT Broker                    Device
   │                           │                           │
   ├─ TEXT → IMAGE ────────────┤                           │
   │  Canvas Conversion        │                           │
   │                           │                           │
   ├─ SAVE IMAGE ──────────────┤                           │
   │  /api/images/...          │                           │
   │                           │                           │
   ├─ PROTOCOL CONVERT ────────┤                           │
   │  JSON → Binary Packet     │                           │
   │                           │                           │
   ├─ PUBLISH ─────────────────┤                           │
   │  display/C16LD25005EA/    │                           │
   │  message                  │                           │
   │  { imageUrl, packet }     │                           │
   │                           ├─ FORWARD ─────────────────┤
   │                           │                           │
   │                           │                           ├─ DOWNLOAD IMAGE
   │                           │                           ├─ DISPLAY MESSAGE
   │                           │                           │
   │                           │                           ├─ PUBLISH
   │                           ├─ FORWARD ─────────────────┤
   │                           │  display/C16LD25005EA/    │
   ├─ SUBSCRIBE ───────────────┤  response                 │
   │  { status: "DELIVERED" }  │  { status: "DELIVERED" }  │
```

### 3. 상태 모니터링
```
Backend                    MQTT Broker                    Device
   │                           │                           │
   ├─ SUBSCRIBE ───────────────┤                           │
   │  display/+/status         │                           │
   │  display/+/heartbeat      │                           │
   │                           │                           │
   │                           │                           ├─ PUBLISH (매 60초)
   │                           ├─ FORWARD ─────────────────┤
   │                           │  display/C16LD25005EA/    │
   ├─ UPDATE STATUS ───────────┤  heartbeat                │
   │  Device.updateHeartbeat() │  { alive: true, temp: 35 }│
   │                           │                           │
   │                           │                           ├─ PUBLISH (상태 변경시)
   │                           ├─ FORWARD ─────────────────┤
   │                           │  display/C16LD25005EA/    │
   ├─ UPDATE STATUS ───────────┤  status                   │
   │  Device.updateStatus()    │  { status: "online" }     │
```

## 🛡️ 보안 고려사항

### 1. MQTT 보안
- **TLS/SSL 암호화**: mqtts:// 프로토콜 사용
- **사용자 인증**: Username/Password 기반
- **토픽 권한**: 디바이스별 토픽 접근 제한
- **페이로드 암호화**: 민감한 데이터 AES 암호화

### 2. 메시지 무결성
- **체크섬 검증**: 프로토콜 패킷 체크섬
- **시퀀스 번호**: 메시지 순서 보장
- **타임스탬프**: 메시지 유효 시간 검증
- **중복 방지**: 메시지 ID 기반 중복 제거

### 3. 네트워크 보안
- **방화벽 설정**: MQTT 포트(8883) 제한
- **VPN 연결**: 원격 디바이스 보안 터널
- **IP 화이트리스트**: 허용된 IP만 접근
- **Rate Limiting**: DoS 공격 방지

## 📊 성능 최적화

### 1. 메시지 압축
```javascript
// 대용량 메시지 압축
const zlib = require('zlib')

function compressMessage(message) {
  const compressed = zlib.gzipSync(JSON.stringify(message))
  return {
    compressed: true,
    data: compressed.toString('base64')
  }
}
```

### 2. 배치 처리
```javascript
// 다중 디바이스 메시지 배치 전송
async function sendBatchMessages(deviceIds, messageData) {
  const promises = deviceIds.map(deviceId => 
    publishMqttMessage(deviceId, 'text_message', messageData)
  )
  
  const results = await Promise.allSettled(promises)
  return results.map((result, index) => ({
    deviceId: deviceIds[index],
    success: result.status === 'fulfilled',
    error: result.status === 'rejected' ? result.reason : null
  }))
}
```

### 3. 연결 풀링
```javascript
// MQTT 연결 풀 관리
class MqttConnectionPool {
  constructor(maxConnections = 10) {
    this.connections = new Map()
    this.maxConnections = maxConnections
  }
  
  async getConnection(deviceId) {
    if (!this.connections.has(deviceId)) {
      if (this.connections.size >= this.maxConnections) {
        // LRU 방식으로 오래된 연결 제거
        const oldestKey = this.connections.keys().next().value
        await this.closeConnection(oldestKey)
      }
      
      const connection = await this.createConnection(deviceId)
      this.connections.set(deviceId, {
        client: connection,
        lastUsed: Date.now()
      })
    }
    
    this.connections.get(deviceId).lastUsed = Date.now()
    return this.connections.get(deviceId).client
  }
}
```

이 통신 프로토콜 가이드는 전광판 시스템의 안정적이고 효율적인 통신을 위한 완전한 참조 문서입니다. 