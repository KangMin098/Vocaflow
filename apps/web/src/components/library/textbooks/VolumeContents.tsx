// apps/web/src/components/library/textbooks/VolumeContents.tsx
//
// **목차 · 미리보기 단원 · 어휘 정리 · 정답과 해설 — 실제 조판 결과를 편다.**
//
// ── 왜 이제야 목차가 생겼나 ────────────────────────────────────────
// 이 저장소는 오랫동안 목차를 **일부러** 막았고 그 이유가 옳았다: 재고 수만으로 목차를
// 지으면 실제보다 부풀려진다(한 단원의 문항은 서로 다른 원글에서 와야 하고, 지문은 학년
// 길이 창에 들어야 한다). 그 금지는 **재고로 짓지 말라**는 것이지 목차를 내지 말라는 것이
// 아니었다 — 그래서 조판과 같은 코드 경로로 조합한 결과(`volume-contents.json`)만 편다.
//
// ── 여기서 하지 않는 것 ─────────────────────────────────────────────
// · **단원 제목을 짓지 않는다.** 네 문항이 서로 다른 글에서 오므로 단원을 대표하는 제목이
//   존재하지 않는다. 대신 그 단원이 쓴 **원글의 실제 제목**을 적는다 — 시중 목차보다
//   오히려 많은 정보다(어떤 글을 읽는지 사기 전에 알 수 있다).
// · **전문 해석·직독직해를 흉내내지 않는다.** 재고에 그 열이 없다(실측 2026-09-06).
// · **미리보기가 없으면 절을 통째로 뺀다.** 빈 자리를 "준비 중" 으로 채우지 않는다 —
//   그건 있는 척하는 것이다.
//
// `data-apparatus` 는 계약이다 — 붙이려면 그 자리에 실제 내용이 있어야 한다.
// 그래서 이 파일의 모든 선언은 **내용이 있을 때만** 렌더되는 자리에 붙어 있다.

import { BookOpenCheck, CircleCheck, Clock, FileText } from 'lucide-react'

import {
  unitCovers,
  type ContentsUnit,
  type PreviewChoiceItem,
  type VolumeContents,
} from '@/lib/textbook/volume-contents'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

function typeLabel(t: string): string {
  return TYPE_GUIDE[t]?.label ?? t
}

/** 지면 한 장 — `VolumeDossier` 와 같은 그릇을 쓴다. 다르면 한 권으로 안 읽힌다. */
function Sheet({
  apparatus,
  label,
  children,
}: {
  apparatus: string
  label: string
  children: React.ReactNode
}) {
  return (
    <section
      data-apparatus={apparatus}
      aria-label={label}
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-6 shadow-ios-2 md:px-8"
    >
      {children}
    </section>
  )
}

function SheetHead({ kicker, title, aside }: { kicker: string; title: string; aside?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t2)]">
          {kicker}
        </p>
        <h2 className="font-editorial text-[22px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)]">
          {title}
        </h2>
      </div>
      {aside && <p className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">{aside}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 목차
// ══════════════════════════════════════════════════════════════════════

function UnitRow({ unit: u }: { unit: ContentsUnit }) {
  // 초등 3종은 원글이 없어 이 자리에 **낱말**이 들어온다 — 글 제목처럼 조판하면 거짓말이 된다.
  const covers = unitCovers(u)
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-[var(--bd)] py-3.5 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_132px_92px]">
      <span className="font-mono text-[13px] font-[700] tabular-nums text-[var(--p)]">
        {String(u.no).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        {/* 단원 제목이 아니라 **그 단원이 읽는 글들**이다. 그래서 목록으로 적는다. */}
        {covers === 'word' ? (
          <ul className="flex flex-wrap gap-1.5">
            {u.passages.slice(0, 8).map((w) => (
              <li
                key={w}
                className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-0.5 font-english text-[12.5px] text-[var(--t1)]"
              >
                {w}
              </li>
            ))}
            {u.passages.length > 8 && (
              <li className="self-center font-body text-[11.5px] text-[var(--t2)]">
                외 {u.passages.length - 8}낱말
              </li>
            )}
          </ul>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {u.passages.slice(0, 3).map((p) => (
              <li
                key={p}
                className="truncate font-editorial text-[14.5px] leading-snug text-[var(--t1)]"
                title={p}
              >
                {p}
              </li>
            ))}
            {u.passages.length > 3 && (
              <li className="font-body text-[11.5px] text-[var(--t2)]">외 {u.passages.length - 3}편</li>
            )}
          </ul>
        )}
      </div>

      <span className="col-start-2 font-body text-[11.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all] sm:col-start-3">
        {u.types.map(typeLabel).join(' · ')}
      </span>

      <span className="col-start-2 flex flex-wrap gap-x-3 font-mono text-[11px] tabular-nums text-[var(--t2)] sm:col-start-4 sm:justify-end">
        {u.words && (
          <span>
            {u.words[0]}~{u.words[1]}어
          </span>
        )}
        {u.minutes !== null && <span>{u.minutes}분</span>}
      </span>
    </li>
  )
}

