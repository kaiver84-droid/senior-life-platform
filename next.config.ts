import type { NextConfig } from "next";

/**
 * Cloudflare Pages 배포용 구성.
 * - `output: "export"` 로 정적 HTML 을 `out/` 에 생성하고 Pages 가 그대로 서빙합니다.
 * - 화면에서 쓰는 API 는 `functions/api/**` 의 Cloudflare Pages Functions 가 담당합니다.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
