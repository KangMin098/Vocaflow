// apps/web/src/lib/csat/trap-atlas.ts
//
// **오답 지도 — 「평가원은 오답을 몇 가지 방법으로 만드는가」의 순수 모델.**
//
// ── 이 파일이 뒤집는 것 ───────────────────────────────────────────────
// 지금까지 이 제품의 기출 화면은 **유형 26개를 1급 시민**으로 두었다. 유형을 고르면 그 유형의
// 절차와 함정이 나온다. 그러면 학습자가 들고 가야 할 것은 **26벌의 절차**다.
//
// 그런데 3,208개 오답 선지를 전부 세어 보면 그렇게 생기지 않았다 (실측 2026-09-15):
//
//   상위 9가지 함정 = 1,935개 (60.3%) · 각각 **26유형 중 13~17유형**에 걸쳐 나온다
//   10위부터는 갑자기 **4~5유형**으로 떨어진다 ← 여기에 틈이 있다
//
// 13 과 4 사이의 이 틈이 이 화면의 근거다. 위쪽 아홉은 **유형을 가로지르는 기술**이고
// 아래쪽은 유형에 매인 요령이다. 외울 것은 26이 아니라 **9 + (지금 푸는 유형의 몇 개)** 다.
// (작업기억 ~4항목 · Sweller — 학습과학 원칙 6. 26 → 9 는 그 방향으로 가는 감축이다.)
//
// ── 수치는 어디서 오나 ────────────────────────────────────────────────
// `trap-atlas.json` — `scripts/csat/build-trap-atlas.mjs` 가 DB 에서 세어 구운 것이다.
// 손으로 고치지 말 것. 낡았는지는 `node scripts/csat/build-trap-atlas.mjs --check`.
//
// ⚠️ **`server-only` 를 들이지 않는다.** 히어로는 클라이언트에서 유형을 바꾸며 다시 세므로
//    (I3 — 200ms 안에 반응해야 한다) 이 모듈이 브라우저 그래프에 들어간다. JSON 은 정적
//    import 라 조회 왕복이 0 이고, 지문 원문은 애초에 이 파일에 들어오지 않는다.

import raw from './trap-atlas.json'

export interface TrapExample {
  item_id: string
  slug: string
  exam_label: string
  no: number
  type_id: string
  choice: number
  tempting: string
  reject: string
}

export interface TrapEntry {
  key: string
  n: number
  recent: number
  items: number
  types: number
  by_type: Record<string, number>
  by_type_recent: Record<string, number>
  examples: TrapExample[]
}

export interface AtlasType {
  id: string
  name: string
  status: string
  distractors: number
  recent: number
  items: number
  named: number
}

export interface AtlasCorpus {
  exams: number
  items: number
  analyzed: number
  distractors: number
  distinct_traps: number
  named: number
  named_recent: number
  recent: number
  year_min: number
  year_max: number
}

interface Atlas {
  built_at: string
  recent_from: number
  min_n: number
  corpus: AtlasCorpus
  types: AtlasType[]
  traps: TrapEntry[]
}

// ⚠️ `as unknown as` 가 필요하다 — 구운 JSON 은 함정마다 `by_type` 의 **키가 다르므로**
//    TS 가 32개의 서로 다른 리터럴 타입으로 읽는다. `Record<string, number>` 와 직접
//    겹치지 않아 한 번에 단언할 수 없다. 모양이 맞는지는 `--check` 와 회귀가 지킨다.
const atlas = raw as unknown as Atlas

export const CORPUS: AtlasCorpus = atlas.corpus
export const RECENT_FROM: number = atlas.recent_from
export const BUILT_AT: string = atlas.built_at
export const TRAPS: TrapEntry[] = atlas.traps
export const ATLAS_TYPES: AtlasType[] = atlas.types

/**
 * 「유형을 가로지른다」의 경계.
 *
 * 임의로 고른 수가 아니다 — 실측 분포에 **틈이 있다**: 9위(인과 역전)가 13유형인데
 * 10위(지시어 선행사 절단)는 4유형이다. 그 사이 어디를 끊어도 같은 아홉이 나온다.
 * 분포가 바뀌어 틈이 사라지면 이 상수가 아니라 화면의 이야기를 다시 써야 한다 —
 * `__tests__/trap-atlas.test.ts` 가 틈이 아직 있는지 지킨다.
 */
