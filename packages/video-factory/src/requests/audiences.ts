// packages/video-factory/src/requests/audiences.ts
//
// **목적 × 수요자별 니즈 정의 — 기획의 출발점.**
//
// 화면(요청 폼)과 드레인(설계자 에이전트)이 **같은 정의**를 읽는다. 둘이 따로 적으면
// 관리자가 본 니즈와 스크립트가 겨냥한 니즈가 갈린다.
//
// 여기 적힌 것은 **수치가 아니라 질문**이다. 효과·성과를 말하지 않는다 — 그건 원료(DB 실측)만 말한다.

import type { RequestAudience, RequestPurpose } from './types'

export interface AudienceNeed {
  /** 이 사람이 원하는 결과 */
  wants: string
  /** 첫 몇 초에 짚을 수 있는 문제 */
  pain: string
  /** 행동을 망설이게 하는 것 — 스크립트가 풀어야 할 의심 */
  doubt: string
  /** 영상 끝에서 권할 다음 행동의 모양 */
  nextStep: string
}

export const PURPOSE_LABEL: Record<RequestPurpose, string> = {
  learn: '학습',
  buy: '구매',
}

export const AUDIENCE_LABEL: Record<RequestAudience, string> = {
  student: '학생',
  parent: '학부모',
  teacher: '교사',
  adult: '성인 학습자',
}

export const NEEDS: Record<RequestPurpose, Record<RequestAudience, AudienceNeed>> = {
  learn: {
    student: {
      wants: '지금 푸는 지문을 막힘 없이 읽고 싶다',
      pain: '단어는 외웠는데 지문에서 또 모르는 말이 나온다',
      doubt: '또 외울 것만 늘어나는 건 아닐까',
      nextStep: '지금 수준의 지문 하나를 바로 열어 본다',
    },
    parent: {
      wants: '아이가 무엇을 얼마나 하고 있는지 알고 싶다',
      pain: '공부했다는데 무엇이 남았는지 보이지 않는다',
      doubt: '또 하나의 앱으로 끝나지 않을까',
      nextStep: '아이의 진행 화면을 함께 본다',
    },
    teacher: {
      wants: '반 전체에 같은 수준의 과제를 빠르게 내고 싶다',
      pain: '학생마다 모르는 단어가 달라 수업 자료가 맞지 않는다',
      doubt: '준비 시간이 더 늘지 않을까',
      nextStep: '학급에 과제 하나를 걸어 본다',
    },
    adult: {
      wants: '짧은 시간에 읽기 실력을 되살리고 싶다',
      pain: '예전에 외운 단어가 떠오르지 않는다',
      doubt: '매일 할 시간이 없다',
      nextStep: '오늘 복습할 낱말만 먼저 본다',
    },
  },
  buy: {
    student: {
      wants: '내 수준에 맞는 교재를 고르고 싶다',
      pain: '교재가 너무 쉽거나 너무 어렵다',
      doubt: '지금 쓰는 교재와 뭐가 다른가',
      nextStep: '내 단계의 권을 열어 목차를 본다',
    },
    parent: {
      wants: '돈을 쓸 만한 교재인지 확인하고 싶다',
      pain: '교재를 사도 끝까지 쓰는 경우가 드물다',
      doubt: '들인 만큼 쓰일까',
      nextStep: '무료로 한 권의 첫 장을 풀어 본다',
    },
    teacher: {
      wants: '수업에 바로 쓸 수 있는 문항 묶음이 필요하다',
      pain: '유형별 문항을 모으는 데 시간이 든다',
      doubt: '평가원 유형과 맞는가',
      nextStep: '유형별 보기로 문항을 훑어본다',
    },
    adult: {
      wants: '다시 시작할 교재를 하나 고르고 싶다',
      pain: '어디서부터 다시 해야 할지 모르겠다',
      doubt: '내 수준을 모르는데 고를 수 있을까',
      nextStep: '수준 확인부터 해 본다',
    },
  },
}

/** 목적 → 자막 읽기 속도 기준(`spec/timing.ts` 의 Audience). 구매 영상은 광고 속도로 잰다. */
export function timingAudience(purpose: RequestPurpose): 'learner' | 'ad' {
  return purpose === 'buy' ? 'ad' : 'learner'
}
