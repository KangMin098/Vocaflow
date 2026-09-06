// apps/web/src/app/admin/csat/sources/SourceEligibilityClient.tsx
// 원문 적격 — 교재에 실을 수 있는 원문인가를 일곱 축으로 판정한 결과. 조작은 없다(판정은 스캔).

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type {
  AxisRow,
  BandRow,
  DefectPanel,
  GradeRow,
  SourceEligibilityPanel,
} from '@/lib/textbook/source-eligibility-view'

/**
 * 등급 색 — **색만으로 말하지 않는다.** 옆에 「조판 가능/불가」 글자를 함께 둔다.
 * 색맹 대응이자, 흑백 인쇄된 화면에서도 읽히게 하는 장치다.
 */
const GRADE_TONE: Record<string, string> = {
  usable: 'var(--success-ink)',
  excerpt: 'var(--success-ink)',
  'excerpt-blind': 'var(--warning-ink)',
  unjudged: 'var(--warning-ink)',
  unknown: 'var(--warning-ink)',
  blocked: 'var(--error-ink)',
}

export function SourceEligibilityClient({ panel }: { panel: SourceEligibilityPanel }) {
  const t = panel.total
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">원문 적격</h2>
          <p className="font-body text-[13px] text-[var(--t2)]">
            교재에 실을 수 있는 원문인가를 일곱 축으로 판정한다. 조판은 이 판정을 통과한 원문만
            받아야 한다.
          </p>
        </div>
        <AdminScreenHelp screen="csat-sources" />
      </header>

      <FreshnessBar panel={panel} />

      {panel.topBlocker ? (
        <section
          aria-label="다음 한 걸음"
          className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--bg)] p-4"
        >
          <span className="font-body text-[12px] font-[700] text-[var(--warning-ink)]">
            다음 한 걸음
          </span>
          <p className="font-body text-[14px] text-[var(--t1)]">
            <b className="tabular-nums">{panel.topBlocker.grade.count.toLocaleString()}편</b> 이{' '}
            <b>{panel.topBlocker.axis.label}</b> 에서 막혀 있다 — {panel.topBlocker.grade.label}.
          </p>
          {/* 처방 문자열의 정본은 `buildSourceEligibilityPanel` 이다 — 미판정이 전부
              구조적이면 거기서 이미 발췌 경로로 바뀌어 온다(등급표와 같은 문자열을 읽는다). */}
          <p className="font-body text-[13px] text-[var(--t2)]">
            {panel.topBlocker.grade.nextStep}
          </p>
          {/*
            ⚠️ **이 줄이 없으면 화면이 헛일을 시킨다.** 미절단 원본(`purpose='raw'`)은
            게이트를 돌려도 판정이 안 붙는다 — `PURPOSE_RULE.raw.verdicts` 가 빈 집합이라
            `decide()` 가 판정 전에 되돌아온다.

            **부분일 때만 "그중" 이라고 쓴다.** 전부일 때(2026-09-04 기사 전량 판정 이후가
            그렇다) "그중" 은 나머지가 있다는 뜻이 되어 거짓이고, 처방은 위 줄이 이미 말한다.
          */}
          {panel.topBlocker.axis.id === 'judgement' &&
          panel.structurallyUnjudged &&
          panel.structurallyUnjudged < panel.topBlocker.grade.count ? (
            <p className="font-body text-[13px] text-[var(--error-ink)]">
              그중 <b className="tabular-nums">{panel.structurallyUnjudged.toLocaleString()}편</b>{' '}
              은 <b>게이트를 돌려도 안 풀린다</b> — 미절단 원본은 게이트가 판정하지 않는다(
              <span className="font-mono">purpose=raw</span>). 발췌 경로(
              <span className="font-mono">plos-extract</span>)로 가야 한다.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-label="요약" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="조판 가능"
          value={t.composable.toLocaleString()}
          sub={`전체 ${t.total.toLocaleString()}편의 ${t.composablePct}%`}
          warn={t.composablePct < 100}
        />
        <Stat
          label="지금 조판이 받으면 안 되는 편수"
          value={(t.total - t.composable).toLocaleString()}
          sub="판정을 통과하지 못한 원문"
          warn={t.total - t.composable > 0}
        />
        <Stat
          label="되돌릴 수 없는 부적격"
          value={((t.byBlockedAxis.legal ?? 0) + (t.byBlockedAxis.safety ?? 0)).toLocaleString()}
          sub="라이선스 · 철회 · 민감 소재"
          warn={(t.byBlockedAxis.legal ?? 0) + (t.byBlockedAxis.safety ?? 0) > 0}
        />
        {/*
          문항이 붙었다는 것은 **그 원문에서 이미 지문이 잘려 나왔다**는 뜻이다.
          그 편수와 조판 가능 편수의 차이가 곧 "판정 없이 만들어진 문항" 의 분모다 —
          숨기면 화면이 좋아 보이지만 그게 이 화면이 막으려는 바로 그것이다.
        */}
        <Stat
          label="문항이 붙은 원문"
          value={
            panel.articlesWithItems == null ? '못 잼' : panel.articlesWithItems.toLocaleString()
          }
          sub={
            panel.articlesWithItems == null
              ? '옛 스냅샷 — 다시 재야 한다'
              : `그중 판정 통과 ${t.composable.toLocaleString()}`
          }
          warn={panel.articlesWithItems != null && panel.articlesWithItems > t.composable}
        />
      </section>
      <p className="font-body text-[12px] text-[var(--t3)]">
        판정 규격 <span className="font-mono">v{panel.specVersion}</span> · 훑는 데{' '}
        {panel.scanSeconds}초
        {panel.articlesWithItems != null && panel.articlesWithItems > t.composable ? (
          <>
            {' · '}
            <b className="text-[var(--warning-ink)]">
              {(panel.articlesWithItems - t.composable).toLocaleString()}편은 문항이 이미 있는데
              원문이 판정을 통과하지 못한다
            </b>
          </>
        ) : null}
      </p>

      <AxisTable axes={panel.axes} />
      <RequirementTable panel={panel} />
      <GradeTable grades={panel.grades} total={t.total} />
      <BandTable bands={panel.bands} />
      <BlockedSources rows={panel.blockedBySource} />
      <DefectTable defects={panel.defects} />
    </div>
  )
}

/**
 * 언제 잰 값인가.
 *
 * ⚠️ **이 줄을 지우면 안 된다.** 이 화면은 실시간 집계가 아니라 스냅샷을 읽는다
 * (`library_articles` 는 본문이 1.3GB 라 조건부 exact count 가 8초 타임아웃에 걸린다).
 * 낡은 값을 최신인 척 보이는 것이 가장 나쁜 실패다.
 */
function FreshnessBar({ panel }: { panel: SourceEligibilityPanel }) {
  const stale = panel.ageDays >= 7 || panel.specStale
  return (
    <p
      className="rounded-[var(--r-sm)] border px-3 py-2 font-body text-[12px]"
      style={{
        borderColor: stale ? 'var(--warning)' : 'var(--bd)',
        color: stale ? 'var(--warning-ink)' : 'var(--t3)',
      }}
    >
      {panel.measuredAt.slice(0, 16).replace('T', ' ')} UTC 에 잰 값
      {panel.ageDays > 0 ? ` · ${panel.ageDays}일 전` : ' · 오늘'} · 대상 {panel.scope}
      {panel.specStale ? ' · ⚠️ 판정 규격이 바뀌었다 — 다시 재야 한다' : ''}
      <span className="ml-2 text-[var(--t3)]">
        갱신: <code>pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs</code>
      </span>
    </p>
  )
}

/** 일곱 축 — **자의 출처를 함께 보인다.** "왜 이 원문을 골랐나" 에 답하는 자리다. */
function AxisTable({ axes }: { axes: AxisRow[] }) {
  return (
    <section aria-label="판정 기준" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">판정 기준 — 일곱 축</h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        순서가 곧 판정 순서다. <b>되돌릴 수 없는 축을 먼저</b> 본다 — 그래야 “고치면 되는 문제” 와
        “고칠 수 없는 문제” 가 사유에 섞이지 않는다. 임계값은 전부 실측에서 나온 값이고, 그 출처를
        함께 적는다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">축</th>
              <th className="py-2 pr-3 font-[600]">무엇을 묻나</th>
              <th className="py-2 pr-3 font-[600]">자의 출처</th>
              <th className="py-2 pr-3 text-right font-[600]">지금 탈락</th>
              <th className="py-2 font-[600]">되돌리기</th>
            </tr>
          </thead>
          <tbody>
            {axes.map((a) => (
              <tr key={a.id} className="border-b border-[var(--bd)] align-top">
                <td className="py-2 pr-3 font-[700] text-[var(--t1)]">{a.label}</td>
                <td className="py-2 pr-3 text-[var(--t2)]">{a.question}</td>
                <td className="py-2 pr-3 text-[11px] text-[var(--t3)]">{a.source}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                  {a.blocked ? a.blocked.toLocaleString() : '—'}
                </td>
                <td
                  className="py-2 text-[12px]"
                  style={{ color: a.recoverable ? 'var(--t2)' : 'var(--error-ink)' }}
                >
                  {a.recoverable ? '가능' : '불가 — 영영 못 쓴다'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * 연령 × 유형별 원문 요건.
 *
 * 위 표들이 "지금 몇 편인가" 를 말한다면 이 표는 **"무엇을 갖춰야 하는가"** 를 말한다.
 * 둘이 함께 있어야 "이 지문을 왜 이 학년 이 유형에 썼나" 에 답할 수 있다 —
 * 그 답이 없으면 원문 선택은 감이다.
 *
 * ⚠️ **DB 를 안 본다.** 정본(`SERIES_SPINE` + `itemWordSpec`)에서 바로 펴므로
 *   스냅샷이 낡아도 이 표는 늘 지금 규격이다.
 */
function RequirementTable({ panel }: { panel: SourceEligibilityPanel }) {
  const families = [...new Set(panel.requirements.flatMap((b) => b.types.map((t) => t.family)))]
  return (
    <section aria-label="연령별 유형별 원문 요건" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        연령 × 유형별 원문 요건
      </h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        어느 학년에 어느 유형이 열리는지는 <b>학령 사다리 7단</b>이 정하고, 그 유형이 요구하는 지문
        어수창은
        <b> 유형 계열</b>이 정한 뒤 <b>그 학년대 시중 분포(p10~p90)</b>가 좁힌다. 좁히지 못한 칸은
        그렇게 적는다 — 좁혀진 척하면 근거가 거짓이 된다.
      </p>
      <div className="flex flex-col gap-3">
        {panel.requirements.map((b) => (
          <div key={b.vLevel} className="rounded-[var(--r-md)] border border-[var(--bd)] p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                {b.step}단 · {b.schoolBand}
              </span>
              <span className="font-body text-[12px] tabular-nums text-[var(--t2)]">
                V{b.vLevel}
              </span>
              <span className="font-body text-[12px] text-[var(--t3)]">{b.volumeTitle}</span>
              <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
                {b.marketBucket ? `시중 버킷 ${b.marketBucket}` : '시중 버킷 없음'}
              </span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {b.types.map((t) => (
                <li
                  key={t.type}
                  className="flex items-baseline gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] px-2 py-1 font-body text-[12px]"
                  title={`${t.familyLabel} — ${panel.familySource[t.family] ?? ''}`}
                >
                  <span className="font-[600] text-[var(--t1)]">{t.label}</span>
                  <span className="tabular-nums text-[var(--t2)]">
                    {t.window ? `${t.window.min}–${t.window.max}어` : '지문 없음'}
                  </span>
                  {t.window ? (
                    <span
                      className="text-[10px]"
                      style={{ color: t.narrowed ? 'var(--success-ink)' : 'var(--t3)' }}
                    >
                      {t.narrowed ? '학년으로 좁힘' : '유형 창 그대로'}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <details className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2">
        <summary className="cursor-pointer font-body text-[12px] font-[600] text-[var(--t2)]">
          계열별 창의 출처 — 짐작으로 정한 값이 없다는 근거
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {families.map((f) => (
            <li key={f} className="font-body text-[11px] text-[var(--t3)]">
              <b className="text-[var(--t2)]">
                {
                  panel.requirements.flatMap((b) => b.types).find((t) => t.family === f)
                    ?.familyLabel
                }
              </b>{' '}
              — {panel.familySource[f]}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

/** 등급 여섯 — **다음에 할 일**로 가른 결과. */
function GradeTable({ grades, total }: { grades: GradeRow[]; total: number }) {
  return (
    <section aria-label="등급 분포" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        등급 분포
        <span className="ml-2 font-body text-[13px] font-[500] tabular-nums text-[var(--t2)]">
          {total.toLocaleString()}편
        </span>
      </h2>
      <ul className="flex flex-col gap-1">
        {grades.map((g) => (
          <li
            key={g.grade}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[13px]"
          >
            <span className="w-[110px] font-[700]" style={{ color: GRADE_TONE[g.grade] }}>
              {g.label}
            </span>
            <span
              aria-hidden
              className="h-[6px] w-[120px] overflow-hidden rounded-[var(--r-sm)] bg-[var(--bd)]"
            >
              <span
                className="block h-full rounded-[var(--r-sm)]"
                style={{
                  width: `${Math.max(1, Math.round(g.pct))}%`,
                  background: GRADE_TONE[g.grade],
                }}
              />
            </span>
            <span className="tabular-nums text-[var(--t1)]">{g.count.toLocaleString()}</span>
            <span className="tabular-nums text-[var(--t3)]">{g.pct}%</span>
            <span className="text-[11px] font-[700] text-[var(--t2)]">
              {g.composable ? '조판 가능' : '조판 불가'}
            </span>
            <span className="ml-auto text-[12px] text-[var(--t2)]">{g.nextStep}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 밴드별 — 어느 학년 교재가 지금 만들어질 수 있는가. */
function BandTable({ bands }: { bands: BandRow[] }) {
  return (
    <section aria-label="학령별 적격" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">학령별 적격</h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        조판 가능이 0 인 칸은 <b>그 학년 교재를 지금 만들 수 없다</b>는 뜻이다. 재고가 있어도 판정을
        통과하지 못하면 실을 수 없다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">V</th>
              <th className="py-2 pr-3 font-[600]">학령</th>
              <th className="py-2 pr-3 text-right font-[600]">원문</th>
              <th className="py-2 pr-3 text-right font-[600]">조판 가능</th>
              <th className="py-2 pr-3 text-right font-[600]">비율</th>
              <th className="py-2 pr-3 text-right font-[600]">그대로</th>
              <th className="py-2 pr-3 text-right font-[600]">발췌</th>
              <th className="py-2 pr-3 text-right font-[600]">미판정</th>
              <th className="py-2 text-right font-[600]">불가</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={String(b.vLevel)} className="border-b border-[var(--bd)]">
                <td className="py-2 pr-3 font-[700] tabular-nums text-[var(--t1)]">
                  {b.vLevel == null ? '없음' : `V${b.vLevel}`}
                </td>
                <td className="py-2 pr-3 text-[var(--t2)]">
                  {b.schoolBand ?? <span className="text-[var(--t3)]">사다리 밖</span>}
                  {b.volumeTitle ? (
                    <span className="ml-1 text-[11px] text-[var(--t3)]">{b.volumeTitle}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                  {b.total.toLocaleString()}
                </td>
                <td
                  className="py-2 pr-3 text-right font-[700] tabular-nums"
                  style={{ color: b.composable ? 'var(--success-ink)' : 'var(--error-ink)' }}
                >
                  {b.composable.toLocaleString()}
                  {b.composable === 0 ? (
                    <span className="ml-1 text-[11px]">만들 수 없음</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                  {b.composablePct}%
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.usable.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.excerpt.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.unjudged.toLocaleString()}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.blocked.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** 원천별 — 한 원천이 통째로 막혀 있으면 그 원천의 처리 단계가 밀린 것이다. */
function BlockedSources({ rows }: { rows: { source: string; count: number }[] }) {
  if (!rows.length) return null
  return (
    <section aria-label="조판 불가 원천" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        조판 불가가 많은 원천
      </h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        한 원천이 통째로 막혀 있으면 대개 <b>그 원천의 처리 단계가 밀린 것</b>이지 원천이 나쁜 것이
        아니다.
      </p>
      <ul className="flex flex-wrap gap-2">
        {rows.slice(0, 12).map((r) => (
          <li
            key={r.source}
            className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-1.5 font-body text-[12px] text-[var(--t2)]"
          >
            {r.source} <b className="tabular-nums text-[var(--t1)]">{r.count.toLocaleString()}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 추출 결함 — **일곱 축이 통과시킨 뒤에도 남는 것.**
 *
 * 축은 「이 원문을 써도 되는가」를 묻고, 그 질문은 본문이 온전하다는 것을 전제한다.
 * 전제가 깨진 경우는 축이 못 잡는다 — 장르도 저작권도 어수도 맞는데 본문 첫 문단이
 * `You are using an outdated browser…` 이거나 초록이 두 번 들어 있다.
 * 그대로 조판하면 **그 문자열이 학생이 읽는 지문에 인쇄된다.**
 *
 * ⚠️ **비율만 보이면 오해를 부른다.** 한 원천이 그 결함의 80% 이상을 차지하면 그 사실을
 * 함께 말한다 — "본문 절반이 깨졌다" 와 "한 원천의 수확기가 한 군데서 겹쳐 붙인다" 는
 * 처방이 완전히 다르다.
 */
function DefectTable({ defects }: { defects: DefectPanel }) {
  return (
    <section aria-label="추출 결함" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">추출 결함</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          적격 판정이 통과시켜도 <b>지문으로 못 쓰는</b> 본문 — 따로 잰다
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {defects.measuredAt.slice(0, 10)} 에 잰 값 ·{' '}
          {defects.ageDays === 0 ? '오늘' : `${defects.ageDays}일 전`} ·{' '}
          {defects.scanned.toLocaleString()}편 훑음
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        하나라도 걸린 편 <b className="tabular-nums">{defects.defective.toLocaleString()}편</b> (
        {defects.defectivePct}%). 갱신:{' '}
        <code>pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --all</code>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">결함</th>
              <th className="py-2 pr-3 text-right font-[600]">편수</th>
              <th className="py-2 pr-3 text-right font-[600]">비율</th>
              <th className="py-2 font-[600]">무엇인가 · 어디에 몰려 있나</th>
            </tr>
          </thead>
          <tbody>
            {defects.rules.map((r) => (
              <tr key={r.id} className="border-[var(--bd)]/50 border-b align-top">
                <td className="py-2 pr-3 font-[600] text-[var(--t1)]">{r.label}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                  {r.count.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">{r.pct}%</td>
                <td className="py-2 text-[12px] text-[var(--t2)]">
                  {r.why}
                  {r.concentrated && r.topSource ? (
                    <span className="mt-1 block text-[var(--warning-ink)]">
                      ⚠ 사실상 <b>{r.topSource.source}</b> 하나의 문제다 —{' '}
                      {/* ⚠️ 한 표현식으로 만든다 — 표현식과 리터럴을 붙여 쓰면 서버 렌더가
                          사이에 주석 마커를 넣어 `99.7%` 가 문자열로 남지 않는다. */}
                      <span className="tabular-nums">
                        {`${r.topSource.count.toLocaleString()} / ${r.count.toLocaleString()}건(${r.topSource.share}%)`}
                      </span>
                      {' 전체 비율로 읽지 말고 그 수확기를 볼 것.'}
                    </span>
                  ) : r.bySource.length ? (
                    <span className="mt-1 block text-[var(--t3)]">
                      원천별{' '}
                      {r.bySource
                        .slice(0, 4)
                        .map((b) => `${b.source} ${b.count.toLocaleString()}`)
                        .join(' · ')}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        이 스캔은 <b>고치지 않는다</b> — 어디에 몇 편 있는지만 센다. 무엇을 지울지는 소스별 추출기를
        고칠 때 사람이 정한다(<code>==</code> 는 수식에도, <code>Media</code> 는 본문 낱말로도
        나온다).
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
      <span className="font-body text-[12px] text-[var(--t2)]">{label}</span>
      <span className="font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
        {value}
      </span>
      {sub ? (
        <span
          className="font-body text-[11px]"
          style={{ color: warn ? 'var(--warning-ink)' : 'var(--t3)' }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  )
}