export const UNIVERSAL_MIN_TYPES = 10

export const UNIVERSAL: TrapEntry[] = TRAPS.filter((t) => t.types >= UNIVERSAL_MIN_TYPES)

/**
 * 함정마다 「어떻게 잡는가」 한 줄.
 *
 * ⚠️ **이것은 센 값이 아니라 우리가 쓴 글이다.** 수치(n·유형 수)와 섞어 읽으면 안 된다.
 *    3,208개 오답의 `how_to_reject` 를 읽고 공통 동작만 남긴 것이고, 각 줄이 실제로 그
 *    함정에서 통하는지는 화면이 함께 내미는 **실제 기출 예시**로 학습자가 검증한다.
 *    (Empathetic Feedback — "이렇게 하세요" 만 있고 근거가 없으면 그것도 외울 것이다.)
 */
export const DETECTOR: Record<string, string> = {
  '어휘 함정': '겹치는 낱말을 지문에서 찾아 그 문장째 읽는다. 낱말이 같아도 문장이 다르면 버린다.',
  '부분 사실': '선지를 절로 쪼개 절마다 근거를 짚는다. 한 절이라도 못 짚으면 버린다.',
  '반대 진술': '선지 서술어에 방향(+/−)을 매기고 지문의 같은 자리와 맞댄다.',
  무관: '근거 문장을 손으로 가리킬 수 없으면 버린다. 그럴듯함은 근거가 아니다.',
  '지문 밖 상식': '세상에서 맞는지 묻지 말고, 이 글이 그렇게 썼는지만 묻는다.',
  '주체 역전': '선지의 주어를 지문에서 찾는다. 동사가 같아도 주어가 다르면 버린다.',
  '범위 과대': '전칭·최상급(all·always·never·most)에 표시하고, 지문이 그 범위를 보증하는지 본다.',
  '범위 과소': '선지가 한 사례·한 조건만 말하면, 지문이 일반 진술을 했는지 본다.',
  '인과 역전': 'A→B 인지 B→A 인지 지문의 연결어(because·so·thus)에서 방향을 읽는다.',
  '지시어 선행사 절단': '지시어를 앞으로 되짚어 가리킬 명사를 찾는다. 앞 덩어리에 없으면 그 자리가 아니다.',
  '마무리 문장 위치 오판': '마무리 표지(Thus·In short)가 든 덩어리는 끝 후보다. 첫 자리에 두지 않는다.',
  '어휘 반복 유인': '같은 낱말이 반복된다고 이어지는 것이 아니다. 지시 관계가 이어지는지 본다.',
  '첫 등장 위반': '고유명사·정관사 없는 명사가 처음 나오는 덩어리가 앞이다.',
  '총론-각론 역전': '총론이 앞이다. 각론에만 있는 구체어(수치·사례명)를 표시해 순서를 가른다.',
  '연결사 방향 충돌': '연결사(However·Therefore)가 요구하는 앞뒤 관계를 먼저 쓰고 자리를 고른다.',
  '조건-귀결 절단': 'if·when 절과 그 귀결은 붙어 있어야 한다. 갈라진 자리를 찾는다.',
  '시간·인과 순서 역전': '사건에 번호를 매겨 시간 순으로 늘어놓고 선지와 맞댄다.',
  '국소 어색함': '한 낱말이 어색해 보여도 문장 전체가 앞뒤와 맞으면 정답 후보가 아니다.',
  '열거·병렬 절단': '열거의 표지(first·also·finally)를 세어 빠진 자리를 찾는다.',
  '항목 짝 바꾸기': '표·도표의 행과 열을 손으로 짚어 값을 하나씩 맞댄다.',
}

export interface RankRow {
  key: string
  n: number
  pct: number
  /** 이 함정이 걸쳐 있는 유형 수 — 「가로지르는가」의 근거 */
  types: number
  universal: boolean
  detector: string | null
  examples: TrapExample[]
}

