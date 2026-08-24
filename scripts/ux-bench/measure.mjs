// scripts/ux-bench/measure.mjs
//
// **한 번의 페이지 로드에서 4축을 재는 브라우저 내 측정식.**
//
// 왜 문자열인가: Vocaflow 와 **경쟁 플랫폼**에 똑같이 주입해야 한다.
// 두 곳을 다른 코드로 재면 그 비교는 아무것도 증명하지 못한다 — 같은 자를 써야 한다.
//
// 여기 있는 것은 전부 **판단이 필요 없는 값**이다. "예쁜가" 는 못 재지만
// "본문 대비가 4.5:1 인가 · 폰트 크기가 몇 종인가 · 44px 인가" 는 잰다.
// 재는 것만 점수에 넣는다 — 못 재는 것을 점수에 넣으면 그 점수는 의견이다.

export const MEASURE_FN = String.raw`() => {
  // 프레임셋이거나 아직 본문이 없으면 잴 것이 없다.
  // ⚠️ 실측 2026-08-25: 국내 대상 하나가 이 경우였고, 가드가 없어 createTreeWalker 가
  //    던지면서 **측정 실패가 예외로 새어 나갔다**. 실패는 값으로 돌려야 걸러진다.
  if (!document.body) return { fatal: 'NO_BODY' };

  // ── 색 ──────────────────────────────────────────────────────────────
  const parseColor = (s) => {
    if (!s) return null;
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const over = (fg, bg) => fg.a >= 1 ? fg : ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  });
  /**
   * 조상을 거슬러 **불투명한** 배경을 찾는다. 못 찾으면 흰색(문서 기본).
   *
   * ⚠️ 그라디언트·배경이미지를 만나면 **모른다고 답한다**('gradient: true').
   *    실측 2026-08-25: '/arcade' 는 'background: radial-gradient(...)' 로 어두운 무대를 깔고
   *    밝은 글자를 얹는다. 'backgroundColor' 는 비어 있으므로 위로 계속 올라가다 흰색으로
   *    떨어지고, 그래서 **68개 글자 중 59개가 "대비 미달"** 로 잡혔다 — 화면은 멀쩡한데
   *    자가 틀린 것이다. 그 값으로 "디자인 31.7점" 을 보고할 뻔했다.
   *
   *    한 픽셀 색을 DOM 만으로 정확히 알 수는 없다(층·투명도·혼합 모드). 그래서
   *    **점수로 바꾸지 않고 분모에서 뺀다** — 못 잰 것을 통과로도, 실패로도 세지 않는다.
   *    대신 못 잰 개수를 그대로 낸다('contrastUnknown'): 0 이 아니면 눈으로 볼 대상이다.
   */
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { gradient: true };
      const c = parseColor(cs.backgroundColor);
      if (c && c.a >= 0.999) return c;
      n = n.parentElement;
    }
    const rootCs = getComputedStyle(document.documentElement);
    if (rootCs.backgroundImage && rootCs.backgroundImage !== 'none') return { gradient: true };
    const html = parseColor(rootCs.backgroundColor);
    return html && html.a >= 0.999 ? html : { r: 255, g: 255, b: 255, a: 1 };
  };

  const vh = document.documentElement.clientHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    return true;
  };

  // ── 축 1. 디자인 ─────────────────────────────────────────────────────
  // D1 본문 대비 (WCAG 1.4.3 AA) · D2 타이포 종수 · D3 색 종수 · D4 4px 그리드
  const fontSizes = new Map();
  const textColors = new Set();
  const bgColors = new Set();
  let textNodes = 0, contrastFail = 0, contrastUnknown = 0;
  const contrastWorst = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = walker.nextNode())) {
    const t = (tn.nodeValue || '').trim();
    if (t.length < 2) continue;
    const el = tn.parentElement;
    if (!el || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh * 3) continue;    // 첫 3화면만 — 무한 스크롤 사이트 보호
    const cs = getComputedStyle(el);
    const fg0 = parseColor(cs.color);
    if (!fg0) continue;
    const bg = bgOf(el);
    const size = parseFloat(cs.fontSize) || 16;
    const weight = Number(cs.fontWeight) || 400;
    // 규율 지표(폰트 종수·글자색 종수)는 배경을 몰라도 셀 수 있다 — 먼저 센다.
    fontSizes.set(Math.round(size), (fontSizes.get(Math.round(size)) || 0) + 1);
    textColors.add(cs.color);
    if (bg.gradient) { contrastUnknown++; continue; }   // 대비만 못 잰다
    const fg = over(fg0, bg);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    textNodes++;
    bgColors.add('rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')');
    if (got < need - 0.05) {
      contrastFail++;
      if (contrastWorst.length < 8) contrastWorst.push({ text: t.slice(0, 28), got: Math.round(got * 100) / 100, need, size: Math.round(size) });
    }
  }

  // 4px 그리드 — 보이는 블록 요소의 padding/gap 이 4의 배수인가 (디자인 시스템 규율의 대리 지표)
  let spacingTotal = 0, spacingOnGrid = 0;
  const offCount = {};                 // 격자 밖 값 -> 몇 번 (무엇을 고칠지 바로 나오게)
  const blocks = Array.from(document.body.querySelectorAll('div,section,article,li,header,footer,main,nav,button,a')).slice(0, 900);
  for (const el of blocks) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    for (const prop of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'gap']) {
      const v = parseFloat(cs[prop]);
      if (!v || Number.isNaN(v)) continue;
      spacingTotal++;
      if (Math.abs(v % 4) < 0.51 || Math.abs((v % 4) - 4) < 0.51) spacingOnGrid++;
      else {
        const k = Math.round(v * 10) / 10;
        offCount[k] = (offCount[k] || 0) + 1;
      }
    }
  }
  // 상위 8개만 — "68% 가 격자 밖" 은 어디를 고칠지 말해 주지 않는다. 값이 말해 준다.
  const spacingOff = Object.entries(offCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => ({ px: Number(e[0]), n: e[1] }));

  // ── 축 2. 사용성 ─────────────────────────────────────────────────────
  const CTRL = 'button, [role="button"], a[href], input, select, textarea, [role="link"], [role="tab"], [role="checkbox"], [role="switch"]';
  const ctrls = Array.from(document.querySelectorAll(CTRL)).filter(visible);
  let ctrlTotal = 0, ctrlBig = 0, ctrlNamed = 0;
  const smallSample = [];
  const namelessSample = [];
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    const host = el.closest('label') || el;
    const hr = host.getBoundingClientRect();
    const w = Math.max(r.width, hr.width), h = Math.max(r.height, hr.height);
    ctrlTotal++;
    if (w >= 44 && h >= 44) ctrlBig++;
    else if (smallSample.length < 8) smallSample.push({ tag: el.tagName.toLowerCase(), w: Math.round(w), h: Math.round(h), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) });
    let name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('alt') || '').trim();
    if (!name && el.getAttribute('aria-labelledby')) name = 'ref';
    if (!name && el.id) { try { if (document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) name = 'label'; } catch (e) { /* noop */ } }
    if (!name) { const lb = el.closest('label'); if (lb && lb.textContent.trim()) name = 'wrap'; }
    if (!name && el.querySelector('img[alt]:not([alt=""]), svg title')) name = 'img';
    if (name) ctrlNamed++;
    else if (namelessSample.length < 8) namelessSample.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 30) });
  }

  const de = document.documentElement;
  const overflowPx = Math.max(0, de.scrollWidth - de.clientWidth);
  const main = document.querySelector('main, [role="main"]');
  const h1s = Array.from(document.querySelectorAll('h1')).filter(visible);
  const hasNav = !!document.querySelector('nav, [role="navigation"]');
  const hasLang = !!document.documentElement.getAttribute('lang');
  const title = (document.title || '').trim();
  const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map((h) => Number(h.tagName[1]));
  let headSkips = 0;
  for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) headSkips++;
  const imgs = Array.from(document.querySelectorAll('img')).filter(visible);
  const imgsWithAlt = imgs.filter((i) => i.hasAttribute('alt')).length;

  // ── 축 3. 연계성 ─────────────────────────────────────────────────────
  const here = location.pathname;
  const scope = main || document.body;
  // 셸(사이드바·헤더·하단 탭)은 **랜드마크로** 판별한다.
  // ⚠️ 첫 판은 "셸 = 전체 − 본문" 이었다. 그러면 <main> 이 없는 사이트에서 셸이
  //    **원리적으로 0** 이 된다(전체 = 본문이므로). 상대를 구조적으로 깎는 계측은
  //    비교를 무의미하게 만든다 — 우위가 제품이 아니라 자에서 나오기 때문이다.
  // ⚠️ 두 번째 판: **본문 안의 nav 는 셸이 아니다.** 화면 자신의 탭 줄('<nav>' 로 마크업된
  //    면 전환)은 학습자에게 진짜 앞길인데, 이름이 nav 라는 이유로 빼면 그 화면이
  //    "막다른 길" 로 잡힌다. 셸은 **본문 밖의** 랜드마크다 — 위치로 판별한다.
  const shellEls = Array.from(document.querySelectorAll('nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]'))
    .filter((s) => !(main && main.contains(s)));
  const inShell = (el) => shellEls.some((s) => s.contains(el));
  const paths = (root, opts) => {
    const out = new Set();
    for (const a of Array.from(root.querySelectorAll('a[href]'))) {
      if (!visible(a)) continue;
      if (opts && opts.shellOnly && !inShell(a)) continue;
      if (opts && opts.skipShell && inShell(a)) continue;
      const href = a.getAttribute('href') || '';
      let p = null;
      if (href.startsWith('/')) p = href.split('?')[0].split('#')[0];
      else if (/^https?:/.test(href)) { try { const u = new URL(href); if (u.origin === location.origin) p = u.pathname; } catch (e) { /* noop */ } }
      if (!p || p === here) continue;
      out.add(p);
    }
    return out;
  };
  const forward = paths(scope, { skipShell: true });
  const shell = paths(document.body, { shellOnly: true });
  let actionButtons = 0;
  for (const b of Array.from(scope.querySelectorAll('button,[role="button"]'))) {
    if (!visible(b) || inShell(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) continue;
    if ((b.getAttribute('aria-label') || b.textContent || '').trim()) actionButtons++;
  }
  const hasCurrent = !!document.querySelector('[aria-current]');
  const hasBreadcrumb = !!document.querySelector('nav[aria-label*="bread" i], [class*="breadcrumb" i]');

  // ── 축 4. 흐름성 ─────────────────────────────────────────────────────
  // 첫 화면(above the fold)에 **누를 수 있는 다음 행동**이 있는가.
  let foldActions = 0;
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.top < vh && r.width >= 44 && r.height >= 44) {
      if ((el.getAttribute('aria-label') || el.textContent || '').trim()) foldActions++;
    }
  }
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = performance.getEntriesByType('paint');
  const fcp = paints.find((p) => p.name === 'first-contentful-paint');
  return {
    textNodes: textNodes, contrastFail: contrastFail, contrastUnknown: contrastUnknown, contrastWorst: contrastWorst,
    fontSizeKinds: fontSizes.size,
    textColorKinds: textColors.size,
    bgColorKinds: bgColors.size,
    spacingTotal: spacingTotal, spacingOnGrid: spacingOnGrid, spacingOff: spacingOff,
    ctrlTotal: ctrlTotal, ctrlBig: ctrlBig, ctrlNamed: ctrlNamed,
    smallSample: smallSample, namelessSample: namelessSample,
    overflowPx: overflowPx, hasMain: !!main, hasNav: hasNav, hasLang: hasLang, h1Count: h1s.length,
    title: title, headSkips: headSkips, headCount: heads.length,
    imgCount: imgs.length, imgsWithAlt: imgsWithAlt,
    forwardPaths: forward.size, shellPaths: shell.size,
    actionButtons: actionButtons, hasCurrent: hasCurrent, hasBreadcrumb: hasBreadcrumb,
    foldActions: foldActions,
    domInteractive: nav ? Math.round(nav.domInteractive) : -1,
    loadEventEnd: nav ? Math.round(nav.loadEventEnd) : -1,
    fcp: fcp ? Math.round(fcp.startTime) : -1,
    domNodes: document.getElementsByTagName('*').length,
  };
}`;
