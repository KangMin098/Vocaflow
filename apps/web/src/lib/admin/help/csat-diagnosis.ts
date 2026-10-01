// apps/web/src/lib/admin/help/csat-diagnosis.ts
//
// 영어 진단(/admin/csat/diagnosis/*) 화면도움말. 화면을 바꾸면 같은 커밋에서 여기도 고친다.

import type { HelpRegistry } from './types'

export const CSAT_DIAGNOSIS_HELP: HelpRegistry = {
  'csat-diagnosis': {
    title: '영어 진단 — 현황',
    screen: {
      summary: '학습자 수, 최근 진단, 시험별 태깅 완료율을 즉석 조회로 보여 줘요. 학습자 진단(점수 흐름 · 약한 유형 · 끌린 오답 · 틀린 문항)은 태깅 없이 기록한 답과 문항 유형·선지 함정으로 바로 나와요 — 태깅은 이후 역량 진단을 위한 준비예요.',
      when: '진단 품질을 점검할 때, 학습자가 「진단이 이상하다」고 할 때.',
      steps: [
        { title: '태깅 완료율을 봐요', detail: '진단 반영이 꺼진 시험은 학습자가 입력해도 점수·등급만 반영돼요. 학습자가 많이 입력하는 시험부터 태깅을 끝내요.', done: '완료율 100% 인 시험은 「시험·태깅」에서 진단 반영을 켤 수 있어요.' },
      ],
      fields: [
        { label: '채점 가능한 시험', detail: '45문항 정답표(csat_dx_answer_key)가 있는 회차. 학습자 시험 기록 입력에 나오는 시험이 이것뿐이에요.' },
        { label: '진단 반영 시험', detail: 'diagnosis_ready 가 켜진 회차. 이 시험의 응답만 역량·함정·습관 진단에 들어가요.' },
      ],
      cautions: [
        '학평 104회는 원본 해설지에서 뽑은 45문항 정답표로 채점해요(scripts/csat/diagnosis/load-answer-keys.mjs --set hakpyeong). 원본 PDF 가 있는 PC 에서만 다시 만들 수 있어요.',
        '2014학년도 A·B형은 DB 문항이 23개뿐이라 정답표 대조를 통과하지 못해 빠졌어요(scripts/csat/diagnosis/load-answer-keys.mjs).',
      ],
      seeAlso: [
        { label: '시험·태깅', href: '/admin/csat/diagnosis/exams' },
        { label: '엔진 설정', href: '/admin/csat/diagnosis/settings' },
      ],
    },
  },
  'csat-diagnosis-exams': {
    title: '시험 · 태깅',
    screen: {
      summary: '시험별 공식 1등급 비율을 넣고, 태깅 진행을 보고, 진단 반영을 켜고 끄는 화면이에요.',
      steps: [
        { title: '시험을 눌러 태깅해요', detail: '문항마다 역량 가중치와 오답 선지 함정을 검수하고 「검수 저장」을 눌러요.', done: '검수 칸이 문항 수와 같아져요.' },
        { title: '공식 통계를 넣어요', detail: '1등급 비율은 0~1 사이 소수(6.12% → 0.0612)와 출처를 함께 적어요. 문항 오답률은 태깅 화면에서 문항마다 넣어요.' },
        { title: '진단 반영을 켜요', detail: '정답표 45문항이 있고 모든 문항이 검수됐을 때만 켜져요. 서버가 다시 확인해요.', done: '「켜짐」으로 바뀌어요. 그 뒤 입력되는 기록부터 상세 진단에 쓰여요.' },
      ],
      cautions: [
        '진단 반영을 켜도 이미 쌓인 스냅샷은 다시 계산되지 않아요. 학습자가 다음 기록을 넣을 때 전체가 다시 계산돼요.',
        '끄기는 언제든 돼요(되돌릴 수 있어요). 태깅이 틀린 걸 알았으면 먼저 끄고 고쳐요.',
      ],
    },
  },
  'csat-diagnosis-tagging': {
    title: '시험 태깅',
    screen: {
      summary: '문항별 역량 가중치(0 없음 · 1 보조 · 2 핵심), 오답 선지의 함정, 공식 오답률, EBS 연계를 검수하는 화면이에요.',
      steps: [
        { title: '미완료만 보기를 켜요', detail: '「다음 미완료로 이동」이 아직 검수 안 된 첫 문항으로 데려가요.' },
        { title: '가중치를 확인해요', detail: '처음 값은 유형별 기본값이에요. 문항이 실제로 요구하는 역량에 맞게 고쳐요.' },
        { title: '함정을 확인해요', detail: '처음 값은 발행된 분석의 라벨이에요. 계열(C1~C9)이 없는 라벨은 함정 진단에서 빠져요. 정답 선지는 비워져요.' },
        { title: '검수 저장', detail: '저장해야 검수 완료로 세요. 같은 값을 다시 저장해도 결과는 같아요(재실행 안전).', done: '카드 오른쪽 위에 검수 날짜가 찍혀요.' },
      ],
      fields: [
        { label: '유형 기본값 — 미검수', detail: '시드된 값만 있는 상태. 값이 있어도 완료율에 세지 않아요.' },
        { label: '공식 오답률', detail: '0~1. 비워 두면 그 시험의 다른 문항 평균으로 채우고, 시험 전체가 비면 난이도 보정을 하지 않아요.' },
        { label: 'EBS 연계', detail: '미확인은 「연계 아님」과 달라요. 미확인 문항은 EBS 의존 신호 계산에서 빠져요.' },
      ],
      cautions: ['함정을 「없음」으로 저장하면 분석에서 온 라벨이 지워져요(분석 원본 csat_item_analyses 는 그대로).'],
    },
  },
  'csat-diagnosis-learners': {
    title: '진단 학습자',
    screen: {
      summary: '진단 프로필을 남겼거나 기록을 입력한 학습자 목록과 최근 진단 요약이에요.',
    },
  },
  'csat-diagnosis-learner': {
    title: '학습자 상세',
    screen: {
      summary: '학습자가 보는 것과 같은 진단과, 학습자 대신 시험을 기록하는 대리 기록이 있는 화면이에요.',
      steps: [
        { title: '대리 기록', detail: '시험을 고르고 학습자의 답을 적어요(entered_by=admin). 저장하면 위 진단이 바로 다시 그려져요.' },
      ],
      cautions: ['대리 입력은 이 화면에서 지울 수 없어요. 잘못 넣지 않게 시험과 응시일을 먼저 확인해요.'],
    },
  },
  'csat-diagnosis-settings': {
    title: '엔진 설정',
    screen: {
      summary: '진단 엔진의 모든 수치(컷 · 반감기 · credit · 습관 임계값 · 시나리오 기준 시험)를 JSON 으로 고치는 화면이에요.',
      steps: [
        { title: '값을 고쳐요', detail: '시나리오·기준 시험 id 는 아래 목록(정답표가 있는 시험)에서 골라요. 난이도 보정은 그 시험들에 공식 오답률이 있어야 작동해요.' },
        { title: '검사 후 저장', detail: '범위를 검사하고 새 버전을 활성으로 저장해요. 실패하면 이전 활성 버전이 그대로 남아요.', done: '버전 기록 맨 위가 「활성」이 돼요.' },
      ],
      cautions: [
        '처음 값은 지시문의 초기 추정값이에요. 습관 응답(맞아요/아니에요)과 쌓인 데이터를 보고 조정해요.',
        '이미 쌓인 스냅샷은 그때의 설정 버전(settings_id)으로 남아요. 새 설정은 다음 계산부터 쓰여요.',
      ],
    },
  },
}
