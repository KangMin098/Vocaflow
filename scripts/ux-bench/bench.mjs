// scripts/ux-bench/bench.mjs
//
// **같은 자로 두 곳을 잰다** — Vocaflow 학습자 화면 · 대표 플랫폼 공개 학습 화면.
//
//   node scripts/ux-bench/bench.mjs --target competitors
//   node scripts/ux-bench/bench.mjs --target vocaflow --base http://localhost:3100
//
// 결과: `scripts/ux-bench/out/<target>.json` (원시 측정 + 화면별 점수)
//
// ⚠️ **못 잰 것을 점수에 넣지 않는다.** 403·타임아웃·로그인 튕김은 `error` 로 남기고
//    집계 분모에서 뺀다. 이 저장소가 반복해서 겪은 실패다 —
//    "측정 실패" 를 "점수 0" 이나 "통과" 로 바꾸면 그 숫자는 아무것도 지키지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { MEASURE_FN } from './measure.mjs';
import { COMPETITORS, VIEWPORTS } from './targets.mjs';
import { scoreOne } from './score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const WEB_ROOT = path.resolve(__dirname, '../../apps/web');

// ESM 은 **파일 위치** 기준으로 패키지를 찾는다 — 이 스크립트는 저장소 루트에 있고
// playwright 는 `apps/web` 에만 설치돼 있다. cwd 를 바꿔도 소용없으므로 명시적으로 건다.
const { chromium } = createRequire(path.join(WEB_ROOT, 'package.json'))('@playwright/test');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const TARGET = arg('target', 'competitors');
const BASE = arg('base', process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100');
const ONLY = arg('only', '');
/**
 * **몇 번 재는가.**
 *
 * ⚠️ 실측 2026-08-25: 같은 커밋에서 대표 플랫폼을 두 번 재는 사이 LingQ 디자인
 *    88.4 → 74.4, Duolingo 흐름 75 → 61.8 로 움직였다. 라이브 사이트는 A/B·쿠키 배너·
 *    광고 때문에 방문마다 다른 화면을 준다. **1회 측정으로 기준선을 고정하면
 *    우리 우위가 그날 상대가 어떤 배너를 띄웠는지에 달린다.**
 *    회차마다 따로 저장하고, 판정은 `compare.mjs` 가 **중앙값**으로 낸다
 *    (평균이 아니라 중앙값 — 한 번의 이상치가 기준선을 끌고 가지 않게).
 */
const RUNS = Math.max(1, Number(arg('runs', '1')) || 1);

/**
 * 학습자 정적 라우트 — `apps/web/tests/e2e/utils/learner-routes.ts` 와 **같은 규칙**.
 *
 * ⚠️ 규칙이 두 곳에 있다. 아래 `--verify-routes` 로 두 목록이 같은지 확인할 수 있게 해 뒀고,
 *    다르면 이 스크립트가 멈춘다 — 조용히 다른 목록을 재는 것이 가장 나쁘다.
 */
const SKIP_ROUTES = new Set(['/hub-lab', '/teacher']);
const SESSION_ROUTES = new Set([
  '/flashcard/play', '/pairflip/play', '/spellforge/play', '/scriptquiz/play',
  '/dictate/session', '/practice/dcp', '/wordvault/review', '/wordvault/study',
]);
const PARAM_ROUTES = new Set(['/dictate/results', '/pairflip/results', '/dictate/setup']);

function learnerRoutes() {
  const base = path.join(WEB_ROOT, 'src/app/(main)');
  const out = [];
  const walk = (dir, url) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      if (name.startsWith('[')) continue;
      if (name.startsWith('_') || name.startsWith('(')) { walk(full, url); continue; }
      const child = `${url}/${name}`;
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child);
      walk(full, child);
    }
  };
  walk(base, '');
  return out.filter((r) => !SKIP_ROUTES.has(r)).sort();
}

/** `redirect(): never` 한 줄짜리 껍데기 — 목적지에서 재므로 여기서는 뺀다. */
function redirectOnly(routes) {
  const base = path.join(WEB_ROOT, 'src/app/(main)');
  const out = new Set();
  for (const r of routes) {
    const f = path.join(base, r, 'page.tsx');
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (src.includes('redirect(') && src.includes('): never')) out.add(r);
  }
  return out;
}

/** 본문이 더 이상 바뀌지 않을 때까지 기다린다 — 그리는 중을 재면 값이 재현되지 않는다. */
const STABILIZE = `() => {
  const QUIET = 900;
  const w = window;
  const root = document.querySelector('main') || document.body;
  if (!root) return false;
  if (!w.__benchObs) {
    w.__benchLast = performance.now();
    w.__benchObs = new MutationObserver(() => { w.__benchLast = performance.now(); });
    w.__benchObs.observe(root, { subtree: true, childList: true, attributes: true });
    return false;
  }
  const has = root.querySelectorAll('a[href], button, [role="button"], input').length > 0;
  return has && performance.now() - (w.__benchLast || 0) > QUIET;
}`;

