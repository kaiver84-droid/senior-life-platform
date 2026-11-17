/**
 * 프로필 사진(avatar_url) 연동 로컬 검증 — 실제 Supabase 프로젝트를 쓴다.
 *
 * 확인 항목
 * 1) /api/state 로 저장할 때 `http://` 사진 주소가 `https://` 로 바뀌어 users.avatar_url 에 남는지
 * 2) /api/groups 가 모임원마다 avatarUrl 을 내려 주는지(사진 없는 사람은 비어 있는지)
 * 3) /api/rankings 가 순위표의 '나' 줄에 avatarUrl 을 붙여 주는지
 *
 * 실행: node e2e/.avatar-api.mjs
 */
import http from "node:http";
import { onRequestGet as stateGet, onRequestPost as statePost } from "../functions/api/state";
import { onRequestGet as groupsGet, onRequestPost as groupsPost } from "../functions/api/groups";
import { onRequestGet as rankingsGet } from "../functions/api/rankings";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const PORT = 8097;

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const request = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const ctx = { request, env } as never;
  let response: Response;
  if (url.pathname === "/api/state") response = req.method === "POST" ? await statePost(ctx) : await stateGet(ctx);
  else if (url.pathname === "/api/groups") response = req.method === "POST" ? await groupsPost(ctx) : await groupsGet(ctx);
  else if (url.pathname === "/api/rankings") response = await rankingsGet(ctx);
  else response = new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404 });
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
});

const results: Record<string, unknown> = {};
const check = (label: string, ok: boolean, extra?: unknown) => {
  results[label] = { ok, ...(extra === undefined ? {} : { extra }) };
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`, extra === undefined ? "" : JSON.stringify(extra));
};

const get = async (path: string) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return { status: r.status, json: await r.json().catch(() => null) };
};

const post = async (path: string, body: unknown) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const SAMPLE = "http://i.pravatar.cc/300?img=52"; // 카카오가 http:// 로 줄 때를 흉내 낸다
const CODE = "AVT001";
const CODE2 = "AVT002";

server.listen(PORT, "127.0.0.1", async () => {
  try {
    // 1) /api/state 저장 — http → https 로 바뀌어 저장되는지
    const saved = await post("/api/state", {
      code: CODE,
      profile: {
        id: "kakao_avatar_test_1",
        nickname: "사진순자",
        birthYear: 1952,
        birthTime: "묘시",
        sido: "충청북도",
        sigungu: "옥천군",
        source: "kakao",
        createdAt: new Date().toISOString(),
        avatarUrl: SAMPLE,
        avatar: SAMPLE,
        profileCompleted: true,
      },
      today: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10),
    });
    check("/api/state 저장 200", saved.status === 200 && saved.json?.ok === true, saved.json);

    const fetched = await get(`/api/state?code=${CODE}`);
    check(
      "state.profile.avatarUrl 이 https 로 저장됨",
      fetched.json?.state?.profile?.avatarUrl === "https://i.pravatar.cc/300?img=52",
      fetched.json?.state?.profile?.avatarUrl
    );

    // 2) /api/groups — 모임원별 avatarUrl (먼저 체험 모임에 들어간다)
    const joined = await post("/api/groups", {
      action: "join",
      code: CODE,
      groupId: "FAM101",
      name: "사진순자",
      me: { name: "사진순자", points: 9999, days: 7, today: true },
    });
    check("체험 모임 가입 200", joined.status === 200 && joined.json?.ok === true, joined.json?.error);
    const g = await get(`/api/groups?code=${CODE}`);
    const members = g.json?.detail?.members ?? [];
    const me = members.find((m: { isMe: boolean }) => m.isMe);
    const demo = members.find((m: { isDemo: boolean }) => m.isDemo);
    check("/api/groups 모임원 avatarUrl", me?.avatarUrl === "https://i.pravatar.cc/300?img=52", {
      memberCount: members.length,
      me: me?.avatarUrl,
    });
    check("사진 없는 체험 모임원은 avatarUrl 없음", demo ? !demo.avatarUrl : false, { demo: demo?.name });

    // 3) /api/rankings — 순위표 '나' 줄에 사진
    const r = await get(`/api/rankings?scope=region&code=${CODE}&sido=충청북도&sigungu=옥천군&name=사진순자&points=9999&streak=7`);
    const meRow = (r.json?.rows ?? []).find((x: { isMe: boolean }) => x.isMe);
    check("/api/rankings 순위표 '나' 줄 avatarUrl", meRow?.avatarUrl === "https://i.pravatar.cc/300?img=52", {
      rank: meRow?.rank,
      name: meRow?.name,
      avatar: meRow?.avatarUrl,
    });
    check("사진 없는 다른 순위 줄은 avatarUrl 없음(첫 글자 폴백)", (r.json?.rows ?? []).length > 1, {
      rows: (r.json?.rows ?? []).length,
    });

    // 정리용 코드 출력(테스트 계정은 호출한 쪽이 지운다)
    check("테스트 코드", true, { CODE, CODE2 });
  } catch (e) {
    check("예외", false, String(e));
  } finally {
    console.log("\nRESULT " + JSON.stringify(results));
    server.close();
  }
});
