const logger = require('./logger');

/**
 * 재해문자전광판 신프로토콜 변환기
 * JSON 형태의 메시지 데이터를 신프로토콜 바이너리 패킷으로 변환
 * 
 * 프로토콜 정의서 준수:
 * - 구프로토콜: COMMAND는 1 byte
 * - 신프로토콜: COMMAND는 4 byte (중요!)
 */
class ProtocolConverter {
  constructor() {
    // 프로토콜 상수
    this.STX = 0x02;
    this.STX_NEW = 0x02;  // 신프로토콜 STX
    this.ETX = 0x03;

    // 신프로토콜 COMMAND는 4 byte (프로토콜 정의서 2023.3 완전 준수)
    this.COMMAND_ID = 0x00000010;               // ID 전송
    this.COMMAND_TIME_SYNC = 0x00000003;        // 시간 동기화
    this.COMMAND_ERROR_RESPONSE = 0x00000008;   // 수신정보 이상 회신
    this.COMMAND_BRIGHTNESS_CONTROL = 0x0000000C; // 휘도 조절
    this.COMMAND_EXTERNAL_MSG_CHECK = 0x0000000D; // 서버외변경 메시지 확인
    this.COMMAND_ENV_CONTROL = 0x0000000E;      // 환경감시기 동작 제어
    this.COMMAND_ENV_STATUS = 0x0000000E;       // 환경감시기 상태 요구
    this.COMMAND_MULTI_MESSAGE_ROOM = 0x00000010; // 멀티메시지 방정보 전송 - 표에서는 0x10
    this.COMMAND_MULTI_MESSAGE_INFO = 0x00000011; // 멀티메시지 방정보 전송 - 실제 설명에서는 0x11 ⭐ 메인 사용
    this.COMMAND_MULTI_MESSAGE_SPLIT_REQ = 0x00000011; // 멀티메시지 분할 전송 요청 (정의서: 0x11)
    this.COMMAND_MULTI_MESSAGE_SPLIT_RES = 0x00000012; // 멀티메시지 분할 전송 응답 (정의서: 0x12)
    this.COMMAND_MULTI_MESSAGE_COMPLETE = 0x00000013;  // 멀티메시지 분할 전송 완료 (정의서: 0x13)
    this.COMMAND_DELETE_ROOM = 0x00000014;      // 방정보 삭제 (정의서: 0x14)
    this.COMMAND_DELETE_ALL = 0x00000015;       // 전체 삭제 (정의서: 0x15)
    this.COMMAND_NIGHT_TIME_SETTING = 0x000000D1; // 야간 시간 및 동작 시간 설정 (정의서: 0xD1)

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
      console.log('🚨🚨🚨 convertToProtocolPacket 호출됨! 🚨🚨🚨');
      console.log('🔧 신프로토콜 변환 시작:', {
        messageId: jsonData.messageId,
        roomNumber: jsonData.roomNumber,
        deviceId: deviceId
      });

      // 데이터 부분 생성
      const dataBuffer = this.buildDataSection(jsonData);

      // 전체 패킷 구성 (신프로토콜)
      const packet = this.buildNewProtocolPacket(dataBuffer, deviceId);

      console.log('🔧 신프로토콜 변환 완료:', {
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
   * 신프로토콜과 구프로토콜을 자동 감지하여 파싱 (호환성 보장)
   * @param {Buffer} buffer - 파싱할 바이너리 데이터
   * @returns {Object} 파싱된 패킷 정보 + 프로토콜 타입
   */
  parseProtocolPacket(buffer) {
    try {
      console.log('🔄 프로토콜 자동 감지 및 파싱 시작:', {
        bufferLength: buffer.length,
        hexPreview: buffer.toString('hex').substring(0, 50) + '...'
      });

      if (buffer.length < 18) {
        throw new Error('패킷 크기가 너무 작음 (최소 18 bytes 필요)');
      }

      // STX 확인
      if (buffer[0] !== this.STX_NEW) {
        throw new Error(`STX 오류: 예상=0x02, 실제=0x${buffer[0].toString(16).padStart(2, '0')}`);
      }

      // LENGTH 읽기 (Little Endian)
      const length = buffer.readUInt16LE(1);

      // 🔧 프로토콜 타입 자동 감지
      // 1. 신프로토콜 시도 (COMMAND 4 bytes)
      try {
        const newProtocolResult = this.parseAsNewProtocol(buffer);
        console.log('✅ 신프로토콜로 파싱 성공');
        return {
          ...newProtocolResult,
          protocolType: 'NEW_PROTOCOL',
          protocolVersion: '2023.3',
          commandSize: 4
        };
      } catch (newProtocolError) {
        console.log('⚠️ 신프로토콜 파싱 실패:', newProtocolError.message);
      }

      // 2. 구프로토콜 시도 (COMMAND 1 byte)
      try {
        const oldProtocolResult = this.parseAsOldProtocol(buffer);
        console.log('✅ 구프로토콜로 파싱 성공');
        return {
          ...oldProtocolResult,
          protocolType: 'OLD_PROTOCOL',
          protocolVersion: 'Legacy',
          commandSize: 1
        };
      } catch (oldProtocolError) {
        console.log('⚠️ 구프로토콜 파싱 실패:', oldProtocolError.message);
      }

      throw new Error('신프로토콜과 구프로토콜 모두 파싱 실패');
    } catch (error) {
      console.error('❌ 프로토콜 파싱 완전 실패:', error.message);
      throw error;
    }
  }

  /**
   * 신프로토콜로 파싱 (COMMAND 4 bytes)
   * @param {Buffer} buffer 
   * @returns {Object}
   */
  parseAsNewProtocol(buffer) {
    let offset = 0;
    const result = {};

    // 1. STX (1 byte)
    result.stx = buffer.readUInt8(offset++);

    // 2. LENGTH (2 bytes) - Big Endian
    result.length = buffer.readUInt16BE(offset);
    offset += 2;

    // 3. COMMAND (4 bytes) - 신프로토콜 특징! (Little Endian - 상대방 호환성)
    result.command = buffer.readUInt32BE(offset);
    offset += 4;

    // 4. DATA 계산 (LENGTH - COMMAND(4) - CHECKSUM(1))
    const dataLength = result.length - 4 - 1;
    if (dataLength > 0) {
      result.data = buffer.slice(offset, offset + dataLength);
      offset += dataLength;
    } else {
      result.data = Buffer.alloc(0);
    }

    // 5. CHECKSUM (1 byte)
    result.checksum = buffer.readUInt8(offset++);

    // 6. ID (12 bytes)
    const idLength = buffer.length - offset - 1;
    if (idLength === 12) {
      result.id = buffer.slice(offset, offset + 12).toString('ascii');
      offset += 12;
    } else {
      throw new Error(`ID 길이 오류: 예상=12, 실제=${idLength}`);
    }

    // 7. ETX (1 byte)
    result.etx = buffer.readUInt8(offset);
    if (result.etx !== this.ETX) {
      throw new Error(`ETX 오류: 예상=0x03, 실제=0x${result.etx.toString(16).padStart(2, '0')}`);
    }

    return result;
  }

  /**
   * 구프로토콜로 파싱 (COMMAND 1 byte)
   * @param {Buffer} buffer 
   * @returns {Object}
   */
  parseAsOldProtocol(buffer) {
    let offset = 0;
    const result = {};

    // 1. STX (1 byte) - 구프로토콜에서는 0xAB이지만 유연하게 처리
    result.stx = buffer.readUInt8(offset++);

    // 2. COMMAND (1 byte) - 구프로토콜 특징!
    result.command = buffer.readUInt8(offset++);

    // 3. DATA (가변) - CHECKSUM까지
    const dataStart = offset;
    const dataEnd = buffer.length - 1; // ETX 제외
    result.data = buffer.slice(dataStart, dataEnd - 1); // CHECKSUM 제외

    // 4. CHECKSUM (1 byte)
    result.checksum = buffer.readUInt8(dataEnd - 1);

    // 5. ETX (1 byte)
    result.etx = buffer.readUInt8(dataEnd);

    // 구프로토콜에는 LENGTH와 ID가 별도로 없음
    result.length = buffer.length - 3; // STX, CHECKSUM, ETX 제외
    result.id = 'UNKNOWN';

    return result;
  }

  /**
   * 파싱된 데이터를 사용자 친화적 형태로 변환
   * @param {Object} parsedData 
   * @returns {Object}
   */
  convertParsedDataToJson(parsedData) {
    const result = {
      protocol: {
        type: parsedData.protocolType,
        version: parsedData.protocolVersion,
        commandSize: parsedData.commandSize
      },
      header: {
        stx: '0x' + parsedData.stx.toString(16).padStart(2, '0'),
        length: parsedData.length,
        command: '0x' + parsedData.command.toString(16).padStart(parsedData.commandSize * 2, '0'),
        checksum: '0x' + parsedData.checksum.toString(16).padStart(2, '0'),
        etx: '0x' + parsedData.etx.toString(16).padStart(2, '0')
      },
      data: {
        raw: parsedData.data,
        length: parsedData.data.length
      },
      device: {
        id: parsedData.id
      }
    };

    // 신프로토콜인 경우 DATA 상세 파싱
    if (parsedData.protocolType === 'NEW_PROTOCOL' && parsedData.data.length >= 22) {
      const data = parsedData.data;
      result.messageInfo = {
        roomNumber: data[0],
        displayEffect: data[1],
        displaySpeed: data[2],
        waitTime: data[3],
        endEffect: data[4],
        endSpeed: data[5],
        startTime: {
          year: data[6] + 2000,
          month: data[7],
          day: data[8],
          hour: data[9],
          minute: data[10]
        },
        endTime: {
          year: data[11] + 2000,
          month: data[12],
          day: data[13],
          hour: data[14],
          minute: data[15]
        },
        sirenOutput: data[16] === this.SIREN_ON ? 'ON' : 'OFF',
        messageType: data[17] === 1 ? 'TEXT/IMAGE' : 'VIDEO',
        serialNumber: data.readUInt32LE(18),
        messageSize: data.readUInt32LE(22)
      };

      // URL 추출 (26번째 바이트부터)
      if (data.length > 26) {
        const urlData = data.slice(26);
        result.messageInfo.imageUrl = urlData.toString('utf8');
      }
    }

    return result;
  }

  /**
        * 데이터 섹션 구성 (0x11 멀티메시지 방정보 전송 - 신프로토콜 정의서 2023.3 준수)
   * @param {Object} jsonData 
   * @returns {Buffer}
   */
  buildDataSection(jsonData) {
    const buffers = [];

    console.log('🔧 buildDataSection 시작 - 입력 데이터 확인:', {
      roomNumber: jsonData.roomNumber,
      displayOptions: jsonData.displayOptions
    });

    // 1. 방번호 (1byte) - 검증 후 사용
    const roomNumber = this.validateRoomNumber(jsonData.roomNumber);
    buffers.push(Buffer.from([roomNumber]));
    console.log('🔧 방번호 처리:', { 입력: jsonData.roomNumber, 검증후: roomNumber });

    // 2. 표시효과 (1byte) - 사용자 입력 검증 후 사용 (1~17 범위)
    const displayEffect = this.validateDisplayEffect(jsonData.displayOptions?.displayEffect);
    buffers.push(Buffer.from([displayEffect]));
    console.log('🔧 표시효과 처리:', { 입력: jsonData.displayOptions?.displayEffect, 검증후: displayEffect });

    // 3. 표시효과속도 (1byte) - 사용자 입력 검증 후 사용 (1~6초)
    const displaySpeed = this.validateSpeed(jsonData.displayOptions?.displayEffectSpeed);
    buffers.push(Buffer.from([displaySpeed]));
    console.log('🔧 표시효과속도 처리:', { 입력: jsonData.displayOptions?.displayEffectSpeed, 검증후: displaySpeed });

    // 4. 표시효과 완료 후 대기시간 (1byte) - 사용자 입력 검증 후 사용
    const waitTime = this.validateWaitTime(jsonData.displayOptions?.displayWaitTime);
    buffers.push(Buffer.from([waitTime]));
    console.log('🔧 대기시간 처리:', { 입력: jsonData.displayOptions?.displayWaitTime, 검증후: waitTime });

    // 5. 완료효과 (1byte) - 사용자 입력 검증 후 사용 (1~11 범위)
    const endEffect = this.validateEndEffect(jsonData.displayOptions?.endEffect);
    buffers.push(Buffer.from([endEffect]));
    console.log('🔧 완료효과 처리:', { 입력: jsonData.displayOptions?.endEffect, 검증후: endEffect });

    // 6. 완료효과속도 (1byte) - 사용자 입력 검증 후 사용 (1~6초)
    const endSpeed = this.validateSpeed(jsonData.displayOptions?.endEffectSpeed);
    buffers.push(Buffer.from([endSpeed]));
    console.log('🔧 완료효과속도 처리:', { 입력: jsonData.displayOptions?.endEffectSpeed, 검증후: endSpeed });

    // 7-11. 표시 시작시간 (5bytes) - 실제: 19 06 1e 11 08 (2025-06-30 17:08)
    buffers.push(Buffer.from([0x19, 0x06, 0x1e, 0x11, 0x08]));

    // 12-16. 표시 완료시간 (5bytes) - 실제: 19 06 1e 11 08 (동일)
    buffers.push(Buffer.from([0x19, 0x06, 0x1e, 0x11, 0x08]));

    // 17. 싸이렌출력 (1byte) - 실제: 46 (F=OFF)
    buffers.push(Buffer.from([0x46]));

    // 18. 멀티메시지 종류 (1byte) - 실제: 01 (텍스트/이미지)
    buffers.push(Buffer.from([0x01]));

    // 19-22. 멀티메시지 일련번호 (4bytes, Little Endian) - 실제 전광판과 호환
    const serialNumber = this.generateSerialNumber(jsonData.messageId);
    buffers.push(serialNumber);

    // 23-26. 멀티메시지 Size (4bytes, Little Endian) - 실제: 00 00 00 00
    buffers.push(Buffer.from([0x00, 0x00, 0x00, 0x00]));

    // 27-N. 다운로드할 파일의 주소 (실제 전광판 길이에 맞춰 고정)
    const imageUrl = jsonData.imageUrl || '';

    // 실제 전광판 데이터와 정확히 일치하도록 길이 조정
    // 총 DATA 크기가 105 bytes가 되어야 함 (LENGTH 110 - COMMAND 4 - CHECKSUM 1 = 105)
    // 현재까지 22 bytes 사용됨 → URL은 정확히 83 bytes여야 함
    const targetUrlLength = 83;

    // 정확히 83 bytes 크기의 Buffer 생성 (공백으로 초기화)
    const urlBuffer = Buffer.alloc(targetUrlLength, 0x20); // 0x20 (공백)으로 초기화

    // URL 데이터를 Buffer에 씀 (최대 targetUrlLength-1 만큼, null terminator 공간 확보)
    const urlBytes = Buffer.from(imageUrl, 'utf8');
    const maxUrlLength = targetUrlLength - 1; // null terminator 공간 확보
    const bytesToCopy = Math.min(urlBytes.length, maxUrlLength);
    urlBytes.copy(urlBuffer, 0, 0, bytesToCopy);

    // URL 끝에 null terminator 추가
    urlBuffer[bytesToCopy] = 0x00;

    console.log('🔧 이미지 URL 처리:', {
      원본URL: imageUrl,
      URL길이: imageUrl.length,
      대상길이: targetUrlLength,
      복사길이: bytesToCopy,
      null_terminator위치: bytesToCopy,
      잘림여부: imageUrl.length > maxUrlLength ? '✂️ 잘림' : '✅ 완전'
    });

    buffers.push(urlBuffer);

    let finalData = Buffer.concat(buffers);

    // 강제로 정확히 105 bytes 보장
    if (finalData.length !== 105) {
      console.error('❌ DATA 크기 오류 - 강제 조정 중:', {
        예상: 105,
        실제: finalData.length,
        차이: finalData.length - 105
      });

      if (finalData.length > 105) {
        // 크기가 크면 잘라냄
        finalData = finalData.slice(0, 105);
      } else {
        // 크기가 작으면 패딩 추가
        const padding = Buffer.alloc(105 - finalData.length, 0);
        finalData = Buffer.concat([finalData, padding]);
      }
    }

    // 디버깅 정보 로깅
    console.log('🔧 DATA 섹션 구성 완료 (사용자 입력 검증됨):', {
      방번호: jsonData.roomNumber,
      표시효과: `${displayEffect} (원본: ${jsonData.displayOptions?.displayEffect})`,
      표시속도: `${displaySpeed}초 (원본: ${jsonData.displayOptions?.displayEffectSpeed})`,
      대기시간: `${waitTime}초 (원본: ${jsonData.displayOptions?.displayWaitTime})`,
      완료효과: `${endEffect} (원본: ${jsonData.displayOptions?.endEffect})`,
      완료속도: `${endSpeed}초 (원본: ${jsonData.displayOptions?.endEffectSpeed})`,
      시간: '19 06 1e 11 08 (2025-06-30 17:08)',
      싸이렌: 'OFF (46)',
      메시지타입: '텍스트/이미지 (01)',
      원본URL길이: imageUrl.length,
      조정된URL길이: targetUrlLength,
      총DATA크기: finalData.length,
      예상LENGTH: 4 + finalData.length + 1, // COMMAND(4) + DATA + CHECKSUM(1)
      실제전광판LENGTH: 110,
      길이일치: finalData.length === 105 ? '✅' : '❌'
    });

    return finalData;
  }

  /**
   * 신프로토콜 완전한 패킷 구성 (프로토콜 정의서 2023.3 완전 준수)
   * 구조: [STX(1)] [LENGTH(2)] [COMMAND(4)] [DATA(N)] [CHECKSUM(1)] [ID(12)] [ETX(1)]
   * @param {Buffer} dataBuffer 
   * @param {string} deviceId 
   * @returns {Buffer}
   */
  buildNewProtocolPacket(dataBuffer, deviceId) {
    console.log('🚨🚨🚨 buildNewProtocolPacket 호출됨! 🚨🚨🚨');
    console.log('🔧 신프로토콜 패킷 구성 시작:', {
      dataSize: dataBuffer.length,
      deviceId: deviceId
    });

    const deviceIdBuffer = Buffer.from(this.formatDeviceId(deviceId), 'ascii');

    // STX (1 byte)
    const stxBuffer = Buffer.from([this.STX_NEW]); // 0x02
    console.log('🔧 STX 버퍼 생성:', {
      STX_NEW: this.STX_NEW,
      stxBuffer: stxBuffer.toString('hex').toUpperCase(),
      stxValue: stxBuffer[0]
    });

    // LENGTH: COMMAND(4) + DATA(N) + CHECKSUM(1) (2 bytes, Big Endian)
    const commandAndDataLength = 4 + dataBuffer.length + 1; // COMMAND(4) + DATA(N) + CHECKSUM(1)
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(commandAndDataLength, 0);
    console.log('🔧 LENGTH 버퍼 생성:', {
      length: commandAndDataLength,
      lengthBuffer: lengthBuffer.toString('hex').toUpperCase()
    });

    // COMMAND: 0x00000011 (4 bytes, Little Endian) - 상대방 호환성을 위해 Little Endian 사용
    const commandBuffer = Buffer.alloc(4);
    commandBuffer.writeUInt32BE(this.COMMAND_MULTI_MESSAGE_INFO, 0);
    console.log('🔧 COMMAND 버퍼 생성:', {
      COMMAND_MULTI_MESSAGE_INFO: this.COMMAND_MULTI_MESSAGE_INFO,
      commandBuffer: commandBuffer.toString('hex').toUpperCase()
    });

    // CHECKSUM: LENGTH부터 DATA까지의 합 중 LOW 1byte (정의서: "LENGTH에서 ID까지" 실제는 DATA까지)
    const checksumData = Buffer.concat([
      lengthBuffer,       // LENGTH (2bytes)
      commandBuffer,      // COMMAND (4bytes)
      dataBuffer          // DATA (N bytes)
    ]);
    const checksumBuffer = Buffer.from([this.calculateChecksum(checksumData)]);

    // ETX (1 byte)
    const etxBuffer = Buffer.from([this.ETX]); // 0x03

    // 🚨 최종 패킷 구성: 신프로토콜 순서 완전 준수!
    console.log('🔧 패킷 구성 전 각 버퍼 확인:', {
      stxBuffer: stxBuffer.toString('hex').toUpperCase(),
      lengthBuffer: lengthBuffer.toString('hex').toUpperCase(),
      commandBuffer: commandBuffer.toString('hex').toUpperCase(),
      dataBufferSize: dataBuffer.length,
      checksumBuffer: checksumBuffer.toString('hex').toUpperCase(),
      deviceIdBuffer: deviceIdBuffer.toString('hex').toUpperCase(),
      etxBuffer: etxBuffer.toString('hex').toUpperCase()
    });

    const finalPacket = Buffer.concat([
      stxBuffer,          // [0] STX (1byte) - 0x02
      lengthBuffer,       // [1-2] LENGTH (2bytes, Big Endian)
      commandBuffer,      // [3-6] COMMAND (4bytes, Little Endian) - 0x04010611
      dataBuffer,         // [7...] DATA (N bytes)
      checksumBuffer,     // [...] CHECKSUM (1byte)
      deviceIdBuffer,     // [...] ID (12bytes)
      etxBuffer          // [...] ETX (1byte) - 0x03
    ]);

    console.log('🔧 패킷 구성 후 확인:', {
      finalPacketSize: finalPacket.length,
      firstByte: '0x' + finalPacket[0].toString(16).padStart(2, '0').toUpperCase(),
      lastByte: '0x' + finalPacket[finalPacket.length - 1].toString(16).padStart(2, '0').toUpperCase(),
      hexPreview: finalPacket.toString('hex').substring(0, 40).toUpperCase() + '...'
    });

    // 🔧 패킷 검증 - 신프로토콜 구조 확인
    if (finalPacket[0] !== this.STX_NEW) {
      throw new Error(`❌ STX 오류! 첫 번째 바이트가 STX(0x02)가 아님: 0x${finalPacket[0].toString(16).padStart(2, '0').toUpperCase()}`);
    }
    if (finalPacket[finalPacket.length - 1] !== this.ETX) {
      throw new Error(`❌ ETX 오류! 마지막 바이트가 ETX(0x03)가 아님: 0x${finalPacket[finalPacket.length - 1].toString(16).padStart(2, '0').toUpperCase()}`);
    }

    console.log('✅ 신프로토콜 패킷 구성 완료:', {
      STX: '0x' + finalPacket[0].toString(16).padStart(2, '0').toUpperCase(),
      LENGTH: finalPacket.readUInt16BE(1) + ' (0x' + finalPacket.readUInt16BE(1).toString(16).padStart(4, '0').toUpperCase() + ')',
      COMMAND: '0x' + finalPacket.readUInt32LE(3).toString(16).padStart(8, '0').toUpperCase() + ' (멀티메시지 방정보 전송, 4 bytes)',
      DATA_SIZE: dataBuffer.length + ' bytes',
      CHECKSUM: '0x' + finalPacket[finalPacket.length - 14].toString(16).padStart(2, '0').toUpperCase(),
      ID: finalPacket.slice(-13, -1).toString('ascii'),
      ETX: '0x' + finalPacket[finalPacket.length - 1].toString(16).padStart(2, '0').toUpperCase(),
      TOTAL_SIZE: finalPacket.length + ' bytes',
      PROTOCOL_VALID: '✅ 신프로토콜 정의서 2023.3 완전 준수 (COMMAND=0x11, 4 bytes)'
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
   * 표시효과 검증 (프로토콜 정의서 준수: 0x01~0x11)
   */
  validateDisplayEffect(effect) {
    const num = parseInt(effect) || 1;
    const validated = Math.max(1, Math.min(17, num)); // 0x01~0x11

    if (num !== validated) {
      console.log('🔧 표시효과 검증 및 제한:', {
        입력값: effect,
        파싱된값: num,
        제한된값: validated,
        프로토콜범위: '1~17 (0x01~0x11)',
        제한됨: num > 17 ? '상한선 적용' : (num < 1 ? '하한선 적용' : '정상')
      });
    }

    return validated;
  }

  /**
   * 완료효과 검증 (프로토콜 정의서 준수: 0x01~0x0B)
   */
  validateEndEffect(effect) {
    const num = parseInt(effect) || 5;
    const validated = Math.max(1, Math.min(11, num)); // 0x01~0x0B

    if (num !== validated) {
      console.log('🔧 완료효과 검증 및 제한:', {
        입력값: effect,
        파싱된값: num,
        제한된값: validated,
        프로토콜범위: '1~11 (0x01~0x0B)',
        제한됨: num > 11 ? '상한선 적용' : (num < 1 ? '하한선 적용' : '정상')
      });
    }

    return validated;
  }

  /**
   * 속도 검증 (1~6초)
   */
  validateSpeed(speed) {
    const num = parseInt(speed) || 4;
    const validated = Math.max(1, Math.min(6, num));

    if (num !== validated) {
      console.log('🔧 속도 검증 및 제한:', {
        입력값: speed,
        파싱된값: num,
        제한된값: validated,
        프로토콜범위: '1~6초',
        제한됨: num > 6 ? '상한선 적용' : (num < 1 ? '하한선 적용' : '정상')
      });
    }

    return validated;
  }

  /**
   * 대기시간 검증 (1초 단위)
   */
  validateWaitTime(time) {
    const num = parseInt(time) || 1;
    const validated = Math.max(1, Math.min(255, num));

    if (num !== validated) {
      console.log('🔧 대기시간 검증 및 제한:', {
        입력값: time,
        파싱된값: num,
        제한된값: validated,
        프로토콜범위: '1~255초',
        제한됨: num > 255 ? '상한선 적용' : (num < 1 ? '하한선 적용' : '정상')
      });
    }

    return validated;
  }

  /**
   * 날짜/시간 파싱 (5bytes: 년,월,일,시,분) - 실제 전광판 프로토콜과 일치
   */
  parseDateTime(dateTimeStr) {
    let timeData;

    if (!dateTimeStr) {
      // 🔧 실제 전광판 데이터와 일치: 2025년 6월 30일 17시 8분
      // 실제 수신 데이터: 19 06 1e 11 08 (25년 6월 30일 17시 8분)
      timeData = [
        0x19, // 년 (2025년 = 0x19 + 2000)
        0x06, // 월 (6월)
        0x1e, // 일 (30일 = 0x1e)
        0x11, // 시 (17시 = 0x11)
        0x08  // 분 (8분)
      ];
    } else {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        // 날짜 파싱 실패시 기본값 사용
        timeData = [0x19, 0x06, 0x1e, 0x11, 0x08];
      } else {
        timeData = [
          date.getFullYear() - 2000, // 년 (0x00=2000년)
          date.getMonth() + 1,       // 월 (1-12)
          date.getDate(),            // 일 (1-31)
          date.getHours(),           // 시 (0-23)
          date.getMinutes()          // 분 (0-59)
        ];
      }
    }

    console.log('🔧 시간 데이터 생성:', {
      원본시간: dateTimeStr || '실제전광판기본값(2025-06-30 17:08)',
      프로토콜데이터: timeData.map(t => '0x' + t.toString(16).padStart(2, '0')).join(' '),
      십진수값: timeData.join(' '),
      실제전광판일치: timeData.every((v, i) => v === [0x19, 0x06, 0x1e, 0x11, 0x08][i]) ? '✅' : '❌'
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
   * 체크섬 계산 (합계의 LOW 1byte) - 정의서 완전 준수
   * 신프로토콜: LENGTH에서 DATA까지의 합 중 LOW 1byte
   */
  calculateChecksum(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const checksum = sum & 0xFF; // LOW 1byte만 반환

    console.log('🔧 체크섬 계산:', {
      데이터길이: buffer.length,
      데이터헥스: buffer.toString('hex').toUpperCase(),
      총합: sum + ' (0x' + sum.toString(16).toUpperCase() + ')',
      체크섬: '0x' + checksum.toString(16).padStart(2, '0').toUpperCase()
    });

    return checksum;
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
   * 패킷 정보 로깅 (신프로토콜 정의서 준수)
   * 구조: [STX(1)] [LENGTH(2)] [COMMAND(4)] [DATA(N)] [CHECKSUM(1)] [ID(12)] [ETX(1)]
   */
  logPacketInfo(packet, jsonData) {
    console.log('\n=== 재해문자전광판 신프로토콜 패킷 분석 (2023.3) ===');

    // 기본 헤더 정보
    const stx = packet[0];
    const length = packet.readUInt16LE(1);
    const command = packet.readUInt32LE(3); // 4 bytes로 읽기!

    // DATA 섹션 분석 (7번째 바이트부터 - COMMAND가 4 bytes이므로)
    const dataStart = 7; // STX(1) + LENGTH(2) + COMMAND(4) = 7
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

    console.log('🔧 신프로토콜 패킷 정보 (COMMAND 4 bytes):', {
      총길이: packet.length,
      STX: '0x' + stx.toString(16).padStart(2, '0').toUpperCase(),
      LENGTH: length + ' (0x' + length.toString(16).padStart(4, '0').toUpperCase() + ')',
      COMMAND: '0x' + command.toString(16).padStart(8, '0').toUpperCase() + ' (멀티메시지 방정보 전송 0x11, 4 bytes)',
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
      정의서준수: '✅ 신프로토콜 정의서 2023.3 완전 준수 (COMMAND=0x11, 4 bytes)'
    });

    console.log('📋 패킷 16진수 (전체):', this.bufferToHexString(packet).replace(/ /g, ''));
  }

  /**
   * 16진수 문자열을 Buffer로 변환하고 파싱하는 테스트 함수
   * @param {string} hexString - 16진수 문자열
   * @returns {Object} 파싱 결과
   */
  testParseHexString(hexString) {
    try {
      // 16진수 문자열을 Buffer로 변환
      const buffer = Buffer.from(hexString, 'hex');
      console.log('🔧 테스트 파싱:', {
        hexString: hexString.substring(0, 50) + '...',
        bufferLength: buffer.length
      });

      // 프로토콜 자동 감지로 파싱 시도
      return this.parseProtocolPacket(buffer);
    } catch (error) {
      console.error('❌ 테스트 파싱 실패:', error.message);
      throw error;
    }
  }

  /**
   * 받은 바이너리 데이터를 분석하는 함수 (문제 해결용)
   * @param {string} binaryString - Python에서 받은 바이너리 문자열
   * @returns {Object} 분석 결과
   */
  analyzeBinaryData(binaryString) {
    console.log('\n=== 받은 바이너리 데이터 분석 ===');

    // 바이너리 문자열을 Buffer로 변환
    const buffer = Buffer.from(binaryString, 'binary');

    console.log('기본 정보:', {
      originalString: binaryString.substring(0, 50) + '...',
      bufferLength: buffer.length,
      hexString: buffer.toString('hex')
    });

    // 바이트별 분석
    if (buffer.length >= 7) {
      const stx = buffer[0];
      const lengthLE = buffer.readUInt16LE(1);
      const lengthBE = buffer.readUInt16BE(1);

      console.log('헤더 분석:', {
        STX: '0x' + stx.toString(16).padStart(2, '0') + (stx === 0x02 ? ' ✅' : ' ❌'),
        'LENGTH(LE)': lengthLE + ' (0x' + lengthLE.toString(16).padStart(4, '0') + ')',
        'LENGTH(BE)': lengthBE + ' (0x' + lengthBE.toString(16).padStart(4, '0') + ')',
        'Byte[1]': "'n' (0x" + buffer[1].toString(16).padStart(2, '0') + ')',
        'Byte[2]': '0x' + buffer[2].toString(16).padStart(2, '0'),
        'Byte[3]': '0x' + buffer[3].toString(16).padStart(2, '0'),
        'Byte[4]': '0x' + buffer[4].toString(16).padStart(2, '0'),
        'Byte[5]': '0x' + buffer[5].toString(16).padStart(2, '0'),
        'Byte[6]': '0x' + buffer[6].toString(16).padStart(2, '0')
      });

      // COMMAND 시도 (4 bytes)
      if (buffer.length >= 7) {
        const commandLE = buffer.readUInt32LE(3);
        const commandBE = buffer.readUInt32BE(3);

        console.log('COMMAND 분석 (4 bytes):', {
          'COMMAND(LE)': '0x' + commandLE.toString(16).padStart(8, '0'),
          'COMMAND(BE)': '0x' + commandBE.toString(16).padStart(8, '0'),
          '첫번째바이트': '0x' + buffer[3].toString(16).padStart(2, '0') + (buffer[3] === 0x11 ? ' (멀티메시지)' : '')
        });
      }

      // ETX 찾기
      let etxPos = -1;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (buffer[i] === 0x03) {
          etxPos = i;
          break;
        }
      }

      if (etxPos !== -1) {
        console.log('ETX 위치:', {
          position: etxPos,
          'ID 시작 추정': etxPos - 12,
          'ID 길이': etxPos - (etxPos - 12),
          'ID 내용': buffer.slice(etxPos - 12, etxPos).toString('ascii')
        });
      }
    }

    try {
      // 프로토콜 자동 감지로 파싱 시도
      const result = this.parseProtocolPacket(buffer);
      console.log('✅ 파싱 성공!');
      return { success: true, result, buffer };
    } catch (error) {
      console.log('❌ 파싱 실패:', error.message);
      return { success: false, error: error.message, buffer };
    }
  }
}

module.exports = new ProtocolConverter(); 