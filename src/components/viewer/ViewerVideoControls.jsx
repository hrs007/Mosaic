import React from 'react';
import { formatVideoTime } from '../../utils/mediaHelpers.js';
import {
  PlayIcon,
  PauseIcon,
  FitIcon,
  VolumeIcon,
  MuteIcon,
  LoopIcon,
  AutoIcon,
  FsEnterIcon,
  FsExitIcon,
  PipIcon
} from '../../constants/icons.jsx';

export default function ViewerVideoControls({
  videoRef,
  isPlaying,
  onPlayToggle,
  isFill,
  onToggleFitMode,
  isMuted,
  onMuteToggle,
  duration,
  currentTime,
  onSeek,
  isLooping,
  onLoopToggle,
  autoplayViewer,
  onAutoplayToggle,
  videoFullscreen,
  onFullscreenVideo,
  hasPip,
  onTogglePip
}) {
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="viewer-controls" role="toolbar" aria-label="Video controls">
      <button
        className={`viewer-ctrl-btn viewer-play ${isPlaying ? 'is-playing' : ''}`}
        type="button"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        aria-pressed={isPlaying}
        title={isPlaying ? 'Pause video (Space)' : 'Play video (Space)'}
        onClick={onPlayToggle}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        className={`viewer-ctrl-btn viewer-zoom ${isFill ? 'active' : ''}`}
        type="button"
        aria-label={isFill ? 'Fit video in viewer' : 'Fill viewer with video'}
        aria-pressed={isFill}
        title={isFill ? 'Fit video (show entire frame)' : 'Fill viewer (crop edges)'}
        onClick={onToggleFitMode}
      >
        <FitIcon />
      </button>

      <button
        className={`viewer-ctrl-btn viewer-mute ${isMuted ? 'active' : ''}`}
        type="button"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        aria-pressed={isMuted}
        title={isMuted ? 'Unmute audio (currently muted)' : 'Mute audio'}
        onClick={onMuteToggle}
      >
        {isMuted ? <MuteIcon /> : <VolumeIcon />}
      </button>

      <input
        type="range"
        min="0"
        max={Math.floor(duration * 10) || 0}
        value={Math.floor(currentTime * 10) || 0}
        style={{ '--progress': `${progressPercent}%` }}
        aria-label="Video seek position"
        onChange={e => {
          const t = Number(e.target.value) / 10;
          if (videoRef.current) videoRef.current.currentTime = t;
          onSeek(t);
        }}
      />

      <span className="viewer-clock" aria-label="Playback time">
        {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
      </span>

      <button
        className={`viewer-ctrl-btn viewer-loop ${isLooping ? 'active' : ''}`}
        type="button"
        aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
        aria-pressed={isLooping}
        title={`Video loop: ${isLooping ? 'ON (click to disable)' : 'OFF (click to enable)'}`}
        onClick={onLoopToggle}
      >
        <LoopIcon />
      </button>

      <button
        className={`viewer-ctrl-btn viewer-ctrl-pill viewer-autoplay-btn ${autoplayViewer ? 'active' : ''}`}
        type="button"
        aria-label={autoplayViewer ? 'Disable autoplay' : 'Enable autoplay'}
        aria-pressed={autoplayViewer}
        title={`Autoplay on open: ${autoplayViewer ? 'ON' : 'OFF'}`}
        onClick={onAutoplayToggle}
      >
        <AutoIcon />
        <span>Auto</span>
        <span className={`ctrl-status-dot ${autoplayViewer ? 'on' : 'off'}`} />
      </button>

      {hasPip && (
        <button
          className="viewer-ctrl-btn viewer-pip"
          type="button"
          aria-label="Toggle Picture-in-Picture"
          title="Float video in Picture-in-Picture"
          onClick={onTogglePip}
        >
          <PipIcon size={14} />
        </button>
      )}

      <button
        className={`viewer-ctrl-btn viewer-fs ${videoFullscreen ? 'active' : ''}`}
        type="button"
        aria-label={videoFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-pressed={videoFullscreen}
        title={videoFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
        onClick={onFullscreenVideo}
      >
        {videoFullscreen ? <FsExitIcon /> : <FsEnterIcon />}
      </button>
    </div>
  );
}
