// apps/web/src/app/api/vocab/[setId]/spread/route.ts
//
// **단어장 지면 — 조판기가 만든 것을 화면에 내려 준다.**
//
// ── 왜 라우트가 필요한가 ───────────────────────────────────────────
// 지면의 재료(뜻 갈래·예문 짝·파생형·노트)는 `shared_dictionary` 에 있는데 **anon 은 그 표를
// 한 행도 못 읽는다**(RLS — `/fit` 이 같은 벽에 부딪혀 `textfit_resolve_levels_public` 을 만든
// 이유다). 그래서 브라우저에서 join 할 수 없고, 서버가 대신 읽어 **조판된 결과만** 내려 준다.
//
// ── 무엇을 내려 주나 ───────────────────────────────────────────────
// 지면 전체가 아니라 **첫 며칠치**다. 상세 시트는 "이 책이 어떻게 생겼나" 를 보여 주는
// 자리이지 학습하는 자리가 아니고, 2,000낱말 세트의 전 지면을 내리면 응답이 수 MB 가 된다.
// 학습 계획·누적 복습·색인 규모는 **전체를 세어** 함께 내려 준다 — 그래야 "며칠이면 끝나는가"
// 가 미리보기에서도 참이다.
//
// 재실행 안전: 읽기만 한다.

import { NextResponse } from 'next/server'
import { setKindOf } from '@/lib/library/vocab/set-kind'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildVocabColophon, ladderStrip, VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'
import { typesetVocabSet, type TypesetWord } from '@vocaflow/library-pipeline/vocab-typeset'

export const dynamic = 'force-dynamic'

/** 상세 시트가 받는 지면 분량. 늘리면 응답이 커지고 줄이면 지면이 지면으로 안 보인다. */
const PREVIEW_DAYS = 2
/** 조판에 넣을 표제어 상한 — 계획·색인 규모를 참으로 유지하면서 응답을 묶어 둔다. */
const MAX_WORDS = 1200

