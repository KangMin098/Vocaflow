// packages/video-factory/src/spec/layout.ts
//
// **규격에 맞춰 크기를 정하는 순수 계산** — 컷 컴포넌트와 회귀가 같은 함수를 쓴다.
//
// 왜 컴포넌트 안에 두지 않았나: 「안전 여백을 넘지 않는가」는 **산술로 확인할 수 있는 것**인데,
// 컴포넌트 안에 있으면 스틸을 렌더해 눈으로 보는 수밖에 없다. 실제로 그렇게 발견했다
// (2026-09-13 정사각: 7권 × 150px = 1,047px > 가용 904px — 책이 화면 끝에 닿았다).

import { FORMATS, typeScale, type FormatId } from './format'

/** 책등 사이 간격. */
export function shelfGap(format: FormatId): number {
  return Math.round(18 * typeScale(format))
}

/**
 * 책등 폭 — **권 수가 늘어도 안전 여백 안에 들어온다.**
 *
 * 하한(52)을 두는 이유: 그보다 좁으면 세로쓰기 제목이 한 글자도 안 들어간다.
 * 하한에 걸릴 만큼 권이 많아지면 그건 폭 문제가 아니라 **한 컷에 너무 많이 담은 것**이다.
 */
export function shelfBookWidth(format: FormatId, count: number): number {
  const def = FORMATS[format]
  const scale = typeScale(format)
  const avail = def.width - def.safe.left - def.safe.right
  const n = Math.max(1, count)
  const gap = shelfGap(format)
  return Math.max(
    Math.round(52 * scale),
    Math.min(Math.round(118 * scale), Math.floor((avail - gap * (n - 1)) / n)),
  )
}

/** 책 묶음 전체 폭. 회귀가 이 값과 가용 폭을 비교한다. */
export function shelfTotalWidth(format: FormatId, count: number): number {
  const n = Math.max(1, count)
  return shelfBookWidth(format, n) * n + shelfGap(format) * (n - 1)
}

/** 그 규격에서 글자를 둘 수 있는 가로 폭. */
export function usableWidth(format: FormatId): number {
  const def = FORMATS[format]
  return def.width - def.safe.left - def.safe.right
}

/**
 * **글줄 하나가 길어질 수 있는 최대 폭.**
 *
 * 가로(1920)에서 가용 폭을 다 쓰면 한 줄이 1,700px 가 되어 눈이 줄 끝에서 다음 줄 머리를
 * 못 찾는다. 반대로 줄을 짧게 두고 **왼쪽에 붙여** 두면 오른쪽 3분의 2가 빈 채로 남아
 * 미완성으로 읽힌다(실측 2026-09-13: 「나아가는 차례」 첫 스틸에서 그랬다).
 *
 * 그래서 폭을 재는 자를 따로 둔다 — 값을 정하고 **가운데로 모은다.**
 * 세로·정사각은 가용 폭이 이미 그 안이라 그대로 쓴다.
 */
export function proseColumnWidth(format: FormatId): number {
  return Math.min(usableWidth(format), format === 'wide' ? 1180 : usableWidth(format))
}
