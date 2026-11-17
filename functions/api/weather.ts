import { fetchWeatherLive } from "../../lib/weather";
import { REGIONS } from "../../lib/regions";

/**
 * 날씨 조회 API — 화면 대신 서버가 날씨를 받아 준다.
 *
 *   GET /api/weather?sido=충청북도&sigungu=옥천군
 *
 * 왜 서버를 거치나: 아이폰 Safari 나 카카오톡 안 화면에서는 바깥 날씨 주소가
 * 막히거나 느려 "날씨 정보를 불러오지 못했어요"가 뜨는 일이 있었다.
 * 서버(Cloudflare)가 대신 조회하면 화면은 같은 주소(/api/weather)만 부르면 된다.
 * Open-Meteo 가 안 되면 MET Norway 로 한 번 더 시도한다.
 */

type Ctx = { request: Request; env: Record<string, unknown> };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
      "access-control-allow-origin": "*",
    },
  });

export const onRequestGet = async ({ request }: Ctx) => {
  const url = new URL(request.url);
  const sido = (url.searchParams.get("sido") || "").trim();
  const sigungu = (url.searchParams.get("sigungu") || "").trim();

  if (url.searchParams.get("regions")) {
    return json({
      ok: true,
      regions: REGIONS.map((r) => ({ name: r.name, sigungu: r.sigungu })),
    });
  }

  const info = await fetchWeatherLive(sido, sigungu);
  if (!info.ok) {
    // 실패해도 200 으로 안내 값을 준다 — 화면이 '불러오는 중'에 멈추지 않게.
    return json({ ...info, ok: false, region: { sido, sigungu } });
  }
  return json({ ...info, ok: true, region: { sido, sigungu } });
};
