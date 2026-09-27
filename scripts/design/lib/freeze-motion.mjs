// scripts/design/lib/freeze-motion.mjs
//
// 우리 화면을 찍기 직전에 **앰비언트 모션을 한 시각에 세우는** 한 곳.
//
// ── 누가 쓰나 (2026-09-23 실측) ───────────────────────────────────
// 우리 화면을 찍는 스크립트는 여섯이고, 그중 넷(`capture-ours` · `show-screen` ·
// `replica-diff` · `tines-corpus`)은 컨텍스트에 `reducedMotion: 'reduce'` 를 **이미 강제한다**
// — 거기서는 §4.5 의 루프 규칙이 애초에 존재하지 않으므로 이미 결정론이다.
// 강제하지 않는 둘이 이 함수를 쓴다:
//   · `capture-learner.mjs` — 기준선 캡처. 학습자가 **실제로 보는** 모습이어야 해서 reduce 를 켤 수 없다.
//   · `shot-authed.mjs` — 로그인 화면 조각 촬영.
// 같은 스니펫을 두 곳에 적으면 한 곳만 고쳐져 **어떤 캡처는 흔들리고 어떤 캡처는 안 흔들리는**
// 상태가 된다. `ref-page.mjs` 가 참조 쪽에서 같은 이유로 존재한다 — 조건이 갈라지면 픽셀 diff 가
// 디자인 차이가 아니라 **조건 차이**를 잰다.
//
// ── 왜 끄지 않고 세우나 ───────────────────────────────────────────
// `globals.css` §4.5 의 진입 애니메이션은 `animation-fill-mode: both` 라 **시작 프레임이
// `opacity: 0`** 이다. `animation: none` 으로 끄면 fill 이 사라져 그 자리에 굳고,
// 캡처에는 **투명한 화면**이 찍힌다. 그래서 `animation-play-state: paused` +
// 음수 `animation-delay` 로 「그 시각으로 감아서 세운다」(참조 tines 가 쓰는 방법 그대로 —
// `[data-3b-deterministic]` · docs/design/tines-mapping.md §29-3 ③).
//
// 기본 3초: 진입은 전부 0.9초 안에 끝나고(rise .5s · arc .9s · grow .7s),
// 루프는 4초 주기의 3/4 지점에서 멈춘다 — 매번 같은 프레임이다.

/** 기본 장면 시각(초). 진입이 끝난 뒤, 루프 주기 안의 한 지점. */
export const DEFAULT_SCENE_TIME = 3

/**
 * **열기 전에** 건다 — 첫 프레임부터 속성이 붙어 있게.
 *
 * ── 왜 이게 따로 있나 (2026-09-23 실측) ───────────────────────────
 * 화면을 연 뒤에 `freezeMotion()` 만 부르면 **이미 돌고 있던 무한 루프가 안 되감긴다.**
 * `animation-play-state: paused` 는 「지금 위치에서 멈춰라」로 동작하고, 그때 뒤늦게 준
 * 음수 `animation-delay` 는 그 위치를 되돌리지 못한다. 그래서 40초짜리 제목 마키가
 * **페이지가 열린 뒤 흐른 시간**(실행마다 다르다)에서 멈췄다 — 두 번 찍은 `/hub` 의
 * 마지막 남은 차이 0.14% 가 정확히 그 띠 한 줄(y 573–601)이었다.
 * 진입 애니메이션은 `both` 로 이미 끝나 있어 같은 프레임이라 증상이 안 보였다 —
 * **긴 주기의 무한 루프에서만** 드러난다(그래서 늦게 발견됐다).
 *
 * 참조(tines)는 이 문제가 없다: `[data-3b-deterministic]` 이 **서버에서 찍혀 나오므로**
 * 애니메이션이 처음부터 멈춘 채 시작한다. 같은 조건을 만든다 — `addInitScript` 로
 * 문서가 생기자마자 속성을 단다.
 *
 * 페이지를 만든 직후, `goto` **전에** 한 번 부른다.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [sceneTime]
 */
export async function installFreezeMotion(page, sceneTime = DEFAULT_SCENE_TIME) {
  await page.addInitScript((t) => {
    const apply = () => {
      const root = document.documentElement
      if (!root) return false
      root.setAttribute('data-motion-freeze', '')
      root.style.setProperty('--scene-time', String(t))
      return true
    }
    // `addInitScript` 는 문서가 만들어지자마자 돈다 — `<html>` 이 아직 없을 수 있다.
    if (!apply()) new MutationObserver((_, o) => { if (apply()) o.disconnect() }).observe(document, { childList: true, subtree: true })
  }, sceneTime)
}

/**
 * 이미 열린 화면에 건다. `installFreezeMotion()` 의 보조 — SPA 이동으로 새로 생긴
 * 루프나, 속성이 어떤 이유로 지워진 경우를 덮는다. **이것만으로는 부족하다**(위 참조).
 *
 * @param {import('@playwright/test').Page} page 우리 화면이 열려 있는 페이지
 * @param {number} [sceneTime] 초. 이 시각의 한 프레임에 세운다.
 */
export async function freezeMotion(page, sceneTime = DEFAULT_SCENE_TIME) {
  await page.evaluate((t) => {
    const root = document.documentElement
    root.setAttribute('data-motion-freeze', '')
    root.style.setProperty('--scene-time', String(t))
  }, sceneTime)
}

/**
 * **지연 로딩 그림을 다 불러온 뒤에 찍는다.**
 *
 * ── 왜 모션과 같은 파일인가 (2026-09-23 실측) ─────────────────────
 * 모션을 세우고도 `/hub` 를 두 번 찍은 결과가 0.89% 달랐다. 모션은 절반이었고
 * 나머지는 **표지**였다 — `loading="lazy"` 인 도서 표지가 외부 호스트에서 오는데,
 * 어떤 실행에는 도착하고 어떤 실행에는 못 와서 **빈 칸이 되고 쪽 높이까지 바뀐다.**
 * 「같은 화면을 두 번 찍으면 같아야 한다」는 하나의 요건이고, 그걸 깨는 원인이 둘일 뿐이다.
 * 한쪽만 고치면 기준선 diff 는 여전히 시끄럽고, 다음 사람은 모션을 의심한다.
 *
 * 다 기다리지는 않는다 — 죽은 호스트 하나가 캡처 전체를 멈추면 안 된다(`timeoutMs`).
 * 못 온 그림이 있으면 **수를 돌려준다**(캡처를 통과로 세우되 조용하지는 않게).
 *
 * @returns {Promise<{ total: number, pending: number }>}
 */
export async function settleImages(page, timeoutMs = 9000) {
  return page.evaluate(async (limit) => {
    const imgs = [...document.images]
    for (const img of imgs) if (img.loading === 'lazy') img.loading = 'eager'
    const waiting = imgs.filter((i) => !i.complete)
    await Promise.race([
      Promise.all(
        waiting.map((i) => new Promise((res) => { i.addEventListener('load', res, { once: true }); i.addEventListener('error', res, { once: true }) })),
      ),
      new Promise((res) => setTimeout(res, limit)),
    ])
    return { total: imgs.length, pending: [...document.images].filter((i) => !i.complete).length }
  }, timeoutMs)
}
