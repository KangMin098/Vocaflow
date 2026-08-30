// apps/web/src/components/library/vocab/VocabColophon.tsx
//
// **판권면 — 상업 단어장이 반드시 싣는 것.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 시중 단어장을 집으면 뒤에 판권면이 있다: 누가 언제 펴냈고, 몇 판이고, 무엇을 근거로
// 표제어를 골랐는가. 그게 없으면 그 책은 **출판물이 아니라 낱장 묶음**으로 읽힌다.
//
// 단어장에서는 특히 **선정 근거**가 판권면보다 중요하다 — 학습자가 가장 먼저 묻는 것이
// "왜 하필 이 낱말들인가" 이고, 시중 단어장이 서문에서 가장 먼저 답하는 질문이기도 하다.
//
// ── 지어내지 않는다 ────────────────────────────────────────────────
// 여기 있는 값은 전부 세트가 실제로 들고 있는 것이다. 없는 칸은 **그 줄을 통째로 뺀다** —
// "정보 없음" 을 채워 넣으면 판권면이 있으나 마나가 되고, 지어내면 거짓이 된다.

'use client'

import { buildVocabColophon, VOCAB_SERIES_BRAND, ladderStrip } from '@vocaflow/library-pipeline/vocab-brand'

import { rungForSet } from '@/lib/library/vocab/rung'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

export function VocabColophon({ set }: { set: PublishedVocabSet }) {
  const { rung, basis } = rungForSet(set)

  const colophon = buildVocabColophon({
    title: set.title,
    step: rung?.step ?? null,
    schoolBand: rung?.schoolBand ?? null,
    // 사다리 밖이면 계단 대신 V-Level 로 적힌다. 0 은 "모른다" 는 뜻이다.
    vLevel: 0,
    // **컴포저가 남긴 조직 원리를 그대로 싣는다.** 없으면 아래에서 그 줄을 뺀다.
    selection: set.kind?.principle ?? '',
    wordCount: set.wordCount,
    wordsPerDay: rung?.wordsPerDay ?? 0,
    issued: new Date(set.createdAt),
    // 검수 수치는 이 화면이 갖고 있지 않다 — 0/0 을 적으면 "검수 0 통과" 로 읽히므로
    // 아래에서 그 줄을 뺀다(지어내지 않는다).
    autoPassed: 0,
    autoTotal: 0,
  })

  const rows: Array<[string, string]> = [
    ['판차', colophon.edition],
    ['발행', colophon.issued],
    ['구성', colophon.volume],
  ]
  if (colophon.selection) rows.push(['표제어 선정', colophon.selection])

  return (
    <section
      aria-label="판권면"
      className="mt-6 border-t border-[var(--bd)] px-1 pb-2 pt-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--t3)]">
          {VOCAB_SERIES_BRAND}
        </p>
        {/*
          사다리 띠 — 시중 단어장이 뒤표지에 시리즈 전체를 싣고 지금 권을 표시하는 자리.
          **다음에 무엇을 볼지** 알 수 있어야 하므로 숫자만 적지 않고 현재 권을 대괄호로 세운다.
        */}
        {rung && (
          <p
            className="font-mono text-[11px] tabular-nums text-[var(--t3)]"
            title={`${colophon.ladder} — 일곱 단 가운데 ${rung.step}단`}
          >
            {ladderStrip(rung.step).join(' ')}
          </p>
        )}
      </div>

      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rung && (
          <>
            <dt className="font-body text-[11.5px] text-[var(--t3)]">단계</dt>
            <dd className="font-body text-[11.5px] text-[var(--t2)]">
              {colophon.ladder}
              {/*
                계단을 **무엇으로 정했는지** 밝힌다. 추정이면 추정이라고 적는다 —
                "왜 이 책이 5단인가" 에 답하지 못하면 사다리를 믿을 수 없다.
              */}
              {basis !== 'authored' && (
                <span className="ml-1.5 text-[var(--t3)]">(수준·분류로 추정)</span>
              )}
            </dd>
          </>
        )}
        {rows.map(([k, v]) => (
          <FragmentRow key={k} label={k} value={v} />
        ))}
        <dt className="font-body text-[11.5px] text-[var(--t3)]">출처</dt>
        <dd className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">
          {colophon.sourcePolicy}
        </dd>
      </dl>

      {/*
        표지 도판 출처 — CC 표기 의무. 도판이 있을 때만 뜬다.
        저작권 표기는 "있으면 좋은 것" 이 아니라 지켜야 하는 것이라 판권면에 둔다.
      */}
      {set.coverImageMeta && (
        <p className="mt-2 font-body text-[10.5px] leading-relaxed text-[var(--t3)]">
          표지 도판: {set.coverImageMeta.provider ?? set.coverImageMeta.source}
          {set.coverImageMeta.creator ? ` · ${set.coverImageMeta.creator}` : ''}
          {set.coverImageMeta.license ? ` · ${set.coverImageMeta.license.toUpperCase()}` : ''}
        </p>
      )}
    </section>
  )
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-body text-[11.5px] text-[var(--t3)]">{label}</dt>
      <dd className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">{value}</dd>
    </>
  )
}
