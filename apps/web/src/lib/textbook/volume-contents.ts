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
  kind?: 'elementary' | 'underline' | 'short' | 'arrange' | 'irrelevant'
  stem: string
  /** 초등 3종 — 문제에 제시되는 낱말·문장. */
  shown?: string
  /** 단답·배열 — 선택지가 없는 문항의 정답(글자). */
  answerText?: string
  /** 단답 — 힌트. */
  hint?: string | null
  /** 밑줄형 — 본문 문장들. */
  sentences?: string[]
  /** 밑줄형 — 어느 문장의 어느 구절에 번호를 다는가. */
  /**
   * 밑줄. `tokenIdx` 는 **있을 때만** 온다 — 어법은 자리를 저장하고 어휘는 안 한다.
   * 있으면 자리로 긋는다(같은 낱말이 여러 번 나와도 확정된다).
   */
  underlines?: { sentenceIdx: number; word: string; tokenIdx?: number }[]
  /** 배열형 — 흩어진 낱말 더미. */
  bank?: string[]
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
  /**
   * 선택지. **없는 유형이 있다** — 문장 삽입은 본문의 동그라미 번호가 곧 선택지고,
   * 밑줄형은 밑줄 번호가 그렇다(실측 2026-09-06: 필수로 적어 뒀다가 화면이
   * `undefined.map` 을 불렀다). 단답·배열도 없다.
   */
  choices?: string[]
  /** 선택지·슬롯이 있는 문항의 정답 번호. 단답(`answerText`)이면 없다. */
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
  /**
   * 어느 시리즈의 권인가. 옛 스냅샷에는 없다 — 없으면 독해다(그때는 독해만 구웠다).
   */
  seriesId?: string
  /**
   * 이 권을 몇 단원으로 조판했는가. 시리즈마다 다르다(독해 10 · 어휘/구문 20).
   *
   * ⚠️ 화면은 top-level `CONTENTS_UNITS_PER_VOLUME` 이 아니라 **이 값**을 써야 한다.
   *   top-level 은 마지막으로 구운 시리즈의 값이라 다른 시리즈 권에 틀린 수를 적는다.
   *   옛 스냅샷에는 없으므로 없으면 `units.length` 로 읽는다.
   */
  unitsPerVolume?: number
  step: number | null
  title: string | null
  schoolBand: string | null
  units: ContentsUnit[]
  totalItems: number
  totalMinutes: number
  stoppedBecause: string | null
  /**
   * **이 권을 찍을 수 있는가** — 실제로 실릴 문항 기준의 준비도.
   *
   * ⚠️ 재고 전량(`ShelfVolume.itemCount`, 밴드에 따라 수만 건)과 **다른 것을 잰다.**
   *   제작 콘솔이 재고 전량으로 판정하다가 "Claude Code 차례 · 해설" 이라며 **할 일이 0인**
   *   드레인을 가리켰다(실측 2026-09-07: 전 밴드 배치 몫 0). 책은 안 막혀 있었다.
   *
   * 옛 스냅샷에는 없으므로 선택 필드다 — 없으면 "못 쟀다" 로 다룬다(0 으로 세지 않는다).
   */
  readiness?: {
    /** 이 권에 실릴 문항 수. */
    items: number
    /** 그중 **조판기가 그릴 수 있는** 수. */
    renderable: number
    /** 그중 해설이 붙은 수. */
    explained: number
    /**
     * 교정 검사 **대상**이 된 문항 수 — `payload.sentences` 가 배열이고 40자를 넘는 것.
     *
     * ⚠️ 분모를 따로 센다. 대상 밖(초등 낱말 유형 등)을 "깨끗함" 으로 세면 결함률이
     *    실제보다 낮게 나온다 — `proofread-report.mjs` 가 세운 규칙 그대로다.
     */
    proofChecked: number
    /** 그중 표기 결함이 **없는** 수. */
    proofClean: number
    /** 유형별 — 어느 유형이 안 그려지는지가 다음에 손볼 자리다. */
    byType: Record<string, { items: number; renderable: number; explained: number }>
  }
  /** 화면이 그릴 수 있는 문항이 든 첫 단원. 없으면 `null`. */
  sample: PreviewUnit | null
}

interface Snapshot {
  generatedAt: string
  unitsPerVolume: number
  bands: number[]
  /**
   * 키는 **`<시리즈>:<V레벨>`** 이다 — 예 `reading:5` · `vocab:5`.
   *
   * ⚠️ 2026-09-23 까지 키가 **V레벨 하나**(`'5'`)였다. 그런데 시리즈는 셋이고 계단은 겹친다
   *   (독해 5단 · 어휘 5단 · 구문 5단이 전부 V5). 그래서 `/library/textbooks/vocab/5` 가
   *   **독해 4권의 목차를 자기 것으로 인쇄했다** — 실측: 조판 기록은 20단원 120문항인데
   *   화면은 10단원 60문항에 「The Will to Power…」 같은 독해 지문과 독해 유형을 적었다.
   *   스냅샷이 독해 7권만 담고 있었고(2026-09-13), 찾는 키에 시리즈가 없었기 때문이다.
   */
  volumes: Record<string, VolumeContents>
  problems: { band: number; error: string; series?: string }[]
}

