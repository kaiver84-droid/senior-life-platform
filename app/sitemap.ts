import type { MetadataRoute } from "next";
import { WELFARE } from "@/lib/welfare";
import { SITE_URL } from "@/lib/guide";

/**
 * 사이트맵 자동 생성 — 빌드할 때마다 lib/welfare.ts 를 읽어 혜택 페이지를 전부 다시 넣는다.
 * (매주 월요일 '오늘의 혜택' 자동 업데이트가 welfare.ts 를 고치고 재배포하면 사이트맵도 함께 최신이 된다.)
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/guide/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...WELFARE.map((p) => ({
      url: `${SITE_URL}/guide/${p.id}/`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/guide/quiz/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
