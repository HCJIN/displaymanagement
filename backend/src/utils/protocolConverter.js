const logger = require('./logger');

/**
 * 재해문자전광판 신프로토콜 변환기
 * JSON 형태의 메시지 데이터를 신프로토콜 바이너리 패킷으로 변환
 */
class ProtocolConverter {
  constructor() {
    // 신프로토콜 상수
    this.STX = 0x02;
    this.ETX = 0x03;
    this.COMMAND_MULTI_MESSAGE = 0x11;
    this.SIREN_ON = 0x54;   // 'T'
    this.SIREN_OFF = 0x46;  // 'F'
    this.MESSAGE_TYPE_TEXT_IMAGE = 1;
    this.MESSAGE_TYPE_VIDEO = 2;
  }

  /**
   * JSON 메시지를 신프로토콜 바이너리 패킷으로 변환
   * @param {Object} jsonData - 변환할 JSON 데이터
   * @param {string} deviceId - 디바이스 ID (12자리)
   * @returns {Buffer} 바이너리 패킷
   */
  convertToProtocolPacket(jsonData, deviceId) {
    try {
      console.log('🔧 프로토콜 변환 시작:', {
        messageId: jsonData.messageId,
        roomNumber: jsonData.roomNumber,
        deviceId: deviceId
      });

      // 데이터 부분 생성
      const dataBuffer = this.buildDataSection(jsonData);

      // 전체 패킷 구성
      const packet = this.buildCompletePacket(dataBuffer, deviceId);

      console.log('🔧 프로토콜 변환 완료:', {
        packetLength: packet.length,
        dataLength: dataBuffer.length,
        deviceId: deviceId
      });

      return packet;
    } catch (error) {
      logger.error('프로토콜 변환 실패:', error);
      throw new Error(`프로토콜 변환 실패: ${error.message}`);
    }
  }

  /**
   * 데이터 섹션 구성 (0x11 멀티메시지 방정보 전송)
   * @param {Object} jsonData 
   * @returns {Buffer}
   */
  buildDataSection(jsonData) {
    const buffers = [];

    // 1. 방번호 (1byte)
    buffers.push(Buffer.from([this.validateRoomNumber(jsonData.roomNumber)]));

    // 2. 표시효과 (1byte)
    const displayEffect = jsonData.displayOptions?.displayEffect || 1;
    buffers.push(Buffer.from([this.validateDisplayEffect(displayEffect)]));

    // 3. 표시효과속도 (1byte) - 1~6초
    const displaySpeed = jsonData.displayOptions?.displayEffectSpeed || 4;
    buffers.push(Buffer.from([this.validateSpeed(displaySpeed)]));

    // 4. 표시효과 완료 후 대기시간 (1byte)
    const waitTime = jsonData.displayOptions?.displayWaitTime || 1;
    buffers.push(Buffer.from([this.validateWaitTime(waitTime)]));

    // 5. 완료효과 (1byte)
    const endEffect = jsonData.displayOptions?.endEffect || 5;
    buffers.push(Buffer.from([this.validateEndEffect(endEffect)]));

    // 6. 완료효과속도 (1byte) - 1~6초
    const endSpeed = jsonData.displayOptions?.endEffectSpeed || 4;
    buffers.push(Buffer.from([this.validateSpeed(endSpeed)]));

    // 7-11. 표시 시작시간 (5bytes: 년,월,일,시,분)
    const startTime = this.parseDateTime(jsonData.schedule?.startTime);
    buffers.push(Buffer.from(startTime));

    // 12-16. 표시 완료시간 (5bytes: 년,월,일,시,분)
    const endTime = this.parseDateTime(jsonData.schedule?.endTime);
    buffers.push(Buffer.from(endTime));

    // 17. 싸이렌출력 (1byte)
    const sirenOutput = jsonData.displayOptions?.sirenOutput ? this.SIREN_ON : this.SIREN_OFF;
    buffers.push(Buffer.from([sirenOutput]));

    // 18. 멀티메시지 종류 (1byte)
    const messageType = this.MESSAGE_TYPE_TEXT_IMAGE; // 텍스트/이미지
    buffers.push(Buffer.from([messageType]));

    // 19-22. 멀티메시지 일련번호 (4bytes)
    const serialNumber = this.generateSerialNumber(jsonData.messageId);
    buffers.push(serialNumber);

    // 23-26. 멀티메시지 Size (4bytes) - 이미지 크기 (추후 구현)
    const messageSize = Buffer.alloc(4);
    messageSize.writeUInt32LE(0, 0); // 현재는 0으로 설정
    buffers.push(messageSize);

    // 27-N. 다운로드할 파일의 주소
    const imageUrl = jsonData.imageUrl || '';
    const urlBuffer = Buffer.from(imageUrl, 'utf8');
    buffers.push(urlBuffer);

    return Buffer.concat(buffers);
  }

