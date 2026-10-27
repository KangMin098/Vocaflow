<!-- docs/lcp-story/D3_FOLLOWUP.md -->
# LCP D3 — W1~W4 후속 실행·수용·D4 인계

2026-10-27 · T-0189 · **W1/W2/W4 제한 범위 수용, W3 준비 수용·제작 HOLD**. 실제 사람 적합성과 독해 성장의 수용이 아니다. 최종 로컬 main 반영은 아래 통합 기록으로 확인한다.

## 1. 실제 기준·기존 작업·실행

- 착수 main/feature: `829526982445fb25062b825bbbcfba36479b0c77`. 기존 `feat/lcp-story-20261025`, `D:/workspace/Vocaflow-lcp-story`를 유지했다.
- W1~W4는 [D3 §10](./LCP_D3_EDITIONS.md)의 논리 ID다. 네 개의 중복 TASK를 만들지 않고 실제 Claude/Codex 분담 실행 하나를 T-0189로 추적했다. T-0165·0169·0174·0176·0187 완료 상태와 S4~S7·D2 설계를 보존했다.
- Claude Code 제작·구현: 기존 세션 `25e83007-cf44-4c42-9750-16d5a98a9764`. 실제 run1 PID20236, 보완 run2 PID26256 모두 **exit0**다. 자연어 완료 보고를 실행 종료로 대신하지 않았다.
- 첫 산출물은 `6ce233af1e56f243750cf52f648862cf729cd6cd`에 로컬 보존했다. 당시 SQL v1은 독립 검토 changes_requested였으므로 적용·main 수용으로 표시하지 않았다. 같은 세션에서 실제 내용 재해시/binding·handling enum과 검증 기대를 보완했다.
- Codex는 SQL/코드·UX 수용을 맡고, 새 S2/S3를 만들지 않은 별도 Codex 세션이 콘텐츠를 직접 검수했다. C06 검토자는 기존 원천 조사 참여자의 준비/범위 검토이며 새 각색의 독립 콘텐츠 승인자가 아니다.

증거 폴더 `R`은 `D:/workspace/Vocaflow-AI-Control/runtime/lcp-story-20261025/d3-execution-20261027`이다. `claude-exit.json`, `claude-fix-exit.json`, 원본/보완 결과와 이전 실패 기록을 보존했다. 비공개 설정·계정은 재사용했으며 자격정보를 문서·로그·커밋에 싣지 않았다.

## 2. 기존 네 단위의 인수·판정

| ID·owner | 선행 의존·변경 범위 | 실제 수용·남은 조건 |
|---|---|---|
| W1 P1 · Claude 제작 / 비제작 Codex 검수 | 고정 C01 p79~97·기존 R2 u08·정책/권리 대조. 로컬 S2/S3만 | **비교 표본 완료·AI 독립 검수 수용**. 전작 제작/DB 등록/발행 없음. 경미 의견과 사람 적합성 미검증 유지 |
| W2 P1 · Claude 구현 / Codex 보안·UX 수용 | 기존 두 note·정책/단위 연결 → 좁은 인증 API → 선택 UI → 정확 SQL 개별 승인 | **기술/PC UX 수용**. 승인 v2 dev 적용·실제 인증·반환·캐시 확인. 기존 진도/완료 의미 보존 |
| W3 P1 · Claude 비실행 준비 / Codex 준비 범위 검토 | 기존 PG 고정 바이트·특정 C06 권리 상태. W1과 독립 가능 | **허용 준비 완료 / 실제 제작 HOLD**. 권리 결정 전 제작용 정규화/snapshot/앵커/policy/export/각색·등록·발행을 하지 않음 |
| W4 P2 · Claude 근거 / Codex 재계산 | W1 실제 표본·기존 surfaceMetrics 재사용. W3 새 본문 분석 없음 | **편집 근거 완료**. CEFR/커버리지/흥미·이해·효과 실측이 아님. 새 분석 엔진·유료 API·이벤트·표 없음 |

## 3. W2 — 기존 두 시대적 맥락의 실제 전달

기존 R2 `lsr_58490bbd38131e1b2e536c5fe08179e8`의 내용은 수정하지 않았다. `note-head-size`는 u03, `note-wife-affection`은 u03/u04에 연결돼 있다. 전자는 홈스의 머리 크기 추론에 깔린 시대의 가정, 후자는 지저분한 모자를 아내의 애정 부족으로 단정하는 성 역할 가정을 증거와 구분하도록 돕는다. 일반 learner_note는 줄거리/정답을 포함할 수 있어 일괄 공개하지 않는다.

