# Conventions

> Vocaflow 코드 작성 패턴 · 네이밍 · 안티패턴. 새 PR 머지 전 체크리스트로 활용.
> 작성 시점: 2026-06-08 (v06.34).

---

## 절대 하지 않을 것

### 조용한 실패 (이 코드베이스의 지배적 결함 유형 — 2026-08-15 실측 8건)

**실패를 침묵시키지 말 것. 폴백을 썼으면 폴백임을 말할 것.**

- ❌ **목업으로 폴백** — `realStats?.total ?? words.length` 에서 `words` 초기값이 `MOCK_WORDS` 였다.
  실제 252단어인 학습자가 **13** 을 자기 수치로 보고 있었다. `/text/[id]` 는 지금도 본문 로드 실패 시
  `MOCK_PARAGRAPHS` 를 렌더한다 — 학습자가 가짜 영어를 읽는다
- ❌ **`loading` · `unauth` · `error` 를 한 문장으로 뭉개기** — "단어가 누적되면 보여요" 하나로 셋을
  덮으면 **조회 실패가 "내 단어가 부족한가 보다" 로 읽힌다**
- ❌ **값만 넘기기** — 화면에 `T | null` 만 주면 "아직 못 셌다" 와 "세어보니 0" 을 구별할 수 없다.
  **상태 전체**(`{status, data}`)를 넘길 것
- ❌ **"몇 번 눌러야 하나" 를 통과 조건으로 삼기** — 필터·칩이 많은 화면에서 Tab 횟수를 재면
  **통과할 방법이 기능을 없애는 것뿐**이 된다. 필요한 것은 적게 누르는 것이 아니라
  **건너뛸 수 있는 것**이다. 계측은 그 쪽을 봐야 한다(건너뛰기가 있는가 · 눌렀을 때
  포커스가 실제로 옮겨 가는가).
  · 실측 2026-08-22 — 교재 서가에 축 3개 · 칩 21개를 얹은 뒤 **첫 권 링크까지 Tab 24번**이었다.
    칩을 줄이는 대신 포커스에만 나타나는 건너뛰기를 냈다(분류 체계는 눈에 보여야 한다).
  · 축이 여럿인 칩 묶음은 `role="group" aria-label="<축>"` 으로 싼다 — 안 그러면
    스크린리더가 21개를 한 덩어리로 읽고, `V3` 만 들으면 **무엇의 3인지 알 수 없다.**
- ❌ **정적 검사를 대비(contrast) 보증으로 착각하기** — `on-p-contrast` 래칫은 **클래스 문자열**을
  본다(`text-white` 가 `bg-[var(--p)]` 위에 있나). **토큰으로만 칠한 화면은 그 검사를 전부
  통과하면서도 AA 미달일 수 있다** — 조합은 문자열에 안 나타난다.
  · 실측 2026-08-22 — 교재 4화면이 래칫을 통과했지만 실제 렌더 대비는 미달이었다.
    `91-hub-design-capture` 에 `lowContrast` 계측(브라우저가 계산한 색 + 알파 합성)을 달아 잡았다.
  · **계측기부터 검증할 것**: 첫 판이 알파를 버려 다크 `--p-light`(`rgba(...,0.18)`)를 불투명으로
    읽고 **"1.67:1 미달" 8건을 지어냈다.** 틀린 숫자가 맞는 숫자처럼 인쇄되는 것이
    측정 안 하는 것보다 나쁘다 — 고치기 전에 계측기를 먼저 의심할 것.
- ❌ **공개 표면에서 RLS 결과를 데이터로 읽기** — **RLS 는 오류를 내지 않는다. 행을 지운다.**
  익명 요청에서 `count` 는 0, `error` 는 `null` 이라 클라이언트에서는 "0건" 과 "못 읽음" 을
  **구별할 방법이 없다.** `if (!count) return` / `data ?? []` 는 그 순간 권한 실패를 사실로 인쇄한다.
  · 실측 2026-08-22 — `/library/textbooks` 가 로그인 7/7, **비로그인 5/7** 이었다.
    초등 재고를 `shared_dictionary`(RLS `authenticated` 전용)에서 세는데 서가는 공개 표면이라,
    익명 방문자에게만 계단 1·2 가 '근간 예정'(재료 없음)으로 보였다.
    **로그인해서 확인하면 멀쩡하니 개발 중에는 절대 안 잡힌다.**
  · 같은 스윕에서 `/library/vocab` 도 확인 — 익명은 발행 세트 747개는 보지만
    `dictionary_categories` 는 **0행**이라 큐레이션 라벨·이모지가 legacy 자유문구로 조용히 내려앉는다.
  · **판정 규칙**: 공개 표면이 읽는 표는 (a) anon 정책을 주거나 (b) 집계 `SECURITY DEFINER` RPC 로
    감싸거나 (c) **세션 유무로 "못 읽음" 을 확정**해 화면에 그렇게 말한다. 셋 중 하나를 반드시 고른다.
  · **확인법**(문서 말고 DB 에 묻는다):
    `SET LOCAL ROLE anon; SELECT count(*) FROM <표>;` — 0 이면 그 표를 읽는 공개 화면은 전부 후보다.
- ❌ **테스트에서 `.catch(() => {})`** — 캡처 하네스가 로그인 화면을 찍어 놓고 허브로 채점했다.
  판정 도구에서 조용한 실패는 회귀 실패보다 나쁘다
- ✅ 이미 잘 하고 있는 예: `TodayPrescription.unavailable` — 폴백값이 신규 학습자의 정상 상태와
  똑같아서 3주간 아무도 몰랐던 사고 뒤에 생긴 플래그. **이 패턴을 다른 곳에도 적용할 것**

### 선택지를 만들면 **길이 편향**을 반드시 잰다 (v06.344 — 첫 파일럿 64문항에서 실측)

정답을 정확히 쓰려다 길어지고 오답은 대충 짧아진다. 그러면 **지문을 안 읽고 가장 긴 것을
고르면 맞는다** — 문항이 아니라 길이 맞히기가 된다.

실측(생성형 문항 첫 파일럿, 정답이 최장인 비율 · 우연이면 20%):

| 유형 | 비율 |
|---|---|
| 요지(main_point) | **16/16 = 100%** (정답이 평균보다 19자 김) |
| 주제(topic) | 68.8% |
| 빈칸(blank) | 50% |
| 제목(title) | 37.5% |

- ❌ 지침으로만 막기 — 구조적 편향이라 "고르게 쓰세요" 로는 안 잡힌다
- ✅ **적재기가 두 겹으로 막는다**: 문항 단위(정답이 오답 평균의 1.25배 초과 → 그 문항 폐기) +
  배치 단위(정답이 최장인 비율 40% 초과 → **적재 자체를 거부**)