export interface Rank {
  /** null 이면 전체 */
  type_id: string | null
  type_name: string | null
  /** 이 범위의 오답 선지 총수 — 막대 비율의 분모 */
  total: number
  rows: RankRow[]
  /** 이름이 안 붙은(드문) 나머지 */
  other: { n: number; pct: number }
}

const typeById = new Map(ATLAS_TYPES.map((t) => [t.id, t]))

/**
 * 한 범위(전체 또는 유형 하나)의 함정 분포.
 *
 * **순수 함수다** — 같은 입력에 같은 값. 히어로가 칩을 누를 때 이것만 다시 부르므로
 * 네트워크 왕복이 0 이고 반응이 프레임 안에 든다(I3).
 *
 * `recentOnly` 는 「최근 4개년만」 — 옛 회차 설계가 지금과 다르다고 보는 학습자를 위한 것.
 */
export function rankFor(typeId: string | null, recentOnly = false): Rank {
  const pick = (t: TrapEntry) =>
    typeId === null ? (recentOnly ? t.recent : t.n) : (recentOnly ? t.by_type_recent : t.by_type)[typeId] ?? 0

  const total =
    typeId === null
      ? recentOnly
        ? CORPUS.recent
        : CORPUS.distractors
      : recentOnly
        ? typeById.get(typeId)?.recent ?? 0
        : typeById.get(typeId)?.distractors ?? 0

  const rows: RankRow[] = TRAPS.map((t) => ({
    key: t.key,
    n: pick(t),
    pct: total > 0 ? (100 * pick(t)) / total : 0,
    types: t.types,
    universal: t.types >= UNIVERSAL_MIN_TYPES,
    detector: DETECTOR[t.key] ?? null,
    // 유형을 고르면 **그 유형의 예시만** 내민다. 다른 유형 예시를 보여 주면 학습자가
    // 「이 유형에서 이렇게 나온다」로 잘못 읽는다. 없으면 전체 예시로 되돌아간다.
    examples:
      typeId === null ? t.examples : t.examples.filter((e) => e.type_id === typeId).length
        ? t.examples.filter((e) => e.type_id === typeId)
        : t.examples,
  }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1))

  const named = rows.reduce((a, r) => a + r.n, 0)
  const other = Math.max(0, total - named)

  return {
    type_id: typeId,
    type_name: typeId ? typeById.get(typeId)?.name ?? typeId : null,
    total,
    rows,
    other: { n: other, pct: total > 0 ? (100 * other) / total : 0 },
  }
}

/**
 * 한 유형에서 **전체보다 유난히 잦은** 함정 — 「이 유형에서 특히 조심할 것」.
 *
 * 그냥 상위 셋을 보여 주면 어느 유형을 눌러도 「어휘 함정 · 부분 사실 · 반대 진술」이 나온다
 * (그게 전체 1~3위니까). 학습자에게 그것은 정보가 아니다. 그래서 **전체 비율 대비 배수**로
 * 고른다 — 표본이 얇으면 배수가 출렁이므로 최소 개수를 함께 건다.
 */
export function standoutFor(typeId: string, minN = 4, minLift = 1.3): RankRow[] {
  const all = rankFor(null)
  const base = new Map(all.rows.map((r) => [r.key, r.pct]))
  return rankFor(typeId)
    .rows.filter((r) => r.n >= minN && r.pct >= (base.get(r.key) ?? 0) * minLift)
    .sort((a, b) => b.pct / (base.get(b.key) || 1) - a.pct / (base.get(a.key) || 1))
}

/** 화면이 「몇 가지를 외우면 되는가」를 말할 때 쓰는 값. */
export function universalCoverage(): { kinds: number; n: number; pct: number; minTypes: number } {
  const n = UNIVERSAL.reduce((a, t) => a + t.n, 0)
  return {
    kinds: UNIVERSAL.length,
    n,
    pct: (100 * n) / CORPUS.distractors,
    minTypes: Math.min(...UNIVERSAL.map((t) => t.types)),
  }
}
