// apps/web/src/lib/csat/__tests__/copyright-boundary.integration.test.ts
//
// **평가원 문항 원문이 학습자 쪽으로 새지 않는지** 실 DB 로 확인한다.
//
// 이 파이프라인은 지문·선지를 통째로 들고 있다. 그것은 한국교육과정평가원의 저작물이고,
// 우리가 학습자에게 줄 수 있는 것은 **그 문항을 분석해 우리가 쓴 글**뿐이다.
// 그래서 `csat_items.passage` 는 `authenticated` 에게 `USING (false)` 이고,
// 학습자 화면은 `csat_items_public` 뷰만 읽는다(`lib/csat/learner.ts` 는 일부러
// service_role 이 아니라 **RLS 를 따르는 클라이언트**를 쓴다).
//
// ⚠️ **이 테스트가 실패하면 = 저작물이 공개됐다는 뜻이다.** 테스트를 고치지 말고 정책을 원복할 것.
//    분석 데이터가 아무리 좋아도 이 경계가 무너지면 서비스를 세울 수 없다.
//
// SERVICE_ROLE_KEY / ANON_KEY 없으면 자동 skip (CI).

import fs from 'node:fs'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? ''

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

describe.skipIf(skip)('기출 원문 저작권 경계 (실 DB)', () => {
  let anon: SupabaseClient
  let learner: SupabaseClient
  let svc: SupabaseClient

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    const { error } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw new Error(`검증 계정 로그인 실패: ${error.message}`)
  })

  afterAll(async () => {
    await learner?.auth.signOut()
  })

  it('service_role 은 지문을 읽는다 — 대조군이 없으면 아래 단언이 무의미하다', async () => {
    // 사정권(독해)만 본다. 듣기 문항의 `passage` 는 짧은 조각이라 대조군이 못 된다.
    const { data, error } = await svc
      .from('csat_items')
      .select('id, passage')
      .eq('in_scope', true)
      .not('passage', 'is', null)
      .limit(50)
    expect(error).toBeNull()
    const long = (data ?? []).filter((r) => String(r.passage ?? '').length > 300)
    expect(long.length, '긴 지문이 하나도 없으면 이 테스트가 아무것도 안 지킨다').toBeGreaterThan(0)
  })

  for (const who of ['anon', 'learner'] as const) {
    it(`${who} 은 csat_items 를 읽지 못한다`, async () => {
      const db = who === 'anon' ? anon : learner
      const { data, error } = await db.from('csat_items').select('id, passage').limit(5)
      // 막는 방법은 둘 다 옳다 — 정책이 0행을 돌려주거나(RLS), 권한 자체가 없거나.
      // **읽히는 것만이 실패다.**
      if (!error) expect(data ?? [], `${who} 이 csat_items 를 읽었다`).toHaveLength(0)
    })

    it(`${who} 은 지문 컬럼을 이름으로 콕 집어도 못 읽는다`, async () => {
      const db = who === 'anon' ? anon : learner
      const { data, error } = await db.from('csat_items').select('passage').not('passage', 'is', null).limit(1)
      if (!error) expect(data ?? [], `${who} 이 passage 를 읽었다`).toHaveLength(0)
    })
  }

  // **경계가 어디에 그어져 있는지** — 이 목록이 곧 결정이다.
  //
  //   나가면 안 되는 것: `passage` · `choices` · `stem`.
  //     발문은 「기능 문구」라 공개 가능하다고 봤으나(2026-09-23), 144문항의 발문에 영어 원문이
  //     들어 있다 — 문장 삽입의 「주어진 문장」 · 밑줄 구절(2026-09-25 실측). 그래서 컬럼 권한으로 닫았다
  //     (`20260925120000_csat_items_public_hide_stem`).
  //   나가도 되는 것:   `answer`(정답 번호) · `points`(배점) — 평가원이 정답표로 이미 공개한다.
  //
  // 즉 이 테스트가 지키는 것은 "다 가려라" 가 아니라 **선이 옮겨 다니지 않는 것**이다.
  it('학습자용 뷰는 지문·선지 컬럼 자체를 갖지 않고, 발문은 읽히지 않는다', async () => {
    const { data, error } = await learner.from('csat_items_public').select('id, exam_id, no, type_id, answer, points').limit(1)
    expect(error, `학습자가 csat_items_public 을 못 읽으면 화면이 빈다: ${error?.message}`).toBeNull()
    expect(data?.length, '뷰가 비어 있으면 이 단언이 아무것도 안 지킨다').toBe(1)
    for (const forbidden of ['passage', 'choices'] as const) {
      const r = await learner.from('csat_items_public').select(forbidden).limit(1)
      expect(r.error, `csat_items_public 에 ${forbidden} 가 있다`).not.toBeNull()
    }
    const stem = await learner.from('csat_items_public').select('stem').limit(1)
    if (!stem.error) expect(stem.data ?? [], '학습자가 발문을 읽었다').toHaveLength(0)
  })

  it('학습자가 읽는 분석·검수는 published 만 보인다', async () => {
    const { data, error } = await learner.from('csat_item_analyses').select('status').limit(200)
    expect(error).toBeNull()
    expect(data?.length, '분석이 하나도 안 보이면 학습자 화면이 빈다').toBeGreaterThan(0)
    expect([...new Set((data ?? []).map((r) => r.status))]).toEqual(['published'])
  })

  it('학습자가 분석을 고쳐 쓰지 못한다 — 검수를 우회하는 가장 짧은 길이다', async () => {
    const { data: one } = await svc.from('csat_item_analyses').select('id').eq('status', 'published').limit(1)
    expect(one?.length).toBe(1)
    const { error } = await learner
      .from('csat_item_analyses')
      .update({ measured_ability: '학습자가 고쳐 쓴 값' })
      .eq('id', one![0].id)
      .select('id')
    // 정책이 막는 방법은 둘 — 오류를 내거나, 0행을 고치거나. 다시 읽어 확인한다.
    const { data: after } = await svc
      .from('csat_item_analyses')
      .select('measured_ability')
      .eq('id', one![0].id)
      .single()
    expect(after?.measured_ability, `학습자 UPDATE 가 통했다 (error=${error?.message ?? 'none'})`).not.toBe(
      '학습자가 고쳐 쓴 값',
    )
  })
})

