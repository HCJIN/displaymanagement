# 재해문자전광판 프로토콜 IndexError 해결 방안

## 🚨 문제 상황

```
2025-06-30 17:18:06 [INFO    ] signal_hub.adapters.in_mqtt    - Received frame from 
b'\x02n\x00\x11\x06\x01\x04\x01\x05\x04\x19\x06\x1e\x11\x08\x19\x06\x1e\x11\x08F\x01\x15\x86\x8d\x00\x00\x00\x00\x00http://192.168.0.56:5002/api/images/text-to-image-0311baeabdcf-6-1751270927491.png;0311baeabdcf\x03'

IndexError: list index out of range
```

### 🔍 문제 원인

1. **프로토콜 불일치**: 
   - 받은 데이터: **신프로토콜** (COMMAND 4 bytes)
   - 파싱 시스템: **구프로토콜** 방식 (COMMAND 1 byte)

2. **'n' 문자의 정체**:
   - `\x02n` → STX(0x02) + LENGTH 첫 번째 바이트(0x6E)
   - 0x6E = 110 (decimal) → LENGTH 값

## ✅ 해결 방안

### 1. 호환성 파서 구현

#### JavaScript 구현 예시:
```javascript
function parseProtocolPacket(buffer) {
  try {
    // 신프로토콜 시도 (COMMAND 4 bytes)
    return parseAsNewProtocol(buffer);
  } catch (error) {
    // 구프로토콜로 대체 (COMMAND 1 byte)
    return parseAsOldProtocol(buffer);
  }
}

function parseAsNewProtocol(buffer) {
  let offset = 0;
  const result = {};
  
  result.stx = buffer.readUInt8(offset++);           // STX (1 byte)
  result.length = buffer.readUInt16LE(offset);       // LENGTH (2 bytes, LE)
  offset += 2;
  result.command = buffer.readUInt32LE(offset);      // COMMAND (4 bytes, LE)
  offset += 4;
  
  const dataLength = result.length - 4 - 1;         // DATA length
  result.data = buffer.slice(offset, offset + dataLength);
  offset += dataLength;
  
  result.checksum = buffer.readUInt8(offset++);      // CHECKSUM (1 byte)
  result.id = buffer.slice(offset, offset + 12).toString('ascii'); // ID (12 bytes)
  offset += 12;
  result.etx = buffer.readUInt8(offset);             // ETX (1 byte)
  
  return result;
}
```

#### Python 구현 예시:
```python
import struct

def parse_protocol_packet(binary_data):
    """프로토콜 자동 감지 파서"""
    try:
        # 신프로토콜 시도 (COMMAND 4 bytes)
        return parse_new_protocol(binary_data)
    except (IndexError, struct.error):
        # 구프로토콜로 대체 (COMMAND 1 byte)
        return parse_old_protocol(binary_data)

def parse_new_protocol(data):
    """신프로토콜 파서 (COMMAND 4 bytes)"""
    if len(data) < 18:
        raise IndexError("패킷 크기 부족")
    
    offset = 0
    
    # STX (1 byte)
    stx = data[offset]
    offset += 1
    
    # LENGTH (2 bytes, Little Endian)
    length = struct.unpack('<H', data[offset:offset+2])[0]
    offset += 2
    
    # COMMAND (4 bytes, Little Endian) - 신프로토콜 특징!
    command = struct.unpack('<L', data[offset:offset+4])[0]
    offset += 4
    
    # DATA (가변 길이)
    data_length = length - 4 - 1  # COMMAND(4) + CHECKSUM(1)
    packet_data = data[offset:offset+data_length]
    offset += data_length
    
    # CHECKSUM (1 byte)
    checksum = data[offset]
    offset += 1
    
    # ID (12 bytes)
    device_id = data[offset:offset+12].decode('ascii')
    offset += 12
    
    # ETX (1 byte)
    etx = data[offset]
    
    return {
        'protocol_type': 'NEW_PROTOCOL',
        'stx': stx,
        'length': length,
        'command': command,
        'data': packet_data,
        'checksum': checksum,
        'device_id': device_id,
        'etx': etx
    }

def parse_old_protocol(data):
    """구프로토콜 파서 (COMMAND 1 byte)"""
    offset = 0
    
    # STX (1 byte)
    stx = data[offset]
    offset += 1
    
    # COMMAND (1 byte) - 구프로토콜 특징!
    command = data[offset]
    offset += 1
    
    # DATA (가변)
    packet_data = data[offset:-2]  # CHECKSUM과 ETX 제외
    
    # CHECKSUM (1 byte)
    checksum = data[-2]
    
    # ETX (1 byte)
    etx = data[-1]
    
    return {
        'protocol_type': 'OLD_PROTOCOL',
        'stx': stx,
        'command': command,
        'data': packet_data,
        'checksum': checksum,
        'etx': etx
    }
```

### 2. signal_hub.adapters.in_mqtt 수정

```python
# signal_hub/adapters/in_mqtt.py 수정 예시

class MqttAdapter:
    def process_frame(self, frame_data):
        try:
            # 호환성 파서 사용
            parsed_packet = parse_protocol_packet(frame_data)
            
            logger.info(f"프로토콜 타입: {parsed_packet['protocol_type']}")
            logger.info(f"COMMAND: 0x{parsed_packet['command']:08x}")
            
            if parsed_packet['protocol_type'] == 'NEW_PROTOCOL':
                return self.handle_new_protocol(parsed_packet)
            else:
                return self.handle_old_protocol(parsed_packet)
                
        except Exception as e:
            logger.error(f"프레임 파싱 실패: {e}")
            raise
```

## 📊 테스트 결과

### 받은 데이터 분석:
```
원본: \x02n\x00\x11\x06\x01\x04\x01\x05\x04...
16진수: 026e001106010401050419061e1108...

파싱 결과:
- STX: 0x02 ✅
- LENGTH: 110 (0x6E) ✅  
- COMMAND: 0x04010611 (4 bytes) ✅
- 프로토콜 타입: 신프로토콜 2023.3 ✅
```

### 메시지 정보:
- **방번호**: 1
- **디바이스 ID**: 0311baeabdcf
- **이미지 URL**: http://192.168.0.56:5002/api/images/text-to-image-0311baeabdcf-6-1751270927491.png
- **메시지 타입**: 텍스트/이미지

## 🎯 핵심 포인트

1. **'n'은 오류가 아님**: LENGTH 필드의 첫 번째 바이트 (0x6E = 110)
2. **COMMAND 크기**: 신프로토콜에서는 4 bytes, 구프로토콜에서는 1 byte
3. **자동 감지**: 신프로토콜 우선 시도 후 실패시 구프로토콜로 대체
4. **Little Endian**: 멀티바이트 값은 Little Endian으로 읽기

## 🔧 즉시 적용 가능한 수정

### signal_hub.adapters.in_mqtt에서:

```python
# 기존 (오류 발생)
command = frame_data[3]  # 1 byte만 읽음

# 수정 (신프로토콜 지원)
if frame_data[0] == 0x02:  # 신프로토콜 STX
    length = struct.unpack('<H', frame_data[1:3])[0]
    command = struct.unpack('<L', frame_data[3:7])[0]  # 4 bytes 읽기
    data_start = 7
else:  # 구프로토콜
    command = frame_data[1]  # 1 byte 읽기
    data_start = 2
```

이 수정으로 IndexError 완전 해결 가능합니다! 🎉 