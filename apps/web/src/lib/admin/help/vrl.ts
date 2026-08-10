// apps/web/src/lib/admin/help/vrl.ts
//
// VRL — 어휘 난이도 4축 분류 (/admin/vrl*) 화면도움말.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.
//
// 근거: 실제 화면 캡처 + 아래 코드.
//   app/admin/vrl/page.tsx · _components/* · lib/admin/dict/{queries,health-score-v2,
//   critical-defects-detector,schema-presence-static}.ts · lib/admin/vrl/queries.ts

import type { HelpRegistry } from './types'

export const VRL_HELP: HelpRegistry = {
  // ───────────────────────────────────────────────────────────
  // /admin/vrl — Dictionary DB Health (8 섹션 점프)
  // ───────────────────────────────────────────────────────────
  vrl: {
    title: '사전DB 종합 모니터링 (Dictionary DB Health)',
    screen: {
      summary:
        'shared_dictionary 가 4개 파이프라인(R1 라이브러리 추출 · R2 스크립트 추출 · R3 단어장 발행 · R4 사용자 학습)을 얼마나 지탱하는지 9차원으로 점수화한 읽기 전용 모니터.',
      when: '재분류·백필·마이그레이션을 시작하기 전에 "무엇부터 고칠지" 고를 때. 여기서 값을 고치지는 못한다.',
      steps: [
        {
          title: '병목 책임 고르기',
          detail:
            'Overall 의 R1~R4 칩 중 점수가 가장 낮고 붉은 링이 걸린 것 하나를 잡는다. 링은 최저 점수이면서 critical 인 책임에만 붙는다.',
          done: '책임 하나(R1~R4)를 특정',
        },
        {
          title: '깎인 요인 찾기',
          detail:
            'R1-R4 섹션에서 그 책임의 Factors 를 본다. w(가중치)가 큰데 채움률이 0% 인 요인이 점수를 가장 많이 먹고 있다.',
          done: '카드 하단 Primary Action 의 백로그 ID(B1/D1/D2/S1/V1) 확보',
        },
        {
          title: '결함 실측값 확인',
          detail:
            'Defects 에서 같은 백로그 ID 가 붙은 결함 카드의 current / target 을 본다. 임계에서 얼마나 모자란지가 작업량이다.',
        },
        {
          title: '작업은 바깥에서',
          detail:
            'Backlog / Quick Actions 에서 SQL 이나 이동 링크를 집어 간다. 이 화면은 실행하지 않는다 — 적용은 Supabase Studio·MCP 또는 VCB·큐레이션 화면에서.',
          done: '작업 후 QA5 새로고침 → 점수 재계산',
        },
      ],
      fields: [
        {
          label: '상단 8개 버튼',
          detail:
            '탭이 아니라 한 페이지의 섹션 점프다. 어느 것을 눌러도 나머지 섹션은 아래에 그대로 있고, 그냥 스크롤만 해도 활성 표시가 따라 움직인다.',
        },
        {
          label: 'Overall Health',
          detail:
            '9차원 가중평균. 40 미만 CRITICAL · 40~64 WARNING · 65~84 OK · 85 이상 EXCELLENT. 가중치는 Pipeline Fitness 20% · Learning 15% · VRL Classification 15% · Coverage/Linguistic/Integrity/Schema 각 10% · Volume/Freshness 각 5%.',
        },
        {
          label: 'fetch errors 배너',
          detail:
            '일부 조회가 실패해도 페이지는 기본값 0 으로 점수를 끝까지 계산해 그린다. 배너나 헤더의 fetch errors 배지가 보이면 그 판의 점수는 실제보다 낮다.',
        },
      ],
      cautions: [
        '점수가 갑자기 떨어졌으면 데이터보다 조회 실패를 먼저 의심해라 — 상단 fetch errors 배너를 확인한다.',
        '60초 캐시(revalidate 60)로 그려진다. 방금 적용한 마이그레이션이 안 보이면 Quick Actions 의 새로고침을 눌러야 한다.',
      ],
      seeAlso: [
        { label: '의심 단어 정리', href: '/admin/vrl/concerns' },
        { label: '분류 기준표', href: '/admin/vrl/taxonomy' },
        { label: '자동 승급 모니터', href: '/admin/vrl/automation' },
      ],
    },
    tabs: {
      Overall: {
        summary:
          '전체 점수 한 장 — 4 책임 점수와 가중치가 큰 3개 차원(Pipeline Fitness · VRL Classification · Schema Evolution)만 추린 요약.',
        fields: [
          {
            label: 'R1 / R2 / R3 / R4',
            detail:
              'R1 도서 챕터 단어 추출 · R2 사용자 스크립트 lemma 매칭 · R3 공용 단어장 발행(VCB) · R4 사용자 학습 콘텐츠. 숫자는 그 파이프라인이 사전DB 를 얼마나 쓸 수 있는지(0-100)이지, 그 파이프라인이 돌고 있는지가 아니다.',
          },
          {
            label: '붉은 링이 걸린 칩',
            detail: '4개 중 최저이면서 critical 인 책임에만 붙는다 — 이번 판의 병목.',
          },
          {
            label: '아래 3개 막대',
            detail:
              '9차원 중 여기만 따로 뽑은 이유는 가중치가 크거나(Pipeline Fitness 20%) 이 파이프라인의 목적 자체(VRL Classification)라서다.',
          },
        ],
      },
      'R1-R4': {
        summary:
          '각 책임 점수가 어떤 요인에서 깎였는지와, 그걸 되돌릴 단일 액션을 카드 한 장에 묶어 놓은 곳.',
        fields: [
          {
            label: 'Factors (n)',
            detail:
              '요인별 가중치(w)와 현재 채움률. 한 책임 안에서 w 합이 100% 다 — 0% 이면서 w 가 큰 요인부터 손대는 게 점수 회복이 가장 빠르다.',
          },
          {
            label: 'Affected Defects',
            detail:
              '아래 Defects 섹션의 어느 규칙이 이 책임을 끌어내리는지. 같은 결함이 여러 책임에 중복으로 잡힌다.',
          },
          {
            label: 'Primary Action',
            detail:
              '백로그 ID + cost + effect. effect 의 "+숫자"는 그 작업을 끝냈을 때 예상되는 책임 점수 상승분이다.',
          },
          {
            label: '본질 페인 띠',
            detail: 'R3 가 4개 중 최저이면서 critical 일 때만 섹션 상단에 뜬다.',
          },
        ],
        cautions: [
          'cost / effect 는 코드에 적어 둔 추정치다. 작업을 끝내도 이 문구는 자동으로 바뀌지 않는다 — 실제 효과는 다음 로드의 점수로 확인해라.',
        ],
      },
      '9 Dims': {
        summary: '9개 품질 차원 점수 — 가중치가 큰 것부터 왼쪽 위에 놓인다.',
        fields: [
          {
            label: '카드의 w',
            detail:
              'Overall 에 대한 기여 비중. 같은 10점을 올려도 Pipeline Fitness(20%)가 Volume(5%)보다 4배 크게 움직인다.',
          },
          {
            label: '🔴 / 🟡 / 🟢',
            detail:
              '차원별로 임계가 다르지 않다 — 40 미만 🔴 · 40~64 🟡 · 65 이상 🟢 으로 Overall 과 같은 기준.',
          },
        ],
      },
      Defects: {
        summary: '15개 탐지 규칙을 페이지를 열 때마다 다시 돌린 결과. P0/P1/P2 로 묶여 나온다.',
        fields: [
          {
            label: 'P0 / P1 / P2',
            detail:
              '심각도가 아니라 처리 순서다. 규칙 임계를 넘으면 자동으로 뜨고, 데이터가 임계 아래로 내려가면 다음 로드에서 저절로 사라진다.',
          },
          {
            label: 'current / target',
            detail: '탐지 시점의 실측값과 규칙이 요구하는 값. 이 차이가 남은 작업량이다.',
          },
          {
            label: 'affects 칩',
            detail: '이 결함이 끌어내리는 책임. Impact 탭의 점 하나하나와 같은 정보다.',
          },
        ],
        cautions: [
          '결함 목록은 DB 에 저장되지 않고 매 요청마다 계산된다 — 이력이 남지 않으니 처리할 항목은 따로 적어 둬라.',
        ],
      },
      Impact: {
        summary:
          '결함 × 4책임 교차표 — 점이 가장 많이 찍힌 컬럼이 이번 판의 본질 페인이다.',
        fields: [
          {
            label: '테두리가 쳐진 컬럼',
            detail:
              '가장 많은 결함에 걸린 책임. 헤더의 큰 숫자는 그 책임의 점수, 그 아래 "n hit" 가 걸린 결함 수다.',
          },
          {
            label: '점 색',
            detail:
              '결함의 severity(critical/warning/info)다. 왼쪽 행 머리의 P0/P1/P2 우선순위와 항상 같지는 않다.',
          },
        ],
        cautions: [
          '결함이 하나도 없으면 이 섹션 자체가 사라진다 — 점프 버튼을 눌러도 아무 데도 가지 않는다.',
        ],
      },
      Schema: {
        summary:
          'Tier 1~5 확장 컬럼이 shared_dictionary 에 실제로 있는지 대조한 로드맵.',
        fields: [
          {
            label: 'Next Tier',
            detail: '아직 다 채워지지 않은 tier 중 priority 가 가장 앞선 것. 같은 카드에 붉은 링이 걸린다.',
          },
          {
            label: '링 안의 %',
            detail:
              '전체 컬럼 중 존재하는 비율. 옆의 Schema dim 점수와 다른 이유는 Tier 1 에 70%, Tier 2 에 30% 가중을 주기 때문이다.',
          },
        ],
        cautions: [
          '컬럼 유무는 DB 를 조회한 값이 아니라 코드의 정적 목록(lib/admin/dict/schema-presence-static.ts)이다. 마이그레이션을 적용해도 그 파일을 같은 커밋에서 고치지 않으면 여기는 계속 ❌ 로 남는다.',
        ],
      },
      'Dist/Rounds': {
        summary:
          '6개 분포 차트 + rule_v1 → v_level 재분류 라운드 기록. 분포는 실측, 라운드 카드는 기록이다.',
        fields: [
          {
            label: 'V-Level (current) vs rule_v1',
            detail:
              '같은 축을 현재 값과 Day 3 원본으로 나란히 그린 것 — 두 막대의 차이가 재분류가 실제로 바꾼 양이다.',
          },
          {
            label: 'sum / total',
            detail:
              '차트 합계와 사전 전체 행수. 둘이 크게 벌어지면 그 컬럼이 대량 NULL 이라는 뜻이다.',
          },
          {
            label: 'retention %',
            detail:
              '그 라운드에서 원래 레벨을 유지한 비율. 낮을수록 rule_v1 이 그 구간에서 크게 틀렸다는 뜻이다.',
          },
          {
            label: '우상단 Classified',
            detail: '이 섹션에서 유일하게 DB 실측인 값 — 분류 진행을 볼 때는 이 비율을 봐라.',
          },
        ],
        cautions: [
          'Round 카드 6장과 Remaining Roadmap(R7-R10), 그 위의 진행률 막대는 코드에 고정된 값이다. 분류를 더 돌려도 움직이지 않는다.',
        ],
      },
      Backlog: {
        summary: '개선 항목을 P0~P3 로 묶은 목록 + 즉시 쓸 수 있는 5개 액션.',
        fields: [
          {
            label: '본질 페인 / Best ROI',
            detail:
              '남은 항목에서 자동으로 뽑은 두 장 — 가장 크게 막힌 항목과 노력 대비 효과가 가장 좋은 항목이다. 헤더의 affects R1-R4 카운트도 남은 항목만 센 값이다.',
          },
          {
            label: 'QA2 / QA3',
            detail: 'SQL 을 펼쳐 보여줄 뿐 실행하지 않는다. 복사해서 승인 후 Supabase 에서 적용한다.',
          },
          {
            label: 'QA5',
            detail: '60초 캐시를 무시하고 서버 컴포넌트를 다시 그린다. 이 화면에서 유일하게 즉시 동작하는 버튼이다.',
          },
        ],
        cautions: [
          '백로그 항목은 코드 상수(_components/backlog-items.ts)다. 작업을 끝내도 카드가 저절로 완료로 넘어가지 않는다 — status 를 코드에서 바꿔야 한다.',
          'QA2 의 UPDATE 는 cefr_confidence IS NULL 인 수만 행을 한 번에 덮어쓴다. 되돌리려면 다시 NULL 로 쓰는 UPDATE 가 필요하니 적용 전 대상 건수를 먼저 세라.',
        ],
      },
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/taxonomy
  // ───────────────────────────────────────────────────────────
  'vrl-taxonomy': {
    title: 'VRL Taxonomy — 4축 분류 기준표',
    screen: {
      summary:
        'V-Level 12 · Track 6 · Domain 8 · Skill 5 의 정의를 읽기만 하는 화면. 단어에 붙은 축 값이 무슨 뜻인지 여기서 확인한다.',
      when: '분류 값을 해석하거나 진단·단어장에 쓸 id 를 확인할 때. 사이드바에 없다 — /admin/vrl/taxonomy 로 직접 들어간다.',
      cautions: [
        '읽기 전용이다. vocaflow_levels / tracks / domains / skills 는 마이그레이션으로만 바뀐다.',
        '탭 옆 배지가 0 이면 "비었다"가 아니라 조회 실패일 수 있다 — 이 화면의 조회는 에러를 무시하고 빈 배열을 넘긴다. 헤더에 적힌 12·6·8·5 와 어긋나면 권한/RLS 를 확인해라.',
        '5분 캐시(revalidate 300)다. 방금 넣은 분류는 바로 안 보일 수 있다.',
      ],
      seeAlso: [{ label: '진단 5종', href: '/admin/vrl/diagnostic' }],
    },
    tabs: {
      Levels: {
        summary: '12단계 V-Level 기준표 — 한국 학교 학년 · CEFR · 시험 점수 힌트를 한 행에 묶어 놓은 표.',
        fields: [
          {
            label: '누적 / 신규 / 시간',
            detail:
              'vocaflow_levels 에 저장된 설계값(cumulative_word_count · new_words_in_level · estimated_study_hours)을 그대로 읽는다 — shared_dictionary 를 실시간 집계한 수치가 아니다.',
          },
          {
            label: 'CEFR 열',
            detail: 'cefr_min 과 cefr_max 가 같으면 한 글자, 다르면 범위(A2–B1)로 나온다.',
          },
          {
            label: '검증 배지',
            detail:
              'classification_method 값 — 검증=claude_verified · 부분=partially_verified · 진행 중=in_progress · 자동=system_inferred · 미검증=unverified. 옆의 소수는 confidence.',
          },
        ],
      },
      Tracks: {
        summary: '6개 목적별 트랙 카드 — 우측 상단의 id(csat_korean · business_english · academic_english …)가 진단·단어장 slug 에 그대로 쓰인다.',
        fields: [
          {
            label: '카드 하단 words',
            detail:
              'vocaflow_tracks.total_words 컬럼값을 그대로 읽는다. 실시간 집계가 아니라서 분류 직후에는 실제와 어긋날 수 있다.',
          },
          {
            label: '좌하단 회색 글자',
            detail: 'display_hint — 학습자 화면에서 트랙을 어떻게 노출할지에 대한 힌트다.',
          },
        ],
      },
      Domains: {
        summary: '8개 주제 도메인 카드 — 단어의 내용 영역 축.',
        fields: [
          {
            label: '카드 하단 words',
            detail: 'vocaflow_domains.total_words 컬럼값 그대로. 실시간 집계가 아니다.',
          },
        ],
      },
      Skills: {
        summary: '5개 기능(Skill) 축 카드 — 어떤 언어 기능에 쓰이는 단어인지를 나누는 축.',
        fields: [
          {
            label: '카드 하단 words',
            detail: 'vocaflow_skills.total_words 컬럼값 그대로. 실시간 집계가 아니다.',
          },
        ],
      },
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/diagnostic
  // ───────────────────────────────────────────────────────────
  'vrl-diagnostic': {
    title: 'VRL Diagnostic System — 진단 적재 상태',
    screen: {
      summary:
        '진단 테스트들이 실제로 응시 가능한 상태인지(선언한 문항이 다 들어갔는지)를 보는 읽기 전용 목록.',
      when: '진단을 열기 전, 또는 시드를 넣은 뒤 문항 수가 맞는지 확인할 때. 사이드바에 없다 — /admin/vrl/diagnostic 으로 직접 들어간다.',
      fields: [
        {
          label: 'questions 열의 a / b',
          detail:
            'a = vrl_diagnostic_questions 에 실제로 들어간 문항 수, b = 테스트가 선언한 question_count. a < b 면 주황색으로 바뀐다 — 선언한 만큼 물어보지 못하는 진단이다.',
        },
        {
          label: 'Results',
          detail: 'user_diagnostic_results 의 전체 행수 — 응시자 수가 아니라 응시 횟수다.',
        },
        {
          label: '평균 분',
          detail: '목록에 실린 모든 테스트의 estimated_minutes 평균. active 여부를 가리지 않는다.',
        },
        {
          label: 'active 배지',
          detail: 'is_active 값을 보여줄 뿐이다 — 여기서 켜고 끌 수 없다.',
        },
        {
          label: 'axis 열',
          detail: 'target_axis 와, track/domain 진단이면 그 대상 id 까지 붙는다.',
        },
      ],
      cautions: [
        '문항 시드와 is_active 변경은 이 화면에서 못 한다 — 마이그레이션이나 Supabase 에서 한다.',
        '조회가 실패해도 화면에는 실패 표시 없이 "등록된 진단 테스트 없음" 빈 상태만 뜬다. 있어야 할 진단이 안 보이면 권한을 의심해라.',
      ],
      seeAlso: [
        { label: '진단 결과가 반영된 사용자', href: '/admin/vrl/users' },
        { label: '분류 기준표', href: '/admin/vrl/taxonomy' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/snapshots
  // ───────────────────────────────────────────────────────────
  'vrl-snapshots': {
    title: 'VRL Level Snapshots — 레벨 변경 감사 로그',
    screen: {
      summary:
        '사용자 V-Level 이 바뀔 때마다 남는 감사 기록을 최근 200건까지 시간 역순으로 보여준다.',
      when: '누군가의 레벨이 왜 바뀌었는지 되짚거나, 자동 승급이 실제로 사람을 움직였는지 확인할 때. 사이드바에 없다 — /admin/vrl/snapshots 로 직접 들어간다.',
      fields: [
        {
          label: '상단 snapshot_type / taken_reason 분포',
          detail: '전체 통계가 아니라 아래 표에 실린 200건만 센 값이다.',
        },
        {
          label: 'type',
          detail: 'initial · level_change · scheduled · manual · reset. manual 과 reset 은 사람이 개입한 기록이다.',
        },
        {
          label: 'trigger',
          detail: '누가 찍었는지 — api(사용자 행동) · cron(자동 승급) · admin · system · internal.',
        },
        {
          label: 'delta',
          detail: 'previous_v_level 대비 증감. "—" 는 델타가 기록되지 않은 행으로, 보통 최초 스냅샷이다.',
        },
        {
          label: 'details',
          detail:
            'trigger_details JSONB 의 키 이름만 나열한다. 값은 화면에 없으니 근거를 봐야 하면 DB 에서 열어야 한다.',
        },
      ],
      cautions: [
        '200건 컷은 시간순이라 특정 사용자의 이력이 잘려 나갈 수 있다 — 한 사람을 추적하려면 user_level_snapshots 를 직접 조회해라.',
        '표가 비었을 때 이력이 없는 건지 admin read 정책이 없어 막힌 건지 화면으로는 구분되지 않는다. 실패는 서버 로그에만 남는다.',
      ],
      seeAlso: [{ label: '자동 승급 cron 상태', href: '/admin/vrl/automation' }],
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/concerns
  // ───────────────────────────────────────────────────────────
  'vrl-concerns': {
    title: 'VRL Concerns — 정합 의심 단어',
    screen: {
      summary:
        '분류 작업 중 "이 단어는 이상하다"고 남겨 둔 목록을 훑고, 정리는 DB 에서 하는 확인용 화면.',
      when: '재분류 라운드를 돌린 뒤 규칙으로 못 거른 단어를 손으로 볼 때. 사전DB 모니터의 Quick Actions QA1 이 여기로 보낸다.',
      fields: [
        {
          label: 'Open / Resolved',
          detail:
            'vrl_data_integrity_concerns.resolved 기준. 표 정렬도 open 이 먼저고, 그 안에서 최근 탐지 순이다.',
        },
        {
          label: '유형별 분포',
          detail: 'concern_type 별 총계 + 남은 open 수. open 이 0 이면 빨간 배지가 사라진다.',
        },
        {
          label: 'detected 옆 회색 글자',
          detail: 'detected_during — 어느 작업 중에 걸린 항목인지.',
        },
        {
          label: 'suggested',
          detail: '기록 당시 제안한 처리 방향일 뿐, 아무것도 자동으로 적용되지 않는다.',
        },
      ],
      cautions: [
        '이 화면에 처리 버튼이 없다. resolved 로 넘기려면 DB 에서 직접 UPDATE 해야 하고, 그래야 다음 로드에서 Open 카운트가 줄어든다.',
        '"의심 단어 없음" 빈 상태는 정말 없을 때와 조회가 실패했을 때 똑같이 뜬다 — 실패는 서버 로그에만 남는다.',
        '최대 500건까지만 읽는다. 그보다 많으면 오래된 resolved 항목부터 화면에서 잘린다.',
      ],
      seeAlso: [{ label: '사전DB 종합 모니터링', href: '/admin/vrl' }],
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/automation
  // ───────────────────────────────────────────────────────────
  'vrl-automation': {
    title: 'VRL Automation — 자동 승급 모니터',
    screen: {
      summary:
        'V-Level 자동 승급 cron 이 돌고 있는지, 그 결과로 사용자 레벨이 실제로 움직였는지를 한 화면에서 대조한다.',
      when: '자동 승급을 켜 둔 뒤 정기 점검할 때. 사이드바 "VRL Automation".',
      fields: [
        {
          label: 'pg_cron jobs',
          detail:
            '매일 KST 03:00 에 도는 vrl-auto-promote-daily(jobid=8). 실패는 pg_notify "vrl_cron_alert" 로만 나가고, 이 화면이 알림을 띄우지는 않는다.',
        },
        {
          label: '최근 cron 실행',
          detail:
            'status 가 succeeded 여도 사용자 레벨이 바뀌었다는 뜻은 아니다. 실제 변경 여부는 아래 "최근 레벨 변경" 표로 확인해라.',
        },
        {
          label: '근거 있는 레벨 / 기본값',
          detail:
            'current_v_level_meta.source 가 diagnostic · learning_data · manual_override · self_declared 중 하나면 근거 있음, 비었거나 그 밖이면 기본값으로 센다.',
        },
        {
          label: '각 섹션의 "없음" 문구',
          detail:
            'RPC 권한이 없을 때도 같은 문구가 뜬다 — 데이터가 없는 건지 못 읽는 건지 화면만 봐서는 구분되지 않는다.',
        },
      ],
      cautions: [
        '조작 버튼이 없다. cron 을 멈추거나 이미 올라간 레벨을 되돌리는 UI 는 이 화면에 없다 — 둘 다 DB 쪽 작업이다.',
        '캐시 없이 매번 조회한다(force-dynamic). 무거운 집계가 여러 개라 새로고침을 연타할 화면은 아니다.',
      ],
      seeAlso: [
        { label: '변경 이력 전체', href: '/admin/vrl/snapshots' },
        { label: '사용자별 현재 레벨', href: '/admin/vrl/users' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/vrl/users
  // ───────────────────────────────────────────────────────────
  'vrl-users': {
    title: 'VRL User Levels — 사용자 V-Level',
    screen: {
      summary:
        '사용자별 현재 V-Level 과, 그 값이 어디서 온 것인지(진단 · 학습 · 자가선언 · 관리자 · 기본값)를 함께 보는 목록.',
      when: '진단 도입 효과나 레벨 분포 쏠림을 볼 때. 사이드바에 없다 — /admin/vrl/users 로 직접 들어간다.',
      fields: [
        {
          label: 'source 배지',
          detail:
            '진단=diagnostic · 학습=learning_data · 자가선언=self_declared · 관리자=manual_override · system=system_default. system 은 아직 아무 근거가 없는 기본값이다.',
        },
        {
          label: '진단 열',
          detail: 'diagnostic_completed_at 날짜. 비어 있으면 미응시고, 그 사람의 레벨은 대개 기본값이다.',
        },
        {
          label: 'conf',
          detail: 'current_v_level_meta.confidence — 레벨 판정의 신뢰도다.',
        },
        {
          label: 'seen / mastered',
          detail: 'user_profiles 의 누적 카운터를 그대로 읽는다. 이 화면에서 재계산하지 않는다.',
        },
      ],
      cautions: [
        '가입 순 앞쪽 500명까지만 읽는다 — 상단 KPI 3개와 V-Level 분포 막대도 그 500명 기준이다.',
        '평균 V-Level 은 레벨이 없는 사용자까지 분모에 넣는다. 미진단자가 많으면 실제보다 낮게 나온다.',
        '레벨을 여기서 바꿀 수 없다. 수동 조정은 DB 에서 하고, 그 흔적은 Snapshots 화면에서 manual/admin 으로 구분해 볼 수 있다.',
      ],
      seeAlso: [
        { label: '진단 5종', href: '/admin/vrl/diagnostic' },
        { label: '레벨 변경 이력', href: '/admin/vrl/snapshots' },
      ],
    },
  },
}