- ✅ 오답을 짧게 끝내지 않는다 — **정답만큼 구체적으로 쓰되 내용이 틀리게** 만드는 것이다.
  정답이 길어졌으면 정답을 줄이지 말고 오답을 채운다(정답을 뭉개면 답이 흐려진다)

**만든 것과 작동하는 것은 다르다** — 문항 수가 늘어도 길이로 풀리면 0개다.

### `.in()` 으로 여러 행을 물을 때 **`.limit()` 은 서버 상한을 못 넘는다** (v06.336 실측)

PostgREST 는 한 응답에 **1000행**까지만 준다. `.limit(20000)` 을 붙여도 넘지 못한다 —
실측: `Photosynthesis` 한 편의 어휘가 1,072행인데 받아온 것은 1,000행이었다.

**왜 위험한가** — 잘린 쪽이 오류를 내지 않는다. 어휘를 원글 5편씩 묶어 물었더니 배치가
1000행에서 잘려 **뒤쪽 원글이 "어휘 0" 으로 보였다.** 그 허수를 근거로 "어휘 없는 글 52편"
이라 판단하고 57편을 재분석했는데, 재분석이 밴드를 다시 계산해 **이미 완성한 교재 한 권의
구성이 흔들렸다.** 측정이 틀리면 고치는 일이 망가뜨리는 일이 된다.

- ❌ `.in('x', ids).limit(20000)` — 크게 잡으면 되겠지
- ❌ 배치 크기를 줄여서 회피 — 행이 많은 항목 하나만으로도 다시 잘린다
- ✅ 정렬을 고정하고 `range(from, from+999)` 로 **다 받을 때까지** 넘긴다
  (`scripts/textbook/volume-pool.mjs` 의 `fetchAllIn`)
- ✅ 존재 여부만 알면 될 때는 `select('*', { count: 'exact', head: true })` — 행을 안 옮긴다

### 같은 대상을 고르는 규칙을 **두 곳에 쓰지 말 것** (v06.336 — 교재 2문항 드리프트)

`render-volume.mjs`(조판)와 `explain-drain-export.mjs`(해설 몫 뽑기)가 각자 풀을 만들었다.
주석에는 "같은 조합 규칙을 쓴다" 고 적혀 있었지만 실제로는 셋이 달랐고(밴드 기준 · 어휘 맵 ·
`display_only`), 뽑은 몫 62건을 **전부 채웠는데도** 책은 78/80 으로 나왔다.

**작게 어긋나는 드리프트는 티가 안 난다** — 2/80 은 눈으로 보면 "거의 다 됐네" 다.
"같은 규칙을 쓴다" 는 주석은 규칙이 아니라 **희망**이다.

- ✅ 규칙을 모듈 하나로 뽑고 양쪽이 그것을 부른다
- ✅ 그 뒤 **아무도 자기 것을 다시 만들지 않는지** 회귀로 감시한다
  (`volume-drift.test.ts` — 원본 함수를 직접 호출하는 코드를 잡는다)

### 화면에 쓰기 전에 **그 컬럼을 누가 채우는지** 확인할 것 (v06.201 — Growth 실측 3건)

컬럼이 존재한다는 것은 값이 맞다는 뜻이 아니다. Growth 회고면은 세 곳에서 동시에 거짓을
인쇄하고 있었고, 셋 다 **화면은 멀쩡히 떴다**.

- ❌ **몇 달 동안 0인 지표를 히어로에** — `user_stats.known_word_count` 를 읽어 "0개" 를 띄웠다.
  갱신은 정상이었고(세션 flush 마다 `refresh_user_known_word_count` 호출) **0도 정직한 값**이었다 —
  정의가 `stability >= 21`(Anki mature)이라 신규~중급 학습자에게는 몇 달간 0이 나온다.
  계산이 틀린 게 아니라 **질문이 틀렸다**.
  → 화면의 주인공 수치는 "1일차 학습자에게 무엇이 보이나" 를 먼저 확인할 것.
  ⚠️ 이 항목을 처음 쓸 때 "호출하는 코드가 없다" 로 단정했는데 **틀렸다** — grep 은 했지만
  히트(`lib/srs/flush-actions.ts`)를 열어 보지 않고 "실행 경로 밖" 이라고 넘겼다.
  실제로는 Flashcard·PairFlip·SpellForge·StudyMode·Dictation 5개 세션이 다 타는 경로다.
  **grep 히트는 읽고 나서 판단할 것.**
- ❌ **반올림으로 소실되는 컬럼을 판정 기준에** — `daily_activity.total_minutes` 는
  `ROUND(duration_seconds/60.0)` 로 누적된다. **60초 미만 세션은 0분**이라 영원히 안 쌓인다.
  히트맵이 `minutes>0` 을 "학습한 날" 로 봐서, 8일 연속 학습 중인 계정을 "28일 중 1일" 로 그렸다.
  → 누적 컬럼은 **함수 정의를 읽고** 쓸 것. 기록되지 않는 값은 **화면에 없는 편이 정직하다**.
- ❌ **같은 값을 두 곳에서 계산** — 연속일이 한 화면에 세 종류로 떴다(띠 3 · 히어로 3 · 히트맵 0).
  진행도 두 종류였다(띠 `2/3` · 흐름 `0/5`). 학습자에게는 무엇을 믿을지 알 방법이 없다.
  → 수치의 정의는 **순수 함수 하나**가 소유하고 모든 표면이 그것을 부른다
  (`growth-math.computeStreak` · `today-blocks.blockProgress`).

### 활동 모듈 id 는 **DB enum 실측치**여야 한다 (v06.201)

`today-blocks` 가 듣기 완료를 `touchedToday.has('echomatch')` 로 판정했는데 enum 값은 `'echo'` 다
(`echomatch` 는 enum 에 아예 없다). 듣기 블록은 무엇을 해도 완료되지 않았고, **단위 테스트가
같은 오타를 그대로 써서 초록불**이었다.

- 매핑표를 늘릴 때는 `pg_enum` 을 다시 조회할 것 — 화면은 멀쩡히 뜨고 판정만 조용히 죽는다
- 오타를 오타로 검증하지 않도록, 테스트에 **enum 실측 집합과 대조하는 단언**을 둘 것
- 표를 두 곳에 두지 말 것 — `today-status.ts` 와 `today-blocks.ts` 가 각자 갖고 있던 동안
  한쪽은 `echo`, 다른 쪽은 `echomatch` 였다

### 도달할 수 없는 목표를 진행 분모에 넣지 말 것 (v06.201)

`오늘의 흐름 0/5` 의 5 중 하나(Syntax)는 `done: false` 하드코딩이라 5/5 가 구조적으로
도달 불가였다. 매일 도달 못 할 목표를 보여주는 것은 진행 표시가 아니라 압박이다(철학 ③).
→ 오늘 열리지 않은 것(`locked`)만 분모에서 뺀다. 열려 있는 항목은 **완료 신호를 찾아서 연결**한다.

