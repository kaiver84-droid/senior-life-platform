/** Canvas 로 그리는 이미지들 (인사카드 · 상장 · 안부카드) */

export type GreetingTheme = "spring" | "summer" | "autumn" | "winter" | "sunset";

export const THEMES: { key: GreetingTheme; label: string; emoji: string; colors: [string, string] }[] = [
  { key: "spring", label: "봄꽃", emoji: "🌸", colors: ["#FFD9E4", "#FFF6EE"] },
  { key: "summer", label: "여름바다", emoji: "🌊", colors: ["#9BD7F5", "#EAF9FF"] },
  { key: "autumn", label: "가을단풍", emoji: "🍁", colors: ["#FFCE8A", "#FFF3E0"] },
  { key: "winter", label: "겨울설경", emoji: "❄️", colors: ["#CFE3F7", "#F8FCFF"] },
  { key: "sunset", label: "노을", emoji: "🌇", colors: ["#FFB07C", "#FFE6C7"] },
];

const FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(cur);
      cur = "";
      continue;
    }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function rnd(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sky(ctx: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function sun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.6);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + "AA");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function petal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function blossom(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, core: string) {
  for (let i = 0; i < 5; i++) {
    petal(ctx, x + Math.cos((i / 5) * Math.PI * 2) * s * 0.9, y + Math.sin((i / 5) * Math.PI * 2) * s * 0.9, s * 0.85, (i / 5) * Math.PI * 2, color);
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function mapleLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? s : s * 0.42;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1.6, s * 0.14);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s);
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(-s * 0.28, -s * 0.85);
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(s * 0.28, -s * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

function pine(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, snow: boolean) {
  ctx.fillStyle = "#2F4B3C";
  for (let i = 0; i < 3; i++) {
    const w = h * (0.52 - i * 0.12);
    const yy = baseY - i * h * 0.26;
    ctx.beginPath();
    ctx.moveTo(x, yy - h * 0.46);
    ctx.lineTo(x - w, yy);
    ctx.lineTo(x + w, yy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#6B4A2B";
  ctx.fillRect(x - h * 0.035, baseY - h * 0.02, h * 0.07, h * 0.09);
  if (snow) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let i = 0; i < 3; i++) {
      const w = h * (0.52 - i * 0.12);
      const yy = baseY - i * h * 0.26;
      ctx.beginPath();
      ctx.moveTo(x, yy - h * 0.2);
      ctx.lineTo(x - w * 0.7, yy - h * 0.02);
      ctx.lineTo(x + w * 0.7, yy - h * 0.02);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function birds(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.55, x, y - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.55, x + s, y);
  ctx.stroke();
}

function paintScene(ctx: CanvasRenderingContext2D, theme: GreetingTheme, w: number, h: number) {
  const R = rnd(theme.length * 7919 + 13);
  switch (theme) {
    case "spring": {
      sky(ctx, w, h, "#FFD6E3", "#FFF7EF");
      sun(ctx, w * 0.78, h * 0.2, 92, "#FFE9B0");
      // 먼 산
      ctx.fillStyle = "rgba(190,214,235,0.55)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.quadraticCurveTo(w * 0.18, h * 0.36, w * 0.38, h * 0.5);
      ctx.quadraticCurveTo(w * 0.55, h * 0.4, w * 0.72, h * 0.5);
      ctx.lineTo(w, h * 0.48);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // 언덕
      ctx.fillStyle = "#C9E4B7";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62);
      ctx.quadraticCurveTo(w * 0.3, h * 0.5, w, h * 0.6);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#B0D89C";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.quadraticCurveTo(w * 0.55, h * 0.58, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // 벚나무 가지
      ctx.strokeStyle = "#6B4A3A";
      ctx.lineWidth = 22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-20, h * 0.06);
      ctx.bezierCurveTo(w * 0.12, h * 0.14, w * 0.2, h * 0.1, w * 0.34, h * 0.2);
      ctx.stroke();
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.11);
      ctx.quadraticCurveTo(w * 0.14, h * 0.2, w * 0.09, h * 0.26);
      ctx.stroke();
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const x = w * (0.02 + t * 0.34) + (R() - 0.5) * 60;
        const y = h * (0.07 + Math.sin(t * 2.4) * 0.05) + (R() - 0.5) * 70;
        blossom(ctx, x, y, 13 + R() * 10, R() > 0.5 ? "#FFB8CE" : "#FFD3E0", "#FFE9A8");
      }
      for (let i = 0; i < 60; i++) {
        petal(ctx, R() * w, R() * h * 0.7, 6 + R() * 9, R() * Math.PI, R() > 0.5 ? "rgba(255,185,207,0.9)" : "rgba(255,222,234,0.95)");
      }
      ctx.fillStyle = "rgba(150,196,124,0.55)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.66);
      ctx.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.68);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "summer": {
      sky(ctx, w, h, "#8FD3F4", "#E9F9FF");
      sun(ctx, w * 0.8, h * 0.14, 100, "#FFF3B0");
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      [
        [w * 0.2, h * 0.18, 150, 58],
        [w * 0.33, h * 0.14, 105, 46],
        [w * 0.62, h * 0.24, 120, 44],
      ].forEach(([x, y, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      birds(ctx, w * 0.24, h * 0.28, 18, "#5A6B7A");
      birds(ctx, w * 0.31, h * 0.25, 14, "#5A6B7A");
      const sea = ctx.createLinearGradient(0, h * 0.46, 0, h);
      sea.addColorStop(0, "#2E9BD6");
      sea.addColorStop(0.5, "#39B6DE");
      sea.addColorStop(1, "#8FE0E8");
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.46, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 14; i++) {
        const y = h * (0.5 + i * 0.028);
        ctx.lineWidth = 3 + i * 0.35;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const yy = y + Math.sin((x / w) * 6 + i) * (4 + i * 0.7);
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#F6E7C8";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.88);
      ctx.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.9);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "autumn": {
      sky(ctx, w, h, "#FFD79A", "#FFF1DC");
      sun(ctx, w * 0.22, h * 0.18, 86, "#FFE3A3");
      const layers = [
        { y: 0.4, c: "#E0A96D", h: 0.16 },
        { y: 0.48, c: "#C97F45", h: 0.16 },
        { y: 0.58, c: "#9C5A31", h: 0.2 },
      ];
      layers.forEach((l, idx) => {
        ctx.fillStyle = l.c;
        ctx.beginPath();
        ctx.moveTo(0, h * l.y);
        for (let x = 0; x <= w; x += 40) {
          ctx.lineTo(x, h * l.y - Math.sin(x / 130 + idx * 2) * h * 0.04 - idx * 10);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      });
      ctx.strokeStyle = "#7A4A2A";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.9);
        ctx.lineTo(x + (R() - 0.5) * 20, h * 0.66);
        ctx.stroke();
      }
      for (let i = 0; i < 34; i++) {
        mapleLeaf(ctx, R() * w, R() * h * 0.7, 12 + R() * 16, R() * Math.PI * 2, ["#E4572E", "#F4A259", "#D95F2B", "#F2C14E"][Math.floor(R() * 4)]);
      }
      break;
    }
    case "winter": {
      sky(ctx, w, h, "#BFD9F2", "#F6FBFF");
      sun(ctx, w * 0.76, h * 0.16, 74, "#FFFDF0");
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.52);
      ctx.quadraticCurveTo(w * 0.25, h * 0.42, w * 0.52, h * 0.54);
      ctx.quadraticCurveTo(w * 0.78, h * 0.64, w, h * 0.5);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#EAF3FC";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.quadraticCurveTo(w * 0.45, h * 0.62, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      pine(ctx, w * 0.16, h * 0.72, 240, true);
      pine(ctx, w * 0.3, h * 0.76, 170, true);
      pine(ctx, w * 0.85, h * 0.74, 210, true);
      ctx.fillStyle = "#8B5E3C";
      rr(ctx, w * 0.6, h * 0.66, 96, 84, 10);
      ctx.fill();
      ctx.fillStyle = "#C8462F";
      ctx.beginPath();
      ctx.moveTo(w * 0.585, h * 0.665);
      ctx.lineTo(w * 0.63, h * 0.585);
      ctx.lineTo(w * 0.675, h * 0.665);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFE9A8";
      ctx.fillRect(w * 0.63, h * 0.695, 36, 30);
      for (let i = 0; i < 46; i++) {
        snowflake(ctx, R() * w, R() * h * 0.85, 5 + R() * 9, 0.5 + R() * 0.5);
      }
      break;
    }
    case "sunset":
    default: {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      g.addColorStop(0, "#3B2B63");
      g.addColorStop(0.45, "#B4557A");
      g.addColorStop(0.78, "#F2894B");
      g.addColorStop(1, "#FFD9A0");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.62);
      ctx.fillStyle = "#FFE7B8";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.56, 118, Math.PI, 0);
      ctx.fill();
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.56, 40, w * 0.5, h * 0.56, 340);
      glow.addColorStop(0, "rgba(255,220,150,0.75)");
      glow.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h * 0.62);
      ctx.fillStyle = "rgba(80,50,90,0.55)";
      [
        [0.1, 0.3, 0.2],
        [0.42, 0.22, 0.16],
        [0.72, 0.34, 0.22],
      ].forEach(([x, y, ww]) => {
        ctx.beginPath();
        ctx.ellipse(w * x + 80, h * y, w * ww, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      birds(ctx, w * 0.22, h * 0.22, 20, "rgba(60,40,70,0.75)");
      birds(ctx, w * 0.31, h * 0.27, 15, "rgba(60,40,70,0.75)");
      const water = ctx.createLinearGradient(0, h * 0.62, 0, h);
      water.addColorStop(0, "#C9705B");
      water.addColorStop(1, "#5D4258");
      ctx.fillStyle = water;
      ctx.fillRect(0, h * 0.62, w, h);
      ctx.fillStyle = "rgba(255,225,170,0.45)";
      for (let i = 0; i < 12; i++) {
        const y = h * (0.64 + i * 0.026);
        const ww = 300 - i * 18;
        ctx.fillRect(w * 0.5 - ww / 2 + (R() - 0.5) * 40, y, ww, 4);
      }
      break;
    }
  }
}

