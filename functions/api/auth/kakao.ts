import { dbStatus } from "../../../lib/db";
import type { DbEnv } from "../../../lib/db";

type Ctx = { request: Request; env: DbEnv };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function newCodeId(): string {
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

type KakaoUser = {
  id: number;
  kakao_account?: {
    profile?: { nickname?: string; profile_image_url?: string };
    name?: string;
    birthyear?: string;
    birthday?: string;
    email?: string;
  };
};

/** 카카오 로그인 설정 여부를 알려 준다 (클라이언트가 버튼 상태를 정할 때 사용) */
export const onRequestGet = async ({ request, env }: Ctx) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // 카카오 로그인 시작: 카카오 인가 화면으로 302 (REST 키는 서버에만 둔다)
  if (url.searchParams.get("start")) {
    if (!env.KAKAO_CLIENT_ID) return json({ ok: false, error: "kakao_not_configured" }, 503);
    const redirectUri = env.KAKAO_REDIRECT_URI || `${url.origin}/`;
    const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
    authorize.searchParams.set("client_id", env.KAKAO_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    return new Response(null, { status: 302, headers: { location: authorize.toString() } });
  }

  if (!code) {
    return json({
      ok: true,
      ...dbStatus(env),
      kakaoLoginConfigured: Boolean(env.KAKAO_CLIENT_ID),
      // JS 키가 있으면 클라이언트가 Kakao.Auth.authorize(throughTalk) 간편로그인을 쓸 수 있다
      kakaoJsConfigured: Boolean(env.NEXT_PUBLIC_KAKAO_JS_KEY),
      redirectUri: env.KAKAO_REDIRECT_URI || `${url.origin}/`,
    });
  }

  if (!env.KAKAO_CLIENT_ID) {
    return json({ ok: false, error: "kakao_not_configured" }, 503);
  }

  try {
    const redirectUri = env.KAKAO_REDIRECT_URI || `${url.origin}/`;
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.KAKAO_CLIENT_ID,
        // Client Secret 은 콘솔에서 '사용 안 함' 으로 둘 수 있으므로 선택값으로 취급한다.
        ...(env.KAKAO_CLIENT_SECRET ? { client_secret: env.KAKAO_CLIENT_SECRET } : {}),
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!tokenRes.ok) {
      return json({ ok: false, error: "kakao_token_failed", detail: await tokenRes.text() }, 502);
    }
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return json({ ok: false, error: "kakao_no_access_token" }, 502);

    const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) return json({ ok: false, error: "kakao_profile_failed" }, 502);
    const me = (await meRes.json()) as KakaoUser;

    const nickname = me.kakao_account?.profile?.nickname || "카카오 이용자";
    const birthYear = Number(me.kakao_account?.birthyear || 0);
    const profile = {
      id: `kakao_${me.id}`,
      nickname,
      birthYear: birthYear || 1955,
      sido: "",
      sigungu: "",
      source: "kakao" as const,
      createdAt: new Date().toISOString(),
      avatar: me.kakao_account?.profile?.profile_image_url,
    };
    return json({ ok: true, profile, needsProfile: true });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 300) }, 500);
  }
};

/** 원터치 체험 로그인 — 카카오 앱 키가 없어도 바로 시작할 수 있다 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  let body: {
    mode?: string;
    nickname?: string;
    birthYear?: number;
    sido?: string;
    sigungu?: string;
    code?: string;
    redirectUri?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (body.code && !body.nickname) {
    // 인가 코드를 교환할 때 쓰는 redirect_uri 는 인가 코드를 받을 때와 100% 같아야 한다.
    // 클라이언트(Kakao.Auth.authorize)가 넘긴 값과 서버가 쓸 값이 다르면 교환하지 않고 알린다.
    const url = new URL(request.url);
    const serverRedirectUri = env.KAKAO_REDIRECT_URI || `${url.origin}/`;
    const clientRedirectUri = (body.redirectUri || "").trim();
    if (clientRedirectUri && clientRedirectUri !== serverRedirectUri) {
      return json(
        {
          ok: false,
          error: "redirect_uri_mismatch",
          clientRedirectUri,
          serverRedirectUri,
        },
        400,
      );
    }
    // 인가 코드 교환 요청을 POST 로 보낸 경우 GET 핸들러 로직을 재사용
    url.searchParams.set("code", body.code);
    return onRequestGet({ request: new Request(url.toString()), env });
  }

  const nickname = (body.nickname || "").trim();
  if (!nickname) return json({ ok: false, error: "nickname_required" }, 400);
  const birthYear = Number(body.birthYear || 1955);

  const profile = {
    id: newCodeId(),
    nickname: nickname.slice(0, 20),
    birthYear,
    sido: body.sido || "",
    sigungu: body.sigungu || "",
    source: "demo" as const,
    createdAt: new Date().toISOString(),
  };
  return json({ ok: true, profile, mode: "demo", db: dbStatus(env).supabase });
};
