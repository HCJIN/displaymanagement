// src/models/Message.js - 디바이스별 독립 방번호 체계
const { v4: uuidv4 } = require('uuid');

// 메모리 기반 메시지 저장소
let messages = [];

// 메시지 ID 시퀀스
let messageIdSequence = 1;

// 메시지 타입 열거형
const MessageType = {
  TEXT: 'text',           // 텍스트 메시지 (3컬러 전용)
  IMAGE: 'image',         // 이미지 메시지
  MIXED: 'mixed',         // 복합 메시지
  MULTIMEDIA: 'multimedia' // 멀티미디어 메시지 (풀컬러 전용)
};

// 메시지 상태 열거형
const MessageStatus = {
  PENDING: 'pending',     // 전송 대기
  SENDING: 'sending',     // 전송 중
  SENT: 'sent',          // 전송 완료
  ACTIVE: 'active',      // 표시 중
  EXPIRED: 'expired',    // 만료됨
  FAILED: 'failed',      // 전송 실패
  CANCELLED: 'cancelled'  // 취소됨
};

// 우선순위 열거형
const Priority = {
  URGENT: 'URGENT',    // 긴급 (방번호 1-5)
  HIGH: 'HIGH',        // 높음
  NORMAL: 'NORMAL',    // 보통
  LOW: 'LOW'          // 낮음
};

// 🆕 표시효과 열거형 (PDF 프로토콜 기준)
const DisplayEffect = {
  DIRECT: 0x01,           // 바로 표시
  SCROLL_LEFT: 0x02,      // 좌측으로 스크롤
  SCROLL_UP: 0x03,        // 위로 스크롤
  SCROLL_DOWN: 0x04,      // 아래로 스크롤
  LASER: 0x05,            // 레이저 효과
  CENTER_EXPAND: 0x06,    // 중심에서 상하로 벌어짐
  EDGE_CONVERGE: 0x07,    // 상하에서 중심으로 모여듬
  ROTATE_DISPLAY: 0x08,   // 문자 회전 display
  ROTATE_LINE: 0x09,      // 회전 Line display
  ROTATE_CHANGE: 0x0A,    // 문자 회전 change
  ROTATE_LINE_CHANGE: 0x0B, // 회전 Line change
  MOVE_UP_DOWN_1: 0x0C,   // 문자 위아래로 이동1
  MOVE_UP_DOWN_2: 0x0D,   // 문자 위아래로 이동2
  REVERSE_SLOW: 0x0E,     // 역상 큰 상태에서 표시 (느리게)
  REVERSE_FAST: 0x0F,     // 역상 큰 상태에서 (빠르게)
  CURRENT_TIME: 0x10,     // 현재시간 표시
  SCROLL_ALL_LEFT: 0x11   // 왼쪽으로 모두 스크롤
};

// 🆕 완료효과 열거형
const EndEffect = {
  DIRECT_DISAPPEAR: 0x05, // 바로 사라짐
  SCROLL_LEFT: 0x07,      // 좌측으로 스크롤
  SCROLL_UP: 0x01,        // 위로 스크롤
  SCROLL_DOWN: 0x02,      // 아래로 스크롤
  CENTER_EXPAND: 0x03,    // 중심에서 상하로 벌어짐
  EDGE_CONVERGE: 0x04,    // 상하에서 중심으로 모여듬
  ROTATE_DISAPPEAR: 0x06, // 문자회전하며 사라짐
  SCREEN_REVERSE: 0x08,   // 화면 반전
  EXPAND_HORIZONTAL: 0x09, // 좌우로 확대되면서 사라짐
  SHRINK_CENTER: 0x0A,    // 중심으로 축소되면서 사라짐
  EXPAND_REVERSE: 0x0B    // 좌우역상으로 확대되면서 사라짐
};

