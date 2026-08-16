// apps/web/src/lib/admin/help/pd-comics.ts
//
// PDCP — 퍼블릭도메인 만화 복원 (/admin/pd-comics) 화면도움말.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.
//
// 근거: 화면 캡처(admin-shots/pd-comics.png) + AdminPdComicsClient.tsx ·
//       app/api/pdcp/{drain,retry,enqueue,progress,reader,doctor}/route.ts ·
//       lib/pd-comic/{model,pipeline-bridge}.ts · scripts/comic/pd/* ·
//       supabase/migrations/20260808161400_pdcp_public_domain_comics.sql (발행 게이트).

import type { HelpRegistry } from './types'

export const PDCP_HELP: HelpRegistry = {
  'pd-comics': {
    title: 'PD Comic Pipeline — 퍼블릭도메인 만화 복원',
    screen: {
      summary:
        '옛 스캔 만화를 호(issue) 단위로 받아 복원·컷분할·대사추출까지 밀어 올리고, PD 근거를 확정해야만 발행되는 큐.',
      when:
        'AI 생성 만화(/admin/comic)와 테이블·화면·발행 게이트가 전부 분리돼 있다. 원본 스캔이 실재하는 옛 만화만 여기서 다룬다.',
      steps: [
        {
          title: '소스에서 담기',
          detail:
            '소스 · 대량 적재 탭에서 검색해 큐에 넣는다. 담는 시점엔 이미지를 한 장도 받지 않는다 — 식별자만 등록되고 취득은 드레인이 한다.',
          done: '큐 · 드레인 탭의 대기 카운트가 늘어난다.',
        },
        {
          title: '드레인으로 자동 단계 전진',
          detail:
            '취득 → 복원 → 컷 분할 → 대사 추출. 한 호출이 한 호의 한 단계다. 이미지 작업은 로컬 CLI(ffmpeg)라 dev 서버에서만 돈다. 대사 추출은 소스가 hOCR 을 줄 때만 돌고, 없으면 실행 없이 검수로 넘어간다 — 실패가 아니다.',
          done: '각 행 stepper 가 대사 추출까지 채워지고 컷 수가 0 이 아니다.',
        },
        {
          title: 'Claude Code 로 대사 정제·현대화',
          detail:
            'OCR 원문은 그대로 못 쓴다(소스 hOCR 실측 통과율 24%). own-ocr 소스(browser-assist · iiif · local-dir)는 대사가 아예 비어 있으므로 전사부터 Claude Code 가 한다. 정제·말풍선 좌표·모던 대사는 사람 판단이 필요하다 — 테스트 · 모니터 탭 도움말의 드레인 절차 참조.',
          done: '컷 대사 드릴다운에 문장이 보이고 상태가 검수로 올라간다.',
        },
        {
          title: 'PD 근거 확정 → 발행',
          detail:
            '목록에 "PD 근거 미기재 — 발행 차단" 이 붙어 있으면 발행할 수 없다. pd_basis · pd_checked_at · pd_checked_by · source_url 네 개가 모두 차야 DB 게이트를 통과한다.',
        },
      ],
      fields: [
        { label: '대기 queued', detail: '식별자만 등록된 상태. 아직 받은 파일이 없다.' },
        { label: '취득 acquired', detail: '원본 페이지 이미지(+IA면 hOCR)가 work/pdcp/<slug>/pages 에 내려온 상태.' },
        { label: '복원 restored', detail: 'ffmpeg 로 여백 크롭 · 탈황변 · 디노이즈 · 2배 업스케일까지 끝난 페이지.' },
        {
          label: '컷 분할 segmented',
          detail: '페이지를 컷으로 자른 상태. 캡션 박스가 거터를 가로지르면 옆 컷과 병합되는 알려진 한계가 있다.',
        },
        { label: '대사 추출 ocr', detail: '버튼으로 갈 수 있는 마지막 단계. 여기서부터는 사람 + Claude Code 몫이다.' },
        { label: '검수 review', detail: '컷과 대사가 pd_comic_panels 에 적재된 상태. 학습자에게는 아직 안 보인다.' },
        { label: '발행 published', detail: 'PD 근거 4종을 갖춘 호만. 학습자 서가 /comics/restored 에 노출된다.' },
        {
          label: 'PD 근거 미기재 — 발행 차단',
          detail:
            '적재 때 어댑터 힌트로 확정되는 근거는 보호기간 만료급뿐이다. 1930~1963 발행분은 갱신 기록을 호별로 확인해 사람이 넣어야 한다.',
        },
      ],
      cautions: [
        '드레인 · 라이브 진행 · 모던 리더 · 브라우저 보조는 모두 dev 전용이다 — 배포 환경에서는 403/404 로 막힌다(서버 프로세스가 ffmpeg 을 돌려야 하기 때문).',
        '1964년 이후 발행분은 저작권이 자동 갱신돼 사용할 수 없고, 1930~1963 은 갱신 기록 확인 전까지 PD 가 아니다. Classics Illustrated Junior 는 제외 대상.',
        '잘못 담은 호를 큐에서 빼는 버튼은 화면에 없다 — DELETE /api/pdcp/issue?id=<uuid>(발행본은 409로 거부). 작업 디렉터리는 기본 보존되고 purge=1 일 때만 함께 지워진다.',
      ],
      seeAlso: [
        { label: 'AI 생성 만화(CCP) 큐', href: '/admin/comic' },
        { label: '학습자 복원 만화 서가', href: '/comics/restored' },
      ],
    },
    tabs: {
      '소스 · 대량 적재': {
        summary: '어느 사이트에서 어떤 호를 가져올지 고르고 큐에 넣는 곳 — 담아도 아직 받지는 않는다.',
        steps: [
          {
            title: '원본 전체를 한 번에 (대량 소스 GET)',
            detail:
              '맨 위 "원본 전체 소스 GET" 은 컬렉션을 통째로 넣는다 — Fawcett 811 + Ace 209 를 검색 응답만으로 훑어 유형 10종·시리즈로 분류해 적재한다(실측 969건 적재, 1964년+ 50건과 표지 모음 1건 제외). 아래 검색·선택 경로는 한 번에 50건이 상한이라 1,000건을 넣으려면 50번 눌러야 하고 외부 사이트에 1,000회 추가 요청을 보낸다. "계획 보기" 는 DB 를 건드리지 않고 무엇이 몇 건 들어올지만 보여주므로 먼저 눌러 본다. 재실행해도 이미 있는 호는 건너뛴다(멱등) — 진행 상태를 덮어쓰지 않는다.',
            done: '큐 · 드레인 탭 대기 카운트 증가 + "유형·시리즈 분포" 에 10유형이 채워진다.',
          },
          {
            title: '추천 소재부터 (사전 지식 불필요)',
            detail:
              '맨 위 "추천 소재" 에서 아는 명작 칩(Ivanhoe·Odyssey…) 하나만 누르면 학습 적합·PD 안전 순으로 자동 랭킹된다(CANON 매칭+CI 감지+분량+PD 위험). 컬렉션 ID·연도 상한·검색어를 몰라도 되고, 가드레일(1964+ 제외·PD 재정렬·노이즈 제외·중복 제외)은 칩으로 표시된 대로 자동 적용된다. "추천 상위 N 큐 적재" 로 원클릭.',
            done: '추천 목록에 fit 점수·왜 추천했는지 배지가 뜨고, 적재하면 큐 대기 카운트 증가.',
          },
          {
            title: '직접 검색은 접어 둔 "고급"',
            detail:
              '컬렉션·연도·정렬을 직접 짜려면 "직접 검색 · 능력표 (고급)" 를 펼친다. 초심자는 열 필요 없다 — 추천 소재로 충분하다.',
          },
          {
            title: '출발점 칩부터',
            detail:
              '자유 검색은 저작권이 살아 있는 자료를 상위에 끌고 온다. 어댑터가 주는 출발점 칩은 검색어와 필터(컬렉션·연도·정렬)를 통째로 갈아끼운다 — 누른 뒤엔 이전 필터가 남지 않는다.',
          },
          {
            title: '발행 상한 확인',
            detail: '기본 1963. 칩을 누르면 이 값도 칩의 것으로 덮이므로 적재 직전에 다시 본다.',
          },
          {
            title: '테스트 모드로 담기',
            detail:
              '기본 켜짐 · 앞 6장. 한 호가 50장을 넘어서, 파라미터를 확인하기 전 전권을 돌리면 시간도 버리고 외부 사이트도 때린다. 체크를 풀어야 전권으로 담긴다.',
            done: '"큐 적재 N건" 메시지 + 큐 · 드레인 탭 대기 카운트 증가.',
          },
        ],
        fields: [
          {
            label: '범위 (전체 / Fawcett / Ace)',
            detail:
              '실제로 만화가 들어 있는 큐레이션 컬렉션만 목록에 있다. "classics illustrated" 제목 검색은 여기 없다 — 실측 208건 중 만화는 9건뿐이고 나머지는 Great Illustrated Classics(1989~96 산문·저작권 존속)·Saddleback\'s(현대)·1731~1745 고서였다.',
          },
          {
            label: '계획 보기 (DB 변경 없음)',
            detail:
              '외부 사이트는 훑지만 DB 는 쓰지 않는다. 유형별 건수와 제외 사유(1964년+ · 표지 모음)를 먼저 확인하는 용도. 미분류가 뜨면 scripts/comic/pd/taxonomy.mjs 규칙표에 추가해야 그 시리즈가 학습자 서가에 묶여 나간다.',
          },
          {
            label: 'PD 확정 / 확인 필요 / 위험',
            detail: '어댑터가 매긴 저작권 위험도이며 목록은 이미 이 순서로 정렬돼 온다. 발행 가능 판정이 아니라 검토 출발점이다.',
          },
          { label: '신규 전체 선택', detail: '이미 큐에 있는 호는 체크박스가 잠겨 있어 선택에서 빠진다.' },
          {
            label: '능력표 · 대량 / OCR / 간격',
            detail:
              '대량 X 인 소스는 검색·자동 취득이 안 된다. OCR "좌표O" 는 소스가 단어 bbox(hOCR)를 함께 준다는 뜻이고, 간격은 요청 사이 최소 대기(Internet Archive 250ms)다.',
          },
          {
            label: '복원 프로파일',
            detail: '그 소스의 스캔 특성에 맞춘 채도·업스케일·OCR 전략. 드레인이 이 값을 그대로 CLI 인자로 넘긴다.',
          },
          {
            label: '브라우저 보조 취득',
            detail:
              '자동 수집을 거부하는 사이트(403 · 계정 · robots 차단)용. 창은 서버가 도는 컴퓨터에 열리고, 사람이 받은 CBZ/ZIP 을 pages/ 로 정규화하는 것까지만 자동이다. 기본 15분 뒤 세션 종료.',
          },
        ],
        cautions: [
          '대량 소스 GET 은 30~60초 걸리고 그동안 외부 사이트를 훑는다. 취득량은 전권 고정이라 드레인이 호당 ~52장을 받는다 — 969건을 전부 드레인하면 로컬 디스크와 시간이 상당히 든다. 유형 하나씩 끝내는 편이 학습자에게 먼저 도착한다.',
          '적재된 969건은 전부 1940~1963 발행이라 PD 근거가 비어 있다(연도만으로 확정되는 것은 1929년 이전뿐). 발행하려면 호마다 갱신 기록을 확인해 근거를 넣어야 한다 — 적재됐다는 것이 발행 가능하다는 뜻이 아니다.',
          '검색·선택 경로는 한 번에 최대 50건만 적재된다 — 그 이상 선택하면 초과분은 조용히 잘린다.',
          '(소스, 식별자)가 유니크라 이미 담긴 호를 다시 담으면 "이미 큐에 있음"으로 집계된다. 실패가 아니다.',
          '스키마 미적용 경고가 떠 있으면 검색·도구 점검은 되지만 적재 버튼이 비활성이다.',
        ],
      },

      '큐 · 드레인': {
        summary: '큐에 담긴 호를 자동 단계(취득 → 대사 추출)까지 밀어 올리고, 멈춘 호를 되살리는 곳.',
        fields: [
          {
            label: '드레인 실행 (N건 대기)',
            detail:
              'N = 실패 표시가 없고 아직 자동 단계에 있는 호. 누르면 큐가 빌 때까지 최대 200회 반복하며 한 호출에 한 단계씩 올린다. 중지는 진행 중인 단계를 끝내고 다음 호출부터 멈춘다.',
          },
          {
            label: '다음 단계 미리보기 (dry-run)',
            detail: '가장 오래된 대상 1건에 대해 실제로 실행될 CLI 명령을 문자열로만 보여준다. 네트워크·디스크 쓰기 없음.',
          },
          {
            label: '유형·시리즈 분포',
            detail:
              '단계 카운트는 진행을 말하지만 무엇을 발행하게 될지는 말하지 않는다. 학습자 서가는 유형별로 묶여 나가므로(/comics/restored), 유형 하나를 끝내면 그 묶음이 통째로 도착한다 — 여러 유형을 조금씩 올리면 어느 묶음도 완성되지 않는다. 막대는 유형별 발행 비율이다.',
          },
          {
            label: '이 호 재시도 / 전체 재시도',
            detail:
              '실패 표시(last_error)만 지운다. 단계는 그대로라 멈춘 지점부터 이어간다 — 처음부터 다시 받지 않는다.',
          },
          {
            label: '실패 N건 카드',
            detail:
              '실패해도 단계는 되돌아가지 않는다. 대신 그 호는 자동 드레인 대상에서 빠지므로, 원인을 고치고 재시도를 눌러야 큐로 돌아온다. 시도 횟수가 계속 늘면 같은 실패를 반복하고 있다는 뜻이다.',
          },
        ],
        drain: {
          what: '큐의 호를 원본 스캔 → 복원 페이지 → 컷 이미지 → 컷별 OCR 대사(work/pdcp/<slug>/)까지 만들어 낸다.',
          prerequisites: [
            '로컬 dev 서버에서 열려 있을 것 — 배포 환경에서는 드레인 API 가 403 이다.',
            '도구 탭 점검 통과 — ffmpeg 이 없으면 복원 단계에서 멈춘다.',
            '대사 추출은 소스가 hOCR 을 줄 때만 돈다(internet-archive). own-ocr 어댑터(browser-assist · iiif · local-dir)는 이미지·컷까지만 만들고 대사 없이 검수로 넘어간다 — 실패가 아니다.',
            '대기 카운트 ≥ 1. 실패 표시가 있는 호는 재시도로 표시를 지우기 전까지 자동 대상이 아니다.',
          ],
          procedure: [
            {
              title: '계획 먼저 본다',
              detail: '다음 단계 미리보기(dry-run) 로 어떤 스크립트에 어떤 파라미터가 들어가는지 확인한다.',
            },
            {
              title: '화면에서 돌린다',
              detail:
                '드레인 실행. 로그에 `<slug>  from → to (Ns)` 가 한 줄씩 쌓인다. 탭을 옮기거나 창을 닫으면 반복 루프가 끊기지만 이미 끝난 단계는 남는다.',
              done: '로그 마지막 줄 "완료 — 큐가 비었습니다".',
            },
            {
              title: '큰 호는 CLI 로 돌린다',
              detail:
                '터미널에서 `node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --out work/<slug> --record`. `--record` 를 빼면 qc.workDir 가 안 남아 라이브 진행·모던 리더가 아무것도 못 찾는다.',
            },
            {
              title: '여러 호를 한 번에',
              detail:
                '`node scripts/comic/pd/drain-batch.mjs --limit 8` — 드레인 가능한 호를 오래된 순으로 기본 8건까지 순차 처리하고 컷 적재까지 한다. 실패한 호는 사유가 화면 실패 카드에 그대로 기록된다.',
            },
            {
              title: '컷을 DB 로 올린다',
              detail:
                '`node scripts/comic/pd/load-panels.mjs --workdir work/<slug>` — 정제본이 있으면 정제본, 없으면 OCR 원문으로 컷을 적재하고 상태를 검수로 올린다.',
              done: '검수 카운트 증가 + 모니터 탭 "컷 대사" 에 문장이 보임.',
            },
          ],
          verify: [
            '상단 카운터에서 대기·취득·복원·컷 분할이 0 이고 대사 추출/검수 쪽에 모여 있다.',
            '각 행 우측 "N컷" 이 0 이 아니다 — 0 이면 컷 분할이 실질적으로 실패한 것이다.',
            '테스트 · 모니터 탭의 "사용가능 %" — 45% 미만이면 붉게 뜨고, 정제 부담이 크다는 신호다.',
          ],
          recovery: [
            '재실행은 안전하다 — 단계마다 자기 산출물 디렉터리를 덮어쓰고, load-panels 는 그 호의 컷을 전부 지우고 다시 넣어 중복이 생기지 않는다.',
            '중간에 멈춰도 status 는 실패로 덮이지 않고 멈춘 단계 그대로다. 재시도 → 드레인이면 그 지점부터 이어간다.',
            '"타임아웃(280s)" 으로 기록된 호는 화면 드레인으로는 못 넘긴다 — 같은 호를 CLI 로 끝낸 뒤 재시도로 표시만 지운다.',
            '"접근 제한(대출 전용)" 처럼 소스가 막은 항목은 재시도해도 같은 실패다. 큐에서 빼거나 브라우저 보조 취득으로 우회한다.',
          ],
        },
        cautions: [
          '한 단계 CLI 실행이 280초를 넘으면 강제 종료된다 — 전권(50장 이상) 복원은 이 시간에 잘 들어가지 않는다.',
          '실패 사유의 대부분은 코드가 아니라 외부 도구 부재다. 재시도를 누르기 전에 도구 탭을 먼저 본다.',
          '대사 추출(ocr) → 검수 전이만은 실행하는 스크립트가 없고 상태만 바뀐다. 정제·컷 적재 전에 드레인을 계속 누르면 대사 없는 호가 검수로 올라간다.',
        ],
      },

      '테스트 · 모니터': {
        summary: '호별로 지금 무엇이 어떻게 처리됐는지 들여다보고, 한 호만 골라 한 단계씩 돌려 보는 곳.',
        when: '드레인이 실패해 원인 호를 좁힐 때, 또는 현대화 산출물을 원작과 비교해 판정할 때.',
        fields: [
          { label: '● LIVE', detail: '4초마다 큐를 다시 읽는다. 이 탭에 있을 때만 돌고, 정지로 끄면 수동 새로고침만 한다.' },
          {
            label: '드레인 대상 / 방금 진행 / 멈춤',
            detail: '방금 진행 = 최근 실행이 30초 이내인 호. 목록도 멈춤 → 방금 진행 → 대상 → 완료 순으로 정렬된다.',
          },
          {
            label: '사용가능 %',
            detail: 'OCR 대사 중 검수 없이 쓸 수 있는 비율. 70% 이상 초록 · 45% 미만 빨강. 콘텐츠끼리 스캔·OCR 품질을 비교하는 지표다.',
          },
          {
            label: '작업 방식',
            detail:
              'hOCR = 소스가 준 텍스트 레이어를 그대로 썼다는 뜻(오탈자는 원본 OCR 품질을 따라간다). "없음" = 소스가 hOCR 을 주지 않아 대사가 비어 있다는 뜻이며, 이 호는 전사부터 사람·Claude Code 몫이다. 컷을 직접 읽는 로컬 OCR 경로는 은퇴했다.',
          },
          {
            label: '이 이슈 한 단계 진행',
            detail: '실패 표시가 있어도 이 버튼은 돈다 — 전체 드레인만 실패한 호를 건너뛴다. 원인을 고친 뒤 한 호만 확인할 때 쓴다.',
          },
          {
            label: '라이브 진행',
            detail:
              'work 디렉터리를 직접 읽어 원본·복원·컷 썸네일과 현대화 산출물을 보여준다. `--record` 없이 돌린 호는 "work 산출물이 없습니다" 로 뜬다.',
          },
          { label: '컷 대사', detail: 'DB(pd_comic_panels)에 적재된 대사. load-panels 전에는 비어 있다.' },
          {
            label: '자기발전 타임라인',
            detail: 'oplog.mjs 가 쌓은 work/_oplog.jsonl 을 읽어 콘텐츠별 시도·판정을 보여준다. 기록이 없으면 카드 자체가 뜨지 않는다.',
          },
          {
            label: '현대화 방법 (2트랙)',
            detail: '기본은 작화 보존(CPU·$0), 선택은 GPU 리스타일. GPU 트랙은 명시적으로 실행해야만 돌고 발행 기본이 아니다.',
          },
          {
            label: '작화보존 현대화 / AI 리스타일 (행 버튼)',
            detail:
              '드레인처럼 CLI 를 콘솔에서 돌린다. 작화보존 = page-modern(MAX)→page-html(CPU·$0·즉시). AI 리스타일 = modernize.mjs(Qwen@RunPod, COMFY_URL 필요) — GPU·비가역 비용이라 먼저 도구 탭의 GPU 연결 점검으로 준비를 확인한다. 끝나면 라이브 진행이 자동으로 열려 산출물이 보인다.',
          },
          {
            label: '현대화 배지 (작화보존✓ · 리더✓ · AI 리스타일✓)',
            detail:
              '이 호가 어디까지 현대화됐는지 산출물로 판정해 보여준다(선형 단계가 아니라 트랙별 상태). "아직 안 함" 이면 현대화 버튼부터 누른다. 리더✓ 는 모던 리더(page-html)까지 됐다는 뜻.',
          },
          {
            label: '발행 (검수 호 전용)',
            detail:
              '검수(review) 상태 행에만 뜬다. 펼치면 ①PD 근거 확정(pd_basis+검증기록) ②콘텐츠 업로드(현대화 페이지를 공개 버킷 comic/pd/<slug>/ 로) ③발행 순. 콘텐츠 업로드 전에는 "발행" 이 잠긴다 — 공개 URL 이 없으면 학습자에게 깨진 이미지가 나가기 때문. 체크리스트 5종(PD근거·검증·출처URL·현대화·콘텐츠서빙)이 모두 초록이어야 발행된다.',
          },
        ],
        drain: {
          what:
            '컷·페이지를 읽히는 결과물로 바꾼다 — 정제 대사(bubbles.refined) + 색채 현대화 페이지(page-modern) + 모던 말풍선 오버레이(letter.spec → 모던 리더).',
          prerequisites: [
            '해당 호가 대사 추출(ocr) 이후이고 work/<slug>/ 에 panels·bubbles 매니페스트가 있을 것.',
            '`--record` 로 실행돼 qc.workDir 가 남아 있을 것 — 없으면 라이브 진행도 모던 리더도 빈 화면이다.',
            'ffmpeg(page-modern) · Playwright chromium(render-check, apps/web e2e 의존성).',
          ],
          procedure: [
            {
              title: '정제 인테이크 뽑기',
              detail: '`node scripts/comic/pd/refine.mjs --intake work/<slug>` → refine.intake.json (컷별 OCR 파편 + 지시문).',
            },
            {
              title: 'Claude Code 가 대사 작성',
              detail:
                'intake 를 읽고 refine.output.json 을 쓴다 — 컷 id 별로 파편을 읽는 순서로 병합·교정하고, 필요하면 고어체를 현대 영어로 순화한다. 스크립트는 LLM 을 부르지 않는다(저장소 무키 원칙).',
            },
            {
              title: '정제 흡수',
              detail:
                '`node scripts/comic/pd/refine.mjs --ingest work/<slug>` → bubbles.refined.manifest.json. output 에서 생략한 컷은 OCR 원문이 그대로 남는다.',
            },
            {
              title: '컷 적재',
              detail: '`node scripts/comic/pd/load-panels.mjs --workdir work/<slug>` — 정제본 우선으로 컷을 교체하고 상태를 검수로 올린다.',
              done: '컷 대사 드릴다운에 "·정제" 표시가 붙은 문장이 보인다.',
            },
            {
              title: '이미지 현대화',
              detail:
                '`node scripts/comic/pd/page-modern.mjs --workdir work/<slug> --level MAX` — 원작 구성은 그대로 두고 색채·디자인만 바꾼다. 결과는 page-modern/ + compare_preview.jpg(원작|결과).',
            },
            {
              title: '말풍선 스펙 작성',
              detail:
                'Claude Code 가 page-modern 이미지를 직접 보고 work/<slug>/letter.spec.json 에 비율 좌표(0~1)와 모던 대사를 적는다. OCR 좌표는 부정확해 쓰지 않는다.',
            },
            {
              title: '렌더 검증 루프',
              detail:
                '`node scripts/comic/pd/page-html.mjs --workdir work/<slug>` → `node scripts/comic/pd/render-check.cjs --workdir work/<slug>`. 어긋난 곳은 letter.spec.json 숫자만 고쳐 다시 돌린다 — 이미지 재작업이 없다.',
            },
            {
              title: '판정 기록',
              detail:
                '`node scripts/comic/pd/oplog.mjs --slug <slug> --content "<제목>" --phase page-modern --action adopt|reject|improve|pivot --title … --verdict … --next …`.',
              done: '자기발전 타임라인에 그 콘텐츠의 스텝 점이 하나 늘어난다.',
            },
          ],
          verify: [
            '라이브 진행 → 현대화 산출물 에 "작화보존 · 구성보존 현대화" 카드와 원작|결과 비교 프리뷰가 뜬다.',
            '모던 리더 ↗ 로 열었을 때 말풍선이 그림 위 제자리에 앉고 대사가 읽힌다.',
            '자기발전 타임라인의 마지막 액션이 채택인지 확인한다 — 판정 대기로 남아 있으면 아직 끝난 게 아니다.',
          ],
          recovery: [
            '어느 단계든 재실행이 안전하다 — 산출물 디렉터리와 매니페스트를 덮어쓰고, 컷 적재는 이슈 단위 전체 교체다.',
            'refine.output.json 없이 --ingest 하면 그냥 에러로 멈춘다(기존 산출물은 그대로).',
            '원작 위에 대사를 굽는 경로(reletter · page-letter)는 좌표 부정확으로 작화가 훼손돼 반려됐다. HTML 오버레이(letter.spec)로만 간다.',
          ],
        },
        cautions: [
          'LIVE 를 켜 두면 4초마다 큐 전체를 다시 읽는다 — 드레인을 돌리는 동안에는 로그가 밀리므로 관찰만 할 때 켠다.',
          '이 탭의 어떤 버튼도 발행하지 않는다. 모던 리더가 잘 보여도 학습자에게는 아직 안 나간다.',
        ],
      },

      '도구': {
        summary: '드레인이 계속 실패할 때 제일 먼저 열 곳 — CLI 환경 점검(pipeline.mjs --doctor) 출력을 그대로 보여준다.',
        when: '탭을 열면 자동으로 한 번 점검이 돈다. 도구를 설치·설정한 뒤 다시 누른다.',
        fields: [
          {
            label: 'ffmpegBin',
            detail:
              '(PATH) 면 환경변수 없이 PATH 를 쓴다는 뜻. 저장소에 tools/ffmpeg/ffmpeg.exe 가 있으면 드레인이 자동으로 그걸 쓰지만 이 값에는 안 나온다 — 판단은 점검 출력의 ffmpeg 행으로 한다.',
          },
          {
            label: '점검 출력',
            detail:
              'ffmpeg · 소스별 검색 응답과 소스별 대사추출 가능 여부를 표로 낸다. 아무것도 만들지 않는 점검 전용 실행이고, 출력은 끝 6000자만 보여준다.',
          },
          {
            label: 'GPU 연결 점검 (connect-check)',
            detail:
              'AI 리스타일(선택 트랙)이 도는 자가호스트 GPU 연결을 read-only 로 본다 — RunPod(pod) · ComfyUI(COMFY_URL). AI 리스타일을 누르기 전에 여기서 ComfyUI 가 ✓ 인지 확인한다(만료돼 있으면 RunPod pod 를 기동해 .comfy-url 을 갱신해야 한다). 과금·GPU 사용 없음.',
          },
        ],
        cautions: [
          'ffmpeg 이 없으면 복원·컷분할이 아예 불가능하다 — 다른 항목이 OK 여도 큐는 2단계에서 전부 멈춘다.',
          '점검이 70초를 넘으면 잘린 출력이 표시된다. 소스 응답이 느릴 때 발생하며 도구 문제와 구분해야 한다.',
        ],
      },
    },
  },

  'pd-comics-reader': {
    title: '모던 리더 preview — 발행 전 학습자 화면',
    screen: {
      summary: '발행 전 호를 학습자 리더 그대로 열어 보는 화면 — 현대화 페이지 위에 모던 말풍선·듣기·단어 뜻이 얹힌다.',
      when: '테스트 · 모니터 탭 각 행의 "모던 리더 ↗". dev 에서만 열리고 배포 환경에서는 404 다.',
      fields: [
        {
          label: '말풍선',
          detail:
            'letter.spec.json 좌표로 얹은 HTML 오버레이다 — 원작 이미지에 굽지 않는다. 위치가 어긋나면 이미지가 아니라 그 JSON 숫자를 고치고 다시 연다.',
        },
        {
          label: '말풍선 우상단 스피커',
          detail: '브라우저 음성(speechSynthesis)이다. 서버 TTS 가 아니라서 목소리·품질은 보는 사람의 OS·브라우저 설정을 따른다.',
        },
        {
          label: '단어 탭',
          detail: 'lookup_word_meaning RPC 로 뜻을 찾는다. 사전에 없으면 "사전에 없는 단어예요" 로 뜨는 것이 정상 동작이다.',
        },
        {
          label: '"현대화 산출물이 없습니다"',
          detail: 'page-modern 을 아직 안 돌렸거나, --record 없이 돌려 qc.workDir 가 없는 호다. 오류가 아니라 앞 단계 미완료 신호.',
        },
      ],
      cautions: [
        '여기서 잘 보여도 발행된 것이 아니다 — 학습자 서가(/comics/restored)는 PD 근거 4종을 갖춘 발행본만 노출한다.',
        'letter.spec.json 이 없으면 페이지 이미지만 뜨고 말풍선은 하나도 안 나온다(에러 표시 없음).',
      ],
      seeAlso: [{ label: 'PD 큐로 돌아가기', href: '/admin/pd-comics' }],
    },
  },
}
