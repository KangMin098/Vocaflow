// apps/web/src/lib/admin/help/knowledge.ts
//
// 학습 원리(본질·원리·방법론·공부법·근거) 화면도움말. 정본 docs/methodology/SYSTEM.md.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.

import type { HelpRegistry } from './types'

const LAYER_FLOW = {
  kind: 'flow' as const,
  caption: '항목은 아래층에서 위층으로만 잇는다',
  nodes: [
    { label: 'L4 공부법', actor: 'claude' as const, says: '오늘 하는 루틴 — 조건이 다르면 다른 항목' },
    { label: 'L3 방법론', actor: 'claude' as const, says: '원리를 한 영역에 쓰는 절차' },
    { label: 'L2 원리', actor: 'user' as const, says: '왜 배워지는가 — 학습 과학 7 이 씨앗' },
    { label: 'L1 본질', actor: 'user' as const, says: '사람만 쓰고 사람만 승인한다' },
  ],
}

const STATUS_FLOW = {
  kind: 'flow' as const,
  caption: '한 항목이 채택되기까지',
  nodes: [
    { label: '추출됨', actor: 'claude' as const, says: '드레인이 뽑았다 — 아직 사실로 쓰지 않는다' },
    { label: '검토 중', actor: 'user' as const, says: '근거 위치를 열어 확인한다' },
    { label: '채택', actor: 'user' as const, says: '제품 판단에 써도 된다' },
    { label: '제품 적용', actor: 'user' as const, says: '어느 모듈에 쓰였는지 기록' },
  ],
  branch: [{ when: '근거가 약하거나 틀림', then: '반려 — 이유를 적지 않으면 DB 가 거부한다' }],
}

