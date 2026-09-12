// apps/web/tests/e2e/utils/tap-target.ts
//
// **탭 대상 규칙의 단일 출처** — 두 스펙(32-touch-targets · 33-public-sweep)이 공유한다.
//
// 규칙을 두 곳에 복제해 두면 반드시 갈라진다. 실제로 갈라지기 직전이었다 —
// 33 을 만들면서 32 의 판정 블록을 그대로 베꼈고, 규칙을 고칠 때 한쪽만 고칠 뻔했다.
//
// ── 왜 한 가지 임계값이 아닌가 (실측 2026-08-26) ──────────────────────────
// 처음에는 `min(너비, 높이) >= 44` 하나로 쟀다. 그랬더니 마케팅 푸터의 **"소개"(2글자)**
// 같은 링크가 `26×44` 로 걸렸다 — 높이는 이미 44인데 **글자가 짧아서** 너비가 26이다.
// 거기에 44px 너비를 강제하면 가로 여백을 넣어야 하고, 내비의 시각 리듬이 바뀐다.
// 그건 접근성 개선이 아니라 디자인 변경이고, 손가락이 실제로 겪는 문제도 아니다
// (한 줄을 누르는 것이라 세로가 확보되면 잡힌다).
//
// 그래서 두 갈래로 나눈다 — **표준도 그렇게 나뉜다**:
//   · 아이콘 전용(보이는 글자가 없거나 1자): **양쪽 다 44px** (WCAG 2.5.5 AAA)
//     — 누를 곳이 아이콘 하나뿐이라 가로도 확보돼야 한다.
//   · 글자가 있는 링크·버튼: **높이 44px 이상 + 너비 24px 이상** (2.5.8 AA 를 바닥으로)
//     — 손가락은 줄을 잡는다. 짧은 라벨까지 정사각형으로 만들 이유가 없다.
//
// 체크박스·라디오는 크기와 무관하게 **감싸는 label** 을 잰다(숨겨 두고 스타일된 것을 보여 준다).

/** 페이지 안에서 도는 판정 함수의 소스 — `page.evaluate` 에 문자열로 넘기지 않고 그대로 쓴다. */
export const TAP_MIN = 44;
export const TAP_MIN_TEXT_WIDTH = 24;

export interface TapOffender {
  tag: string;
  label: string;
  w: number;
  h: number;
  /** 아이콘 전용으로 판정됐는가 — 규칙이 왜 걸렸는지 읽는 사람이 알게. */
  iconOnly: boolean;
}

/**
 * 브라우저 안에서 실행할 스캐너.
 *
 * `page.evaluate(scanTapTargets, { min, minTextWidth })` 로 쓴다.
 * 전달 인자를 객체 하나로 받는 이유는 Playwright 의 evaluate 가 인자를 하나만 받기 때문이다.
 */
export function scanTapTargets(opts: { min: number; minTextWidth: number }): TapOffender[] {
  const { min, minTextWidth } = opts;
  const out: TapOffender[] = [];
  const sel =
    'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select';

  for (const el of Array.from(document.querySelectorAll(sel))) {
    const r0 = el.getBoundingClientRect();
    if (r0.width === 0 || r0.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;

    // 체크박스·라디오는 감싸는 label 이 탭 대상이다.
    let target: Element = el;
    if (el.tagName === 'INPUT') {
      const lab =
        el.closest('label') ??
        (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (!lab) continue; // 라벨이 없으면 판단하지 않는다
      target = lab;
    }

    const r = target.getBoundingClientRect();
    // ⚠️ 글자는 **탭 대상이 된 요소**에서 읽는다. 체크박스를 label 로 환산해 놓고
    //    글자는 `<input>` 에서 읽으면(항상 비어 있다) 라벨이 붙은 토글이 전부
    //    "아이콘 전용" 으로 판정돼 44px 너비까지 요구받는다 — 실측 2026-08-26 오탐.
    const text = (target.textContent ?? '').replace(/\s+/g, ' ').trim();
    const iconOnly = text.length <= 1;

    // 본문 **문장 안**의 인라인 링크는 대상이 아니다 — 문장 속 링크까지 키우면
    // 읽는 글이 버튼 목록이 된다.
    //
    // ⚠️ 판단 기준은 **글자 수가 아니라 문맥**이다. 처음에는 "글자 4자 초과면 인라인" 으로
    //    쟀는데, 그러면 "이미 계정이 있으신가요? **로그인**" 의 3자 링크는 걸리고(문장 속인데),
    //    푸터 내비의 "소개"(2자)는 안 걸린다(내비인데) — 정확히 거꾸로였다.
    //    지금은 **부모에 링크 밖 글자가 있는가**로 본다. 그게 곧 "문장 속" 의 정의다.
    if (el.tagName === 'A' && r.height < 30) {
      const parent = el.parentElement;
      const parentText = (parent?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const inSentence = parentText.length > text.length + 2;
      if (inSentence) continue;
    }

    const ok = iconOnly
      ? r.width >= min && r.height >= min
      : r.height >= min && r.width >= minTextWidth;
    if (ok) continue;

    out.push({
      tag: el.tagName,
      label: (el.getAttribute('aria-label') ?? text).slice(0, 30),
      w: Math.round(r.width),
      h: Math.round(r.height),
      iconOnly,
    });
  }
  return out;
}

export const describeOffender = (o: TapOffender) =>
  `${o.w}×${o.h}${o.iconOnly ? ' (아이콘)' : ''} ${o.tag} ${o.label}`;
