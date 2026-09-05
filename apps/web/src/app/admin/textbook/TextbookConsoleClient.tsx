// apps/web/src/app/admin/textbook/TextbookConsoleClient.tsx
// TBP(교재) 콘솔 — 브랜드 · 사다리 · 문항 건강 · 평가 우위. 조작은 없다(생성은 Claude Code 드레인).

'use client'

import { KID_SOURCE_TARGET } from '@vocaflow/library-pipeline'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { TextbookConsoleStats, VolumeRender } from '@/lib/textbook/console-stats'
import type { KidSourcePanel } from '@/lib/textbook/kid-source-stats'

const TYPE_KO: Record<string, string> = {
  order: '순서',
  insert: '삽입',
  irrelevant: '흐름 무관',
  vocab_choice: '어휘',
  grammar_choice: '어법',
  word_order: '영작 배열',
}

const STANDING_KO: Record<string, { mark: string; label: string; color: string }> = {
  superior: { mark: '🟢', label: '우위', color: 'var(--success-ink)' },
  parity: { mark: '⚪', label: '대등', color: 'var(--t2)' },
  inferior: { mark: '🔴', label: '열위', color: 'var(--error-ink)' },
  absent: { mark: '⛔', label: '없음', color: 'var(--error-ink)' },
  unmeasured: { mark: '❔', label: '못 잼', color: 'var(--t3)' },
}

/** 카이제곱 임계 — 자유도 4, 유의수준 0.05. 통계표 값이지 우리가 고른 숫자가 아니다. */
const CHI2_CRITICAL = 9.488

