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

/** 세로/정사각은 한 줄에 들어가는 글자가 적다 — 폰트 배율을 규격이 정한다. */
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
