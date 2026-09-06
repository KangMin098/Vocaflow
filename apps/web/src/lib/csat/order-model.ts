// apps/web/src/lib/csat/order-model.ts
//
// **「새 교재 만들기」의 순수 모델** — 타입 · 근거 매핑 · 게이트 판정 · 명령 조립.
// DB 도 파일도 안 읽는다.
//
// ── 왜 이 파일이 생겼나 (2026-09-06) ─────────────────────────────────
// 교재 공장에는 공정 화면이 여덟이었는데, **한 권을 내려는 사람이 갈 곳이 없었다.** 여덟 칸은
// 전부 「전체가 지금 어떤가」를 말하고(재고 65만 · 해설 보유율 · 밴드별 구멍), 각 칸의 명령은
// 파이프라인 **전체**를 미는 드레인이다. 그래서 "고2 어휘책 한 권 내자" 를 시작하려면
// 관리자가 여덟 화면을 돌며 머릿속에서 한 권 몫을 골라내야 했다 — 그 골라내기가 어디에도
// 안 적혀 있으니 매번 다시 한다.
//
// 이 모델은 그 골라내기를 **한 자리에 적는다**: 시리즈 → 권 → 그 권이 쓰는 유형 →
// 그 유형의 재고·해설 → 그 유형을 뒷받침하는 근거(평가원 기출 분석 / 시중 교재 코퍼스) →
// 못 넘은 게이트 → 그것을 채우는 명령 → 조판 명령.
//
// ⚠️ **화면이 값을 짓지 않는다.** 유형 이름은 `SERIES_TYPE_LABEL_KO`, 배합과 학령은
//   `SERIES_CATALOG`, 재고는 집계표에서 온다. 여기서 새로 지으면 조판물과 갈린다.

import {
  SERIES_TYPE_LABEL_KO,
  type SeriesItemType,
} from '@vocaflow/library-pipeline/textbook-series'

/**
 * 우리 문항 유형 → 그것을 뒷받침하는 **평가원 유형**.
 *
 * ── 왜 이 표가 필요한가 ──────────────────────────────────────────────
 * 「무엇을 근거로 이 문항을 만드나」에 답하는 유일한 사슬이다. 우리 유형(`vocab_choice`)과
 * 평가원 유형(`R-VOCAB`)은 이름도 코드 체계도 달라서, 이 표가 없으면 화면이 기출 분석
 * 2,234건을 갖고도 **어느 문항의 근거인지 말하지 못한다.**
 *
 * ⚠️ **빈 배열이 정보다.** 내신·초등 축(`unit_vocab`·`spell_blank`·`rhyme`…)은 평가원에
 *   대응 유형이 아예 없다 — 시험 자체가 그것을 안 낸다. 그 자리를 억지로 이어 붙이면
 *   "기출 근거 있음" 이라는 거짓이 만들어진다. 그 유형의 근거는 **시중 교재 코퍼스**이고,
 *   화면은 그렇게 말해야 한다.
 */
export const CSAT_BACKING: Record<SeriesItemType, readonly string[]> = {
  vocab_choice: ['R-VOCAB', 'X-VOCAB'],
  grammar_choice: ['R-GRAMMAR'],
  order: ['R-ORDER', 'X-ORDER'],
  insert: ['R-INSERT'],
  irrelevant: ['R-IRRELEVANT'],
  // ── 평가원에 대응 유형이 없는 축 ────────────────────────────────────
  // 내신(학교 시험)과 초등 축이다. 근거는 시중 교재 코퍼스 79종 · 140,739문항.
  rhyme: [],
  word_meaning: [],
  spell_blank: [],
  word_order: [],
  blank_word: [],
  grammar_fix: [],
  unit_vocab: [],
  unit_grammar: [],
}

/** 그 평가원 유형 하나의 준비 상태. */
export interface CsatBacking {
  id: string
  name: string
  /** 그 유형의 기출 문항 수 (`csat_items`). */
  items: number
  /** 그 유형의 분석 수 (`csat_item_analyses`, published). */
  analyses: number
  /** 유형 리포트(플랫폼 자체 연구)가 발행됐는가 (`csat_type_reports.status`). */
  report: boolean
}

/** 한 권이 쓰는 유형 하나 — 재고와 근거를 함께 든다. */
export interface OrderTypeAsset {
  type: SeriesItemType
  label: string
  /** 그 (유형 × 수준) 재고. 못 쟀으면 null — 0 이 아니다. */
  items: number | null
  explained: number | null
  /** 이 유형을 뒷받침하는 평가원 유형들. **빈 배열이면 기출 대응이 없다**(위 표 참조). */
  csat: CsatBacking[]
}