export function TextbookConsoleClient({
  stats,
  kidSource,
}: {
  stats: TextbookConsoleStats
  kidSource: KidSourcePanel
}) {
  const { evaluation: ev, series, brand } = stats
  const bottleneck = findBottleneck(brand.renders)
  const superiorPct = ev.total ? Math.round((100 * ev.byStanding.superior) / ev.total) : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-[800] text-[var(--t1)]">교재 (TBP)</h1>
          <p className="font-body text-[13px] text-[var(--t2)]">
            학령 사다리 · 문항 건강 · 시중 대비 평가 우위. 생성은 이 화면이 아니라 Claude Code 드레인이다.
          </p>
        </div>
        <AdminScreenHelp screen="textbook" />
      </header>

      {stats.loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--bg)] p-4 font-body text-[13px] text-[var(--error-ink)]"
        >
          {stats.loadError}
        </p>
      ) : null}

      {/* ── 요약 ─────────────────────────────────────────────── */}
      <section aria-label="요약" className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="저장 문항" value={stats.totalItems.toLocaleString()} />
        <Stat label="사다리 계단" value={`${series.rungs.length - series.brokenSteps.length}/${series.rungs.length}`} />
        <Stat
          label="조판된 권"
          value={brand.renderError ? '—' : `${brand.renders.length}/${series.rungs.length}`}
          sub={
            brand.renderError
              ? '기록 못 읽음'
              : brand.staleBands.length
                ? `옛 규격 ${brand.staleBands.length}권`
                : undefined
          }
          warn={Boolean(brand.renderError) || brand.staleBands.length > 0}
        />
        <Stat
          label="문항 없는 원글"
          value={brand.idleArticles == null ? '—' : brand.idleArticles.toLocaleString()}
          sub={
            brand.idleArticles == null
              ? '아직 안 쟀다'
              : brand.idleArticles > 0
                ? '집필보다 이게 먼저다'
                : '남은 몫 없음'
          }
          warn={(brand.idleArticles ?? 0) > 0}
        />
        <Stat label="평가 우위" value={`${superiorPct}%`} sub={`${ev.byStanding.superior}/${ev.total}`} />
        <Stat
          label="학습자 관측"
          value={stats.observations.toLocaleString()}
          sub={stats.observations === 0 ? '난이도·변별도 못 냄' : undefined}
          warn={stats.observations === 0}
        />
      </section>

      {/* ── 유형별 ────────────────────────────────────────────── */}
      <section aria-label="유형별 문항" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">유형별 문항</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-body text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                <th className="py-2 pr-3 font-[600]">유형</th>
                <th className="py-2 pr-3 text-right font-[600] tabular-nums">문항</th>
                <th className="py-2 pr-3 font-[600]">정답 번호</th>
              </tr>
            </thead>
            <tbody>
              {stats.byType.map((t) => (
                <tr key={t.type} className="border-b border-[var(--bd)]">
                  <td className="py-2 pr-3 text-[var(--t1)]">{TYPE_KO[t.type] ?? t.type}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                    {t.count.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    {t.chi2 == null ? (
                      <span className="text-[var(--t3)]">저장 형식에 번호 없음</span>
                    ) : (
                      <span style={{ color: t.answerBiased ? 'var(--error-ink)' : 'var(--success-ink)' }}>
                        {t.answerBiased ? '⚠️ 쏠림' : '✅ 고름'} · χ²={t.chi2.toFixed(1)} (임계 {CHI2_CRITICAL})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-body text-[12px] text-[var(--t3)]">
          초등 3종(파닉스 운율·기본어휘 뜻·철자 완성)은 사전의 순수 함수라 저장하지 않는다 — 여기 표에 없다.
        </p>
      </section>

      {/* ── 브랜드 규격 ───────────────────────────────────────── */}
      <section aria-label="브랜드 규격" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          브랜드 규격 — {brand.brand}
        </h2>
        <p className="font-body text-[12px] text-[var(--t3)]">
          값은 <code className="font-mono">@vocaflow/design-tokens</code> 에서 읽는다 — 조판기가 색을 따로
          갖고 있으면 손에 쥔 책이 화면과 달라진다. 규격 지문{' '}
          <span className="font-mono text-[var(--t2)]">{brand.fingerprint}</span> 이 바뀌면 그 전에 찍은
          권은 아래에서 <span style={{ color: 'var(--warning-ink)' }}>옛 규격</span> 으로 뜬다.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-body text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                <th className="py-2 pr-3 font-[600]">지면에서의 자리</th>
                <th className="py-2 pr-3 font-[600]">라이트</th>
                <th className="py-2 pr-3 font-[600]">다크</th>
              </tr>
            </thead>
            <tbody>
              {brand.palette.map((row) => (
                <tr key={row.key} className="border-b border-[var(--bd)]">
                  <td className="py-2 pr-3 text-[var(--t1)]">{row.label}</td>
                  <td className="py-2 pr-3">
                    <Swatch value={row.light} />
                  </td>
                  <td className="py-2 pr-3">
                    <Swatch value={row.dark} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-body text-[12px]">
          <dt className="text-[var(--t2)]">영문 지문</dt>
          <dd className="font-mono text-[var(--t1)]">{brand.fonts.english}</dd>
          <dt className="text-[var(--t2)]">한국어 해설</dt>
          <dd className="font-mono text-[var(--t1)]">{brand.fonts.body}</dd>
          <dt className="text-[var(--t2)]">문항 번호·수치</dt>
          <dd className="font-mono text-[var(--t1)]">{brand.fonts.mono}</dd>
        </dl>
      </section>

      {/* ── 조판 기록 ─────────────────────────────────────────── */}
      <section aria-label="조판된 권" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">조판된 권</h2>
        {brand.renderError ? (
          <p
            role="alert"
            className="rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--error-ink)]"
          >
            {brand.renderError} — 조판이 0권인 것이 아니라 기록을 못 읽은 것이다.
          </p>
        ) : brand.renders.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">
            아직 조판된 권이 없다.{' '}
            <code className="font-mono text-[12px]">
              pnpm dlx tsx scripts/textbook/render-volume.mjs --band 5 --units 20 --out volume-v5.html
            </code>{' '}
            로 찍으면 여기 한 행이 남는다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse font-body text-[13px]">
              <thead>
                <tr className="border-b border-[var(--bd)] text-left text-[var(--t2)]">
                  <th className="py-2 pr-3 font-[600]">권</th>
                  <th className="py-2 pr-3 text-right font-[600]">단원</th>
                  <th className="py-2 pr-3 text-right font-[600]">문항</th>
                  <th className="py-2 pr-3 font-[600]">자동 검수</th>
                  <th className="py-2 pr-3 font-[600]">해설 없음</th>
                  <th className="py-2 pr-3 text-right font-[600]">유형-학년 적합도</th>
                  <th className="py-2 pr-3 text-right font-[600]">쓸 수 있는 원글</th>
                  <th className="py-2 pr-3 text-right font-[600]">겹치지 않는 권</th>
                  <th className="py-2 pr-3 font-[600]" title="조판물 표지에 인쇄되는 검수 주장과 같은 값">
                    검수 결과
                  </th>
                  <th className="py-2 pr-3 font-[600]">규격</th>
                  <th className="py-2 pr-3 font-[600]">마지막 조판</th>
                </tr>
              </thead>
              <tbody>
                {brand.renders.map((r) => (
                  <tr key={r.band} className="border-b border-[var(--bd)] align-top">
                    <td className="py-2 pr-3 text-[var(--t1)]">
                      <span className="font-[700]">{r.volumeTitle}</span>
                      <span className="block text-[12px] text-[var(--t3)]">
                        V{r.band}
                        {r.step != null ? ` · ${r.step}단` : ''}
                        {r.schoolBand ? ` · ${r.schoolBand}` : ''}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">{r.units}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">{r.items}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="tabular-nums"
                        style={{ color: r.autoPassed === r.autoTotal ? 'var(--success-ink)' : 'var(--warning-ink)' }}
                      >
                        {/* 한 문자열로 낸다 — 조각내면 "8/9" 가 마크업 사이에 끊겨 복사도 검색도 안 된다. */}
                        {`${r.autoPassed === r.autoTotal ? '✅' : '⚠️'} ${r.autoPassed}/${r.autoTotal}`}
                      </span>
                      {r.failedChecks.length ? (
                        <span className="block text-[12px] text-[var(--warning-ink)]">
                          {r.failedChecks.join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      <span
                        style={{ color: r.missingExplanations === 0 ? 'var(--success-ink)' : 'var(--warning-ink)' }}
                      >
                        {r.missingExplanations === 0 ? '✅ 0' : `⚠️ ${r.missingExplanations}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                      {/* 임계를 두지 않는다 — 시장에서 읽어온 밀도와의 거리일 뿐, 몇 %면
                          합격이라는 근거가 어디에도 없다. 낮은 순서만 아래에서 짚는다. */}
                      {r.typeMixFit == null ? (
                        <span className="text-[var(--t3)]">못 잼</span>
                      ) : (
                        `${(r.typeMixFit * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                      {/* 분자를 함께 보여야 옆 칸의 권수가 읽힌다. 유휴분은 경고색으로 뒤에 붙인다. */}
                      {r.articlesWithItems == null ? (
                        <span className="text-[var(--t3)]">못 잼</span>
                      ) : (
                        <>
                          {r.articlesWithItems.toLocaleString()}
                          {r.articlesIdle ? (
                            <span className="block text-[12px]" style={{ color: 'var(--warning-ink)' }}>
                              +{r.articlesIdle.toLocaleString()} 문항 없음
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                      {/* null 은 0 이 아니다 — 원글을 안 쓰는 권은 원글 재고가 상한이 아니다. */}
                      {r.distinctVolumes == null ? (
                        <span className="text-[var(--t3)]" title="이 권은 원글을 쓰지 않는다 — 원글 재고가 상한이 아니다">
                          해당 없음
                        </span>
                      ) : (
                        r.distinctVolumes
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[12px] leading-relaxed">
                      {/* 조판물이 표지에 인쇄하는 검수 주장을 **화면에서도 확인**할 수 있게 한다.
                          그 셋(지문 규격·정답 쏠림·교정)은 오래 조판물에만 있었고, 둘은
                          2026-08-31 까지 아예 돌지도 않았다(칩만 찍혔다). 기록이 없는 옛 권은
                          '옛 기록' 으로 남긴다 — 0 으로 채우면 검수가 돈 것처럼 보인다. */}
                      {r.review.proofread == null && r.review.answerBias == null ? (
                        <span className="text-[var(--t3)]">옛 기록 — 재조판 필요</span>
                      ) : (
                        <>
                          {r.review.passageSpec ? (
                            <span className="block text-[var(--t2)]">지문 {r.review.passageSpec}</span>
                          ) : null}
                          {r.review.answerBias ? (
                            <span
                              className="block"
                              style={{ color: r.review.answerBias.biased ? 'var(--warning-ink)' : 'var(--success-ink)' }}
                              title={`χ²=${r.review.answerBias.chi2} · Cramér's V=${r.review.answerBias.cramersV} (둘 다 넘어야 쏠림)`}
                            >
                              {r.review.answerBias.biased ? '⚠️ 정답 쏠림' : '✅ 정답 균등'}
                            </span>
                          ) : null}
                          {r.review.proofread ? (
                            <span
                              className="block"
                              style={{ color: r.review.proofread.defective ? 'var(--warning-ink)' : 'var(--success-ink)' }}
                              title={
                                Object.entries(r.review.proofread.byRule)
                                  .map(([rule, n]) => `${rule} ${n}`)
                                  .join(' · ') || '지적 없음'
                              }
                            >
                              교정 {r.review.proofread.defective}/{r.review.proofread.passages}
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.brandCurrent ? (
                        <span style={{ color: 'var(--success-ink)' }}>✅ 최신</span>
                      ) : (
                        <span style={{ color: 'var(--warning-ink)' }} title={r.brandFingerprint}>
                          ⚠️ 옛 규격 — 재조판
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[var(--t2)]">
                      {r.renderedAt.slice(0, 10)}
                      <span className="block text-[12px] text-[var(--t3)]">{r.renderCount}회 찍음</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {bottleneck ? (
          <p className="font-body text-[13px] text-[var(--t2)]">
            <span className="font-[700] text-[var(--t1)]">사다리 병목</span> —{' '}
            {bottleneck.capacity ? (
              <>
                겹치지 않는 권이 가장 적은 계단은{' '}
                <span className="text-[var(--t1)]">
                  {bottleneck.capacity.step}단 {bottleneck.capacity.volumeTitle}
                </span>{' '}
                <span className="tabular-nums">({bottleneck.capacity.distinctVolumes}권)</span>. 여기서
                학습자가 같은 책을 다시 받는다 — 문항이 아니라 <strong>원글</strong>이 상한이다.{' '}
              </>
            ) : null}
            {bottleneck.fit ? (
              <>
                시중 구성과 가장 먼 계단은{' '}
                <span className="text-[var(--t1)]">
                  {bottleneck.fit.step}단 {bottleneck.fit.volumeTitle}
                </span>{' '}
                <span className="tabular-nums">
                  ({(bottleneck.fit.typeMixFit! * 100).toFixed(1)}%)
                </span>
                .
              </>
            ) : null}
          </p>
        ) : null}
        {brand.idleArticles ? (
          <p className="font-body text-[13px]" style={{ color: 'var(--warning-ink)' }}>
            <span className="font-[700]">먼저 할 일</span> — 쓰여 있는데 문항이 안 붙은 원글이{' '}
            <span className="tabular-nums">{brand.idleArticles.toLocaleString()}편</span> 있다. 조판은 이
            글들을 재고로 세지 않으므로, <strong>이 상태에서는 글을 더 써도 사다리가 안 늘어난다</strong> —{' '}
            <code className="font-mono text-[12px]">
              scripts/textbook/store-new-types.mjs --band N --commit
            </code>{' '}
            이 집필보다 먼저다.
          </p>
        ) : null}
        <p className="font-body text-[12px] text-[var(--t3)]">
          권마다 한 행이고 다시 찍으면 덮어쓴다 — 재실행해도 행이 늘지 않는다. 여기 없는 계단은
          아직 안 찍은 것이지 실패한 것이 아니다. <strong>임계값을 두지 않는다</strong> — 적합도
          몇 %가 합격이라는 근거가 없어서, 가장 낮은 것만 이름으로 짚는다.
        </p>
      </section>

      {/* ── 사다리 ────────────────────────────────────────────── */}
      {/* ── 초·중 원문 재고 ───────────────────────────────────── */}
      <KidSourceSection panel={kidSource} />

      <section aria-label="학령 사다리" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          학령 사다리 — {series.brand}
        </h2>
        <ul className="flex flex-col gap-1">
          {series.rungs.map((r) => (
            <li
              key={r.rung.step}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[13px]"
            >
              <span className="font-[700] text-[var(--t1)]">{r.rung.step}단</span>
              <span className="text-[var(--t2)]">V{r.rung.vLevels.join(',')}</span>
              <span className="text-[var(--t1)]">{r.rung.schoolBand}</span>
              <span className="ml-auto tabular-nums text-[var(--t1)]">{r.total.toLocaleString()}</span>
              {r.emptyTypes.length ? (
                <span className="basis-full text-[12px] text-[var(--warning-ink)]">
                  재고 0: {r.emptyTypes.map((t) => TYPE_KO[t] ?? t).join(' · ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 평가 우위 ─────────────────────────────────────────── */}
      <section aria-label="평가 요소" className="flex flex-col gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">시중 교재 대비 평가 요소</h2>
        <p className="font-body text-[12px] text-[var(--t3)]">
          분모는 요소 전체다 — 못 잰 것을 빼고 세면 숫자가 거짓말이 된다.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['superior', 'parity', 'inferior', 'absent', 'unmeasured'] as const).map((s) => (
            <span
              key={s}
              className="rounded-[var(--r-sm)] border border-[var(--bd)] px-2 py-1 font-body text-[12px]"
              style={{ color: STANDING_KO[s]!.color }}
            >
              {STANDING_KO[s]!.mark} {STANDING_KO[s]!.label} {ev.byStanding[s]}
            </span>
          ))}
        </div>
        {ev.losing.length ? (
          <div className="mt-1 flex flex-col gap-1">
            <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
              지고 있는 요소 {ev.losing.length}개
            </h3>
            <ul className="flex flex-col gap-1 font-body text-[13px] text-[var(--t2)]">
              {ev.losing.map((d) => (
                <li key={d.key}>
                  <span style={{ color: STANDING_KO[d.standing]!.color }}>
                    {STANDING_KO[d.standing]!.mark}
                  </span>{' '}
                  <span className="text-[var(--t1)]">{d.label}</span> — {d.ours}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}

/**
 * 사다리의 병목 — **최솟값을 이름으로 짚는다.**
 *
 * 표에 숫자가 일곱 줄 있으면 관리자가 매번 눈으로 최소를 찾아야 하고, 그러면 대개 안 찾는다.
 * 임계값을 두지 않는 이유는 근거가 없어서다 — "적합도 80% 이상 합격" 같은 수치는
 * 어디에서도 관측되지 않았다. 그래서 **판정하지 않고 순위만 말한다.**
 *
 * 못 잰 것(null)은 후보에서 뺀다 — 0 으로 치면 그것이 항상 최소가 되어 병목을 가린다.
 */
function findBottleneck(renders: VolumeRender[]): {
  capacity: VolumeRender | null
  fit: VolumeRender | null
} | null {
  if (renders.length === 0) return null
  const withCapacity = renders.filter((r) => r.distinctVolumes != null)
  const withFit = renders.filter((r) => r.typeMixFit != null)
  const min = <T,>(rows: T[], key: (r: T) => number): T | null =>
    rows.length === 0 ? null : rows.reduce((a, b) => (key(b) < key(a) ? b : a))
  const capacity = min(withCapacity, (r) => r.distinctVolumes!)
  const fit = min(withFit, (r) => r.typeMixFit!)
  if (!capacity && !fit) return null
  return { capacity, fit }
}

/** 색 한 칸. **색상만으로 정보를 전달하지 않는다** — 값을 글자로 함께 적는다. */
function Swatch({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-[3px] border border-[var(--bd)]"
        style={{ backgroundColor: value }}
      />
      <span className="font-mono text-[12px] uppercase text-[var(--t1)]">{value}</span>
    </span>
  )
}

/**
 * **초·중 원문 재고 — 칸별로 얼마나 찼고 어디가 막혔나.**
 *
 * 지금까지 이 수치는 `scripts/textbook/kid-inventory.mjs` 를 돌려야만 보였다.
 * 조작 버튼은 두지 않는다 — 수확은 책을 수십 권 내려받는 일이라 웹 요청 시간 안에
 * 안 끝난다. 절차는 화면 도움말에 있다.
 *
 * 채움 막대는 게이지가 아니라 **어느 칸이 비었는지 한눈에 보이게** 하는 장치다.
 * 색만으로 말하지 않는다 — 수치를 옆에 함께 적는다(색맹 대응).
 */
function KidSourceSection({ panel }: { panel: KidSourcePanel }) {
  const inv = panel.inventory
  return (
    <section aria-label="초·중 원문 재고" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        초·중 원문 재고
        {inv ? (
          <span className="ml-2 font-body text-[13px] font-[500] tabular-nums text-[var(--t2)]">
            {inv.total.toLocaleString()} / {KID_SOURCE_TARGET.total.toLocaleString()} ({inv.pct}%)
          </span>
        ) : null}
      </h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        목표는 고등 재고 {KID_SOURCE_TARGET.highSchoolStock.toLocaleString()}편의 절반이다. “게시 가능” 은
        적재분에서 <b>격리가 확정된 것만</b> 뺀 수 — 아직 판정 안 받은 행은 격리가 아니다.
      </p>

      {panel.error ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--bg)] p-4 font-body text-[13px] text-[var(--error-ink)]"
        >
          {panel.error}
        </p>
      ) : null}

      {inv ? (
        <ul className="flex flex-col gap-1">
          {inv.bands.map((r) => {
            const fill = Math.min(100, Math.round((100 * r.publishable) / KID_SOURCE_TARGET.quotaPerBand))
            return (
              <li
                key={r.band}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[13px]"
              >
                <span className="w-[68px] font-[700] text-[var(--t1)]">{r.band}</span>
                <span
                  aria-hidden
                  className="h-[6px] w-[120px] overflow-hidden rounded-[var(--r-sm)] bg-[var(--bd)]"
                >
                  <span
                    className="block h-full rounded-[var(--r-sm)]"
                    style={{
                      width: `${fill}%`,
                      background: r.quotaLeft ? 'var(--warning-ink)' : 'var(--success-ink)',
                    }}
                  />
                </span>
                <span className="tabular-nums text-[var(--t1)]">
                  {r.publishable.toLocaleString()}
                  <span className="text-[var(--t3)]"> / {KID_SOURCE_TARGET.quotaPerBand.toLocaleString()}</span>
                </span>
                <span className="tabular-nums text-[var(--t3)]">적재 {r.held.toLocaleString()}</span>
                <span className="tabular-nums text-[var(--t3)]">격리 {r.quarantinedPct}%</span>
                <span className="ml-auto tabular-nums text-[var(--t2)]">
                  {r.quotaLeft ? `남은 몫 ${r.quotaLeft.toLocaleString()}` : '몫 참'}
                </span>
              </li>
            )
          })}
          <li className="flex flex-wrap items-baseline gap-x-3 rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] px-3 py-2 font-body text-[13px]">
            <span className="w-[68px] font-[700] text-[var(--t1)]">각색</span>
            <span className="tabular-nums text-[var(--t1)]">{inv.adapted.publishable.toLocaleString()}</span>
            <span className="text-[var(--t3)]">칸이 아니라 별도 경로다 — 우리가 다시 쓴 글</span>
          </li>
        </ul>
      ) : null}
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
      <span className="font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">{value}</span>
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