// 🆕 프로토콜 명령어 열거형
const ProtocolCommand = {
  CONNECT: 0x10,          // ID 접속
  SEND_TEXT: 0x01,        // 문구전송 (3컬러전용)
  REQUEST_ROOM_INFO: 0x02, // 방정보요구 (3컬러전용)
  TIME_SYNC: 0x03,        // 시간전송
  DELETE_ALL: 0x04,       // 전체삭제
  DELETE_ROOM: 0x07,      // 방정보삭제
  ERROR_RESPONSE: 0x08,   // 수신정보이상회신
  BRIGHTNESS_CONTROL: 0x0C, // 휘도조절
  CHECK_EXTERNAL_MSG: 0x0D, // 서버외변경메시지확인
  ENVIRONMENT_CONTROL: 0x0E, // 환경감시기동작제어
  ENVIRONMENT_STATUS: 0x0E,  // 환경감시기상태요구
  MULTIMEDIA_ROOM_INFO: 0x10, // 멀티메시지방정보전송
  MULTIMEDIA_SPLIT_REQUEST: 0x11, // 멀티메시지분할전송요청
  MULTIMEDIA_SPLIT_RESPONSE: 0x12, // 멀티메시지분할전송요청응답
  MULTIMEDIA_SPLIT_COMPLETE: 0x13, // 멀티메시지분할전송완료
  MULTIMEDIA_DELETE_ROOM: 0x14,   // 방정보삭제
  MULTIMEDIA_DELETE_ALL: 0x15,    // 전체삭제
  NIGHT_TIME_SETTING: 0xD1        // 야간시간및동작시간설정
};

class Message {
  constructor(messageData) {
    this.id = messageData.id || `msg_${Date.now()}_${messageIdSequence++}`;
    this.deviceId = messageData.deviceId;
    this.type = messageData.type || MessageType.TEXT;
    this.priority = messageData.priority || Priority.NORMAL;
    this.urgent = messageData.urgent || false;

    console.log('🔧 Message 생성자 - 방번호 처리:', {
      messageId: this.id,
      deviceId: this.deviceId,
      입력받은방번호: messageData.roomNumber,
      긴급여부: messageData.urgent,
      방번호제공여부: !!messageData.roomNumber
    });

    // 🔧 방번호 관리 - 이미 방번호가 제공된 경우 그대로 사용
    if (messageData.roomNumber) {
      this.roomNumber = messageData.roomNumber;
      console.log(`🔧 Message 생성자 - 제공된 방번호 사용: ${this.roomNumber}`);
    } else {
      this.roomNumber = this.assignRoomNumber(messageData.deviceId, messageData.urgent);
      console.log(`🔧 Message 생성자 - 자동 할당된 방번호: ${this.roomNumber}`);
    }

    // 메시지 내용
    this.content = messageData.content || '';
    this.imageData = messageData.imageData || null;
    this.components = messageData.components || []; // 복합 메시지용

    // 🆕 표시 옵션 (프로토콜 기준)
    this.displayOptions = {
      // 기본 표시 설정
      fontSize: 12,
      color: '#FFFFFF',
      backgroundColor: '#000000',
      blink: false,
      scrollType: 'horizontal',
      scrollSpeed: 'normal',
      position: 'center',

      // 🆕 프로토콜 표시효과
      displayEffect: DisplayEffect.DIRECT,        // 표시효과
      displayEffectSpeed: 0x04,                   // 표시효과속도 (1~8, 1이 가장 빠름)
      displayWaitTime: 1,                         // 표시효과 완료 후 대기시간 (초)
      endEffect: EndEffect.DIRECT_DISAPPEAR,      // 완료효과
      endEffectSpeed: 0x04,                       // 완료효과속도 (1~8, 1이 가장 빠름)

      // 🆕 싸이렌 출력
      sirenOutput: false,                         // 싸이렌 출력 여부 (T=0x54, F=0x46)

      ...messageData.displayOptions
    };

    // 🆕 스케줄링 (프로토콜 시간 형식)
    this.schedule = {
      startTime: null,      // 표시 시작시간
      endTime: null,        // 표시 완료시간
      repeatCount: 1,
      repeatInterval: 0,    // 초
      duration: 10,         // 표시 시간 (초)
      ...messageData.schedule
    };

    // 상태 정보
    this.status = messageData.status || MessageStatus.PENDING;
    this.error = messageData.error || null;
    this.sendAttempts = messageData.sendAttempts || 0;
    this.maxAttempts = messageData.maxAttempts || 3;

    // 메타데이터
    this.createdBy = messageData.createdBy;
    this.createdAt = messageData.createdAt || new Date();
    this.updatedAt = messageData.updatedAt || new Date();
    this.sentAt = messageData.sentAt || null;
    this.completedAt = messageData.completedAt || null;

    // 통계
    this.stats = {
      viewCount: 0,
      displayDuration: 0, // 실제 표시된 시간 (초)
      ...messageData.stats
    };
  }

