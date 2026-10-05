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
          { title: '공개 원문 cohort를 먼저 종료한다', detail: '고정 cohort·구절 family를 유지하고 public_fulltext의 각 문항을 found / plausible-but-unverified / exhausted로 기록한다. 후보가 없으면 특정 책 내부 검증은 해당 없음이다. exhausted는 정한 공개 경로에서 증거가 부족했다는 뜻이며 출처 부재가 아니다. 독립 원작 후보와 시험 재배포·주제 유사 히트를 구분한다. 모든 구절 평가와 적용 가능한 후보 검수가 끝난 discovery closure를 먼저 고정한다. DB 쓰기 없는 조사이며 같은 대상 재확인 안전, 기존 closure를 새 결과로 덮지 않는다.' },
          { title: '새 증거가 생긴 B만 승격 검수한다', detail: 'B 전체 정기 재탐색은 하지 않는다. 동일 문항·본문 SHA·후보 ID에 새 edition/pdf/page_image/original_snippet evidence ID가 들어올 때만 promotionEvidenceEvent로 큐 적격을 판단한다. 이미 본 evidence ID는 건너뛰며 재실행 안전하다. 사유는 edition_uncertain / partial_context_only / secondary_quote_only / page_not_verified / bibliography_only / text_match_partial이며 priority는 high/medium/low다. 깊이만으로 A를 부여하지 않는다. --public-metrics는 기존 종료 기록과 실제 등록을 대조해 실측 전이를 계산한다. DB 쓰기 없음; 등록은 before/after·본문 SHA에 묶인 preview→transaction→재검증 순서다.' },
          { title: 'Books 증분 실험과 소진 상태를 보존한다', detail: '공개 종료 후 freezePublicBaseline으로 50개 현재 상태·후보 ID/검수된 alias·본문 SHA를 동결한다. 로컬 investigationState의 G_PUBLIC_EXHAUSTED 37개와 G_STRONG_CANDIDATE_UNVERIFIED 1개는 같은 공개 검색을 반복하지 않으며 API pending은 별도 속성이다. 새 retriever는 동일 cohort를 조사한다. --books <plan> <log> <최신행> --benchmark --stage smoke|canary|full|retry --public-baseline <기준선>을 사용한다. 기준선은 HTTP 전 검증하며 기존12개는 control이고 신규성과에서 제외한다. *.incremental-review-queue.json의 미등록 문항 신규 후보만 검수한다. outcomes에는 plausible_candidate 불리언을 기록하며 A/B는 실제 등록 후 집계한다. 후보 비율은 정상161질의 완료 후, 신규 A/B 비율은 신규 top-N 검수 종료 후 확정한다. 미완료·분모0은 null이며 smoke/canary 통과를 건너뛰지 않는다. 신규 유력 후보 문항 5개 이상이면 Books 확장, 2–4개면 학술 cohort 준비, 0–1개면 다음 허용 lane을 검토한다. 임계값은 운영 규칙이며 자동 확장·전체 수율 예측이 아니다. DB 쓰기 없고 성공 질의 로그를 재개하므로 같은 로그/기준선 재실행 안전하다.' },
          { title: '자격과 라이선스를 따로 확인한다', detail: 'Books 공개 volume 검색은 사용자 OAuth 없이 API key로 앱을 식별한다. 프로젝트 ID만으로 실행하지 않는다. 키는 Books API로 제한하고 활성화 여부는 smoke의 응답으로 확인한다. Semantic은 x-api-key와 별도로 사용 목적·라이선스 확인이 필요하다. SEMANTIC_SCHOLAR_USAGE=internal_research/product_db/unresolved, SEMANTIC_SCHOLAR_LICENSE_STATUS=research_allowed/expanded_license_required/unresolved를 닫힌 값으로 읽는다. 내부라는 이유만으로 비상업 연구 허용을 확정하지 않는다. 제품 DB 활용은 Expanded License 승인을 확인한 뒤 SEMANTIC_SCHOLAR_EXPANDED_LICENSE_APPROVED=true로 기록한다. 기본 unresolved는 호출 전 차단한다. 키 원문·일부·prefix·hash를 로그나 Git에 쓰지 않는다.' },
          { title: '고정 질의로 단계별 실행한다', detail: '--stage smoke는 기존 질의 1개로 자격·JSON schema를 확인하며 후보·snippet을 저장하지 않고 metadata만 남긴다. 성공하면 --stage canary로 같은 고정 집합의 앞 5개를 실행하고 rate-limit·quota·로그를 확인한다. --stage full 또는 retry는 동일 cohort·프로젝트·라이선스 정책에 묶인 smoke와 canary 성공 증거가 있어야 실행한다. 이미 정상 완료한 질의는 건너뛰고 실패 질의만 같은 질의로 재시도한다. .metrics.json의 queries_eligible·blocked_credentials·blocked_license를 completed와 분리해 읽는다. 차단 사유는 중복될 수 있으며 429나 차단을 검색 0건으로 해석하지 않는다. 공개 원문 조사 성과는 public_fulltext로만 집계한다.' },
          { title: '실험 기준선을 보존한다', detail: 'benchmark 실행 전 생성하는 .baseline.json은 고정 cohort·본문 SHA와 시작 시 등록 상태를 보존한다. DB 등록 후 재집계할 때도 같은 기준선 파일을 유지한다. 기준선을 지우거나 다른 실험 로그로 바꾸면 신규 A의 시작 기준이 달라지므로 기존 로그와 함께 보관한다. 내용 또는 cohort가 달라진 기준선은 실행 전에 거부한다.' },
          { title: '고정 API 비교를 완료한다', detail: '원문 출처 실험은 기존 50개·161개 query family를 유지한다. --books <plan> <log> <최신행> --benchmark와 --semantic-fixed <plan> <log> <최신행>은 이미 등록된 양성 대조군도 포함한다. GOOGLE_BOOKS_API_KEY·GOOGLE_BOOKS_API_PROJECT·SEMANTIC_SCHOLAR_API_KEY는 환경에서만 읽고 자격이 없으면 HTTP 호출 없이 미실행으로 기록한다. Semantic 호출은 한 Node 프로세스에서 직렬 1RPS로 진행하므로 benchmark CLI는 하나만 실행한다. 429·일시 오류는 최대 3회 재시도하고 30초를 넘는 Retry-After는 다음 실행까지 대기 기한을 보존한다. 성공 캐시만 재사용하므로 재실행 안전하며 DB 쓰기는 없다.' },
          { title: 'API 비교 종료 조건을 확인한다', detail: '.metrics.json의 availability·retrieval·verification을 각각 확인한다. 동일 후보 ID의 top 3만 검수하고 --reviews 파일에 현재 registry·본문 SHA와 판정을 기록한다. 161개 질의의 정상 응답과 상위 후보 검수가 모두 끝나기 전에는 수율을 null로 유지한다. 공개 PDF에서 확인한 기존 A는 public_fulltext 성과이며 API 신규 A로 합산하지 않는다. 후보 순위·부분 snippet만으로 A를 자동 등록하지 않는다.' },
          { title: '미리보기', detail: 'node scripts/knowledge/import-seed.mjs — 등급별 개수만 출력하고 쓰지 않는다.' },
          { title: '적재', detail: 'node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/knowledge/import-seed.mjs --commit', done: '「원천 새로 N · 같음 M · 충돌 0」 — 충돌이 0 이 아니면 아래 주의를 본다' },
          { title: '새 구절로 조사한다', detail: '기존과 다른 짧은 구절을 검색하고 빈칸·순서·삽입문을 복원한다. source-origin-search.mjs의 alternativeQueries는 문장·시험 블록 안의 희소 네 단어 구절과 두 구절 조합을 만든다. 질의 준비와 실제 검색 횟수는 구분하며 재실행 전에 DB 상태·본문 SHA를 다시 읽어 등록된 A/B는 건너뛴다. 원문 직접 대조는 A, 부분 인용·저자 기고·판본을 연결한 유추는 B로 기록한다. B에는 distinctive_match·content_sequence·bibliographic_link·checked_scope·explained_difference·remaining_uncertainty를 모두 쓴다. 공개 미리보기의 목차·색인은 목표 문단 확인이 아니며 접근 실패는 검색 0건이 아니다. 도표 데이터 원천과 영어 설명문 발췌 원천은 확인 범위를 구분한다. 확정·유추·보류 모두 연결 문항별 현재 본문 SHA·URL·확인 범위를 남긴다. 검색은 DB를 쓰지 않으며 같은 본문에서는 재실행 안전하다. 본문이 바뀌면 재검수한다.' },
          { title: 'API와 공개 본문을 대조한다', detail: 'source-origin-search.mjs <현재행.json> <검색.jsonl>은 도서·학술 후보 로그만 만든다. snippet은 일반 텍스트 검색이며 exact/proximity 특수 문법을 쓰지 않는다. 429·접근 거부는 결과 0건이 아니며 같은 provider의 남은 질의는 미실행으로 남긴다. 성공한 동일 질의·본문 해시만 건너뛰고 장애는 다음 실행에서 다시 시도한다. 새 로그 경로는 전량 재검색이다. --oa는 OA PMCID 본문을 로컬 문단과 참고문헌 연결로 분리하며 캐시 본문을 확인한다. --local은 역색인·편집 정렬의 순위만 만든다. 참고문헌 marker·부분 단어 중복·후기 판본은 원작 귀속이 아니며 A/B 검수로 별도 확인한다. DB는 이 단계에서 변경하지 않는다.' },
          { title: '응답과 캐시를 확인한다', detail: '총 건수는 양수인데 결과 배열이 비면 invalid_response로 남겨 재시도한다. 손상된 XML 캐시는 원격 본문을 다시 받아 유효한 응답으로 교체한다. 로컬 순위는 원문·블록 해시, 서지, 인용 연결, 시점의 미확인, 문서 역할을 보존한다. 높은 점수만으로 A/B를 부여하지 않는다.' },
          { title: '도서 lane을 고정한다', detail: 'source-origin-search.mjs --book-plan <현재행.json> <시험.json> <plan.json>으로 G 전량의 도서/학술/웹 우선 경로와 수능 book-likely 상위 50개를 고정한다. 문체 점수는 출처 장르·확률이 아니며 A/B 참고 등급·미분류·경로 중첩을 보존한다. 새 plan은 새 비교 집합이다. --books <고정plan.json> <검색.jsonl> <최신행.json>은 cohort identity SHA를 재계산해 대상/질의 변조를 거부한다. 현재 연결 본문 SHA가 바뀌면 중단하고 등록된 행을 건너뛴다. 캐시만 사용해도 기존 로그의 누적 성과·고정 분모 50·등록 완료·남은 대상 수를 출력한다. 3–4 구절 family·40건/페이지·기본 2페이지 제한으로 후보 서지만 저장하며 후기 판본을 검수 우선 점수에서 감점한다. 성공한 동일 질의·본문·페이지·필터만 재개하며 429는 남은 미실행을 남긴다. DB 쓰기 없음, 본문/상태 재조회 후 재실행 안전하다.' },
          { title: '책 내부 검색을 확인한다', detail: '책이 특정되면 공개 Google Books reader의 알려진 volume ID와 고유 구절로 해당 위치를 확인한다. Open Library/IA는 후보 책의 item ID·실제 data host와 공개 스캔이 있는 경우에 검증한다. 검색 조각 성공은 v1 API 쿼터 회복·전체 본문 열람이 아니다. retriever·candidate_rank·verification_depth와 쪽·편집·판본 불확실성을 남기며 검색 조각만 읽으면 B로 검수한다. 대상 문단 전체를 직접 읽어 대조한 경우에만 A 승격한다. 깊이 값·높은 후보 순위만으로 자동 승격하지 않는다. 목표와 다른 쪽의 결과만 있으면 기존 등급을 유지한다. DB 쓰기 없음, 재검색 안전하다.' },
          { title: 'retriever 성과를 비교한다', detail: '후보 수·검수 수·신규 A/B·B→A·실제 검색 대상·미실행·검수 작업량을 각각 기록한다. 누적 집계는 고정 cohort의 대상·본문·질의 family·페이지·필터·페이지 크기가 맞는 로그만 포함하고 다른 실험의 제외 수를 표시한다. 제목 발견과 PDF/전사 검증 경로를 연결하되 승격 성과를 두 retriever에 중복 합산하지 않는다. 도서 사이트 한정 웹 검색은 Books API full-text 실험이 아니다. 429로 정상 검색 0개인 API의 수율을 0%로 만들지 않는다. 시간·예산을 재지 않은 회차는 우세 판정에 쓰지 않는다. 도서 이후 Semantic snippet은 일반 텍스트 검색과 자체 alignment로 검수한다. DB 쓰기 없음, 같은 실험 로그/판정 집계는 재실행 안전하다.' },
          { title: '후속 검수 미리보기', detail: '현재 원천 행의 변경 전후 값·연결 문항별 본문 SHA를 manifest에 넣고 node scripts/csat/source-origin-review.mjs --input <검수.json> --output <preview.sql>로 SQL을 만든다. 생성 단계는 DB를 쓰지 않으며 재실행 안전하다.' },
          { title: '증분 등록과 판본 중복을 묶는다', detail: '--reviews 파일은 outcomes(후보 판정), registrations(선택해 실제 등록한 후보), identity_reviews(기존 공개 후보와 판본 동일성)를 나눈다. registrations는 기존 before/after·item_ids·본문 SHA 검수에 retriever/candidate_id/API candidate_title을 더하고 최신 서지·evidence·감사 필드를 after와 전부 대조한다. 같은 문항에 A/B 후보가 여러 개여도 후보 precision은 각각 세고 등록 문항은 한 번만 센다. 유용한 후보의 등록 연결이 없으면 완료하지 않는다. identity_reviews는 baseline_sha256·본문 SHA·candidate_id·public_candidate_id·same_as_public=true·checked_scope로 묶고 frozen 기준선을 덮지 않는다. 동일 판본 계열로 검수된 재발견은 top-N과 신규 검수 분모에서 제외한다. 집계는 DB 쓰기 없이 재실행 안전하다.' },
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
