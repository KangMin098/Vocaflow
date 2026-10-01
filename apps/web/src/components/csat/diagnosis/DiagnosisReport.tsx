// apps/web/src/components/csat/diagnosis/DiagnosisReport.tsx
//
// 진단 리포트 — 학습자(/csat/diagnosis)와 관리자(/admin/csat/diagnosis/learners/[id])가 함께 쓴다.
// variant='learner' 는 코드(A4 · C4)를 드러내지 않고 쉬운 말만, 'admin' 은 코드와 수치를 함께.
// 정보는 색만으로 전하지 않는다 — 증감은 ▲▼ 와 숫자, 데이터 부족은 글자로 적는다.

import Link from 'next/link'

import { ATTRIBUTE_CODES, TRAP_FAMILIES, type ScenarioForecast } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME, CONFIDENCE_LABEL, HABIT_TEXT, TRAP_FAMILY_NAME, lineText } from '@/lib/csat/diagnosis/labels'
import { summaryLine, type SnapshotView } from '@/lib/csat/diagnosis/snapshot'
import { toItemSlug } from '@/lib/csat/item-slug'

import { HabitButtons } from './HabitButtons'
import { ScoreTrend } from './ScoreTrend'

const h3 = 'font-display text-[16px] font-[800] text-[var(--t1)]'
const card = 'flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4'
const small = 'break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]'

function monthLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

function Scenario({ name, f, admin }: { name: string; f: ScenarioForecast | undefined; admin: boolean }) {
  if (!f || f.grade === null) return <li className="font-body text-[14px] text-[var(--t2)]">{name} — 기준 시험이 아직 정해지지 않았어요</li>
  return (
    <li className="flex flex-wrap items-baseline gap-2 font-body text-[14px] text-[var(--t1)]">
      <span className="w-[72px] font-[700]">{name}</span>
      <span>{f.grade}등급</span>
      {admin && <span className="text-[var(--t2)]">예상 {f.expected} · {f.examId}{f.adjusted ? '' : ' · 미보정'}</span>}
      {f.meetsTarget === false && <span className="font-[700] text-[var(--error-ink)]">· 목표에 못 미칠 위험</span>}
      {f.meetsTarget === true && <span className="text-[var(--success-ink)]">· 목표 충족</span>}
    </li>
  )
}