### 문서를 근거로 "이 기능은 죽었다" 고 결론내지 말 것 (v06.201 — 같은 세션에서 실측)

위 항목을 처음 고칠 때 Syntax 를 `observable: false` 로 두고 분모에서 뺐다. 근거는
CLAUDE.md 의 "`csat_item_attempts` 미해결" 이었다. **그 표가 나흘 낡아 있었다** —
`20260812113000_restore_csat_item_attempts` 가 이미 복원해서 `grade_dcp_item` 은 정상이었고,
DCP 완료는 처음부터 관측 가능했다. 낡은 문서를 믿고 **멀쩡한 기능을 진행에서 지워 버릴 뻔**했다.

- 기능의 생사를 판정할 때는 `to_regclass('public.X')` · `pg_get_functiondef` 로 **DB 에 직접 묻는다**
- 문서의 "미해결/알려진 결함" 목록은 **근거가 아니라 단서**다. 확인 후 낡았으면 그 자리에서 고친다
- 저장 위치가 다른 신호를 매핑표에 가짜 키로 밀어넣지 말 것 — DCP 는 `daily_activity` 가 아니라
  `csat_item_attempts` 에 남으므로 별도 인자로 받는다(`BLOCK_MODULES` 는 enum 실측치만 담는 계약)

### vitest 를 깨뜨리는 것은 `server-only` 가 아니라 **`react.cache`** 다 (v06.203 실측)

같은 함정을 네 번 밟고 나서야 원인을 정확히 갈랐다. 컴포넌트·테스트가 서버 모듈을 import 할 때
스위트가 `cache is not a function` 으로 통째로 죽는데, **범인은 `cache()` 하나**다.

- `import 'server-only'` **만** 있는 모듈은 vitest(node 환경)에서 정상 import 된다
  (실측: `lib/learner/taste-word.ts` — `server-only` 만 쓰고 순수 함수 `pickIndex` 를 그대로 테스트).
- `react.cache` 로 감싼 export 가 하나라도 있으면 그 파일을 import 하는 **모든** 테스트가 죽는다.
- 그러므로 판단 기준은 이것이다:
  - **여러 곳이 같은 요청에서 부르는가** → `cache()` 를 쓰고, 순수부를 별도 파일로 분리한다
    (`growth-math` ↔ `growth-stats` · `gateway-state` ↔ `gateway`).
  - **호출부가 한 곳뿐인가** → `cache()` 를 쓰지 않는다. 이득이 없고 테스트만 잃는다
    (`lib/admin/retention.ts` · `lib/admin/dashboard-stats.ts` 가 그 예).
- 컴포넌트는 **언제나 순수 모듈에서 import** 한다. 타입 하나 때문에 조회 모듈을 당겨오면
  같은 사고가 재발한다.

### 빈 화면의 원인을 데이터로 단정하지 말 것

같은 세션에서 "빈 화면" 의 원인이 셋 다 달랐다 — 목업 폴백 · `lemma` 결손(252개 중 1개만 채워짐) ·
**CSS**(`flex items-end` 가 열을 콘텐츠 높이로 줄여 막대 `h-full` 이 0 붕괴). 데이터·조회·렌더 셋을
모두 의심할 것.

### Typography
- `Inter` · `Roboto` · `Arial` 사용
- 한글 텍스트에 영어 폰트 (Lora) 사용
- 영어 본문에 산세리프 (Plus Jakarta / DM Sans) 사용