`StoryContextNotes.tsx`는 본문 뒤 native details로 제공한다. 기본 접힘이며 필수 확인·새 학습 절차가 없다. 단위/발행 키로 remount해 다음 단위도 접힘으로 시작한다. u03 두 개/u04 한 개/u01 없음, 오류/미적용/불일치는 설명 없음과 구분한다. 인증 checking/changed/denied 때 기존 본문·진도와 함께 숨긴다. 기록/완료 RPC와 이벤트는 추가하지 않았다.

새 `public.story_unit_context_notes(text,integer)`는 현재 발행본의 source/slot/target/policy/version을 결속하고 실제 `artifact - activities`와 `policy - production`의 기존 canonical SHA를 재계산한다. 민감 정책의 기존 handling 3종을 검사하고 `retain_with_context`·`editorial_note/context_note`·해당 unit_ids만 선택한다. 응답은 `{release_key,unit_index,notes:[{id,text}]}`다. 검수/정답/활동/full change_log/개인 진도는 반환하지 않는다. 노트 수/길이에 임의의 새 상한을 두지 않았다.

### 승인·적용·기존 상태 보호

- 사용자 승인: dev `jajenrevcbmrpaliomxv`, **SHA `0fee756e6a50a0c57a37d2a3400ed4bb7a1ca420bf6dee31b96f2581094da319` 원문만**. 이전 U1 승인이나 C06 권리·새 발행 승인으로 확장하지 않았다.
- MCP apply_migration 성공·원장 **`20261026235109`**. 원장 statement 한 개의 SHA가 승인값과 같고 함수 본문 SHA도 원문과 같다. 새 함수와 원장 행 xmin이 같아 같은 실제 트랜잭션에서 반영됐음을 확인했다.
- owner postgres, SECURITY DEFINER/STABLE, `search_path=pg_catalog, pg_temp`; owner의 보호 표 읽기/helper 권한 확인. authenticated 실행 허용, anon/PUBLIC/service_role 실행 차단. 기존 learner 판정(인증 UID, 정지/삭제 거부, 프로필 없음 허용)을 유지했다.
- 적용 전후 **Story12표 전체 행·기존34함수 정의/권한·12표 RLS/ACL·계정 역할/활성 상태** 지문이 같다. Auth/화면 검증 후에도 Story12표 전체 행이 같다. C01 원문·R2·권리 결정·진도·완료를 변경하지 않았다.
- 실제 `SET LOCAL lock_timeout='3s'`, 문장별 `statement_timeout='60s'`, 같은 트랜잭션 NOTIFY가 있다. 함수 호출 한도가 아니다. 실제 DB 잠금 시간은 미측정이며 MCP 왕복49,995ms를 DB 실행 시간으로 부르지 않는다.
- 복구 SHA `14e6ea371ece8c208ea681592cd4a079692561735923b274e20162f953bebf78`는 제시·격리 검사만 했다. **실제 복구 미실행**이다. 승인 원문/제안 시점 머리말은 보존한다.

### 검증 증거 구분

| 증거 | 실제 결과·범위 |
|---|---|
| 관련 단위/타입/lint | 8파일 **352 PASS**, 타입 exit0, 변경 web lint exit0. 루트 스크립트에 web eslint를 적용한 최초 실패는 보존하고 적절한 범위에서 재실행 |
| PC 격리 브라우저 | **40 PASS·exit0**, 1440/1280. 탐색/시작/도움/완료/이어하기·저장 실패·인증/계정 전환·늦은 응답·철회 회귀, 노트의 접힘/2·1·0/오류/키보드/axe. 합성 데이터이며 실제 dev로 부르지 않음 |
| SQL 최종 격리 | **25 PASS·0 FAIL·2 NOT_RUN·실제 exit3** 원본 유지. PG17.10, 정확 SQL/하네스 해시. 변이9종 검출·각 exit1, runner exit0; 구문/기동 실패와 구분. 이전 v1의 잘못된 W09 기대·실패 이력도 보존 |
| 독립 코드/UX | 비제작 Codex가 실제 코드와 핵심16개 격리 화면을 직접 열람, 추가 결함0. summary44px·solid2px focus. SQL은 별도 비제작 검토에서 P1/P2 수정 수용 |
| 실제 dev REST | **13건 PASS·exit0**. 정상 Auth A/B의 서버 사용자·활성 user 역할 확인. u03 두 개/u04 한 개/u01 빈 목록이 고정 R2 텍스트와 일치. anon401/42501, 실제 철회 R1·없는 키·범위 밖 단위400 거부. 새 응답에 개인 필드 없음 |
| 실제 PC 화면 | 별도 feature preview에서 정상 A1440/B1280, 로그인 전 비노출·단위2/1/0·접힘·Enter/Space·44px·focus·가로 넘침 없음, 실제 exit0. root도 실제 캡처를 직접 확인. main 결과는 통합 기록에 추가 |
| 원본 미실행 N01 | 별도 실제 dev 증거로 **확인**: PostgREST에서 새 RPC200/오류 모양·정확 데이터 반환, 추가 캐시 갱신이나 재시도0. 원래 격리 not_run 행을 PASS로 덮지 않음 |
| 원본 미실행 N02 | 별도 실제 적용 증거로 **같은 트랜잭션·원장 원문 일치 확인**. 공유 DB 실패 주입은 미실행이며 rollback 증거는 격리에 한정 |

