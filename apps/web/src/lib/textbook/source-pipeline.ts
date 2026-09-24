// apps/web/src/lib/textbook/source-pipeline.ts
//
// **원천별 작업 진행표 — 단계 정의와 칸 판정(순수 함수).** (2026-09-25 · 사용자 요청 「단계별 작업 방법·진행 상태를 소스별로 화면에서」)
//
// ── 왜 생겼나 ─────────────────────────────────────────────────────────
// 원문이 교재 재료가 되기까지의 단계(모음 → 원문 점검 → 발췌 → 학년 분석 → 내용 판정)는 스크립트와 도움말 산문에만
// 있었다. 화면은 모든 원천을 합친 관문 줄기 하나와 「확인할 항목」 표뿐이라, 「PLOS 는 어디까지 왔나」 ·
// 「원문 점검은 몇 편 남았나」 · 「발췌기는 왜 아무것도 안 자르나」를 답하지 못했다. 원문 점검 단계는 화면에 **아예 없었다.**
//
// 숫자는 DB 함수 `csat_source_pipeline_live()` 가 센다 — 원본/조각 구분은 `gate-rules.mjs` 의 `derivativeKind`,
// 보관 상태는 `retentionOf` 와 **같은 규칙**이다(둘이 갈리면 화면이 발췌기와 다른 말을 한다).
// 이 파일은 그 숫자를 칸의 모양(값 · 한 줄 · 상태)으로 접고, 단계마다 하는 법을 붙인다.
//
// ⚠️ 명령은 저장소에 실제로 있는 파일만 적는다 — `source-pipeline.test.ts` 가 파일 존재를 잰다.

export type StageKey = 'collect' | 'retain' | 'extract' | 'level' | 'judge' | 'usable'
export type Tone = 'ok' | 'pile' | 'stop' | 'na'
export type Who = 'auto' | 'claude' | 'person' | 'result'

export const TONE_LABEL: Record<Tone, string> = { ok: '끝', pile: '남음', stop: '막힘', na: '해당 없음' }
export const WHO_LABEL: Record<Who, string> = { auto: '자동', claude: 'Claude', person: '사람', result: '결과' }

/** DB 함수 한 행을 화면 모양으로 — 원천 하나. */
export interface PipelineRow {
  source: string
  total: number
  pieces: number
  keep: number
  keepPending: number
  hold: number
  discard: number
  undecided: number
  levelled: number
  judged: number
  lastGet: string | null
  /** 실어도 되는 편수(`csat_source_live_rollup` usable). 못 셌으면 null. */
  usable: number | null
  /** 수집 명령(`csat_source_registry.harvest_cmd`). 등록 안 됐으면 null. */
  harvestCmd: string | null
}

/** 원천의 원문 점검 회차 기록(`docs/source-check/round-*.md`). */
export interface SourceRounds {
  /** 이중 판정 κ — 잰 회차만, 오래된 것부터. */
  kappas: { round: string; n: number; kappa: number }[]
  /** 가장 최근 회차의 보관 비율(%). */
  keepPct: number | null
  keepRound: string | null
}

export interface Cell {
  /** 크게 보이는 값. */
  value: string
  /** 한 줄 설명 — 남은 수 · 끝 · 해당 없음. */
  note: string
  tone: Tone
  /** 막대 길이 0~1. 없으면 막대를 안 그린다. */
  ratio: number | null
}

export interface StageDef {
  key: StageKey
  no: string
  name: string
  who: Who
  /** 이 단계가 하는 일 — 한 줄. */
  says: string
  /** 먼저 끝나야 하는 것. */
  needs: string
}

