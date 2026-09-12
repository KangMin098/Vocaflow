// apps/web/src/components/home/room-tone.ts
//
// Today 지면의 시각(時刻) 톤.
//
// ⚠️ **명도는 테마가, 색조는 시각이 소유한다.** 이 분리가 없으면 두 축이 싸운다.
//
// 처음 구현은 밤 지면을 `var(--p-dark)` 로 칠하고 글자를 `var(--ti)` 로 뒀다. 라이트에서는
// 의도대로 깊은 잉크 지면이 나왔지만 **다크 테마에서 `--p-dark` 는 `#4F84BC`(밝은 파랑)로
// 뒤집힌다.** 어두운 페이지 한가운데 밝은 판이 박혔고 그 위 글자는 AA 미달이었다.
// (같은 함정을 `tokens.css` 가 이미 겪고 `--on-p` 를 만들어 뒀다 — 다크 `--p` 위 흰 글자 2.90:1.)
//
// 그래서 시각 톤은 **명도를 건드리지 않는다.** 지면은 언제나 테마의 `--bg` 이고 시각은
// 거기에 색조만 12~16% 섞는다. 글자는 언제나 `--t1`/`--t2` 라 테마와 함께 뒤집힌다.
//
// 대가: 라이트 테마의 극적인 "깊은 잉크 밤 지면" 은 없다. 되살리려면 **테마와 무관하게
// 어두운 표면 토큰**이 필요하고, 그것은 design-tokens 패키지 변경 사항이다.

export type RoomTime = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'

export interface RoomTone {
  canvas: string
  ink: string
  sub: string
  rule: string
  says: string
}

export const ROOM_TONE: Record<RoomTime, RoomTone> = {
  dawn: {
    canvas: 'color-mix(in srgb, var(--bg) 88%, var(--p) 12%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 70%, var(--p) 30%)',
    says: '이른 시간이에요',
  },
  morning: {
    canvas: 'color-mix(in srgb, var(--bg) 88%, var(--active) 12%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 70%, var(--active) 30%)',
    says: '아침이에요',
  },
  afternoon: {
    canvas: 'var(--bg)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'var(--bd)',
    says: '한낮이에요',
  },
  evening: {
    canvas: 'color-mix(in srgb, var(--bg) 86%, var(--warning) 14%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 65%, var(--warning) 35%)',
    says: '저녁이에요',
  },
  night: {
    canvas: 'color-mix(in srgb, var(--bg) 84%, var(--p) 16%)',
    ink: 'var(--t1)',
    sub: 'var(--t2)',
    rule: 'color-mix(in srgb, var(--bd) 60%, var(--p) 40%)',
    says: '밤이에요',
  },
}

/**
 * KST 시각대.
 *
 * **서버에서 계산해 내려보낼 것.** 클라이언트에서 `new Date()` 로 정하면 SSR 결과와 달라져
 * 하이드레이션 불일치가 나고, 그 순간 지면 색이 한 번 튄다.
 */
export function kstRoomTime(nowMs: number = Date.now()): RoomTime {
  const hour = new Date(nowMs + 9 * 3_600_000).getUTCHours()
  if (hour < 6) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}