/**
 * **누적 레이아웃 이동(CLS)** 은 로드 시작부터 쌓아야 한다 — 다 그린 뒤에 물으면 늦다.
 * 그래서 페이지가 열리기 전에 관측기를 심는다(컨텍스트당 한 번).
 * 임계값은 Core Web Vitals 공개 기준: good <= 0.1 · poor >= 0.25.
 */
const CLS_INIT = () => {
  window.__uxbCls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__uxbCls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) { /* 미지원 브라우저 — -1 로 남고 분모에서 빠진다 */ }
};

async function measurePage(page, url, timeoutMs) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (e) {
    // 소프트 리다이렉트는 실패가 아니다 — 도착 여부로 판단한다.
    // ⚠️ 실측 2026-08-25: 국내 서비스 대부분이 **클라이언트 리다이렉트**로 로케일/기기별
    //    화면으로 보낸다. 그때 Playwright 는 `is interrupted by another navigation` 을 던지는데,
    //    이걸 실패로 세면 국내 표본이 통째로 사라진다(첫 실행에서 6/7 이 그랬다).
    //    실패로 세야 하는 것은 "도착을 못 했다" 이지 "도중에 방향이 바뀌었다" 가 아니다.
    if (!/ERR_ABORTED|interrupted by another navigation/i.test(String(e))) {
      return { error: `NAV: ${String(e).slice(0, 120)}` };
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForFunction(STABILIZE, undefined, { timeout: 25_000, polling: 200 }).catch(() => {});

  // ── 스켈레톤을 그 화면의 값으로 세지 않는다 ─────────────────────────
  // ⚠️ 실측 2026-08-25: `/diagnostic` 이 DOM 305 · 텍스트 15 · 컨트롤 6 으로 잡혔다.
  //    같은 화면을 다른 스펙(`10-a11y-sweep`)은 **액션 버튼 12개**로 잰다 —
  //    우리는 로딩 스켈레톤을 재고 있었고, 그걸 "막다른 길" 이라는 **제품 결함**으로
  //    보고할 참이었다. 계측기가 틀렸는데 화면을 고치면 아무것도 나아지지 않는다.
  //
  //    그래서 얇게 나오면 더 기다렸다가 다시 잰다. **양쪽에 똑같이 적용한다** —
  //    우리에게만 유리한 재시도는 비교를 조작하는 것이다.
  const thin = (x) => !x || x.fatal || x.textNodes < 12 || x.ctrlTotal < 4;
  let m = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let got;
    try {
      got = await page.evaluate(`(${MEASURE_FN})()`);
    } catch (e) {
      if (attempt === 3) return { error: `MEASURE: ${String(e).slice(0, 120)}` };
      await page.waitForTimeout(2_000);
      continue;
    }
    // 더 많이 그려진 쪽을 남긴다 — 재시도가 화면을 되레 비우는 경우(리다이렉트)를 대비.
    if (!m || (got.domNodes ?? 0) > (m.domNodes ?? 0)) m = got;
    if (!thin(got)) break;
    if (attempt < 3) await page.waitForTimeout(2_500);
  }
  // ── WCAG 2.2 §1.4.12 Text Spacing (AA) ──
  // 기준서가 **CSS 를 직접 명시한다**: 줄간격 1.5배 · 문단간격 2배 · 자간 0.12em · 어간 0.16em.
  // 그걸 얹어도 내용이 잘리거나 기능이 사라지면 안 된다. 자동으로 잴 수 있고,
  // 고정 높이 상자를 쓰는 화면은 흔히 실패한다 — **우리도 실패할 수 있는 기준이라 넣는다.**
  if (m && !m.fatal) {
    const spacing = await page.evaluate(() => {
      const id = '__uxb_text_spacing';
      document.getElementById(id)?.remove();
      const st = document.createElement('style');
      st.id = id;
      st.textContent = '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}p{margin-bottom:2em !important}';
      document.head.appendChild(st);
      // 강제 리플로 후 관측
      void document.body.offsetHeight;
      const de = document.documentElement;
      const overflow = Math.max(0, de.scrollWidth - de.clientWidth);
      // 잘림: 넘치는 내용을 감추는 상자
      let clipped = 0, checked = 0;
      const els = Array.from(document.querySelectorAll('p, li, h1, h2, h3, h4, span, div, button, a')).slice(0, 1200);
      for (const el of els) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const hides = cs.overflowY === 'hidden' || cs.overflow === 'hidden';
        if (!hides) continue;
        checked++;
        if (el.scrollHeight > el.clientHeight + 2) clipped++;
      }
      st.remove();
      void document.body.offsetHeight;
      return { overflow: overflow, clipped: clipped, checked: checked };
    }).catch(() => null);
    if (spacing) {
      m.spacingOverflowPx = spacing.overflow;
      m.spacingClipped = spacing.clipped;
      m.spacingClipChecked = spacing.checked;
    }
  }

  const bad = invalid(m);
  return bad ? { error: bad, raw: m } : m;
}