// ── 오버레이 앵커 — **경계 밖에 새 문을 내지 않았는지** ──────────────────
//
// 위 검사들은 `csat_items` 와 `csat_items_public` 만 본다. 그런데 2026-09-13 에 **새 저장소**가
// 생겼다 — `lib/csat/anchor-data/*.json`(평가원 문제지 위에 상자를 그릴 좌표). 그 파일들은
// 위 검사의 사정권 **밖**이라, 누군가 거기에 지문 조각을 담기 시작하면 **테스트는 계속 초록인데
// 경계는 옮겨간다.** 이 파일 주석이 경고하는 바로 그 실패 모드다
// ("이 테스트가 지키는 것은 «다 가려라» 가 아니라 **선이 옮겨 다니지 않는 것**이다").
//
// 그래서 규칙을 코드로 고정한다: **앵커에는 숫자와 식별자만 있다.**
//   허용되는 문자열 값은 `exam_id`(회차 id)와 `sha256`(16진수 64자) 둘뿐이고,
//   나머지는 전부 숫자여야 한다. 문장·낱말이 들어오는 즉시 실패한다.
//
// DB 가 필요 없으므로 **CI 에서도 돈다**(위 블록은 키가 없으면 skip 된다).
describe('오버레이 앵커 데이터는 좌표만 담는다', () => {
  const dir = path.resolve(process.cwd(), 'src/lib/csat/anchor-data')

  it('앵커 폴더가 있고 색인이 회차를 가리킨다 — 없으면 아래 단언이 아무것도 안 지킨다', () => {
    expect(fs.existsSync(dir), `${dir} 가 없다 (build-anchor-data.mjs --commit)`).toBe(true)
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    expect(Array.isArray(idx.exams)).toBe(true)
    expect(idx.exams.length, '색인이 비어 있다').toBeGreaterThan(0)
  })

  it('문자열 값은 exam_id 와 sha256 뿐 — 지문·선지 글자가 한 자도 없다', () => {
    const bad: string[] = []
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
      const walk = (v: unknown, key: string) => {
        if (typeof v === 'number') return
        if (typeof v === 'string') {
          if (key === 'exam_id' || key === 'sha256') return
          bad.push(`${f}: ${key} = "${v.slice(0, 40)}"`)
          return
        }
        if (Array.isArray(v)) {
          v.forEach((x) => walk(x, key))
          return
        }
        if (v && typeof v === 'object') {
          for (const k of Object.keys(v as Record<string, unknown>)) walk((v as Record<string, unknown>)[k], k)
          return
        }
        bad.push(`${f}: ${key} 가 숫자도 문자열도 객체도 아니다`)
      }
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      walk(j, 'root')
      expect(/^[0-9a-f]{64}$/.test(j.sha256), `${f}: sha256 형식이 아니다`).toBe(true)
    }
    expect(bad, `앵커에 좌표가 아닌 문자열이 있다 — 경계가 옮겨갔다:\n  ${bad.slice(0, 6).join('\n  ')}`).toHaveLength(0)
  })

  it('한 해시가 두 회차를 가리키지 않는다 — 회차 판정이 동전 던지기가 된다', () => {
    // 실측: M2009 의 문제지 PDF 가 M2106 것과 sha256 까지 같다(원본 중복). 빌드가 양쪽 다
    // 떨어뜨리는데, 그 가드가 사라지면 학습자가 떨어뜨린 파일의 회차를 틀리게 답한다.
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    const hashes = idx.exams.map((e: { sha256: string }) => e.sha256)
    expect(new Set(hashes).size, '색인에 같은 해시가 둘 있다').toBe(hashes.length)
  })

  it('오버레이 화면·로더는 passage·choices 를 입에 올리지 않는다', () => {
    // 컬럼 이름이 코드에 **나타나지도 않아야** 한다. 나타나면 언젠가 select 에 들어간다.
    //
    // ⚠️ 목록의 파일이 **사라질 수 있다** — `668c3f05`(학습자 훈련·오버레이 걷기)에서 라우트와
    //    OverlayClient 가 지워졌는데 이 목록이 따라오지 않아 ENOENT 로 죽었다(2026-09-20).
    //    그래서 없는 파일은 건너뛰되, **하나도 안 봤으면 실패**시킨다 — 0건 통과는 측정 실패다.
    const candidates = [
      'src/lib/csat/overlay.ts',
      'src/app/api/csat/overlay/route.ts',
      'src/app/(main)/csat/overlay/OverlayClient.tsx',
      'src/lib/csat/anchor-loader.ts',
    ]
    const present = candidates.filter((rel) => fs.existsSync(path.resolve(process.cwd(), rel)))
    expect(present.length, `오버레이 계열 파일을 하나도 못 찾았다 — 목록이 낡았다: ${candidates.join(', ')}`).toBeGreaterThan(0)
    for (const rel of present) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')
      // 주석에서 「담지 않는다」고 설명하는 것은 허용한다 — 코드 줄에만 없어야 한다.
      const codeLines = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      for (const forbidden of ['passage', 'raw_block']) {
        expect(codeLines.includes(forbidden), `${rel} 코드 줄에 ${forbidden} 가 있다`).toBe(false)
      }
    }
  })
})

