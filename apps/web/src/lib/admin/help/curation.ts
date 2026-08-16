// apps/web/src/lib/admin/help/curation.ts
//
// LCP — 도서 큐레이션 (/admin/curation) 화면도움말.
// 스키마·작성 원칙은 ./types.ts 참조. 화면을 바꾸면 이 파일도 같은 커밋에서 고친다.
//
// 탭 키는 AdminCurationClient 의 TABS[].label 문자열 그대로다 (라벨을 바꾸면 여기도).

import type { HelpRegistry } from './types'

export const LCP_HELP: HelpRegistry = {
  curation: {
    title: 'LCP — 라이브러리 큐레이션',
    screen: {
      summary:
        'PD/CC 소스에서 책을 끌어와 큐 → 로직 처리 → 검수 → 게시까지 밀어 넣는 콘솔. 탭은 "어디서 가져오나"로 나뉘고, 가져온 뒤는 전부 Curated Books 에서 추적한다.',
      when: '새 도서를 카탈로그에 넣을 때, 또는 처리가 멈춘 도서의 상태를 확인할 때.',
      steps: [
        {
          title: '후보 확보',
          detail:
            '여러 권을 한 번에 훑으려면 「소스 GET (대량)」, 특정 책 한 권이면 소스별 ID 탭, 검증된 고전이면 「추천 시드」. 어느 경로든 결과는 같은 library_books 큐로 모인다.',
          done: '상단 「전체」 카운트가 늘고 Curated Books 에 대기 중 행이 생긴다.',
        },
        {
          title: '로직 처리',
          detail:
            '수집·정규화·챕터 분절·분석·어휘 추출·V-Level·LibriVox 자동 매핑까지는 판단이 필요 없어 코드가 한 번에 돌린다. 권당 수십 초 걸린다.',
          done: '상태가 검토 대기로 바뀐다.',
        },
        {
          title: '검수',
          detail:
            '행을 클릭해 상세 모달을 열고 「📖 본문 검수」로 들어간다. 챕터 분절·낭독 연결·추출 단어를 여기서 본다.',
        },
        {
          title: '게시',
          detail:
            '검수 화면에서 게시한다. 게시하는 순간 챕터 단어장이 트리거로 자동 생성되므로, 게시 전에는 단어장 수가 0인 게 정상이다.',
          done: '스테퍼의 게시됨 카운트가 늘고 학습자 카탈로그에 노출된다.',
        },
        {
          title: '후처리 큐 적재 (선택)',
          detail:
            '스크립트 퀴즈·레벨 검토·어휘 감사는 게시 전후에 Curated Books 에서 체크 선택 후 큐에 넣는다. 실제 생성·판정은 Claude Code 드레인이 한다.',
        },
      ],
      fields: [
        {
          label: '상단 4 타일',
          detail:
            '「처리 중」에는 아직 손대지 않은 대기(queued)까지 포함된다 — Curated Books 스테퍼의 「로직 처리중」과 숫자가 다른 이유다. 「실패」는 fetch/preview/ingest/enrich 실패를 합친 값.',
        },
        {
          label: '저작권 게이트',
          detail:
            'copyright_safe_in_kr 은 저자 사망연도가 아니라 license 문자열로 판정한다(PD… · CC… · public domain 포함이면 통과). Wikibooks·Wikisource·OpenStax·StoryWeaver 는 모두 여기서 자동 통과 — 각 탭 안내문의 "강제 publish 필요"는 사후 70년 룰을 쓰던 시절 문구다.',
        },
      ],
      cautions: [
        '「큐 처리 (dev)」·「Dev 일괄 처리」·상세 모달의 「재처리 (dev)」는 dev 서버 전용이다. production 에서는 API 가 거부한다(pg_cron 경로 사용).',
      ],
      seeAlso: [
        { label: '품질 지표', href: '/admin/quality' },
        { label: '콘텐츠(발행 도서)', href: '/admin/library' },
      ],
    },

    tabs: {
      'Curated Books': {
        summary:
          '큐에 들어온 도서를 상태별로 추적하고, 처리·검수·게시·후처리 큐 적재를 실제로 누르는 곳.',
        fields: [
          {
            label: '작업 순서 스테퍼',
            detail:
              '단계를 누르면 아래 목록이 그 상태로 필터된다. 카운트 0인 단계는 접히고, 현재 권장 단계와 게시됨만 항상 보인다.',
          },
          {
            label: '큐 처리 (dev · N권)',
            detail:
              '대기 중 전체를 확인 없이 즉시 순차 처리한다. 진행 배너의 「중지」는 현재 권을 끝낸 뒤 멈춘다 — 즉시 취소가 아니다.',
          },
          {
            label: 'Dev 일괄 처리',
            detail:
              '체크한 것 중 처리중·검토대기·실패만 대상이다. 실패 도서는 ingest 부터 다시 시작하므로 정규식·네트워크 일시 실패를 고친 뒤 재시도용으로 쓴다.',
          },
          {
            label: '새로고침',
            detail:
              '드레인·소스 GET 처럼 이 화면 밖에서 바뀐 결과는 자동으로 들어오지 않는다. 목록·상단 통계·드레인 큐 배너를 한 번에 다시 읽는다.',
          },
          {
            label: '소스 칩의 TS · TB 배지',
            detail:
              'T + 소스 tier(S/A/B/C/M). tier 는 레벨 판정 confidence 계산에 그대로 들어간다 — Std Ebooks·OpenStax 가 S, Gutenberg 가 B.',
          },
          {
            label: '추출 열',
            detail:
              '어휘 해석률. 배지 옆 숫자는 사전·보조자산 어디로도 해석되지 않은 진짜 공백 수로, 크면 검수 화면에서 사전 등재 큐에 올릴 대상이다.',
          },
          {
            label: '단어장 열',
            detail: '발행된 챕터 단어장 수. 게시 전에는 항상 0 — 게시 트리거가 만든다.',
          },
          {
            label: '스크립트 퀴즈 큐 / 레벨 검토 큐 / 어휘 감사 큐',
            detail:
              '적재만 한다. 자격은 퀴즈·레벨 검토 = 검토대기 또는 게시됨, 어휘 감사 = 게시됨만이고, 자격 밖은 서버 RPC 가 조용히 스킵한다(결과 알림에 스킵 권수가 뜬다).',
          },
        ],
        cautions: [
          '「소스로 되돌리기 (삭제)」는 상태 롤백이 아니라 library_books DELETE 다. 챕터·추출 어휘·draft 단어장까지 cascade 로 사라지고 복구는 없다. 대신 seed 가 unlock 되어 「소스 GET (대량)」에서 다시 fetch 할 수 있다. 게시 단어장이나 사용자 진도가 있는 도서만 자동 스킵된다.',
          '게시됨 도서를 상세 모달에서 「재처리 (dev)」 하면 status 가 검토 대기로 내려가 학습자 카탈로그에서 빠진다 — 끝난 뒤 다시 게시해야 한다.',
          '퀴즈·검토 큐에 같은 도서를 다시 적재하면 진행률과 이전 검토 결과가 리셋된다. 이미 만든 퀴즈 문항은 재드레인 시 순서 키로 덮어쓴다.',
          '상세 모달의 「영구 삭제」는 확인란에 삭제를 타이핑해야 실행되고 되돌릴 수 없다. 사용자 학습 기록은 SET NULL 로 보존된다.',
        ],
        drain: {
          what:
            '스크립트 퀴즈 문항 · LibriVox 챕터 매핑 · 레벨 판정 · 어휘 감사 결과. 네 task 모두 LLM 판단이 필요해 버튼만으로는 끝나지 않는다.',
          prerequisites: [
            '🛠 큐레이션 드레인 큐 배너에 대기/진행 건이 있을 것 — 0건이면 배너 자체가 뜨지 않는다.',
            '대상 도서가 로직 처리를 끝냈을 것(검토 대기 이상). 챕터 본문이 없으면 읽을 게 없다.',
            'apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 있을 것 — 드레인 스크립트가 여기서 읽는다.',
          ],
          procedure: [
            {
              title: '큐 훑기',
              detail: 'node scripts/lcp/drain.mjs list — 미완 잡을 책별·task 별로 한 번에 본다.',
            },
            {
              title: '런북 받기',
              detail:
                'node scripts/lcp/drain.mjs next [book_id] — 그 책의 pending task 마다 실행할 helper 커맨드 순서를 출력한다. book_id 를 빼면 다음 책을 고른다.',
            },
            {
              title: '런북 그대로 실행',
              detail:
                '퀴즈는 generate-chapter-quiz.mjs plan → content <ch> → insert <ch> --file, 레벨은 review-book.mjs plan → apply --file [--correct], 어휘는 audit-vocab.mjs plan → apply --file, 매핑은 librivox-align.mjs dry-run → --commit. plan 단계는 쓰기가 없다.',
              done: 'apply/insert 가 잡 status 와 진행률을 DB 에 갱신한다.',
            },
          ],
          verify: [
            '드레인 큐 배너를 새로고침 — 해당 잡이 완료로 바뀐다. 진행 중 건이 하나도 없어야 배너에 닫기 버튼이 생긴다.',
            '퀴즈는 배너를 펼쳐 chapters_done/total 과 누적 문항 수를 본다.',
            '검토는 배너 요약으로 본다 — 레벨은 CEFR/V(verdict), 어휘는 flagged N.',
            '퀴즈·단어장 실물은 그 도서의 검수 화면(챕터 퀴즈 검수 / 챕터 단어장 검수)에서 확인한다.',
          ],
          recovery: [
            '진행 중 잡이 있으면 배너가 8초마다 자동 폴링한다. 갱신이 멈춘 것처럼 보이면 배너를 펼쳐 status 가 failed 인지 본다 — 실패 사유가 행에 그대로 뜬다.',
            '드레인은 도서 단위라 중간에 끊겨도 이미 insert 된 챕터는 남는다. 같은 책을 이어서 다시 돌리면 된다.',
          ],
        },
      },

      '소스 GET (대량)': {
        summary:
          '소스 API 를 직접 호출해 후보 도서를 library_seed_catalog 로 긁어오고, 그중 쓸 것만 골라 큐에 넣는 곳.',
        when: '카탈로그가 비었거나, 특정 난이도·연령대 책을 새로 늘려야 할 때.',
        steps: [
          {
            title: 'GET batch',
            detail:
              '소스·정렬·장르·배치 수를 고르고 가져온다. 결과 줄에 신규/중복 건수가 뜨고, 소스에 더 남아 있으면 「더 가져오기」가 offset 을 이어받는다.',
            done: '아래 리스트가 방금 고른 소스로 자동 필터되어 채워진다.',
          },
          {
            title: '소스 메타 보강 (먼저 이것부터)',
            detail:
              '목록 API 는 제목·표지·저자만 준다 — 줄거리·주제·분량은 소스의 개별 도서 페이지에만 있다. 「메타 없는 후보 보강」이 그 페이지를 긁어온다(Gutenberg · Standard Ebooks · Lit2Go 만 지원). 8건씩 반복하며 진행이 표시되고, 버튼이 「멈추기」로 바뀌어 언제든 중단할 수 있다. AI 생성이 아니라 원문 그대로라 비용이 없고, 다시 눌러도 이미 채운 행은 건너뛴다.',
            done: '카드에 줄거리 두 줄과 분량·읽기 시간 칩이 나타난다. 한 회차에서 한 건도 못 채우면 소스 페이지 구조 변경일 수 있어 자동 중단된다.',
          },
          {
            title: '큐레이션 정보 채우기',
            detail:
              '유형·연령·학습 도움·추정 V-Level·한국어 줄거리는 소스가 주지 않는다. 「정보 없는 도서 큐에 추가」로 인기순 100건을 큐잉하면 Claude Code 배치가 채운다. 위의 소스 메타 보강을 먼저 돌리면 원문 줄거리가 있는 책은 굳이 생성하지 않아도 된다.',
            done: '행에 "큐레이션 정보 생성 대기 중"이 뜨고, 채워지면 줄거리·테마 칩으로 바뀐다.',
          },
          {
            title: 'enqueue',
            detail: '쓸 행만 enqueue 한다. 이후 추적은 Curated Books 탭.',
            done: '행 버튼이 「큐」 배지로 바뀐다.',
          },
        ],
        fields: [
          {
            label: '배치 (최대 N)',
            detail:
              '상한은 소스마다 다르다. 카테고리에 실제로 있는 수가 적으면 배치보다 적게 들어오는 게 정상이다.',
          },
          {
            label: '난이도 필터',
            detail:
              '추정 V-Level 기준이고 CEFR 은 보조 표기다. 여기 값은 ingest 전 추정치라, 처리 후 실측 V-Level 로 대체된다.',
          },
          {
            label: 'SE 정리 필터',
            detail:
              'Standard Ebooks 에 같은 책이 있는 Gutenberg 행 = 삭제 대상(기본 숨김), SE 판이 없는 Gutenberg = SE 변환 후보.',
          },
          {
            label: 'SE 변환',
            detail:
              '제목 우선 매칭으로 Standard Ebooks 판을 카탈로그에 추가하고 이 Gutenberg 행을 치운다. SE 에 같은 책이 없으면 아무것도 바뀌지 않고 안내만 뜬다.',
          },
          {
            label: '소스 목록의 LibriVox 부재',
            detail:
              '낭독은 독립 GET 대상이 아니다. Gutenberg·Std Ebooks 도서에 검수 화면에서 보이스로 연결한다.',
          },
        ],
        cautions: [
          '「삭제 대상 N건 모두 삭제」는 카탈로그 행을 실제로 지운다. 이미 큐에 들어간 행은 보호되지만 나머지는 되돌릴 수 없어 다시 GET 해야 한다.',
          '결과 0건은 대개 실패가 아니라 "그 카테고리에 없거나 이미 전부 카탈로그에 있음"이다 — 필터를 바꾸기 전에 중복 건수를 먼저 본다.',
        ],
      },

      '소스 카탈로그': {
        summary:
          '어디서 가져올지 고르기 전에 소스 자체를 비교하는 곳. 카드를 누르면 그 소스의 입력 탭으로 넘어간다.',
        fields: [
          {
            label: '평가 점수 6축',
            detail:
              '텍스트·메타·API·학습·라이선스·규모. 종합 점수는 이 축들의 요약이고 정렬 기준으로도 쓴다 — 낮은 축이 그 소스에서 실제로 겪을 불편이다.',
          },
          {
            label: 'KR safe / KR check',
            detail:
              'safe 는 라이선스만으로 배포 판정이 나는 소스, check 는 도서별로 사람이 확인해야 하는 소스(수동 입력·Open Library 등).',
          },
          {
            label: '구현 예정 카드',
            detail: '버튼이 비활성이다 — 아직 GET 경로가 없어 클릭해도 탭이 열리지 않는다.',
          },
          {
            label: '카드 클릭 시 이동처',
            detail:
              'gutenberg·standard_ebooks 는 「추천 시드」로, wikibooks·wikisource·openstax·storyweaver 는 각자의 ID 입력 탭으로 간다.',
          },
        ],
      },

      '추천 시드': {
        summary:
          '패키지에 박아 둔 고전 추천 목록 — 카탈로그 GET 없이 바로 큐에 넣을 수 있는 지름길.',
        when: '카탈로그가 비어 있거나, 검증된 고전부터 빠르게 채우고 싶을 때.',
        fields: [
          {
            label: '선택',
            detail:
              '큐 추가 확인 모달이 뜨고, 추가되면 Curated Books 탭으로 자동 이동한다. 같은 (소스, id) 는 멱등이라 두 번 넣어도 행이 늘지 않는다.',
          },
          {
            label: '상태 배지',
            detail:
              '이미 library_books 에 있는 시드는 「선택」 대신 현재 상태가 뜬다 — 소스와 id 를 함께 보므로 Gutenberg 판과 SE 판은 별개로 센다.',
          },
          {
            label: '소스 필터',
            detail:
              '고르면 장르·CEFR 옵션이 그 소스에 실제 존재하는 값으로 좁혀지고, 맞지 않는 하위 필터는 자동 해제된다(0건 조합 방지).',
          },
          {
            label: 'CEFR',
            detail: '시드 파일에 적어 둔 추정치다. 처리 후 실측 V-Level 로 대체된다.',
          },
        ],
      },

      'Gutenberg ID': {
        summary: 'Gutenberg 책 번호 하나로 본문 앞부분을 확인한 뒤 큐에 넣는 곳.',
        fields: [
          {
            label: '입력값',
            detail: 'URL 마지막 숫자 1~7자리. 다른 형식은 요청 전에 막힌다.',
          },
          {
            label: '미리보기',
            detail:
              '제목·저자·생몰년·본문 발췌를 소스에서 가져온다. 「큐에 추가」는 미리보기가 뜬 뒤에만 나타난다 — 본문이 엉뚱하면 여기서 걸러야 한다.',
          },
        ],
        cautions: [
          '같은 책이 Standard Ebooks 에 있으면 그쪽 텍스트·메타 품질이 낫다. 이미 Gutenberg 로 넣었다면 「소스 GET (대량)」의 SE 변환으로 갈아탈 수 있다.',
        ],
      },

      Wikibooks: {
        summary: 'en.wikibooks.org 페이지 제목으로 학습서를 가져오는 곳 — 하위 페이지가 챕터가 된다.',
        fields: [
          {
            label: '페이지 제목',
            detail: 'URL 마지막 부분만 넣는다. 공백은 자동으로 _ 로 바뀐다.',
          },
          {
            label: 'sub-page 수집',
            detail: '상위 페이지를 넣으면 최대 50개까지 자동 수집된다 — 더 큰 교재는 뒷부분이 빠진다.',
          },
          {
            label: '게시 게이트',
            detail:
              'license 는 CC-BY-SA-3.0 으로 들어가고 이 값은 게이트를 자동 통과한다. 탭 안내문의 "강제 publish 필요"는 사후 70년 룰을 쓰던 시절 문구다.',
          },
        ],
      },

      Wikisource: {
        summary: 'en.wikisource.org 페이지 제목으로 PD 텍스트를 가져오는 곳.',
        fields: [
          {
            label: '페이지 제목',
            detail: 'URL 마지막 부분만 넣는다. 공백은 자동으로 _ 로 바뀐다.',
          },
          {
            label: 'sub-page 수집',
            detail: '상위 페이지를 넣으면 챕터 하위 페이지가 최대 100개까지 자동 수집된다.',
          },
          {
            label: '게시 게이트',
            detail:
              'license 는 PD 로 들어가고 이 값은 게이트를 자동 통과한다 — 저자 생몰년이 없어도 막히지 않는다. 다만 위키 편집본이라 본문 품질은 검수 화면에서 직접 봐야 한다.',
          },
        ],
      },

      OpenStax: {
        summary: 'openstax.org 교과서 슬러그로 OA 교재를 가져오는 곳.',
        fields: [
          {
            label: 'Book slug',
            detail: 'URL 마지막 segment. 소문자·숫자·하이픈만 허용하고 100자를 넘으면 막힌다.',
          },
          {
            label: '수집 범위',
            detail: '최대 30 챕터. 그보다 긴 교재는 뒷부분이 들어오지 않는다.',
          },
          {
            label: '본문 가공',
            detail:
              '수식(MathML)은 [수식] 으로 치환되고 표·이미지 캡션은 제거된다 — 단어 추출 노이즈를 줄이려는 것이라 원문과 달라 보이는 게 정상이다.',
          },
        ],
        cautions: [
          '교재는 분량이 커서 로직 처리가 오래 걸리고 추출 단어 수도 수십만 단위가 된다 — 큐에 여러 권을 한꺼번에 넣지 않는 편이 낫다.',
        ],
      },

      StoryWeaver: {
        summary:
          'storyweaver.org.in 그림책을 id 또는 slug 로 가져오는 곳 — 삽화와 낭독이 함께 들어온다.',
        fields: [
          {
            label: 'Story id / slug',
            detail: 'story URL 의 id 부분. 전체 URL 을 붙여넣어도 된다.',
          },
          {
            label: '함께 들어오는 것',
            detail:
              '페이지별 삽화(링크)와 낭독 오디오가 같이 수집되어 학습자 화면에 그대로 노출된다 — 검수 화면의 삽화 패널에서 페이지 정합을 확인한다.',
          },
          {
            label: '게시 게이트',
            detail: 'CC BY 4.0 이라 게이트를 자동 통과한다.',
          },
        ],
        cautions: [
          '그림책은 본문이 수백 단어뿐이라 챕터 단어장이 임계값(10단어) 아래로 떨어지기 쉽다 — 검수 화면에서 저단어 경고를 확인하고 게시한다.',
        ],
      },
    },
  },

  'curation-preview': {
    title: 'LCP — 도서 검수',
    screen: {
      summary:
        '게시 전에 사람이 확인하는 마지막 관문 — 본문·삽화·낭독·추출 단어·챕터 단어장·챕터 퀴즈를 한 페이지에서 본다.',
      when: 'Curated Books 에서 검토 대기(또는 게시됨) 도서의 상세 모달 → 「📖 본문 검수」로 들어온다.',
      steps: [
        {
          title: '본문 훑기',
          detail:
            '리더에서 ← / → 로 장을 넘기며 챕터 분절이 깨졌는지, 머리말·판권·목차가 본문에 섞였는지 본다. 여기서 걸러야 재처리 비용이 적다.',
        },
        {
          title: '낭독 연결 확인',
          detail:
            'LibriVox 패널은 gutenberg·standard_ebooks·librivox 도서에만 나온다. 로직 처리에서 자동 매핑이 되면 이미 챕터별로 연결돼 있고, 정합에 실패한 책만 손으로 맞춘다.',
        },
        {
          title: '추출 단어 확인',
          detail:
            '「추출」을 누르면 실제 발행될 단어장과 같은 목록·순서가 나온다. 사전 미바인딩이 많으면 그 자리에서 등재 큐에 올린다(뜻 생성·등재는 Claude Code 배치).',
        },
        {
          title: '게시',
          detail:
            '상단 「게시」는 신뢰도 임계값과 무관하게 즉시 게시한다. 이 순간 챕터 단어장이 트리거로 생성된다.',
          done: '단어장 검수 섹션이 빈 안내에서 챕터 표로 바뀐다.',
        },
        {
          title: '퀴즈·단어장 검수',
          detail:
            '챕터 단어장·챕터 퀴즈 섹션에서 행을 클릭해 실물을 본다. 퀴즈 문항은 드레인이 만든 것이라 여기서는 확인만 한다.',
        },
      ],
      fields: [
        {
          label: '게시 버튼 자리',
          detail:
            '누를 수 없을 때는 버튼 대신 사유가 뜬다 — 저작권 미확인 / 처리 중 / 보관됨. 게시 자격은 검토 대기 또는 실패 상태뿐이고, 이미 게시된 책은 「게시됨」 배지로 바뀐다.',
        },
        {
          label: '학습 단어 추출 — 미리보기 = 실제 발행',
          detail:
            '이름 그대로 미리보기가 곧 발행본이다. book_v_level 이상 단어만 남기고 고어·시대어는 빼며, composite = freq_boost 0.70 + 챕터 salience 0.10 + skill penalty 로 정렬한다.',
        },
        {
          label: '사전 미바인딩 단어',
          detail:
            '조치 대상 건수만 세면 된다. "설명됨"으로 분류된 것(보조사전·형태 회수·외국어·노이즈)은 손댈 필요가 없다. ' +
            '외국어 인용은 본문이 괄호로 번역을 병기한 대목을 자동 판정한 것이라(is_quoted_foreign_citation) 검수 대상이 아니다.',
        },
        {
          label: '실단어 미등재를 큐에 올리기 전에',
          detail:
            '전부 올리면 안 된다. 다국어 인용·저자가 일부러 뭉갠 철자(억양 표기)·라틴어 관용구가 섞여 있고, ' +
            '드레인은 그런 것에도 뜻을 만들어 낸다. 근거 문장을 먼저 보고, 표준 영어형이 없는 것은 ' +
            'noise_blacklist 로 내린다 — 판정 근거를 남기려고 삭제가 아니라 is_blocking 플래그를 쓴다.',
        },
        {
          label: '저단어 / 저문항 경고',
          detail:
            '챕터 단어장은 10단어 미만, 챕터 퀴즈는 3문항 미만이면 경고가 뜬다 — 분절이 너무 잘게 쪼개졌다는 신호인 경우가 많다.',
        },
        {
          label: '보관',
          detail: '카탈로그에서 내리되 데이터는 남긴다. 보관 상태에서는 게시할 수 없다.',
        },
      ],
      cautions: [
        '게시·보관·재처리를 누르면 성공 즉시 /admin/curation 목록으로 되돌아간다 — 같은 책을 더 볼 게 있으면 순서를 뒤로 미룬다.',
        '삭제·재처리 같은 되돌리기 액션은 이 화면이 아니라 Curated Books 의 상세 모달에 있다.',
        '챕터 퀴즈 검수는 발행 여부와 무관하게 보인다 — 여기서 문항이 보인다고 학습자에게 노출된 것은 아니다.',
      ],
      seeAlso: [{ label: '큐레이션 목록으로', href: '/admin/curation' }],
    },
  },
}
