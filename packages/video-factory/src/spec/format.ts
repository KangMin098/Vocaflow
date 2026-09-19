// packages/video-factory/src/spec/format.ts
//
// **출력 규격 3종** — 같은 설계도 하나를 세 곳에 내보낸다.
//
// 왜 셋인가: 이 공장의 소비처가 셋이다 — 학습자 화면(가로) · 광고/쇼츠(세로) · 피드 광고(정사각).
// 규격마다 영상을 따로 만들면 반드시 갈린다(이 저장소가 이름·경로·수치에서 세 번 겪은 모양).
// 그래서 **레이아웃은 규격이 정하고 내용은 설계도가 정한다.**

export type FormatId = 'wide' | 'vertical' | 'square'

export interface FormatDef {
  id: FormatId
  width: number
  height: number
  /** 어디에 쓰는가 — 규격을 고를 때 읽는 문장이지 장식이 아니다. */
  use: string
  /**
   * 안전 여백(px) — 이 바깥에는 글자를 두지 않는다.
   * 세로는 플랫폼 UI(하단 캡션·버튼)가 아래를 덮으므로 아래를 두껍게 잡는다.
   */
  safe: { top: number; right: number; bottom: number; left: number }
}

/** 프레임률 — 30. 화면 녹화(제품 UI)와 맞추기 위한 값이고 전 규격 공통이다. */
export const FPS = 30

export const FORMATS: Record<FormatId, FormatDef> = {
  wide: {
    id: 'wide',
    width: 1920,
    height: 1080,
    use: 'YouTube 본편 · 학습자 화면 임베드 · 사이트 히어로',
    safe: { top: 72, right: 108, bottom: 72, left: 108 },
  },
  vertical: {
    id: 'vertical',
    width: 1080,
    height: 1920,
    use: 'YouTube Shorts · Reels · 세로 광고',
    safe: { top: 220, right: 72, bottom: 380, left: 72 },
  },
  square: {
    id: 'square',
    width: 1080,
    height: 1080,
    use: '피드 광고 · 카드형 배너',
    safe: { top: 88, right: 88, bottom: 88, left: 88 },
  },
}

export const FORMAT_IDS = ['wide', 'vertical', 'square'] as const satisfies readonly FormatId[]

/**
 * **짧은 글**(제목·수치·한 줄 문구)의 배율.
 *
 * 세로는 화면이 좁아 같은 글자가 작아 보이므로 키운다.
 */
export function typeScale(format: FormatId): number {
  switch (format) {
    case 'wide':
      return 1
    case 'vertical':
      return 1.28
    case 'square':
      return 1.1
  }
}

/**
 * **긴 글**(지문·문항 보기)의 배율 — `typeScale` 과 **반대 방향**이다.
 *
 * 왜 갈랐나 (실측 2026-09-13, 세로 스틸):
 *   커버리지 지문에 `typeScale` 1.28 을 곱했더니 61낱말이 **14줄**이 되어 본문 영역을 넘쳤고,
 *   가운데 정렬이라 위아래로 흘러 **좌상단 브랜드 표기와 겹쳤다.** 오류는 나지 않는다.
 *   짧은 글은 좁은 화면에서 키워야 읽히지만, **긴 글은 줄 수가 문제**라 반대로 줄여야 한다.
 */
export function proseScale(format: FormatId): number {
  switch (format) {
    case 'wide':
      return 1
    case 'vertical':
      return 0.76
    case 'square':
      return 0.84
  }
}
