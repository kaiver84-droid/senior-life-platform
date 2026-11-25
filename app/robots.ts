import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/guide";

/** robots.txt — 검색 로봇이 안내 페이지를 모두 읽고 사이트맵을 찾아갈 수 있게 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API 는 검색 결과에 나올 내용이 없다
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
