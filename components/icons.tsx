import React from "react";

type P = { className?: string; size?: number };

const base = (size = 26) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* ---------------------------------------------------------------- */
/* 하단 메뉴 · 화면 아이콘                                            */
/* ---------------------------------------------------------------- */

export const IconHome = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V21h13V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

/** 두뇌(퀴즈) */
export const IconQuiz = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 4.4a2.9 2.9 0 0 0-2.9 2.7A2.7 2.7 0 0 0 7.3 12a2.9 2.9 0 0 0 1.4 4.9A2.8 2.8 0 0 0 12 19.6Z" />
    <path d="M12 4.4a2.9 2.9 0 0 1 2.9 2.7A2.7 2.7 0 0 1 16.7 12a2.9 2.9 0 0 1-1.4 4.9A2.8 2.8 0 0 1 12 19.6Z" />
    <path d="M9.4 8.6c.8.2 1.3.8 1.3 1.6M14.6 13.8c-.8-.2-1.3-.8-1.3-1.6" />
  </svg>
);

export const IconTrophy = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M7.5 3.5h9v4.2a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 5.2H4.4v1.4a3.1 3.1 0 0 0 3.1 3.1" />
    <path d="M16.5 5.2h3.1v1.4a3.1 3.1 0 0 1-3.1 3.1" />
    <path d="M12 12.2V16" />
    <path d="M8.6 20.4h6.8c0-2.4-1.5-4.4-3.4-4.4s-3.4 2-3.4 4.4Z" />
  </svg>
);

export const IconGift = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M4 10.5h16V21H4z" />
    <path d="M2.5 7.5h19v3h-19z" />
    <path d="M12 7.5V21" />
    <path d="M12 7.5S10.8 3 8.3 3a2.4 2.4 0 0 0 0 4.5H12Zm0 0S13.2 3 15.7 3a2.4 2.4 0 0 1 0 4.5H12Z" />
  </svg>
);

/** 정부 지원금(관공서) */
export const IconBank = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M3 9.5 12 4l9 5.5" />
    <path d="M5 10.5V19M9.5 10.5V19M14.5 10.5V19M19 10.5V19" />
    <path d="M3.2 20.5h17.6" />
  </svg>
);

export const IconTools = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
);

export const IconFamily = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="9" cy="8" r="3.2" />
    <circle cx="17" cy="10" r="2.4" />
    <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <path d="M15.5 20c0-2.2 1-4 3-4s3 1.6 3 4" />
  </svg>
);

export const IconBook = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 6.3C10.4 4.8 8.2 4.2 4.5 4.2v14.3c3.7 0 5.9.6 7.5 2.1 1.6-1.5 3.8-2.1 7.5-2.1V4.2c-3.7 0-5.9.6-7.5 2.1Z" />
    <path d="M12 6.3v14.3" />
  </svg>
);

export const IconPill = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
    <path d="M9 9 15 15" />
  </svg>
);

export const IconMail = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4.5 8 6.6 4.8c.6.4 1.4.4 2 0L19.5 8" />
  </svg>
);

export const IconSun = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
  </svg>
);

export const IconStar = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9 7.3 14.4 2.6 9.8l6.5-.9z" />
  </svg>
);

export const IconHeart = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 20s-7.6-4.5-7.6-9.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.6 3.2C19.6 15.5 12 20 12 20Z" />
  </svg>
);

export const IconSprout = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 20v-7" />
    <path d="M12 13c-4.2 0-6.4-2.4-6.4-6.2 4.2 0 6.4 2.4 6.4 6.2Z" />
    <path d="M12 13c4.2 0 6.4-2.4 6.4-6.2-4.2 0-6.4 2.4-6.4 6.2Z" />
  </svg>
);

export const IconGear = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.2 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.6 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const IconBell = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 4.3-1.6 5.6-1.6 5.6h15.2S18 12.9 18 8.6Z" />
    <path d="M10.3 18.2a2 2 0 0 0 3.4 0" />
  </svg>
);

export const IconCalendar = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 9.5h17M8 3v3.4M16 3v3.4" />
  </svg>
);

export const IconPin = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 21s6.4-5.6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.4" />
  </svg>
);

export const IconDownload = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

export const IconShare = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="17.5" cy="6.5" r="2.6" />
    <circle cx="17.5" cy="17.5" r="2.6" />
    <path d="m8.4 10.8 6.8-3.4M8.4 13.2l6.8 3.4" />
  </svg>
);

export const IconChat = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M20.5 12c0 4.1-3.8 7.4-8.5 7.4-1 0-2-.15-2.9-.42L4 20.5l1.6-3.6C4.3 15.6 3.5 13.9 3.5 12 3.5 7.9 7.3 4.6 12 4.6s8.5 3.3 8.5 7.4Z" />
  </svg>
);

export const IconSend = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 3.5 10.4 14.1" />
    <path d="M21 3.5 14.4 21l-4-6.9-6.9-4z" />
  </svg>
);

export const IconCheck = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconChevron = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconBack = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const IconClose = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconCamera = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M3.5 8.5h3l1.6-2.2h7.8l1.6 2.2h3v11h-17z" />
    <circle cx="12" cy="13.7" r="3.4" />
  </svg>
);

export const IconBulb = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M9 17.5h6" />
    <path d="M10 21h4" />
    <path d="M12 2.8a6.2 6.2 0 0 0-3.4 11.4V17h6.8v-2.8A6.2 6.2 0 0 0 12 2.8Z" />
  </svg>
);

export const IconPhone = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M6.2 3.5h3.2l1.4 3.6-2 1.4a10.5 10.5 0 0 0 5.2 5.2l1.4-2 3.6 1.4v3.2c0 1.2-1 2.2-2.2 2.2C10.3 18.5 5.5 13.7 4 6.2c-.15-1.2.9-2.7 2.2-2.7Z" />
  </svg>
);

export const IconPlus = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M5 12h14" />
  </svg>
);

export const IconCrown = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M4 18h16l1.4-9.4-4.9 3.1L12 5l-4.5 6.7-4.9-3.1z" />
    <path d="M4 20.4h16" />
  </svg>
);

export const IconSparkle = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9z" />
    <path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z" />
  </svg>
);

export const IconClock = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.6V12l3 2" />
  </svg>
);