export const PIPELINE_STAGES: readonly StageDef[] = [
  { key: 'collect', no: '①', name: '모음', who: 'auto', says: '누리집·기관에서 원문을 받아 창고에 넣는다', needs: '가져오는 곳이 등록돼 있어야 한다' },
  {
    key: 'retain',
    no: '②',
    name: '원문 점검',
    who: 'claude',
    says: '원본 전문을 읽고 보관 · 보류 · 폐기를 가른다(원문 점검 기준)',
    needs: '없음 — 다만 대량 판정은 그 원천의 판정자 일치도(κ)가 두 회차 연속 0.6 이상일 때',
  },
  { key: 'extract', no: '③', name: '발췌', who: 'auto', says: '보관된 원본에서 지문으로 쓸 구간을 잘라 조각을 만든다', needs: '② 원문 점검에서 「보관」 — 판정 없는 원본은 건너뛴다' },
  { key: 'level', no: '④', name: '학년 분석', who: 'auto', says: '글의 학년 수준·어휘·문체를 잰다', needs: '원문 또는 조각이 창고에 있어야 한다' },
  { key: 'judge', no: '⑤', name: '내용 판정', who: 'claude', says: '본문을 읽고 교재에 쓸지 · 갈래 · 재료를 적는다', needs: '④ 학년 분석' },
  { key: 'usable', no: '⑥', name: '실을 수 있음', who: 'result', says: '적격 7축을 모두 통과해 교재에 실을 수 있는 편수', needs: '① ~ ⑤' },
]

const n = (v: number) => v.toLocaleString('ko-KR')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

/** 남은 몫이 전체의 1% 이하이면 「끝」으로 본다 — 수만 편 중 몇 편 때문에 줄 전체를 주황으로 칠하지 않는다. 남은 수는 한 줄에 적는다. */
function doneTone(left: number, total: number): Tone {
  if (left <= 0) return 'ok'
  return left / total <= 0.01 ? 'ok' : 'pile'
}

export function cellOf(row: PipelineRow, stage: StageKey): Cell {
  const originals = row.total - row.pieces
  switch (stage) {
    case 'collect':
      return {
        value: n(row.total),
        note: row.pieces ? `원본 ${n(originals)} · 조각 ${n(row.pieces)}` : '원본',
        tone: row.total > 0 ? 'ok' : 'stop',
        ratio: null,
      }
    case 'retain': {
      if (originals <= 0) return { value: '—', note: '원본 없음(조각만)', tone: 'na', ratio: null }
      const decided = originals - row.undecided
      return {
        value: `${n(decided)} / ${n(originals)}`,
        note: row.undecided ? `${n(row.undecided)} 판정 전${row.hold ? ` · 보류 ${n(row.hold)}` : ''}` : row.hold ? `끝 · 보류 ${n(row.hold)}` : '끝',
        tone: row.undecided === 0 ? 'ok' : decided === 0 ? 'stop' : doneTone(row.undecided, originals),
        ratio: decided / originals,
      }
    }
    case 'extract':
      if (row.keepPending === 0 && row.pieces === 0) return { value: '—', note: '자를 원본 없음', tone: 'na', ratio: null }
      return {
        value: n(row.pieces),
        note: row.keepPending ? `${n(row.keepPending)} 발췌 대기` : '끝',
        tone: row.keepPending ? 'pile' : 'ok',
        ratio: row.keepPending ? row.pieces / (row.pieces + row.keepPending) : 1,
      }
    case 'level': {
      const left = row.total - row.levelled
      return {
        value: `${pct(row.levelled, row.total)}%`,
        note: left ? `${n(left)} 남음` : '끝',
        tone: row.levelled === 0 && row.total > 0 ? 'stop' : doneTone(left, row.total),
        ratio: row.total ? row.levelled / row.total : 0,
      }
    }
    case 'judge': {
      const left = row.total - row.judged
      return {
        value: `${pct(row.judged, row.total)}%`,
        note: left ? `${n(left)} 남음` : '끝',
        tone: row.judged === 0 && row.total > 0 ? 'stop' : doneTone(left, row.total),
        ratio: row.total ? row.judged / row.total : 0,
      }
    }
    case 'usable':
      if (row.usable == null) return { value: '—', note: '못 셈', tone: 'na', ratio: null }
      return { value: n(row.usable), note: row.usable ? '편' : '아직 0편', tone: row.usable ? 'ok' : 'stop', ratio: null }
  }
}

