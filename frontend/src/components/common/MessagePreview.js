// MessagePreview.js - 표시효과가 포함된 미리보기 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  Speed,
  Info,
} from '@mui/icons-material';

// 표시효과 이름 매핑
const DISPLAY_EFFECTS = {
  0x01: { name: '바로 표시', duration: 0 },
  0x02: { name: '좌측으로 스크롤', duration: 2000 },
  0x03: { name: '위로 스크롤', duration: 2000 },
  0x04: { name: '아래로 스크롤', duration: 2000 },
  0x05: { name: '레이저 효과', duration: 1500 },
  0x06: { name: '중심에서 상하로 벌어짐', duration: 1500 },
  0x07: { name: '상하에서 중심으로 모여듬', duration: 1500 },
  0x08: { name: '문자 회전 표시', duration: 2000 },
  0x09: { name: '회전 라인 표시', duration: 2000 },
  0x0A: { name: '문자 회전 변경', duration: 2000 },
  0x0B: { name: '회전 라인 변경', duration: 2000 },
  0x0C: { name: '문자 위아래 이동1', duration: 2000 },
  0x0D: { name: '문자 위아래 이동2', duration: 2000 },
  0x0E: { name: '역상 표시 (느리게)', duration: 3000 },
  0x0F: { name: '역상 표시 (빠르게)', duration: 1000 },
  0x10: { name: '현재시간 표시', duration: 1000 },
  0x11: { name: '왼쪽으로 모두 스크롤', duration: 3000 },
};

const END_EFFECTS = {
  0x01: { name: '위로 스크롤', duration: 1500 },
  0x02: { name: '아래로 스크롤', duration: 1500 },
  0x03: { name: '중심에서 상하로 벌어짐', duration: 1500 },
  0x04: { name: '상하에서 중심으로 모여듬', duration: 1500 },
  0x05: { name: '바로 사라짐', duration: 0 },
  0x06: { name: '문자회전하며 사라짐', duration: 1500 },
  0x07: { name: '좌측으로 스크롤', duration: 1500 },
  0x08: { name: '화면 반전', duration: 1000 },
  0x09: { name: '좌우로 확대되면서 사라짐', duration: 1500 },
  0x0A: { name: '중심으로 축소되면서 사라짐', duration: 1500 },
  0x0B: { name: '좌우역상으로 확대되면서 사라짐', duration: 1500 },
};

