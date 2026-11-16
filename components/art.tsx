"use client";

import React from "react";

/* ================================================================ */
/* 고화질 사진 · 일러스트 에셋 (public/images)                        */
/* ---------------------------------------------------------------- */
/* - WebP 를 먼저 주고, 못 읽는 브라우저에는 JPEG 로 내려 준다.        */
/* - `picture` 를 display:contents 로 두어 <img> 가 곧바로 놓이게 한다.*/
/* ================================================================ */

export type AssetName =
  | "greeting-chrysanthemum"
  | "quiz-couple"
  | "welfare-pension-bg"
  | "family-greeting-couple"
  | "onboarding-hero";

export function AssetImage({
  name,
  alt,
  className = "",
  priority = false,
}: {
  name: AssetName;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <picture className="contents">
      <source srcSet={`/images/${name}.webp`} type="image/webp" />
      <img
        src={`/images/${name}.jpg`}
        alt={alt}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
}

/* ================================================================ */
/* 3D 입체 아이콘 (public/images/icon-3d-*)                           */
/* ---------------------------------------------------------------- */
/* - 클레이·글래스 질감의 3D 아이콘. 단색 선 SVG 대신 쓴다.           */
/* - 640px(표시 크기의 4~8배)로 두어 아이폰 3배 화면에서도 또렷하다.   */
/* - 모서리는 이미지에 투명하게 새겨 두어 어떤 배경에서도 자연스럽다.  */
/* ================================================================ */

export type Icon3DName =
  | "icon-3d-sun-fortune"
  | "icon-3d-quiz-trophy"
  | "icon-3d-welfare-gift"
  | "icon-3d-weather"
  | "icon-3d-health-leaf"
  | "icon-3d-magnifier"
  | "icon-3d-pill"
  | "icon-3d-mail"
  | "icon-3d-book";

export function Icon3D({
  name,
  size = 48,
  alt = "",
  className = "",
}: {
  name: Icon3DName;
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <picture className="contents">
      <source srcSet={`/images/${name}.webp`} type="image/webp" />
      <img
        src={`/images/${name}.png`}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={`block shrink-0 rounded-[24%] ${className}`}
        style={{ width: size, height: size }}
      />
    </picture>
  );
}

/* ================================================================ */
/* 늘봄 로고 — 청록 하트 · 따뜻한 노랑 해 · 새싹                        */
/* ================================================================ */

export function NeulbomMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="늘봄"
    >
      <defs>
        <linearGradient id="nb-teal" x1="6" y1="8" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2BB0B6" />
          <stop offset="1" stopColor="#0F6F76" />
        </linearGradient>
        <linearGradient id="nb-sun" x1="18" y1="12" x2="31" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD15C" />
          <stop offset="1" stopColor="#F5B82E" />
        </linearGradient>
      </defs>
      <path
        d="M24 43.5C13.4 36.6 5 29.4 5 20.7 5 14 10 9.3 16.2 9.3c3.4 0 6.4 1.7 7.8 4.3 1.4-2.6 4.4-4.3 7.8-4.3C38 9.3 43 14 43 20.7c0 8.7-8.4 15.9-19 22.8Z"
        fill="url(#nb-teal)"
      />
      <circle cx="24" cy="20.4" r="7.6" fill="url(#nb-sun)" />
      <path
        d="M24 12.8V7.6"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path d="M24 9.4c2.4-3.6 6.2-3.6 7.8-1.6-2 3.2-5.2 3.8-7.8 1.6Z" fill="#FFFFFF" opacity="0.92" />
      <path d="M24 9.9c-2-2.6-4.6-3-6.2-1.6 1.4 2.4 3.8 3 6.2 1.6Z" fill="#F5B82E" />
    </svg>
  );
}

