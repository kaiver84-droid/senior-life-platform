/**
 * 프로필 사진 URL 정리.
 *
 * 카카오는 예전 계정에 `http://` 주소(k.kakaocdn.net 등)를 돌려주기도 한다.
 * 아이폰 사파리는 https 화면에서 http 이미지를 막아(혼합 콘텐츠) 사진이 깨지므로
 * 저장·표시 전에 반드시 https 로 바꾼다.
 */
export function normalizeAvatarUrl(raw?: string | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  if (url.startsWith("https://")) return url;
  // data:/blob: 등은 저장하지 않는다(다른 기기에서 볼 수 없고 DB도 부풀린다).
  return undefined;
}