  // 🔧 방번호 자동 할당 (디바이스별 독립)
  assignRoomNumber(deviceId, isUrgent = false) {
    if (!deviceId) {
      console.error('디바이스 ID가 필요합니다.');
      return isUrgent ? 1 : 6;
    }

    // 🔧 해당 디바이스의 사용 중인 방번호만 조회
    const deviceMessages = messages.filter(msg =>
      msg.deviceId === deviceId &&
      msg.roomNumber &&
      ['pending', 'sending', 'sent', 'active'].includes(msg.status)
    );

    const usedRooms = new Set(deviceMessages.map(msg => msg.roomNumber).filter(Boolean));

    console.log(`🔧 방번호 할당 - 디바이스: ${deviceId}, 긴급: ${isUrgent}, 사용중인 방: [${Array.from(usedRooms).sort((a, b) => a - b).join(', ')}]`);

    if (isUrgent) {
      // 긴급 메시지는 1~5번 방 사용 (해당 디바이스 내에서만)
      for (let i = 1; i <= 5; i++) {
        if (!usedRooms.has(i)) {
          console.log(`🔧 긴급 방번호 할당: ${i}`);
          return i;
        }
      }
      // 긴급 방이 모두 사용중이면 1번 방 강제 사용 (덮어쓰기)
      console.log(`🔧 긴급 방번호 강제 할당: 1 (덮어쓰기)`);
      return 1;
    } else {
      // 일반 메시지는 6~100번 방 사용 (해당 디바이스 내에서만)
      for (let i = 6; i <= 100; i++) {
        if (!usedRooms.has(i)) {
          console.log(`🔧 일반 방번호 할당: ${i}`);
          return i;
        }
      }
      // 모든 방이 사용중이면 6번 방 강제 사용 (가장 오래된 메시지 덮어쓰기)
      console.log(`🔧 일반 방번호 강제 할당: 6 (덮어쓰기)`);
      return 6;
    }
  }

  // 🆕 프로토콜 시간 변환 (년도는 2000년 기준)
  formatProtocolTime(date) {
    if (!date) return null;

    const d = new Date(date);
    return {
      year: d.getFullYear() - 2000,  // 0x00 = 2000년
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes()
    };
  }

  // 메시지 상태 업데이트
  updateStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.updatedAt = new Date();

    if (status === MessageStatus.SENT) {
      this.sentAt = new Date();
    } else if (status === MessageStatus.EXPIRED || status === MessageStatus.CANCELLED) {
      this.completedAt = new Date();
    }