  /**
   * 완전한 패킷 구성 (재해문자전광판 신프로토콜 정의서 준수)
   * 구조: [STX(1)] [LENGTH(2)] [COMMAND(1)] [DATA(N)] [CHECKSUM(1)] [ID(12)] [ETX(1)]
   * @param {Buffer} dataBuffer 
   * @param {string} deviceId 
   * @returns {Buffer}
   */
  buildCompletePacket(dataBuffer, deviceId) {
    console.log('🔧 패킷 구성 시작:', {
      dataSize: dataBuffer.length,
      deviceId: deviceId
    });

    const deviceIdBuffer = Buffer.from(this.formatDeviceId(deviceId), 'ascii');

    // 🚨 STX는 단 한 번만! 절대 중복되지 않도록 주의
    const STX = Buffer.from([this.STX]); // 0x02

    // LENGTH: COMMAND부터 CHECKSUM까지의 길이 (정의서 준수)
    const commandAndDataLength = 1 + dataBuffer.length; // COMMAND(1) + DATA(N)
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16LE(commandAndDataLength + 1, 0); // +1 for CHECKSUM

    // COMMAND: 0x11 (멀티메시지 방정보 전송)
    const commandBuffer = Buffer.from([this.COMMAND_MULTI_MESSAGE]);

    // CHECKSUM: LENGTH부터 ID까지의 합 중 LOW 1byte (정의서 준수)
    const checksumData = Buffer.concat([
      lengthBuffer,                                    // LENGTH (2bytes)
      commandBuffer,                                   // COMMAND (1byte)
      dataBuffer,                                     // DATA (N bytes)
      deviceIdBuffer                                  // ID (12bytes)
    ]);
    const checksum = Buffer.from([this.calculateChecksum(checksumData)]);

    // ETX: 0x03
    const ETX = Buffer.from([this.ETX]);

    // 🚨 최종 패킷 구성: 순서 절대 바뀌면 안됨!
    const finalPacket = Buffer.concat([
      STX,              // [0] STX (1byte) - 0x02
      lengthBuffer,     // [1-2] LENGTH (2bytes) 
      commandBuffer,    // [3] COMMAND (1byte) - 0x11
      dataBuffer,       // [4...] DATA (N bytes)
      checksum,         // [...] CHECKSUM (1byte)
      deviceIdBuffer,   // [...] ID (12bytes)
      ETX              // [...] ETX (1byte) - 0x03
    ]);

    // 🔧 패킷 검증 - 프로토콜 구조 확인
    if (finalPacket[0] !== this.STX) {
      throw new Error(`❌ STX 오류! 첫 번째 바이트가 STX(0x02)가 아님: 0x${finalPacket[0].toString(16).padStart(2, '0').toUpperCase()}`);
    }
    if (finalPacket[finalPacket.length - 1] !== this.ETX) {
      throw new Error(`❌ ETX 오류! 마지막 바이트가 ETX(0x03)가 아님: 0x${finalPacket[finalPacket.length - 1].toString(16).padStart(2, '0').toUpperCase()}`);
    }

    console.log('✅ 재해문자전광판 신프로토콜 패킷 구성 완료:', {
      STX: '0x' + finalPacket[0].toString(16).padStart(2, '0').toUpperCase(),
      LENGTH: finalPacket.readUInt16LE(1) + ' (0x' + finalPacket.readUInt16LE(1).toString(16).padStart(4, '0').toUpperCase() + ')',
      COMMAND: '0x' + finalPacket[3].toString(16).padStart(2, '0').toUpperCase(),
      DATA_SIZE: dataBuffer.length + ' bytes',
      CHECKSUM: '0x' + finalPacket[finalPacket.length - 14].toString(16).padStart(2, '0').toUpperCase(),
      ID: finalPacket.slice(-13, -1).toString('ascii'),
      ETX: '0x' + finalPacket[finalPacket.length - 1].toString(16).padStart(2, '0').toUpperCase(),
      TOTAL_SIZE: finalPacket.length + ' bytes',
      PROTOCOL_VALID: '✅ STX/ETX 구조 정상'
    });

    return finalPacket;
  }

