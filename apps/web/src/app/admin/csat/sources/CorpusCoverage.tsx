// apps/web/src/app/admin/csat/sources/CorpusCoverage.tsx
// G2 환경 변형: 학생 수준을 고르면 실측 원문이 채우는 주제 칸과 출처 편중이 변한다.
// 서명은 비어 있는 읽기 사정권. 원문×주제 자산 없이 이 빈칸과 분포는 성립하지 않는다.
'use client'

import { useRef, useState } from 'react'
import {
  DEFAULT_COVERAGE_FILTERS,
  coverageOptions,
  selectCorpusCoverage,
  type CorpusCoverageData,
  type CoverageFilters,
  type SourceDiscoveryProfiles,
} from '@/lib/textbook/corpus-coverage'
import styles from './corpus-coverage.module.css'

const number = (n: number | null) => (n === null ? '미측정' : n.toLocaleString('ko-KR'))
const labels: Record<keyof CoverageFilters, string> = {
  cefr: '영어 수준 · CEFR',
  topic: '주제 · 키워드 추정',
  format: '글 형식 · 저장 라벨',
  school: '학령 · 공급 의도',
}
const date = (value: string) => value.slice(0, 19).replace('T', ' ') + ' UTC'

export function CorpusCoverage({
  data,
  profiles,
  onSource,
}: {
  data?: CorpusCoverageData
  profiles?: SourceDiscoveryProfiles
  onSource: (source: string, button: HTMLButtonElement) => void
}) {
  const [filters, setFilters] = useState(DEFAULT_COVERAGE_FILTERS)
  const sourceTrigger = useRef<HTMLButtonElement | null>(null)
  const [showAllSources, setShowAllSources] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  if (!data)
    return (
      <div className={styles.root}>
        <p>코퍼스 분포 스냅샷을 아직 준비하지 못했습니다.</p>
        <p>원천 관리에서 원문과 판정 상태를 확인하세요.</p>
      </div>
    )
  const result = selectCorpusCoverage(data, filters)
  const visibleProviders = showAllSources
    ? result.providers
    : result.providers.filter((row) => row.usable > 0 || (row.conditional ?? 0) > 0)
  const candidates = [...(profiles?.candidates ?? [])].sort(
    (a, b) => Number(b.topics.includes(filters.topic)) - Number(a.topics.includes(filters.topic))
  )
  const selected = data.sources.find((source) => source.source === selectedSource)
  const profile = profiles?.existing.find((source) => source.source === selectedSource)
  const samples = data.samples.filter(
    (sample) =>
      (!selectedSource || sample.source === selectedSource) &&
      (filters.cefr === 'all' || sample.cefr === filters.cefr) &&
      (filters.topic === 'all' || sample.topic === filters.topic) &&
      (filters.format === 'all' || sample.register === filters.format)
  )
  return (
    <div className={styles.root}>
      <header className={styles.intro}>
        <h3>학생의 읽기 범위에 어떤 주제가 비어 있나요?</h3>
        <p>
          사용 가능 원문에서 주제를 다시 추정한 결과입니다. 수준과 학령을 골라 원천별 공급을
          확인하세요.
        </p>
        <p className={styles.snapshot}>
          고정 스냅샷 · 재고 {date(data.measuredAt)} · 주제 {date(data.topicsMeasuredAt)}. 실시간
          집계가 아닙니다.
        </p>
      </header>
      <div className={styles.filters}>
        {(Object.keys(labels) as (keyof CoverageFilters)[]).map((key) => (
          <label key={key}>
            {labels[key]}
            <select
              value={filters[key]}
              onChange={(event) => {
                setFilters({ ...filters, [key]: event.target.value })
                setSelectedSource(null)
              }}
            >
              <option value="all">전체</option>
              {coverageOptions(data, key).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className={styles.caveat}>
        학령은 공급 의도이며 연령 적합성은 미검증입니다. 글 형식에는 수집 시 기본값이 섞여 있습니다.
        문항 유형 적합성은 미측정입니다.
      </p>
      <div className={styles.result} role="status" aria-live="polite">
        <p>
          <strong>{number(result.total)}</strong>편 사용 가능{' '}
          <span>
            조건부 발췌 {number(result.conditional)}
            {result.conditional === null ? '' : '편'}
          </span>
        </p>
        <p>
          {result.concentration === null
            ? '선택한 범위에 사용 가능 원문이 없습니다.'
            : `사용 가능 원문의 ${result.concentration.toFixed(1)}%가 ${result.providers[0].label}에 있습니다.`}
        </p>
      </div>
      {filters.topic !== 'all' ? (
        <p className={styles.caveat}>
          조건부 발췌에는 같은 방식의 주제 재측정이 없어 주제별 교집합을 계산하지 않습니다.
        </p>
      ) : null}
      <section aria-label="주제별 사용 가능 원문" className={styles.topicSection}>
        <p>
          주제 칸을 선택하면 해당 원천으로 좁혀집니다. 0은 이 스냅샷·선택 범위의 실측 공백입니다.
          분류불가는 주제가 없는 글이라는 뜻이 아닙니다.
        </p>
        <div className={styles.topics}>
          {result.topics.map((row) => (
            <button
              key={row.topic}
              aria-pressed={filters.topic === row.topic}
              data-empty={row.count === 0}
              onClick={() => {
                setFilters({ ...filters, topic: filters.topic === row.topic ? 'all' : row.topic })
                setSelectedSource(null)
              }}
            >
              <span>{row.topic}</span>
              <strong>
                {number(row.count)}
                <small>편</small>
              </strong>
              {row.count === 0 ? <small>이 범위에 없음</small> : null}
            </button>
          ))}
        </div>
      </section>
      <div className={styles.tableWrap}>
        <table>
          <caption>선택 범위의 원천별 원문 · 출처를 선택하면 검토 근거를 엽니다</caption>
          <thead>
            <tr>
              <th scope="col">원천</th>
              <th scope="col">사용 가능</th>
              <th scope="col">조건부 발췌</th>
            </tr>
          </thead>
          <tbody>
            {visibleProviders.map((row) => (
              <tr key={row.source} data-selected={selectedSource === row.source}>
                <th scope="row">
                  <button
                    onClick={(event) => {
                      sourceTrigger.current = event.currentTarget
                      setSelectedSource(row.source)
                      requestAnimationFrame(() =>
                        document.getElementById('coverage-source-title')?.focus()
                      )
                    }}
                    aria-expanded={selectedSource === row.source}
                    aria-controls="coverage-source-detail"
                  >
                    {row.label}
                  </button>
                </th>
                <td>{number(row.usable)}</td>
                <td>{number(row.conditional)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className={styles.linkButton} onClick={() => setShowAllSources(!showAllSources)}>
        {showAllSources
          ? '선택 범위에 원문이 있는 원천만 보기'
          : `원천 ${data.sources.length}종 모두 보기`}
      </button>
      {selected ? (
        <section
          id="coverage-source-detail"
          className={styles.inspector}
          aria-label={`${selected.label} 검토 근거`}
        >
          <div className={styles.detailHeading}>
            <h4 id="coverage-source-title" tabIndex={-1}>
              {selected.label}
            </h4>
            <button
              onClick={() => {
                setSelectedSource(null)
                requestAnimationFrame(() => sourceTrigger.current?.focus())
              }}
            >
              근거 닫기
            </button>
          </div>
          <p>
            {profile?.reason ??
              '이 원천의 역할·수집 권리·수집 건강 상태를 검토한 프로필이 아직 없습니다.'}
          </p>
          <button
            className={styles.linkButton}
            onClick={(event) => onSource(selected.source, event.currentTarget)}
          >
            원천 관리에서 검수하기 →
          </button>
          <details>
            <summary>역할 추천·권리·수집 건강 근거</summary>
            <dl>
              <dt>추천 역할</dt>
              <dd>
                {profile ? `${profile.role} · ${profile.decision}` : '미검증'} — 자동 수집 설정을
                변경하지 않습니다.
              </dd>
              <dt>활용할 범위</dt>
              <dd>{profile?.recommendedUse.join(' · ') || '미검증'}</dd>
              <dt>피할 범위</dt>
              <dd>{profile?.avoidFor.join(' · ') || '미검증'}</dd>
              <dt>강점</dt>
              <dd>{profile?.strengths.join(' · ') || '미검증'}</dd>
              <dt>한계</dt>
              <dd>{profile?.weaknesses.join(' · ') || '미검증'}</dd>
              <dt>등록된 라이선스 분류</dt>
              <dd>{selected.license ?? '미등록'} · 개별 원문의 권리 확인을 대신하지 않습니다.</dd>
              <dt>마지막 수집 시각</dt>
              <dd>
                {selected.lastFetch ? date(selected.lastFetch) : '미측정'} · 시각 없는 원문{' '}
                {number(selected.missingFetchTime)}편
              </dd>
              <dt>수집 건강</dt>
              <dd>실패율·응답 시간 미측정</dd>
            </dl>
            {profile?.evidenceUrls.map((url) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  공식 근거: {new URL(url).hostname}
                </a>
              </p>
            ))}
          </details>
          <details>
            <summary>사용 가능 원문 표본 {samples.length}편</summary>
            <p>
              표본은 전체 목록이 아닙니다. 학령별 표본 연결은 미측정입니다. 아래 링크는 적격 판정
              화면을 열며 해당 ID를 자동 선택하지 않습니다.
            </p>
            {samples.slice(0, 6).map((sample) => (
              <p key={sample.id}>
                <a href="/admin/csat/sources?view=eligibility">
                  <span className={styles.sampleTitle}>{sample.title}</span> · 적격 판정 열기
                </a>
                <small className={styles.sampleId}>원문 ID {sample.id}</small>
              </p>
            ))}
            {!samples.length ? (
              <p>이 선택 범위에 보관된 표본이 없습니다. 원천 관리에서 원문을 확인하세요.</p>
            ) : null}
          </details>
        </section>
      ) : null}
      <details className={styles.candidates}>
        <summary>
          새 원천 후보와 검토 상태 {profiles ? `· ${profiles.candidates.length}종` : '· 미검증'}
        </summary>
        <p>
          후보와 역할은 운영 검토를 위한 추천입니다. 이 화면에서 자동 수집을 활성화하지 않습니다.
        </p>
        {candidates.map((candidate) => (
          <details key={candidate.source}>
            <summary>
              {filters.topic !== 'all' && candidate.topics.includes(filters.topic)
                ? '선택 주제 관련 · '
                : ''}
              {candidate.label} · {candidate.tier} · {candidate.role}
            </summary>
            <p>{candidate.reason}</p>
            <p>주제: {candidate.topics.join(' · ')}</p>
            <p>접근 확인: {candidate.accessStatus}</p>
            <p>권리: {candidate.licenseSummary}</p>
            <p>
              {candidate.pilot
                ? `표본 시도 ${candidate.pilot.attempted} · 추출 ${candidate.pilot.extracted} · 사용 가능 ${number(candidate.pilot.usable)} · 제외 ${number(candidate.pilot.rejected)}`
                : '표본 수집·적격 판정 미측정'}
            </p>
            {candidate.evidenceUrls.map((url) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  공식 근거: {new URL(url).hostname}
                </a>
              </p>
            ))}
          </details>
        ))}
      </details>
    </div>
  )
}
