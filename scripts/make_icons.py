"""늘봄 심볼(favicon.svg)로 PWA 아이콘을 만든다 — 192/512/180 + maskable.

실행: python3 scripts/make_icons.py   (cairosvg 필요: pip install cairosvg)
"""
import pathlib

import cairosvg

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = "#FAF6EE"

PATHS = """
    <path d="M32 58C18 48.8 7 39.4 7 27.9 7 19 13.6 12.7 21.9 12.7c4.5 0 8.5 2.3 10.1 5.8 1.6-3.5 5.6-5.8 10.1-5.8C50.4 12.7 57 19 57 27.9c0 11.5-11 20.9-25 30.1Z" fill="url(#teal)"/>
    <circle cx="32" cy="27.2" r="10" fill="url(#sun)"/>
    <path d="M32 17V10" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M32 12.6c3.2-4.8 8.2-4.8 10.4-2.1-2.7 4.2-7 5-10.4 2.1Z" fill="#FFFFFF"/>
    <path d="M32 13.3c-2.6-3.4-6-3.9-8.1-2.1 1.8 3.1 5 3.9 8.1 2.1Z" fill="#F5B82E"/>
"""


def svg(size: int, scale: float, rounded: bool) -> str:
    radius = 14 if rounded else 0
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="teal" x1="8" y1="10" x2="56" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2BB0B6"/><stop offset="1" stop-color="#0F6F76"/>
    </linearGradient>
    <linearGradient id="sun" x1="24" y1="16" x2="42" y2="38" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFD15C"/><stop offset="1" stop-color="#F5B82E"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="{radius}" fill="{BG}"/>
  <g transform="translate(32,32) scale({scale}) translate(-32,-32)">{PATHS}</g>
</svg>
"""


def main():
    jobs = [
        ("icon-192.png", 192, 0.92, True),
        ("icon-512.png", 512, 0.92, True),
        ("icon-maskable-192.png", 192, 0.62, False),
        ("icon-maskable-512.png", 512, 0.62, False),
    ]
    for name, size, scale, rounded in jobs:
        cairosvg.svg2png(
            bytestring=svg(size, scale, rounded).encode(),
            write_to=str(OUT / name),
            output_width=size,
            output_height=size,
        )
        print("saved", OUT / name)

    # 아이폰 홈 화면 아이콘(180) — iOS 가 모서리를 다듬으므로 꽉 찬 배경으로
    cairosvg.svg2png(
        bytestring=svg(180, 0.96, False).encode(),
        write_to=str(ROOT / "public" / "apple-touch-icon.png"),
        output_width=180,
        output_height=180,
    )
    print("saved", ROOT / "public" / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