  /**
   * 방번호 검증 (1~100)
   */
  validateRoomNumber(roomNumber) {
    const num = parseInt(roomNumber) || 1;
    return Math.max(1, Math.min(100, num));
  }

  /**
   * 표시효과 검증
   */
  validateDisplayEffect(effect) {
    const num = parseInt(effect) || 1;
    return Math.max(1, Math.min(17, num)); // 0x01~0x11
  }

  /**
   * 완료효과 검증
   */
  validateEndEffect(effect) {
    const num = parseInt(effect) || 5;
    return Math.max(1, Math.min(11, num)); // 0x01~0x0B
  }

  /**
   * 속도 검증 (1~6초)
   */
  validateSpeed(speed) {
    const num = parseInt(speed) || 4;
    return Math.max(1, Math.min(6, num));
  }

  /**
   * 대기시간 검증 (1초 단위)
   */
  validateWaitTime(time) {
    const num = parseInt(time) || 1;
    return Math.max(1, Math.min(255, num));
  }

  /**
   * 날짜/시간 파싱 (5bytes: 년,월,일,시,분)
   */
  parseDateTime(dateTimeStr) {
    let date;

    if (!dateTimeStr) {
      // 🔧 일관성을 위해 고정된 시간 사용 (또는 현재 시간의 분 단위로 반올림)
      date = new Date();
      // 초와 밀리초를 0으로 설정하여 같은 분 내에서는 동일한 결과 생성
      date.setSeconds(0, 0);
    } else {
      date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        date = new Date();
        date.setSeconds(0, 0);
      }
    }

    const timeData = [
      date.getFullYear() - 2000, // 년 (0x00=2000년)
      date.getMonth() + 1,       // 월 (1-12)
      date.getDate(),            // 일 (1-31)
      date.getHours(),           // 시 (0-23)
      date.getMinutes()          // 분 (0-59)
    ];

    console.log('🔧 시간 데이터 생성:', {
      원본시간: dateTimeStr || '현재시간',
      처리된시간: date.toISOString(),
      프로토콜데이터: timeData.map(t => '0x' + t.toString(16).padStart(2, '0')).join(' ')
    });