export function NeulbomLogo({
  size = 34,
  tagline = false,
  onClick,
}: {
  size?: number;
  tagline?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <span className="flex items-center gap-2">
      <NeulbomMark size={size} />
      <span className="flex flex-col items-start leading-none">
        <span
          className="font-black tracking-[-0.05em] text-ink"
          style={{ fontSize: size * 0.78, lineHeight: 1.05 }}
        >
          늘봄
        </span>
        {tagline ? (
          <span className="mt-1 text-[0.62rem] font-bold tracking-[-0.01em] text-ink/55">
            언제나, 늘 곁에
          </span>
        ) : null}
      </span>
    </span>
  );
  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} aria-label="늘봄 홈으로" className="active:scale-[0.98]">
      {content}
    </button>
  );
}

/* ================================================================ */
/* 국화 일러스트 (히어로 배경)                                        */
/* ================================================================ */

function Chrysanthemum({
  x,
  y,
  r,
  inner,
  outer,
  core,
  opacity = 1,
}: {
  x: number;
  y: number;
  r: number;
  inner: string;
  outer: string;
  core: string;
  opacity?: number;
}) {
  const layers = [
    { count: 18, len: 1, wid: 0.3, fill: outer, off: 0 },
    { count: 14, len: 0.78, wid: 0.26, fill: inner, off: 12 },
    { count: 10, len: 0.54, wid: 0.22, fill: outer, off: 6 },
  ];
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {layers.map((layer, li) =>
        Array.from({ length: layer.count }).map((_, i) => {
          const angle = (360 / layer.count) * i + layer.off;
          const len = r * layer.len;
          return (
            <ellipse
              key={`${li}-${i}`}
              cx="0"
              cy={-len * 0.55}
              rx={r * layer.wid}
              ry={len * 0.62}
              fill={layer.fill}
              transform={`rotate(${angle})`}
              opacity={li === 0 ? 0.98 : 0.95}
            />
          );
        })
      )}
      <circle cx="0" cy="0" r={r * 0.22} fill={core} />
      <circle cx="0" cy="0" r={r * 0.11} fill={outer} opacity="0.9" />
    </g>
  );
}

function Leaf({ x, y, r, rotate = 0, color = "#5E9A57" }: { x: number; y: number; r: number; rotate?: number; color?: string }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={r}
      ry={r * 0.46}
      fill={color}
      transform={`rotate(${rotate} ${x} ${y})`}
      opacity="0.95"
    />
  );
}

