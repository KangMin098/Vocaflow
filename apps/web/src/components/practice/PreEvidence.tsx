// apps/web/src/components/practice/PreEvidence.tsx
//
// R0-PRE-EVIDENCE-01 — 기사 제목 · 주제 문항에서 **답을 제출하기 전에** 본문 문장 하나를 (원하면) 짚어 두고,
// 성공한 채점 피드백에서 「이번 제출 당시 짚은 문장」 으로 다시 보여 준다.
// - 짚은 문장은 채점 · 저장 · 전송하지 않는다(서버에는 기존대로 {choice} 만 간다). React 메모리에만 있다.
// - 후보는 지문만으로 나눈 문장(meaningEvidenceSentences) — 정답 · source_snippet · 해설을 쓰지 않는다.
// - 「최초 판단」 · 「근거 정답」 이라 부르지 않는다. 다른 경로의 사전 노출은 모르므로 「이번 제출 당시」 로만 말한다.

'use client'

import { EvidenceLongListHint, evidenceListClass } from './MeaningEvidence'

/** 제출 시작 순간에 고정한 짚은 문장 — 같은 문항 객체에만 묶는다(다른 문항 · 판본에는 보이지 않는다) */
export interface PreEvidenceSnapshot<I = unknown> {
  item: I
  /** 고르지 않았으면 null — 「짚지 않았음」 을 사실대로 말한다 */
  sentence: string | null
}

/** 이 스냅샷을 지금 피드백에 보여도 되는가 — 같은 문항 객체일 때만 */
export function preEvidenceFor<I>(snap: PreEvidenceSnapshot<I> | null, item: I): PreEvidenceSnapshot<I> | null {
  return snap && snap.item === item ? snap : null
}

export function PreEvidencePicker({
  sentences,
  picked,
  onPick,
  locked,
}: {
  sentences: string[]
  picked: number | null
  onPick: (i: number | null) => void
  /** 제출 중 — 바꾸지 못하게 하되 disabled 대신 aria-disabled 로 초점을 지킨다 */
  locked: boolean
}) {
  return (
    <section aria-label="제출 전에 본문 문장 짚기(선택)" className="flex flex-col gap-2" data-testid="pre-evidence">
      <p className="break-keep font-display text-[12.5px] font-[700] text-[var(--t1)]">
        답을 받치는 본문 문장을 하나 짚어 둘 수 있어요(선택) — 피드백에서 이번 제출 때 짚은 문장과 견주어 봐요.
      </p>
      <EvidenceLongListHint n={sentences.length} />
      <div role="group" aria-label="짚을 본문 문장 후보" className={evidenceListClass(sentences.length)} data-testid="pre-evidence-list">
        {sentences.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={picked === i}
            aria-disabled={locked || undefined}
            onClick={() => {
              if (!locked) onPick(picked === i ? null : i)
            }}
            className="min-h-[44px] rounded-[var(--r-md)] border px-3 py-2 text-left font-english text-[13.5px] leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            style={
              picked === i
                ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--t1)' }
                : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
            }
          >
            {s}
          </button>
        ))}
      </div>
      <p className="break-keep font-body text-[12px] text-[var(--t2)]" data-testid="pre-evidence-state">
        {picked === null ? '짚은 문장 없음 — 짚지 않고 제출해도 돼요.' : `${picked + 1}번째 문장을 짚었어요. 다시 누르면 해제돼요.`}
      </p>
    </section>
  )
}

/** 성공한 피드백 안 — 이번 제출 당시 짚은 문장(읽기 전용). 채점 뒤 근거 짚기(MeaningEvidence)와 다른 것이다 */
export function PreEvidenceNote({ sentence }: { sentence: string | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2" data-testid="pre-evidence-note">
      <p className="break-keep font-display text-[12.5px] font-[700] text-[var(--t2)]">이번 제출 당시 짚은 문장</p>
      {sentence === null ? (
        <p className="break-keep font-body text-[12.5px] text-[var(--t2)]" data-testid="pre-evidence-none">
          이번 제출 때는 본문 문장을 짚지 않았어요.
        </p>
      ) : (
        <p className="font-english text-[13.5px] leading-relaxed text-[var(--t1)]" data-testid="pre-evidence-sentence">
          {sentence}
        </p>
      )}
      <p className="break-keep font-body text-[12px] text-[var(--t2)]">짚은 문장은 채점하지 않아요. 아래 해설 · 근거 짚기와 견주어 보세요.</p>
    </div>
  )
}
