/**
 * 공유 상황별 제목·설명 — 카카오톡 미리보기(OG 메타태그)와 앱의 공유 버튼이
 * **같은 문구**를 쓰도록 한 곳에서 정한다.
 *
 * - DOM 을 쓰지 않는다(문자열만 다룬다) → 브라우저 컴포넌트와
 *   Cloudflare Pages Functions(worker) 양쪽에서 그대로 import 한다.
 * - worker 는 이 모듈의 applyShareMeta() 로 정적 HTML 의 <title>·og:* 를 바꿔 내려보내고,
 *   앱은 shareLinkFor() 로 ‘그 상황의 주소’를 만들어 보낸다.
 */

export type ShareSituation =
  | "home"
  | "family"
  | "invite"
  | "quiz"
  | "welfare"
  | "ranking"
  | "groups"
  | "greeting"
  | "fortune"
  | "more";

export type ShareMeta = {
  title: string;
  description: string;
  /** 카카오톡 피드 버튼 글자 */
  buttonTitle: string;
  /** 공유 카드 이미지 경로(사이트 기준) */
  image: string;
};

/** worker 에서도 안전하게 쓰는 기본 주소(브라우저에서는 window.location.origin 을 먼저 쓴다) */
export const SITE_ORIGIN = "https://senior-life-platform.pages.dev";

/**
 * 상황별 카카오 피드 카드 이미지(1200×630).
 * 예전에는 어떤 상황이든 같은 로고 배너(/share-card.png)가 떠서 “무슨 링크인지”가
 * 카드에서 보이지 않았다. 이제는 상황마다 그 상황을 그림으로 보여 준다.
 * (home·ranking·more 는 대표 배너를 그대로 쓴다)
 */
export const SHARE_IMAGE_BY_SITUATION: Record<ShareSituation, string> = {
  home: "/share-card.png",
  family: "/images/share-family.png",
  invite: "/images/share-group.png",
  groups: "/images/share-group.png",
  quiz: "/images/share-quiz.png",
  welfare: "/images/share-welfare.png",
  ranking: "/share-card.png",
  greeting: "/images/share-greeting.png",
  fortune: "/images/share-fortune.png",
  more: "/share-card.png",
};

/** 업로드한 ‘내가 만든 카드’를 가리킬 때 쓰는 종류 — 이 이름들이 저장 경로·주소에 들어간다 */
export const CARD_IMAGE_KINDS = ["greeting", "quiz", "welfare", "group", "family", "fortune", "memory"] as const;
export type CardImageKind = (typeof CARD_IMAGE_KINDS)[number];

export function isCardImageKind(value: string): value is CardImageKind {
  return (CARD_IMAGE_KINDS as readonly string[]).includes(value);
}

/** 상황 → 그 상황의 기본 카드 이미지 경로(사이트 기준) */
export function shareImageFor(situation: ShareSituation): string {
  return SHARE_IMAGE_BY_SITUATION[situation] || "/share-card.png";
}

/** 상황 → 절대 주소(카카오에 그대로 넘기는 값) */
export function shareImageUrlFor(situation: ShareSituation, origin?: string): string {
  const base = (origin || siteOrigin()).replace(/\/+$/, "");
  return `${base}${shareImageFor(situation)}`;
}

/** 앱의 공유 카드 종류(lib/canvas) → OG 상황 */
export function situationForCardKind(kind: string): ShareSituation {
  switch (kind) {
    case "greeting":
      return "greeting";
    case "quiz":
      return "quiz";
    case "health":
      return "welfare";
    case "invite":
      return "invite";
    default:
      return "home";
  }
}

const DEFAULT_META: ShareMeta = {
  title: "늘봄 | 언제나, 늘 곁에 있는 시니어 생활 플랫폼",
  description:
    "운세와 안부 인사카드, 1분 치매예방 퀴즈와 명예의 전당, 맞춤형 정부 지원금, 돋보기·생활 가이드, 가족 안부와 복약 체크를 한 곳에서. 늘봄 — 언제나, 늘 곁에 있는 시니어를 위한 스마트한 생활 플랫폼.",
  buttonTitle: "늘봄 열기",
  image: "/share-card.png",
};

