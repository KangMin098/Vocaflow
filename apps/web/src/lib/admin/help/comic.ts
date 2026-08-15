// apps/web/src/lib/admin/help/comic.ts
//
// CCP — 만화 생성 (/admin/comic) 화면도움말.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.

import type { HelpRegistry } from './types'

export const CCP_HELP: HelpRegistry = {
  // ── /admin/comic ─────────────────────────────────────────────
  comic: {
    title: 'Comic Pipeline (CCP)',
    screen: {
      summary:
        '큐레이션 도서를 만화 컷으로 만들어 학습자에게 내보내는 콘솔. 여기서 하는 일은 큐 적재와 발행 결정이고, 컷은 Claude Code 드레인이 만든다.',
      when:
        '도서가 라이브러리에서 ready 또는 published 가 된 뒤. 그 두 상태가 아닌 도서는 목록에 아예 없고, 큐 적재도 스킵된다.',
      fields: [
        { label: '대상 도서', detail: 'ready/published 도서 수. 만화 유무와 무관한, 만화화가 가능한 모집단이다.' },
        { label: '초안 · 발행됨', detail: 'comic_books 헤더 상태 기준. 보관(archived)은 어느 쪽에도 안 잡힌다.' },
        {
          label: '큐 대기',
          detail:
            'comic_gen 잡이 pending 또는 running 인 도서 수. 드레인이 컷을 적재하면 done 이 되어 0으로 떨어진다 — 0이라고 만화가 다 만들어졌다는 뜻은 아니다.',
        },
      ],
      cautions: [
        '만화를 발행해도 도서 자체가 published 가 아니면 학습자에게 보이지 않는다 — 학습자 읽기 RPC 가 comic_books.status 와 library_books.status 를 함께 요구한다. ready 도서는 만화만 발행해 봐야 노출되지 않는다.',
      ],
    },
    tabs: {
      'Catalog': {
        summary: '만화화 대상 도서 목록. 체크해서 드레인 큐에 올리는 곳이고, 여기서 컷이 만들어지지는 않는다.',
        fields: [
          { label: '도서', detail: 'library_books 상태. ready 도서도 큐에 넣을 수 있지만 학습자 노출까지 가려면 도서 자체가 published 여야 한다.' },
          { label: '만화', detail: 'comic_books 헤더 상태 — 없음 / 초안 / 발행됨 / 보관.' },
          { label: '컷', detail: '적재된 comic_pages 수. 잡이 running 이면 "진행/전체" 로 바뀐다.' },
          { label: '큐', detail: 'comic_gen 잡 상태(pending·running·done·failed). "—" 면 큐에 올라간 적이 없거나 보관하면서 잡이 지워진 것이다.' },
          {
            label: '만화 생성 큐',
            detail:
              '선택 도서를 book_curation_jobs(comic_gen) 에 pending 으로 올린다. 같은 도서를 다시 넣으면 잡이 하나 더 생기지 않고 기존 잡이 pending 으로 초기화된다(진행·오류 기록도 함께 지워짐). ready/published 아닌 도서는 스킵 수로만 보고된다.',
          },
        ],
        cautions: [
          '이미 발행된 만화를 다시 큐에 넣으면 그 순간 초안으로 강등돼 학습자 노출이 끊긴다 — 재생성이 끝나고 다시 발행할 때까지 돌아오지 않는다.',
          '적재는 큐에 줄만 세운다. 이어서 드레인(generate-comic.mjs)을 돌리지 않으면 상태가 pending 에서 영원히 멈춰 있다.',
        ],
      },
      'Published': {
        summary: '만화 헤더가 있는 도서의 발행 스위치. 초안·보관본도 같은 표에 섞여 나온다.',
        fields: [
          {
            label: 'QC',
            detail:
              'comic_books.panels_pass. 드레인 적재(insert --commit) 시점에 고정되며 화면에서는 바꿀 수 없다. 통과가 아니면 발행 버튼이 잠기고, 우회해도 서버 RPC 가 거부한다.',
          },
          { label: '발행', detail: '컷이 1개 이상이고 QC 통과일 때만 통한다. 즉시 반영되고 별도 배포는 없다.' },
          { label: '회수', detail: '헤더를 초안으로 되돌리고 발행 시각을 지운다. 컷과 QC 판정은 그대로 남아 바로 재발행할 수 있다.' },
        ],
        cautions: [
          '제목만 보고 발행 여부를 판단하지 마라 — 이 표는 만화가 있는 도서 전부(초안·보관 포함)를 보여준다. "만화" 열이 실제 상태다.',
        ],
      },
      '스타일': {
        summary: '생성에 쓸 화풍 카탈로그. 여기서는 채택/제외만 관리하고, 도서에 붙이는 것은 검수 화면이다.',
        when: '드레인을 돌리기 전. plan 이 도서에 지정된 스타일의 art_prompt 를 읽어 가므로 화풍은 생성 전에 정해야 한다.',
        fields: [
          {
            label: '상태 셀렉트(candidate·adopted·rejected)',
            detail:
              'rejected 로 두면 검수·테스트의 스타일 드롭다운에서 사라진다. 그 외에 생성에 미치는 영향은 없다 — adopted 라고 자동으로 쓰이지 않는다.',
          },
          { label: '기본 배지', detail: 'comic_styles.is_default 표시일 뿐, 도서에 자동 적용되지 않는다. 도서별 지정은 검수에서 손으로 한다.' },
          { label: '포맷·연령·장르·팔레트 필터', detail: '보이는 카드만 거른다. 저장되지 않고 다른 화면에도 영향이 없다.' },
        ],
        cautions: [
          '이미 적재된 컷은 스타일을 바꿔도 달라지지 않는다. 화풍을 갈아엎으려면 검수에서 스타일 재지정 → [보완(재생성 큐)] → 드레인 재실행이다.',
          '카탈로그가 비어 있으면 검수의 스타일 드롭다운도 비고, plan 이 "(미선택)" 을 출력한다 — 화풍이 드레인 담당자 재량으로 흘러간다.',
        ],
      },
      '테스트': {
        summary: '모델·환경·스타일 조합 실험을 기록하는 장부. 이 화면은 아무것도 실행하지 않는다.',
        fields: [
          {
            label: '실행 환경',
            detail:
              '고른 환경(run_envs)에서 돌릴 수 있는 모델만 아래 드롭다운에 남는다. 환경을 바꾸면 선택했던 모델이 초기화된다. 기본값은 자가호스트(RunPod 4090).',
          },
          {
            label: '계획 추가',
            detail:
              'comic_gen_tests 에 status=planned 로 한 줄 남길 뿐이다. 실제 실행은 터미널(test-comic-model.mjs 등)에서 하고, 점수·비용·샘플 결과는 드레인 담당자가 나중에 채운다.',
          },
          { label: '메모', detail: '저장할 때 앞에 [환경:…][스타일:…] 가 자동으로 붙는다. 나중에 조건을 되짚기 위한 것이라 지우지 마라.' },
          { label: '모니터링 링크', detail: 'params.kernel_url 이 있는 테스트에만 나타난다 — 외부 커널로 돌린 실행에 스크립트가 넣어 준다.' },
          { label: '자동 갱신', detail: 'planned/running 테스트가 하나라도 있으면 12초마다 서버 데이터를 다시 읽는다. 새로고침을 누를 필요가 없다.' },
        ],
        cautions: [
          '화면에서 테스트를 지우거나 상태를 되돌릴 수 없다 — 잘못 만든 계획도 목록에 남는다.',
          '최근 50건만 보인다. 그보다 오래된 실험은 이 화면에서 사라진다.',
        ],
      },
      '모델': {
        summary: '이미지 생성 모델 비교표. 상태는 판단 기록이지 생성 백엔드 스위치가 아니다.',
        fields: [
          { label: 'Fit', detail: 'comic_fit(0~100) — 정렬 기준. 80 이상 초록, 60 이상 앰버로 칠한다.' },
          { label: '비용/장', detail: 'cost_per_image_usd. 값이 없고 자가호스트(RunPod) 실행이 가능하면 "무료*" 로 표기한다 — GPU 대여 시간은 여기 안 잡힌다.' },
          { label: '실행환경', detail: 'run_envs. 테스트 탭의 모델 후보를 거르는 유일한 기준이다.' },
          {
            label: '상태 셀렉트',
            detail:
              '후보/테스트/채택/제외. 채택으로 바꿔도 드레인이 쓰는 백엔드는 안 바뀐다 — 실제 백엔드는 pages.json 의 backend 값으로 기록된다.',
          },
        ],
        cautions: [
          '제외(rejected)로 바꿔도 테스트 탭 모델 목록에서는 사라지지 않는다 — 스타일과 달리 그 목록은 실행환경만 보고 거른다.',
        ],
      },
    },
  },

  // ── /admin/comic/[bookId] ────────────────────────────────────
  'comic-review': {
    title: '만화 검수',
    screen: {
      summary: '도서 한 권의 컷과 QC 를 보고 게시·보완·보관·삭제를 결정하는 화면.',
      when:
        '드레인 적재가 끝나 컷이 들어온 뒤. 컷이 0개면 스타일 지정 말고 할 수 있는 게 없다. 큐 대기·생성 중 단계에서는 5초마다 자동 갱신된다.',
      steps: [
        {
          title: '스타일을 먼저 지정',
          detail: '드레인 plan 이 이 값으로 art_prompt·negative_prompt 를 꺼내 간다. 생성 후에 바꾸면 다음 재생성부터 적용된다.',
          done: '드롭다운 옆에 팔레트 이름과 "생성 시 이 art_prompt 적용" 이 뜬다.',
        },
        {
          title: 'QC 카드 확인',
          detail:
            '정본 불일치가 1건이라도 있으면 QC 게이트가 미통과로 고정돼 게시가 잠긴다. 규칙 위반은 경고일 뿐 게이트를 막지 않는다.',
          done: 'QC 게이트 = 통과, 정본 불일치 0.',
        },
        {
          title: '컷과 대사 훑기',
          detail: '대사 끝의 ✓ 는 원문 그대로 옮긴 버블이라는 표시다. ✓ 없는 대사는 각색이라 정본 대조 대상이 아니다.',
        },
        {
          title: '게시 또는 보완',
          detail: '이상 없으면 [게시 →], 컷을 다시 뽑아야 하면 [보완(재생성 큐)] 으로 큐에 되돌린 뒤 드레인을 다시 돌린다.',
          done: '단계 배지가 "게시됨" 으로 넘어간다.',
        },
      ],
      fields: [
        { label: 'QC 게이트', detail: 'comic_books.panels_pass. 적재 시점에 고정되며 화면에서 바꿀 수 없다. 미통과면 게시 버튼이 비활성이다.' },
        { label: '정본 불일치 / 규칙 위반', detail: 'qc_verdict 의 두 배열 길이. 건수를 누를 필요 없이 아래 상세 카드에 어떤 컷·어떤 규칙인지 그대로 펼쳐진다.' },
        {
          label: '단어장 미등록',
          detail:
            '만화 target_vocab 중 그 도서 챕터 단어장에 없는 단어 수. 발행을 막지는 않지만 그 단어는 학습자 단어장·FSRS 로 이어지지 않는다. 챕터 단어장 자체가 없으면 "판정 불가".',
        },
        { label: '보완(재생성 큐)', detail: '큐에 다시 올린다. 발행 중이었다면 그 순간 초안으로 강등된다. 컷은 그대로 남아 있고 드레인 적재 때 통째로 교체된다.' },
        { label: '보관', detail: '학습자 노출을 즉시 끊고 목록에서 치운다. [복원(검수)] 로 되돌릴 수 있다.' },
        { label: '드레인 관측 →', detail: '이 도서의 생성 실행 이력·컷별 판정. 왜 발행이 막혔는지는 거기서 사유 목록으로 본다.' },
      ],
      cautions: [
        '[삭제]는 되돌릴 수 없다 — 컷·헤더·큐 잡을 한꺼번에 지우고 스토리지 이미지까지 제거한다. 확인 창 하나가 유일한 안전장치고, 끝나면 목록으로 돌아간다.',
        '[보관]은 comic_gen 큐 잡도 같이 지운다. 보관본을 다시 만들려면 Catalog 에서 큐에 새로 적재해야 한다.',
        '스타일을 바꿔도 이미 적재된 컷은 그대로다 — 화풍 교체는 재생성이 필요하다.',
      ],
    },
  },

  // ── /admin/comic/[bookId]/drain ──────────────────────────────
  'comic-drain': {
    title: '드레인 관측',
    screen: {
      summary: '이 도서의 컷 생성이 어디까지 갔고 왜 발행이 막혔는지 보는 읽기 전용 화면.',
      when:
        '큐에 적재한 뒤. 본 생성의 실행 기록은 generate-comic.mjs 의 적재(insert --commit)가 남기므로, 컷을 뽑는 동안에는 비어 있다가 적재 순간 한꺼번에 채워진다.',
      fields: [
        { label: '진행 바', detail: '적재된 컷 / 전체 컷. 실패 컷이 있으면 막대가 앰버로 바뀐다.' },
        { label: '자기발전 반복', detail: 'pages.json 의 run.iterations — 폐루프가 컷을 다시 뽑은 횟수. 스크립트가 넘기지 않으면 0으로 남는다.' },
        { label: '컷 pass율', detail: 'panels_pass / panels_total. qc.failed 에 들어간 컷만 fail 로 센다.' },
        { label: '비용(USD)', detail: 'run.cost_usd. 자가호스트 실행은 대개 기록되지 않아 0으로 보인다.' },
        { label: '컷 상태 그리드', detail: '컷마다 마지막 시도 하나만 보여준다. 우상단 작은 숫자는 그 컷을 몇 번 시도했는지다.' },
        {
          label: '발행 차단 / 대기',
          detail:
            '판정 권위는 comic_books.panels_pass 다. 실행이 완료여도 헤더 게이트가 false 면 차단으로 뜬다 — 검수 화면·Published 탭과 같은 값을 본다.',
        },
        { label: '평가 이력', detail: '가장 최근 실행의 컷 이벤트 최대 40건. 이전 실행의 이벤트는 여기 안 나온다.' },
        { label: '실행 이력', detail: '실행이 2회 이상일 때만 나타난다.' },
      ],
      drain: {
        what: '큐에 올린 도서 한 권을 컷 이미지 + 대사 버블로 만들어 comic_pages 에 적재하고, QC 판정을 comic_books 헤더에 고정한다.',
        prerequisites: [
          'Catalog 에서 그 도서를 [만화 생성 큐] 에 적재해 "큐" 열이 pending 인 상태.',
          '검수 화면에서 만화 스타일 지정 — plan 이 style_key 로 art_prompt·negative_prompt 를 꺼낸다. 미지정이면 화풍이 고정되지 않는다.',
          'apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY. 스크립트가 이 파일을 직접 읽고, 없으면 바로 종료한다.',
          '이미지 백엔드 — gen-verified 는 ComfyUI(--comfy-url)로 컷을 뽑는다. 사람 개입 없이 끝까지 돌리려면 ANTHROPIC_API_KEY + --sdk 가 있어야 하고, 없으면 판단 스테이지마다 멈춘다.',
        ],
        procedure: [
          {
            title: '큐 확인',
            detail:
              'node scripts/lcp/drain.mjs list — 미완 잡을 책별로 훑는다. node scripts/lcp/drain.mjs next <book_id> 는 그 책의 실행 명령 3줄을 그대로 찍어 준다.',
            done: '"🎞 만화 생성 : pending" 줄에 대상 도서가 보인다.',
          },
          {
            title: '컨텍스트 확보',
            detail:
              'node scripts/lcp/generate-comic.mjs plan <book_id> — 도서 메타·헤더·선택된 스타일·이미 적재된 컷 수를 JSON 으로 뱉는다. 읽기만 하고 아무것도 바꾸지 않는다.',
          },
          {
            title: '정본 받기',
            detail:
              'node scripts/lcp/generate-comic.mjs content <book_id> <chapter_idx> — 그 챕터 원문을 표준출력으로 준다. verbatim 으로 표시할 대사는 반드시 여기서 그대로 따와야 QC 를 통과한다.',
          },
          {
            title: '컷 생성(폐루프)',
            detail:
              'node scripts/comic/gen-verified.mjs --script <각색.json> --out <디렉터리> --wf-gen … --wf-edit … --comfy-url … — S0 lint → S0.5 preflight → S1 생성 → S2 컷 QC → S3 교차 일관성 → S4 조립. 실패한 컷만 골라 다시 뽑고, 기본 3라운드(--max-rounds)를 넘기면 사람에게 넘긴다. --sdk 없이 돌리면 판단이 필요한 지점마다 종료 코드 20 으로 멈추고 qc/*-manifest.json 을 남기므로, verdicts json 을 채운 뒤 --resume 으로 이어서 돌린다.',
            done: '"✅ ALL PASS (preflight+S2+S3)" 출력.',
          },
          {
            title: '검증(dry-run)',
            detail:
              'pages.json 을 조립한 뒤 node scripts/lcp/generate-comic.mjs insert <book_id> --file pages.json — --commit 없이 돌리면 스키마 검증만 한다. (chapter_idx, page_order) 중복, http(s) 아닌 image_url, kind/pos 오탈자를 여기서 걸러라. target_vocab 이 verbatim 버블에 없으면 경고만 뜨고 통과한다.',
            done: '"검증 OK · N컷 · panels_pass=true".',
          },
          {
            title: '적재',
            detail:
              '같은 명령에 --commit 을 붙인다. 그 도서 컷을 전부 지우고 pages.json 으로 교체한 뒤 헤더 QC 판정·관측 실행 1건·컷 이벤트 N건·큐 잡 진행을 함께 쓴다. 발행은 하지 않는다 — 헤더는 초안으로 남는다.',
            done: '"✓ 적재 완료 — N컷 · QC 통과(발행 가능)".',
          },
        ],
        verify: [
          '이 화면에 실행 카드가 생기고 진행 바가 N/N, 컷 pass율 100%.',
          '검수 화면의 [QC 게이트] 가 "통과", [정본 불일치] 0 — 1건이라도 남으면 게시 버튼이 잠긴 채다.',
          'Catalog 의 [큐] 열이 done 이고 [컷] 열이 적재한 컷 수와 같은지. done 으로 안 바뀌면 이번 pages.json 의 컷 수가 잡에 기록된 전체 컷 수보다 적은 것이다.',
        ],
        recovery: [
          '중간에 멈춰도 DB 는 그대로다 — plan·content 는 읽기 전용이고 쓰기는 insert --commit 한 번에 몰려 있다. 처음부터 다시 돌려도 안전하다.',
          'insert --commit 을 두 번 돌려도 컷은 중복되지 않는다. 매번 그 도서 컷을 전부 지우고 다시 넣는 방식이라, 대신 관측 실행은 돌릴 때마다 한 줄씩 쌓인다.',
          '부분 pages.json 으로 --commit 하면 나머지 컷이 사라진다 — 재적재는 항상 전권 pages.json 으로 한다.',
          'gen-verified 가 라운드를 다 쓰고도 실패하면 qc/repair-report.json 의 flagged 컷을 보고 각색 스크립트(장면 서술)를 고친 뒤 다시 돌린다. 같은 스크립트로 재시도하면 대개 같은 자리에서 또 막힌다.',
          '"(comic_gen job 없음 — write-back skip)" 이 뜨면 컷은 적재됐지만 Catalog 의 큐 열이 갱신되지 않는다. 큐에 올린 적이 없거나 보관하면서 잡이 지워진 경우다 — Catalog 에서 다시 적재하면 맞춰진다.',
          '실행 기록이 계속 비어 있으면 아직 적재를 안 한 것이다. 생성만으로는 이 화면에 아무것도 남지 않는다.',
        ],
      },
      cautions: [
        '읽기 전용 화면이다 — 여기서 재실행하거나 취소할 수 없다. 다시 돌리려면 검수의 [보완(재생성 큐)] 또는 Catalog 적재부터다.',
        '모델 샘플 테스트(test-comic-model.mjs)도 같은 관측 테이블에 실행을 남기고, 도서를 지정하지 않으면 A Christmas Carol 로 기록된다 — 그 도서 실행 이력에는 본 생성과 샘플 테스트가 섞여 보인다.',
      ],
    },
  },
}
