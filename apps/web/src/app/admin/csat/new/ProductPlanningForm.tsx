// apps/web/src/app/admin/csat/new/ProductPlanningForm.tsx
'use client'

import { useRef, useState } from 'react'

const grades = [
  ['elementary_5', '초5'], ['elementary_6', '초6'], ['middle_1', '중1'], ['middle_2', '중2'],
  ['middle_3', '중3'], ['high_1', '고1'], ['high_2', '고2'], ['high_3', '고3'],
] as const
const purposes = [
  ['knowledge_reading', '지식 독해'], ['relation_reading', '관계 독해'],
  ['vocabulary_in_context', '문맥 어휘'], ['academic_sentence', '학술 문장'],
  ['inference', '추론'], ['exam_bridge', '시험 연결'],
] as const
const domains = [['science', '과학'], ['social', '사회'], ['history', '역사'], ['culture', '문화']] as const
const genres = [['explanation', '설명'], ['argument', '논설'], ['narrative', '서사']] as const

type Unit = {
  day: number; chapter: number; primary_skill: string; domain: string; genre: string
  difficulty_level: number; passage_words_target: number; item_type_target: string
  revisit_prior_skill: boolean; cumulative_review: boolean
}
type PlanningResult = {
  plan_hash: string
  plan: { product_family: string; production_capability: string; units: Unit[];
    chapters: { chapter: number; from_day: number; to_day: number }[] }
}