정상 REST 성공6회의 실제 왕복은 **113.8~164.3ms, 중앙값130.85ms**다(네트워크/서버 포함, DB 단독 시간 아님). 실제 정지 계정 변경이나 미발행 발행본 fixture 생성은 하지 않았다. 해당 경계는 격리/기존 증거이며 없는 실제 계정·데이터를 성공 처리하지 않는다. 이번에는 새 진도 쓰기를 실행하지 않았다. 기존 [S7](./S7_PILOT.md)의 실제 쓰기·완독·재로그인·계정/철회 증거와 현재 관련 회귀를 재사용한다.

주요 실제 증거: `R/deployment-verified.json`, `R/live-closeout-verified.json`, `R/live-rest-2026-10-26T235333851Z.json`, `R/live-after-apply-2026-10-26T235500731Z/result.json`. SQL 검토는 `sql-independent-review-v2.json`, 코드/UX 검토는 `codex-w2-ui-independent-review-20261027.json`이다.

## 4. W1 — 실제 C01 대표 구간 비교·콘텐츠 검수

고정 source SHA `39141394…a129`의 0-based p79~97, UTF-16 `[18689,22751)`와 기존 R2 u08을 재사용했다. S2/S3만 로컬 발췌 easy_reader/level_adaptation로 만들었다. 둘의 B1은 편집 가설이며 공개 B2 R2를 교체하지 않는다. 원본·R2 raw SHA `6818797b…`/`09cde981…`는 그대로다.

| 항목 | 원문/기존 → 새 제안 | 이유·기대 도움 | 의미 손실/읽기 비용 |
|---|---|---|---|
| 어려운 잔해 표현 | S2는 `leftover bits`로 풀이 | 고전/라틴어식 표현의 어휘 부담 완화 | Baker의 격식·유머가 옅어질 수 있음 |
| crop | S2 보존, S3는 새의 먹이주머니 설명 삽입 | 배경어를 본문 안에서 이해할 가설 | 단서를 강조하고 대화 리듬을 끊을 위험 |
| the matter | S2 보존, S3 `the stone` | 지시 대상 명시 | 보석에 관한 일반 지식까지 부정하는 넓은 읽기 위험(minor) |
| circulation/gravity | S2/S3는 몸의 여름 적합성/`my serious nature`로 바꿈 | 어휘·관용 부담 완화 가설 | 농담의 정확성·품위/우쭐함 어조 약화(minor) |

전체 변경에는 source 앵커·제안 문장·이유·기대 도움·손실 위험이 있다(`R/w1/w1-changes.json`). Baker의 광고하지 않은 경제적 이유/도난 추정, 먹었다는 **홈스의 발화**→놀람→대체 거위 수락/안도, 잔해 무관심, 거위 클럽 출처, 홈스의 추론/추적 전환을 직접 대조했다. Museum 출입을 직업 증거로 바꾸거나 Baker에게 보석 지식을 주지 않았다.

비제작 Codex는 먼저 본문 판단을 고정한 뒤 정책/앵커/변경 근거를 읽었다. 현재 ReviewArtifactSchema·binding을 직접 계산해 S2/S3 각각 필수9항목 pass, **로컬 표본 approve**, major/critical0, minor2/3을 기록했다. 검수 provenance는 ai_review/ai_model이며 사람/staff 발행 승인과 다르다. `R/w1/codex-first-content-review.json`, 두 실제 `*.codex.out.json`, `codex-final-review-validation.json`에 해시/독립성이 있다.

기존 로컬 파이프라인에서 실제 review 파일을 읽어 validate exit0·2valid/current review2, plan exit2·두 표본 hold를 확인했다. hold는 보존한 옛 snapshot의 `claimed_by_source`에 따른 `rights_unconfirmed:source_text`다. **실제 dev의 해당 C01 source 권리 확인은 이미 true**이며 이번 비교를 위해 역사 snapshot을 조작하지 않았다. 새 표본 등록/발행은 범위 밖이다. S3의 우월성·전작/실제 독자 적합성을 판정하지 않는다.