// ── 지문 골격 — **두 번째 새 저장소** ────────────────────────────────────
//
// 2026-09-15 에 또 하나 생겼다 — `lib/csat/skeleton-data/*.json`(문장 길이 + 인용문).
// 앵커와 다른 점이 있다: **여기는 글자가 들어 있는 것이 설계다.** 화면이 «근거가 지문의
// 어디인가» 를 보여주려면 인용문을 내보내야 하고, 그건 이미 `learner.ts` 가 하던 일이다.
//
// 그러므로 지킬 규칙이 앵커와 다르다. 「문자열 0」이 아니라 **「문자열이 들어올 수 있는
// 자리가 넷뿐」** 이다. 누군가 `sentenceText` 같은 키를 하나 더하는 순간 실패해야 한다 —
// 그게 지문 전체가 새는 가장 짧은 길이고, 화면은 그때도 멀쩡히 돈다.
//
// 노출 «양» 은 `skeleton-data.test.ts` 가 지킨다(현행 배포본의 최대치를 넘지 않는지).
// 여기서 지키는 것은 노출 «자리» 다. 둘 다 있어야 한다 — 양만 재면 새 필드를 놓치고,
// 자리만 보면 같은 필드로 더 많이 내보내는 것을 놓친다.
describe('지문 골격 데이터는 정해진 네 자리에만 글자를 담는다', () => {
  const dir = path.resolve(process.cwd(), 'src/lib/csat/skeleton-data')
  /**
   * 글자가 허용되는 키. 늘리려면 **왜 필요한지 여기 적고** 늘릴 것.
   *
   * · `exam_id` · `id` — 식별자(`M2309` · `M2309#42`). 지문 글자가 아니다.
   * · `anchorId` — `'answer'` · `'reject:2'`. 닫힌 모양이다.
   * · `text` — **여기만 지문 글자가 나간다.** 분석이 근거로 든 인용문이고, 양은
   *   `skeleton-data.test.ts` 가 따로 잠근다(현행 배포본의 최대치를 넘지 않는다).
   * · `built` — 굽은 시각.
   * · `type_id`(2026-09-15 추가) — 유형 코드(`R-BLANK` 등 26종의 닫힌 집합). 지문과 무관하다.
   *   왜 넣었나: 「이 유형은 근거가 지문의 어디에 있나」 같은 분석이 없으면 **매번 DB 를
   *   타야** 하고, 망이 끊기면 못 한다(실측: 그 이유로 3사이클 미뤄졌다). 골격이 스스로를
   *   설명하게 두면 그 분석은 영원히 오프라인이다.
   */
  // `exam_label` 은 **우리가 붙인 회차 이름**이다("2026학년도 수능") — 평가원 지문이 아니다.
  // 2026-09-15 에 「다음 기출」을 조회 0회로 바꾸며 더했다: 이름 하나 때문에 DB 를 치면
  // 유형 전체 분석 432행·633 kB 를 끌고 온다. **이 목록에 더할 때는 그 값이 무엇인지 적는다** —
  // 적지 않고 더하면 다음 사람이 「원래 있던 것」으로 읽고, 그때 목록은 경계를 지키는 것을 멈춘다.
  const TEXT_KEYS = new Set(['exam_id', 'exam_label', 'id', 'anchorId', 'text', 'built', 'type_id'])

  it('골격 폴더가 있고 색인이 회차를 가리킨다 — 없으면 아래 단언이 아무것도 안 지킨다', () => {
    expect(fs.existsSync(dir), `${dir} 가 없다 (build-skeleton-data.mjs --write)`).toBe(true)
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    expect(Array.isArray(idx.exams)).toBe(true)
    expect(idx.exams.length, '색인이 비어 있다').toBeGreaterThan(0)
  })

  it('문자열은 네 자리에만 있다 — 새 필드로 지문이 새는 길을 막는다', () => {
    const bad: string[] = []
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const walk = (v: unknown, key: string) => {
        if (typeof v === 'number') return
        if (typeof v === 'string') {
          // `from` — 앵커를 어디서 찾았나(`answer` · `reject` · `tempt`). **닫힌 세 값**만 받는다.
          // 2026-09-15 「끌리는 이유」 칩과 함께 골격에 들어왔는데 이 목록이 따라오지 않아
          // 이 검사가 2,261건으로 빨갛게 서 있었다(2026-09-17 발견). 값을 좁혀서 연다.
          if (key === 'from' && ['answer', 'reject', 'tempt'].includes(v)) return
          if (!TEXT_KEYS.has(key)) bad.push(`${f}: ${key} = "${v.slice(0, 40)}"`)
          return
        }
        if (Array.isArray(v)) {
          v.forEach((x) => walk(x, key))
          return
        }
        if (v && typeof v === 'object') {
          for (const k of Object.keys(v as Record<string, unknown>)) walk((v as Record<string, unknown>)[k], k)
        }
      }
      walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), 'root')
    }
    expect(bad, `골격에 허용되지 않은 문자열이 있다 — 경계가 옮겨갔다:\n  ${bad.slice(0, 6).join('\n  ')}`).toHaveLength(0)
  })

  it('한 문장이 통째로 드러나는 일이 드물다 — 이어 붙이면 지문이 된다', () => {
    // 문장 하나가 100% 드러나는 것 자체는 인용의 정상 범위다(근거 문장이 짧으면 그렇게 된다).
    // 위험한 것은 **그런 문장이 한 지문에 몰리는 것**이다 — 다 드러난 문장이 절반을 넘으면
    // 이어 붙여 지문을 복원할 수 있다. 문항 단위로 본다.
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    const worst = { id: '', frac: 0 }
    for (const e of idx.exams as { exam_id: string }[]) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, `${e.exam_id}.json`), 'utf8'))
      for (const it of j.items as { id: string; sentences: { chars: number; reveals: { text: string }[] }[] }[]) {
        const full = it.sentences.filter(
          (s) => s.reveals.reduce((a, r) => a + r.text.length, 0) >= s.chars * 0.9,
        ).length
        const frac = full / Math.max(it.sentences.length, 1)
        if (frac > worst.frac) {
          worst.frac = frac
          worst.id = it.id
        }
      }
    }
    expect(worst.frac, `${worst.id} 에서 거의 다 드러난 문장이 ${(worst.frac * 100).toFixed(0)}%`).toBeLessThan(0.5)
  })
})