/** 원천 한 줄이 「끝난 원천」인가 — 접힌 목록으로 보낼지 정한다. */
export function rowDone(row: PipelineRow): boolean {
  return (['retain', 'extract', 'level', 'judge'] as const).every((k) => {
    const t = cellOf(row, k).tone
    return t === 'ok' || t === 'na'
  })
}

/** 대량 판정을 해도 되나 — 최근 두 회차 κ 가 모두 0.6 이상. */
export function roundsReady(r: SourceRounds | undefined): { ready: boolean; says: string } {
  if (!r || r.kappas.length === 0) return { ready: false, says: '이중 판정 기록 없음 — 표본 회차부터' }
  const last = r.kappas.slice(-2)
  const k = r.kappas[r.kappas.length - 1]!
  const ready = last.length === 2 && last.every((x) => x.kappa >= 0.6)
  return {
    ready,
    says: ready
      ? `대량 판정 가능 — 최근 두 회차 κ ${last.map((x) => x.kappa.toFixed(2)).join(' · ')}`
      : `표본 더 필요 — κ ${k.kappa.toFixed(3)} (${k.round} · ${k.n}편)${last.length < 2 ? ' · 측정 1회' : ''}`,
  }
}

/* ───────────────────────── 하는 법 ───────────────────────── */

export interface HowTo {
  /** 먼저 돌리는 한 줄 — 예행(쓰지 않음)이 먼저다. */
  steps: { cmd: string; why: string; writes: boolean }[]
  /** Claude Code 에 맡길 때 붙여 넣는 지시문. 사람 판단이 필요 없는 단계면 null. */
  claude: string | null
  /** 다시 돌려도 안전한가. */
  rerun: string
}