### 색상
- `--color-primary` 등 v5 롱폼 변수 사용 (**v6 이후 `--p` 축약형만**)
- 보라색 그라디언트 배경 (PairFlip Editorial 팔레트 제외)
- Quizlet 로고·아이콘·브랜드색(#4255FF teal) 복사
- 색상만으로 정보 전달 (접근성 위반)

### 학습 UX
- 학습 중 화면 광고 배치
- 모달 오버레이로 학습 중단 ("3일 연속 학습이 끊겼어요!")
- 정답률 빨간 글씨 압박 ("정확도 67% 😢")
- 진행률 100% 도달 시 폭죽·트로피 — 차분한 "오늘 잘 마쳤어요" 선호

### 접근성
- 44px 미만 터치 타겟
- placeholder 만으로 레이블 대체
- 애니메이션 없는 상태 전환

### 가로 넘침 원인은 "잘리지 않는 요소" 중에서 찾는다 (v06.34 — `/library` 61px 실측)
넘침을 추적할 때 **뷰포트를 넘는 요소를 그냥 세면 틀린 곳을 고친다**. 조상 중 하나라도
`overflow-x` 가 `visible` 이 아니면 그 요소는 잘리고, **잘린 요소는 문서를 넓히지 못한다**.

- 실측: `/library` 는 3D 캐러셀 카드가 +372px 까지 뻗어 범인처럼 보였지만 무대에 이미
  `overflow-x-clip` 이 있었다. 진짜 원인은 **점 인디케이터 줄**(점 하나가 44px 히트영역이라
  권수만큼 자라 20권에서 512px) 이었고, 넘침 값(61px)과 앞뒤가 맞는 유일한 요소였다.
- 추적 규칙: ① 조상에 자르는 것이 없는 요소만 후보 ② 넘침 px 와 **크기가 맞는지** 대조.
- 개수만큼 자라는 UI(점·칩·탭)는 좁은 화면에서 `overflow-x-auto` 로 가둔다 — 개수를 숨기지
  않으면서 화면만 지킨다.

### grid/flex 자식은 `min-w-0` 이 기본값이 아니다 (v06.201 — `/dashboard` 20px 실측)
grid·flex 자식의 `min-width` 는 `auto` 라 **안쪽 콘텐츠의 최소 폭 아래로 줄지 않는다**.
카드 안의 긴 뜻풀이나 고정폭 트랙 하나가 칸을 밀어내고, 넘침은 **카드가 아니라 문서 바닥**에서
드러나 원인을 찾기 어렵다.

- 카드류를 grid 칸에 넣으면 루트에 **`min-w-0`** 을 붙인다(`truncate`·`overflow-hidden` 만으로는
  안 된다 — 그것들은 이미 좁혀진 뒤에 동작한다).
- 막대 그래프는 **자기 트랙 안에서만** 자라게 한다. 막대와 숫자를 같은 flex 줄에 두면
  100%짜리 막대가 숫자를 밖으로 밀어낸다.
- 추적은 `tests/e2e/91-hub-design-capture.spec.ts` 의 **`overflowCulprits`** 로 한다 —
  넘침 px 만 보고하던 동안 한 라운드를 엉뚱한 컴포넌트를 고치는 데 썼다.

### `sr-only` 는 가로 스크롤러 안에서 문서를 넓힌다 (v06.34 — `/plan` 126px 실측)
`sr-only` 는 `position:absolute` 다. **위치 기준 조상이 없으면 문서를 기준으로 잡는다** —
가로 스크롤 컨테이너(`overflow-x-auto` + `min-w-[820px]`) 안에 있으면 그 정적 위치(예: 515px)가
그대로 문서 폭이 되어, 모바일에서 **화면 전체가 옆으로 밀린다**. 스크롤러의 `overflow` 도,
부모의 `overflow-hidden` 도 이걸 못 막는다(기준이 바깥이라 클리핑 대상이 아니다).

- `sr-only` 를 품은 요소에 **`relative`** 를 준다(카드·행 등 가장 가까운 자리).
- 증상은 "왜인지 모르게 넘치는 126px" 로 나타난다 — 넘친 요소는 폭 1px 라 눈에 안 보인다.
  원인 추적은 **뷰포트 오른쪽을 넘는 요소 중 부모는 안 넘는 것**을 찾는 방식으로 한다.

### 하단 고정 UI (v06.34 — 하단 탭 도입에서 실측)
모바일 하단은 **하단 탭(`components/layout/MobileTabBar`)이 이미 쓰고 있는 자리**다.

- `fixed bottom-0` 을 새로 쓰지 않는다 → `bottom-[var(--tabbar-h)]`. 이 토큰이 md 이상에서 `0px` 이므로 데스크톱 모양은 그대로다.
- **z-index 로 "안 겹친다" 를 판정하지 않는다.** 스택 컨텍스트·transform 이 순서를 바꾼다. 판정은 `elementFromPoint(버튼 중심)` **히트 테스트**로 한다 — 보이는데 안 눌리는 것이 가장 나쁜 결함이다. 회귀 자산: `tests/e2e/20-mobile-shell.spec.ts`.
- 숨김 상태(`translate-y-full` 등)에는 `pointer-events-none` 을 함께 준다. `bottom` 이 0 이 아니게 되는 순간, 내려간 자리가 **탭 바 위**가 되어 없는 UI 가 탭 터치를 먹는다.
- 탭이 없는 화면(풀스크린 세션 · `lib/layout/full-screen-routes`)에는 `--tabbar-h` 를 쓰지 않는다 — 빈 자리만큼 떠 보인다.
- 탭 아래 여백은 **탭을 그리는 컴포넌트가 같이 낸다**. 레이아웃에 `pb-` 로 두면 탭이 없는 화면에도 남아 세션 화면이 뷰포트보다 길어진다.

### 데이터 모델
- `memory_state` 컬럼 DB 저장 (R(t) 동적 계산만)
- `mastery_progress` 컬럼 5단계 (learning_records 누적으로 계산)
- `last_days` / `next_days` 컬럼 (Date 차이로 derive)
- 암호화되지 않은 Claude API 키 / 사용자 비밀번호 (Supabase Vault 사용)
- `module_history` 를 정규화 (TEXT[] 그대로 유지)
- **`classified_by` 없이 `shared_dictionary` 에 행 INSERT** — CHECK 는 NULL 을 통과시키므로 INSERT 가 조용히 성공하지만, `resolve_dict_headword()` 가 L1~L5 전 경로에서 `classified_by IS NOT NULL` 을 요구해 **사전에는 있고 학습자에겐 없는 유령 행**이 된다 (v06.36 실측 — 기초어 11종이 등재되고도 해석 0건)

### 인증 (v06.140 — 실측 결함 12종에서 도출)

**절대 하지 않을 것**

- **권한·상태 컬럼을 `FOR ALL` RLS 하나로 덮기.** `USING (auth.uid() = user_id)` 는 컬럼을
  구분하지 못한다 → 사용자가 자기 `role` 을 `'admin'` 으로 바꾼다(실측 재현). 권한 컬럼은
  **컬럼 단위 `GRANT` + BEFORE UPDATE 트리거** 2겹으로 막는다.
- **SECURITY DEFINER RPC 가 이미 지키는 규칙을 RLS 정책으로 또 열어 주기.** `class_members` 는
  가입 RPC 가 invite_code 를 검증하고 role 을 고정하는데, 별도 INSERT 정책이 **검증 없는
  우회로**로 남아 있었다(실측). DEFINER 함수는 RLS 를 우회하므로 그 정책은 애초에 불필요했다.
- **`anon` 에게 `FOR ALL USING(true)` 부여.** anon key 는 브라우저 번들에 그대로 들어 있어
  "익명 허용" 이 아니라 **전 인터넷 공개**다. 실측으로 고아 테이블의 `pass_hash` 가 읽혔다.
- **쓰지 않는 테이블을 열어 둔 채 방치.** 참조 0건이어도 정책이 살아 있으면 표면은 그대로다.
  스키마를 정리할 때 **정책과 GRANT 도 같이** 걷어낸다.
- **권한 검사 트리거를 `SECURITY DEFINER` 로 선언.** `current_user` 가 소유자로 바뀌어 판정이
  항상 통과한다 — 방어가 조용히 사라진다. 반드시 INVOKER(기본).
- **복귀 파라미터 이름을 화면마다 정하기.** `?next=` / `?returnTo=` / `?redirect=` 가 공존하면
  읽는 쪽과 쓰는 쪽이 반드시 어긋난다. `lib/auth/redirect.ts` 단독 소유.
- **페이지마다 손으로 `getUser()`→`redirect()`.** 새 화면에서 반드시 빠진다
  (실측: `(main)` 48 중 32 라우트가 열려 있었다). 보호 목록은 선언 한 곳 + 미들웨어 강제.
- **경로 접두사에 끝 슬래시.** `'/api/'` 로 적고 `=== p || startsWith(p + '/')` 로 비교하면
  `/api/auth/callback` 이 어느 쪽에도 안 걸린다(실측 회귀).
- **로그인 실패에 "등록되지 않은 이메일" 노출.** 계정 열거(enumeration)에 쓰인다 —
  자격증명 계열은 전부 같은 문구로 수렴시킨다.
- **Supabase 원문 에러를 토스트로 그대로 흘리기.** 내부 구조 노출 + 비-한국어 UX.
  `lib/auth/errors.ts` 매핑을 통과시킨다.
- **인증 핸들러를 `try/finally` 로만 감싸기.** 네트워크 예외가 조용히 사라져 버튼이
  "아무 일도 안 하는" 상태가 된다. `catch` 로 사용자에게 사유를 준다.
- **가입 후 목적지를 고정.** `mailer_autoconfirm` 설정에 따라 `signUp` 이 세션을 주기도 한다 —
  `data.session` 유무로 분기하지 않으면 이미 로그인된 사용자를 "메일 확인" 화면에 가둔다.
  이미 가입된 이메일의 조용한 가짜 성공(`identities: []`)도 함께 본다.
- **동작하지 않는 컨트롤을 두기.** `onClick` 없는 버튼(로그아웃)·아무 데도 안 쓰이는
  체크박스("30일간 로그인 유지")는 결함이다. 배선하거나 지운다.
- **`useSearchParams` 를 Suspense 없이 쓰기.** 페이지 전체가 CSR 로 이탈한다(Next 14).
- **`user.id`·`email` 을 서버 콘솔에 상시 로깅.** PII 가 로그에 쌓인다.

**항상 지킬 것**

- 3층 가드(middleware · RSC · API)는 **같은 판정 함수**(`lib/auth/account.ts`)를 쓴다.
  한 층만 `role==='admin'` 으로 두면 그 층이 먼저 돌아 `curator` 를 전부 막는다(실측).
- 계정 상태(`status`)는 로그인 시점 **그리고** 매 요청(미들웨어) 검사한다. 한쪽만이면
  이미 로그인한 사용자를 정지시킬 수 없다.
- 인증 변경은 `tests/e2e/20-auth-flows.spec.ts` + `lib/auth/__tests__/` 에 회귀를 남긴다.
  admin 가드를 고쳤으면 `DEV_ADMIN_BYPASS=0` 으로 **한 번 더** 돌려 확인한다
  (플래그가 켜져 있으면 해당 테스트가 자동 skip 된다).
- 보안 결함을 하나 찾으면 **같은 계열을 전수로 훑는다**. 스윕 쿼리는
  [DB_SCHEMA.md](./DB_SCHEMA.md#클라이언트-쓰기-표면-스윕-20260815020000) 에 있다
  (`user_profiles` 한 건인 줄 알았던 것이 실제로는 3곳이었다).
- 차단 테스트에는 **"막지 말아야 할 것"** 단언을 반드시 같이 둔다. 과잉 차단은 조용히
  기능을 죽이므로, 정상 경로(본인 설정 저장 · 초대코드 가입 · 공개 카탈로그 열람)가
  살아 있는지까지 같은 파일에서 확인한다.

### 텍스트 토큰화 (v06.35 — 실측 누수 6종에서 도출)
학습자 입력 스크립트는 **아무 글이나 들어온다**. 아래는 모두 `lib/text-extract/tokenize.ts` 에서 실제로 발생했던 결함이다.

- **정렬 후 절단** — `sort().slice(0, N)` 은 알파벳 뒷글자를 통째로 지운다. 상한을 둘 거면 **등장 순서**로 자르고, 잘린 수를 반드시 반환값에 노출 (조용한 절단 금지)
- **아포스트로피를 문자 클래스로 처리** — `split("'")[0]` 류는 `didn't`→`didn`, `won't`→`won` 을 만든다. **`won`·`don` 은 사전에 실재하므로 하류 필터를 전부 통과해 원문에 없던 단어를 학습자에게 가르친다.** 축약은 불규칙 맵 + `n't`/clitic 규칙으로 어간 복원
- **숫자 결합 토큰의 알파벳 앞부분만 남기기** — `CO2`→`co` 는 없는 단어를 짓는 것. 숫자가 섞이면 **통째로 제외**
- **유니코드 정규화 생략** — U+0027 vs U+2019, soft hyphen, `ø`/`é` 를 정규화하지 않으면 붙여넣기 출처에 따라 결과가 달라진다 (재현성 없음 = 회귀 측정 불가)
- **하이픈과 대시를 같이 취급** — 하이픈은 복합어를 잇고(`self-taught`), em/en dash 는 구두점으로 끊는다
- **관습 제거 정규식을 느슨하게** — 화자 라벨 스트립이 `"There is one lesson here: "` 를 통째로 삼켰다. **덜 지우는 쪽이 안전하다** (남은 인명은 서버 `word_register='proper_noun'` 이 거른다). 과삭제는 누수, 과소삭제는 무해

원칙: 표제어 해석은 서버 `resolve_dict_headword`(4계층) 담당. 클라이언트 토크나이저는 **"있던 것을 있는 그대로, 빠짐없이. 없던 것은 만들지 않기"** 만 책임진다.

### 형태 규칙(en_inflection_bases / en_derivational_bases) 수정 (v06.36 — 실측에서 도출)

- **규칙을 넓히기 전에 오탐부터 센다** — `-ves → -f/-fe` 는 옳은 규칙 같지만 동사 3인칭과 충돌해
  `saves→safe` · `caves→cafe` · `serves→serf` 를 만든다. 게다가 `trg_lbv_fill_lemma` 는
  `ORDER BY id.word`(알파벳)라 **`safe` 가 `save` 를 이긴다**. 회수 건수만 세고 넣으면 조용히 오염된다
- **가드는 사전 실재로 건다** — "`-ve` base 가 사전에 있으면 `-f`/`-fe` 후보를 내지 않는다" 처럼
  코퍼스가 판정하게 한다. 예외 목록을 손으로 유지하지 말 것 (실측: 위험군 182 차단 / 정상 28 통과)
- **`en_derivational_bases` 를 `lookup_word_meaning` 에 연결하지 말 것** — 두 규칙 집합이 갈라져
  있는 것은 결함이 아니라 **의도된 분리**다. 전자는 재현율(seed 후보 · 뒤에서 검수), 후자는
  정밀도(학습자 즉시 노출). 통합하면 `ation→at` · `barant→bar` · `bative→bat` 가 그대로 노출된다
  (ADR 0004 D4: 틀린 뜻은 뜻이 없는 것보다 나쁘다)
- **형제 규칙과의 비대칭을 의심하라** — `-ly`·`-er`·`-ion`·`-able` 등은 전부 `strip`/`strip+e`
  두 벌인데 `-ish` 만 한 벌이어서 `epicurish→epicur` 로 실패했다. 한 벌만 있는 규칙은 대개 버그다
- **고친 뒤에는 `backfill_book_lemmas` → 발행 도서 I10 확인**까지가 한 세트다. 바인딩이 바뀌면
  `select_book_chapter_vocab` 출력이 바뀌어 발행 세트가 드리프트할 수 있다

### 사용자 입력 (v06.35 — 런타임 e2e 로만 드러난 결함)
- **`<textarea maxLength>` 로 학습자 글을 하드 절단** — 브라우저가 말없이 잘라내고 나머지를 버린다.
  실측: 20,818자 붙여넣기 → 5,100자만 남고 본문 783어만 인식. 경고 없음 · 저장 성공.
  넘치면 **입력은 보존한 채 알리고**, 저장 조건에서 막는다
- **저장 조건에 상한 검사 누락** — 입력 UI 만 제한하면 절단본이 "성공적으로" 저장된다.
  입력 제한과 저장 조건은 반드시 한 쌍으로 간다
- 정적 분석으로 4회차를 돌아도 이 결함은 안 보였다. **실제로 붙여넣어 보는 e2e 가 유일한 발견 경로**였다

### Cross-platform
- 웹 전용 또는 앱 전용 단방향 설계
- Parts Kit v01~v05 기준 코드

---

## 항상 지킬 것

### 컴포넌트
- 모든 인터랙티브 요소에 hover + active + focus + disabled 4상태
- 모든 카드·버튼에 transition (`--dur-normal`, `--ease`)
- 정답/오답 피드백: 색상 + 아이콘 + 애니메이션 3중
- 모바일 퍼스트 → 데스크톱 확장 (390 → 768 → 1280)
- 공통 컴포넌트 `components/ui/` 재사용 우선

### 스타일
- CSS Variables (`--p`, `--bg`, `--t1`) 로 테마 제어 — 하드코딩 금지 (게임 전용 예외 제외)
- `data-theme="dark"` 모든 컴포넌트 대응 필수
- 이미지 대신 Lucide 아이콘 우선

### React Native
- `minHeight: 44, minWidth: 44` 터치 타겟
- `accessibilityLabel` 모든 버튼

### 코드 작성
- 파일 첫 줄에 경로 주석 (`// apps/web/src/components/ui/Button.tsx`)
- 완성형만 — TODO·생략·placeholder 절대 금지

---

## 파일 경로 주석 규칙

```typescript
// 웹 (Next.js)
// apps/web/src/components/ui/Button.tsx              ← 공통 UI
// apps/web/src/components/game/spellforge/...        ← 게임
// apps/web/src/components/wordvault/WordList.tsx     ← 단어장
// apps/web/src/app/(main)/hub/page.tsx               ← 페이지
// apps/web/src/lib/supabase/client.ts                ← Supabase

// 앱 (Expo)
// apps/mobile/src/components/ui/Button.tsx           ← RN 버전

// 공유 패키지
// packages/design-tokens/src/colors.ts
// packages/types/src/database.ts
```

---

## 폴더 분리 원칙 (Single Responsibility)

| 폴더 | 책임 | 들어가는 것 / 들어가면 안 되는 것 |
|---|---|---|
| `components/ui` | 디자인 시스템 원자 | Parts Kit 컴포넌트만. 비즈니스 로직 금지 |
| `components/{도메인}` | 도메인별 합성 | API 호출 OK. 다른 도메인 import 금지 |
| `components/admin` | 관리자 콘솔 전용 | AdminSidebar 등. 사용자 앱과 격리 (보라 액센트) |
| `components/dev` | 개발 도구 | StubPage 등 placeholder. 프로덕션 의미 부여 금지 |
| `hooks` | UI ↔ 데이터 연결 | React 훅만. 순수 함수는 `lib/utils` |
| `stores` | 전역 클라이언트 상태 | Zustand 스토어 |
| `lib` | 외부 통합 + 유틸 | API SDK 래핑·파서·계산. React 훅 금지 |
| `types` | TS 타입 | 인터페이스·타입·enum. 실행 코드 금지 |

---

## Supabase 클라이언트 패턴

### Server Component / Route Handler
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('texts').select('*')
}
```

### Client Component
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

function Component() {
  const supabase = createClient()  // 동기 (싱글톤)
}
```

### Service Role (절대 클라이언트 노출 금지)
```typescript
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

## Admin API 인증 패턴

```typescript
import { requireAdminApi } from '@/lib/auth/require-admin-api'  // ✅ API route
import { requireAdmin } from '@/lib/auth/require-admin'         // ✅ RSC / Server Action

// API route — NextResponse 반환
const adminOrError = await requireAdminApi()
if (adminOrError instanceof NextResponse) return adminOrError

// RSC / Server Action — redirect()
await requireAdmin('/admin/curation')
```

---

## 풀스크린 라우트 정책

`lib/layout/full-screen-routes.ts` `isFullScreenRoute(pathname)` — Sidebar 와 FlowNav 가 공유:

```typescript
const FULL_SCREEN_ROUTES = [
  '/flashcard/play', '/spellforge/play', '/scriptquiz/play',
  '/pairflip/play', '/dictate/session',
  '/wordvault/browse',
  '/play/wordblitz', '/play/pirate-quest',
]
```

세션 셸 `components/layout/SessionFrame.tsx` 자동 주입.

### 세션 "제자리 복귀" (?from / backHref) — 항상 지킬 것

풀스크린 세션은 진입 출처로 닫혀야 한다("진입→닫기→제자리"). 두 축을 반드시 지킨다:

1. **진입 링크**: 풀스크린 play 라우트로 보내는 링크는 **`?from=<현재경로>`** 를 부착한다.
   SessionFrame(X·Esc)이 이를 읽어 복귀 — 미부착 시 모듈 hub로 튕긴다.
   - 워크스페이스: `ModePills.withReturn()` · 계획/홈: `activityLaunchHref(m, activity, origin)` (풀스크린 라우트에만 자동 부착).
   - 해시(`#set-…`)·비세션(`/dictate/setup`·echo·hub)엔 붙이지 않는다.
2. **세션 내부 닫기/완료 버튼**: `/text/${id}` 를 직접 하드코딩하지 말 것. 반드시 서버/클라이언트
   페이지가 계산한 **`backHref`** 를 prop 으로 받아 쓴다 — [`resolveSessionReturnHref(from, text, hubHref)`](../apps/web/src/lib/layout/session-return.ts)
   (`?from` → 스코프 텍스트 → hub). 스코프 진입 시 `textId` 는 단어 id 라 링크로 쓰면 404.
3. **`router.back()` 금지 조건**: 직접 진입(북마크/새로고침) 가능한 비세션 화면(`/dictate/setup` 등)에서
   무가드 `router.back()` 은 앱 이탈 → `window.history.length > 1` 가드 후 hub `push` fallback.

---

## 폼 검증

- `min` 50자 (`CONTENT_MIN`)
- `max` 100,000자 (`CONTENT_MAX`)
- title `max` 200자 (`TITLE_MAX`)
- 책 챕터 `max` 50개 (`MAX_CHAPTERS`)

---

## Server Action 결과 타입

```typescript
export type DeleteResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'unauthenticated' | 'not_found' | 'error'; message?: string }
```

---

## 에러 처리

### 클라이언트
- `window.alert` — 사용자 액션 결과
- `console.error` — DevTools 진단용
- Toast (`components/ui/Toast.tsx`) — 격려·정보

### 서버
- `try/catch` + `console.error` + `NextResponse.json({ error })`
- `revalidatePath('/text')` 등 — 변경 후 cache 무효화

---

## 마이그레이션 작명 규칙

```
YYYYMMDDHHMMSS_descriptive_name_in_snake_case.sql

예:
20260608120000_texts_user_book_group_id.sql
20260607170000_admin_bulk_return_to_source.sql
```

내용 첫 줄: `-- {filename}` 주석.
두 번째 블록: 의도 설명 (Korean OK).

### 적용 전 검토

**[memory: 사용자 SOP]** 마이그레이션 자동 적용 금지. SQL 보여주고 승인 받은 뒤 `apply_migration` 실행.

적용 **전에** 읽기 쿼리로 확인할 것:
- **영향 행 수가 주석의 수치와 맞는가** — 어긋나면 측정 이후 데이터가 움직인 것이다. 실제 값으로 주석을 고치고 적용한다 (v06.36 — 발행 세트 2,861 로 적혔으나 실제 2,951)
- **표제어·사용자 입력을 정규식에 문자열 연결하는가** — 반드시 `regexp_quote(text)` 를 경유한다. 안 하면 괄호를 가진 표제어(`a breath of (fresh) air` 등 216종)에서 괄호가 **그룹으로 해석돼 조용히 매칭을 벗어난다**
  - ⚠️ **컴파일 검사로는 못 잡는다.** v06.36 에서 "패턴이 컴파일되는가" 를 216종 전부 확인하고 통과시켰지만, 그 중 39행이 매칭에서 빠져 그대로 학습자에게 남았다. 에러가 나는 경우(짝 안 맞는 괄호)와 **조용히 다른 것을 맞추는 경우**는 다른 문제다
  - 검증은 이스케이프 유무로 **결과 행 수를 비교**해서 한다 — 같아야 정상, 다르면 이스케이프 누락분이 그 차이다
- **되돌릴 수 없는 대량 DML 인가** — `backup` 스키마에 원본을 먼저 캡처한다. 주석에 "백업에서 복원" 이라고 적는 것은 백업이 아니다

### 같은 것을 판정하는 함수가 둘이면 **단계 순서까지** 같아야 한다 (v06.36 — 발행 세트 210행 실측)

`resolve_dict_headword`(해석기)와 `lookup_word_meaning`(발행 경로)은 둘 다 표면형 → 표제어를 푼다.
조건은 거의 같은데 **단계 순서가 반대**였다 — 해석기는 사전 등재 굴절형을 먼저 보고,
발행 경로는 규칙 생성 후보를 먼저 봤다. 그 결과 `dying` 이 학습자에게 "염색하다"(dye)로 나갔다.

- **명시된 데이터가 생성된 추측을 이긴다.** 사람이 `ripe.inflected_forms = {riper, ripest}` 라고
  적어 뒀으면 규칙이 만든 `rip` 보다 우선한다. 순서가 곧 정책이다
- 빈도 순위 같은 **휴리스틱 타이브레이크는 최후단**에 둔다 — `riper` 가 `rip`(3906)에 진 이유가
  "`ripe`(6697)보다 흔해서" 였다. 근거 있는 데이터가 있는데 통계로 결정하면 안 된다
- 같은 판정을 두 함수가 하고 있다면 **둘의 출력을 전수 대조하는 쿼리를 먼저 쓴다** —
  `lemma` 와 `resolve_dict_headword(word)` 를 맞춰 보는 한 줄이 210행을 드러냈다

### 데이터 결함은 자동 탐지 규칙을 믿지 말고 **바뀌는 것만 전수 확인**한다 (v06.36)

위 순서를 고칠 때 "어떤 데이터가 잘못됐나" 를 규칙으로 찾으려다 **두 번 다 실패**했다.
"명사인데 -ed/-ing 굴절형 보유"(19건)도, "묵음 e 하나로 갈리는 명사/동사 쌍"(44건)도
대부분 오탐이었다 — `caned`←cane · `sited`←site · `wines`←wine 은 명사 쪽 등재가 맞다.

- 순서는 **① 변경을 시뮬레이션해 "결과가 달라지는 것" 을 뽑고 ② 그것만 전수 확인**한다.
  24,273 표면 중 바뀌는 것은 20개였고, 20개를 눈으로 보니 진짜 데이터 오류는 2 표제어뿐이었다
- 규칙으로 뽑은 후보를 그대로 일괄 적용했으면 멀쩡한 데이터 17~42건을 망쳤다
- 전수 확인이 불가능한 규모면 **그 변경은 아직 범위가 잘못 잡힌 것**이다. 범위를 좁힌다

### 백필 대상은 **출처의 신뢰도**로 자른다 (v06.36)

재해석 결과로 발행분을 덮을 때 `match_via`(어느 단계가 답했나)로 선을 그었다.
큐레이션 사전 기반(`direct`·`cluster`·`inflection`)만 반영하고, `lexicon_clean` 기계번역 덤프
기반(`coverage-clean`)은 제외했다 — 덮었으면 `blowzy` 가 "얼굴이 불그레하고 투박한" 에서
"창녀나 걸레의 특징이거나 어울리는 것" 으로 **퇴행**했다.

- 폴백 출처는 "없는 것보다 낫다" 일 뿐, **이미 있는 큐레이션 값을 이기지 못한다**
- 자동 갱신 파이프라인은 값만 보지 말고 **그 값이 어느 단계에서 왔는지**를 함께 저장·판정할 것

### 적용 후 검증 (v06.36 — 실측에서 도출)

**`apply_migration` 의 성공은 목적 달성이 아니다.** DDL/DML 이 문법적으로 실행됐다는 뜻일 뿐이다.

- 마이그레이션 파일 끝의 "적용 후 확인" 주석은 **주석으로 두지 말고 실제로 돌린다**. 기초어 11종 등재는 성공으로 끝났지만 자체 점검 쿼리를 돌리자 12행 중 11행이 `null` 이었다 — `classified_by` 미기입으로 해석기에 안 보이는 행이었다
- 확인 쿼리는 **행이 들어갔는지**가 아니라 **그 행을 실제로 읽는 경로가 보는지**를 물어야 한다 (`SELECT count(*) FROM shared_dictionary` 아님 · `SELECT resolve_dict_headword(...)` 맞음)
- JSON 컬럼에 같은 값의 사본이 있는지 본다. `example_en` 만 비우고 `senses[0].examples` 를 두면 화면 경로에 따라 지운 값이 계속 나간다

---

## 안전 가드 패턴

### Bulk RPC

```sql
CREATE OR REPLACE FUNCTION admin_bulk_X(p_book_ids uuid[])
RETURNS TABLE(...)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  -- 자격 row 만 처리, 자격 외는 silently skip
  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids) AND status = ANY(v_eligible)
  LOOP
    -- 안전 가드 1: published 단어장 존재
    -- 안전 가드 2: 사용자 텍스트 참조
    -- 실제 작업
  END LOOP;

  RETURN NEXT;
END $function$;
```

---

## 컴포넌트 props 인터페이스 규칙

```typescript
interface FooProps {
  /** 한 줄 설명 */
  required: string
  /** 선택 — null 일 때 폴백 동작 명시 */
  optional?: string | null
  /** 이벤트 — on{Action} */
  onAction?: () => void
  /** disabled flag */
  pending?: boolean
}
```

- 모든 prop JSDoc 1줄 (의도 + 선택 여부)
- callback prefix `on{Action}`
- `loading` 보다 `pending` 선호 (useTransition 정합)

---

## 한글 vs 영어 표기

| 항목 | 표기 |
|---|---|
| 모듈 이름 (UI) | "플래시카드", "단어장", "스크립트" |
| 모듈 이름 (코드) | Flashcard, WordVault, TextViewer |
| 학습 카피 | 한글 (사용자 친화) |
| 코드 주석 | 한글 OK (디자인 의도 명확화) |
| 변수명 | 영어 camelCase |
| 함수명 | 영어 camelCase (`saveText`, `aggregateBookChapters`) |
| 파일명 | kebab-case (`save-text.ts`, `book-chapter-input.tsx`) |
| 컴포넌트명 | PascalCase (`TextCard.tsx`, `BookChapterInput.tsx`) |

---

## 가독성 명명 규칙

### TypeScript
```typescript
// ✅ 명확한 의도
const isLibraryBookCard = !!text.bookId
const isUserBookCard = !isLibraryBookCard && !!text.userBookGroupId
const chapterN = text.chapterCount ?? 0

// ❌ 모호
const ok = !!text.bookId
const n = text.chapterCount ?? 0
```

### DB
- 테이블: 복수형 (`texts`, `vocabularies`, `library_books`)
- 컬럼: snake_case
- FK: `{table}_{column}_fkey`
- 인덱스: `idx_{table}_{cols}` (또는 `{table}_{col}_key` for unique)
- RPC: `{verb}_{noun}` (`admin_bulk_requeue_books`)

---

## PR 자가 점검 체크리스트

머지 전:
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여?
- [ ] Calm UI 위반 없는가? (색·소리·애니메이션 과잉)
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 실패가 비난적이지 않은가? ("다시 만나봐요" / "곧 익숙해질 거예요")
- [ ] 진행을 환경으로 보여주는가? (숫자만이 아닌 색·아이콘·여백)
- [ ] 맥락을 보존하는가? (단어/표현은 스크립트이나 예문과 결합)
- [ ] DB direct query · 라우트 grep 으로 검증 가능한가?
- [ ] 파일 첫 줄 경로 주석 있는가?
- [ ] 모든 인터랙티브 hover/active/focus/disabled 4상태?
- [ ] data-theme="dark" 정합?
- [ ] WCAG AA 대비 + 44px 터치 타겟?
- [ ] 색상 + 형태 + 텍스트 3중 표현 (색맹 대응)?

---

## 골든셋 스냅샷 규약 (v06.118 · 파이프라인 품질평가 Q1)

파이프라인 순수 함수(`computeLexicalNoise` · `segmentBook`/`normalizeBook` · `alignChaptersBy*` · `judgeIPlusOne`)는
골든셋 fixture 기반 스냅샷 테스트가 CI(`turbo run test`)에서 회귀를 감시한다.

- fixture: `packages/library-pipeline/test/fixtures/` (책·글 raw + meta.json) · `apps/web/src/test/fixtures/librivox/` (정합 리스트)
- **라이선스-안전만** (PD / CC BY / CC BY-SA + attribution). CC BY-ND(The Conversation)는 fixture 저장 금지.
- **스냅샷 diff = 차단 아님, 리뷰 필수 신호.** 의도적 파이프라인 개선 시: ① diff 검토 ② 스냅샷 갱신을 별도 커밋으로 분리 ③ CHANGELOG 에 "골든셋 스냅샷 갱신 — 사유" 1줄.
- fixture 는 분기당 1건 교체 (화석화 방지).
- RPC 통합 스냅샷(`extraction-rpc.integration.test.ts`)은 env-skip — CI 에서 skip 이 정상, 로컬/수동 실행 전용.

---

## 변경 이력 기록

각 PR 머지 후 [CHANGELOG.md](./CHANGELOG.md) "Unreleased" 또는 새 버전 섹션에 추가:
- 신규 라우트 / API
- 신규 컴포넌트
- 마이그레이션 (요약 — 정확한 SQL 은 git log)
- 모듈 시맨틱 변경
- 안티패턴 추가

3개 버전 (v06.32~34) 만 보존 — 이전은 git 이력 참조.

---

## 자동 .md 갱신 매트릭스 (사용자 standing authorization · 2026-06-08)

**[CLAUDE.md "자동화 정책" 섹션 참조]**. 코드 변경 발생 시 같은 turn 에 해당 .md 도 함께 갱신 (사용자 요청 없어도):

| 트리거 | 갱신 대상 |
|---|---|
| 마이그레이션 적용 | [DB_SCHEMA.md](./DB_SCHEMA.md) + [CHANGELOG.md](./CHANGELOG.md) |
| 새 RPC / view / trigger | [DB_SCHEMA.md](./DB_SCHEMA.md) |
| 새 라우트 | [ROUTES.md](./ROUTES.md) |
| 새 컴포넌트 (도메인 신설) | [MODULES.md](./MODULES.md) |
| 학습 모듈 / 인지 계층 변경 | [LEARNING_MODEL.md](./LEARNING_MODEL.md) + [MODULES.md](./MODULES.md) |
| 디자인 토큰 / 컴포넌트 패턴 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Admin 라우트 / 일괄 액션 | [ADMIN_CONSOLE.md](./ADMIN_CONSOLE.md) |
| 큐레이션 RPC / 파이프라인 | [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) |
| 코딩 패턴 / 안티패턴 추가 | 본 파일 ([CONVENTIONS.md](./CONVENTIONS.md)) |
| 패키지 추가/버전 변경 | [STACK.md](./STACK.md) |
| 위 모든 변경 (요약) | [CHANGELOG.md](./CHANGELOG.md) Unreleased |

### 갱신 원칙
- 정확도 100% — DB direct query / grep 으로 검증 가능한 사실만
- 같은 turn 안에 코드와 .md 함께 변경 (drift 차단)
- 별도 사용자 알림 없이 자동 — 작업 결과 요약에만 "+ 관련 doc 갱신" 한 줄

### Git 자동 commit / push (요약)

논리적 milestone 또는 파일 ≥5 변경 시 자동 commit + push (작업 브랜치만, main 직접 push 금지).
Conventional commits 스타일 + `Co-Authored-By` 첨부. 안전 안티패턴 (`.env`/secret/빌드 실패/DROP TABLE/30+ 파일) 시 사용자 확인.

상세: CLAUDE.md "🤖 자동화 정책".