const snapshot = raw as unknown as Snapshot

/**
 * 스냅샷 키. 시리즈를 **반드시** 포함한다.
 *
 * 옛 스냅샷(시리즈 없는 숫자 키)은 **독해로만** 받아 준다 — 그 파일이 담고 있던 것이
 * 독해뿐이었기 때문이다. 어휘·구문을 옛 키로 읽어 주면 바로 그 버그가 돌아온다.
 */
function lookup(seriesId: string, vLevel: number): VolumeContents | undefined {
  const hit = snapshot.volumes[`${seriesId}:${vLevel}`]
  if (hit) return hit
  return seriesId === 'reading' ? snapshot.volumes[String(vLevel)] : undefined
}

/** 스냅샷을 구운 시각(ISO). 화면이 함께 내보인다. */
export const CONTENTS_GENERATED_AT: string = snapshot.generatedAt

/** 한 권에 몇 단원으로 조판했는가 — 시장 중앙값을 따른다. */
export const CONTENTS_UNITS_PER_VOLUME: number = snapshot.unitsPerVolume

/**
 * 그 **시리즈의** 그 V레벨 목차. 스냅샷에 없으면 `null` — **빈 목차를 만들어 내지 않고,
 * 다른 시리즈의 목차를 대신 내주지도 않는다.**
 *
 * 권은 V레벨 여럿을 쓸 수 있으므로 **첫 레벨**로 찾는다(조판도 그 밴드로 찍는다).
 *
 * ⚠️ `seriesId` 가 인자로 **반드시** 들어온다. 기본값을 두지 않는 이유는 `shelf-query.ts` 가
 *   같은 실수를 이미 겪었기 때문이다 — 기본값 `'reading'` 때문에 시리즈 셋 중 둘이
 *   학습자에게 도달하지 않았다(그 파일 머리말). 여기서 기본값을 두면 호출부가 인자를
 *   빠뜨린 것을 아무도 못 본다.
 */
export function contentsOf(seriesId: string, vLevels: readonly number[]): VolumeContents | null {
  for (const v of vLevels) {
    const found = lookup(seriesId, v)
    if (found) return found
  }
  return null
}

/**
 * 원글이 없는 유형 — 초등 3종. 이 셋은 사전에서 나오므로 `ref_title` 자리에 **낱말**이 들어간다.
 *
 * ⚠️ 그걸 지문 제목처럼 인쇄하면 목차가 거짓말을 한다(실측 2026-09-06: 초등 저학년 목차가
 *   `add · about · act` 를 글 제목처럼 늘어놓았다). 조판기도 같은 함정을 먼저 겪어
 *   출처를 「2022 개정 교육과정 별표 어휘」로 못 박아 뒀다.
 *
 * 스냅샷을 다시 굽지 않고 **읽는 쪽에서 가른다** — 유형 목록만 보면 알 수 있다.
 */
export const WORD_UNIT_TYPES: ReadonlySet<string> = new Set(['rhyme', 'word_meaning', 'spell_blank'])

/** 그 단원이 다루는 것이 **글인가 낱말인가.** 목차가 라벨을 바꿔 단다. */
export function unitCovers(unit: ContentsUnit): 'article' | 'word' {
  return unit.types.length > 0 && unit.types.every((t) => WORD_UNIT_TYPES.has(t)) ? 'word' : 'article'
}

/**
 * 그 **시리즈의** 그 밴드가 스냅샷을 굽다 만난 문제. 없으면 `null`.
 *
 * 옛 스냅샷의 문제 기록에는 `series` 가 없다 — 그때는 독해만 구웠으므로 독해로 읽는다.
 */
export function contentsProblem(seriesId: string, vLevels: readonly number[]): string | null {
  for (const v of vLevels) {
    const p = snapshot.problems.find(
      (x) => x.band === v && (x.series ?? 'reading') === seriesId,
    )
    if (p) return p.error
  }
  return null
}

/**
 * 그 시리즈가 스냅샷에 **하나라도** 구워져 있는가.
 *
 * ⚠️ 「이 권의 목차가 아직 없다」와 「이 시리즈를 아예 안 구웠다」는 다른 사실이고 할 일이
 *   정반대다(전자는 그 권만, 후자는 `contents-snapshot --series <id>` 전량). 화면이 그
 *   둘을 같은 문장으로 적으면 아무도 다시 굽지 않는다.
 */
export function seriesHasContents(seriesId: string): boolean {
  const prefix = `${seriesId}:`
  for (const k of Object.keys(snapshot.volumes)) {
    if (k.startsWith(prefix)) return true
    // 옛 숫자 키는 독해가 소유한다.
    if (seriesId === 'reading' && /^\d+$/.test(k)) return true
  }
  return false
}
