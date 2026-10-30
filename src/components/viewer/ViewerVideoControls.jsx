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
  FsExitIcon
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
  onFullscreenVideo
}) {
  return (
    <div className="viewer-controls">
      <button
        className="viewer-ctrl-btn viewer-play"
        type="button"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        title={isPlaying ? 'Pause video' : 'Play video'}
        onClick={onPlayToggle}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        className={`viewer-ctrl-btn viewer-zoom ${isFill ? 'active' : ''}`}
        type="button"
        title={isFill ? 'Fit video in viewer' : 'Fill viewer with video'}
        onClick={onToggleFitMode}
      >
        <FitIcon />
      </button>

      <button
        className={`viewer-ctrl-btn viewer-mute ${isMuted ? 'active' : ''}`}
        type="button"
        title={isMuted ? 'Unmute' : 'Mute'}
        onClick={onMuteToggle}
      >
        {isMuted ? <MuteIcon /> : <VolumeIcon />}
      </button>

      <input
        type="range"
        min="0"
        max={Math.floor(duration * 10) || 0}
        value={Math.floor(currentTime * 10) || 0}
        aria-label="Video position"
        onChange={e => {
          const t = Number(e.target.value) / 10;
          if (videoRef.current) videoRef.current.currentTime = t;
          onSeek(t);
        }}
      />

      <span className="viewer-clock">
        {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
      </span>

      <button
        className={`viewer-ctrl-btn viewer-loop ${isLooping ? 'active' : ''}`}
        type="button"
        title={`Loop video: ${isLooping ? 'ON' : 'OFF'}`}
        onClick={onLoopToggle}
      >
        <LoopIcon />
      </button>

      <button
        className={`viewer-ctrl-btn viewer-ctrl-pill viewer-autoplay-btn ${autoplayViewer ? 'active' : ''}`}
        type="button"
        title={`Viewer autoplay: ${autoplayViewer ? 'ON' : 'OFF'}`}
        onClick={onAutoplayToggle}
      >
        <AutoIcon />
        <span>Auto</span>
      </button>

      <button
        className={`viewer-ctrl-btn viewer-fs ${videoFullscreen ? 'active' : ''}`}
        type="button"
        title="Toggle fullscreen"
        onClick={onFullscreenVideo}
      >
        {videoFullscreen ? <FsExitIcon /> : <FsEnterIcon />}
      </button>
    </div>
  );
}