export function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return SITE_ORIGIN;
}

/** 모임 코드 — 6자리 영문·숫자(?group=·?join=) */
export function groupCodeFromParams(params: URLSearchParams): string {
  const raw = (params.get("group") || params.get("join") || "").trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(raw) ? raw : "";
}

/**
 * 지금 주소가 어떤 상황인지 — 앞에 있는 것이 더 구체적이다.
 * (모임 초대 > 안부·운세 공유 > 탭)
 */
export function shareSituationFor(pathname: string, params: URLSearchParams): ShareSituation {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  const share = (params.get("share") || "").toLowerCase();
  const tab = (params.get("tab") || "").toLowerCase();

  if (path === "/family" || path === "/family/index.html") return "family";

  if (groupCodeFromParams(params)) return "invite";

  if (share === "greeting" || share === "anbu") return "greeting";
  if (share === "fortune" || share === "unse") return "fortune";

  if (tab === "quiz") return "quiz";
  if (tab === "welfare") return "welfare";
  if (tab === "ranking") return "ranking";
  if (tab === "groups" || tab === "group") return "groups";
  if (tab === "more") return "more";
  return "home";
}

/**
 * 상황별 제목·설명. 모임 초대는 모임 이름을 넣어 “어디로 초대하는지”가 보이게 한다.
 * (이름을 못 찾아도 초대 전용 문구를 그대로 쓴다 — 대표 소개 문구로 돌아가지 않는다)
 */
export function shareMetaFor(
  situation: ShareSituation,
  opts: { groupCode?: string; groupName?: string } = {}
): ShareMeta {
  const code = (opts.groupCode || "").trim().toUpperCase();
  const name = cleanName(opts.groupName);

  switch (situation) {
    case "invite":
      if (name) {
        return {
          title: `${name} 모임에 초대합니다 | 늘봄`,
          description: code
            ? `초대 번호 ${code} · 매일 안부와 치매예방 퀴즈를 함께해요`
            : "매일 안부와 치매예방 퀴즈를 함께해요",
          buttonTitle: "모임 들어가기",
          image: shareImageFor("invite"),
        };
      }
      return {
        title: "늘봄 모임에 초대합니다",
        description: code
          ? `초대 번호 ${code} · 매일 안부와 치매예방 퀴즈를 함께해요`
          : "매일 안부와 치매예방 퀴즈를 함께해요",
        buttonTitle: "모임 들어가기",
        image: shareImageFor("invite"),
      };

    case "family":
      return {
        title: "늘봄 가족 안부 확인",
        description: "가족의 오늘 안부·건강 챌린지·복약 기록을 확인해 보세요",
        buttonTitle: "가족 안부 보기",
        image: shareImageFor("family"),
      };

    case "quiz":
      return {
        title: "늘봄 1분 치매예방 퀴즈",
        description: "초성·옛날노래·OX 퀴즈로 두뇌 건강을 챙겨보세요",
        buttonTitle: "퀴즈 풀기",
        image: shareImageFor("quiz"),
      };

    case "welfare":
      return {
        title: "늘봄 오늘의 복지 혜택",
        description: "내 나이와 동네에 맞는 지원금과 신청 방법 3단계를 확인해 보세요",
        buttonTitle: "혜택 보기",
        image: shareImageFor("welfare"),
      };

    case "ranking":
      return {
        title: "늘봄 이번 주 랭킹",
        description: "우리 동네와 모임 순위를 확인하고 함께 응원해 보세요",
        buttonTitle: "랭킹 보기",
        image: DEFAULT_META.image,
      };

    case "groups":
      return {
        title: "늘봄 우리 모임",
        description: "가족·친구와 모임을 만들어 매일 안부를 나누세요",
        buttonTitle: "모임 보기",
        image: shareImageFor("groups"),
      };

    case "greeting":
      return {
        title: "오늘도 마음을 전해 보세요 | 늘봄",
        description: "가족·친구에게 안부 인사카드를 보내고 오늘의 운세도 함께 나눠요",
        buttonTitle: "안부 보내기",
        image: shareImageFor("greeting"),
      };

    case "fortune":
      return {
        title: "오늘의 운세, 함께 볼까요? | 늘봄",
        description: "생년월일로 보는 오늘의 운세와 행운의 색·숫자를 확인해 보세요",
        buttonTitle: "운세 보기",
        image: shareImageFor("fortune"),
      };

    case "more":
      return {
        title: "늘봄 더보기",
        description: "돋보기·생활 가이드와 내 정보를 한 곳에서 확인해 보세요",
        buttonTitle: "늘봄 열기",
        image: DEFAULT_META.image,
      };

    default:
      return DEFAULT_META;
  }
}

