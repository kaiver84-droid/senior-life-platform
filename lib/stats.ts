/**
 * 더보기 탭 ‘늘봄 현황’ — 서버(/api/stats)에서 전체 가입자 수·현재 접속자 수를 받는다.
 * 서버를 못 부르면 null 을 돌려주고, 화면은 ‘—’ 를 그대로 둔다.
 */

export type CommunityStats = {
  totalUsers: number;
  onlineUsers: number;
};

export async function fetchCommunityStats(code: string): Promise<CommunityStats | null> {
  const q = new URLSearchParams();
  if (code) q.set("code", code);
  const qs = q.toString();
  try {
    const res = await fetch(`/api/stats${qs ? `?${qs}` : ""}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    const totalUsers = Math.round(Number(j.totalUsers));
    const onlineUsers = Math.round(Number(j.onlineUsers));
    if (!Number.isFinite(totalUsers) || !Number.isFinite(onlineUsers)) return null;
    return {
      totalUsers: Math.max(0, totalUsers),
      // 화면을 열어 둔 사람은 최소 한 명
      onlineUsers: Math.max(1, onlineUsers),
    };
  } catch {
    return null;
  }
}
