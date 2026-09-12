// apps/web/src/lib/worksheet/qr.ts
//
// **인쇄물의 QR** — 종이에서 웹으로 돌아오는 유일한 경로.
//
// ── 왜 짧은 주소만 싣나 (2026-08-26 실측) ───────────────────────────
// 처음에는 `/fit` 의 결과 공유 링크(`/fit/s/<payload>`)를 실으려 했다. 그 주소는 **434자**다.
// 바이트 모드로 담으면 QR 버전 16 — **81×81 모듈**이 된다. 30mm 로 인쇄하면 한 모듈이
// 0.37mm 이고, 그건 새 종이에서도 아슬아슬하며 **복사본에서는 읽히지 않는다.**
// 교실에 도는 유인물은 대개 복사본이다.
//
//   https://vocaflow.app/join/ABC123  → 29×29 → 30mm 에서 **1.03mm/모듈**
//   https://vocaflow.app/fit          → 25×25 → 30mm 에서 **1.20mm/모듈**
//
// 안정적으로 읽히는 하한이 대략 0.5mm/모듈이라 두 배 여유가 있다.
// **그래서 QR 에는 짧은 주소만 싣는다.** 낱말은 종이에 이미 인쇄돼 있고,
// 학생이 실제로 그 낱말을 받는 경로는 공유 링크가 아니라 **학급 초대**다.
//
// ── 왜 SVG 인가 ─────────────────────────────────────────────────────
// 인쇄에서 비트맵은 화면 해상도(96dpi)로 굳어 가장자리가 뭉갠다. SVG 는 인쇄기 해상도로
// 다시 그려져 모듈 경계가 또렷하다 — QR 은 그 경계가 전부다.
// 외부 이미지 서비스를 쓰지 않는 이유도 같다: 인쇄는 오프라인에서도 돼야 한다.

import qrcode from 'qrcode-generator'

/**
 * 오류정정 수준.
 *
 * `M`(약 15% 복원)을 쓴다. 복사·접힘·형광펜을 견뎌야 하는 지면이라 `L` 은 얇고,
 * `Q`·`H` 는 같은 내용에 모듈을 늘려 오히려 각 모듈을 작게 만든다.
 */
const EC_LEVEL = 'M' as const

/** 이 인코더가 감당하는 상한 — 넘으면 QR 이 촘촘해져 인쇄에서 못 읽는다. */
export const MAX_QR_URL_LENGTH = 120

export interface QrSvg {
  /** `<svg>` 마크업 (width/height 없음 — 담는 쪽이 크기를 정한다). */
  markup: string
  /** 한 변의 모듈 수. 인쇄 크기를 정할 때 쓴다. */
  modules: number
}

/**
 * 주소 하나를 인쇄용 SVG QR 로.
 *
 * 너무 긴 주소는 **거부한다** — 조용히 촘촘한 QR 을 만들어 내보내면 교사는 인쇄해서
 * 나눠 준 뒤에야 아무도 못 읽는다는 것을 알게 된다. 못 만들면 `null` 이고,
 * 부르는 쪽은 QR 없이 주소 글자만 인쇄한다.
 */
export function qrSvg(url: string): QrSvg | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed || trimmed.length > MAX_QR_URL_LENGTH) return null

  try {
    const q = qrcode(0, EC_LEVEL)
    q.addData(trimmed)
    q.make()

    return {
      // `margin: 0` — 여백(quiet zone)은 담는 쪽이 흰 여백으로 준다.
      // 라이브러리 여백까지 더하면 같은 지면에서 모듈이 작아진다.
      markup: q.createSvgTag({ cellSize: 1, margin: 0, scalable: true }),
      modules: q.getModuleCount(),
    }
  } catch {
    // 인코딩 실패가 인쇄를 막지 않는다 — 주소 글자는 그대로 나간다.
    return null
  }
}

/**
 * 이 모듈 수를 몇 mm 로 인쇄해야 읽히는가.
 *
 * 0.5mm/모듈을 하한으로 잡되(복사본·구형 카메라 기준) 지면을 잡아먹지 않게 상한을 둔다.
 */
export function printSizeMm(modules: number): number {
  const MIN_MODULE_MM = 0.5
  return Math.min(34, Math.max(22, Math.ceil(modules * MIN_MODULE_MM)))
}