export async function GET(
  _req: Request,
  { params }: { params: { setId: string } },
): Promise<NextResponse> {
  const setId = params.setId
  if (!/^[0-9a-f-]{36}$/i.test(setId)) {
    return NextResponse.json({ error: 'bad set id' }, { status: 400 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    // 키가 없는 환경에서 500 을 내지 않는다 — 지면이 없는 것과 서버가 고장난 것은 다르다.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const { data: setRow, error: setErr } = await supabase
    .from('shared_word_sets')
    .select('id, title, is_published, curation_query, created_at, slug, version')
    .eq('id', setId)
    .maybeSingle()
  if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 })
  if (!setRow || !(setRow as { is_published: boolean }).is_published) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const { data: wordRows, error: wErr } = await supabase
    .from('shared_words')
    .select('word, sort_order, chapter')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true })
    .limit(MAX_WORDS)
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
  const rows = (wordRows ?? []) as Array<{ word: string; sort_order: number | null; chapter: number | null }>
  if (rows.length === 0) return NextResponse.json({ error: 'empty' }, { status: 404 })

  /*
    사전은 **표제어 단위로** 한 번에 읽는다. 행마다 조회하면 1,200번 왕복한다.
    `in` 은 인자 수 제한이 있어 500 씩 끊는다.
  */
  const dict = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => r.word)
    const { data } = await supabase
      .from('shared_dictionary')
      .select('word, meanings_ko, meaning_ko, ipa, pos, synonyms, antonyms, collocations, korean_learner_note, inflections')
      .in('word', chunk)
    for (const d of (data ?? []) as Array<Record<string, unknown>>) {
      dict.set(String(d.word).toLowerCase(), d)
    }
  }

  const words: TypesetWord[] = rows.map((r) => {
    const d = dict.get(r.word.toLowerCase()) ?? {}
    const infl = d.inflections as { forms?: Array<{ form?: string }> } | null | undefined
    return {
      word: r.word,
      meaningsKo: (d.meanings_ko as TypesetWord['meaningsKo']) ?? null,
      meaningKo: (d.meaning_ko as string | null) ?? null,
      ipa: (d.ipa as string | null) ?? null,
      partOfSpeech: (d.pos as string | null) ?? null,
      synonyms: (d.synonyms as string[] | null) ?? null,
      antonyms: (d.antonyms as string[] | null) ?? null,
      collocations: (d.collocations as string[] | null) ?? null,
      koreanLearnerNote: (d.korean_learner_note as string | null) ?? null,
      inflectionForms: (infl?.forms ?? []).map((f) => f.form ?? '').filter(Boolean),
      groupKey: r.chapter != null ? `ch-${r.chapter}` : null,
      groupLabel: r.chapter != null ? `${r.chapter}장` : null,
    }
  })

  const cq = (setRow as { curation_query: Record<string, unknown> | null }).curation_query ?? {}
  const recipe = cq.recipe as { meta?: { principle?: string }; organize?: { pacing?: { per_day?: number } } } | undefined
  /*
    묶음 원리는 **한 곳에서만 읽는다** — `setKindOf(curation_query.blueprint)`.
    여기서 문구를 따로 적으면 카드·판권면과 갈린다(이 저장소가 색·계단에서 이미 겪은 사고다).
    처음에 `recipe.meta.principle` 을 봤다가 실측에서 null 이 나와 `rootHeader` 장치 하나가
    통째로 비었다(2026-09-06 · 16/17).
  */
  const principle =
    setKindOf((cq as { blueprint?: string }).blueprint)?.principle
    ?? recipe?.meta?.principle
    ?? null
  /*
    하루치는 레시피가 정한 값을 먼저 쓰고, 없으면 시장 관례(하루 30개)를 쓴다.
    임의로 정하지 않는 이유: 「며칠이면 끝나는가」가 판권면·학습 플랜과 어긋나면 안 된다.
  */
  const perDay = recipe?.organize?.pacing?.per_day ?? 30

  const spread = typesetVocabSet({
    title: (setRow as { title: string }).title,
    wordsPerDay: perDay,
    principle,
    words,
  })

  /*
    판권면 — **지면의 일부다.** 시중 단어장은 뒤에 판권면을 싣고, 학습자는 거기서 "누가 언제
    무엇을 근거로 냈는가" 를 읽는다. 우리 판권면(`VocabColophon`)은 이미 있었지만 그것을 그리는
    `VocabSetPreviewModal` 이 `/library/vocab` 에서 **열리지 않아** 학습자에게 닿은 적이 없다
    (실측 2026-09-06). 열리지 않는 쪽을 고치는 대신 **닿는 지면에** 싣는다.

    값은 지어내지 않는다 — 각인(`scripts/vocab/stamp-imprint.mts`) 전 세트는 검수 수치가
    없으므로 그 줄이 빠진 채로 내려간다.
  */
  const slug = (setRow as { slug?: string | null }).slug ?? null
  /*
    ⚠️ `ladder_step` 은 **생성된 스키마 타입에 없다**(DB 에는 있고 `queries.ts` 도 읽는다 —
       타입만 낡았다). 위 select 에 넣으면 그 한 컬럼 때문에 행 전체가 SelectQueryError 로
       추론돼 나머지 필드까지 다 깨진다. 그래서 **따로** 읽는다. 타입을 다시 생성하면
       이 두 번째 질의를 지우고 위 select 에 합칠 수 있다.
  */
  const { data: stepRow } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { ladder_step: number | null } | null }> }
      }
    }
  })
    .from('shared_word_sets')
    .select('ladder_step')
    .eq('id', setId)
    .maybeSingle()
  const ladderStep = stepRow?.ladder_step ?? null
  const qa = (cq as { qa?: { checked?: number; passed?: number } }).qa
  const level = (cq as { level?: { median: number; min: number; max: number; measured: number } }).level
  const colophon = buildVocabColophon({
    title: (setRow as { title: string }).title,
    step: ladderStep,
    schoolBand: null,
    vLevel: level?.median ?? 0,
    selection: principle ?? '',
    wordCount: rows.length,
    wordsPerDay: perDay,
    issued: new Date((setRow as { created_at?: string }).created_at ?? Date.now()),
    autoPassed: qa?.passed ?? 0,
    autoTotal: qa?.checked ?? 0,
  })

  // 앞 며칠치만 남긴다 — 계획·복습·색인 규모는 전체를 센 값 그대로 둔다.
  const trimmedParts = spread.parts
    .map((p) => ({ ...p, days: p.days.filter((d) => d.n <= PREVIEW_DAYS) }))
    .filter((p) => p.days.length > 0)

  return NextResponse.json({
    title: spread.title,
    studyPlan: spread.studyPlan,
    parts: trimmedParts,
    reviews: spread.reviews.slice(0, 2),
    indexSize: spread.index.length,
    indexHead: spread.index.slice(0, 12),
    /*
      판권면에 세 줄을 더 싣는다 — 렌더 기준으로 선택 지수를 재니 **0.94** 였고, 못 준 것이
      정확히 이 셋이었다(실측 2026-09-06: `isbn` · `seriesGuide` · `targetGrade` 전부 0%).
      셋 다 시중 단어장이 반드시 싣는 칸이고 우리도 값을 갖고 있었다 — 지면에 자리가 없었을 뿐이다.

      · 판권 번호 — `queries.ts` 와 **같은 규칙**으로 만든다(slug 없으면 만들지 않는다.
        id 로 지어내면 학습자가 인용할 수 없는 값이 된다).
      · 사다리 — 일곱 계단 중 이 권의 자리. 계단 밖이어도 띠는 그린다(어느 칸도 안 세운다) —
        띠를 통째로 빼면 그 권만 시리즈에서 떨어져 나온 것처럼 보인다.
      · 대상 수준 — 계단이 있으면 계단, 없으면 각인된 V-Level 중앙값. 사다리 밖이라고
        수준이 없는 것이 아니다.
    */
    colophon: {
      brand: VOCAB_SERIES_BRAND,
      ...colophon,
      imprintCode: slug ? `VF-${slug}-v${(setRow as { version?: number }).version ?? 1}` : null,
      ladderStrip: ladderStrip(ladderStep),
      ladderStep,
      targetLevel: colophon.ladder,
    },
    apparatus: spread.apparatus,
    previewDays: PREVIEW_DAYS,
    truncated: rows.length >= MAX_WORDS,
  })
}