export function HeroScene({
  variant = "chrysanthemum",
  className = "",
}: {
  variant?: "chrysanthemum" | "cherry" | "autumn";
  className?: string;
}) {
  if (variant === "cherry") {
    return (
      <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
        <defs>
          <linearGradient id="ch-sky" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#DCEBF7" />
            <stop offset="0.55" stopColor="#F6F9FC" />
            <stop offset="1" stopColor="#FFF6F2" />
          </linearGradient>
          <linearGradient id="ch-lake" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#9FC7DD" />
            <stop offset="1" stopColor="#E2EFF4" />
          </linearGradient>
          <filter id="ch-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect width="400" height="280" fill="url(#ch-sky)" />
        <circle cx="330" cy="46" r="44" fill="#FFF0C6" opacity="0.6" filter="url(#ch-soft)" />
        <path d="M0 150c46-24 78-26 120-14 30 8 52 4 84-10 40-18 78-12 120 12v44H0Z" fill="#B7D2BE" />
        <path d="M0 170c60-20 104-14 152 0 44 12 88 8 128-8 40-16 80-12 120 6v40H0Z" fill="#9CC0A8" />
        <rect y="190" width="400" height="60" fill="url(#ch-lake)" />
        <path d="M0 190h400" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={40 + i * 52} y={200 + i * 9} width={86 - i * 8} height="2.6" rx="1.3" fill="#FFFFFF" opacity={0.42 - i * 0.05} />
        ))}
        <path d="M0 244c70-16 140-12 210-2 66 10 128 8 190-6v44H0Z" fill="#C9DFC6" />
        <path d="M0 260c72-12 150-8 214 0 62 8 124 6 186-6v26H0Z" fill="#B2D0AE" />
        <path d="M-10 24c44 6 74 20 108 44 20 14 36 22 62 26" stroke="#7A4E3B" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M52 46c14 22 12 40 6 58" stroke="#7A4E3B" strokeWidth="6" fill="none" strokeLinecap="round" />
        {[
          [30, 28, 12], [64, 42, 14], [96, 60, 12], [124, 74, 15], [152, 90, 11],
          [46, 72, 10], [58, 102, 12], [86, 104, 9], [112, 94, 10], [140, 106, 12],
          [168, 72, 10], [186, 94, 9], [20, 54, 9], [74, 24, 10], [110, 28, 9],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {Array.from({ length: 5 }).map((_, p) => (
              <ellipse key={p} cx="0" cy={-r * 0.62} rx={r * 0.46} ry={r * 0.56} fill={p % 2 ? "#FFC9DA" : "#FFDDE8"} transform={`rotate(${p * 72})`} />
            ))}
            <circle r={r * 0.2} fill="#FFE9A8" />
          </g>
        ))}
        {[
          [210, 130, 5], [246, 94, 4], [274, 150, 5], [312, 118, 4], [186, 166, 4], [352, 90, 4],
        ].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.66} fill="#FFC9DA" opacity="0.85" transform={`rotate(${i * 40} ${x} ${y})`} />
        ))}
      </svg>
    );
  }

  if (variant === "autumn") {
    return (
      <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
        <defs>
          <linearGradient id="au-sky" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#FFE3BA" />
            <stop offset="0.6" stopColor="#FFF4E2" />
            <stop offset="1" stopColor="#FFF9EE" />
          </linearGradient>
          <filter id="au-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <rect width="400" height="280" fill="url(#au-sky)" />
        <circle cx="86" cy="64" r="52" fill="#FFD98A" opacity="0.62" filter="url(#au-soft)" />
        <path d="M0 168c50-28 92-32 138-14 34 14 62 12 96-6 40-22 82-18 166 14v46H0Z" fill="#E7C49A" />
        <path d="M0 190c56-22 108-16 154 0 44 16 90 10 130-10 38-20 78-16 116 2v38H0Z" fill="#CFA277" />
        <path d="M0 214c70-18 146-14 214 0 62 12 122 8 186-8v74H0Z" fill="#B8855B" />
        <path d="M0 244c84-16 168-10 236 4 58 12 112 6 164-8v40H0Z" fill="#9C6A45" />
        {[
          [300, 34, 14], [336, 60, 12], [268, 68, 11], [356, 96, 10], [318, 104, 9], [240, 44, 9],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${i * 30})`}>
            <path d={`M0 ${-r} L${r * 0.42} ${-r * 0.3} L${r} ${-r * 0.12} L${r * 0.5} ${r * 0.28} L${r * 0.62} ${r} L0 ${r * 0.55} L${-r * 0.62} ${r} L${-r * 0.5} ${r * 0.28} L${-r} ${-r * 0.12} L${-r * 0.42} ${-r * 0.3} Z`} fill={["#E2793D", "#F0A24C", "#D9642E", "#F4BE58"][i % 4]} />
          </g>
        ))}
        <path d="M400 78c-36 2-62 12-88 30" stroke="#7C4A2E" strokeWidth="7" fill="none" strokeLinecap="round" />
        <Chrysanthemum x={300} y={216} r={54} inner="#FFD764" outer="#F2B031" core="#DE8E17" />
        <Chrysanthemum x={358} y={252} r={38} inner="#FFE39A" outer="#F6C245" core="#DE8E17" />
        <Chrysanthemum x={60} y={252} r={34} inner="#FFD764" outer="#F2B031" core="#DE8E17" opacity={0.92} />
      </svg>
    );
  }

  /* 기본: 국화 · 노란 가을 정원 */
  return (
    <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFF5E0" />
          <stop offset="0.45" stopColor="#FFFBF1" />
          <stop offset="1" stopColor="#FCF0D6" />
        </linearGradient>
        <linearGradient id="hb-ground" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#EBD9AC" />
          <stop offset="1" stopColor="#D9BE86" />
        </linearGradient>
        <filter id="hb-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="hb-blur2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>

      <rect width="400" height="280" fill="url(#hb-sky)" />
      <circle cx="332" cy="42" r="58" fill="#FFE9B0" opacity="0.85" filter="url(#hb-blur)" />
      <circle cx="120" cy="26" r="34" fill="#FFEFC8" opacity="0.5" filter="url(#hb-blur)" />
      {[
        [92, 84, 12], [176, 48, 8], [236, 62, 10], [372, 132, 9], [28, 128, 8],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.5 - i * 0.04} filter="url(#hb-blur2)" />
      ))}

      {/* 먼 언덕 */}
      <path d="M0 168c42-20 76-22 112-8 32 12 58 12 90-4 36-18 72-18 108 0 32 16 62 18 90 8v30H0Z" fill="#C9D8B4" opacity="0.9" />
      <path d="M0 188c54-22 108-20 156-4 40 14 80 12 118-4 44-18 84-14 126 4v34H0Z" fill="#AFC79B" />
      <path d="M0 212c60-18 120-14 178-2 54 12 106 10 156-2 22-6 44-8 66-6v88H0Z" fill="url(#hb-ground)" />

      {/* 줄기 · 잎 */}
      <g opacity="0.95">
        <Leaf x={36} y={236} r={30} rotate={-22} color="#6C9A5B" />
        <Leaf x={86} y={252} r={26} rotate={16} color="#5C8C51" />
        <Leaf x={310} y={244} r={34} rotate={18} color="#6C9A5B" />
        <Leaf x={368} y={258} r={26} rotate={-14} color="#5C8C51" />
        <Leaf x={248} y={264} r={22} rotate={6} color="#7AA867" />
      </g>

      {/* 국화 송이 — 오른쪽에 크게, 왼쪽 아래에 작게 */}
      <Chrysanthemum x={318} y={176} r={70} inner="#FFD764" outer="#F5B82E" core="#D98612" />
      <Chrysanthemum x={372} y={244} r={46} inner="#FFE39A" outer="#F7C346" core="#D98F16" />
      <Chrysanthemum x={252} y={232} r={40} inner="#FFD764" outer="#F2B031" core="#DE8E17" opacity={0.97} />
      <Chrysanthemum x={56} y={248} r={38} inner="#FFE39A" outer="#F5B82E" core="#DE8E17" />
      <Chrysanthemum x={118} y={266} r={26} inner="#FFE7AE" outer="#F2B031" core="#DE8E17" opacity={0.95} />
      <Chrysanthemum x={200} y={276} r={22} inner="#FFD764" outer="#EFAF35" core="#DE8E17" opacity={0.9} />
      {[
        [230, 152, 8], [286, 118, 7], [168, 210, 7], [366, 150, 7],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill="#F7C346" />
          <circle cx={x} cy={y} r={r * 0.55} fill="#F5B82E" />
        </g>
      ))}
      <path d="M230 160c0 14-4 22-10 30M286 126c2 12 6 20 12 28" stroke="#6C9A5B" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ================================================================ */
/* 가족 배너 일러스트                                                 */
/* ================================================================ */

export function FamilyScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="fm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFE9C9" />
          <stop offset="0.6" stopColor="#FFF6E6" />
          <stop offset="1" stopColor="#FDEBEA" />
        </linearGradient>
        <linearGradient id="fm-hill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#CFE3C4" />
          <stop offset="1" stopColor="#B7D5AC" />
        </linearGradient>
        <filter id="fm-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width="400" height="220" fill="url(#fm-sky)" />
      <circle cx="332" cy="46" r="40" fill="#FFD98A" opacity="0.6" filter="url(#fm-blur)" />
      <path d="M0 150c58-26 118-24 172-8 52 16 106 12 150-6 30-12 56-14 78-10v94H0Z" fill="url(#fm-hill)" />

      {/* 집 */}
      <g transform="translate(0 96)">
        <rect x="0" y="26" width="96" height="62" rx="8" fill="#FFF8EA" />
        <path d="M-10 28 48-14l58 42z" fill="#F2A08A" />
        <rect x="18" y="46" width="24" height="22" rx="4" fill="#BFDCEA" />
        <rect x="56" y="46" width="24" height="22" rx="4" fill="#BFDCEA" />
        <rect x="38" y="68" width="20" height="20" rx="4" fill="#E4B983" />
        <circle cx="48" cy="2" r="7" fill="#F7C346" />
      </g>

      {/* 나무 */}
      <g transform="translate(196 136)">
        <rect x="-4" y="0" width="8" height="46" rx="4" fill="#9A7454" />
        <circle cx="0" cy="-14" r="26" fill="#9DCB8A" />
        <circle cx="-16" cy="-2" r="16" fill="#8CC07C" />
        <circle cx="17" cy="-4" r="15" fill="#A8D496" />
      </g>

      {/* 어르신 두 분 */}
      <g transform="translate(94 124)">
        {/* 할아버지 */}
        <path d="M-32 80c0-24 12-38 30-38s30 14 30 38z" fill="#8FB6C9" />
        <circle cx="-2" cy="22" r="20" fill="#FFE0C4" />
        <path d="M-22 16c0-14 9-22 20-22s20 8 20 22c-6-6-13-8-20-8s-14 2-20 8Z" fill="#E7E4DD" />
        <circle cx="-9" cy="22" r="2.2" fill="#3B4A5A" />
        <circle cx="5" cy="22" r="2.2" fill="#3B4A5A" />
        <path d="M-8 30c3 4 9 4 12 0" stroke="#C8735A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* 할머니 */}
        <g transform="translate(62 4)">
          <path d="M-28 76c0-22 11-36 28-36s28 14 28 36z" fill="#F3B7BE" />
          <circle cx="0" cy="22" r="19" fill="#FFE3CC" />
          <path d="M-19 18c0-15 8-23 19-23s19 8 19 23c-4-8-10-12-19-12s-15 4-19 12Z" fill="#F0EDE6" />
          <circle cx="-8" cy="22" r="2.1" fill="#3B4A5A" />
          <circle cx="7" cy="22" r="2.1" fill="#3B4A5A" />
          <path d="M-6 30c3 4 9 4 12 0" stroke="#C8735A" strokeWidth="2.3" fill="none" strokeLinecap="round" />
          <circle cx="-19" cy="26" r="2.6" fill="#F5B82E" opacity="0.8" />
          <circle cx="19" cy="26" r="2.6" fill="#F5B82E" opacity="0.8" />
        </g>
        {/* 하트 */}
        <path
          d="M-30-30c-6-8-18-6-18 3 0 8 10 13 18 19 8-6 18-11 18-19 0-9-12-11-18-3Z"
          fill="#F2708A"
          opacity="0.9"
        />
      </g>
      <path d="M0 196c70-14 140-10 200-2 66 10 134 6 200-6v32H0Z" fill="#A9CBA0" opacity="0.7" />
    </svg>
  );
}

/* ================================================================ */
/* 입체 타일 — 운세 띠 · 날씨 아이콘을 한 겹 더 도드라지게           */
/* ================================================================ */

export function RaisedTile({
  children,
  tone = "warm",
  size = 56,
}: {
  children: React.ReactNode;
  tone?: "warm" | "sky";
  size?: number;
}) {
  const skin =
    tone === "warm"
      ? "bg-gradient-to-br from-[#FFEDE0] via-[#FFD9C6] to-[#FFC0AB] shadow-[0_9px_18px_-9px_rgba(214,110,86,0.75),inset_0_-4px_8px_rgba(198,96,72,0.18),inset_0_2px_0_rgba(255,255,255,0.95)]"
      : "bg-gradient-to-br from-[#EDF7FE] via-[#D6EAFB] to-[#B7D9F4] shadow-[0_9px_18px_-9px_rgba(70,140,190,0.65),inset_0_-4px_8px_rgba(58,118,168,0.16),inset_0_2px_0_rgba(255,255,255,0.95)]";
  const glow = tone === "warm" ? "bg-white/60" : "bg-white/70";
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[1.1rem] ${skin}`}
      style={{ width: size, height: size }}
    >
      {/* 윗면 하이라이트 */}
      <span aria-hidden className={`pointer-events-none absolute inset-x-1.5 top-1 h-3 rounded-full blur-[2px] ${glow}`} />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.1rem] ring-1 ring-inset ring-white/40" />
      <span className="relative drop-shadow-[0_2px_2px_rgba(90,70,60,0.28)]">{children}</span>
    </span>
  );
}