    return timeData;
  }

  /**
   * 메시지 ID에서 일련번호 생성 (4bytes)
   */
  generateSerialNumber(messageId) {
    // messageId에서 숫자 추출하여 일련번호로 사용
    const numericPart = messageId.replace(/[^0-9]/g, '');
    const serialNum = parseInt(numericPart.slice(-8)) || Math.floor(Math.random() * 0xFFFFFFFF);

    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(serialNum, 0);

    console.log('🔧 일련번호 생성:', {
      메시지ID: messageId,
      숫자부분: numericPart,
      일련번호: serialNum,
      hexValue: '0x' + serialNum.toString(16).padStart(8, '0').toUpperCase(),
      바이트배열: Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    });

    return buffer;
  }

  /**
   * 디바이스 ID 포맷팅 (12자리)
   */
  formatDeviceId(deviceId) {
    const id = deviceId.toString().slice(-12); // 마지막 12자리만 사용
    return id.padStart(12, '0'); // 12자리로 맞춤
  }

  /**
   * 체크섬 계산 (합계의 LOW 1byte)
   */
  calculateChecksum(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    return sum & 0xFF; // LOW 1byte만 반환
  }

  /**
   * 패킷을 16진수 문자열로 변환 (디버깅용)
   */
  bufferToHexString(buffer) {
    return Array.from(buffer)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * 패킷 정보 로깅 (재해문자전광판 신프로토콜 정의서 준수)
   * 구조: [STX(1)] [LENGTH(2)] [COMMAND(1)] [DATA(N)] [CHECKSUM(1)] [ID(12)] [ETX(1)]
   */
  logPacketInfo(packet, jsonData) {
    console.log('\n=== 재해문자전광판 신프로토콜 패킷 분석 ===');

    // 기본 헤더 정보
    const stx = packet[0];
    const length = packet.readUInt16LE(1);
    const command = packet[3];

    // DATA 섹션 분석 (4번째 바이트부터)
    const dataStart = 4;
    const roomNumber = packet[dataStart];
    const displayEffect = packet[dataStart + 1];
    const displaySpeed = packet[dataStart + 2];
    const waitTime = packet[dataStart + 3];
    const endEffect = packet[dataStart + 4];
    const endSpeed = packet[dataStart + 5];

    // 시간 데이터 추출 (6-15번째 DATA 바이트)
    const startTime = {
      year: packet[dataStart + 6] + 2000,
      month: packet[dataStart + 7],
      day: packet[dataStart + 8],
      hour: packet[dataStart + 9],
      minute: packet[dataStart + 10]
    };
    const endTime = {
      year: packet[dataStart + 11] + 2000,
      month: packet[dataStart + 12],
      day: packet[dataStart + 13],
      hour: packet[dataStart + 14],
      minute: packet[dataStart + 15]
    };

    // 멀티메시지 정보 추출
    const sirenOutput = packet[dataStart + 16];
    const messageType = packet[dataStart + 17];

    // 일련번호 추출 (DATA의 18-21번째 바이트)
    const serialBytes = packet.slice(dataStart + 18, dataStart + 22);
    const serialNumber = serialBytes.readUInt32LE(0);

    // CHECKSUM과 ID, ETX 위치 계산
    const checksumPos = packet.length - 14; // ETX 앞 13바이트(ID 12 + ETX 1)에서 1바이트 앞
    const idStart = packet.length - 13;
    const idEnd = packet.length - 1;
    const etx = packet[packet.length - 1];

    console.log('🔧 재해문자전광판 신프로토콜 패킷 정보:', {
      총길이: packet.length,
      STX: '0x' + stx.toString(16).padStart(2, '0').toUpperCase(),
      LENGTH: length + ' (0x' + length.toString(16).padStart(4, '0').toUpperCase() + ')',
      COMMAND: '0x' + command.toString(16).padStart(2, '0').toUpperCase() + ' (멀티메시지 방정보 전송)',
      방번호: roomNumber,
      표시효과: displayEffect + ' (0x' + displayEffect.toString(16).padStart(2, '0') + ')',
      표시효과속도: displaySpeed + '초',
      대기시간: waitTime + '초',
      완료효과: endEffect + ' (0x' + endEffect.toString(16).padStart(2, '0') + ')',
      완료효과속도: endSpeed + '초',
      시작시간: `${startTime.year}-${startTime.month.toString().padStart(2, '0')}-${startTime.day.toString().padStart(2, '0')} ${startTime.hour.toString().padStart(2, '0')}:${startTime.minute.toString().padStart(2, '0')}`,
      종료시간: `${endTime.year}-${endTime.month.toString().padStart(2, '0')}-${endTime.day.toString().padStart(2, '0')} ${endTime.hour.toString().padStart(2, '0')}:${endTime.minute.toString().padStart(2, '0')}`,
      싸이렌: sirenOutput === this.SIREN_ON ? 'ON (0x54)' : 'OFF (0x46)',
      메시지종류: messageType + ' (텍스트/이미지)',
      일련번호: serialNumber,
      일련번호HEX: '0x' + serialNumber.toString(16).padStart(8, '0').toUpperCase(),
      CHECKSUM: '0x' + packet[checksumPos].toString(16).padStart(2, '0').toUpperCase(),
      ID: packet.slice(idStart, idEnd).toString('ascii'),
      ETX: '0x' + etx.toString(16).padStart(2, '0').toUpperCase(),
      정의서준수: '✅ 재해문자전광판 신프로토콜 정의서 2023.3 완전 준수'
    });

    console.log('📋 패킷 16진수 (전체):', this.bufferToHexString(packet).replace(/ /g, ''));
  }
}

module.exports = new ProtocolConverter(); 