## 5. W3 — C06 준비 완료와 실제 제작 보류

C06은 **Saki(H. H. Munro), The Open Window**, Project Gutenberg269 *Beasts and Super-Beasts*, 1914 John Lane/The Bodley Head, David Price 전사본이다. 기존 exact TXT는7,195B, SHA `050cca38bf540923ce935143a275c2a6aaf2fff26947c24d93e00f44bb674b27`, collection TXT `[59044,66239)`와 일치한다. 원작·전사/간기·PG 배포/브랜드·제외 자산을 구분하며 [기존 조사](./C06_SOURCE_PREPARATION.md)를 새 권리 승인으로 바꾸지 않는다.

필요 최소 현대화 판본 하나, B2 편집 가설, 질문2개와 시간 확인 진술·누나4년 전/비극 주장3년 전·주장/관찰/초점화/서술자 아이러니·흰 외투/개/노래·마지막 재해석 보존을 비실행 계획으로 구체화했다. 호칭·현대 철자·설명 후보는 변경 근거와 연결하고 HOOK/도움에서 반전을 앞당기지 않는다. 실제 문장을 만들거나 동일 수준 여러 판본을 강제하지 않았다.

이번에 **새 raw 조사 위치 색인**(인용27개, 표제 포함 raw30덩어리)을 만들었다. CRLF/원문 줄/UTF-8 바이트 자료이며 production SourceAnchor의 정규화 UTF-16 결속이 아니다. ‘앵커 관련 작업0’으로 숨기지 않고, 제작 앵커로 재사용하지 않는다.

준비 v1의 권리 선행/표현/위치/처리 후보7건은 같은 Claude 보완에서 고쳤다. v1과 review는 보존했다. 최종 `R/w3/c06-edition-prep-v2.md` SHA `95d8b8f9745e35a321f742c45d6360fb2e9cd3b531df7f92202400f767108b81`은 **ACCEPTED_PREPARATION_ONLY**다. 기존 원천 조사 참여자의 준비/범위 검토이며 새 각색 독립승인·법률/사람 검수·효과 증명이 아니다.

**특정 C06 source_text 권리 결정 → 제작용 정규화/snapshot/앵커 → 정책/export/현대화 → 비제작 전문 검수·정상 증인/발행 조건** 순서다. 현재 첫 조건이 없어 이후 단계는 HOLD다. C01 결정·일반 AI 역할 위임·관리자 권한·plan의 예상 hold로 대신하지 않았다. 담당 사람·계정·비공개 설정을 다시 요청하지 않았다.

## 6. W4 — 편집 근거와 미검증 수준

기존 `surfaceMetrics`의 `[A-Za-z][A-Za-z'’-]*` 단어 규칙/종결부호 문장 규칙을 재사용했고 Codex가 실제 파일/본문 해시·문단별 계측을 독립 재계산했다(`R/w4-independent-verification.json`, exit0).

| 표본 | 단어 | 문장 | 평균 문장 단어 |
|---|---:|---:|---:|
| S0 원문 p79~97 | 763 | 50 | 15.3 |
| S1 기존 R2 u08 | 759 | 50 | 15.2 |
| S2 단순화 초안 | 755 | 59 | 12.8 |
| S3 제한 상세화 초안 | 803 | 59 | 13.6 |

S2의 짧은 문장은 읽기 쉬움의 실증이 아니고 S3는 설명을 얻는 대신 총 분량이 늘었다. 문법/지시어·대화 어조, Holmes의 시험과 추론, 문화어/유머 부담을 나눴다. CEFR·어휘 커버리지·이해/흥미 실측은 하지 않았다. 새 난도 추정기나 C06 미제작 본문의 지표를 만들지 않았다.

## 7. 실제 학습자 준비·D4 인계·남은 가치 공백

[기존 관찰표](./LEARNER_OBSERVATION.md)의 발견/선택·읽기 시작·도움 경험·직접 이해/흥미 피드백·자발 재개·다음 독서를 사용한다. 개발 코호트 트래픽은 실제 사람 증거에서 제외한다. 참가자·동의·자료 보관 조건을 충족한 뒤 시행하며, 도움의 체감은 직접 관찰/질문으로 확인한다. 새 노트 열기 이벤트·자유서술 DB·대시보드는 만들지 않았다. 동일 반전의 여러 판본 반복 노출은 첫 독서 비교를 오염시키므로 순서/노출을 별도로 다룬다. 성장은 새로운 미노출 지문과 독립 평가가 필요하다.