    return this.save();
  }

  // 전송 시도 기록
  recordSendAttempt(success = false, error = null) {
    this.sendAttempts += 1;
    this.updatedAt = new Date();

    if (success) {
      this.updateStatus(MessageStatus.SENT);
    } else {
      this.error = error;
      if (this.sendAttempts >= this.maxAttempts) {
        this.updateStatus(MessageStatus.FAILED, error);
      }
    }

    return this.save();
  }

  // 메시지 만료 확인
  isExpired() {
    if (!this.schedule.endTime) return false;

    const now = new Date();
    const endTime = new Date(this.schedule.endTime);
    return now > endTime;
  }

  // 메시지 활성 시간 확인
  isActiveTime() {
    const now = new Date();

    if (this.schedule.startTime) {
      const startTime = new Date(this.schedule.startTime);
      if (now < startTime) return false;
    }

    if (this.schedule.endTime) {
      const endTime = new Date(this.schedule.endTime);
      if (now > endTime) return false;
    }

    return true;
  }

  // 메시지 크기 계산 (바이트)
  getSize() {
    let size = 0;

    // 텍스트 크기
    if (this.content) {
      size += Buffer.byteLength(this.content, 'utf8');
    }

    // 이미지 크기
    if (this.imageData && this.imageData.base64) {
      size += Buffer.byteLength(this.imageData.base64, 'base64');
    }

    // 복합 메시지 크기
    if (this.components && this.components.length > 0) {
      this.components.forEach(component => {
        if (component.type === 'text' && component.content) {
          size += Buffer.byteLength(component.content, 'utf8');
        } else if (component.type === 'image' && component.data) {
          size += Buffer.byteLength(component.data, 'base64');
        }
      });
    }

    return size;
  }

  // 메시지 유효성 검증
  validate() {
    const errors = [];

    // 필수 필드 확인
    if (!this.deviceId) {
      errors.push('디바이스 ID가 필요합니다.');
    }

    if (!this.type || !Object.values(MessageType).includes(this.type)) {
      errors.push('유효한 메시지 타입이 필요합니다.');
    }

    // 🆕 방번호 유효성 검증
    if (!this.roomNumber || this.roomNumber < 1 || this.roomNumber > 100) {
      errors.push('방번호는 1~100 사이여야 합니다.');
    }

    // 긴급 메시지 방번호 검증
    if (this.urgent && (this.roomNumber < 1 || this.roomNumber > 5)) {
      errors.push('긴급 메시지는 1~5번 방을 사용해야 합니다.');
    }

    // 타입별 유효성 검증
    if (this.type === MessageType.TEXT && !this.content) {
      errors.push('텍스트 메시지는 내용이 필요합니다.');
    }

    if (this.type === MessageType.IMAGE && !this.imageData) {
      errors.push('이미지 메시지는 이미지 데이터가 필요합니다.');
    }

    if (this.type === MessageType.MIXED && (!this.components || this.components.length === 0)) {
      errors.push('복합 메시지는 컴포넌트가 필요합니다.');
    }

    // 크기 제한 확인 (5MB)
    if (this.getSize() > 5242880) {
      errors.push('메시지 크기가 제한을 초과했습니다. (최대 5MB)');
    }

    // 스케줄 유효성 확인
    if (this.schedule.startTime && this.schedule.endTime) {
      const startTime = new Date(this.schedule.startTime);
      const endTime = new Date(this.schedule.endTime);
      if (startTime >= endTime) {
        errors.push('종료 시간이 시작 시간보다 늦어야 합니다.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 🆕 전광판 프로토콜용 명령 생성 (PDF 프로토콜 기준)
  toDisplayCommand() {
    const startTime = this.formatProtocolTime(this.schedule.startTime);
    const endTime = this.formatProtocolTime(this.schedule.endTime);

    const baseCommand = {
      device_id: this.deviceId,
      message_id: this.id,
      room_number: this.roomNumber,
      priority: this.priority,
      urgent: this.urgent
    };

    switch (this.type) {
      case MessageType.TEXT:
        // 3컬러 전용 텍스트 메시지 (명령어 0x01)
        return {
          cmd: ProtocolCommand.SEND_TEXT,
          room_number: this.roomNumber,
          display_effect: this.displayOptions.displayEffect,
          display_effect_speed: this.displayOptions.displayEffectSpeed,
          display_wait_time: this.displayOptions.displayWaitTime,
          end_effect: this.displayOptions.endEffect,
          end_effect_speed: this.displayOptions.endEffectSpeed,
          start_time: startTime,
          end_time: endTime,
          siren_output: this.displayOptions.sirenOutput ? 0x54 : 0x46, // T/F
          message: this.content + '\0', // null 종료
          ...baseCommand
        };

      case MessageType.IMAGE:
      case MessageType.MULTIMEDIA:
        // 멀티미디어 메시지 (명령어 0x10)
        return {
          cmd: ProtocolCommand.MULTIMEDIA_ROOM_INFO,
          room_number: this.roomNumber,
          display_effect: this.displayOptions.displayEffect,
          display_effect_speed: this.displayOptions.displayEffectSpeed,
          display_wait_time: this.displayOptions.displayWaitTime,
          end_effect: this.displayOptions.endEffect,
          end_effect_speed: this.displayOptions.endEffectSpeed,
          start_time: startTime,
          end_time: endTime,
          siren_output: this.displayOptions.sirenOutput ? 0x54 : 0x46,
          multimedia_type: this.type === MessageType.IMAGE ? 1 : 2, // 1=이미지, 2=동영상
          multimedia_serial: Date.now(), // 일련번호
          multimedia_size: this.getSize(),
          image_data: this.imageData,
          ...baseCommand
        };

      case MessageType.MIXED:
        return {
          cmd: ProtocolCommand.MULTIMEDIA_ROOM_INFO,
          room_number: this.roomNumber,
          components: this.components,
          display_effect: this.displayOptions.displayEffect,
          display_effect_speed: this.displayOptions.displayEffectSpeed,
          start_time: startTime,
          end_time: endTime,
          siren_output: this.displayOptions.sirenOutput ? 0x54 : 0x46,
          ...baseCommand
        };

      default:
        throw new Error(`지원하지 않는 메시지 타입: ${this.type}`);
    }
  }

  // 🆕 방정보 요구 명령 생성
  createRoomInfoRequest() {
    return {
      cmd: ProtocolCommand.REQUEST_ROOM_INFO,
      device_id: this.deviceId,
      room_number: this.roomNumber
    };
  }

  // 🆕 방정보 삭제 명령 생성
  createRoomDeleteCommand() {
    return {
      cmd: ProtocolCommand.DELETE_ROOM,
      device_id: this.deviceId,
      room_number: this.roomNumber
    };
  }

  // 저장
  save() {
    const index = messages.findIndex(message => message.id === this.id);
    if (index !== -1) {
      messages[index] = this.toObject();
    } else {
      messages.push(this.toObject());
    }
    return this;
  }

  // 객체 변환
  toObject() {
    return { ...this };
  }

  // JSON 변환
  toJSON() {
    return this.toObject();
  }

  // 정적 메서드들
  static findAll(options = {}) {
    let result = messages.map(messageData => new Message(messageData));

    // 필터링
    if (options.deviceId) {
      result = result.filter(message => message.deviceId === options.deviceId);
    }

    if (options.roomNumber) {
      result = result.filter(message => message.roomNumber === options.roomNumber);
    }

    if (options.status) {
      if (Array.isArray(options.status)) {
        result = result.filter(message => options.status.includes(message.status));
      } else {
        result = result.filter(message => message.status === options.status);
      }
    }

    if (options.type) {
      result = result.filter(message => message.type === options.type);
    }

    if (options.priority) {
      result = result.filter(message => message.priority === options.priority);
    }

    if (options.createdBy) {
      result = result.filter(message => message.createdBy === options.createdBy);
    }

    // 날짜 범위 필터
    if (options.startDate) {
      const startDate = new Date(options.startDate);
      result = result.filter(message => new Date(message.createdAt) >= startDate);
    }

    if (options.endDate) {
      const endDate = new Date(options.endDate);
      result = result.filter(message => new Date(message.createdAt) <= endDate);
    }

    // 정렬
    if (options.sortBy) {
      result.sort((a, b) => {
        let aVal = a[options.sortBy];
        let bVal = b[options.sortBy];

        // 날짜 필드 처리
        if (options.sortBy.includes('At') || options.sortBy.includes('Time')) {
          aVal = aVal ? new Date(aVal) : new Date(0);
          bVal = bVal ? new Date(bVal) : new Date(0);
        }

        if (options.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    } else {
      // 기본 정렬: 생성일 내림차순
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 페이지네이션
    if (options.page && options.limit) {
      const start = (options.page - 1) * options.limit;
      result = result.slice(start, start + options.limit);
    }

    return result;
  }

  static findById(id) {
    const messageData = messages.find(message => message.id === id);
    return messageData ? new Message(messageData) : null;
  }

  static findByDeviceId(deviceId, options = {}) {
    return Message.findAll({ ...options, deviceId });
  }

  // 🆕 방번호로 메시지 조회 (디바이스별)
  static findByRoomNumber(deviceId, roomNumber) {
    return messages
      .filter(messageData =>
        messageData.deviceId === deviceId &&
        messageData.roomNumber === roomNumber
      )
      .map(messageData => new Message(messageData));
  }

  // 🔧 사용 중인 방번호 목록 조회 (디바이스별 독립)
  static getUsedRoomNumbers(deviceId) {
    const deviceMessages = messages.filter(messageData =>
      messageData.deviceId === deviceId &&
      ['pending', 'sending', 'sent', 'active'].includes(messageData.status) &&
      messageData.roomNumber != null
    );

    // 🔧 Set을 사용한 중복 제거
    const usedRoomsSet = new Set();
    deviceMessages.forEach(msg => {
      const roomNum = parseInt(msg.roomNumber);
      if (!isNaN(roomNum) && roomNum >= 1 && roomNum <= 100) {
        usedRoomsSet.add(roomNum);
      }
    });

    const usedRooms = Array.from(usedRoomsSet).sort((a, b) => a - b);

    console.log(`🔧 사용중인 방번호 조회 - 디바이스: ${deviceId}, 방번호: [${usedRooms.join(', ')}]`);

    return usedRooms;
  }

  static create(messageData) {
    const message = new Message(messageData);

    // 유효성 검증
    const validation = message.validate();
    if (!validation.isValid) {
      throw new Error(`메시지 유효성 검증 실패: ${validation.errors.join(', ')}`);
    }

    return message.save();
  }

  static update(id, updateData) {
    const message = Message.findById(id);
    if (!message) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    // 허용된 필드만 업데이트
    const allowedFields = ['content', 'imageData', 'components', 'displayOptions', 'schedule', 'status', 'roomNumber'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (typeof message[field] === 'object' && message[field] !== null) {
          message[field] = { ...message[field], ...updateData[field] };
        } else {
          message[field] = updateData[field];
        }
      }
    });

    message.updatedAt = new Date();
    return message.save();
  }

  static delete(id) {
    const index = messages.findIndex(message => message.id === id);
    if (index === -1) {
      throw new Error('메시지를 찾을 수 없습니다.');
    }

    messages.splice(index, 1);
    return true;
  }

  // 🔧 방번호로 메시지 삭제 (디바이스별)
  static deleteByRoomNumber(deviceId, roomNumber) {
    const messagesToDelete = messages.filter(messageData =>
      messageData.deviceId === deviceId &&
      messageData.roomNumber === roomNumber
    );

    messagesToDelete.forEach(messageData => {
      Message.delete(messageData.id);
    });

    console.log(`🔧 방번호별 메시지 삭제 - 디바이스: ${deviceId}, 방번호: ${roomNumber}, 삭제된 메시지: ${messagesToDelete.length}개`);

    return messagesToDelete.length;
  }

  static count(options = {}) {
    return Message.findAll(options).length;
  }

  // 만료된 메시지 정리
  static cleanupExpiredMessages() {
    const expiredMessages = [];

    messages.forEach(messageData => {
      const message = new Message(messageData);
      if (message.isExpired() && message.status === MessageStatus.ACTIVE) {
        message.updateStatus(MessageStatus.EXPIRED);
        expiredMessages.push(message.id);
      }
    });

    return expiredMessages;
  }

  // 활성 메시지 조회
  static getActiveMessages(deviceId = null) {
    const options = {
      status: [MessageStatus.ACTIVE, MessageStatus.SENT]
    };

    if (deviceId) {
      options.deviceId = deviceId;
    }

    return Message.findAll(options).filter(message =>
      message.isActiveTime() && !message.isExpired()
    );
  }

  // 🔧 통계 정보 (디바이스별 방번호 통계 개선)
  static getStats(deviceId = null) {
    const allMessages = deviceId ? Message.findByDeviceId(deviceId) : Message.findAll();

    const total = allMessages.length;
    const byStatus = allMessages.reduce((acc, message) => {
      acc[message.status] = (acc[message.status] || 0) + 1;
      return acc;
    }, {});

    const byType = allMessages.reduce((acc, message) => {
      acc[message.type] = (acc[message.type] || 0) + 1;
      return acc;
    }, {});

    const byPriority = allMessages.reduce((acc, message) => {
      acc[message.priority] = (acc[message.priority] || 0) + 1;
      return acc;
    }, {});

    // 🔧 방번호별 통계 (디바이스별로 독립적으로 계산)
    const byRoomNumber = allMessages.reduce((acc, message) => {
      if (message.roomNumber) {
        acc[message.roomNumber] = (acc[message.roomNumber] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      total,
      byStatus,
      byType,
      byPriority,
      byRoomNumber,
      active: Message.getActiveMessages(deviceId).length
    };
  }

  // 🆕 디바이스별 방번호 사용 현황 상세 조회
  static getDeviceRoomStatus(deviceId) {
    const deviceMessages = messages.filter(msg =>
      msg.deviceId === deviceId &&
      msg.roomNumber != null &&
      ['pending', 'sending', 'sent', 'active'].includes(msg.status)
    );

    const usedRooms = new Set();
    const roomDetails = {};

    deviceMessages.forEach(msg => {
      const roomNum = parseInt(msg.roomNumber);
      if (!isNaN(roomNum) && roomNum >= 1 && roomNum <= 100) {
        usedRooms.add(roomNum);

        if (!roomDetails[roomNum]) {
          roomDetails[roomNum] = {
            roomNumber: roomNum,
            messages: [],
            isUrgent: roomNum <= 5,
            lastUpdate: null
          };
        }

        roomDetails[roomNum].messages.push({
          id: msg.id,
          content: msg.content?.substring(0, 50) + (msg.content?.length > 50 ? '...' : ''),
          status: msg.status,
          createdAt: msg.createdAt,
          urgent: msg.urgent
        });

        // 최신 메시지 시간 업데이트
        if (!roomDetails[roomNum].lastUpdate || new Date(msg.createdAt) > new Date(roomDetails[roomNum].lastUpdate)) {
          roomDetails[roomNum].lastUpdate = msg.createdAt;
        }
      }
    });

    const availableRooms = [];
    for (let i = 1; i <= 100; i++) {
      if (!usedRooms.has(i)) {
        availableRooms.push(i);
      }
    }

    return {
      deviceId,
      totalRooms: 100,
      usedRooms: Array.from(usedRooms).sort((a, b) => a - b),
      availableRooms: {
        urgent: availableRooms.filter(r => r >= 1 && r <= 5),
        normal: availableRooms.filter(r => r >= 6 && r <= 100)
      },
      roomDetails,
      summary: {
        usedCount: usedRooms.size,
        availableCount: 100 - usedRooms.size,
        urgentUsed: Array.from(usedRooms).filter(r => r <= 5).length,
        normalUsed: Array.from(usedRooms).filter(r => r > 5).length
      }
    };
  }
}

// 상수 내보내기
Message.Type = MessageType;
Message.Status = MessageStatus;
Message.Priority = Priority;
Message.DisplayEffect = DisplayEffect;
Message.EndEffect = EndEffect;
Message.ProtocolCommand = ProtocolCommand;

module.exports = Message;