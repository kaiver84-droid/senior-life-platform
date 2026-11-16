import { REGIONS, sigunguList, shortSido } from "../../lib/regions";
import { localNewsFor, newsAreaName } from "../../lib/local-news";
import { regionLinks } from "../../lib/region-links";

/**
 * 우리동네 소식 조회 API — 시·도 / 시·군·구를 주면 그 지역 소식을 돌려준다.
 *
 *   GET /api/local-news?sido=충청북도&sigungu=옥천군&months=4&today=2026-11-17
 *   GET /api/local-news?regions=1                (지원하는 시·도 / 시·군·구 전체 목록)
 *
 * 화면은 같은 계산을 lib 에서 바로 하므로(오프라인에서도 보임) 이 API 는
 * 다른 기기·다른 화면에서 지역 소식을 받아 갈 때 쓴다.
 */

type Ctx = { request: Request; env: Record<string, unknown> };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });

const todayKst = () => {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
};

export const onRequestGet = async ({ request }: Ctx) => {
  const url = new URL(request.url);

  if (url.searchParams.get("regions")) {
    return json({
      ok: true,
      sido: REGIONS.map((r) => ({ name: r.name, short: shortSido(r.name), count: r.sigungu.length })),
      totalSigungu: REGIONS.reduce((n, r) => n + r.sigungu.length, 0),
      regions: REGIONS.map((r) => ({ name: r.name, sigungu: r.sigungu })),
    });
  }

  const sido = (url.searchParams.get("sido") || "").trim();
  const sigungu = (url.searchParams.get("sigungu") || "").trim();
  const months = Math.min(12, Math.max(1, Number(url.searchParams.get("months") || 4) || 4));
  const todayParam = (url.searchParams.get("today") || "").trim();
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : todayKst();

  const sidoEntry = REGIONS.find((r) => r.name === sido || shortSido(r.name) === sido);
  if (!sidoEntry) {
    return json(
      {
        ok: false,
        error: "unknown_sido",
        message: "시·도를 찾지 못했어요. /api/local-news?regions=1 로 지원하는 지역을 확인하세요.",
      },
      400
    );
  }

  const list = sigunguList(sidoEntry.name);
  const sigunguName = sigungu
    ? list.find((s) => s === sigungu || s === `${sigungu}시` || s === `${sigungu}군`) || ""
    : "";
  if (sigungu && !sigunguName) {
    return json(
      {
        ok: false,
        error: "unknown_sigungu",
        message: `${sidoEntry.name}에는 '${sigungu}' 가 없어요.`,
        sigungu: list,
      },
      400
    );
  }

  const news = localNewsFor(sidoEntry.name, sigunguName, today, months);
  return json({
    ok: true,
    sido: sidoEntry.name,
    sigungu: sigunguName,
    area: newsAreaName(sidoEntry.name, sigunguName),
    today,
    months,
    count: news.length,
    byCategory: {
      festival: news.filter((n) => n.category === "festival").length,
      event: news.filter((n) => n.category === "event").length,
      class: news.filter((n) => n.category === "class").length,
      welfare: news.filter((n) => n.category === "welfare").length,
    },
    links: regionLinks(sidoEntry.name, sigunguName),
    news,
  });
};
