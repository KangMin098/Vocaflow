// apps/web/src/lib/csat/diagnosis/labels.ts
//
// 코드(A4 · C4 · time_collapse) ↔ 이름. 학습자 화면은 `learner*` 만 쓰고 코드를 드러내지 않는다.
// 관리자 화면은 코드와 이름을 함께 보여 준다.

import type { AttributeCode, HabitFlag, TrapFamily } from './engine/types'

export const ATTRIBUTE_NAME: Record<AttributeCode, { admin: string; learner: string }> = {
  A1: { admin: '어휘', learner: '단어 뜻 파악' },
  A2: { admin: '구문', learner: '문장 구조 읽기' },
  A3: { admin: '논리흐름', learner: '글의 흐름 따라가기' },
  A4: { admin: '재진술', learner: '같은 말 바꿔 말하기 알아보기' },
  A5: { admin: '근거판단', learner: '본문에서 근거 찾기' },
  A6: { admin: '배경지식', learner: '낯선 소재 버티기' },
  A7: { admin: '듣기', learner: '듣기' },
  A8: { admin: '어법', learner: '어법' },
  A9: { admin: '속도', learner: '긴 글을 시간 안에 읽기' },
}

export const TRAP_FAMILY_NAME: Record<TrapFamily, { admin: string; learner: string }> = {
  C1: { admin: '단어 재활용', learner: '본문 단어를 그대로 가져온 선지에 끌려요' },
  C2: { admin: '핵심 아님', learner: '맞는 말이지만 핵심이 아닌 선지를 골라요' },
  C3: { admin: '부분→전체', learner: '일부만 맞는 선지를 전체로 받아들여요' },
  C4: { admin: '인과 전도', learner: '원인과 결과를 뒤집은 선지에 끌려요' },
  C5: { admin: '대상·범위·강도 변형', learner: '대상이나 범위를 슬쩍 바꾼 선지를 놓쳐요' },
  C6: { admin: '방향 반대', learner: '본문과 반대로 말하는 선지를 골라요' },
  C7: { admin: '상식 개입', learner: '본문 대신 상식으로 판단해요' },
  C8: { admin: '비유 선지', learner: '비유적 표현을 글자 그대로 읽어요' },
  C9: { admin: '글 구조 단서', learner: '지시어·연결어 같은 글 구조 단서를 놓쳐요' },
}

export const HABIT_TEXT: Record<HabitFlag['code'], { admin: string; learner: string }> = {
  time_collapse: { admin: '시간 붕괴(41~45 오답 집중 · timeout)', learner: '마지막 장문(41~45번)에서 오답이 몰려요. 시간이 부족한 것 같아요.' },
  guessing: { admin: '추측 풀이(guess 비율 · 쉬운 문항 오답)', learner: '찍은 문항이 많거나, 쉬운 문항에서 실수가 나와요.' },
  word_reuse: { admin: '단어 재활용 편중(오답 중 C1 비율)', learner: '틀린 문제의 상당수가 본문 단어를 그대로 쓴 선지예요.' },
  cutline_90: { admin: '90점 커트라인(최근 live 3회 86~93)', learner: '1등급 경계(90점) 근처에서 계속 머물러 있어요.' },
  ebs: { admin: 'EBS 의존(연계−비연계 정답률 ≥ 20%p)', learner: 'EBS 연계 지문과 아닌 지문의 정답률 차이가 커요.' },
  listening: { admin: '듣기 소홀(1~17 오답 2+ 연속)', learner: '듣기에서 두 번 이상 연속으로 2문항 넘게 틀렸어요.' },
}

export const CONFIDENCE_LABEL = { high: '높음', medium: '보통', low: '낮음' } as const

export const GOAL_LABEL: Record<string, string> = {
  susi_min: '수시 최저',
  jeongsi: '정시',
  naesin: '내신 병행',
  keep: '등급 유지',
}

export const GRADE_LEVEL_LABEL: Record<string, string> = {
  h1: '고1',
  h2: '고2',
  h3: '고3',
  n_su: 'N수',
  adult: '성인',
}

/** 배경 질문 5개 — 탭으로 고르는 짧은 선택지 */
export const BACKGROUND_QUESTIONS: { key: string; q: string; options: { value: string; label: string }[] }[] = [
  { key: 'start', q: '영어 공부는 주로 어떻게 해 왔나요?', options: [
    { value: 'school', label: '학교 수업 위주' }, { value: 'academy', label: '학원' }, { value: 'self', label: '혼자' }, { value: 'abroad', label: '해외 경험' } ] },
  { key: 'vocab', q: '단어 공부는 꾸준히 하나요?', options: [
    { value: 'daily', label: '매일' }, { value: 'weekly', label: '가끔' }, { value: 'rarely', label: '거의 안 함' } ] },
  { key: 'reading', q: '긴 영어 글을 읽는 게 어떤가요?', options: [
    { value: 'easy', label: '편해요' }, { value: 'ok', label: '보통' }, { value: 'hard', label: '힘들어요' } ] },
  { key: 'listening', q: '듣기는 어떤가요?', options: [
    { value: 'easy', label: '거의 안 틀려요' }, { value: 'ok', label: '가끔 틀려요' }, { value: 'hard', label: '자주 틀려요' } ] },
  { key: 'time', q: '모의고사에서 시간은 어떤가요?', options: [
    { value: 'enough', label: '남아요' }, { value: 'tight', label: '빠듯해요' }, { value: 'short', label: '모자라요' } ] },
]

export function lineText(code: string): { title: string; why: string } {
  const [kind, ref] = code.split(':')
  if (kind === 'ATTR' && ref in ATTRIBUTE_NAME) {
    const n = ATTRIBUTE_NAME[ref as AttributeCode].learner
    return { title: `${n} 연습`, why: `${n}이(가) 다른 역량보다 약하게 나왔어요.` }
  }
  if (kind === 'TRAP' && ref in TRAP_FAMILY_NAME) {
    return { title: `「${TRAP_FAMILY_NAME[ref as TrapFamily].admin}」 함정 감별`, why: TRAP_FAMILY_NAME[ref as TrapFamily].learner }
  }
  if (kind === 'HABIT' && ref in HABIT_TEXT) {
    return { title: '풀이 습관 점검', why: HABIT_TEXT[ref as HabitFlag['code']].learner }
  }
  return { title: code, why: '' }
}
