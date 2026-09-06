// apps/web/src/lib/admin/help/vocab.ts
//
// VCB — 어휘 구축 (/admin/vocab*) 화면도움말.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.

import type { HelpRegistry, ScreenHelpEntry } from './types'

// /admin/vocab 는 /admin/vocab/runs 로 redirect 한다 — 같은 화면이라 도움말도 공유한다.
const RUNS_ENTRY: ScreenHelpEntry = {
  title: 'VCB Pipeline Runs',
  screen: {
    summary:
      '공용 단어장 하나를 만드는 실행 단위(run)를 만들고, 각 run 이 8단계 중 어디서 멈춰 있는지 본다.',
    when: '새 공용 단어장을 시작할 때, 또는 진행 중인 run 을 이어서 처리할 때.',
    fields: [
      {
        label: '시중 단어장 대비 (종합)',
        detail:
          '세 자의 기하평균이다 — 내용(표제어 칸에 무엇이 있나) · 선택(고르기 전 근거) · 지면(펼쳤을 때 매 쪽 장치). '
          + '**여기서 계산하지 않고 docs/reports/vocab-*-benchmark.json 을 읽는다** — 계산이 두 벌이면 화면과 리포트가 '
          + '다른 수를 말하게 된다. 값을 갱신하려면 각 벤치마크를 돌린 뒤 overall-benchmark 를 돌린다. '
          + '날짜와 "N일 전" 이 함께 뜨므로 낡았는지 화면에서 판단할 수 있다.',
      },
      {
        label: '축 옆의 「천장」',
        detail:
          '지면 지수는 장치가 있거나 없거나라 상한이 있다(17종 ÷ 시장 평균 = 1.153). '
          + '**그 축에 1.20 을 요구하면 영원히 미달로 남으므로 목표가 천장이다** — 천장에 닿으면 ● 로 그린다. '
          + '천장이 없는 축(내용·선택)만 1.20 을 목표로 본다.',
      },
      {
        label: '「학습자가 실제로 여는 화면」 문구',
        detail:
          '선택·지면 지수를 무엇에서 쟀는지다. 「DB 조건」으로 뜨면 그 값은 화면 확인을 안 한 것이라 믿으면 안 된다 — '
          + '2026-09-06 에 선택 지수가 열리지 않는 모달을 근거로 1.288 을 내고 있었고, 지면에서 재니 0.94 였다.',
      },
      {
        label: 'Active',
        detail:
          '보강 중 · QA 검증 중 · 큐레이션 중 상태의 run 수. 이 셋만 사람 손이 필요한 단계다.',
      },
      {
        label: 'Failed',
        detail:
          'run 자체가 실패 상태로 남은 것. 개별 단어의 보강 실패는 여기 잡히지 않고 run 상세의 "실패" 지표에 잡힌다.',
      },
      {
        label: '카드의 N / M · % 완료',
        detail:
          '(보강 완료 + 실패) ÷ 총 시드. 보강 진척률이지 발행 진척률이 아니다 — 100% 여도 큐레이션·발행은 남아 있다.',
      },
      {
        label: 'New Run',
        detail:
          'run 껍데기만 만든다. 단어는 하나도 들어가지 않고, 시드 확보는 run 상세에서 방식 A(파일) 또는 B(AI 생성)로 한다.',
      },
    ],
    cautions: [
      'collection_slug 는 run 전체에서 유일해야 한다. 이미 쓴 슬러그로 새 run 을 만들면 "already exists (run #N)" 로 생성이 막힌다.',
    ],
    seeAlso: [
      { label: 'Sources — 시드 출처', href: '/admin/vocab/sources' },
      { label: '발행 컬렉션', href: '/admin/vocab/collections' },
    ],
  },
}