export function DiagnosisReport({
  snapshot,
  previous,
  variant,
  feedback = {},
  goalText,
}: {
  snapshot: SnapshotView
  previous: SnapshotView | null
  variant: 'learner' | 'admin'
  feedback?: Record<string, boolean>
  goalText?: string | null
}) {
  const admin = variant === 'admin'
  const ev = snapshot.evidence
  const traps = TRAP_FAMILIES.map((f) => ({ f, v: snapshot.trapVulnerability?.[f] }))
    .filter((x): x is { f: (typeof TRAP_FAMILIES)[number]; v: NonNullable<typeof x.v> } => Boolean(x.v && x.v.picked > 0))
    .sort((a, b) => Number(b.v.vulnerable) - Number(a.v.vulnerable) || b.v.ratio - a.v.ratio)
    .slice(0, admin ? 9 : 3)

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <p className={small}>
          {monthLabel(snapshot.computedAt)} 진단 · 근거: 시험 {ev.examSessions}회{ev.diagnosticSessions ? ` · 진단 테스트 ${ev.diagnosticSessions}회` : ''}, {ev.responses}문항 · 신뢰도 {CONFIDENCE_LABEL[snapshot.confidence]}
          {admin && ` · 진단 반영 응답 ${ev.diagnosedResponses} · 점수만 ${ev.scoreOnlySessions}회 · ${snapshot.engineVersion} · 설정 v${snapshot.settingsId ?? '?'}`}
        </p>
        <p className="break-keep font-display text-[18px] font-[800] leading-snug text-[var(--t1)]">{summaryLine(snapshot)}</p>
        {snapshot.confidence === 'low' && (
          <p className={small}>아직 근거가 적어요. 최근 모의고사 결과를 입력하면 진단이 훨씬 정확해져요.</p>
        )}
        {ev.scoreOnlySessions > 0 && (
          <p className={small}>입력한 시험 중 {ev.scoreOnlySessions}회는 아직 상세 진단이 준비 중이라 점수만 반영했어요.</p>
        )}
      </section>

      {ev.trend && ev.trend.length > 0 && (
        <section className={card}>
          <h3 className={h3}>내 점수 흐름</h3>
          <ScoreTrend points={ev.trend} />
          <p className={small}>
            {ev.adjusted
              ? '시험마다 난이도가 달라서, 같은 기준으로 맞춘 점수를 함께 보여 드려요. 다시 푼 기출은 흐리게 표시해요.'
              : '아직 시험 난이도 자료가 없어 원점수만 보여 드려요. 다시 푼 기출은 흐리게 표시해요.'}
          </p>
        </section>
      )}

      <section className={card}>
        <h3 className={h3}>수능 시나리오</h3>
        <ul className="flex flex-col gap-1">
          <Scenario name="어려운 해" f={snapshot.forecast?.hard} admin={admin} />
          <Scenario name="보통" f={snapshot.forecast?.normal} admin={admin} />
          <Scenario name="쉬운 해" f={snapshot.forecast?.easy} admin={admin} />
        </ul>
        {goalText && <p className={small}>목표: {goalText}</p>}
      </section>

      <section className={card}>
        <h3 className={h3}>강점과 약점</h3>
        <ul className="flex flex-col gap-2">
          {ATTRIBUTE_CODES.map((c) => {
            const m = snapshot.attributeMastery?.[c]
            const prev = previous?.attributeMastery?.[c]
            const value = m?.value ?? null
            const delta = value !== null && prev?.value != null ? Math.round((value - prev.value) * 100) : null
            const name = admin ? `${c} ${ATTRIBUTE_NAME[c].admin}` : ATTRIBUTE_NAME[c].learner
            return (
              <li key={c} className="grid grid-cols-[minmax(120px,200px)_1fr_auto] items-center gap-3">
                <span className="break-keep font-body text-[14px] text-[var(--t1)]">{name}</span>
                <div
                  className="h-3 rounded-[var(--r-full)] bg-[var(--bg3)]"
                  role="img"
                  aria-label={value === null ? `${name} 데이터 부족` : `${name} ${Math.round(value * 100)}점`}
                >
                  {value !== null && (
                    <div className="h-3 rounded-[var(--r-full)] bg-[var(--p)]" style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
                  )}
                </div>
                <span className="w-[120px] text-right font-body text-[13px] text-[var(--t2)]">
                  {value === null ? `데이터 부족${admin ? ` (n=${m?.n ?? 0})` : ''}` : `${Math.round(value * 100)}`}
                  {delta !== null && delta !== 0 && <span className="ml-1">{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>}
                  {admin && value !== null && <span className="ml-1">n={m?.n}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={card}>
        <h3 className={h3}>{admin ? '함정 취약도' : '자주 걸리는 함정 Top 3'}</h3>
        {traps.length === 0 ? (
          <p className={small}>아직 함정 패턴이 보일 만큼 기록이 쌓이지 않았어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {traps.map(({ f, v }) => (
              <li key={f} className="flex flex-col gap-1">
                <span className="break-keep font-body text-[14px] text-[var(--t1)]">
                  {admin ? `${f} ${TRAP_FAMILY_NAME[f].admin} — ${v.picked}/${v.exposure} (${v.ratio})${v.vulnerable ? ' · 취약' : ''}` : `${TRAP_FAMILY_NAME[f].learner} (${v.exposure}번 중 ${v.picked}번)`}
                </span>
                {v.items.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {v.items.slice(0, 5).map((id) => (
                      <Link
                        key={id}
                        href={`/csat/item/${toItemSlug(id)}`}
                        className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-body text-[13px] text-[var(--t1)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                      >
                        {admin ? id : `${id.replace('#', ' ')}번 다시 보기`}
                      </Link>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className={h3}>풀이 습관</h3>
        {snapshot.habitFlags.length === 0 ? (
          <p className={small}>눈에 띄는 습관 신호는 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {snapshot.habitFlags.map((h) => (
              <li key={h.code} className="flex flex-col gap-2">
                <span className="break-keep font-body text-[14px] text-[var(--t1)]">
                  {admin ? `${h.code} — ${HABIT_TEXT[h.code].admin} ${JSON.stringify(h.evidence)}` : HABIT_TEXT[h.code].learner}
                </span>
                {admin ? (
                  <span className={small}>학습자 응답: {feedback[h.code] === undefined ? '없음' : feedback[h.code] ? '맞아요' : '아니에요'}</span>
                ) : (
                  <HabitButtons snapshotId={snapshot.id} habitCode={h.code} initial={feedback[h.code]} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className={h3}>추천 학습</h3>
        {snapshot.recommendedLines.length === 0 ? (
          <p className={small}>추천을 만들 만큼 기록이 쌓이면 여기에 보여 드려요.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {snapshot.recommendedLines.map((l, i) => {
              const t = lineText(l.code)
              return (
                <li key={l.code} className="flex flex-col gap-0.5">
                  <span className="font-display text-[14px] font-[800] text-[var(--t1)]">{i + 1}. {t.title}{admin ? ` (${l.code})` : ''}</span>
                  <span className={small}>{t.why}</span>
                </li>
              )
            })}
          </ol>
        )}
        {!admin && (
          <Link
            href="/csat/workspace/new"
            className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[14px] font-[800] text-[var(--on-p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            학습 작업공간 만들기
          </Link>
        )}
      </section>
    </div>
  )
}
