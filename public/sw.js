/* 늘봄 서비스 워커 — ‘홈 화면에 추가’(앱 설치) 조건을 채우기 위한 최소 구성.
 *
 * 일부러 캐시를 하지 않는다: 예전 화면이 남아 “고쳤는데 그대로”가 되는 일을 막고,
 * 모든 요청은 그대로 네트워크로 보낸다(pass-through).
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  /* 아무것도 가로채지 않는다 — 브라우저가 평소처럼 네트워크에서 받는다 */
});
