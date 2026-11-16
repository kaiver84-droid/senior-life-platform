import { buildRanking } from "../../lib/rankings";
import { weekIdOf } from "../../lib/week";
import type { RankingScope } from "../../lib/types";

type Ctx = { request: Request; env: unknown };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const onRequestGet = async ({ request }: Ctx) => {
  const p = new URL(request.url).searchParams;
  const scopeParam = p.get("scope") || "region";
  const scope: RankingScope =
    scopeParam === "zodiac" || scopeParam === "streak" ? (scopeParam as RankingScope) : "region";

  const result = buildRanking({
    scope,
    weekId: p.get("weekId") || weekIdOf(),
    sido: p.get("sido") || "",
    sigungu: p.get("sigungu") || "",
    birthYear: Number(p.get("birthYear") || 1955),
    myName: p.get("name") || "나",
    myPoints: Number(p.get("points") || 0),
    myStreak: Number(p.get("streak") || 0),
  });

  return json({ ok: true, ...result });
};