const MessagePreview = ({
  content,
  displayOptions = {},
  schedule = {},
  deviceResolution = { width: 1920, height: 1080 },
  autoPlay = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('idle'); // idle, entering, displaying, exiting
  const [progress, setProgress] = useState(0);
  const textRef = useRef(null);
  const containerRef = useRef(null);

  // 효과 속도 계산 (1=빠름, 8=느림)
  const getSpeedMultiplier = (speed) => {
    return 9 - (speed || 4); // 1->8, 8->1로 변환
  };

  // 표시효과별 애니메이션 스타일 생성
  const getDisplayEffectAnimation = () => {
    const effect = displayOptions.displayEffect || 0x01;
    const speed = getSpeedMultiplier(displayOptions.displayEffectSpeed || 4);
    const duration = (DISPLAY_EFFECTS[effect]?.duration || 1000) / speed;

    const animations = {
      0x01: 'displayDirect', // 바로 표시
      0x02: 'displayScrollLeft', // 좌측으로 스크롤
      0x03: 'displayScrollUp', // 위로 스크롤
      0x04: 'displayScrollDown', // 아래로 스크롤
      0x05: 'displayLaser', // 레이저 효과
      0x06: 'displayCenterExpand', // 중심에서 상하로 벌어짐
      0x07: 'displayEdgeConverge', // 상하에서 중심으로 모여듬
      0x08: 'displayRotate', // 문자 회전
      0x09: 'displayRotateLine', // 회전 라인
      0x0A: 'displayRotateChange', // 문자 회전 변경
      0x0B: 'displayRotateLineChange', // 회전 라인 변경
      0x0C: 'displayMoveUpDown1', // 위아래 이동1
      0x0D: 'displayMoveUpDown2', // 위아래 이동2
      0x0E: 'displayReverseSlow', // 역상 느리게
      0x0F: 'displayReverseFast', // 역상 빠르게
      0x10: 'displayCurrentTime', // 현재시간
      0x11: 'displayScrollAllLeft', // 전체 좌측 스크롤
    };

    return {
      animation: animations[effect] || 'displayDirect',
      duration: `${duration}ms`,
      effect,
      effectName: DISPLAY_EFFECTS[effect]?.name || '바로 표시'
    };
  };

  // 완료효과별 애니메이션 스타일 생성
  const getEndEffectAnimation = () => {
    const effect = displayOptions.endEffect || 0x05;
    const speed = getSpeedMultiplier(displayOptions.endEffectSpeed || 4);
    const duration = (END_EFFECTS[effect]?.duration || 1000) / speed;

    const animations = {
      0x01: 'endScrollUp', // 위로 스크롤
      0x02: 'endScrollDown', // 아래로 스크롤
      0x03: 'endCenterExpand', // 중심에서 상하로 벌어짐
      0x04: 'endEdgeConverge', // 상하에서 중심으로 모여듬
      0x05: 'endDirect', // 바로 사라짐
      0x06: 'endRotateDisappear', // 문자회전하며 사라짐
      0x07: 'endScrollLeft', // 좌측으로 스크롤
      0x08: 'endScreenReverse', // 화면 반전
      0x09: 'endExpandHorizontal', // 좌우로 확대
      0x0A: 'endShrinkCenter', // 중심으로 축소
      0x0B: 'endExpandReverse', // 좌우역상으로 확대
    };

    return {
      animation: animations[effect] || 'endDirect',
      duration: `${duration}ms`,
      effect,
      effectName: END_EFFECTS[effect]?.name || '바로 사라짐'
    };
  };

  // 미리보기 스타일 계산 (실제 이미지 변환과 일치시킴)
  const getPreviewStyle = () => {
    const resolution = deviceResolution;
    const aspectRatio = resolution.width / resolution.height;

    // 🔧 실제 전광판 비율에 맞는 미리보기 크기 설정
    let baseWidth, baseHeight;
    if (aspectRatio > 3) {
      baseWidth = 720;
      baseHeight = 240;
    } else if (aspectRatio > 2) {
      baseWidth = 600;
      baseHeight = 300;
    } else if (aspectRatio > 1.5) {
      baseWidth = 560;
      baseHeight = 315;
    } else {
      baseWidth = 400;
      baseHeight = 400;
    }

    // 🔧 간단한 폰트 크기 계산
    const userFontSize = displayOptions.fontSize || 16;
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const maxLines = Math.max(lines.length, 1);

    // 실제 전광판 해상도 기준으로 비례 계산
    const baseScale = Math.min(baseWidth / resolution.width, baseHeight / resolution.height);
    let calculatedFontSize = userFontSize * baseScale;

    // 🔧 폰트 크기 변화가 잘 보이도록 제한 완화
    const maxByHeight = baseHeight / maxLines * 0.8; // 0.6 → 0.8로 증가
    const longestLine = lines.reduce((max, line) => line.length > max.length ? line : max, '');
    const maxByWidth = longestLine.length > 0 ? baseWidth / longestLine.length * 1.2 : calculatedFontSize; // 0.8 → 1.2로 증가

    // 🔧 폰트 크기 변화가 더 잘 보이도록 제한 로직 수정
    const minUserSize = userFontSize * baseScale * 0.3; // 사용자 크기의 최소 30%는 보장
    const maxSize = Math.max(maxByHeight, maxByWidth, minUserSize); // 가장 큰 값을 기준으로

    calculatedFontSize = Math.min(calculatedFontSize, maxSize);
    calculatedFontSize = Math.max(calculatedFontSize, 12);

    return {
      width: `${baseWidth}px`,
      height: `${baseHeight}px`,
      maxHeight: '500px', // 약간 더 큰 최대 높이
      bgcolor: displayOptions.backgroundColor || '#000000',
      color: displayOptions.color || '#FFFFFF',
      fontSize: `${calculatedFontSize}px`,
      textAlign: displayOptions.position || 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '3px solid #333',
      borderRadius: 2,
      overflow: 'hidden',
      position: 'relative',
      boxSizing: 'border-box',
      fontWeight: 'bold', // 🔧 실제 변환과 동일한 굵은 폰트
      fontFamily: '"Malgun Gothic", "맑은 고딕", Arial, sans-serif', // 🔧 동일한 폰트 패밀리
    };
  };

  // 텍스트 스타일 계산
  const getTextStyle = () => {
    const displayAnim = getDisplayEffectAnimation();
    const endAnim = getEndEffectAnimation();

    let animationName = 'none';
    let animationDuration = '0s';
    let animationTimingFunction = 'ease-in-out';
    let animationFillMode = 'both';

    if (currentPhase === 'entering') {
      animationName = displayAnim.animation;
      animationDuration = displayAnim.duration;
    } else if (currentPhase === 'exiting') {
      animationName = endAnim.animation;
      animationDuration = endAnim.duration;
    } else if (currentPhase === 'displaying') {
      // 표시 중 효과 (깜빡임 등)
      if (displayOptions.blink) {
        animationName = 'blinkEffect';
        animationDuration = '1s';
        animationTimingFunction = 'ease-in-out';
        animationFillMode = 'infinite';
      }
    }

    return {
      animation: `${animationName} ${animationDuration} ${animationTimingFunction} ${animationFillMode}`,
      padding: '10px', // 🔧 실제 변환과 동일한 패딩
      wordBreak: 'break-word',
      lineHeight: 1.0, // 🔧 실제 변환과 동일한 줄 간격
      whiteSpace: 'pre-wrap',
      position: 'relative',
      zIndex: 1,
    };
  };

  // 애니메이션 시퀀스 실행
  const playAnimation = async () => {
    if (!content.trim()) return;

    setIsPlaying(true);
    setProgress(0);

    const displayAnim = getDisplayEffectAnimation();
    const endAnim = getEndEffectAnimation();
    const waitTime = (displayOptions.displayWaitTime || 1) * 1000;
    const displayTime = (schedule.duration || 5) * 1000;

    try {
      // 1. 표시 효과
      setCurrentPhase('entering');
      await new Promise(resolve => {
        const duration = parseInt(displayAnim.duration);
        if (duration > 0) {
          setTimeout(resolve, duration);
        } else {
          resolve();
        }
      });

      // 2. 대기 시간
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // 3. 표시 중 (깜빡임 등)
      setCurrentPhase('displaying');

      // 진행률 업데이트
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + (100 / (displayTime / 100));
        });
      }, 100);

      await new Promise(resolve => setTimeout(resolve, displayTime));
      clearInterval(progressInterval);

      // 4. 완료 효과
      setCurrentPhase('exiting');
      await new Promise(resolve => {
        const duration = parseInt(endAnim.duration);
        if (duration > 0) {
          setTimeout(resolve, duration);
        } else {
          resolve();
        }
      });

      // 5. 완료
      setCurrentPhase('idle');
      setProgress(0);
    } catch (error) {
      console.error('애니메이션 재생 오류:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  // 애니메이션 중지
  const stopAnimation = () => {
    setIsPlaying(false);
    setCurrentPhase('idle');
    setProgress(0);
  };

  // 자동 재생
  useEffect(() => {
    if (autoPlay && content.trim()) {
      const timer = setTimeout(() => {
        playAnimation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, content, displayOptions, schedule]);

  const displayAnim = getDisplayEffectAnimation();
  const endAnim = getEndEffectAnimation();

  return (
    <Box>
      {/* 미리보기 화면 */}
      <Paper ref={containerRef} sx={getPreviewStyle()}>
        {content.trim() ? (
          <Typography ref={textRef} sx={getTextStyle()}>
            {displayOptions.displayEffect === 0x10 ?
              new Date().toLocaleTimeString() : // 현재시간 표시
              content
            }
          </Typography>
        ) : (
          <Typography color="textSecondary" sx={{ opacity: 0.5 }}>
            미리보기할 내용이 없습니다.
          </Typography>
        )}

        {/* 싸이렌 효과 표시 */}
        {displayOptions.sirenOutput && currentPhase === 'entering' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'red',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: '12px',
              animation: 'pulse 0.5s infinite',
              zIndex: 10,
            }}
          >
            🚨 SIREN
          </Box>
        )}

        {/* 진행률 표시 */}
        {isPlaying && currentPhase === 'displaying' && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
            }}
          />
        )}
      </Paper>

      {/* 컨트롤 패널 */}
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <Button
            variant={isPlaying ? "outlined" : "contained"}
            startIcon={isPlaying ? <Pause /> : <PlayArrow />}
            onClick={isPlaying ? stopAnimation : playAnimation}
            disabled={!content.trim()}
            size="small"
          >
            {isPlaying ? '중지' : '재생'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              stopAnimation();
              setTimeout(playAnimation, 100);
            }}
            disabled={!content.trim() || isPlaying}
            size="small"
          >
            다시 재생
          </Button>

          <Chip
            label={`현재 단계: ${currentPhase === 'idle' ? '대기' :
              currentPhase === 'entering' ? '표시 중' :
                currentPhase === 'displaying' ? '진행 중' :
                  currentPhase === 'exiting' ? '완료 중' : '알 수 없음'
              }`}
            size="small"
            color={currentPhase === 'displaying' ? 'success' : 'default'}
            icon={<Info />}
          />
        </Stack>

        {/* 효과 정보 */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`표시: ${displayAnim.effectName}`}
            size="small"
            variant="outlined"
            icon={<Speed />}
          />
          <Chip
            label={`완료: ${endAnim.effectName}`}
            size="small"
            variant="outlined"
          />
          {displayOptions.sirenOutput && (
            <Chip
              label="싸이렌 출력"
              size="small"
              color="warning"
            />
          )}
          <Chip
            label={`표시시간: ${schedule.duration || 5}초`}
            size="small"
            variant="outlined"
          />
        </Stack>

        {/* 효과 설명 */}
        {isPlaying && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {currentPhase === 'entering' && `${displayAnim.effectName} 효과로 메시지가 나타납니다.`}
              {currentPhase === 'displaying' && `메시지가 ${schedule.duration || 5}초간 표시됩니다.`}
              {currentPhase === 'exiting' && `${endAnim.effectName} 효과로 메시지가 사라집니다.`}
            </Typography>
          </Alert>
        )}
      </Box>

      {/* CSS 애니메이션 정의 */}
      <style jsx>{`
        @keyframes displayDirect {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes displayScrollLeft {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes displayScrollUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes displayScrollDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes displayLaser {
          0% { opacity: 0; transform: scaleX(0); }
          50% { opacity: 1; transform: scaleX(0.1); }
          100% { opacity: 1; transform: scaleX(1); }
        }

        @keyframes displayCenterExpand {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }

        @keyframes displayEdgeConverge {
          0% { transform: scaleY(2) translateY(-25%); opacity: 0; }
          100% { transform: scaleY(1) translateY(0); opacity: 1; }
        }

        @keyframes displayRotate {
          0% { transform: rotate(-180deg) scale(0); opacity: 0; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }

        @keyframes displayRotateLine {
          0% { transform: rotateY(-90deg); opacity: 0; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }

        @keyframes displayRotateChange {
          0% { transform: rotateZ(-90deg) scale(0.5); opacity: 0; }
          50% { transform: rotateZ(45deg) scale(1.2); opacity: 0.7; }
          100% { transform: rotateZ(0deg) scale(1); opacity: 1; }
        }

        @keyframes displayRotateLineChange {
          0% { transform: rotateX(-90deg); opacity: 0; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }

        @keyframes displayMoveUpDown1 {
          0% { transform: translateY(-50px); opacity: 0; }
          25% { transform: translateY(10px); opacity: 0.5; }
          75% { transform: translateY(-10px); opacity: 0.8; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes displayMoveUpDown2 {
          0% { transform: translateY(50px); opacity: 0; }
          25% { transform: translateY(-10px); opacity: 0.5; }
          75% { transform: translateY(10px); opacity: 0.8; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes displayReverseSlow {
          0% { filter: invert(1); transform: scale(1.5); opacity: 0; }
          100% { filter: invert(0); transform: scale(1); opacity: 1; }
        }

        @keyframes displayReverseFast {
          0% { filter: invert(1); transform: scale(2); opacity: 0; }
          50% { filter: invert(0.5); transform: scale(1.2); opacity: 0.7; }
          100% { filter: invert(0); transform: scale(1); opacity: 1; }
        }

        @keyframes displayCurrentTime {
          0% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes displayScrollAllLeft {
          0% { transform: translateX(200%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }

        /* 완료 효과 */
        @keyframes endDirect {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes endScrollLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-100%); opacity: 0; }
        }

        @keyframes endScrollUp {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }

        @keyframes endScrollDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }

        @keyframes endCenterExpand {
          from { transform: scaleY(1); opacity: 1; }
          to { transform: scaleY(0); opacity: 0; }
        }

        @keyframes endEdgeConverge {
          from { transform: scaleY(1); opacity: 1; }
          to { transform: scaleY(2) translateY(-25%); opacity: 0; }
        }

        @keyframes endRotateDisappear {
          from { transform: rotate(0deg) scale(1); opacity: 1; }
          to { transform: rotate(180deg) scale(0); opacity: 0; }
        }

        @keyframes endScreenReverse {
          0% { filter: invert(0); opacity: 1; }
          50% { filter: invert(1); opacity: 0.5; }
          100% { filter: invert(0); opacity: 0; }
        }

        @keyframes endExpandHorizontal {
          from { transform: scaleX(1); opacity: 1; }
          to { transform: scaleX(3); opacity: 0; }
        }

        @keyframes endShrinkCenter {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0); opacity: 0; }
        }

        @keyframes endExpandReverse {
          0% { transform: scaleX(1); filter: invert(0); opacity: 1; }
          50% { transform: scaleX(2); filter: invert(1); opacity: 0.5; }
          100% { transform: scaleX(3); filter: invert(0); opacity: 0; }
        }

        /* 기타 효과 */
        @keyframes blinkEffect {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </Box>
  );
};

export default MessagePreview;