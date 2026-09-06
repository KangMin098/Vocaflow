// apps/web/src/lib/textbook/volume-contents.ts
//
// **조판된 권의 목차·미리보기 단원을 읽는다.**
//
// 값은 `scripts/textbook/contents-snapshot.mjs` 가 굽는다 — 조판(`loadVolume`)과 **같은
// 코드 경로**로 실제 단원을 조합한 결과다. 이 파일은 읽기만 하고 아무것도 짓지 않는다.
//
// ── 왜 스냅샷인가 ───────────────────────────────────────────────────
// 상세면은 비로그인에 열린 공개 표면이고, 단원 조합은 밴드 하나에 수천 편을 훑는 일이라
// 요청마다 할 수 없다. 같은 이유로 이 저장소에는 이미 `source-eligibility-snapshot.json` 이 있다.
//
// ⚠️ **스냅샷은 낡는다.** `generatedAt` 을 화면이 함께 내보인다 — 낡은 것이 보여야 다시 굽는다.
// ⚠️ **없으면 없다고 답한다.** 어떤 권이든 화면이 그릴 수 있는 문항이 없으면 미리보기가
//    `null` 이다. 그 자리를 지어내지 않는다 — 호출부가 절을 통째로 빼고 이유를 적는다.
//    (초등 저학년이 한동안 그랬다. 2026-09-06 에 초등 3종 그림을 붙여 해소.)

import raw from './volume-contents.json'

/** 목차 한 줄 — 한 단원. */
export interface ContentsUnit {
  no: number
  /** 그 단원이 실제로 쓴 유형들. */
  types: string[]
  items: number
  /** 조합기가 잡은 예상 소요(분). 못 잡았으면 `null`. */
  minutes: number | null
  /** 그 단원 지문들의 길이 [최소, 최대]. 지문이 없는 유형뿐이면 `null`. */
  words: [number, number] | null
  /** 그 단원이 쓴 **원글의 실제 제목들**. 단원 제목을 짓지 않는 이유는 스냅샷 머리말 참조. */
  passages: string[]
}

export interface PreviewChoiceItem {
  no: number
  type: string
  /**
   * 초등 3종(rhyme · word_meaning · spell_blank)인가.
   *
   * ⚠️ 이 셋은 **선택지가 3~4개일 수 있고** 원글이 없다(출처가 교육과정 별표다).
   *   5지선다 규칙으로 그리면 전부 떨어진다 — 그래서 화면이 갈래를 알아야 한다.
   */
  kind?: 'elementary'
  stem: string
  /** 초등 3종 — 문제에 제시되는 낱말·문장. */
  shown?: string
  /** 초등 철자 완성 — 선택지가 없는 단답의 정답. */
  answerText?: string
  /** 순서 유형 — 주어진 글. */
  intro?: string
  /** 순서 유형 — (A)(B)(C) 덩어리. */
  blocks?: { label: string; text: string }[]
  /** 삽입 유형 — 주어진 문장. 생성형 — 요약 문장. */
  given?: string | null
  /** 삽입 유형 — 본문 문장과 슬롯 위치(−1 이면 슬롯 없음). */
  body?: { text: string; slot: number }[]
  /** 생성형 — 지문. */
  passage?: string
  /** 생성형 — 밑줄 칠 구절. */
  underline?: string | null
  choices: string[]
  /** 선택지가 있는 문항의 정답 번호. 단답(`answerText`)이면 없다. */
  answer?: number
  explanation: { text: string; from: 'batch' | 'rule' } | null
  source: string | null
}

export interface PreviewUnit {
  no: number
  minutes: number | null
  vocabulary: { word: string; meaningKo: string }[]
  items: PreviewChoiceItem[]
}

export interface VolumeContents {
  band: number
  step: number | null
  title: string | null
  schoolBand: string | null
  units: ContentsUnit[]
  totalItems: number
  totalMinutes: number
  stoppedBecause: string | null
  /** 화면이 그릴 수 있는 문항이 든 첫 단원. 없으면 `null`. */
  sample: PreviewUnit | null
}

interface Snapshot {
  generatedAt: string
  unitsPerVolume: number
  bands: number[]
  volumes: Record<string, VolumeContents>
  problems: { band: number; error: string }[]
}

const snapshot = raw as unknown as Snapshot

/** 스냅샷을 구운 시각(ISO). 화면이 함께 내보인다. */
export const CONTENTS_GENERATED_AT: string = snapshot.generatedAt

/** 한 권에 몇 단원으로 조판했는가 — 시장 중앙값을 따른다. */
export const CONTENTS_UNITS_PER_VOLUME: number = snapshot.unitsPerVolume

/**
 * 그 V레벨의 목차. 스냅샷에 없으면 `null` — **빈 목차를 만들어 내지 않는다.**
 *
 * 권은 V레벨 여럿을 쓸 수 있으므로 **첫 레벨**로 찾는다(조판도 그 밴드로 찍는다).
 */
export function contentsOf(vLevels: readonly number[]): VolumeContents | null {
  for (const v of vLevels) {
    const found = snapshot.volumes[String(v)]
    if (found) return found
  }
  return null
}

/** 그 밴드가 스냅샷을 굽다 만난 문제. 없으면 `null`. */
export function contentsProblem(vLevels: readonly number[]): string | null {
  for (const v of vLevels) {
    const p = snapshot.problems.find((x) => x.band === v)
    if (p) return p.error
  }
  return null
}
