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

// 2026-10-01 학평 전면 적용 — 다섯 화면 공통 범위 탭(lib/csat/scope.ts)
const SCOPE_FIELD = {
  label: '집합 범위 탭(평가원 · 학평 고1·2·3)',
  detail:
    '같은 화면을 집합만 바꿔 본다(`?set=hakpyeong&grade=N`, 기본 평가원). **통계는 섞지 않는다** — 학평을 고르면 출제 수·지형은 그 학년 회차 전체(분석 발행 여부와 무관, 서비스 역할로 셈)로, 유형 리포트는 그 학년 리포트(`csat_type_reports` organizer·grade)로 읽는다. 학평 리포트·함정 지도는 아직 굽지 않아 빈 상태로 보이는 것이 정상이다(내용은 별도 드레인). 문항 목록·문항 화면은 학습자 뷰를 따르므로 **발행된 학평만** 열린다.',
} as const

export const KICE_HELP: HelpRegistry = {
  kice: {
    title: '기출 분석 뷰 — 802문항 분석을 읽는 자리',
    screen: {
      summary:
        '평가원 독해 기출 802문항의 오답 선지 3,208개를 센 분포와 유형 26개를 본다. **학습자는 이 화면을 보지 않는다** — 학습자에게는 이 분석이 세션 구성(약한 유형·복습)과 ② 이해 단계의 인라인 설명으로만 간다.',
      when: '분석 결과가 학습자 세션에 어떻게 쓰일지 확인할 때 · 분석 드레인 적재 뒤 결과를 눈으로 볼 때.',
      fields: [
        SCOPE_FIELD,
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
        '「내 기록」 칩과 계획의 「내 약한 것 먼저」는 옛 훈련 기록(`csat_trap_attempts`)을 읽는다. 새 세션의 풀이는 `csat_session_attempts` 에 쌓이지만(2026-09-17~) **이 화면은 아직 그 표를 읽지 않는다** — 훈련 화면이 없어진 뒤로 칩이 비어 보이는 것이 그 때문이다. 세션 기록을 보려면 표를 직접 조회한다.',
      ],
      seeAlso: [{ label: '기출 원천 — 분석 진행', href: '/admin/csat/evidence' }, SEE_SESSION],
    },
  },
  'kice-type': {
    title: '기출 분석 뷰 — 유형 하나',
    screen: {
      summary: '한 유형의 리포트(근거 자리 · 되풀이 함정 · 풀이 절차 · 시간)와 그 유형의 기출 목록.',
      fields: [
        SCOPE_FIELD,
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
        '오답이 지문 위에 자리를 갖는 순서는 ① 지우는 근거 ② 끌리는 이유 속 영어 조각 ③ 드레인이 채운 `lure_quote` 다(`scripts/csat/lib-fragments.mjs` — 골격 굽기와 드레인이 같은 규칙을 쓴다). ②③ 은 「끌리는 자리」라 화면이 「지우는 근거」와 다르게 말한다.',
      ],
      drain: {
        what: '지문 위 자리가 없는 오답마다 「이 선지로 끌어당기는 구절」(지문 원문 20–80자)을 `choice_analysis[].lure_quote` 키로 더한다 → 문제 지도 · 해설 극장에서 그 오답의 끌리는 자리가 칠해진다.',
        prerequisites: ['평가원 분석이 발행(published) 상태 · 지문 온전(body_ok)', '`apps/web/.env.local` 의 서비스 키(스크립트는 저장소 루트에서 실행)'],
        procedure: [
          {
            title: '내보내기',
            detail:
              '`pnpm exec tsx scripts/csat/lure-drain-export.mjs` — 자리 없는 오답만 `scripts/csat/lure-drain/chunk-NN.json` 으로(지문 원문 포함 · 커밋 안 함). **재실행 안전** — 이미 자리가 있거나 채운 청크는 건너뛴다.',
            done: '「오답 N · 자리 있음 M (p%) · 채울 것 K개」 한 줄',
          },
          {
            title: 'Claude Code 가 채우기',
            detail:
              '청크마다 `lure-drain/README.md` 지시대로 `chunk-NN.out.json` 을 쓰고 `node scripts/csat/lure-drain-check.mjs NN` 으로 문제 0 을 확인한다. 끌림이 지문 밖에서 오면 null(억지로 고르지 않는다). **재실행 안전**(파일만 쓴다).',
          },
          {
            title: '예행 → 반영',
            detail:
              '`pnpm exec tsx scripts/csat/lure-drain-import.mjs` 로 사유별 건너뜀을 본 뒤 `--commit`. 행을 다시 읽어 그 오답 원소에 키 하나만 더하고, 내보낸 뒤 버전이 바뀐 분석은 건너뛴다. **재실행 안전**(이미 자리가 있으면 건드리지 않는다).',
            done: '「받아들인 끌리는 구절 N개 · 갱신한 분석 M행」',
          },
          {
            title: '골격 다시 굽기',
            detail: '`pnpm exec tsx scripts/csat/build-skeleton-data.mjs --write` — 노출 상한 · 유출 검사를 통과해야 쓴다. 굽지 않으면 화면은 옛 지도를 그대로 보인다.',
            done: '「원문 유출 0」 · `skeleton-data/*.json` 변경',
          },
        ],
        verify: [
          '내보내기를 다시 돌려 「자리 있음」 비율이 올랐는지 · 남은 것은 null 판정분과 검증 탈락분뿐인지',
          '문항 화면에서 오답 칩을 눌러 칠해진 구절이 그 오답의 「끌리는 이유」와 맞는지 표본으로 본다',
        ],
        recovery: ['잘못 들어간 구절은 그 원소의 `lure_quote` 키만 지운다(다른 키는 그대로) → 골격 다시 굽기.'],
      },
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }, SEE_SESSION],
    },
  },
  'kice-map': {
    title: '기출 분석 뷰 — 출제 지형',
    screen: {
      summary: '유형 × 학년도 히트맵. 칸을 고르면 그 유형 해부로 간다.',
      fields: [SCOPE_FIELD],
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }],
    },
  },
  'kice-predict': {
    title: '기출 분석 뷰 — 사정권',
    screen: {
      summary:
        '최근 출제 빈도로 유형을 A·B·C·은퇴로 가른다. 학습자 세션의 「다음 순서 유형」이 이 순서(최근 출제가 많은 순)를 따른다.',
      fields: [SCOPE_FIELD],
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }, SEE_SESSION],
    },
  },
  'kice-plan': {
    title: '기출 분석 뷰 — 한 회차 주파 계획',
    screen: {
      summary: '최신 회차 독해 28문항의 풀이 순서·권장 시간·첫 절차. 평가원은 최신 수능, 학평은 고른 학년의 최신 학력평가.',
      fields: [SCOPE_FIELD],
      seeAlso: [{ label: '기출 분석 뷰', href: '/admin/kice' }],
    },
  },
}