/** 만들 수 있는 권 하나. */
export interface OrderVolume {
  seriesId: string
  brand: string
  accent: string
  /** 시리즈 안의 계단 번호 = 조판기의 `--band`. */
  step: number
  schoolBand: string
  title: string
  recipe: string
  types: OrderTypeAsset[]
  items: number | null
  explained: number | null
  published: boolean
}

/** 준비된 근거 전체 — 어느 권을 고르든 같은 값이라 한 번만 싣는다. */
export interface OrderEvidence {
  /** 기출 시험지 — 수능과 모의고사를 나눠 센다. 「기출」 한 덩어리로 세면 무엇이 있는지 모른다. */
  exams: { suneung: number; mock: number }
  items: number
  analyses: number
  reviews: number
  /** 발행된 유형 리포트 수 = 플랫폼 자체 연구. */
  typeReports: number
  typeReportsTotal: number
  /** 시중 교재 코퍼스 — 저장소 밖 store 의 실측 집계. */
  market: {
    series: number
    publishers: number
    documents: number
    itemsMeasured: number
    /** 12축 종합 지수 (1.000 = 시장 평균). */
    index: number
    measuredAt: string | null
  }
}

export interface OrderView {
  volumes: OrderVolume[]
  evidence: OrderEvidence
  /** 한 권에 드는 문항 수 — 정본에서 온다. */
  itemsPerVolume: number
  /** 한 권의 단원 수 — 조판 명령의 `--units`. */
  unitsPerBook: number
  /** 재고를 언제 센 값인가 (ISO). 못 읽었으면 null — 신선도를 주장하지 않는다. */
  inventoryAt: string | null
  loadError: string | null
}

/* ─────────────────────────── 게이트 ─────────────────────────── */

export type GateId = 'items' | 'explained' | 'typeMix' | 'evidence'

export interface Gate {
  id: GateId
  /** 이 관문이 묻는 것. 화면 라벨이 아니라 **질문**이다. */
  question: string
  pass: boolean
  /** 왜 못 넘었나. 넘었으면 null. */
  why: string | null
  /** 못 넘었을 때 채우는 명령. 넘었으면 빈 배열. */
  commands: { cmd: string; why: string; claudeCode?: boolean }[]
}

/**
 * 한 권의 관문 넷을 판정한다.
 *
 * 순서가 곧 인과다 — 문항이 없으면 해설이 있을 수 없고, 배합이 안 맞으면 문항 수가 차도
 * 그 권은 못 찍는다. 그래서 **처음 막힌 관문 하나만** 화면이 펼친다(원칙 6 인지 부하).
 */
export function judgeGates(v: OrderVolume, itemsPerVolume: number, unitsPerBook: number): Gate[] {
  const band = v.step
  const empty = v.types.filter((t) => t.items === 0)
  const unmeasured = v.types.some((t) => t.items == null)
  const noReport = v.types.flatMap((t) => t.csat).filter((c) => !c.report)

  return [
    {
      id: 'items',
      question: `문항이 ${itemsPerVolume}개 있나`,
      pass: v.items != null && v.items >= itemsPerVolume,
      why:
        v.items == null
          ? '재고를 못 쟀다 — 0 이 아니라 모르는 것이다'
          : v.items >= itemsPerVolume
            ? null
            : `${v.items.toLocaleString()} / ${itemsPerVolume} — ${itemsPerVolume - v.items}개 모자란다`,
      commands:
        v.items != null && v.items >= itemsPerVolume
          ? []
          : [
              {
                cmd: `pnpm dlx tsx scripts/textbook/store-new-types.mjs --band ${band} --commit`,
                why: '그 밴드의 지문에서 문항을 생성해 적재한다 — 재실행 안전(이미 있는 지문은 건너뛴다)',
              },
            ],
    },
    {
      id: 'typeMix',
      question: '배합의 모든 유형에 재고가 있나',
      pass: !unmeasured && empty.length === 0,
      why: unmeasured
        ? '재고를 못 쟀다'
        : empty.length
          ? `${empty.map((t) => t.label).join(' · ')} 가 0개 — 배합을 못 맞춘다`
          : null,
      commands: empty.length
        ? [
            {
              cmd: `pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band ${band} --size 6`,
              why: `빈 유형(${empty.map((t) => t.type).join(', ')}) 몫을 청크로 뽑는다 — 이어서 Claude Code 가 채우고 import 한다`,
              claudeCode: true,
            },
          ]
        : [],
    },
    {
      id: 'explained',
      question: `해설이 ${itemsPerVolume}개 있나`,
      pass: v.explained != null && v.explained >= itemsPerVolume,
      why:
        v.explained == null
          ? '해설 수를 못 쟀다'
          : v.explained >= itemsPerVolume
            ? null
            : `${v.explained.toLocaleString()} / ${itemsPerVolume}`,
      commands:
        v.explained != null && v.explained >= itemsPerVolume
          ? []
          : [
              {
                cmd: 'pnpm dlx tsx scripts/textbook/explain-fill.mjs --commit',
                why: '규칙으로 채울 수 있는 해설을 먼저 채운다 — 재실행 안전(이미 있는 해설은 안 덮는다)',
              },
              {
                cmd: `pnpm dlx tsx scripts/textbook/explain-drain-export.mjs --band ${band} --volume ${unitsPerBook} --size 12`,
                why: '남은 몫을 청크로 뽑는다 — Claude Code 가 채운 뒤 `explain-drain-import.mjs --commit`',
                claudeCode: true,
              },
            ],
    },
    {
      id: 'evidence',
      question: '이 권이 쓰는 평가원 유형의 연구가 끝났나',
      // 기출 대응이 없는 유형만으로 이뤄진 권(초등·내신 축)은 이 관문을 **통과**한다 —
      // 물어볼 평가원 유형이 없는 것이지 준비가 덜 된 것이 아니다.
      pass: noReport.length === 0,
      why: noReport.length ? `${noReport.map((c) => c.name).join(' · ')} 리포트 미발행` : null,
      commands: noReport.length
        ? [
            {
              cmd: 'node scripts/csat/analysis-drain-export.mjs --limit 6',
              why: '분석이 덜 된 유형 몫을 뽑는다 — Claude Code(csat-item-analyst)가 채우고 import 한다',
              claudeCode: true,
            },
          ]
        : [],
    },
  ]
}