export async function renderGreetingCard(
  canvas: HTMLCanvasElement,
  opts: { theme: GreetingTheme; name: string; message: string; dateLabel: string; fortuneLine: string }
): Promise<void> {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts.ready;
  ctx.clearRect(0, 0, W, H);

  paintScene(ctx, opts.theme, W, H);

  // 하단 가독성용 그라데이션
  const shade = ctx.createLinearGradient(0, H * 0.38, 0, H);
  shade.addColorStop(0, "rgba(20,25,40,0)");
  shade.addColorStop(0.55, "rgba(20,25,40,0.18)");
  shade.addColorStop(1, "rgba(20,25,40,0.42)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // 흰 카드
  const cardX = 84;
  const cardW = W - 168;
  const cardY = 736;
  const cardH = 530;
  ctx.save();
  ctx.shadowColor = "rgba(20,25,40,0.35)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "rgba(255,253,246,0.96)";
  rr(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(176,122,22,0.35)";
  ctx.lineWidth = 3;
  rr(ctx, cardX + 16, cardY + 16, cardW - 32, cardH - 32, 32);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#B07A16";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("오늘의 안부", W / 2, cardY + 92);

  ctx.fillStyle = "#14213A";
  ctx.font = `800 92px ${FONT}`;
  const nameText = opts.name.length > 8 ? opts.name.slice(0, 8) : opts.name;
  ctx.fillText(`${nameText} 님`, W / 2, cardY + 200);

  ctx.fillStyle = "#3C4A63";
  ctx.font = `500 44px ${FONT}`;
  const lines = wrap(ctx, opts.message, cardW - 150);
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, W / 2, cardY + 278 + i * 60);
  });

  ctx.fillStyle = "#1B6B45";
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(opts.fortuneLine, W / 2, cardY + cardH - 120);

  ctx.fillStyle = "#7A8399";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`${opts.dateLabel} · 시니어생활 도우미`, W / 2, cardY + cardH - 66);
}