export function howTo(row: PipelineRow, stage: StageKey, nextRound: number): HowTo | null {
  const src = row.source
  switch (stage) {
    case 'collect':
      return row.harvestCmd
        ? {
            steps: [{ cmd: row.harvestCmd, why: `${src} 에서 새 원문을 받는다`, writes: true }],
            claude: null,
            rerun: '수집기는 이미 받은 원문을 건너뛴다(원천 id 로 거른다)',
          }
        : {
            steps: [
              {
                cmd: 'node --tls-max-v1.2 scripts/acp/collect-daily.mjs',
                why: '등록된 가져오는 곳을 한 번에 돈다 — 이 원천의 수집 명령은 등록돼 있지 않다',
                writes: true,
              },
            ],
            claude: null,
            rerun: '이미 받은 원문은 건너뛴다',
          }
    case 'retain':
      if (row.total - row.pieces <= 0 || row.undecided === 0) return null
      if (src === 'plos') {
        return {
          steps: [
            { cmd: 'node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs', why: '예행 — 판정할 원본 수만 센다', writes: false },
            { cmd: 'node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 60', why: '전문을 20편씩 묶음 파일로 뽑는다(읽기만)', writes: false },
          ],
          claude: [
            'PLOS 원본 원문 점검(보관 판정) 표본 회차를 해 줘.',
            '1. `node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 60` 으로 묶음 파일을 뽑아.',
            '2. `scripts/csat/plos-raw-triage-brief.md` 와 `docs/source-check/criteria.md` 를 따라 묶음마다 chunk-NNN.out.json 을 써(전문을 끝까지 읽고 keep/hold/discard + 채울 칸 + 이유).',
            '3. 묶음 하나는 두 번째 판정자(별도 서브에이전트)가 따로 판정하고 `node scripts/csat/gate-reviews-agreement.mjs` 로 κ 를 재.',
            '4. **DB 에는 쓰지 마.** κ · 보관/보류/폐기 비율 · 채우는 칸 분포 · 어긋난 편의 이유를 회차 기록으로 남기고 알려 줘.',
          ].join('\n'),
          rerun: '뽑기는 읽기만 하고, 이미 판정됐거나 이미 묶음에 든 원본은 건너뛴다',
        }
      }
      return {
        steps: [
          { cmd: `node --tls-max-v1.2 scripts/csat/source-round-export.mjs --round ${nextRound}`, why: '예행 — 원천별 후보 수만 센다', writes: false },
          {
            cmd: `node --tls-max-v1.2 scripts/csat/source-round-export.mjs --round ${nextRound} --write --per 20 --sources ${src}`,
            why: '이 원천 표본 20편을 회차 묶음으로 뽑는다(읽기만)',
            writes: false,
          },
        ],
        claude: [
          `원천 ${src} 의 원문 점검 회차 ${nextRound} 를 해 줘.`,
          `1. \`node --tls-max-v1.2 scripts/csat/source-round-export.mjs --round ${nextRound} --write --per 20 --sources ${src}\` 로 표본을 뽑아.`,
          '2. `docs/source-check/criteria.md` 를 따라 전문을 끝까지 읽고 keep/hold/discard · 채울 칸 · 이유를 적어.',
          '3. 두 번째 판정자가 같은 표본을 따로 판정하고 `node scripts/csat/gate-reviews-agreement.mjs` 로 κ 를 재.',
          `4. \`node scripts/csat/source-round-report.mjs --round ${nextRound}\` 로 회차 기록을 만들고, **DB 에는 쓰지 말고** 결과를 알려 줘.`,
        ].join('\n'),
        rerun: '같은 회차 번호면 같은 표본이 뽑힌다(재실행 안전)',
      }
    case 'extract':
      if (row.keepPending === 0) return null
      return {
        steps: [
          { cmd: 'pnpm exec tsx scripts/csat/plos-extract.mjs --limit 200 --compare', why: '예행 — 200편에서 무엇이 잘리는지 본다(쓰지 않음)', writes: false },
          { cmd: 'pnpm exec tsx scripts/csat/plos-extract.mjs --limit 200 --commit', why: '보관된 원본 200편을 잘라 조각으로 넣는다', writes: true },
        ],
        claude: null,
        rerun: '보관 판정이 없는 원본은 건너뛰고, 이미 자른 원본은 다시 자르지 않는다',
      }
    case 'level':
      if (row.levelled >= row.total) return null
      return {
        steps: [
          { cmd: 'pnpm dlx tsx scripts/acp/process-queue.mjs', why: '분석 대기열 상태만 본다', writes: false },
          { cmd: 'pnpm dlx tsx scripts/acp/process-queue.mjs --commit --limit 10', why: '대기 중인 글 10편을 분석한다 — LLM 비용이 든다', writes: true },
        ],
        claude: null,
        rerun: '대기(queued) 상태만 집는다 · 실패한 글은 다시 안 집힌다',
      }
    case 'judge':
      if (row.judged >= row.total) return null
      return {
        steps: [
          { cmd: 'node scripts/csat/gate-article-export.mjs', why: '예행 — 판정할 글 수만 센다', writes: false },
          { cmd: 'node scripts/csat/gate-article-export.mjs --write --per 100 --max 12', why: '판정 묶음을 만든다(읽기만)', writes: false },
        ],
        claude: [
          `원천 ${src} 의 내용 판정 드레인을 해 줘.`,
          '1. `node scripts/csat/gate-article-export.mjs --write --per 100 --max 12` 로 묶음을 만들어.',
          '2. `docs/source-check/criteria.md` 기준으로 묶음마다 chunk-NN.out.json 을 채워(본문을 읽고 verdict · genre · 재료).',
          '3. `node scripts/csat/gate-reviews-verify.mjs <chunk> <out>` 로 검증하고 `node scripts/csat/gate-mixed-import.mjs --input <out>` 를 예행으로 돌려 결과를 보여 줘. **적재(--commit)는 내가 확인한 뒤에.**',
        ].join('\n'),
        rerun: '이미 판정된 글은 건너뛴다 · 같은 판정 재적재는 변경 0',
      }
    case 'usable':
      return null
  }
}
