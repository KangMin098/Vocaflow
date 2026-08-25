// scripts/ux-bench/score.selftest.mjs
//
// **채점식 자체 검사** — `node scripts/ux-bench/score.selftest.mjs`
//
// 왜 필요한가: 이 파일이 틀리면 Vocaflow 와 경쟁 플랫폼 **양쪽 점수가 함께** 틀린다.
// 그러면 비교는 그럴듯해 보이면서 아무 의미가 없다. 계측기를 먼저 검사한다.

import assert from 'node:assert/strict';
import { scoreOne, aggregate } from './score.mjs';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

/** 모든 항목이 만점인 측정값. */
const perfect = {
  textNodes: 100, contrastFail: 0, contrastWorst: [],
  fontSizeKinds: 6, textColorKinds: 5, bgColorKinds: 3,
  spacingTotal: 200, spacingOnGrid: 200,
  ctrlTotal: 20, ctrlBig: 20, ctrlNamed: 20, smallSample: [], namelessSample: [],
  overflowPx: 0, hasMain: true, hasNav: true, hasLang: true, h1Count: 1,
  title: 'x', headSkips: 0, headCount: 5, imgCount: 4, imgsWithAlt: 4,
  forwardPaths: 5, shellPaths: 6, actionButtons: 3, hasCurrent: true, hasBreadcrumb: true,
  hasSkipLink: true, hasSearch: true, hasSitemap: false, cls: 0.02,
  spacingOverflowPx: 0, spacingClipped: 0, spacingClipChecked: 40,
  foldActions: 3, domInteractive: 900, loadEventEnd: 1200, fcp: 800, domNodes: 900,
};

check('만점 입력 → 네 축 전부 100', () => {
  const s = scoreOne(perfect);
  for (const ax of ['design', 'usability', 'connectivity', 'flow']) {
    assert.equal(s[ax].score, 100, `${ax} = ${s[ax].score}`);
  }
});

check('대비 위반 10% → D1 = 90', () => {
  const s = scoreOne({ ...perfect, contrastFail: 10 });
  assert.equal(s.design.D1, 90);
  assert.equal(s.design.score, 98);              // (90+100+100+100+100)/5 — D5(1.4.12) 추가 후
});

check('터치 타겟 절반 미달 → U1 = 50', () => {
  const s = scoreOne({ ...perfect, ctrlBig: 10 });
  assert.equal(s.usability.U1, 50);
});

check('가로 넘침은 0 아니면 100 (부분 점수 없음 — WCAG 1.4.10 은 충족/미충족)', () => {
  assert.equal(scoreOne({ ...perfect, overflowPx: 2 }).usability.U3, 0);
  assert.equal(scoreOne({ ...perfect, overflowPx: 1 }).usability.U3, 100);
});

check('h1 이 둘이면 U4 가 25점 깎인다', () => {
  assert.equal(scoreOne({ ...perfect, h1Count: 2 }).usability.U4, 75);
});

check('막다른 길(앞길 0) → C1 = 0 · C2 = 0', () => {
  const s = scoreOne({ ...perfect, forwardPaths: 0, actionButtons: 0 });
  assert.equal(s.connectivity.C1, 0);
  assert.equal(s.connectivity.C2, 0);
});

check('앞길 1종이면 C2 = 33.3 (3종에서 만점)', () => {
  const s = scoreOne({ ...perfect, forwardPaths: 1, actionButtons: 0 });
  assert.equal(s.connectivity.C2, 33.3);
});

check('FCP 임계 — 1800 만점 · 3000 영점 · 2400 은 절반', () => {
  assert.equal(scoreOne({ ...perfect, fcp: 1800 }).flow.F2, 100);
  assert.equal(scoreOne({ ...perfect, fcp: 3000 }).flow.F2, 0);
  assert.equal(scoreOne({ ...perfect, fcp: 2400 }).flow.F2, 50);
});