| 우선순위 | 다음 결정·제약 |
|---|---|
| P1 · D4 관찰 | 실제 독자가 선택형 맥락을 발견하고 도움받는지, 긴 단위 끝 배치/본문 흐름·원문/각색/목표 난도 이해를 관찰. 강제 도움/퀴즈·새 추천 엔진으로 대체하지 않음 |
| P1 · C06 | 특정 원천 권리 결정 뒤에만 최소 현대화 제작·해시/보존·독립 검수 진행. 현재 두 번째 실제 공개 작품이 없어 자발적 다음 작품 선택은 미검증 |
| P2 · 표본 | S2/S3의 경미 언어/의미 범위 의견을 전작 생산 전에 해결하고 실제 독자에게 도움/리듬 비용 확인. AI approve를 실험 우월성으로 쓰지 않음 |
| P2 · 실제 판본 선택/연계 | 기존 sibling/원문 대응·단어 도움·revision/앵커 재사용. 로컬 B1 초안을 공개 선택지로 광고하지 않음. VCP·듣기·교재생성 연계는 필요/권리/판본 결속을 별도 확인 |
| 독립 성장 평가 | 참가자·평가 자료가 준비된 별도 단계. 이번 UI/API/개발 계정/합성 검사로 독해 성장·독서 지속을 입증하지 않음 |

## 8. 최종 판정·통합 기록

- **기술**: W2 기능·권한·실제 dev 반환/PC 검증 수용. 기존 S4~S7을 보존하며 새 SQL/함수 하나 외 데이터 변경은 없다. 정확 SQL의 실제 적용·복구 경계를 기록했다.
- **콘텐츠**: C01 로컬 발췌의 AI 독립 검수 수용, minor 의견 유지. C06 비실행 준비 수용·권리/실제 제작/발행 HOLD. 사람 콘텐츠 검수로 올리지 않음.
- **실제 학습자 적합성·교육 효과**: `PILOT_NOT_RUN / EDUCATION_EFFECT_UNVERIFIED`. 선택/이해/지속·성장을 확인한 실제 참가자 자료가 없다.

이 문서의 입력 코드·SQL·콘텐츠 해시와 실제 종료/검증은 `R/final-closeout.json`, 최종 feature/main SHA·깨끗한 상태·통합 방법은 `R/integration.json`에 결속한다. 통합 뒤 실제 main 화면 확인도 해당 기록에 추가하며 검증 전 단계를 완료로 바꾸지 않는다.

### 로컬 main 통합 완료(2026-10-27)

검증 feature `41cb6bbf96c2b61b1269914e95e51d2612bf9671`을 기존 main `e0e834fb2`에 병합해 `ba81f4c02779993fe9a8a3c04e7524fd0158460d`로 통합했다. main의 Playwright 인증 흔적 가림 변경도 보존했다. 중앙 통합 검사의 타입·린트·관련 테스트233건이 통과했고, 오래된 `local/integration`은 다른 owner의 상태를 보존하여 변경하지 않았다. 도구가 안내한 exact-task 경로로 잠금·깨끗한 main·진행 Git 작업 없음 확인 후 검증 SHA만 병합했다.

기존 실제 3000 서버에서 정상 A1440/B1280 로그인으로 비로그인 본문/설명 차단, u03 두 항목/u04 한 항목/그 외 없음, 접기·펼치기·단위 이동 초기화·키보드·44px/focus·가로 넘침 없음을 확인했다. 실제 exit0이며 Codex가 두 크기의 열린 설명 화면을 직접 확인했다(`R/live-after-apply-2026-10-27T001641674Z/result.json`). 이 검사도 읽기 전용이며 기존 S7 진도 쓰기 검증을 새로 실행했다고 표시하지 않는다. 검사 후 Story12표 전체 행 지문은 적용 전과 동일했다.

이미 적용된 정확 SQL은 dev 원장 버전과 같은 [번호 migration](../../supabase/migrations/20261026235109_lcp_story_w2_context_notes.sql)에 바이트 그대로 반영했다(SHA `0fee756e6a50a0c57a37d2a3400ed4bb7a1ca420bf6dee31b96f2581094da319`). 저장소 반영만 수행했으며 DB 재적용·추가 SQL·복구 실행은 없었다. 등록 작업의 검증/수용 커밋과 이후 main의 문서·migration 반영 커밋은 구분하여 `R/integration.json`에 기록한다. 원격 main 직접 push는 하지 않았으며 기존 일일 동기화 경로를 유지한다.