/** 복지 혜택 하나를 카톡으로 보낼 때의 제목·설명 — 앱 공유 버튼과 worker 의 OG 가 같은 문구를 쓴다 */
export function programShareMeta(program: {
  title: string;
  amount: string;
  org: string;
  phone?: string;
}): ShareMeta {
  const phone = (program.phone || "").trim();
  const contact = `${program.org}${phone ? ` · ${phone}` : ""}`.trim();
  return {
    title: `${program.title} | 늘봄`,
    description: `${program.amount} · ${contact}`.slice(0, 120),
    buttonTitle: "혜택 보기",
    image: shareImageFor("welfare"),
  };
}

/**
 * 상황에 맞는 ‘그 링크’ — 이 주소로 보내야 카톡 미리보기도 그 상황으로 뜬다.
 * card 를 넘기면 그 카드(이미 올려 둔 내 카드 PNG)를 미리보기 이미지로 쓰도록
 * `?card=<종류>&h=<해시>` 를 붙인다 — 링크를 그대로 붙여 넣어도 같은 카드가 뜨다.
 */
export function shareLinkFor(
  situation: ShareSituation,
  opts: {
    origin?: string;
    groupCode?: string;
    ref?: string;
    familyCode?: string;
    /** 복지 혜택 상세를 바로 열 링크(?tab=welfare&program=<id>) */
    program?: string;
    card?: { kind: CardImageKind; hash: string };
  } = {}
): string {
  const origin = (opts.origin || siteOrigin()).replace(/\/+$/, "");
  const code = (opts.groupCode || "").trim().toUpperCase();
  const familyCode = (opts.familyCode || "").trim().toUpperCase();
  const withRef = (url: string) => {
    let out = url;
    if (opts.card?.hash && isCardImageKind(opts.card.kind)) {
      const sep = out.includes("?") ? "&" : "?";
      out = `${out}${sep}card=${opts.card.kind}&h=${encodeURIComponent(opts.card.hash)}`;
    }
    if (!opts.ref) return out;
    const sep = out.includes("?") ? "&" : "?";
    return `${out}${sep}ref=${encodeURIComponent(opts.ref)}`;
  };

  switch (situation) {
    case "invite":
      return withRef(`${origin}/?group=${encodeURIComponent(code)}`);
    case "family": {
      const base = `${origin}/family/${familyCode ? `?code=${encodeURIComponent(familyCode)}` : ""}`;
      if (!opts.card?.hash || !isCardImageKind(opts.card.kind)) return base;
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}card=${opts.card.kind}&h=${encodeURIComponent(opts.card.hash)}`;
    }
    case "quiz":
      return withRef(`${origin}/?tab=quiz`);
    case "welfare": {
      const id = (opts.program || "").trim();
      return withRef(`${origin}/?tab=welfare${id ? `&program=${encodeURIComponent(id)}` : ""}`);
    }
    case "ranking":
      return withRef(`${origin}/?tab=ranking`);
    case "groups":
      return withRef(`${origin}/?tab=groups`);
    case "greeting":
      return withRef(`${origin}/?share=greeting`);
    case "fortune":
      return withRef(`${origin}/?share=fortune`);
    case "more":
      return withRef(`${origin}/?tab=more`);
    default:
      return withRef(`${origin}/`);
  }
}

/* ------------------------------------------------------------------ */
/* 정적 HTML 의 메타태그 바꿔치기 (worker 전용)                        */
/* ------------------------------------------------------------------ */

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function esc(value: string): string {
  return String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPE[c]);
}

/** 모임 이름은 화면에 그대로 나가므로 줄바꿈·과한 길이를 정리한다 */
function cleanName(raw?: string): string {
  if (!raw) return "";
  return String(raw).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
}

/**
 * <meta name="…"> / <meta property="…"> 의 content 를 바꾼다.
 * 없으면 </head> 앞에 새로 넣는다(Next 가 뺀 태그도 상황에 맞게 붙일 수 있게).
 */
function setMeta(html: string, attr: "name" | "property", key: string, content: string): string {
  const tagRe = /<meta\b[^>]*>/gi;
  let replaced = false;
  const next = html.replace(tagRe, (tag) => {
    if (!new RegExp(`\\b${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i").test(tag)) return tag;
    replaced = true;
    if (/\bcontent="/i.test(tag)) return tag.replace(/\bcontent="[^"]*"/i, `content="${esc(content)}"`);
    return tag.replace(/\s*\/?>$/, ` content="${esc(content)}"/>`);
  });
  if (replaced) return next;
  return next.replace(/<\/head>/i, `<meta ${attr}="${key}" content="${esc(content)}"/></head>`);
}

export type ApplyShareMetaOptions = {
  /** 지금 요청 주소 — og:url 로 넣는다(?ref= 같은 추적 값은 뺀다) */
  url?: string;
  imageUrl?: string;
};

/**
 * 정적 HTML 의 대표 제목·설명을 상황에 맞게 바꾼다.
 * 카카오톡·메신저 미리보기는 og:title / og:description / <title> 을 먼저 본다.
 */
export function applyShareMeta(html: string, meta: ShareMeta, opts: ApplyShareMetaOptions = {}): string {
  const title = esc(meta.title);
  const description = esc(meta.description);
  // meta.image 는 사이트 기준 경로(/images/share-*.png)이거나, 업로드한 카드의 절대 주소다.
  const imageUrl = opts.imageUrl || (/^https?:\/\//i.test(meta.image) ? meta.image : `${SITE_ORIGIN}${meta.image}`);

  let out = html;

  // <title>
  if (/<title>[\s\S]*?<\/title>/i.test(out)) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  } else {
    out = out.replace(/<\/head>/i, `<title>${title}</title></head>`);
  }

  out = setMeta(out, "name", "description", meta.description);
  out = setMeta(out, "property", "og:title", meta.title);
  out = setMeta(out, "property", "og:description", meta.description);
  out = setMeta(out, "property", "og:url", cleanUrl(opts.url));
  out = setMeta(out, "property", "og:image", imageUrl);
  out = setMeta(out, "property", "og:site_name", "늘봄");
  out = setMeta(out, "name", "twitter:title", meta.title);
  out = setMeta(out, "name", "twitter:description", meta.description);
  out = setMeta(out, "name", "twitter:image", imageUrl);

  return out;
}

/** og:url 에는 추적용 ref 만 빼고 경로·상황 파라미터를 남긴다 */
function cleanUrl(raw?: string): string {
  if (!raw) return SITE_ORIGIN + "/";
  try {
    const url = new URL(raw);
    url.searchParams.delete("ref");
    return url.toString();
  } catch {
    return raw;
  }
}

/** 테스트·검증용 — 지금 요청 주소로 어떤 OG 가 나갈지 */
export function shareMetaForUrl(url: string, opts: { groupName?: string } = {}): ShareMeta {
  try {
    const parsed = new URL(url, SITE_ORIGIN);
    const situation = shareSituationFor(parsed.pathname, parsed.searchParams);
    return shareMetaFor(situation, {
      groupCode: groupCodeFromParams(parsed.searchParams),
      groupName: opts.groupName,
    });
  } catch {
    return DEFAULT_META;
  }
}