// ── 강의 대본 데이터 — 원문은 위치로 가리키고, 인용은 짧게 ─────────────────
// 대본은 우리가 쓴 한국어 해설이다. 영어 조각만 지문을 인용할 수 있고, 그 길이는 적재가
// 8단어 연속 일치 0 으로 막는다(`lib/csat/lecture/validate.ts`). 여기서는 **커밋된 산출물 자체**가
// 그 경계 안에 있는지를 DB 없이 본다 — 적재를 거치지 않고 파일이 바뀌어도 잡히게.
describe('강의 대본 데이터의 경계', () => {
  const dir = path.join(process.cwd(), 'src/lib/csat/lecture-data')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json') : []
  const ENUM: Record<string, string[]> = {
    kind: ['analysis', 'anchor'],
    role: ['intro', 'strategy', 'structure', 'evidence', 'eliminate', 'trap', 'vocab', 'wrapup'],
    lang: ['ko-KR', 'en-US'],
  }
  const FREE = new Set(['exam_id', 'item_id', 'built', 'generated_by', 'id', 'text'])

  it('대본 파일이 있다 — 없으면 아래 단언이 아무것도 안 지킨다', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('문자열은 정해진 자리에만 — 열거형은 닫힌 값만', () => {
    const bad: string[] = []
    for (const f of files) {
      const walk = (v: unknown, key: string) => {
        if (typeof v === 'string') {
          if (ENUM[key]) {
            if (!ENUM[key].includes(v)) bad.push(`${f}: ${key} = "${v.slice(0, 30)}"`)
          } else if (!FREE.has(key)) bad.push(`${f}: ${key} = "${v.slice(0, 30)}"`)
          return
        }
        if (Array.isArray(v)) return v.forEach((x) => walk(x, key))
        if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
      }
      walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), 'root')
    }
    expect(bad, bad.slice(0, 6).join('\n')).toEqual([])
  })

  it('영어 조각은 7단어 이하다 — 긴 원문은 위치로 가리킨다', () => {
    const long: string[] = []
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      for (const [id, lec] of Object.entries(j.lectures as Record<string, { cues: { id: string; segments: { lang: string; text: string }[] }[] }>))
        for (const c of lec.cues)
          for (const g of c.segments)
            // ⚠️ 아포스트로피는 **곱슬(’)도 센다**. `[A-Za-z']` 만 보면 `enemy’s` 가 두 낱말로
            //    쪼개져 7단어 조각이 8단어로 잡힌다(2026-09-20 `2016#25 c6` 이 그래서 걸렸다 —
            //    데이터는 규칙을 지키고 있었고 세는 쪽이 틀렸다).
            if (g.lang === 'en-US' && (g.text.match(/[A-Za-z'’]+/g) ?? []).length > 7) long.push(`${id} ${c.id}`)
    }
    expect(long, `8단어 이상 영어 조각: ${long.slice(0, 5).join(', ')}`).toEqual([])
  })

  it('한국어 조각에는 영어 문장이 숨어 있지 않다', () => {
    const hidden: string[] = []
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      for (const [id, lec] of Object.entries(j.lectures as Record<string, { cues: { id: string; segments: { lang: string; text: string }[] }[] }>))
        for (const c of lec.cues)
          for (const g of c.segments) if (g.lang === 'ko-KR' && /[A-Za-z]{2,}/.test(g.text)) hidden.push(`${id} ${c.id}`)
    }
    expect(hidden).toEqual([])
  })
})
