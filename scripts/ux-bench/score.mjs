// scripts/ux-bench/score.mjs
//
// **원시 측정값 → 4축 점수(0~100).**
//
// ── 임계값은 어디서 왔는가 (짐작 금지) ────────────────────────────────
// 이 저장소 규칙: "근거 없는 임계값을 목표로 삼지 않는다." 그래서 각 하위 지표의
// 만점/영점은 **공개 1차 기준**에 건다. 출처를 지표마다 적어 둔다 —
// 출처를 못 적는 지표는 넣지 않았다.
//
//   · 대비 4.5:1 / 3:1        WCAG 2.2 §1.4.3 (AA)
//   · 터치 타겟 44×44         WCAG 2.2 §2.5.5 (AAA) — 이 저장소 CLAUDE.md 도 같은 값
//   · 접근 가능한 이름        WCAG 2.2 §4.1.2
//   · 가로 넘침(리플로)       WCAG 2.2 §1.4.10 (AA)
//   · 제목 계층               WCAG 2.2 §1.3.1 · §2.4.6
//   · FCP 1.8s / 3.0s         Core Web Vitals 공개 임계(good / poor)
//   · DOM 노드 1500 / 3000    Lighthouse `dom-size` 경고/실패선
//   · 4px 간격 그리드         디자인 시스템 규율의 대리 지표(내부 토큰이 4px 배수)
//
// ── 왜 "종수" 로 규율을 재는가 ────────────────────────────────────────
// 타이포·색은 아름다움을 못 재지만 **일관성**은 잰다. 한 화면에서 폰트 크기가 20종,
// 글자색이 25종 쓰이면 그건 취향 문제가 아니라 시스템이 없다는 뜻이다.
// 만점 8종 · 영점 24종은 임의가 아니라 이 저장소 `design-tokens` 의 실제 스케일 크기다
// (아래 TYPO_FULL 주석 참조).

/** 선형 보간 — v 가 full 이하면 100, zero 이상이면 0. */
const band = (v, full, zero) => {
  if (!Number.isFinite(v)) return null;
  if (v <= full) return 100;
  if (v >= zero) return 0;
  return Math.round(((zero - v) / (zero - full)) * 1000) / 10;
};
const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// ── 규율 지표의 기준선은 **실계수**로 정한다 ───────────────────────────
// 첫 판은 "토큰 스케일 8단" 이라고 적었는데 **세어 보지 않고 쓴 숫자였다.**
// 실측(2026-08-25):
//   · `packages/design-tokens/src/tokens.css` 의 타입 스케일(iOS HIG 파생)
//     `--ios-text-*` 11 역할 · **서로 다른 px 10종** (34·28·22·20·17·16·15·13·12·11)
//   · 텍스트 색 토큰: ink 3단(`--t1`·`--t2`·`--t3`) + semantic·accent 6
//     (success·error·warning·info·activeInk·p) ≈ **10종**
// 그래서 만점 10 · 영점 30(3배). 이 값은 **양쪽에 똑같이** 적용되므로 상대적 비교는
// 영향받지 않는다 — 그래도 바꾼 이유를 적어 둔다. 근거 없는 임계값이 목표가 되면 안 된다.
const TYPO_FULL = 10, TYPO_ZERO = 30;

export function scoreOne(m) {
  if (!m || m.error) return null;

  // ── 축 1. 디자인 ──
  const D1 = rate(m.textNodes - m.contrastFail, m.textNodes);        // WCAG 1.4.3
  const D2 = band(m.fontSizeKinds, TYPO_FULL, TYPO_ZERO);            // 타이포 규율
  const D3 = band(m.textColorKinds, TYPO_FULL, TYPO_ZERO);           // 색 규율
  const D4 = rate(m.spacingOnGrid, m.spacingTotal);                  // 4px 그리드

  // ── 축 2. 사용성 ──
  const U1 = rate(m.ctrlBig, m.ctrlTotal);                           // WCAG 2.5.5
  const U2 = rate(m.ctrlNamed, m.ctrlTotal);                         // WCAG 4.1.2
  const U3 = m.overflowPx <= 1 ? 100 : 0;                            // WCAG 1.4.10
  const U4 = (m.hasMain ? 25 : 0) + (m.hasNav ? 25 : 0) + (m.h1Count === 1 ? 25 : 0) + (m.hasLang ? 25 : 0);
  const U5 = m.headCount > 1 ? rate(Math.max(0, m.headCount - 1 - m.headSkips), m.headCount - 1) : null;
  const U6 = m.imgCount > 0 ? rate(m.imgsWithAlt, m.imgCount) : null;

  // ── 축 3. 연계성 ──
  const ways = m.forwardPaths + m.actionButtons;
  const C1 = ways > 0 ? 100 : 0;                                     // 막다른 길 아님
  const C2 = band(-Math.min(ways, 3), -3, 0);                        // 앞길 3종 이상이면 만점
  const C3 = band(-Math.min(m.shellPaths, 3), -3, 0);                // 셸이 항상 있는가
  const C4 = m.hasCurrent ? 100 : 0;                                 // 현재 위치 표시

  // ── 축 4. 흐름성 ──
  const F1 = m.foldActions > 0 ? 100 : 0;                            // 첫 화면에 다음 행동
  const F2 = m.fcp >= 0 ? band(m.fcp, 1800, 3000) : null;            // Core Web Vitals
  const F3 = m.domInteractive >= 0 ? band(m.domInteractive, 2000, 5000) : null;
  const F4 = band(m.domNodes, 1500, 3000);                           // Lighthouse dom-size

  const avg = (xs) => {
    const v = xs.filter((x) => x !== null && Number.isFinite(x));
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };

  return {
    design: { D1, D2, D3, D4, score: avg([D1, D2, D3, D4]) },
    usability: { U1, U2, U3, U4, U5, U6, score: avg([U1, U2, U3, U4, U5, U6]) },
    connectivity: { C1, C2, C3, C4, score: avg([C1, C2, C3, C4]) },
    // `scoreNeutral` — **환경 편향을 뺀** 흐름 점수.
    // ⚠️ 우리 화면은 localhost 프로덕션 빌드에서, 상대는 공용 인터넷에서 잰다.
    //    FCP·domInteractive 는 그 차이만으로 우리 쪽이 유리해진다 — 그 우위는 제품이 아니라
    //    네트워크에서 나온 것이다. 그래서 속도 둘을 뺀 값을 함께 낸다.
    //    판정은 이 중립값으로 하고, 원래 값은 참고로 함께 적는다.
    flow: { F1, F2, F3, F4, score: avg([F1, F2, F3, F4]), scoreNeutral: avg([F1, F4]) },
  };
}

export const AXES = ['design', 'usability', 'connectivity', 'flow'];
export const AXIS_KO = { design: '디자인', usability: '사용성', connectivity: '연계성', flow: '흐름성' };

/** 여러 화면 점수의 평균 — 못 잰 화면(null)은 **분모에서 뺀다**(통과로 세지 않는다). */
export function aggregate(scored) {
  const out = {};
  const mean = (vals) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null);
  for (const ax of AXES) {
    const vals = scored.map((s) => s && s[ax] && s[ax].score).filter((v) => Number.isFinite(v));
    out[ax] = mean(vals);
    out[ax + 'N'] = vals.length;
  }
  out.flowNeutral = mean(scored.map((s) => s && s.flow && s.flow.scoreNeutral).filter((v) => Number.isFinite(v)));
  return out;
}