export async function renderCertificate(
  canvas: HTMLCanvasElement,
  opts: { name: string; correct: number; total: number; points: number; dateLabel: string }
): Promise<void> {
  const W = 1200;
  const H = 860;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts.ready;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#FFFDF3");
  bg.addColorStop(1, "#FFF6DC");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 금빛 테두리
  ctx.strokeStyle = "#C9A227";
  ctx.lineWidth = 12;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.strokeStyle = "rgba(201,162,39,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // 모서리 장식
  ctx.fillStyle = "#C9A227";
  [
    [52, 52],
    [W - 52, 52],
    [52, H - 52],
    [W - 52, H - 52],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#B07A16";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("제 1 회 · 1분 두뇌 퀴즈", W / 2, 130);

  ctx.fillStyle = "#8A5A0B";
  ctx.font = `900 108px ${FONT}`;
  ctx.fillText("상 장", W / 2, 258);

  ctx.fillStyle = "#14213A";
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText(opts.name, W / 2, 374);

  ctx.fillStyle = "#3C4A63";
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText("위 분은 오늘의 두뇌 퀴즈를 훌륭히 마치셨으므로", W / 2, 444);
  ctx.fillText("이 상장을 드립니다.", W / 2, 496);

  ctx.fillStyle = "#14213A";
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(`정답 ${opts.correct}문제 / ${opts.total}문제 · ${opts.points}점`, W / 2, 578);

  ctx.fillStyle = "#5A6478";
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(opts.dateLabel, W / 2, 690);

  // 도장
  ctx.save();
  ctx.strokeStyle = "#C0392B";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W - 210, H - 190, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#C0392B";
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText("시니어생활", W - 210, H - 198);
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("도우미", W - 210, H - 162);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = "#8A93A6";
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("시니어생활 도우미", 92, H - 108);
}

export async function renderAnbuCard(
  canvas: HTMLCanvasElement,
  opts: {
    name: string;
    morning: boolean;
    evening: boolean;
    streak: number;
    quizDone: boolean;
    timeLabel: string;
    dateLabel: string;
  }
): Promise<void> {
  const W = 900;
  const H = 1200;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts.ready;

  sky(ctx, W, H, "#FFF3D6", "#FFFBF0");
  ctx.fillStyle = "rgba(255,209,102,0.35)";
  ctx.beginPath();
  ctx.arc(W * 0.86, 130, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#B07A16";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("오늘의 안부", W / 2, 110);

  ctx.fillStyle = "#14213A";
  ctx.font = `900 76px ${FONT}`;
  ctx.fillText("저는 잘 지내고 있어요", W / 2, 230);

  ctx.fillStyle = "#3C4A63";
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText(`${opts.name} 드림`, W / 2, 296);

  const rows: [string, string, boolean][] = [
    ["아침 약", opts.morning ? "먹었어요" : "아직이에요", opts.morning],
    ["저녁 약", opts.evening ? "먹었어요" : "아직이에요", opts.evening],
    ["오늘 퀴즈", opts.quizDone ? "했어요" : "아직이에요", opts.quizDone],
  ];
  rows.forEach(([label, value, ok], i) => {
    const y = 400 + i * 150;
    ctx.fillStyle = "#FFFFFF";
    rr(ctx, 90, y, W - 180, 118, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,33,58,0.12)";
    ctx.lineWidth = 2;
    rr(ctx, 90, y, W - 180, 118, 28);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#14213A";
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText(label, 130, y + 76);

    ctx.textAlign = "right";
    ctx.fillStyle = ok ? "#1B6B45" : "#8A93A6";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`${ok ? "✓ " : "○ "}${value}`, W - 130, y + 76);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#B07A16";
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(`🔥 ${opts.streak}일 연속 출석 중`, W / 2, 920);

  ctx.fillStyle = "#7A8399";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`${opts.dateLabel} ${opts.timeLabel}`, W / 2, 1060);
  ctx.fillText("시니어생활 도우미", W / 2, 1108);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png", 1);
  });
}
