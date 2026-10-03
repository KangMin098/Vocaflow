// scripts/csat/lib-scoped-type-reports.mjs
import { parseExamId, examIdOf } from './lib-exam-id.mjs'

// Type procedures follow analysis-drain/_PROMPT.md §1-c. Counts come only from DB rows.
const MAIN = ['선지의 대상·범위·평가 방향을 분리한다', '통념과 필자의 주장을 전환 표지와 주어·술어로 구별한다', '사례를 일반화한 주장이 앞뒤 근거와 함께 성립하는지 확인한다', '주장과 대상·방향이 모두 맞는 선지를 고르고 소재 낱말만 겹치는 선지를 지운다']
const FACT = ['발문에서 일치와 불일치 중 요구하는 판단을 고정한다', '선지마다 주체·행위·시점·수량·조건을 나눈다', '각 선지의 해당 정보를 지문에서 찾아 한 성분씩 대조한다', '모든 성분이 맞는 진술과 하나라도 바뀐 진술을 구별해 발문의 요구에 맞춘다']
const ORDER = ['각 덩어리의 처음과 끝에서 인물·대상·사건을 표시한다', '지시어·정관사·연결사가 요구하는 선행 정보를 찾는다', '모든 이음매에서 앞 덩어리 끝과 뒤 덩어리 첫머리의 대응을 확인한다', '선택한 순서에서 사건의 전제와 귀결이 뒤집히지 않는지 검산한다']
const VOCAB = ['밑줄을 포함한 절의 주어·술어·조건을 표시한다', '직유·이유·대조·예시가 해당 낱말의 평가 방향을 어떻게 한정하는지 찾는다', '각 밑줄을 그 방향과 대조하고 사전 뜻이 자연스럽다는 이유만으로 통과시키지 않는다', '어긋난 낱말의 반대 방향을 넣었을 때 앞뒤 근거가 동시에 맞는지 검산한다']
const REFER = ['등장인물과 화자를 구별해 표시한다', '각 밑줄에서 직전 절의 주어·소유격의 임자·인용 화자를 확인한다', '가장 가까운 이름과 문법적으로 지칭하는 대상을 구별한다', '각 밑줄의 대상을 나란히 적어 넷과 다른 하나를 확인한다']
const SUMMARY = ['요약문의 두 칸이 표현하는 관계와 평가 방향을 나눈다', '각 칸을 뒷받침하는 근거를 따로 찾는다', '한 칸만 맞는 선지도 남기고 다른 칸을 독립적으로 대조한다', '두 칸을 모두 채웠을 때 원문의 관계가 유지되는 선지를 고른다']
const PROCEDURES = {
  'R-PURPOSE': ['발신자·수신자와 요구 또는 통보 대상을 확인한다', '요청·감사·항의·통보 동사와 그 목적어를 따로 표시한다', '배경 설명과 상대에게 실제로 원하는 행동을 구별한다', '선지의 화행과 대상이 둘 다 편지의 요구와 일치하는지 대조한다'],
  'R-MOOD': ['초반과 후반의 감정어·신체 반응·행동을 따로 표시한다', '상황이나 반응이 달라지는 사건을 전환점으로 잡는다', '선지의 앞 심경과 뒤 심경을 각각 지문의 묘사와 대조한다', '한쪽 심경만 맞는 선지를 지우고 두 시점이 모두 맞는 쌍을 고른다'],
  'R-INSERT': ['주어진 문장의 연결사·지시어·전제 표현을 표시한다', '그 문장 앞에 필요한 정보가 실제로 있는 위치를 찾는다', '후보 위치의 뒤 문장이 주어진 문장으로부터 무엇을 받는지 확인한다', '앞쪽 전제와 뒤쪽 지칭을 동시에 만족하는 위치를 남긴다'],
  'R-IRRELEVANT': ['앞 문장이 제시한 화제와 관계를 표시한다', '각 표시 문장이 그 관계를 설명하는지 다른 화제로 옮기는지 구별한다', '의심되는 문장을 뺐을 때 뒤 문장의 지시어가 앞 근거를 바로 받는지 확인한다', '내용의 참·거짓과 글의 전개에 필요한 역할을 구별해 검산한다'],
  'R-GRAMMAR': ['각 밑줄이 들어 있는 절의 정동사와 주어를 찾는다', '밑줄 형태를 지배하는 주어·목적어·수식 대상을 가까운 명사와 구별한다', '절의 완결성·수일치·능동과 수동·수식 관계를 각각 검사한다', '고친 형태가 해당 절의 구조를 완성하는지 검산한다'],
  'R-IMPLY': ['밑줄 표현이 들어 있는 문장의 주어·서술 대상을 확인한다', '앞뒤에서 그 표현을 예시하거나 반박하는 진술을 찾는다', '비유의 낱말 뜻과 글에서 맡는 역할을 구별한다', '근거가 요구하는 역할과 평가 방향을 모두 옮긴 선지를 고른다'],
  'R-BLANK': ['빈칸이 포함된 절의 주어·연결사·조건을 표시한다', '그 절을 예시·설명·대조하는 근거를 앞뒤에서 찾는다', '근거가 요구하는 대상·관계·평가 방향을 빈칸의 역할로 정리한다', '그 역할이 선지의 표현과 대응하는지 검사하고 빈칸에 넣어 앞뒤 관계를 검산한다'],
  'R-TITLE': MAIN, 'R-TOPIC': MAIN, 'R-GIST': MAIN, 'R-CLAIM': MAIN, 'X-TITLE': MAIN,
  'R-FACT': FACT, 'R-NOTICE': FACT, 'X-FACT': FACT,
  'R-ORDER': ORDER, 'X-ORDER': ORDER,
  'R-VOCAB': VOCAB, 'X-VOCAB': VOCAB,
  'R-REFER': REFER, 'X-REFER': REFER,
  'R-SUMMARY': SUMMARY, 'R-BLANK2': SUMMARY, 'X-BLANK2': SUMMARY,
}
PROCEDURES['X-BLANK'] = PROCEDURES['R-BLANK']

