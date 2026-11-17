/** 랭킹 2차 API 로컬 점검 — 배포 전에 /api/rankings(profile·groupbattle·area)와 /api/duiels 를 실제 Supabase 로 확인한다. */
import { onRequestGet as rankingsGet } from "../functions/api/rankings";
import { onRequestGet as duelsGet, onRequestPost as duelsPost } from "../functions/api/duels";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const base = "https://senior-life-platform.pages.dev";
async function get(path: string) {
  const res = await rankingsGet({ request: new Request(base + path), env } as never);
  return { status: res.status, body: await res.json() };
}
async function duelGet(path: string) {
  const res = await duelsGet({ request: new Request(base + path), env } as never);
  return { status: res.status, body: await res.json() };
}
async function duelPost(payload: unknown) {
  const res = await duelsPost({
    request: new Request(base + "/api/duels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    env,
  } as never);
  return { status: res.status, body: await res.json() };
}

const CODE = process.env.PROBE_CODE || "TF1J4S";
const TODAY = process.env.PROBE_TODAY || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const out: Record<string, unknown> = {};
out.profile = await get(`/api/rankings?scope=profile&code=${CODE}&today=${TODAY}`);
out.area = await get(`/api/rankings?area=all&range=national&code=${CODE}&today=${TODAY}&myd=40,0,0,0,0,0,0`);
out.groupbattle = await get(`/api/rankings?scope=groupbattle&code=${CODE}&today=${TODAY}`);
out.duels = await duelGet(`/api/duels?code=${CODE}&today=${TODAY}`);
// 다른 계정이 없으므로 자기 자신과의 대결은 거절돼야 한다.
out.duelSelf = await duelPost({ action: "create", code: CODE, today: TODAY, opponentCode: CODE, kind: "total" });
console.log(JSON.stringify(out, null, 1));
