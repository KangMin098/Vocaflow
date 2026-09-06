// apps/web/src/app/admin/csat/new/OrderWizard.tsx
//
// **새 교재 만들기 — 네 걸음.**
//
// ── 왜 이 화면이 생겼나 (2026-09-06) ─────────────────────────────────
// 교재 공장의 공정 화면 여덟은 전부 「공장 전체가 지금 어떤가」를 말한다 — 재고 65만,
// 해설 보유율, 밴드별 구멍. 그런데 관리자가 실제로 하려는 일은 **한 권을 내는 것**이고,
// 그 일을 시작할 자리가 없었다. 여덟 화면을 돌며 머릿속에서 한 권 몫을 골라내야 했는데
// 그 골라내기가 어디에도 안 적혀 있어서 **매번 다시** 했다.
//
// 그래서 이 화면은 공정을 다시 그리지 않는다. 이미 준비된 것들 — 기출 분석 · 시중 교재
// 코퍼스 · 유형 정본 · 브랜드 · 시리즈 · 재고 — 을 **한 권 기준으로 모아** 네 걸음으로 편다:
//
//   ① 무엇을   시리즈를 고르고, 그 시리즈의 어느 권인지 고른다
//   ② 무엇으로 그 권이 쓰는 유형마다 재고와 **근거**(평가원 기출 분석 / 시중 교재 코퍼스)
//   ③ 규격     브랜드 · 표지 · 학령 · 단원 수 · 문항 수
//   ④ 발주     관문 넷과, 못 넘은 관문을 채우는 명령 · 인자가 다 채워진 조판 명령
//
// **한 번에 한 걸음만 보인다**(철학 2 Progressive Disclosure). 넷을 다 펴면 이 화면도
// 공정 화면들과 똑같이 "한 번에 다 보이지만 그래서 아무것도 안 보이는" 판이 된다.
//
// 조작 버튼은 없다 — 교재 생성은 사전·재고 전체를 훑는 일이라 웹 요청 시간 안에 안 끝난다.
// 이 화면의 산출물은 **인자가 다 채워진 명령 한 줄**이고, 그것이 공장 화면들과 다른 점이다
// (저쪽은 `--band 6` 같은 예시를 든다 — 자기 권의 값으로 고치려면 다시 여덟 화면을 본다).

'use client'

import { Check, ClipboardCheck, Copy, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { coverSvg } from '@vocaflow/library-pipeline/textbook-cover'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  firstBlocked,
  judgeGates,
  pressPlan,
  renderCommand,
  type OrderView,
  type OrderVolume,
} from '@/lib/csat/order-model'

const STEPS = ['무엇을', '무엇으로', '규격', '발주'] as const

