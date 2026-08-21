// apps/web/src/lib/admin/help/textbook.ts
//
// TBP(교재 파이프라인) 화면도움말.
//
// 이 화면의 관리자는 "여기 버튼이 왜 없지?" 를 가장 먼저 묻는다 — **교재 생성은 버튼이
// 아니라 Claude Code 드레인**이기 때문이다. 문항 생성은 사전·재고 전체를 훑는 일이라
// 웹 요청 시간 안에 안 끝나고, 규칙이 바뀌면 이미 넣은 것까지 다시 재야 한다.
// summary 가 그것부터 말한다.

import type { HelpRegistry } from './types'

export const TBP_HELP: HelpRegistry = {
  textbook: {
    title: '교재 (TBP)',
    screen: {
      summary:
        '학령 사다리 7단에 문항이 얼마나 차 있는지, 그 문항이 건강한지, 시중 교재 대비 어디서 이기고 지는지를 한 장에서 보는 곳. **여기서는 만들지 않는다** — 생성·적재·정리는 Claude Code 로 스크립트를 돌린다(아래 드레인 절차).',
      when: '문항을 새로 만들었거나 생성 규칙을 고친 뒤. 또는 어느 학년 교재가 비어 있는지 확인할 때.',
      fields: [
        {
          label: '사다리 계단별 문항',
          detail:
            '**저장된 문항만 센다.** 초등 3종(파닉스 운율·기본어휘 뜻·철자 완성)은 사전의 순수 함수라 DB 에 넣지 않으므로 여기서 초등 계단이 비어 보인다 — 실제 수율은 `series-report` 가 낸다(초등 두 계단 3,988문항).',
        },
        {
          label: '정답 번호 χ²',
          detail:
            '정답이 한 번호로 쏠리면 학습자가 읽지 않고 찍는다. 비중이 아니라 카이제곱으로 보는 이유는 표본 수에 따라 같은 비중도 뜻이 달라지기 때문이다 — 자유도 4 의 임계는 9.488(유의수준 0.05, 통계표 값).',
        },
        {
          label: '관측',
          detail:
            '학습자가 실제로 푼 기록 수. **0 이면 난이도(P)·변별도(D)를 못 낸다** — 지금 보는 것은 "만들어진 모양" 이지 "가르쳐 본 결과" 가 아니다.',
        },
        {
          label: '평가 우위율',
          detail:
            '시중 교재 대비 평가 요소 15개 중 우리가 나은 것의 비율. **분모는 요소 전체**다 — 못 잰 것을 빼고 세면 숫자가 거짓말이 된다.',
        },
      ],
      cautions: [
        '`--prune` 은 되돌릴 수 없다. 낡은 문항을 지우는 스위치이고, 적재(`--commit`)와 **다른 스위치**다.',
        '문항 유형을 새로 추가하면 `apps/web/src/lib/learner/dcp-types.ts` 의 두 갈래(재생용/교재용) 중 하나에 반드시 넣어야 한다 — 안 넣으면 통합 회귀가 실패한다. 재생용으로 넣는다면 `parseItem`·`DcpPlayer`·`grade_dcp_item`·`prescribe_today` 넷이 함께 준비돼야 한다.',
        '교재용 유형은 `prescribe_today` 의 허용 목록에 **넣지 않는다.** 학습자 화면이 못 그리는 유형이 처방에 섞이면 문항이 조용히 줄어든다(2026-08-21 에 실제로 발행 카탈로그의 42.5% 가 그렇게 샜다).',
      ],
      drain: {
        what: '문항 생성 → 저장 → 낡은 것 정리 → 건강 점검까지 한 바퀴. 산출물은 `csat_dcp_items` 행과 리포트 네 장이다.',
        prerequisites: [
          '`apps/web/.env.local` 에 `SUPABASE_SERVICE_ROLE_KEY` 가 있어야 한다 — 스크립트가 그 파일을 직접 읽는다.',
          '기사 재고가 `ready` 또는 `published` 상태여야 한다. ND(`display_only`) 기사는 본문을 못 써서 자동으로 빠진다.',
          '새 유형을 추가했다면 `csat_dcp_items.type` CHECK 제약을 먼저 넓혀야 한다(마이그레이션 — 사용자 승인 필요).',
        ],
        procedure: [
          {
            title: '몇 개 늘고 몇 개 낡았는지만 본다',
            detail:
              '`pnpm dlx tsx scripts/textbook/store-new-types.mjs` — 인자 없이 돌리면 **아무것도 쓰지 않는다.** 새로 넣을 문항 수와 "지금 규칙으로 낡은" 기존 문항 수를 센다. 낡음은 인쇄 불가·규격 밖·**다시 만들면 달라짐** 세 가지로 갈라 보여 준다.',
            done: '"--commit 없이 실행했다. 아무것도 쓰지 않았다." 로 끝난다.',
          },
          {
            title: '낡은 문항 정리',
            detail:
              '`… store-new-types.mjs --prune` — 낡은 것을 지운다. **되돌릴 수 없다.** 규칙을 고친 뒤에만 필요하고, 새로 넣기만 할 때는 건너뛴다.',
            done: '"삭제 완료 N건" 이 찍힌다.',
          },
          {
            title: '적재',
            detail:
              '`… store-new-types.mjs --commit` — 유일키가 `(kind, ref_id, type, paragraph_idx)` 라 이미 있는 조합은 건너뛴다. **몇 번 돌려도 결과가 같다.**',
            done: '"적재 완료 N건". 다시 돌리면 "새로 넣을 문항 0" 이 나온다.',
          },
          {
            title: '건강 점검',
            detail:
              '`pnpm dlx tsx scripts/textbook/item-health-report.mjs` — 정답 번호 쏠림·지문 규격·밴드 분포·관측 유무를 낸다. **읽기만 한다.**',
            done: '"고칠 것 N건" 이 마지막 줄에 나온다. 0 이 목표다.',
          },
          {
            title: '사다리 확인',
            detail:
              '`pnpm dlx tsx scripts/textbook/series-report.mjs` — 학령 7단이 다 찼는지 본다. 초등 3종은 **그 자리에서 생성해 세므로** DB 에 없어도 숫자가 나온다(사전 전체를 훑어 1분 남짓 걸린다).',
            done: '"모든 계단에 문항이 있다" 또는 끊긴 계단 번호가 나온다.',
          },
          {
            title: '권 조립 미리보기',
            detail:
              '`pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20` — 그 밴드로 한 권을 실제로 조합해 3관점 채점표를 낸다. **읽기만 한다.**',
            done: '자동 채점 항목 통과 수가 나온다. 사람 판단 항목은 분모 밖이다.',
          },
        ],
        verify: [
          '이 화면의 **유형별 문항 수**가 늘었는지.',
          '**정답 번호 χ²** 가 전부 임계(9.488) 아래인지 — 넘으면 그 유형은 찍어서 맞을 여지가 있다.',
          '`store-new-types.mjs` 를 인자 없이 다시 돌렸을 때 **새로 넣을 문항 0 · 낡은 것 0** 인지. 둘 중 하나라도 남으면 한 바퀴가 안 끝난 것이다.',
        ],
        recovery: [
          '중간에 멈춰도 안전하다 — 적재는 유일키가 막고, 나머지는 읽기만 한다. 처음부터 다시 돌리면 된다.',
          '"사전 조회 실패" 로 죽으면 `.env.local` 의 서비스 키를 확인한다. 스크립트는 실패를 삼키지 않고 던진다(조용한 0 건을 만들지 않기 위해서다).',
          '적재 후 이 화면의 수치가 안 바뀌면 브라우저 새로고침 — 이 화면은 `force-dynamic` 이라 매 요청에 다시 읽는다.',
        ],
      },
      seeAlso: [
        { label: '평가 요소 대조표 (스크립트)', href: '/admin/textbook' },
        { label: 'CHANGELOG — 교재 파이프라인', href: '/admin' },
      ],
    },
  },
}