/** 처음 막힌 관문. 전부 넘었으면 null. */
export function firstBlocked(gates: readonly Gate[]): Gate | null {
  return gates.find((g) => !g.pass) ?? null
}

/**
 * 조판 명령 — **인자가 다 채워진 한 줄.**
 *
 * 이게 이 화면의 산출물이다. 공정 화면들은 `--band 6` 같은 **예시**를 들고 있어서 관리자가
 * 자기 권의 값으로 고쳐 써야 했는데, 고치려면 다시 여덟 화면을 봐야 했다.
 */
export function renderCommand(v: OrderVolume, unitsPerBook: number): string {
  return (
    `pnpm dlx tsx scripts/textbook/render-volume.mjs` +
    ` --series ${v.seriesId} --band ${v.step} --units ${unitsPerBook}` +
    ` --out volume-${v.seriesId}-v${v.step}.html`
  )
}

/**
 * 관문을 다 넘은 권에게 할 말 — **이미 낸 권과 처음 내는 권을 같은 말로 부르지 않는다.**
 *
 * ⚠️ 실측 2026-09-06: 카탈로그 19권이 **전부** 조판 기록을 갖고 있다. 그래서 이 갈래가
 *   사실상 기본 경로인데, 둘을 같은 말로 부르면 이미 서가에 있는 권을 두고
 *   「아래 한 줄이면 이 권이 나온다」고 말하게 된다 — 사실이 아니고, 덮어쓴다는 것도 안 보인다.
 *
 * 문구를 화면이 아니라 여기 두는 이유: 화면의 이 갈래는 걸음 ④ 에서만 보이는데
 * `renderToString` 은 늘 걸음 ①을 그리므로 **DOM 으로는 검증이 안 된다**(없는 문자열을
 * 「없다」고 확인하는 빈 테스트가 된다). 순수 함수로 빼면 갈래가 실제로 갈리는지 잰다.
 */
export function pressPlan(v: OrderVolume, gateCount: number): { note: string; why: string } {
  if (v.published) {
    return {
      note: `관문 ${gateCount}개를 모두 넘었다 — 이 권은 이미 냈다. 아래 한 줄은 같은 자리에 다시 찍는다.`,
      why: '다시 조판한다 — 조판 기록의 (시리즈, 단) 그 행과 출력 HTML 을 덮어쓴다. 행이 늘지는 않는다',
    }
  }
  return {
    note: `관문 ${gateCount}개를 모두 넘었다 — 아래 한 줄이면 이 권이 나온다.`,
    why: '조판한다. 재실행 안전 — 조판 기록은 (시리즈, 단) 한 행을 덮어쓴다',
  }
}

/** 유형 코드 → 한국어 이름. 정본을 그대로 나른다 — 화면이 다시 짓지 않는다. */
export function typeLabel(t: SeriesItemType): string {
  return SERIES_TYPE_LABEL_KO[t] ?? t
}
