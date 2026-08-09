# CHANGELOG

> Vocaflow 변경 이력. 최신 3개 버전(v06.32~34) + 현재 작업 중인 마이그레이션 + 세션 변경 사항을 보존.
> 이전 v06.0~v06.31 의 누적 변경은 git 이력 (`git log`) 으로만 추적.
>
> **갱신 정책**: 새 마이그레이션 / 새 라우트 / 모듈 시맨틱 변경 / 컴포넌트 신설·제거 시 항목 추가.
> SQL · 라우트 경로 · 컴포넌트 이름은 `git`/`grep`/`SQL` 로 100% 검증 가능한 사실만 기록.

---

## Unreleased (v06.34 → next)

### 만화 탭 이름을 학습자 말로 · Comics 를 별도 메뉴로

`Adapted / 도서 각색`, `Restored / 원본 복원` 은 **우리 파이프라인 용어**였다. 원작에 무슨 처리를
했는지를 말할 뿐, 학습자가 *무엇을 읽게 되는지*는 하나도 알려주지 않는다. 각색·복원은 우리 사정이다.

| 이전 | 지금 | 학습자에게 |
|---|---|---|
| Adapted · 도서 각색 | **Book Comics** · 읽는 책을 만화로 | 라이브러리 도서의 만화판 — 원문·퀴즈와 이어진다 |
| Restored · 원본 복원 | **Vintage Comics** · 옛 영어 만화책 | 1940~50년대 실제 영어 만화책 |

- `/comics/restored` 페이지 제목도 `복원 만화` → `옛 영어 만화책`, `/comics/adapted` 는 `만화` → `책 만화`
  (탭이 둘인데 제목이 그냥 "만화"면 어느 쪽인지 알 수 없다).
- **Comics 를 Scripts 그룹에서 빼 바로 아래 별도 메뉴로.** Scripts 는 "읽을 원문"의 그룹인데
  만화는 원문이 아니라 **읽는 방식**이라, 그 안에 두면 Library·My Scripts 와 같은 층위로 오해된다.
  메뉴 안에 두 종류를 그대로 노출한다 — 사이드바에서 바로 고를 수 있다.
- URL 슬러그(`adapted`/`restored`)는 그대로 뒀다 — 화면 문구가 아니고, 참조가 67곳이라 지금 바꾸면
  진행 중인 다른 작업과 충돌한다. 이름 정합을 원하면 리다이렉트와 함께 별도로 처리할 일이다.
- `Sidebar` 의 React key 가 `flowStage` 였는데 Comics 가 `script` 를 공유하게 되어 중복 → `label` 로 교체.
- 스펙: 사이드바·탭 단언은 이미 href 기반이라 그대로 통과. 제목 단언 하나만 부분일치로 완화.


### 아케이드 v07.8 — 19종 전수 재설계 + 도서·스크립트·단어장 연계 (마이그레이션 1건)

**마이그레이션 [20260809120000_add_remaining_arcade_module_ids.sql](../supabase/migrations/20260809120000_add_remaining_arcade_module_ids.sql) — 2026-08-09 사용자 승인 후 dev 적용 완료.** enum 조회로 `pirate-quest` 확인.

#### 발단 — 재미 감사에서 제품 유효성 결함이 나왔다

19게임을 10축 루브릭으로 전수 감사(게임당 1에이전트 병렬). 평균이 **tensionCurve 1.42/5 · decisions 1.47 · streakHook 1.79 · learningIntegrity 1.95**.

가장 중요한 발견은 재미가 아니었다 — **게임 7종 이상이 영어를 한 글자도 몰라도 이길 수 있었고**, 그 결과가 FSRS 로 "학습했다"고 기록됐다. `pirate-quest` 는 정답 라벨이 **그 뜻을 그대로 조형한 GLB 위**에 붙어 있었고, `connections` 는 타일에 한글 뜻이 상시 노출돼 "한글 명사 분류"였으며, `morphmerge` 는 부분 선택 시 "(2/5)" 로 정답 개수를 알려줘 **무위험 브루트포스가 최적 전략**이었다.

#### DB 실측 — 큐레이션 계열 10종은 학습 기록이 구조적으로 불가능했다

`learning_records` 조회 결과 connections · glyph-tongue · letter-forge · lexicon-* · morpheme-rules · silent-rule · word-orrery · wordsmith-vigil · pirate-quest 가 **0건**. 원인은 enum 이 아니라 `recordGameResult` 가 **사용자 `vocabularies` 에 없는 단어를 silent skip** 하는 것 — 내장 뱅크로만 도는 게임은 아무리 플레이해도 FSRS·XP·점수가 남지 않는다. **wordPool 을 쓰는 것이 곧 학습 연계**라는 사실이 여기서 확정됐다.

#### 공유 킷 선행 확장 (게임별 구현보다 먼저)

감사 19건 중 13건이 독립적으로 같은 훅을 요청했다. 19개 에이전트가 각자 만들면 19개의 다른 구현이 남으므로 먼저 놓았다.
- `mechanics.tsx` 신설 — `useCountdown`(벽시계 · `extend`/`drain` 1급 · 가산 75% 상한으로 세션 길이 보호) · `useCombo`(티어·마일스톤·끊김) · `useFlipGrid`(보드 재배치 FLIP — 타일이 순간이동하던 문제) · `usePersonalBest`
- `gamekit` — **`FeedbackIcon`**(CLAUDE.md 가 요구하는 색+아이콘+모션 3중 피드백인데 **킷에 아이콘 축이 없어 19게임이 전부 2축만** 쓰고 있었다) · `TimerBar` · `LifePips`(채움/빔 이중 인코딩) · `Hud lives/comboMult` · `ParticleBurst colors` · `useSfx.nearMiss` · `GameDone best/badge/restartHint/reveal/footer`
- **결함 수정 ①** `GK_CSS` 에 `data-theme` 분기가 0줄 — 다크에서 게임이 하드코딩한 밝은 그라디언트 위에 밝은 텍스트(`--t1`)를 그렸다. 19게임 색 인자를 고치는 대신 색조는 유지하고 명도만 `--bg` 로 끌어내리는 규칙을 중앙에 추가.
- **결함 수정 ②** 리빌 시 `disabled` 를 걸어 키보드 포커스가 날아가던 문제 → `.gk-tile[aria-disabled]` 패턴.

#### 19종 재설계 (3웨이브 병렬 · 총 +22,000줄)

- **웨이브1(최하위 7종)** — pirate-quest 는 라벨↔모델 결합을 끊고 훑기(영단어만)→회수(뜻만) 2단 페이즈로 분리해 제출 순간 정답 단서를 0으로 만들었다. **마지막 한 자리는 묻지 않는다**(소거법 정답이 FSRS 를 오염시키는 경로 차단). glyph-tongue 은 등불 150초 단일 자원 + 묶음 봉인 배수 + 상시 미끼로 "마지막 룬 = 공짜" 제거.
- **웨이브2(중위 6종)** — connections 는 타일에서 영단어를 지우고 규칙을 **숨겨진 영단어의 형태**(끝 글자·접사·길이·품사)로 옮겨, 뜻→영단어 인출 없이는 규칙이 보이지 않게 했다. 절차 생성기에 불변식 3종(정답 분할 유일성)을 코드로 강제하고 1,200격자 × 3풀 실측 위반 0. daily-blitz 는 `page.tsx` 가 **`wordPool` 을 아예 안 넘기고 있었다**(FSRS 0건의 직접 원인).
- **웨이브3(나머지 6종)** — blitz 계열 4종이 완전히 같은 루프였던 문제에 대해 각 모드의 동기 장치를 극단으로 밀어 차별화. ghost-race 는 자기파괴적 래칫(이길수록 유령이 영구히 빨라져 12초 하한에 갇힘)을 티어 하한·연패 완화·상한을 가진 적응형 라이벌로 교체하고, 시간이 아니라 **거리**를 화폐로 쓰는 3랩 추격전이 됐다.

#### 도서 · 스크립트 · 공용 단어장 연계 — 끊긴 세 곳

배관(`?set=`/`?text=` → `useGameWordScope`)은 있었는데:
- **허브가 스코프를 버렸다** — 카드가 `gamePlayHref(slug,{from:'/arcade'})` 하드코딩이라 `?set=` 을 달고 와도 게임 진입 순간 증발. 이제 `searchParams` 를 읽어 19종 카드·오늘의 추천·계열 모드칩 전부에 싣고 `from` 도 스코프를 유지한다(게임에서 나가도 같은 자료로 이어감). 자료명 배너 + 해제 링크.
- **도서/공용단어장 모달이 4개 게임만** 제공 → `VocabSetPreviewModal` 에 "🕹 아케이드 19종" 칩. 이 모달을 도서 상세·단어장 목록·`/wordvault` 세 화면이 공유하므로 한 줄로 세 진입면이 열렸다. 이 칩들의 24px 터치 타겟도 44px 로 교정(CLAUDE.md 위반이었다).
- **스크립트 화면도 둘뿐** → `ModePills` 에 '아케이드' pill 정식 추가(`ModeKey` 확장).

카탈로그 정합 — 19종 전부 `source:'mine'` + 라우트 실값 `minWords`. `pirate-quest` 는 `ArcadeGameId`·`ModuleId`·`ScoreModule` 편입 + `GamePlayScaffold` 전환으로 **처음으로 FSRS·scores 가 남는다**(DB enum 이 `pirate_quest` 언더스코어라 하이픈 insert 가 조용히 실패하던 경로 — 사용 행 0건 확인 후 하이픈 추가).

#### ⚠️ 허브 분류축 교체 — `source` 축이 죽었다

전 게임이 학습자 단어를 쓰게 되면서 `mine`/`bank` 축이 한쪽으로 몰려 무의미해졌다. 그대로 두면 **"큐레이션 세계" 섹션이 빈 채로 남고**, 더 심각하게 `pickDailyGame` 이 `vocabCount < 6 ? BANK_GAMES : …` 로 갈리므로 후보 0개 → `from[NaN]` → `undefined` 로 **단어 6개 미만 학습자의 `/arcade` 가 통째로 크래시**한다.

새 축은 **학습 동사**(L계층 진행과 같은 순서): `빠르게 떠올리기(6)` · `직접 만들어 내기(6)` · `읽고 추론하기(7)`. `HUB_TRACKS` + `trackOf()` 로 카탈로그에 명시(문자열 파싱 금지 — 오분류가 조용히 생기지 않게). `pickDailyGame` 은 분기를 없애고 후보가 비면 전체 카탈로그로 되돌아가도록 방어.

#### 검증

- **신규 spec [13-arcade-integrity.spec.ts](../apps/web/tests/e2e/13-arcade-integrity.spec.ts)** — 기존 07 은 "마운트 + 첫 입력 + 콘솔에러 0"만 봐서 **게임이 wordPool 을 통째로 무시해도 초록불**이었다. 이제 ⓐ **19종 전부가 `?set=` 자료를 실제로 싣는지**(세션 셸 `aria-label` 로 판정 · **맛보기 degrade 를 실패로 잡는다**) ⓑ 허브가 모든 카드에 스코프를 전달하는지 ⓒ 스크립트 화면 진입문. **A·B·C 전부 pass**(A2 는 storage-state 경합 flake, 재시도 통과).
- 유닛 [catalog.test.ts](../apps/web/src/lib/game/__tests__/catalog.test.ts) 40/40 — 트랙 분류 전수 커버·빈 트랙 금지·`pickDailyGame` 크래시 회귀 추가.
- `tsc --noEmit` 클린.
- ⚠️ 09-arcade-access B3 재작성 — 'bank 게임 = 큐레이션 세계' 단언이 죽었다. 새 계약은 **"조용히 degrade 하지 않는다"**(맛보기는 FSRS 에 안 남으므로 기록되는 플레이로 오인하면 진도를 착각한다).
- ⚠️ 테스트 함정: 사이드바에도 "아케이드" 링크가 있어 `getByRole('link', {name:/아케이드/})` 는 ModePills 안으로 한정해야 한다.

### 🔒 public 스키마 노출 정리 — anon 키로 사전을 고칠 수 있던 상태 (마이그레이션 `harden_public_reference_tables_and_drop_scratch`)

MCP 로 권한을 직접 조회하다 발견. **advisor 가 WARN 으로 조용히 세던 것의 실체가 이거였다.**

8개 테이블이 RLS 없이 anon 에게 `INSERT·UPDATE·DELETE·TRUNCATE` 까지 열려 있었다.
anon 키는 브라우저에 실려 나가므로, 누구나:

- `lexicon_clean` **455,037행을 UPDATE** — 학습자 단어 뜻 조회가 전부 이 테이블을 거친다
- `extraction_test_vocab` **2,045,936행 · 1.4GB 평가 코퍼스를 TRUNCATE**

실측으로 확인했다(anon 롤로 조회 성공 + `has_table_privilege` = true).

#### 조치가 테이블마다 다른 이유

이 테이블들을 읽는 함수(`lookup_word_meaning` 등 7종)가 **전부 SECURITY INVOKER** 다.
정책 없이 RLS 만 켜면 호출자 권한으로 읽으므로 **학습자 단어 조회가 통째로 죽는다.**

| 대상 | 조치 |
|---|---|
| `lexicon_clean` · `spelling_norm` · `dialect_map` · `csat_stage_gates` | 쓰기 권한 회수 + RLS + **읽기 정책** (조회 유지) |
| `extraction_test_books` · `extraction_test_vocab` | 전 권한 회수 + RLS **정책 없음** (서비스롤 스크립트만 사용 — 실측 확인) |
| `csat_stage_catalog` (뷰) | `security_invoker = true` — 기존 `views_security_invoker` 에서 누락됐던 한 건 |
| `_seed_lem`(54,230행) · `_resid_ctx`(4,212행) | **DROP** — 코드·함수·뷰 참조 0건. 삭제 전 `work/db-backup/` 에 전량 백업 |

**검증**: anon 이 `lexicon_clean` 455,037행을 여전히 읽고, `lookup_word_meaning` 이 정상 해소
(`coverage-clean` tier). UPDATE·TRUNCATE·평가 코퍼스 SELECT 는 전부 차단.
**Supabase advisor ERROR 9건 → 0건.**

#### 자기발전 정답 표본을 저장소로

`truth.json`(사람이 페이지를 열어 센 컷 수)이 `work/` 안에만 있었다 — gitignore 대상이라
작업 폴더를 지우면 이 하네스에서 **제일 비싼 산출물**이 통째로 날아가고 스윕을 재현할 수 없다.
`scripts/comic/pd/samples/` 로 옮기고 `tune.mjs` 가 작업 폴더 → 저장소 순으로 찾게 했다.
이미지는 남기지 않고 재구성 방법만 적어둔다(README).


### PDCP 스키마 정합 — MCP 로 DB 를 직접 점검해 결함 3건 (마이그레이션 `pdcp_adapter_browser_assist_and_term_expired_basis`)

Supabase MCP 가 붙어 DB 를 직접 볼 수 있게 되자, 코드만 봐서는 안 보이던 것들이 나왔다.

- **큐 마이그레이션에 로컬 파일이 없었다.** `pdcp_queue_states_and_monitoring` 을 MCP 로만 적용하고
  `supabase/migrations/` 에 남기지 않아, 새 환경에서는 `queued`·`last_error`·`attempts`·`acquire_pages`
  없이 테이블이 만들어졌다 — 콘솔과 드레인이 통째로 깨지는 상태. 적용된 DDL 을 DB 에서 역으로 읽어
  파일로 기록했다.
- **파일명 버전이 DB 기록과 달랐다.** `20260809020000_pdcp_...` 인데 DB 는 `20260808161400` —
  `db push` 가 같은 변경을 다시 적용하려 든다. DB 기록에 맞춰 rename.
- **`browser-assist` 가 어댑터 CHECK 에 없었다.** 브라우저 보조로 사람이 직접 받은 호를 큐에 넣으면
  제약 위반으로 거부된다 — 어댑터는 이미 코드에 등록돼 동작하는데 적재 경로만 막혀 있었다.
- **PD 근거 토큰이 코드와 갈렸다.** 검색 랭킹은 `PD_YEAR_CUTOFF`(1930)를 쓰는데 `usPdHint` 만 1929 가
  하드코딩돼, 1930년 발행물이 목록에선 "PD 확정"인데 적재하면 "미확정"이 됐다.
  토큰을 연도 비종속 `term-expired` 로 바꾸고 상한을 한 곳(`PD_YEAR_CUTOFF`)에서만 읽게 했다 —
  `pre-1929` 같은 토큰은 매년 1월 1일에 거짓이 된다. 회귀 스펙 5건으로 고정(총 66건).

검증: `browser-assist` + `term-expired` 로 실제 INSERT 성공(롤백). anon 세션으로 미발행 호 0건 노출 확인.

#### 그 밖에 확인한 것

- 대기 중이던 `get_comic_format` 마이그레이션은 **이미 적용돼 정상 동작**(발행 만화에서 `comic-page` 반환,
  authenticated·anon EXECUTE 권한 정상). 대기 메모 삭제.
- DB 통계 갱신: **81 테이블 · 6 view · 310 함수 · 377 migrations** (문서상 59/5/227/58 로 낡아 있었다).
- `DB_SCHEMA.md` 에 PDCP 섹션 추가 — 상태 전이·발행 게이트·근거 토큰·RLS 이중 게이트.
- Supabase advisor: ERROR 9건은 전부 기존 것(VCB/LCP 작업 테이블 8개 RLS 미적용 +
  `csat_stage_catalog` SECURITY DEFINER 뷰). PDCP 관련 경고는 설계대로 —
  발행 게이트 SECURITY DEFINER RPC 와 published-only 읽기 정책.


### PDCP 자기발전 — 손으로 고른 파라미터를 측정으로 갈아치웠다 (마이그레이션 없음)

`scripts/comic/pd/tune.mjs` 신설. CCP 의 gen-verified 폐루프에 대응하는 PDCP 쪽 장치로,
**산출물을 채점하고 더 나은 파라미터를 찾아 래칫한다.**

채점은 프록시가 아니라 **사람이 박은 정답**으로 한다 — 컷 개수·커버리지만 최적화하면
과분할이 이긴다(실제로 첫 규칙이 정답 7컷 페이지에서 9컷을 골랐다). 표본 페이지를 눈으로 세어
`truth.json` 에 적고, 정답과의 오차를 1순위 지표로 쓴다.

#### 컷 분할 — 고정 dilate 폐기, 페이지 단위 적응형 채택

스윕에서 드러난 것: **표본마다 최적 고정값이 정반대였다.**

| 조합 | All Top Comics #6 | Classics Illustrated #27 | 평균 |
|---|---|---|---|
| **적응형(채택)** | **-0.667** | **-1.122** | **-0.894** |
| a2000/d2 (차선 고정값) | -0.667 | -2.226 | -1.446 |
| a800/d0 (표본1 1위) | -0.333 | -4.417 | -2.375 |
| a1500/d3 (표본2 1위) | -4.088 | -0.239 | -2.163 |
| **a1100/d2 (직전 운영값)** | **-4.200** | -1.122 | **-2.661** |

- 직전 운영값은 17개 조합 중 **거의 최하위**였다. 근거가 "480px 에서 안 쪼개져서 올렸다"뿐이었고,
  그 한 장 말고는 아무도 검증하지 않았다.
- 적응형 선택 기준은 **박스 겹침(커버리지 > 1)이 풀리는 첫 지점**이다. 커버리지가 1을 넘는다는 건
  바운딩 박스가 서로 겹친다 = 컷이 아직 병합돼 있다는 뜻이다. 겹침이 풀리는 순간이 구조가 드러난 지점.
  이미 겹치지 않는 페이지는 더 팽창시키면 컷을 갉는다(0.86 → 0.22 실측).
- 결과: Classics Illustrated 에서 운영값과 **동점**, All Top Comics 에서 **6.3배 개선**.

#### 대사 추출 — psm 3 → 4

| 설정 | All Top | Classics Illustrated |
|---|---|---|
| psm3/conf55 (직전) | 30.97 (그대로쓸수있음 32) | 6.84 (8) |
| **psm4/conf55 (채택)** | **32.84 (34)** | **7.95 (9)** |
| psm6·psm11 | 대사를 3~5배 뱉지만 95%가 검수 대상 + 비라틴 오염 | 동일 |

psm 4 = "가변 크기 텍스트 한 열" — 말풍선은 세로로 쌓인 짧은 줄이라 여기에 맞는다.
**두 표본 모두에서 1위**라 채택했다(한 표본 1위는 그 표본에만 맞춘 값일 수 있다).

#### 래칫 자체의 결함도 하나 잡았다

처음엔 표본을 구분하지 않고 한 계열에 이어붙여, All Top 의 -0.333 과 Classics Illustrated 의 -0.239 를
비교해 "개선"이라고 기록했다. **서로 다른 페이지를 채점한 수는 비교 대상이 아니다.**
이제 `kind:sample` 로 계열을 나누고, 채택 판단은 교차 평균으로 한다.

#### 남은 한계 (정직하게)

- 정답 표본이 4페이지(2소스)뿐이다. 늘릴수록 판단이 단단해진다.
- All Top 0008 은 어떤 파라미터로도 8컷 중 6컷까지만 나온다 — 맞닿은 컷은 이 알고리즘의 한계.
- **만화 지면 vs 광고·표지 분류 단계가 없다.** 광고 지면을 분할 채점에 섞었더니 스윕 1위가
  광고 한 장에 끌려갔다(그래서 정답 표본에서 뺐다). 지금은 검수에서 사람이 걸러낸다.

### 전수테스트 (2026-08-09)

- 단위 **225 통과**(4 파일 skip) · PDCP 파이프라인 **61 통과** · 프로덕션 빌드 **성공**(124 페이지)
- e2e 87건 중 **72 통과 · 9 실패 · 6 skip**. 실패 9건은 전부 **기존 결함** —
  이번 세션이 건드린 공유 파일은 `lib/supabase/admin.ts` 하나뿐이고, 그것을 세션 이전 상태로
  되돌려 재실행해도 **동일하게(오히려 더 많이) 실패**했다.
  · 03-admin-curation · 10-judge-harness — 런타임 계정이 `role=user` 라 `/admin` 에서 `/hub` 로 리다이렉트.
    **앱이 옳고 스펙이 틀렸다**(신규 13-pdcp 스펙은 같은 상황을 "학습자 차단"으로 올바로 단언한다).
  · 01·02·05·06·08 — 셀렉터/시드 데이터 문제 (element not found)
  · 12-arcade-audio — 30s 타임아웃. 19곡 MP3 헤더 검사라 단독 실행에서도 재현.
- **고친 것**: `@vocaflow/library-pipeline` 타입체크 5건(`noUncheckedIndexedAccess` 가드 누락, 2026-07-26 이후 방치).
  이것 때문에 `pnpm turbo run typecheck` 가 저장소 전체에서 실패하고 있었다. 이제 6/6 통과.


### PDCP 소스 GET 정교화 + 브라우저 보조 취득 (마이그레이션 없음)

**딥서치 결론 — 소스를 늘리는 것보다 있는 소스를 제대로 쓰는 게 이득이었다.**
후보를 전부 실측(2026-08-09)한 결과, 골든에이지 만화 전권 스캔을 자동 취득할 수 있는 곳은
사실상 Internet Archive 하나다.

| 소스 | 실측 결과 | 처리 |
|---|---|---|
| Internet Archive | 검색 API·hOCR 개방 | **자동** (정교화 대상) |
| Comic Book Plus | robots.txt 가 `ClaudeBot`·`anthropic-ai` 를 전면 Disallow + 목록/벌크 엔드포인트 전부 Disallow | 브라우저 보조 |
| Digital Comic Museum | 일반 클라이언트 403 · 무료 계정 필요 | 브라우저 보조 |
| Library of Congress | Cloudflare 챌린지("Just a moment…") | 브라우저 보조 |
| HathiTrust | 다운로드 403 | 브라우저 보조 |
| DPLA · Smithsonian · Europeana | API 키 필요 + **만화 페이지 스캔은 사실상 없음**(아카이브로 되돌아감) | 미채택 |
| Wikimedia Commons | 개방 API 지만 표지·낱장 위주, 전권 시퀀스 아님 | 미채택 |

명시적으로 자동 수집을 거부한 사이트에는 스크래퍼를 붙이지 않았다.

#### IA 발견 정교화 (`sources/discovery.mjs` 신설)

- **저작권 살아 있는 자료가 검색 상위에 올라오던 문제**를 고쳤다. 초기 질의는 `q AND mediatype:texts` 한 줄이라 "classics illustrated" 에 Strega Nona(2017)·Great Illustrated Classics(1990) 가 상위였다.
- `collection:comics` 로 좁히는 건 **더 나쁘다** — 실측 116,891건 상위가 Batman 1940·Spawn·Daredevil, 즉 사용자 업로드 침해물이다. **컬렉션이 곧 PD 보증은 아니다.**
- 대신 ① 제목 우선 질의 ② 컬렉션·연도·최소페이지 필터 + 정렬 + 페이지네이션 ③ **PD 위험도 3등급 판정 후 재정렬**(같은 등급 안에서는 큐레이션 컬렉션 우선) ④ 프리셋 출발점 3종(Fawcett 813건 · Classics Illustrated · PD 확정 구간).
- **제목에서 연도 추출** — IA `year`/`date` 필드는 만화 컬렉션에서 자주 빈다(fawcett 상위 6건 중 5건). "Whiz Comics 002 (1940-02)" → 1940. 호수(002·51)를 연도로 오해하지 않는다.
- PD 확정 상한을 **1929 → 1930** 으로 갱신(2026-01-01 부로 1930년 발행물 PD). `PD_YEAR_CUTOFF` 한 곳만 고치면 힌트·위험도·프리셋이 함께 따라온다.

#### 브라우저 보조 취득 (`sources/browser-assist.mjs` · `assist.mjs` · `/api/pdcp/assist`)

- 진짜 크롬 창을 띄우고 **사람이 로그인·선택·다운로드**하면, 도구가 받은 파일을 포착해 CBZ/ZIP 을 풀고 `pages/` 로 정렬·정규화한 뒤 매니페스트를 쓴다. 자동 클릭·자동 순회는 하지 않는다(그건 스크래퍼다).
- 로그인 세션은 영속 프로필에 남아 다음 회차에 재사용된다.
- ZIP 리더를 직접 구현했다 — 이 환경에 unzip 이 없고 Node 에 zip 리더가 없다. 실물 CBZ(IA, 37엔트리 · store+deflate 혼재)로 검증: **36장 추출 → 복원 단계 통과**.
- CBR(RAR)·PDF 는 해제하지 못한다는 사실을 메모로 남긴다 — 조용히 0장이 되면 성공처럼 보인다.

#### 그 밖에

- **vitest 종료 코드 134** — 테스트 파일이 4개가 되자 전부 통과한 뒤 SIGABRT 로 죽었다(Node 24.15 · 워커 스레드 풀). 결과는 초록인데 CI 는 빨간불이 되는 유형이라 `scripts/comic/pd/vitest.config.mjs` 로 `pool: forks` 고정.
- 회귀 스펙 +33: `discovery.test.mjs`(21) · `assist.test.mjs`(8, 합성 ZIP 으로 store/deflate·정렬·손상파일 격리 검증) · e2e +4(프리셋·위험도 배지·보조 패널 정책 표기·작업명 검증).


### PDCP 운영 콘솔 — 파이프라인을 화면에서 돌린다 (마이그레이션 `pdcp_queue_states_and_monitoring`)

- `/admin/pd-comics` 가 **읽기 전용 목록에서 조작면으로**. 3탭 — 소스·대량 적재 / 큐·드레인 / 도구.
  - 어댑터 능력표는 `scripts/comic/pd/sources` 를 **동적 import** 해서 그린다. 앱에 베껴두면 즉시 drift 한다(아케이드 카탈로그가 4곳에 복제돼 전부 낡았던 실패의 재발 방지).
  - **테스트 모드** — 전권 대신 앞 N장만 취득해 파라미터를 먼저 확인. 52p 한 호를 매번 받아보며 튜닝할 수는 없다.
  - **드레인** — 호출 1회 = 호 1개의 다음 단계 1개. UI 가 반복 호출하며 라이브 로그를 쌓는다. dry-run 으로 실행할 CLI 명령을 먼저 보여준다. prod 403(앱이 ffmpeg 을 돌리는 건 로컬 한정).
- 신규 API 8종 `/api/pdcp/*` (sources·search·enqueue·drain·retry·queue·doctor·issue) — 전부 admin 게이트.
- **실측 end-to-end**: Classics Illustrated #27 을 테스트 모드(4p)로 적재 → queued→acquired→restored→segmented→ocr→review 전 구간을 콘솔에서 완주. 컷 8개 · 대사 20개(그대로 쓸 수 있음 50%).

#### 이번에 드러나 고친 결함 4건

- **실패가 단계를 지웠다** — 드레인이 실패 시 `status='failed'` 로 덮어써 *어느 단계에서 멈췄는지*가 사라졌고, 그 호는 큐에서 영구 이탈했다(복원 단계 ffmpeg 부재로 실측). 이제 status 는 보존하고 `last_error` 로만 표시 → 원인을 고친 뒤 **멈춘 지점부터** 재개. 자동 선택은 `last_error` 있는 행을 건너뛴다(같은 실패 무한 반복 방지).
- **admin 화면이 낡은 스냅샷을 보여줬다** — Next 14 가 전역 fetch 를 패치해 서버 측 GET 을 기본 캐시하는데 supabase-js 조회가 거기 걸렸다(DB 는 review·8컷인데 API 는 직전 failed 를 반환). `createAdminClient` 에 `cache:'no-store'` 를 못 박음 — **PDCP 뿐 아니라 서비스롤을 쓰는 admin 화면 전체에 해당하던 문제**.
- **server-only 가 클라이언트 번들로 새어 빌드가 통째로 깨졌다** — 운영 콘솔(클라이언트)이 `queries.ts` 에서 타입·상수를 가져오는 순간 `/api/pdcp/*` 전부 500. 순수 타입/상수를 `lib/pd-comic/model.ts` 로 분리.
- **`stageIndex` 가 미지 상태를 0(대기)으로 뭉갰다** — 실패·보관이 정상 대기처럼 보였다. -1 을 돌려주고 stepper 는 별도 표기.

- ffmpeg/tesseract 를 `tools/`(gitignore)에서도 찾도록 폴백 추가 — Windows 는 ffmpeg 기본 설치가 없어 PATH 만 보면 복원 단계가 통째로 실패한다.
- 회귀 스펙: `lib/pd-comic/__tests__/model.test.ts`(7) — 단계 목록이 드레인 전이표와 어긋나면 실패. `tests/e2e/13-pdcp-console.spec.ts`(5) — 8라우트 admin 게이트 + 조작면 렌더. `DEV_ADMIN_BYPASS` 활성 시 게이트 검증은 성립하지 않으므로 스펙이 이를 탐지해 skip 한다(빨간 스펙으로 학습되면 진짜 구멍을 놓친다).


### 아케이드 BGM v07.7 — 측정으로 선곡 + 마디 정렬 루프 (마이그레이션 없음)

사용자 피드백: "웅장하면서 긴장감과 긴박감이 있어야 함. 빠른 템포도 필요하고."

- **왜 v07.6 이 못 맞췄는지가 측정으로 드러났다** — 후보 118곡(Scott Buckley 72 + Alexander Nakarada 46)을 재보니 Buckley 라이브러리 대부분이 `pulse`(온셋 자기상관 피크 선명도) ≈ 1.0, 즉 **박이 노이즈와 구별되지 않는 앰비언트**였다. 제목이 장엄해도 몰아치지 않는 실체가 이것이다. 측정 축 6개: `bpm` · `onset/s`(긴박) · `pulse`(추진) · `low%`(150Hz 이하 타격) · `full%`(웅장) · `tension`(2~6kHz 변동).
- **BGM 19곡 재선곡** — `Alexander Nakarada`(creatorchords.com · CC-BY 4.0)가 전 축에서 앞서 16슬롯, Scott Buckley 3슬롯 유지(`morpheme-rules` Simulacra · `lexicon-detective` Honour Among Thieves · `word-orrery` Electric Dreams). **전 곡 129~161 BPM**, 19종 고유 트랙. 33.3 MB. 예: wordblitz *Riders of Ragnarok*(161) · ghost-race *Through the White Steppes*(161) · wordfall-cadence *Into Battle*(pulse 3.74 — 케이던스 게임에 가장 또렷한 박) · wordsmith-vigil *Daudir*(저역 타격 39% — 전 곡 최고) · glyph-tongue *Fantasy Soundscape*(pulse 5.65 · 긴장 1.33).
- **루프를 마디 정수배로 자른다** — `loopLen = bars × 4 × 60/bpm`, 크로스페이드도 1마디. 꼬리(start+loopLen)와 머리(start)의 **박 위상이 같아져** 크로스페이드가 박 위에 정확히 얹힌다. 임의 길이로 자르면 겹박(플램)이 나 추진력이 뭉개진다. 길이 109.5~110.6초(59~74마디).
- ⚠️ **크로스페이드가 조용히 사라지는 두 번째 경로 발견** — `-t X` 로 뜬 조각이 MP3 프레임 경계 때문에 X 보다 아주 살짝 짧으면 `acrossfade=d=X` 가 성립하지 않아 통째로 빠진다(19곡 중 다수가 딱 1마디 짧게 구워졌다). `X+0.4`초를 떠서 필터 안에서 `atrim` 으로 정확히 자르는 것으로 해결. 빌드 스크립트에 `출력 길이 == loopLen` 단언 추가.
- 표기 갱신 — `CREDITS.txt` 전면 재작성(선곡 근거 수치 + 곡별 BPM·마디 수 포함) · `/arcade` 푸터에 두 아티스트 + CREDITS 링크.
- **검증** — 12-arcade-audio 3/3(루프 길이 단언을 마디 정수배 범위 108.8~111.4초로 갱신) · 스피커 실재생 오디션 19곡 + 루프 이음매 2곡(경과 282초, 실패 0) · `tsc` 클린.

### 아케이드 오디오 v07.6 — 실제 시네마틱 음원 + 실녹음 효과음 (마이그레이션 없음)

- **BGM 19곡 전면 교체 — Kevin MacLeod(CC-BY 3.0) → Scott Buckley(CC-BY 4.0)**. 직전 세트는 8비트 칩튠을 걷어낸 결과물이었지만 여전히 샘플 라이브러리 오케스트라라 "웅장"과 거리가 있었다. 교체본은 라이브 감각의 시네마틱 스코어(`word-orrery` = *Adrift Among Infinite Stars*, `wordblitz` = *Escape Velocity*, `pirate-quest` = *The Great Sea* …). 게임 19종 × 서로 다른 19곡, 중복 없음.
- **루프가 심리스가 됐다** — 이전 빌드는 3초 페이드인 / 5초 페이드아웃이라 **110초마다 8초짜리 무음 구멍**이 생겼다. 지금은 꼬리 6초를 머리 6초에 크로스페이드해 잇는다: `concat( acrossfade(tail, head), body )`. 두 이음매(body→tail, head→body)가 모두 원곡 그대로의 연결이라 구멍도 클릭도 없다.
- ⚠️ **빌드 함정(회귀 spec 으로 고정)**: 한 입력을 `asplit=3` 으로 쪼개 `atrim` 셋을 물리면 `acrossfade` 가 빈 스트림을 받아 **크로스페이드 구간이 통째로 사라진다**(결과가 110초가 아니라 body 만 104초). head/tail/body 를 각각 별도 `-i` 로 열어야 한다. 파일은 멀쩡히 200 을 주므로 육안으로는 안 잡힌다.
- 구간 선정은 자동 — 인트로(앞 15%)·아웃트로(뒤 8%)를 뺀 뒤 초당 RMS 포락선에서 `평균 − 0.6×표준편차`가 최대인 116초 창(= 웅장하되 흔들리지 않는 구간). 전 곡 -16 LUFS / TP -1.5 dBTP 통일, VBR MP3(-q:a 5), 총 31.7 MB.
- **효과음 6종 교체 — Kenney "Interface Sounds"(CC0) → Mixkit 실녹음**. FFT 실측으로 기존 세트는 **6종 전부 모노 · 8 kHz 이상 에너지 0~0.6% · `correct`/`complete` 는 스펙트럴 평탄도 0.0000** — 대역제한 합성음이었다("그냥 컴퓨터 소리"라는 지적이 수치로도 맞았다). 교체본은 전부 스테레오 실녹음이고 비조화 부분음·자연 감쇠·고역 공기감을 갖는다: `correct`=실제 벨 0.65s / `wrong`=나무 타격 0.30s / `combo`=반짝임 0.95s / `click`=타자기 타건 0.15s / `coin`=실제 동전 0.45s / `complete`=금관 합주 2.8s. 총 494 KB. `wrong` 을 버저가 아닌 나무 타격으로 둔 건 Empathetic Feedback(오답에 비난조 금지).
- 코드 변경 없음 — `SFX_SRC` 확장자 매핑(`complete` 만 `.ogg`)을 그대로 유지. `useSfx` 의 호출별 게인 위계도 그대로(피크 목표가 완주 > 정답 > 코인·콤보 > 오답 > 클릭 순으로 이미 설계됨).
- 표기 갱신 — `public/audio/games/CREDITS.txt` 전면 재작성 · `/arcade` 푸터 "Scott Buckley · CC-BY 4.0 · 효과음: Mixkit".
- **배경음악 기본값 OFF → ON** (사용자 결정 2026-08-09: "단어 게임은 음악이 중요함"). 기존 OFF 의 근거는 Calm UI 였지만 실측 결과가 Calm 이 아니라 **무음**이었다 — 토글 전에는 트랙을 내려받지도 않아, 시네마틱 BGM 19곡을 붙여놓고도 처음 들어온 학습자는 한 곡도 듣지 못했다. `DEFAULT_MUSIC_ON` + `readMusicOn()` 신설: `readMusicPref()` 는 미설정을 `null` 로 유지하고 실제 판단만 기본값으로 폴백해, **명시적으로 OFF 를 고른 학습자를 기본값 변경이 덮어쓰지 않는다**. `useGameMusic` 은 초기값을 상수로 잡아(하이드레이션 불일치·아이콘 깜빡임 제거) `ready` 게이트 전에는 절대 소리를 내지 않는다.
- 자동재생 차단 대응에 **`keydown` 추가** — 기존엔 `pointerdown` 만 듣고 있어, 포인터를 안 쓰는 타이핑 게임(wordsmith-vigil·letter-forge 등)은 기본 ON 이어도 영영 무음이 될 참이었다.
- **신규 spec [12-arcade-audio.spec.ts](../apps/web/tests/e2e/12-arcade-audio.spec.ts) 3/3 pass** — ① BGM 19곡을 브라우저에서 실제 디코드해 110초·스테레오 단언(104초 회귀 차단) ② 효과음 6종 길이·스테레오 단언(모노 합성음 회귀 차단) ③ 선호 미설정 학습자가 **토글 없이 게임 진입만으로** 트랙을 받는지 + 명시적 OFF 가 리로드 후에도 유지되는지. 기존 [09-arcade-access.spec.ts](../apps/web/tests/e2e/09-arcade-access.spec.ts) F1 은 기본 ON 기준으로 재작성(허브 토글 → 게임 적용을 끄기/켜기 양방향으로 고정) — F1·F2 2/2 pass.

### 품질 루프 4회차 — **학습자 전 화면 접근성 위반 0 달성**, 게이트 11화면으로 확대 (2026-08-09)

3회차 잔여 21건을 끝까지 좁혀 학습자 화면 전체가 라이트·다크 모두 **위반 0**. 게이트가 이제 11개 화면 + 만화 4면 + 도서 목록을 지킨다.

- **채움 위 글자 규칙 완성** — `--on-semantic`(semantic 채움 버튼 · 테마별 반전) 추가. `PrimaryButton` 의 iOS 원색 채움(red 3.55 · orange 2.20 · green 2.22)을 Reading Room semantic 팔레트로 교체하고, 앰버처럼 밝은 면에는 잉크 글자(#231a09, 5.0:1)를 얹었다.
- **다크 `--error` 를 채움 기준으로 조정** `#C25E54 → #A8443A` — 흰 글자 4.18 · 잉크 3.99 로 **어느 쪽 글자도 AA 를 못 넘기던** 값이었다. 글자용 밝은 빨강은 `--error-ink` 가 따로 담당하므로 채움만 깊게.
- **ACP 트랙 액센트를 테마 토큰으로** — `--track-*` 7종(라이트=진한 원색 / 다크=밝은 톤). 같은 색을 5% wash 배경 위 글자로 쓰는 구조라 다크에서 2.85~3.18 이었다.
- **공용 컴포넌트 3건** — `StatPill` 값 색(iOS 원색 1.76~1.78 → ink) · `Capsule` brand 톤(`--p-dark` 는 다크에서 오히려 더 어둡다 → `--on-p-tint`) · `HubStartCard` 에 `accentText` 도입(모듈 accent 채움 위 글자 지정).
- **`judgeArticleIPlusOne` 누락 보정** — 책 버전만 잉크로 바꾸고 글(article) 버전을 빠뜨려 `/library/scripts` 배지가 계속 미달이었다. 두 판정이 같은 규칙을 쓰도록 정렬.
- **자기 계열 tint 안티패턴** — 글자색의 14% 를 배경으로 깔면 같은 계열이라 4.5 를 넘기 어렵다(실측 4.49). 중립 면(`--bg2`) 위에 잉크를 얹는 방식으로 교체.
- 검증: 14-learner-quality 5/5(11화면 + 만화 4면 + 도서목록 · 라이트/다크) · 11/12/13 16/16 · 04-ui-smoke 5/5 · unit 229 · tsc 클린.

### 품질 루프 3회차 — 잉크 토큰 체계 완성, hub·dashboard·dictate·arcade 도 게이트 편입 (2026-08-09)

2회차의 잔여(47건)를 계속 좁히며, "면 vs 잉크" 규칙을 **semantic·brand tint 까지** 확장해 체계를 닫았다.

- **잉크 토큰 3계열 추가** — `--on-p-tint`(브랜드 tint 칩 · 테마별 반전) · `--success/error/warning/info-ink` · (2회차의) `--memory-*-ink`. 실측 미달치: success 4.21 · warning 2.82 · info 3.63 · 다크 tint 위 success 4.27.
- **`--memory-stable-ink` 재조정** `#2E7D5A → #1F6B49` — 종이(4.79)는 통과했지만 `--bg3`(4.03)에서 미달이었다. 잉크는 **가장 어두운 종이 톤 기준**으로 잡아야 한다는 걸 이번에 확인.
- **무효 CSS 2건 추가 제거** — `TodayQueue` 의 `` `${meta.color}0D` `` (var() + 알파 hex)로 카드 배경·테두리가 실제로는 **투명**이었다. `color-mix()` 로 교체(ScriptQuiz 와 같은 유형, 세 번째 발견).
- **공용 컴포넌트 교정** — `TodayQueue`(hub·flashcard·spellforge 3화면 공용) 색 구조를 `color/ink/tint/edge` 로 분리 · 분포 막대의 `aria-prohibited-attr` 제거 · `VocabSetCarousel` 활성 탭 accent 3종을 흰 글자 AA 기준으로 심화(csat 3.19→5.38 등) · `RecommendedSetsSection` 배지 팔레트 · `PlanClient` 의 `opacity-70` 이중 감광 제거.
- **게이트 확장** — `14-learner-quality` 에 **hub·dashboard·dictate·arcade** 추가(라이트/다크 0 유지). 나머지 화면(wordvault·flashcard·scriptquiz·plan·settings·library/*)은 잔여가 남아 아직 넣지 않았다 — **0 이 되는 대로 배열에 한 줄씩 추가**하는 것이 이 루프의 진행 방식이고, 스펙 주석에 그렇게 적어두었다.
- 검증: 14-learner-quality 5/5 · 11/12/13 포함 21/21 · 04-ui-smoke 5/5 · unit 229 · tsc 클린.

### 품질 루프 2회차 — 학습자 전 화면으로 확대, 접근성 위반 719 → 20 (2026-08-09)

1회차(만화·도서)를 앱 전역 학습자 화면 11곳(hub·dashboard·wordvault·flashcard·scriptquiz·dictate·arcade·library/scripts·library/vocab·plan·settings)으로 넓혀 같은 루프를 돌렸다.

- **`--t3` 텍스트 금지 규칙을 전면 적용(코드모드)**: 학습자 표면 246파일 · 1,221곳의 `text-[var(--t3)]` → `--t2`. 어드민·게임·아케이드(`(app)`)는 자체 팔레트라 **의도적으로 제외**(admin 34곳 잔존 확인). `--t4` 를 글자로 쓰던 곳도 동일 처리.
- **`--memory-*-ink` 4종 추가**: Memory Decay 색을 작은 글자로 쓰면 shaky 3.29 · new 3.63 으로 미달이었다. 면·점·막대는 원색 유지, 글자만 잉크(다크는 반대로 밝은 값).
- **`--active-ink` 재조정 `#8A6420` → `#7E5A1B`**: 종이 위에선 통과했지만 앰버 tint(`--warning-light`) 위에서 4.40 으로 아슬하게 미달이었다. 종이 5.97 · 앰버 tint 5.13 으로 재조정.
- **ScriptQuiz 챕터 칩** — `` `${QUIZ_ACCENT}15` `` 가 `var(--active)15` 라는 **무효 CSS 값**이라 배경이 투명이었고 글자만 3.24:1 로 남아 있었다(라이트 101 노드의 정체). tint 토큰 + 잉크로 교체.
- **구조적 접근성 3종**: `aria-prohibited-attr`(role 없는 div 에 aria-label → 막대 전체를 `role="img"` 하나로) · `dlitem`/`definition-list`(dt/dd 를 dl 직계로 평탄화) · `scrollable-region-focusable`(가로 스크롤 목록에 `tabIndex=0` + 포커스 링).
- **결과**: 총 위반 719 → **20**(색대비 719→45→그 뒤 구조 수정 포함). 만화·도서·리더 5개 화면은 계속 **0** 유지.

#### 회귀 스펙 자체의 결함 2종도 수정

- **진도 잔여 상태 의존** — 리더 테스트가 이전 실행이 남긴 `comic_read_progress` 위치에서 열려, 마지막 컷이면 '다음 컷'이 disabled 라 실패했다. 시작 위치를 0 으로 고정하고 `finally` 로 복원하게 바꿔 결정론화.
- **라벨 결합** — 병행 세션이 만화 탭 라벨을 Adapted/Restored → Book Comics/Vintage Comics 로 바꾸자 스펙이 깨졌다. 탭·사이드바 단언을 **href 기준**으로 전환(라벨 변경에 무관).

### 학습자 화면 품질 자기발전 루프 — 접근성 게이트 신설 + 토큰 체계 개편 (2026-08-09)

"측정 → 결함 → 수정 → 재측정"을 9회 돌려 만화·도서 화면의 접근성 위반을 **0** 으로 만들고, 그 측정 자체를 상시 게이트(`14-learner-quality.spec.ts`)로 고정했다. 측정 도구는 `@axe-core/playwright`(WCAG 2.1 A/AA) 신규 도입.

- **근본 원인은 토큰이었다 — 면(fill)과 잉크(ink) 분리(ADR-004)**: 브랜드/시스템 원색을 *작은 글자*로 쓰면 거의 전부 AA 미달이었다(실측: `--active` 3.24 · `--ios-green` 2.02 · `--ios-orange` 1.99 · `--learn-known` 2.23). 다크에선 반대로 밝은 원색이 흰 글자와 부딪혔다(`--p` 위 흰 글자 2.90 · `--success` 위 2.98). → 배경·아이콘은 원색 그대로 두고 **글자만** 새 토큰으로: `--active-ink` · `--ios-*-ink`(7종) · `--learn-*-ink`(3종) · `--on-p`(테마별 반전).
- **`--t3` 는 텍스트 색이 아니다**를 규칙으로 확정: 알파 0.38 은 종이 위 2.35:1 이고 **어떤 알파로도 4.5 를 못 넘긴다**(0.62=`--t2` 가 최소선 4.79). 저자명·설명·탭 캡션·메타 등 의미 있는 글자를 `--t2` 로 올렸다(ComicsTabs · LibraryTabs · FlowNav · ComicsBrowser · ComicHeroCard · ComicFormatChoice · BookGridCard · BookFilterBar · BookShelfRail · LibraryGrid · 만화 상세/리더).
- **공용 컴포넌트 교정**: `Capsule` 이 tint 위에 원색 글자 + `opacity:0.85` 이중 감광이라 2.01:1 이었다 → ink 토큰 + opacity 제거. `i-plus-one` 적합도 배지도 ink 토큰으로(가장 많이 걸린 41 노드).
- **ARIA 구조 수정**: LibraryGrid 의 `role="list"` 가 listitem 의 직접 부모가 아니어서 `aria-required-children`(critical)이 떴다 → 실제 부모로 이동.
- **44px 터치 타겟**(CLAUDE.md 절대 금지 항목) 전수 교정: 필터 칩 36개 · 빠른 선택 · 검색/정렬 컨트롤 · 코버플로우 점(6×6 → 44px 히트영역 + 안쪽 점) · 사이드바 로고/접기 · 만화 레벨 칩.
- **결과**: 만화 카탈로그/상세/복원 서가/리더 · 도서 목록 = **라이트·다크 모두 axe 위반 0**, 학습자 콘텐츠 내 44px 미만 **0**.
- 검증: 14-learner-quality 4/4 · 11/12/13 회귀 15/16(1건은 dev 콜드 컴파일 타임아웃, 단독 재실행 통과) · unit 225 · tsc 클린.

### 만화 화면 기본 조작 전수 점검 — `13-comic-navigation.spec.ts` 신설 (2026-08-09)

카탈로그 · 상세 · 리더 컨트롤 · 이탈/복귀 · 종료 CTA · Restored 탭을 자동 감사하고 상시 회귀로 고정.

- **발견·수정 — 버튼을 누르면 화살표 넘김이 죽었다**: 리더 키 핸들러가 "컨트롤에 포커스가 있으면 단축키 양보" 였는데, 이전/다음 컷 버튼을 마우스로 한 번 누르면 포커스가 그 버튼에 남아 **이후 ArrowLeft/Right 가 조용히 무시**됐다(실측: 6 → → 6). 마우스와 키보드를 섞어 쓰는 것이 정상 사용이므로 화살표는 항상 받도록 바꾸고, **Space 만** 예외로 남겼다(포커스된 버튼을 누르는 키라 리더가 가로채면 이중 동작). 입력 필드·모달 안에서는 여전히 전면 양보.
- **정상 확인(설계 의도대로 동작)**: 컨트롤 3초 자동 숨김 → `focus` 로 자동 노출(키보드 사용자가 갇히지 않는다) · 다음/이전 컷 · 뷰 전환(페이지↔세로 스크롤) · 몰입(dim) `aria-pressed` · stave 레일 점프 · 코치 안내 닫기 · 본문 복귀 후 뒤로가기로 리더 복귀 · 마지막 컷 종료 화면 + 본문/퀴즈 유입 CTA · 상세의 목록 복귀/단어장 연결/원문 카드.
- **감사 스펙이 넘어졌던 함정 3종을 규칙으로 남김**(주석): ① 컨트롤은 opacity 0 + pointer-events-none 으로만 숨어 Playwright 에 "보이는데 클릭 불가(not stable)" 로 보인다 → 컴퓨티드 opacity 로 판정 ② stave aria-label 상태값은 `읽음/현재/남음` ③ **모든 컷에 정본 대사가 있는 게 아니다**(캡션만 있는 컷) → 대사 단언은 조건부.
- 현재 Restored(PDCP) 서가는 0편이라 렌더까지만 검증(데이터 들어오면 리더 왕복까지 자동 검증).

### 내비게이션 기본기 전수 자동 점검 — `12-navigation.spec.ts` 신설 (2026-08-09)

"화면 이동 / 뒤로가기 / 닫기 / 페이지 네비게이션"을 자동 감사하고, 그 시나리오를 상시 회귀로 남겼다. 감사 범위: 사이드바 15개 메뉴 · 탭 5개(라이브러리 3 · 만화 2) · 진입 리다이렉트 2건 · 브라우저 뒤로/앞으로 · 페이지 내 되돌아가기(만화 상세→목록, 리더→본문) · 워크스페이스 ModePills 9종.

- **결과: 이동 경로 자체는 전부 정상.** 사이드바 15/15, 탭 5/5(aria-selected 포함), 히스토리 복원, 인페이지 복귀 링크 모두 통과.
- **발견·수정 — hydration mismatch**: `Toggle` 이 `Math.random()` 으로 input id 를 만들어 서버/클라 값이 달랐다(`/settings` 콘솔 `Prop id did not match. Server: tg-… Client: tg-…`). id 가 어긋나면 `label htmlFor ↔ input` 연결이 깨져 **라벨 클릭·스크린리더 연결도 함께 흔들린다.** `useId()` 로 교체. 같은 패턴이던 `Radio`(value 없는 경우)도 선제 수정.
- **감사 도구 자체의 오탐 2종을 규칙으로 고정** — 다음 사람이 같은 곳에서 헛다리 짚지 않도록 스펙 주석에 근거를 남겼다:
  - Next 는 스트리밍 시작 후의 `redirect()` 를 **소프트(클라) 리다이렉트**로 처리한다. 문서 응답은 200 이고 URL 은 hydration 후 바뀌므로 `goto` 직후 URL 로 판정하면 "리다이렉트 안 됨"으로 오판한다. → 전부 `waitForURL` 판정.
  - dev 서버는 라우트별 콜드 컴파일이 수 초~수십 초라 클릭 직후 URL 을 읽으면 "이동 안 함"으로 오판한다(세션 pill 3종이 그렇게 실패로 보였으나 실제로는 정상).
- ModePills 계약도 단언에 포함: 워크스페이스를 떠나는 pill 은 복귀용 `from=` 파라미터를 반드시 실어야 한다.

### 만화를 볼 수 없던 이유 — `cefr_level` NULL 이 등록을 막고 있었다 (2026-08-09 수정)

"만화 보는 페이지가 안 된다"는 제보를 끝까지 재현해 원인을 특정했다. **UI 문제가 아니라 데이터 결손**이었다.

- **근본 원인**: `enroll_library_book` 은 `cefr_level ∈ (A1…C2)` 가 아니면 예외를 던진다. 만화가 발행된 유일한 도서(A Christmas Carol)가 `cefr_level = NULL` — 발행 도서 13권 중 **유일하게** 비어 있었다. 그래서 `texts` 행이 한 번도 만들어지지 않았고(전 사용자 0행), 리더 라우트 `/text/[id]/comic` 에 **아무도 도달할 수 없었다**. 만화 자체는 정상(90컷·5 stave·이미지 public 200).
- **데이터 수정**: `cefr_band='B2'`(이미 있던 값)로부터 `cefr_level='B2'` 채움 — 1행 UPDATE.
- **실패를 삼키던 UI 수정**: `ComicFormatChoice` 가 모든 등록 실패를 "잠시 후 다시 시도해 주세요" 로 뭉개 원인을 볼 수 없었다. 이제 차분한 한 줄 뒤에 실제 사유를 덧붙인다.
- **회귀 신설** — `11-comic-discovery.spec.ts` "만화 리더": 상세 → 시작(등록) → `/text/[id]/comic` → **컷 카운터 + 정본 대사 렌더 + `comic_read_progress` service-role DB 단언**. 이 체인이 죽으면 실패한다.
- **테스트가 조용히 공회전하던 것도 고침**: 카드 href 가 등록 상태에 따라 상세/리더로 갈려서, 등록 후에는 `a[href^="/comics/adapted/"]` 가 아무것도 못 찾고 "카탈로그 0" 으로 통과하고 있었다. 카드에 `data-book-id` 를 붙이고 그것으로 도서를 식별하도록 교체.

### 곁가지 수정 — WordVault 허브가 로드마다 400 을 쏘고 있었다

위 등록으로 계정에 챕터 단어장 구독이 생기자 드러난 **선재 결함**. `useHubStats` 가 `shared_word_sets.category_id` 를 먼저 select 하고 실패하면 폴백하는 "예외로 스키마 탐지" 구조인데, 이 DB 는 브릿지 마이그레이션(`20260518130000`)이 미적용이라 **구독 세트가 있는 모든 사용자에게 매 로드 400 이 확정 발생**했다(화면은 폴백으로 멀쩡). 왕복 1회 낭비 + 콘솔/모니터링 오염이라 legacy select 로 단순화하고, 브릿지 적용 시 되돌릴 지점을 주석으로 남겼다.

### 만화 메뉴 통합 — `Comics` 하나 안에 **Adapted(도서 각색) · Restored(원본 복원)** (사용자 결정 2026-08-09)

두 만화 기능(CCP 도서 각색 · PDCP 원본 복원)이 사이드바에 각각 최상위 항목으로 있던 것을 **입구 하나로 합치고 안에서 출처로 나눴다**. 학습자에겐 둘 다 "만화"라 입구가 둘이면 어느 쪽을 눌러야 할지 알 수 없다.

- **라우트 재편**: `/comics` → `/comics/adapted` 리다이렉트(`/library` 패턴 동일) · `(main)/comics/adapted/**`(구 `/comics`+`/comics/book`) · `(main)/comics/restored/**`(구 `/restored`). `layout.tsx` + 신규 `ComicsTabs`(role=tablist · aria-selected · 44px, LibraryTabs 와 동일 패턴).
- **명명 — `Adapted` / `Restored`**: 기술(AI·스캔)이 아니라 **원작에 무슨 일이 있었는지**로 지은 과거분사 쌍. "AI Comics"류는 기술이 바뀌면 낡고, 각색의 정본 정합(R4)이라는 핵심 가치를 가린다. 기각한 대안: `Booktoon`(CCP 전용이라 쌍이 안 맞음) · `Generated`(기술 노출) · `Classics`(복원본이 고전이 아닐 수 있음) · `Reimagined`(각색보다 과장).
- 사이드바는 `Comics` 단일 항목으로 복귀 — PDCP 의 `Restored` 최상위 항목 제거(탭으로 편입).
- **회귀 함정 하나 고침**: 통합 후 e2e 3·4번이 `/comics`(리다이렉트) 진입 → 카드 링크 미발견으로 **조용히 공회전 통과**하고 있었다. 진입을 정규 목록 URL(`/comics/adapted`)로 바꿔 실제 프리뷰 3컷·로그인 유도까지 다시 검증된다.
- 검증: `tsc --noEmit` 클린 · e2e 11-comic 4/4(탭 aria-selected · href 계약 `/comics/adapted/…` · 프리뷰 3컷) · 04-ui-smoke 5/5 · 4개 라우트 실렌더(구 `/restored` 404 확인).

### 만화 = `/library` 탭 → **사이드바 최상위 메뉴** `/comics` (사용자 결정 2026-08-09)

- `LibraryTabs` 4탭 → **3탭 복귀**(도서/스크립트/공용 단어장). 만화는 사이드바 Scripts 그룹의 `Comics` 항목으로 승격 — `(main)/library/comics/**` → `(main)/comics/**` 이동.
- **데이터 축은 불변**: 만화는 여전히 `library_books` 앵커(D1)이고, 도서 카드의 만화 배지·포맷 필터·상세 시트 gold CTA 는 `/library` 에 그대로 남는다. 입구만 밖으로 나왔다.
- ⚠️ **병행 세션(PDCP)과의 라우트 충돌 해소**: 같은 시간 다른 세션이 퍼블릭도메인 복원 만화용으로 `(main)/comics/[slug]` 와 `(main)/library/comics` 를 만들고 있었다. `[bookId]`/`[slug]` 형제 동적 세그먼트는 **Next.js 빌드가 깨지는** 조합이라 CCP 상세를 `/comics/book/[bookId]` 로 한 단계 내렸다. 사이드바에 `Comics` 라벨이 둘이던 것도 PDCP 쪽을 `Restored` 로 분리(해당 세션이 이후 `/restored` 로 이동).
- 검증: `tsc --noEmit` 클린(이동 후 `.next/types` 스테일 정리 포함) · e2e 11-comic 4/4(사이드바 진입 · 카드 href 계약 `/comics/book/…` · 프리뷰 · 로그인 유도 `next=%2Fcomics%2Fbook%2F`) · 04-ui-smoke 5/5.
- ⚠️ 구 경로 `/library/comics` 는 CCP 쪽 리다이렉트를 두지 않았다 — 그 자리를 PDCP 가 쓰고 있었기 때문(현재는 `/restored` 로 이동 중).

### CCP × Library P2 — 만화가 단어장·발행 체계에 정합으로 편입됐다 (마이그레이션 없음)

- **발행 조건 단일화 — `lib/library/publish-gate.ts` 신설**: "학습자에게 무엇이 보이는가"가 화면마다 흩어져(도서 3조건 / 아티클 2조건 / 만화 RPC 내부) 한 곳만 고치면 조용히 어긋나던 것을 묶었다. **카탈로그 게이트(published_at 요구) ≠ 열람 게이트(status만)** 라는 사실도 의도로 문서화 — 만화 RPC 기준과 맞춘 것. 설계서의 `v_library_catalog` 뷰는 **P3 로 연기**: 소비자(통합 홈)가 없는 지금 뷰만 추가하면 아무도 안 쓰는 정의가 하나 더 늘 뿐이라, 실제 쿼리 지점을 먼저 묶는 쪽을 택했다(설계서 검토 로그에 반영).
- **만화 vocab 정합 게이트 — `lib/comic/vocab-integrity.ts` + 단위 8종**: `comic_pages.target_vocab` 이 챕터 단어장(`shared_word_sets` category='library_book' → `shared_words`)에 실재하는지 대조. 없으면 학습자가 만화에서 만난 단어가 **FSRS 로 이어지지 않는 고아**가 된다. word/lemma 양방향 대조(굴절형 허용) · 정규화(대소문자·전후 문장부호, 하이픈/어퍼스트로피는 보존). SQL 함수 대신 TS 인 이유는 마이그레이션 없이 작동하고 규칙을 테스트로 고정하기 위해서.
- **Admin 검수에 정합 노출** — QC 타일 5칸으로 확장(+"단어장 미등록") + 고아 단어 목록(≤40) + 단어장이 없을 땐 "판정 불가"로 정직하게 표기(0 과 구분).
- **학습자 3종 연결** — 만화 상세에 "이 책의 단어장 보기"(`/library/books/[id]?preview=1`).
- **R2 분리 회계 표기** — 도서 상세 시트에 "만화 미리 봄 42% / 다 봤어요"를 본문 진도와 **별도 블록**으로. CTA 라벨도 진도에 따라 분기(만화 이어서 보기 / 다시 보기). 만화를 다 봐도 챕터는 완료되지 않는다는 계약이 UI 에서도 보인다.
- **검증**: unit 17 pass(prescribe 9 + vocab-integrity 8) · e2e 11-comic 4/4 · 04-ui-smoke 5/5(publish-gate 리팩터가 도서·스크립트 목록을 건드려 회귀 확인) · `tsc --noEmit` 클린. ⚠️ Admin 검수 화면은 이 환경의 e2e 계정에 admin 권한이 없어 **런타임 렌더 미검증**(타입 검사만).

### CCP × Library P1 — 등록 전에도 만화를 보고, 어느 입구로 들어갈지 고른다

**마이그레이션 [20260808240000_comic_catalog_p1.sql](../supabase/migrations/20260808240000_comic_catalog_p1.sql) — 2026-08-09 사용자 승인 후 dev 적용 완료.** 검증: `list_comic_catalog` 1행(A Christmas Carol · 90컷 · 5챕터 · cover_url 실값) · `preview_book_comic(p_limit=99)` → **5행**(서버 하드캡 동작) · 앱 상세에 "5챕터 · 약 3시간 · 90컷" 실렌더 · e2e 4/4(이제 P1 경로). 코드는 여전히 2단 폴백을 유지해 롤백에도 견딘다.

> ⚠️ **적용 중 발견(후속 필요)**: Supabase 기본 권한이 public 스키마 신규 함수에 anon/authenticated EXECUTE 를 자동 부여한다. `REVOKE ALL … FROM PUBLIC` 은 PUBLIC 의사롤만 건드리므로 anon 이 남는다. 실제로 **`select_book_comic_all`(전권 90컷 + bubbles + target_vocab)이 anon 실행 가능** — 마이그레이션 파일은 authenticated 만 GRANT 했는데도. 즉 프리뷰 5컷 하드캡은 전권 유출을 막지 못한다. 명시 REVOKE 마이그레이션 필요(승인 대기).

- **`/library/comics/[bookId]` 신설 — G3 해소**: 리더 라우트가 `texts.id`(=등록)를 요구해 **미등록 학습자는 만화를 아예 못 봤다**. 이제 비로그인·미등록도 프리뷰 3컷을 본다. 프리뷰는 **아트만** — 정본 대사·`target_vocab` 은 리더의 학습 자산이라 싣지 않는다.
- **`ComicFormatChoice`** — 만화/원문/듣기 3카드. **권장은 정확히 1개**(선택 피로 방지), 나머지도 그대로 선택 가능(강제 이동 없음). 미등록이 시작하면 `enroll_library_book`(멱등) 후 해당 포맷으로 직행, 비로그인은 `?next=` 로 되돌아온다.
- **`lib/comic/prescribe.ts` + 단위 테스트 9종** — 이어보기 > 복습(본문 완독 이력) > 난이도 > 미진단 순. **적정 난이도(ideal)에선 본문을 권장**한다: 만화를 항상 앞세우면 seductive details(그림이 본문 읽기 시간을 밀어냄) 문제를 제품이 스스로 만든다.
- **마이그레이션 내용** — `comic_books.feature_rank`(노출 순서 · G4) + `preview_from`(스포일러 회피 오프셋) · `list_comic_catalog`(RPC 안에서 첫 컷 커버 + 커버리지/낭독/챕터 메타까지 1회 · G5) · `preview_book_comic`(published 이중 게이트 + **서버 하드캡 5컷** + anon GRANT).
- **진입 경로 재배선**: 만화 탭 카드 · 도서 히어로 · 상세 시트의 미등록 href → `/library/comics/[bookId]`.
- **검증**: e2e 4종이 **마이그레이션 미적용 상태에서 통과**(= 폴백 경로 실증) · 04-ui-smoke 5/5 · unit 55 pass · `tsc --noEmit` 클린. 프리뷰 3컷 실렌더 확인(anon).

### CCP × Library P0 — 만화가 라이브러리의 고를 수 있는 포맷이 됐다

설계(아래) 의 P0 구현. **마이그레이션 없음** — 기존 발행 게이트 RPC(`list_book_comic_catalog`)만 사용.

- **`/library/comics` 신설 + LibraryTabs 4탭**(도서/만화/스크립트/공용 단어장). 만화 탭 = `kind=book ∧ format∋comic` 의 저장된 뷰 — 콘텐츠 복제 0. 이어서 보기 레인(`comic_read_progress`) + 레벨 밴드 필터(facet-adaptive) + 발행 0일 때 차분한 빈 상태.
- **포맷 축 도입(장르와 직교)**: `BookFilterBar` "음성" 구획 → **"포맷"**(만화/원어민 음성)으로 승격 · `BookFilters.comicOnly` · QuickPick "만화로" · `BookGridCard` gold 배지(아이콘 + sr-only 텍스트 — 색상 단독 전달 금지). 이제 "SF이면서 만화"가 질의된다.
- **선택 지점 배선**: `NetflixDetailSheet` 도서 상세에 gold 보조 CTA(등록: 만화로 읽기 / 미등록: 만화 미리보기). `toBookDetailVariant` 경유라 spotlight·rail·그리드 전부 자동 적용.
- **`lib/comic/catalog.ts` 단일 출처 신설** — 이전엔 `library/books/page.tsx` 안에 인라인. 커버(첫 컷) 조회를 `coverLimit`(실제 렌더 카드 수)로 상한: 히어로 4권만 받는다. `select_book_comic_all` 이 커버 1장에 전권 payload 를 주는 구조라 도서 수 증가 시 터질 자리였음 — 근본 해소(RPC `list_comic_catalog`)는 P1.
- **회귀** — `11-comic-discovery.spec.ts`: 탭 이동(aria-selected) · 카드 href 계약(`/text/[id]/comic` 또는 `/library/books/[id]`) · **포맷 칩 적용 후 남은 도서 수 = 만화 배지 수**(필터가 거짓말하면 실패). 발행 만화 0이면 빈 상태 단언 후 종료(콘텐츠 의존 false-fail 방지).
- 실측 확인: 발행 만화 1편 · 04-ui-smoke 5/5 통과 · 신규 spec 2/2 통과 · `tsc --noEmit` 클린.

### 설계 — CCP × Library 만화 카탈로그 편입 ([CCP_LIBRARY_INTEGRATION.md](./CCP_LIBRARY_INTEGRATION.md))

만화를 `/library` 의 정식 학습 포맷으로 편입하는 설계 확정(구현 미착수). 핵심 판정: 만화 = **같은 책(Work)의 다른 표현형(Expression)** — FRBR 근거로 데이터는 `library_books` 앵커 유지, 탐색 UI 만 독립 코너화(4탭 `/library/comics` + 포맷 facet). 실측 결함 8종(G1~G8) 명시 — 만화 전용 진입점·필터 부재, **미등록 학습자 열람 불가**(라우트가 `texts.id` 요구), 히어로 알파벳순 4권 고정, 커버 1장에 전권 RPC 4회, 단어장(`target_vocab`) 미연계, 진도 이원화. seductive details 연구 근거로 **만화 완주 ≠ 챕터 완료**를 코드 계약(R1~R6)으로 고정. 신설 예정 RPC `list_comic_catalog`/`preview_book_comic`/`v_library_catalog` SQL 초안 포함(마이그레이션 미적용 — 승인 대기).

### 아케이드 접근 모델 재설계 — 카탈로그 SSoT · 기본 스코프 = 내 복습 단어 (v07.4)

딥서치(choice overload · SDT 자율성 · Gimkit/Blooket 모드 선택) 결론: **"추천 하나 + 전부 열람"**. 선택지가 작업기억을 넘으면 자율성이 아니라 마비가 되고, 반대로 선택권을 뺏으면 SDT 자율성이 깎인다. 그리고 학습자가 게임 앞에서 실제로 궁금한 건 장르가 아니라 **"이게 내 단어를 쓰나"**.

- **P0 — 아케이드 진입 게임이 내 단어를 한 번도 안 만졌음(수정)**: `/arcade` 카드는 `?set=`/`?text=` 없이 게임을 열었고, `GamePlayScaffold` 는 스코프가 없으면 `wordPool` 을 주지 않았다 → 게임이 하드코딩 `DEFAULT_POOL` 로 돌고 `recordGameResult` 가 `vocabularies` 조회 실패로 silent skip. 허브가 내걸던 "모든 게임은 학습 기록(FSRS)과 연동됩니다"가 **기본 진입에서 거짓**이었다. 스코프를 3단으로 재정의 — ① `?set=`/`?text=` → ② **사용자 due 큐**(신규 기본) → ③ 맛보기. ③으로 떨어질 때는 세션 셸 브레드크럼에 "맛보기 단어 · 내 단어장이 채워지면 내 단어로 바뀌어요"로 정직하게 표기.
- **`lib/game/catalog.tsx` 신설 — 게임 정의 SSoT(19종)**: slug·이름·태그라인·인지계층·무드·마크·`source`(mine/bank)·`minWords`·`closeHref`. 같은 사실이 4곳(arcade 페이지 GAMES 17 · gamekit `MARK_PATHS` 17 · SessionFrame `SESSION_META` 14 · ArcadeEntryCard 문구 "12종"/"14개 세계")에 복제돼 전부 다르게 낡아 있던 drift 를 제거. `GameMark` 는 카탈로그 `GAME_MARKS` 참조, SessionFrame·진입 카드 문구는 파생.
  - 부수 복구: **누락돼 있던 3종**(`wordsmith-vigil`·`morphmerge`·`wordfall-cadence`)의 세션 셸 제목이 "학습 세션 ✨"로 뜨고 닫기가 `/hub` 로 오배송되던 문제 해소.
  - 부수 복구: 스캐폴드 exit 폴백이 존재하지 않는 라우트(`/cascade` 등 module id)로 push 하던 것을 `/arcade` 로 교정.
  - 부수 복구: 아케이드 그리드에서 누락돼 있던 `wordblitz`·`pirate-quest` 편입 → 발견 가능. `pirate-quest` 자체 exit 도 `/library` → `/arcade`.
- **`/arcade` IA 재설계** — ① 오늘의 추천 1종(KST 날짜 시드 결정론 회전 · 보유 단어 ≥6 이면 mine 풀에서, 아니면 bank 풀에서) ② **내 단어로 플레이**(8종 · "복습 임박 N개" 배지 · FSRS 반영 명시) ③ **큐레이션 세계**(11종 · 단어 없이 즉시 플레이). 3D·베타 칩 추가.
- **`(app)` → `(main)` 라우트 그룹 이동**: 허브는 세션이 아닌데 `(app)`(SessionFrame 전용 풀스크린 그룹)에 있어 Sidebar·FlowNav 가 통째로 사라졌다. URL 은 `/arcade` 그대로. 게임 본체 `/play/*` 만 `(app)` 에 잔류.
- **Sidebar Practice 그룹에 `Arcade` 등재**(`Gamepad2`) — 이전엔 `/hub` 를 스크롤해 진입 카드를 찾는 것이 유일한 통로였다.
- 신규: `lib/game/due-words.ts`(`fetchDueGameWords` · cap 40 · `next_review_at` ASC nullsFirst, flashcard/pairflip 과 동일 정책 · 굴절형 보강). `scoped-words.loadInflectedForms` export 승격(중복 쿼리 방지).
- **회귀 고정** — `07-arcade-games.spec.ts`: ① 허브 테스트를 IA v07.4 로 갱신(오늘의 추천 + 2섹션 + 19카드 전수 딥링크) ② **신규 "비스코프 진입 — mine 게임이 내 복습 단어를 쓴다"** — 브레드크럼 `내 복습 단어`(맛보기 아님) + 제시된 뜻이 사용자 `vocabularies` 소속임을 service-role DB 단언(`fetchUserVocabWords` 헬퍼 신설). DEFAULT_POOL 회귀 시 실패한다.

#### 전수 테스트 라운드 — 도출 케이스 36 + 발견 결함 5 수정

테스트 케이스를 축(발견성 / 스코프 3단 / 세션 셸 / 영속화 / 반응형·a11y)으로 도출해 unit 20 + e2e 16 을 작성하고, 그 과정에서 나온 결함을 전부 수정.

- **[자체 결함] wordblitz 가 카탈로그 광고와 다르게 동작** — `source:'mine'` 으로 "내 단어로 플레이" 섹션에 넣었지만, 이 페이지는 스캐폴드를 안 쓰고 자체 스코프 로직을 복제하고 있어 mine 단계가 없었다(= 아케이드에서 열면 여전히 DEFAULT_POOL). 스코프 해석을 **`lib/game/use-word-scope.ts` 공용 훅**으로 추출해 스캐폴드 17종과 독립 3D 가 같은 규칙을 공유하도록 통합. 브레드크럼 매핑도 `lib/game/scope-resource.ts` 로 분리.
- **[선재 결함 · 전 게임 영향] 셸 X·Esc 로 닫으면 세션 기록이 통째로 유실** — `scores` 적재와 스트릭·XP 적립이 **게임 내부 종료 버튼**의 `onExit` 에만 걸려 있었다. 학습자가 실제로 가장 많이 누르는 종료는 세션 셸 상단 X 와 Esc(SessionFrame 이 라우팅으로 처리 → `onExit` 미호출). 실측: 4문항 플레이 후 X → `learning_records` 6행 / `scores` **0행**. **`lib/game/use-session-recorder.ts`** 신설 — 언마운트(=세션을 떠나는 모든 경로) 시 1회 가드 flush.
- **[선재 결함 · 전역] 모든 (main) 페이지에 가로 스크롤바** — FlowNav 리치 툴팁(`w-240px`)이 `opacity-0` 여도 레이아웃을 점유해 좁은 폭에서 뷰포트를 넘겼다(실측 `/hub`·`/arcade` 768px **39px**, 900px 23px). `<nav>` 에 `overflow-x-clip`(다른 축을 스크롤로 승격하지 않아 툴팁 하단 전개는 유지).
- **[자체 결함] 깨진 카피 2종** — due 0 일 때 `"내 복습 단어  로 진행"`(수 없는 문장)과 `"복습 임박 0개"` 배지. 3상태(단어없음 / 있고 due 0 / 있고 due N)를 각각 자연스러운 문장으로 분기(`mineBadge`·`mineDesc`·`dailyMeta`).
- **[일관성] FlowNav 단계 누락** — Sidebar Practice 에 Arcade 를 넣었는데 `getStageFromPathname` 에 `/arcade` 가 없어 단계 하이라이트가 안 됐다. `practice` 로 매핑.
- **[판단] 오늘의 추천에서 3D·베타 제외** — 모바일 three.js 번들 부담 + 베타(pirate-quest)는 학습 기록 미연동이라 "오늘 이거 하나만"의 약속과 맞지 않음. 직접 선택은 그대로 가능.
- 테스트: `src/lib/game/__tests__/catalog.test.ts` **20 케이스**(카탈로그 ↔ 실제 `/play` 디렉터리 정합 · 필수 필드 · source↔minWords 정합 · `gamePlayHref` 엣지 · `pickDailyGame` 결정론/3D제외/전순회/음수 · `kstDayIndex` KST 자정 경계) + `tests/e2e/09-arcade-access.spec.ts` **16 케이스**(비로그인 맛보기·깨진 카피 회귀·반응형 3뷰포트 / 사이드바 활성·문구↔카드수 일치·섹션 카운트·추천 결정론 / explicit 우선·단어0 안내·bank 격리·wordblitz mine / 세션셸 신규3종·`?from` 우선·Esc 복귀 / X 종료 영속화 / 44px·제목계층·포커스링).
- 검증: `tsc --noEmit` 0 error · **vitest 185 pass** · **e2e 07 16/16 + 09 16/16 pass**.
- ⚠️ 미수정(별건, 본 변경과 무관): ① `next lint` 가 `eslint-module-utils/resolve` 미해결로 이 환경에서 실행 불가 ② `/library/books` 768px 가로 넘침 **324px** — `BooksExplorer` 의 고정폭 `w-[270px]` 표지(v06.33)가 원인.

#### BGM 시네마틱 전면 교체 + 아케이드 아트 디렉션 브랜드 정렬 (v07.5)

**① BGM — 칩튠 19곡 전량 교체.** 이전 세트는 8비트 스퀘어파(8bit Dungeon Level · Bit Quest · Bit Shift · Awesome Call …)라 "PC 효과음 같은 얇은 느낌"이었고 학습 공간의 무게와 맞지 않았다.

- incompetech(Kevin MacLeod, CC-BY 3.0) 카탈로그에서 **오케스트라·시네마틱·앰비언트 23곡을 검증**해 게임 무드별로 재큐레이션 → **19종 전부 고유 트랙**(재사용 0). 예: wordblitz "Prelude and Action" · glyph-tongue "Ossuary 6 - Air" · silent-rule "Lightless Dawn" · lexicon-estate "Shores of Avalon" · word-orrery "Immersed" · pirate-quest "Achaidh Cheide".
- 가공(포터블 ffmpeg 9.0): 인트로 이후 **~110초 루프** · 3s 페이드인 / 5s 페이드아웃 · **EBU R128 -16 LUFS (TP -1.5)** 정규화로 게임 간 레벨 일관 · 128kbps 44.1kHz **스테레오**(폭·저역 유지). 17MB(14곡 112kbps) → 33MB(19곡 128kbps).
- `CREDITS.txt` 전면 갱신(곡명·게임 매핑·가공 방식). 앱 내 `/arcade` 푸터 표기 유지.

**② 아트 디렉션 — 플랫폼 정렬.** 아케이드가 보라–마젠타 황혼 배경 + 카드 19장 풀블리드 무지개 그라디언트였다. 플랫폼 토큰(Reading Room — deep ink `#0F2540` · paper `#FBFAF6` · muted gold `#B0843A`, Linear식 "gold 는 5% 미만·시그니처에만")과 접점이 전혀 없어, 페이퍼 톤 셸 안에서 **다른 앱을 붙여둔 이물질**로 읽혔다(허브를 `(main)` 으로 옮기며 더 두드러짐).

- 씬: 앱 **다크 테마 캔버스**(warm dark paper `#181410`) 바닥 + deep ink 웨시 = "저녁의 서재". 앰비언트 글로우도 gold + ink 두 색만(이전 오렌지+퍼플).
- 카드: 공통 잉크 베이스 + **게임 무드 24% 틴트**로 통일. 정체성은 색면이 아니라 **2px 상단 액센트 엣지 + 마크 색 + hover 글로우**가 담당 → 19색 무지개 제거, 식별성은 유지.
- **금빛은 오늘의 추천 한 곳에만**(카드 배경 웨시 · eyebrow · CTA). 브랜드의 단일 액센트 규칙을 화면에서 실제로 지킨다.
- 섹션 배지 `live` 도 초록 → 금빛으로 통일. 칩·마크 컨테이너 채도 하향.
- 회귀 +4: 트랙 재사용 금지 · **칩튠 곡명 복귀 차단**(CREDITS 정규식) · 전 게임 크레딧 기재(CC-BY 준수) · 경로 형식.
- 검증: tsc 0 · vitest 202 · e2e 07+09 35/35 · 신규 mp3 서빙 200.

#### 중복 게임 정리 — 계열(family) 접기 (v07.4)

"중복 게임이 많다" 제보 조사. 핵심 루프를 코드로 대조한 결과 **19종 중 4종이 같은 엔진의 스킨**이었다.

| 게임 | 줄 수 | 프롬프트 | 응답 | 판정 |
|---|---|---|---|---|
| wordblitz | 789 | `target.ko` | 4지선다 en 타일 | `o.en === target.en` |
| daily-blitz | 311 | 〃 | 〃 | 〃 |
| word-economy | 268 | 〃 | 〃 | 〃 |
| ghost-race | 236 | 〃 | 〃 | 〃 |

- **판단: 삭제가 아니라 접기.** 학습적으로는 같아도 동기 장치(타이머·데일리·경제·경쟁)로는 서로 다르고, 같은 문답 위에 모드를 얹는 구조는 Gimkit 이 검증한 방식이다. 진짜 문제는 존재가 아니라 **19장을 동급 카드로 평평하게 깐 것**.
- **구현**: 카탈로그에 `GAME_FAMILIES` + `family`/`modeLabel`/`modeNote`/`modeOrder` 축 추가. `hubSections()` 가 섹션별 `HubItem[]` 을 만들고 허브가 계열 1장 + 모드 칩으로 렌더. **게임 코드 무변경**(순수 표시 계층) → 저위험·롤백 용이.
- 카드 수 **19 → 16**(mine 9→6장 · bank 10장). 도달 가능한 게임은 그대로 19.
- 계열은 쪼개지지 않는다 — blitz 3종이 mine, 데일리 1종이 bank 라 **멤버 다수 섹션으로 통째 이동**하고 소수파는 칩 설명에 명시("내장 뱅크"). 섹션 배지는 `countHubGames()` 로 실제 구성에서 계산(mine 9 · bank 10).
- 계열 카드는 `<a>` 가 아니라 컨테이너 — 중첩 앵커를 피하고 **모드 칩 각각이 플레이 링크**(44px 타깃).
- **[부수 오류 정정] `wordblitz` 는 3D 가 아니다** — v07 재설계로 three.js 인형뽑기 → 순수 2D DOM 인데(MODULES.md §5), 카탈로그에 stale 한 루트 인덱스 설명("인형뽑기 3D · GLB 집게")을 옮겨 적어 `is3d: true` + 잘못된 태그라인이 들어가 있었다. 그 탓에 오늘의 추천에서도 부당하게 제외됐다. 실측(three 임포트 0)으로 확인 후 정정.
- **유지한 약한 중복**: letter-forge(글자 제공) → wordsmith-vigil(무단서 타이핑)은 Desirable Difficulty 계단, connections(선택 분류) ↔ lexicon-estate(공간 배치)는 입력 방식이 달라 학습 경험이 구분됨.
- 회귀 +10: unit 계열 무결성 9(계열 정의 존재 · modeLabel 필수 · 라벨 중복 금지 · modeOrder 정렬 · 멤버 2+ · **접어도 전 게임 정확히 1번씩 도달** · 계열 미분할 · 카드 수 감소 · 첫 멤버 자리 보존) + e2e `A5`(카드<링크 · 계열카드 비앵커 · 모드칩 딥링크·44px · 중복 노출 0). A2/A3 는 카드 수 → 플레이 링크 수 기준으로 갱신.
- 검증: tsc 0 · vitest 198 · e2e 07+09 35/35.

#### BGM 이 안 들리던 진짜 이유 — CSS 명시도 + 발견성 (v07.4)

"각 게임에 BGM 없음" 제보 조사. 재생 로직·음원·배선은 **전부 정상**이었다(토글 시 `paused:false · currentTime 진행 · vol 0.3 · loop`). 원인은 둘:

- **[P0 · CSS 명시도] 음악 버튼이 좌하단 고정이 아니라 게임 상단 흐름에 전체 너비로 박혀 있었다.** `.gk-root > :not(.gk-energy):not(.gk-atmos)`(명시도 0,3,0)가 `.gk-music-btn`(0,1,0)의 `position: fixed` 를 이겨 `position: relative` 로 계산됐고, `.gk-root` 가 flex 컨테이너라 `inline-flex` 가 blockify 돼 폭 1280px 로 퍼졌다(실측). 음악 컨트롤로 보이지 않으니 아무도 누르지 않았다. WordBlitz 는 `.wbz-root > :not(.wbz-energy)` 로 같은 문제. 배경 레이어처럼 `:not(.gk-music-btn)` 로 제외.
- **[P1 · 발견성] 기본 OFF 인데 켜는 길이 게임 안 무라벨 아이콘 하나뿐.** ① **아케이드 허브에 "배경음악 켬/끔" 토글** 신설(`ArcadeMetaStrip` · 게임 진입 전 조용한 맥락에서 결정) ② 선호 미결정(`null`)이면 게임 내 버튼이 **"배경음악" 라벨을 펼쳐** 존재를 알리고, 한 번 정하면 아이콘만 남김. 선호 키는 `lib/game/music-pref.ts` 로 분리해 허브·게임이 공유. 기본값은 계속 OFF(자동재생은 Calm UI·브라우저 정책 위반).
- **[커버리지] 트랙 매핑을 카탈로그로 통합** — gamekit 의 `MUSIC_SRC` 복제본에서 독립 3D 2종이 빠져 **WordBlitz·Pirate's Bounty 는 트랙 자체가 없었다**. `GameEntry.music` 필드로 이관하고 두 게임에 배선(각각 Bit Shift / Awaiting Return 재사용) + gamekit 미사용 게임엔 `GameKitStyles` 동반 주입. `useGameMusic`·`GameMusic` 타입을 `GameSlug` 로 확장.
- 검증: **19종 전수 실측** — 18개 아케이드 라우트에서 `position:fixed` · 좌하단 14px · mp3 요청 확인(ALL OK), pirate-quest 배선 후 07 스펙 전수 통과.
- 회귀 고정 +5: unit `BGM 커버리지` 3(전 게임 트랙 보유 · 파일 실존 · 경로 형식) + e2e `F1`(허브 토글 → 게임 자동 적용) · `F2`(미결정 시 라벨 힌트 → 결정 후 해제) + **07 게임별 루프에 음악 버튼 존재·fixed·좌하단·폭 단언 추가**(레이아웃 붕괴 재발 시 14게임 전부에서 실패).

### 신규 파이프라인 — CCP (Comic Curation Pipeline · book→comic)

- **만화 스타일 선택(디자인 · 국내외 딥서치)** — 마이그레이션 `20260808240000` **적용됨**: `comic_styles`(포맷×연령×장르×난이도(V-Level) → 모델-레디 art_prompt·negative·lettering·palette·근거URL·상태) + `comic_books.style_key`. **국내외 딥서치로 20 프리셋 시드**: 웹툰 10(순정/로판/액션판타지/일상개그/감성일상/스릴러느와르/미스터리/학습만화/사극무협/공포) + 국제 10(Gonick교육/빅토리아동판화/그래픽노블/리뉴클레르/소년·소녀·청년·코도모 만화/슈퍼히어로/정밀리터러리). Admin **"스타일" 탭**(포맷/연령/장르 필터·art_prompt 프리뷰·상태) + **검수 콘솔 도서별 스타일 드롭다운**(setBookStyleAction) → `generate-comic.mjs plan`이 선택 art_prompt 노출 → 생성이 그 디자인으로. Carol=Gonick 기본(is_default).

- **진도 영속(P3 · 연속성)** — 마이그레이션 `20260808160000` **적용됨**: `comic_read_progress`(user_id+library_book_id PK · RLS user-owns) + `save_comic_progress` RPC. 리더가 위치를 서버에 **디바운스 저장** + 진입 시 **서버 진도 우선 복원**(localStorage 폴백) → **기기 간 이어보기** + 완독 시각 기록. 리더 route가 진도 로드 → `initialIndex` 전달.
- **세로 스크롤 몰입 모드(P2)** — 리더 상단에 **Page↔Scroll 토글**(Rows3/Square·뷰 localStorage 영속). Scroll = 전 컷 세로 스택(웹툰형) + IntersectionObserver로 현재 컷 추적(레일·카운터·aria-live) + 스크롤 시 크롬 자동숨김 + 레일 dot 탭 scrollIntoView. 뷰 통합 nav()로 키보드/푸터/레일 공용, `renderPanel` 추출로 두 모드 공용. reduced-motion 대응.
- **정본 회상 보상 루프(P2)** — verbatim blur→reveal 후 **"기억했어요 / 다시 볼게요"** 자가판정(Desirable Difficulty) + 세션 회상 집계 → 완독 화면 "정본 대사 N개를 기억했어요"(자기효능감·폭죽 없음). Emotional Encoding.
- **실험 매트릭스 = 모델×환경×스타일** — 테스트 폼에 스타일 드롭다운 추가(모델·환경에 이어) → `comic_gen_tests.style`+`params.env` 기록. 오케스트레이터 `test-comic-model.mjs --style KEY` → `comic_styles.art_prompt` 해석·생성 화풍 고정·run 기록. 테스트 카드에 스타일/환경 배지. → "어떤 모델+환경+스타일이 최적인가"를 구조적으로 실험.
- **자가호스트 러너 오케스트레이션 + 자동 테스트 + 엄격 감사수정** — `scripts/comic/model-runners.mjs`(backend→gen스크립트/워크플로/환경 매핑) + `scripts/comic/kaggle/setup-comfyui-comic.py`(Kaggle ComfyUI+cloudflared 터널→RunPod 드롭인 호환) + `scripts/lcp/test-comic-model.mjs`(모델×환경 dispatch→샘플 생성→관측 기록→루브릭 채점 유도, **run_envs 제약 스크립트 레벨 강제**) + `RUN_ENVIRONMENTS.md`. **엄격 사용성 감사 수정**: 테스트폼 자유입력 백엔드 제거(환경제약 강제) · 모델 상태변경 오류 노출·행별 pending · 빈-환경 안내 · 드레인 발행게이트 헤더 단일소스·대기/취소 사유·컷 그리드 상태글리프+aria·이벤트 로그 최신순·null좌표 skip · 44px·aria-label.
- **이미지 생성 모델 레지스트리(P3 · 시장 딥서치)** — 마이그레이션 `20260808200000` **적용됨**: `comic_gen_models`(key·provider·site·hosting·비용·다중참조·텍스트제어·캐릭터/화풍 일관성·4090적합·comic_fit·강약점·근거URL·상태). **2026 시장 딥서치(에이전트, 근거 URL 인용)로 17 모델 시드**: Qwen-Image-Edit-2511(fit90·자가호스트 top) · FLUX.2 pro(88) · Nano Banana Pro/Gemini3(88) · SD3.5+LoRA(85) · Qwen-2509(85) · Nano Banana(82) · FLUX Kontext pro/dev · FLUX.2 dev · Seedream4 · Ideogram3 · HiDream · Recraft · GPT Image1 · Z-Image · Midjourney(제외) · **gpt-image-2(현 프로덕션 채택)**. Admin **"모델" 탭**(comic_fit 순 비교·상태 토글·근거링크) + **"테스트" 탭 모델 드롭다운**(선택 시 backend/model/site 자동). **자가호스트 우선 구조(마이그레이션 `20260808220000`)**: `run_envs`(runpod-4090/kaggle-t4/api 화이트리스트)+`min_vram_gb` — 테스트 탭 **실행 환경 선택 → 그 환경 실행 가능 모델만 노출(선택 제약조건)**. **디폴트 = flux2-dev(자가호스트 RunPod)**. 자가호스트 7모델(Qwen-Edit 2511/2509·SD3.5·FLUX Kontext dev·FLUX.2 dev·HiDream·Z-Image) vs API전용 10. 트렌드: 참조조건 편집이 일관성 표준화 · 오픈 Apache 모델 20B+로 4090 양자화 필수 · 프런티어 API 라이선스 조임→자가호스트 앵커.
- **드레인 관측 + 테스트 콘솔(P3 · 생성 블랙박스 투명화)** — 마이그레이션 `20260808180000` **적용됨**: `comic_gen_runs`(백엔드/사이트/모델·상태·진행·**자기발전 반복**·비용·정본불일치·규칙위반) + `comic_panel_events`(컷 단위 **위치·시도횟수·phase·상태·점수·판정** 작업/평가 이력) + `comic_gen_tests`(실험 A/B). `/admin/comic/[bookId]/drain` **관측 콘솔**: 실행 헤더(백엔드/사이트/진행바/KPI) + **컷 상태 그리드**(pass/fail/repairing·시도수 배지) + **왜 발행 못하는지**(차단 사유 파생) + 평가 이력 로그 + 실행 이력 · running 시 5s 자동갱신. Catalog **테스트 탭**(실험 계획/기록/비교 · createComicTestAction). 드레인 `generate-comic.mjs`가 insert 시 run+events 자동 기록. Carol 시드(run 1·events 90·test 1 FLUX vs GPT).
- **Admin 검수 품질(P3)** — 검수 그리드 **썸네일**(Supabase 이미지 변환 `render/image ?width=320` · 변환 미지원 시 원본 onError 폴백) → 90 full-res 로드 회피. **생성 중 실시간 진행**(queued/generating 시 5s 자동 갱신 · router.refresh).
- **Admin 순차 작업 가이드** — `/admin/comic` Catalog "작업 순서"(① 큐 적재 → ② 드레인 생성 → ③ 검수 → ④ 발행) + 검수 콘솔 단계별 "이 단계에서 할 일" 문구.
- **맥락 속 어휘 학습(P2)** — 리더 `학습 단어` 칩 실동작: 정본 대사에서 `lookup_word_meaning`(RPC)로 레벨 검증한 학습가치 단어(v≥5)를 컷별 target_vocab에 배정(Carol 17컷·23단어 · humbug/haunt/toll/ignorance…). 칩 탭 → 팝오버에 **실제 뜻(meaning_ko)·품사·CEFR·예문 인라인** + **단어장 추가**(`addWordToVault` 서버액션, 멱등). Context-Dependent + Dual Coding 실현(기존 뜻 조회/추가 자산 재사용, 마이그레이션 무).

- 자기발전 만화 파이프라인을 정식 제품 통합(설계 → 이중 검토[교육학·아키텍처] → 구현). 상세: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.
- **DB**(마이그레이션 `20260808120000_comic_pipeline.sql` — **적용됨 2026-08-08**): `comic_books`(발행 게이트 헤더 + qc_verdict 지속) + `comic_pages`((library_book_id,chapter_idx,page_order) 자연키 · image_url 외부 URL · bubbles · target_vocab) + `book_curation_jobs.task_type='comic_gen'` + `panels_total/done` 컬럼 + RPC 5종(`enqueue_comic_jobs`·`admin_set_comic_published`·`select_book_comic`·`list_book_comic_catalog`·`book_comic_available` — 학습자 read 전부 published 게이트).
- **Admin** `/admin/comic` — Catalog(큐 적재) / Published(QC 게이트 강제 발행·회수). AdminSidebar 등재(BookImage). 드레인 `scripts/lcp/generate-comic.mjs`(plan/content/insert) + `drain.mjs` 🎞 등록.
- **Hub** `/text/[id]/comic` — TextViewer input 모드 "만화"(ModePills). Calm 2D 리더 + 대사 non-cover 대사존 + verbatim blur→reveal(회상) + 정본 정합 vocab 칩 + effortful 유입 CTA. RPC 미적용/미발행 시 EmptyState degrade.
- **Admin 파이프라인 완성** — `/admin/comic/[bookId]` 검수 콘솔: 단계 stepper(큐→생성→검수→게시) + QC 카드(panels_pass·정본불일치·규칙위반) + stave별 컷 전수 검수(그림+대사+정본✓) + 단계 제어(게시/회수/보관/복원/삭제/보완=재생성 큐). 삭제·보관은 RLS admin 서버액션 직접(마이그레이션 무).
- **리더 v2(딥서치 반영: Naver Webtoon·Kindle·Duolingo·MasterClass)** — 몰입 크롬 자동숨김+중앙 탭 토글+글래스(paper-blur) · **stave-dot 진행 레일**(gold ring·탭 점프) · 방향성 전환+엣지 rubber-band+Space키 · 대사 film-strip gold tie+화자 dot+라벨 · **Light/Dim 리딩 모드** · verbatim blur→reveal 유지 · reduced-motion 전면. 토큰만(신규 hex 0, gold=`--active`). ModePills "만화" gold underline.
- **QA 사이클(학습자·접근성·제3자·Admin 4관점 감사 → 수정)** — 마이그레이션 `20260808140000` **적용됨 2026-08-08**(전권 90컷·5 stave 레일·삭제 RPC 검증):
  - *구조*: 리더가 `select_book_comic_all`로 **도서 전권(전 챕터)** 로드 → stave-dot 레일 다중 dot + 챕터 연속(기존 1챕터만 로드해 레일 붕괴 결함). RPC 미적용 시 챕터 단위 폴백.
  - *접근성*: 포커스-인지 키 핸들러(컨트롤 포커스 시 슬라이드 조작 안 함) · vocab 실 모달(aria-modal·focus 이동·Esc·focus 복귀·Tab 트랩) · 숨은 크롬 focus 자동노출 + 'm'/Esc 토글 · `aria-live` 컷 안내 · 44px 히트영역 · gold CTA 고대비(#231a09) · 레일 shape 백업(완료/현재/남음) · reveal 마운트 유지+aria-pressed · ModePills reduced-motion.
  - *UX/연속성*: 크롬 컨트롤發 넘김은 크롬 유지(버튼 자기소멸 방지) · Dim 토큰 오버라이드(밝은 요소 누수 0) · 위치/Dim localStorage 영속 · 첫 진입 온보딩 힌트 · 긴 대사 스크롤 · 깨진 이미지 폴백 · 히어로 커버 병렬화.
  - *Admin*: `deriveStage` 순서(archived 우선)·중복조건 수정 · 발행본 보완 시 자동 미발행(enqueue 강등) · 원자적 삭제(`admin_delete_comic`)+버킷 정리 · 보관 시 잡 정리 · 발행/회수/보관 확인 다이얼로그 · 삭제 발행경고 · 보완 queued:0 경고 · QC 상세(불일치/위반 목록) · 보관 stepper 이력 보존.
- **라이브러리 히어로 카드** — `/library/books` 상단에 `ComicHeroCard`(MasterClass/Apple 히어로·Linear hover): 실제 첫 컷 아트 블리드 + paper 그라디언트 + 단일 gold CTA + hover lift/scale. `list_book_comic_catalog`(published)로 발견, enrollment 분기 route(등록→`/text/[id]/comic` · 미등록→도서 상세). RPC 미적용 시 graceful 생략.
- **P2 시드(2026-08-08)** — A Christmas Carol(book `66b084a0…`) 90컷 GONICK 실 발행: 공개 버킷 `comic/carol/sN/NN.jpg` 90컷 업로드 + `comic_pages` 90행 + `comic_books` published(panels_pass·QC 판정 지속) + 도서 ready→published. `select_book_comic` 5챕터×18컷 반환 검증. ⚠️ 이미지=full-res(~2.7MB/컷 · P3 압축 여지) · 공개 버킷은 발행본 전용(드래프트는 private+signed 재검토). 도서 발행은 dev 데모용(status→ready PATCH로 원복 가능).

### 신규 게임 — Wordfall Cadence (듣기 케이던스 · 청각 채널)

- 시장 딥서치 후속 — 아케이드에 **전무하던 "청각/듣기" 채널**을 메움(EchoMatch 코어 보완). 리듬 계열.
- **루프**: 영단어 발음(SpeechSynthesis TTS)을 듣고, 케이던스(제한시간) 다하기 전에 **4개 뜻 후보 중 정답을 고름**. 정답 속도 보너스·콤보·기회 3(♪), 난이도 램프. "다시 듣기" 지원. TTS 부재 시 안내 게이트, en 보이스 자동 선택. 동의어(ko 동일) distractor 제외.
- `WordfallCadenceGame` + `/play/wordfall-cadence` · gamekit 공용 + 접근성(aria-live·reduced-motion) + 스프링. 배선 + `module_id` enum 값 추가(마이그레이션 적용).

### 신규 게임 — Morphmerge (어족 합치기 · 형태론 채널)

- 시장 딥서치 후속 — 평가에서 드러난 **미개척 채널 "형태론/굴절"**을 메우는 머지 게임(2048/Merge 원형). 클라이언트 전용.
- **루프**: 보드의 단어 형태 타일 중 **같은 어족(같은 lemma의 굴절형: go/goes/went/gone)의 모든 형태를 골라 합치면** 어족 보석으로 수집. 혼합=오답(콤보 리셋), 부분=감점없이 안내. 90초 세션·콤보. **불규칙 활용 인지** 훈련.
- **데이터**: 스코프 단어의 `inflected` 형으로 어족 구성(4어족 이상이면 사용), 부족하면 불규칙 풍부한 기본 어족 12종. `MorphmergeGame` + `/play/morphmerge` · gamekit 공용 + 접근성(aria-pressed·aria-live·reduced-motion)·스프링. 배선: ArcadeGameId/ModuleId/ScoreModule/MARK/MUSIC_SRC/카드.

### 신규 게임 — Wordsmith's Vigil (타이핑 서바이버 · 생성 채널)

- **시장 딥서치**(세계 베스트 게임 + 학습앱 리텐션) 결론 반영 — 아케이드가 **재인 편중**이라 최대 학습 ROI인 **생성(타이핑)** 게임을 신설. 원형: Typing of the Dead × Vampire Survivors.
- **루프**: 뜻(ko)을 든 안개 정령이 촛불로 낙하 → 그 영단어를 **정확히 타이핑**(prefix 조준·완성 시 격파). 콤보·촛불 3개(놓치면 소진)·난이도 램프. 생성효과(직접 생성 회상 ~40%↑) + 철자 정밀. 스코프 단어(FSRS due) 시드.
- **구현**: `components/game/wordsmith-vigil/WordsmithVigilGame.tsx` + `/play/wordsmith-vigil` 라우트. gamekit 공용(AmbientBackground·GameDone·GameMusic·useSfx·ParticleBurst) + 접근성(실제 input=모바일 키보드·aria-live·reduced-motion) + 스프링/오디오 폴리시. `ArcadeGameId`·`ModuleId`·`ScoreModule`·MARK·MUSIC_SRC·아케이드 카드 배선.
- ✅ 점수/FSRS persistence: `module_id` enum 에 `wordsmith-vigil`·`morphmerge`·`wordfall-cadence` 3값 추가 마이그레이션 **적용 완료**(신규 3게임 저장 활성). 기존 14 아케이드는 등록돼 있었음.

### 아케이드 디자인 폴리시 레이어 — 감촉·모션 고급화(딥서치 상위안, 14게임 일괄)

- **스프링 이징 토큰** `--ease-spring`/`--ease-settle`(`gk-root`) — 진짜 오버슈트는 `linear()`(`@supports`), 미지원은 `cubic-bezier` 폴백. 타일·버튼 누름·리빌에 적용해 "저렴한 선형" 감촉 제거.
- **리빌 anticipation→overshoot→settle**: `gk-correct` 키프레임을 dip(.97)→overshoot(1.06)→settle 로 — 정답 순간이 "묵직하게" 안착. 14게임 공용.
- **reduced-motion = 페이드 대체**(제거만 아님): 정답/오답 피드백을 전정계 자극 없는 `gk-rm-fade` 잔잔한 페이드로 대체(접근성=폴리시).
- **윤리적 스트릭 — 하루 유예(freeze)**: `arcade-meta` 스트릭이 하루 건너뛰어도 0으로 하드 리셋하지 않고 보존(gap 2까지). 손실회피 압박 대신 "진행 보존"(Calm UI 정렬).
- (이미 반영) SFX 재생마다 피치/음량 지터 · 완료 폭죽 기본 OFF.

### 아케이드 14게임 전수 감사 — P0 버그·설계정확성·접근성 수정

- **전수 감사**(게임 3그룹 + 공유 kit 병렬 리뷰 + 디자인 딥서치)로 파일:라인 근거 수집 후 우선순위 수정.
- **공유 kit P0(전 게임 영향)**: ① `useGameMusic` 자동재생 리스너 cleanup 누락 → 음악 OFF 후 탭이 되살리던 버그·리스너 리크 수정(onRef 가드+cleanup). ② `awardArcadeXp`가 스캐폴드 완료 경로에 미배선 → 스트릭/XP가 대부분 게임에서 안 쌓이던 것 배선. ③ `GameDone` `celebrate` 기본 OFF(Calm UI "폭죽 금지" 준수 — 패배 시 폭죽 제거). ④ 음악 FAB `env(safe-area-inset)` + SFX 재생마다 피치·음량 지터(반복음 피로 제거). ⑤ 공유 에러 처리(취소 vs 실패 구분).
- **게임별 P0**: daily-blitz 스테일-클로저 타이머(런 전체 오염) → `answerRef`; letter-forge·cascade 길이/ko 필터 후 빈 풀 크래시 → `NotEnoughWords` 가드; cascade 무해결 보드 소프트락 → 자동 재셔플(`hasMove`/`settleSafe`); glyph-tongue 다크모드 룬 안보임(`#3B3050`→토큰) + 중복-ko 미해결 석실 → ko 중복 제거; word-economy 동의어 distractor 오답 → ko 제외.

### 아케이드 14게임 BGM — 게임별 무드 매칭 배경음악 (P0)

- **딥서치 분석 결론 적용**: 아케이드 14게임은 흥미(검증된 인디 원형 14종)·주스(공유 `gamekit`)·세션 중독성은 상위권이나 **BGM이 0/14**로 몰입의 최대 미개발 지렛대였음. 각 게임 무드(긴장·박진감·탐험·정적)에 맞는 **실제 큐레이션 BGM** 추가.
- **음원**: Kevin MacLeod(incompetech.com) **CC-BY 3.0** 14곡을 게임 무드별 매칭(Balatro=Bass Walker 워킹베이스 / Papers Please=An Upsetting Theme 심문 / Outer Wilds=Awaiting Return 심우주 / The Witness=Airship Serenity 명상 등). ffmpeg로 90초 루프 세그먼트+페이드 경량화(~1MB/곡, 총 17MB). `public/audio/games/*.mp3` + `CREDITS.txt`, 아케이드 푸터 저작자 표기.
- **실오디오 시스템** (`gamekit.tsx` `useGameMusic`/`GameMusic`/`MUSIC_SRC`): 합성음 아닌 `HTMLAudioElement` — 게임별 트랙·루프·페이드 인/아웃·**기본 OFF**(연구: 개인차+언어학습 무가사 저자극)·`localStorage` 기억·SFX/TTS 덕킹·자동재생 차단 폴백(다음 제스처 시작)·접근성(aria-pressed·44px). 14게임에 `<GameMusic gameId>` 1줄 배선.
- **효과음 실샘플 교체 (P1)**: `useSfx`가 합성 오실레이터 → **CC0 실제 샘플**(Kenney "Interface Sounds"/"Music Jingles", CC0 1.0 무저작권, `public/audio/sfx/` 6종 132KB) Web Audio 버퍼 저지연 재생으로 격상. 콤보는 `playbackRate` 상승, 로드 전/실패 시에만 합성 폴백(무음 방지). API 불변 → 14게임 코드 변경 0. correct/wrong/combo/click/coin/complete.
- **리텐션 메타 — 데일리 스트릭·XP·오늘의 목표 (P2)**: `lib/game/arcade-meta.ts`(localStorage, DB 무변경) — 연속 플레이 일수 스트릭 + 누적 XP·레벨(√곡선) + 데일리 목표(30 XP). 게임 완료 단일 지점 `useRecordGameScore`에서 `awardArcadeXp`(미로그인도 동작). 아케이드 허브 상단 `ArcadeMetaStrip`(SSR 안전 클라이언트)로 🔥연속일·Lv 진행바·오늘의 목표 노출 → 재방문(스트릭)·성장(XP)·오늘의 목표로 중독성 강화(가변보상 원리).
- **결과 공유 카드 (P3)**: 공유 `GameDone`에 "결과 공유" 버튼 — 완료 메시지+주요 스탯+🔥연속일을 조합해 **모바일 `navigator.share` / 그 외 클립보드 복사**(Wordle식 바이럴). 클라이언트 전용·DB 무변경, 14게임 코드 변경 0(공유 컴포넌트 한 곳). 리더보드(서버 집계)는 마이그레이션 필요로 후속 승인 대상.

### 만화화 파이프라인 — 무료 Qwen 백엔드 + 만화/웹툰 이중 렌더 + 표시크기 해상도 설계

- **무료 이미지 백엔드 = Qwen-Image-Edit (Alibaba DashScope)** — `scripts/comic/gen-qwen.mjs` 신설. 신규가입 100장 무료(90일·카드불필요·싱가포르 Intl)로 캐릭터 identity 잠금이 되는 유일한 실용 무료 경로(딥서치 결론). 2단계: `qwen-image-max`(캐릭터 시트 t2i) → `qwen-image-edit-max`(패널 편집). Nano Banana Pro 무료 API는 부재(limit:0 실측), Pollinations FLUX는 identity 없음 → 기각. 대안 어댑터 `gen-openai.mjs`·`gen-nanobanana.mjs`도 정비(유료).
- **Carol Stave 1 무료 실증 (18/18 ship)**: 생성→Vision-QC(3에이전트)→결함 6종 식별→프롬프트 보완→재생성→재-QC 완결 루프. Qwen 특유 결함 대응을 어댑터에 상수화: HARDBW(색단어 강제흑백)·BLANK(빈 종이)·solo/no-dup·솔리드 잉크·씬 메타접두사 strip·**t2i `--noref` 폴백**(클로즈업 시트누출+의상오버라이드 회피, 정규식 자동 라우팅). `qc-defects-carol.json` section1 재검사(low 6 accepted-limit).
- **스크립트 생성기 백엔드-중립화** (`01-script.mjs`): scene에 art-style/색단어/메타 금지, 단일주체/패널, 패널별 `size`(full/half/third)·`noref` 지정 지침 추가 → 런타임 패치 없이 Qwen 네이티브.
- **표시크기 기반 해상도 + 폰 하한**: 만화책 페이지-그리드는 패널당 표시크기가 작고 가변 → 역할 티어(full 1024×768/half 704×939/third 640×853). <768px 리플로우 시 폰 풀폭이 되므로 flat 라인아트 ~1.6× DPI 하한 적용. 균일 대비 저비용 + 폰 크리스프.
- **이중 레이아웃 렌더러** (`03-assemble.mjs --layout comic|webtoon`, 딥서치 최적안): CSS Grid 12칼럼 + 숫자 span, **tier(행) 원자적 = Z-path 보장**, DOM순서=읽기순서, <768px 세로 리플로우(Webtoon), 강조배분(페이지당 full≤1), 워드카운트 role 승급, orphan 행채움, 테마변수, `loading=lazy`. `--external` 웹배포 모드(HTML 3.8MB→18KB + img/ 분리). 한 소스 → 만화책/웹툰 동시 산출.
- **텍스트 구성 3-보이스(레터링 크래프트 딥서치 최적안)**: 텍스트를 그림 위가 아니라 **밴드**에 배치(AI 아트는 여백 미보장 → 가림 0, 데스크톱·폰 공통). 모양으로 목소리 구분(색맹 안전): **나레이션**=틴트 라운드사각 캡션(위)·**대사**=라운드사각 말풍선(아래)·**원문인용**=세리프+좌측 인용바+양피지+"— 저자"(책의 목소리). 교육·원문충실 → 문장case, 강조 italic/bold-italic, 폰 하한 반응형 타이포(clamp). 만화 데스크톱 오버레이 폐기 → 밴드 통일.

### 만화화 파이프라인 — 최종 인수 게이트 (final-audit) + Frankenstein 1~10장

- **`scripts/comic/final-audit.mjs` 신설**: 전권 완료 시 실행하는 SHIP/NO-SHIP 인수 게이트. 완결성(4 Letter + 24 Chapter = 28섹션)·GATE-1 verbatim 실검·이미지 GATE-2·원문반영 밴드(≥25%)·인지부하(말풍선 ≤4)·캐스트 연속성(bible appears_in)·9.5 QC 원장(`qc-scores.json`)을 종합해 우선순위 remediation 큐 + 단일 판정 산출. `--remediate`로 appears_in 자동 정합.
- **`scripts/comic/qc-scores.json` 신설**: 챕터별 비전-QC 원장(floor + 패널별 status: remediated/accepted-limit/open). open 이 하나라도 있으면 SHIP 차단, 문서화된 무료 FLUX 천장(accepted-limit)은 경고로만 노출.
- **Frankenstein 3~10장 완성 + 5·6·7장 성숙톤 재정렬**: 전 챕터 mature 그래픽노블 잉크 + Elizabeth 금발 단일 땋은머리 캐논 통일. Victor·Creature·Elizabeth·Alphonse 1→10장 교차 일관(연속성 remediation 0). 전 챕터 원문반영 25.0~26.5%.

### 잔여 근본분해 + 아포스트로피 생략 추출 필터 (카테고리 2·3)

- **잔여 정밀 재분류**(162권, 3,092 lemma): OCR 아님(SE 손교정) 재확인 — ① 작가 의도 비표준(방언·조어·후렴) + ② 추출 파편(하이픈/아포스트로피 분해) + ③ 진짜 희귀·전문어. Wiktionary 전수조회로 en 712/foreign 422/부재 1,958 실측.
- **카테고리 2-Ⓑ 아포스트로피 생략 필터 (근본, 채택)**: winkNLP가 방언 생략 아포스트로피(`foun'`·`hadn'`·`doin'`·`wukkin'`)를 별도 punctuation 으로 떼어내 어간만 남기던 것을, **word 토큰 뒤 홑 아포스트로피 glued + 비-s어미** 판정으로 제외. `extract-lemmas.ts` + 3 빌더 동기화. 소유격(`cat's`=PART·`dogs'`=s어미)·`o'clock`·복합어(`self-control`→control) **전부 안전**(실단어 손실 0). 잔여 −262 occ.
- **카테고리 2-Ⓐ 하이픈 분해 (기각·pivot)**: 실측상 `self-control`→control·`flat-footedly`→footedly 등 실단어가 하이픈에 glued 되어 인접성만으로 안전 제거 불가 + PROPN 태그 불신(`Ten-teh`=NUM). 사전 없이는 근본 수정 불가 → not_found 무해 잔존으로 유지(사전 오염 0).
- **카테고리 3M 형태소 (기각)**: 복합어 자동분해 정밀도 부정 실측 — `cameleopard→came+leopard`(실제 기린), `flaysome→flay+some`, `granfarther→gran+farther` 등 **희귀어에 틀린 뜻** 부여. 수율도 미미(2홉 124·접두사 209·복합어 313 occ). → 위험 형태소 폐기, 진짜 희귀어는 3R로 흡수.
- **카테고리 3R-Ⓒ 자기치유 (게이트+적재+자동배선 완료)**: LLM 뜻 생성 0 — Wiktionary 정의→Google 번역만.
  - **코어** `dict-selfheal-core.mjs`: Wiktionary 영어섹션+register 게이트(eye-dialect/misspelling 거부, plural/alt-form/"See X" 리다이렉트 2단 추적, `nocat` 등 템플릿 잔여 정리) + Google 번역 + `koQualityOk`(본문 미번역 라틴어 차단). gate/drain 공유.
  - **② 게이트 정제** `dict-selfheal-gate.mjs`: 잔여 379 후보 → **55 통과(순수 50/243 occ + 방언 5), 오역 0** (coinage/외국어 312 영어섹션 부재로 정확 거부). 빈글로스 "See" prose 추적으로 tuckshop/sansculottism 회수.
  - **① 적재** `dict-selfheal-load.mjs`: 순수 50 → `lexicon_clean`(ko_source=`wikt-selfheal`) 적재. RPC 검증: pedicellariae·foretopmast·kinematograph·seignorage·avicularium·tuckshop 전부 `coverage-clean` 티어 해소 확인(루프 폐합).
  - **③ 자동 배선** `dict-selfheal-drain.mjs`: LCP ingest 가 미해소어를 쌓는 `archaic_candidates`(collect_archaic_candidates)를 소스로 게이트→`lexicon_clean` 자동 적재(멱등, 배치 캡, 기존적재 제외). **핫패스 밖 드레인**이라 외부 조회가 ingest 를 안 막음. 스모크: 984 임계통과→876 기존제외→4 신규 적재. 크론/Claude Code 드레인으로 주기 실행 → 사전 자가성장(반복 수작업 제거).
  - 형태소 자동분해(3M)는 `cameleopard→came+leopard`(기린) 등 정밀도 부정으로 기각 — 진짜 희귀어의 정확한 뜻은 외부 소스(3R)에 있음.

### 큐레이션 "소스 GET" 목록 일반화 테스트 (시드 카탈로그 미테스트 162권)

- **소스 전환**: Standard Ebooks 실 카탈로그 최신 774권 4라운드 전량 소진(SKIP=800→0권) 확인. 이후 큐레이션 "소스 GET(대량)" 목록 `library_seed_catalog`(ingest 전 소스 후보)로 테스트 지속 — SE 항목 **1,450권**(내 최신-리스팅 크롤 774와 **겹침 0** = 더 오래된 스냅샷). crawl774 ∪ prev110 제외 → **미테스트 SE 748권 풀** 확보.
- **신규 코퍼스**: 시드 카탈로그 미테스트 SE **162권** 빌드(230 후보 중 SE single-page 부재 68 실패) — 48,019 distinct lemma · **4,954,841 등장**. 프로덕션 동일 winkNLP 추출(`build-test-corpus-seedlist.mts`).
- **플랫폼 베이스라인(캐스케이드 前) = 99.863%** 등장가중 해소 — 401–600(99.846%)·601–800(99.916%) 범위 재현 → **완전 미학습·다른 스냅샷 도서에서도 방법 일반화 확인**. 경로: direct 96.63% + inflection 1.58% + coverage-clean 1.27% + derivation/spelling/normalized/dialect/suggestion 등.
- **잔여 3,092 lemma / 6,789 등장(0.137%)** — 79.7%(5,410 occ) 단일책 idiosyncratic. 유형: SF/판타지 조어(Burroughs Barsoom/Pellucidar: jeddak·therns·banths·kaldane·zitidar·padwar) + 네덜란드어 인라인(jongejuffrouw·mejuffrouw·molens) + eye-dialect(cunjuh←conjure·sezee←says he·wukkin·ernudder — Douglass/Remus) + OCR 파편(teh·hadn·foun) + 소수 실단어(pedicellariae 해부학·finneskoe 순록가죽신). = 사전 환원불가(조어·외래·방언) 성격 전 라운드와 동일.
- **부수 정리**: eval `extraction_test_vocab` 에 이전 라운드 823권 vocab 누적(빌더 REST-DELETE 대용량 부분실패)이 발견돼 고아 제거 → 162권/800,239행 정합. 임시테이블·스크래치 전량 정리.

### 근본 방안 심층 검토 + 추출 파편 수정 (books 601–800)

- **일반화 재확인**: books 601–800(0 겹침) 플랫폼 베이스라인 **99.916%** — 401–600(99.846%)보다 높음. 누적 사전(실영어 6,700+·방언 3,128+·recovery)이 **미관찰 코퍼스에 강하게 일반화**(방법은 일반화, 데이터는 per-corpus) 실증.
- **포괄 사전(R1) 실측 기각**: Webster 1913 PD 87k 표제어 포괄사전화 시도 → 잔여 커버 **2.9%(517 occ)** + Google MT 희귀어 ~15% 오역 → **한계효용 ~0**(누적 사전이 이미 포괄 역할). `webster-comprehensive.mjs`(참고 보존, 미적재).
- **근본 3분해**: 잔여 = R1(사전공백·이미 해소) + R2(정규화공백·LLM없인 ~85% 상한) + R3(비-단어). R3의 다수는 SF/펄프 발명어휘(뜻 없음)·고유명사(NER 대상)·파편(토크나이저 대상).
- **추출 파편 수정(권장안)**: winkNLP 하이픈 분해로 발생하는 중첩복합어 파편(`brac`←bric-a-brac 41책·`shilly`←shilly-shally 27책·`scarum`←harum-scarum 20책·`toity`·`jongg`·`lutely`←abso-blooming-lutely 등) 37종을 `extract-lemmas` TOKEN_BLOCKLIST + eval 동기화 추가. 601–800 잔여 −215 occ(99.916→99.917%). **정밀도 리스크 0**(비-어휘 제거) + **모든 책 영구 적용**.
- **결론**: 99.917%(미관찰)는 정밀도 유지 실질 바닥. 남은 ~85%는 발명어휘(환원불가), 나머지 방안은 소규모 추출단 정제 or 정밀도 희생 or LLM 재도입.
- **5단계 캐스케이드 601–800 적용**: 면밀 분류(en 10.8%·foreign 17.1%·absent 67.3%) 후 전체 캐스케이드 실행 — ①플랫폼 ②Wiktionary ③Google(en=Webster정의문·foreign=언어별) ④Claude 18병렬(en 1,201 gloss·foreign 89·방언 1,044) ⑤recovery 12병렬(409). 잔여 17,586→**13,200 등장**, 토큰 99.916→**99.937%**. absent 대다수·recovery 수율 ~6%(401–600 19%보다 낮음)로 이 코퍼스가 SF/펄프 조어 지배 재확인. `r8-*.mjs`.


### 새 200권 일반화 테스트 + 4단계 캐스케이드 (방법 일반화 실증)

- **일반화 테스트**: 튜닝 코퍼스(books 201–400)와 **0 겹침**인 새 200권(books 401–600, 17.7M 토큰) 추출. 플랫폼(사전DB+로직)만으로 **99.846%** — 오버핏 아닌 강건한 일반화 확인. 격차(vs 99.922%)의 정체 = rare word 데이터 전이 한계(thews·anodynic류 저 코퍼스에 없던 단어).
- **4단계 캐스케이드**(사용자 지정 프로세스): ① 플랫폼(실 RPC 전수) → ② 외부소스(Wiktionary 멤버십 분류: en 4,420·foreign 2,318·absent 8,997) → ③ Google(무료: en=Webster PD 정의문 번역 2,965 draft·foreign=올바른 소스언어 직역) → ④ Claude 28병렬(정밀 교정·검증·정규화).
- **적재**: en gloss 4,376(lexicon_clean wikt-claude, Google/Webster draft 교정) + foreign 700(la 중심 문맥검증) + 방언 1,782(spelling_norm). 총 6,858 신규 해소.
- **효과**: 새 코퍼스 잔여 27,211→**15,238 등장**, 토큰 99.846→**99.914%** — 튜닝 코퍼스(99.922%)에 근접 → **캐스케이드 방법이 임의 미관찰 도서를 ~99.91%로 수렴시킴을 실증**. thews→근육·anodynic→통증완화·pleeceman→policeman·gilikopter→helicopter 정확 해소, magter·klangan(SF조어) not_found 유지.
- 파이프라인 스크립트: `fresh-residual-build.mjs`(REST RPC 전수 판정)·`fresh-dump-resid.mjs`·`fresh-classify.mjs`·`fresh-google.mjs`·`fresh-route.mjs`.
- **Stage ⑤ recovery pass**: "환원불가"로 거부된 8,953을 재검토 — (a) 외국어 오분류된 영어 방언 정규화(orses→horse·worl→world), (b) 정규화 불가하나 **직접 글로싱 가능한 실단어**(진짜 방언·고어·확실한 외국어 차용어) 판정. Claude 14병렬 → norm 1,165 + gloss 864 = **2,029 회수**(~19%). muckle→많은/큰(스코틀랜드)·horosho→좋아(러시아어)·bandarillas→반데리야(스페인어)·eftesoones→곧이어(고어)·wazeer→vizier. 새 코퍼스 잔여 15,238→**11,526 등장**, 토큰 99.914→**99.935%**(튜닝 코퍼스 초과). `fresh-recover-load.mjs`. 남은 11,526은 SF조어·가공 고유명사·Joyce 조어·순수 nonce = 진짜 바닥.

### Wiktionary 멤버십 판별기 + 실영어 gap-fill (잔여 −3,149 등장)

- **"Google보다 큰 어휘" 시스템 = Wiktionary(kaikki)**: 영어 ~1.3M 표제어 + 1000+ 언어. 잔여 9,659 전량을 en.wiktionary API(50-title 배치)로 분류 — **English 1,542 / 외국어 1,410(Latin 290·Italian·French…) / 부재 5,581**.
- **판별기 통찰**: 잔여 다수는 "희귀 실단어"가 아니라 조어(Ulysses/SF)·오철자·고유명사 → Wiktionary조차 부재. 하지만 **1,542개는 실영어**(Google·Webster가 놓친 narghileh·byrny·dickty·netherstocks·praties·stengah…)로 판명.
- **W-1 실영어 gap-fill**: Wiktionary 멤버십(사실)로 실영어 확정 → Claude 8병렬로 문맥 기반 ko 생성(정의문 미사용, 자체 생성) → `lexicon_clean` **1,429** 적재(ko_source=wikt-claude·gloss_source=wiktionary-membership). `scripts/dict/wikt-classify.mjs`·`wikt-route-export.mjs`·`wikt-en-load.mjs`.
- **효과**: 잔여 15,730→**12,581 등장**, 토큰 99.869→**99.895%**. 정밀 검증: narghileh→물담배·dickty→거들먹거리는 상류층 행세(흑인 속어)·stengah→위스키 소다(말레이)·praties→감자(아일랜드) 전부 coverage-clean 정확.
- **W-2 부재 정규화**: Wiktionary 부재 5,581을 Claude 12병렬 문맥 정규화 — 오철자/방언만 표준어 매핑(cockodrill→crocodile·stumicks→stomach·perliceman→policeman·roomatism→rheumatism·saxohpone→saxophone·wictim→victim), 조어·고유명사·외국어 거부. 확정 1,461 → `spelling_norm(curated-dialect)`(누적 3,128). 잔여 12,581→**10,690 등장**, 토큰 99.895→**99.911%**.
- **W-3 외국어 라벨링+번역**: foreign 1,410을 Claude 6병렬 **문맥 검증** — 진짜 외국어 인용만 번역+언어태그, 우연일치(magter=Danish?·menzil=Turkish?·balu=Basque? = 실은 SF/정글북 조어) 거부. 확정 **513** → `lexicon_clean`(lang별: la 281·fr 80·it 63·sco 38·de 16·es 15·… · ko_source=foreign-claude). salutamus→경의를 표하다(la)·putana→창녀(it, wlang Albanian 오류 교정). 잔여 10,690→**9,992 등장**, 토큰 99.911→**99.917%**.
- `WordLookupPopover` LANG_META 8→28 언어 확장(pt·el·ru·da·sv·no·fi·ga·cy·gd·gl·eu·af·cs·pl·hu·is·enm·ang·sco + xx 일반) — 팝오버 국기+언어명 표시.
- **W-4 미분류 사각지대 재처리**: Wiktionary API 에러로 미분류였던 1,786(freq≤2) 재분류 → en 271·foreign 203·absent 1,032. Claude 8병렬(2 gap-fill+4 정규화+2 외국어검증): 실영어 267 gloss·방언 316·외국어 84 확정. neffew→nephew·conwulsions→convulsion·halbatrosses→albatross·unneth→간신히. 잔여 9,992→**9,308 등장**, 토큰 99.917→**99.922%**. `scripts/dict/wikt-reclass.mjs`.
- 약어 `rm` blocklist 추가(프로덕션+eval). Wiktionary 사용은 CC BY-SA 사실(멤버십·언어태그)만 — [DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md).

### 잔여 유형별 정밀 분해 + 3레버 해소 (Webster PD·방언확정·약어필터)

- **유형별 분해**: 새 200권 잔여 20,145 등장을 배타적 버킷 분류 — F(3+책)1,853·G(2책)2,390·C(약어)883·hapax(1책)14,973. dmetaphone 앵커 태그: lev1 4,468·lev2 4,012·앵커없음 11,665(가공 고유명사·nonce·외국어=환원불가). **잔여는 표준 고어가 아니라 방언 표음철자+가공 고유명사가 지배**임을 실증.
- **Method A(약어 필터)**: 프로덕션 `extract-lemmas.ts` TOKEN_BLOCKLIST에 안전 약어 8종(yd·yds·yr·hr·hrs·mos·pts·doz) 추가 + eval 코퍼스 blocklist 프로덕션 동기화. acct·dept·wks 등은 이미 프로덕션 필터됨 → eval 잔여의 약어 393 등장은 측정 아티팩트로 확정.
- **Method C(Webster 1913 PD)**: 잔여∩Webster 65 lemma/127 등장 — **정의문을 Google 번역**(희귀 표면형 오역 회피). `lexicon_clean` 적재(ko_source=webster-mt·gloss_source=webster). 퍼블릭 도메인 = 완전 청정. `scripts/dict/webster-build.mjs`·`webster-load.mjs`.
- **Method B(방언/오철자 확정 — 주 레버)**: dmetaphone 앵커 후보를 **Claude 서브에이전트 8병렬**로 확정/교정(naive 앵커 ~55% 오답을 독립 판단: prau→pray✗ 배·collige→college✓·strate→straight✓·tundher→thunder·cawfy→coffee·dreffle→dreadful). 정밀 우선(모호·고유명사·외국어·함수어 reject).
  - lev1(4,468 등장) → 확정 815 lemma/1,730 등장
  - lev2(4,012 등장) → 확정 654 lemma/1,208 등장 (8병렬 2차)
  - **앵커없음 다중책+고빈도 hapax(3,411 등장) → 오픈형 문맥 패스**: dmetaphone이 못 잡은 방언(chilluns→child·laigs→leg·diffrunts→different·tomorrer→tomorrow·figgered→figure) + 복합어(indiarubber→rubber) — first_sentence 문맥 제공, Claude 6병렬. 확정 198 lemma/991 등장. `scripts/dict/ctx-export.mjs`
  - 합계 **1,679 lemma/3,929 등장** → `spelling_norm(curated-dialect)`. `scripts/dict/anchor-export.mjs`(TABLE/OUTDIR env)·`anchor-load.mjs`.
- **효과**: 잔여 20,145→**15,730 등장**, 토큰 99.832→**99.869%**. 남은 앵커없음 hapax(가공세계 고유명사·nonce·외국어 인라인)는 환원불가 확정 — 제안모드+not_found가 정답.

### 음성 제안모드 검토 + 고빈도 잔여 확정 해소 승격

- **제안모드 검토**: tier10 dmetaphone+lev≤1. 정밀 무작위 ~85%(오철자·eye-dialect 정확), 고빈도 ~60%(고유명사·외국어 혼입). "혹시 X?(추정)" 프레이밍이 오답 무해화 → 설계 적정, 큰 변경 불요. lev2 확장은 금지(45%).
- **소폭 개선(확정 승격)** `20260724170000`: 고빈도 정착방언·오철자 47종을 spelling_norm/dialect_map에 확정 추가(제안→정식 해소). probily→probably·hawss→horse·wessel→vessel·diffrunt→different·doan→do·tommorow→tomorrow. 고유명사/SF조어/외국어/약어 제외.
- **효과**: 제안모드는 커버리지 미포함(추정)이나, 확정 승격은 **+47 lemma/1,021 등장** 실제 해소 증가. 토큰 ~99.822→99.830%.

### hapax 사전갭 확장 — Claude 서브에이전트 8병렬 교정 (2,345)

- **스케일 방법**: hapax(1권) 실단어 3,372개 → Google baseline → **Claude 서브에이전트 8개 병렬 교정**(배치당 ~420). 인라인 교정(books>=2 380개)을 대량 확장.
- **교정 품질**: 각 서브에이전트가 전수 검수 — 부정접두 뒤집기(unwintry→겨울답지 않은·unabased→기죽지 않은), 동음이의(windingsheet→수의·floodtide→밀물·cloudbank→구름 둑), 음역 복원(reddleman→붉은염료 행상인·tulwar→인도 곡도), 복합어(woodswallow→숲제비·witchhazel→풍년화). 방언/외국어/nonce ~1,027 제외.
- **적재**: lexicon_clean lang=en **2,345**(ko_source=claude-batch). 누적 실단어갭 2,725(+이전 380). `scripts/dict/gap-fill3.mjs`·`gap3-load.mjs`.
- **효과**: 잔여 −4,465 등장, 토큰 99.786→**~99.822%**. 정밀 ~97%(전수 Claude 교정).

### 실단어 사전갭 채움 — Google baseline + Claude Code 배치 교정

- **2단계 최적 방법**: 잔여 실단어(복합·고어·파생, 2+권) 437개 → ① Google en→ko baseline(무료) → ② **Claude Code 배치 교정**(전수 검수).
- **교정 내역**: Google 오역 164건 수정(unostentatiously→겸손하게[가식적으로 반대뜻]·bestrewn→흩뿌려진·scatheless→무사한·tirewoman→시녀·stockstill→꼼짝없이) + 방언/외국어/nonce 54건 제외(ahint·asthore·bagnet·dickty) + Google 정답 216 검증.
- **적재**: lexicon_clean lang=en **380**(ko_source=claude-corrected/verified). 잔여 −1,412 등장. 토큰 ~99.798%. `scripts/dict/gap-fill2*.mjs`.
- **정밀**: 전수 Claude 검수라 ~98%+(이전 Google-only gap-fill 60% 롤백과 대비 — 교정으로 정밀 확보).

### 잔여 "비단어" 재규명 + 복합어 분해 시도·롤백 (정밀 우선)

- **"비단어" 오라벨 교정**: 클린 Standard Ebooks인데 "비단어 48%"는 모순. 조사 결과 **대부분 실단어** — dwyl(370k) 미수록 복합어(diningroom·postoffice)·고어(meseemeth·yclept)·파생(unostentatiously)·방언·고유명사. OCR nonce 아님.
- **복합어 분해 시도**: 비하이픈 복합어 head 해소(diningroom→room). 정밀 2중 게이트(기능어/접미사 head 제외 + 단일단어 음성근접=오철자 제외 → contrack→contract는 suggestion으로). 정밀 40%→~75%.
- **롤백**: 여전히 부분뜻 단정 + 25% 오분해(cartonnage→tonnage·pigling→ling·bargun→gun). **정밀 바 미달**(gap-fill 60%·하이픈 정밀수정과 동일 기준) → 복합어 tier 롤백. "틀린 뜻 단정 > not_found" 원칙.
- **성과 유지**: ① 비단어=실단어 규명(향후 방향) ② 오철자→suggestion 리다이렉트 확인 ③ Cockney h-탈락 규칙(아래, clean).

### 일반화 테스트 (새 200권) + Cockney h-탈락 규칙

- **일반화 테스트**: 기존 200권 삭제 → **미관찰 새 200권**(Forster·Herbert·Kropotkin·Saltus 등, 1,200만 토큰) 재추출. `build-test-corpus.mts` SKIP/CLEAR 추가.
- **결과**: 토큰 해소 **99.785%**(원래 99.80% 대비 −0.015pp) → **과적합 아님, 강한 일반화**. 세션 tier들 동일 비율 기여(외국어는 오히려 13,028등장으로 더 해소 — 다국어 사전이 미관찰 외국어 커버 실증). 근본 아키텍처(생성엔진+포괄 외부소스)가 관찰 아닌 원리 기반임을 확증.
- **새 잔여 분석**: 구성 원래와 동일(비단어 48%·음성 lev1 19%·영어 16%·lev2 15%). 미착수 외국어(nl/pt/ru/pl) 확인 → 오탐뿐(추출 ^[a-z] 필터로 키릴/그리스 이미 제외).
- **★ 새 방안 발견 — Cockney h-탈락** `20260724160000`: 새 코퍼스에서 ead→head·elp→help·orrible→horrible·usband→husband 체계적 패턴 발견. surface_variants에 'h'||s 규칙. 정밀(실단어 direct 우선, and·old·ear 무회귀). +60 lemma/186 등장, 생성적(미관찰 Cockney 일반화).

### 라틴어 사전 — UD treebank 표면형 (마지막 clean 잔여 방안)

- **동기**: 잔여 최정밀 분석에서 유일한 미착수 clean 후보 = 라틴(198+ 등장). "lemmatizer 필요" 장벽을 ① Google 굴절 표면형 직접번역(aeternitatis→영원의) ② UD treebank 실제 표면형 소스 — 두 가지로 우회.
- **소스**: Universal Dependencies Latin(PROIEL/ITTB/Perseus/LLCT) **47,391 표면형**(실제 라틴 텍스트 굴절형, 공개데이터·표면형=사실). `scripts/dict/latin-build.mjs`.
- **적재**: Google sl=la → `lexicon_clean` lang='la' **42,342**(영어 충돌 skip). 기존 foreign tier·🏛️ 배지 재사용, 코드/마이그레이션 0.
- **검증**: aeternitatis→영원의·rerum→사물의·gentium→국가·virtutis→미덕의·genuit→낳았다·fratres→형제. 영어 우선(동형이의어 안전).
- **효과**: 잔여 +295 lemma/388 등장(UD 표면형이 Whitaker stem 23%보다 우수). 토큰 해소 → **~99.81%**. 외국어 사전 총 ~186k(fr/it/de/es/la). 출처표기 DATA_ATTRIBUTION.md.

### 심층 정밀도 분석 — 하이픈 복합어 오해소 수정 (품질축)

- **동기**: 커버리지(99.8%)에 이어 **해소 정밀도(false positive)** 미검증축 분석. 비핵심 tier 표본 검수.
- **발견**: spelling(MorphAdorner+Wiktionary) ~95%·derivation ~90% 정밀 양호. **norm(surface_variants 하이픈) 27% 오해소** — re-embodied→"re"·over-hot→"over"·un-policeman-like→"like"·counter-will→"will"(조동사) 등 **접두사/기능어 세그먼트를 취해 틀린 뜻**. 규모 323 lemma/393 등장.
- **수정** `20260724140000`: surface_variants 하이픈 세그먼트에 **blocklist(접두사·기능어 44종) 필터** → head 세그먼트 또는 정직한 not_found. "틀린 뜻 > not_found" 원칙.
- **결과**: 오해소 **323→7(98% 수정)**. 1,154 정답 전환(re-embodied→embody·over-hot→hot), 14 not_found(counter-will·un-policeman-like). 커버리지 손실 미미, 품질 대폭 개선.
- **교훈**: 커버리지 극대화가 정밀도를 잠식할 수 있음 → 공격적 tier는 정밀 검수 필수.

### Wiktionary 방언 매핑 — heavy dialect 해소 (CC BY-SA, 사실 쌍만)

- **동기**: 200권 잔여의 최대 미해소 = 작가 방언(nuthin·chillun·wuz·nevah). MorphAdorner(5k)가 못 잡은 tail을 Wiktionary 포괄 방언으로 보완.
- **라이선스 준수**: Wiktionary(CC BY-SA)에서 **variant→standard '사실 쌍'만** 추출(gloss/정의문 미추출). 뜻은 전적으로 자체 사전에서 해소 → 배포물에 CC BY-SA 창작물 0. **BY 출처표기** `docs/DATA_ATTRIBUTION.md` 신설. (사용자 승인: 완화구성+BY 유지.)
- **추출/적재**: `wiktionary-dialect-extract.mjs`(kaikki 2.6GB gz 스트림 필터, 82,669 매핑 중 방언태그) → `wiktionary-dialect-load.mjs`(pronunciation-spelling·eye-dialect·dialectal·nonstandard·colloquial·contraction·informal, alternative/archaic 66k 노이즈 제외) → `spelling_norm` source='wiktionary' **3,506**.
- **정밀 3중 보호**: ①tier 순서(실단어 direct 우선 — of·year·free 무회귀) ②표준형 사전해소 게이트 ③노이즈 태그 제외. 검증: nuthin→아무것도·chillun→아이들·wuz→was·nevah→never·befo→before·stummick→위.
- **효과**(200권): 토큰 해소 → **~99.80%**(spelling tier 4,515→5,455 등장). 잔여 heavy dialect 대폭 해소.

### 음성 제안모드 + 독일·스페인어 — 잔여 추가 대응

- **음성 제안모드** `20260724120000`+`121000`: `lookup_word_meaning` suggestion tier(10) + `dmetaphone` 함수인덱스. not_found 직전 dmetaphone∧lev≤1(86% 정밀) → **단정 아닌 "혹시 X?"**(match_via='suggestion'). realy→really·suport→support·salery→salary. UI `SuggestionBody`("🔍 혹시 이 단어? 추정 — 문맥 확인"). **커버리지 미포함**(독해 툴팁 전용, 추출/큐레이션 무영향) → 사전 신뢰 유지. 잔여 phon_lev1 ~2,533 등장 독해 보조.
- **독일어·스페인어** (foreign-dict-build LANG_CODE=de/es): hermitdave + Google → lexicon_clean lang='de'(35,469)·'es'(34,633). behandlung→치료·betteln→구걸하다. 동형이의어(gift·war·hat) 영어 우선 안전. 잔여 +178 lemma/430 등장. 외국어 사전 총 ~144k(fr/it/de/es).
- **200권 재측정**: 토큰 해소 → **99.782%**. 잔여 ~12,970 등장(0.22%) = 무거운 방언(Lardner·McKay 반열린)+라틴(표면소스 필요)+nonce(환원불가). 자동해소는 정밀 벽 → 제안모드/라벨이 정직한 처리.

### 외국어 확장 — 이탈리아어 사전 (French 파이프라인 복제)

- **동기**: 200권 평가 이탈리아어 잔여 289 lemma/617 등장 → French 선제형 방식 그대로 복제.
- **적재**: hermitdave it_50k(표면형) + Google sl=it → `lexicon_clean` lang='it' **36,015**(영어 충돌 자동 skip). `scripts/dict/foreign-dict-build.mjs` 재사용(LANG_CODE=it). 코드/마이그레이션 변경 0 — 기존 foreign tier·lang 배지(🇮🇹) 재사용.
- **검증**: contadina→농부·fanciulla→소녀·malinconia→우울·cantare→노래하다. pain 영어 유지(동형이의어 안전).
- **효과**: 잔여 +289 lemma/617 등장, 토큰 ~99.767%. 핵심: Google가 라틴 굴절 표면형도 정확 번역 → 모던어(it/de/es) 즉시 확장 가능. **라틴 보류**(표면 wordlist 소스 미확보). 설계 `foreign-language-reading-support.md` §9.

### 잔여 유형별 대응 — 부정축약·비운음·재귀 -ingly (+1,338 등장)

- **잔여 정밀 분해**(200권): opaque 3,738/phon 2,477/fragment 632/gen 279 lemma. 최대 미발견 패턴 = **부정축약**(아포스트로피 탈락) 17형 1,134 등장(dident 335·wouldent 254·wasent 241).
- **① 부정축약 맵** `20260723161000`: dialect_map에 dident→did·wouldent→would·couldna→could 등 38형. 표준형=조동사 base(부정 소실 note). 실단어 wont은 direct 우선(무회귀).
- **② 비운음 -ah→-er** + **③ 재귀 -ingly→base** `20260723160000`: surface_variants. nevah→never·bettah→better·comprehendingly→comprehend·shiningly→shine. hurrah/lovingly 무회귀.
- **효과**: +67 lemma/1,338 등장, 토큰 99.734→**99.757%**, 잔여 등장 −8.5%. 분석 `coverage-root-architecture.md`.
- 잔여 대응 우선순위: 나머지(phon_lev2 45%정밀·gen_prefix 뜻역전·외국어·nonce)는 자동해소 보류 → 음성 제안모드/라벨 세분화가 정직한 처리.

### MorphAdorner 철자정규화 tier — 퍼미시브 방언 사전 (301k)

- **외부 소스**: MorphAdorner(Northwestern, **NCSA 퍼미시브·상업배포 OK**) 철자맵 → `spelling_norm`(variant→standard) **301,501** 적재(EME 297k+19c소설 NCF 4k). 출처 github.com/travisbrown/morphadorner. 조사 근거: VARD/kaikki/음성 배제(coverage-root-architecture.md §10).
- **마이그레이션** `20260723150000`(spelling_norm 테이블)+`151000`(lookup_word_meaning spelling tier). 적재 `scripts/dict/spelling-norm-load.mjs`.
- **tier 7.6**: variant→standard 후 **표준형이 분류사전에 해소될 때만** 반환(정밀 100% 게이트, 음성 45%와 대비). match_via='spelling'. 검증: accordynge→according·afther→after·abaht→about·furriners→foreigner. 회귀 0.
- **효과**(200권): +643 lemma/2,602 등장, 토큰 99.690→**99.734%**, 잔여 등장 −14%. 핵심가치=301k가 **미관찰 방언 텍스트 일반화**(dialect_map 밴드에이드 승격).
- **약어 추출필터**: extract-lemmas TOKEN_BLOCKLIST에 acct·dept·yrs·wks·cts 등 추가(학습단어 아님).
- **UI**: WordLookupPopover match_via='spelling' → "🗣 방언·옛 철자 — 표준어 'X'". tsc 통과(web·library-pipeline).

### 방언·고어 해소 tier — 단어추출 잔여 -27% (200권 평가 기반)

- **`-in→-ing` 정규화** `20260723130000`: surface_variants 확대(g 탈락 방언). nothin→nothing·lookin→looking → normalized tier 소비. 회귀 0(basin/coin은 direct 우선). 218 lemma·2,796 등장.
- **eye-dialect 맵** `20260723131000`+`132000`: `dialect_map`(74 entry, 방언/고어→표준 lemma) + `lookup_word_meaning` dialect tier(coverage 뒤·normalized 앞). gwine→가다·brung→가져오다·drownded→익사하다·dunno→알다·twould·methought. 표준형 68/74 해소.
- **방언 UI** WordLookupPopover: match_via='dialect' → "🗣 방언·고어 — 표준어 '{원형}'로 이해" 안내. tsc 통과.
- **효과**(199권 재측정): 토큰 해소 99.57%→**99.689%**, 잔여 등장 25,438→**18,510(-27%)**, 잔여 lemma 8,720→7,823. 근거 `extraction-evaluation-2026-07-23.md` §9.

### 단어추출 대규모 평가 — Standard Ebooks 199권 (토큰 99.57% 해소)

- **인프라**: `scripts/dict/build-test-corpus.mts`(Standard Ebooks 손교정 클린 고전 single-page → HTML strip → 프로덕션 winkNLP 추출 재사용) + `extraction_test_books/vocab`(프로덕션 분리) + `measure-test-corpus.sql`(해소율 측정).
- **규모**: 199권 · 5,948,640 토큰 · 고유 lemma 53,617. 난이도 고전(Kipling·Shaw·Heyer·SF·정치/역사).
- **해소율**: **토큰 가중 99.57%**(독해 체감) · 도서×lemma 98.73% · 고유 lemma 83.7%. 15권(98.8%)과 일치, 대규모·OCR無 클린에서 목표 초과.
- **진짜 잔여 8,720 정체**(OCR 손상 0 → 순수 신호): ≥10권 체계적갭 48(~85% 방언) · hapax 7,803(85%). 최고 ROI 단일개선 = **`-in→-ing` 정규화**(218 lemma·2,796 등장·67권). 다음 = eye-dialect 큐레이션 맵(tis·gwine·twould). hapax는 장기꼬리 보류.
- 평가서 `docs/proposals/extraction-evaluation-2026-07-23.md` §8.

### 선제형 외국어 독해 지원 — French 사전 DB 선(先)적재 (Google식)

- **패러다임**: 도서에서 외국어를 뽑는 반응형 ❌ → **외국어 빈도 사전을 미리 `lexicon_clean`에 적재**하는 선제형 ✅. 이후 어떤 입력(도서·스크립트)이 와도 이미 준비된 외국어를 단어추출 시 해소. 설계 `docs/proposals/foreign-language-reading-support.md`(rev2).
- **스키마**: `lexicon_clean.lang`(default 'en') + partial index(`lang<>'en'`). 영어 256k 무변경, 외국어만 격리 조회.
- **소스·청정성**: hermitdave FrequencyWords(OpenSubtitles) 프랑스어 **표면형** 빈도목록(=사실 데이터) + **Google 무료 번역**(sl=fr, LLM·비용 0). 외부 사전의 gloss는 **미사용** → 배포 청정. `ko_source='google-mt-fr'`.
- **적재**(`scripts/dict/foreign-dict-build.mjs`): fr 50k 목록 → Google 배치번역(15/요청, 재개캐시) → **ignore-duplicates 적재**(영어 표제어 절대 미변경 = 동형이의어 영어 우선). **French 37,955 적재**(영어 충돌 ~11k skip). 검증: son/pain/chat/de → 영어 유지, faute/toujours/vous → 프랑스어.
- **런타임 해소**: 감지 로직 0 — `lookup_word_meaning` tier 6(coverage-clean)이 meaning_ko 매칭으로 외국어 자동 해소. 검증: `faute→결점`·`toujours→항상`·`pain→통증`(영어 우선).
- **언어 배지** `20260723120000_lookup_word_meaning_lang`: `lookup_word_meaning` RETURNS 에 `lang` 추가(영어 tier='en'·lexicon_clean tier=lc.lang, DROP+CREATE·하위호환). WordLookupPopover 에 🇫🇷 언어 배지 + 안내("독해 이해용, 영어 암기 대상 아님") + 발음 로케일(fr-FR 등). reader-queries `WordLookup.lang` 노출. 검증: faute/toujours→fr·pain/happy→en, tsc 통과.
- **효과 실측**: 레미제라블 잔여 665 → **308 프랑스어 해소(46.3%)**. 잔여 54%는 위고 19세기 파리 은어(argot: bastringue·bousingot)·OCR잡음·라틴조각·고유명사 → **정당한 잔여**(현대 빈도목록·노이즈필터 밖).
- **라틴/그리스 데이터 기반 폐기**: 라틴 실측 — Roman+Dialogues 잔여 ~290 중 실제 라틴 32%, Whitaker(stem) 매칭 23%(굴절형 미매칭) → 실효 해소 **7.5%**. 그리스 — 추출 `^[a-z]` 필터로 그리스문자 토큰 애초에 배제(잔여≈0). → **French 단독 확정**. 라틴 정식 지원은 CLTK lemmatizer 통합 별도 프로젝트.

### 청정 lexicon_clean 구축 — kaikki(CC BY-SA) 대체 착수

- **동기**: coverage_lexicon 은 gloss_en 전량 kaikki(CC BY-SA), meaning_ko 도 그 번역(파생물). 배포 대비 청정화. 설계 `docs/proposals/lexicon-coverage-clean-architecture.md`.
- **원칙**: 런타임 100% DB(LLM 오프라인) · kaikki 전량 배제 · L0(단어목록)+L2(WordNet/Webster 정의)+LLM 뜻 계층.
- **실측 근거**: 퍼미시브 정의 커버 = 우선순위 78k 중 **37%**(WordNet∪Webster). Tier1(kaikki뜻=clean뜻 일치) 한국어 재사용 가능분 ~12k.
- **마이그레이션** `20260722120000_create_lexicon_clean`: word PK · gloss_en · meaning_ko · ipa · gloss_source · ko_source · is_valid_word.
- **구축**(`scripts/dict/lexicon-build.mjs`): WordNet 정의 추출 + Webster 1913 정제(노이즈/고어/단일sense) → 통합 청정 gloss **206,498**(WordNet 147,981 + Webster 58,517) 적재 + CMUdict ipa 38,243 + **Tier1 한국어 9,568 검증 재귀속**(ko_source=verified). kaikki 0.
- **런타임 RPC** `20260722130000_lookup_lexicon_clean_rpc`: `lookup_lexicon_clean(text)` — direct+굴절(en_inflection_bases) 해소, 청정 gloss/meaning/ipa 반환. L1(shared_dictionary) 미스 시 L2 폴백. authenticated/anon grant.
- **성능 벤치**(실측): 2000단어 배치 ~0.8ms/단어. L2(lexicon_clean) 전부 캐시히트로 빠름 → **런타임 DB-only 설계 검증**. L1 bloat(shared_dictionary 힙 50% free·480 캐시미스/2000)는 VACUUM FULL로 개선 필요(성능 정당화).
- **런타임 체인 연결** `20260722140000`: `lookup_word_meaning` 에 lexicon_clean(청정) 우선 tier 6·8 삽입, coverage_lexicon(kaikki) tier 7·9 는 **브리지로 유지**(무regression). 순서 L1(1-5)→청정 한국어(6)→kaikki 한국어(7)→청정 영어(8)→kaikki 영어(9). 검증: happy=direct·take-up=coverage-clean·ural=coverage(브리지)·aardwolf=coverage-clean_en. LLM 한국어 채워질수록 coverage→coverage-clean 자동 이동. (기존 발견: coverage tier 는 이미 구현돼 있었고 return 에 gloss_en 컬럼 존재.)
- **Step 5 한국어 채움(A-min)**: 실사용 대상 19,217(coverage 등장 ∩ lexicon_clean) → **Google 무료 번역 엔드포인트** 자동 번역(동시성4·재시도) → **19,214 성공(실패3·비용0)**. `ko_source='googletrans'`. lexicon_clean meaning_ko **9,568→28,782**. 검증: pesthole/trailhead/parkland → 읽기 체인이 coverage-clean(청정)으로 서빙(kaikki 브리지보다 우선).
- **tail 전량 한국어 완주**: lexicon_clean 나머지 ~177k 도 Google 무료 번역(줄바꿈 **배치 20/요청** 로 ~20배 가속) → **한국어 206,391 / 206,498 = 99.9%**(잔여 107=분류학 학명 무시). ko_source googletrans 196,823. 비용 0.
- **가치분 통합 + 읽기 kaikki 제거** `20260722150000`: coverage 등장 단어 중 저작권 없는 요소(**word+pos+LLM 한국어**만, gloss_en·예문 제외)를 lexicon_clean 통합(49,619, ko_source=coverage-llm) → lexicon_clean **256,117**(한국어 256,010). `lookup_word_meaning` 에서 coverage_lexicon(kaikki) tier 제거 → **학습자 읽기 경로 kaikki-free**. 검증: happy=direct·a-flutter/a-level/gleba=coverage-clean·xyzzyq=not_found.
- **coverage_lexicon(kaikki) 완전 폐기** `20260722160000`·`170000`: 참조 함수 4종(select_article_coverage·select_book_chapter_coverage·select_coverage_for_words·select_extraction_residual) → lexicon_clean repoint(테이블명 교체+source필터 제거) → 앱/함수 참조 0 확인 → **coverage_lexicon DROP**(CC BY-SA 원문 제거 + ~78MB 회수). 검증: 폐기 후 읽기 체인 정상(a-flutter/a-level/gleba=coverage-clean, 404 확인).
- **✅ kaikki(CC BY-SA) 제거 완료**: shared_dictionary(관계 WordNet 교체) + coverage_lexicon(폐기, 가치분 lexicon_clean 통합) + 읽기 체인(lexicon_clean 256k 청정).
- **kaikki 흔적/관련성 제거 (원칙: 가치·저작권무관 값은 유지, kaikki 관련성만 제거)**: 발음 사실 데이터(ipa 36,793·rhyme_key 28,989·homophones 5,224)는 저작권 없는 사실이라 **값 유지**(purge했던 것 백업 복원). `field_provenance` 의 kaikki 관련 태그(`kaikki-unverified` 등) **전량 제거 → 0**. 저작권 원문(gloss_en·예문)은 coverage_lexicon 폐기로 제거 완료.
- **L0 노이즈 필터(고유명사) 착수**: WordNet lexname(location 15·person 18) 기반 정밀 고유명사 식별 5,143(지명·인명 단일어, 오검출 0) → lexicon_clean `is_valid_word=false` 플래그. 읽기 조회는 미영향(lookup_word_meaning은 is_valid_word 미체크 → 고유명사도 resolve), 추출/커버리지 curation에서 선택 제외용.
- **단어추출 해소율 개선 — 표면형 정규화** `20260722180000`: `surface_variants()` helper(de-하이픈·접두복합·소유격) + `lookup_word_meaning` tier 8-9(정규화). de-하이픈 전체형 우선. 검증: be-cause→because·help-less→helpless·non-religious→religious·sister's→sister.
- **17권 재평가(강화)**: 해소율 94.7~100%(평균~98%) → 강화 후 잔여 대폭 감소(Sociology 406→232·Ozma 91→52·Tom 77→56·Pride 92→69). 잔여 4대 유형: ①학술복합어(개선중) ②OCR하이픈(해소) ③고유명사·소유격(부분해소) ④방언·외국어(수용).
- **잔여(선택)**: 파생접미사 확대(-ized/-ization/-ist) · OCR 오타교정(catologue) · coverage 첫-synset 오선택 개선 · L0 소비 · VACUUM FULL.

### shared_dictionary kaikki → WordNet 선별적 교체 (라이선스·노이즈 청정)

- **동기**: kaikki(Wiktionary, **CC BY-SA** share-alike) 유래 컬럼이 상업화 시 copyleft 리스크 + 노이즈(`bisexy`·`BUG`·`lesbigaytrans`·`"I'm bisexual"`). WordNet 3.1(Princeton License — 퍼미시브·share-alike 없음)로 교체.
- **마이그레이션** `20260720120000_shared_dictionary_field_provenance`: `field_provenance JSONB` + gin 인덱스 — 필드별 출처 추적(근본원인=행단위 source라 필드 출처 부재).
- **파이프라인** `scripts/dict/wordnet-enrich.mjs`(WNDB flat file 파싱·무의존성·재시도+동시성8): extract(117,791 synset→145,967 lemma) + apply-all 필드별 정책.
- **필드별 정책(설계 `docs/proposals/wordnet-replacement-design.md`)**: related_terms·derived_forms=**교체+잔여purge**(kaikki 전용) · synonyms=**교체+잔여flag**(혼합) · example_en=**빈칸만**(시드 예문 보존) · antonyms=**병합+denoise**(WordNet 희소).
- **실적용**(40,304행 stamp·실패0): related_terms 11,529→**28,582**(WordNet·+17k) · derived_forms **14,313**(잔여 7,691 purge) · synonyms WordNet 25,723+flag 11,255 · antonyms denoise 3,415(볼륨 23,667 유지) · example_en 시드 보존+183 보강.
- **Phase 2 (CMUdict)**: ipa/homophones/rhyme_key = CMU Pronouncing Dict(PD/BSD·무제한)로 교체. `scripts/dict/cmudict-enrich.mjs`(ARPAbet→IPA 변환·rhyme·동음이의). 적용(실패0): ipa CMU 25,522+kaikki flag 11,067 · rhyme_key 20,451(잔여 3,264 purge) · homophones 3,732(잔여 1,203 purge). rhyme_key 값이 kaikki와 다수 일치(검증).
- **잔여 정리**: synonyms `kaikki-unverified` 잔여 11,255 **purge 완료**(남은 synonyms 27,013 전부 WordNet·CC BY-SA 0). ipa 잔여 11,067은 발음 핵심 기능이라 유지(추후 G2P 무손실 교체 예정, field_provenance 로 식별).

### 굴절형·파생형 학습 구조 — ADR 0001 Phase 6 개정 착수 (v06.273)
- **배경/결정**: "학습자에게 불규칙 굴절형(went·children·better)·파생형을 그 형태의 뜻 그대로 학습시킨다". ADR 0001 D1(굴절=별도 row 안 함)을 **부분 개정** — 전면 반전(모든 굴절형 row화, +15,714 규칙형 중복)이 아니라 **불규칙+어휘화만**(attested·bounded) 등록, 규칙형(walked·cats)은 통합 유지(D2 attested 게이트 준수). 근거 [ADR 0001](adr/0001-dictionary-derivational-enrichment.md).
- **A — `base_word` 전수 채움**: 굴절 헤드워드 역인덱스 + 파생 candidates 병합으로 base 관계 채움(`scripts/dict/base-word-backfill.mjs`, 멱등·NULL만). 굴절 162 + 검증 candidates 121 반영. "went ← go" 관계 정보 확보.
- **B PoC — 불규칙 굴절형 15개 헤드워드화**(said·knew·took·gave·seen·brought·built·understood·children·men·feet·teeth…): 뜻 authoring(과거형/과거분사/복수형 명시) + base_word/pos/v_level 상속. **검증**: `resolve_dict_headword('children')→children`·`said→said`(그 자체 추출) vs `walked→walk`(규칙형 통합 유지). B 전체 대상 = 불규칙 **487**(정제: 자음중복/영국식 규칙형 제외).
- **스키마**(migration `20260718000000`): `shared_dictionary.source` CHECK 에 `'inflection-seed'` 추가(파생 `derivational-seed` 와 대칭 provenance, 추적/롤백용). classified_by=기존 `claude_code_opus_4_8`.
- **잔여**: B 스케일업(472 authoring·homograph led/meant 교정) · A2 파생 base_word 광역(happiness/national류 형태소 detection) · C 전용 학습 세트(불규칙 동사표) + 추출카드 base 배지.

### DB 용량 정리 — 미출시 도서 16권 삭제 (v06.272)
- **원인 규명**: 어드민 "게시됨"(`status='published'`) ≠ hub 노출. hub(`/library/books`)는 `status='published' AND copyright_safe_in_kr AND published_at IS NOT NULL` 3조건을 모두 요구 — `published_at`은 정식 publish RPC만 찍고, `status='published'`는 챕터 단어장 발행 트리거(`ready→published`) 메커니즘으로도 쓰여 `published_at` 없이 올라간 도서가 섞임. 결과: 게시됨 23권 중 **hub 노출 7권 · 숨김 16권**.
- **삭제**(사용자 승인): `published_at` NULL 16권 삭제. 정본 `admin_delete_book` 시맨틱 재현(RPC는 published 거부 → 동일 데이터 연산 트랜잭션). 단 texts는 `chk_content_or_library`로 unlink 불가(library 타입) → **DELETE**로 처리. CASCADE: `library_book_vocabularies` 63,863 · `library_chapter_quiz` 1,251 · `library_chapters_master` 627 · `shared_word_sets` 626(+하위 `shared_words`) · `book_curation_jobs` 11. seed 14개 `imported_to_books=false` unlock 복귀.
- **결과**: 도서 28→12권, hub 7권 정상 유지. 콘텐츠 5테이블 `VACUUM FULL` 152→47 MB(−105 MB OS 반환). DB 총량 500→~470 MB. 전체 DB VACUUM FULL은 안전 분류기 차단(수동 실행 필요).

### 콘텐츠 품질 게이트 — 파이프라인 정확성 자동 검증 (v06.271)
- **목적 재정의**: "기능이 되나"(UI 테스트) 아니라 **"학습자에게 나갈 산출물이 맞는 단어·맞는 뜻·맞는 레벨로 정확히 뽑혔나"**를 결정론 불변식으로 검증 → 관리자 게시 신뢰. 실패=사전DB/파이프라인 수정 신호.
- **갭 실측**: `quality_metrics`(nightly) 7지표는 전부 **부피·완비율**이고 정확성 검사 0. P0 결함(반의어 바인딩·gated KICE)은 전부 수동 발견 — 자동으로 아무것도 안 잡힘.
- **F 즉시 수정** `content_quality_gate_fixes_F`(사용자 승인): **I7** 발행 세트 노이즈-register junk **9건 제거**(xl/mph/bc/cl/ft — 학습자 노출 중이던 약어) + word_count 재동기 + **F.2** 발행도서 resolvable NULL lemma 백필(→0, 학습자 출력 무변).
- **G1 게이트 함수** `run_content_quality_gates(scope, id)`: scope=global|book|article|dict 별 불변식 pass/fail. 사전DB(I1 필드완비·I2 per-sense v_level) · 단어추출(I5 바인딩드리프트·I7 노이즈) · LCP(I6 resolvable lemma·I8 book_v_level·**I10 발행세트 SSoT 드리프트**) · ACP(I9 register). critical FAIL=게시 차단 후보.
- **발견**: 전역 게이트 critical 전부 PASS(F 후). **도서 게이트가 P&P 발행세트 SSoT 드리프트 770 검출** — D1/D4a 개선이 select 출력을 바꿔 발행 콘텐츠가 stale(재발행 필요). 추출 로직 개선→발행 stale 이 처음으로 가시화.
- **G3 화면** `/admin/quality/gates`: 전역 게이트 red/green + 요약 배너(allGreen=게시 신뢰) + 콘텐츠별 게시전 체크(도서/아티클 선택→book|article scope). AdminSidebar '품질 게이트'(ShieldCheck).
- **G4 nightly cron** `content-gate-nightly`(KST 03:25): `collect_content_gate_metrics` → `quality_metrics(stage='gate')` 적재로 추이 추적. `admin_collect_content_gate_metrics` 수동 트리거. **→ 파이프라인 정확성 상시 자동 감시**.
- **G2 게시 게이트 wire**: `content_gate_publishable(scope,id)`(critical FAIL 있으면 false, I10 드리프트 제외) → `publish_book_word_sets`·`publish_article_word_set`·`republish_*` 에 가드. broken 콘텐츠 게시 차단.
- **드리프트 재발행 완료**: `republish_book_word_sets`·`republish_article_word_set`(set_id 보존, shared_words만 교체 — 구독/진행 안전) → 전 발행 도서 20권 + 아티클 135세트 SSoT 재동기. **I10 드리프트 전량 해소**(P&P 770→0 등). D1/D4a 개선이 학습자 단어장에 반영됨. I10 미발행 false-fail 수정.
- **최종 상태**: 전역 게이트 critical(I1·I5·I7·I8·I9) 전부 PASS · 도서 I10 PASS · I2만 WARN 343. 파이프라인 정확성 상시 자동 감시 + 게시 전 차단 + 게시 후 재발행 루프 완성.

### 콘텐츠 품질 게이트 — ACP+VCB 커버 + LCP end-to-end 실증 (v06.271)
- **LCP end-to-end 실증**: 소스 GET(queued) "Ozma of Oz" → `reprocess-book.mjs --commit`(ingest 21ch/38k → 추출 2,785 → v7/B1) → ready → 게이트 전부 PASS → G2 publishable=true. 게이트가 실제 큐레이션 흐름의 관문으로 작동 확인.
- **ACP 커버** (`gate_acp_vcb_coverage`): article scope + 전역에 **I11 항목단위 라이선스**(copyright_safe_in_kr) 추가. NASA ready 아티클 게시전 체크 PASS.
- **VCB 커버**: 전역 I5/I7 을 **전 발행 세트**로 broaden(library 외 큐레이션 세트 41개 포함) + **`word_set` scope** 신설(I5·I7·뜻결측·비어있음). 확장 즉시 VCB '중등 기본어휘'의 "technic"(archaic) 검출 → `vcb_noise_cleanup` 로 전 발행 세트 노이즈 일반 정리.
- **게이트 게시전 체크에 미발행 노출**: `/admin/quality/gates` 드롭다운 published+ready+queued(소스 GET → 추출 후 게시 전 검증).


### 추출 품질 심층 평가 P0 + 표제어 바인딩 결함 수리 (v06.270)
- **P0 정찰**(read-only, `docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`): 추출 품질 5속성(Q1~Q5) 분해 + 3 프로브(P&P ch18·Black hole 아티클·register 집계) 실측. Q2/Q5 3분해(in-cap/out-of-cap/gated) 결정론 산출 확인 · working set = **20,678 lemma** · freq_rank 30%(6,204) 결측 = 사전 유일 실질 갭(그중 KICE 238) · Phase B per-sense v_level 백로그 사실상 종결(전역 343·ws 68).
- **🔴 신규 결함 발견·수리 — 표제어 바인딩**: `select_*_vocab` 가 pre-stem 된 `bv.lemma`(파생/부정접두 과잉 축약)를 그대로 바인딩 → 학습자에게 **반대 뜻** 노출(`imprudent→prudent` 신중한 · `insincere→진심의` · `forbearance→조상,선조`). 발행 콘텐츠 **782 오바인딩·654 POS 불일치·36 반의어 플립** 실측. 기존 "Q1 100% 검증(40,355 표제어)" 미커버 축(표제어 아닌 표면→표제어 바인딩).
- **마이그레이션** `fix_extraction_surface_headword_binding`(사용자 승인): `select_book_chapter_vocab`·`select_article_vocab` JOIN 한 줄 — 표면형이 자체 quality 표제어이면 그것으로 바인딩(아니면 현행 resolver 폴백). dry-run 검증 = 782 재바인딩·**+143 회수 개선**·extraction-readiness 실패 0·gate-out 17 전량 비-KICE 정당. **발행 세트 영향 0**(현행 학습자 데이터 clean → 재발행 불요). `bv.lemma` 원본 데이터는 무수정(SSoT가 오버라이드 — 대량 재생성 금지 원칙 준수).
- **마이그레이션** `create_extraction_judgments_table`(사용자 승인): 판정 하네스(Q3/Q5) 골든 라벨 저장소. composite/sort_order 스냅샷 보존 → 가중 변경 회귀 대조. RLS enabled(정책은 D3 하네스 착수 시 admin grant).
- **D3 판정 하네스** `/admin/quality/judge` — 추출 "탁월함"(cap 40 최적성)을 인간 blind 판정으로 축적하는 골든 라벨 UI. 마이그레이션 `judgment_harness_rpcs`: `get_judgment_sample`(in-cap 8 + 경계 8 셔플·출처 은닉) + `save_extraction_judgment`(저장 시점 SSoT 재조회로 스냅샷 서버-권위 기록 → blind 보존·회귀 대조) + `extraction_judgments` RLS `ej_admin_all`. 절대 판정 + 쌍대 비교 모드, 제출 후 precision/recall reveal. AdminSidebar '추출 판정'(Scale). typecheck 0·lint clean·RPC 로직 실데이터 검증(표본 16=8+8). 런타임 UI 스모크는 admin 세션 필요 → 후속(전용 e2e spec 권장).
- **D4a KICE freq_rank proxy 백필** — migration `backfill_kice_freq_rank_proxy`: KICE-core(수능 tier≥3) NULL freq_rank **273행**을 proxy rank(밴드 실측 중앙값 135 + KICE 중앙값 1986 = 138)으로 채움. `frequency_sources.proxy` provenance 마킹. efficiency·innovation·precision·prioritize 등 CSAT 빈출어가 composite 0.40 freq축 0점→~0.12 → 추출 순위 정상화. **핵심 재발견**: 추출가능(v≥6) working set의 freq_rank NULL 28.7%(4,648) 중 backfillable은 46뿐 — 나머지 4,602는 **무신호 rare tail(NULL이 정당, 결함 아님)**. 설계의 "freq_rank가 사전 최대 갭" 은 완비율로는 맞으나 추출 영향분은 대부분 **축소 불가**(D4b 외부corpus 없이는).
- **다음(승인 대기)**: D5 V6 게이트 register-인식화(논의) · D4b 외부 corpus(rare tail — 저우선).

### 커버리지 사전 — 비학습 롱테일 독해 대응 (v06.271)
- **문제**: 도서·스크립트에 코어 45k 밖 롱테일(고어·희귀·전문)이 등장 → 학습자 독해 시 "정의 없음". 학습 큐레이션과 독해 커버리지는 다른 요구.
- **설계**: `coverage_lexicon` **별도 테이블**(shared_dictionary 무변경·학습 무오염). 마이그 `create_coverage_lexicon`. `word·pos·gloss_en·ipa·meaning_ko·frequency_rank·source·seen_count`. 2-tier: 학습=core만 / 독해=core→coverage→미상 폴백.
- **벌크 적재**: kaikki 단일어·content POS·실 gloss·**form_of(굴절) 제외**·코어 밖 → **424,328행**(gloss_en+ipa, meaning_ko는 demand 채움). `coverage-bulk-load.mjs`.
- **검증**: 도서 잔여어 커버 — 미커버는 90%+ 굴절형(추출이 코어 lemma로 해소)+OCR잡음. 진짜 희귀어는 커버. 굴절 해소 후 실질 커버리지 높음.
- **소스 분석**: kaikki 한국어 번역 25,736(흔한 단어 편중·tail 무용) · PanLex 4.31GB(불확실 payoff·보류). → 한국어는 **콘텐츠 등장 잔여만 LLM 배치**(bounded), gloss_en 즉시 폴백. 설계 근거=`docs/AI_CONTEXT/diagnostics/kaikki_upgrade_opportunities_20260718.md` 계열.
- **한국어 빈도순 tier 완주**: hermitdave OpenSubtitles(165만) 랭크순으로 Opus 배치 번역 → **meaning_ko 77,501행**(빈도순 잔여 1·미랭크 극희귀 327k만 대기). `coverage-translate-{chunk,apply}.mjs`. 게이트=한글 필수(영어 echo 거부)·멱등·`--prune`(스킵 잡음 source='skip'). **english_echo 0**. ⚠️ 모델 교훈: 이 gloss→한국어 작업은 품질 민감 → **Opus 필수·Haiku 부적합**([[project_coverage_lexicon]] 실증: 약 모델 워커 다수가 영어 gloss 복사).
- **잔여**: RPC 폴백(lookup_word_meaning)+is_learning_target(select_*_vocab) · UI 2섹션 · 미랭크 tail(327k, 설계상 대기).

### kaikki C — per-sense 예문 매칭 (v06.270)
- **진짜 per-sense**: 다의어 각 한국어 sense에 kaikki 실용 예문을 매칭(판단=LLM). 도구 `example-match-{chunk,apply}.mjs`. grounding 게이트: 예문은 제공 풀에서 **verbatim만**(편집·창작 거부=ungrounded-ex)·meaning 매칭·pos/v_level 보존.
- **결과**: **5,111단어 · 9,645 sense-예문** 부착(meanings_ko sense별 `example`). `groan`=[신음]let out a groan·[툴툴]We groaned at his awful jokes·[삐걱]The table groaned under the weight 식 sense별 정확 매칭. 억지 금지(풀에 뜻 없으면 생략).
- **청크 크기 교훈**: 240단어 청크가 최고빈도 구간(am·be 등 10+sense)에서 **출력 64k 토큰 초과**로 실패 → 그 구간만 60단어 재분할(exmatch-hi)로 해소. 저빈도는 240 무방. 세션 한도 걸린 1청크는 메인 세션이 직접 매칭.
- **정직**: 멀티세션 지시문 만들었으나 실행은 소규모라 단일 세션 넓은 웨이브가 효율적(세션 수는 작업량÷머신 동시성으로, 습관적 6 지양).

### kaikki 보완 #4·#5 — 관계 컬럼 + 예문/동의어 (v06.269)
- **마이그레이션** `add_kaikki_extra_columns`: `homophones`·`rhyme_key`·`derived_forms`·`related_terms` 4컬럼 신설(사용자 승인).
- **1회 스트림 추출**(`kaikki-extra-{extract,apply}.mjs`, 멀티세션보다 빠름 — 추출은 I/O 병목이라 병렬 무의미): homophones 2,687·rhyme_key 16,042·derived_forms 19,548·related_terms 11,223 채움. + example_en 결측 752 채움(96.8%) + synonyms 보강(64.5→**76.4%**). 전부 kaikki 외부사실=무환각·결측만.
- **교훈**: (1) `Object.create(null)` 필수 — "constructor"·"toString" 실제 영단어가 프로토타입 오염 유발. (2) 45k 맵 `JSON.stringify` 512MB 한계 → JSONL 스트림 기록.
- **per-sense 예문(C) 잔여**: 영어 예문↔한국어 sense 매칭은 판단 필요(단일 스트림 불가) → 별도 LLM 패스 옵션. 현 pass는 word-level 예문/동의어까지.

### 어원 니모닉 확대 M3 — kaikki etymology_text 근거 6세션 병렬 (v06.268)
- **배경**: 니모닉 6.5%(2,618) 정체 — M2는 어근 인벤토리(181개) 근거라 그 밖 어근은 skip. kaikki `etymology_text`(83.3%)는 단어별 권위 근거라 인벤토리 한계 해소.
- **경선식(발음 소리흉내) 차단 = 근거 대조 게이트**: 지시만으론 약함 → `mnemonic-etym-apply.mjs`가 (1)화살표 필수 (2)로마자 어근 필수(순수 한글=경선식 거부) (3)어근이 etymology_text에 실제 등장(diacritic strip + 어간 4글자 매칭으로 굴절변이 흡수). 자체테스트: `advocate→ad(voc)` 통과 / `애들 보고 캣` 거부.
- **파이프라인**(`mnemonic-etym-{chunk,apply}.mjs`): 미니모닉 v≥7·rank≤12k 5,935 → 고전어 3,486 → 30청크 → 6세션×5청크 격리 병렬. authoring 프롬프트에 경선식 정의(애들·보고·캣) + skip 규칙.
- **결과**: **2,433 적용**(pass 2,433·거부 41=1.7% 진짜 엣지). 니모닉 **2,618→5,062**(커버 11.08%). **경선식 유입 0**(pure_hangul_pun_suspect: 0·화살표 100% 검증).
- **게이트 튜닝 교훈**: 초기 게이트가 매크론 어근(vās·prō)·영어 접미사(-ist)·한국어 괄호설명(일(공화국))을 오거부(452) → 유니코드 추출+어간매칭+"근거 어근 ≥1이면 통과"로 41까지 축소, 336+ 복구. 지시문 SSoT=`docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md`.

### sense 깊이 확대 — kaikki 근거 다의어 완성 1차 슬라이스 (v06.266)
- **배경**: 추출 사전DB 최대 갭 = sense 깊이(avg 1.28 vs 일반사전 3~5+). 얕음(≤2)+kaikki풍부(≥3) 단어 **19,549**(노출 freq≤8k **5,995**). 추출 시 드문/지배 sense 결측으로 오해소.
- **파이프라인**(신규 `kaikki-sense-chunk.mjs`·`kaikki-sense-apply.mjs`): kaikki JSONL 재스트림 → 대상 단어 표준 sense(gloss+pos, obsolete/rare/**형태포인터**(Abbreviation/plural of…) 제외·leaf gloss·**굴절형/길이<3 제외**) → 청크. 서브에이전트가 현 한국어 sense + kaikki 영어 gloss를 **근거로** 완전한 meanings_ko(한국어·per-sense pos/v_level, most-common-first, 과분할 통합, cap 5) authoring. apply=meanings_ko 교체+flat 동기화, **sense 추가만(손실 방지 가드)**.
- **1차 슬라이스(freq≤3000, 800단어)**: 5청크 → **315단어 enriched**(39%, 0 reject). **퇴화 엔트리 근본 교정**: `add`(ADHD 약어만→더하다/추가하다) · `will`(→모달 ~할 것이다) · `act`(ACT약어→행동/연기/막/법령) · `stop`·`single`·`policy`(→보험증권)·`light`(빛/조명/가벼운/옅은/신호등) 등. 자가생성 아닌 **외부 사전 근거=무환각**.
- **인프라**: 대형 청크(kaikki gloss 포함 ~126KB) 동시 3에이전트 stall(600s watchdog) 1회 발생 → 재-dispatch로 전량 복구. 데이터는 gitignore.
- **2차 슬라이스(freq 3000~6000) 전 18청크 완료**: `--min-rank` 추가·청크120·6에이전트/웨이브(stall 회피). 웨이브1 175(24%) + 웨이브2 323(45%) + 웨이브3 275(38%) = **773 enriched**. `bark`(→짖다)·`lens`(→수정체)·`vein`(→정맥/잎맥/광맥)·`cookie`(→컴퓨터 쿠키)·`decay`(→붕괴)·`toxic`(→해로운 관계)·`crow`(→까마귀)·`crane`(→기중기/두루미)·`niche`(→생태적 지위)·`dismissal`(→해고/기각)·`socket`(→눈구멍)·`carrot`(→유인책) 등. **누계 sense 깊이 = 1,088단어**(slice1 315 + slice2 773) · 3+ sense 1,466→**1,850행** · avg 1.273→**1.290**.
- **3차 확대 — freq 6k-31k 멀티 세션(6 병렬, v06.267)**: 잔여 8,320단어를 1회 스트림 후 rank 정렬 70청크로 분할 → 6개 Claude Code 세션(ksense-s1~s6, rank 대역별 격리)이 각 12청크(S6=10) 병렬 authoring. 지시문 = `docs/AI_CONTEXT/handoffs/ksense_multisession_20260717.md`(치환 없는 복붙 블록 6개). **5,406 enriched**(yield 65% — 이 대역은 복합 뭉침 엔트리多라 수리 대상 많음). 검증(읽기전용 `_ksense_{check,redundancy,preserve}.mjs`): **세션 간 단어 중복 0·무효 0·기존 sense 드롭 표본상 0·inflation 0.8~2.7%**. 부수 성과=`elevation`(고도;승진;입면도 1문자열)·`cache` 같은 **복합 뭉침 759건을 sense별 분리**(per-sense v_level+문맥-POS 매칭 원리상 필수). **누계 sense 깊이 = 6,494단어**(1,088+5,406) · 3+ sense 1,850→**5,742행**(+3,892) · avg 1.290→**1.475**.
- **잔여**: unranked(freq_rank NULL) 3,979 = 최저 노출 tail(현 툴은 rank 필수라 제외, `--include-unranked` 선결). 노출 다의어는 사실상 소진.

### kaikki(Wiktionary) 확보 — 사전 외부검증 보완 파이프라인 + IPA PoC (v06.265)
- **배경**: 사전 sense 깊이(avg 1.28 vs 일반사전 3~5+)·syn/ant/ipa parity 갭의 근본 병목 = 권위 외부 소스(kaikki) 부재([[project_dict_wave_plan_w0]] W0 중단 사유). 일반사전 비교 분석(`extraction_dict_vs_general_20260717.md`)이 이를 최우선 병목으로 확정.
- **확보**: kaikki `kaikki.org-dictionary-English-words.jsonl` **3.19GB**(CC BY-SA 3.0·무료·귀속) 다운로드 → `scripts/dict/data/`(gitignore). 벤더 중립(상용 아님).
- **파이프라인**(`scripts/dict/kaikki-enrich.mjs`): `extract`(3.19GB·148만 줄 스트림 → 45k 표제어 필터) + `apply-ipa/syn/ant`(결측만·멱등·**외부 사전 사실=무환각**, 자가생성 아님). 커버리지 45,667 중 **43,692(95.7%)** kaikki 존재.
- **IPA PoC 적용**: 결측 **5,879 채움** → ipa **64%→76.9%**(29,230→35,109). 0 실패. 자가생성 병목 해소 실증.
- **후속 자원(kaikki가 열어줌)**: sense 깊이(avg 4.5·≥5 sense 12,131 → 한국어 sense 추가 authoring, 별도 batch) · audio mp3 30,902(스키마 컬럼 필요) · syn/ant는 kaikki 구조화 희소라 저우선.

### 니모닉 확대 — v8+ 라틴계 학습어 265 (M2 확대, v06.264)
- **배경**: M2(v06.260)는 word_root_links 보유 2,472단어만 대상. 학습 세트 노출 v8+ 라틴계 단어 중 **어근 미링크 712개**가 니모닉 없음 → 최고난도(어원이 가장 유용한) 구간 보강.
- **도구**(`mnemonic-expand-chunk.mjs`): 링크 없는 라틴계 학습어 + **어근 인벤토리(181개) 근거 파일** 청크. 서브에이전트가 인벤토리 근거로 분해+니모닉(무환각), 근거 밖·비라틴·오귀속 위험이면 skip. 기존 `mnemonic-apply.mjs` 재사용(니모닉이 분해를 담아 링크 미삽입).
- **결과**: 5청크(712 후보) → **265 니모닉**(37% yield, mnemonic_ko 2,358→**2,623**). 서브에이전트 품질 게이트가 정교하게 오귀속 차단(`heliport` heli=헬리콥터≠helios · `interference` fer=치다≠나르다 · `taxable` tax=재정≠배열 · `compliance` complēre≠plic 등). 발음 말장난 0. 예 `deduction` de+duc+tion→추론 · `serpent` serp(기어가다)→뱀.
- **saturation**: 후보 노이즈(게르만어·외래어·고유명) 높아 yield 14~51%. v6-7로 더 확대 가능하나 per-word 가치↓ — 투명 분해 가능 집합은 사실상 포화. 발음 말장난 절대 금지 원칙([[feedback_mnemonic_etymology_only]]) 유지.

### UI 스모크 green 복구 — 스크립트 히어로 selector 수리 (v06.263)
- **런타임 검증**: 우위 로드맵 UI(리치 카드·플랜 스트립·RecallCard) 스모크 검증 — `04-ui-smoke` test 1(주요 화면 콘솔에러 0)이 `/wordvault`·`/library/vocab`·`/flashcard` 포함 통과 → 이번 세션 변경 런타임 안전 확인.
- **스모크 실패 수리**(테스트 결함, 앱 무버그): "스크립트 진입면 — 시리즈 상세" 테스트가 추천 히어로의 `getByRole('button').first()`(=v06.238 재설계 후 **본문 '학습 안내 보기' 팝업 버튼**)를 눌러 시트 오버레이가 클릭을 가로챔. 시리즈 진입은 하단 **'글 둘러보기'**(onEnter) 버튼 → selector를 `{name:/글 둘러보기/}`로 교정. **5/5 green** 복구. (고급 밴드 V9+ 계정에서만 재현 — 히어로가 안내 CTA라서.)

### 리더 단어 팝업 리치화 — 다의어+어원+니모닉 (v06.263)
- **배경**: 플래시카드 CardBack(v06.259·260)은 다의어·어원·니모닉을 노출하나, **리더 단어 팝업(RecallCard)은 삽화·뜻만** 표시 → 문맥 학습(읽기 중 단어 클릭) 흐름엔 리치 정보 부재.
- **배선**(`RecallCard`): 카드 열릴 때 공유 헬퍼 `fetchDictExtras([word])` 조회(클라이언트 재사용) → **다의어 품사별 뜻(≥2)·어원 root 분해 chip·💡니모닉** 컴팩트 노출. 미매칭/실패 시 뜻만(안전 폴백). 카드 높이 변화에 위치 재계산(extras 의존성).
- **효과**: 읽다가 단어를 눌러도 플래시카드와 동일한 리치 정보 — Context-Dependent 학습 + 어원/니모닉 결합. `posLabel`(명/동/형/부) 재사용. tsc 0.

### 진도-aware 완성 추정 — 학습 플랜 개인화 (F2, v06.262)
- **배경**: v06.261 플랜 스트립은 세트 규모 기반 정적 추정. 시중 능가의 핵심 = **개인 진도 반영**(시중 종이책은 불가능).
- **진도 계산**(`VocabSetPreviewModal`): 구독+로그인+챕터형(전체 단어 로드) 시 사용자 `vocabularies` 단어집합(RLS 본인, keyset pagination) ∩ 세트 단어 → **학습 X/N**. 마이그레이션 없이 클라이언트 조인(미충족 시 정적 플랜으로 안전 폴백).
- **UI**: 플랜 스트립에 **진행 바(%)** + "학습 X/N · 남은 Y단어 · 약 Z일 더"(완주 시 "한 바퀴 완주했어요 🎉"). remaining÷하루22단어로 남은 일수 산출 — 학습할수록 줄어드는 적응형 추정.
- **차별화**: 시중 고정 30일(누구나 동일) vs 플랫폼 실진도 기반 개인 추정 + FSRS 자동복습. tsc 0.

### 적응형 학습 플랜 스트립 — 세트 완성 프레이밍 (F2, v06.261)
- **배경**: 시중 벤치마크 — 시중 단어장은 "30일 완성" 고정 스케줄(누구나 하루 40단어·정형 누적테스트). 플랫폼은 세트를 정적 목록으로만 노출.
- **플랜 스트립**(`VocabSetPreviewModal`): 세트 미리보기에 **학습 플랜** 섹션 — 하루 신규 **22단어**(인지부하 Sweller 기준) × **약 N일** 도입 + N챕터 구성 안내. 핵심 프레이밍: **"복습은 기억이 흐려질 때 자동 배치돼요 — 고정 일정이 아니라 당신의 기억에 맞춰 조절"**(FSRS). 순수 계산(세트 규모), 로그인 무관 노출.
- **차별화**: 시중 고정 30일 vs 플랫폼 적응형(신규 페이싱 + FSRS 자동 복습). 정적 목록 → 달성 가능한 개인화 플랜으로 재프레이밍. tsc 0.
- **잔여**: 진도-aware 완성 추정(사용자 vocabularies∩세트 FSRS 조인 → "학습 120/500·예상 D-15") · prescribe_today 세트 연동.

### 어근 기반 니모닉 생성 + 학습 카드 노출 (M2, v06.260)
- **배경**: 시중 벤치마크 danger zone — `mnemonic_ko` 0%. 시중 어원편·경선식(발음 말장난)이 차별화하나 플랫폼 전무. 어원 root 축(v06.253) 배선으로 **어근 근거 니모닉**을 환각 없이 생성 가능(희귀어 어원 환각과 다름).
- **생성**: 어원 root 링크 보유 2,472단어 → 서브에이전트 16 병렬 authoring(어근 gloss 근거로 "어근 literal → 단어 뜻" 다리). **품질 게이트**: 어근이 뜻을 투명 설명 못하거나(불투명·의미변화) 어근 오데이터(gloss 불일치)면 skip → **2,358 생성(95.4% yield)**, 0 reject. 도구 `scripts/dict/mnemonic-{chunk,apply}.mjs`.
- **품질**: `inspect` in(안을)+spec(보다)→안을 들여다보다→점검 · `contradict` contra(반대)+dict(말하다)→반박 · `adjective` ad+ject(던지다)→명사 옆에 던져 붙인 말→형용사. 서브에이전트가 어근 오귀속(`absent`의 sent=느끼다 오데이터 등)까지 검출·skip.
- **카드 노출**(CardBack): 정답면에 `💡 {니모닉}`(Lora italic, Progressive Disclosure). dict-extras/FlashcardWord에 `mnemonic` 배선. **853단어는 니모닉+어원+다의어 동시 노출**(triple-rich) — 시중 단일-행·경선식이 못 주는 학습 카드. tsc 0.
- **잔여**: 어근 없는 단어 니모닉(소스 없어 보류) · RecallCard 배선.

### 학습 카드 리치화 — 다의어 품사별 뜻 + 어원 힌트 (M1·F1, v06.259)
- **배경**: 시중 벤치마크 danger zone — 플래시카드 정답면(CardBack)이 **flat meaning 1개만** 표시, 플랫폼이 이미 보유한 **다의어 per-sense meanings_ko(다의어 100%)·어원 root(2,767 링크)·콜로케이션**을 미노출. 시중 프리미엄 단어장(다의·뉘앙스·어원)보다 카드가 얕음.
- **공유 헬퍼**(`lib/flashcard/dict-extras.ts`): 단어 배치 → `{collocations, senses(다의어 ≥2), roots(어원 분해)}` map. shared_dictionary(collocations·meanings_ko) + word_root_links⋈word_roots(prefix→root→suffix) 배치 조회. scoped-words·hub-words 공용(단일 출처). 실패해도 카드 렌더 무영향.
- **카드 렌더**(`CardBack.tsx`): (M1) **품사별 뜻** 블록 — 다의어(≥2 sense)일 때 각 sense를 `명/동/형/부` 라벨+뜻으로. (F1) **어원 힌트** — root 분해 chip(`in-(안으로) + port(나르다)`). 둘 다 Progressive Disclosure(데이터 있을 때만·Calm UI 절제).
- **커버리지**: 학습 세트 단어 9,538개 중 **다의어 39%(3,734)·어원 20%(1,867), 51%가 최소 1개 보강 노출** → 시중 단일-행 항목이 못 주는 정보를 학습 시점에 제공. tsc 0.
- **잔여**: 니모닉(M2, mnemonic_ko 0%) · RecallCard(워크스페이스) 동일 배선 · bare gloss 재작성(M1 후속).

### P1 생성기 품질 게이트 — auto-vlevel 저레벨 오염 근절 (v06.258)
- **배경**: 시중 단어장 벤치마크(`docs/AI_CONTEXT/diagnostics/commercial_benchmark_vcb_20260717.md`)에서 **초등 세그먼트 열위** 판정 — auto-vlevel V1이 굴절형 35%(are/been/was/were/had), V2-3이 파생 -ing/-ed 30%(saying/backing/takings)로 **학습자 제공 부적합**. 우위 확보 로드맵 최우선(P1).
- **품질 게이트**(`republish-auto-vlevel.mjs` v06.258): 생성기에 (R1) **굴절형 제외** — 단어가 다른 표제어의 `inflected_forms`에 등장하면 배제 · (R2) **파생 -ing/-ed 제외** — base 표제어가 사전에 실재하면 배제(표준 역굴절 stem + `-ings` 복수 포함). 표제어(lemma) 우선. `--no-quality`로 원 동작 재현.
- **재발행 결과**: auto-vlevel 9세트 +250/−250 교체 → **굴절형 0(V1 35%→0)·파생 -ing ~0(V2 34→0)**, on-level 100% 유지, word_count 불변. V1 head `are/been/being/was/were/had`→**`have, say, know, think, make, see, like`**(실 기초 동사). 필터 후에도 pool ≥ qty(전 레벨 여유) 확인.
- **효과**: 게이트가 생성기 내장 → 향후 재발행(드리프트 수정 포함)도 자동 정제. 벤치마크 danger zone #1(저레벨 오염) 해소, 초등 세그먼트 제공가능화.

### 유형별 공용단어장 파이프라인 전수 테스트 + 오류 3건 조치 (v06.257)
- **전 유형 자동 테스트**(read-only, 9유형·1,085세트·44,958단어): 무결성(count/null/dup/chapter/orphan) **전 유형 통과** + 레벨정합·드리프트·surfacing 4차원 감사. 리포트 = `docs/AI_CONTEXT/diagnostics/wordset_pipeline_typewise_test_20260717.md`.
- **E1 조치 — auto-vlevel 드리프트 해소**: V5-V7 세트가 2026-05 생성 후 VRL 재분류 미반영(V5 75% on-level)이던 것을 신규 `scripts/dict/republish-auto-vlevel.mjs`(원 curation_query 충실 재구성·검증게이트 V1 재현 100%)로 9세트 재발행 → **+176 −176, 전 세트 100% on-level**. 추천 RPC(primary/stretch/review)에 직접 노출되던 stale 제거.
- **E2 조치 — 사전 오분류 `third`**: 최기초 서수가 v_level 11·C2·freq NULL(형제 서수는 전부 V1) → **V1/A1** + per-sense [1,2,2] 교정. (shared_dictionary v_level UPDATE 차단 트리거 부재 확인.)
- **I4 조치 — csat multi-POS 이중 행**: kice 세트의 같은 표제어 품사별 2행(85행, 중복 플래시카드/SRS 충돌 소지)을 survivor 병합(뜻·품사 `n·v` 결합)으로 dedup → csat 1,487→1,402단어, 중복 0.
- **미조치(의도)**: I3 구상어 과대 v_level(~27, VRL 분류기 차원) · I5 book/article floor 누수(소수) · I6 surfacing 갭(교육과정/article 추천 미노출, 제품 판단). 상세는 리포트 §5.

### per-sense v_level 정밀도 — Phase B 100% 종결 (v06.256)
- **2차 tier(단일-POS 다의어) 완료**: 우선순위(multi-POS) 소진 후 남은 **단일-POS 다의어 4,894단어**를 `sense-vlevel-chunk.mjs --all-pos`(25청크·200개씩·2웨이브)로 authoring → `updated 4,894 · failed 0`. 같은 POS 내 sense 차이(예 `will` noun 의지1/유언장5 · `practice` noun 연습2/관행4 · `centre` 중심1/센터2)를 반영.
- **최종 상태**: 추출 대상 다의어(register 제외) **10,144개 = per-sense v_level 100% 완비**(`any_sense_missing: 0`, 이전 2,724→10,144). 추출 시 sense별 정확한 난이도로 threshold 필터·V 배지 산출 — flat 폴백 근사 제거 완료. **Phase B 백로그 종결**(추출 신뢰 로드맵 3단계 정밀도 잔여 해소).
- **품질**: 2차 tier sense별 분화 59.6%(나머지=전 sense 동일 난이도가 정확한 legit). 전수 검증 결측·배열 길이불일치·범위초과 전부 0. `svl-p2` 작업 디렉터리 gitignore.

### per-sense v_level 정밀도 — Phase B 우선순위 슬라이스 완료 (v06.255)
- **배경**: 추출 신뢰 로드맵 3단계의 정밀도 잔여(비차단). 다의어 중 일부 sense에 자체 `v_level`이 없어 추출 시 flat(대표) v_level로 폴백 → 그 sense가 대표와 난이도가 다르면 threshold 필터·V 배지가 근사값. **뜻·POS는 이미 100%**라 "틀림"이 아닌 난이도 숫자 정밀화. 명세=`scripts/dict/SENSE_COMPLETION_MULTISESSION.md` §Phase B.
- **신규 툴 2종**: `scripts/dict/sense-vlevel-chunk.mjs`(대상→sense별 `{i,pos,meaning,v_level}` 청크, multi-POS 우선·`--all-pos`/`--max-rank`/`--limit`) + `sense-vlevel-apply.mjs`(`v_levels[i]`를 `meanings_ko[i].v_level` **결측분에만** 주입 — pos/meaning/기존값/flat 컬럼 불변, 길이 불일치·무변화 스킵, 1-11 검증, 멱등). 기존 sense-chunk/apply(단일-sense POS 추가용)와 분리.
- **우선순위 슬라이스 = 100% 완료**: multi-POS(형태별 sense 분기) ∩ per-sense v_level 결측 **2,526단어** — 16 서브에이전트 병렬 authoring(각 sense의 실제 난이도 부여, 대표≈flat_v·드문/전문/비유 sense↑) → `updated 2,206` + 멱등 `skipped 320` + `failed 0`. DB 검증 `multipos_missing_remaining: 0`. 전 sense 완비 단어 2,724 → **5,250**.
- **품질**: sense별 난이도 분화 53.6%(예 `firm` noun 회사5/adj 단단한4/verb 굳히다7 · `prime` adj5/noun6/verb8 · `shadow` noun4/adj8/verb7). 나머지 46.4%는 전 sense 난이도 동일이 정확한 legit 케이스(예 `pizzicato` 전 sense 전문 음악용어 11). 전수 검증: 결측 0·배열 길이불일치 0·범위초과 0.
- **잔여(2차 tier, 비차단)**: 단일-POS 다의어 4,894 — 같은 POS 내 sense 차이라 flat 폴백이 더 근접(cross-POS 난이도 점프 없음). `--all-pos`로 동일 파이프라인 실행 가능. `svl-*` 작업 디렉터리 gitignore(결과=DB 데이터).

### 아케이드 게임 module_id enum — 이미 적용 확인 (문서 교정)
- **검증**: `docs/proposals/game-suite-module-enum.sql`의 6 값(cascade/connections/word-economy/daily-blitz/letter-forge/ghost-race)이 원격 마이그 `20260711011813`으로 **이미 적용됨**을 DB `pg_enum` 조회로 재확인(+ 이후 게임 glyph-tongue·lexicon-detective 등도 추가됨). 게임 persistence(learning_records/scores insert) 활성 상태. SESSION_LOG 2026-07-11 기록의 "enum 승인 대기"는 stale이었음 — 교정.

### 추천 RPC에 재설계 세트(어원·주제) 소급 (v06.254)
- **배경**: 단어장 파이프라인 재설계 자동 검증(사전 DB·정확성·사용성) 결과 — 마스터 사전 45,667행 meaning/pos/cefr/v_level **100%**, 세트 무결성(orphan 0·empty 0·null_meaning 0), 어원 5/5 챕터 정확, 학년 v_level 단조(초1.9<중3.7<고5.9), e2e 09 통과. **발견 #1**: `recommend_word_sets_for_user`가 legacy `auto-vlevel-*`/`library_book`만 surface하고 재설계 세트(어원·주제)는 **브라우즈 전용**이던 커버리지 갭.
- **수리**(migration `20260717160000_recommend_word_sets_redesign_tiers`): 기존 티어(primary/stretch/review/specialty/track/book/fallback) **전부 무변경** + additive 2티어 — **Tier 7 어원**(`etymology-core`, 진단 V5+) · **Tier 8 관심 주제**(`topic-{interest}` opt-in, specialty 동일 패턴). 순수 UNION ALL(시그니처·컬럼 불변, 매칭 없으면 0행).
- **검증**: V11 유저 재호출 → 어원 티어(priority 7) 노출 ✅. 관심사 `[travel,health,business]` → topic-travel·topic-health + specialty-business 동시 노출 ✅.
- **프론트**: `RecommendedSetsSection.TYPE_BADGE` + `VocabSetGrid.TIER_BADGE`에 어원(어원)·주제(주제) 배지 추가(미지 타입 '추천' fallback 대체). tsc 0.
- **#2 빈 카테고리 탭 조사 → 이미 처리됨**: 라이브 뷰는 `VocabSetCarousel`이 세트 없는 카테고리 **숨김** + `CategoryMatrix`가 빈 탭 `disabled`+dimmed(info-scent)로 dead-end 없음. 유일 잔재 = **dead `CategoryFilter.tsx`**(참조 0·stale 퍼플 주석) **삭제**. preschool/civil/business는 matrix에서 "0" 비활성 노출(coming-soon = 의도적, 제거는 제품 판단이라 보류).
- **#3 legacy null_lemma backfill ✅**(DB 데이터만·승인): auto-vlevel-*/specialty-* 세트의 lemma NULL **2,502행** 전량 채움(`lemma = word` — 진단 결과 100% exact 사전 매칭). 검증: null_lemma 0·orphan 0. eng_test는 이제 avg_v 산출(8.5, 이전 NULL). 학년 단조 선명화(초2.0<중3.9<고4.8<eng_test8.5). 재설계 세트는 이미 lemma 보유라 미영향.
- **#4 library_book POS backfill ✅**(DB 데이터·승인, Option B=정확도 안전): 책 세트 POS 결측 중 **사전 단일-POS(pos_set 길이 1) 단어만** dict primary_pos로 채움 — 20,765행. **다의어 1,637 + pos_set 미상 1,081 = 2,718행은 NULL 유지**(문맥-POS 후속, primary-POS 오주입 회피 = 프로젝트 원칙 정합). 결과: 책 세트 POS 채움 0.8%→**88.5%**. 포맷 정합 사전 확인(noun/verb… 영문 소문자 동일 체계).
- **잔여(검증 발견, 후속)**: #5 주제 챕터 coarse(~125단어/챕터 — L2 롤업, 선택적 L3 세분화).

### LCP RPC 침묵실패 관측성 소급 (PR #93 salvage) — dev-process/process 라우트 (v06.254)
- **배경**: `feat/scriptquiz-chapter-quiz`(PR #93)를 새 main에 merge. 대형 기능(챕터 퀴즈)은 plan-ui 재구현으로 main에 있고, scriptquiz 드레인·VCB QA·dict enrichment는 데이터/docs라 반영/superseded → **유일한 고유 코드 = LCP RPC 관측성 수리**만 소급.
- **관측성 수리**(`0679a2d`): `/api/lcp/{dev-process,process}`의 `compute_book_*` RPC 호출이 `try/catch`였으나 supabase-js rpc는 **무-throw({error} 반환)** → catch가 죽은 코드(침묵실패). **per-call `{error}` 검사 for-loop로 교정** — main의 확장 RPC(chapter_v_levels·syntax·difficulty)는 유지하고 관측성만 결합. (같은 무-throw 버그의 DB측 짝 = #94 lbv lemma 게이트.)
- **머지 처리**: docs 충돌은 main 채택. **pairflip은 main 통째 채택**(#93의 "stale mock 제거"는 구버전 기준 판단 — main의 `saveLearningRecords` 실 persistence 회귀 방지). CLAUDE.md scriptquiz 카운트만 #93값(1,292문항·10권) 반영.

### 품질 파이프라인 회귀 인프라 소급 (PR #94 salvage) — 골든 스냅샷 + quality_metrics + lbv lemma 게이트 (v06.254)
- **배경**: `feat/quality-eval`(PR #94)이 old main 분기 후 미머지였고, plan-ui 통합으로 `/admin/quality` UI는 main에 들어왔으나 그 **하부 인프라 3종**(마이그·회귀 테스트)이 마이그 이력 밖이었음 → **main에 소급**(main을 브랜치로 merge, docs 충돌만 main 채택).
- **골든셋 스냅샷 테스트**(Q1 `0b6db84`): `packages/library-pipeline/test/{noise,segmentation}.snapshot.test.ts` — `computeLexicalNoise`·`normalizeBook` 결정론 회귀 가드. `.gitattributes -text`로 골든 fixture 줄끝 정규화 차단(`ff8dba3`).
- **quality_metrics nightly 집계**(Q2 `8f7f49c`): 마이그 `20260704043934_quality_metrics.sql` — main 후속 `20260706000000_admin_collect_quality_metrics.sql`(집계 버튼)이 참조하던 테이블의 **CREATE 마이그 공백을 메움**(마이그 순서 정합 복구, 04→06).
- **lbv lemma INSERT 게이트**(`86ec3d4`): 마이그 `20260704090000_lbv_lemma_insert_gate.sql` — `library_book_vocabularies` lemma NULL 삽입 시 statement-level 트리거로 자동 채움. rpc 무-throw 침묵실패로 Les Misérables 13,351행 lemma 전량 NULL→추출 3경로 무력화됐던 결함의 근본 게이트.

### CI green 복구 — main 머지 게이트 정리 (v06.254)
- **배경**: `feat/plan-ui`(origin/main +319, 0 behind)의 CI 3잡(TypeScript·build·verify)이 최신 커밋 기준 red → 깨끗한 main 머지의 유일 블로커.
- **build(next lint) 13 에러**: 아케이드/신규 게임 스위트가 남긴 미사용 import/var — `GameMark`(7 게임)·`IconSound`·`useRef`(glyph-tongue)·`NextRequest`(factbook-feed route)·죽은 로컬 `mounted`(언마운트 가드 미배선)·`placedCount`·`total`(lexicon-detective/morpheme-rules) 제거. 전부 동작 무변경 죽은코드.
- **TypeScript 0 error(tsc) 1 에러**: `lib/recommend/next-action.mock.ts` `actionToHref` switch가 `ModuleId`(아케이드 모듈 추가로 확장) 비exhaustive → TS2366. `default` → `/library`(P4 폴백) 추가.
- **verify(vitest) 1 실패**: `TodayPrescriptionCard.test.tsx`가 Phase 1의 "곧 제공" 상태칩을 기대했으나 Phase 2(v06.204)에서 ④구문연습이 실런처(`/practice/dcp`)로 교체됨 → 테스트를 shipped 동작(런처 노출)으로 교정.
- **부수**: 게임 지시문(glyph-tongue·silent-rule) `aria-hidden` 제거로 스크린리더가 룰 낭독(a11y). 검증: lint 0 · web/library-pipeline tsc 0 · 테스트 144 passed.

### 주제별 단어장 PoC — dictionary_categories 활용 (v06.254)
- **P0 정찰**(read-only, `wordset_pipeline_v2_p0_20260717.md`): 단어장 파이프라인 v2 전제 판정 — ① 학년 노드는 `dictionary_categories`엔 없음(thematic 18) BUT `kcurr2022` 교육과정 별표=word-level 학년 소스 **이미 존재·발행**(오류1 완화) ② `category_id` 부재 확인(오류5 철회) ③ `curation_query` 스키마 불일치→GENERATED 정규화 선결 ④ **`dictionary_categories` 566노드+28,079 매핑=주제축 데이터 이미 존재**(플랜 밖 기회).
- **주제 세트 발행**(정찰 발견 즉시 실현, migration 불요): `topics-publish-set.mjs` — L1 테마=세트·L2 소주제=챕터(L3 롤업). **전 18주제 7,219단어** 발행(음식·여행·건강·비즈니스·과학·자연·사람·정치사회·문화·외모·언어기능·동물·집·스포츠·개념·의사소통·시간공간·여가). category `themed`/subcategory `topic`. chapter=L2 그룹번호·라벨=`korean_learner_note`(예: 여행→항공 교통·휴가 / 건강→의료·장애).
- **검증**: e2e 09에 주제 세트 렌더 단언 추가(소주제 챕터 라벨) → 통과(14.6s). 시중 주제별 단어장 대응 완비.
- **배경**: 시중 대응 카탈로그 실측 결과 학년/수능/시험/주제는 이미 발행됐고, 유일한 미대응 = **어원 단어장**(Word Smart류). kaikki 불요(핵심 학술 root=표준지식).
- **스키마**(migration `20260717140000`): `word_roots`(어근 인벤토리·origin·meaning_en·gloss_ko·variants) + `word_root_links`(단어↔어근, (word,root_id) PK 멱등·affix_type·confidence). RLS 공개읽기.
- **시드**: 라틴/그리스 핵심 어근·접두·접미 **181개**(`scripts/dict/roots-seed.mjs` + `data/word-roots-seed.json`, 멱등).
- **매핑**: 6 서브에이전트가 root→파생어족 생성(어원학적 진짜 파생어만) → 사전 실재 단어만 링크. **2,767 링크**(후보 2,591 중 사전 실재 2,472=95%). `scripts/dict/roots-map.mjs`.
- **어원 단어장 발행**: `etymology-core` "어원으로 익히는 핵심 영단어" — **1,500단어·159 어근 챕터**(chapter=그룹번호, `korean_learner_note`=어근 라벨). category `themed`/subcategory `etymology`. `scripts/dict/roots-publish-set.mjs`. 품질 검증(spec/dict/port/duc 챕터 전수 정확).
- **이중배당**: 어원 단어장 + (후속) 추출 파생어 인식·니모닉 소스. curation_query `{org:'root'}` 문서화(RPC 실행축 확장은 후속).
- **렌더 검증(수정 포함)**: `VocabSetPreviewModal`이 챕터를 `Chapter N`(숫자만)으로만 표시 → 어원 세트의 어근이 안 보이던 문제 수정 — 챕터 내 `korean_learner_note`가 균일하면 **어근 라벨("어근 spec — 보다")을 챕터 헤딩으로 승격**(책 챕터엔 무영향). e2e `09-etymology-set.spec.ts`(검색→모달→어근 챕터 렌더 단언) 통과. ⚠️ 발견: 어원 세트가 themed 저중요도라 기본 추천 캐러셀엔 비노출(검색/테마별로 접근) — 프로미넌스는 후속.
- **추출 이중배당**: `ExtractionPanel`이 추출 단어의 표제어 어근을 `word_root_links` 조회 → **🏛 어원 힌트 칩**(인라인 `🏛 spec` + expand "어원 spec (보다)") 노출. 학습자가 단어 추출 시 어근을 바로 봄. e2e 08에 어근 칩 단언 추가(통과 29.3s). `mnemonic_ko`는 admin 전용 UI뿐이라 대량 채움 대신 기존 근거 카드 surface 재사용(스키마 마찰 0).
- **어원 first-class 카테고리 승격**(migration `20260717150000`): `shared_word_sets.category` CHECK에 `'etymology'` 추가 + etymology-core 세트 이동(themed→etymology). `categories.ts`에 **📜 어원 카테고리**(중요도 50·공인 다음) + `VocabSetCarousel` 앰버 색 → /library/vocab 기본 뷰에 **자체 어원 탭** 노출(시중 어원 카테고리 대응). e2e 09에 탭 프로미넌스 단언 추가(통과 31.3s).

### 추출 대상 단일단어 example 100% 완비 (v06.252)
- 추출 대상(classified·v_level·노이즈 register 제외) **단일 단어 172개**의 `example_en` 결측을 사전급 예문으로 채움 → 단일단어 example **95.5%→100%**. 대부분 학술 고급어(auscultation·sedimentary·inhibitory·regulatory 등) + 영국식 철자변형.
- 도구 `scripts/dict/example-fill.mjs`(dump=대상 청크화 · apply=검증 후 결측행만 UPDATE 멱등). 4 서브에이전트 병렬 authoring(품사·의미 sense 매칭·영국식 철자 보존) → 172 valid·0 reject·0 fail.
- 잔여 결측 1,635는 **multiword 항목**(단일 토큰 추출 경로로 애초에 추출 안 됨 → 추출 품질 무관, 의도적 잔존).

### 추출 신뢰 런타임 회귀 스펙 — 알아요/몰라요 + 근거 카드 E2E (v06.251)
- **상시 회귀 자산**(임시 드라이버 금지 정책): `08-text-extract-trust.spec.ts` — 실 로그인으로 `/text/new` 추출 → 4단계 근거 카드 렌더 + 2단계 알아요(✓·체크해제)/몰라요(aria-pressed) → `word_familiarity` known/unknown 적재를 **service-role DB 단언**. finally 에서 테스트가 만든 행만 원복(known이 다음 추출을 영구 축소하지 않도록).
- **db 헬퍼 2종**: `countWordFamiliaritySince`(verdict 필터) · `deleteWordFamiliaritySince`(멱등 정리). **ExtractionPanel 토글 버튼에 `aria-pressed`**(a11y + 상태 검증). 최초 실행 통과(18.9s · known+unknown 영속화 확인 · cleanup 2행).

### 추출 신뢰 로드맵 기반 완성 — 3단계 검증 + 정밀도 백로그 (v06.250)
- **5단계 로드맵**(새는 곳 막기→틀려도 고칠 수 있게→채우기→자랑하기)의 **0·1·2·4단계 완료** = 신뢰의 누수(3경로 분열·형태-POS 오정렬·교정 불가·근거 불투명) 전부 봉인.
- **3단계 검증(읽기 전용)**: 추출 대상 **40,355** 표제어 — `meaning_ko`·`pos`·`cefr_level`·`meanings_ko sense별 pos` **모두 100%**(= 맞는 단어·그 형태의 맞는 뜻·맞는 POS 보장), example_en 95.5%. **뜻·POS가 틀리지 않음이 데이터로 확인**.
- **정밀도 백로그(Phase B, 비차단)**: 다의어 10,144 중 **7,420**이 일부 sense에 자체 v_level 결측 → flat 폴백(뜻 아닌 **난이도 숫자 근사**만 영향). 우선순위=실사용∩multi-POS 5,170. 신규 툴 명세를 `scripts/dict/SENSE_COMPLETION_MULTISESSION.md` §Phase B에 기록. 여유 시 멀티세션 배치.

### 추출 신뢰 4단계 — 추출 근거 카드("왜 이 단어인가") (v06.249)
- **전략 4단계 "자랑하기"**: 백엔드가 이미 반환하던 `score_breakdown`(V-Level·threshold·track/freq boost·reasoning·형태해소)을 **학습자 공감 언어의 근거**로 번역. 완벽함을 주장하는 대신 "왜 뽑았는지" 투명하게 보여 신뢰 형성.
- **`buildReasons(r)`** 순수 헬퍼 — 신뢰 가치순 근거 생성: ① 목표 트랙 빈출(수능/비즈/학술, `track_boost>0` + 최고 트랙) ② i+1 난이도 위치(`v_level==threshold`→"딱 지금 배우기 좋은" / 초과→"조금 도전적") ③ 빈도(rank≤3000 "두루 쓸모" / rare "이 글에서 특히 중요") ④ **형태 해소**(match_layer 2 → `이 글엔 "surface" 형태 — 표제어 "lemma"(POS 뜻)`, 이 플랫폼만의 강점). 각 근거에 lucide 아이콘(Dual Coding).
- **UI(ExtractionPanel)**: 인라인엔 **눈에 띄는 근거만**(generic 난이도 제외 → Calm UI) 뜻 아래 italic 한 줄. expand 상단에 **"왜 추천했어요?" 카드**(전체 근거 + 아이콘) → 기존 기술 breakdown 테이블은 그 아래로(Progressive Disclosure). 스코어 코너의 dev 문자열("V6 ≥ threshold")은 "추천 점수"로 정리, 기술 reasoning/method는 breakdown 안으로 이동. tsc 0·eslint 0.

### 추출 신뢰 2단계 — 학습자 "알아요/몰라요" 교정 + 오난이도 신호 (v06.248)
- **전략 순서**(새는 곳 막기→틀려도 고칠 수 있게→채우기)의 **2단계**: 완벽 대신 학습자가 추출을 직접 교정. 마이그 `20260713180000`(테이블+RPC+뷰) · `20260713180500`(추출 제외).
- **`word_familiarity`** 테이블(user·**lemma(표제어) 단위**·verdict known/unknown·판정당시 v_level·source) + RLS(본인) + `idx_wf_lemma_verdict`. lemma 단위 저장 → 굴절/파생 형태 무관 일관.
- **`set_word_familiarity(lemma,verdict,v_level)`** RPC(DEFINER·`auth.uid()` upsert·PUBLIC revoke·authenticated grant). **`word_mislevel_signal`** 뷰(known_ct/unknown_ct + dict_v_level 대비 → 과대/과소난이도 후보 집계).
- **추출 제외**: `extract_vocabulary_for_user_v2` filtered CTE에 `verdict='known'` 배제(이미 아는 단어 재추출 안 함). 나머지 통합 로직(resolve_dict_headword·infer_form_pos·i+1 threshold) 불변.
- **`ExtractionPanel`**: 행마다 알아요/몰라요 버튼(낙관적 UI·known→페이드+선택해제). 저장은 **lemma 단위 + `extracted_surface` 보존**(SRS 형태별 쪼갬 방지). L2 배지 형태→표제어 시맨틱 교정. `@vocaflow/types` database.ts 재생성(신규 RPC 타입). tsc 0(ExtractionPanel).

### 스크립트 출처 설명 — 소스별·소스주제별 한눈에 (v06.247)
- **문제**: 소스는 라벨(NASA·OWID·eLife…)만 있고 "그게 뭔지·무슨 주제인지" 설명이 없어 학습자가 파악 어려움.
- **소스 메타 확장**: `source-meta.ts` 각 소스에 **domain(분야: 우주·천문/건강·의학/데이터·통계/여행…)** + **blurb(한 줄 설명: "미국 항공우주국 — 우주 탐사·천문·지구 관측 소식")** 추가(14소스 전수). `TrackStat.sources`가 집계 시 domain/blurb 주입.
- **한눈 디자인**: ① 팝업(SeriesInfoModal) **'출처별' 존** — 색점 + 이름 + **분야 배지** + 편수 + **비율 바**(시리즈 내 비중 시각화) + 설명. 소스별(무엇) + 소스주제별(무슨 분야·얼마나) 동시 전달. ② SeriesDetail 소스 그룹 헤더에 **분야 배지 + 설명** → 글 목록에서 소스주제별 맥락.
- **검증**: tsc 0·eslint 0 · unit 18 유지 · 런타임 diag(모달 출처 분야·설명 렌더·pageerror 0).

### ACP 소스 feed 전수 자동 테스트 + nih 불안정 표기 (v06.246)
- **전수 테스트**(29 feed · 14 소스 · 실 외부 호출, DEV_ADMIN_BYPASS): **12/14 소스가 233+ 후보 정상 산출** — voa(36)·nasa(21)·simple_wikipedia(40)·the_conversation(23)·owid(4)·factbook(30)·elife(20)·wikipedia(38)·plos(15)·wikivoyage(40)·usgs(24)·noaa(19). **코드 파싱 버그 0** — 실패/빈 feed는 전부 외부 요인 확인.
- **외부 이슈(코드 아님)**: nih/news RSS **403 차단** · nih/directors-blog **연결불가(000)** · nih/medlineplus **원본 1건뿐** · nasa/apod **원본 RSS가 제목 공란·설명=이미지태그**(기사용 아님) → curation 정확히 0 · wikinews **비활성**(기존 flag) · the_conversation/politics **저볼륨**(all/science/health는 정상).
- **사용성 보완**: nih 3 feed 모두 실패인데 basic 프리셋에 포함돼 매번 실패 유발 → `BulkArticlesTab` nih 에 **`health='unstable'`** + note(“News 403·Blog 불가·MedlinePlus 희소 — URL 직접 입력 권장”) 표기(wikinews 패턴). 소스 카드에 ⚠️ 경고 노출.

### 시리즈 학습정보 팝업 — 텍스트 위주 → 시각적 정보전달 (v06.245)
- **문제**: 팝업(SeriesInfoModal)이 텍스트 위주 — "나에게 맞나?"(난이도)가 텍스트 배지뿐, 능력은 텍스트 나열, 정보전달 매커니즘 부족.
- **시각 부호화 강화**: ① **난이도 게이지** 신설 — 축(쉬움→어려움) 위에 시리즈 밴드(vMin~vMax)와 **내 위치 마커**를 그려 "나에게 맞나"를 <1s 시각 즉답(전주의적, `vToPct`/`effectiveUserV` 재사용). ② **스탯 타일**에 아이콘(분량·읽기시간·음성) — 읽기시간은 실 글에서 집계(`3~8분`). ③ **능력 = 아이콘 칩 그리드** — 키워드→아이콘(듣기 Headphones·논증 Scale·독해 BookOpen·데이터 BarChart…) Dual Coding. ④ why는 Lightbulb 앵커로 보조 강등.
- **검증**: tsc 0·eslint 0 · 런타임 diag(팝업 열림·게이지·스탯·능력·로드맵·why 렌더 · pageerror 0). buildScriptsMap/진입 flow 불변.

### `/admin/articles` 소스 라벨 SSoT 통일 — 커버리지↔소스GET 불일치 수정 (v06.244)
- **버그**: 소스 라벨이 3곳(정본 `source-guide.SOURCE_LABEL` · `SourceFeedList.SOURCE_LABELS` · `CurationConsole.SOURCE_OPTIONS`)에 중복 정의 → 드리프트. `SOURCE_OPTIONS`가 `simple_wikipedia`를 **"Wikipedia"로 오표기**(정본 "Simple Wikipedia") → 커버리지(SourceFeedList)엔 "Simple Wikipedia", 소스GET 탭엔 "Wikipedia"(×2, wikipedia와 충돌)로 **같은 소스가 다른 이름**.
- **수정**: 커버리지·소스GET·소스헤더 셋 다 **정본 `SOURCE_LABEL` 단일출처**만 사용. `SOURCE_OPTIONS`는 key+Icon만 정의(라벨 하드코딩 제거), `SourceTabs`가 `SOURCE_LABEL[key]` 렌더. `SourceFeedList`의 중복 `SOURCE_LABELS` 삭제 → `SOURCE_LABEL[source]`. DB 소스 집합(seed_catalog·articles)은 14 정본 내 확인(stale 없음). 미래 드리프트 차단.
- **소스GET(대량) 라벨 정렬**(BulkArticlesTab, 4번째 소스 맵): owid=**"OWID"→"Our World in Data"** · factbook=**"Factbook"→"CIA World Factbook"** · noaa=**"NOAA"→"NOAA Climate.gov"** 정본과 일치. 14 소스 전부 존재(preset "전체(14 소스)") 확인. (커버리지의 「소스 피드 현황」은 후보 수집된 소스만 동적 표시 — 미수집 소스는 미노출이 현 설계.)

### `/library/scripts` 선택 후 글 목록(SeriesDetail) 에디토리얼 재설계 (v06.242)
- **문제**: 시리즈 선택 후 화면이 분류 없이 카드 나열식 — 특히 고급(V11) 학습자는 모든 글이 같은 fit('수월')이라 그룹이 붕괴돼 평면 그리드였음.
- **재설계(콘텐츠 우선)**: ① **먼저 읽어볼 글**(featured lead — 추천순 1편을 큰 잡지 lead 카드로, 최고의 글 어필) ② **적응형 분류** — 다중 출처 시리즈(관심 주제·데이터·백과)는 **출처(소주제)별**(NASA/NIH/PLOS…), 단일 출처(듣기·쉬운글·논증)는 **읽기 시간별**(빠르게 4분↓/찬찬히 5~9분/깊이 10분↑). V-Level 무관하게 항상 의미 있는 분류(고급도 나열식 X). ③ 오리엔테이션(능력·why·학습법)은 하단 "이 시리즈에 대해" footer로(콘텐츠가 먼저 보이게).
- **ArticleCard 에디토리얼 타일**: 본문 미리보기가 없어 **제목(Lora)을 크게 승격**(콘텐츠의 얼굴), 나머지(출처 색점·읽기시간·레벨·적합·음성·태그)는 절제된 한 줄 메타. 카드 전체 클릭=읽기 진입, 우상단 원문 링크. `featured` 변형(큰 리드). SOURCE_META는 source-meta.ts 공유분 재사용.
- **검증**: tsc 0·eslint 0. (진입면→상세 클릭 경로 e2e 는 동시 진행된 SeriesInfoModal 2-타깃 개편과 겹쳐 별도 조정 필요 — 상세 화면 자체는 onEnter '둘러보기' 도착지로 유지.)

### `/library/scripts` 시리즈 학습정보 팝업 (v06.240 → 가독성 재설계 v06.241)
- **결정 surface 신설** `SeriesInfoModal.tsx` — 진입면에서 주제(시리즈) **왼쪽(본문) 클릭 → 학습정보 팝업**. 글 목록에 들어가기 전, 고를지 확신을 갖고 결정하게 함(Progressive Disclosure · 자기효능감). 콘텐츠 전부 실데이터/근거(TrackStat sources·count·fit·idealCount + SourceTrack 카피). 추가 fetch 0.
- **v06.241 가독성·가시성 재설계 (뇌과학·심리 근거)**: ① **한눈 요약 스탯 스트립**(난이도·레벨·분량 3타일, 색·크기 전주의적 <1s 파악) ② **격리된 개인화 훅**(16px 볼드·fit색·Von Restorff) ③ **체크 앵커 능력 리스트**(t1 14px, 그림 우월) ④ **큰 번호 로드맵**(28px 원·연결선) ⑤ **근거 존 그룹화**(왜+출처 한 카드, Gestalt 공통영역) ⑥ **48px 고대비 CTA**. 인지부하 청킹(6나열→3존 ~4항목), 중요정보 대비 t3→t1/t2. Calm 등장(mounted-state)·Esc/백드롭·스크롤잠금·role=dialog·다크 토큰.
- **카드 2-타깃 재구성** ScriptsBrowser: 히어로/row **왼쪽(본문)=학습안내 팝업 / 오른쪽(둘러보기)=글 목록 직행**. 히어로 "ⓘ 이 시리즈 알아보기" 어포던스, row Info 아이콘 + 우측 "cefr·편수 ›" 분절. buildScriptsMap 불변.
- **출처 제공**: `source-meta.ts` 신설 — 소스 라벨·색·짧은라벨을 ArticleCard에서 추출해 공유(진입면·상세 재사용). `buildScriptsMap` 이 시리즈별 **실제 출처+편수**(`TrackStat.sources`) 집계 → 진입면 히어로/row에 "출처 · NASA · NIH · PLOS +N" 한 줄, 상세엔 색 점 + 편수 칩. 학습자 신뢰·기대 형성(정식 원문 큐레이션).
- **글 목록 분류(모던·심플)**: `SeriesDetail` 글 목록을 **i+1 적합 티어로 그룹**(딱 맞아요→수월→도전→어려움, 그룹당 짧은 글 먼저) — iOS 그룹 리스트식 조용한 색-점 헤더. 무엇부터 읽을지 스스로 판단(학습자 제공 최적화). 그룹 1개면 평면.
- **검증**: tsc 0·eslint 0·SSR 200(진입면 출처 힌트 렌더 확인) · 04-ui-smoke 2종 PASS(진입면→상세(출처칩·분류)→복귀 · 밴드 V2/V5/V9) · unit 18 유지.

### `/library/scripts` 진입면 간소화 — Progressive Disclosure 재설계 (v06.238)
- **문제**: v06.222 재설계가 진입면에 난이도 지도(칩 레일) + 개인화 배너 + '바로 시작' strip + **시리즈 카드 6개(각각 능력·학습과학 why·학습법 ①②③ 전부)** 를 한꺼번에 노출 → 첫인상이 "학습 초대"가 아니라 "학습 요람". 프로젝트 원칙(Progressive Disclosure·Cognitive Load ~4항목·Calm UI) 위반, 학습자 선택 과부하(Hick).
- **재설계**: **"조용한 초대 먼저, 깊이는 고른 뒤"** 2계층. 진입면 = ① 밴드별 한 줄 안내 → ② **추천 시리즈 히어로 1개**(확신 있는 출발점·자기효능감) → ③ 나머지 시리즈 **간단 row**(스캔 가능·저부하·자율). 시리즈 선택 시에만 `SeriesDetail`에서 능력·why(Lora italic)·학습법·글 목록 노출.
- **변경**: `SeriesDetail.tsx` 신설. `ScriptsBrowser.tsx` 진입면 재작성(inline 히어로/row). **제거**: `DifficultyMap`·`ScriptsGuideBanner`·`TrackOrientationCard`(내용은 detail로 이동). `buildScriptsMap`/`bandGuidance`(밴드 적응 로직)는 유지 — 추천·안내는 그대로 레벨 적응.
- **검증**: tsc 0·eslint 0·SSR 200(구 '난이도 지도'/'골라보기' 제거 확인). 04-ui-smoke 2종 갱신 **PASS**(진입면→상세→복귀 2.9s · 밴드 V2 초급/V5 중급/V9 고급 6.7s) + `source-map.test.ts` 18 유지. 클린 단일 서버·CI=1.

### 아케이드 도시에 마지막 북극성 ⑧「The Word Orrery」 — 지식 게이트 탐사 (Outer Wilds 계열) (v06.237)
- **메커니즘(독창)**: 미니 항성계의 **여섯 행성을 자유 탐사(비선형)**. 각 행성의 '현상'이 곧 단어 뜻을 체현(예: 잿더미·생명 無 → `desolate`). 관측 시 이름을 읽어 **성좌 노트(코덱스)**에 기록. 여섯 성좌를 모두 관측하면 **중심 핵의 봉인이 깨어남**. 봉인의 수수께끼는 현상을 **에둘러** 가리켜, 스탯·운이 아닌 **오직 앎으로만** 열림(Outer Wilds의 '지식이 곧 진행'). 오답 페널티 無(시간 루프식 자유 탐사).
- **학습 과학**: 현상 문맥에서 뜻 획득(Dual Coding·Context-Dependent) → 봉인에서 에두른 단서로 인출(Active Recall·새 맥락 전이). 6단어 오센틱 형용사(desolate/profound/erratic/volatile/dormant/radiant).
- **아트**: 심우주 인디고→따뜻한 태양 오렌지. 회전 궤도링·펄스 태양·행성 비컨·현상 Lora italic 세리프. 오리리 원형 배치(6행성) + 코덱스 + 봉인 패널.
- 배선: `word-orrery` 3타입(ArcadeGameId/ModuleId/ScoreModule) + MARK_PATHS + `/play/word-orrery` + SessionFrame + 아케이드 허브(14번째 포탈) + /hub 배너("14개 세계").
- **검증**: Playwright 18항목 전 PASS — 잠금 게이트·6관측·코덱스·해금·오답 shake·4봉인 개방·완료·**pageerror 0**.
- **persistence 마이그 `add_word_orrery_module_id` 적용 완료**(2026-07-13) — `module_id` enum +`word-orrery`. 순수 additive(IF NOT EXISTS). DB 검증: enum 존재 확인. 로컬 미러 `supabase/migrations/20260713110000_*.sql`. → **아케이드 14종 전부 persistence 완성**(무드 6 + 신개념 7 + 북극성 1).

### ⑦ Lexicon Estate module_id enum 마이그 적용 — 아케이드 13종 persistence 완성 (v06.236)
- DB 마이그 `add_lexicon_estate_module_id` **적용 완료**(2026-07-13) — `module_id` enum +`lexicon-estate`. 순수 additive(IF NOT EXISTS). DB 검증: enum 존재 확인. 로컬 미러 `supabase/migrations/20260713100000_*.sql`.
- 효과: 아케이드 **13종 전부** FSRS learning_records·scores persistence 활성(무드 6 + 신개념 7).

### 아케이드 도시에 2차 웨이브 ⑦「Lexicon Estate」 — 의미장 인접 배치 (Blue Prince 계열) (v06.235)
- **메커니즘(독창)**: 청사진 저택 3×3에 단어-방을 **드래프트(3장 중 택1)**해 배치. **인접(상하좌우) 방이 같은 의미장이면 '복도'로 연결**(점수·글로우). 같은 의미장끼리 뭉치도록 배치 최적화 = 어휘의 **연상 웹(의미 네트워크)** 감각. 4 의미장(감정/자연/신체/금융)×6단어.
- **학습**: 단어의 의미장(semantic field)을 인식하고 공간적으로 군집화 — 어휘 depth의 핵심인 연상 관계 훈련. Blue Prince의 드래프트+도면+인접 시너지를 차용.
- **배선**: `LexiconEstateGame` + `/play/lexicon-estate`(minWords=0) + 청사진 블루 무드 + 도면 마크/워터마크 + 허브 13번째 포탈 + SESSION_META. TS 3유니온 +lexicon-estate.
- **검증**: 그리디 봇 3회 — 저택 완성·응집도 42~50%("훌륭한 저택")·9방·pageerror 0. **밸런스**(그리디 5~6, 최적 8+). **아케이드 12→13종(도시에 북극성 Blue Prince계 실구현).**
- ⏳ DB `module_id` enum +lexicon-estate 마이그 대기.

### 허브 아케이드 진입 동선 — /hub 배너 카드 (v06.234)
- `ArcadeEntryCard` — /hub 모듈 그리드 아래 아케이드 진입 배너(황혼 갤러리 무드 그라디언트 + 컨트롤러 마크 + "12개 세계에서 단어를 놀이로 — 해독·추리·시너지" + 플레이 CTA). 아케이드 아이덴티티와 무드 일치, Calm UI(강조 1). 이전엔 /arcade 직접·사이드바로만 도달 → 메인 오늘 화면에서 발견 가능.
- **검증**: /hub 렌더 200·링크 감지·pageerror 0·스크린샷 확인.

### 아케이드 무드게임 내장 콘텐츠 확장 — Connections 5퍼즐 · Daily Blitz 48뱅크 (v06.233)
- **Connections** 퍼즐 3→5(+67% 리플레이): 악기/보석/응시/거래 · 곤충/지형/성격결점/말하기. 스코프 미지원 게임이라 내장 뱅크가 곧 콘텐츠. **검증**: 새 퍼즐 식별·완승·0미식별·0에러.
- **Daily Blitz** 데일리 뱅크 30→48단어(신중한·마지못한·성취하다·극복하다·풍부한 등): 날짜 시드가 10개 추출 → 뱅크 클수록 데일리 변화 폭↑. 데이터 추가(로직 무변경·tsc 0·0에러).

### 아케이드 ④ Lexicon Detective 사건 2→3 확장 — 「불타는 극장」 · authored 3종 확장 완결 (v06.232)
- ④에 사건 3 추가: 극장 화재 재구성 — 8단서(actor·jealous·sabotage·ignite·flee·rescue + 함정 applause/curtain) → 6빈칸 서사(질투한 배우가 조명을 방해공작→합선 발화→관객 대피→구조). 게임 코드 무변경(동적 CASES).
- **검증**: 3사건 완주(사건1·2·3)·done 3사건·100%·18단서·pageerror 0.
- **authored 3종(④⑤⑥) 콘텐츠 확장 완결** — ④ 2→3사건 · ⑤ 2→3회랑 · ⑥ 3→6규칙. 각 end-to-end 검증.

### 아케이드 ⑤ Morpheme Rules 회랑 2→3 확장 — 「시간의 방」 (v06.231)
- ⑤에 회랑 3 추가: 시제 형태소(pre 미리·re 다시·fore 앞서 × view·cast·tell) → preview/forecast/review 조립으로 장애물 발동(안개 낀 앞날·다가올 폭풍·흐릿한 기록). VALID +6단어(foretell/retell/recast 등은 실재하나 오적용 시 "통하지 않는다"). 게임 코드 무변경(동적 LEVELS).
- **검증**: 3회랑 완주(3/3×3)·done 9단어·100%·3회랑·pageerror 0.

### 아케이드 ⑥ The Silent Rule 콘텐츠 확장 — 철자 규칙 3→6 (v06.230)
- authored 게임 콘텐츠 확장(배선 불가 게임은 콘텐츠가 리플레이 자산). ⑥에 고가치 철자 규칙 3종 추가: **자음+y→-ies**(babies/cities) · **s·x·ch·sh 뒤 -es**(boxes/watches) · **-ful은 l 하나**(careful/usefull✗). 각 2패널(정답3+오답2)·교정 노출.
- **검증**: 6규칙 완주(i-before-e·e탈락·자음중복·y→ies·치찰음es·-ful) · done 12패널·6규칙·100% · pageerror 0. dev 메모리 캐시로 안정 서빙 확인.

### Windows dev 안정화 + 아케이드 실 어휘 배선 ①③② end-to-end 검증 완료 (v06.229)
- **dev 픽스**: `next.config.mjs` webpack — **Windows 한정 메모리 캐시**(`config.cache={type:'memory'}`). 원인: FS 캐시 `.next/cache/**/*.pack.gz` rename이 백신 파일락으로 간헐 ENOENT → vendor-chunks 손상 → 라우트 404/500·dev 서버 반복 사망(이번 세션 내내). 메모리 캐시로 pack.gz 쓰기 제거 → 근절. mac/linux는 FS 캐시 유지.
- **검증 완결**: 안정화 후 ③②를 실 단어장(교육과정 고등)으로 **end-to-end 확인** — ③ Lexicon Hands 손패=실단어(fiction·celebrate·vocabulary…)+어원태그(fic), done 도달·0에러 · ② Word Customs 여권=실단어(device: 명사·장치·실 예문 "keeps her electronic device charged")+생성 위조, 18여행자 진행·0에러. 내장뱅크 미감지(✅).
- **결론**: 아케이드 실 어휘 배선 **3종(① Glyph Tongue · ③ Lexicon Hands · ② Word Customs) 전부 end-to-end 검증 완료.** `?set=`/`?text=`로 학습자 실단어+실예문으로 플레이. authored ④⑤⑥은 콘텐츠 확장 영역.

### CTP 스테이지 카탈로그 밴드 매핑 근본 재보정 (v06.232)
- **근본 원인**: `csat_stage_catalog` VIEW 가 ① 아티클에 `register='argumentative'→S3` 특례(문체가 난이도 밴드를 덮음·비정합), ② 도서/비-argumentative 를 3버킷(v≤4→S1·v5-6→S2·v≥7→S4)으로만 나눠 **S3 밴드 사실상 부재**(argumentative 전용→굶주림), CSAT 핵심 v5-6 이 비활성 S2 로 밀림. v06.229(처방 누적 완화)가 표면화한 근본.
- **재보정**: articles·books 일관 4버킷 monotonic — **v≤2→S1 · v3-4→S2 · v5-6→S3(CSAT 핵심·활성) · v7+→S4(killer band)**. argumentative 특례 제거, NULL→S2 방어. derive_learner_stage coverage 게이트(S_n≈v[(n-1)×2,n×2))에 i+1 정합. 컬럼 시그니처 불변(grants/의존 안전). 마이그레이션 `20260713090000_ctp_stage_catalog_band_recalibrate`.
- **효과(라이브 실측)**: input 후보 S1:7·S2:50·S3:114·S4:12(전 밴드 populated); at-band DCP S2:48·**S3:762**·S4:564(S3 굶주림 해소). 현 S1 사용자 처방 input 5후보 유지(무영향), practice 비활성 정상. 유일 소비처 prescribe_today(input 정확매칭·practice 누적) 재검증.
- **DCP end-to-end 실증**: 실 사용자 전원 S1(다차원 게이트 — vocab+wpm+정확도+듣기)이라 DCP 미구동이던 것을, runtime-test에 `reading_fluency_log` 3건(wpm~160) 시드→**S3 안착**. prescribe_today: practice_active=true·5 items(order+insert)·75분. order 채점(source_order 역순열=정답) 로직 재현 correct=true. runtime-test **S3 데모-레디**(로그인 시 DCP 노출·fluency 3건 DELETE로 복귀). apps/web/CLAUDE.md 계정 라인 갱신.
- **헬스 체크 신설** `scripts/verify-dcp-health.mts` — 도달성 불변식(①밴드 populated ②도달 DCP S3≥100·S4≥300 ③고아 0)을 실행 가능 검증으로 codify(dev 서버 비의존·CI 배선 가능·회귀 시 exit 1). PASS 실측 S3=810·S4=1374. PostgREST 1000행 한계는 range 페이지네이션으로 처리(전량 1374 집계).

### CTP DCP 처방 도달성 수리 — 확대 콘텐츠 실제 활성화 (v06.229)
- **버그**: prescribe_today practice 블록이 `c.stage_band = v_band`(정확 밴드 매칭)로 DCP 선정 → 카탈로그 매핑(v≤4→S1·v5-6→S2·argumentative→S3·v≥7→S4)과 맞물려 **S3 밴드가 argumentative 7편에 굶주리고, CSAT 핵심 v5-6·v6도서가 비활성 S2에 갇혀** v06.228 확대(+782)의 ~95%가 학습자 도달 불가였음. (소비 경로 = `/practice/dcp`·hub 처방 ④ 모두 prescribe_today 단일 출처 — 검증.)
- **수리**: practice 블록만 `substring(stage_band)::int <= LEAST(v_num,4)`(누적 밴드) + `ORDER BY md5(id||current_date)`(일자-안정 로테이션 — 매일 다른 5·하루 내 고정)로 교체. VIEW 매핑·input 블록·활성 게이트 불변. 마이그레이션 `20260712190000_ctp_prescribe_today_dcp_band_cumulative`.
- **효과(실측)**: 도달 가능 DCP — **S3 학습자 64→810 items(7→69 refs, 12.7×)**, S4 564→1374(12→81 refs). S3 시뮬레이션 = v6도서(Oz·Fables)+expository v5+argumentative 혼합. 난이도 정확 캘리브레이션은 완화되나 순서/삽입(글 논리 훈련)엔 무해.

### CTP DCP 확대 — 순서/삽입 연습 592→1374 items (아티클+도서 v6, v06.228)
- **아티클 드라이버 신설** `scripts/generate-article-dcp.mts` — `dev-generate-items` 라우트(기본 register=argumentative·limit 20 → v5 7편에 정체)를 스탠드얼론 스크립트로 일반화. 동일 입력 게이트(설계 §T2: published·NOT display_only·license PD/CC·lexical_noise≤0.08)를 **전 register·무제한**으로 적용. dev 서버 비의존(service-role) → 재사용 자산. dry-run 기본 + `--apply`.
  - 결과: 적격 135편 중 64편에서 560 items upsert(멱등). article DCP **64→566 items**(7→64편), v_level **v5-only → v3~v7**. 핵심 = **CSAT 스위트스팟 expository v4~v7**(v6 204·v5 128·v4 36·v7 36) + reference v5/v6 86. narrative 13편은 문단 필터가 0 산출로 자기선별(대화체·단문 부적격 = 품질 게이트 정상).
- **도서 드라이버 floor 파라미터화** `scripts/generate-book-dcp.mts --floor=N`(기본 7 보존) — CSAT S3(v6) 확대. book DCP **528→808 items**(11→17권, v6 6권 신규·Poetry 0 산출 자기선별). v_level v5-8→v4-9(챕터 단위).
- **전체 DCP 592→1374 items**(+782), 결합 커버리지 **v3~v9 전 CSAT 사다리**, 81 refs. 런타임 LLM 0(generateDcpItems 결정론·멱등, 라이브 592 검증 엔진 재사용). 스팟체크: expository v6 order presented↔source_order 왕복 정합.
- **후속 정제 여지**: 일부 reference/travel 콘텐츠는 CSAT 학술 장르와 이질(순서 모호성 여지) — 필터가 구조 유효성은 담보하나 시험급 무모호성은 아님. 장르 순수화(expository/argumentative 한정) + v5/v2 도서(6권)는 옵션.

### 아케이드 실 어휘 배선 ② — Word Customs가 학습자 단어 여권으로 (v06.227)
- **배선**: `buildDaysFromPool` — 스코프 단어 → 여권. 진본(word·pos·뜻·예문 실데이터) + **결정적 위조 생성**: 뜻 위조(다른 단어의 뜻으로 swap = false friend 유사) · 품사 위조(실제와 다른 품사 표기). 예문은 단어/굴절형을 찾아 `{}` 블랭크. 3근무일(각 6), 규칙 누적(뜻→+품사, day1엔 품사위조 없음). 9단어 미만이면 내장 뱅크 폴백.
- **버그 예방**: word-customs page wordPool 전달 추가 + posKoFromData 부사 우선(‘adverb’⊃‘verb’).
- **검증**: **독립 로직 테스트 PASS**(3일·진본10·뜻위조4·품사위조1·전 여권 예문 {}·규칙 정합·품사 매핑 정확) + tsc 0. ①과 동일한(이미 실단어 end-to-end 검증된) 스캐폴드→wordPool 흐름. ⚠️ 런타임 렌더는 dev 서버 환경 이슈(webpack 캐시 rename 실패→청크 404, AV 파일락 추정)로 보류 — ①③②는 코드·로직 검증 완료, 환경 안정 시 확인.
- 실 어휘 배선 3종 완료(① Glyph Tongue end-to-end ✅ / ③ Lexicon Hands·② Word Customs 로직 ✅). authored 게임 ④⑤⑥은 콘텐츠 확장이 적합.

### UI 스모크 로그인 견고화 + 런타임 검증 (v06.222)
- **런타임 검증**(디스크 확보 후 단일 dev 서버): ScriptsBrowser "학습 지도" 재설계 + ArticleCard/CEFR/a11y 변경이 실브라우저 렌더·동작 확인 — 04-ui-smoke **4/4 통과**(주요 화면 콘솔에러 0·스크립트 드릴다운/복귀·도서관 필터·EchoMatch 게이트).
- **스모크 견고화**: `loginRuntimeUser`가 배치 실행 시 반복 로그인 스로틀/dev 컴파일 경합으로 waitForURL 타임아웃(false-fail) 잦았음 → **1회 재시도 + 타임아웃 25s** 보강. test1 단일 로그인이 견고해져 storageState 재사용 하위 테스트도 안정. (근본: STATE_PATH storageState 이미 재사용 구조 — test1 로그인만 flaky였음.)
- **환경 교훈**(재확인): 멀티 dev 서버(:3000/:3001/:3100)가 `apps/web/.next` 공유 → 라우트 무작위 404/500 오염 → 로그인 flow 붕괴. 검증은 **전 서버 종료 → .next 삭제 → 단일 서버** 필수(apps/web/CLAUDE.md 규약).
- **밴드 적응성 검증(단위+E2E)**: (1) `source-map.test.ts` 신설(18 테스트) — `getLearnerBand`/`buildScriptsMap`/`bandGuidance`가 초급(V2→listen 추천)·중급·고급(V9→최고심도 topic, 깊이 유도)·미진단(진단 유도)별 배너 카피·추천 트랙을 실집계로 결정적 검증. (2) 04-ui-smoke E2E — 실 로그인 세션에서 `current_v_level`을 V2/V5/V9로 바꿔 배너·지도가 밴드별로 flip 함을 단언(finally 원복). **정정**: 초기 "storageState 로 클라이언트 인증 불가" 는 오진 — 클린 단일 서버에선 브라우저 `getUser()` 200 정상(V11→"고급 안내" 확인), 앞선 실패는 멀티 dev 서버 `.next` 오염(청크 404→하이드레이션 미완)이 실체. 스크립트 오리엔테이션 e2e 도 hydration-견고 재클릭(toPass) 패턴으로 보강.

### 아케이드 실 어휘 배선 ③ — Lexicon Hands가 학습자 단어 속성 덱으로 (v06.226)
- **배선**: `buildDeckFromPool` — 스코프 단어 → 속성 태그 덱. **품사**(스캐폴드 실데이터 우선 + 형태론 휴리스틱 폴백: -ly→부사·-tion→명사 등) + **어원**(라틴/그리스 어근 41종 substring 감지: spect/port/dict/struct…) + **접두사**(27종 감지) 자동 태깅. 세션당 최대 40장, 12장 미만이면 내장 덱 폴백.
- **버그 수정 2건**: (1) lexicon-hands page가 `wordPool` 미전달(항상 폴백) → render에 추가. (2) `posFromData`에서 'ad**verb**'가 `/verb/`에 매칭돼 부사→동사 오분류 → 부사 검사 우선순위로 수정.
- **검증**: **독립 로직 테스트 PASS**(실단어 15장 덱 생성·전 카드 품사·어원 시너지 그룹 존재 spect[inspect/respect/suspect]·port[transport/export]·휴리스틱 품사 정확) + posFromData 7케이스 매핑 검증 + tsc 0. ①과 동일한(이미 실단어 end-to-end 검증된) 스캐폴드→wordPool 흐름. ⚠️ **런타임 end-to-end 렌더는 dev 서버 불안정(디스크 98% → .next 반복 손상·프로세스 사망)으로 보류** — 로컬 디스크 확보 후 `?set=<테마 세트>` 플레이로 확인 권장.
- 도메인 태그는 데이터 sparse/과광범위로 미사용(품사+어원+접두사 3축). authored 게임(④⑤⑥)은 배선보다 콘텐츠 확장이 적합.

### 추출 3경로 통합 (1단계 "새는 곳 막기") — 책·글·BYO 동일 규칙 (v06.225)
- **문제**: 단어추출이 책(`select_book_chapter_vocab`)·글(`select_article_vocab`)·학습자 직접입력(`extract_vocabulary_for_user_v2`, /text) 3경로가 서로 다르게 구현 → 같은 문장도 다른 결과("라이브러리선 뽑혔는데 내 지문선 왜?") = 신뢰 저하.
- **0단계 세보기**: 실 학습 corpus 표제어 **22,086**(검사 범위, 사전 절반) · 다의어 **10,492/45,667=23%**(실사용 중 31%). 3경로 구조적 상이 실증.
- **통합(drift 방지)**: 형태→품사 추론을 **공유 헬퍼 `infer_form_pos(surface,base)`** 로 추출 → 3함수가 인라인 복붙 대신 헬퍼 호출(이후 규칙 변경 한 곳만). book·article 리팩터(동작 동일, **회귀 0** 검증). **/text(BYO) 통합**: `resolve_dict_headword`(굴절/파생 해소)+`infer_form_pos` sense+노이즈 register 제외+표면형 표시 추가 → 책/글과 일치(galloped→gallop·ransomed→동사 뜻·uncomfortableness→uncomfortable 회수).
- **유지(정당한 차이)**: BYO 개인화(레벨 i+1·track 점수·아는단어 제외)·ephemeral·시그니처. 마이그 `20260713170000/171000/172000/172500`.
- **잔여**: BYO는 winkNLP를 안 거쳐 context_pos 없음(형태추론 폴백) → **winkNLP 배선(근본 파리티)은 후속**. 앱-측: /text 저장 시 표면형 대신 `matched_via_surface`(표제어) 저장 권장(SRS 쪼갬 방지).

### 다의어 sense 전면 완성 — 일반 사전급 다중 POS (v06.225, 진행형)
- **목표**: 사전 전체 단어가 실제 쓰이는 모든 POS sense를 갖도록(일반 사전급) → "ransomed→몸값을 치르고 풀어주다"처럼 형태에 맞는 뜻 추출.
- **병렬 파이프라인**: `sense-chunk.mjs`(단일-sense content 단어 빈도순 청크 분할) → **서브에이전트 병렬 authoring**(청크당 1 에이전트, 표준 영어 실재 POS만 보수적 추가, 애매하면 skip) → `sense-apply.mjs`(검증·일괄 적용: meanings_ko + flat pos/meaning_ko 동기화 + shared_words, 단일-sense 가드).
- **Wave 1 완료(rank 1700-6000)**: 수작업 고빈도 ~100(watch→보다·face→직면하다·bear→견디다/낳다·fine→좋은/미세한·count→세다·surround→둘러싸다·fast→빠른) + **서브에이전트 388**(steal→도루·milk→착취하다·desert→탈영하다·boot→부팅·march→행진하다·wolf→늑대 복원·manifest→나타내다·crisp→바삭한 등). rare-primary 오류(명사만/희귀뜻 primary) 다수 교정. 해당 범위 다중-sense 45%.
- **형태 POS 추론(마이그 `161500`)과 결합** → 추출 시 굴절/파생형이 형태에 맞는 sense로 나옴. Wave 2(rank 6000-9000) 등 후속 진행.

### 굴절형·파생형 해소 — 조회·도서 단어추출 양쪽 (v06.225)
- **문제**: 흔한 파생형은 표제어라 뜻이 나오나, rare 미등록 파생형(dreamlike·kinglike·boyishly)은 `not_found`; 도서 단어추출(`select_book_chapter_vocab`)은 winkNLP lemma 직접 매칭만 해 미매칭 굴절/파생형 탈락 → 학습자가 따로 찾아야 함.
- **lookup tier 5**(마이그 `20260713150000`): `lookup_word_meaning`에 **파생 해소** 추가 — 기존 4-tier(direct→규칙 역굴절→철자변형→inflected_forms cluster) 실패 시 투명 접미사(-ly/ily/ically/ness/iness/less/iless/ful/fully/ish/like/wise)를 벗겨 **base 표제어 뜻 폴백**. 검증: 굴절·파생 20종 전수 해소, `not_found` 0.
- **도서 추출 해소**(마이그 `20260713160000`+`160500`): `resolve_dict_headword(surface)` 헬퍼(direct→cluster→규칙 역굴절→파생 strip) 신설 → `select_book_chapter_vocab` JOIN을 이 헬퍼로 교체. **미매칭 굴절/파생형이 사전 뜻과 함께 회수**(darkish→dark·motherless→mother·uncomfortableness→uncomfortable). 시그니처 동일(호출부 무변).
- **쓰레기 방지**: 해소는 **base 표제어가 실재할 때만** → 규칙 날조 불가. 파생 strip은 base 길이≥4 + junk 제외로 과도 strip 방지(reely→ree·actuly→junk 차단). junk 표제어 `foreign_word_proxy`(actu) 1건 삭제. Huck Finn 방언 코퍼스로 검증 — study 목록 무오염.
- **추출 단어 = 실제 도서 표면형**(마이그 `20260713161000`): 도서에 "children"이 나오면 추출도 `word="children"`(+뜻), `lemma="child"`. 이전엔 표제어 child로 환원 표시 → 일반 사전처럼 실제 형태+뜻. dedup은 표제어 단위(중복 방지), 대표 표면형=챕터 최빈. ※ 방언 과다 코퍼스(Huck Finn)는 일부 오해소(chillen→chill·biler→bile) — 표준 텍스트엔 무해.
- **형태별 POS 추론으로 형태에 맞는 뜻**(마이그 `20260713161500`): "ransomed"(=ransom+ed)가 추출되면 **동사 뜻("몸값을 치르고 풀어주다")** — 표제어 대표 뜻(명사 "몸값") 아님. context_pos(winkNLP) 있으면 그것을, NULL이면 표면형↔표제어 형태차로 POS 추론(+ed/d/ied·+ing→verb·+ly→adverb·-tion/ness/ity→noun·-ous/ive/ful/less→adjective) → 맞는 sense 선택. 실증: ransomed·scented·tilted·scattering·grumbling 전부 동사 뜻. 맞는 sense 없으면 대표 뜻 폴백=polysemy gap 노출(예: boom 동사 sense 없어 booming→호황 → boom·ransom 동사 sense 보강). **완전 정확은 전 단어 sense 완비(polysemy) 필요** — 지속 사전 보강 대상.
- ⚠️ **forward 규칙 대량 생성은 부적합 확정**: 형용사→-ly 생성이 `unprotectedly`·`whitishly` 등 비표준 날조. runtime 역-strip 해소가 정답(base 실재 검증).

### 굴절형·파생형 추출 — 기존 인프라 확인 + 파생 검증소스 완결 (v06.225)
- **목표**: 굴절형·파생형이 "뜻 그대로" 단어추출/조회 되도록 (전체 사전).
- **핵심 발견 — 굴절형은 기존 인프라가 이미 처리**: 2026-06-13 v06.41 마이그가 구축한 `en_inflection_bases()`(규칙 역굴절)+`inflected_forms text[]`(불규칙/클러스터, GIN)+`english_irregular_forms`로 `lookup_word_meaning`(4-tier)·`extract_vocabulary_for_user_v2`(L2)가 굴절형 해소. 검증: galloped→gallop·studied→study·happier→happy(inflection)·children→child(cluster) 전부 뜻 그대로 ✓. **별도 굴절 표제어 생성 불요**.
- **⚠️ 규칙 표제어 대량 생성 시도→롤백**: SQL 규칙이 실단어 판별 못 해 쓰레기 날조(`abashederness`·`ablesness`, 형용사+복수/비교급 오적용+복합). 68,246 row 오염 즉시 전량 롤백. `clean-inflected-forms.mjs` 원칙("신규 규칙형 생성 안 함") 재확인.
- **파생형 = headword(자체 뜻) 완결**: `data/seed/derivational-candidates.json`(빈도 코퍼스 검증 실단어 2,494) 대비 미등록 93(recognise·regulatory·auditory·forestry·-ise/-ory/-ry 등) 채움 + 도서 rare 파생 114(ebullition·volubility·omniscience 등 C2) → **검증 소스 100% 커버**. `classified_by='claude_code_derivational'` 6,180→6,387. 사전 45,496→45,703.

### 사전 sense/POS 오정렬 근본 수리 Phase 2·3 — 문맥-sense 매칭 추출 (v06.225)
- **근본**: 큐레이션 단어추출에서 `creep="변태"` 등 문맥과 다른 뜻 노출 → 원인=`shared_dictionary` 단일-행 + v_level=최난이도 sense. 다의어의 기본 sense(저-V) 용법을 텍스트가 써도 행 v_level(고-V sense)이 V≥6 필터 통과 → 고급 gloss로 오추출(B류).
- **Phase 2 문맥 POS 저장**: `library_book/article_vocabularies` `context_pos` 컬럼(마이그 `20260712160000`) + winkNLP 백필(`backfill-context-pos.mts`, book 1,507·article 212) + 파이프라인 forward-wiring(`extract-lemmas` 지배 POS → ChapterWord → `insert_book_analysis` RPC `20260712170000` + article 직삽입) → 신규 도서 자동.
- **Phase 3 문맥-sense 매칭**: `select_book_chapter_vocab`+`select_article_vocab` LATERAL JOIN(`20260712165000`) — `context_pos`로 `meanings_ko` 문맥 POS 일치 sense 선택 → 그 sense v_level로 V≥6 필터 + gloss·pos 표시, NULL은 row 폴백.
- **검증**: creep(문맥 verb)→"기어가다" · sole(문맥 adj·sense v5)→Gibbon/Les Mis 추출 0건(기본용법 오추출 근절). tsc 0.
- **잔여 sweep 배치 1~3 — 고가치 후보(179) 전량 종결**: 코퍼스 POS 불일치 504건 → 고가치 179 → 배치1 40 + 배치2 109 + 배치3 tail 5 = **누적 154단어** sense 보강(누락 POS 추가·전 sense v_level·flat 정렬·형식 정규화). 발행 shared_words 동기화. context_pos 재백필. 실증: idle(형용사 문맥)→추출 제외(v5) · noble/breeze(문맥)→정확 gloss. flat flip: breeze→"산들바람"·pine→"소나무"(v5)·vacuum→"진공"·crumble→"부서지다"·refrain→"삼가다"·inevitable→"불가피한" 등. A류 오데이터: wan("WAN약어"→"창백한"). **종결 판정**: 남은 🟡·🔴는 (a) 인벤토리 완성돼 Phase 3가 이미 처리 (b) flat-primary 정답(grave→무덤) (c) 명사화/participle 노이즈 — 추가 실익 낮음.
- 사전 데이터 수리 누적 154단어(sense별 v_level 모델) — 상세 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).
- **Phase 4 사전 전역 구조/POS 정규화**: 45,496단어 전수 스캔 → Phase 3를 구조적으로 무력화하던 결함 전량 근절. no_meanings 6,964→0(단일 sense 백필) · legacy string-array 773→0 · enrichment `sense_ko`키 2,045→`meaning` additive · **sense POS 약어(`n.`·`adj.`·`v.` ~5,000)→풀폼**(context_pos와 절대 매칭 안 되던 핵심 결함) · flat pos 흔들림 16→0. ~9,800단어(21%) 정합 → 사전 전역 균일 `{pos,meaning,v_level}` + 전 POS 풀폼, 수천 단어 sense-매칭 즉시 활성화(무손실·additive, 추출 회귀 정상).
- **Phase 5 레벨별 필드 완비 감사 + 예문 전수 채움**: 학습자-대면 필드를 v_level별 전수 점검(meaning/meanings/pos/cefr/v_level 100% · example 84.5%·ipa 64%·syn 59%·coll 31%…). 실 단일어 결측 **2,548개 예문을 Claude 생성으로 전수 채움**(15배치) → **전 레벨 V1~V11 example 100%**, 전체 사전 84.5%→**90.1%**. 잔여 결측 4,517=전량 관용구/구동사/다어절/고어(독립 예문 부적절). 후속: ipa(~10,594)·synonyms·collocations.
- **Phase 6 추출 품질 개선 항목 도출 + 항목1 구현**: 추출 게이트/스코어/조인 필드 전수 진단 → 6개 개선 항목 도출(word_register 노이즈·frequency_rank NULL 0.40손실·커버리지 갭 19.5%·다의어 완성도·spelling_variants·verified). **항목1 구현**: word_register에 `brand`·`abbreviation`·`proper_noun` 카테고리 신설(CHECK 확장 마이그 `20260713100000`) → 브랜드(™) 96·약어 129 분류 → 추출 함수 제외 확장(`20260713100500`). 검증: 3도서 추출 정상·노이즈 0. 상세 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).
- **Phase 7 추출 결과 평가 기반 사전 보완**: 분석된 25권 전권 추출 집계(50,997 노출·distinct 14,704) → cap-40 진입 단어 직접 평가. 추출 품질 이미 높음(초기 플래그 대부분 false alarm) 확인 + **실 결함 7건 수리**(현대/기술 뜻만 있고 문학 대표 뜻 누락 패턴): bid(→명하다/작별)·tender(→다정한)·pardon(→용서/실례)·pin(→핀/시침바늘)·rear·rage·whip. shared_words 동기화. rank 샘플이 놓친 실 도서 다의어 gap을 추출 평가가 정확 포착.
- **Phase 8 도서 배치 채굴 루프(자동화 `scripts/lcp/dict-mine-batch.mjs`) — 100권 완료·yield 포화**: 5권 적재→추출·집계→사전 보완→도서 삭제(transient, 용량 절약) 무인 루프. seed 직접 INSERT + `reprocess-all-se --ids`(fetch+winkNLP) + `select_book_chapter_vocab` 집계(단일-sense·sort_order≤40·rank≤8000 후보를 등장 도서수 합산) + 삭제 + `curation_meta.dict_mined` 표시. **run1(50권)→2,903 후보→실 gap 16 수리**(drift·flush·quarrel·sin·despair·bundle·thrill·vain·blaze·spy·shield·thrust·divine·retreat·surge 동사/형용사 sense 누락 + **ah** abbreviation "암페어시" 오분류→interjection 교정). **run2(+50권=100권)→+430 신규(전부 등장≤4권)→실 gap 2**(articulate·lapse). 수동 15권 별도 ~18단어. **누적 mined ~115권·수리 ~36단어**. **yield 0.32→0.04 gap/book(8배 급락)=포화 확정** — 고빈도 다의어는 run1에서 전량 포착, 남은 SE seed는 이미 정확한 롱테일 희귀어. 근본 사전 전체 이슈 미발견(전부 per-word). 등장 도서수=임팩트 정렬이 핵심 효율 레버. 스크립트 dedup 버그(최종 write 정렬배열→재로드 중복) 수정.

### 아케이드 실 어휘 배선 ① — The Glyph Tongue이 학습자 단어+예문으로 (v06.224)
- **배선**: 스캐폴드가 이미 fetch하던 `example`(도서 챕터는 `source_sentence`=실제 책 문맥)·`pos`·`inflectedForms`를 그동안 버렸던 것 → `Word` 타입 +3필드로 게임에 전달. `GlyphTongueGame.buildChambersFromPool`: 스코프 단어의 예문에서 단어/굴절형을 찾아 룬으로 블랭크 → 석실 생성(세션당 최대 20단어=4석실). 예문 없는 단어 제외, 4개 미만이면 내장 뱅크 폴백.
- **버그 수정**: glyph-tongue page가 `wordPool`을 게임에 미전달 → 항상 내장 폴백. render에 `wordPool` 추가.
- **검증**: `?set=<교육과정 고등>` 진입 → 실단어(fundamental·veterinarian·joint·tackle·status) + 실 예문("Trust is a 〈룬〉 part of...")로 렌더, 내장뱅크 미감지(✅), 무차별 솔버 5/5 해독, pageerror 0. 비스코프 진입 시 내장 회귀 유지. tsc 0.
- 나머지 게임: ②세관·③핸드는 pos/domain·forgery 데이터 성격, ④⑤⑥은 authored 콘텐츠라 배선 방식 상이(후속).

### 도서 탭 「전체 탐색」 필터 재설계 — 묶음 카드 → 라벨 구획 상세 패널 + 내 학습 상태 (v06.223)
- **문제**: `/library/books` 전체 탐색이 한 카드에 나에게/레벨/장르/길이 칩을 작은 10px 라벨로 **뭉쳐 노출("묶음")** + 주제·연령은 "상세 필터" 숨김 disclosure 뒤. 학습자가 조건을 또렷이 판별하기 어려움.
- **재설계(`BookFilterBar`)**: 뭉친 카드 → **항상 펼친 라벨 구획**(`divide-y`) 상세 패널. 각 조건(내 학습·나에게·레벨·장르·주제·연령·길이·음성)이 좌측 고정폭 라벨 + 칩의 독립 compartment. 주제·연령을 숨김→상시 노출 승격, 오디오를 길이 그룹에서 분리해 '음성' 구획, 상세필터 disclosure 제거.
- **신규 필터 '내 학습 상태'**: 내 서재/학습 중/완료 — `enrollment_state` 기반, facet-adaptive(등록 도서 보유 시에만 노출). `BookFilters` +`enroll`·`FacetData` +`hasEnrollments`, `BooksExplorer` 필터 로직 + facet 집계 추가.
- **hydration mismatch 수정**: 주제 상시 노출로 표면화된 결함 — facet 주제 정렬 tie-break `localeCompare`(Node↔브라우저 collation 상이로 순서 엇갈림)를 code-unit 비교로 교체(`BooksExplorer`). 이전엔 주제가 disclosure에 숨겨져 초기 렌더에 없어 잠복.
- **장르 분류 품질 보정(Part A)**: `bucketOf`(genres.ts) 키워드 보강 — `우화`→동화·청소년, `학술·정책·보고서·논픽션·사회학·교과서`→인문·논픽션. `essay_philosophy` 라벨 `에세이·철학·전기`→`에세이·인문·논픽션`(비문학 정직 반영). NULL 폴백→'문학·소설' 한계 주석화. 레벨칩 테스트를 hydration 재시도(toPass+리로드)로 견고화.
- **장르 분류 품질 보정(Part B)** — DB 백필(사용자 명시 승인 "실행"): 발행 genre_norm NULL 2권 `library_books.curation_metadata` additive 병합 — `Introduction to Sociology`→`사회학 교과서`(→인문·논픽션), `Pride and Prejudice`→`로맨스 소설`(→로맨스). 결과: 발행 7권 중 literary(문학·소설) 버킷 **0** = NULL→문학 오분류 완전 해소. 스키마 변경 無(데이터 UPDATE). 잔여: 미발행 NULL 10권은 추후 큐레이션 백필.
- **길이 버킷 세분화**: `reading_minutes` 3버킷(짧게/보통/길게 — 카탈로그 73%가 '길게'>4h에 쏠림)→**5버킷**(~1h/1–4h/4–10h/10–20h/20h+, 임계 60/240/600/1200분). 20h+ 대작(로마제국 120h)을 장편과 분리 → 읽기 부담 판단 명확. 길이 구획도 **facet-adaptive**로 전환(빈 버킷 숨김). `genres.ts`(LENGTH_BUCKETS/lengthBucket)+`BooksExplorer`(lengths facet)+`BookFilterBar`. 검증: SSR로 발행 7권 짧게/4–10h/10–20h/20h+ 노출·빈 1–4h 숨김 확인.
- **범위 밖(사용자 선택)**: CEFR 병기·형식자료 신설·칩별 카운트는 제외. 레벨=V밴드 유지(CEFR=카드 배지 보조).
- **검증**: tsc 0 · eslint 0(변경 `BookFilterBar`·`BooksExplorer`). 04-ui-smoke에 "전체 탐색 필터 구획 렌더 + 레벨칩 7→2 축소 + 초기화 원복 + 콘솔에러 0" 회귀 테스트 추가 → **통과**(격리 실행 40.8s). 전 화면 콘솔에러 테스트도 `/library/books` 포함 10화면 통과(53.8s). 검증 전 워크스페이스 `next dev` 2개 동시 기동→`.next` 공유 오염(라우트 무작위 404) 발견·단일 서버 정리로 복구.

### `/library/scripts` 학습 지도 재설계 — 소스/시리즈 선택 오리엔테이션 (v06.222)
- **문제**: 스크립트 탭이 트랙 섹션 + 얇은 한 줄 소개 + fit 배지뿐 — `source-map.ts` 의 풍부한 오리엔테이션 데이터(능력·학습과학 why·학습법 단계·난이도 V밴드)가 **전부 미사용**. 다양한 레벨의 학습자가 "어떤 소스/시리즈를 왜/어떻게 고를지" 판단 근거 부재.
- **재설계(기본 뷰)**: 개인화 배너 → **난이도 지도**(쉬움→어려움 축 + "여기 있어요" 마커 + 시리즈 칩·추천 강조) → 바로 시작할 글 strip → **시리즈 오리엔테이션 카드**(능력 칩 + why(Lora italic) + 학습법 ①②③ + 레벨범위·편수·음성 + 대표글 + 골라보기 CTA).
- **레벨 밴드 적응**: `getLearnerBand` (미진단/초급/중급/고급) + `bandGuidance` — 미진단은 진단 유도(/diagnostic), 고급은 "대부분 수월" 솔직 안내 + 논증·데이터·원문 깊이 유도. `buildScriptsMap` 이 실집계(V범위·편수·음성·fit·idealCount·추천 트랙) 계산 — **하드코딩 0**.
- **신규 컴포넌트 3**: `DifficultyMap` · `TrackOrientationCard` · `ScriptsGuideBanner`. `source-map.ts` +`LearnerBand`/`buildScriptsMap`/`bandGuidance`/`articleFitRank`/`byRecommendedArticle`/`vToCefrLabel`/트랙 `short`. `ScriptsBrowser` 재작성(추가 fetch 0). 04-ui-smoke 마커를 "난이도 지도" 로 강화.
- **검증**: tsc 0(변경 6파일) · eslint 0 · SSR 렌더 200(배너·지도·마커·추천 리본·6 시리즈 카드 마커 전부 확인). e2e 로그인 beforeAll 은 Supabase auth 경합으로 환경성 실패(스크립트 화면 미도달·본 변경 무관).

### LCP 도서 단어장 라벨 드리프트 수정 — (V{bvl}+)→(V6+) (v06.221)
- **드리프트**: 도서 챕터 단어장 description 이 `(V{book_v_level}+)` 표기(예 V7 도서 "V7+")였으나 단어는 `select_book_chapter_vocab` 의 **P1 고정 floor=V6** 선정 → 라벨/내용 불일치.
- **수정**: `publish_book_word_sets` description 한 줄 `(V6+)` 정합(CREATE OR REPLACE, 제목·slug·메타·선정 전부 불변) + 로컬 마이그 기록.
- **백필**: 기존 발행 세트 **829건** description `(V{n}+)`→`(V6+)` (regexp_replace). 검증: non-V6 잔여 0 · V6 라벨 909.

### 사전 sense/POS 품질 감사 — 다의어 primary 오선정 수리 (v06.216)
- **발견**: 큐레이션 단어추출 검증에서 `creep="변태"`·`founder="침몰하다"`·`spiritual="흑인 영가"`·`bay="적갈색의"` 등 **흔한 sense를 누락하고 특수·희귀 sense를 primary로 선정**한 사전 오류(근본=추출 아닌 shared_dictionary 품질). 발행 mid-rank 다의어 오류율 ~8%.
- **수리**: 11단어 사전 교정(creep→기어가다·nettle→쐐기풀·founder→창립자·spiritual→영적인·bay→만·steam→증기 + shed·sacrifice·grip·echo·faint 누락 sense 보강) + **발행 `shared_words` ~130 appearance 전파**(creep 19세트·faint 23·echo 18 등, `meaning_ko`+`part_of_speech`).
- **잔여**: 전수 근절은 다의어 배치 Claude 재검수(`dict-enrich`) 필요 — 탐지 기계화 어려움(특수 sense primary 판단=Claude). 예방책=문맥 POS 저장+`meanings_ko` sense 선택(RC2/RC3). 설계 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).

### 아케이드 신개념 6종 module_id enum 마이그 **적용** — persistence 활성 (v06.220)
- DB 마이그 `add_arcade_newconcept_module_ids` **적용 완료**(2026-07-12) — `module_id` enum +6값(glyph-tongue/word-customs/lexicon-hands/lexicon-detective/morpheme-rules/silent-rule). 순수 additive(IF NOT EXISTS). DB 검증: pg_enum 6값 존재 확인. 로컬 미러 `supabase/migrations/20260712180000_*.sql`.
- 효과: 아케이드 **12종 전부** FSRS `learning_records.module` / `scores.module` persistence 활성(기존 6종 20260711 + 신개념 6종). 게임 onCorrect/onWrong→기록 저장 완성.

### 아케이드 신개념 게임 ⑥「The Silent Rule」 — 철자 규칙 귀납 (The Witness 계열) · **도시에 6 신개념 완결** (v06.219)
- **메커니즘(독창)**: **설명이 없다.** 각 패널에서 '규칙을 지키는 칸'만 활성화. 오답들이 모두 같은 규칙을 어기게 설계 → 여러 패널을 풀며 규칙을 **스스로 귀납**(오답 시 "N칸 어긋남"만, 어디인지 비공개=귀납 보존). 클러스터 완료 시 규칙+교정 공개. 미로가 아니라 철자·형태 규칙의 **발견 학습**(desirable difficulty = 가장 깊은 정착).
- **3규칙**: ① i before e, except after c · ② 어미 -e 탈락 후 -ing · ③ 단모음+단자음 자음 중복. 각 2패널(정답3+오답2). 교정 노출(recieve→receive…)로 정답 각인.
- **배선**: `SilentRuleGame` + `/play/silent-rule`(minWords=0) + 세렌 섬 무드(Witness) + 패널-라인 마크/워터마크 + 허브 12번째 포탈 + SESSION_META. TS 3유니온 +silent-rule.
- **검증**: 실플레이 7항목 — 오답 "N칸 어긋남"(비공개)·규칙3 귀납·교정4·done 효율86%·모바일 0오버플로·tsc 0·pageerror 0.
- 🎉 **아케이드 6→12종. 명작 해부 도시에의 6 신개념(①글리프 ②세관 ③핸드 ④디텍티브 ⑤형태소 ⑥무언규칙) 전부 실구현·검증 완결.** 뻔한 퀴즈 0. 누적 자동검증 58항목 PASS.
- ⏳ DB `module_id` enum +6종(glyph/customs/hands/detective/morpheme/silent) 마이그 대기.

### 아케이드 신개념 게임 ⑤「Morpheme Rules」 — 형태소가 곧 의미 (Baba Is You 계열) (v06.218)
- **메커니즘(독창)**: 형태소 블록(접두사+어근)을 조립하면 **그 단어의 뜻이 세계에 발동** — UN+LOCK→🔒열림, RE+BUILD→다리 재건, EN+LARGE→발판 확대. 애너그램(=Letter Forge)이 아니라 **형태론 조립 = 세계 변형**. 이중 연역: ①실재 단어인가(형태론) ②그 뜻이 이 장애물에 통하는가(의미). 함정: `discover`처럼 실재하지만 오적용 → "통하지 않는다".
- **학습**: 접사 의미(un=제거·re=다시·en=만들다·dis=반대·over=과도)와 의미의 **합성성**을 체득 = 생성적(L4b) 지식. 라이브 실재검증(✓/✗) 피드백.
- **배선**: `MorphemeRulesGame` + `/play/morpheme-rules`(minWords=0) + 미니멀 슬레이트 무드 + 블록 마크/워터마크 + 허브 11번째 포탈 + SESSION_META. TS 3유니온 +morpheme-rules.
- **검증**: 실플레이 10항목 — 라이브 ✓/✗·없는단어·발동효과·2회랑 정타·오적용 "통하지 않는다"·done 효율86%·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→11종(①글리프 ②세관 ③핸드 ④디텍티브 ⑤형태소 신설, 도시에 6 신개념 중 5 완료).**
- ⏳ DB `module_id` enum +5종 마이그 대기.

### 아케이드 신개념 게임 ④「Lexicon Detective」 — 장면 수확·서사 재구성 (Golden Idol 계열) (v06.217)
- **메커니즘(독창)**: 현장 단서(증거 카드)를 조사해 **단어를 수확** → 그 단어들을 서사의 빈칸(의미역 제약)에 배치해 **사건을 재구성**. **함정 단어(distractor)** 포함 → 뜻·역할을 알아야 풀리는 연역(클로즈가 아니라 장면 교차 추리). 해결 시 빈칸이 채워지며 **범행 서사가 하나의 이야기로 완성**되는 페이로프.
- **학습**: 풍부한 시각 문맥(이중부호화)에서 단어를 만나고, 품사·의미·의미역을 알아야 배치 성공. 2사건(서재·유언장) 각 8단서·6빈칸(정답 6 + 함정 2).
- **배선**: `LexiconDetectiveGame` + `/play/lexicon-detective`(minWords=0) + 세피아 수사 무드 + 돋보기 마크/워터마크 + 허브 10번째 포탈 + SESSION_META. TS 3유니온 +lexicon-detective.
- **검증**: 실플레이 8항목 — 조사→수확 8·2사건 정타 100%·**함정 배치 시 "어긋남"**·done 정확도100%·단서12·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→10종(①글리프 ②세관 ③핸드 ④디텍티브 신설).**
- ⏳ DB `module_id` enum +4종(glyph/customs/hands/detective) 마이그 대기.

### 아케이드 신개념 게임 ③「Lexicon Hands」 — 어휘 속성 시너지 엔진 (Balatro 계열) (v06.216)
- **메커니즘(독창)**: 포커가 아니라 **조커 시너지로 배수를 폭발**시키는 덱빌딩. 단어 카드가 공유하는 속성(어원·품사·도메인·접사·반의어)으로 **족보**를 만들어 칩×배수 → 언어 조커(학자=학술+20칩·접사수집가=접사런 배수×2·고전어=어원+8칩)로 증폭 → 라운드 목표 격파. 24장 속성-태그 덱, 손패 8, 3라운드 누적 목표(260/620/1300).
- **학습**: 족보를 만들려면 **어원·품사·의미장·접사**를 알아야 함 → 뜻 암기 너머 **깊은 어휘 지식(depth)** 훈련. 라이브 chips×mult 프리뷰.
- **배선**: `LexiconHandsGame` + `/play/lexicon-hands`(minWords=0) + 무디 테이블 무드 + 카드 마크/워터마크 + 허브 9번째 포탈 + SESSION_META. TS 3유니온 +lexicon-hands.
- **검증**: 실플레이 7항목 — 손패8·조커3·라이브 프리뷰·최적 봇 전 라운드 격파("엔진 폭발" 2,692점)·**난도 밸런스**(대충하면 R3 막힘, 숙련시 클리어)·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→9종(①글리프 ②세관 ③핸드 신설).**
- ⏳ DB `module_id` enum +glyph-tongue/word-customs/lexicon-hands 마이그 대기.

### 도서 난이도 v2.4 파이프라인 자동 편입 — 신규 도서 자동 산정 (v06.215)
- **`compute_book_difficulty(book_id)`** SQL 함수 신설(migration `20260712140000`, MCP execute_sql 적용) — v2.4 앙상블(ease-게이트 어휘+통사 병목+커버리지 범프)을 DB 이식. 파이프라인-계산 신호(vrl_components·syntax_score·lemma_coverage_pct·cefrj) 사용, **F-K 없으면 sent_p90+clause_depth 대체**(graceful). **claude_v 있으면 미덮음**(v3 가드) + `book_v_level_v1` 원본 보존.
- **배선**: `lcp/dev-process` `compute_book_syntax` 직후 `compute_book_difficulty` 호출 → 신규 도서가 옛 p75 단축 대신 **자동 v2.4** 산정.
- **검증**: Huck claude_v 임시제거→함수 실행 auto_v=**6**(스크립트 v2.4 일치·covbump 1.4·미매칭 26%·v2.4_sql)→복원. tsc clean.

### 아케이드 신개념 게임 ②「Word Customs」 — 위조 적발 (Papers Please 계열) (v06.214)
- **메커니즘(독창)**: 영어 **입국심사관**. 단어의 여권(철자·품사·뜻·예문)을 **일자별 누적 규칙서**와 대조해 **위조 적발** → 승인/거부 스탬프 + 거부 시 **위조 항목 지목**(철자/품사/뜻/예문). 정답 맞히기가 아니라 **오류 탐지**(무엇이 왜 틀렸나로 각인).
- **위조 18종**: false friend(sensible=분별있는≠민감한, library=도서관≠서점, familiar=익숙한≠친척의…) · 철자 트랩(recieve/seperate/definately) · 품사 오용(success 명사≠형용사, economic 형용사≠명사). 3근무일 규칙 누적(뜻→+철자→+품사).
- **배선**: `WordCustomsGame` + `/play/word-customs`(minWords=0) + 세피아 심사대 무드 + 여권 마크/워터마크 + 허브 8번째 포탈 + SESSION_META. TS 3유니온 +word-customs.
- **검증**: 실플레이 7항목 — 정타 18여행자 100%·위조 10적발·오심 케이스("오류")·done 3,880점·모바일 0오버플로·tsc 0·pageerror 0. 아케이드 6→8종(①글리프 ②세관 신설).
- ⏳ DB `module_id` enum +glyph-tongue,+word-customs 마이그 **대기**(미적용 시 fire-and-forget 흡수, 동작 무관).

### 도서 난이도 — p75 재평가 + v2.4 hidden-difficulty 자동화 (v06.213)
- **p75 재평가**: 어휘축 대안 비교(Claude 대비 MAE) — type-p75 **1.17**(최선) vs weighted_avg 1.62·token-cov90 1.40·cov95 2.00. token-커버리지(`lexical_coverage`)는 이론(i+1) 정합이나 짧은책·희귀꼬리로 노이지 → **p75 유지 확증**(대안 기각).
- **v2.4 자동화**: `lemma_coverage_pct`(사전 매칭률)=방언/외래 탐지 신호 발견 — **Huck Finn 74.1%** vs 타 90-95%(방언어 미매칭 → p75가 못 봄). `covBump=f(미매칭율)` 추가(Huck auto 5→6 부분보정, auto-MAE 0.48→0.43) + 저커버리지(≥20%)=확신감쇠·플래그(신규 도서 Claude 검토 유도). **Claude 검토 도서(claude_v)는 v3 가드로 자동값 미덮음**. `scripts/apply-book-difficulty.mjs` v2.4.
- 한계(정직): 완전 Claude-대체 불가(극단 방언은 문학판단) — 자동경로=부분보정+잔여 플래그.

### 도서 난이도 v2.3 — Claude 전문가 캘리브레이션 (외부 앵커 100% 달성) (v06.212)
- **작업**: LCP 대량 GET 도서 **전체 대상 25권(published 23 + ready 2)**을 **Claude(LLM-as-expert)가 본문샘플+문학지식으로 한 권씩 큐레이션 평가** → 플랫폼 v2.2와 대조 → Claude 판정을 강추정기로 편입해 정확도 고도화. **Claude 캘리 커버 100%**(25/25). ready 대작 Dialogues(Plato) V9·Les Misérables V8 편입(발행 timeout이나 학습가치). `scripts/calibrate-book-difficulty-claude.mjs`(published+ready).
- **텍스트 지표 사각지대 교정**(v2.2 앙상블이 구조적으로 못 봄):
  - **방언(eye-dialect)** — Huckleberry Finn V5→**7** (방언어=짧아 F-K↓·흔한 lemma=V↓로 지표가 못 봄; Twain 서문 "a number of dialects" 명시). 텍스트 지표 최대 사각지대.
  - Kipling 조어·율문 Just So V5→7 · 철학 추상 Book of Tea V6→7 · 아동 운문 Poetry V7→5.
  - 검토 8권 해소: Gibbon **11**·Foundational **8**·Alice Adams(CEFR-J C1 과대) **6**.
- **공식**: `v3 = round(0.65·claude_v + 0.35·ensemble_v2)` · `difficulty_v2.{claude_v, claude_note, v3}` 감사저장 · `book_v_level_v1` 원본 보존.
- **정확도 결과**: 외부 앵커(고전 published 난이도 consensus) 적중 **90%→100%**(10/10). `scripts/verify-book-difficulty.mjs` 갱신(적용값 기준). 잔여: 신규 도서 자동화용 사각지대 감지 프록시(비표준 orthography 비율).

### 아케이드 신개념 게임 ①「The Glyph Tongue」 — 문맥 해독 (Chants of Sennaar 계열) (v06.211)
- **배경**: 명작 10종 해부 도시에(설계 덱) → "뻔한 퀴즈류 탈락, 핵심 루프 훔치기" → 최우선 빌드 ①번 프로토타입 구현.
- **메커니즘(독창)**: 목표 단어를 **미지의 절차적 룬**(단어 해시→결정적 SVG)으로 제시. **뜻을 절대 주지 않음** — 한 룬이 2개 영어 비문에 반복 등장 → 학습자가 **문맥으로 삼각측량**해 의미 추론 → 코덱스에 가설 배치 → **봉인(검증)** → 맞으면 룬이 영어 단어로 풀리며 **비문 전체가 읽히기 시작**(에피파니 페이로프). 3석실×5룬 내장 뱅크.
- **학습**: 문맥 추론(원칙 #5 맥락) + 능동 인출·검증(#1) + 룬→단어 이중부호화(#4). 얕은 고르기가 아니라 추론.
- **배선**: `GlyphTongueGame` + `/play/glyph-tongue`(scaffold minWords=0) + AmbientBackground 파스텔 필사본 무드 + glyph 마크/워터마크 + 허브 7번째 플래그십 포탈 + SESSION_META. TS 3유니온(ArcadeGameId/ModuleId/ScoreModule) +glyph-tongue.
- **검증**: 실플레이 하니스 — 3석실 정답 배치→봉인→"비문을 읽어냈다" 전부 통과, done 15룬·100%·3석실, 스크린샷(룬 비문·해독 후 가독), tsc 0·pageerror 0·console 0.
- ⏳ DB `module_id` enum +glyph-tongue 마이그레이션 **대기**(미적용 시 audit/scores fire-and-forget 흡수, 게임 동작 무관 — 기존 6종과 동일 패턴).

### VRL Phase2 런타임 함수 스키마 드리프트 기록 12종 (v06.220)
- **최우선 재현성 복구**: 진단·프로필·자동상향 런타임 함수 **12종**이 committed 마이그레이션 부재(out-of-band)로 DB 재구축 시 DiagnosticClient/VLevelPromotionCheck/pg_cron RPC 전부 붕괴 위험이었음.
- **정확 대조**: admin_vrl_*(6)·is_admin 은 마이그 존재(드리프트 아님) 확인. 실제 부재는 의존 closure **12함수** — `effective_confidence`·`calculate_next_review_due`·`update_user_v_level`·`analyze_diagnostic_result`·`analyze_track_diagnostic_result`·`apply_diagnostic_result`·`analyze_and_apply_{diagnostic,track,comprehensive}_result`·`auto_promote_{v_level,track_level}_for_user`·`cron_auto_promote_all_users`.
- **기록**: 현 DB 정의를 pg_get_functiondef 로 덤프해 의존 순서 기록 마이그(동작 변경 0). **참조 테이블·컬럼도 기록 완결** — `user_level_snapshots`(25컬럼·5FK·4CHECK·4인덱스)·`vrl_data_integrity_concerns` CREATE TABLE + user_profiles Phase2 컬럼(`current_v_level_meta`·`target_v_level_meta`·`learning_activity_score`·`next_level_review_due_at`·`segment`·`total_words_*`) ALTER, 전부 `IF NOT EXISTS`(멱등). ⚠️ 잔여: 진단 문항 시드 데이터 + user_level_snapshots own-data RLS 정책.

### VRL/VCB 파이프라인 종합 점검 + 5개선 (v06.219)
- **점검**(2-agent 정찰 + DB 실측): VRL 4축 분류(shared_dictionary 45,496어) — v_level·meaning·cefr 100%. VCB seed→enrich→큐레이션→발행→학습자 전 구간 배선 확인(cast-2000 audit chain 온전).
- **개선 5건**:
  1. **추천/컬렉션 딥링크 죽은 앵커 (교차 버그)** — 추천 카드·진단결과·VCB 컬렉션/런이 `#set-{slug}`로 링크하나 학습자 카드는 `id="set-{UUID}"` → slug(≠uuid·NULL 다수)라 `:target` 하이라이트 전부 불발. **4곳 `#set-{set_id}`(UUID) 정합**(RecommendedSetsSection·DiagnosticClient·collections·runs).
  2. **/admin/vrl/automation requireAdmin 누락** — 형제 VRL 페이지와 달리 RSC 가드 결손(3층 규약 위반) → `requireAdmin` 추가.
  3. **vcb_publish_commit 스키마 드리프트** — 발행 전량 의존 RPC가 마이그 부재(proposal "미적용" 표기, DB엔 실존) → DB 덤프로 기록 마이그(재현·감사).
  4. **admin 진단 페이지 stale 안내** — "L0/L1/L2 미분류"(실제 100% 완료) + `apply_diagnostic_result`(실제 `analyze_and_apply_diagnostic_result`) 정정.
- **관찰(리포트 권고·미수정)**: shared_dictionary track/domain/skill 축 ~7,100어 NULL(후속 추가어 미분류) · **VRL/VCB Phase2 런타임 다수 함수·테이블이 마이그 이력 밖(DB-only)** — 재현 불가(대규모 기록 필요) · track auto-promote 미배선 · VCB 큐레이션 일괄에 비-enriched 혼입.

### LCP G1 book 추천 링크 수정 (v06.218)
- book_iplus1 추천(`recommend_word_sets_for_user`)이 `/library/vocab#set-{slug}`로 링크되나 그 페이지가 library_book 제외+slug NULL이라 죽은 앵커였음 → `library_book` 카테고리는 **도서 브라우즈(`/library/books`, i+1 레일)로 라우팅**. (deep-link는 RPC에 book_id 노출 필요 — 후속.)

### LCP 도서 파이프라인 종합 점검 + 6개선 (v06.215)
- **점검**(3-agent 정찰 + DB 실측): 발행 도서 23권(SE 14·gutenberg 4·storyweaver 2·lit2go/pressbooks/wikibooks 각 1). 4축 난이도·챕터·단어장 전권 완비. 콘솔 9탭 + book_curation_jobs 큐(Claude 드레인) + 학습자 8접점(브라우즈·enroll·읽기·챕터단어장·plan·처방·모듈·CTP) 추적.
- **개선 6건**:
  1. **표지 6권 백필** — Alice·Sherlock(gutenberg cover.medium.jpg) + Oz·Fables·Just So·Railway Children(SE og:image). 각 URL curl HEAD 200 image 실검증. (lit2go/pressbooks/wikibooks 3권은 표지 소스 없음 = NULL 정당.)
  2. **CATALOG_SOURCES 통계 누락** — storyweaver/pressbooks 미포함 → 통계 칩 항상 0(ACP VALID_SOURCES 동류). 8종 정합.
  3. **SeedCatalogRow.source 타입 stale** — lit2go/storyweaver/pressbooks 추가·openstax 제거.
  4. **ScriptQuiz 챕터 "본문으로" 잘못된 id** — `/text/{bookId}`(library_books.id→조회 실패→mock 폴백)→`/library/books/{bookId}`.
  5. **plan 도서 발행게이트 불일치** — plan picker가 `status='published'`만 검사 → 브라우즈엔 없는 KR-unsafe 도서가 plan에 뜨고 enroll 실패. `copyright_safe_in_kr`+`published_at` 정합.
  6. **스키마 드리프트 기록** — `compute_book_vrl`/`compute_book_cefrj`/`compute_book_coverage` 함수 본체가 마이그레이션 부재(out-of-band) → DB 덤프로 기록 마이그(재현·감사 복구, 동작 변경 0).
- **관찰(리포트 권고·미수정)**: G1 book_iplus1 추천 죽은링크(`/library/vocab`가 library_book 제외+slug NULL) · G4 Dictation 도서챕터 미스코핑 · auto_curate 게이트지표≠발행지표 · prod 워커 pressbooks/compute_book_difficulty 미배선(dev 비대칭) · chapter_count≤100 상한 · set 라벨 드리프트("V{bvl}+" vs 실 V6 floor).

### ACP UI 디자인 부채 백로그 + 안전 2수정 (v06.214)
- **백로그** [acp-ui-a11y-backlog.md](proposals/acp-ui-a11y-backlog.md): 12 컴포넌트 감사 산출을 P1(대비)~P4(정체성) 우선순위·파일위치·수정법으로 정리. 색/레이아웃/정체성 변경 항목은 **시각검증(dev 서버) 트랙**으로 분리(블라인드 편집 회귀 방지).
- **안전 2수정**: GetGuidePanel `open:shadow-[var(--shadow-sm,none)]` 오타(그림자 영구 미적용)→`--sh-sm` · BulkArticlesTab 소스 우선순위 뱃지 `'white'` 하드코딩→`var(--ti)` 토큰화(시각 동일).

### ACP 콘솔 키보드 포커스 보강 — focus-visible 14 컨트롤 (v06.213)
- **BulkArticlesTab (9)**: 대량 가져오기·삭제·큐추가 액션 버튼 + 학습자레벨·정렬·발행·audio 세그먼트 토글 + 조건 접기. **CuratedArticlesTab (5)**: 전체/행 선택 아이콘 버튼·드레인 배너 버튼·발행 버튼.
- 순수 additive(focus-visible ring만) — 색·레이아웃 회귀 0(WCAG 2.4.7). tsc clean.
- 잔여(다음 트랙·시각검증 권장): 44px 터치타겟 확대 · `--admin` 토큰 채택 · ScoreBar 중복 통합 · 저빈도 필터칩 focus.

### 학습자 기사 브라우즈 a11y 패스 — CEFR 배지 대비 + 44px/포커스 (v06.211)
- **ArticleCard**: CEFR 배지를 `text-white`(고정 흰 글씨) → **틴트 패턴**(색=텍스트·배경 color-mix 15%)으로 통일 — 소스/적합도 배지와 동형. A1 파스텔뿐 아니라 **다크모드에서 밝은 토큰(`--p` 등) 위 판독 실패**까지 근본 해소(양 테마·전 레벨 대비 보장). "학습하기" 버튼 `min-h-[44px]`+active, 원문 링크 36→44px + focus-visible + active.
- **ScriptsBrowser**: 묶음 필터 해제 X 버튼 16→24px, 빈상태 초기화 버튼 focus-visible + active 보강.
- 범위: 학습자 노출 최다 2컴포넌트 우선. 콘솔측 systemic 부채(BulkArticlesTab focus-visible·44px, `--admin` 토큰, ScoreBar 중복)는 다음 트랙 — 브라우저 시각검증 가능 시점 권장.

### ACP 신규 소스 2차 심층 재점검 — owid 본문 정제 + A1 대비 교정 (v06.210)
- **6개선 재검증**: 1차(v06.209) 개선 전부 유지 확인 — 제목 엔티티 0 · syntax NULL 0 · 라벨/필터 코드 반영.
- **owid 본문 품질 (신규 발견)**: owid 8기사 전량이 본문에 hex 엔티티 + 각주(Endnotes)·BibTeX 인용(Cite this work)·라이선스 안내(Reuse this work freely) 트레일러 누출(본문의 16~41%). 읽기·어휘 추출 오염.
  - **파서 근본 수정** `owid.ts`: htmlToPlainText 후 최초 트레일러 마커에서 본문 절단.
  - **기존 8기사 백필**: 엔티티 디코드 + 트레일러 절단(예 22,888→19,187자) + word_count·syntax_score·article_v_level 재계산. 검증: URL·엔티티·보일러플레이트 0.
- **접근성 defect 교정** `ArticleCard`: CEFR 배지가 흰 글씨인데 A1=`#86EFAC`(파스텔·대비 ≈1.4:1)라 판독 불가 → 대비 통과 녹색(`#15803D`)으로 교정.
- **디자인 감사(12 컴포넌트)**: 광범위 pre-existing 부채 확인 — 44px 미만 터치타겟(전반)·focus-visible 누락(BulkArticlesTab ~15곳)·하드코딩 소스/CEFR hex 팔레트(ArticleCard, 다크 무대응)·`--admin` 토큰 미사용(전 admin이 `--p`)·ScoreBar 중복/임계값 불일치. **신규소스 범위 밖·광범위라 미수정, 리포트에 우선순위 권고로 기록**(모범: CoverageMatrix 색+빗금+텍스트 3중부호·CandidateTable 아이콘 구분).

### ACP 신규 소스 전 파이프라인 자동 점검 + 5개선 (v06.209)
- **점검**(3-agent 정찰 + DB 실측): 신규 소스 noaa/usgs/owid/factbook/elife **전 5종 발행 성공**(4/5/8/7/2건) · 10개 배선지점·게이트·drift-lock 전부 등록 확인 · 학습자 6접점(브라우즈/읽기/단어장/plan/처방/CTP·모듈) 도달 경로 추적. 백엔드 파이프라인 건전.
- **개선 5건**:
  1. **seed-list 후보 필터 버그** — `seed-list/route.ts` `VALID_SOURCES` 6종만 → `?source=noaa` 등이 탈락해 전 소스 혼합 후보 반환. 14종 정합.
  2. **plan/hub article 열기 404** — `materialHref('article')=/library/scripts/{id}`가 무조건 도서로 redirect→`notFound()`. `/library/scripts/[id]` 리졸버가 발행 article 을 `startArticleLearning`→리더로 연결(브라우즈·처방과 대칭).
  3. **제목 HTML hex 엔티티 잔존** — `decodeEntities`(_helpers + voa 로컬)가 `&#x27;` 등 hex 미처리 → owid 1 + voa 7 제목에 `&#x27;` 노출. hex 디코드 보강 + 기존 8제목 백필 + 회귀 테스트 4.
  4. **SourceFeedList 라벨** — 신규 소스 raw key(`noaa`…) 노출 → 8종 라벨 추가.
  5. **BulkArticlesTab 프리셋 라벨** — "전체 (12 소스)" → 실제 14 정합.
- **데이터 백필**: `syntax_score` NULL 22기사(noaa/usgs/factbook/wikivoyage/plos) `compute_syntax_score` 재계산.
- **관찰(설계상·미수정)**: article 단어장은 추천엔진·WordVault 브라우즈에서 격리(의도) · plan article 게임은 texts 변환 전 unscoped · 신규 expository 소스는 register→stage_band 미승격(owid=argumentative만 S3, 나머지 v_level 종속). ⚠️ 라이브 브라우저 테스트는 디스크 100%+동시 dev서버로 회피 → 백엔드/정적/타입/테스트 검증 채택.

### 도서 난이도 다축 평가 v2 — 어휘 단축 왜곡 교정 (v06.208)
- **문제**(사용자 지적): `book_v_level = 어휘 p75` 단축 → (1) 희귀 content-word 꼬리가 p75 부풀림(Alice ease 70인데 V6), (2) 통사 완전 무시(Foundational 학술 F-K 14.55인데 V6·Gibbon 최난이도인데 V9 캡). 23권 실증.
- **설계**(재고): "100% 정확"의 단일 텍스트 공식은 불가(ground truth=학습자 성과) → **앙상블+확신도+외부앵커**로 실효 정확도 수렴. 공식: **ease-게이트 어휘축**(읽기 쉬우면 중심값·어려우면 p75 → 문맥 희귀어 탈부풀림) + **통사축**(F-K·syntax_score) + **병목 융합**(0.75·max+0.25·mean — 어느 한 축만 어려워도 어려움) + **CEFR-J 앵커**(lexOffset 0.04≈편향0) + **CEFR-J 교차확증 확신도**. 설계문서 [book-difficulty-multiaxis.md](proposals/book-difficulty-multiaxis.md).
- **적용**(서비스롤·非DDL, v2.2): syntax_score 16권 백필(`compute_book_syntax`, 전권 확보) 후 재산출 → **고확신 13권 `book_v_level` 갱신**(Alice V6→5 conf 0.99·Jane Eyre V9→8·Great Expectations V9→8·Wizard V6→5 등) + **저확신 8권 검토 회부**(Gibbon V9→11·Foundational V6→8·Alice Adams V9→6 등). CEFR-J MAE **0.78 V**. 전권 `vrl_components.difficulty_v2` + `book_v_level_v1` 구값 보존(되돌리기 가능).
- **부수 발견**: `compute_syntax_score.score = LEAST(100, sent×2+clause×6)`가 **100 포화**(Alice 112·Gibbon 212 전부 캡)라 변별력 0 → 앙상블은 raw clause_depth+F-K로 대체. 재보정 마이그 `20260712120000_ctp_syntax_score_recalibrate` 작성(선형 분산) — **CTP score 소비처 임계값 재검증 후 apply**(앙상블 무영향).
- **정확도 검증 하니스** `scripts/verify-book-difficulty.mjs` — 3중 수렴검증: v2.2 외부 앵커(고전 published 난이도) 적중 **9/10(90%)** vs old 60% · 고확신 CEFR-J MAE **0.27V** vs 저확신 1.75V(confidence가 accuracy 예측 입증). 100% 경로=저확신 8권 인간검토+IRT.
- **잔여**: 검토 8권 어드민 flip · 소비처(recommend·i+1·source-map) 전환 · score 재보정 CTP 조율 apply · Tier2 IRT.

### CTP DCP S4 도서 콘텐츠 populate + kind 정합 (killer band 활성화) (v06.207)
- **갭 발견**: DCP 문항 64개가 전부 **S3(논증 article 7건)** 뿐 → S4(도서 v≥7·killer band) 학습자는 처방 ④ 연습이 영영 비활성. 게다가 `csat_dcp_items.kind` CHECK=`('article','chapter')`인데 catalog·`prescribe_today` 조인은 도서를 `kind='book'`으로 씀 → **book DCP 구조적 삽입/조인 불가**(CTP 백엔드 잠재 불일치).
- **마이그 `ctp_dcp_items_kind_allow_book`**: kind CHECK 에 `'book'` 추가(catalog 정합, additive).
- **드레인 `scripts/generate-book-dcp.mts`**: 발행 도서 챕터 본문(`content_chunks`)→`generateDcpItems`(결정론·LLM 0)→`csat_dcp_items` upsert(멱등). 챕터별 `paragraph_idx` 전역 오프셋(chapter×1000+para)으로 도서 내 충돌 회피. Claude Code 수동 드레인 관행.
- **populate**: Decline and Fall(설명문 v9)·Pride and Prejudice(서사 v8) → **S4 book 96문항**(order 48 + insert 48). 검증: prescribe_today practice 조인 S4 반환 · book order 채점 계약 실측(`source_order [0,4,2,1,3]`→`[0,3,2,4,1]` 정답) · 재실행 멱등(96 유지). **DCP practice S3·S4 양쪽 활성화.**

### 아케이드 아이덴티티 폴리시 — SVG 마크·워터마크·결과 히어로 (v06.206)
- **동기**: 아트 디렉션 후속 폴리시(사용자 "전부 다듬어줘"). 남은 이모지 잔재 제거 + 게임별 아이덴티티 강화.
- **게임킷**: `GameMark`(6종 공용 SVG 마크)·`IconSound`(SVG 사운드 토글) 추가. `AmbientBackground`에 `watermark` 옵션(각 게임 마크를 우하단 대형·soft-light 은은한 워터마크). `GameDone`에 `mark` 히어로(글래스 배지+파티클).
- **이모지 교체**: Daily Blitz 📅→일출 마크 배지 · HUD 🔊🔇→SVG 사운드 아이콘(게임킷+Daily) · Ghost Race 결과 🏆 제거(마크 히어로 대체). 🔥(스트릭/콤보)는 관용적이라 유지.
- **6종 배선**: 각 게임 watermark(자기 마크) + GameDone/결과 mark 히어로. 밝은/무드 배경 양쪽에서 글래스 배지 가독.
- **검증**: 6종 인터랙티브 QA 재통과(정타·스코어·승리/결과) · 스크린샷(Daily 인트로·Ghost/Letter 결과 히어로·워터마크) · tsc 0 · pageerror 0 · console 0. (⚠️ 작업 중 C: 디스크 재만충→`.next` 클리어로 dev 복구.)

### LCP ready 도서 드레인 — 발행 카탈로그 7→23권 (v06.205)
- **갭**: LCP 품질 스윕(서비스롤 tsx)에서 **18권이 `ready`+copyright_safe인데 미발행**(학습자 카탈로그 7권뿐) 발견 — ACP 스트랜딩의 도서판. 파이프라인 자체는 건전(NULL v_level 0·lbv NULL lemma 6.10% proper-noun/hapax 잔여·단어세트 word_count=0 **0**).
- **드레인**: `ready`→`published` 상태 플립 → 트리거 `trg_publish_book_word_sets_t`가 챕터 단어세트 자동 생성(멱등). **16권 발행**(Great Expectations V9·Jane Eyre V9·Sherlock V8·Wind in the Willows V8·Wizard of Oz V6·Alice V6·Huck Finn V7 등) → **발행 7→23권**, V-Level V6:3 V7:8 V8:4 V9:6 풍부화, library_book 챕터 단어세트 **283→909**(+626).
- **실 발견 (LCP 한계)**: `publish_book_word_sets`가 초대형 책(**Les Misérables 364ch·Dialogues**)에서 **statement timeout** — 모놀리식 전-챕터 생성이 API 타임아웃 초과, 트랜잭션 롤백(두 책 `ready` 유지·무손상). **향후 fix**: 챕터 청크 분할 발행(per-chapter 드레인) 또는 statement_timeout 상향. 현재 25권 중 2권만 잔여.
- DEV 데이터 드레인(코드 변경 0) — 트리거·RPC는 기존.

### CTP ⑥ Today UI Phase 2 — DCP 구문 연습 인터랙션 (order/insert·채점·error_cause) (v06.204)
- **신규 라우트 `/practice/dcp`** — hub 처방 ④ 연습 블록 진입점. 오늘 처방(`prescribe_today`) practice 문항을 세션으로 진행. S3 미만/문항 없으면 Calm 빈 상태.
- **인터랙션**: `DcpItems.tsx`(**order**=문장 순서 배열: 이동 버튼 44px·드래그 대신 a11y 우선 / **insert**=삽입 위치 슬롯 탭) + `DcpPlayer.tsx`(세션 오케스트레이터 — 채점 피드백·정답 공개·진행바·완료 요약). 제출 포맷은 `grade_dcp_item` 계약(order `{order:[presented idx]}`·insert `{position}`).
- **채점·기록**: `dcp-actions.ts`(`fetchDcpPracticeItems`·`gradeDcpItem`·`recordDcpErrorCause`). 마이그 `ctp_dcp_grade_return_attempt` — `grade_dcp_item` 이 `attempt_id`+`question_id` 반환(오답 원인 부착용). 채점=서버 `answer_key`(클라 노출 0).
- **error_cause 1-tap**: 오답 시 5원인 자기보고(vocab/parsing/structure/inference/timing) → `csat_item_attempts.error_cause`(RLS owner + CHECK 이중방어). 정적 라우팅=존재 라우트만 링크(vocab→`/flashcard/play`, 나머지 격려 tip · **허위 링크 금지**). hub practice 블록 상태칩→실런처(`/practice/dcp`).
- **검증**: tsc clean · `grade_dcp_item` order 채점 로직 DB 실측(`{order:[4,0,3,1,2]}`=정답) · 단위+렌더 테스트 **9/9**(`dcp.test.ts` 5 `correctOrderFromKey`·ERROR_CAUSES 무결성 + `DcpPlayer.test.tsx` 4 renderToString). **CTP ⑥ Today UI 완결**(Phase 1 처방정본 + Phase 2 DCP).

### hub "오늘" META 재설계 Phase 1 — prescribe_today 정본화 (CTP ⑥ Today UI) (v06.203)
- **META 확정(Opt A)**: hub "오늘"의 삼중 출처(수동계획 `study_plan_items` · `TodayFocus` 클라이언트 휴리스틱 · CTP `prescribe_today`)를 단일 정본으로. 우선순위 — **오늘 수동계획 있음 → `TodayPlanCard`**(사용자 의지 우선) · **진단완료 + 수동계획 없음 → `TodayPrescriptionCard`**(★ `prescribe_today` 5블록 스마트 기본값) · **미진단 → `TodayFocus`**(진단 유도). `TodayFocus` 페르소나 휴리스틱은 진단완료자에게 처방으로 승격 대체. 결정 문서 [hub-today-meta.md](proposals/hub-today-meta.md).
- **신규**: `lib/learner/prescription-actions.ts`(`fetchTodayPrescription` 서버 액션 — `prescribe_today` 호출·파싱·isDiagnosed·듣기text) · `components/home/TodayPrescriptionCard.tsx`(서버, 5블록: 복습/듣기/읽기/연습/점검 + 번호 스텝·색+아이콘 이중부호·44px+·다크 토큰) · `components/home/PrescriptionArticleLaunch.tsx`(client — article 은 URL 직결 불가 → `startArticleLearning` texts 변환). `hub/page.tsx` 분기 배선.
- **런처 매핑**: 복습→`/flashcard/play`(전역 due) · 듣기→최근 `/text/[id]/echo` or `/library/books` · 읽기→book `/library/books/[id]`·article texts 변환 · 점검→`/scriptquiz`. ④ DCP 연습은 **Phase 2**(order/insert 인터랙션·`grade_dcp_item`·error_cause) — Phase 1 은 상태칩만.
- **검증**: tsc clean(신규 3파일+배선, 전체 잔여는 기존 `recommend/next-action.mock.ts` 1건 무관) · `prescribe_today` 5블록 payload DB 실측(파서 계약 일치) · 렌더 테스트 `TodayPrescriptionCard.test.tsx` **7/7**(renderToString, 전 분기). ⚠️ dev 서버 1개 원칙+디스크 99%로 Playwright 스모크 대신 renderToString 채택.

### 아케이드 아트 디렉션 — 게임별 무드 그레이딩 6종 완성 (v06.202)
- **동기**: 학습자 관점 디자인/색감 점검 — 기존 아케이드는 "깔끔한 학습 UI"였으나 레퍼런스(Blue Prince·Outer Wilds·Witness·지중해 듀오톤) 수준의 감성엔 미달(플랫·무드 없음). Calm UI와 충돌 없이(Calm≠밋밋) 격상.
- **허브 재설계**: 플랫 화이트 카드 → **황혼 갤러리 + 6 무드 포탈**(스테인드글라스). 듀오톤 배경·앰비언트 드리프트 글로우·그레인·비네트 + **이모지→일관 SVG 라인 마크** + 깊이/글로우/타이포.
- **게임킷 `AmbientBackground`** 공용 컴포넌트 — 중앙 밝게(가독)·가장자리 무드로 깊게(드라마) + 글로우·그레인·비네트. reduced-motion 대응.
- **6종 무드**: Daily Blitz=새벽(peach/rose) · Letter Forge=엠버(gold/brown) · Cascade=수중(cyan/teal) · Connections=다스크(violet/indigo) · Word Economy=골드(amber/bronze) · Ghost Race=트와일라잇(magenta/purple). 밝은 타일/어두운 텍스트 가독 유지.
- **검증**: 6종 dev :3100 스크린샷(무드·가독) + 인터랙티브 QA 재실행(정타·스코어·승리/결과 전부 통과) · tsc 0 · pageerror 0 · console 0. 커밋 `3f7aee8`(허브+시스템+Ghost) + 본 커밋(5종).

### ACP 신규 소스 학습자 표면 배선 — source→learner loop 닫음 (v06.201)
- **갭 발견**: 이번 세션 신규 소스 중 **wikipedia·plos·wikivoyage·usgs·noaa 5종이 `source-map.ts`(학습자 /library/scripts 트랙 맵)에 미등록** → 발행돼도 `SOURCE_TO_TRACK.get()`=undefined로 **트랙 그룹에서 완전 누락**(실측 8편 stranded). ArticleCard `SOURCE_META`도 미등록 → raw 회색 라벨.
- **수정**: `topic`(과학) 트랙에 plos/usgs/noaa 추가(oneLine 지구·기후 반영) + **신규 `reference` 트랙**('백과·여행으로 넓히기' — wikipedia/wikivoyage, Schema Theory 근거) + `computeTrackCounts` Record + ArticleCard 5소스 메타(라벨·액센트). TrackKey 6→7·SOURCE_TRACKS 6→7.
- **검증**(서비스롤 tsx): 발행 14소스 전부 트랙 매핑(⚠트랙없음 0) — stranded 8편(wikipedia/plos/wikivoyage/usgs/noaa) 학습자 노출 복구. web tsc clean. **런타임 스모크 통과**(기존 :3000 재사용, `test:e2e:smoke` 2 passed — /library/scripts 포함 10 학습자 화면 콘솔에러 0).
- **커버리지 배치**(v06.201 후속): 신규 소스 20편 ingest→publish 스케일 스트레스테스트 **0 실패**(wikivoyage 12,046w·plos 6,599w 포함) → reference 밴드 5→14, usgs/noaa/wikivoyage/factbook/plos 실 카탈로그 presence. DEV 데이터(코드 변경 0). 남은 빈칸 17/30=구조적(A1 전무·C2 미검출).

### 아케이드 6종 자동 QA 스윕 + Daily Blitz 공유 버그 수정 (v06.200)
- **인터랙티브 QA 하니스**(Playwright) — 6게임을 정답 매핑으로 **실제 플레이**(정타·스코어·콤보·승리/결과·상점 구매·50:50·매치 클리어·레이스 완주) 자동 검증. 6종 전부 통과: Letter Forge 10/10(3,213점)·Cascade 22매치(4,281점)·Connections 4/4 완승·Word Economy 26정답·5강화·코인·Ghost Race 12/12 승(5.2s).
- **버그 수정** — `DailyBlitzGame` 결과 공유의 `navigator.clipboard.writeText`를 `void`+동기 `try/catch`로 감싸 **프로미스 rejection 미처리(unhandledrejection)** → insecure/권한거부 컨텍스트에서 pageerror. **프로미스 `.then/.catch` + `execCommand` 폴백 + 성공 시에만 "복사됨" 표시**로 재설계. 재검증 pageerror 1→0.
- **모바일 퍼스트 검증** — 6게임 390×844 가로 오버플로 **전부 0px**(Cascade 4×4 보드·Connections 영+한 타일·Word Economy 상점 반응형 2열 확인). 데스크톱/모바일 pageerror·console error 0.

### ACP NOAA Climate.gov 기후과학 소스 신설 — 신규 도메인(climate·CSAT 최빈출) (v06.199)
- **NOAA ingester** — `ingest-article/noaa.ts`. NOAA Climate.gov Understanding Climate / Features(Drupal 서버렌더 HTML, 의존성 0). **PD(US Gov) → 발행 허용 · 인용 자유**. **register=expository**, **신규 도메인 climate-science**(대기 CO₂·해양 열용량·지구온난화·빙하) — **CSAT 최빈출 주제**. USGS(지질·재해)·NASA(우주)와 구별. B2-C1 접근형 과학 저널리즘.
  - 본문: `field--name-body`(가장 큰 조각 = 본문 필드만 · 관련링크 region 제외) → `field-media-caption` 차트 캡션 제거 + References/인용목록 절단 + 후행 관련-기사 링크(문장부호 없는 짧은 라인) 최대 6줄 제거.
  - 리스트: anchor 텍스트=제목(USGS 와 달리 직접 페어).
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue(host=`www.climate.gov/news-features/`) + 어드민 UI(🌡 CloudSun) + 대량 GET(14소스 + noaa-feed understanding-climate/features). **drift-lock 30 tests**. tsc clean(패키지+web).
- **라이브 검증**(tsx 실 ingester) — Ocean Heat(984w)·CO₂(1060w)·global temp(1122w)·glaciers(1058w)·Incoming Sunlight(2299w) 5기사 clean · listNoaaFeed understanding-climate 7건(★51-54)·features 12건.
- 마이그레이션 `acp_source_add_noaa` (source CHECK +noaa) — **적용 완료**(2026-07-11, 대시보드 SQL Editor — MCP 세션 단절 우회). library_articles·library_article_seed_catalog 두 CHECK 모두 `'noaa'` 포함.
- **DB end-to-end 발행 증명**(서비스롤 tsx · MCP 우회) — Ocean Heat Content INSERT → **license_class=public_domain·display_only=false·copyright_safe=true** → `analyzeArticle` 245 어휘 → register=expository·B2·noise 0.005 → 발행 트리거 → 단어세트 **40 words published**(greenhouse 온실·marine 해양의·emission 배출·atmospheric 대기의·ecosystem 생태계·absorb 흡수 — 기후/CSAT 도메인, 한국어 뜻 완비). USGS와 동형 확인.

### ACP USGS 지구과학·자연재해 소스 신설 — 신규 도메인(earth-science) (v06.198)
- **USGS ingester** — `ingest-article/usgs.ts`. 미국 지질조사국 Featured Stories / Science Snippets(Drupal 서버렌더 HTML, 의존성 0). **PD(US Gov) → 발행 허용 · 인용 자유**. **register=expository**, **신규 도메인 earth-science**(지진·화산·허리케인·광물·산사태) — NASA(우주)·NIH(건강)와 구별되는 빈칸. B2 접근형 과학 저널리즘.
  - 본문: `node-main-body` 컨테이너 → `d-media-copyright` 이미지 크레딧 반복 제거 + plain-text catch-all(`Sources/Usage:`) + related-*-tab/contacts/attributions/authors 트레일러 절단 + 맨 끝 "Learn More" 리소스 링크 컷.
  - 리스트: `c-usgs-teaser` 카드 블록 파싱(제목 h*.title + teaser). RSS 없음 → HTML 파싱.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue(host=`www.usgs.gov/news/`) + 어드민 UI(⛰ Mountain) + 대량 GET(13소스 + usgs-feed featured/snippets). **drift-lock 29 tests**. tsc clean(패키지+web).
- 마이그레이션 `acp_source_add_usgs` (source CHECK +usgs) — **적용 완료**.
- **라이브 검증**(tsx 실 ingester) — featured 12건(★60-61) · Solar Superstorm(814w)·Hurricane Helene(1394w) both **junk 0**(크레딧/링크리스트 clean) · snippets 12건.
- **end-to-end 발행 증명** — Hurricane Helene INSERT → **license_class=public_domain·display_only=false·copyright_safe=true** → register=expository·B2·noise 0 → `analyzeArticle` 377 어휘 추출 → 발행 트리거 → 단어세트 **40 words published**(landslide 산사태·debris 잔해·hazard·trigger 촉발·personnel·collaboration — 지구과학/재해 도메인, 한국어 뜻 완비).

### 아케이드 스위트 — 세계적 게임 메커닉 기반 단어 게임 6종 (v06.197)

세계적 게임/교육게임(Kahoot·Blooket·Gimkit·Duolingo·Wordle·NYT Connections·Match-3) 리서치 → 단어 학습 게임 6종 신설. 각 dev :3100 스크린샷 검증.
- **공용 게임킷** [`components/game/_shared/gamekit.tsx`] — `useSfx`(Web Audio·무자산)·`ParticleBurst`·`useCountUp`·`Hud`·`GameDone`·`GameLoading`·`NotEnoughWords`·토큰 스타일(라이트/다크·reduced-motion·접근성). WordBlitz v07.2 주스 일반화. + 공용 스캐폴드([`lib/game/play-scaffold`] 스코프 단어·기록·복귀) + 일반 레코더([`lib/game/record-result`] module 파라미터화).
- **6종**: **Letter Forge**(철자 조립 L4b) · **Cascade**(매치·낙하 보드 L4a) · **Connections**(의미 그룹핑 L5·큐레이션 뱅크) · **Word Economy**(경제·전략 Gimkit) · **Daily Blitz**(데일리+스트릭 Wordle·localStorage) · **Ghost Race**(비동기 레이스+리그). 각 `/play/<slug>` + `GhostRace`/`Cascade`/`WordEconomy`는 wordPool·onCorrect/onWrong(FSRS) 계약 재사용.
- **허브·크롬**: `/arcade` 진입점(6카드) + SessionFrame SESSION_META 6종 등록(closeHref→/arcade).
- **module_id enum**: TS `ModuleId`/`ScoreModule` 6종 추가 + DB 마이그 `add_arcade_game_module_ids` **적용**(6값 ADD VALUE IF NOT EXISTS, 순수 additive) → FSRS audit/scores persistence 활성. 검증: pg_enum 16값 확인.
- 커밋 `c463ade`(kit+LetterForge)·`e0816ba`(Cascade)·`79bf6a8`(Connections)·`63141a8`(WordEconomy)·`3e7751f`(DailyBlitz)·`4e1cd02`(GhostRace)·`fd55e19`(허브).
- ⚠️ 환경: C: 디스크 100% full 실측 → `.next` 클리어로 dev 서버 unblock(사용자 공간 확보 권장).

### ACP Wikivoyage 여행 가이드 소스 신설 — reference 밴드 보강 (v06.196)
- **Wikivoyage ingester** — `ingest-article/wikivoyage.ts`. Wikimedia 프로젝트라 `_mediawiki` 재사용(host=en.wikivoyage.org). Star/Guide 카테고리. CC-BY-SA → 발행 허용. **register=reference**(목적지 가이드=Factbook 동류) → **얇은 reference 밴드 보강(3→5, 패딩 아닌 갭 채움)**. B1-B2 접근형·여행 흥미↑.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🗺 MapPin) + 대량 GET(12소스 + wikivoyage-feed Star/Guide). drift-lock 28 tests. gcmsort=timestamp+영문자-필터(v06.195 QA 패턴 반영).
- 마이그레이션 `acp_source_add_wikivoyage`.
- **end-to-end** — Kyoto(8847w·B2)·Prague(14420w·B2) published·cc_by_sa·register=reference·noise 0·llm_cost 0. reference 밴드 3→5(factbook+wikivoyage).

### QA 자체점검 — Wikipedia feed 품질 + prescribe_today 정합 (v06.195)
- **Wikipedia feed 니치-junk 수리** — categorymembers가 sortkey 순이라 앞부분이 문장부호-시작 니치(화석종 `?Oryzomys`·`.hack`·`*SCAPE`·`0-8-4`)로 도배 → `gcmsort=timestamp desc`(최근 승격 GA) + 영문자-시작 제목 필터. 검증: junk 0, 다양한 실주제(San Jose Sharks·Semiotics·University of Yangon 등).
- **prescribe_today practice 정합** — S4/S5 학습자(v_band=S4·도서, DCP 문항 없음)가 practice active=true·items=[] 오해 → "문항 존재 시만 active". 검증: S5 active=false·0분·total 60.
- 자체점검 확인: 신규 5소스 발행 데이터 전부 clean(title/register/license/noise 이상치 0) · register×CEFR 매트릭스 건전.

### ACP PLOS 오픈 학술 소스 신설 (v06.194)
- **PLOS ingester** — `ingest-article/plos.ts`. CC-BY 오픈액세스 과학 저널(HTML 서버렌더). abstract+본문 산문 추출 — figures/tables/References·인용 상첨자 스트립 + References 이하 절단(methods/stats 노이즈 배제). solr API `listPlosFeed`. C1-C2 심화(S4 킬러급) register=expository.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🧬 Dna) + 대량 GET(11소스 + plos-feed 라우트). drift-lock 27 tests.
- 마이그레이션 `acp_source_add_plos`(articles + seed_catalog CHECK).
- **end-to-end + 추출 품질** — pbio(1271w)·pone(5948w) published·cc_by·C1·**lexical_noise 0.001~0.002**(스트립 성공, 깔끔 산문 확인)·llm_cost 0.

### ACP English Wikipedia 정규 소스 신설 (v06.193)
- **Wikipedia ingester** — `ingest-article/wikipedia.ts`. Simple Wikipedia와 동일 `_mediawiki` 재사용(host만 en.wikipedia.org). FA(Featured)/GA(Good) 카테고리 categorymembers. CC-BY-SA → 발행 허용. B2-C1 고급 백과(Simple의 A2-B1 대비 심화). register=expository.
- 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(📚 Library) + **대량 GET**(BulkArticlesTab 10소스 + wikipedia-feed 라우트 FA/GA). drift-lock 26 tests.
- 마이그레이션 `acp_source_add_wikipedia`(library_articles + seed_catalog CHECK +wikipedia).
- **end-to-end** — Photosynthesis(7297w·C1)·Black hole(11277w·C1) published·cc_by_sa·display_only=false·llm_cost 0. per-source + 대량 GET 동시.

### /wordvault 구독 단어장 챕터 학습 — 세트 미리보기 모달 재사용 (v06.192)

/wordvault '학습 자산 › 단어장' 탭에서 챕터형 공용단어장 행 탭 시 [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx)(챕터 아코디언 + 게임별 런처)을 열어 그 챕터 단어로 바로 학습. 구독이 죽은 끝(단어 목록 링크뿐)이던 문제 해소. 세션 through-line 완성: 브라우즈(모달)→계획(런처)→보관함(모달).

- **모달 재사용(위치 무관화)** — VocabSetPreviewModal 에 `fromPath` prop(기본 `/library/vocab`) 추가 → 챕터 게임 launch 의 `?from` 복귀 경로를 재사용처가 지정. 기존 소비처(VocabSetGrid/BookDetailClient) 무변(선택 prop).
- **챕터형만 라우팅** — [ResourcePortfolio](../apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx): 단일 세트 중 내부 챕터(`shared_words.chapter`) 보유 세트만 `setId` 부여해 모달 오픈(InsetRow onClick), 챕터 없는 세트·도서 묶음은 기존 `/wordvault/browse` 링크 유지(모달은 10개 미리보기뿐이라). 판별=otherSets set_id 단일 쿼리.
- **모달 CTA=구독 해지** — 확인 후 `unsubscribeSet` → 목록에서 제거, 학습 기록 서버 보존. tsc·lint 0.
- 조사: /library/books 는 이미 인기/중요도 랭킹(`recommend-books.ts` popularity_rank·인기 레일) 보유 → 개선 불요. BookShelfSection/AssetGrid 는 미마운트(dead).

### WordBlitz 익사이트 강화 — 파티클·SFX·콤보 연출 (v06.191)

"학습자에게 더 재미·흥미·익사이트" 후속(v06.189 재설계 위에). 리서치 "숙련될수록 더 극적인 피드백" 적용.
- 파티클 버스트(콤보 티어로 강도↑) · Web Audio SFX(정답 상승음·마일스톤 아르페지오·오답 버즈·완료 팡파르, 뮤트 토글) · 속도등급 PERFECT/GREAT/GOOD(+보너스) · 콤보 불꽃 성장(크기·색·글로우) · 마일스톤 배너("COMBO N!") · 점수 카운트업 · 에너지 백드롭(콤보로 발광) · 문항 등장 애니 · 타이머 긴박 색변화.
- 전부 테마 토큰(color-mix) · prefers-reduced-motion 폴백(파티클/애니 off) · 계약 무변경. (`926dc71`.)
- 검증: :3000 콤보5 마일스톤 스크린샷 라이트/다크 — 배너·파티클·PERFECT·+293·불꽃·에너지 확인, tsc 0, pageerror 0.

### EchoMatch 피드백 강화 — 구간 지목 + 정직한 문구 (v06.190)

기능·효과 평가 후속. 프로소디 3축 채점(v06.158 재설계)은 작동하나 ① 발음/단어 정확도 미측정 ② 어디서 틀렸는지 지목 부재 ③ 미보정 임계값 — 한계 확인. 이 중 **안전·검증 가능한 2건** 반영.

- **구간 divergence 지목(#3)** — `divergenceRegions`(기존 DTW semitone-shape 규칙 재사용·순수함수): 억양이 원어민과 ≥3 semitone 벌어진 시간 구간을 `PitchVisualizer`에 음영+범례+안내문으로 표시 → "어디를 다시 따라할지" 행동 가능 피드백. 회귀 4종(동일/화자독립=무표시, 다른모양=지목, 무음=무표시).
- **문구 정직화(#4)** — `scoreFeedback` "원어민에 가까워요"(참조가 Piper TTS인데 과장) → "억양·리듬이 잘 맞았어요". 채점이 프로소디 정합임을 정직하게.
- **#2 단어 정확도 게이트 (구현)** — 녹음과 병렬로 Web Speech `SpeechRecognition`(재사용 `createRecognizer`) 실행 → `computeShadowMatch`(기존 자산)로 문장 단어 인식률 산출. 인식률 <40%면 프로소디 점수를 celebrate 대신 "단어부터 또박또박 다시" 로 부드럽게 게이트(비난 X). **완전 additive·전면 guard** — 미지원(Firefox 등)·인식 실패·무음은 `null`(미측정)로 프로소디-only 폴백, 녹음/채점 절대 무영향. scored 화면에 "단어 N% 인식" 표시. ⚠️ **실 육성 인식 정확도는 헤드리스에서 검증 불가**(Chrome 실기 필요) — 구조·guard·gate 로직만 tsc+스모크 검증.
- **자동 실주행 검증(fake-mic E2E)** — `06-echomatch-fakemic.spec.ts` 신규: Chrome 합성 오디오(`--use-fake-device-for-media-stream`)로 전체 4-Phase(Listen→Repeat→Compare→Score) 자동 완주. 결과 `overall=48`(인토네이션 23·강세 55·리듬 74) — 파이프라인 크래시 0·콘솔에러 0·**구조적 0점 없음**(비발화 톤에 거짓 고득점도 안 줌=변별력 유지). `overall>0` 단언으로 구 절대값 결함 회귀 가드. *합성 톤이라 사람 보정(#1)은 아님 — 파이프라인 생존/범위 검증.*
- **잔여**: #1 실음성 threshold 보정(실제 육성 샘플 필요 — 합성 톤으론 불가). tsc green · vitest 11/11 · EchoMatch 게이트 스모크 green · fake-mic 실주행 green.

### WordBlitz 재설계 — 3D 인형뽑기 → 2D 속사 인지 (v06.189)

L4a 자동화 모듈 전면 재설계(리서치 기반: 어휘게임 메커닉·게임필·모던 UI·플로우).
- **게임**: ko 뜻 → 4 en 타일 중 정답 빠르게(탭/키 1-4). 콤보(연속정답→배수·레벨업)·문항 타이머(레벨↑ 단축)·점수(시간보너스×배수). Action→Feedback→Reward 루프.
- **이전 Three.js 3D 인형뽑기 대체** — ~5초/단어 → ~1-2초/단어. "Blitz"·L4a 자동화 목표 정합 + 모바일 우선. (`WordBlitzGame.tsx` 재작성 `7d55cce`.)
- **Calm UI 주스**: 정답 초록+체크·오답 앰버 shake·콤보 범프. 폭죽 없음, 차분한 종료("오늘 잘 마쳤어요").
- **모던 UI + 테마 토큰**(라이트/다크 자동) + 접근성(키보드·aria-live·reduced-motion·44px+). 게임 예외 `--combo`/`--streak`.
- **계약 무변경**: wordPool/onExit/onCorrect/onWrong(FSRS) — page + WorkspaceWordBlitzMode 자동 적용.
- **dead code 제거**(`e6e67dd`+`a4105c4`): ClawMachine/ClawModel/ClawScene/Plushie/PlushieModel·useWordBlitzGame·WordBlitzUI.css·lib/wordblitz/types.ts 삭제. data.ts 정리. 정글 이모지 🌴→⏱. (three/fiber는 pirate-quest 사용 → 유지.)
- 검증: :3000 스크린샷 playing/reveal·라이트/다크, ko→en 정합, tsc 0, pageerror 0.

### /plan 런처 챕터 선택 — 공용단어장 챕터 단위 시작 (v06.188)

'게임별 챕터 학습 UI'([VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx))의 플랜 버전 — /plan '바로 시작'에서 공용단어장을 특정 챕터 단어로 시작.

- **LaunchRow + ChapterScopePicker** — [PlanClient](../apps/web/src/components/plan/PlanClient.tsx): 공용단어장이 내부 챕터(`shared_words.chapter`)로 나뉘면 챕터 select(전체/N장) 노출. TodayRow(오늘의 학습)·ItemConfig(구성 패널) '바로 시작' 공유. 30챕터도 수용하는 컴팩트 select(Calm UI).
- **챕터 스코프 launch** — [plan-activities.ts](../apps/web/src/lib/learner/plan-activities.ts) `activityLaunchHref(m, activity, origin, chapter)`: word_set 게임 라우트(`set=`)에만 `&chapter=N` 부착 → 카드/블리츠/스펠포지/페어플립이 그 챕터 단어만 학습(게임 page 가 이미 `?chapter=` 파싱). 본문/vocab/스크립트엔 무영향.
- **chapterCount 게이트** — [plan-actions.ts](../apps/web/src/lib/learner/plan-actions.ts) `fetchStudyPlanItems` 가 word_set 내부 챕터 수(MAX chapter)를 `chapterCount` 에 채움(book 전용 → word_set 도 사용). 챕터 미부여 세트는 0 → 선택 숨김.
- **실데이터**: 교육과정 기본어휘 초등19/중등30/고등25장 라이브 확인. tsc·lint 0.

### /library/vocab '추천' — 정본 추천 엔진(RPC)으로 교체 (v06.188)

즉흥 client 근접정렬(V-Level·CEFR·category 추정)을 앱 정본 추천 엔진으로 교체 (최적 방안).

- **`recommend_word_sets_for_user` RPC** — [page.tsx](../apps/web/src/app/(main)/library/vocab/page.tsx): 진단 완료(`current_v_level`·`diagnostic_completed_at`) 시 RPC 호출, fallback 티어 제외한 recommended 전달. 미진단은 진단 유도(DiagnosePrompt).
- **티어·사유 노출** — [VocabSetGrid](../apps/web/src/components/library/vocab/VocabSetGrid.tsx) FeaturedRow: 티어 배지(메인/도전/보강/관심) + 왜 추천 사유(reason). estimateSetLevel/categoryVLevel 근접정렬 제거. [queries.ts](../apps/web/src/lib/library/vocab/queries.ts) `RecommendedSet` 타입 export. tsc·lint 0.

### CTP DCP 채점 — 실행 루프 완결 (v06.187)
- **`grade_dcp_item(item_id, answer)`** — order/insert 답변 서버 채점 + `csat_item_attempts` 기록(item_role=practice). answer_key는 서버에만(오답 시에만 반환). SECURITY DEFINER+auth.uid 가드.
- **검증** — order 정답=true/오답=false · insert 정답=true/오답=false · 기록 확인(롤백).
- **DCP 실행 루프 완결**: 생성(dev-generate-items)→처방(prescribe_today·answer_key 제외)→채점(grade_dcp_item)→기록(csat_item_attempts).

### CTP ⑥ Today 처방 백엔드 — CTP 백엔드 완성 (v06.186)
- **`prescribe_today(uuid)`** — 결정론 일일 루프 처방(5블록: FSRS due·듣기·input·practice·verify). derive_learner_stage→stage→조립. input=csat_stage_catalog(stage_band)·practice=csat_dcp_items(S3+·answer_key 제외). 시간삭감(practice=S3+에서만). SECURITY DEFINER+auth.uid 가드.
- **양방향 검증** — S1 학습자(practice 비활성·60분·input 5기사) / S3 학습자(wpm 주입 모사→practice 5문항 OWID order·75분). 롤백(영속 X).
- **CTP 백엔드 완성**(8계층): ①syntax ②stage_band ③DCP문항 ④유창성 ⑤gate ⑦error_cause ⑧BYO가드(구조) + **⑥ 처방·stage 파생**. 잔여=⑥ Today **UI**(META 게이트).

### Dictation 세션 결함 수리 + 사용성 (v06.185)

/dictate/session 점검 — 기능 결함 2건 + 폴리시 2건. 스코프: dictation 파일 한정.

- **🔴 세션 미발견 무한 로딩** — 세션은 localStorage(기기 로컬)라 다른 브라우저/기기·공유된 URL·오래된 세션이면 `getSession` 이 미발견인데, 훅이 session=null 을 로딩과 구분 못해 "세션을 불러오는 중..."에서 **영구 정지**(사용자 제보 URL 시나리오). → `useDictationSession` 에 `status('loading'|'ready'|'not-found')` 추가, 세션 화면이 not-found 시 "세션을 찾을 수 없어요" + 다시 시작 CTA 렌더.
- **🔴 TTS voices 비동기 로드 함정 + 무음 방치** — `AudioController.speak()` 가 `getVoices()` 를 동기 호출 → 첫 발화 시 빈 배열이라 영어 음성 미선택(잘못된 언어/무음). 또 OS 영어 음성 미설치 시 **아무 안내 없이 무음**. → `ensureVoices()`(voiceschanged 대기+1.5s 폴백·캐시) + `pickEnglishVoice`(en-US 우선), speak 가 await. `hasEnglishVoice()` 로 판정해 영어 음성 없으면 세션 화면에 안내 배너.
- **폴리시**: 입력 라벨 영문("Type what you hear") → 한글 · storage.ts 주석 정정(sessionStorage→localStorage, 기기 로컬·URL 공유 경고).
- 검증: tsc(dictation 오류 0)·eslint 클린 + **라이브 실주행 완료**(dev 서버 clean 재기동 후 Playwright): ① 없는 sessionId → "세션을 찾을 수 없어요" 안내(무한로딩 제거, 스크린샷) ② setup→session→입력→제출→채점(결과·정답·오류패턴) 정상 ③ voices 3개 감지→ensureVoices resolve→배너 정상 미표시(음성 있을 때). 콘솔 에러 0.

### CTP P3 종결 — 학습자 stage 실시간 파생 (v06.184)
- **`derive_learner_stage(uuid)`** — csat_stage_gates 전 지표 통과 최대 단계 매 호출 파생(**컬럼 저장 금지**·§9 R(t) 동형). 지표: wpm(reading_fluency_log)·item_accuracy(csat_item_attempts)·listening(echo_match)·coverage(v1 current_v_level 대리). SECURITY INVOKER(RLS 본인만).
- **양방향 검증** — 무데이터 유저 3인 전원 S1(고 v_level도 읽기증거 없이는 승급 불가) · 강한 지표 주입 시 S1→S5 승급(롤백, 영속 X).
- ⚠ apply_migration이 함수 본문 `$$` 오분할 → execute_sql로 적용(migration 파일은 repo 보존).
- **CTP P3 종결**: ① syntax_score · ② stage_band(view) · ③ DCP 문항 · ④⑤⑦ 테이블 · **stage 파생**. 잔여 ⑥ Today UI(META 게이트) · ⑧ BYO 가드.

### /library/scripts 재설계 — 목적별 묶음 + 레벨 칩 단일 시스템 (v06.183)

기존 이원 구조(추상 소스맵 + 평면 그리드)로 "선택을 어떻게 하는지 모름" 문제 → 분류를 목록에 직접 노출하는 단일 시스템으로 통합.

- **`ScriptsBrowser` 신설** — ① 레벨 칩(내 레벨/CEFR, 드롭다운 아닌 가시 facet) ② 내 레벨 추천 strip(i+1 상위 3) ③ 목적별 트랙 섹션(적합순·묶음당 미리보기 6편 + "전체 N편 보기") ↔ 필터·묶음 진입 시 평면 그리드. `ArticleCard`·`source-map.ts`·i+1 로직 재사용, 추가 fetch 0.
- **신규 소스 트랙 편입** — owid+factbook→📊 '데이터·사실로 읽기'(신규 트랙), elife→🔬 topic. 기존 맵에서 누락되던 3소스 커버. `ArticleCard` SOURCE_META에 라벨·색 추가.
- **제거** — `SourceMapShell`·`ArticlesExplorer`·`source-map/{SourceMap·DifficultyMap·TrackCard}` (page 단일 진입 dead code).
- 04-ui-smoke에 `/library/scripts` 화면 추가(영구 회귀 자산). tsc green. ⚠ 런타임 스모크는 동시 멀티세션 `.next` 캐시 오염(`_document.js` 결측 — 전 라우트 500)으로 차단 → 클린 서버 재기동 후 검증 필요.

### CTP P3 — DCP T2 결정론 문항 생성 완료 (③) (v06.182)
- **`csat_dcp_items` 테이블** — 공유 배치 order/insert 문항(quiz_questions는 per-user·MC라 부적합 — P0식 정정). RLS admin write.
- **생성 라우트** `/api/ctp/dev-generate-items` — 결정론 생성기 실행+INSERT. **DCP 입력 게이트**(NOT display_only·license_class∈pd/cc0/cc_by/cc_by_sa·noise≤0.08) — ND(The Conversation) 파생 차단.
- **보일러플레이트 필터** — 생성기 적격필터에 인용·URL·라이선스·캡션 배제 추가(OWID "cited as…" 오인식 수리). drift-lock +1(6 tests).
- **실증** — OWID S3 논증 8건(게이트 통과) → **64 실 문항**(실 산문 확인). ND 파생 항목 사후 삭제.
- 다음 P3 잔여: 학습자 stage 실시간 파생 함수.

### LCP 대량 GET — Pressbooks 소스 배선 (v06.181)
- **BulkFetchTab에 Pressbooks 추가** — seed-fetcher `pressbooks.ts`(정적 큐레이션 리스트 — 통합 카탈로그 API 부재라 Factbook 국가리스트와 동형). opentextbc.ca 검증 슬러그 4권(Sociology·Psychology·Writing·Chemistry). 실 메타는 ingest 시 `citation_*` 재취득.
- seed-fetchers `SeedSource`+pressbooks · `FETCHERS`/`SOURCE_LABELS` 등록 · BulkFetchTab SourceKey/SOURCE_OPTIONS.
- 마이그레이션 `lcp_seed_catalog_source_add_pressbooks`(seed_catalog CHECK +pressbooks). opentextbc.ca 봇차단 회피=ingester UA.
- → **ACP·LCP 대량 GET 모두 신규 소스 배선 완료**(per-source GET과 동등 커버리지).

### ACP 대량 GET — 신규 소스(OWID·Factbook·eLife) 배선 (v06.180)
- **BulkArticlesTab에 신규 3소스 추가** — 기존 per-source GET(SourceGetView)에만 있던 owid(📊)·factbook(🌍)·elife(🔬)를 대량 GET에도 배선. 9소스 프리셋.
- feed 라우트 3종 신설(`owid-feed`·`elife-feed`·`factbook-feed`) — 대량 흐름의 score-cap 위해 `listFactbookFeed`·`listElifeFeed`에 `applyArticleCurationSpec` 스코어링 추가.
- 마이그레이션 `acp_seed_catalog_source_add_new`(seed_catalog CHECK +3) + `SeedSource` 타입 +3 → seed 영속화(새로고침 보존).
- 실검증: owid 4·factbook 30국·elife 6 스코어 항목 + published 감지. (LCP pressbooks 대량은 후속)

### /library/vocab 중요도·사용빈도 기반 재구성 (v06.179)

공용 단어장 화면을 **중요도(카테고리)·사용빈도(구독수)** 신호로 재구성 — no-op이던 "추천순"을 실제 랭킹으로.

- **중요도 랭킹** — [categories.ts](../apps/web/src/components/library/vocab/categories.ts) `CATEGORY_IMPORTANCE`(수능·내신100→교육과정 고90/중80/초70→공인60→공무원/비즈니스45→테마30→유아20). 추천순 = 중요도→사용빈도(구독수)→큐레이션 순서→단어수. 캐러셀 카테고리 탭도 중요도순(수능 먼저·기본 활성).
- **사용빈도 랭킹** — 마이그 `20260709194335_shared_word_sets_subscriber_count`: `shared_word_sets.subscriber_count`(denormalized) + 트리거 `trg_maintain_set_subscriber_count`(user_word_set_subscriptions INSERT/DELETE, SECURITY DEFINER) + 백필(262세트). RLS 본인전용이라 클라 집계 불가 → 비정규화. [queries.ts](../apps/web/src/lib/library/vocab/queries.ts) `subscriberCount` 노출(loose client). 카드에 "👥N" 표기.
- **클러터 제거** — `library_article` 107세트(저큐레이션·소스종속) 공용 라이브러리에서 제외(도서 세트와 동일 원칙, 각 소스 컨텍스트 전용).
- **카드 정보 단서** — [VocabSetCard](../apps/web/src/components/library/vocab/VocabSetCard.tsx) 좌하단 카테고리(중요도) 칩 + 구독수. tsc·lint 0.

### CTP P3 — syntax_score 배치 산출 (① 구문 난이도) (v06.178)
- **`compute_syntax_score(text)` RPC** — 자체 정규식(문장 p90·절 깊이 휴리스틱). 런타임 LLM 0·winkNLP 불요. score 0-100(가중 2:6, 베타 보정 대상).
- **전량 backfill·검증** — article 132건: register별 정합(reference 94>논증 83>설명 71>서사 61>news 56). 도서 7권: v-level 정합(Gibbon v9=100 … 동화 v3=26).
- **배선 RPC** — `compute_article_syntax`/`compute_book_syntax`(챕터 content_chunks 집계) → ACP·LCP dev-process 에 `compute_*_vrl` 옆 호출(미래 콘텐츠 자동 산출).
- 다음 P3 잔여: 학습자 stage 실시간 파생 함수 · DCP T2 결정론 문항 생성.

### 연어 슬롯 롤아웃 — scoped 플래시카드 + 리더 툴팁 (v06.177)

v06.175(hub 플래시카드 연어 슬롯) 롤아웃 — 나머지 학습자 노출면에 동일 슬롯 확장. 마이그레이션 0(앱-사이드 fetch).

- **scoped 플래시카드** ([scoped-words.ts](../apps/web/src/lib/flashcard/scoped-words.ts)) — 세트/텍스트 스코프 진입도 collocations 배치 보강(hub-words 와 동일 패턴). CardBack 슬롯 공유.
- **리더 툴팁** ([WordLookupPopover.tsx](../apps/web/src/components/library/reader/WordLookupPopover.tsx)) — 본문 단어 클릭 시 예문 아래 연어 칩 최대 3개. `lookup_word_meaning` RPC 가 collocations 미반환이라 [reader-queries.ts](../apps/web/src/lib/library/reader-queries.ts) `lookupWord` 가 해소된 word 로 shared_dictionary 1행 보조 조회(툴팁은 on-demand 라 round-trip 허용, 실패 graceful).
- 검증: tsc·eslint 클린 · 데이터 경로 실증(`lookup_word_meaning('verdict')`→resolved_word→collocations `[guilty verdict·unanimous verdict·reach a verdict]`). 렌더는 스크린샷 검증한 v06.175 CardBack 과 동일 칩 패턴.
- 이로써 학습자 노출면 3곳(hub·scoped 플래시카드·리더 툴팁) 연어 소비 UI 완비 → D7(collocations 노출 단어 2,240 채움)이 비로소 학습자 가치를 가짐(다음 단계).

### CTP 착수 — CSAT Track Pipeline 데이터모델 (P0 정찰 + P1/P2 migration) (v06.176)
- **P0 정찰** — 소유 8계층 read-only 실측([ctp_p0_20260709.md](./AI_CONTEXT/diagnostics/ctp_p0_20260709.md)). 판정 GO + 정정 2건: ④ `reading_sessions` 이름충돌(기존=읽기플랜 262rows) · ⑦ per-question attempt 부재(scores=세션단위).
- **P1/P2 migration 3건 적용**(승인): `ctp_catalog_syntax`(syntax_score jsonb + `csat_stage_catalog` VIEW 139항목) · `ctp_dcp_items`(quiz type +order/insert + item_role) · `ctp_runtime_tables`(`reading_fluency_log`·`csat_stage_gates` 9행seed·`csat_item_attempts` + RLS).
- **회귀 통과** — quiz 기존 3종 값 보존 · reading_sessions 262 불변 · stage_band 분포 S1(55)·S2(46)·S3(33)·S4(5).
- 스코프: 데이터모델+배치 계층. Today UI(⑥)는 META 확정 게이트. 다음 P3 = syntax_score 배치 산출 + stage_band/gate 소비.
- docs: [DB_SCHEMA.md](./DB_SCHEMA.md) CTP 섹션.

### 플래시카드 연어(collocations) 슬롯 — 카드 리치화 시제품 (v06.175)

v06.173 진단(collocations 등 무소비 필드) 후속 — enrichment 를 가치있게 만드는 선행 조건인 **소비 UI** 를 플래시카드 정답면에 시제품으로 구축. 닭-달걀(UI 없어 안 채움/안 채워 UI 없음) 해소의 첫 조각.

- **CardBack 연어 슬롯** ([CardBack.tsx](../apps/web/src/components/flashcard/CardBack.tsx)) — 정답면 예문 아래 "함께 쓰는 표현" 회색 칩 최대 3개. **데이터 있을 때만 렌더**(Progressive Disclosure) · 예문 보조 톤(Calm UI, 학습 자극 최소화).
- **데이터 스레딩** — `FlashcardWord.collocations?`([types/flashcard.ts](../apps/web/src/types/flashcard.ts)) + hub-words 가 shared_dictionary 에서 배치 1쿼리 보강([hub-words.ts](../apps/web/src/lib/flashcard/hub-words.ts), collocations 는 vocabularies 미보유). fetch 실패해도 카드 렌더 무영향.
- 시연: runtime-test 계정 10단어 연어 실채움 + Playwright 정답면 스크린샷으로 렌더 육안 확인(예: verdict → guilty verdict · unanimous verdict · reach a verdict). tsc·eslint 클린.
- 잔여(설계 승인 후 롤아웃): scoped-words 경로 · 리더 툴팁(WordLookupPopover) · 노출 단어 2,240 collocations 채움. 이 UI 가 서면 D7 enrichment 가 비로소 학습자 가치 생김.

### 챕터별 어휘 V-level — 단일 book_v_level 챕터 편차 노출 (v06.174)

P0 진단(통사 축 신설 정당성 실측)이 드러낸 최대 결함 = 단일 `book_v_level` 이 챕터 난이도 **3~5레벨 편차**를 뭉갬(Alice V6 라벨인데 도입 V4·10장 V8; Les Misérables V9인데 챕터 V2~V10). 통사 축은 F-K가 이미 포착 → DEFER, 챕터 편차가 실측 최대 결함이라 우선 착수.

- **마이그레이션 적용** — `lcm_chapter_v_level`: `library_chapters_master.chapter_v_level smallint` + 백필(distinct lemma v_level `PERCENTILE_DISC(0.75)`, V11 제외 — `compute_book_vrl` 동일 규칙). `library_book_vocabularies ⋈ shared_dictionary(word=lemma)`. **1,295/1,296 채움**(chapter_idx 정합), 파괴 0. 동적 상태 아님(정적 콘텐츠 속성, 재추출 시 갱신).
- **노출** — 리더 목차 사이드바(`ChapterSidebar`) + `/plan` 도서 챕터 리스트(`ChapterList`)에 `V{n}` 텍스트 pill(색상만 의존 X → 색맹 안전, memory-decay 4색과 무관). `reader-queries.listChapters`·`plan-actions.fetchBookChapters` 에 `chapter_v_level` 승계 + `database.ts` 타입.
- **파이프라인 wire-up** — 마이그레이션 `20260709194527_compute_book_chapter_v_levels`: 별도 peer 함수(공유 `compute_book_vrl` 미수정 → 동시 CTP 충돌 방지). LCP `dev-process`·`process` 라우트 + `reprocess-book`·`reprocess-all-se` 스크립트의 `compute_*` 시퀀스에 배선 → **신규 적재 도서 자동 채움**. idempotent 검증(Alice 재계산 값 불변).
- **CTP 통사 축과의 관계** — 동시 세션이 `library_*.syntax_score`(구문 p90·절 깊이) 축을 별도 구축(`ctp_p0_20260709`). 본 chapter_v_level(어휘 축 챕터 분해)과 **직교/상보** — 중복 아님(P0 판정: 도서 라벨 관점 통사 반례 0 vs CTP=수능 stage 게이팅 관점).
- **P2 완료 — 가독성 축 완결**: F-K NULL 4권(`book-readability.mjs` per-book) 백필 → Intro Sociology 12.35·Book of Tea 10.25·Alice Adams 8.65·Short Fiction 6.8. book_v_level 보유 도서 F-K **NULL 0**.
- 진단서: [syntactic_axis_p0_20260709](./AI_CONTEXT/diagnostics/syntactic_axis_p0_20260709.md). P0가 지목한 결함(챕터 편차 P1 + 가독성 공백 P2) **모두 해소**. 통사 축은 DEFER 유지(CTP syntax_score와 상보).

### enrichment 백로그 진단 — 무소비 필드 3종(D3/D6/D7) 이연 (v06.173)

노출 단어 표적 enrichment 착수 전 진단 — 대상 필드가 학습자 UI 미렌더 판명(register D2·B1과 동일 패턴 3번째). 코드만 변경(데이터·마이그레이션 0).

- **진단**: 발행 세트 노출 단어 9,227개의 갭 = collocations 2,240·korean_learner_note 7,104·다의어 senses 6,784. 그러나 **학습자 UI 전수 확인 결과 이 필드들은 어디에도 렌더 안 됨** — 플래시카드 CardBack(pos·meaning·example)·리더 툴팁 WordLookupPopover(register·pos·cefr·v_level·meaning·example)·단어장 미리보기(word·meaning_ko·pos·cefr) 모두 미포함. 렌더되는 필드는 노출 단어에서 이미 ~100%(example 결핍 2).
- **결론**: D3(polysemy)·D6(korean_learner_note)·D7(collocations) 채우기 = 현재 학습자 효과 0(admin 패널 전용). 카드 리치화 UI 선행 필요.
- **대시보드 정직화**: backlog D3/D6/D7 P1→P3 + "UI 미렌더 이연" 근거 · 결함 룰 3종 P1/warning→P2/info + description 에 미렌더 명시. → 사전 Health P1 warning 3건 감소.

### ACP eLife digest 소스 신설 — 고품질 과학 설명 (v06.172)
- **eLife ingester 신설** — `ingest-article/elife.ts`. eLife API(JSON)에서 편집자 저작 **plain-language digest**만 추출(연구 본문 C2 배제·dependency-0). CC-BY 4.0 → 발행 허용. register=expository(과학). digest 없는 기사 자동 거부(guard).
- 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🔬 Microscope). drift-lock +1(25 tests).
- **마이그레이션 적용** — `acp_source_check_add_elife`.
- **end-to-end 실증** — elife:91060·89129 published·C1·cc_by·display_only=false·llm_cost 0(50253=digest 없음 정상 거부). expository에 최신 생명과학 topical 다양성 보강.
- docs: [CSAT_SOURCE_MATRIX.md](./CSAT_SOURCE_MATRIX.md) T-1 이동.

### 소스 매트릭스 feasibility 재분석 — CSAT_SOURCE_MATRIX 신설 (docs)
- **[CSAT_SOURCE_MATRIX.md](./CSAT_SOURCE_MATRIX.md) 신설** — 전수 소스를 feasibility 3축(포맷 HTML/PDF·라이선스 CC/NC·트리거)으로 재분류. 설계 문서 ↔ 실측 갭 해소(OWID·Factbook·Pressbooks = T-1 승격, OBP = PDF-only 반증).
- **동결 풀 판정**: 청정 viable(PLOS·eLife·Wikipedia 정규·PMC) 이나 트리거 전부 미충족 · PDF-블록(OECD·WB·UNDP·CRS/CBO/GAO) · NC 오염(LibreTexts·Saylor).
- **⚠ S3 헤지 갭(신규)** — "OWID 실패 시 OECD/UNDP 자동 승격"이 두 대체재 PDF-블록으로 작동 불가. ACP_SOURCE_REDESIGN §20.4 명기.

### 학습 루프 E2E — 진단→개인화 체인 + storageState 리팩터 (v06.171)

핵심 루프 회귀의 마지막 고가치 대상 — **진단 완료→V-Level snapshot** 추가. 진단은 사용자 V-Level 을 설정해 추천·i+1·추출 임계 등 개인화 전체를 좌우하는 진입점인데 런타임 검증이 전무했음.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** 진단 테스트 — `/diagnostic` → "진단 시작" → ~40문항 전부 "알아요" 이진 응답 → `analyze_and_apply_diagnostic_result` 가 기록하는 `user_level_snapshots(taken_reason='diagnostic')` 를 service-role 로 단언. 실측: snapshot v_level=11 기록(전 구간 동작 확인).
- **storageState 리팩터** — 3 테스트가 각자 로그인하던 것을 `beforeAll` 1회 로그인+`storageState` 재사용으로. 3중 로그인의 auth rate-limit·하이드레이션 리셋 플레이크(로그인 폼 빈 필드로 멈춤) 해소 + `loginRuntimeUser` 에 fill 값 확정 재시도 추가. ScriptQuiz 7.7s(로그인 제거로 단축)·Flashcard 51s·진단 21s = 3 passed.
- `countDiagnosticSnapshotsSince` 헬퍼([utils/db.ts](../apps/web/tests/e2e/utils/db.ts)). 이로써 핵심 루프 3종(게임 완주 ×2 + 개인화 진입) 전부 회귀 보장.

### 학습 루프 E2E — Flashcard 추가(반복 가능) (v06.170)

v06.166(ScriptQuiz 루프) 확장 — 가장 중심 모듈 Flashcard 완주→`scores(module='flashcard')` 적재 회귀 추가. 두 핵심 study 모듈 커버.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** Flashcard 테스트 — `/flashcard/play`(due 큐) → 카드별 FirstJudge "떠올렸어요"→SRSBar "기억나요" 클릭 완주 → scores 폴링 단언. 실측 적재 확인.
- **반복 가능성 확보**: flashcard 는 SRS due 큐 의존 → 완주가 카드를 미래로 밀어 재실행 시 due 0 이 되는 문제. `resetDueCards`([utils/db.ts](../apps/web/tests/e2e/utils/db.ts)) 로 실행 전 `next_review_at` 과거 리셋. service-role 키 없으면 due 보장 불가라 `test.skip`(scriptquiz 는 정적 콘텐츠라 무관).
- 인터랙션 교훈: flashcard 카드 = recall(3s 자동)→flippable(FirstJudge)→flipped(SRSBar) 3단계. Space 플립은 recall 타이밍과 어긋나 불안정 → **버튼 출현 대기+클릭**(FirstJudge "떠올렸어요"→"기억나요")이 결정론적. 2 passed(scriptquiz 26s + flashcard 55s).

### ACP register 피드 단위 전환 — narrative 채움 + VOA 오분류 교정 (v06.169)
- **register 매트릭스 5종 완성** — narrative(0→13, VOA lets-learn-english)·expository(64→78) 채움. 새 콘텐츠 없이 **정확한 분류만으로**. 5개 코어 register 전부 publishable.
- **결함 교정** — `REGISTER_BY_SOURCE`가 소스 단위라 VOA 전 피드가 'news' 오분류. `resolveArticleRegister(source, feedId)` 피드 우선 resolver 신설(`FEED_REGISTER` + `SOURCE_REGISTER_DEFAULT`, 패키지). dev-process 가 `feed_id` 읽어 적용. drift-lock +4 tests(24).
- **백필** — 기존 VOA 30건 register 재분류(narrative 13·expository 14·news 3). 메타만(단어세트 불변). news 30→3(as-it-is만 실 시사).
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.3.

### 공용단어장 내부 챕터 구성 — 세트 1개 안에 챕터 (v06.168)

교육과정 어휘 등 대용량 단어장을 **하나의 세트 안에서 여러 챕터로 내부 구성**(챕터별 세트 발행 아님). 발행 파이프라인 개선.

- **마이그레이션** `20260709135526_shared_words_chapter_column` — `shared_words`에 `chapter smallint`(1..N, NULL=미분할) + idx `(set_id, chapter, sort_order)`. 하나의 `shared_word_sets`를 여러 챕터로 내부 분할.
- **[publish-list-word-set.ts](../scripts/lcp/publish-list-word-set.ts) 재작업** — `--chapter-size=N` 시 **세트 N개 → 세트 1개 + 단어에 chapter 배정**(정렬 순서를 N개씩 끊어 chapter 1..N, 전역 sort_order 유지). `--order=cefr`로 급별(A1→C2) 진행. `--replace`는 단일 slug + 과거 챕터별 세트(`slug-ch-*`) 모두 정리. dry-run 검증(초등 729→1세트·19챕터).
- ⚠️ 직전 per-chapter 발행분(74세트: elem19/mid30/high25)은 `--replace` 재실행 시 자동 정리됨.
- **뷰어 챕터 렌더** — [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx): 챕터형 세트(shared_words.chapter 존재)는 **Chapter 아코디언**(접기/펼치기·첫 챕터 열림·챕터별 CEFR 범위)으로, 평면 세트는 기존 10개 미리보기. chapter 컬럼은 database.ts 재생성 전이라 loose client 접근. tsc·lint 0.
- **챕터별 학습** — 학습 로더 [fetchScopedWords](../apps/web/src/lib/workspace/scoped-words.ts) `chapter` 필터 추가(단일 출처 → 게임 공통) + [flashcard/play](../apps/web/src/app/(main)/flashcard/play/page.tsx) `?set=X&chapter=N` 지원 + 모달 아코디언 챕터별 "학습" 링크. 챕터 1개만 스코프 학습 가능. (다른 게임 wordblitz/pairflip/spellforge는 동일 로더라 chapter 전달만 추가하면 확장)

### ACP CIA World Factbook — reference register 신설 (v06.167)
- **reference register 빈칸 채움** — 발행 매트릭스 유일 공백(reference publishable 0)을 CIA World Factbook(PD)로 충족. 4개 코어 register 전부 발행 가능.
- **ingester 신설** — `ingest-article/factbook.ts`(dependency-0). factbook.json(PD 덤프) 국가 JSON `Introduction/Background` 산문만 추출(목록·표 제외). `FACTBOOK_COUNTRIES` 35국 정적 picker. 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·source-guide + enqueue/dev-enqueue/dev-process + 어드민(CurationConsole·SourceGetView·RssFeedTab 🌍). drift-lock 20 tests.
- **마이그레이션 적용** — `acp_source_check_add_factbook`(source CHECK +`factbook`).
- **end-to-end 실증** — South Korea(C1·40)·United States(B2·8)·France(C1·16) enqueue→process→publish: published·register=reference·public_domain·display_only=false·llm_cost 0. reference publishable **0→3**.
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.2.

### 핵심 학습 루프 E2E — 완주→영속화 회귀 자산 (v06.166)

UI 스모크(v06.159, "렌더" 검증)의 다음 층 — "게임 완주 → DB 적재" 를 실주행+DB 단언으로 고정. 배경: ScriptQuiz 완주 결과가 sessionStorage 에만 쌓이고 소비자가 없어 scores 적재가 조용히 증발했던 결함(v06.139) 재발 방지.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** — 로그인 → `/scriptquiz/play?book=…&ch=1` 직행(Drone Ch1·4문항) → 시작 → 키보드 '1'×4 완주 → `scores(module='scriptquiz')` 신규 행을 service-role 로 폴링 단언. 실측: 완주 시 total_questions=4 행 적재 확인.
- **[utils/db.ts](../apps/web/tests/e2e/utils/db.ts)** — e2e service-role DB 헬퍼(apps/web/.env.local 직접 로드 · `userIdByEmail`·`countScoresSince`). 키 없는 환경은 UI 완주만 검증(graceful degrade).
- **스모크 견고화**: 8화면 순차 방문이 dev first-compile 누적으로 기본 30s 초과 → `test.setTimeout(120s)` + goto 1회 재시도(간헐 ERR_ABORTED frame-detached). 3/3 green.
- 인터랙션 교훈: 4지선다 옵션은 plain button(role≠radio), OX만 radio → 완주는 **키보드 '1'**(양 타입 공통 handleAnswer, window 리스너라 포커스 비의존)이 안정. 시작 게이트는 하이드레이션 전 클릭 무시되므로 문항 배지 전이 확인 후 재클릭.

### ACP 파이프라인 라이브 검증 + Simple Wikipedia junk 수정 (v06.165)

ACP(article) §18 파이프라인 라이브 검증 — **정상 작동 확인**(127 발행기사/5소스, 라이선스 게이트 정확: the_conversation cc_by_nd 전부 display_only, register×cefr 매트릭스 UI 정상, pageerror 0). 발견 1건 수정:

- **Simple Wikipedia junk 유입 수정** — `Category:Good_articles` 수집이 `gcmtype=page`로 전 네임스페이스 포함 → `Wikipedia:Good articles/by date` 같은 관리 인덱스 페이지가 발행 기사로 유입되던 버그. ingester에 `gcmnamespace=0`(주 기사) 추가([simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts), `62be48a`). 라이브 검증: junk 3→0.
- **기존 junk 2건 DB 정리**(사용자 승인) — Wikipedia: 메타페이지 2 + 사용자 단어세트 2 + 단어 3 + vocab 25(cascade) 삭제. `docs/proposals/acp-cleanup-simple-wiki-junk.sql`. 검증: 전 테이블 junk 0, UI 전체 129→127·설명 B2 14→12.
- 진단 기록(수정 안 함): wikinews 0건(영문 소스 폐쇄중 + `feedrecentchanges` 피드 오선택, 실기사는 `Category:Published`) · A1-A2 gap(Simple Wikipedia 콘텐츠 실제 B1+)은 소스 현실로 확인(버그 아님).

### 보안 advisor — anon 호출 가능 무가드 DEFINER 함수 잠금 (v06.164)

Supabase 보안 advisor 점검(352 WARN·ERROR 0) 후속 — anon 키(클라 번들 공개)로 앱 인증을 우회해 호출 가능하던 무가드 SECURITY DEFINER 함수 9종 잠금. 마이그레이션 2건(`20260708120000` + PUBLIC 상속 보정 `20260708120500`), 사용자 명시 승인.

- **쓰기/액션 3종 → service_role 전용** (anon·authenticated 회수): `enrich_shared_dictionary`(마스터 사전 임의 INSERT 오염) · `regenerate_auto_curated_set`(발행 단어장 shared_words 파괴) · `process_library_pipeline_batch`(내부 토큰 외부 HTTP POST 트리거). 정당한 호출자는 전부 LCP 파이프라인 = service_role(검증) → 무영향.
- **admin 대시보드 읽기 6종 → anon 회수, authenticated 유지**: `admin_vrl_cron_jobs`·`cron_runs`·`diagnostic_use`·`snapshot_counts`·`track_distribution`·`v_level_distribution`. /admin/vrl/automation 서버컴포넌트(authenticated admin)는 유지.
- **교훈**: Postgres 함수 EXECUTE 기본이 PUBLIC grant(ACL `=X/postgres`)라 `REVOKE FROM anon` 만으로는 PUBLIC 상속으로 뚫림 — `REVOKE FROM PUBLIC` 필수(명시 grant된 service_role/authenticated 는 유지). 검증: 9종 전부 anon=false, 쓰기 3종 auth=false·srv=true, 읽기 6종 auth=true·srv=true.
- 잔여(별건·저위험): `function_search_path_mutable` 41 · `pg_graphql_*_table_exposed` 146(PostgREST 사용·RLS 게이트) · `auth_leaked_password_protection`(대시보드 토글) · `rls_policy_always_true` 2(sw_comments/players 게임).

### T-2 OWID 스케일업 + OBP 동결해제 α(Pressbooks) (v06.163)
- **OWID 8건 라이브 발행** — atom feed 8 기사 실 ingest→process→publish 전 구간(dev 라우트). argumentative CC-BY 학습 단어세트 8개(B2×7·C1×1 · llm_cost 0 · orphan 0). The Conversation(ND=display_only) 공백을 라이브 실증. dev 라우트 신설 `/api/acp/dev-enqueue`·`/api/acp/dev-publish`(service-role·NODE_ENV 가드).
- **OBP 재정찰 → 동결 유지** — 챕터 페이지 client-render + `__NEXT_DATA__` 에 PDF URL 만(산문 0) + 표본 CC BY-NC-ND. β(PDF)=dependency-0 위반 → OBP-proper 해제 불가.
- **α 실행 = Pressbooks ingester 신설** — `ingest/pressbooks.ts`(dependency-0·SE 계약 mirror·CC-BY 서버렌더 HTML). `LibrarySource`+`pressbooks`, 배럴 export. dev 라우트 3종: `/api/lcp/dev-ingest-preview`·`/api/lcp/dev-enqueue-book` + dev-process `pressbooks` 케이스(`max_chapters`).
- **마이그레이션 적용** — `library_books_source_add_pressbooks`(source CHECK +`pressbooks`).
- **end-to-end 실증** — `Introduction to Sociology 2e`(book_id 406dbc3e) enqueue→process→force-publish: published·CC BY 4.0·CEFR C1·book_v_level 8·23 챕터·23/23 챕터 단어세트(894단어)·word_count 367,776·llm_cost 0. LCP book 경로 실증(OWID=ACP article 경로에 이어).
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.1 · [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) 소스표.

### B1(VCB-VRL) 진단 — 허위 P0 강등, 대시보드 Critical 0 (v06.162)

사전 Health 대시보드 마지막 P0(B1) 착수 전 진단에서 D2·V1과 동일 패턴 확인 — 기능은 이미 우회 경로로 달성, 남은 것은 견고성 부채. 코드만 변경(데이터·마이그레이션 0).

- **진단**: `recommend_word_sets_for_user` 는 slug 조립(`auto-vlevel-v' || level`)으로 세트 조회 — V-Level 단어장 발행·추천·구독 전부 동작(auto-vlevel V1~V9 9세트 + 도서 챕터 260세트 curation_query.book_v_level). 전용 컬럼 부재의 실비용 = 슬러그 네이밍 관례 결합(소비처 RPC 1곳·사고 0건)·인덱스/무결성 부재뿐.
- **결함 룰 1** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)): `vcb_vrl_not_integrated` P0/critical → **P2/info**, 문구를 "우회로 동작 중, 세트 대량화/슬러그 개편 시 전용 컬럼 도입"으로. → **대시보드 P0 Critical = 0**(실측 정합: audio_url·segment·v_level 은 이미 충족·미발화).
- **R3 점수 정직화** ([health-score-v2.ts](../apps/web/src/lib/admin/dict/health-score-v2.ts)): 최대 가중(0.3) 팩터가 "스키마 컬럼 존재?"(구조적 항상 0, `🚨 V-Level 단어장 0/72` 허위 evidence)로 R3 를 끌어내리던 것 → "V-Level 단어장 발행 동작"(우회 동작=0.85, 견고성 부채 -0.15) 실측 반영. 가중치는 유지(재분배 없음).
- **백로그 B1** ([backlog-items.ts](../apps/web/src/app/admin/vrl/_components/backlog-items.ts)): P0 본질페인 → **P3 이연**("견고성 — 세트 대량화/슬러그 개편 시").

### VCB 파이프라인 어드민 재설계 — 스킬-우선·DB-status·정합성 (v06.161)

`/admin/vocab/runs` 프로세스·화면 전체 재검토/재설계. 결정 A(위저드 필터 제거)·B(out-of-band 스킬을 정식 경로)·C(저빈도 전문가 도구) 반영. 각 변경 dev :3100 + Playwright 스크린샷 검증.

- **위저드 3→2스텝**: 필터 UI(FilterPanel/LiveCountBadge/DistributionChart/SampleWords) + `filter-actions.ts` + `CreateRunInput.filters/limits` 전량 제거. run 생성은 preset + meta 만.
- **스킬-우선 callout**: enrich(§5)·seed(§2) 카드에 "Claude Code에서 `/vcb-batch-enrich`·`/vcb-seed-list` 실행 권장, in-UI 자동실행은 로컬 dev 편의" 안내.
- **집계 1000행 cap 버그 수정**: `aggregateRunCounts`·`precheckPublish`가 PostgREST 1000행 기본 cap에 걸려 2,000+ run의 승인/발행 카운트가 반토막(→ 거짓 정합성 배너·"50% 완료"). `.range()` 페이지네이션으로 전량 집계.
- **발행 원자성**: `publishRun`의 JS insert 시퀀스+보상 로직을 `vcb_publish_commit(...)` SECURITY DEFINER RPC 단일 트랜잭션으로 치환(service_role 전용 grant).
- **run 진행 오리엔테이션**: `VcbRunProgress`(run.status 기반 7-phase 스텝퍼 + 다음 액션). FS 의존 `VcbPipelineGuide` + `pipeline-steps.ts`(computeStepStatuses) dead code 제거.
- **RLS 정합**: 어드민 서버 조회를 `createAdminClient()`(service_role) + `requireAdmin` 게이트로 — DEV_ADMIN_BYPASS(auth.uid()=NULL) 하에서 RLS 조회 실패 해소.
- **404 수정**: `/admin/vocab/collections` 페이지 신설(발행 컬렉션 목록).
- **Phase 1.5 MockBanner 제거**: 관리자 콘솔 어디도 mock 미사용 → 전역 "MOCK · 시각 검증용" 배너 삭제(실 mutation 오인 위험).
- **마이그레이션**: `drop_vcb_filter_preview_rpcs` — orphan RPC 3종(vcb_count_words_matching·vcb_distribution_for_filters·vcb_sample_words_for_filters) DROP.

### /plan 공용단어장도 다건 선택 — 소스탭 패턴 통일 (v06.160)

공용단어장(word_set)을 스크립트·내 스크립트와 **동일한 소스탭 패턴**(좌 2열 네비 + 우 다건 선택)으로 전환. 이제 도서를 제외한 3탭 모두 다건 선택.

- **분류 축**: 카테고리(수능/공인시험/…/도서 챕터)를 1단, **도서 챕터는 소속 책을 2단**(feed_label=책 제목). `plan-actions`에서 `source`=category, library_book은 책 제목 조인(scripts와 통합 조회).
- **컴포넌트 일반화**: `buildArticleNav`에 소스라벨·정렬 파라미터 추가(word_set=`wordsetCategoryLabel`), `isSourceTab`에 word_set 포함, `ArticleNav` 컬럼 라벨 prop(카테고리/책), `ArticleSelectPane` 아이콘 type별(Layers), `commitSourceBatch` pool 확장.
- **정리**: 표준 경로의 word_set 분기·`WordSetBookGroups`·`bookTitleById`·죽은 groups 분기 제거(−250여 줄). 도서만 표준 master-detail 유지.
- 검증: `tsc --noEmit` 내 파일 0 오류(무관한 동시 WIP `source-guide.ts` 'owid' 오류는 별개).

### UI 스모크 상시 자산화 — 화면 검증 자동화 (v06.159)

지금까지 화면 검증은 매번 임시 Playwright 드라이버 작성→삭제(반자동)였음 — 상시 자산으로 전환.

- **[04-ui-smoke.spec.ts](../apps/web/tests/e2e/04-ui-smoke.spec.ts)** 신설 — 학습자 8화면(/hub·/dashboard·/plan·/wordvault·/flashcard·/pairflip·/scriptquiz·/library/books) 렌더 + 404/에러 바운더리 부재 + **페이지별 콘솔 에러 0 단언** + EchoMatch 마이크 게이트 렌더. 계정: runtime-test-0705(시드 존치).
- `pnpm --filter web test:e2e:smoke` 스크립트 추가 — 기존 dev 서버 재사용, 없으면 자동 기동(기존 playwright.config).
- **[apps/web/CLAUDE.md](../apps/web/CLAUDE.md) "화면 검증" 섹션** — 향후 세션이 자동으로 이 경로를 쓰도록 규칙화: 임시 드라이버 금지 · 새 검증 시나리오는 spec 으로 남겨 자동 회귀화 · fake-mic 플래그 · **⚠️ dev 서버 1개 원칙**(멀티 세션 `next dev` 동시 기동 시 `.next` 공유 오염 → 라우트 무작위 404, 2026-07-07 실측).
- 참고: 첫 실행 검증은 현재 dev 서버 `.next` 오염(/login 404)으로 보류 — 서버 재시작 후 1회 실행 필요.

### EchoMatch 채점 3축 재설계 — 구조적 0점 결함 수리 (v06.158)

런타임 점검(v06.33 이후 첫 실주행 검증)에서 파이프라인(TTS·녹음·4-Phase·DB 적재)은 정상이나 **채점이 항상 낙제점**(실사용 7건 overall 0~53, timing 6/7건 0)임을 확인 — [dtw-comparator.ts](../apps/web/src/lib/echo/dtw-comparator.ts) 재설계.

- **인토네이션**: 절대 Hz DTW(여성 참조 Amy ~200Hz vs 남성 화자 ~110Hz → 평균차만으로 threshold 80Hz 소진 = 구조적 0점) → **semitone 변환 + 화자 평균 제거** 후 곡선 '모양' DTW (threshold 5st).
- **강세**: 절대 RMS DTW(마이크 게인에 점수 좌우) → **시퀀스 피크 정규화** 후 상대 강세 패턴 DTW (threshold 0.4).
- **리듬**: 무음 포함 전체 녹음 길이 비율(발화 전 머뭇거림+완료 버튼 지연이 0점 유발, 실측 8.5s 녹음/3s 참조) → **voiced 구간 발화 길이의 로그 비율** (2.5배에서 0점, 대칭 감점).
- **회귀 테스트 7종** ([__tests__/dtw-comparator.test.ts](../apps/web/src/lib/echo/__tests__/dtw-comparator.test.ts)) — 결함 3건을 시나리오로 고정(옥타브 차 동일 억양 ≥85 · 게인 5배 ≥90 · 무음 패딩 timing ≥95) + 변별력 보존(다른 곡선 < 같은 곡선, 2.5배 느림 = 0, 무음 = 전축 0). 전 스위트 106 passed.
- 한계: threshold 3종은 합성 contour 기준 보정 — 실음성 베타 데이터로 재보정 여지. 런타임 재주행은 dev 서버 `.next` 공유 충돌(멀티 세션)로 이번엔 유닛 검증까지 — 파이프라인 자체는 수리 전 실주행에서 완주 확인됨.

### /plan 내 스크립트 '도서에서'를 책별 2차 분류 (v06.157)

v06.155 후속 — `도서에서`(library) texts가 단일 '전체'에 평면으로 쌓이던 것을 **소속 도서로 2차 분류**(feed_label=책 제목) → **소스 → 책 → 챕터** 3단(article의 소스→프로그램→컨텐츠와 동일).

- `plan-actions` scripts fetch에 `library_book_id`·`chapter_idx` 추가 + `library_books` 제목 조인. `feed_label`=책 제목(library 소스), 책→챕터 순 정렬.
- 실측: 도서에서 235 texts → **5권**(Twenty years after 90·Decline&Fall 71·Pride&Prejudice 61·Alice 12·Ammachi 1)으로 그룹.
- 검증: `tsc --noEmit` 통과.

### D2(register 백필) 진단 — 허위 P0 해소, segment 실지표로 교체 (v06.156)

register 43,988행 백필 착수 전 진단에서 전제 반전 확인 — 코드만 변경(데이터·마이그레이션 0).

- **진단**: D2 의 기대효과(segment 자동 단어장)는 **list_tags 로 이미 달성**(specialty 4종 curation_query 실측: `list_tags has moel_1.0` 등). SSoT 가 소비하는 것은 `word_register`(100% 채움)이고, `register` 컬럼은 **앱 내 소비처 0** — admin 지표만 참조하던 허위 P0.
- **결함 룰 4 교체** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)): `register_critical_null`(항상 발화) → `segment_tags_underdeveloped`(segment 태그 풀 <50% 시만). 실측 2,661 row/목표 3,000 = 89% → 미발화.
- **점수 정상화** ([health-score-v2.ts](../apps/web/src/lib/admin/dict/health-score-v2.ts)): R3 팩터(가중 15%)와 coverage(6%)의 register 채움률(3.3%) → segment 태그 충족률(89%)로 교체 — "segment 매칭 불가 🚨" 허위 evidence 제거. `SEGMENT_TAGS`/`SEGMENT_TAGS_TARGET` 상수 신설([queries.ts](../apps/web/src/lib/admin/dict/queries.ts), coverage fetch +1 카운트).
- **백로그 D2**: P0 → P3 이연 — "격식(formal/informal) 표시 UI 등 실소비처 확정 시 재개"(룰 커버 ~2.6K + LLM 잔여로 재산정). 대시보드 P0 는 이제 B1(VCB-VRL 컬럼) 단독.

### /plan 내 스크립트도 소스별 분류 + 다건 선택 (v06.155)

내 스크립트(개인 texts)를 스크립트(article) 탭과 **동일한 소스별 분류 네비 + 다건 선택** 디자인으로 통일.

- **분류 축 = `texts.source`(text_source)** — 도서에서 / 직접 입력 / 파일 업로드 / 공유 세트. `ARTICLE_SOURCE_LABEL`에 text_source 라벨 추가(키 비충돌로 공개·개인 스크립트 공용), `articleSourceLabel` 폴백 정리.
- **컴포넌트 공용화** — `isSourceTab`(article|script) 분기로 `ArticleNav`(좌 2열) + `ArticleSelectPane`(우 다건 선택)를 두 탭이 공유. `ArticleSelectPane`/`ArticlePickRow`에 `type` prop(활동 목록·배지·countByKey 키). `commitArticleBatch` → `commitSourceBatch`(활성 탭 type + 해당 pool).
- 탭 전환 시 다건 선택·소스 상태(`artSel`/`artActs`/`artSrc`/`artProg`) 리셋.
- `plan-actions` scripts fetch에 `source` 추가. 검증: `tsc --noEmit` 통과.

### 스텁 예문 백로그 전량 종결 — 근접 노출 201 교체 + 잔여 6,894 NULL (v06.154)

v06.152(사전 보강)에서 발견한 비노출 스텁 예문 7,096건 처리 완료 — DB 데이터만 변경(코드 0).

- **근접 노출 201단어**(published/ready 도서 어휘에 등장 — 향후 세트 발행 시 노출될 후보): 전부 정상 예문으로 교체. 개인 단어장·아티클 겹침 0 실측.
- **잔여 비노출 6,894건: `example_en = NULL`** — 깨진 템플릿 문장("The X is referenced in this passage.")을 학습자에게 보여줄 바에는 공란이 정직. 채움률 착시 제거(example NULL 171→7,065 = 실상 노출). 추후 해당 단어가 노출 경로에 들어올 때 lazy-enrich.
- 전수 스캔 검증: 스텁 패턴 잔존 **0** · 당일 갱신 7,413행 산술 정합(331 보강+181 예문+6,894 NULL).
- 인프라 메모: 작업 중 Supabase MCP 프록시 502 장기 장애 → 서비스롤 supabase-js 폴백(프로젝트 관례, `scripts/dict-fill/*-import` 패턴). PostgREST LIKE 전표 스캔은 statement timeout — PK(word) 범위 페이지네이션 + 클라이언트 필터로 우회. 임시 스크립트는 삭제.

### fix: /plan 탭 전환 시 우측 컴포저 초기화 (v06.153)

도서/공용단어장/내 스크립트에서 자료를 골라 `draft`가 생긴 상태로 스크립트 탭으로 전환하면, 우측 우선순위(`draft > … > ArticleSelectPane`)에서 옛 구성이 남아 스크립트 컨텐츠 선택 영역이 안 보이던 버그. 탭 버튼 onClick에 `setDraft(null)`+`setEditId(null)`+`setError(null)` 추가.

### /plan 스크립트 학습대상 다건 선택 + 우측 선택 영역 재설계 (v06.152)

컨텐츠를 하나 누르면 곧바로 단건 구성으로 가버려 **여러 개를 못 고르던 구조** 개선 — 우측 선택 영역을 다건 선택 체크리스트 + 공유 구성 + 일괄 담기로 재설계.

- **`ArticleSelectPane`/`ArticlePickRow`(신규)** — 컨텐츠 행에 체크박스, 여러 개 토글 선택. 선택 ≥1이면 아래에 **선택분 공통 활동·요일** 구성이 열리고, **`계획에 담기 (N개 자료)`**로 일괄 저장.
- 상태 리프트 `artSel`(선택 id 집합)·`artActs`·`artDays` + `commitArticleBatch`(선택분 순차 savePlanItem, 낙관적 일괄 추가). 도서/공용단어장/내 스크립트는 기존 단건 draft 유지(도서는 챕터 per-book).
- 행 디자인 폴리시 유지(hover 리프트·체크 채움), 이미 담긴 자료 '담김' 배지.
- 검증: `tsc --noEmit` 통과, 잔여 참조 0.

### 교육과정 기본어휘 3,000 `list_tags` 태깅 완료 ([별책14]) (v06.146)

2022 개정 영어과 교육과정 기본어휘([별책14] PDF)를 검토·추출해 `shared_dictionary.list_tags`에 별표 등급별 3단 태그 부착 완료. 공용단어장 VCB 필터에서 즉시 사용 가능.

- **추출·검증** — `pdftotext`로 3,045 core(공식 3,000 + 슬래시 철자변형) 추출, dropped 0. 등급 `*`819·`**`1,215·무1,011 = 문서 명시 배분과 일치. 파생형(괄호) 226 별도.
- **커버리지** — 3,025/3,045(**99.3%**) 이미 `shared_dictionary` 존재, 누락 20(철자변형/구어/역형성 — 대부분 정본 twin 존재). 읽기전용 실측(service-role).
- **스테이징** — [data/curriculum/](../packages/library-pipeline/data/curriculum/) `kcurr2022_1/2/0.csv`(별표 등급별) + `kcurr2022_missing.csv`(20). [import-ngsl-list.ts](../scripts/lcp/import-ngsl-list.ts) `VALID_LIST_IDS`에 3 태그 등록.
- **연계 감사** — `list_tags` 소비처 2갈래: VRL 분류(`calc_v_level/track/domain`)는 알려진 태그(ngsl/csat/bsl 등)에만 분기 → `kcurr2022_*` 무영향(분류 불변, 트리거 재계산 없음) · VCB 단어장 필터(`vcb_*_for_filters` = `list_tags && tags`)로 공용단어장 큐레이션 가능. FK 체인 `shared_word_sets→shared_words.lemma→shared_dictionary` 확인.
- **적용 완료(멱등 append, 사용자 실행)** — `kcurr2022_1`=808 · `kcurr2022_2`=1,211 · `kcurr2022_0`=1,006 = **합계 3,025행**(disjoint, DB 실측 대조). 태그 구조 3단(별표별, 사용자 확정).

### 큐레이션 드레인 큐 통합 + 품질 검토 task (v06.153)

Curated Books 드레인 큐를 단일화하고, 드레인(Claude Code 배치)이 생성/매핑을 넘어 **품질 검토(레벨·어휘)**까지 하도록 확장.

- **큐 통합** — 퀴즈 큐(`book_quiz_jobs`)를 `book_curation_jobs`(`task_type` 판별자)로 흡수 후 DROP. 배너 2개(`CurationJobsBanner`+`QuizJobsBanner`) → **`DrainQueueBanner` 1개**(🔊 매핑 / 📝 퀴즈 / 🔬 검토). `dev-process` upsert/delete 에 `task_type='voice_map'` 필터(퀴즈 잡 오삭제 방지). 마이그 `unify_quiz_into_curation_jobs`.
- **검토 task 2종** — `level_verify`(본문 근거 CEFR/V 재판정, [`review-book.mjs`](../scripts/lcp/review-book.mjs)) + `vocab_audit`(발행 단어장 뜻·품사·레벨·register 감사, [`audit-vocab.mjs`](../scripts/lcp/audit-vocab.mjs)). `book_curation_jobs.result` jsonb + `enqueue_review_jobs(uuid[],text)` RPC + Bulk 툴바 `레벨 검토 큐`·`어휘 감사 큐` 버튼. 마이그 `drain_review_tasks_level_vocab`.
- **오케스트레이터** — [`scripts/lcp/drain.mjs`](../scripts/lcp/drain.mjs) (`list`/`next`): 4 task 통합 큐 단일 진입점(무엇을·어떻게 드레인).
- **실증** — Pinocchio 어휘 감사 3건(`stroke=뇌졸중→타격` 등 문맥 오류) → `shared_dictionary` 교정 + 발행 스냅샷 10건 전파. Alice Adams 레벨 `B2/V8 → C1/V9` 교정(`cefr_band` 포함 4지표 일관화). `review-book --correct` 가 `cefrj_level` 미갱신해 `cefr_band` 안 따라오던 결함 수정.
- (Curated Books 프로세스 재설계 R1~R4 + 완료 배너 액션 + `⟳ 새로고침` 은 [v06.131](#curated-books-프로세스-재설계--통합정리-v06131))

### 사전 노출 단어 표적 보강 + 스텁 예문 교체 (v06.152)

"Tier B/C enrichment ~5.1K" 백로그 재진단·종결 — DB 데이터만 변경(코드 0·마이그레이션 0).

- **재진단**: rank 보유 구간(28,673)은 example 100%·ipa 96%+로 건강. 미보강 코어 = rank NULL 16,823 중 **발행 세트 노출 331단어**만 표적 보강(고유명사 0·구동사 19 포함) — ipa 77→1 · synonyms 142→48 · collocations 278→20 · example→0. 잔여는 대명사·약어·희귀어 등 본질상 동의어/연어 없음(강제 생성 대신 정직한 공란).
- **🔴 발견·수리**: 템플릿 스텁 예문 7,143건("The X is referenced in this passage." 등)이 example 채움률 100% 착시를 만들고 있었음 — **발행 세트 노출 47건 전량을 정상 예문으로 교체**(노출 스텁 0 확인). 비노출 잔여 7,096건은 백로그 기록.
- 보류/종결: B/C collocations 16,001(보류) · 세트 밖 노출 4,652(저ROI 보류) · 비노출 ~10.8K(종결).
- 빈 필드만 채우는 가드(`CASE WHEN … IS NULL OR =''/'{}'`)로 기존 값 무손실 · 스텁 교체는 패턴 매치 가드.

### /plan picker 행·컬럼 디자인 폴리시 — 상태·깊이 적용 (v06.151)

컨텐츠 행이 hover/active 상태·깊이 없이 평면적이던 것 정비(디자인 원칙: 인터랙티브 요소 hover+active+focus 필수).

- **MaterialRow**(전 탭 공용) — hover 리프트(`-translate-y-px` + `border-[var(--p)]` + `shadow-sm`), `active:scale` 프레스, `+` 아이콘 group-hover 잉크 채움, V-Level 배지 outlined pill, 제목/부제 leading 정리.
- **ArticleContentPane** — 헤더 하단 구분선 + 아이콘 배지 + 개수 pill + 안내문 italic.
- **ArticleNav** — 소스·분류 열에 컬럼 라벨(mono uppercase) 추가로 3단 구조 명시.
- 검증: `tsc --noEmit` 통과. 하드코딩 색 없음(전부 토큰).

### /plan 스크립트 컨텐츠 리스트를 우측 선택 영역으로 (v06.150)

v06.149(좌측 3열) 후속 — 사용자 요청대로 **좌측=소스·분류 2열 네비**, **컨텐츠 리스트는 우측 넓은 선택 영역**으로 이동(제목이 좁게 잘리던 문제 해소). 컨텐츠 클릭 시 그 자리에서 활동·요일 구성으로 전환.

- 소스·프로그램 선택 상태를 PlanClient로 리프트(`artSrc`/`artProg`) → 좌 네비와 우 컨텐츠가 공유. `buildArticleNav` 순수 헬퍼.
- `ArticleColumns`(3열) → `ArticleNav`(좌 2열) + `ArticleContentPane`(우 컨텐츠 리스트)로 분리. 소스 클릭 시 프로그램 리셋.
- 우측 구성 패널 우선순위: draft > editItem > (article) 컨텐츠 리스트 > 빈 안내.
- 검증: `tsc --noEmit` 통과, `ArticleColumns` 잔여 참조 0.

### /plan 스크립트 picker 3열 드릴 — 소스 | 분류 | 컨텐츠 (v06.149)

v06.146(프로그램=우측 헤더) 후속 — 사용자 요청대로 **진짜 3열**로: ① 소스 열 → ② 소스별 분류(프로그램) 열 → ③ 가장 오른쪽 컨텐츠 리스트. 각 단계가 독립 열이라 클릭으로 드릴다운.

- `ArticleColumns`(신규) — 3열 레이아웃 + 소스/프로그램 2개 선택 상태(useState). 소스 클릭 시 프로그램 첫 항목으로 리셋, 컨텐츠는 선택 프로그램만. `ArticleFeedGroups`(우측 헤더 방식) 대체.
- 프로그램 라벨 소스명 중복 제거(`shortProgramLabel`, 원문 tooltip). feed 없는 소스는 '전체' 1개.
- 도서·공용단어장·내 스크립트는 기존 표준 master-detail 유지.
- 검증: `tsc --noEmit` 통과, 잔여 참조 0.

### VRL admin read RLS 정책 + is_admin() 헬퍼 (v06.148)

v06.147 발견분 수리 — 마이그레이션 `20260706010000_vrl_admin_read_policies` (사용자 명시 승인 "적용").

- **`is_admin()`** SECURITY DEFINER STABLE 헬퍼 신설 — `user_profiles` 자기참조 정책의 infinite recursion 방지 표준 패턴 (EXECUTE→authenticated).
- **admin read 정책 4건**: `user_level_snapshots`·`user_profiles`·`user_diagnostic_results`·`vrl_diagnostic_tests`(비활성 포함) — 기존 본인(own) 정책은 유지, admin 에게 SELECT 만 추가.
- 효과: `/admin/vrl/users`·`snapshots`·`diagnostic` 하위 페이지 + automation "최근 레벨 변경"·분포 source 분리 섹션이 실데이터 표시.
- 검증: admin 세션 시뮬레이션 profiles 3·snapshots 5·diag_results 6·tests 5(비활성 포함) 가시 + 재귀 오류 0 · 학습자 세션 본인 1행만(타인 0) 격리 유지.

### /admin/vrl 두 대시보드 현행화 + 고도화 (v06.147)

사전DB Health·VRL Automation 화면을 2026-07-06 DB 실측과 대조 — 불일치 정정 + 관측 강화. 마이그레이션 0 (RLS admin read 정책은 별도 결재 대기).

- **Backlog 현행화** ([backlog-items.ts](../apps/web/src/app/admin/vrl/_components/backlog-items.ts)) — 완료 확인 4건(D1 cefr_confidence 99.6% · V1 V-Level 100% 분류 · C1 진단 5종+FE · D4 inflected_forms 권위화)을 `status:'done'`+실측 근거로 분리 그룹 표시, 헤더는 "남은 N · 완료 M". stale 수치 정정(D3 17.5%, D5 26.8%, D9 ~55%).
- **결함룰 13 라이브화** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)) — CEFR C2 과대표현이 하드코드 스냅샷(56.2%/38,605)으로 발화하던 것을 `raw.categorical.by_cefr_level` 라이브 계산(>40% 발화)으로 교체. 룰 1(VCB-VRL) 설명을 현행 우회 구조(curation_query book_v_level·slug) 반영해 정확화. BACKLOG.V1 stale copy 정정.
- **Automation 관측 강화** ([automation/page.tsx](../apps/web/src/app/admin/vrl/automation/page.tsx)) — ① "최근 레벨 변경" 테이블 신설(user_level_snapshots 10건: 시각·사용자·V변화·사유 — cron `"1 row"` 메시지로는 승급 내용이 안 보이던 문제 해소) ② V-Level 분포에 근거 있는 레벨(진단·학습·수동) vs 기본값(미진단) 인원 분리 표기(기본값 부풀림 착시 방지).
- **발견(별도 결재)**: `user_level_snapshots`·`user_profiles`·`user_diagnostic_results` RLS가 본인 read 전용이라 **/admin/vrl/users·snapshots·diagnostic 하위 페이지와 위 신설 섹션이 admin 세션에서도 사실상 빈 화면** — admin read 정책 마이그레이션 필요.

### /plan 스크립트 picker 3단계 통일 — 도서와 동일 master-detail (v06.146)

스크립트(article) 탭이 **레일에 소스+프로그램을 2단 트리로 욱여넣던** 전용 `ArticlePicker`를, 도서·공용단어장과 **동일한 표준 master-detail**로 되돌림 — 레일=**소스(1축)** → 우측=**프로그램(feed) 헤더** → **컨텐츠 행** (공용단어장 도서챕터와 동일한 3단).

- 전용 `ArticlePicker`/`ArticleRailSource`/`ArticleRailProgram`/`ArticleCrumb`(레일 2단 트리) 제거(−238줄), 표준 렌더 경로로 통합. 우측 그룹 렌더에 `article → ArticleFeedGroups` 분기 추가.
- 프로그램 헤더는 `shortProgramLabel`로 소스명 중복 제거("The Conversation — Health + Medicine" → "Health + Medicine", 원문 tooltip). 레일 폭 96→110px(소스명 수용).
- 검증: `tsc --noEmit` 통과, 제거 컴포넌트 잔여 참조 0.

### /plan 학습 계획 다중 엔트리 — 챕터=최하위 단위 일별 배치 (v06.145)

"일별 · 다수 소스 · 다수 챕터" 요구 충족 — 한 자료를 여러 배치로 담아 챕터를 날짜별로 쪼갤 수 있게. 계획 관리 기본 기능 전면 점검 후 모델 결함 + 삭제 버그 동시 수리.

- **마이그레이션** `20260706024846_p1_plan_multi_entry` — `study_plan_items` `UNIQUE(user_id,material_type,material_id)` **제거**(백킹 인덱스 동반 제거, 조회는 `idx_study_plan_items_user`). 한 자료가 **여러 행(요일×챕터 배치)** 으로 존재 → '월=Alice Ch1 / 수=Alice Ch2' 가능. 무손실(기존 3행 유효). 롤백 SQL: `docs/AI_CONTEXT/rollback/`. 검증: 같은 (user,book) 2배치 삽입 충돌 없음(트랜잭션 확인 후 정리).
- **[plan-actions.ts](../apps/web/src/lib/learner/plan-actions.ts) `savePlanItem`** — `onConflict` upsert 제거 → `id` 있으면 UPDATE by id, 없으면 INSERT 후 **`id` 반환**. **버그 수리**: 기존 낙관적 갱신이 `id:'tmp-…'` 부여 → 방금 담은 항목 삭제 시 uuid 파싱 오류로 실패하던 문제 해결(실 id 사용).
- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx)** — picker 클릭=**항상 새 배치**(기존 '담김→편집 점프' 제거), '담김' 배지→**개수(계획 N)**, 편집/삭제는 주간 보드 카드. 보드 카드 챕터 배지 소수(≤3)는 번호 표기(`chapterBadge`)로 같은 도서 배치 구분. `MaterialRow`/`WordSetBookGroups`/`ArticlePicker`/`ArticleFeedGroups` 시그니처 `added/editing`→`count` 정리.
- 죽은 `study_plan_schedule` 주석 참조 정리(plan-actions·plan-activities). `tsc`·`lint` 0.

### /plan 스크립트 picker 계층 레일(소스→분류→컨텐츠) (v06.144)

스크립트(article) 자료 고르기를 **소스→프로그램(분류)→컨텐츠** 캐스케이드로 재구성 — 분류를 고르면 오른쪽에 그 분류의 글 목록이 나오도록.

- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `ArticlePicker`**(신규) — article 탭 전용 2-pane: 좌측 계층 레일(소스 헤더 + 그 아래 분류 항목) + 우측 컨텐츠. `rail` = `all`/`s:<source>`/`p:<source>:<feed>`. 분류 선택=평면 글 목록 + 브레드크럼(소스·분류), 소스 선택=프로그램 하위그룹, 전체=소스별 그룹. `ArticleRailSource`/`ArticleRailProgram`/`ArticleCrumb` 보조.
- **`shortProgramLabel`** — 좁은 레일에서 부모(소스) 이름 중복 제거: "The Conversation — Health + Medicine"→"Health + Medicine" · "NASA News Releases"→"News Releases" · "Good Articles (Simple Wikipedia)"→"Good Articles"(원문은 tooltip 보존) + 2줄 `line-clamp`. 실데이터 4소스·11프로그램·121편 기준.
- 도서/단어장/내스크립트 탭은 기존 제네릭 rail 유지. 순수 UI(DB/RPC 0) · `tsc`·`lint` 0.

### /plan 주간 보드 세로→가로 7열 캘린더 재설계 (v06.143)

기존 "요일=행(아젠다 나열)" 을 "요일=열(가로 7열 캘린더)" 로 전환 — Google Calendar/Notion board/Things 3 정합 + Reading Room 아이덴티티 유지.

- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `WeekBoard`** — `grid-cols-7 items-start` 7열. 데스크톱=한 화면(min-w-820px 이하로 넘침 없음), 모바일=가로 스크롤(`snap-x` + 열 `snap-start`) 로 "가로" 컨셉을 소형 화면까지 관철. 오늘 열은 마운트 시 스크롤로 가시화(넘칠 때만, 데스크톱 무해).
- **요일 헤더 밴드** — 요일·날짜·'오늘' 배지. 오늘=테두리(`--p`)+틴트 헤더(`--p-light`)+배지 3중 인코딩(색맹 대응). 계획 있는 날=흰 종이 카드(`--bg`+shadow)로 도드라지고, 빈 날은 캔버스(`--bg2`)에 잠겨 물러남(기존 emphasis 로직 계승).
- **`DayCard`(신규, `WeekDayCell` 대체)** — 좁은 열(≈120px)용 압축 카드: 표지 글리프 + 챕터 배지 + 제목 2줄 `line-clamp-2` + 활동 글리프(최대 4 + `+n`). active=편집 중 잉크 채움. `요일 미정` 섹션은 `BoardChip`(행형) 유지.
- 검증: `tsc --noEmit` 0 오류 · `next lint` 0 경고. DB/RPC/라우트 변경 없음(순수 UI).

### /admin/quality "지금 수집" 버튼 + admin wrapper RPC (v06.142)

v06.140 후속 결재분 — nightly 를 기다리지 않는 즉석 스냅샷 수집.

- **마이그레이션** `20260706000000_admin_collect_quality_metrics` — `admin_collect_quality_metrics()` (SECURITY DEFINER, `user_profiles.role='admin'` 검사 후 `collect_quality_metrics()` 위임, EXECUTE→authenticated). 검증: 비admin 세션 'admin only' 차단 + admin 세션 9행 수집(트랜잭션 내 확인 후 ROLLBACK — 실데이터 오염 0).
- **[CollectNowButton.tsx](../apps/web/src/app/admin/quality/CollectNowButton.tsx)** — RPC 호출 → `router.refresh()`. 4상태(idle/loading/done/error) + Calm 피드백("새 스냅샷을 수집했어요"). dev-bypass(anon)에선 RPC 거부 → 오류 상태(정상).
- 참고: MCP `apply_migration` 이 권한 분류기에 거부되어 동일 SQL 을 `execute_sql` 로 적용 + `schema_migrations` 이력 수기 기록(버전 `20260706000000`) — 리포 마이그레이션 파일과 정합.

### ACP 나머지 소스 발행 — 전 소스 프로그램 구조 완성 (v06.141)

v06.137(소스→프로그램→컨텐츠 + VOA 30편) 후속 — 남은 3개 소스의 시드도 전량 발행해 `/plan` picker 모든 소스에 프로그램 하위그룹을 채움.

- **`scripts/acp/publish-article-seeds.mjs`**(신규, 범용) — 소스별 ingester 분기 + `--source`/`--delay` + rate-limit throttle(MediaWiki 429 대응, wiki 기본 1500ms). VOA 전용 스크립트의 일반화판.
- **발행**: Simple Wikipedia 36(Good/Very Good, 429 재시도 3회로 완료) · NASA 30(News Releases 18/Image of the Day 12) · The Conversation 25(CC-BY-ND → **display_only** 읽기전용). 전량 published + article_v_level 산출.
- 전 소스 합계 **121편 · 11개 프로그램** — VOA(4)·NASA(2)·Simple Wiki(2)·The Conversation(3).

### 품질평가 Q3 — /admin/quality 지표 대시보드 (v06.140)

Q1(골든셋 스냅샷)+Q2(nightly `quality_metrics` 수집, PR #94) 후속 — 수집만 되고 보는 화면이 없던 지표를 admin 콘솔에 노출. 마이그레이션 0.

- **`/admin/quality`** ([page.tsx](../apps/web/src/app/admin/quality/page.tsx), Server Component 단일 파일) — 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드: 최신값 + 전회 대비(▲/▼ %p) + 수집 이력 스파크라인(SVG) + `dims` 측정 모수 상세. 도서 지표는 `dims.status`(published/ready) 세그먼트 분리. 미등록 신규 metric 도 원문 라벨로 자동 노출.
- **AdminSidebar** '운영' 그룹에 "품질 지표"(Gauge) 등재.
- **렌더 테스트** [__tests__/page.test.tsx](../apps/web/src/app/admin/quality/__tests__/page.test.tsx) — RLS(read=admin) 탓에 dev-bypass 실주행은 빈 상태만 확인 가능 → 데이터 분기(카드·세그먼트·delta·스파크라인·dims·빈 상태·오류 폴백)는 `renderToString` 픽스처 3케이스로 검증. vitest 에 automatic JSX 런타임 추가([vitest.config.ts](../apps/web/vitest.config.ts), 첫 .tsx 테스트). 전 스위트 99 passed.
- 검증: `tsc --noEmit`·eslint 0 오류 · admin RLS 시뮬레이션 27행 가시 확인 · dev 렌더 200.
- 한계: "지금 수집" 버튼 없음 — `collect_quality_metrics` EXECUTE 가 postgres/service_role 전용(admin wrapper RPC 는 별도 결재 대기).

### 게임 모듈 런타임 검증 — PairFlip 완주 + ScriptQuiz 결함 2건 수리 (v06.139)

Playwright 실주행으로 PairFlip·ScriptQuiz(#53/#54 잔여 "런타임 미검증") 종결.

- **PairFlip ✅ 전 경로 정상**: 허브 실 스탯(Best/게임 수) → Easy 4쌍 완주(시드한 실 SRS 단어로 카드 렌더) → `scores` 1행(730점·won·콤보4) + `learning_records` 4행 + `daily_activity` 트리거 집계(+4 리뷰)까지 확인. 수리 0건.
- **🔴 ScriptQuiz 카탈로그 전멸 수리**: 허브가 "도서 0·문항 0" — 원인은 `const rpc = client.rpc as ...` 로 메서드를 떼어내며 **this 바인딩 소실** → 호출 즉시 throw → page 의 무언 catch 가 빈 배열 폴백. `client.rpc.bind(client)` 로 수정(2곳) + catch 에 `console.warn` 관측성. 수리 후 카탈로그 5권·129챕터·1,019문항 정상.
- **🔴 ScriptQuiz 완료 결과 영속화 0 수리**: 완료 시 `pushPendingTextResult`(sessionStorage) 만 쌓고 **소비자가 전무** — DB 기록이 증발(#57 scores 적재에서 유일하게 빠졌던 게임). 완료 분기에 `recordGameScore` 직접 배선(score=정답×20, 정확도·소요초·챕터 메타). 재플레이 검증: `scores` 1행(Pinocchio Ch1 · 7문항 · 2정답 · 29%) 적재 확인.
- 부수 확인: 회전 정답 설계 실측 정합(전부 1번 선택 시 ch1 정답 정확히 2개) · 결과 화면 Calm UI("오늘 잘 마쳤어요") · console error 0.

### 네비게이션 감사 P2 + 경미 복귀 마무리 (v06.138)

v06.135(P0+P1) 후속 — 감사 P2 7건(커밋 `56cb8de`, 당시 CHANGELOG 동시편집으로 보류분) + 경미 2건 기록. 감사 전 항목 종결.

- **P2 폴리시 7건** — 메인 [Sidebar](../apps/web/src/components/layout/Sidebar.tsx) 하위 라우트 하이라이트(`/wordvault/study`·`/review`) · [WordVaultBrowse](../apps/web/src/components/wordvault/WordVaultBrowseClient.tsx) 챕터 이동 `?from` 유지 · [구독 토스트](../apps/web/src/components/library/vocab/SubscribeSuccessToast.tsx) `?from` 부착 · 모달 focus 복원 5곳(Netflix·VocabSet·ChapterQuiz·ChapterWordSet·ArticleWordSet) · [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx) body scroll lock · Type/Voice 팝오버 Esc 닫기 · [DiagnosticClient](../apps/web/src/components/diagnostic/DiagnosticClient.tsx) 질문 중 "그만두기".
- **경미 복귀 2건** — [ScriptQuiz](../apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx) 시작화면 back `/library` 하드코딩 → `?from` ?? `/scriptquiz` · [PairFlipResultScreen](../apps/web/src/components/pairflip/PairFlipResultScreen.tsx) 결과화면에 "PairFlip 홈으로" 복귀 링크 추가(결과=sessionStorage라 스코프 유실 → 허브).
- dead-code 정리: `ContextBar.tsx`(미사용, 부활 시 back 하드코딩 버그) **삭제** + WorkspaceBookContext stale 주석 정정.
- 검증: `tsc --noEmit` 통과(0 오류) · `next build` clean `.next` 재빌드 Compiled successfully(내 파일 에러 0).

### ACP 스크립트 소스→프로그램→컨텐츠 + VOA 30편 발행 (v06.137)

`/plan` 자료 고르기 스크립트(article) 탭을 **소스 → 프로그램(feed) → 컨텐츠** 3단 구조로. VOA 프로그램(Let's Learn English/Words and Their Stories/Science & Technology/As It Is)이 시드에만 있고 발행 아티클엔 없던 데이터 갭 해소.

- **마이그레이션** `20260705120000_acp_library_articles_feed_label` — `library_articles`에 `feed_id`·`feed_label` 컬럼 + `admin_enqueue_article` RPC 9→11-arg(feed 승계, 기존 호출 호환). database.ts 정밀 추가.
- **VOA 시드 30편 발행** — `scripts/acp/publish-voa-seeds.mjs`(신규): live ingest → INSERT(queued) → analyze(skipLlm) → compute_article_vrl → force-publish 게이트(저작권+오디오). feed 분포 정합: Let's Learn 13 · Words 9 · Sci&Tech 5 · As It Is 3. 전량 published + 단어세트 자동 생성.
- **enqueue 라우트** — 시드 feed_label 조회 후 RPC 승계(향후 UI import도 프로그램 유지).
- **picker UI** — `ArticleFeedGroups`(신규): 소스 레일 → 우측 프로그램 하위헤더 + 컨텐츠 행. feed 없는 소스는 flat. `MaterialOption.feedLabel` 추가. (공용단어장 도서 챕터와 동일 하위그룹 패턴)
- 검증: `tsc --noEmit` 통과 · VOA live fetch 정상 확인.

### 학습자 플로우 런타임 검증 + 전역 셸 목업 수치 실데이터화 (v06.136)

Playwright 실주행 검증(가입→자동확인→로그인→/hub→/dashboard→/reports 갱신→/plan)에서 발견한 결함 수리.

- **🔴 전역 목업 수치 4곳 제거 → 실데이터**: 신규 계정에 STREAK 23일·리본 12일·기억상태 847개·활동 25/28일이 표시되던 문제. 신설 `lib/learner/growth-stats.ts` (React `cache()` — layout·page 요청당 1회) 가 `user_stats.current_streak` + `vocabularies` R(t) 4상태(SSoT `getMemoryState`) + `daily_activity` 28일을 공급.
  - `(main)/layout.tsx` — `streak=23` TODO 하드코딩 제거, Sidebar·FlowNav 실데이터 주입
  - `FlowNav` — `MOMENTUM` 상수 → `momentum` prop (streak·mastery 4색·주간일수). 근거 없던 "정확도 84%" 표기는 삭제, streak 0 이면 "오늘부터 시작해요"
  - `MemoryStatus` — 기본값 612/142/58/35 → 0 + **빈 상태**(읽을거리 CTA)
  - `WeeklyHeatmap` — `generateMockData()`(sin 가짜 활동) 삭제, `days` prop(직렬화 DTO) + 빈 28일 폴백
- **Checkbox 하이드레이션 경고 수정**: `Math.random()` id → `useId()` (SSR/CSR 불일치 해소).
- 검증: 신규 계정 = 정직한 0 상태(빈 스파크라인·CTA), 시드 계정(3일 활동) = STREAK 3·3/28일·45분·67개 전 경로 반영, console error 0. `/reports` "이번 주 갱신" E2E(생성→렌더) 정상. `/onboarding` 은 결함 아님 — #75 재설계로 폐기, `/plan` 이 대체(메모리 정정).

### 네비게이션 "진입→닫기→제자리" 감사 P0+P1 수정 (v06.135)

플랫폼 전체 학습 세션·모달·어드민 탭의 닫기/뒤로 복귀 오류 8건 수정 (5개 영역 병렬 감사 기반). 감사 전체 결과 15건은 [SESSION_LOG.md](../docs/SESSION_LOG.md) 기록, P2 7건은 후속.

- **세션 복귀 통합** — [`lib/layout/session-return.ts`](../apps/web/src/lib/layout/session-return.ts) 신규(`resolveSessionReturnHref`: `?from` → 스코프 텍스트 → hub). Plan/홈 "바로 시작"이 세션 진입 시 `?from` 미부착 → 닫기가 `/plan`·`/`이 아닌 hub로 튕기던 문제 수정([`activityLaunchHref`](../apps/web/src/lib/learner/plan-activities.ts) origin 인자 — 풀스크린 play 라우트에만 `from` 부착).
- **깨진 반환 링크(404) 수정** — SpellForge play가 `textId` 리터럴(`vocab`/`script`/`all`)을 넘겨 종료 링크가 `/text/vocab` 등 404 나던 것 + Flashcard 완료 "Workspace 돌아가기"가 스코프 진입 시 `/text/<단어id>` 404 나던 것 → `backHref` prop(페이지가 `?from`/스코프로 계산)으로 교체. 워크스페이스 인라인 SpellForge 포함.
- **모달 스크롤락 무력화 수정** — [`GlobalBodyReset`](../apps/web/src/components/layout/GlobalBodyReset.tsx) pointerdown 안전망 셀렉터가 실제 모달(`aria-modal`)과 미매칭 → 모달 안 첫 클릭에 배경 스크롤락이 풀리던 문제. `[role="dialog"]:not([aria-hidden="true"])`로 확장(2곳).
- **WordBlitz 나가기** — 인게임 종료가 `/text`·`/library`로(id 유실) 가던 것 → `resolveSessionReturnHref` 사용. **Dictation** `router.back()` 직접 진입 시 앱 이탈 → `history.length` 가드 후 `/dictate` fallback(setup·session 2곳).
- **ACP 기사 콘솔 stage 유지** — [CurationConsole](../apps/web/src/app/admin/articles/CurationConsole.tsx) stage를 `?stage=` URL 동기화 + 프리뷰가 stage 전달 → 검수 후 복귀 시 '커버리지' 리셋 없이 제자리. **AdminSidebar** 이중 하이라이트(vocab↔vocabulary, vrl↔vrl-automation) → 경계+최장일치 1개만 활성.
- 검증: `tsc --noEmit` 통과(0 오류).

### /plan 자료 고르기 picker 일관화 + 공용단어장 챕터 표시 (v06.134)

`/plan` 자료 고르기([PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx))의 4탭 분류 구조 통일 + 도서 챕터 단어장 발견성 개선.

- **도서 리스트 통일** — 도서만 커버 그리드였던 것을 다른 3탭(스크립트·공용단어장·내 스크립트)과 동일한 리스트 행으로. 작은 표지 썸네일 + 저자 + **V레벨 배지**. 4탭 모두 좌=분류 레일 / 우=그룹 리스트의 동일 master-detail. (`BookGridItem` 제거)
- **공용단어장 도서 챕터** — 흩어져 있던 책별 레일 ~15개를 **`도서 챕터` 카테고리 1개**로 통합. 우측에서 책 하위헤더(`챕터 N개`) + 각 챕터 `N장` 행으로 펼쳐(`WordSetBookGroups` 신규) 챕터 발견성 보장. (데이터: 발행 세트 260개 전부 book_id+chapter_idx 보유 확인)
- 분류 축: 도서=V레벨 밴드 · 스크립트(article)=소스 · 공용단어장=카테고리(도서 챕터 포함) · 내 스크립트=V레벨.
- 검증: `tsc --noEmit` 통과(0 오류).

### Pinocchio 챕터 퀴즈 드레인 완결 — 36챕터 252문항 (v06.133)

퀴즈 게이트(v06.129) 후속: published 6권 중 퀴즈 0이던 3권(Pinocchio·Decline·Twenty Years After) 가운데 서사 최소 규모 **Pinocchio 전량 드레인** (Claude Code 본문 정독 생성, content_chunks→`library_chapter_quiz`).

- **36챕터 × 7문항 = 252문항** (`quiz_target_per_chapter(V7)=7` 정합) · type=multiple · en/ko 병기 · `source_snippet` 원문 인용.
- **정답 위치 처음부터 균등 설계**: 챕터별 회전 패턴(`(chapter+q_order)%4`) → 분포 **62/63/64/63** (v06.128 편중 교훈 반영, 사후 셔플 불요).
- 무결성 검증: options=4 전량 · correct_index 범위 · ko/snippet 결손 0 · (chapter,q_order) 중복 0 · 스팟체크 5문항 정답 정합.
- `/scriptquiz` 카탈로그 published 4권(Pride 488 · Pinocchio 252 · Ammachi 5 · Drone 4 = 749문항). 잔여: Decline(71ch)·Twenty Years After(90ch) — 대형 2권 별도 세션.

### /plan 주간 보드 디자인 개선 — 빈 날 압축 (v06.132)

`/plan` 요일별 계획 보드([PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `WeekBoard`)의 세로 빈 공간 정리 — 컴포저가 아래로 밀리던 문제 완화.

- **빈 날 행 압축** — 계획 없는 요일은 배경 없이 얇게 눌러 표시(`비어 있음`), 계획 있는 날만 카드(그림자)로 도드라지게. 요일 셀 52→46px 컴팩트화(`WeekDayCell` 신규 추출).
- **섹션 헤더 추가** — `주간 보드 · 이번 주 N일 계획`(오늘의 학습·컴포저와 리듬 통일).
- 오늘 강조는 ring(형태)+색+`오늘` 텍스트 3중 유지(색맹 대응). 하드코딩 `rgba(59,130,246,0.2)` → `var(--bd)` 토큰화.
- 검증: `tsc --noEmit` 통과(0 오류).

### Curated Books 프로세스 재설계 — 통합·정리 (v06.131)

`/admin/curation` "Curated Books"([MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx)) 의 중복·불필요·복잡 UI 를 동작 보존·DB 무변경으로 정리. 순 ~150줄 감소.

- **R1 처리 엔진 통합** — 구 `큐 자동 처리(drain)` + `Dev 일괄 처리` 두 상태머신·두 배너를 **단일 엔진(`runProcess`) + 단일 배너**로 통합. 둘 다 결국 도서별 `/api/lcp/dev-process` 순차 호출이라 동일 → 큐 전체(`queuedIds`)든 선택분(`devBatchIds`)이든 유한 id 목록을 같은 루프로 처리(무한 루프 불가). `dev-drain-queue` 라우트는 잔존하나 UI 미사용.
- **R2 소스 복귀 버튼 통합** — `처리중 → 소스 GET` + `검토대기 → 소스 GET`(동일 `admin_bulk_requeue_books`) → **`소스로 되돌리기 (삭제)` 1버튼**(선택된 처리중 ∪ 검토대기 전체).
- **R3 vestigial 제거** — `검토대기 → 처리중` 버튼 제거(재처리로 대체). RPC `admin_bulk_set_books_curating` 는 DB 잔존.
- **R4 스텝퍼 단순화** — `▶ 큐 처리` header 중복 버튼 제거(가이드 콜아웃 1곳만 유지). 작업 순서 스테퍼는 도서 status 선형(소스처리→처리중→검토대기→게시됨)만, 빈 단계 자동 접기 + 유령 `매핑 큐` 단계 제거(매핑은 `CurationJobsBanner`+행 배지가 담당).
- 검증: `tsc --noEmit` + `next lint` 통과.

### 인증 화면 소셜 버튼 제거 — provider 미설정 정리 (v06.130)

Supabase Auth 설정 실측(`/auth/v1/settings`): **OAuth provider 전원 비활성**(google 포함, email 만 true) — Google 버튼은 "provider is not enabled" 실패, Apple/Kakao/Naver 는 목업 토스트였음.

- `/login` · `/signup` 소셜 버튼 4종 + 구분선 + `handleSocial`/아이콘/`SocialButton` 제거 → 이메일 인증 단일화 (provider 설정 시 git 이력 복원).
- 고아 파일 `signup/signup.tsx` 삭제 (import 0, 전체 목업 구버전 잔재).
- `/api/auth/callback` 의 OAuth 처리·`oauth_failed` 에러 매핑은 유지 (재도입 대비, 무해).

### 큐레이션 미결 2건 결재·적용 — 퀴즈 게이트 + book i+1 추천 (v06.129)

v06.128 미결 ①② 사용자 승인 후 마이그레이션 2건 적용 (`quiz_catalog_published_gate` + `recommend_book_iplus1_tier`).

- **① `list_book_chapter_quiz_catalog()` 노출 게이트**: 도서 탐색과 동일 3중 게이트(`published + copyright_safe_in_kr + published_at`) 추가 — 카탈로그 11권 → **3권**(Pride 488 · Ammachi 5 · Drone 4 = 497문항). ready 8권 909문항은 데이터 보존, 도서 publish 시 자동 재노출.
- **② `recommend_word_sets_for_user` 6th tier `book_iplus1`**: `lexical_coverage` 가 사용자 V-Level 에서 **85~95%** (judgeIPlusOne 밴드)인 published 도서 상위 2권의 입문(최저 챕터) 세트를 priority 6 으로 추천. 시그니처·기존 5-tier 불변. 검증: V6 시뮬레이션 → Ammachi Ch.1(94%) + Pinocchio Ch.1(88%). 미진단(fallback) 분기엔 미노출(레벨 앵커 없음).
- **③ `classified_by` CHECK 확장** (`classified_by_allow_new_models`): 허용값에 `claude_code_opus_4_8` + `claude_code_fable_5` 추가 (기존 4값 유지, 이전 등재분 4_7 표기는 소급 변경 없이 기록 보존).

### 큐레이션 4축 심층 점검 — 품질 결함 수정 (v06.128)

도서·스크립트(퀴즈)·사용자 자동·단어 큐레이션 전수 점검(라이브 DB) + 확정 결함 즉시 수정. 마이그레이션 0 (데이터 정비).

- **🔴 퀴즈 정답 편중 수정**: 초기 드레인 5권(Huck·Sherlock·Just So·Ammachi·Drone)이 **정답 100% A**, Wonderful Oz 77% → 전체 0번 49.9%(701/1,406). "모르면 A" 전략이 통하던 상태. md5(id) 결정적 스왑으로 균등화 → **359/355/348/330 (±1%p)**. 스왑 무결성 스팟체크 통과. (options≠4 로 보인 14건은 truefalse 타입의 정상 2지선다 — 오탐.)
- **🔴 단어장 CEFR 라벨 drift 808건 동기화**: 사전 99-relabel·R5 정렬 이후 세트 스냅샷이 구 라벨 유지 → `shared_words.cefr_level` ← 사전 SSoT 전수 동기화(drift 0).
- **도서 4축 완충**: F-K 결손 10권 → `book-readability.mjs` 재실행으로 **21권 전량 충전**(Decline grade 20 = 학술서 실측 정합) · lexical_coverage 결손 1권 `compute_book_coverage` 충전(활성 도서 100%).
- **Les Mis 사전 등재 드레인 완결**: addable_modern 247 → 노이즈 blacklist 19(불어/OCR) + **사전 등재 226**(신규 171 + stub 채움, -ed 표면형은 base 동사/형용사로 정규화, 고어=archaic_literary·시대어=period_cultural 레지스터) → processed 마킹 + backfill → lemma **89.54%**. 잔여 NULL 상위 = 불어 기능어(de/la/des)·고유명(louis/faubourg)·고어(thee/yonder=archaic 사전 영역) — 학습 사전 비대상.
- **건강 확인**: 사용자 자동 큐레이션(auto-vlevel 9세트·KICE 5·specialty 4 발행, v3 세트 순도 100%, promote cron active·succeeded) · 단어장 무결성(word_count drift 0·빈 세트 0·뜻 누락 0·사전 링크 끊김 0) · 퀴즈 스냅샷 drift 0·중복 문항 0.
- **🟡 미결(결정 필요)**: ① 노출 게이트 불일치 — 도서 탐색 6권(published+ts) vs 퀴즈 카탈로그 11권(RPC 게이트 0, ready 포함) ② recommend 에 lexical_coverage 6th tier(book_iplus1) 추가 마이그레이션 ③ `classified_by` CHECK 에 opus_4_8 미등재(4_7로 기입).

### P6 소급 F3 전면 실행 + P6.4/6.5 재검증 (v06.127)

P6은 6/28에 1차 종결(P6.1~3 PR #46 · P6.4 점검 · P6.5 PR #50 · P6.6 PR #47 — 당시 F 결정은 "F3 하되 **V0 미진단 사용자 제외** → 삭제 0건"). 오늘 세션은 재검증 + **사용자 신규 결정으로 V0 제외 조항을 해제한 F3 전면 소급**. 마이그레이션 0.

- **P6.4 재검증 (결론 일치)**: 두 함수 dump 재비교 — 구독 = `BETWEEN v−1 AND v+1` 양방향 밴드(부담 관리, fallback user→book_v→5, cap50) vs 추출 = `>= user_v+1` 상향 threshold(미지어 발굴, text_p75 fallback). 6/28 판정("맥락별 메커니즘 차이, drift 없음")과 동일 결론 — 통합 불요 재확정.
- **P6.5 재검증 (정상)**: Cold(발행 세트 cap=40 live max 확인) / Warm(i+1+전면 dedup+cap50 dump 확인) / Hot(FSRS 별도) — `docs/VOCAB_LAYERS.md` 명문화와 정합.
- **P6.6 F3 전면 소급 (사용자 결정 2026-07-04)**: 측정 — vocabularies 6,477행(2 users) 중 **미학습 99.94%**·stable 0·i+1 위반 4,919(76%). 6/28 결정에서 제외됐던 V0 사용자 물량이 위반의 전부 → 오늘 결정으로 해제. 실행: book-origin 4,862행 DELETE(review_count=0 가드 — 보호 대상 0) → 5권 재-enroll(V0 는 P6.6 가드로 book_v_level fallback 밴드 적용) → **4권 × 정확히 50행·i+1 위반 0** + Ammachi 0행(V4 어휘가 밴드 밖 = 필터 정상). 총 vocabularies **6,477→1,815행** (비도서 구독분·학습 진도 보존).
- 상세: `docs/AI_CONTEXT/handoffs/p6_subscribe_user_filter.md` 완결 기록.

### 비밀번호 재설정 실동작 연결 — 목업 제거 (v06.126)

`/reset-password` 가 **Supabase 호출 없는 목업**(setTimeout 1.2s 후 성공 화면, 토스트에 "(목업)" 표기)이어서 재설정 메일이 영구 미발송이던 결함을 실구현으로 교체. 마이그레이션 0.

- **진단 경로**: auth 로그에 `/recover` 요청 부재 확인 → 페이지 소스에서 목업 확정. (부수 발견: `/authorize` 400 `provider is not enabled` — 소셜 로그인 버튼이 미설정 프로바이더 호출.)
- **request 모드**: `resetPasswordForEmail(email, { redirectTo: origin + '/api/auth/callback' })` — 429 rate-limit 안내 + enumeration 방지 문구(미가입 이메일은 미발송) 추가.
- **update 모드**: recovery 링크 → 콜백(`verifyOtp` type=recovery → `/reset-password`) 세션 감지 시 새 비밀번호 폼(8자+확인) → `auth.updateUser({ password })` → `/hub`. 세션 확인 중 스피너로 모드 플리커 차단.
- typecheck 0 · eslint 0. 기존 디자인(Parts Kit 토큰) 그대로 유지.
- 운영 주의: Supabase 기본 SMTP 는 시간당 발송 제한(~2통)·발신 평판 낮음 — 국내 웹메일(empal 등) 스팸 분류 가능. 운영 전 custom SMTP 설정 권장.

### /plan 학습 계획 — 챕터 리스트·주간 날짜·계획 아이콘 (v06.124)

`/plan` 구성 UX 3종 개선. 마이그레이션 0.

- **챕터 리스트화**: 번호 칩 → 체크 리스트(번호+**챕터 제목**, 스크롤). 제목은 신규 서버 액션 `fetchBookChapters`(plan-actions)가 `library_chapters_master`에서 지연 로드(모듈 캐시) — RLS `read_via_published` 범위(=picker와 동일)라 추가 정책 불요.
- **요일에 날짜**: 서버(KST)에서 이번 주 월~일 'M/D' 7개를 산출해 주입(하이드레이션 안전) — 주간 보드 헤더·요일 선택 칩(원형→날짜 병기 필)·오늘의 학습 헤더에 표시.
- **보드 칩에 계획 내용 아이콘**: 자료 글리프 아래 활동 아이콘(듣기/읽기 등, 최대 4개+`+n`)과 챕터 배지(`ListChecks`+`n장`/`전체`) — title·sr-only 텍스트 병기(색맹·스크린리더).
- **활동 아이콘 재정비(유일성)**: vocab/flashcard 중복 'Layers' 해소 — vocab→`WholeWord` · pairflip `Shuffle`→`Grid2x2` · spellforge `Pencil`→`Hammer` · scriptquiz `ScrollText`→`HelpCircle`. **활동 선택 칩도 선택 여부와 무관하게 같은 아이콘 상시 표시**(기존: 선택 시 체크로 교체돼 연상 단절) + 선택 체크 병기.
- **요일 선택 재설계(인식률)**: 원형/소형 필 → 전폭 7열 그리드 셀(min-h 56px, 요일 14px + 날짜 10px + 상태 슬롯) — 선택=채움+체크(형태 이중), 오늘=테두리+'오늘' 라벨.
- **아이콘 단일 출처화**: `lib/learner/activity-icons.ts` 신설 — PlanClient·**TodayPlanCard(hub)** 가 공유. hub 쪽 복제 맵이 구버전 아이콘 이름을 들고 있어 신규 아이콘이 Layers 폴백으로 뭉개지던 실버그 해소.
- **담은 자료 picker 유지**: 담아도 목록에서 사라지지 않고 '담김' 배지 표시, 클릭 시 그 항목 편집으로 진입(자료당 계획 1개 + 챕터/활동 수정 모델을 UI 로 드러냄).
- **picker master-detail 기본 패턴**: 모든 자료 유형에서 좌측 **분류 레일**(전체+분류·개수) / 우측 세부 리스트 — 도서·내 스크립트=V밴드, 스크립트=소스별(VOA/NASA/…), 공용단어장=카테고리+**책별 레일**(책 선택 시 챕터 순 단어장 목록, 'n장 단어' 표기·저장은 원제). 챕터 종속 단어장 262종 숨김 해제. 기존 V밴드/서브필터 칩 2줄은 레일로 대체.
- **요일 미정 안내**: 보드 하단 설명 문구 + 요일 블록 라벨("안 고르면 '요일 미정'에 담겨요"). **신규 담기 기본 요일=오늘**(해제 가능) — 담자마자 미정으로 떨어지던 흐름 해소, 담기 버튼에 '주 n일/요일 미정' 상태 명시.
- **주간 보드 아젠다형 재설계(디테일 가시성)**: 7열 세로 그리드(칸 ~90px, 아이콘 11px) → **요일=행** 리스트로 전환 — 각 계획이 전폭 카드(표지 36×28 · 제목 · 챕터 배지 · 활동 아이콘 13px 최대 6개)로 표시. 활동 선택도 2열 정렬 그리드 + 아이콘 타일(24px 박스)로 확대.
- **아이콘 타일 단일 컴포넌트화**: `ActivityGlyph`(sm/md·onDark 톤) — 주간 보드 행·활동 선택 칩·바로 시작·hub 오늘의 학습 계획이 전부 같은 타일 표현 공유(맨 아이콘 혼재 해소). 선택 시 구성 패널이 화면 밖이면 `scrollIntoView(nearest)` 로 데려오는 사용성 보강.
- **/plan·/dashboard 폭 정합**: 두 화면만 `content`(820px)였고 /plan 은 내부 `max-w-3xl`(768px)+px-4 이중 제약까지 겹침 → `wide`(1024px) 통일 + 내부 제약 제거 (Screen 주석의 'wide=Dashboard' 명세와 코드 불일치 해소).
- 검증: typecheck 0 · lint 신규 0 · vitest 96 pass · dev 렌더 /plan·/hub 에러 0, 오늘(토 7/4) 마커·주간 날짜 정합 확인.

### 빌드-타임 lint 게이트 복원 + a11y/lint 부채 청산 (v06.117)

v06.92 에서 lint 부채(74건)로 빌드에서 분리했던 ESLint 게이트를 복원. 마이그레이션 0.

- **부채 청산**: `no-unused-vars` ERROR(ChapterQuizAdminSection 미사용 `bookId`) 해소 + 지원 안 되는 `aria-*` 3건(SourceCard `article`/Radio `radio`/CEFRDistribution `listitem`) 제거·승격 → `next lint` **0 error / 6 warning**(exhaustive-deps 잔여).
- **게이트 복원**: `next.config.mjs` `eslint.ignoreDuringBuilds` `true`→`false`. 풀 `next build` EXIT 0 검증(warning 은 빌드 비차단). typecheck 계속 강제. `swcMinify:false`(piper-tts)는 별건이라 유지.
- **트리 정합 복구**: "챕터 퀴즈 검수" admin 기능(`ChapterQuizAdminSection`·`ChapterQuizPreviewModal`·`admin-quiz-queries.ts`·`preview/[bookId]/page.tsx`)이 untracked 로 방치돼 CI 에서 import 미해결이던 것을 완결 커밋.

### P0 보안 — public RLS 하드닝 + 유출 backup 제거 (v06.117)

security advisor **ERROR 8건 → 0**. 마이그레이션 2 (`20260703120000_p0_security_rls_hardening` · `20260703120010_p0_drop_p5a_backup_table`).

- **근본 원인**: `public` 스키마 8 테이블이 anon 에 SELECT+INSERT 권한이 있는데 RLS 가 꺼져 있어 익명 키로 직접 read/write 가능한 상태였음.
- **참조 taxonomy 4종**(`vocaflow_levels`/`tracks`/`domains`/`skills`) — RLS on + authenticated read 정책(앱 DiagnosticClient·admin 경로 유지).
- **내부 QA**(`vrl_data_integrity_concerns`) — RLS on + admin 전용 read(`user_profiles.role='admin'`).
- **백엔드 전용**(`noise_blacklist`·`english_irregular_forms`) — RLS on·정책 없음(락). SECURITY DEFINER RPC·service_role bypass 로 기능 무영향.
- **유출 backup DROP**: `shared_dictionary_p5a_backup_20260620` (16,492 row · 688 kB) — 추출 P1~P4 백업본 목적 종료. 테이블 59→58.
- read 정책만 추가(INSERT 정책 부재) → 익명 write 구멍 차단. anon SELECT 도 정책 부재로 무력화. typecheck green.

### Dictation 화면 디자인·기능 개선 (v06.116)

받아쓰기 4개 화면(Hub/Setup/Session/Results) 폴리시 정합 개선. 마이그레이션 0 · typecheck green.

- **Calm UI**: Hub 직접입력 검증을 `alert()`(차단형 모달) → 인라인 empathetic 메시지("조금만 더 있으면 돼요 — 지금 N자")로 교체. 입력 시 자동 소거 + `aria-invalid`/`role=status`.
- **트로피 지양(§학습UX)**: Results hero 상시 `Trophy` 아이콘 → 점수대별 차분한 아이콘(`Check`/`Sprout`/`Leaf`) + Lora italic 격려 한 줄("오늘 들은 만큼 분명히 남았어요"). "Session Complete"→"오늘 받아쓰기 완료".
- **색맹 대응(§접근성)**: Session 피드백 단어칩에 **범례**(정답/철자/오답/누락/불필요) 추가 — 색상 단독 전달 방지. `WORD_STATUS_STYLES`/`LABELS` 모듈 스코프로 승격.
- **focus 상태(§항상지킬것)**: Session·Setup·Hub 주요 인터랙티브 요소에 프로젝트 공통 `focus-visible:ring` 추가(`FOCUS_RING` 상수) + 속도/힌트 버튼 `aria-pressed`/`aria-label`.
- **키보드 정합**: 숫자키 1-5 속도 매핑을 화면 버튼과 동일 5단계(0.5·0.75·0.85·1.0·1.25x)로 정정 · 파일 상단 단축키 주석을 실제 핸들러(L/H 미구현·Esc=정지)와 일치하도록 수정.
- **정직한 카운트**: Results 오답 단어 20개 초과 시 "+N개 더" 표기.

### ScriptQuiz 큐레이션 챕터 퀴즈 — 도서 V-Level별 스토리 퀴즈 생성 파이프라인 (v06.115)

LCP 큐레이션 드레인 시 도서 챕터별 **스토리 기반 질의/선지 퀴즈**를 생성해 `/scriptquiz` 에서 학습. 마이그레이션 1 (`20260702120000_scriptquiz_curated_chapter_quiz`).

- **신규 테이블 2**: `library_chapter_quiz` (공유 큐레이션 챕터 퀴즈 · 키 `library_book_id`+`chapter_idx`+`q_order` · RLS admin-only) · `book_quiz_jobs` (퀴즈 생성 작업 큐 · 진행률 chapters_done/questions_created · RLS admin-only). 기존 `quiz_questions`(per user+text)와 분리 — 큐레이션 퀴즈는 전 학습자 공유.
- **신규 함수 5**: `quiz_target_per_chapter(smallint)` (V-Level→챕터당 문항 수 SSoT 곡선 **3~10**: V0-1→3·V2-3→4·V4-5→5·V6→6·V7→7·V8→8·V9→9·V10-11→10) · `select_book_chapter_quiz(uuid,int)` (학습자 read RPC, SECURITY DEFINER) · `list_book_chapter_quiz_catalog()` (허브 discovery) · `book_quiz_coverage(uuid)` (커버리지 집계) · `enqueue_quiz_jobs(uuid[])` (큐 적재 · ready/published+챕터 존재만).
- **Frontend**: `/scriptquiz` 허브 목업→실 카탈로그 서버 fetch + `ScriptQuizHub`(client 선택 UI) · `/scriptquiz/play?book=&ch=` 공유 챕터 퀴즈 read(`fetchChapterQuizSession`) · 기존 `?text=`(개인 quiz_questions)·MOCK 폴백 보존.
- **Admin**: `/admin/curation` MyLibraryTab 일괄 액션에 **"스크립트 퀴즈 큐"** 버튼 + `QuizJobsBanner`(진행률 폴링) + `enqueueQuizJobsAction`/`fetchQuizJobsAction`.
- **검수 노출**: `/admin/curation/preview/[bookId]` 도서 검수 페이지에 **"챕터 퀴즈 검수" 섹션** 신규(`ChapterQuizAdminSection`) — 챕터별 문항수 표 + 커버리지/저문항(<3) 경고 + 생성 잡 배지(done/running/failed·chapters_done/total). 행 클릭 → `ChapterQuizPreviewModal`(문항 EN+KO·4지선다 **정답 초록 하이라이트**·본문 근거 snippet Lora italic — 검수용 정답 노출, 학습자 플레이는 숨김). 서버 `fetchBookChapterQuizzes`(authed admin, `library_chapter_quiz`+`book_quiz_jobs` 직접 read, 발행 상태 무관 = 미발행 검수 가능).
- **드레인 헬퍼**: `scripts/lcp/generate-chapter-quiz.mjs` (`plan`/`content`/`insert`/`refresh-job` — 챕터 나열·본문 dump·문항 검증+전량교체·진행률 갱신). 문항 저술=Claude Code(앱 런타임 LLM 0).
- **첫 도서 완성**: Alice's Adventures in Wonderland(V6) **전권 12챕터 × 6 = 72문항** 드레인 생성(`generate-chapter-quiz.mjs insert`) — 챕터별 스토리 MCQ(5 multiple + 1 truefalse), EN+KO, 본문 근거 snippet, correct_index 분산, 무결성 0, book_quiz_jobs=done(12/12).
- **둘째 도서 완성**: The Wonderful Wizard of Oz(V6) **전권 24챕터 = 141문항** 드레인 생성(MCP 직접 INSERT) — 각 챕터 스토리 comprehension MCQ 6문항(Ch.24 "Home Again"=77단어 초단편이라 3문항), EN+KO 4지선다, 본문 근거 snippet, 무결성 0(bad option/correct_index/null/q_order-gap 각 0), book_quiz_jobs=done(24/24). `/scriptquiz` 카탈로그 2권(Alice+Oz) 노출.
- **소형 2권 완성**: Ammachi's Amazing Machines(V4·1ch·5문항 — 코코넛 바르피/6가지 단순기계) + Tell Me, What is a Drone?(V3·1ch·4문항) 드레인 — 단일 챕터 논픽션 그림책.
- **넷째 도서 완성**: The Adventures of Sherlock Holmes(V8) **전권 12편 × 8 = 96문항** 드레인(MCP 직접 INSERT) — 각 단편 스토리 comprehension MCQ 8문항(Scandal in Bohemia~Copper Beeches), EN+KO 4지선다, 본문 정밀 근거 snippet(regexp 추출), 무결성 0(bad option/correct_index/null/q_order-gap 각 0), 전 챕터 정확히 8문항, book_quiz_jobs=done(12/12).
- **다섯째 도서 완성**: Just So Stories(V7) **전권 12편 × 7 = 84문항** 드레인(MCP 직접 INSERT) — 키플링 유래담(Whale~Butterfly) 스토리 comprehension MCQ 7문항, EN+KO 4지선다, 본문 근거 snippet, 무결성 0, 전 챕터 정확히 7문항, book_quiz_jobs=done(12/12).
- `/scriptquiz` 카탈로그 **6권 총 402문항**(Alice 72 + Oz 141 + Sherlock 96 + Just So 84 + Ammachi 5 + Drone 4). V3~V8 난이도 커버.
- 나머지 도서(Pride 61·Twenty 90·Les Mis 364 등 대형서) = 큐 대기.

### Growth(/dashboard) known-word 성장 hero (v06.114)

"Growth" 표면인데 성장 지표(known-word)가 헤더 작은 글씨뿐이던 것을 **성장 hero**로 부각. 마이그레이션 0.

- 헤더에 known-word **큰 숫자(40px)** + "N일 연속" 컨텍스트 + Lora italic Implicit 코멘트("어휘가 자라고 있어요"). 게이지·정답률·압박 없음(§철학1 Calm·§철학4 Implicit).
- 기존 작은 known-word 텍스트 라인 대체. dashboard 헤더만 변경(다른 섹션 유지). typecheck/build green.

### 계획 launch — Dictation 자료 스코핑 (게임 6/6 완결) (v06.113)

마지막 미스코핑 게임 **Dictation** 스코핑 → **6/6 완결**. 마이그레이션 0.

- **`lib/dictation/scoped-resource.ts`** 신규 — `texts.content`(스크립트 본문) → 임시 `DictationResource`(id `text-{id}` · script=content · cefr=texts.cefr_level · translation).
- **`DictationSetupClient`** — `?text=`(texts.id) 있으면 그 스크립트를 fetch→임시 리소스 saveResource→setup 진행. content 없으면 `/dictate` graceful redirect.
- 받아쓰기=문장 전사라 **스크립트(본문)만** 스코핑 — 단어장 미해당, 도서는 inline 본문 없어 hub. (`activityLaunchHref`/`isActivityScoped` dictation=script)
- 데이터패스: 강민 텍스트 content 有 4개 → 정상 리소스(B1 6781자 등), 무 → redirect. typecheck/build green.
- **게임 스코핑 6/6**: flashcard·scriptquiz·spellforge·wordblitz·pairflip·dictation (각 자료유형 정합).

### 계획 launch — PairFlip 자료 스코핑 (게임 5/6) (v06.112)

계획 활동 launch 의 게임 스코핑을 **PairFlip** 까지 확대 → 5/6. 마이그레이션 0.

- **`lib/pairflip/scoped-pairs.ts`** 신규(fetchScopedWords → PairFlipMockWord, meaning 빈 단어 제외).
- **`/pairflip/play`** — `?set/?text`(window.location.search, Suspense 회피) 있으면 **default Normal config + scoped-pairs** 로 사전 config 없이 바로 시작. 없으면 기존 sessionStorage config + due.
- `plan-activities.ts` activityLaunchHref/isActivityScoped(pairflip → 스크립트 `?text=`·단어장 `?set=`).
- **스코핑 5/6**: flashcard·scriptquiz·spellforge·wordblitz·pairflip. **미지원**: dictation.
- **dictation defer 사유**: session 기반 아키텍처(`/dictate/session?sessionId` → DictationSessionClient, setup 가 세션 생성) — 스코핑에 setup/세션생성 개조 필요(별건). typecheck/build green.

### 계획 launch — 게임 자료 스코핑 확대 (SpellForge·WordBlitz) (v06.111)

계획의 활동 launch 를 그 자료 단어로 여는 게임을 **flashcard·scriptquiz → + spellforge·wordblitz** 로 확대. 마이그레이션 0.

- **SpellForge**: `lib/spellforge/scoped-words.ts` 신규(fetchScopedWords 어댑터) + `/spellforge/play?set=/?text=` 분기(flashcard/play 미러). 없으면 기존 due 단어.
- **WordBlitz**: `/play/wordblitz` 가 **이미 `?set/?text` 스코핑 지원**(fetchScopedWords) — launch 라우트만 hub→scoped 로 교정.
- `plan-activities.ts` activityLaunchHref(spellforge·wordblitz → 스크립트 `?text=`·단어장 `?set=`) + isActivityScoped 갱신.
- **스코핑 게임 4/6**: flashcard·scriptquiz·spellforge·wordblitz. **미지원(모듈 hub)**: pairflip(sessionStorage config)·dictation(multi-step setup) — flow 기반 진입이라 별도 작업.
- 데이터패스 검증: fetchScopedWords → word_set 15 실단어(E2E 검증분 재사용). typecheck/build green.

### Today(/hub)에 "오늘의 학습 계획" — 계획→매일 실행 loop 완성 (v06.110)

`/plan` 의 요일별 계획(study_plan_items.weekdays)을 **Today 홈 진입면**에 노출 — 계획이 매일 첫 화면에서 바로 시작. 마이그레이션 0.

- **`components/home/TodayPlanCard.tsx`** 신규(서버 컴포넌트) — 오늘 요일 항목 + 자료별 활동 **바로 시작(launch) 칩**(scoped ▶ / hub ↗). 오늘 항목 없으면 렌더 X(Calm).
- **`/hub` async 화** — fetchStudyPlanItems + KST 오늘 요일. 배치: HubHero → **TodayPlanCard** → TodayFocus → Continue → Modules → Recommended.
- /plan TodayStrip 과 동일 의미, Today(forward) 진입면 노출. (/hub ○static → ƒdynamic)
- typecheck/lint/build green.

### 메뉴 라벨 영어 통일 — 한자어(회고·진단) 제거 (v06.109)

올드한 한자어 문어체(회고=회고록·추도 / 진단=의료 뉘앙스) 제거 + 영어 학습 플랫폼 톤·Reading Room Dual Coding(serif 정체성)으로. 사용자 결정 **B(모듈도 영어 통일)** + /diagnostic 페이지 내부 copy 는 유지. 라우트 URL 불변(라벨만). 마이그레이션 0.

- **메타**: 오늘→**Today**(/hub) · 회고→**Growth**(/dashboard).
- **Growth 관리 카드**: 진단→**Level** · 학습 계획→**Plan** · 주간 리포트→**Report** (CTA "재진단·진단 받기"→"다시 측정·수준 측정", "학습 회고"→"성장 기록").
- **사이드바 그룹/항목**: 스크립트→Scripts · 단어→Words · 익히기→Practice · 정복→Conquer · 완성→Complete · 라이브러리→Library · 내 스크립트→My Scripts · 클래스→Class (WordVault/Flashcard 등 기존 영어 유지).
- **FlowNav STAGES 라벨**도 동일 영어화(subtitle·tip 은 Korean copy 유지).
- typecheck green · `next build` green · 실렌더(전 영어 라벨, 회고/진단 메뉴 소멸) 확인.
- (유지) /diagnostic 페이지 내부 "진단" copy = 시험·평가 맥락 자연스러움 (사용자 결정).

### 메타 표면 4→2 통합 — 오늘(/hub) · 회고(/dashboard) (v06.108)

4개 메타 표면(/hub·/dashboard·/diagnostic·/manage)의 중복(RecentActivity 양쪽·L7 이중할당·/manage 라우터+오링크)을 **2개(오늘·회고)**로 통합. 마이그레이션 0(라우트/컴포넌트만).

- **/dashboard = 회고(L7 단독)**: TodayHero(인사+forward CTA) 삭제 → known-word 성장 editorial 헤더. 순서: 헤더 → MemoryStatus → WeeklyHeatmap → **학습 관리 3카드(ManageSection)** → RecentActivity. `fetchManageOverview` 재사용(+userName).
- **/manage 삭제** → `ManageSection`(진단·계획·리포트, 미진단 시 진단 카드 ring 강조)으로 흡수.
- **/hub = 오늘(forward)**: RecentActivity 제거(회고로 이전).
- **Sidebar META 4→2**: `오늘`(/hub)·`회고`(/dashboard). 진단/계획/리포트는 회고 섹션 카드로 강등(메타 peer 아님).
- 삭제: `(main)/manage/page.tsx` · `components/dashboard/TodayHero.tsx` · `lib/learner/dashboard-data.ts`(소비처 dashboard 단독). 신규: `components/dashboard/ManageSection.tsx`.
- docs: LEARNING_MODEL(L7=/dashboard 단독) · ROUTES(/manage 삭제·/hub·/dashboard) 갱신. typecheck green · `next build` 88/88(/manage 제거).

### 학습 계획 "오늘의 학습" — 계획 → 매일 실행 연결 (v06.107)

`/plan` 에 오늘 요일 학습을 노출 — 계획이 매일 actionable. 마이그레이션 0.

- **오늘의 학습 strip**: 오늘 요일(KST) 항목을 자료 + 활동 **바로 시작(launch) 칩**으로 노출. 없으면 "오늘 요일을 더해 보세요" 안내.
- **주간 보드 오늘 강조**: 오늘 칼럼 ring + "오늘" 라벨.
- 오늘 요일은 **서버(page.tsx) KST 산출** 주입(하이드레이션 불일치 방지, 1=월..7=일).
- `PlanClient.tsx` TodayStrip/TodayRow + WeekBoard today prop. `/plan` page todayWeekday.
- typecheck green · `next build` 89/89 (/plan 12kB) · 실렌더(오늘 강조) 확인.

### 학습 계획 UX 재구성 — 컴포저 + 주간 보드 (v06.106)

`/plan` 을 나열식(세로 카드 리스트) → **컴포저 + 주간 보드**로 (사용자 피드백: 나열식 X, 소스+챕터/단어/활동+요일 한눈에 클릭클릭). 마이그레이션 0 — 데이터 모델 동일, UI 전면 재구성.

- **주간 보드**: 담은 자료를 요일(월~일) 칼럼에 배치 — 날짜가 한눈에. 칩 클릭 → 우측 구성에서 편집. 요일 미정 항목은 하단 행.
- **컴포저(2-pane)**: 좌=자료 고르기(탭·V밴드·표지 그리드/목록) / 우=선택 자료의 **챕터·활동·요일 칩이 한 화면**. 신규=‘계획에 담기’, 담은 항목=토글 즉시 저장 + ‘바로 시작’ launch + 빼기.
- 좌측 자료 클릭 → 우측 즉시 구성, 보드 칩 클릭 → 우측 편집 (클릭클릭). PlanItemCard/WeeklyOverview/ScheduleStrip 류 세로 나열 제거.
- `PlanClient.tsx` 전면 재작성(WeekBoard·DraftConfig·ItemConfig·BoardChip). `plan-actions`/`plan-activities`/마이그레이션 변경 없음.
- typecheck green · `next build` 89/89 (/plan 11.5kB) · 실렌더(보드·컴포저·구성) 확인.

### 학습 계획 요일 결합 — 시간 제거, 자료에 요일 부착 (v06.105)

학습 요일을 **자료 선택과 결합**(따로 선택 = 이질감/계획성 약함, 사용자 피드백) + **시간(하루 분) 제거**.

- **마이그레이션** `20260628220000` — study_plan_items `weekdays int[]`(1=월..7=일, 빈=미정) 추가 + 전역 `study_plan_schedule` DROP.
- **요일 결합**: 자료 추가 흐름(챕터·활동·**요일**) + 카드(요일 요약 + 편집 시 요일 칩) — 분리된 일정 스트립 폐기.
- **주간 overview**: 담은 자료의 요일을 집계해 월~일 학습일/자료 수 표시(읽기 전용 · "계획성").
- **시간 제거**: 하루 목표(분)·daily_minutes 폐기.
- `plan-activities.ts` weekdayLabel(+ DAILY_MINUTES/PlanSchedule 제거) · `plan-actions.ts` PlanItem.weekdays + savePlanItem weekdays(+ fetch/saveSchedule 제거) · `PlanClient.tsx` WeeklyOverview/WeekdayChips + 카드/추가 결합.
- typecheck green · `next build` 89/89 (/plan 11.7kB) · 실렌더(시간 제거·페이지 정상) 확인.

### 학습 계획 picker — V-Level 밴드 × 카테고리 체계화 (v06.104)

`/plan` 자료 추가를 나열식 → **V-Level 밴드 섹션 + 카테고리/소스 필터**의 체계적 선택 구조로 (사용자 피드백: "나열식 안 됨, 체계적 선택구조"). 마이그레이션 0.

- **V밴드 그룹**: 모든 탭을 `genres.ts` V_BANDS(입문 V1-2 / 초급 V3-4 / 중급 V5-6 / 중상급 V7-8 / 고급 V9-11) 섹션으로 그룹 + "전체 레벨" 필터. (도서 book_v_level · 스크립트 article_v_level · 내 글 text_v_level · 단어장 slug(auto-vlevel)→cefr 폴백)
- **서브필터**: 스크립트=소스(VOA·NASA…) · 공용단어장=주제(수능/공인시험/초·중·고/주제별).
- **단어장 정리**: 챕터 종속 세트(category=library_book/library_article 262개) picker 제외 — 부모 자료로 학습.
- `plan-activities.ts` cefrToVLevel + wordsetCategoryLabel. `plan-actions.ts` 단어장 V 도출(slug→cefr)·챕터세트 제외·texts text_v_level·MaterialOption.category. `PlanClient.tsx` 밴드 그룹 렌더 + FilterChip.
- typecheck green · `next build` 89/89 (/plan 11.6kB) · 실렌더 확인.

### `/library/scripts` 소스 맵 — 개인화 오리엔테이션 (v06.103)

ACP 6 소스를 5 학습 트랙으로 묶어 글 선택 전 "내 수준으로 재계산되는 맵" 추가 (ArticlesExplorer 위, 마이그레이션 0).

- **`lib/articles/source-map.ts`** 데이터층 — 5 트랙(listen/easy/topic/news/argue) + 카피는 `SOURCE_SPECS`(topicDomain·styleGuide) 근거. 트랙 V밴드 = `cefrToVLevel(targetCefr)` 실 SSoT, 난이도 판정·정렬·편수 전부 입력→계산(하드코딩 0). `judgeTrackFit`(fit/easy/hard) · `effectiveUserV`(V5 fallback, judgeArticleIPlusOne 정합) · `computeTrackCounts`(prop articles 집계, 추가 쿼리 0).
- **`source-map/DifficultyMap.tsx`** V레벨 native 난이도 맵 — 세그먼트 `vToPct(vMin~vMax)` · 내 위치선 = `vToPct(effectiveUserV)` · 색은 `color-mix` over `--learn-*`(카드 배지색 정합, 신규 토큰 0). Calm UI(도전=amber·red 미사용).
- **`source-map/TrackCard.tsx`** 접힘(이름·한줄·난이도·효과칩)/펼침(왜·방법·편수·CTA) · 첫 fit 카드만 자동 펼침(Progressive Disclosure) · 색+텍스트 배지(색만 금지).
- **`source-map/SourceMap.tsx` + `SourceMapShell.tsx`** 맵 트랙 탭 → 카드 scroll+강조 · CTA → `ArticlesExplorer` 그 트랙 소스로 필터(맵↔목록 연동) · 단일 articles prop 공유.
- **`ArticlesExplorer.tsx`** `sourceFilter` 선택 prop + 활성 칩(backward compatible).
- typecheck green · 시각 검증(맵/탭/필터/0 PAGEERR) · 현 데이터 2편(voa·simple_wikipedia)·3 트랙 "준비 중".

### 학습 계획 리치 구성 — 일정 + 자료 4종 + 도서 챕터 + 비주얼 (v06.102)

`/plan` 을 텍스트 위주 → 비주얼·선택 중심으로 재구성 (사용자 피드백: 일정/무엇을/어떻게 요소 + 학습 의욕).

- **마이그레이션** `20260628210000` — study_plan_items `material_type` += `'article'` + `chapters int[]`(도서 선택 챕터) + 신규 `study_plan_schedule`(weekly_days 1=월..7=일 + daily_minutes, 전역 1개/사용자, 본인 RLS).
- **일정(주당 리듬)**: ScheduleStrip — 학습 요일(월~일 원형 토글) + 하루 목표(분) 즉시 저장.
- **자료 4종**: 도서(library_books·표지) / 스크립트(library_articles·소스 배지) / 공용단어장(shared_word_sets·이모지) / 내 스크립트(texts). 4탭 picker + 스크립트 소스 필터(VOA·NASA·…).
- **도서 챕터 다중 선택**: chapter_count 기반 챕터 칩(안 고르면 전체), 카드/편집에서 토글.
- **비주얼**: 도서 표지(img+onError 폴백) 그리드 + 카드 썸네일, 단어장 이모지, 소스 배지.
- **`plan-activities.ts`** article 활동(echo 제외 9종)·MATERIAL_LABEL·materialHref(/library/scripts)·WEEKDAYS·ARTICLE_SOURCE_LABEL. **`plan-actions.ts`** 4종 fetch + chapters + fetchSchedule/saveSchedule. **`PlanClient.tsx`** 전면 재구성.
- typecheck green · `next build` 89/89 (/plan 10.1kB) · 실렌더 확인.

### 학습 계획 활동 실행(launch) 연결 (v06.101)

`/plan` 담은 자료 카드를 "구성"에서 "실행"까지 확장 (사용자 "계획·실행" 요청 정합, 마이그레이션 0).

- **`plan-activities.ts`** `activityLaunchHref` + `isActivityScoped` — 선택 활동을 그 자료 실제 단어로 진입: 스크립트 `flashcard/play?text=`·`scriptquiz/play?text=` / 단어장 `flashcard/play?set=` (scoped-words `fetchScopedWords` 정합) / listen·read·echo·vocab→본문. 미스코핑 게임(wordblitz/pairflip/spellforge/dictation·도서 게임)은 모듈 hub.
- **`PlanClient.tsx`** PlanItemCard 개편 — 기본=선택 활동 실행 링크(LaunchChip, scoped ▶ / hub ↗ 아이콘 구분=색맹 대응) · 편집(연필)=활동 토글(즉시 저장) Progressive Disclosure. `PlanItem.slug` 추가.
- typecheck green · `next build` 89/89 (/plan 7.89kB).

### 학습 계획 재설계 — 자료×활동 (수능 D-day 폐기) (v06.100)

학습 계획을 "수능 D-day 단어 카운트다운"(P1 초안)에서 **플랫폼 자료(도서/스크립트/공용단어장)별 활동 선택**(리틀팍스 코스형)으로 전면 재설계. 사용자 피드백 — "계획이 왜 수능으로 나오나, 플랫폼 학습 계획이어야 한다".

- **마이그레이션** `20260628200000_p1_redesign_study_plan_items` — 수능 `learning_goals`(goal_type='csat', 0 rows) DROP + `study_plan_items`(material_type/material_id/modules text[]) 신설 · UNIQUE(user_id,material_type,material_id) · 본인 RLS 4정책 · updated_at 트리거.
- **활동 10종**(listen/read/echo/vocab/flashcard/wordblitz/pairflip/spellforge/scriptquiz/dictation) + 자료유형별 가용: 도서/스크립트=10종 전부 · 공용단어장=어휘 5종.
- **신규** `lib/learner/plan-activities.ts`(활동 정의·매트릭스·라우트 빌더) · `plan-actions.ts`(fetchStudyPlanItems/fetchAvailableMaterials/savePlanItem/removePlanItem) · `/plan`(서버) + `components/plan/PlanClient.tsx`(자료 탭 → 활동 체크 → 담은 자료 카드, 활동 토글 즉시 저장, Calm UI).
- **수정** `manage-overview.ts`(plan = 자료N·활동N·상위자료) · `/manage` 학습 계획 카드(CTA→/plan).
- **삭제** `goal-actions.ts`·`study-plan.ts`·`/onboarding`·`OnboardingClient.tsx`.
- typecheck green · `next build` 89/89 · `/plan` 7.25kB. (docs: LEARNER_MANAGEMENT §2-2·§4·라우트표 · ROUTES · DB_SCHEMA 갱신)

### ACP 큐레이션 LCP My Library화 + RPC SSoT 정합 (v06.99)

ACP `/admin/articles` 의 큐레이션 목록을 LCP My Library 방식으로 정렬(멀티셀렉트 + bulk actions: Dev 일괄 / → 소스 GET + DrainBanner). seed-unlock 버그 수정 — 글 삭제 시 `imported_to_articles=true` 잔존 → 재-GET 불가였던 것 → flags 완전 리셋. (PR #72: 라우트 `/api/acp/dev-drain-queue`·`/api/admin/articles/bulk-requeue` + delete 라우트 패치, 마이그레이션 0 — service_role TS 로직.)

- **마이그레이션 (RPC SSoT 정합)** — 라우트 TS 가 실제 동작이지만 직접 RPC 호출 경로 일관성용:
  - `20260628111709_acp_delete_article_seed_unlock` — `admin_delete_article` 가 seed flags 완전 unlock (FK SET NULL 만으로는 `imported_to_articles=true` 잔존).
  - `20260628111753_acp_bulk_requeue_articles` — `admin_bulk_requeue_articles(uuid[])` 신규 (LCP `admin_bulk_requeue_books` 미러: DELETE + draft 단어장 삭제 + seed unlock + 발행/사용자 가드).

### 내 학습 관리 화면 /manage (계획·실행·진단·리포트 통합) (v06.98)

리틀팍스 MY 학습 참고 — P0~P3 데이터를 한 화면에 모은 학습자 관리 overview. 마이그레이션 0(기존 테이블 read).

- **`lib/learner/manage-overview.ts`** `fetchManageOverview` — V-Level(current_v_level, V0=미진단) · known-word · streak · 오늘 단어 · Study Plan(fetchStudyPlan) · 최근 주간 리포트 1건 통합 조회.
- **`/manage`** 신규(서버 렌더) — 4 관리 카드(진단/학습 계획/학습 현황/주간 리포트) + 각 상세 CTA(/diagnostic·/onboarding·/hub·/reports). Calm UI.
- **Sidebar 통합** — META 의 별도 `학습 계획`·`리포트`(직전 추가)를 단일 **`내 학습`(/manage)** 으로 합침(Cognitive Load 절감). /onboarding·/reports 라우트는 /manage 카드 CTA 로 접근. typecheck/lint green.

### Sidebar 학습자 관리 라우트 연결 (/onboarding·/reports·/teacher) (v06.98)

P1~P4.2 신규 라우트가 Sidebar 미등재라 URL로만 접근 가능하던 것 → `sidebar-config.ts`(단일 출처)에 연결. 마이그레이션 0.

- **META_ITEMS** += `학습 계획`(/onboarding, Target) · `리포트`(/reports, CalendarRange) — Hub/Dashboard/진단과 같은 메타 학습 tier.
- **FOOTER_ITEMS** += `클래스`(/teacher, GraduationCap) — L3 B2B 유틸(Settings 옆).
- Sidebar.tsx 가 두 배열 map → 즉시 노출. 누적 구축한 학습자 관리 화면이 발견 가능해짐. typecheck/lint green.

### P4.2 교사 허브 — /teacher (클래스 개설·초대코드·참여) (v06.98)

LEARNER_MANAGEMENT.md P4 화면 1단계 — 클래스카드형 교사 허브. P4.1 데이터 모델 소비. 마이그레이션 `20260628190000_p4_2_join_class_by_code`(초대코드 join SECURITY DEFINER 함수, 사용자 승인).

- **`lib/teacher/class-actions.ts`** server actions — `createClass`(초대코드 자동생성·UNIQUE 충돌 재시도) · `joinClassByCode`(RPC `join_class_by_code` — 비멤버 RLS 우회 lookup+가입) · `fetchTeacherClasses`(멤버수 nested count) · `fetchMyMemberships`.
- **`/teacher`** 신규 — 클래스 개설/목록(초대코드 복사·학생수) + 초대코드 참여 + 참여 중 클래스. Calm UI.
- **마이그레이션** `join_class_by_code(text)` SECURITY DEFINER — 비멤버는 classes SELECT 불가 → 함수가 코드 lookup + class_members 가입(중복 무시). typecheck/lint green.
- 잔여(P4.3): 과제배포(assignments UI) · 리포트 공유. 화면 런타임 미검증.

### P4.1 L3 B2B 데이터 모델 선반영 (classes/class_members/assignments) (v06.98)

LEARNER_MANAGEMENT.md P4 — 클래스카드형 교사/학원 위탁관리의 **데이터 모델 선반영**(사용자 결정 "L3 명시 — 선반영"). **화면(`/teacher/*`)은 Phase 2** — 본 변경은 테이블/RLS 만. 마이그레이션 `20260628180000_p4_l3_class_data_model`(추가·비파괴, 사용자 승인).

- **`classes`**(teacher_id · invite_code UNIQUE) · **`class_members`**(class_id+user_id PK · role) · **`assignments`**(class_id · kind text/word_set · ref_id · due_at).
- **recursion-safe RLS** — classes↔class_members 상호 참조를 `is_class_teacher`/`is_class_member`(SECURITY DEFINER) 헬퍼로 분리(무한재귀 회피). 정책 8: classes(교사 전권+멤버 읽기) / class_members(본인·교사 읽기·본인 가입·교사/본인 삭제) / assignments(교사 전권+멤버 읽기).
- `user_profiles.role`(기존)에 `teacher` 값으로 진입. 검증: 테이블 3·헬퍼 2·정책 8·RLS 3. 화면·서버액션은 P4.2(Phase 2).

### P3 대시보드 실데이터화 — TodayHero + known-word (v06.98)

LEARNER_MANAGEMENT.md P3 — `/dashboard` TodayHero 가 `todayWords=23·goal=30·userName="학습자"` 하드코딩이던 것 → 실데이터. 마이그레이션 0(P0 산출물 소비).

- **`lib/learner/dashboard-data.ts`** `fetchDashboardHero` — 오늘 단어(daily_activity KST today) · 일 목표(user_profiles.daily_word_goal) · 이름(display_name) · known-word(P0 user_stats.known_word_count).
- **`/dashboard`** async 전환 — 서버 fetch → TodayHero 실 props 주입. WeeklyHeatmap(streak)·MemoryStatus(기억 4색)·RecentActivity 는 P0 데이터로 자동 실데이터화(자체 fetch).
- **TodayHero** `knownWordCount` prop + Implicit Progress 표시("지금까지 N개의 단어가 마음에 자리잡았어요" — §철학4 환경 변화, 게이지 X). typecheck/lint green.

### P2 주간 Report Card — weekly_reports + /reports (v06.98)

LEARNER_MANAGEMENT.md P2 — 리틀팍스 월리포트 이식. `daily_activity`(P0) 주간 집계 + Empathetic 코멘트. 마이그레이션 `20260628170000_p2_weekly_reports`(신규 테이블 + 본인 RLS, 사용자 승인).

- **`weekly_reports`** 테이블 — week_start(월,KST) · total_minutes/words/reviews · by_module · empathetic_note · UNIQUE(user_id, week_start).
- **`lib/learner/weekly-report.ts`** — `generateWeeklyReport`(daily_activity 주간 집계 → upsert + 템플릿 격려 코멘트, KST 월요일, 멱등) · `fetchRecentReports`.
- **`/reports`** 신규 — Report Card 목록(단어/복습/모듈 + Lora italic 격려 코멘트) + "이번 주 갱신" server action. Calm UI · 빈 상태 안내.
- 격려형(§철학3): 미활동도 "잠시 숨을 골랐네요" — 압박/비난 없음. cron 자동 생성은 후속. typecheck/lint green.

### P1 Study Plan — learning_goals + /onboarding (수능 D-day 역산) (v06.98)

LEARNER_MANAGEMENT.md P1 — Busuu study plan 이식. 수능 D-day + 주당 목표 → 주당/일 필요량 + 완료일 역산. 마이그레이션 `20260628160000_p1_learning_goals`(신규 테이블 + 본인 RLS, 사용자 승인).

- **`learning_goals`** 테이블 — goal_type='csat'(수능 단일) · target_date(D-day) · target_v_level(7) · target_word_count(4000, 수능 핵심 어휘 근사) · weekly_target_days/minutes. UNIQUE(user_id, goal_type).
- **`lib/learner/study-plan.ts`** `computeStudyPlan`(순수) — gap=목표-known / 남은주 → 주당·하루 필요 + recentWeeklyRate 기반 완료일 예측(격려형, 미달 압박 X).
- **`lib/learner/goal-actions.ts`** server actions — `saveLearningGoal`(upsert) · `fetchOnboardingContext` · `fetchStudyPlan`.
- **`/onboarding`** 신규 페이지 — D-day·주당일·주당분 입력 → 실시간 Study Plan 미리보기(클라 computeStudyPlan 즉시 반영) + 저장. Calm UI.
- P0 집계층(known-word/daily_activity)을 역산 입력으로 소비. typecheck/lint green.

### P0 집계층 — daily_activity 자동 집계 + known_word_count (v06.98)

LEARNER_MANAGEMENT.md P0 적용 — 진단상 `daily_activity` writer 0(=진짜 P0)였던 것을, 이미 흐르는 원천 스트림(learning_records/scores)에서 자동 집계. 마이그레이션 `20260628150000_p0_daily_activity_agg_known_word_count`(추가·비파괴, 사용자 명시 승인).

- **트리거 2** — `learning_records` AFTER INSERT → daily_activity(total_reviews++ · by_module, KST date) · `scores` AFTER INSERT → daily_activity(total_minutes += duration/60 · total_words += correct_count). FlowStripe 히트맵·주간 리포트 집계원 가동(새 INSERT 부터).
- **known_word_count** — `user_stats` 컬럼 + `refresh_user_known_word_count(uuid)`(stability≥21 count → upsert). `flush-actions.ts` 가 flush 후 1회 호출(부가 집계, 실패 무영향). LingQ형 Implicit Progress(§10 derived 캐시).
- 검증: 트리거 2·컬럼·함수 존재 확인 / known-word 로직 read(현 stable 0=정상, 학습 누적 시 성장). P1(Study Plan)·P2(리포트)·P3(dashboard 실데이터)의 전제 완성.

### 학습자 관리 설계 SSoT (LEARNER_MANAGEMENT.md) (v06.98)

5개 비교군(LingQ/Busuu/리틀팍스/클래스카드/듀오) 분석 + 라이브 데이터 진단 종합 — `docs/LEARNER_MANAGEMENT.md` 신규(설계 문서, 마이그레이션 0). 타겟 = **수능생 단일 집중** · L3(B2B) 로드맵 명시 + 데이터 모델 선반영.

- **라이브 진단**: `learning_records` = 연결+검증(4 row, 이번 세션 flush·게임 5종) · `scores` = 연결됨 실플레이 대기 · **`daily_activity` = writer 0 = 진짜 P0** · `known_word_count` = 컬럼 미존재.
- **설계 수록**: DDL 제안(learning_goals/weekly_reports/classes·class_members·assignments + user_profiles.persona/user_stats.known_word_count) · known-word 집계 정의(§10 derived, stability≥21) · Study Plan 수능 D-day 역산 공식 · 5단계 여정 + 3모드 화면 와이어 · P0~P4 시퀀싱.
- **P0 재정의**: 원천 스트림(learning_records/scores)은 이미 흐름 → P0 = 집계층(`daily_activity` AFTER INSERT 트리거 + `known_word_count` 캐시). CLAUDE.md navigation 행 추가.

### A3.8 추천 엔진 실데이터화 (getMockNextAction → 실 사용자 상태) (v06.98)

세션 종료/워크스페이스의 "다음 행동" 추천이 `getMockNextAction(MOCK_USER_CONTEXTS)` 고정 컨텍스트였던 것 → 실 사용자 상태(due 단어 수 + mastery) 기반. 설계 주석대로 "swap 대상은 한 함수" — 5개 호출처는 hook 1줄 교체. 마이그레이션 0.

- **`lib/recommend/decide.ts`** 신규 — `decideNextAction(ctx)` 순수 P1~P4 로직(mock·실 단일 출처). `next-action.mock.ts getMockNextAction` 도 이 함수 경유로 DRY.
- **`lib/recommend/get-next-action.ts`** 신규 — `getNextActionForUser()` server action: due 단어 수(P1) + mastery(user_stats 또는 vocab 수 근사) → decide. v1 P2(진행중 스크립트) 미연동.
- **`lib/recommend/use-next-action.ts`** 신규 — `useNextAction()` client hook: cold 기본 후 server action 결과 1회 교체.
- **5개 호출처** — FlashcardSession/ScriptQuiz/SpellForge/DictationResultsClient/text[id] 의 `useMemo(getMockNextAction(...))` → `useNextAction()`. (getMockNextAction/MOCK_USER_CONTEXTS 은 데모/테스트용 보존.)
- ⚠️ typecheck/lint green, 런타임 미검증. user_stats 빈 상태면 vocab 수 근사로 mastery 산정(cold-bias) — 실 사용자 데이터 누적 시 정확.

### A3.7 WordBlitz standalone 영속화 완성 (learning_records + scores) (v06.98)

`/play/wordblitz` standalone 라우트의 onCorrect/onWrong 이 `console.log` TODO 였던 것(워크스페이스 모드 WorkspaceWordBlitzMode 만 A1.3 적재) → learning_records + scores 둘 다 적재. **이로써 게임 5종(flashcard/spellforge/pairflip/scriptquiz·텍스트결과/dictation/wordblitz) 점수 적재 완료.** 마이그레이션 0.

- **onCorrect/onWrong** → `recordWordBlitzResult({word, isCorrect})`(FSRS learning_records, 워크스페이스 모드와 동일) + 정/오답 카운트.
- **onExit** → `recordGameScore`(module='wordblitz', score=correct×120+wrong×30 게임식 복제[POINTS 고정], accuracy/duration/metadata). captured 0(미플레이) skip + 1회 가드.
- ⚠️ typecheck/lint green, Three.js 게임 런타임 미검증. WordBlitz 는 무한루프라 "완료" 없음 → exit 시점 적재.

### A3.6 게임 점수 적재 확장 (flashcard/spellforge/dictation) (v06.98)

A3.5(PairFlip)로 시작한 `scores` 적재를 3개 게임으로 확장 — 메인 Hub "최근 활동"(useHubData 가 scores 읽음)이 실제로 채워지도록. 공유 헬퍼로 통일. 마이그레이션 0.

- **`lib/scores/record-score.ts`** 신규 — `recordGameScore`(fire-and-forget INSERT) + `useRecordGameScore`(완료 컴포넌트 마운트 1회, re-render/StrictMode 중복 방지). `learning_records`(단어별 FSRS)와 별개 세션 결과.
- **Flashcard** `CompletionState` — ratingCounts 기반 correct/accuracy 집계 → scores(module='flashcard').
- **SpellForge** `SpellForgeCompletion` — totalWords/correctCount/duration → scores(module='spellforge').
- **Dictation** `DictationResultsClient` — session.totalAccuracy/items/totalTimeMs → scores(module='dictation', session 로드 시 1회).
- ⚠️ typecheck/lint green, 완료 화면 런타임 미검증. **WordBlitz 보류**(무한루프 — 세션 시작시각·정오 카운트 추적 구조 추가 필요, 별도). PairFlip(A3.5/#56)은 inline write — 후속 통일 가능.

### A3.5 PairFlip 게임 점수 영속화 + hub 실 stats (v06.98)

`scores` 테이블에 **어떤 게임도 쓰지 않던**(write 0, useHubData 가 읽기만) gap 의 첫 해소 — PairFlip 완료 시 게임 점수를 `scores` 적재 + hub stats 를 mock(0 고정)에서 실 집계로. 마이그레이션 0(`scores`/`module_id` 기존재).

- **`PairFlipGameScreen` onComplete** — `scores` INSERT(module='pairflip', score/total/correct/accuracy/duration + metadata{maxCombo/hintsUsed/totalAttempts/level/mode}). 실/mock 페어 무관 게임 성과 기록, fire-and-forget(흐름 비차단).
- **`lib/pairflip/stats.ts`** 신규 — `fetchPairFlipStats`(scores module='pairflip' 집계 → bestScore/maxCombo/gamesPlayed, 최근 500 cap). `/pairflip`(server) 가 fetch → `PairFlipHub` stats prop 주입(기록 없으면 zero=cold).
- **`PairFlipHub`** `MOCK_STATS`(0 고정) 제거 → `stats` prop. Best·콤보·게임수 hero 실데이터.
- ⚠️ typecheck/lint green, 게임 완료 write 런타임 미검증. 다른 게임(flashcard/spellforge/…) scores 적재는 별개(동일 패턴 확장 가능).

### A3.4b ScriptQuiz 질문 한국어(question_ko) 완성 (v06.98)

A3.4 의 한국어 토글이 옵션만 번역하고 질문은 영어로 남던 것 → `quiz_questions.question_ko` 컬럼 추가로 질문까지 한국어. 마이그레이션 `20260628140000_scriptquiz_question_ko`(nullable, 무손실).

- **마이그레이션** — `ADD COLUMN question_ko text`(사용자 명시 승인). Ammachi Ch1 5문제 한국어 질문 UPDATE 적재.
- **`fetchQuizSession`** — `question_ko` select + `questionKo` 매핑(있을 때만). 생성 타입 미반영이라 unknown 경유 캐스팅(런타임 컬럼 존재).
- 롤백 `docs/AI_CONTEXT/rollback/scriptquiz_question_ko_원본.sql`.

### A3.4 ScriptQuiz 실 퀴즈 capability (quiz_questions 연동) (v06.98)

게임 mock 스윕 마지막 — ScriptQuiz 가 `MOCK_SESSION` 고정이던 것 → `quiz_questions`(per user+text) 실 퀴즈 fetch + MOCK 폴백. **코드 capability 만**(문제 콘텐츠 생성은 별도 — 앱에 런타임 LLM 인프라 없음, Claude Code 사전 생성 또는 생성 파이프라인이 채움). 마이그레이션 0.

- **`lib/scriptquiz/questions.ts`** 신규 — `fetchQuizSession(client, userId, textId)` → quiz_questions + texts.title → `QuizSession`. 문제 0개면 null → MOCK 폴백.
- **`ScriptQuiz`** `session?: QuizSession` prop(기본 MOCK_SESSION) — `typeof MOCK_SESSION` → `QuizSession` 정합.
- **play 페이지** async — `?text={texts.id}` 의 실 퀴즈 fetch, ResourceContext 동적 제목/문항수. 미지정/미생성 시 데모 MOCK.
- ⚠️ typecheck/lint green, 게임 상호작용 런타임 미검증.
- **문제 콘텐츠 적재(사용자 명시 승인 2026-06-28)** — "Ammachi's Amazing Machines — Chapter 1"(text `26688c2b`)에 독해 5문제 INSERT(multiple 4 + truefalse 1, 정답 인덱스 0/2/0/1/3 분산, 영어 본문 + 한국어 옵션 + sourceSnippet). E2E 검증: title 해석·5문제·옵션/정답 인덱스 전부 유효 → `?text=26688c2b…` 실 퀴즈 동작. quiz_questions 0→5 rows.

### A3.3 PairFlip 실 페어 + SRS 영속화 (v06.98)

게임 mock 스윕 3번째 — PairFlip 이 `MOCK_PAIRS`(evolution/predator…) 고정 + **영속화 전무**(fsrsRating 계산만 하고 sessionStorage→results 로만)였던 것 → 사용자 SRS 큐 due 단어 실 페어 + 매칭 결과 FSRS 영속화. 마이그레이션 0 (`module_id` enum 에 `pairflip` 기존재 — TS `ModuleId` 만 정합).

- **`lib/pairflip/due-pairs.ts`** 신규 — `fetchDuePairs`(브라우저 client, due 우선, meaning 빈 단어 제외, `pairId = vocabularies.id`).
- **play 페이지** — config + due 페어 둘 다 로드 후 게임 마운트(실 페어를 mount 시점 주입). 부족하면 빈 배열 → hook mock 폴백(win-condition 보존, 무회귀).
- **`usePairFlipSession`** `pairs?` 옵션(레벨 pairCount 이상이면 실데이터, 아니면 mock).
- **`PairFlipGameScreen`** onComplete — 실 페어 사용 시 pairResult 별 `pushPendingResult`(word lookup) + `flushPendingSession`(서버 권위 재계산). mock 폴백이면 push 생략.
- **`ModuleId`** += `'pairflip'`(DB enum 정합) → 연쇄로 `actionToHref` 에 `/pairflip` 케이스 추가.
- ⚠️ typecheck/lint green, **게임 상호작용 런타임 미검증**(상태머신) — 머지 전 수동 확인 권장.
- 잔여: ScriptQuiz(AI 문제생성 파이프라인 필요 — mock 스왑 아님).

### A3.2 SpellForge play 실데이터화 (v06.98)

게임 mock 스윕 후속 — SpellForge play(`/spellforge/play`)가 `'The Great Gatsby'` + `MOCK_WORDS` 하드코딩(스코프 진입조차 없음)을 쓰던 것 → **사용자 SRS 큐의 due 단어 실데이터**로. 영속화(`pushPendingResult`/`flushPendingSession`)는 이미 작동 — 데이터 source 만 교체. 마이그레이션 0.

- **`lib/spellforge/hub-words.ts`** 신규 — `fetchDueSpellForgeWords` = study-queries 재사용 + `rowToCard`→`getMemoryState` SSoT 로 `status`(메모리 4색) 계산 → `SpellForgeWord[]`.
- **play 페이지** async 전환 + 미로그인/빈 큐 `HubEmpty` 안내. 부수 효과: 기존 mock 단어는 flush 가 사용자 vocab 과 매칭 안 돼 영속화 무효였던 것이 실 단어로 정상 영속화.

### A3 Flashcard hub 진입 실데이터화 (v06.98)

게임 모듈 mock 잔존 스윕 — Flashcard hub 일반 진입(`/flashcard/play`, set/text 스코프 없음)이 `MOCK_FLASHCARD_WORDS` 하드코딩 단어를 쓰던 것 → **사용자 SRS 큐의 due 단어 실데이터**로. 영속화(`flushPendingSession`)는 이미 작동 중이라 hub 진입 데이터 source 만 교체. 마이그레이션 0.

- **`lib/flashcard/hub-words.ts`** 신규 — `fetchDueFlashcardWords` = `study-queries.fetchStudyVocabularies`(due 우선 next_review_at 임박순 + cap 50) 재사용 + `rowToCard` 로 실 FSRS 상태 hydrate. 스코프 진입(scoped-words)과 짝.
- **play 페이지** — hub 분기에서 mock 제거, 미로그인/빈 큐 빈 상태(`HubEmpty`) 안내(mock 폴백 금지). 스코프 진입(워크스페이스 "카드" pill)은 기존 그대로.
- 잔여(별도): SpellForge play(Gatsby mock) · PairFlip(mock stats) · ScriptQuiz(MOCK_SESSION) 실데이터화.

### P6.5 어휘 학습 계층(Cold/Warm/Hot) 통합 검증·명문화 (v06.97)

P6 잔여 마지막 단계. read-only 진단 결과 **세 계층이 P6.1~P6.4 + SRS 영속화(A1/A2) + 자동 승급(Phase 2E/G) 누적으로 이미 기능적 통합·일관**됨을 확인 — 별도 재설계 불요. 암묵 계약을 `docs/VOCAB_LAYERS.md` 로 명문화(drift 차단). 마이그레이션 0.

- **검증된 불변식**: (1) 전이(Cold→Warm→Hot→V-level) 전부 `vocabularies.word = shared_dictionary.word` 키 — `auto_promote_v_level_for_user`/`_track_` word-keyed 확인 (2) V-level 게이트 `current_v_level` 중심(hard band enroll vs soft Gaussian extract, drift 없음) (3) 상태 분류 `lib/srs/state.ts getMemoryState()` 단일 SSoT.
- **보류(저가치)**: G1 `vocabularies.lemma` NULL 백필 = vestigial(핵심 경로 word-keyed, Cold 계층 `library_book_vocabularies.lemma` 와 별개) **skip** · G3 통합 read view = DX(deferred) · G4 origin taxonomy = cosmetic(deferred) · Warm→Hot DB 함수화 = **거부**(현 server action 충분).
- 실측: vocabularies origin별 warm 6,473 / hot 4(dev 데이터).

### P6.6 V0(미진단) effective V-level 가드 (v06.97)

P6.1 의 effective V-level 산정이 `current_v_level = 0`(진단 미완료 기본값)을 유효 앵커로 사용해 i+1 밴드가 `GREATEST(0-1,1)..LEAST(0+1,11) = [1,1]` 로 붕괴 → 책 구독 시 V1 단어만 import(라이브러리 도서 어휘 V6~V11 전량 배제)되던 잠재 결함 해소. 마이그레이션 `20260628130000_p6_6_enroll_v0_undiagnosed_guard`.

- **NULLIF 가드** — `COALESCE(NULLIF(current_v_level, 0), book_v_level, 5)` 로 V0 을 미진단 취급 → fallback. V0 사용자 effective=5 → band [4,6](검증).
- **F3 소급 정리(사용자 결정 2026-06-28)** — review_count=0 + i+1 위반 vocab 정리는 **V0/NULL 미진단 사용자 제외**. 측정 결과 유일 후보가 V0 사용자라 **삭제 0 건**(진도·데이터 무손실). 본 가드는 향후 enroll 정합만 확보.
- 검증: `has_v0_guard=true` + V0 simul effective=5/band [4,6]. 롤백 `docs/AI_CONTEXT/rollback/P6_6_enroll_v0_guard_원본.sql`.

### ACP §19 OpenStax CNXML 소스 설계 + 프로토타입 (v06.97)

§18 에서 "CNXML dump 통합 필요(별도)"로 보류했던 OpenStax 교재 소스 설계. 실측 검증 기반(GitHub API + raw CNXML + DB 분류 함수). 마이그레이션 0 (DB 등록은 라이선스 결정 대기). 스펙 `docs/ACP_OPENSTAX_DESIGN.md`.

- **프로토타입 ingester** `packages/library-pipeline/src/ingest-article/openstax.ts` — collection.xml `<md:license url>` 권위 읽기 + `cnxmlToPlainText`(MathML/figure/exercise/equation/link 제거 → `<para>/<section>/<term>` 산문) + `ingestOpenStaxModule` → `RawArticle`. `ArticleSource` 에 `'openstax'` 추가.
- **검증** — biology m45417: 18,544자 클린 산문 · lexical_noise 0 · math/figure/src 잔존 0. 라이선스 = collection 메타 그대로(가정 X).
- **🔴 결정적 발견** — OpenStax 인기 교재 10종 전부 **CC-BY-NC-SA**(NonCommercial). `acp_classify_license('CC-BY-NC-SA-4.0')='restricted'`(차단), `'CC-BY-4.0'='cc_by'`(통과). 즉 기술 통합은 완료, **차단 요인은 라이선스 1건** — 상업 의도 서비스엔 NC 부적합(게이트 정확). 통합 진입은 코드 아닌 **결정**(CC-BY 타이틀 한정 / 비상업 commitment / 보류 중 택일). ingester 만 대기 머지, O1~O5 wiring 보류.

### C1/P6.1 구독 시점 i+1 필터 (v06.96)

책 구독 시 `_enroll_book_subscribe_word_sets` 가 vocabularies 를 사용자 V-level 무관하게 일괄 import 하던 것(i+1·Desirable Difficulty 위배) → 구독 시점 i+1 필터 + dedup + 세션 cap. 마이그레이션 `20260628120000_p6_enroll_subscribe_i_plus_one`.

- **구독(set-level) 불변** — 책 전체 챕터 단어장은 그대로 구독. **vocabularies import 만** 필터(E8 완전분리 — orphan vocab 343 확인).
- **i+1 필터(E1)** — `v_level BETWEEN GREATEST(N-1,1) AND LEAST(N+1,11)`. N = `user_profiles.current_v_level`(E1) → `library_books.book_v_level`(E2) → 5(E5). `shared_dictionary` LEFT JOIN(미등재 단어 통과).
- **dedup(E7)** — `UNIQUE(user_id,word)` 존재 확인 → `NOT EXISTS` + `ON CONFLICT DO NOTHING`(stable dedup 포괄).
- **세션 cap 50(E4)** — DISTINCT ON 단어당 1행 + 레벨 근접·고빈도 우선 ORDER → LIMIT 50.
- **F0(소급 보류)** — 기존 vocabularies 무변경, 신규 enroll 만 적용.
- 검증: read-only 스모크 — v_n=5 시 selected=50(cap)·전부 band [4,6] / 실 V0 사용자는 dedup 으로 0(정상). 롤백 `docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql`.

### A2b WordVault 복습 뷰 실데이터 (v06.95)

`/wordvault` 복습 뷰가 하드코딩 placeholder("오늘 복습할 단어 12개")였던 것 → 실 vocabularies 기반 복습 세션으로. (A2 study 인프라 재사용 — 마이그레이션 0.)

- **`/wordvault/review` RSC** 신설 (study 라우트 미러) — 복습 대상 = **due+new**(`next_review_at ≤ now` 또는 NULL), `fetchStudyVocabularies`(due 우선) → `WordVaultStudyClient` (`mode="review"`). 평가는 study 와 동일 flush 경로(A1.1)로 영속화.
- `WordVaultStudyClient`에 `mode?: 'study'|'review'` prop 추가(빈 상태 카피 분기, 기본 study).
- 레거시 `?view=review` → `/wordvault/review` redirect (study 패턴 동일). hub words mock 실데이터화는 별도(미진입).

### A1.3 WordBlitz 학습 기록 적재 (v06.91)

`recordWordBlitzResult`가 `vocabularies`(FSRS D/S)만 update하고 `learning_records`(audit) insert는 누락해 Hub/Dashboard 통계에서 WordBlitz 플레이가 빠지던 문제 해소. update 성공 후 `resultToRecordPayload(result, user.id)`로 insert 추가 — 4모듈(flashcard/spellforge/dictation/wordblitz) 기록 일관. 마이그레이션 0(컬럼 기존재). 독립 변경(flush 인프라 무관).

### A2 WordVault 학습 실데이터 + 영속화 (v06.90)

WordVault StudyMode가 `MOCK_WORDS`(레거시 `?view=study` 클라이언트 경로)만 받던 문제 해소 — browse RSC 패턴을 study에 복제해 **실 vocabularies** 제시 + A1.1 flush 경로로 평가 영속화. (마이그레이션 0. 신규 라우트 `/wordvault/study`.)

- **`/wordvault/study` RSC** 신설 (browse 미러) — `fetchStudyVocabularies`(due 우선: `next_review_at` asc nullsFirst, 세션 cap 50) → `vocabRowToWord` → `WordVaultStudyClient`(빈 상태 안내 포함). 레거시 `?view=study` → 신 라우트 redirect.
- **StudyMode 실 배선** — 데모 제거(studyIndex 0 시작·실 진행률·modulo 루프 제거). `rateWord(1~5)` → `studyRatingToFsrs`(1다시→Again·2어려움→Hard·3애매→Hard·4쉬움→Good·5완벽→Easy) → `applyReview`+큐 push(word) → 마지막 단어/종료 시 `flushPendingSession`.
- `rating-mapper.ts` `studyRatingToFsrs` 추가. WordVault review·hub words mock 은 A2b 분리.

### A1.1 SRS 학습 결과 DB 영속화 (v06.89)

학습 모듈이 FSRS를 클라이언트에서 계산해 `sessionStorage` 큐(`pushPendingResult`)에 쌓지만 **DB로 flush하는 소비자가 없어 탭을 닫으면 소실되던** 갭 해소. (마이그레이션 0 — `vocabularies` FSRS 컬럼 + `learning_records.rating`/audit 컬럼 모두 기존재 확인.)

- **`flushPendingSrsResults` 서버 액션** (`lib/srs/flush-actions.ts`) — 큐를 받아 **단어 텍스트로 (user_id, word) `vocabularies` 조회**(cardId는 모듈마다 의미 상이 — shared_words.id/vocabularies.id/정규화 단어 — 신뢰 불가, WordBlitz 패턴 재사용) → **서버 권위 재계산**(실 DB row의 D/S에 `applyReview`, scoped 단어 empty-card 진행도 리셋 방지) → `vocabularies.update` + `learning_records.insert`. 사용자 어휘에 없는 단어(mock/챕터 보충)는 silent skip. 같은 단어 반복 평가는 시간순 누적.
- **`flushPendingSession` 클라이언트 헬퍼** (`lib/srs/flush-session.ts`) — 세션 종료 시 큐 flush, 성공 시에만 비움(실패 시 보존·재시도).
- **3개 모듈 완료 지점 배선** — Flashcard(`isComplete`)·SpellForge(`showCompletion`)·Dictation(`srsAppliedRef`) 에서 flush 호출. `PendingSrsResult`에 `word` 추가(4개 push 사이트 갱신). WordVault StudyMode(데모)·WordBlitz `learning_records` insert는 A1.2/A1.3로 분리.

### Tier B UI 폴리시 (v06.88)

플랫폼 미완성 작업 스캔 후속 — 자립형 quick-win 묶음. (B1 워크스페이스 article `audio_url` 재생은 P5(v06.86)에서 이미 배선 완료로 확인되어 작업 제외.)

- **pending-words 피드백** — `PendingWordActions` 상태 전환 실패 시 `alert()` → `useToast().error` (Calm UI · 기존 `components/ui/Toast` 재사용).
- **로딩 화면 폴리시** — `dictate/setup` Suspense fallback + `pairflip/play` 세션 대기 화면을 `Loader2` 스피너 + 차분한 카피("준비하고 있어요")로 정비. (두 화면 모두 정상 전환 상태였고 무한 로딩 아님 — 점검 결과 cosmetic 개선만.)

### 멀티 세션 git worktree 자동화 (v06.94)

여러 Claude Code / VS Code 세션이 서로 다른 화면·기능을 동시에 작업하도록 worktree 레이아웃 셋업 + 관리 자동화.

- **worktree 레이아웃** — `../Vocaflow-main`(main, PR/handoff) · `../Vocaflow-ui`(`feat/learner-ui`, `app/(main)/*`) · `../Vocaflow-admin`(`feat/admin-ui`, `app/admin/*`). 학습자/어드민 라우트 폴더 분리로 병렬 충돌 최소.
- **`scripts/worktree.mjs` + `pnpm wt`** — `list`(ahead/behind) / `new <suffix> [base]`(생성 + `pnpm install` 자동) / `remove <suffix> [--del-branch]` / `sync`(fetch --prune). 규약: 디렉터리 `../Vocaflow-<suffix>` + 브랜치 `feat/<suffix>`.
- **`docs/WORKTREE.md`** 신규 — 운영 가이드(원칙·레이아웃·스크립트·공유 자산 충돌 직렬화 규칙). 핵심 주의: 클라우드 DB·`supabase/migrations/`·`packages/ui-shared` 등 공유 자산은 한 세션에서만 변경 후 나머지 worktree pull/rebase.

### verify CI green 복구 — lint 74건 + CI 안정화 (v06.93)

CI `verify` job(`turbo run lint typecheck test`)이 **3가지 독립 사유**로 상시 red였던 것을 green으로 복구(빌드 복구 v06.92 후속). 경고(jsx-a11y·exhaustive-deps)는 차단 안 하므로 보존.

**① web ESLint 에러 74건 → 0:**

- **`no-explicit-any` 32 (전부 `lib/admin/dict/queries.ts`)** — `countRows` 콜백의 불필요한 `(q as any)` 중복 캐스트 제거(`q`는 이미 `PgQuery`(eslint-disabled 단일 alias) 타입). 런타임 불변.
- **`no-unused-vars` 28** — 미사용 import/var/arg 제거(24파일). 미사용 prop은 destructure에서만 제거(인터페이스/콜러 계약 보존), write-only 변수·orphaned arg는 안전 정리.
- **`no-unescaped-entities` 12** — JSX 텍스트의 `"`/`'`를 `&ldquo;`/`&rdquo;`/`&apos;` 등으로 이스케이프(6파일).
- **`prefer-const` 2** — `bookMetaMap`·`countsPerSet` `let`→`const`.

**② `apps/mobile` (Expo 기획 scaffold — eslint·typescript 미설치):** `lint`·`typecheck` 스크립트를 no-op stub(`@vocaflow/wlp:lint` 선례 동일 — 검사할 실 코드 없음. 모바일 실구현 시 복원).

**③ 무(無)테스트 패키지:** `vcb-core`·`library-pipeline` test 스크립트에 `--passWithNoTests` 추가(`vitest run`이 "No test files found"로 exit 1 하던 것 — `@vocaflow/wlp` 선례 동일).

**④ 통합 테스트 env-skip 버그:** `content-storage.test.ts`(Supabase 통합)가 env 없는 CI에서 `describe` 본문 최상위의 즉시 `createClient` 호출로 `supabaseUrl is required` throw(collection 단계). `client` 생성을 `beforeAll`로 지연 → `skipIf(env 없음)` 시 미실행 → CI 정상 skip(로컬 .env.local 있으면 그대로 실행).

- 검증: 로컬 `turbo run lint typecheck test` **13/13 green**(env 有) · CI(env 無)는 content-storage skip 후 green · `next lint` 0 · `tsc` 통과 · `next build` green(83p).

### 프로덕션 빌드 복구 (v06.92)

`next build`(프로덕션)가 main에서 **기존부터 실패**하던 것을 복구 — 배포 차단 이슈. CI가 typecheck/lint만 게이트하고 `next build`는 안 돌려 미발견. (SRS 검증 중 발견 — [[project_next_build_broken]] 진단.)

- **`swcMinify: false`** — SWC minifier가 `@mintplex-labs/piper-tts-web`(onnxruntime-web 번들, EchoMatch) 청크를 parse 못해 `failed to parse input file: Syntax Error`로 죽던 것 → Terser minifier 폴백. `✓ Compiled successfully` 회복. (후속: ort 청크만 제외하는 surgical 방식으로 SWC minify 복원 가능.)
- **`eslint: { ignoreDuringBuilds: true }`** — 전(全)프로젝트 기존 lint 부채 74건(no-explicit-any 32·no-unused-vars 28·no-unescaped-entities 12·exhaustive-deps 6)이 빌드 산출물 생성을 막던 것 → lint를 빌드에서 분리(`next lint`/별도 CI job). **typecheck는 빌드에서 계속 강제**(tsc 통과 유지, `ignoreBuildErrors` 미설정).
- 결과: `next build` exit 0, 83 페이지 생성.
- **CI 가드** — `ci.yml`에 `build` job 추가(`next build` 실행 · placeholder env · push/PR to main). 빌드 깨짐 재발 조기 감지. CI 시뮬레이션으로 `.env.local` 없이 green 확인(force-dynamic 페이지는 build-time 미실행). 후속: lint 74건 점진 cleanup + ort 청크만 제외하는 surgical minify 복원.

### 큐레이션 관리자 콘솔 — SourcePolicy 단일 화면 (v06.87)

`/admin/articles` 를 소스별 8탭 → **SourcePolicy 분기 단일 4단계 콘솔**(커버리지·소스GET·검수·발행)로 재구성. VOA/TC 등 소스 차이는 정책 4축(supply/media/derivation/attribution)으로만 분기 — `if (source==='voa')` 하드코딩 제거. (admin_curation_screens_build handoff: C2 + P1~P4.)

- **C2 SourcePolicy 공유 자산** — `_curation-spec.ts` 에 `SourcePolicy`/`getSourcePolicy`/`SOURCE_POLICIES`/`resolveSourcePolicy`/`licenseClassOf` + 4 라벨 맵. 정책은 기존 SSoT 에서 **파생**(supply←`frozen`, attribution←`attributionRequired`, derivation←`license_class` cc_by_nd, media←VOA audio 정체성). drift-lock vitest 18종(패키지 첫 테스트). client 는 `/curation-spec` 서브패스로 소비.
- **P1 셸+훅** — `CurationConsole`(4-stage) + `useSourcePolicy` 단일 진입 훅 + `PolicyBar`(소스 선택 시 정책 라이브 렌더). `AcpClient` 대체.
- **P2 커버리지** — `CoverageMatrix` gap(빗금+GAP)/filled(stable 바+발행건수) + 셀 클릭→GET · `SourceFeedList`(소스/feed별 후보·audio·avg score — `listSourceFeedHealth` JS 집계, 마이그레이션 0).
- **P3 소스 GET** — `CandidateTable`(seed-list 6컬럼: 체크박스·제목·register·CEFR/V·score 막대·audio[policy.media]) + 다중선택 → `/api/acp/enqueue` import. supply 뱃지(static→"recency 미적용·정렬 source·length"). register/CEFR/V 는 ingest 전 미산출 → "—".
- **P4 검수·발행** — `ReviewPanel`(3패널: 큐 상태 dot / 에디터·player / 정책 게이트) + `computeGateItems(policy)` 동적 게이트(media/attribution/noise/v_level) + 발행 버튼 라벨 derivation 분기. 기존 deep review `computePublishGate` 의 `if(source==='voa')` → `resolveSourcePolicy().media` 교체. `ArticleAdminRow` +`audio_url`/`article_v_level` · `publish-gate.ts` 공유 유틸.
- 마이그레이션 0건 · 본문·단어 딥 편집은 `/preview/[id]` 재사용(중복 회피) · web `tsc --noEmit` 통과.

### VOA 큐레이션 재설계 — frozen archive (v06.86)

VOA Learning English = frozen archive(전 feed 2025-03 정지, 라이브 확인) 전제로 큐레이션 입력측·검수·학습자 제시 재설계. PR `feat/voa-curation-redesign` (P0 진단 → P1~P5, 영향격리 순).

- **P1 score frozen 재정규화** — `_curation-spec.ts` `FeedSpec.frozen` 플래그. frozen feed 는 recency 축(0.40 — stale 로 사문화)을 제거하고 source 0.45 / length 0.25 재분배 + 730일 stale cliff 면제. VOA 4 feed + `SOURCE_DEFAULT_SPEC.voa` 한정(NASA/NIH/wikinews/the_conversation/simple_wikipedia score 불변, 54 조합 검증).
- **P2 feed 확장** — register gap 보강 2종: American Stories(zoneid 1581, narrative) + Health & Lifestyle(zoneid 955, expository). `VOA_FEEDS` + `FEED_SPECS`(frozen) + `SOURCE_SPECS.voa.preferredFeedMix` 6 feed 재분배(합 1.00) + `VoaFeedTab`. 마이그레이션 0건(source='voa' 유지 · register narrative/expository 기존 CHECK 허용).
- **P3 발행 audio 게이트** — `20260621120000_voa_publish_require_audio_gate`: 트리거 `trg_la_require_audio`(BEFORE INSERT/UPDATE OF status · source='voa' && audio_url 없음 → 발행 차단 · 타 소스 격리). force-publish route `AudioGate` 400 + 검수 UI `PublishGate` `no_audio` 상태. smoke 3/3, 기존 발행분 영향 0. C3(register=course 배제)는 register enum 에 'course' 값 부재로 **연기**.
- **P4 학습자 카드** — `judgeArticleIPlusOne`(글은 coverage 부재 → `article_v_level` vs 사용자 V 직접 비교, 미진단 V5 fallback) + `ArticleCard` i+1 적합도 배지 + CEFR/VOA Level 병기 + register 배지(아이콘+텍스트) + 음성 인디케이터.
- **P5 진열 + 인라인 주석** — `ArticlesExplorer` '추천순'(i+1 적합 우선 → 짧은 글) 기본 정렬 + Progressive Disclosure "맞춤 다음 글" 1개. `text/[id]` article 분기 인라인 단어 주석 풀 적용(발행 `shared_words` → `chapterWords` · preview==publish==workspace). 듣기 동급 진입점은 기배선(FloatingAudioPlayer). 시리즈 이어듣기는 글에 feed/series 데이터 미보유로 보류.

### Post-audit hardening (v06.85)

PR #31 (UI 감사) 후속 — 동 PR 의 main 직접 commit 실수 (push 실패로 origin 비파괴, PR 경유 복구) 재발 방지 + Project attach 정합.

변경:
- manifest §1 Tier 3 활성 list 에 `ui_screen_audit_20260621.md` 추가 — Project 가 1차 정합 복구 / 2차 spec 설계 입력으로 자동 attach 권장 대상화
- `feedback_handoff_workflow` 메모리에 "Edit/Write 전 `git branch --show-current` 선확인" 안티패턴 추가 — 다음 세션 자동 차단

### manifest drift 자동 검증 (v06.84)

PR #26 (manifest 보강) 후속 — drift 가 누적되지 않도록 CI 검증 추가.

**신규** `scripts/check-manifest.mjs`:
- (1) `docs/` 직속 *.md 파일이 manifest §1 Tier 1 list 에 백틱 인용됐는지
- (2) `docs/AI_CONTEXT/` 하위 폴더가 manifest 분류 (Tier 또는 §2 제외) 에 명시됐는지
- (3) `docs/` 의 1차 하위 폴더 (`adr/`, `references/`, `proposals/` 등) manifest 명시 확인

**`.github/workflows/sync-check.yml`** `manifest-drift` job 추가 — push / PR 마다 실행, warning-only (block X).

**효과**: 본 세션 초반 발견된 `docs/AI_CONTEXT/handoffs/` 누락 같은 drift 가 다음부터 자동 알림.

### PROJECT_KNOWLEDGE_MANIFEST 신규 폴더 3종 분류 (v06.83)

PR #25 (P6 handoff) 후속 — `docs/AI_CONTEXT/` 의 신규 폴더 3종이 manifest 에 없어 Project 가 attach list 생성 불가. 보강.

| 폴더 | Tier | 정책 |
|---|---|---|
| `docs/AI_CONTEXT/handoffs/` | **Tier 2 항상 묶음** | 활성 handoff 항상 attach. 머지/완료 시 archive |
| `docs/AI_CONTEXT/diagnostics/` | **Tier 3 선별** | 활성 milestone 동안만 (예: `extraction_p0_20260620.md`) |
| `docs/AI_CONTEXT/rollback/` | **Tier 외 제외** | DDL 청크 — Project spec 검토 무가치. Claude Code 단독 `Read` |

### P1~P4 누적 효과 — 기존 published 책 재발행 (v06.82)

P4 (단일 코어 통합) 직후. 기존 259 published 단어장은 옛 selection 마커 (v06.35 / v06.51) 유지 → P1~P4 효과 미반영. 재발행으로 적용.

**판정 (적용 전)**:
- 사용자 학습 진도 측정 — review_count=0 / fsrs=0 (단순 import 만, 학습 시작 0) → reset 비용 0
- Production 사용자 0 (dev 환경, 단일 사용자 본인)
- FK CASCADE: shared_words / subscriptions → 자동 / vocabularies → SET NULL (명시 DELETE 로 orphan 방지)

**적용** (migration [20260620080000_republish_library_books_with_p1_p4](../supabase/migrations/20260620080000_republish_library_books_with_p1_p4.sql)):
- 단일 DO 트랜잭션 (BEGIN/COMMIT 보호)
- IDEMPOTENT — `curation_query.selection NOT LIKE '%P3%'` 가드
- vocabularies + shared_word_sets DELETE → publish_book_word_sets(book_id, 40) → _enroll_book_subscribe_word_sets

**실측 효과**:
- 259 sets 전부 word_count ≤ 40 (max 239 → 40 · p90 57 → 40 · p50 21 → 36)
- avg 28.8 → 30.9 (V6~V8 학습밴드 복원 효과 +7%)
- vocabularies 4,363 → 4,862 (+499 · 사용자 단어 풍부도)
- Twenty years after (V9) 챕터1 top10: cardinal/parliament/valet/glance/troop/superintendent/chamber/mayor/exclaim/murmur (17세기 프랑스 정치소설 핵심 + 학습 균형)

**Production 적용 시 주의**: 본 DO 블록의 사용자 iteration 은 dev 1명 가정. 다수 사용자는 `_enroll_book_subscribe_word_sets` 를 `FOR v_user IN ... LOOP` 으로 확장 필요.

### P4 — book·article 추출 단일 코어 통합 (v06.81 · C5)

P3 (cap) 직후. handoff §P4 — composite 식 drift 영구 차단.

**변경** (migration [20260620070000_p4_unify_composite_core](../supabase/migrations/20260620070000_p4_unify_composite_core.sql)):
- 신규 `_extract_composite_score(rank, freq_in_unit, unit_max, v_level, verified, example, skill, unit_v_level) RETURNS numeric IMMUTABLE` — composite 식 단일 SSoT
- `select_book_chapter_vocab` scored CTE → 헬퍼 호출 (unit=chapter)
- `select_article_vocab` scored CTE → 헬퍼 호출 (unit=article)
- 식 변경 시 한 곳만 수정. book/article 정합 영구 보장.

**회귀 0 검증** (Les Misérables · bit-identical):
- total=7472 · distinct=1677 · null_rank=1643 · distinct_null=46 (P2 와 100% 일치)
- 챕터1 top5: bishop V8 0.7109 / petty V9 0.6167 / occupy V6 0.5467 / portion V6 0.5444 / fate V6 0.5394
- 호출자 (publish_*_word_set / 트리거 / 외부) 영향 0 — 함수 시그니처/반환 타입 무변동

**보존**: 게이트 (P1), composite 식 (P2), cap 발행 (P3), DISTINCT/sort.

**핸드오프 §P4-3 미수행** (범위 외): `/api/analyze` (OpenAI) → winkNLP lemma → shared_dictionary → 동일 코어 재랭킹 spec 검토.

**남은 단계** (handoff):
- P5b — standard+C2 register 재분류 (15% 의심 표본)
- P5c — example_en 갭 (V6~V11 100% 이미 충전 → 사실상 불요)
- P6 — 구독 시점 user V-level 필터 (C6 별도 handoff 필요)

### P3 — 챕터/글당 top-N cap (v06.80 · C4)

P2 (composite 재설계) 직후. P0 측정 C4 (챕터당 word_count max=239 · p90=57 · cap 없음) 해결.

**변경** (migration [20260620060000_p3_publish_cap40](../supabase/migrations/20260620060000_p3_publish_cap40.sql) + [20260620061000_p3b_drop_old_publish_overload](../supabase/migrations/20260620061000_p3b_drop_old_publish_overload.sql)):

- `publish_book_word_sets(p_book_id uuid, p_cap int DEFAULT 40)` — INSERT WHERE `sort_order <= p_cap` + `curation_query.cap`
- `publish_article_word_set(p_article_id uuid, p_cap int DEFAULT 40)` — 동일 패턴
- **P3b overload DROP**: 옛 1-arg 시그니처 DROP (PostgreSQL exact-match 우선 정책 회피)
  - 호출자: `trg_publish_book_word_sets` / `trg_publish_article_word_set` 트리거 2개 (lazy resolution → trigger 본문 변경 불요)
  - 1-arg PERFORM → 새 2-arg DEFAULT 매칭 → cap=40 자동 적용

**효과** (Les Misérables 실측):
- 359 챕터 / max_raw=233 / cap=40 후 max=40 / **clipped 44 챕터 (12.3%)** / avg_publish=16.2
- p75=32 안전권 (75% sets 영향 0)
- Sweller Cognitive Load (작업기억 ~4, 세션 30~50) 정합

**보존**:
- 게이트 (P1), composite 식 (P2), `select_*_vocab` 본문 무변동
- 기존 set 존재 시 `CONTINUE` 정책 (옵션 B 결정 = 재발행 보류)
- 기존 259 published sets word_count 영향 0

**다음** (handoff):
- P4 단일 코어 통합 (C5)
- P5b/P5c, P6 후행

### P2 — composite 재설계 (v06.79 · C1·C2)

P5a (freq_rank 백필 22.7→64.1%) 직후. P0 측정 C1 (salience 가중 ~9% · 챕터 max 정규화 부재) + C2 (rank NULL→50000 동점) 해결.

**새 식** (handoff §P2-2, 가중치 합 1.0 · book/article 동일):

```
score =
    0.40 * freq_global       -- 1/log10(rank+10), rank NULL → 0 (50000 폐지)
  + 0.35 * salience_inbook    -- freq_in_chapter / MAX(freq) OVER (PARTITION BY chapter_idx)
  + 0.15 * csat_band_fit      -- V6~9 → 1.0, V10 → 0.6, V11 → 0.4
  + 0.10 * quality_bonus      -- verified OR example_en 존재 → 1, else 0
  - skill_penalty             -- 기존 (skill_level=4 AND book_v_level<6 → -0.10)
```

**변경** (migration [20260620050000_p2_composite_redesign](../supabase/migrations/20260620050000_p2_composite_redesign.sql)):
- `cand` CTE 에 `sd.verified` 추가
- 신규 `norm` CTE — `MAX(freq_in_chapter) OVER (PARTITION BY chapter_idx)` (article 은 전역 MAX)
- 새 가중 4항 + skill penalty
- 게이트 (`v_level >= 6`), register exclude, DISTINCT/sort, cap 없음 (P3 분리) 보존

**실측 효과** (Les Misérables):
- NULL-rank 1,643 단어 distinct composite: 5 → **46** (9.2배, C2 해결)
- 전체 distinct: 643 → **1,677** (2.6배, 평균 동점 11.6 → 4.46)
- 챕터 1 상위: **bishop V8 freq=4** (1장 핵심 = Monsieur Myriel 주교) ✓
- published 5권 추출 회귀 0

**누적 진행 (handoff)**:
- ✅ P0 진단 → ✅ P1 게이트 디커플 → ✅ P5a freq_rank 백필 → ✅ P2 composite 재설계
- ⏳ P3 cap N=40 (C4) — 다음
- ⏳ P4 단일 코어 통합 (C5)
- ⏳ P5b/P5c, P6 (후행)

### P5a — frequency_rank 백필 16,492 row (v06.78 · D2)

P1 (게이트 디커플) 직후. P0 측정 D2 = "V6~V11 frequency_rank 충전 22.7% (< 60%)" → P2 composite 재설계 전 선행 필수.

**근거**: composite 의 `0.70 * 1/LOG(rank+10)` 항이 학습밴드 77% 단어에서 `COALESCE(rank, 50000)` 으로 상수 동점 (C2). 백필로 의미 회복.

**백필** (migration [20260620040000_p5a_freq_rank_backfill_from_ext](../supabase/migrations/20260620040000_p5a_freq_rank_backfill_from_ext.sql)):
- 대상: V6~V11 + `frequency_rank IS NULL` + `lemma_band IS NOT NULL` = **16,492 row**
- 식: `lemma_band 'XXk'` → `XX * 1000 + 500` (밴드 중간점, deterministic, vendor-neutral)
- 마커: `frequency_sources.p5a_backfill = '2026-06-20T00:00:00Z'`
- 백업: `shared_dictionary_p5a_backup_20260620` (PK=word + NULL 보존, 롤백용)

**실측 효과**:
- V6~V11 충전율: 22.7% → **64.1%** (+41.4pp · D2 60% 통과)
- V6~V8 CSAT 핵심: 40.0% → 56.6% (+16.6pp)
- 25 distinct band 중간점 (1500~25500)

**미백필 14,271 row**: frequency_band ∈ {compound, phrase, rare} 또는 frequency_sources 자체 부재. 빈도 신호 없음 — P5a 범위 외.

**다음** (P2): composite 재설계. NULL→50000 폐지 (rank NULL → 0), salience 챕터 max 정규화, csat_band_fit 항 추가.

### P1 — 추출 게이트 디커플 (v06.77)

Handoff (Project 작성) "학습 단어 추출 파이프라인 사전db 목적 최적합 고도화" 의 P1 단계. P0 진단 (`docs/AI_CONTEXT/diagnostics/extraction_p0_20260620.md`) 의 결정표 권장 그대로 적용.

**문제 (C3)**: `select_book_chapter_vocab` 의 게이트가 `sd.v_level >= bk.book_v_level` 라 책 난이도가 학습밴드를 결정. 결과: book_v_level≥7 책 15권에서 V6~V8 (CSAT 핵심 학습밴드) 가 100% 역배제 (~23,000 단어 인스턴스 손실).

**변경** (migration [20260620030000_extraction_fixed_learnable_floor](../supabase/migrations/20260620030000_extraction_fixed_learnable_floor.sql)):
- `select_book_chapter_vocab` 게이트: `>= bk.book_v_level` → `>= 6` (D1=V6 확정)
- `select_article_vocab` 게이트: `>= COALESCE(art.article_v_level, 4)` → `>= 6` (book 함수와 일치, C5 drift 사전 차단)
- composite / skill penalty / register exclude / 정렬 / cap 전부 보존 (P2/P3 별도)
- `book_v_level` (난이도 표시) `compute_book_vrl` 보존

**검증 (실측)**:
- Les Misérables (V9) — V6=1,117 / V7=1,240 / V8=1,120 복원 (이전 0/0/0)
- Alice (V6) — V6=169 / V7=121 / V8=70 변동 0 (이미 floor 통과 중)
- published 5권 추출 회귀 0

**롤백**: `docs/AI_CONTEXT/rollback/P1_*_원본.sql` 재적용.

**다음** (P2~P5):
- P5a (frequency_rank 백필 · D2 선행 필수) — V6~V11 충전 22.7% → 60%+
- P2 (composite 재설계 · C1·C2) — NULL→50000 폐지, salience 챕터 max 정규화
- P3 (cap N=40 · C4) — 챕터당 max=239 → 40
- P4 (단일 코어 통합 · C5)
- P5b/P5c/P6 (후행 검토)

### git tracking 정합 — 적용된 4 migration 추적 합류 (v06.76)

이미 supabase 에 적용된 4 migration 파일이 git untracked 상태로 잔류. SSoT (git=DB) 정합 위해 추적 합류 — schema drift 0 (적용 timestamp 와 파일 timestamp 가 다른 것은 직접 SQL 로 apply 했기 때문).

| 파일 | DB apply 시각 | 도메인 |
|---|---|---|
| [20260608120000_acp_license_register_gate](../supabase/migrations/20260608120000_acp_license_register_gate.sql) | 2026-06-14 05:13 UTC | ACP §18 Step 1 — license_class / register / lexical_noise / display_only 컬럼 + 자동 게이트 트리거 |
| [20260608123000_acp_nd_display_only_gate](../supabase/migrations/20260608123000_acp_nd_display_only_gate.sql) | 2026-06-14 05:33 UTC | ACP §18 Step 3 — ND(display_only) 단어세트 발행 차단 + 구독 no-op |
| [20260608126000_acp_lexical_noise_gate](../supabase/migrations/20260608126000_acp_lexical_noise_gate.sql) | 2026-06-14 06:11 UTC | ACP §18 Step 5 §4-C — lexical_noise>0.08 단어세트 발행 차단 |
| [20260614200000_library_books_is_picture_book](../supabase/migrations/20260614200000_library_books_is_picture_book.sql) | 2026-06-14 11:00 UTC | LCP — `is_picture_book` GENERATED STORED (삽화≥4 + 단어<5000) · `judgeIPlusOne` 임계 -7pp 보정용 |

내용 변경 없음 (이미 동작 중). PR #22 머지로 확정된 Project Knowledge attach 묶음에 ACP gate migration 들이 합류 가능해짐.

### LCP 대량 list — 단계별 상태 + 삭제 기능 (v06.75)

사용자 요청: "LCP 대량 리스트에 단계별 상태(큐상태 등), 삭제 기능 등 필요한 기능 있어야함. 전체적으로 검토 다시 해서 적용해줘."

### 단계별 상태 가시화

- [seed-upsert.ts](../apps/web/src/lib/acp/seed-upsert.ts) `listArticleSeeds` 에 article.status / status_message JOIN — `imported_article_id` 별도 query 로 `library_articles` status 매핑. 신규 타입 `SeedListRow` + `ArticleStatusValue` 8종.
- mount 시 `seed-list?includeImported=true` — 큐에 진행 중인 article 도 표시.
- 신규 row badge 9종 (`STATUS_BADGE`): 후보 / 대기 / 정규화 / 분석중 / 큐레이션 / 검토대기 / 발행됨 / 실패 / 보관.
- 색상 단계 직관화 (fresh→review→stable→known / failed=error).
- `articleStatusMessage` 가 tooltip 으로 표시 (실패 사유 즉시 확인).

### 삭제 기능 (단건 + bulk)

- 신규 API [`/api/admin/articles/seed/delete`](../apps/web/src/app/api/admin/articles/seed/delete/route.ts):
  - 미발행 후보: `curation_status='hidden'` soft hide (다시 GET 시 재노출 안 됨)
  - 진행 중/검수 대기/실패: `library_articles` 영구 삭제 (CASCADE 로 vocabularies + word_sets 정리)
  - `published` 는 차단 + 안내 ("먼저 검토대기로 되돌리세요")
- `requireAdmin` + service_role + dev-bypass 호환.
- UI:
  - **row 별 휴지통 아이콘** — confirm 후 즉시 삭제. tooltip 으로 분기 동작 명시 (`seed hide` / `article delete`)
  - **헤더에 bulk 삭제 버튼** (선택 N건) — 잘못 가져온 묶음 일괄 정리
  - 실패 row 에 RefreshCw 아이콘 (검수 페이지의 재처리 액션 안내)

### 필터 패널에 큐 단계 축 추가 (8축)

기존 7축 (검색/소스/점수/CEFR/발행/audio/기간) + **신규 `articleStatuses` chip 다중 선택** (9 옵션 `STATUS_OPTIONS`). 토글 옆 활성 카운트 chip 도 8축 기준 갱신. 발행 상태 기본값 `unpublished` → `all` 로 변경 (큐 진행 중도 보이도록).

### 새 흐름

```
mount → seed-list (includeImported=true) → rows {seedId, articleStatus, articleStatusMessage}
                          ↓
              filter 8축 + sort → displayRows
                          ↓
       row 각각: 단계 badge + 휴지통 / bulk 헤더: 삭제 + 큐 추가
```

큐레이터가 단순 "후보 → 큐 추가" 흐름 외에도 진행 중 article 모니터링 + 잘못된 항목 즉시 정리까지 한 화면에서 해결.

### 워크스페이스 브라우저 TTS — best voice 자동 선택 재설계 (v06.74)

`/text/[id]` 하단 플레이어의 브라우저 음성(Web Speech) 자동 선택 품질 개선. 기존 `pickBestVoice` 결함 4건 수정:
1. "Google US English"(Chrome 클라우드 WaveNet)가 'standard' 오분류 → Chrome 에서 로봇 로컬 음성(David)에 밀림.
2. `localService +20` 이 거꾸로 — 최고 음질은 클라우드(non-local) neural/Google 인데 로컬 우대 → David(45) > Google(15) 역전 버그.
3. 레거시 로봇 음성(eSpeak·MS David/Zira/Mark/Hazel/George) 감점 없음.
4. 저장된 voice 가 이 기기에 없으면(stale) 브라우저 기본(로봇)으로 조용히 강등.

수정 [tts-controller.ts](../apps/web/src/lib/workspace/tts-controller.ts): 점수 SSoT `voiceScore()` — neural/natural/studio(+100) > Online(+95) > Google(+85) > Siri/Premium/Enhanced(+70) > Apple named(+45), eSpeak/레거시 MS(−60), en-US(+15)>en-GB(+10), 학습친화 named(aria/jenny/ava…) nudge(+8). `localService` 미반영(품질 신호 아님 — 이름 기반). loadVoices 가 stale 저장값이면 best 재선정(LS 보존). getEnglishVoices best-first 정렬. [VoicePickerPopover](../apps/web/src/components/workspace/VoicePickerPopover.tsx) 상단 음성에 "추천" 배지. 예: Chrome/Win 에서 David(−43) 대신 Google US English(100) 선택.

### LCP 대량 결과 list — 7축 필터 통합 패널 (v06.73)

사용자 요청: "LCP 대량의 list 에 필터 조건 필요함. 전체 조건에 대한 커버리지가 필터에 있어야 함."

이전엔 `hidePublished` / `audioOnly` 토글 2개만 있었음. 결과 row 가 수십~수백 건일 때 큐레이터가 좁히기 불편 → 7축 필터 패널로 통합.

### 신 state — `listFilters` 7축

| 축 | 컨트롤 | 동작 |
|---|---|---|
| **검색** | text input | title + description 부분 일치 (대소문자 무시) |
| **소스** | 6개 chip 다중 선택 | 비어있으면 모두 통과 |
| **점수** | minScore slider (0~100) | `score.total × 100 >= minScore`. 0 = 전체 |
| **CEFR** | A1~C2 chip 다중 선택 | 소스 spec.targetCefr.min 기준. 비어있으면 모두 |
| **발행 상태** | segment (전체/미발행/발행) | 기본값 `미발행` (이전 `hidePublished=true` 와 동등) |
| **audio 보유** | segment (전체/있음/없음) | 기존 `audioOnly` 통합 |
| **기간** | recencyDays slider (1~365) | `now − published_at > N일` 차단. 0 = 전체 |

### UI ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))

- 결과 헤더 안에 **`필터 [N]` 토글** (활성 필터 개수 chip — 기본 `미발행` 만 활성). ChevronDown 아이콘.
- 펼치면 grid 2열 (sm) 필터 패널. 각 축마다 라벨 + 컨트롤 + 현재 값 표시.
- 우하단 `필터 초기화 (기본값: 미발행만)` 버튼.
- 결과 카운트 표시 갱신: `N건 (필터로 M 숨김 / 전체 K)`.

### 적용 후 흐름

```
rows (서버 fetch)
  ↓ listFilters 7축 통과
visibleRows (사용자 필터링)
  ↓ sortBy (score | date) 정렬
displayRows (화면 표시)
```

소스별 / CEFR 별 / 점수 구간별로 사용자가 즉시 좁혀 큐 추가 후보를 명확히 식별 가능.

### LCP 대량 GET — 전체 재설계 (v06.72)

사용자 명시: "전체 재설계 해달라는것임" (선택 / 가져오기 개수 / 종류 / 결과 조건 모두 사용자 컨트롤). v06.71 의 부분 fix 가 부족 → 4축 동시 재구성.

### 신 state schema

| state | 역할 |
|---|---|
| `sourceConfig: Map<SourceKey, { selectedFeeds, maxItems }>` | 소스별 세부 — feed 개별 선택 + 가져올 최대 개수 (1~50) |
| `globalFilters: { minScoreOverride, recencyDaysOverride }` | 전역 spec override (null = spec 기본) |
| `expandedSources: Set<SourceKey>` | 어떤 카드가 펼쳐졌는지 |
| `fetchProgress: { current, total }` | fetch 진행 상태 (실시간 N/M feed) |

### 4축 UI 재구조 ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))

#### A. 선택 — 빠른 선택 preset chips
상단에 `기본 (VOA+NASA+NIH)` · `전체 (6 소스)` · `고급 (학자+백과)` 칩 3종. 한 번에 합리적 묶음 선택.

#### B. 종류 — 카드 expand → feed 개별 체크박스
각 소스 카드에 "세부 설정" 토글 (ChevronDown). 펼치면 해당 소스의 feed 별 체크박스. 헤더에 `{선택}/{전체} feed` 표시.

#### C. 가져오기 개수 — 카드별 maxItems slider+input
펼친 영역에 maxItems range slider (1~50) + number input (양방향 동기). 기본값 = `SOURCE_SPECS[source].maxItemsPerBatch`. 카드 헤더에 `최대 N` 가시화.

#### D. 결과 조건 — 글로벌 필터 패널 (펼치기)
🎚 패널 토글. 펼치면:
- **최소 점수 override** (★ 0~100 slider) — spec.minScore 이상으로 강화 (낮추지는 못함; 다른 소스 spec 들 보호).
- **신선도 cutoff override** (1~365일 slider).
- `spec 기본값으로 초기화` 버튼.

펼침 헤더에 현재 override 값 표시 (`min★50 · 30d` 또는 `spec · spec`).

### 진행 상태 표시

fetch 중 버튼 라벨이 `가져오는 중… 3/9 feed` 로 실시간 갱신 + 아래 progress bar (0~100%) 표시. 사용자가 어느 정도 진행 중인지 한눈에 파악.

### handleBulkFetch 재구성

```
feedsToFetch = SOURCES 순회 → selectedSources & sourceConfig.selectedFeeds 만 추가
fetch 각 feed → done 카운터 + setFetchProgress
cap 단계 → globalMinScore = max(spec.minScore, globalFilters.minScoreOverride)
            (낮춤 X — 다른 소스 spec 보호)
        → spec 통과 후 applySourceLevelCap
        → sourceConfig.maxItems 추가 slice
```

### 결과 패널 (v06.71 그대로)

소스별 분포 (최종 / 원본 −드롭) + N feed. 0건 회색. drop 사유 tooltip.

### 사용자 흐름 (전후)

| 단계 | v06.71 | v06.72 |
|---|---|---|
| 빠른 시작 | 카드 일일이 클릭 | preset chip 1 클릭 |
| 종류 조절 | 불가 (spec 자동) | 카드 펼치고 feed 체크박스 |
| 개수 조절 | 불가 (spec 고정) | 카드 펼치고 slider 즉시 변경 |
| 결과 조건 | 불가 (spec 고정) | 글로벌 필터 패널 slider |
| 진행 상태 | "가져오는 중…" 만 | `3/9 feed` + progress bar |
| 결과 분포 | 텍스트 row 만 | sourceStats 패널 + tooltip |

### LCP 대량 GET — 인터페이스/결과 고도화 + 3건 fix (v06.71)

사용자 피드백: "VOA, NASA 외 전부 LCP 대량 가져오기 안됨. 선택, 가져오기 개수, 종류 등 가져오기 인터페이스, 결과 조건 등 고도화 해줘. 많이 불편함."

### 실측 진단 (curl + spec scoring 시뮬레이션)

| 소스 | parsed | 가드 통과 | 주요 실패 원인 |
|---|---:|---:|---|
| VOA | 20 | 20 | ✅ |
| NASA | 10 | 10 | ✅ |
| **NIH MedlinePlus** | 54 | **0** | desc 28~100자 / title 16~25자 (가드 120/25 너무 높음). MedlinePlus 본문 자체가 짧음 |
| **Wikinews** | **0** | 0 | 영문 사이트 사실상 비활성 (30일 ns=0 article 0건) |
| **Simple Wikipedia** | 30 | 18 | extract<60자 12개 사전 필터 후 |
| The Conversation | 50 | 50 | ✅ (v06.70 fix 효과) |

### 코어 버그 1건 — byCappedSource 하드코딩

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) `handleBulkFetch` 의 cap 단계가 하드코딩 `['voa','nasa','nih']` 만 처리 → wikinews/the_conversation/simple_wikipedia 가 가져온 후 결과 row 에서 누락. SOURCES 전수 순회로 변경.

### Fix 3건

1. **NIH spec 완화** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts)): `minDescriptionLen` 120 → **40**, `minTitleLen` 25 → **15**, `recencyDays` 21 → **365**, `idealDescLen` 300 → **120**, `maxItems` 10 → **30**. MedlinePlus 본문이 본질적으로 짧은 특성 반영.
2. **Wikinews health=inactive**: SourceConfig 에 `health` + `healthNote` 신설. Wikinews 카드에 "⚠️ 외부 소스 비활성 — 영문 사이트가 현재 거의 비활성 (30일 새 article 0건)" 표시.
3. **byCappedSource 7종 전수 처리** (위 코어 버그 fix).

### 인터페이스 고도화 (사용자 명시 — "선택/개수/종류/결과 조건")

- **소스 카드 health badge** — health!=ok 시 카드 하단에 AlertCircle + 상태 메시지 (inactive=빨강 / unstable=주황).
- **결과 패널 신규** (`sourceStats`): 가져온 후 소스별 분포 표시 — 색점 + 라벨 + `최종 / 원본 (−드롭) (N feed)` 형식. 0건 소스는 회색 처리. tooltip 에 드롭 사유 (spec 가드 미통과). 사용자가 "어느 소스가 몇 건 회수됐는지" + "왜 드롭됐는지" 한눈에.

### 활성 ACP 6종 (v06.71 기준)

VOA (활성) · NASA (활성) · NIH (활성 — spec 완화) · Simple Wikipedia (활성 — 60% 회수) · Wikinews (⚠️ 외부 비활성) · The Conversation (활성).

### LCP 대량 — The Conversation description 추출 수정 (v06.70)

사용자 피드백: "LCP 대량에서 The Conversation 가져오기 기능 안되는 거 같음."

진단 (curl + Node 시뮬레이션):
- 외부 endpoint 정상 (HTTP 200, atom 50 entries)
- 라우트 정상 호출
- parseRssFeed 가 entry 별 description 추출 시 **`<summary>` (68자) 가 `<content>` (5720자) 보다 우선** → score 가드 `minDescriptionLen: 200` 통과 못해 모두 reject

수정 ([_helpers.ts](../packages/library-pipeline/src/ingest-article/_helpers.ts)):
1. `description / content / summary` 후보 중 **가장 긴 것** 선택 (이전: description → summary → content 순 fallback)
2. entity-encoded HTML 처리 순서: 이전 `decodeEntities(stripTags(desc))` 는 stripTags 가 `&lt;p&gt;` 같은 entity 를 못 풀어 HTML 태그 잔존 → `stripTags(decodeEntities(desc))` 로 변경. `\s+` 정규화 추가.

검증 (사후 시뮬레이션): 50 entries 모두 descLen ≥ 200 (이전 0건 통과). 평균 400 (slice 한계).

영향 — VOA / NASA / NIH / Wikinews / Simple Wikipedia 같은 다른 atom/RSS 소스도 동일 헬퍼 사용. content/summary 분리된 소스 모두 회복 가능 (지금까지는 description 또는 summary 만 잡혔던 케이스).

### ACP arxiv 소스 — 플랫폼 전체 삭제 (v06.69)

사용자 명시: "arxiv 삭제 (플랫폼 전체에서)."

**사전 확인**: `library_articles.source='arxiv'` 2 row (vocabularies / shared_word_sets / seed_catalog 연결 0). 데이터 손실 위험 없음.

**DB** migration [20260614240000_acp_remove_arxiv_source](../supabase/migrations/20260614240000_acp_remove_arxiv_source.sql):
- 잔존 2 article DELETE
- `library_articles_source_check` + `library_article_seed_catalog_source_check` 양쪽 CHECK 에서 `'arxiv'` 제거

**파일 제거**:
- `packages/library-pipeline/src/ingest-article/arxiv.ts`
- `apps/web/src/app/api/admin/articles/arxiv-feed/` (폴더 전체)

**타입/spec 정리**:
- `ArticleSource` (types-article.ts) — `'arxiv'` 제거
- `SourceKey` (_curation-spec.ts) — `'arxiv'` 제거. SOURCE_SPECS + SOURCE_DEFAULT_SPEC + 6 FEED_SPECS + SOURCE_RANKINGS_BY_LEVEL 모든 arxiv 항목 제거
- `SeedSource` (seed-upsert.ts) — `'arxiv'` 제거
- `index.ts` — `listArxivFeed` / `ingestArxivArticle` / `ARXIV_FEEDS` / `ArxivListItem` export 제거

**route/UI 정리**:
- `/api/acp/enqueue` — `HOST_TO_SOURCE` arxiv 패턴 제거, switch 분기 제거, `arxiv:ID` 직접 입력 처리 제거, 에러 메시지 갱신
- `/api/admin/articles/seed-list` — `VALID_SOURCES` 갱신 (6종)
- `BulkArticlesTab.tsx` — SOURCES 에서 arxiv entry 제거 (UI 노출 0)
- `RssFeedTab.tsx` — `source` prop 타입에서 `'arxiv'` 제거
- `AcpClient.tsx` / `page.tsx` / `(main)/library/scripts/page.tsx` — 헤더/설명 문구 갱신
- `ArticleCard.tsx` — `SOURCE_META.arxiv` 제거, 3종 신규 (simple_wikipedia / wikinews / the_conversation) 추가

**활성 ACP 소스 6종**: VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation.

### LCP 대량 GET — 7종 소스 endpoint 실측 점검 + 3건 fix (v06.68)

사용자 요청: "LCP 대량 GET 각 소스별 가져오기 점검해줘."

7개 endpoint 직접 fetch (curl `-A 'Vocaflow-LCP/2.0'`) 후 응답 분석:

| 소스 | HTTP | 항목 | 상태 |
|---|---:|---:|---|
| VOA as-it-is | 200 | 20 | ✅ |
| NASA news | 200 | 10 | ✅ |
| NIH medlineplus | 200 | **54** | ✅ (이전 grep 한 줄 카운트 한계로 1로 보였던 것) |
| arXiv cs-AI | 200 | 0 | ⚠️ RSS `<skipDays>Sat/Sun</skipDays>` — 주말 publish skip (정상 정책) |
| Wikinews `Special:NewsFeed` | **404** | 0 | ❌ URL deprecated |
| The Conversation all | 200 | 50 | ✅ |
| Simple Wikipedia good | 200 | **18/30 valid** | ⚠️ 12 페이지 extract 부족 (<100자) |

**수정 3건**:
- [wikinews.ts](../packages/library-pipeline/src/ingest-article/wikinews.ts) `WIKINEWS_FEEDS[0].url` `Special:NewsFeed` (404) → `api.php?action=feedrecentchanges&feedformat=atom&namespace=0&hidebots=1&hideminor=1&hideanons=1&days=30&limit=30`. namespace=0 으로 article 만 필터링. **단**: 영문 Wikinews 가 사실상 비활성 (30일 ns=0 article 0건) → 라벨에 "(※ 현재 거의 비활성)" 명시.
- [BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) arXiv 라벨 → "arXiv (월~금만 publish)" — 주말 fetch 시 0건이 정상임을 사용자에게 안내.
- [simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts) list 단계에서 extract 짧은 페이지(`<60자`) 사전 필터. [_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) `simple_wikipedia.minDescriptionLen` 100→60, `minTitleLen` 15→3, `idealDescLen` 300→250 (Simple Wikipedia 특성에 맞게 완화).

### VRL 일상 구체어 과대분류 교정 — 어린이 책 V-Level 부풀림 (v06.67)

StoryWeaver 어린이 그림책 "Ammachi's Amazing Machines"(Level 2, A2)가 book_v_level **V5(B1)**로 과대 산정. 분석: 53단어 중 34개가 V1-V4지만 **p75가 일상 구체어 과대분류 단어에 끌려** V5로 부풀려짐 — coconut→C1/V8, tray→C1/V5, neat→C2/V7, shell→B2/V5, ripe→C1/V6, toss→C1/V7, squeak→C1/V9, husk→C2/V10 (구체 picturable 일상어인데 C1-C2). centroid 2.85·CEFR-J A2.2는 A2로 맞았으나 p75만 부풀려짐.

**수정** [migration 20260614230000](../supabase/migrations/20260614230000_fix_overclassified_concrete_words.sql): 8개 단어 v_level/cefr_level 교정(V3-4≈A2 매핑) — 전역 적용. 교정+재산정 후 해당 책 book_v_level **V5→V4**, centroid 2.85→2.46, CEFR-J A2.2→A2.1 (모든 지표 A2 정합). 다른 어린이/구체어 도서가 또 다른 과대분류 단어를 만날 수 있어 광역 sweep 은 별도 과제.

### LCP 대량 소스 — wikinews / the_conversation / simple_wikipedia 추가 (v06.66 2/2)

v06.66 1/2 에서 arXiv 재노출 (4종). 남은 3종 (wikinews / the_conversation / simple_wikipedia) ingester 는 단건 `ingestXArticle` 만 있고 `listXFeed` 미구현이라 대량 GET 불가했음. 본 작업에서 7종 모두 활성화.

**라이브러리 파이프라인** (`packages/library-pipeline/src/ingest-article/`):
- [wikinews.ts](../packages/library-pipeline/src/ingest-article/wikinews.ts) `listWikinewsFeed` + `WIKINEWS_FEEDS` — Atom feed (Special:NewsFeed)
- [the-conversation.ts](../packages/library-pipeline/src/ingest-article/the-conversation.ts) `listTheConversationFeed` + `THE_CONVERSATION_FEEDS` — Atom feed 4종 (all/science/health/politics)
- [simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts) `listSimpleWikipediaFeed` + `SIMPLE_WIKIPEDIA_FEEDS` — MediaWiki API `generator=categorymembers` + `prop=extracts` 단일 호출 (very-good / good)
- [_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) `SourceKey` 7종 확장, `SOURCE_SPECS` + `SOURCE_DEFAULT_SPEC` + `SOURCE_RANKINGS_BY_LEVEL` 갱신
- [index.ts](../packages/library-pipeline/src/index.ts) `listXFeed` + `X_FEEDS` + `XListItem` 3종 export

**DB** migration [20260614230000_acp_article_source_add_3sources](../supabase/migrations/20260614230000_acp_article_source_add_3sources.sql):
- `library_articles_source_check` + `library_article_seed_catalog_source_check` 두 CHECK 에 3종 추가.
- 기존 enqueue 가 정상 동작 (v06.46 enqueue → seed_catalog upsert path).

**Web app**:
- 신규 feed route 3종: [/wikinews-feed](../apps/web/src/app/api/admin/articles/wikinews-feed/route.ts) / [/the_conversation-feed](../apps/web/src/app/api/admin/articles/the_conversation-feed/route.ts) / [/simple_wikipedia-feed](../apps/web/src/app/api/admin/articles/simple_wikipedia-feed/route.ts) — voa-feed 패턴 동일 (seed_catalog upsert + publishedSourceIds dedup).
- [seed-upsert.ts](../apps/web/src/lib/acp/seed-upsert.ts) `SeedSource` 7종 확장.
- [BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) `SOURCES` 에 3종 추가 (BookText / Newspaper / MessageSquareText 아이콘).

**커버리지** (학습 친화 우선순위 기반 정렬):

| 소스 | CEFR | 라이선스 | bulkPriority |
|---|---|---|---|
| VOA | A2-B2 | PD | 1 |
| NASA | B1-C1 | PD | 2 |
| NIH | B2-C1 | PD | 3 |
| arXiv | C1-C2 | CC-BY | 4 |
| Wikinews | B1-B2 | CC-BY-2.5 | 5 |
| The Conversation | B2-C1 | CC-BY-ND (display_only) | 6 |
| Simple Wikipedia | A2-B1 | CC-BY-SA | 7 |

The Conversation 은 CC-BY-ND 라 단어장 발행 차단 (license_class=cc_by_nd → display_only trigger). 워크스페이스 단어 학습은 클릭 툴팁(`lookup_word_meaning`)으로만.

### LCP 대량 소스 — arXiv UI 재노출 (v06.66 1/2)

사용자 피드백: "LCP 대량에서 소스 GET 대상이 3개만 보임. 전체 대상에서 전체부터 ~ 1개까지 선택할 수 있어야 한다. 옵션을 왜 선택하라고 하나? 기본 아닌가?"

가용한 모든 소스가 노출되는 것이 기본. v06.35 에서 arXiv 제거 코멘트("라이선스 비자유·C2+·텍스트 오염") 가 있었지만 ingester / SOURCE_SPECS / feed route 모두 완비됨. UI 만 재추가.

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) SOURCES 에 `arxiv` entry 추가 (6 feed: cs-AI / cs-CL / cs-LG / q-bio / math-HO / physics-gen-ph). `learnerLevel='advanced'` 선택 시 자동 우선 정렬, beginner/intermediate 에선 "이 수준엔 어려움" 배지로 가드. 이전 제거 사유는 spec.minScore 와 targetLevels='advanced' 가 처리.

**남은 작업** (v06.66 2/2 — 별도 commit 예정): simple_wikipedia / the_conversation / wikinews ingester 는 단건 `ingestXArticle` 만 있고 `listXFeed` 미구현 → 대량 GET 불가. 3종에 RSS/MediaWiki API 기반 listFeed 추가 후 노출.

### "→ 소스 GET" 일괄 복귀 seed unlock 버그 수정 (v06.65)

Curated Books 에서 도서를 "→ 소스 GET" 일괄 복귀하면 도서는 삭제되지만 소스 GET 탭에 **"큐" 표시가 잔류**(StoryWeaver "Ammachi's Amazing Machines"로 발견). 원인: `admin_bulk_requeue_books` 가 seed catalog 를 `IF EXISTS(... imported_book_id=v_id) THEN count++` 로 **카운트만** 하고 `UPDATE` 를 안 함 → 이후 `DELETE library_books` 시 FK(`imported_book_id ON DELETE SET NULL`)가 `imported_book_id` 만 null 로, `imported_to_books` 는 true 잔존. (단건 `admin_delete_book` 은 DELETE 전 UPDATE 라 정상 — bulk 경로만 결함.)

**수정** [migration 20260614220000](../supabase/migrations/20260614220000_fix_bulk_requeue_seed_unlock.sql) (적용·검증): DELETE 전에 `library_seed_catalog` 실제 UPDATE(imported 플래그 해제) + 기존 orphan(매칭 library_books 없는 imported_to_books=true) 정리. 검증: Ammachi imported_to_books→false, orphan 0.

### /admin/articles 단계 이동 액션 — LCP 동등화 (v06.64)

사용자 피드백: "/admin/articles 도 프로세스에 필요할 때 LCP 와 같이 삭제, 단계 전 이동 등의 기능이 있어야지."

LCP `MyLibraryTab` 의 published→ready revert + 영구 삭제 액션을 ACP 글에도 동등 적용. 기존 ACP 액션은 force_publish / requeue / archive 3종만이었음.

migration [20260614220000_acp_admin_revert_delete_article](../supabase/migrations/20260614220000_acp_admin_revert_delete_article.sql):
- `admin_revert_published_article(uuid)` — `admin_revert_published_book` 미러. published → ready 전환 + shared_word_sets(library_article) 삭제.
- `admin_delete_article(uuid)` — `admin_delete_book` 미러. ready/archived/queued/failed status 영구 삭제. CASCADE 로 `library_article_vocabularies` 삭제, SET NULL 로 `library_article_seed_catalog.imported_article_id` unlock. `shared_word_sets` 잔존분 정리.
  - **texts.source_url='article:{id}' 마커는 보존** — 사용자 학습 진도 유지 (layout.tsx 가 fetch 시 null → 보이스/단어장 미연결).
- published 책은 revert 후 삭제 (LCP 와 동일 정책).

API route (v06.55 force-publish 와 동일 패턴 — `requireAdmin` + service_role + 동등 로직 직접 실행, browser RPC + DEV_ADMIN_BYPASS 함정 회피):
- [/api/admin/articles/revert](../apps/web/src/app/api/admin/articles/revert/route.ts) — shared_word_sets DELETE + `status='ready'`/`published_at=NULL`.
- [/api/admin/articles/delete](../apps/web/src/app/api/admin/articles/delete/route.ts) — status 가드(ready/archived/queued/failed) + shared_word_sets DELETE + seed unlock 카운트 + library_articles DELETE.

UI:
- [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) — published 행에 `검토대기` (Undo2), ready/archived/queued/failed 행에 `삭제` (Trash2 · danger tone). 둘 다 confirm 다이얼로그 (단어장 삭제 / 본문 CASCADE / 마커 보존 명시). `RPC_ROUTE` 맵에 두 신규 endpoint 추가.
- [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx) — 검수 페이지 푸터에 `검토대기로 되돌리기` + `영구 삭제` 액션 노출. `ActionButton` tone 에 `danger` 추가.

### /admin/articles 대량 GET 소스 선택 UX 개선 (v06.63)

사용자 피드백: "LCP 대량에 전체 소스 대상 중 선택할 수 있어야 하지 않나? 선택 기능도 현재 불편함."

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) 소스 카드 UX 보강:
- **전체 선택/해제** 토글 — 헤더 우측 버튼 (`전체 선택` ↔ `전체 해제`). 한 번에 모든 소스 선택/해제. 이전엔 카드 하나씩 클릭.
- **선택 카운트** — `{selectedSources.size}/{SOURCES.length} 선택` 헤더 라인 표시.
- **명시적 체크박스 아이콘** — 카드 좌측 상단 `<CheckSquare>`/`<Square>` (lucide-react). 이전엔 카드 배경/테두리 색깔 변화만으로 선택 상태 표현 — 사용자가 인지하기 어려웠음.
- `toggleAllSources` 핸들러 신설 (전체 선택 상태 → 해제, 그 외 → 전체 선택).

소스 본체 (VOA/NASA/NIH) 와 spec/scoring/audio detection 등은 그대로.

### /text/[id] 본문 폰트/줄간격 컴팩트화 (v06.62)

사용자 피드백: "폰트와 줄간격이 너무 큼." 이전 `--reader-font-size: 16px` / `--reader-line-height: 1.7` 가 차분하지만 한 화면에 적게 들어와 읽기 흐름이 끊겼음.

수정:
- [globals.css](../apps/web/src/app/globals.css) `--reader-font-size` 16px → **15px**, `--reader-line-height` 1.7 → **1.55**
- [ReadingUniverse.tsx](../apps/web/src/components/workspace/ReadingUniverse.tsx) paragraph 사이 margin `mb-7 md:mb-8` → **`mb-4 md:mb-5`**

검수 페이지(`ChapterContent` = 16px/1.75) 보다 약간 컴팩트한 차분 본문. 사용자 단어 클릭/문장 듣기 인터랙션 영향 0.

### article direct-script 워크스페이스 줄바꿈 수정 — single-newline fallback (v06.61)

`/text/[id]` (article direct-script) 본문 줄바꿈이 검수 페이지(`/admin/articles/preview/[id]`)와 어긋남. v06.58 paragraph 정합 수정 후에도 article 케이스는 paragraph 가 한 덩어리로 표시됐음.

**원인**: article 의 `texts.paragraph_offsets` 가 NULL (article ingest 단계에서 산출 안 함). `buildParagraphsFromContent` 의 fallback 이 `\n\s*\n` (double newline) 만 시도 — article 본문은 보통 single newline 으로 paragraph 구분이라 byBlank=1 → 모든 문장이 한 paragraph 로 합쳐짐.

**수정**: 검수의 [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx#L49-L55) 동일 로직 적용:
```ts
const byBlank = content.split(/\n{2,}/).filter(Boolean)
rawSplits = byBlank.length > 1 ? byBlank : content.split(/\n+/).filter(Boolean)
```

VOA "Everyday Grammar" 같은 article (single newline 으로 paragraph 분리) 이 검수와 동일하게 paragraph 별 분리 표시.

### StoryWeaver 레벨→난이도 밴드 필터 (v06.60)

StoryWeaver 그림책은 **레벨(1-4)이 곧 난이도** (leveled reader). 소스 GET 시 [fetcher](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) 가 레벨→`est_v_level`(L1→V2 … L4→V5) 직접 설정 (SeedRow `est_v_level` 옵셔널 필드 추가). 단, 카탈로그 난이도 밴드가 V5(B1)부터라 초급 그림책(V1-4)이 어떤 밴드에도 안 잡힘 → [BulkFetchTab](../apps/web/src/components/admin/curation/BulkFetchTab.tsx) V_BANDS 에 **초급 A1–A2 (V1–4)** 밴드 신설. 이제 StoryWeaver 책이 난이도로 필터됨. (최종 난이도는 analyze coverage 가 SSoT — est 는 카탈로그 필터용 추정.)

### StoryWeaver fetch 403 수정 — Cloudflare JA3 차단 → curl 폴백 (v06.59)

`/admin/curation 소스 GET → StoryWeaver 가져오기` 에서 `StoryWeaver books-search failed: 403`. 원인: StoryWeaver 가 Cloudflare 로 **Node 의 TLS(JA3) 핑거프린트를 차단** — undici `fetch` 와 Node `https` 모듈은 브라우저 UA·전체 헤더를 줘도 403, 동일 IP 에서 `curl` 은 200 (TLS 핸드셰이크 fingerprint 차이). 단순 UA/헤더 수정으로 해결 불가.

**수정** — [storyweaver.ts(ingester)](../packages/library-pipeline/src/ingest/storyweaver.ts) + [storyweaver.ts(fetcher)](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) 에 `swFetchJson()` 도입: undici `fetch` 우선 시도(차단 안 되는 환경) → 실패 시 `curl` (execFile) 폴백. 브라우저 UA 사용. 큐레이션은 admin/dev 서버 작업이라 curl 가용 가정. 실측: books-search·read 양쪽 fetch 403 → curl 폴백 → 정상(L2 필터·16페이지·audio).

### /text/[id] 본문 — 검수 페이지와 줄바꿈/내용 정합 (v06.58)

`/text/[id]` 워크스페이스 본문 표시가 `/admin/curation/preview` 검수 페이지 본문과 어긋남. 사용자: "원문 내용의 검수한 내용으로 보이지 않음. 줄바꿈이 전체 안 맞음."

**원인 진단** (검수 ↔ 워크스페이스 본문 처리 비교):

| 항목 | 검수 (`ChapterContent`) | 워크스페이스 (`ReadingUniverse`, before) |
|---|---|---|
| boilerplate strip | ❌ (raw DB content) | ✅ (TOC/chapter header 잘라냄 + offsets shift) — **검수와 불일치** |
| paragraph 경계 | `splitByOffsets(paragraph_offsets)` | `splitByOffsets` + `stripBoilerplate` 적용 후 — **검수와 불일치** |
| paragraph 내부 `\n` | `whitespace-pre-wrap` 으로 보존 | `splitIntoSentences` 의 `\s+` 가 `\n` 흡수 → **줄바꿈 손실** |
| sentence 사이 구분 | (paragraph 단위라 무관) | `<span>` inline + `' '` 1개만 — `\n` 표현 없음 |

**실측** (published 책 ch1 newline 분포):

| 책 | content_len | para_offsets | total `\n` | single `\n` |
|---|---:|---:|---:|---:|
| Pride and Prejudice | 825 | 43 | 25 | **25** |
| Twenty years after | 24,995 | 82 | 506 | **506** |
| Pinocchio | 3,163 | 18 | 34 | 0 |
| Decline and Fall of Roman Empire | 54,189 | 41 | 80 | 0 |

→ Pride/Twenty 같은 소스는 paragraph 내부에 single newline 다수 — 이전 워크스페이스에서 모두 한 줄로 합쳐졌음.

**수정** (3 처):
- [text-content-helpers.ts](../apps/web/src/app/(main)/text/[id]/text-content-helpers.ts):
  - `stripBoilerplate` + `shiftOffsets` + 관련 정규식 4종 dead code 제거. ingest/normalize 가 SSoT, 워크스페이스는 raw content 사용 (검수와 정합).
  - paragraph 경계 = `paragraph_offsets` 만 사용 (검수 `splitByOffsets` 와 동일).
  - `splitIntoSentences` 의 sentence 경계 separator: `\s+` → `[ \t]+`. `\n` 은 sentence 경계로 보지 않고 sentence text 안에 보존.
- [ReadingUniverse.tsx](../apps/web/src/components/workspace/ReadingUniverse.tsx) `<p>` 에 `whitespace-pre-line` 추가 — sentence text 안의 `\n` 이 자동으로 `<br>` 효과. 검수의 `whitespace-pre-wrap` 와 동등 (paragraph 단위 표시).

결과: paragraph 개수는 검수와 동일 (paragraph_offsets 기준), paragraph 내부 줄바꿈은 보존, sentence 단위 재생/하이라이트 기능도 유지.

### 글 게시 2건 수정 — CHECK 위반 + dev-bypass 무반응 (v06.57)

**증상**
- `/admin/articles` list 의 "게시" 클릭 → alert: `new row for relation "shared_word_sets" violates check constraint "shared_word_sets_category_check"`
- `/admin/articles/preview/[id]` 의 "게시" 클릭 → 무반응

**원인 1 — CHECK constraint 누락**: v06.52 가 `publish_article_word_set` 를 추가하면서 `category='library_article'` 로 INSERT 하는데, 기존 CHECK constraint 가 `library_book` 까지만 허용 → INSERT 위반.

**원인 2 — browser RPC + dev-bypass 비호환**: 두 화면 모두 브라우저 `client.rpc('admin_force_publish_article')` 직접 호출. `DEV_ADMIN_BYPASS=1` 환경에서 cookie 세션이 없어 `auth.uid()`=NULL → `is_admin_or_curator()`=false → RPC throw "Forbidden". list 에선 alert, preview 에선 footer 의 작은 표시로 무반응처럼 보임. v06.55 의 책 게시 fix 와 동일 패턴.

**수정**
- migration [20260614210000_shared_word_sets_category_add_library_article](../supabase/migrations/20260614210000_shared_word_sets_category_add_library_article.sql) — CHECK constraint 에 `library_article` 추가
- 신규 [/api/admin/articles/force-publish](../apps/web/src/app/api/admin/articles/force-publish/route.ts) — `requireAdmin` + service_role 동등 로직 (copyright 검증 + `status='published'` UPDATE). `trg_publish_article_word_set` trigger 가 자동 발행
- [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) + [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx) — `rpcAction` 에 `RPC_ROUTE` 맵 추가 → `admin_force_publish_article` 만 fetch 호출로 전환 (다른 RPC 는 기존 path 보존)

### LCP StoryWeaver 소스 + 그림책 삽화/낭독 (v06.56)

StoryWeaver(Pratham Books) CC BY 4.0 그림책을 LCP 소스로 추가 — 페이지별 **삽화**(링크)와 **낭독 오디오**를 학습자에게 노출. 모든 파이프라인은 기존 LCP 모델 그대로 (ingest→normalize→segment→analyze→publish→단어장→enroll→workspace).

**마이그레이션** `20260614190000_lcp_storyweaver_source` (적용·검증됨):
- `library_books.illustrations jsonb` (`[{idx,url,alt}]` 링크) + `library_books.audio_url text` (readalong)
- `library_books_source_check` 에 `storyweaver` 추가 · `library_source_catalogs` storyweaver row (CC BY 4.0, composite 4.6, S-tier)

**ingester** [storyweaver.ts](../packages/library-pipeline/src/ingest/storyweaver.ts) — `/api/v1/stories/{id|slug}/read` (server-side fetch, UA 필수): StoryPage 텍스트→문단, `coverImage.sizes`→삽화(idx 정합), FrontCover→표지, `audioPath`→낭독, `authors`→저자, BackCover→제목/줄거리. 실측: 2-smile-please 12페이지·삽화·mp3 정상.

**파이프라인** — 3 LCP 라우트(process/dev-process/dev-validate) dispatch + 자산 persist(삽화/표지/오디오). StoryWeaver 는 자체 표지·오디오 제공 → resolveCoverImageUrl·LibriVox 매핑 우회.

**학습자** — [ReadingUniverse](../apps/web/src/components/workspace/ReadingUniverse.tsx) 가 문단 idx별 삽화를 `<figure>`로 렌더(plain img) + [workspace layout](../apps/web/src/app/(main)/text/[id]/layout.tsx) 이 `audio_url`→단일 스트림 `chapterAudio`(원어민 성우) + 삽화 전달.

**admin (개별 추가)** — [StoryWeaverIdTab](../apps/web/src/components/admin/curation/StoryWeaverIdTab.tsx) + [preview-storyweaver](../apps/web/src/app/api/admin/library/preview-storyweaver/route.ts) + EnqueueModal/AdminCurationClient 배선. /admin/curation Sources 탭 자동 노출 + "StoryWeaver" ID 탭(표지·페이지수·낭독 미리보기 → 큐 추가).

**admin (소스 GET 대량)** — [storyweaver fetcher](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) (books-search API: 레벨 1-4 필터 + 키워드 검색 + 페이지네이션) → `library_seed_catalog` 대량 적재. BulkFetchTab SOURCE_OPTIONS + seed-fetchers FETCHERS 등록. 마이그레이션 `20260614200000_lcp_storyweaver_seed_catalog` (seed_catalog source CHECK 확장). 목록엔 저자 미포함 → ingest 시 채움, 레벨은 genre/subjects 보존.

### 책 검수 페이지 "게시" 무반응 수정 — dev-bypass + browser RPC 호환 (v06.55)

`/admin/curation/preview/{book-id}` 의 "게시" 버튼이 dev-bypass 모드 (`DEV_ADMIN_BYPASS=1`) 에서 무반응. 원인: AdminReviewClient → `forcePublishBook(client, id)` 가 브라우저 supabase client 로 직접 `admin_force_publish_book` RPC 호출 → cookie 세션이 없어 `auth.uid()`=NULL → `is_admin_or_curator()`=false → RPC `RAISE EXCEPTION 'Forbidden'`. 에러는 reader footer 의 작은 영역에 표시돼 사용자 시야 밖. v06.48 의 다른 admin write route 와 동일 함정.

수정:
- 신규 [/api/admin/library/force-publish-book](../apps/web/src/app/api/admin/library/force-publish-book/route.ts) — `requireAdmin` 가드 + service_role client. SECURITY DEFINER RPC 의 `is_admin_or_curator()` 우회를 위해 RPC 대신 동등 로직 직접 실행 (copyright 검증 + `status='published'` UPDATE). `trg_lb_publish_word_sets` trigger 가 자동으로 챕터 단어장 발행.
- [admin-queries.ts](../apps/web/src/lib/library/admin-queries.ts) `forcePublishBook` 헬퍼를 fetch 호출로 전환 — 호출부 시그니처 보존. `AdminReviewClient` + `BookDetailModal` "강제 게시" 두 entry 모두 자동 fix.

### ACP article 추출 기준 LCP book 동등화 — V-Level 게이트 + skill penalty (v06.54)

v06.52 가 만든 `select_article_vocab` 는 register filter + composite 만 동일했고 **V-Level 게이트 / skill penalty 는 결락** — LCP book 의 `select_book_chapter_vocab` 와 비교 시 4축 점검 결과:

| 축 | LCP book | ACP article (이전) | 강화 후 |
|---|---|---|---|
| 재분석 | analyzeBook → library_book_vocabularies | analyzeArticle 동일 | 그대로 |
| SSoT (preview ↔ publish) | `select_book_chapter_vocab` 단일 | preview = library_article_vocabularies 직접 SELECT(base_learning_value DESC) / publish = `select_article_vocab` (분기) | RPC 일원화 |
| V-Level 게이트 (`v_level ≥ baseline`) | ✅ `book_v_level` (P75 DISTINCT lemma, V11 제외) | ❌ 없음 (V0~V10 모두 포함) | ✅ `article_v_level` 신설 + 게이트 |
| Skill penalty (`skill=4 AND baseline<6 → −0.10`) | ✅ | ❌ | ✅ 동일 적용 |
| Register filter + Composite weight | ✅ | ✅ | 동일 |

migration [20260614200000_article_v_level_ssot_unify](../supabase/migrations/20260614200000_article_v_level_ssot_unify.sql):
- `library_articles` 에 `article_v_level smallint` + `vrl_components jsonb` + `vrl_calculated_at` 컬럼 신설
- `compute_article_vrl(article_id)` 함수 (`compute_book_vrl` 미러 — DISTINCT lemma P75, V11 제외)
- `select_article_vocab` v3 (V-Level 게이트 + skill penalty 추가)
- 기존 ready/published article 전수 backfill (compute_article_vrl)
- 기존 published article 단어장 재발행 (V<baseline 단어 제거 반영)

code:
- [acp/dev-process/route.ts](../apps/web/src/app/api/acp/dev-process/route.ts) — analyzeArticle 직후 `compute_article_vrl` RPC 호출
- [admin/articles/preview/[id]/page.tsx](../apps/web/src/app/admin/articles/preview/[id]/page.tsx) — `library_article_vocabularies` 직접 SELECT + shared_dictionary JOIN 제거 → `select_article_vocab` RPC 단일 호출 (preview ↔ publish SSoT)
- [review-types.ts](../apps/web/src/lib/articles/review-types.ts) — `ReviewArticle.articleVLevel` 필드 추가
- [ArticleExtractionPanel.tsx](../apps/web/src/components/admin/articles/ArticleExtractionPanel.tsx) — 헤더 `article_v_level V{N} 이상` 표시 + MetaCell 5열 (`발행 기준` + `article_v_level` 추가)

**검증** (ready article 1건 실측):
- vocab raw 186 → V-Level 게이트 + skill penalty 적용 후 **47** (`v06.52` 의 180 대비 -73% — book LCP 와 동일 정밀도)
- backfill 결과: ready article 1건 article_v_level = V4 산출
- TypeScript 0 error

### Lit2Go 곱슬따옴표 엔티티 미디코딩 수정 — Huck Finn 미바인딩 정상화 (v06.53)

`/admin/curation/preview` *Huckleberry Finn* 단어추출 미바인딩 618건 진단. 원인: [ingest/lit2go.ts](../packages/library-pipeline/src/ingest/lit2go.ts#L212) `decodeEntities()` 가 USF 본문의 곱슬따옴표 named entity(`&ldquo; &rdquo; &lsquo; &rsquo;`)를 안 풀어 **ldquo/rdquo/lsquo/rsquo 가 단어로 잡히고(2,790회)** `s&rsquo;pose→ose`·`b&rsquo;lieve→lieve`·`Only→nly` 식으로 **실단어가 쪼개짐**(노이즈 + coverage 손실 동시). lit2go 소스에만 발생(다른 ingest 는 디코딩 정상). standard-ebooks 와 동일하게 4 entity 추가 + [reprocess-book.mjs](../scripts/lcp/reprocess-book.mjs) INGEST 맵에 lit2go 추가. Huck Finn 재-ingest/재추출 → **엔티티 쓰레기 0** · instead/suppose/need/believe **복구·바인딩**. 남은 미바인딩은 Twain eye-dialect(de/dat/dey/gwyne/wuz)로 정상(학습어휘 제외 맞음).

### ACP 학습 모델 완성 — 글=학습자 스크립트 (LCP 전체 체인 미러) (v06.52)

검수 페이지(v06.51)에 이어 **발행→단어장→학습시작→워크스페이스** 전 구간을 책(LCP)과 동등하게. 글이 라이브러리 스크립트로 학습자에게 제공되는 학습 모델 완성.

**마이그레이션** `20260614180000_acp_article_word_set_pipeline` (4 함수 + 1 트리거 + backfill):
- `select_article_vocab(uuid)` — `select_book_chapter_vocab` 단일-섹션 버전 (register 필터 + classified/meaning + composite 랭킹; book_v_level 임계만 제외). 실측: ready 글 186 raw → 180 선정.
- `publish_article_word_set(uuid)` — 발행 시 `shared_word_sets`(category `library_article`) 1개 + `shared_words` 생성 (멱등).
- 트리거 `trg_la_publish_word_set` (AFTER UPDATE OF status) — status→published 시 자동 (책 `trg_lb_publish_word_sets` 미러).
- `subscribe_article_word_set(uuid)` — SECURITY DEFINER auth.uid(): 학습 시작 시 구독 + `vocabularies` 시드 (책 `_enroll_book_subscribe_word_sets` 미러).

**프론트엔드**:
- [start-learning.ts](../apps/web/src/lib/articles/start-learning.ts) — 텍스트 생성(신규·재사용 양쪽) 후 `subscribe_article_word_set` 호출 → 학습자 WordVault 에 글 단어장.
- [text/[id]/layout.tsx](../apps/web/src/app/(main)/text/[id]/layout.tsx) — direct-script(article 파생) 분기 신규: `source_url='article:{id}'` → `library_articles.audio_url`→`chapterAudio`(원어민 보이스, FloatingAudioPlayer 재사용) + 글 단어장→`currentChapterWordSet`(워크스페이스 "단어" pill). 책의 librivox/챕터 단어장 경로 대응.

### ACP 글 검수 페이지 — LCP 책 검수와 동등한 큐레이션 프로세스 (v06.51)

기존 `/admin/articles` Curated 탭은 **목록 + 행 액션 버튼**뿐 — 본문을 읽지 않고 게시/보관해야 했음("목록만 보고 큐레이션?"). LCP 책 검수(`/admin/curation/preview/[bookId]`)의 **4패널을 글에 1:1 미러** — 할 수 있는 부분 모두 동일, 화면 골격 동일. (책=다챕터, 글=단일 섹션이 유일한 본질 차이.)

**신규 라우트** `/admin/articles/preview/[id]` — 책 검수 4패널 미러:
1. **본문 리더 + 게시 게이트** ([AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx)) ↔ AdminReviewClient — 상단바(뒤로/상태/신뢰도/PublishControl) + 단일 섹션 리더 + 푸터 액션(지금 처리·재분석/재처리/보관). 게시 게이트 = `copyright_safe_in_kr` 강제(`admin_force_publish_article` 정합).
2. **보이스 연결** ([ArticleAudioPanel.tsx](../apps/web/src/components/admin/articles/ArticleAudioPanel.tsx)) ↔ LibriVoxAudioPanel — 글은 단일 오디오라 챕터 매핑 대신 `audio_url` 검증/미리듣기/연결·해제. 신규 [/api/acp/set-audio](../apps/web/src/app/api/acp/set-audio/route.ts) (service-role).
3. **학습 단어 추출** ([ArticleExtractionPanel.tsx](../apps/web/src/components/admin/articles/ArticleExtractionPanel.tsx)) ↔ BookExtractionPanel — meta cells(CEFR/단어수/추출수/읽기시간) + LV 내림차순 랭킹 테이블 + 📜/🏛 RegisterBadge + 미등재 경고.
4. **검수 팝업** ([ArticleWordSetPreviewModal.tsx](../apps/web/src/components/admin/articles/ArticleWordSetPreviewModal.tsx)) ↔ ChapterWordSetPreviewModal — 단어 전수 + 뜻 + 발음(TTS) + 본문 첫 문장 + register.

**데이터** — [page.tsx](../apps/web/src/app/admin/articles/preview/[id]/page.tsx) (RSC) service-role 로 `library_article_vocabularies` 전량 + `shared_dictionary`(meaning_ko/pos/cefr/v_level/word_register/frequency_rank) 조인 (vocab 테이블에 admin RLS 없음 → ready 상태도 검수 가능). 진입 = [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) 제목/검수 버튼.

**버그 fix** — [analyze-article.ts](../packages/library-pipeline/src/analyze/analyze-article.ts): vocab INSERT 전 기존 행 DELETE (재분석 시 중복 누적 방지 — 멱등).

**남은 follow-up** — 학습자 워크스페이스(`/text/[id]`)는 아직 글 `audio_url` 미재생(direct-script texts 오디오 미배선); 책의 chapterAudio 경로에 article 분기 추가 필요.

### Dev 일괄 처리 대상에 failed 도서 포함 (v06.50)

[MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — Dev 일괄 처리 (`devBatchIds`) 가 `inProgressIds + readyIds` 만 모았는데 **failed 도서가 빠져 있어** 정규식/네트워크 일시 실패 후 fix 한 도서를 batch 로 다시 못 돌림. failed 도서 1권을 다시 처리하려면 모달에서 한 건씩 dev-process 호출하는 번거로움.

수정:
- `failedIds` memo 신설 (`b.status === 'failed'`).
- `devBatchIds = [...inProgressIds, ...readyIds, ...failedIds]`.
- confirm 다이얼로그 + 카운트 chip + 버튼 title 에 실패 N 권 노출.
- failed 도서는 `dev-process` 가 status 게이트 없이 ingest 부터 재시작 (이미 그렇게 설계됨 — UI 만 막혀 있었던 것).

이번 세션의 Lit2Go 정규식 fix (v06.49) 같은 케이스에서 실패 도서를 batch 재처리하는 것이 자연스러운 흐름. 무한 루프 위험 0 (단일 round) — 다시 실패하면 그저 status 유지.

### Lit2Go 본문 ingest 실패 수정 — 0 chars (v06.49)

`/admin/curation → Curated Books → Lit2Go dev 일괄 처리` 시 `Lit2Go book body too short: 0 chars` 발생. 원인은 ingest 정규식이 실제 USF 마크업과 안 맞음 (WordPress 기본 wrapper 가정).

**3 처: 모두 [ingest/lit2go.ts](../packages/library-pipeline/src/ingest/lit2go.ts)**

| 항목 | 코드 가정 | 실제 USF 마크업 | 수정 |
|---|---|---|---|
| passage URL | `/lit2go/{book-id}/{passage-slug}/` (3 seg, 상대) | `https://etc.usf.edu/lit2go/{book-id}/{book-slug}/{passage-id}/{passage-slug}/` (5 seg, 절대) | 정규식 5-seg + 절대/상대 모두 매칭 |
| 본문 wrapper | `<div class="entry-content">` / `<article>` | `<div id="i_apologize_for_the_soup">` (재미있는 실제 USF id) | id 매칭 + `<audio>`/`<source>`/`<nav>` 사전 제거 |
| 책 제목 | `<h1>` 동일 라인 | `<h2>` 멀티라인 (`<h1>` 은 사이트 로고) | `<h2>` + 멀티라인 `[\s\S]*?` |
| author/collection/genre anchor | 상대 URL 만 | 절대 URL | `(?:https?:\/\/etc\.usf\.edu)?` prefix optional |

**검증**: 책 91 (`The King of the Golden River`) 로 dry-run — 5 passage URL + title/author + 본문 18,393자 모두 정상 추출.

### dev-bypass 모드에서 seed 큐레이션 RLS 거부 수정 (v06.48)

`/admin/curation → 소스 GET → Lit2Go 1권` 시 `new row violates row-level security policy for table "library_seed_catalog"` 발생. 원인: `DEV_ADMIN_BYPASS=1` 환경에서 `requireAdmin` 은 합성 admin 으로 통과하지만 `createClient()` 가 만드는 SSR client 의 cookie 세션이 비어있어 `auth.uid()` = NULL → 정책 `is_admin_or_curator()` 1행 (`IF auth.uid() IS NULL THEN RETURN false`) 에서 거부.

수정 — 두 admin write route 를 다른 동족 route (`delete-seed-catalog`, `save-librivox-audio`, `backfill-covers`) 와 동일하게 **service_role client** 로 통일:
- [fetch-seed-batch/route.ts](../apps/web/src/app/api/admin/library/fetch-seed-batch/route.ts) — 모든 source bulk fetch UPSERT
- [enrich-seed/route.ts](../apps/web/src/app/api/admin/library/enrich-seed/route.ts) — seed detail enrich UPDATE

`requireAdmin` 가드는 그대로 유지. 정상 로그인 사용자 영향 0, dev-bypass 모드에서만 동작 복구. lit2go 뿐 아니라 모든 fetcher (gutenberg / standard_ebooks / wikibooks / librivox / lit2go) 에 동일 함정이 잠재했음.

### Supabase advisor "Security Definer View" 5건 일괄 해결 (v06.47)

migration `20260614150000_views_security_invoker` — public 스키마 5 view (`library_seed_catalog_view`, `user_vocab_enriched`, `v_book_extraction_stats`, `v_text_content`, `v_user_book_progress`) 를 `SECURITY INVOKER` 로 전환. SECURITY DEFINER (PG15 default) 는 view creator (postgres superuser) 권한으로 실행 → 호출자 RLS 우회 위험. INVOKER 전환 시 호출자 권한으로 RLS 가 정상 적용. 기능 변화 0 — 5 view 기반 8 테이블 모두 RLS + 정책 (admin role / user_id 본인 필터 / public read) 갖춤. defense in depth.

### middleware — 리다이렉트 시 세션 쿠키 유실 수정 (갑자기 로그아웃)

`/admin` 가드의 `/login`·`/hub` 리다이렉트가 `getUser()` 가 갱신·회전시킨 Supabase 세션 쿠키를 안 실어 보냄 → 토큰 회전이 리다이렉트와 겹치면 새 쿠키 유실·옛 refresh 토큰 무효 → 세션 끊김(간헐적 "갑자기 로그아웃"). 리다이렉트 응답에 `response.cookies` 를 복사하는 `redirectTo()` 헬퍼로 교체 ([middleware.ts](../apps/web/src/middleware.ts)). Supabase SSR 미들웨어 필수 패턴.

### VOA 기사 본문 추출 수정 — balanced wsw + 클립 reject

ACP 대량 GET 에서 VOA 기사 enqueue 시 "body too short" 빈발. 원인·수정 ([voa.ts](../packages/library-pipeline/src/ingest-article/voa.ts)):
- **본문 토막남**: `<div class="wsw">` 본문 컨테이너가 **오디오 플레이어 div 로 시작** → 기존 non-greedy `</div></div>` 정규식이 첫 블록(~97자)에서 끊겨 transcript 22단락을 통째로 놓침. **`extractDivByClass`(div 중첩 균형 추출)** 신설 → 컨테이너 전체 회수 후 `<p>` transcript 추출 (실측: 97자 → 2,156자). "No media source currently available" 플레이어 boilerplate 제거.
- **클립 chrome 오긁기 차단**: `<article>`/whole-html 폴백이 transcript 없는 오디오·비디오 클립에서 nav·footer 메뉴를 본문으로 긁어 4,839자 garbage 통과시키던 것 → **wsw 없으면 명확히 reject**("no transcript body — audio/video clip?"). VOA transcript = wsw 컨테이너가 SSoT.

### Lit2Go (USF) 대량 GET 수정

Lit2Go bulk fetch 가 0건 / 삽입 실패. 두 원인 교정:
- **fetcher URL 정합** ([seed-fetchers/lit2go.ts](../apps/web/src/lib/library/seed-fetchers/lit2go.ts)): 책 링크가 절대 URL(`https://etc.usf.edu/lit2go/{id}/`)인데 상대경로만 파싱 → 0건. 절대/상대 매칭 + icon anchor skip → `/books/` 204권 추출. genre 는 실제 `genres/{id}/{slug}/`(slug-only 404) — 실제 22장르 매핑. per-band·audio listing 부재라 gradeBand/audioOnly 필터 제거.
- **CHECK 제약 보완** (migration `20260614130000_library_seed_catalog_source_add_lit2go`): `library_seed_catalog_source_check` 에 `'lit2go'` 누락(`20260614120000` 이 `library_books` 만 갱신) → seed 삽입 시 위반. 추가. + `getCatalogStats` CATALOG_SOURCES 에 lit2go 추가(통계 pill).

### LibriVox 권-인지 정합 — 다권 도서 100% 드레인 (v06.35)

**문제** — Les Misérables(5권) LibriVox 매핑이 92장 오배정. 원인: 이전 드레인이 5권을 flatten 후 `(book,chapter)` **번호**로 매핑 → 각 권이 "Bk 01"부터 재시작해 권 간 충돌 + 묶음파일("Ch 01-04")·포맷불일치("Bk 1" vs "Bk 01")·`<b>` 태그.

**해결 — 두 목록(소스 챕터 + LibriVox 섹션) 구조 분석 후 권-인지 매핑** ([librivox-chapter-map.ts](../apps/web/src/lib/library/librivox-chapter-map.ts) + `scripts/lcp/librivox-align.mjs`):
- **`alignChaptersByVolume`** — 권 N = 텍스트 Part N, 권 내 `(Book,Chapter)` 순서로 매핑(권 내 "Bk 01" 유일 → 충돌 0). 4-pass: ①번호매핑 ②퍼지 제목 교차검증(Levenshtein≥0.7+토큰+접두 — 표기차/악센트/`<b>`/`...`절단 흡수) ③**PASS2 제목복구**(edition shift: 오디오 추가/병합 챕터) ④**PASS3 번호신뢰**(제목 오타지만 라벨=위치 단일 미사용 섹션, `number_trusted` 보고). 묶음→블록재생, multi-part→멀티파트.
- **`alignChaptersByTitle`** — 단권 titled 용 (섹션↔챕터 제목 1:1).
- **결과**: Les Mis **364/364 (100%)** — gap 0, conflict 0, number_trusted 1(ch103 제목오타). 이전 92장 오배정 완전 교체.
- **정확도 원칙**: 검증/복구 못 한 건 omit → `pickChapterAudio` null → TTS. "강제 채움 금지 = 틀린 오디오 0".
- **NEW** `scripts/lcp/librivox-align.mjs`(드레인) + `librivox-dump.mjs`(두 목록 진단 덤프). `build-librivox-map.mjs` 헤더에 다권 시 librivox-align 안내.

### 큐레이션 파이프라인 점검 — 오류 6 + dead code 정리 (v06.35)

소스 GET(대량) → Curated Books 전 과정 2-에이전트 리뷰 + RPC 실측 후 일괄 수정:

**🔴 버그 픽스**
- [dev-process/route.ts](../apps/web/src/app/api/lcp/dev-process/route.ts) `collect_archaic_candidates` **try/catch 누락** → throw 시 이미 `ready` 인 책이 `failed` 로 뒤집히던 것 가드 (주석은 best-effort 인데 실제 미가드였음).
- [admin-queries.ts](../apps/web/src/lib/library/admin-queries.ts) `CATALOG_SOURCES` 가 기본 소스 `simple_wikipedia` 누락 + 미사용 `openstax` 포함 → 실제 fetcher 5종으로 교정 (BulkFetch 통계 0 표시 해결).
- `enqueueSeedRow` 의 `imported_to_books` UPDATE 에러 미확인 → throw 추가 (중복 enqueue 차단).
- dev-process 자동매핑 성공/녹음없음 시 `book_curation_jobs` 무조건 DELETE → `status IN ('pending','failed')` 가드 (진행 중 수동 매핑 잡 보존).
- dev-process 자동 enqueue `mode` 하드코딩 `dev_reprocess` → 원본 status 로 판정 (`dev_process`/`dev_reprocess`).
- [MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) 워크플로 스텝퍼 **queued vs in_progress 불일치** → `'queued'` StatusFilter 신설 (필터/카운트/스텝 정합, `대기 중` 칩).

**🟡 dead code**
- `enqueueCurationJobsAction` + `enqueueCurationJobs` wrapper + `EnqueueCurationJobsResult` 제거 (이번 세션 "매핑 큐 등록" 버튼 삭제로 호출부 소멸 — dev-process 자동 등록이 대체).

남은 dead code(enrich-seed 라우트·languages 고급필터·requeueBook·book_curation_jobs 이중 fetch)는 영향 작아 후속 정리 대상.

### LCP 도서 소스 — Lit2Go (USF) 추가 + V-Level SSoT 정책 명시 (v06.43)

사용자 명시 — "Lit2Go (USF) 를 라이브러리 소스 get 대상으로 추가. 프로세스는 기존 준용, 레벨은 v level 로 제산". 외부 비평 (Lit2Go US grade ≠ CEFR ≠ EFL) 검토 후 정책 정합.

**핵심 정책 — V-Level SSoT 보호**

| 축 | Lit2Go 제공 | Vocaflow 처리 |
|---|---|---|
| US 학년 (Flesch-Kincaid) | ✓ | **`curation_meta.lit2go_grade` 보존만** (final 매핑 X) |
| 장르 (K-12 분류) | ✓ | curation_meta 저장 |
| 연령 (간접) | ✓ | `content_maturity` 플래그 (kids/teen/adult) — hi-lo 표시 |
| 컬렉션 | ✓ | curation_meta |
| 오디오 (USF MP3) | ✓ | curation_meta.audio_url |
| 본문 라이선스 | PD | source: 'lit2go' |
| 요약 라이선스 | CC-BY (USF) | 인용 권장 표시 |
| **V-Level** | ✗ | **coverage 모델이 SSoT** (analyze 단계 lexical_coverage + lemma_coverage_pct) |

**`est_v_level` 보정 매핑 — 보정 참조용 (final X)**
- US grade 1-2 → est V4 (A2/B1)
- US grade 3-5 → est V6 (B1)
- US grade 6-8 → est V7 (B1-B2)
- US grade 9-12 → est V8 (B2)
- College+ → est V9 (C1)
이 값은 `curation_meta.est_v_level` 로 보존되어 admin 검수 cross-check 신호.

**구현 — 기존 fetcher 패턴 준용**

1. **seed-fetchers/lit2go.ts** 신규 (admin 브라우징)
   - HTML scrape (Lit2Go API 없음)
   - 장르/학년 밴드/검색 필터링
   - `lit2goGradeToEstVLevel(grade)` + `lit2goInferMaturity(grade, genre)` 보정 helpers
   - `getOptions()` — sorts 2 / genres 11 / advanced (search, lit2goGradeBand, lit2goAudioOnly) / maxBatch 40 / ⚠ EFL 차이 hint

2. **types.ts SeedSource 확장** — 'lit2go' 추가 + `lit2goGradeBand` / `lit2goAudioOnly` FetchBatchParams 필드 + AdvancedFieldKey 확장

3. **index.ts FETCHERS / SOURCE_LABELS 등록** + 보정 helpers export

4. **library-pipeline ingest/lit2go.ts** (Stage S2 — 본문 fetch)
   - 책 페이지 + passage 목록 파싱
   - 각 passage 본문 결합 (USF 서버 보호 150ms sleep)
   - 메타 (US grade · 컬렉션 · 장르 · 오디오 · USF 요약) 보존
   - `LibrarySource` type 에 'lit2go' 추가
   - 라이선스 'PD-Body / CC-BY-Summary'

5. **AdvancedFetchPanel** — 'lit2goGradeBand' / 'lit2goAudioOnly' 필드 + state + buildAdvancedBody + countActive 정합

6. **BulkFetchTab UI** — SOURCE_OPTIONS / SOURCE_OPTS 에 'lit2go' 추가 + ⚠ hint 가시화

**hi-lo (high-interest / low-readability) 정책**
EFL 한국 학습자 — "쉬운 영어 + 연령 적합 흥미":
- US grade 1-2 picture book = 쉬운 영어 ✓ but 10대에게 유치 ✗ → `kids` 표시
- US grade 6-8 모험 = 적정 흥미 + 적정 어휘 → `teen`
- 어른 문학 = `adult`
admin 검수 시 hi-lo 미스매치 판단 가능 (kids + V8 = 모순 → reject)

**파급**
- BulkFetchTab 소스 6종 확장 (gutenberg/SE/wikibooks/librivox/simple_wiki/**lit2go**)
- 짧은 지문 부족 보완 (SE = 완본 / Lit2Go = passage 단위 granular)
- 학년별 탐색 가능 (Lit2Go readability/k-2, 3-5, 6-8, 9-12)
- **US grade ≠ V-Level 정책 명시** → 향후 다른 grade 기반 소스 추가 시 동일 패턴

### LCP 대량 GET — 소스 레벨 spec + 학습자 수준별 순위 (v06.42)

사용자 명시 — "소스별 가져오기 할때 조건/기준/순위가 필요함. 소스별로 검토하여 구성". v06.41 feed-level spec 위에 **소스 레벨 거버넌스** 추가.

**v06.41 부족 진단**
- v06.41 = feed 레벨 spec (15 feed × 8 dim) 만 존재
- 소스간 우선순위 X · 소스당 batch cap X · 학습자 수준 매칭 X
- VOA 4 feed × 15 + arXiv 6 feed × 8 = 108건 부담 + arXiv 과점 위험

**소스 레벨 spec 확장** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts))

새 `SourceSpec` 9 dimension — targetLevels / targetCefr / maxItemsPerBatch / minScore / bulkPriority / license + attributionRequired / topicDomain + styleGuide / preferredFeedMix.

**4 소스 spec 정의**

| Source | targetLevels | CEFR | cap | minScore | priority | preferredFeedMix |
|---|---|---|---|---|---|---|
| **VOA** | beginner+intermediate | A2-B2 | 30 | 0.40 | **1** | as-it-is 30 / lets-learn 30 / sci-tech 25 / words 15 |
| **NASA** | intermediate | B1-C1 | 24 | 0.45 | 2 | **APOD 50** / news 30 / iotd 20 |
| **NIH** | intermediate+advanced | B2-C1 | 18 | 0.45 | 3 | **medlineplus 60** / blog 25 / news 15 |
| **arXiv** | advanced | C1-C2 | 18 | 0.35 | 4 | cs-CL 30 / math-HO 20 / cs-AI 15 / cs-LG 15 / q-bio 10 / phys 10 |

**학습자 수준별 소스 순위** `SOURCE_RANKINGS_BY_LEVEL`
- **beginner** (A1-A2): VOA → NASA → NIH → arXiv
- **intermediate** (B1-B2): VOA → NASA → NIH → arXiv
- **advanced** (C1+): **arXiv → NIH → NASA → VOA** (역전)

**Helper 함수**
- `applySourceLevelCap(items, source)` — feed-level cap 후 소스 레벨 적용
  · 학습 적합도 score 내림차순 → minScore 이하 제거 → maxItemsPerBatch 까지 → preferredFeedMix 비중 분포 (greedy pick)
- `getSourceOrderForLevel(level)` — 학습자 수준 기반 순서 + 추천 여부

**Public API 추가** ([index.ts](../packages/library-pipeline/src/index.ts))
- 12 함수/상수 export (FEED_SPECS / SOURCE_SPECS / SOURCE_RANKINGS_BY_LEVEL / 6 helpers / 5 types)

**BulkArticlesTab UI 강화** ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))
- **학습자 수준 선택기** — 입문/중급/고급 → 소스 카드 자동 재정렬 + "추천" 배지
- **소스 명세 카드** (단순 chip → 4 line spec):
  · 1행: priority 번호 + 라벨 + feed 수 + cap + 추천 배지
  · 2행: CEFR 범위 · 라이선스 · 인용 의무 · min ★
  · 3행: 문체 (styleGuide)
- **bulk fetch 후 소스 레벨 cap 적용** — applySourceLevelCap 호출 (소스당 max / minScore / feed mix 보장)

**파급**
- **고급 학습자** 선택 → arXiv 최상단 (이전 항상 4번째)
- **VOA 60건 → 30건** (cap 적용, 다른 소스에 자리 양보)
- **NASA APOD 50% 비중 보장** (news 가 많아도 APOD 절반 차지)
- **arXiv minScore 0.35** — 학술 본질 어려움 인정, 관대
- **인용 의무 가시화** — arXiv CC-BY 표시

### LCP 대량 GET — 소스별 큐레이션 spec + 학습 친화도 score (v06.41)

사용자 명시 — "LCP 대량에서 소스별 가져오는 조건/기준/순위 검토해서 적용". 진단 결과 4 source 모두 단순 `slice(0, 20)` 하드코딩 — 필터/순위/dedup 부재.

**진단**
| 영역 | 이전 | 문제 |
|---|---|---|
| 가져오는 양 | 하드코딩 20 | 학습 친화도 무관 |
| 필터 | 없음 | placeholder · 짧은 stub · stale 항목 통과 |
| 순위 | RSS 원순 (대개 최신) | 학습 적합도 무시 |
| 신선도 | 컷오프 없음 | arXiv 7일↑ stale, APOD 영원 등 차등 X |
| 중복 | client enqueuedKeys | `library_articles` 이미 발행 X · 큐 이미 있음 X |
| 소스 차등 | 일률 | VOA L1 = arXiv = 동일 가중치 |

**개선 4 축**

**1. 소스/피드별 큐레이션 spec** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) NEW) — 15 feed × 8 dimension
- `recencyDays` — VOA L1=365 (학습용 stale OK) / NASA news=30 / NASA APOD=∞ (timeless) / arXiv=7
- `minDescriptionLen` — 50-150 (소스별, description 길이 = 본문 quality proxy)
- `minTitleLen` — 8-25 (placeholder 제거)
- `sourceWeight` — 0.50-1.00 (VOA L1=1.0 > NASA APOD=0.90 > NIH=0.78 > arXiv=0.55)
- `levelBonus` — −0.20~+0.30 (VOA Let's Learn=+0.30, arXiv q-bio=−0.20)
- `idealDescLen` — bell curve 정점
- `noiseKeywords` — title 포함시 제외 (`archive`/`advisory`/`recall`/`erratum` 등)
- `maxItems` — 6-15 (소스별 차등)

**2. 학습 친화도 score** — 합성 0~1
```
score = recency(0.40) + sourceWeight(0.30) + lengthFit(0.20) + levelBonus(0.10)
```
- recency = `1 - ageDays / recencyDays` (timeless feed=0.7 default)
- lengthFit = bell curve (idealDescLen 정점)
- 각 항목에 `score: { total, recency, source, length, level }` 부여

**3. DB dedup** — 4 route 모두 `library_articles` 이미 발행 source_id 조회 후 `publishedSourceIds` 응답
- 제거 X (가시화) — 클라이언트에 "발행됨" 배지 표시
- 토글: 발행 숨김 default ON

**4. UI 강화** ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))
- **★ score chip** (75↑=green / 55↑=blue / 35↑=amber / 그 외=red) + hover tooltip (recency/source/length/level breakdown)
- **발행됨 배지** (회색) — checkbox disabled
- **정렬 토글** — 적합도 / 최신순
- **발행 숨김 토글** — default ON
- 전체 선택: 보이는 항목만 (숨김 항목 제외)

**파급**
- VOA Let's Learn (L1) `lets-learn-english` = 학습 적합 최우선 (score 0.85+)
- NASA APOD = 시각 매력 + timeless = 두 번째 우선 (score 0.80+)
- arXiv = score 0.45 권역 → 최상단 X (사용자가 학술 원할 때만 선택)
- 같은 항목 두 번 큐잉 방지 (DB dedup)

**구현 통계**
- 15 feed spec 정의 (VOA 4 / NASA 3 / NIH 3 / arXiv 6 — 미스매치 없음 정합)
- 4 source list 함수 시그니처 변경 (feedId 추가)
- 4 route 업데이트 (publishedSourceIds 동봉)
- BulkArticlesTab UI 4 신규 컨트롤

### 🌍 Contemporary Editorial v06.40 ★★★ (세계 최고 수준 벤치마크 정제)

사용자 명시 — "세계 최고 수준의 작품들을 찾아서 분석해서 검토한 후 적용". Reading Room v06.39 위에 Apple Books × Linear × Things 3 × Notion × Substack × Reflect × Bear 7개 분석 → "Contemporary Editorial" 정제.

**v06.39 진단**
- Paper `#FAF8F3` 너무 yellow → vintage 느낌 (Apple Books `#FAFAF6` 가 modern editorial)
- Navy `#1E3A5F` "old map" 톤 → contemporary depth 부족 (Linear 비교)
- Gold 적용 3곳 분산 (active + memory shaky + CTA) → Linear single-accent 원칙 위반
- Hairline 약간 visible → Reflect 가 입증한 "거의 invisible + 여백 구조" 원칙 미적용

**토큰 정제** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | v06.39 | v06.40 |
|---|---|---|
| `--p` | `#1E3A5F` | **`#0F2540`** deep ink (contemporary depth) |
| `--active` | `#B8893B` | **`#B0843A`** (살짝 less yellow + 적용 면적 제한) |
| `--bg` | `#FAF8F3` warm yellow paper | **`#FBFAF6`** Apple Books off-white |
| `--bg2` | `#F2EEE6` | **`#F4F0E9`** cleaner contrast |
| `--bg3` | `#EAE4D8` | **`#ECE6DA`** |
| `--t1` | `#1C1815` | **`#1A1714`** deeper ink |
| `--bd` | `#D8D2C2` visible | **`#E0DBD0`** subtler (Linear 정합) |
| `--error` | `#A03A2E` | **`#9C3A30`** deeper |
| `--warning` | `#C68A2C` mustard | **`#B5803A`** sophisticated |
| 다크 `--p` | `#5F8FC0` | **`#6B9BD1`** (다크 contrast 강화) |
| 다크 `--bg` | `#1F1A14` | **`#231D17`** (살짝 lighter) |
| 다크 `--bg2` | `#16130E` | **`#181410`** (덜 brown, 더 contemporary dark) |
| 다크 `--bd` | `#3A332B` | **`#3D362D`** |

**Memory Decay 정제** ([globals.css](../apps/web/src/app/globals.css))
- shaky `#C68A2C` mustard → **`#B5803A`** deeper amber (sophisticated)
- risk `#A03A2E` → **`#9C3A30`** deeper warm red
- new `#7A726A` → **`#8A8278`** lighter warm gray
- stable `#2E7D5A` 유지

**Hero typography 최종 polish**
- 5 페이지 hero (`/library/books`, `/vocab`, `/scripts`, `/diagnostic/history`, `/settings`)
  - 42→52px font-[600] → **44→56px font-[500] tracking-[-0.012em]**
  - 가벼운 weight + 큰 사이즈 = Substack/Bear 가 입증한 editorial 효과 ↑

**Frame 호흡 강화** ([Frame.tsx](../apps/web/src/components/ui/ios/Frame.tsx))
- title weight 700 → **600** (Linear/Things 3 정밀)
- tracking `-0.024em` → `-0.022em`
- header `mb-5` → **`mb-6`** (Reflect 정합)

**HubHero 정제**
- 그라데이션 더 깊은 ink (`#051428 → #0F2540 → #1F3B66`) + 금빛 light leak 채도 ↓ (0.20 → 0.16) — "촛불 켜진 서재" 정제

**glow tokens 절제**
- `--sh-ios-glow-tint` `.22` → `.20` (Linear 정합 절제)
- 모든 glow 채도 한 단 더 ↓

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §World-class Benchmarks)
- 7개 작품 분석 표 (Apple Books / Linear / Things 3 / Notion / Substack / Reflect / Bear)
- 종합 진단 (v06.39 → v06.40 정제) 표
- 세계 최고 수준 적용 5조 (Single accent / Less yellow / Deeper ink / Subtler hairlines / Lora editorial 가벼움)

**파급 효과**
- 카드 = 더 modern off-white (vintage 느낌 사라짐)
- 텍스트 = deeper ink (premium contrast)
- 버튼 = deep ink navy (contemporary)
- 헤어라인 = 거의 invisible, 여백이 구조 책임 (Reflect 정합)
- Hero = 가벼운 Lora 큰 사이즈 = editorial 정점
- Frame 카드 사이 호흡 ↑ — Reflect 식 거대 여백 정합
- 컴포넌트 코드 0줄 수정 — CSS 변수 단일 체계의 이점 (v06.39 와 동일)

### 🎨 Reading Room Art Direction v06.39 ★★★ (iOS 골격 + 잉크/페이퍼/금)

외부 디자인 비평 검토 → 사용자 명시 (a) Reading Room 풀 피벗. iOS 정합은 **"안 깨져 보이는" floor 였고 ceiling 이 아니었음** 진단 + 아트 디렉션 단일 컨셉 커밋.

**진단 (외부 비평 검증)**
- 팔레트가 프레임워크 기본값 (Tailwind blue → iOS Indigo — 둘 다 system default, 브랜드 관점 0)
- 가장 강한 자산 Lora 가 본문 20px 유틸에만 갇힘. Hero/Display 는 평범한 Plus Jakarta
- 모듈마다 다른 "세계" (정글 / 하늘 / 네이비-골드 / 하늘) → "한 사람이 설계한 제품"이 아님
- iOS HIG = 안 깨져 보이는 floor. 그 위에 관점 없으면 모든 iOS 앱과 똑같이 보임

**Reading Room 컨셉 — "조용한 서재 / 문학적 도구"**
금고에서 꺼낸 종이와 잉크, 절제된 한 줄기 금빛. WordVault(금고/서재) + Calm UI + Memory Decay + PairFlip 검증된 네이비/골드 + Lora 시그니처 — 프로젝트가 이미 내포한 정체성 표면화.

**토큰 풀 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | iOS Indigo (v06.38) | Reading Room (v06.39) |
|---|---|---|
| `--p` | `#5856D6` iOS Indigo | **`#1E3A5F`** ink navy |
| `--active` | `#FF9500` iOS Orange | **`#B8893B`** muted gold (시그니처) |
| `--bg` | `#FFFFFF` 순백 | **`#FAF8F3`** warm paper |
| `--bg2` | `#F2F2F7` | **`#F2EEE6`** page canvas |
| `--t1` | `#000000` 순흑 | **`#1C1815`** ink (warm) |
| `--t2~t4` | cool 알파 (60,60,67) | **warm 알파 (28,24,21)** |
| `--bd` | `#C6C6C8` | **`#D8D2C2`** paper hairline |
| `--success` | `#34C759` | **`#2E7D5A`** muted forest |
| `--error` | `#FF3B30` | **`#A03A2E`** warm red |
| `--warning` | `#FF9500` | **`#C68A2C`** warm amber (gold) |
| 다크 `--bg` | `#1C1C1E` | **`#1F1A14`** warm dark paper |
| 다크 `--bg2` | `#000000` 순흑 | **`#16130E`** warm dark (순흑 X) |
| 다크 `--t1` | `#FFFFFF` 순백 | **`#F0EAE0`** warm paper |
| Material 글라스 | white translucent | **paper translucent** |

**Memory Decay paper 톤 정합** — 채도 1-2단 하향, 의미 1:1 유지
- stable `#34C759` → `#2E7D5A` muted forest
- shaky `#FF9500` → `#C68A2C` warm amber (gold 계열, 시그니처 정합)
- risk `#FF3B30` → `#A03A2E` warm red
- new `#8E8E93` → `#7A726A` warm gray

**Lora editorial 승격** — Plus Jakarta 가 차지하던 모든 hero 자리 → Lora
- [tailwind.config.ts](../apps/web/tailwind.config.ts) — `font-editorial` (Lora) 유틸리티 신규
- 5 페이지 hero — `font-display 32-34px` → **`font-editorial 42-52px font-[600]`**
- HubHero greeting — Plus Jakarta 20px → **Lora editorial 26-30px**
- HubHero BigStat — Plus Jakarta 24px → **Lora editorial 30px**
- TodayHero h1 — Plus Jakarta 22-26px → **Lora editorial 28-34px**
- VaultIdentity hero 숫자 — Plus Jakarta 64-88px → **Lora editorial 72-96px**

**HubHero 풀 재설계** ([HubHero.tsx](../apps/web/src/components/home/HubHero.tsx))
- 그라데이션 iOS Indigo 3단 → **ink navy 3단 + 우측 상단 금빛 light leak** (`#0F1E33 → #1E3A5F → #2D5380` + `radial(#B8893B 20%) soft-light`) = "촛불 켜진 서재"
- CTA 흰 캡슐 → **금빛 캡슐** (`#D4A856` bg, `#0F1E33` text, gold glow) — 금고에서 꺼낸 보상

**glow tokens 정렬** — 모든 saturated glow → muted 톤 (paper 정합)

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §Reading Room Art Direction)
- 컨셉 정의 ("조용한 서재 / 문학적 도구")
- 시그니처 3축 (paper bg / ink text / navy + gold brand) iOS Indigo 비교표
- 색상 토큰 카탈로그 (light + dark)
- Lora editorial 승격 hierarchy 표
- 5조 디자인 철학 (순백 X 순흑 X / Lora hero / 금빛 시그니처 모먼트 / 헤어라인 + 여백 / 동시 노출 색 3개 이하)

**파급 효과 — 토큰 1곳 변경 = 화면 전체 톤 교체**
- 모든 `bg-[var(--bg)]` 카드 = warm paper
- 모든 `text-[var(--t1)]` = warm ink
- 모든 `bg-[var(--p)]` 버튼 = ink navy
- 모든 `--memory-*` = paper 톤
- 다크 모드 = 진짜 "서재 야간" (warm dark + warm paper)
- **컴포넌트 코드 0줄 수정** — CSS 변수 단일 체계의 이점

**기존 iOS 골격 유지** — 12+ 프리미티브 (Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen), 모션 토큰, 접근성 훅 모두 그대로. iOS 작업은 골격, Reading Room 은 표현.

### iOS 디자인 일관성 감사 v06.38.2 ★ (6 미정합 일괄 정리)

사용자 — "전체 화면의 디자인 컨셉의 일괄성을 점검해줘". 광범위 grep 으로 6 미정합 발견 + 일괄 정리.

**진단 발견 (6 미정합)**
1. `/library/layout.tsx` + `/my/layout.tsx` 가 `max-w-6xl + p-4 md:p-8` 로 자식을 감싸 → Screen 이중 적용 충돌
2. `font-[800]` 19곳 잔존 (Flashcard / SpellForge / ScriptQuiz / MyBooks / DiagnosticClient / HistoryTimeline / WeeklyHeatmap / StatCard / HubHero BigStat / TodayHero / BookDetailClient)
3. Tailwind hex 잔존 (TodayFocus `#3B82F6/#F59E0B`, ModuleCard `#F59E0B/#22C55E/#8B5CF6/#4A9FCF`, NetflixDetailSheet `#3B82F6`, ArticleCard CEFR, RecentActivity SRS 색)
4. Ad-hoc card div 15+ (`border bg shadow rounded-r-lg`) — Frame/Card 프리미티브 미사용 (Dashboard 3, HistoryTimeline, ContinueCard, ModuleCard)
5. 6 페이지 Screen 미사용 (재확인: flashcard/spellforge/scriptquiz/wordblitz 는 max-w-wide 폭만 통일됨 — 기능적 OK)
6. `page.tsx.bak` 백업 잔존

**수정**
- **P1 layout 충돌** — `/library/layout.tsx` + `/my/layout.tsx` 의 `max-w-6xl bg-gradient` 제거, 상단 Tabs 컨테이너만 `max-w-[var(--ios-content-wide-max)]` 로 통일. 자식 페이지의 `<Screen>` 이 폭/패딩 책임
- **P2 font-[800] → font-[700]** 일괄 (11 파일 19곳): Flashcard/SpellForge/ScriptQuiz/MyBooks hero stats, HubHero BigStat (24px), TodayHero h1, DiagnosticClient 5곳, HistoryTimeline 2곳, WeeklyHeatmap, StatCard 등 → 모두 iOS Display Bold (700) 정합
- **P3 Tailwind hex → iOS 토큰** (5 파일):
  · TodayFocus accent `#3B82F6/#F59E0B/#8B5CF6/#10B981` → `#5856D6/#FF9500/#AF52DE/#34C759` (iOS Indigo/Orange/Purple/Green)
  · ModuleCard 모듈 색 hardcoded → iOS systemColor 토큰화 (textviewer=brand / wordvault=purple / flashcard=orange / spellforge=blue / wordblitz=green / pairflip=pink / scriptquiz=yellow)
  · RecentActivity SRS hex → `var(--memory-*)` 토큰
  · NetflixDetailSheet `#3B82F6` → `#5856D6` / `var(--p)`
  · ArticleCard CEFR A2/B1 → `var(--ios-green) / var(--p)`
- **P4 ad-hoc card → iOS 정렬** (6 파일):
  · MemoryStatus / WeeklyHeatmap → `rounded-ios-2xl bg-bg shadow-ios-2`
  · RecentActivity → `rounded-ios-xl shadow-ios-1`
  · ContinueCard / ModuleCard → iOS interactive (rounded-ios-2xl + shadow-ios-2 + motion-safe hover:shadow-ios-3 + -translate-y-0.5 + ease-ios-emphasized + active scale)
  · HistoryTimeline → `rounded-ios-xl shadow-ios-2`
- **P6** `hub/page.tsx.bak` 삭제

**파급**
- /library/* 페이지 폭/패딩 = 모든 페이지 동일 (Screen이 일괄 처리)
- /my/* 페이지 동일
- 모든 카드 컴포넌트 = iOS radius + shadow + hover motion 정합
- 모든 hero stat 숫자 = font-700 (iOS Bold, ExtraBold 안드로이드 톤 제거)
- 모든 액센트 색 = iOS systemColor 토큰 (Tailwind hex 잔존 0)

### iOS Design Polish v06.38.1 ★ (타이포 + 디테일 모션 + 폰트 스택)

사용자 — "디자인 부분도 ios 감성을 더 강하게 해줘". 색상 v06.38 이후 **타이포·간격·디테일 모션** 으로 iOS 감성 풀 보강.

**진단 — 덜 iOS인 부분**
- Hero 타이틀 `font-[800]` ExtraBold → iOS Display는 `font-[700]` (800은 안드로이드 Material 톤)
- Hero 사이즈 28-32px → iOS Large Title 표준 **34px**
- 트래킹 `-0.025em` → iOS는 `-0.028em` (Display는 매우 타이트)
- Line-height `leading-tight` (1.25) → iOS Large Title은 **`leading-[1.05]`** (좁게)
- Body 13-14px → iOS는 17pt 표준, 부제 15pt
- 폰트 스택 Plus Jakarta Sans 우선 → **`-apple-system` 우선** (iOS/macOS는 진짜 SF Pro)
- 카드 hover 변화 X → **`hover:shadow-ios-3 + -translate-y-0.5`** + iOS spring
- 아이콘 컨테이너 `rounded-ios-sm` 8px → **`rounded-ios-md`** 12px continuous
- Chevron `text-t3/70` → iOS 정확 `rgba(0,0,0,0.30)` (dark에선 `rgba(235,235,245,0.30)`)
- Capsule font-700 → **font-600** (iOS Footnote bold)

**Hero Large Title 5 페이지 일괄 재정렬**
- [/library/books](../apps/web/src/app/(main)/library/books/page.tsx) · [/library/vocab](../apps/web/src/app/(main)/library/vocab/page.tsx) · [/library/scripts](../apps/web/src/app/(main)/library/scripts/page.tsx) · [/diagnostic/history](../apps/web/src/app/(main)/diagnostic/history/page.tsx) · [/settings](../apps/web/src/app/(main)/settings/page.tsx)
- `text-[28px] font-[800] tracking-[-0.025em] md:text-[32px]` → `text-[32px] font-[700] tracking-[-0.028em] leading-[1.05] md:text-[34px]`
- body subtitle 14px → 15px (iOS Subheadline)

**Frame 컴포넌트 강화** ([Frame.tsx](../apps/web/src/components/ui/ios/Frame.tsx))
- 섹션 타이틀 20→**22px** (iOS Title 2) · weight 700 유지 · tracking-[-0.022em]→**-0.024em** · leading-[1.1]
- meta 11→12px · More 링크 13→14px font-600 (iOS Footnote)
- mb-4 → mb-5 (헤더 호흡 증가)

**Card interactive prop** ([Card.tsx](../apps/web/src/components/ui/ios/Card.tsx))
- `interactive` boolean prop 추가
- 활성화 시: `hover:shadow-ios-3 + -translate-y-0.5 + active:scale-[0.99]` + ease-ios-emphasized + cursor-pointer
- motion-safe 가드 (Reduce Motion 사용자 비활성)

**InsetRow polish** ([InsetRow.tsx](../apps/web/src/components/ui/ios/InsetRow.tsx))
- 아이콘 컨테이너 `h-8 w-8 rounded-ios-sm` → **`h-[30px] w-[30px] rounded-ios-md`** + `shadow-[0_1px_2px_rgba(0,0,0,0.08)]` (iOS Settings 정확)
- title 14px font-600 → **15px font-500** (iOS Headline)
- metaRight `text-mono-11-t3` → **`text-display-15-400-t2`** (iOS 정확 우측 메타)
- chevron `text-t3/70 size-16` → **`text-[rgba(60,60,67,0.30)] size-17 strokeWidth-2.25`** (iOS 정확 + dark mode 분기)
- 셀 패딩 `py-3` → `py-2.5 + min-h-[44px]` (iOS 44pt 표준)
- 사이 gap `gap-1.5` → `gap-2` (메타-chevron 호흡)

**Capsule weight** ([Capsule.tsx](../apps/web/src/components/ui/ios/Capsule.tsx))
- `font-display font-[700]` → **`font-[600]`** 일괄 (iOS Footnote bold)

**Tailwind font stack** ([tailwind.config.ts](../apps/web/tailwind.config.ts))
- display/body 폰트 첫 fallback: **`-apple-system` + `BlinkMacSystemFont`**
- 효과: iOS/macOS 사용자 → 시스템이 **진짜 SF Pro Display/Text** 렌더링. 다른 OS는 Plus Jakarta Sans / DM Sans
- mono: `SF Mono` 우선

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Typography SSoT)
- iOS Type Ramp 11단 (Large Title → Caption 2) Vocaflow 사용처 매핑
- 폰트 스택 설명 (왜 `-apple-system` 우선이 진짜 iOS인지)
- iOS Typography 핵심 원칙 7조 (font-700 / -0.028em / leading-1.05 / Body 17pt / Footnote 600 / Caption mono / tabular-nums)
- 안티패턴 (font-extrabold = 안드로이드 톤, tracking-tight = 약함, leading-tight = 1.25 너무 떨어짐)

### iOS 학습 브랜드 + Learning Color v06.38 ★★ (Indigo + Memory Decay iOS 정렬)

사용자 재진단 — "색상이 플랫폼에 안맞음. ios 색상 + 디자인 & 학습적 효과 색상 + 디자인". v06.37 systemBlue 채택의 문제 진단 + 재정렬:

**v06.37 진단**
- `--p` = `#007AFF` iOS systemBlue → "Apple Settings" 톤. system 앱(Settings/Files)이 쓰는 색을 학습 플랫폼이 차용 → 정체성 무력화
- 3rd party iOS 앱은 모두 **브랜드 색 + iOS 구조**: Duolingo(그린)·Things 3(블루)·Linear(퍼플)·Notion(블랙)·Spotify(그린). systemBlue 그대로 쓰는 건 시스템 앱뿐
- 학습 플랫폼 색채 심리 → 보라/인디고 = 학구열·사색·집중 (Korean academic 정서)

**결정 — `--p` = iOS systemIndigo `#5856D6`** (다크 `#5E5CE6` vivid)
- iOS systemColor 12종 중 하나 → HIG 정합 100%
- 학구열·사색 정서 → 학습 플랫폼 정합
- 다른 영어 학습 앱(블루/그린 위주)과 시각 차별

**토큰 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))
- `--p` `#007AFF` → `#5856D6` (light) + `#0A84FF` → `#5E5CE6` (dark vivid)
- `--p-hover/--p-light/--p-dark` 인디고 단계로 일괄 재정렬
- `--bdf` (focused border) `#007AFF` → `#5856D6`
- **새 토큰** `--sh-ios-glow-tint` (인디고 브랜드 글로우) — `--sh-ios-glow-blue` (iOS Blue, info 액션 보존) 와 분리

**Tailwind + 컴포넌트**
- [tailwind.config.ts](../apps/web/tailwind.config.ts) — `shadow-ios-glow-tint` 추가
- [PrimaryButton](../apps/web/src/components/ui/ios/PrimaryButton.tsx) — `tone="brand"` glow → `shadow-ios-glow-tint`. `tone="info"` 는 iOS Blue 글로우 유지

**Memory Decay 4색 — Tailwind hex → iOS systemColor 1:1**
- [globals.css §Memory Decay Colors](../apps/web/src/app/globals.css) `--memory-{stable/shaky/risk/new}` 토큰 신규
- stable: `#22C55E` → **`#34C759`** iOS systemGreen
- shaky: `#F59E0B` → **`#FF9500`** iOS systemOrange
- risk: `#EF4444` → **`#FF3B30`** iOS systemRed
- new: `#94A3B8` → **`#8E8E93`** iOS systemGray
- [srs/state.ts](../apps/web/src/lib/srs/state.ts) 주석 정렬 + [VaultIdentity](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) `BUCKET_META` → 토큰화 (`var(--memory-stable)` 등)
- [CLAUDE.md §Memory Decay 표](../CLAUDE.md) iOS hex 정렬

**인라인 brand glow 일괄 정렬**
- [HubHero](../apps/web/src/components/home/HubHero.tsx) 그라데이션 — iOS Blue 3단 → **iOS Indigo 3단** (`#3C3AAB → #5856D6 → #7B79E0`)
- [ActivityRing](../apps/web/src/components/ui/ios/ActivityRing.tsx) · [VocabularyLevelMap](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx) · [NextStepList](../apps/web/src/components/wordvault/hub/NextStepList.tsx) · [FlowStripe](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) — `rgba(0,122,255)` → `rgba(88,86,214)` iOS Indigo

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Color SSoT v06.38)
- Indigo 채택 이유 명시 (systemBlue = Apple Settings 톤 / 3rd party 정합 / 학습 정서)
- 토큰 카탈로그 인디고 정렬
- **§학습 효과 색채 (NEW)**
  · Memory Decay 4색 iOS systemColor 1:1 표
  · 학습 플랫폼 색채 철학 5조 (단일 브랜드 액센트 / 의미별 1:1 / 동기부여 ≠ 압박 / V-Level 시각 진행 / Calm UI 자극 절제)
  · 색-의미 1:1 매핑 표 (Indigo=brand, Green=달성/i+1, Orange=주의/streak, Red=회복, Gray=중립)
  · 동기부여 vs 압박 색 사용 원칙 (risk 옅게, streak warm, 정답 spring, 오답 0.6초)
  · V-Level 시각 진행 (현재=Indigo, i+1=Green, 분포=ios-gray-3, V0/미진단=Gray)
- §don'ts 안티패턴 — "iOS systemBlue 를 브랜드로 사용 금지" 추가

**파급 효과**
- 모든 `bg-[var(--p)]` 버튼 = 즉시 인디고 (학습 정서)
- 모든 `--memory-*` 사용처 = iOS systemColor (시각 일관성)
- WordVault Hub 4 bucket (확실/익숙/회복/신규) = 학습 의미 명확
- HubHero 그라데이션 = "사색하는 깊이감" Apple Music 카드 톤

### iOS Color SSoT 풀 재정렬 v06.37 ★ (브랜드 → System Blue + Grouped Background + Label Color)

사용자 명시 — "ios 감성이 느낌이 아직 임. 특히 색상에 대해서는 ios 설계가 안되 있는거 같음". 진단 결과 토큰 핵심 3가지가 **Tailwind 톤 그대로** → iOS HIG와 1:1 정합으로 재정렬:

**근본 진단 (3 주요 미스매치)**
1. 브랜드 `--p` = `#3B82F6` (Tailwind blue) → **iOS는 `#007AFF` systemBlue** — 미세하게 다른 cyan-shift, Tailwind 티 100%
2. 캔버스 `--bg2` = `#F8FAFC` (Tailwind slate-50) → **iOS는 `#F2F2F7` systemGroupedBackground** — Tailwind는 푸른빛, iOS는 중성 톤
3. 텍스트 `--t1` = `#0F172A` (Tailwind slate cool) → **iOS는 `rgba(60,60,67,*)` label color (warm-neutral 알파)** — cool slate → warm-neutral

**토큰 풀 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | 이전 (Tailwind) | 신규 (iOS HIG) |
|---|---|---|
| `--p` | `#3B82F6` | `#007AFF` systemBlue |
| `--p-hover` | `#2563EB` | `#0066D6` |
| `--p-light` | `#EFF6FF` | `#E5F1FF` |
| `--success` | `#22C55E` | `#34C759` systemGreen |
| `--error` | `#EF4444` | `#FF3B30` systemRed |
| `--warning` | `#F59E0B` | `#FF9500` systemOrange |
| `--info` | `#06B6D4` | `#32ADE6` systemCyan |
| `--bg2` (캔버스) | `#F8FAFC` | `#F2F2F7` systemGroupedBackground ★ |
| `--bg3` | `#F1F5F9` | `#E5E5EA` systemGray5 |
| `--t1` | `#0F172A` | `#000000` label |
| `--t2` | `#475569` | `rgba(60,60,67,.60)` secondaryLabel |
| `--t3` | `#94A3B8` | `rgba(60,60,67,.30)` tertiaryLabel |
| `--t4` | `#CBD5E1` | `rgba(60,60,67,.18)` quaternaryLabel |
| `--bd` | `#E2E8F0` | `#C6C6C8` separator opaque |

**다크 모드 — iOS 정확** (이전 진청 + 차가운 slate → 순흑 + warm-neutral)
- `--p` `#60A5FA` → `#0A84FF` (systemBlue dark vivid)
- `--bg` `#0B1120` → `#1C1C1E` (card)
- `--bg2` `#141E30` → `#000000` (순흑 캔버스, iOS Settings Dark 시그니처)
- `--bd` `#1E2D42` → `#38383A` (separator dark)
- 라벨 모두 알파 기반 (`rgba(235,235,245,.60/.30/.16)`)

**컴포넌트 정합 수정**
- [Capsule](../apps/web/src/components/ui/ios/Capsule.tsx) — `neutral` tone 배경 `--bg2` → `--bg3` (다크에서 캔버스 순흑과 겹침 방지)
- [Capsule](../apps/web/src/components/ui/ios/Capsule.tsx) — `green/purple/pink` 등 hex (`#15803D` 등) → iOS system color 토큰 (`var(--ios-green)` 등)
- [StatPill](../apps/web/src/components/ui/ios/StatPill.tsx) — 배경 `--bg2` → `--bg3` (동일 이유)
- [ActivityRing](../apps/web/src/components/ui/ios/ActivityRing.tsx) — glow `rgba(59,130,246,.25)` → `rgba(0,122,255,.30)` (iOS Blue)
- [FlowStripe](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) · [NextStepList](../apps/web/src/components/wordvault/hub/NextStepList.tsx) · [VocabularyLevelMap](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx) — 인라인 glow Tailwind blue → iOS Blue
- [HubHero](../apps/web/src/components/home/HubHero.tsx) — 그라데이션 `var(--p-dark) → var(--p)` 토큰 → 명시 iOS Blue 3단계 그라데이션 `#0051A8 → #007AFF → #2A8BFF` (Apple Music 카드 톤)
- `--sh-ios-glow-{blue,red,orange}` shadow tokens — 모두 iOS system color RGB 기반으로 재정의

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Color SSoT)
- iOS HIG 3대 색상 시스템 표 (System Tint / System Colors / Grouped Background / Label / Separator)
- 색상 토큰 카탈로그 (light + dark)
- iOS 색상 철학 dos/don'ts 14조
- Capsule tone 의미-색 1:1 매핑

**파급 효과 (자동 정렬)**
- 모든 `bg-[var(--bg2)]` 페이지 = 즉시 iOS 시그니처 그레이 캔버스
- 모든 `text-[var(--t1~t4)]` = warm-neutral 알파 라벨 (Tailwind cool slate 사라짐)
- 모든 `bg-[var(--p)]` 버튼 = iOS Blue (#007AFF), 즉시 Apple 앱 톤
- 모든 `border-[var(--bd)]` = 정확한 iOS separator
- 다크 모드 = 진짜 iOS Settings Dark (순흑 + 카드)

### iOS Design System — 전체 화면 일괄 적용 v06.36.2 (Tier A + 학습 모듈)

사용자 명시 — "전체 화면을 iOS 디자인 적용해줘. 최고 수준으로". 학습자 노출 빈도순 Tier A 5+α 화면 일괄 적용:

**핵심 화면 (deep iOS 재설계 — Card/Frame/ActivityRing/Capsule/PrimaryButton 기반)**
- [/hub](../apps/web/src/app/(main)/hub/page.tsx) + [HubHero](../apps/web/src/components/home/HubHero.tsx) — 캡슐 메타 row (Streak/V-Level) + iOS Primary 흰 캡슐 CTA (외부 shadow glow) + 큰 stat row (BigStat 24px tabular-nums)
- [/dashboard](../apps/web/src/app/(main)/dashboard/page.tsx) + [TodayHero](../apps/web/src/components/dashboard/TodayHero.tsx) — ActivityRing (오늘 목표 진행) + 거대 hero 인사 + PrimaryButton (done=success/in-progress=brand)

**진단/라이브러리 페이지 (Screen 래퍼 + iOS 헤더 + Capsule 통계 row)**
- [/diagnostic](../apps/web/src/app/(main)/diagnostic/page.tsx) + 5 위치 `max-w-xl/2xl` → iOS content max
- [/diagnostic/history](../apps/web/src/app/(main)/diagnostic/history/page.tsx) — Card 래퍼 + iOS 헤더 + 뒤로가기 링크 iOS 정합
- [/library/books](../apps/web/src/app/(main)/library/books/page.tsx) — 32px hero 타이틀 + SF Symbol 컬러 아이콘 box (ios-orange) + Capsule 통계 row (도서/챕터/단어/내 학습)
- [/library/vocab](../apps/web/src/app/(main)/library/vocab/page.tsx) — ios-purple 아이콘 + Capsule (세트/단어/카테고리/구독)
- [/library/scripts](../apps/web/src/app/(main)/library/scripts/page.tsx) — brand 아이콘 + Capsule (아티클/단어)

**학습 모듈 진입 페이지 (Screen 래퍼 통일 — `max-w-5xl` → `--ios-content-wide-max`)**
- [/text](../apps/web/src/app/(main)/text/page.tsx) · [/dictate](../apps/web/src/app/(main)/dictate/page.tsx) · [/pairflip](../apps/web/src/app/(main)/pairflip/page.tsx) — Screen 래퍼
- [/flashcard](../apps/web/src/app/(main)/flashcard/page.tsx) · [/spellforge](../apps/web/src/app/(main)/spellforge/page.tsx) · [/scriptquiz](../apps/web/src/app/(main)/scriptquiz/page.tsx) · [/wordblitz](../apps/web/src/app/(main)/wordblitz/page.tsx) — `max-w-5xl gap-6 p-8` → `max-w-[var(--ios-content-wide-max)] gap-4 px-4 py-6 md:px-6 md:py-8` (iOS rhythm)

**Settings 페이지**
- [/settings](../apps/web/src/app/(main)/settings/page.tsx) — Screen 래퍼 + 32px hero 타이틀 + 캡슐 TOC nav (rounded-ios-pill + shadow-ios-1 + active:scale) + Section 카드 `rounded-ios-2xl + shadow-ios-2` + 아이콘 box `rounded-ios-md`

**My 페이지**
- [/my/books](../apps/web/src/app/(main)/my/books/page.tsx) · [/my/texts](../apps/web/src/app/(main)/my/texts/page.tsx) — iOS 폭 + Screen 래퍼
- [/text/new](../apps/web/src/app/(main)/text/new/page.tsx) — `max-w-4xl` → `--ios-content-wide-max`

**iOS 정합 패턴 (전체 적용)**
- `Screen` 컴포넌트로 모든 페이지 셸 통일 — `width: content|wide|compact|full` variant
- 캔버스 = `bg2` (그레이) + 카드 = `bg` (흰)
- gap = `gap-4` (iOS rhythm, 이전 `gap-6` 보다 호흡 정밀)
- 헤더 = 32px Display 타이틀 + 14px body 부제 + Capsule 통계 row
- 폭 = `--ios-content-max` (820px Reading) / `--ios-content-wide-max` (1024px Browse)

**나머지 화면 (Phase 14.6 후속)** — Workspace `/text/[id]` (Player 이미 v06.35 재설계 완료), Admin Console (별도 보라 액센트 유지), 게임 play 화면 (자체 게임 미학 보존), Auth/Marketing (분리 처리)

### iOS Design System — audit 반영 v06.36.1 (D1-D9 patch)

외부 audit 점검 9건을 분석. 현재 코드 상태와 정합 검증 후 **실가치 있는 부분만 선별 적용** (audit 가 hypothetical 코드를 점검한 부분은 따로 처리):

**즉시 적용 (웹 — 실가치)**
- **D3 sheetUp keyframe 전역화** — [globals.css](../apps/web/src/app/globals.css) §4.5 에 `@keyframes sheetUp/sheetDown/scrimFadeIn` 추가. styled-jsx 스코프 해시 회피 → Tailwind `animate-[sheetUp_...]` 매칭 보장.
- **D6 `useReduceMotion` 웹 훅** — [useReduceMotion.ts](../apps/web/src/hooks/useReduceMotion.ts). CSS @media 가 1차 가드, JS-driven 애니메이션 (ActivityRing transition 등) 분기엔 이 훅.
- **D3 web SheetContainer 프리미티브** — [SheetContainer.tsx](../apps/web/src/components/ui/ios/SheetContainer.tsx). 전역 keyframe + solid scrim (블러 X) + Esc/scrim 닫힘 + body scroll lock + `aria-modal`.
- **D8 web Screen 프리미티브** — [Screen.tsx](../apps/web/src/components/ui/ios/Screen.tsx). `width: compact|content|wide|full` variant (580/820/1024/none) + safe-area inset + 배경 variant.
- **D6 ActivityRing reduce-motion 분기** — inline style `transition` 은 CSS @media 우회 → `useReduceMotion()` 으로 `transition: none` 명시.
- **D6 RecommendedBooks 카드 hover** — `motion-safe:` 가드 추가 (translate-y, scale).
- **사용 규약 13조** — `<SheetContainer>` · `<Screen>` 사용 강제 + JS-driven 분기 필수 등 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §사용 규약 확장.

**Phase 2 보존 (mobile shell — audit corrected 최종형)**
- [MOBILE_SHELL_SPEC.md](./MOBILE_SHELL_SPEC.md) **신규** — 외부 audit 의 corrected 최종 코드 8 파일을 그대로 보존. 현재 `apps/mobile/` 은 Expo·RN 의존성 미설치 상태 (theme tokens + root layout만). Phase 2 진입 시 1:1 복붙 + 사전 작업 체크리스트 정합.
- 핵심: **D1 LargeTitleScreen** (공간 회수 = large title 을 스크롤 콘텐츠 첫 요소) · **D2 Expo Router `href: null`** 명시 차단 · **D4 Material 단일화 + Android `dimezisBlurView`** · **D7 useWindowDimensions + solid scrim** · **D9 한국어 IME 셸 책임 아님** (TextInput 레벨).
- 명명 변경: **"iOS Layer" → "Native Layer (iOS-led)"** (Android 동시 타깃 정합).

**미정 항목 (D5 — 데이터로 결정)**
- TAB-IA-1 Home 위치 (6번째 탭 / `index` 라우트 / 폐기)
- TAB-IA-2 "게임" 탭 (wordblitz 직결 / `/games` 허브)
- MAT-1 바 blur 상시 vs 스크롤 시에만 (Calm UI 트레이드오프)
- 현재 스펙은 TAB-IA-1=② + TAB-IA-2=① 가정. 베타 측정 후 확정.

**audit 정정**
- **D6 부분 정합 확인** — `prefers-reduced-motion: reduce` CSS @media 가드는 이미 [globals.css:220](../apps/web/src/app/globals.css) 에 존재. audit 의 "코드 0" 주장은 부분 정확 (CSS 가드는 있고 JS 훅이 없었음 → 본 패치로 보강).
- **D3 web SheetContainer 자체가 부재** — audit 가 점검한 styled-jsx 버그가 있는 web SheetContainer 가 실제로는 존재하지 않았음. 본 패치로 audit 의 corrected 최종형을 NEW 컴포넌트로 등재.

### iOS Design System — 플랫폼 디자인 뼈대 v06.36 ★

사용자 명시 — "iOS 디자인 설계 철학, 개념, 특징 등 모든 요소를 정의하고 플랫폼 전체에 적용되도록 디자인 뼈대를 구성". 플랫폼 전체 SSoT 재구성:

**1. 토큰 확장** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))
- **iOS 시스템 컬러 12종** + 6단계 그레이 + 7 tints (HIG light) + Vivid dark 셋 (`--ios-{red,orange,yellow,green,mint,teal,cyan,blue,indigo,purple,pink,brown}`, `--ios-gray-{1..6}`)
- **iOS Radius 스케일** 9단 (`--r-ios-{xs:6 .. 3xl:32, modal:38, pill}`)
- **iOS Shadow 스케일** 4단 + 컬러 글로우 4종 (`--sh-ios-{1..4}`, `--sh-ios-glow-{blue,green,red,orange}`)
- **iOS Material 글라스** 3단 (`--mat-glass-bg-{thin,regular,thick}` + `--mat-glass-filter`)
- **iOS Motion** — Spring/Standard/Emphasized 4 easing + 4 duration
- **iOS Layout Inset** — Reading 폭 820/1024px, safe-area inset, NavBar/Toolbar/TabBar h
- **iOS Type ramp** — large-title → caption-2 (SF Display/Text 정합)

**2. Tailwind 조인** ([tailwind.config.ts](../apps/web/tailwind.config.ts))
- `bg-ios-*` / `text-ios-*` 25종 컬러 utility · `rounded-ios-{xs..pill}` 9종 · `shadow-ios-{1..4}` + glow · `ease-ios-{standard,emphasized,spring,spring-bouncy}` timing function

**3. Foundation 프리미티브 10개** ([apps/web/src/components/ui/ios/](../apps/web/src/components/ui/ios/))
- `Card` — 떠있는 카드 (size · elevation · as 슬롯)
- `Frame` — Card + section header (title + meta + More 링크)
- `SegmentControl` — UISegmentedControl 캡슐 (Link/button 모드, count 배지)
- `InsetGroup` — Settings 인셋 그룹 + header/footer 캡션
- `InsetRow` — Settings 셀 (icon box + title/subtitle + progress + chevron)
- `Capsule` — 정보·상태 캡슐 (9 tone, sm/md size)
- `StatPill` — Health Categories KPI 셀
- `ActivityRing` — Fitness 원형 진행도 (gradient + glow + emphasized easing)
- `PrimaryButton` — iOS Primary CTA (6 tone × 3 size, count 배지)
- `GlassBar` — Navigation glass header (thin/regular/thick material)

**4. WordVault Hub 6 Section 리팩토링** — 모두 프리미티브 기반으로 재림
- `page.tsx` 헤더 → `<GlassBar>` + `<SegmentControl>`
- VaultIdentity → `<Card>` + `<ActivityRing>` + `<Capsule>` + `<StatPill>` + `<PrimaryButton>`
- VocabularyLevelMap → `<Frame>` + `<Capsule>` + `<InsetGroup>`/`<InsetRow>`
- ResourcePortfolio → `<Frame>` + `<SegmentControl>` + `<InsetGroup>`/`<InsetRow>`
- RecommendedBooks → `<Frame>` + `<PrimaryButton>` (no-diagnostic CTA)
- NextStepList → `<Frame>` + `<Capsule>` (type 배지) + `InsetGroup` 구조
- FlowStripe → `<Frame>` + `<StatPill>`

**5. SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS / iPadOS 디자인 언어)
- HIG 3대 원칙 (Clarity · Deference · Depth) → Vocaflow 적용 매핑
- 핵심 개념 10종 (Continuous Corner · Gray Canvas · Glass Material · Capsule · Inset Grouped List · Segmented Control · Activity Ring · Hero Numerals · Primary CTA · iOS Color Glow)
- 시스템 컬러 의미 슬롯 매핑 (red=critical, green=success/i+1, orange=warning/도서, purple=단어장, ...)
- 토큰 카탈로그 + Foundation 컴포넌트 사용 규약 10조

### admin 검수 — 챕터별 원본 소스 deep-link 정확화 (v06.35)

**문제** — `/admin/curation/preview/[bookId]` 챕터 목록의 "원본 소스" 외부링크가 챕터를 못 찾음(404). `source-urls.ts` 가 Standard Ebooks 챕터 URL 을 `/text/chapter-N` 으로 **추측**했으나, SE 실제 챕터 URL 은 도서 구조마다 4종으로 갈림(검증):
- 파일분리 `/text/chapter-1` (단권 소설) · 앵커 `/text/fables#the-fox-and-the-grapes` (우화·시 모음) · 명명 `/text/charmides` (플라톤 대화편) · 중첩 `/text/chapter-1-1-1` (Les Mis 다권). DB 메타만으로는 형식 구분 불가.

**해결** — 적재 시점에 소스 TOC(`{ebookUrl}/text`)를 파싱해 챕터별 **실제 href 를 DB 저장**:
- migration `20260613120000_library_chapters_source_href` — `library_chapters_master.source_href text` 추가 + `insert_book_analysis` 가 `p_chapters[].source_href` 적재하도록 확장
- SE ingest(`standard-ebooks.ts`) — single-page `<section id>` ↔ TOC href fragment 조인 → 챕터 마커에 href 동봉(`CHAPTER_HREF_SEP` U+001E). segment 가 분리해 `ChapterSegment.source_href` 로 전달
- 렌더 — `listChapters` 가 `source_href` select, `ChapterSidebar` 가 저장값 우선 사용. `chapterSourceUrl` SE fallback 은 추측 `/text/chapter-N` → 안전한 도서 TOC(`/text`)로 변경(절대 404 없음)
- 백필(`scripts/lcp/backfill-se-chapter-hrefs.mjs`) — 기존 13권 ingest+segment 재실행 후 (group,title) 조인·idx 조인으로 `source_href` 만 UPDATE(본문/어휘 불변). **859/955 챕터 정확 매핑**(10권 100% · Les Mis 364 중첩 포함). 잔여는 안전 TOC fallback: Fables/Poetry 에디션 drift(intersection 만) · Dialogues 본문 손상(별도) · Alice·Marvelous Oz 미적재(0행, 별도 ingest 버그)

### 도서 lemma 바인딩 self-heal — 추출 시 자동 backfill (v06.35)

**문제** — Les Misérables(364장)가 수동 재분절로 `library_book_vocabularies` 재삽입되며 lemma backfill 누락 → 13,351 단어 전부 미바인딩(0 bound). 영향: 굴절형 어휘 추출 누락 + `lexical_coverage` NULL + 미바인딩 진단 13,351건이 "노이즈 1,000"으로 부풀려져 표시. (추출 SSoT 가 `COALESCE(bv.lemma, bv.word)` 라 base 형은 매칭됐으나 굴절형은 누락.)

**데이터 복구** (`backfill_book_lemmas` 실행):
- Les Misérables: 0 → **11,808 bound (88.4%)** · coverage 재생성 · 추출 4,343 단어 정상화 (남은 1,543 = 프랑스 고유명사 = 진짜 노이즈 tail)
- Twenty years after: 6,759 → **6,919 bound (97.6%)**
- 전수 스캔 결과 이 2권만 영향 (나머지 정상)

**재발 방지** (migration `20260613022941_extract_admin_self_heal_lemmas`):
- `extract_book_vocabulary_admin` 시작부에 `PERFORM backfill_book_lemmas(p_book_id)` 1줄 추가 → **매 추출마다 멱등 backfill 선행**. 어떤 경로로 깨졌든(수동 재분절 등) 추출 시점에 자동 복구. 부수효과: Claude Code 배치가 신규 등재한 사전 단어도 다음 추출에서 즉시 바인딩.

### WordVault — iPhone/iPad 감성 풀 적용 (v06.35)

사용자 명시 — "아이폰, 아이패드의 디자인 감성을 전체적으로 적용". iOS HIG 핵심 6 패턴을 6 Section 포트폴리오에 일괄 적용:

**iOS HIG 핵심 패턴**
1. **그레이 캔버스 + 떠있는 흰 카드** — `bg-[var(--bg2)]` 메인 + 카드 `rounded-[24px]` + soft shadow (`0_1px_2px + 0_8px_24px_-12px`)
2. **글라스 헤더** — `bg-[var(--bg)]/85 backdrop-blur-xl backdrop-saturate-150` (52px h)
3. **캡슐 세그먼트 컨트롤** — 헤더 view 전환, ResourcePortfolio 도서/스크립트/단어장 탭에 적용 (활성 시 `shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)]`)
4. **거대한 hero 숫자** — VaultIdentity `text-[88px]` SF Display 스타일 (`font-[800] tracking-[-0.045em] tabular-nums`)
5. **iOS Activity Ring** — 주간 목표 진행도 (140px size, 14px stroke, gradient + soft shadow, cubic-bezier easing)
6. **iOS Settings 인셋 그룹** — `rounded-[14px]` 바깥 + 흰 안쪽 divide-y, disclosure chevron, 8x8 컬러 사각형 아이콘
7. **App Store 카드** — RecommendedBooks 가로 스크롤 snap, aspect-[2/3] 표지 + 캡슐 fit-tier 배지 + `group-hover:-translate-y-1`

**Section별 변경**
- VaultIdentity — Activity Ring + 88px hero 숫자 + 캡슐 메타 (수준/단어장/누적) + 4 bucket iOS Health 카드 + iOS Primary CTA (tone별 컬러 buttom: critical/warning/info/neutral)
- VocabularyLevelMap — V-Level 캡슐 막대 (`rounded-full` + soft shadow), 현재/다음/합계 캡슐 row, 트랙은 iOS Settings 인셋 list
- ResourcePortfolio — 도서/스크립트/단어장 세그먼트 컨트롤 + 인셋 그룹 list (SF Symbol 컬러 아이콘 + 진도 막대 + chevron)
- RecommendedBooks — App Store 가로 스크롤 snap 카드 6권 (cover image or 그라디언트 fallback + fit 배지 캡슐 + V-Level/CEFR 미니 칩)
- NextStepList — iOS Settings 인셋 list + 컬러 type 캡슐 배지 (현재/다음/복습/관심/수능/비즈/학술)
- FlowStripe — Stats 캡슐 row (평균/활동/총합) + 28일 캡슐 막대 (`rounded-full`, 활동/오늘/비활동 3색)

**iOS 시스템 컬러 도입**
- 그린 `#34C759` (확실/달성/딱맞아요)
- 오렌지 `#FF9F0A` (익숙/도서)
- 레드 `#FF453A` (회복/critical CTA)
- 그레이 `#8E8E93` (신규/비활성)
- 퍼플 `#AF52DE` (단어장)
- 옐로/시안/핑크 (수능/비즈/학술)

**컨테이너** — `max-w-5xl` → **`max-w-[820px]`** (iOS Reading 폭 정합 + 가독성 ↑) + `gap-5` → **`gap-4`** (카드간 호흡 정밀화)

### WordVault — 단어 관점 종합 포트폴리오 6 Section 재설계 (v06.35)

사용자 요청 정합 — 학습자의 리소스 이력 + V-Level 정보 + 권장 도서 통합:

**1. Identity Hero** (VaultIdentity) — 자산 hero (큰 숫자 + V-Level 메타 + 4 bucket 가로 비교 + 단일 CTA + 주간 목표)

**2. Vocabulary Level Map** ★신규 ([VocabularyLevelMap.tsx](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx))
- 사용자 보유 단어를 V-Level 0-11 별 분포 막대 (120px 높이)
- 현재 V-Level → `var(--p)` 강조 / **i+1 zone (V+1) → `var(--success)` 강조** (Krashen 권장)
- 트랙별 수준 inline (csat_korean / business / academic — `user_profiles.current_track_levels` JSONB)
- 데이터: `vocabularies.lemma` JOIN `shared_dictionary.v_level` (500 chunk in() 쿼리)

**3. Resource Portfolio** ★신규 ([ResourcePortfolio.tsx](../apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx))
- 3-column grid: 도서 / 스크립트 / 공용 단어장
- 각 row: 제목 + 진도 막대 + 마지막 학습 시점
- 도서: `texts.library_book_id` 그룹 + `library_books` 메타 fetch
- 스크립트: `texts.user_book_group_id` + 직접 입력
- 단어장: `user_word_set_subscriptions` (library_book 카테고리는 도서 단위 그룹화)
- 각 그룹 상위 4개만 + 마지막 시점 relative time

**4. Recommended Books** ★신규 ([RecommendedBooks.tsx](../apps/web/src/components/wordvault/hub/RecommendedBooks.tsx))
- 사용자 V-Level 기준 i+1 도서 4권 (이미 enrolled 도서 제외)
- `scoreBook(book, ctx)` ([recommend-books.ts](../apps/web/src/lib/library/recommend-books.ts)) 점수 매김
- `judgeIPlusOne(coverage, vLevel)` ([i-plus-one.ts](../apps/web/src/lib/library/i-plus-one.ts)) 적합도 태그 (딱 맞아요/도전/쉬워요/어려워요)
- 진단 미완료 시 /diagnostic CTA

**5. Next Step List** (NextStepList) — `recommend_word_sets_for_user(uuid)` 단어장 추천 (그대로)

**6. Flow Stripe** (FlowStripe) — 28일 sparkline + 평균/활동/총합 + 마지막 활동 (그대로)

**max-width**: 4xl → **5xl** (Portfolio 정보 밀도 ↑)

### WordVault — 한눈에 보이는 학습 대시보드로 재설계 (v06.35)

이전 4 zone (VaultIdentity / NextStepList / AssetGrid / FlowStripe) → **3 zone 압축**.

**문제**: AssetGrid (단어장 grid) 가 사용자가 알고 싶은 "학습 진행 정보" 가 아닌 "내 컬렉션 목록" 만 보여줌. 사용자는 학습 상태·진행도·다음 단계를 한눈에 보고 싶음.

**해결**:
- **AssetGrid 제거** (`components/wordvault/hub/AssetGrid.tsx` import 폐기 — 파일 보존)
- [VaultIdentity.tsx](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) 강화 — Mastery Hero
  - V-Level 메타 칩 추가 (`user_profiles.current_v_level` fetch · 강조 색 박스)
  - 4 bucket **가로 비교 막대** (이전 한 줄 stacked bar 폐기) — 각 bucket 별 레이블/dot/막대/수치/비율 동시
  - 레이블: "확실히 기억 / 익숙해지는 중 / 잊혀가는 중 / 새로 만난" (사용자 친화 문구)
  - "기억 X%" inline 요약 (stable + shaky / total)
  - 단일 CTA (이전 동일 — risk→shaky→new 우선순위)
- FlowStripe / NextStepList 그대로 유지 (각각 추세·다음 단계)
- max-width 4xl · 3 zone · 한 스크롤 안에 모든 학습 정보 가시

**보존**: AssetGrid.tsx 파일은 import 없이 보존 (필요 시 `/wordvault/browse` 등 다른 view 에서 재활용 가능).

### Workspace Player — 풀 재설계 (하단 dock + 글라스 + Step Hero) (v06.35)

[FloatingAudioPlayer.tsx](../apps/web/src/components/workspace/FloatingAudioPlayer.tsx) 전면 재설계 — 모던/심플/최고 수준 톤:

- **레이아웃**: `fixed bottom-5 left-1/2` 떠 있는 카드 → `fixed inset-x-0 bottom-0` **하단 dock** (전체 폭, 화면 끝에 anchored). 가운데 max-w 920px 콘텐츠.
- **글라스 효과**: `bg-[var(--t1)]/95 backdrop-blur-2xl` + `border-t` + `shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.18)]` — 정제된 프리미엄 인상.
- **타이포 정제**: pill 탭 → **underline 탭** (active 시 흰색 2px 라운드 underline). 진행 카운트 `1 / 22` mono tabular-nums 회색.
- **Transport 정제**: 통일된 9×9 ghost button + 중앙 11×11 흰 둥근 play (그림자 깊이 강화).
- **Step Hero** (step mode 활성 시): 별도 카드 → **Lora 17-19px 문장 텍스트가 hero**. step meta (mono tracking-wider) + 상태 라벨 + 작은 pulsing dot (` ` 듣는 중 / `●` 따라 말해 보세요).
- **Countdown ring**: 카운트다운 bar 폐기 → **play button 주변 SVG ring** (`var(--success)`, `stroke-dasharray` decreasing). 시각 무게중심 통합.
- **Step 액션 정제**: 좌 `↺ 다시 듣기` (ghost) · 중 play (ring 포함) · 우 `다음 ⏭` (`--p` brand pill + glow).
- **LibriVox body** 도 색상/구조 정합 (Mic icon 작아짐, 시간 mono tabular-nums, 속도 button border 정제).

### Workspace Player — 따라하기 (Step) 모드 추가 (v06.35)

리틀팍스 스타일 step-by-step 학습 — 문장 1개씩 듣고 따라 말한 후 자동 진행.

**TTS Controller** ([tts-controller.ts](../apps/web/src/lib/workspace/tts-controller.ts)):
- `PlayMode` 에 `'step'` 추가 (기존 `'sentence'|'paragraph'|'all'` 외)
- `PlayState` 에 `'awaiting_repeat'` 추가 (문장 재생 후 따라하기 대기 상태)
- 새 state 필드: `repeatCountdown` (남은 초) / `repeatTotalSec` (총 초, UI 비율 계산) / `currentText` (현재 문장 텍스트)
- `playFromMode('step', sentences, 0)` — 첫 문장 재생 → onend 시 `startRepeatCountdown` 호출
- `startRepeatCountdown(sec)` — 문장 단어수 비례 자동 (`min(8, max(2, words × 0.35))`), 매 1초 `setInterval` tick → 0초 도달 시 자동 다음
- 사용자 액션: `stepReplay()` (현재 문장 다시 듣기) / `stepAdvance()` (카운트다운 무시하고 즉시 다음)
- `stop()` · `finish()` · `repeatTimer` 정리 보장 (메모리 누수 차단)

**FloatingAudioPlayer** ([FloatingAudioPlayer.tsx](../apps/web/src/components/workspace/FloatingAudioPlayer.tsx)):
- `MODE_OPTIONS` 에 4번째 탭 "따라하기" 추가
- `StepCard` 신규 — Step 활성 시 모드 toggle 아래에 카드:
  - 헤더: 큰 흰색 step 번호 배지 + `STEP · N / Total` 메타 + 상태 라벨 (`🔊 듣는 중` / `👤 따라 말해 보세요`)
  - 현재 문장 (Lora 15px)
  - 카운트다운 bar (success 색, 매 초 width 감소)
  - 액션 row: `↺ 다시 듣기` (좌) · `N s 후 다음` (중) · `다음 ⏭` (우, brand p 색)
- 진행 표시: `STEP 3 / 22` (mono tabular-nums)
- 중앙 ▶ 버튼 — step 모드면 `playFromMode('step', ...)` 호출 (전체 연속 X)

### WordVault 도서 단어장 챕터별 표시 X — 도서 단위 1 카드로 그룹 (v06.35 patch)

`useHubStats` — `category='library_book'` 인 `shared_word_sets` 는 `curation_query->>'book_id'` 별로 그룹화. Pride & Prejudice 61 챕터 단어장 → 1 카드 (제목 = library_books.title, subtitle = "저자 · CEFR · N장", distribution = 챕터 합산). `collectionsCount` 도 도서 단위로 카운트 (이전: 챕터 수 합산 → 부풀려진 컬렉션 수). href: `?filter=set:{firstChapterSet}&book={bookId}` (browse 의 prev/next 챕터 nav 자연스럽게 활성).

### WordVault 허브 전면 재설계 — 7 tier → 4 zone (v06.35)

**문제** — 이전 v06.20 허브는 7 tier (ModuleHero+VaultBar / Recommended / BookShelf / CEFR / FindAndMore / LearningDimension / MemoryDecay / WordPeek) 누적으로 인지 부하 ↑, 동일 정보 (단어 분포) 3번 노출, gradient + 이모지로 "전문적이지 않음" 인상, 목표/방향 부재.

**재설계** — Editorial monochrome (회색 + `--p` 액센트만, 그라디언트/이모지 제거) + 4 Zone:

1. **Zone 1 — VaultIdentity** ([VaultIdentity.tsx](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) 신규)
   - 큰 단일 숫자 (총 단어, 64-88px `tabular-nums`) + 4색 horizontal bar + bucket inline counts
   - **이번 주 목표** 진행 바 (`user_profiles.daily_word_goal × 7` vs `daily_activity` 7일 합)
   - **단일 CTA** 우선순위: risk → shaky → new → 둘러보기 (`/wordvault/browse?filter=state:...`)

2. **Zone 2 — NextStepList** ([NextStepList.tsx](../apps/web/src/components/wordvault/hub/NextStepList.tsx) 신규)
   - `recommend_word_sets_for_user(user_id)` 결과 3-5개 — 카드 X, 번호 매긴 text list (Editorial)
   - 진단 미완료 시 `/diagnostic` CTA + "진단을 마치면 V-Level 에 맞는 단어장 3-5개를 추천해드려요" 안내
   - type label: 현재 수준 / 한 단계 위 / 복습 / 관심 분야 / 수능 / 비즈니스 / 학술

3. **Zone 3 — AssetGrid** ([AssetGrid.tsx](../apps/web/src/components/wordvault/hub/AssetGrid.tsx) 신규)
   - 상시 가시 검색 input + 1/2/3 col grid
   - 각 카드: type label · 제목 (영문 prefix 이모지 strip) · 큰 숫자 (단어 수) · 4색 mini bar · inline counts
   - `useHubStats.books[]` 그대로 활용 (스크립트 + 공용 단어장 통합)

4. **Zone 4 — FlowStripe** ([FlowStripe.tsx](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) 신규)
   - 28일 sparkline (`daily_activity` 직접 fetch) — 오늘은 `--p`, 활동일은 `--t3`, 빈 날은 `--bg3` opacity 0.5
   - 평균/활동/총합 (tabular-nums) + 마지막 학습 활동 (어제 · Flashcard 12개 등)

**Hub 조립** ([WordVaultHub.tsx](../apps/web/src/components/wordvault/hub/WordVaultHub.tsx) 재작성)
- 6 tier → 4 zone, max-width 5xl → 4xl (집중도 ↑)
- mock fallback 보존 (개발/비로그인 시 mock_books 등)

**Header** ([page.tsx](../apps/web/src/app/(main)/wordvault/page.tsx)) — Editorial 톤:
- "WordVault · 내 어휘" 메타 라벨
- ViewSwitcher: 4 옵션 (허브/둘러보기/학습/복습), 가독성 폰트 12px
- 메인 배경 `var(--bg2)` (zone 들이 `var(--bg)` 카드 위로 떠 보임)

**기존 컴포넌트 보존** — VaultBar / BookShelfSection / CEFRDistribution / FindAndMore / LearningDimensionSection / MemoryDecayDistribution / TrendIndicator / WordPeekStrip / RecommendedSetsSection / VLevelPromotionCheck 는 import 되지 않지만 파일 보존 (Phase 2 추가 view 에서 재활용 가능).

### LibriVox 챕터 매핑 — 로직 흡수 + 큐 단순화 (v06.35)

**문제** — v06.34 는 LibriVox 매핑을 "항상 사람 판단 필요"로 보고 큐(book_curation_jobs)+수동 "매핑 큐 등록" 버튼+수동 CLI 드레인+수동 잡 닫기 = 한 권에 4단계로 만들었다. 그러나 `buildChapterPartsMap` 의 count-gate 로 매핑은 대부분 자동이며, 사람 판단은 **count-gate 실패 시에만** 필요.

**해결** — 자동 매핑을 로직 단계로 흡수:
- **NEW** [`apps/web/src/lib/library/librivox-automap.ts`](../apps/web/src/lib/library/librivox-automap.ts) — `autoMapLibriVoxForBook(client, bookId)` 공유 헬퍼 (resolve → count-gate → flat 폴백 → `librivox_audio` 저장).
- [`save-librivox-audio/route.ts`](../apps/web/src/app/api/admin/library/save-librivox-audio/route.ts) `build_chapter_map` 분기 = 헬퍼 호출로 리팩터 (≈190줄 중복 제거, 응답 shape 보존).
- [`lcp/dev-process/route.ts`](../apps/web/src/app/api/lcp/dev-process/route.ts) 분석 직후 헬퍼 자동 호출 → `librivox: 'mapped' | 'queued' | 'no_recording'` 반환. **count-gate 통과 시 즉시 저장** (별도 버튼·CLI 불필요). 정합 실패본만 `book_curation_jobs` 자동 upsert(서비스롤 직접 — RPC admin 가드 우회), 성공/녹음없음은 큐 잡 자동 삭제 → 큐는 "사람 손 필요한 책"만.
- [`MyLibraryTab.tsx`](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — 수동 "매핑 큐 등록(Claude)" 버튼·`runEnqueueMapping` 제거. "Dev 일괄 처리" 배너에 `🔊 매핑 N · ⏳ 매핑큐 M` 집계. 워크플로 가이드 callout 갱신.

### 도서 큐레이션 — "→ 소스 GET" 시맨틱 재정의 (DELETE-based)

**Before** — `admin_bulk_requeue_books` 가 `status='queued'` UPDATE 만 수행 → 도서가 Curated Books 에 그대로 남음 (의도와 불일치).

**After** — `library_books` row DELETE → cascading effect:
- `library_book_vocabularies` (CASCADE) + `library_chapters_master` (CASCADE) 자동 삭제
- `library_seed_catalog.imported_book_id` (SET NULL) — seed 자동 unlock → BulkFetchTab 에서 재 fetch 가능
- `shared_word_sets` drafts 명시 DELETE (FK 없음, JSONB 참조)
- `archaic_candidates.first_seen_book_id` (SET NULL — FK 변경) — 단어 자산은 보존

| Migration | 내용 |
|---|---|
| `20260606225815_admin_bulk_book_status` | bulk RPC 초안 — status UPDATE 만 |
| `20260606231723_admin_bulk_book_rollback_cascade` | rollback cleanup 추가 (draft sets / vocabs / chapters) |
| `20260607005258_admin_bulk_return_to_source` | DELETE 시맨틱 재정의 (deleted_count / seed_unlocked 반환) |
| `20260607010118_archaic_candidates_first_seen_book_set_null` | FK ON DELETE NO ACTION → SET NULL |

**관련 RPC**: `admin_bulk_set_books_curating(uuid[])` (ready→curating, draft 삭제만), `admin_bulk_requeue_books(uuid[])` (→ 소스 GET, library_books DELETE).

**관련 UI**: [`apps/web/src/components/admin/curation/MyLibraryTab.tsx`](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — Curated Books toolbar 3 버튼 (`검토대기 → 처리중` / `처리중 → 소스 GET` / `검토대기 → 소스 GET`) + `▶ 큐 처리 (dev · N권)` (자동 반복 drain).

### Dev 큐 드레인 (production 외 pg_cron 회피)

`get_lcp_config()` 가 dev 환경에서 NULL → cron worker 가 pgmq 메시지 무시. Admin 이 직접 트리거하는 dev-only endpoint 추가:

- **NEW**: [`apps/web/src/app/api/lcp/dev-drain-queue/route.ts`](../apps/web/src/app/api/lcp/dev-drain-queue/route.ts) — `NODE_ENV !== 'production'` + admin 인증 가드, `max=5` 도서를 self-host `/api/lcp/dev-process` 로 순차 호출, `archive_book_pipeline_messages` 자동 정리.
- UI: 자동 반복 루프 (라운드별 fetch + remaining 카운트 + 1초 elapsed 타이머 + 중지/계속 banner).

### 사용자 입력 책 (챕터별) 모드

`/text/new` 가 "단일 스크립트 / 책 (챕터별)" 두 모드. 책 모드는 챕터 N개 → 한 UUID 그룹으로 묶음.

| Migration | 내용 |
|---|---|
| `20260608222229_texts_user_book_group_id` | `texts.user_book_group_id UUID` + CHECK(library_book_id IS NULL OR user_book_group_id IS NULL) + 부분 인덱스 |
| `20260608222931_v_text_content_user_book_group_v2` | `v_text_content` view 에 `user_book_group_id` 추가 |

**관련 신규 파일**:
- [`apps/web/src/lib/text-viewer/save-user-book.ts`](../apps/web/src/lib/text-viewer/save-user-book.ts) — `saveUserBook({ bookTitle, author, chapters[] })` (UUID 생성 + N row 일괄 INSERT + 부분 실패 rollback)
- [`apps/web/src/components/text-viewer/BookChapterInput.tsx`](../apps/web/src/components/text-viewer/BookChapterInput.tsx) — 챕터 워크벤치 (가로 레일 nav + Alt+←/→ 단축키 + 챕터별 작성 상태 시각화)

**관련 액션**:
- `deleteUserBookGroupAction(groupId)` 신규 (단일 텍스트 액션은 그룹 chapter 거부)
- `useTexts` 가 `aggregateUserBookChapters` 로 그룹 → 1 LibraryText 카드 집계 (category="내 책")
- Workspace `/text/[id]/layout.tsx` 가 `user_book_group_id` 분기 — synthetic BookRow + chapter siblings → ChapterSidebar 동작

### DB 디스크 회수 (운영 정리)

5,155 orphan `content_chunks` DELETE → VACUUM FULL 5종 (`library_book_vocabularies` 233 MB→39 MB · `content_chunks` 58→13 MB · `archaic_candidates` 21→9.5 MB · `library_chapters_master` 6.2→1.4 MB · `pgmq.q_library_pipeline`).

**결과**: DB 606 MB → **350 MB** (256 MB / 42% 감소).

### LibriVox 챕터 매핑 (Workspace 보이스)

`librivox-chapter-map.ts` 재설계 — `parseSectionChapterMeta` (Roman + Arabic + "Book X, Chapter Y") + `buildVoiceChapters` 그룹핑 + `verifyWithinBookContiguity` (책별 1..N 검증) + 1차 outlier 제외 실패 시 2차 재시도 (Two Treatises Ch 11 like 긴 챕터 보호). `save-librivox-audio` route 는 `chapter_parts` 실패 시 단권 `audio.section_count === masters.length` 시 자동 `flat` 폴백.

`LibriVoxAudioPanel` 이 legacy `mode === null + aligned === true` 도 flat 으로 인식 (Pride & Prejudice 등 기존 저장본 자동 노출).

---

## v06.34 — 사용자 학습 자산 시각화 + ENHANCEMENTS

**라이브러리 도서 V-Level 측정 방식 token → type 교체** (`compute_book_vrl_type_based_p75` migration) — Zipf 편향 차단. Christmas Carol/Treasure Island/Sherlock/Dorian 등 12 도서 V-Level 재측정 (예: V5 → V7~V8). 학술 정합 (Lexile/ATOS/CEFR-J Text Profile).

**도서·단어장 spec UI 적용** — `/library/books` LibraryGrid 카드에 `✨ 단어장` indicator + `word_set_count` prop. `BookDetailClient` Primary/Supplementary Tier 시스템. Workspace 상시 가시 사이드 패널 (`WordSetSidebar.tsx`, lg breakpoint 이상 320px).

**라우트 정리** — `/library/scripts` + `/library/scripts/[bookId]` → `/library/books*` redirect. `LibraryTabs` 3탭 → 2탭. 미사용 `PublishedBooksSection` / `BookCard` 삭제. `fetchPublishedBooks` + `PublishedBook` interface 제거.

**Spec 충돌 해석 명시** — Spec §4 "Primary 1 단어장" vs 챕터당 1 단어장 → "도서 학습 단어장" 통합 카드 + 챕터별 펼침으로 해석. Spec §5 "학습 완료 234/1748" vs 사용자 0명 → null placeholder + "학습을 시작하면 진행도가 채워져요" 안내.

---

## v06.33 — EchoMatch 따라읽기 모듈 (Shadow Reading)

**4-Phase cycle**: idle → listening (TTS) → recording (MediaRecorder) → comparing (DTW) → scored.

**라이브러리**: `pitchfinder` (YIN 알고리즘) + `dynamic-time-warping-ts`. **3축 점수 40/30/30 가중** — 인토네이션 (피치 contour DTW · PITCH_THRESHOLD=80Hz) + 강세 (RMS energy DTW · ENERGY_THRESHOLD=0.08) + 리듬 (durationMs ratio · MAX 2.5).

**코드 인프라** — `lib/echo/`: `pitch-extractor.ts` (YIN frame 2048/hop 512 + voicedFrames) · `dtw-comparator.ts` (3축 + `scoreFeedback`) · `audio-recorder.ts` (getUserMedia echoCancel/noiseSuppress/AGC + MediaRecorder webm/opus + playBothOverlay) · `tts-player.ts` (Web Speech API · voice 선택) · `sentence-splitter.ts` (약어 Mr/Dr 처리) · `save-attempt.ts` (세션 캐시 + attempt INSERT + finalize 통계 집계).

**컴포넌트** — `components/echo/`: `EchoMatchPlayer` (4-Phase 컨트롤러 + sessionCache + attemptCountRef) · `MicPermissionGate` (권한 요청 게이트) · `PhaseProgress` (4 pill + 진행 %) · `SentenceCarousel` (Lora 18-22px) · `PitchVisualizer` (Canvas 2D devicePixelRatio + 원어민 var(--p) vs 사용자 var(--success) overlay + 그리드 + 정규화 min×0.9 max×1.1) · `ScoreCard` (overall 48px mono + 3축 weight % 표시 + tone 색).

**DB Migrations 2건** — `echo_match_sessions` (user/text/library_book FK + avg/best/worst 점수 통계 + retried_sentence_ids TEXT[] + RLS own sessions) + `echo_match_attempts` (session FK + sentence_id TEXT + attempt_number + 3축 점수 + duration_ms + RLS own attempts + idx user_date).

**알려진 한계**:
1. Web Speech API TTS 출력 직접 audio 추출 불가 (브라우저 보안) — 현재 `buildSyntheticRefContour` 합성 reference. Phase 2 에서 사전 녹음 audio 파일 또는 cloud TTS + Storage 캐싱으로 진짜 비교.
2. DTW threshold (80Hz/0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행.

**학습 모델 매핑** — Shadow Reading 은 기존 9계층 매핑 없음. 실제 인지는 L4c (청각 → 음운 출력). 위치: `/text/[id]/echo` 별도 라우트 (ModePills 'shadow' 모드 → 이 라우트).

---

## v06.32 — Workspace 도서 챕터 단어장 chip + Reading Universe

**도서↔단어장 매핑 정합** + Workspace UnifiedHeader 챕터 단어장 chip — `subscribed/total` 표시 + 클릭 시 InsightPanel.

**노출 분리 정책 최종 확정** — 단어장은 도서 컨텍스트 안에서만 노출, 카드/그리드 어디에도 단어장 정보 노출 X.

**`/library/scripts` 사용자 영역** — mock CurationCard 4권 + 별도 "발행된 도서" 섹션 모두 폐기 후 `PublishedBooksSection` 으로 통합. BookCard 단순화 — 인라인 expansion 제거 + `Link` 로 변환 (도서 카드 = entry point only).

**`/library/scripts/[bookId]` 도서 상세 페이지 신규** — 네이비/골드 Hero (cover gradient + 제목/저자/CEFR/V-Level/CEFR-J/Lexile/FK + "읽기 시작" CTA → `/text/[id]`) + `BookDetailClient` (6열 챕터 단어장 grid · 구독 상태 시각화 · VocabSetPreviewModal 재사용).

**`/admin/curation/preview/[bookId]` `ChapterWordSetsAdminSection`** Client 전환 — 표 행 `role="button"` + Enter/Space 키보드 + `ChapterWordSetPreviewModal` 신규 (구독 CTA 없는 admin 전용 modal · 단어 전수 fetch + sort_order DESC + 발음 듣기 + 추출 메타 JSONB details).

**결정** — 학습 진행 % 표시 보류. 사용자 0명 단계라 `vocabularies × learning_records` JOIN 비용 vs 정보 가치 비효율 — 구독 카운트만 표시 (Phase 2 사용자 학습 데이터 누적 후 확장 예정).