export function ProductPlanningForm() {
  const requestGeneration = useRef(0)
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['middle_2'])
  const [purpose, setPurpose] = useState('relation_reading')
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['science', 'social'])
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['explanation'])
  const [days, setDays] = useState(20)
  const [unitsPerChapter, setUnitsPerChapter] = useState(5)
  const [startLevel, setStartLevel] = useState(3)
  const [endLevel, setEndLevel] = useState(6)
  const [startWords, setStartWords] = useState(180)
  const [endWords, setEndWords] = useState(260)
  const [sourceStrategy, setSourceStrategy] = useState('balanced')
  const [result, setResult] = useState<PlanningResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function invalidatePlan() {
    requestGeneration.current += 1
    setResult(null)
  }

  function toggle(value: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter(entry => entry !== value) : [...current, value])
    invalidatePlan()
  }

  async function plan() {
    invalidatePlan()
    const generation = requestGeneration.current
    setError(null)
    const ordered = grades.map(([grade]) => grade).filter(grade => selectedGrades.includes(grade))
    const positions = ordered.map(grade => grades.findIndex(([value]) => value === grade))
    const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1]! + 1)
    const mode = ordered.length === 1 ? 'single_grade' : contiguous ? 'grade_range' : 'multi_grade'
    const weights = (items: string[]) => Object.fromEntries(items.map(item => [item, 1]))
    const brief = {
      schema: 'textbook-product-brief/1', grade_scope: { mode, grades: ordered }, purpose,
      domain_weights: weights(selectedDomains), genre_weights: weights(selectedGenres),
      duration_days: days, units_per_chapter: unitsPerChapter,
      difficulty: { start: startLevel, end: endLevel },
      passage_words: { start: startWords, end: endWords }, source_strategy: sourceStrategy,
    }
    setPending(true)
    try {
      const response = await fetch('/api/admin/csat/product-plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(brief),
      })
      if (!response.ok) {
        if (generation === requestGeneration.current) setError('기획 조건이 유효하지 않습니다. 학년·난도·기간을 확인하세요.')
        return
      }
      const next = await response.json() as PlanningResult
      if (generation === requestGeneration.current) setResult(next)
    } catch { if (generation === requestGeneration.current) setError('기획 요청을 완료하지 못했습니다. 연결 상태를 확인하세요.') }
    finally { setPending(false) }
  }

  const numberField = (label: string, value: number, set: (value: number) => void, min: number, max: number) =>
    <label className="flex min-h-[44px] items-center justify-between gap-3 text-[13px] text-[var(--t2)]">
      {label}<input type="number" min={min} max={max} value={value} onChange={event => {
        set(Number(event.target.value)); invalidatePlan()
      }} className="min-h-[44px] w-20 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-right text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" />
    </label>

  return <section aria-labelledby="product-planning" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
    <h2 id="product-planning" className="font-display text-[16px] font-[800] text-[var(--t1)]">교재 기획</h2>
    <p className="mt-2 break-keep text-[13px] text-[var(--t2)]">학년·목적·영역·분량을 정하면 제품 유형, 단원별 능력·난도·길이와 복습 위치를 설계합니다. 기획안은 주문 등록이나 콘텐츠 생산을 실행하지 않습니다.</p>
    <fieldset className="mt-4"><legend className="font-[700] text-[13px] text-[var(--t1)]">대상 학년</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{grades.map(([value, label]) =>
        <button key={value} type="button" aria-pressed={selectedGrades.includes(value)} onClick={() => toggle(value, selectedGrades, setSelectedGrades)}
          className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-3 text-[13px] text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)]">{label}</button>)}</div></fieldset>
    <label className="mt-3 block text-[13px] font-[700] text-[var(--t1)]">교재 목적
      <select value={purpose} onChange={event => { setPurpose(event.target.value); invalidatePlan() }} className="mt-1 block min-h-[44px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
        {purposes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <fieldset><legend className="text-[13px] font-[700] text-[var(--t1)]">영역 배합</legend>{domains.map(([value, label]) =>
        <button key={value} type="button" aria-pressed={selectedDomains.includes(value)} onClick={() => toggle(value, selectedDomains, setSelectedDomains)}
          className="mr-2 min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-3 text-[13px] text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)]">{label}</button>)}</fieldset>
      <fieldset><legend className="text-[13px] font-[700] text-[var(--t1)]">글 유형</legend>{genres.map(([value, label]) =>
        <button key={value} type="button" aria-pressed={selectedGenres.includes(value)} onClick={() => toggle(value, selectedGenres, setSelectedGenres)}
          className="mr-2 min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-3 text-[13px] text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)]">{label}</button>)}</fieldset>
    </div>
    <div className="mt-3 grid gap-x-6 lg:grid-cols-3">
      {numberField('학습일', days, setDays, 1, 180)}
      {numberField('장당 단원', unitsPerChapter, setUnitsPerChapter, 1, 20)}
      {numberField('시작 난도', startLevel, setStartLevel, 0, 11)}
      {numberField('끝 난도', endLevel, setEndLevel, 0, 11)}
      {numberField('시작 어휘 수', startWords, setStartWords, 40, 1200)}
      {numberField('끝 어휘 수', endWords, setEndWords, 40, 1200)}
    </div>
    <label className="mt-3 block text-[13px] font-[700] text-[var(--t1)]">원천 사용 계획
      <select value={sourceStrategy} onChange={event => { setSourceStrategy(event.target.value); invalidatePlan() }} className="mt-1 block min-h-[44px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
        <option value="balanced">직접 사용·각색 균형</option><option value="direct_first">직접 사용 우선</option><option value="adaptation_first">각색 우선</option>
      </select></label>
    <button type="button" disabled={pending || !selectedGrades.length || !selectedDomains.length || !selectedGenres.length} onClick={() => void plan()}
      className="mt-4 min-h-[44px] rounded-[var(--r-sm)] border border-[var(--p)] px-4 text-[13px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50">
      {pending ? '설계 중…' : '기획안 만들기'}
    </button>
    {error ? <p role="alert" className="mt-3 break-keep text-[13px] text-[var(--memory-risk)]">{error}</p> : null}
    {result ? <div role="status" className="mt-4 text-[13px] text-[var(--t2)]">
      <p>제품 {result.plan.product_family} · 계약 상태 {result.plan.production_capability} · {result.plan.units.length}단원 · {result.plan.chapters.length}장</p>
      <p className="break-all font-mono text-[11px]">기획 hash {result.plan_hash}</p>
      <p className="mt-2 break-keep">원천·권리·benchmark·승인 증거는 별도로 확인해야 합니다. 이 기획안만으로 생산할 수는 없습니다.</p>
      <div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-[12px]"><thead><tr><th>일</th><th>장</th><th>능력</th><th>영역</th><th>글</th><th>난도</th><th>길이</th><th>문항</th><th>복습</th></tr></thead><tbody>
        {result.plan.units.map(unit => <tr key={unit.day} className="border-t border-[var(--bd)]"><td>{unit.day}</td><td>{unit.chapter}</td><td>{unit.primary_skill}</td><td>{unit.domain}</td><td>{unit.genre}</td><td>{unit.difficulty_level}</td><td>{unit.passage_words_target}</td><td>{unit.item_type_target}</td><td>{unit.cumulative_review ? '종합' : unit.revisit_prior_skill ? '재방문' : '—'}</td></tr>)}
      </tbody></table></div>
    </div> : null}
  </section>
}
