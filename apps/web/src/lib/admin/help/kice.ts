// apps/web/src/lib/admin/help/kice.ts
//
// 기출 분석 뷰(`/admin/kice/*`) 화면도움말.
//
// 이 화면들은 2026-09-17 까지 학습자 `/csat` 밑에 있었다. 학습자 쪽이 「오늘의 세션」 루프로
// 바뀌면서(docs/csat-learner-brief.md · DECISIONS.md D8) 관리자 뷰로 옮겼다. 화면 자체는 그대로다 —
// 그래서 도움말은 「무엇이 바뀌었나」와 「학습자 세션과 어떻게 이어지나」를 말한다.
//
// ⚠️ 학습자 세션 구성·복습 규칙이 바뀌면 **같은 커밋에서** 여기도 고친다(CLAUDE.md §3️⃣).

import type { HelpRegistry } from './types'

const SEE_SESSION = { label: '학습자 세션 설계 — 결정 기록', doc: 'docs/csat-learner/DECISIONS.md' } as const

export const KICE_HELP: HelpRegistry = {
  kice: {
    title: '기출 분석 뷰 — 802문항 분석을 읽는 자리',
    screen: {
      summary:
        '평가원 독해 기출 802문항의 오답 선지 3,208개를 센 분포와 유형 26개를 본다. **학습자는 이 화면을 보지 않는다** — 학습자에게는 이 분석이 세션 구성(약한 유형·복습)과 ② 이해 단계의 인라인 설명으로만 간다.',
      when: '분석 결과가 학습자 세션에 어떻게 쓰일지 확인할 때 · 분석 드레인 적재 뒤 결과를 눈으로 볼 때.',
      fields: [
        {
          label: '출제 지형 · 사정권 · 한 회차 주파 계획',
          detail:
            '예전 학습자 레일의 ②③⑤ 칸. 화면은 그대로 옮겼고 학습자 링크(훈련·오버레이)만 걷었다 — 그 두 화면은 삭제됐다(세션의 ①풀기와 문제지 reflow 가 대체).',
        },
        {
          label: '유형 카드 → 문항',
          detail:
            '문항 화면(`/admin/kice/item/<회차-번호>`)은 **강의 검수 하네스가 쓰는 자리**다(`scripts/csat-lecture/gate2-play.mts`). 지우거나 주소를 바꾸면 강의 재생 검사가 같이 깨진다.',
        },
      ],
      cautions: [
        '「내 기록」 칩은 옛 훈련 기록(`csat_trap_attempts`)을 읽는다. 새 세션의 풀이 기록은 지금 **학습자 기기(IndexedDB)** 에만 있어 여기 안 잡힌다 — 서버 저장 마이그레이션이 승인되기 전까지는 0 으로 보이는 것이 정상이다.',
      ],
      seeAlso: [{ label: '기출 원천 — 분석 진행', href: '/admin/csat/evidence' }, SEE_SESSION],
    },
  },
  'kice-type': {
    title: '기출 분석 뷰 — 유형 하나',
    screen: {
      summary: '한 유형의 리포트(근거 자리 · 되풀이 함정 · 풀이 절차 · 시간)와 그 유형의 기출 목록.',
      fields: [
        {
          label: '풀이 절차 첫 줄',
          detail:
            '학습자 세션 ③ 「한 줄」(다음에 이 유형을 만나면 첫 10초에 할 일)이 **여기 첫 절차**에서 온다. 첫 절차가 길거나 비면 세션의 한 줄도 그렇다.',
        },
      ],
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }, SEE_SESSION],
    },
  },
  'kice-item': {
    title: '기출 분석 뷰 — 문항 하나',
    screen: {
      summary:
        '한 문항의 해설 전문(재는 힘 · 출제 의도 · 근거 · 오답 넷 · 절차 · 어휘)과 강의 재생. 학습자 세션은 이 중 근거·오답·함정을 **원문 문장 안**에 인라인으로 편다.',
      cautions: [
        '강의 검수 하네스(`gate2-play.mts` · e2e `46-csat-lecture`)가 이 주소로 들어온다. 주소를 바꾸면 그 둘도 함께 고친다.',
      ],
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }, SEE_SESSION],
    },
  },
  'kice-map': {
    title: '기출 분석 뷰 — 출제 지형',
    screen: {
      summary: '유형 × 학년도 히트맵. 칸을 고르면 그 유형 해부로 간다.',
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }],
    },
  },
  'kice-predict': {
    title: '기출 분석 뷰 — 사정권',
    screen: {
      summary:
        '최근 출제 빈도로 유형을 A·B·C·은퇴로 가른다. 학습자 세션의 「다음 순서 유형」이 이 순서(최근 출제가 많은 순)를 따른다.',
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }, SEE_SESSION],
    },
  },
  'kice-plan': {
    title: '기출 분석 뷰 — 한 회차 주파 계획',
    screen: {
      summary: '최신 회차 독해 28문항의 풀이 순서·권장 시간·첫 절차.',
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }],
    },
  },
}