check('DOM 노드 — 1500 만점 · 3000 영점 (Lighthouse dom-size)', () => {
  assert.equal(scoreOne({ ...perfect, domNodes: 1500 }).flow.F4, 100);
  assert.equal(scoreOne({ ...perfect, domNodes: 3000 }).flow.F4, 0);
});

check('폰트 크기 종수 — 10 만점 · 30 영점 · 20 은 절반', () => {
  assert.equal(scoreOne({ ...perfect, fontSizeKinds: 10 }).design.D2, 100);
  assert.equal(scoreOne({ ...perfect, fontSizeKinds: 30 }).design.D2, 0);
  assert.equal(scoreOne({ ...perfect, fontSizeKinds: 20 }).design.D2, 50);
});

check('이미지가 없으면 U6 는 null — **분모에서 빠진다**(만점으로 세지 않는다)', () => {
  const s = scoreOne({ ...perfect, imgCount: 0, imgsWithAlt: 0 });
  assert.equal(s.usability.U6, null);
  assert.equal(s.usability.score, 100);          // 남은 다섯이 만점
  const bad = scoreOne({ ...perfect, imgCount: 0, imgsWithAlt: 0, ctrlBig: 0 });
  assert.equal(bad.usability.U1, 0);
  assert.equal(bad.usability.score, 80);         // (0+100+100+100+100)/5
});

check('측정 실패(error)는 null — 점수 0 이 아니다', () => {
  assert.equal(scoreOne({ error: 'NAV' }), null);
  assert.equal(scoreOne(null), null);
});

check('집계는 null 을 분모에서 뺀다', () => {
  const a = aggregate([scoreOne(perfect), null, scoreOne({ ...perfect, ctrlBig: 10 })]);
  assert.equal(a.usabilityN, 2);
  // 화면 점수는 화면 단계에서 이미 반올림된다(91.7) — 집계는 **그 값**을 평균한다.
  // 반올림 전 값(91.666)으로 기대치를 세우면 0.1 이 어긋난다.
  assert.equal(a.usability, 95.9);              // (100 + 91.7) / 2 = 95.85 → 95.9
});

check('WCAG 2.4.1 — 우회 링크가 없으면 C5 = 0', () => {
  assert.equal(scoreOne({ ...perfect, hasSkipLink: false }).connectivity.C5, 0);
});

check('WCAG 2.4.5 — 내비만 있고 검색·사이트맵이 없으면 절반', () => {
  assert.equal(scoreOne({ ...perfect, hasSearch: false, hasSitemap: false }).connectivity.C6, 50);
  assert.equal(scoreOne({ ...perfect, hasSearch: false, hasSitemap: true }).connectivity.C6, 100);
  assert.equal(scoreOne({ ...perfect, hasNav: false, hasSearch: false, hasSitemap: false }).connectivity.C6, 0);
});

check('CLS — 0.1 만점 · 0.25 영점 (Core Web Vitals) · 못 잰 값은 분모에서 빠진다', () => {
  assert.equal(scoreOne({ ...perfect, cls: 0.1 }).flow.F5, 100);
  assert.equal(scoreOne({ ...perfect, cls: 0.25 }).flow.F5, 0);
  assert.equal(scoreOne({ ...perfect, cls: -1 }).flow.F5, null);
});

check('WCAG 1.4.12 — 간격 CSS 를 얹었을 때 넘치면 절반, 잘리면 비율만큼', () => {
  assert.equal(scoreOne(perfect).design.D5, 100);
  assert.equal(scoreOne({ ...perfect, spacingOverflowPx: 12 }).design.D5, 50);
  assert.equal(scoreOne({ ...perfect, spacingClipped: 20 }).design.D5, 75);   // 20/40 잘림
  assert.equal(scoreOne({ ...perfect, spacingOverflowPx: undefined }).design.D5, null);
});

console.log(`\n${n}개 검사 통과.`);