export const VCB_HELP: HelpRegistry = {
  // `vocab` 키는 두지 않는다 — `/admin/vocab` 은 `redirect('/admin/vocab/runs')` 한 줄이라
  // 도움말 버튼을 그릴 화면 자체가 없다. 별칭으로 남겨 두면 "쓰이는 줄 알고 갱신되는 문서" 가
  // 되고, 낡아도 아무도 모른다(레지스트리 고아 검사가 이걸 잡는다).
  'vocab-runs': RUNS_ENTRY,

  // VCB 11개 화면 중 **유일하게** 도움말이 없던 곳인데, 하필 되돌릴 수 없는 동작 둘을 쥐고
  // 있었다 — 재생성(파일 삭제 + 거부표시 초기화)과 수천 건 DB 적재.
  'vocab-seed-preview': {
    title: '시드 미리보기 — 적재 전 마지막 관문',
    screen: {
      summary:
        'AI 가 만든 시드 낱말을 DB 에 넣기 전에 한 건씩 본다. 여기서 거부한 낱말은 적재에서 빠진다.',
      when: '시드 생성이 끝난 뒤, 「DB 에 import」를 누르기 전에.',
      steps: [
        {
          title: '필터로 의심스러운 것부터 본다',
          detail:
            '레벨·품사·출처로 좁혀 훑는다. 전부 볼 필요는 없다 — 목표에서 벗어난 낱말이 몰려 있는 구간만 보면 된다.',
          done: '거부 표시 수가 늘고 남은 수가 목표에 가까워진다.',
        },
        {
          title: '거부 표시',
          detail:
            '적재에서 뺄 낱말을 표시한다. **브라우저 탭 안에만(sessionStorage) 남는다** — 탭을 닫거나 다른 기기에서 열면 표시가 사라진다. 한 자리에서 끝내라.',
          done: '헤더의 남은 수가 줄어든다.',
        },
        {
          title: 'DB 에 import',
          detail:
            '거부하지 않은 낱말 전부를 이 run 의 큐로 넣는다. 수천 건이 한 번에 들어가고, 끝나면 시드 화면으로 돌아간다. 되돌리려면 run 자체를 새로 만들어야 한다.',
          done: 'run 상태가 다음 단계로 넘어가고 Run 상세의 Step 4(사전 매칭)가 열린다.',
        },
      ],
      cautions: [
        '재생성은 **복구 불가** — seed-list 파일을 지우고 거부 표시까지 초기화한 뒤 생성 단계로 되돌린다. 지금 목록이 마음에 안 들 때만 누른다.',
        '거부 표시는 sessionStorage 다 — **탭을 닫으면 사라진다.** 검토를 여러 번에 나눠 하려면 그때마다 처음부터 다시 봐야 한다.',
        'import 는 되돌리는 버튼이 없다. 잘못 넣었으면 run 을 새로 만드는 것이 가장 빠르다.',
      ],
      seeAlso: [{ label: 'Run 상세로', href: '/admin/vocab/runs' }],
    },
  },

  'vocab-studio': {
    title: '단어장 Studio',
    screen: {
      summary:
        '단어장 유형(blueprint)을 하나 골라 실 사전·코퍼스로 조립해 보고, 7지표 채점을 통과하면 공용 세트로 발행한다. 8단계 run 과 달리 보강(LLM)을 거치지 않고 이미 있는 사전 데이터만 조합한다.',
      when: '새 공용 단어장을 만들 때. 사전에 없는 단어를 새로 채워 넣어야 하면 여기가 아니라 Runs 로 간다.',
      steps: [
        {
          title: '유형 고르기',
          detail:
            '유형이 정하는 것은 **목차**다 — 어근·주제·짝·일자 중 무엇이 챕터가 되는지가 유형마다 다르다. 카드의 "자산 없음/규모 제한" 표시는 사전 충전율 실측에서 온 것이고, 고를 수는 있지만 결과가 0건이거나 작을 수 있다.',
          done: '카드가 보라 테두리로 바뀌고 아래에 그 유형이 요구하는 값만 나타난다.',
        },
        {
          title: '값 채우기',
          detail:
            '요구 항목만 물어본다(도서·챕터 범위·어휘 목록·주제·일정 등). 슬러그를 비우면 유형 기본 슬러그를 쓰고, **같은 슬러그로 발행하면 그 세트의 단어가 교체된다**(새 세트가 생기지 않는다).',
          done: '요구 항목이 다 찼다. 슬러그를 비워 두고 넘어가면 **기존 세트를 덮게 될 수 있다** — 새 세트를 원하면 여기서 새 슬러그를 적는다(발행 뒤에는 되돌릴 수 없다).',
        },
        {
          title: '미리보기 + 채점',
          detail:
            'DB 를 읽어 조립만 하고 아무것도 쓰지 않는다. 총점·7지표·면별 준비도·깔때기(어디서 몇 개가 떨어졌나)·목차 앞부분이 나온다. 도서 코퍼스는 응답이 수 초 걸린다.',
          done: '총점이 통과선 0.80 이상이면 발행 버튼이 열린다.',
        },
        {
          title: '발행',
          detail:
            '서버가 같은 레시피로 **다시 조립해** 발행한다(화면이 들고 있던 결과를 쓰지 않는다 — 사이에 사전이 바뀌었으면 결과도 바뀌어야 한다). 단어를 넣는 동안 세트는 비공개로 내려가 있고, 다 넣은 뒤 공개로 바뀐다.',
          done: '초록 배너에 슬러그와 단어 수가 찍힌다. 발행 컬렉션 탭과 학습자 Sets 목록에서 보인다.',
        },
        {
          title: '발행 뒤 — 표지·판권면·계단 (이 화면 밖)',
          detail:
            '**발행만으로는 한 권이 되지 않는다.** 여기서 나온 세트는 표지 도판도, 판권면의 검수·대상 수준도 없고, 사다리 자리가 낱말 실측과 어긋나 있을 수 있다. 저장소 루트에서 **이 순서로** 돌린다(전부 드라이런이 기본 · `--commit` 이 있어야 쓴다 · 몇 번을 돌려도 결과가 같다):\n'
            + '① `scripts/vcb/fetch-covers.mts --skip-existing` (표지)\n'
            + '② `scripts/vocab/refresh-published-words.mjs` (사전 따라잡기 — 발음·유의어·반의어·연어를 **빈 칸에만**. 발행은 사전의 스냅샷이라 나중에 사전이 좋아져도 게시된 권은 그대로다)\n'
            + '③ `scripts/vocab/stamp-imprint.mts` (판권면 각인 — 검수 수치·V-Level 중앙값·규격 지문)\n'
            + '④ `scripts/vocab/reconcile-ladder.mts` (계단 재도출)\n'
            + '**순서를 바꾸면 안 된다** — ④ 는 ③ 이 각인한 중앙값을 읽으므로, 각인 전에 돌리면 아무 일도 하지 않고 "고칠 것 0" 만 낸다.',
          done: '`scripts/vocab/choice-benchmark.mts` 의 표지·판권면·시리즈안내 신호가 100% 로 뜬다.',
        },
      ],
      fields: [
        {
          label: '총점 / 통과선 0.80',
          detail:
            '7지표를 유형별 가중치로 합산한 값. 총점이 넘어도 개별 지표가 0.50 미만이면 발행이 막힌다 — 가중치가 낮은 지표 하나가 0 이어도 총점은 0.9 가 될 수 있기 때문이다.',
        },
        {
          label: '면 충전 (fill)',
          detail:
            '이 세트가 훈련한다고 선언한 면(뜻·철자·소리·조립·문맥·속도)의 요구 필드가 실제로 채워진 비율. 소리 면은 녹음 자산이 0% 라 IPA + 브라우저 TTS 로 대체되며 그 경우 1.0 이 아니라 0.7 로 계산된다.',
        },
        {
          label: '신규성 (novelty)',
          detail:
            '이미 발행된 세트와 겹치는 비율. 점수에는 반영되지만 **발행을 막지 않는다** — 수능·빈도 어휘가 여러 세트에 나오는 것은 정상이다.',
        },
        {
          label: '유형 적합 (blueprint_fit)',
          detail:
            '그 유형만의 조건. 짝 유형은 모든 그룹이 2개 이상이어야 하고, 해금·재등장 유형은 같은 단어 수의 빈도순 대조군을 실제로 이겨야 1.0 이 된다.',
        },
        {
          label: '시중 베스트와 비교',
          detail:
            '같은 유형의 시중 대표작(능률 VOCA·해커스 보카·Word Power Made Easy·Collocations in Use·30일 완성·원서 부록 등) 하나를 상대로 16 요소를 견준다. 셀은 `우리 / 기준선`이고 기준선은 **그 책이 지면에서 주는 상한**이다 — 뜻·발음·오류는 1.00 으로 잡혀 있어 동률이 정상이다. ★ 표시는 지면이 구조상 못 하는 요소(개인화·적응 복습·콘텐츠 연결·갱신).',
        },
        {
          label: '깔때기',
          detail:
            '모집단 → 필터 → 차감 → 목표 → 최종. 결과가 예상보다 적으면 여기서 이유가 보인다(register 잡음·예문 없음·짝 없는 그룹 제거 등).',
        },
        {
          label: '통과선 미달을 알고도 발행',
          detail:
            '채점 미달일 때만 나타난다. 되돌리는 버튼은 없고, 같은 슬러그로 다시 발행해 덮는 것이 유일한 복구다.',
        },
      ],
      cautions: [
        '같은 슬러그로 발행하면 그 세트의 기존 단어가 **삭제되고** 새 단어로 교체된다. 구독자가 이미 학습한 단어는 개인 단어장(vocabularies)에 남지만, 세트 쪽 목차는 바뀐다.',
        '학습자 화면은 챕터 제목을 "챕터 안에서 균일한 korean_learner_note" 로 읽는다. 그래서 목차가 있는 세트는 사전의 학습자 노트 대신 그룹 라벨이 들어간다 — 두 값을 같이 담을 컬럼이 없다.',
        '자산 없음 유형(그림·오디오)은 지금 반드시 0건을 낸다. image_url·audio_url 이 45,688행 전부 NULL 이라 설계로 메울 수 없고, 자산 수집이 선행 과제다.',
        '사다리 계단(`ladder_step`)을 쓰는 곳은 **발행 경로와 `reconcile-ladder.mts` 둘뿐이다.** 다른 스크립트로 이 값을 손으로 넣지 말 것 — 규칙이 다른 writer 가 둘이던 동안 `반대말 짝`(사다리가 4단에서 열린다고 정한 원리)이 2단에 앉아 있었다(2026-08-31 실측·교정).',
        '계단은 **청사진이 열리는 바닥**과 낱말 난이도 중 높은 쪽이다. 쉬운 낱말로 만든 유의어 세트라도 초등에 놓이지 않는다 — 묶는 원리가 그 나이의 과제가 아니기 때문이다. 낱말 중앙값이 V8 이상이면 계단을 **비운다**(학령 밖). 그때 판권면은 계단 대신 "대상 수준" 을 싣는다.',
      ],
      seeAlso: [
        { label: '재설계 근거 · 26유형 분류 · 목표', doc: 'docs/VCB_REDESIGN.md' },
        { label: '평가 매트릭스 (러너가 갱신)', doc: 'docs/reports/vcb-compose-eval.md' },
        { label: '발행 컬렉션', href: '/admin/vocab/collections' },
      ],
    },
  },

  'vocab-runs-new': {
    title: 'New VCB Run',
    screen: {
      summary:
        '프리셋을 골라 슬러그·제목·대상만 정하고 run 을 만든다. 어떤 단어가 들어갈지는 여기서 정해지지 않는다.',
      steps: [
        {
          title: '유형 선택',
          detail:
            '프리셋 안의 변형(수능 코어 → 필수 2,000 등)을 고르면 다음 단계의 슬러그·제목·대상·CEFR 이 자동으로 채워진다. 사용자 정의를 고르면 빈 값으로 시작한다.',
          done: '카드에 선택 표시가 되고 우측 하단 다음 이 활성화된다.',
        },
        {
          title: '단어장 정보',
          detail:
            '슬러그는 소문자·숫자·하이픈 3~80자. 이 값이 발행 시 공용 단어장의 slug 가 되고, 이후 바꿀 수 있는 화면이 없다. 생성하면 곧바로 run 상세로 이동한다.',
          done: 'run 상세가 열리고 상태 배지가 생성됨 이다.',
        },
      ],
      fields: [
        {
          label: '변형의 "약 N단어"',
          detail:
            '규모 감을 주는 안내 문구다. 이 숫자가 필터로 쓰이지는 않는다 — 실제 단어 수는 시드 단계(방식 A/B)에서 정해진다.',
        },
        {
          label: '대상 (target_segment)',
          detail:
            '발행 시 공용 단어장의 카테고리로 매핑된다(고교→high, TOEIC→eng_test 등). 값이 비거나 잘못되면 발행 사전점검이 막는다.',
        },
      ],
      cautions: [
        '생성 후 슬러그·제목·대상·CEFR 을 고치는 화면이 없다. 잘못 만들었으면 다른 슬러그로 새 run 을 만들어야 한다.',
      ],
    },
  },

  'vocab-run-detail': {
    title: 'VCB Run 상세',
    screen: {
      summary:
        'run 하나를 시드 확보부터 발행까지 순서대로 진행시키는 작업대. 단계 카드는 run 상태에 도달해야 나타난다.',
      when: 'run 을 만든 직후부터 발행까지 계속. 어느 단계인지 모르겠으면 상단 진행 막대의 "다음 할 일"을 본다.',
      steps: [
        {
          title: '시드 확보',
          detail:
            '방식 A(업로드한 소스 파일에서 추출)와 방식 B(AI 시드 생성) 중 하나만 하면 된다. 둘 다 끝나면 상태가 추출 완료 가 된다.',
          done: '지표의 총 시드 가 0 이 아니게 된다.',
        },
        {
          title: '사전 매칭 (Step 4)',
          detail:
            '시드를 내부 사전과 대조해 이미 뜻이 다 있는 단어는 보강 완료로, 부족하거나 없는 단어는 보강 대기로 나눈다. LLM 을 쓰지 않아 비용이 없고 수천 건도 수십 초다.',
          done: '결과 상자에 full / partial / miss 수가 뜨고 지표의 대기 중 이 채워진다.',
        },
        {
          title: 'AI 보강 (Step 5)',
          detail:
            'Export 실행 으로 대기 중 단어를 200개씩 JSONL chunk 로 내보낸 뒤, Claude Code 에서 보강하고 chunk 마다 DB import 한다. 아래 드레인 절차 참조.',
          done: '지표의 대기 중 0 · 보강 완료 가 총 시드에 근접.',
        },
        {
          title: 'QA 게이트 (Step 6)',
          detail:
            '보강 결과에 규칙 검사를 돌려 통과 / 플래그 / 실패로 나눈다. 플래그는 버려지지 않고 큐레이션에서 사람이 판단한다.',
          done: '결과 상자의 passed · flagged · failed 수치. 상태가 QA 검증 중 이 된다.',
        },
        {
          title: '큐레이션 (Step 7)',
          detail:
            '큐레이션 시작 을 누르면 별도 화면에서 단어별 승인/거절을 한다. 플래그뿐 아니라 QA 통과 항목까지 전부 결정이 있어야 발행이 열린다.',
          done: '발행 카드의 blocker 목록에서 "미검토" 항목이 사라진다.',
        },
        {
          title: '발행 (Step 8)',
          detail:
            '사전점검이 통과하고 확인 체크를 해야 버튼이 열린다. 발행은 세트·단어·컬렉션을 한 트랜잭션으로 커밋하므로 중간에 끊겨도 반쪽 상태가 남지 않는다.',
          done: '발행 결과 섹션에 세트가 뜨고 상태 배지가 발행됨 이 된다.',
        },
      ],
      fields: [
        {
          label: '대기 중 / 보강 완료 / 플래그 / 실패 / 승인',
          detail:
            '모두 queue 행 기준이다. 승인 은 큐레이션에서 최신 결정이 승인 또는 수정인 항목 수이고, 이 값이 그대로 발행 대상 건수가 된다.',
        },
        {
          label: '단계 카드가 안 보일 때',
          detail:
            '카드는 run 상태로 노출이 정해진다 — 사전 매칭은 추출 완료 이후, 보강은 사전 매칭 완료 이후, QA 는 보강 중 이후에 나타난다. 시드 카드는 발행 중·발행됨 에서 숨는다.',
        },
        {
          label: '무결성 미스매치 배지',
          detail:
            '발행된 단어 수와 승인 수가 다를 때만 뜬다. 발행 자체는 성공한 상태이므로 어느 쪽이 맞는지 확인 후 필요하면 새 버전으로 다시 발행한다.',
        },
      ],
      drain: {
        what:
          '보강 대기 단어의 뜻·예문·IPA·CEFR 을 채운 enriched JSONL — DB import 하면 run 의 보강 완료 수치가 올라간다.',
        prerequisites: [
          'run 상태가 사전 매칭 완료 또는 보강 중 이고, 지표의 대기 중 이 1 이상일 것',
          'Step 5 의 Export 실행 을 눌러 chunk 파일이 만들어져 있을 것 (200개 단위, exports/vcb-jobs/ 에 생성)',
          'Claude Code 세션을 저장소 루트에서 열어 둘 것 — 화면의 AI 실행 버튼은 서버에 claude CLI 가 있을 때만 동작하는 로컬 편의 기능이다',
        ],
        procedure: [
          {
            title: 'Export 실행',
            detail:
              '대기 중 단어가 200개씩 나뉘어 exports/vcb-jobs/<타임스탬프>-<슬러그>-pending-01ofNN.jsonl 로 떨어진다. 이때 run 상태가 보강 중 으로 바뀌고 해당 queue 행은 exported 로 마킹된다.',
            done: 'Export pending 줄에 "N개 chunk 생성됨" 과 chunk 목록이 나타난다.',
          },
          {
            title: 'job-slug 확인',
            detail:
              'chunk 파일명에서 -pending 앞부분이 job-slug 다 (예: 20260515-0737-cast-2000). chunk 목록의 파일명을 그대로 읽으면 된다.',
          },
          {
            title: '/vcb-batch-enrich <job-slug> 실행',
            detail:
              'Claude Code 세션에서 실행한다. chunk 당 서브에이전트 하나를 붙여 기본 3개씩 병렬로 돌리고(--wave-size 로 변경), 이미 enriched 파일이 있는 chunk 와 실행 마커가 있는 chunk 는 건너뛴다. 품질을 먼저 보려면 --pilot 로 첫 chunk 만 돌린다.',
            done: '마지막에 chunk 별 OK / FAIL 이 적힌 배치 리포트가 출력된다.',
          },
          {
            title: '화면에서 chunk 상태 확인',
            detail:
              '실행 중에는 카드가 5초마다 자동 갱신된다. chunk 줄에 enriched 건수와 validation: ok 가 뜨면 그 chunk 는 끝난 것이다.',
          },
          {
            title: 'DB import',
            detail:
              'validation 이 ok 인 chunk 에만 DB import 버튼이 생긴다. chunk 마다 눌러 넣거나, 터미널에서 pnpm vcb:import-enriched --file exports/vcb-jobs/<...>-enriched-01ofNN.jsonl 로 넣는다.',
            done: '지표의 대기 중 이 줄고 보강 완료 가 그만큼 는다.',
          },
        ],
        verify: [
          'Step 5 의 모든 chunk 줄이 validation: ok 이고 enriched 건수가 pending 건수와 같다',
          'run 상세 지표에서 대기 중 0 · 보강 완료 가 총 시드 − 실패 와 맞는다',
          'QA 게이트 카드의 "enriched N건" 이 보강 완료 수치와 일치한다',
        ],
        recovery: [
          '중간에 멈춰도 이미 만들어진 enriched 파일은 남는다. 같은 명령을 다시 돌리면 남은 chunk 만 처리하므로 재실행이 안전하다.',
          '특정 chunk 를 다시 만들려면 --chunks NN --force — 기존 enriched 파일은 .bak 로 백업된 뒤 덮어써진다.',
          'import 는 같은 파일을 두 번 넣어도 같은 queue 행을 덮어쓸 뿐이라 중복 적재가 생기지 않는다.',
          'validation 이 fail 이면 import 버튼이 아예 나오지 않는다. 실패 코드를 보고 해당 chunk 를 --force 로 다시 돌린다.',
          'pending 파일을 지웠는데 DB 에는 exported 로 남아 있으면 "파일 사라짐" 배지가 뜬다 — Stale 정리 로 pending 상태로 되돌린 뒤 Export 를 다시 한다.',
          '작업이 죽어 .running.json 마커만 남으면 그 chunk 는 실행 중으로 보인다. exports/vcb-jobs/ 에서 해당 마커 파일을 지우면 다시 실행할 수 있다.',
        ],
      },
      cautions: [
        '사전 매칭 재실행 은 부분 일치·미스 행을 pending 으로 되돌리면서 enriched_payload 와 QA 플래그를 지운다. 보강 결과를 이미 import 한 뒤라면 그만큼 다시 보강해야 한다.',
        '발행은 되돌리는 버튼이 없다. 잘못 발행하면 수정이 아니라 새 버전 발행으로만 교정된다.',
      ],
      seeAlso: [{ label: '발행 컬렉션', href: '/admin/vocab/collections' }],
    },
  },

  'vocab-run-seed': {
    title: 'Seed 등록 (Method B)',
    screen: {
      summary:
        'AI 로 시드 단어 목록을 만들어 검토한 뒤 run 에 적재한다 — 소스 파일이 없을 때 쓰는 경로.',
      when: 'run 상태가 생성됨 또는 수집 중 일 때. 업로드한 파일에서 뽑을 거면 이 화면 대신 run 상세의 방식 A 를 쓴다.',
      steps: [
        {
          title: 'Spec 생성',
          detail:
            '목표 단어 수(50~10,000)·도메인 힌트·포함/제외 키워드를 적어 spec 파일을 만든다. 대상과 CEFR 범위는 run 생성 때 값이 자동으로 들어간다.',
          done: '버튼 옆에 <타임스탬프>-<슬러그>-seed-spec.json 파일명이 표시된다.',
        },
        {
          title: 'AI 시드 목록 생성',
          detail:
            'Claude Code 에서 /vcb-seed-list 로 돌리는 것이 정식 경로다(아래 드레인 절차). 화면의 AI 실행 버튼은 서버에 claude CLI 가 있을 때만 동작하는 로컬 편의 기능이고, 5~15분 걸리며 5초 간격으로 상태를 폴링한다.',
          done: 'seed-list.jsonl 점이 초록이 되고 단어 수가 표시된다. 이 화면에서 실행했다면 잠시 뒤 미리보기로 자동 이동한다.',
        },
        {
          title: '미리보기 후 DB 적재',
          detail:
            '미리보기에서 CEFR 분포·신뢰도를 보고 뺄 단어를 체크한 뒤 적재한다. 적재 시 ai_generated 소스가 자동으로 하나 생기고 run 상태가 추출 완료 로 넘어간다.',
          done: 'run 상세의 총 시드 가 적재 건수와 같아진다.',
        },
      ],
      fields: [
        {
          label: '라이선스 제약',
          detail:
            '생성 프롬프트에 그대로 실려 특정 교재·시험 브랜드·상용 단어 목록을 베끼지 못하게 막는 문장이다. 비우지 말 것.',
        },
        {
          label: 'validation.json',
          detail:
            '생성 직후 검증 스크립트가 남기는 결과다. fail 이면 lemma 중복·CEFR 범위 이탈·필수 키워드 누락 중 하나이므로 적재하지 말고 다시 생성한다.',
        },
      ],
      drain: {
        what: 'spec 을 만족하는 시드 lemma 목록(seed-list.jsonl) + 검증 리포트.',
        prerequisites: [
          '1단계에서 spec 파일이 만들어져 있을 것 (버튼 옆에 파일명이 보인다)',
          '같은 이름의 seed-list.jsonl 이 아직 없을 것 — 있으면 생성이 거부된다',
          'run 상태가 생성됨 또는 수집 중 일 것 (적재가 이 두 상태에서만 가능)',
        ],
        procedure: [
          {
            title: '명령 복사',
            detail:
              '2단계의 "수동 실행" 을 펼치면 /vcb-seed-list exports/vcb-jobs/<spec 파일명> 이 그대로 들어 있다. 이 접힘 영역은 spec 이 있고 아직 생성 전일 때만 보인다.',
          },
          {
            title: 'Claude Code 에서 실행',
            detail:
              '명령이 spec 을 읽고 같은 폴더에 <base>-seed-list.jsonl 을 쓴 뒤 node scripts/vcb/01c-validate-seed-list.mjs 로 검증까지 돌린다. 목표 수량은 ±10% 까지 허용된다.',
            done: '총 개수 · CEFR 분포 · 평균 신뢰도 · 출력 경로가 리포트로 출력된다.',
          },
          {
            title: '화면으로 돌아와 상태 새로고침',
            detail:
              '2단계의 파일 상태 줄에서 seed-list.jsonl 과 validation.json 이 초록인지 확인한다.',
          },
          {
            title: '미리보기에서 적재',
            detail:
              '3단계의 "N건 미리보기" 로 들어가 뺄 단어를 체크한 뒤 적재한다. 제외한 항목은 시드로 들어가지 않는다.',
            done: 'Import 완료 상자에 신규 / 중복 / 전체 건수가 뜬다.',
          },
        ],
        verify: [
          '2단계 파일 상태 줄의 seed-list.jsonl 이 초록이고 단어 수가 목표치 근처다',
          'validation.json 이 ok 다',
          'run 상세의 총 시드 가 적재 건수와 같고 상태 배지가 추출 완료 다',
        ],
        recovery: [
          '다시 생성하려면 exports/vcb-jobs/ 의 <base>-seed-list.jsonl 을 먼저 지워야 한다 — 파일이 있으면 실행이 거부된다.',
          '작업이 죽어 <base>-seed-list.running.json 마커만 남으면 실행 중으로 표시된다. 마커를 지우면 다시 실행할 수 있다.',
          '명령을 여러 번 돌려도 DB 는 적재 시점에만 바뀐다. 적재 자체는 상태가 추출 완료 로 넘어가 두 번 눌리지 않으므로 중복 적재 위험이 없다.',
        ],
      },
      cautions: [
        'Spec 재생성 은 새 타임스탬프로 다른 spec 파일을 만들고 run 이 그 파일을 바라보게 한다. 이전 seed-list 는 디스크에 남지만 화면에서는 추적되지 않는다.',
        '적재는 되돌리는 버튼이 없다. 상태가 추출 완료 로 넘어가면 이 화면의 적재 버튼도 잠긴다.',
      ],
    },
  },

  'vocab-sources': {
    title: 'VCB Sources',
    screen: {
      summary:
        '시드가 어디서 왔는지 대는 출처 등록부. 방식 A 추출은 여기에 파일까지 올린 소스에서만 가능하다.',
      when: '파일에서 단어를 뽑아 run 을 만들기 전, 또는 발행물의 출처 표기를 확인할 때.',
      fields: [
        {
          label: 'T1 / T2 / T3',
          detail:
            'T2 는 발행물에 출처 표기가 따라붙고, T3 는 저장 자체가 DB 제약으로 막힌다. 등록 후 등급을 바꾸는 화면은 없다.',
        },
        {
          label: '파일 경로 표시',
          detail:
            '업로드된 소스에만 초록색으로 저장 키가 보인다. 이 표시가 없는 소스는 run 상세의 방식 A 목록에서 "파일이 없어 추출 불가" 로 빠진다.',
        },
        {
          label: 'N개 run 에서 사용',
          detail: '이 소스로 시드를 넣은 run 수. 0 이면 아직 어떤 단어장에도 반영되지 않았다.',
        },
      ],
      cautions: [
        'Method B 로 시드를 적재하면 "AI Generated Seed for …" 소스가 자동으로 하나 생겨 이 목록에 섞인다 — 사람이 등록한 출처와 구분해서 보라.',
      ],
      seeAlso: [{ label: 'Runs 목록', href: '/admin/vocab/runs' }],
    },
  },

  'vocab-sources-new': {
    title: 'New VCB Source',
    screen: {
      summary:
        '시드 출처를 등록한다. 파일을 함께 올리면 그 소스가 방식 A 추출 대상이 된다.',
      fields: [
        {
          label: 'slug',
          detail:
            '업로드 파일의 저장 경로(<slug>/source.<확장자>)에 그대로 쓰인다. 등록 후 바꾸는 화면이 없으니 처음에 확정할 것.',
        },
        {
          label: 'AI 생성 선택 시',
          detail:
            '라이선스가 T1 로 고정되고 파일 업로드 영역이 사라진다. 사람이 만든 목록이면 큐레이션 리스트 를 고른다.',
        },
        {
          label: '파일 업로드',
          detail:
            'CSV / TXT / TSV, 50MB 까지. 파일 없이 메타데이터만 등록해도 되지만 그 소스로는 방식 A 추출을 할 수 없다.',
        },
        {
          label: 'citation',
          detail:
            '필수. 발행물의 출처 표기에 실리는 문장이므로 저자·연도·제목·라이선스를 그대로 적는다.',
        },
      ],
      cautions: [
        '등록에 성공하면 곧바로 Sources 목록으로 이동하고, 잘못 넣은 소스를 화면에서 지우거나 고칠 방법이 없다.',
      ],
    },
  },

  'vocab-collections': {
    title: '발행 컬렉션',
    screen: {
      summary:
        'VCB 로 발행돼 학습자에게 실제로 보이는 공용 단어장 목록. 생산자 두 종류를 함께 싣는다 — 8-step run 산출물과 단어장 Studio(유형 카탈로그) 산출물.',
      when: '발행이 제대로 반영됐는지 확인할 때, 또는 어떤 run·어떤 유형에서 나온 단어장인지 되짚을 때.',
      fields: [
        {
          label: 'run / Studio 태그',
          detail:
            '어느 경로로 만들어졌는지. run 은 8-step 파이프라인(seed→enrich→publish), Studio 는 유형(blueprint)을 골라 조립한 것이다. 고치는 방법이 서로 다르므로 먼저 이것을 본다 — run 산출물은 새 run 을, Studio 산출물은 같은 슬러그로 재조립·재발행한다.',
        },
        {
          label: '발행됨 / 비공개',
          detail:
            '비공개는 세트는 만들어졌지만 학습자에게 노출되지 않는 상태다. 이 화면에는 전환 버튼이 없다.',
        },
        {
          label: '캐시 N 불일치',
          detail:
            '세트에 저장된 단어 수와 실제 단어 행 수가 다를 때만 뜬다. 표시 숫자는 실제 행 수 쪽이다.',
        },
        {
          label: 'Run #N',
          detail:
            '이 단어장을 만든 run 상세로 간다. 내용을 고쳐야 하면 그 run 이 아니라 새 run 에서 새 버전을 발행해야 한다.',
        },
        {
          label: 'Studio · <유형>',
          detail:
            '그 세트를 만든 유형(blueprint) 이름이고, 누르면 Studio 로 간다. 같은 유형·같은 슬러그로 다시 발행하면 기존 세트를 제자리에서 교체한다(구독은 유지된다).',
        },
      ],
      cautions: [
        '여기에는 수정·회수 버튼이 없다. 잘못 발행된 단어장은 같은 슬러그로 새 버전을 발행해 덮는 것이 유일한 교정 경로다.',
        '예문 한국어 해석은 이미 채워져 있다(카탈로그 표제어 11,166/11,183 = 99.8%, meanings_ko[].example_ko). 학습자도 플래시카드 정답면·읽기 조회 창에서 보고 있다 — scripts/vocab/example-ko-drain-* 은 다른 칸(example_ko 컬럼·senses[].examples_ko)을 채우는 도구이고, 지금 그 두 칸을 읽는 화면이 없어 돌릴 이유가 없다. 2026-08-30 에 우위지수가 이 축을 0% 로 잘못 읽어 3,450 문장을 중복으로 채운 적이 있다.',
        '브랜드 각인(curation_query.brand)은 계열 단위다 — 한 세트만 다시 그릴 수 없다. 그 계열 전체가 같은 규격을 받는다.',
      ],
      drain: {
        what:
          '계열(list·structure·corpus·delivery·unique) 다섯의 표지 규격. Claude Design 캔버스에서 확정하고 '
          + 'VocabBrandCanvas 로 적재한다. 세트 단위가 아니라 계열 단위인 이유는 서가가 계열로 읽히기 때문이다 — '
          + '표지 듀오톤이 계열 색이고, 세트마다 브랜드를 만들면 카탈로그가 잡지 스크랩북이 된다.',
        prerequisites: [
          'apps/web/.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 있을 것 (import 가 발행 세트를 고친다)',
          '색을 새로 정할 생각이라면 먼저 디자인 토큰을 고칠 것 — 규격은 색 값을 담을 수 없다(역할 이름만)',
        ],
        procedure: [
          {
            title: 'export — 그릴 몫을 뽑는다',
            detail:
              'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-export.mts '
              + '→ scripts/vocab/brand-drain/chunk-NN.json (계열당 하나). '
              + '**재실행 안전** — 이미 전권 각인된 계열은 건너뛴다. 다시 그리려면 --force.',
            done: '청크 파일이 생기고 "건너뜀" 수가 출력된다.',
          },
          {
            title: '아트보드 — 토큰에서 만든다',
            detail:
              'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-artboards.mts '
              + '→ scripts/vocab/brand-drain/canvas/*.dc.html + canvas.json. '
              + '**색을 손으로 적지 않는다** — 토큰을 읽어 칠하므로 토큰이 바뀌면 다시 돌리면 따라온다. '
              + '재실행 안전(파일만 덮어쓴다).',
            done: '아트보드 7장(lockup·격자 + 계열 5)이 생긴다.',
          },
          {
            title: 'Claude Design — 캔버스에서 확정',
            detail:
              'Claude Code 에서 /design 으로 캔버스를 만들어 규격을 눈으로 확인하고 다듬는다. '
              + '확정한 값을 chunk-NN.out.json 에 VocabBrandCanvas 한 개로 적는다(캔버스 주소 포함).',
            done: '계열마다 .out.json 이 생긴다.',
          },
          {
            title: 'import — 발행물에 각인',
            detail:
              'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-import.mts --commit. '
              + 'curation_query 에 brand 키를 **더한다**(마이그레이션 불필요·기존 키 보존). '
              + '**재실행 안전** — 같은 .out.json 으로 몇 번을 돌려도 결과가 같다. 기본은 드라이런.',
            done: '"캔버스 N개 · 세트 M개" 가 찍히고 건너뛴 수가 0 이다.',
          },
        ],
        verify: [
          'export 를 다시 돌리면 청크 0개 · 건너뜀 5개가 나온다 (재실행 안전의 증거)',
          '세트 하나의 curation_query 키에 brand 가 늘고 기존 키(recipe·scorecard·imprint)가 그대로다',
        ],
        recovery: [
          '검증에 걸린 캔버스는 **적재되지 않는다** — 색 값(hex/rgb)을 담았거나 빈 값이면 거절하고 그 계열을 건너뛴다. 출력에 찍힌 field/message 를 고쳐 다시 돌린다.',
          '잘못 각인했으면 .out.json 을 고쳐 --commit 을 다시 돌린다 (덮어쓰기가 아니라 같은 키를 다시 쓴다).',
        ],
      },
    },
  },

  'vocab-curate': {
    title: 'VCB 큐레이션',
    screen: {
      summary:
        '보강된 단어를 하나씩 승인·거절·수정해 발행 대상을 확정하는 곳.',
      when: 'QA 게이트를 돌린 뒤(run 상태 QA 검증 중 또는 큐레이션 중). run 상세의 큐레이션 시작 으로 들어온다.',
      steps: [
        {
          title: '플래그부터 처리',
          detail:
            '플래그 필터는 QA 가 문제를 잡았고 아직 결정이 없는 항목만 남긴다. 여기가 사람의 판단이 가장 필요한 묶음이다.',
          done: '플래그 필터의 카운트가 0 이 된다.',
        },
        {
          title: '나머지 미검토 처리',
          detail:
            'QA 를 통과한 항목도 결정이 없으면 발행이 막힌다. 목록 좌상단 전체 선택 → 승인 으로 한꺼번에 넘길 수 있다.',
          done: '미검토 필터의 카운트가 0 이 된다.',
        },
        {
          title: 'run 상세로 돌아가 발행',
          detail:
            '발행 카드의 사전점검에서 blocker 가 사라졌는지 확인한다. 승인/수정 합계가 50건 미만이면 여전히 막힌다.',
          done: 'blocker 가 0 이고 발행 버튼이 눌린다. **50건은 합계 기준**이라 승인만 49건이면 수정 1건으로도 열린다 — 승인 수만 세고 있으면 왜 막히는지 안 보인다.',
        },
      ],
      fields: [
        {
          label: '승인 · 거절',
          detail:
            '누르는 즉시 서버에 결정이 쌓이고 다음 항목으로 넘어간다. 결정은 이력으로 누적되고 최신 것만 유효하므로, 같은 항목을 다시 골라 반대 결정을 내리면 뒤집힌다.',
        },
        {
          label: '수정',
          detail:
            '내용을 직접 고쳐 저장하면 수정 결정으로 기록되고, 승인과 똑같이 발행 대상에 포함된다.',
        },
        {
          label: '재보강',
          detail:
            '이 항목을 보강 대기로 되돌리고 Claude Code 용 명령을 만들어 준다 — 아래 드레인 절차 참조.',
        },
        {
          label: '거부됨 필터',
          detail:
            '거절 처리한 항목만 모아 본다. 실수로 거절한 것을 되돌릴 때 여기서 찾아 다시 승인하면 된다.',
        },
      ],
      drain: {
        what: '큐레이터 지시를 반영해 다시 만든 단어 하나짜리 enriched JSONL.',
        prerequisites: [
          '되돌릴 항목을 목록에서 선택해 둘 것',
          '무엇이 마음에 안 드는지 노트에 적어 둘 것 — 노트가 그대로 재생성 지시로 들어간다',
        ],
        procedure: [
          {
            title: '재보강 누르기',
            detail:
              '해당 queue 항목이 보강 대기로 돌아가고 기존 내용과 QA 플래그가 지워진다. 화면에 /vcb-reenrich <queue_id> "노트" 가 나타난다.',
            done: '복사 버튼이 있는 명령 상자가 뜬다.',
          },
          {
            title: 'Claude Code 에서 실행',
            detail:
              '명령을 붙여넣어 돌리면 exports/vcb-jobs/reenrich-<queue_id>-enriched.jsonl 이 만들어지고 05c-validate-output.mjs 로 검증까지 끝난다.',
            done: '리포트에 validation: passed 가 찍힌다.',
          },
          {
            title: '직접 import',
            detail:
              '이 경로는 자동으로 DB 에 들어가지 않는다. pnpm vcb:import-enriched --file exports/vcb-jobs/reenrich-<queue_id>-enriched.jsonl 로 넣는다.',
            done: 'run 상세의 대기 중 이 1 줄고 보강 완료 가 1 는다.',
          },
        ],
        verify: [
          '큐레이션 목록에서 그 단어를 다시 열었을 때 내용이 바뀌어 있다',
          'run 상세 지표의 대기 중 이 0 으로 돌아왔다',
        ],
        recovery: [
          '같은 명령을 다시 돌려도 파일만 다시 쓴다 — 재실행이 안전하다.',
          'import 를 잊으면 그 단어는 보강 대기로 남고, 발행 사전점검이 "still pending" 으로 발행을 막는다.',
        ],
      },
      cautions: [
        '이 화면을 여는 것만으로 run 상태가 QA 검증 중 → 큐레이션 중 으로 넘어간다. 이 전이 뒤에는 QA 게이트를 다시 돌릴 수 없다.',
        '재보강은 기존 보강 내용을 지우고 되돌리는 버튼이 없다. 사소한 오류는 재보강 대신 수정 으로 고치는 편이 안전하다.',
      ],
    },
  },
}