export function VolumeToc({
  contents: c,
  generatedAt,
}: {
  contents: VolumeContents
  generatedAt: string
}) {
  if (c.units.length === 0) return null
  const day = generatedAt.slice(0, 10)
  return (
    <Sheet apparatus="toc" label="목차">
      <SheetHead
        kicker="Contents"
        title="목차"
        aside={`${c.units.length}단원 · 문항 ${c.totalItems} · 약 ${Math.round(c.totalMinutes / 60)}시간`}
      />
      <ul className="mt-4 flex flex-col">
        {c.units.map((u) => (
          <UnitRow key={u.no} unit={u} />
        ))}
      </ul>
      {/* 지어낸 목차가 아니라는 것을 **화면이 스스로 말한다.** 근거 없이 믿으라고 하지 않는다. */}
      <p className="mt-4 rounded-[var(--r-md)] border border-[rgba(176,132,58,0.28)] bg-[var(--warning-light)] px-4 py-3 font-body text-[12px] leading-[1.7] text-[var(--warning-ink)] [word-break:keep-all]">
        이 목차는 <strong className="font-display">실제로 조판한 단원</strong>입니다 — 재고 수로 지어낸
        것이 아니에요. 한 단원의 문항은 서로 다른 글에서 오고, 지문은 이 학년의 길이 창에 듭니다.{' '}
        <span className="font-mono tabular-nums">{day}</span> 기준이라 재고가 늘면 다시 짭니다.
      </p>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 미리보기 단원 — 도입 · 문항
// ══════════════════════════════════════════════════════════════════════

/** 이 단원이 시키는 일 — 유형에서 유도한다. 목표를 손으로 적으면 권마다 어긋난다. */
function objectivesOf(items: readonly PreviewChoiceItem[]): { label: string; says: string }[] {
  const seen = new Set<string>()
  const out: { label: string; says: string }[] = []
  for (const it of items) {
    if (seen.has(it.type)) continue
    seen.add(it.type)
    const g = TYPE_GUIDE[it.type]
    out.push({ label: g?.label ?? it.type, says: g?.says ?? '' })
  }
  return out
}

function PreviewItem({ item: it }: { item: PreviewChoiceItem }) {
  return (
    <li className="border-t border-[var(--bd)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[var(--r-sm)] bg-[var(--p)] px-2 font-mono text-[12px] font-[700] tabular-nums text-[var(--on-p)]">
          {String(it.no).padStart(2, '0')}
        </span>
        <p className="font-display text-[14px] font-[700] leading-snug text-[var(--t1)] [word-break:keep-all]">
          {it.stem}
        </p>
      </div>

      {/* 초등 3종 — 낱말 카드. 지문이 없고 **제시어 하나**가 문제의 전부다.
          ⚠️ 선택지가 3~4개일 수 있어 5지선다 모양으로 그리면 안 된다. */}
      {it.kind === 'elementary' && it.shown && (
        <p className="mt-3 rounded-[var(--r-md)] bg-[var(--bg2)] px-4 py-4 text-center font-english text-[22px] font-[600] leading-snug text-[var(--t1)]">
          {it.shown}
        </p>
      )}

      {/* 순서 — 주어진 글 + (A)(B)(C) */}
      {it.intro && (
        <p className="mt-3 rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-4 py-3 font-english text-[14.5px] leading-[1.8] text-[var(--t1)]">
          {it.intro}
        </p>
      )}
      {it.blocks && (
        <div className="mt-3 flex flex-col gap-2.5">
          {it.blocks.map((b) => (
            <p key={b.label} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
              <span className="font-display text-[13.5px] font-[800] text-[var(--p)]">({b.label})</span>
              <span className="font-english text-[14px] leading-[1.8] text-[var(--t1)]">{b.text}</span>
            </p>
          ))}
        </div>
      )}

      {/* 삽입 — 주어진 문장 + 슬롯이 박힌 본문 */}
      {it.given && !it.blocks && (
        <p className="mt-3 rounded-[var(--r-md)] border border-dashed border-[var(--p)] bg-[var(--active-light)] px-4 py-3 font-english text-[14.5px] leading-[1.8] text-[var(--t1)]">
          {it.given}
        </p>
      )}
      {it.body && (
        <p className="mt-3 font-english text-[14px] leading-[1.95] text-[var(--t1)]">
          {it.body.map((s, i) => (
            <span key={i}>
              {s.text}{' '}
              {s.slot >= 0 && (
                <span className="font-display font-[700] text-[var(--p)]">{CIRCLED[s.slot]} </span>
              )}
            </span>
          ))}
        </p>
      )}

      {/* 밑줄형 — 문장 안의 구절에 번호를 단다. 번호가 없으면 발문이 가리키는 곳이 없다.
          ⚠️ HTML 을 만들어 넣지 않는다 — 조각으로 나눠 React 가 그린다(주입 여지 0). */}
      {it.kind === 'underline' && it.sentences && (
        <p className="mt-3 rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-4 py-3 font-english text-[14.5px] leading-[1.9] text-[var(--t1)]">
          {it.sentences.map((sentence, si) => {
            const marks = (it.underlines ?? []).filter((u) => u.sentenceIdx === si)
            let rest = sentence
            const parts: React.ReactNode[] = []
            for (const m of marks) {
              const at = rest.indexOf(m.word)
              if (at < 0 || !m.word) continue
              const idx = (it.underlines ?? []).indexOf(m)
              parts.push(rest.slice(0, at))
              parts.push(
                <u key={`${si}-${idx}`} className="font-[600] decoration-[var(--p)] underline-offset-4">
                  <span className="font-display text-[var(--p)]">{CIRCLED[idx] ?? ''}</span>
                  {m.word}
                </u>,
              )
              rest = rest.slice(at + m.word.length)
            }
            parts.push(rest + ' ')
            return <span key={si}>{parts}</span>
          })}
        </p>
      )}

      {/* 배열형(영작) — 흩어진 낱말 더미. 정답이 원문이라 확정된다. */}
      {it.kind === 'arrange' && it.bank && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {it.bank.map((w, i) => (
            <li
              key={`${w}-${i}`}
              className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-english text-[13.5px] text-[var(--t1)]"
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* 단답형 — 제시 문장 + 힌트. */}
      {it.kind === 'short' && it.shown && (
        <>
          <p className="mt-3 rounded-[var(--r-md)] bg-[var(--bg2)] px-4 py-3 font-english text-[14.5px] leading-[1.8] text-[var(--t1)]">
            {it.shown}
          </p>
          {it.hint && (
            <p className="mt-1.5 font-body text-[11.5px] text-[var(--t2)]">힌트 · {it.hint}</p>
          )}
        </>
      )}

      {/* 생성형 — 지문 하나 */}
      {it.passage && (
        <p className="mt-3 rounded-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-4 py-3 font-english text-[14.5px] leading-[1.8] text-[var(--t1)]">
          {it.passage}
        </p>
      )}

      {/* 단답·배열 — 선택지가 없다. 답 칸을 그리고 정답을 아래 해설에서도 밝힌다. */}
      {(it.choices?.length ?? 0) === 0 && it.answerText && (
        <p className="mt-3 font-body text-[13px] text-[var(--t2)]">
          답{' '}
          <span className="ml-1 inline-block min-w-[120px] border-b border-[var(--bd)] pb-0.5 font-english text-[15px] font-[600] text-[var(--success-ink)]">
            {it.answerText}
          </span>
        </p>
      )}

      <ol className="mt-3 flex flex-col gap-1.5">
        {(it.choices ?? []).map((c, i) => (
          <li key={i} className="flex gap-2.5">
            <span
              className={`shrink-0 font-display text-[13px] font-[700] ${
                i + 1 === it.answer ? 'text-[var(--success-ink)]' : 'text-[var(--t2)]'
              }`}
            >
              {CIRCLED[i]}
            </span>
            <span
              className={`font-english text-[13.5px] leading-[1.7] ${
                i + 1 === it.answer ? 'font-[600] text-[var(--success-ink)]' : 'text-[var(--t2)]'
              }`}
            >
              {c}
            </span>
          </li>
        ))}
      </ol>

      {/* 정답과 해설 — 미리보기이므로 **답을 가리지 않는다.** 시중 미리보기 PDF 와 같다. */}
      <div
        data-apparatus="answerkey"
        className="mt-4 rounded-[var(--r-md)] bg-[var(--bg2)] px-4 py-3.5"
      >
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-display text-[12px] font-[700] text-[var(--success-ink)]">
            <CircleCheck size={13} aria-hidden />
            정답 {it.answer ? CIRCLED[it.answer - 1] : it.answerText}
          </span>
          {it.source && (
            <span className="font-mono text-[10.5px] text-[var(--t2)]">출처 · {it.source}</span>
          )}
        </p>
        {it.explanation ? (
          <p className="mt-2 whitespace-pre-line font-body text-[12.5px] leading-[1.8] text-[var(--t2)] [word-break:keep-all]">
            {it.explanation.text}
          </p>
        ) : (
          // 없는 해설을 지어내지 않는다. 조판물도 같은 문장을 인쇄한다.
          <p className="mt-2 font-body text-[12.5px] leading-[1.8] text-[var(--t3)] [word-break:keep-all]">
            근거를 지문에서 확정하지 못해 해설을 싣지 않았습니다.
          </p>
        )}
      </div>
    </li>
  )
}

export function VolumePreview({ contents: c }: { contents: VolumeContents }) {
  const s = c.sample
  if (!s || s.items.length === 0) return null
  const objectives = objectivesOf(s.items)

  return (
    <Sheet apparatus="unitopener" label="단원 미리보기">
      <SheetHead
        kicker={`Unit ${String(s.no).padStart(2, '0')} · 미리보기`}
        title="한 단원을 통째로 펼쳐 봅니다"
        aside={[s.minutes !== null ? `약 ${s.minutes}분` : null, `문항 ${s.items.length}`]
          .filter(Boolean)
          .join(' · ')}
      />

      {/* 단원 도입 — 오늘 무엇을 확인하는지 먼저 말한다. */}
      <div className="mt-5 rounded-[var(--r-lg)] bg-[var(--p)] px-5 py-5 text-[var(--on-p)]">
        <p className="flex items-center gap-2 font-display text-[11.5px] font-[700] uppercase tracking-[0.1em] opacity-80">
          <BookOpenCheck size={14} aria-hidden />이 단원에서 하는 일
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {objectives.map((o) => (
            <li key={o.label} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-display text-[12.5px] font-[700] opacity-90">
                {o.label}
              </span>
              <span className="font-body text-[12.5px] leading-[1.7] opacity-80 [word-break:keep-all]">
                {o.says}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="mt-6 flex flex-col gap-6">
        {s.items.map((it) => (
          <PreviewItem key={it.no} item={it} />
        ))}
      </ol>

      <p className="mt-5 flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
        <Clock size={13} aria-hidden />
        나머지 {Math.max(0, c.units.length - 1)}단원은 담은 뒤에 이어서 풀 수 있어요.
      </p>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 어휘 정리
// ══════════════════════════════════════════════════════════════════════

export function VolumeWordList({ contents: c }: { contents: VolumeContents }) {
  const words = c.sample?.vocabulary ?? []
  if (words.length === 0) return null
  return (
    <Sheet apparatus="wordlist" label="어휘 정리">
      <SheetHead
        kicker="Word List"
        title={`UNIT ${String(c.sample!.no).padStart(2, '0')} 어휘`}
        aside={`${words.length}낱말`}
      />
      <p className="mt-2 max-w-[62ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
        지문에 <strong className="font-display text-[var(--t1)]">실제로 나온</strong> 낱말만
        모았습니다. 여기서 막힌 낱말은 단어장으로 그대로 넘어가요 — 옮겨 적을 일이 없습니다.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {words.map((w) => (
          <li
            key={w.word}
            className="flex items-baseline gap-3 border-b border-[var(--bd)] py-2.5"
          >
            <span className="min-w-[104px] shrink-0 font-english text-[14.5px] font-[600] text-[var(--t1)]">
              {w.word}
            </span>
            <span className="font-body text-[12.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
              {w.meaningKo}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 미리보기를 못 내는 권 — **자리를 비우지 않고 이유를 적는다**
// ══════════════════════════════════════════════════════════════════════

export function ContentsUnavailable({ reason }: { reason: string }) {
  return (
    <p className="flex items-start gap-2.5 rounded-ios-2xl bg-[var(--bg)] px-5 py-4 font-body text-[12.5px] leading-[1.7] text-[var(--t2)] shadow-ios-2 [word-break:keep-all] md:px-8">
      <FileText size={14} aria-hidden className="mt-0.5 shrink-0" />이 권은 아직 화면으로 미리보기를
      낼 수 없어요 — {reason}. 목차와 분량은 위에서 확인할 수 있습니다.
    </p>
  )
}
