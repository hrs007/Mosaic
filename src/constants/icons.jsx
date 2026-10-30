import React from 'react';

export const PlayIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <polygon points="7 4 19 12 7 20 7 4" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <rect x="6" y="5" width="4" height="14" fill="currentColor" rx="1" />
    <rect x="14" y="5" width="4" height="14" fill="currentColor" rx="1" />
  </svg>
);

export const FitIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M7 9h2v2M17 9h-2v2M7 15h2v-2M17 15h-2v-2" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const VolumeIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const MuteIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const LoopIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M17 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M7 22l-4-4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const AutoIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
  </svg>
);

export const FsEnterIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M15 3h6v6m0-6L14 10M9 21H3v-6m0 6l7-7" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const FsExitIcon = ({ className = "viewer-svg-icon" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M4 14h6v6m0-6L3 21M20 10h-6V4m0 6l7-7" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const DownloadIcon = ({ className = "card-svg-icon", size = 16 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const CheckIcon = ({ className = "card-svg-icon", size = 16 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