/* ================================================================ */
/* 날씨 아이콘                                                        */
/* ================================================================ */

export function WeatherArt({ label, size = 52 }: { label: string; size?: number }) {
  const rainy = /비|소나기|천둥|이슬비/.test(label);
  const snowy = /눈/.test(label);
  const cloudy = /흐림|안개|구름/.test(label);

  if (rainy || snowy) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <circle cx="30" cy="24" r="13" fill="#F5B82E" />
        <g fill="#FFFFFF">
          <ellipse cx="30" cy="34" rx="20" ry="14" />
          <ellipse cx="42" cy="32" rx="12" ry="10" />
          <ellipse cx="19" cy="33" rx="11" ry="9" />
        </g>
        <g stroke={rainy ? "#4EA3D6" : "#9EC7E8"} strokeWidth="3.4" strokeLinecap="round">
          <path d="M22 48l-3 8M33 48l-3 8M44 48l-3 8" opacity={rainy ? 1 : 0.3} />
        </g>
        {snowy ? (
          <g fill="#FFFFFF" stroke="#9EC7E8" strokeWidth="1.4">
            <circle cx="22" cy="53" r="2.6" />
            <circle cx="33" cy="56" r="2.2" />
            <circle cx="44" cy="52" r="2.4" />
          </g>
        ) : null}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {cloudy ? (
        <>
          <circle cx="24" cy="24" r="12" fill="#F7C346" opacity="0.85" />
          <g fill="#FFFDF8">
            <ellipse cx="34" cy="38" rx="20" ry="13" />
            <ellipse cx="46" cy="35" rx="12" ry="10" />
            <ellipse cx="22" cy="36" rx="11" ry="9" />
          </g>
          <g fill="#DCEAF7">
            <ellipse cx="34" cy="40" rx="16" ry="9" />
          </g>
        </>
      ) : (
        <>
          <circle cx="32" cy="32" r="13" fill="#F5B82E" />
          <circle cx="32" cy="32" r="13" fill="url(#w-sun)" />
          <defs>
            <radialGradient id="w-sun" cx="0.35" cy="0.3" r="0.8">
              <stop stopColor="#FFD764" />
              <stop offset="1" stopColor="#F5B82E" />
            </radialGradient>
          </defs>
          <g stroke="#F5B82E" strokeWidth="3.4" strokeLinecap="round">
            <path d="M32 6v6M32 52v6M6 32h6M52 32h6M13.5 13.5l4.2 4.2M46.3 46.3l4.2 4.2M50.5 13.5l-4.2 4.2M17.7 46.3l-4.2 4.2" />
          </g>
        </>
      )}
    </svg>
  );
}
