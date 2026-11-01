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

export const ResetIcon = ({ className = "filter-svg-icon", size = 13 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const StarIcon = ({ filled = false, className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#f59e0b" : "none"} stroke={filled ? "#f59e0b" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const PipIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const CopyIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const ExternalLinkIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const SearchIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const ToolsIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const InstagramIcon = ({ className = "viewer-svg-icon", size = 14 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