/** 명령 한 줄 + 복사. 공정 화면과 같은 모양이라 관리자가 다시 안 배운다. */
function CommandRow({ cmd, why, claudeCode }: { cmd: string; why: string; claudeCode?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex flex-col gap-1 border-t border-[var(--bd)] pt-2 first:border-0 first:pt-0">
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] leading-relaxed text-[var(--t1)]">
          {cmd}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(cmd).then(
              () => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              },
              () => setCopied(false)
            )
          }}
          aria-label={`명령 복사: ${cmd}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] active:bg-[var(--bd)]"
        >
          {copied ? (
            <ClipboardCheck size={15} strokeWidth={1.75} className="text-[#2E7D5A]" aria-hidden />
          ) : (
            <Copy size={15} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
        {claudeCode ? (
          <span className="bg-[#8B5CF6]/12 mr-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-[600] text-[#8B5CF6]">
            <Sparkles size={10} strokeWidth={2} aria-hidden />
            Claude Code
          </span>
        ) : null}
        {why}
      </p>
    </li>
  )
}

/** 표지 미니어처 — 조판기와 **같은 함수**를 쓴다. 다른 그림을 쓰면 매대와 책이 달라진다. */
function Cover({ v, width = 40 }: { v: OrderVolume; width?: number }) {
  const short = v.brand.split(' ').slice(-1)[0] ?? v.brand
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width, display: 'inline-block' }}
      dangerouslySetInnerHTML={{
        __html: coverSvg(
          {
            brand: short,
            accent: v.accent,
            step: v.step,
            totalSteps: 7,
            schoolBand: v.schoolBand,
            pending: !v.published,
          },
          width
        ),
      }}
    />
  )
}

export function OrderWizard({
  volumes,
  evidence,
  itemsPerVolume,
  unitsPerBook,
  inventoryAt,
  loadError,
}: OrderView) {
  const [pick, setPick] = useState<string | null>(null)
  const [at, setAt] = useState(0)

  const chosen = volumes.find((v) => `${v.seriesId}|${v.step}` === pick) ?? null
  const gates = useMemo(
    () => (chosen ? judgeGates(chosen, itemsPerVolume, unitsPerBook) : []),
    [chosen, itemsPerVolume, unitsPerBook]
  )
  const blocked = firstBlocked(gates)

  const series = useMemo(() => {
    const seen = new Map<string, OrderVolume[]>()
    for (const v of volumes) {
      const list = seen.get(v.seriesId) ?? []
      list.push(v)
      seen.set(v.seriesId, list)
    }
    return [...seen.entries()]
  }, [volumes])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">새 교재 만들기</h2>
        <AdminScreenHelp screen="csat-new" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      {/* ── 걸음 표시 ── 지난 걸음으로만 돌아갈 수 있다. 아직 안 고른 앞 걸음은 누를 게 없다. */}
      <ol className="flex flex-wrap items-stretch gap-1.5" aria-label="진행 단계">
        {STEPS.map((label, i) => {
          const reachable = i === 0 || (chosen != null && i <= Math.max(at, 1))
          const here = i === at
          return (
            <li key={label} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setAt(i)}
                aria-current={here ? 'step' : undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-[var(--r-md)] border px-2.5 py-2 text-left font-display text-[12.5px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
                  here
                    ? 'bg-[#8B5CF6]/8 border-[#8B5CF6] font-[700] text-[var(--t1)]'
                    : reachable
                      ? 'border-[var(--bd)] bg-[var(--bg)] font-[500] text-[var(--t2)] hover:bg-[var(--bg2)]'
                      : 'cursor-not-allowed border-dashed border-[var(--bd)] bg-transparent font-[500] text-[var(--t3)]'
                }`}
              >
                <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ── ① 무엇을 만드나 ── */}
      {at === 0 ? (
        <section aria-label="권 고르기" className="flex flex-col gap-3">
          {series.map(([id, list]) => {
            const head = list[0]!
            return (
              <div
                key={id}
                className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
              >
                <div className="flex items-center gap-2.5">
                  <Cover v={head} />
                  <div className="min-w-0">
                    <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                      {head.brand}
                    </h3>
                    <p className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
                      {list.filter((v) => v.published).length}/{list.length} 권 냈음
                    </p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {list.map((v) => {
                    const key = `${v.seriesId}|${v.step}`
                    const ready = v.items != null && v.items >= itemsPerVolume
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => {
                            setPick(key)
                            setAt(1)
                          }}
                          className={`flex min-h-[44px] flex-col justify-center rounded-[var(--r-sm)] border px-2.5 py-1.5 text-left transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
                            pick === key
                              ? 'bg-[#8B5CF6]/8 border-[#8B5CF6]'
                              : 'border-[var(--bd)] bg-[var(--bg2)] hover:bg-[var(--bg3)]'
                          }`}
                        >
                          <span className="font-display text-[12.5px] font-[600] text-[var(--t1)]">
                            {v.schoolBand}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
                            {v.published
                              ? '냈음'
                              : v.items == null
                                ? '못 잼'
                                : `${v.items.toLocaleString()}/${itemsPerVolume}`}
                            <span
                              aria-hidden
                              className="ml-1"
                              style={{ color: v.published || ready ? '#2E7D5A' : '#B5803A' }}
                            >
                              {v.published ? '●' : ready ? '○' : '◔'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </section>
      ) : null}

      {/* ── ② 무엇으로 만드나 ── */}
      {at === 1 && chosen ? (
        <section
          aria-label="재료"
          className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        >
          <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            {chosen.title}
            <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t3)]">
              {chosen.schoolBand}
            </span>
          </h3>
          <p className="break-keep font-body text-[12px] leading-snug text-[var(--t2)]">
            {chosen.recipe}
          </p>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--bd)]">
                <th className="pb-1 font-display text-[11px] font-[600] text-[var(--t3)]">유형</th>
                <th className="pb-1 text-right font-display text-[11px] font-[600] text-[var(--t3)]">
                  재고 · 해설
                </th>
                <th className="pb-1 pl-2 font-display text-[11px] font-[600] text-[var(--t3)]">
                  근거
                </th>
              </tr>
            </thead>
            <tbody>
              {chosen.types.map((t) => (
                <tr key={t.type} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-1.5 font-display text-[12.5px] text-[var(--t1)]">{t.label}</td>
                  <td className="py-1.5 text-right font-mono text-[12px] tabular-nums text-[var(--t2)]">
                    {t.items == null ? '못 잼' : t.items.toLocaleString()}
                    <span className="text-[var(--t3)]">
                      {' · '}
                      {t.explained == null ? '?' : t.explained.toLocaleString()}
                    </span>
                  </td>
                  <td className="break-keep py-1.5 pl-2 font-body text-[11.5px] text-[var(--t2)]">
                    {t.csat.length ? (
                      t.csat.map((c) => (
                        <span key={c.id} className="mr-2 inline-block whitespace-nowrap">
                          {c.name}{' '}
                          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">
                            기출 {c.items} · 분석 {c.analyses}
                          </span>
                          <span
                            aria-label={c.report ? '유형 리포트 발행됨' : '유형 리포트 없음'}
                            className="ml-0.5"
                            style={{ color: c.report ? '#2E7D5A' : '#B5803A' }}
                          >
                            {c.report ? '●' : '○'}
                          </span>
                        </span>
                      ))
                    ) : (
                      // 평가원에 대응 유형이 **없는** 축이다. 억지로 이어 붙이면 "기출 근거 있음"
                      // 이라는 거짓이 만들어진다 — 그 자리의 진짜 근거를 적는다.
                      <span className="text-[var(--t3)]">
                        평가원 대응 없음 — 시중 교재 코퍼스 {evidence.market.documents}종
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
            <span className="text-[var(--t2)]">준비된 근거 · </span>
            수능 {evidence.exams.suneung} · 모의 {evidence.exams.mock} 회분 → 기출 문항{' '}
            {evidence.items.toLocaleString()} · 분석 {evidence.analyses.toLocaleString()} · 검토{' '}
            {evidence.reviews.toLocaleString()} · 유형 리포트 {evidence.typeReports}/
            {evidence.typeReportsTotal} · 시중 교재 {evidence.market.documents}종{' '}
            {evidence.market.itemsMeasured.toLocaleString()}문항(12축 지수{' '}
            {evidence.market.index.toFixed(3)})
            {inventoryAt ? ` · 재고 ${new Date(inventoryAt).toLocaleString('ko-KR')} 기준` : ''}
          </p>

          <button
            type="button"
            onClick={() => setAt(2)}
            className="bg-[#8B5CF6]/8 hover:bg-[#8B5CF6]/16 min-h-[44px] w-fit rounded-[var(--r-md)] border border-[#8B5CF6] px-4 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          >
            규격 보기
          </button>
        </section>
      ) : null}

      {/* ── ③ 규격 ── */}
      {at === 2 && chosen ? (
        <section
          aria-label="규격"
          className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        >
          <div className="flex items-start gap-3">
            <Cover v={chosen} width={64} />
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                ['브랜드', chosen.brand],
                ['권 이름', chosen.title],
                ['학령', chosen.schoolBand],
                ['조판 단(band)', String(chosen.step)],
                ['단원', `${unitsPerBook}단원`],
                ['문항', `${itemsPerVolume}문항`],
              ].map(([k, val]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="font-body text-[11.5px] text-[var(--t3)]">{k}</dt>
                  <dd className="truncate font-display text-[12.5px] font-[600] text-[var(--t1)]">
                    {val}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
            표지·색·서체는 조판기가 <code className="font-mono">coverSvg</code> 로 그리는 것과 같은
            값이다 — 이 그림이 곧 나올 책의 표지다.
          </p>
          <button
            type="button"
            onClick={() => setAt(3)}
            className="bg-[#8B5CF6]/8 hover:bg-[#8B5CF6]/16 min-h-[44px] w-fit rounded-[var(--r-md)] border border-[#8B5CF6] px-4 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          >
            발주 확인
          </button>
        </section>
      ) : null}

      {/* ── ④ 발주 ── */}
      {at === 3 && chosen ? (
        <section
          aria-label="발주"
          className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        >
          <ul className="flex flex-col gap-1.5">
            {gates.map((g) => (
              <li key={g.id} className="flex items-start gap-2">
                {g.pass ? (
                  <Check
                    size={14}
                    strokeWidth={2.25}
                    className="mt-0.5 shrink-0 text-[#2E7D5A]"
                    aria-hidden
                  />
                ) : (
                  <X
                    size={14}
                    strokeWidth={2.25}
                    className="mt-0.5 shrink-0 text-[#B5803A]"
                    aria-hidden
                  />
                )}
                <span className="break-keep font-body text-[12.5px] leading-snug text-[var(--t1)]">
                  {g.question}
                  {g.why ? (
                    <span className="ml-1.5 font-mono text-[11.5px] text-[#B5803A]">{g.why}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {blocked ? (
            <>
              <p className="flex items-start gap-1.5 break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[12px] leading-snug text-[var(--t2)]">
                <TriangleAlert
                  size={13}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[#B5803A]"
                  aria-hidden
                />
                먼저 「{blocked.question}」 를 채운다 — 뒤 관문이 더 나빠 보여도 여기부터 푼다.
              </p>
              <ul className="flex flex-col gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
                {blocked.commands.map((c) => (
                  <CommandRow key={c.cmd} {...c} />
                ))}
              </ul>
            </>
          ) : (
            <>
              {/* 문구는 `pressPlan()` 이 정한다 — 이 갈래는 걸음 ④ 에서만 보여서 DOM 으로는
                  검증이 안 되기 때문이다(그 이유는 그 함수 머리말). */}
              <p className="break-keep font-body text-[12.5px] leading-snug text-[#2E7D5A]">
                {pressPlan(chosen, gates.length).note}
              </p>
              <ul className="flex flex-col gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
                <CommandRow
                  cmd={renderCommand(chosen, unitsPerBook)}
                  why={pressPlan(chosen, gates.length).why}
                />
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