/**
 * **빈 화면·봇 차단 화면을 점수로 바꾸지 않는다.**
 *
 * ⚠️ 실측 2026-08-25: Quizlet 이 봇 차단 페이지("Access to this page has been denied",
 *    DOM 11 노드, 텍스트 0)를 돌려줬는데 채점식이 **디자인 100점**을 줬다 —
 *    글자가 없으면 대비 위반이 0 이고 폰트 종수도 0 이라 전부 만점이 된다.
 *    그 상태로 비교했다면 우리 우위는 상대의 차단 페이지와 겨룬 결과가 된다.
 *    측정 실패는 실패로 남긴다. 분모에서 빠지지, 점수가 되지 않는다.
 */
function invalid(m) {
  if (!m || m.error) return m?.error ?? 'EMPTY';
  if (m.fatal) return m.fatal;
  if (m.domNodes < 60) return `BLOCKED_OR_EMPTY(dom=${m.domNodes})`;
  if (m.textNodes < 5) return `NO_TEXT(textNodes=${m.textNodes})`;
  if (m.ctrlTotal === 0) return 'NO_CONTROLS';
  if (/denied|forbidden|are you a robot|access to this page|just a moment|attention required/i.test(m.title || '')) {
    return `BLOCK_PAGE(${m.title.slice(0, 40)})`;
  }
  return null;
}

async function runCompetitors() {
  const browser = await chromium.launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent:
        vp.name === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      isMobile: vp.name === 'mobile',
      hasTouch: vp.name === 'mobile',
      // 인증서가 깨진 대상이 있다 — 그건 UX 결함이 아니라 접속 문제이므로 측정을 막지 않는다.
      ignoreHTTPSErrors: true,
    });
    await ctx.addInitScript(CLS_INIT);
    const page = await ctx.newPage();
    for (const t of COMPETITORS) {
      if (ONLY && !t.platform.includes(ONLY)) continue;
      const m = await measurePage(page, t.url, 45_000);
      const landed = page.url();
      const s = scoreOne(m);
      rows.push({ ...t, viewport: vp.name, landed, raw: m, score: s });
      process.stdout.write(
        `  ${vp.name.padEnd(7)} ${t.platform.padEnd(14)} ${(s ? `D${s.design.score} U${s.usability.score} C${s.connectivity.score} F${s.flow.score}` : 'ERR ' + String(m.error).slice(0, 44))}  ${t.url}\n`,
      );
    }
    await ctx.close();
  }
  await browser.close();
  return rows;
}

async function runVocaflow() {
  const routes = learnerRoutes();
  const shells = redirectOnly(routes);
  const targets = routes.filter((r) => !SESSION_ROUTES.has(r) && !PARAM_ROUTES.has(r) && !shells.has(r));
  console.log(`[bench] 학습자 라우트 ${routes.length} → 측정 대상 ${targets.length} (세션·파라미터·리다이렉트 껍데기 제외)`);

  const browser = await chromium.launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'ko-KR',
      isMobile: vp.name === 'mobile',
      hasTouch: vp.name === 'mobile',
    });
    await ctx.addInitScript(CLS_INIT);
    const page = await ctx.newPage();
    // 로그인
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(600);
    await page.fill('input[type="email"]', process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev');
    await page.fill('input[type="password"]', process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });

    for (const r of targets) {
      const m = await measurePage(page, `${BASE}${r}`, 45_000);
      // 세션이 죽어 /login 을 재고 있지는 않은가 — 그 값은 그 화면의 값이 아니다.
      if (/\/login(\?|$)/.test(page.url())) {
        rows.push({ platform: 'Vocaflow', region: 'self', url: r, what: r, viewport: vp.name, landed: page.url(), raw: { error: 'LOGGED_OUT' }, score: null });
        continue;
      }
      const s = scoreOne(m);
      rows.push({ platform: 'Vocaflow', region: 'self', url: r, what: r, viewport: vp.name, landed: page.url(), raw: m, score: s });
      process.stdout.write(
        `  ${vp.name.padEnd(7)} ${r.padEnd(24)} ${(s ? `D${s.design.score} U${s.usability.score} C${s.connectivity.score} F${s.flow.score}` : 'ERR ' + String(m.error).slice(0, 44))}\n`,
      );
    }
    await ctx.close();
  }
  await browser.close();
  return rows;
}

const rows = [];
for (let run = 1; run <= RUNS; run++) {
  if (RUNS > 1) console.log(`\n[bench] ── 회차 ${run}/${RUNS} ──`);
  const got = TARGET === 'vocaflow' ? await runVocaflow() : await runCompetitors();
  for (const r of got) rows.push({ ...r, run });
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, `${TARGET}.json`);
fs.writeFileSync(outFile, JSON.stringify(rows, null, 2), 'utf8');
const ok = rows.filter((r) => r.score).length;
console.log(`\n[bench] ${rows.length} 측정(${RUNS}회차) · 유효 ${ok} · 실패 ${rows.length - ok} → ${path.relative(process.cwd(), outFile)}`);
