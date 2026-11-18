"""모임 화면 측정 스니펫 — 로컬/라이브 검증에서 함께 쓴다."""

MEASURE = """
() => {
  const wrap = document.querySelector('.group-action');
  const btns = wrap ? Array.from(wrap.querySelectorAll('button')) : [];
  const lineCount = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    return rects.length;
  };
  const rows = btns.map((b) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return {
      text: (b.textContent || '').trim(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      scrollW: b.scrollWidth,
      clientW: b.clientWidth,
      wrap: cs.whiteSpace,
      fontSize: cs.fontSize,
      lines: lineCount(b),
      overflow: b.scrollWidth > b.clientWidth + 1 ? b.scrollWidth - b.clientWidth : 0,
    };
  });
  const input = document.querySelector('input[aria-label="모임 게시판에 남길 말"]');
  const submit = input && input.parentElement ? input.parentElement.querySelector('button') : null;
  let inputInfo = null;
  if (input) {
    const cs = getComputedStyle(input);
    const contentW = input.clientWidth; // input 의 clientWidth 는 안쪽 글자 영역
    const canvas = document.createElement('canvas');
    const c2 = canvas.getContext('2d');
    c2.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const phW = c2.measureText(input.placeholder).width;
    inputInfo = {
      ph: input.placeholder,
      w: Math.round(input.getBoundingClientRect().width),
      contentW: Math.round(contentW),
      phW: Math.round(phW),
      phFits: phW <= contentW,
      fontSize: cs.fontSize,
    };
  }
  const submitInfo = submit
    ? {
        text: (submit.textContent || '').trim(),
        w: Math.round(submit.getBoundingClientRect().width),
        h: Math.round(submit.getBoundingClientRect().height),
        lines: lineCount(submit),
      }
    : null;
  const doc = document.documentElement;
  const over = Array.from(document.querySelectorAll('main *'))
    .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
    .slice(0, 5)
    .map((el) => (el.tagName + '.' + (el.className || '')).slice(0, 60));
  return { rows, inputInfo, submitInfo, root: getComputedStyle(doc).fontSize, scrollW: doc.scrollWidth, clientW: doc.clientWidth, over };
}
"""
