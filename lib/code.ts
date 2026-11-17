/**
 * 사람 id(내부 id · 카카오 회원번호) → 6자리 기기/가족 코드.
 *
 * 화면(브라우저)과 API(서버)가 같은 코드를 만들어야 같은 사람의 기록을 찾을 수 있으므로
 * 계산식을 한 곳에 둔다.
 */
export function makeCode(seed?: string): string {
  const base = seed || Math.random().toString(36).slice(2);
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString(36).toUpperCase();
  return n.slice(-6).padStart(6, "0");
}
