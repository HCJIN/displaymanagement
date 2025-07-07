const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const router = express.Router();

// 이미지 저장 디렉토리 설정
const IMAGES_DIR = path.join(__dirname, '../../images');

// 웹서버 설정 (환경변수 사용)
const WEB_SERVER_HOST = process.env.WEB_SERVER_HOST || '192.168.0.58';
const WEB_SERVER_PORT = process.env.WEB_SERVER_PORT || '5002';
const WEB_SERVER_PROTOCOL = process.env.WEB_SERVER_PROTOCOL || 'http';

// 디렉토리가 없으면 생성
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  logger.info('이미지 디렉토리 생성:', IMAGES_DIR);
}

// Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// 이미지 업로드 API
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다.'
      });
    }

    const deviceId = req.body.deviceId || 'unknown';
    const roomNumber = req.body.roomNumber || 'auto';
    const timestamp = Date.now();
    const fileName = `img-${deviceId.slice(-8)}-${roomNumber}-${timestamp.toString().slice(-6)}.png`;
    const filePath = path.join(IMAGES_DIR, fileName);

    // 파일 저장
    fs.writeFileSync(filePath, req.file.buffer);

    const imageUrl = `${WEB_SERVER_PROTOCOL}://${WEB_SERVER_HOST}:${WEB_SERVER_PORT}/api/images/${fileName}`;

    logger.info('이미지 업로드 성공:', {
      fileName,
      size: req.file.size,
      deviceId,
      roomNumber
    });

    res.json({
      success: true,
      imageUrl: imageUrl,
      fileName: fileName,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('이미지 업로드 실패:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드에 실패했습니다.',
      error: error.message
    });
  }
});

// Base64 이미지 저장 API
router.post('/save-base64', (req, res) => {
  try {
    const { base64Data, deviceId, roomNumber, messageType } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'Base64 이미지 데이터가 필요합니다.'
      });
    }

    // Base64 데이터에서 헤더 제거
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Image, 'base64');

    const timestamp = Date.now();
    const fileName = `${messageType || 'text-to-image'}-${deviceId || 'unknown'}-${roomNumber || 'auto'}-${timestamp}.png`;
    const filePath = path.join(IMAGES_DIR, fileName);

    // 파일 저장
    fs.writeFileSync(filePath, imageBuffer);

    const imageUrl = `${WEB_SERVER_PROTOCOL}://${WEB_SERVER_HOST}:${WEB_SERVER_PORT}/api/images/${fileName}`;

    logger.info('Base64 이미지 저장 성공:', {
      fileName,
      size: imageBuffer.length,
      deviceId,
      roomNumber
    });

    res.json({
      success: true,
      imageUrl: imageUrl,
      fileName: fileName,
      size: imageBuffer.length,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Base64 이미지 저장 실패:', error);
    res.status(500).json({
      success: false,
      message: 'Base64 이미지 저장에 실패했습니다.',
      error: error.message
    });
  }
});

// 이미지 제공 API
router.get('/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(IMAGES_DIR, fileName);

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    // MIME 타입 설정
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'image/png';

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.bmp':
        contentType = 'image/bmp';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      default:
        contentType = 'image/png';
    }

    // 파일 전송
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일 캐시
    res.sendFile(filePath);

    logger.debug('이미지 제공:', fileName);

  } catch (error) {
    logger.error('이미지 제공 실패:', error);
    res.status(500).json({
      success: false,
      message: '이미지 제공에 실패했습니다.',
      error: error.message
    });
  }
});

// 이미지 목록 조회 API
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    const imageFiles = files.filter(file =>
      /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(file)
    );

    const images = imageFiles.map(fileName => {
      const filePath = path.join(IMAGES_DIR, fileName);
      const stats = fs.statSync(filePath);

      return {
        fileName,
        imageUrl: `${WEB_SERVER_PROTOCOL}://${WEB_SERVER_HOST}:${WEB_SERVER_PORT}/api/images/${fileName}`,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    });

    res.json({
      success: true,
      images: images,
      total: images.length
    });

  } catch (error) {
    logger.error('이미지 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 이미지 삭제 API
router.delete('/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(IMAGES_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '삭제할 이미지를 찾을 수 없습니다.'
      });
    }

    fs.unlinkSync(filePath);

    logger.info('이미지 삭제 성공:', fileName);

    res.json({
      success: true,
      message: '이미지가 삭제되었습니다.',
      fileName: fileName
    });

  } catch (error) {
    logger.error('이미지 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 