export function scopedTypeReports(items, analyses, now, knownScopes = []) {
  const itemOf = new Map(items.filter((i) => i.in_scope !== false && i.type_id && parseExamId(examIdOf(i.id))?.kind === 'hakpyeong').map((i) => [i.id, i]))
  const latest = new Map()
  for (const a of analyses) if (!latest.has(a.item_id) || a.version > latest.get(a.item_id).version) latest.set(a.item_id, a)
  const groups = new Map()
  for (const s of [...knownScopes, ...[...itemOf.values()].map((i) => ({ grade: parseExamId(examIdOf(i.id)).grade, type_id: i.type_id }))]) {
    if (![1, 2, 3].includes(s.grade) || !s.type_id) throw new Error('학평 리포트 범위는 학년 1~3과 유형 id가 필요하다')
    groups.set(`${s.grade}|${s.type_id}`, { grade: s.grade, type_id: s.type_id, analyses: [] })
  }
  for (const a of latest.values()) {
    const item = itemOf.get(a.item_id)
    if (!item || a.status !== 'published' || a.answer_unknown) continue
    const grade = parseExamId(examIdOf(item.id)).grade
    const key = `${grade}|${item.type_id}`
    if (!groups.has(key)) groups.set(key, { grade, type_id: item.type_id, analyses: [] })
    groups.get(key).analyses.push(a)
  }
  return [...groups.values()].sort((a, b) => a.grade - b.grade || a.type_id.localeCompare(b.type_id)).map((g) => {
    const traps = new Map()
    const loci = new Map()
    const times = []
    for (const a of g.analyses) {
      const n = new Set(a.answer_locus?.sentence_index ?? []).size
      loci.set(n, (loci.get(n) ?? 0) + 1)
      if (Number.isFinite(a.time_budget_sec) && a.time_budget_sec > 0) times.push(a.time_budget_sec)
      for (const c of a.choice_analysis ?? []) if (c.verdict === 'distractor' && c.trap?.trim()) traps.set(c.trap.trim(), (traps.get(c.trap.trim()) ?? 0) + 1)
    }
    const recurring = [...traps].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([trap, count]) => ({ trap, count }))
    times.sort((a, b) => a - b)
    const steps = PROCEDURES[g.type_id]
    if (!steps && g.analyses.length) throw new Error(`${g.type_id}: 근거가 있는 유형 절차를 먼저 정의해야 한다`)
    return {
      type_id: g.type_id, organizer: 'edu_office', grade: g.grade,
      n_analyzed: g.analyses.length, recurring_traps: recurring,
      answer_locus_pattern: `발행된 최신 분석 ${g.analyses.length}문항의 근거 단위 수: ${[...loci].sort((a, b) => a[0] - b[0]).map(([n, count]) => `${n}단위 ${count}문항`).join(' · ')}. 문항마다 다른 정본 목록의 번호이므로 번호 자체를 같은 위치로 일반화하지 않는다.`,
      procedure_steps: (steps ?? []).map((step) => ({ step })),
      failure_modes: [],
      time_budget_sec: times.length ? times[Math.floor(times.length / 2)] : null,
      open_questions: ['집계는 학년별 최신 발행 분석에 한정한다. 공통 절차는 _PROMPT.md §1-c의 유형별 근거 원리를 따른다. 실제 학생 오답률은 관측하지 않아 failure_modes와 정답률을 추정하지 않는다.', '함정 count는 오답 선지 수이며, 동일 문항의 다른 오답도 각각 센다.'],
      status: g.analyses.length ? 'published' : 'draft', updated_at: now,
    }
  })
}