export const KNOWLEDGE_HELP: HelpRegistry = {
  // ───────────────────────────────────────────────────────────
  // /admin/knowledge — 원리 지도
  // ───────────────────────────────────────────────────────────
  knowledge: {
    title: '원리 지도',
    screen: {
      summary:
        '영어 학습의 본질·원리·방법론·공부법이 층마다 몇 개이고 어느 상태인지, 무엇을 모르는지를 한 장으로 본다. 수치는 열 때마다 DB 를 다시 센 값이다.',
      diagrams: [LAYER_FLOW],
      fields: [
        { label: '층 × 상태 표', detail: '「·」는 0 이다. 채택 칸이 비어 있으면 그 층은 아직 제품 판단에 쓸 근거가 없다는 뜻이다.' },
        { label: '열린 공백', detail: '조사했지만 모르는 것. 공백이 0 이라고 다 아는 게 아니다 — 막힌 곳을 공백으로 남겨야 보인다.' },
        { label: '기출 원천', detail: '수능·모평 지문이 온 책·논문. 등급 A 만 「확인」이다. B 는 후보, C 는 같은 소재의 다른 원천, G 는 미확인.' },
      ],
      cautions: [
        '원리 7개는 학습 과학 씨앗이라 「검토 중」으로 들어왔고 근거가 아직 연결되지 않았다(공백 1건). 채택 전에 1차 연구 서지를 붙인다.',
      ],
    },
  },

  'knowledge-principles': {
    title: '본질 · 원리',
    screen: {
      summary:
        'L1 본질(이 영역에서 잘한다는 것)과 L2 원리(왜 그렇게 배워지는가). 개수가 적고 오래가는 층이다.',
      diagrams: [LAYER_FLOW],
      fields: [
        { label: '근거 없음', detail: '연결된 근거가 0 이다. 이 상태로 채택하지 않는다.' },
        { label: 'v 번호', detail: '문장이 바뀔 때마다 DB 가 올린다. 버전이 오르면 연결된 방법론을 다시 본다.' },
      ],
      cautions: [
        '본질은 자동 추출로 만들지 않는다 — 기출 원천 같은 관찰을 근거로 사람이 쓰고, 분석자 추론(inferred)으로 표시한다.',
        '표본이 작은 관찰로 전체를 단정하지 않는다. 기출 원천 화면의 현재 등급·모집단과 조사 날짜를 확인하고 문장에 표본 크기를 함께 적는다.',
      ],
    },
  },

  'knowledge-methods': {
    title: '방법론 · 공부법',
    screen: {
      summary:
        'L3 방법론(원리를 한 영역에 쓰는 절차)과 L4 공부법(학습자가 오늘 하는 루틴). 조건 칩(학령·숙련도·시험·과정)이 다르면 같은 문장이라도 다른 항목이다.',
      diagrams: [LAYER_FLOW],
      cautions: [
        '전문가 여럿이 같은 말을 해도 효과가 검증된 것은 아니다. 효과 강도는 연구 설계가 확인된 근거가 있을 때만 적는다.',
        '같은 강사의 재업로드·쇼츠는 독립 근거가 아니다 — 근거 수를 부풀리지 않는다.',
      ],
    },
  },

  'knowledge-review': {
    title: '검토 대기',
    screen: {
      summary: '「추출됨」·「검토 중」 항목. 사람이 근거를 확인해야 채택으로 간다.',
      diagrams: [STATUS_FLOW],
      steps: [
        { title: '근거 위치를 연다', detail: '영상은 초 위치, 문서는 절 위치로 연다. 제목·챕터 이름만으로는 근거가 아니다.' },
        { title: '기존 항목과 겹치는지 본다', detail: '표현이 비슷해도 조건이 다르면 합치지 않는다. 자동 병합은 없다.' },
        { title: '채택하거나 반려한다', detail: '반려에는 이유가 필요하다(DB 제약). 상태 변경은 검토 기록에 자동으로 남는다.', done: '항목이 이 목록에서 사라지고 원리 지도의 채택 칸이 늘어난다.' },
      ],
    },
  },

  'knowledge-item': {
    title: '항목 상세',
    screen: {
      summary:
        '한 항목이 어느 위층에 기대고 어느 아래층을 떠받치는지, 무엇을 근거로 하는지 본다. 오른쪽에서 상태를 바꾸고, 층을 잇고, 근거를 붙인다.',
      diagrams: [STATUS_FLOW],
      steps: [
        { title: '근거를 먼저 붙인다', detail: '링크(https)면 등급을 직접 고르고, 기출 원천이면 원천의 등급을 그대로 쓴다. 미확인(G) 원천은 근거가 될 수 없다.' },
        { title: '위층에 잇는다', detail: '「위 층을 구현한다」는 바로 위 층만 고를 수 있다. 옆 관계(보완·반대·조건만 다름·중복 후보)는 층을 가리지 않는다.' },
        { title: '상태를 바꾼다', detail: '검토 중 → 채택은 근거가 1개 이상일 때만. 반려는 이유가 필수다.', done: '검토 기록 맨 위에 새 줄이 생긴다.' },
      ],
      fields: [
        { label: '귀속', detail: '「출처가 직접 말함」(권고) · 「수업 진행 관찰」 · 「분석자 추론」을 가른다. 영상의 수업 순서를 강사의 권고로, 추론을 전문가의 말로 쓰지 않는다.' },
        { label: '등급 A', detail: '그 주장을 원문 위치(영상 초 구간·문서 절)까지 대조했다는 뜻이다. 효과가 과학적으로 검증됐다는 뜻이 아니다 — 효과는 「효과」 칸이 따로 다룬다.' },
        { label: '메모', detail: '근거 내용을 재서술해 적는다. 자막·지문·본문을 옮겨 적지 않는다.' },
        { label: 'v 번호', detail: '문장이 바뀌면 DB 가 올린다. 이 항목에 기대는 아래층을 다시 볼 신호다.' },
      ],
      cautions: [
        '화면을 연 뒤 근거가 추가·삭제되거나 기출 원천 등급이 바뀌면, 채택·반려 버튼은 「화면을 연 뒤 근거가 바뀌었습니다」로 거부된다 — 본 근거와 저장된 근거가 다른 채로 판단하지 않게 하는 장치다. 새로 고쳐 근거를 다시 본 뒤 누른다.',
        '두 사람이 같은 항목의 상태를 동시에 바꾸면 먼저 저장한 쪽만 반영되고, 나중 쪽은 「그 사이 다른 사람이 상태를 바꿨습니다」 오류를 본다(덮어쓰지 않는다). 새로 고친 뒤 다시 판단한다.',
      ],
    },
  },

  'knowledge-sources': {
    title: '근거 · 출처',
    screen: {
      summary:
        '출처 종류별로 무엇이 들어와 있고 항목에 얼마나 연결됐는지 본다. 어떤 출처도 원문(자막·지문·본문)을 저장하지 않는다 — 링크·위치·서지만.',
      fields: [
        { label: '가져오기 원장', detail: '방법론 조사 스냅샷(methodology_*). 한 번 가져온 스냅샷은 바뀌지 않고, 새로 가져오면 새 스냅샷이 생긴다.' },
        { label: '항목에 연결된 근거', detail: '출처가 들어와 있어도 항목에 연결되지 않으면 판단에 쓰이지 않는다.' },
      ],
      cautions: [
        'YouTube 자막은 자동 수집하지 않는다(봇 차단 우회 금지). 공식 대본이 있는 곳(BBC·VOA·British Council)이나 사람이 넣은 텍스트만 쓴다.',
      ],
    },
  },

  'knowledge-csat-origins': {
    title: '기출 원천',
    screen: {
      summary:
        '수능·평가원 모의평가 지문이 발췌된 책·논문. 최초 조사와 후속 검수를 함께 반영하며, 지문 원문 없이 문항 번호·서지·근거 링크·등급만 보인다.',
      diagrams: [
        {
          kind: 'flow',
          caption: '등급은 이 순서로 약해진다',
          nodes: [
            { label: 'A 직접 확인', actor: 'auto', says: '원문 위치까지 대조했다', state: 'pass' },
            { label: 'B 유력 후보', actor: 'auto', says: '부분 근거 유추 등록 포함 — 확인 범위·불확실성 기록', state: 'short' },
            { label: 'C 계보만', actor: 'auto', says: '같은 소재의 다른 원천', state: 'short' },
            { label: 'G 미확인', actor: 'auto', says: '검색으로 원천을 찾지 못했다', state: 'unmeasured' },
          ],
        },
      ],
      fields: [
        { label: '문항', detail: '같은 지문을 여러 문항이 쓰면(41–42번 등) 한 줄에 모두 적는다.' },
        { label: '근거', detail: '원작·출판사·저자 기고·학술 재인용·판본 링크. 시험 재게시물의 서지는 탐색 단서이며 그 자료만으로 귀속하지 않는다. 부분 근거 유추는 확인 범위·차이·불확실성을 함께 기록한다.' },
      ],
      cautions: [
        '씨앗 파일은 2026-09-28 시점 자료다. DB 에서 판정을 고친 뒤(예: A→B) 다시 돌려도 덮지 않고 「충돌」로만 보고한다 — 파일이 맞다고 판단되면 그 행만 사람이 고친다(재등급 트리거가 연결 근거와 채택 항목을 함께 처리한다).',
        '접근 제한·시험 편집·재인용과 판본 차이·검색 단서 부족은 자동 보류 사유가 아니다. 고유 구절·내용 전개·서지 연결로 차이를 설명할 수 있으면 B 유추 등록을 허용한다. 소재만 비슷하거나 귀속이 충돌하면 추가 조사한다.',
        '전체 검색 완료는 전체 원천 확인 완료가 아니다. 직접 대조한 A와 부분 근거로 등록한 B를 구분한다. 확인 범위와 미확인 문장·판본을 남기며 시험 후 발행 판본을 시험 사용 판본으로 지정하지 않는다. 장 저자와 편집자·인용 학자를 구분한다. 원천 확인은 원문 재사용 허가를 뜻하지 않는다.',
      ],
      drain: {
        what: 'Codex 원천 조사 결과를 등록부(knowledge_csat_origins)에 적재한다.',
        prerequisites: ['docs/reports/csat-source-origin-results-20260928.jsonl 이 있다', 'apps/web/.env.local 의 service role 자격'],
        procedure: [
          { title: '미리보기', detail: 'node scripts/knowledge/import-seed.mjs — 등급별 개수만 출력하고 쓰지 않는다.' },
          { title: '적재', detail: 'node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/knowledge/import-seed.mjs --commit', done: '「원천 새로 N · 같음 M · 충돌 0」 — 충돌이 0 이 아니면 아래 주의를 본다' },
          { title: '새 구절로 조사한다', detail: '기존과 다른 짧은 구절을 검색하고 빈칸·순서·삽입문을 복원한다. source-origin-search.mjs의 alternativeQueries는 문장·시험 블록 안의 희소 네 단어 구절과 두 구절 조합을 만든다. 질의 준비와 실제 검색 횟수는 구분하며 재실행 전에 DB 상태·본문 SHA를 다시 읽어 등록된 A/B는 건너뛴다. 원문 직접 대조는 A, 부분 인용·저자 기고·판본을 연결한 유추는 B로 기록한다. B에는 distinctive_match·content_sequence·bibliographic_link·checked_scope·explained_difference·remaining_uncertainty를 모두 쓴다. 공개 미리보기의 목차·색인은 목표 문단 확인이 아니며 접근 실패는 검색 0건이 아니다. 도표 데이터 원천과 영어 설명문 발췌 원천은 확인 범위를 구분한다. 확정·유추·보류 모두 연결 문항별 현재 본문 SHA·URL·확인 범위를 남긴다. 검색은 DB를 쓰지 않으며 같은 본문에서는 재실행 안전하다. 본문이 바뀌면 재검수한다.' },
          { title: '후속 검수 미리보기', detail: '현재 원천 행의 변경 전후 값·연결 문항별 본문 SHA를 manifest에 넣고 node scripts/csat/source-origin-review.mjs --input <검수.json> --output <preview.sql>로 SQL을 만든다. 생성 단계는 DB를 쓰지 않으며 재실행 안전하다.' },
          { title: '후속 검수 적용', detail: 'preview SQL을 DB에서 확인해 모두 ready일 때 --commit-sql로 적용 SQL을 만든다. 생성만으로 적용되지 않는다. 체크포인트 전후를 찍고 승인된 DB 실행 도구로 한 트랜잭션을 실행한다. 이미 적용한 같은 검수는 건너뛰며 충돌은 전체를 중단한다.' },
        ],
        verify: ['현재 DB 집계를 해당 회차 보고서와 대조한다. 수능과 모의평가, 지문 수와 연결 문항 수를 구분한다.', '후속 검수 preview를 다시 실행하면 전부 already_applied이며, 기존 공백의 미확인 수·다음 작업도 실제 집계와 맞아야 한다.'],
        recovery: ['초기 적재는 기존 원천을 덮지 않는다. 후속 검수는 동일 전후 값·본문 SHA일 때만 재실행 안전하다. 충돌은 현재 행과 본문을 다시 읽어 재검수하며, 강제로 덮지 않는다.'],
      },
    },
  },

  'knowledge-experts': {
    title: '전문가 · 채널',
    screen: {
      summary: '근거로 삼는 강사·연구자와 그 소유 채널. 가져오기 원장 최신 스냅샷에서 읽는다. 목록은 순위가 아니다.',
      fields: [
        { label: '후보 / 프로필 확인', detail: '후보는 공식 자료에서 이름만 확인한 사람, 프로필 확인은 공식 본문을 읽은 사람이다.' },
      ],
      cautions: [
        '학원·방송 채널은 여러 강사 영상이 섞여 있다. 채널 영상을 특정 강사의 근거로 쓰기 전에 강사를 확인한다.',
      ],
    },
  },

  'knowledge-gaps': {
    title: '공백',
    screen: {
      summary: '조사했지만 모르는 것. 원인과 다음 행동을 함께 둔다. 공백은 실패가 아니라 다음 조사의 목록이다.',
      fields: [
        { label: '영향', detail: '이 공백 때문에 판단할 수 없는 대상의 수(예: 원천 미확인 지문 수).' },
        { label: '원인', detail: '자막 미확보 · 권리 미확인 · 찾지 못함 · 아직 조사 안 함 · 검증 불가. 원인마다 다음 행동이 다르다.' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────
  // /admin/methodology — 가져오기 원장 (Codex 2026-09-19 워크벤치)
  // ───────────────────────────────────────────────────────────
  methodology: {
    title: '가져오기 원장',
    screen: {
      summary:
        '방법론 조사 스냅샷(전문가·채널·출처·주장·근거)을 그대로 읽는다. 스냅샷은 바뀌지 않는다 — 항목을 검토·채택하는 일은 학습 원리 등록부에서 한다.',
      cautions: ['스냅샷의 방법 4개는 조사 초기 자료다. 학생 성과를 입증한 연구로 읽지 않는다.'],
    },
  },
}
