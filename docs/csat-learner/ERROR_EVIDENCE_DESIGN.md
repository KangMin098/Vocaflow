# C 오답 원인 Evidence 모델 — 설계안 (Phase 2)

> 상태: **설계안 · 미승인** (2026-10-03). 마이그레이션 · 구현 없음. 승인 뒤 다음 단계로 간다.
> 이 문서의 화면 변경(§7 자기보고) · 지도 C 의미 변경(승인 요청 5)은 **제안**이다 — Phase 1 목표의 「기존 /csat 기능 변경 금지」 범위 밖이라, 승인되면 Phase 2 목표 · 수용 기준을 따로 세운 뒤 구현한다.
> 원칙: 정답/오답 결과만으로 원인을 확정하지 않는다. `wrong answer → C code` 직접 규칙을 만들지 않는다.
> 수치는 전부 2026-10-03 DB 직접 질의(Supabase `jajenrevcbmrpaliomxv`) 결과다.

---

## 1. 현재 attempt 관련 DB 구조 조사

학생 응답을 담는 테이블은 넷이고, 용도가 서로 다르다.

| 테이블 | 키 | 담는 것 | 행 | 오답 | 선택 선지 |
|---|---|---|---|---|---|
| `csat_dx_session` + `csat_dx_response` | `(session_id, item_no)` | 실제 시험 1회분 기록(내 진단) — `chosen_option` · `is_correct` · `confidence`(sure/unsure/guess/timeout) | 세션 2 · 응답 90 | **70** | 70 모두 있음 |
| `csat_trap_attempts` | `id` | 함정 드릴 응답 — `choice` · `answer_trap` · `picked_trap` | 83 | 69 | 있음 |
| `csat_item_attempts` | `id` | DCP 연습 — `error_cause`(vocab/parsing/structure/inference/timing CHECK) | 20 | 1 | 없음 |
| `csat_session_attempts` | `id` | 세션 문항 기록 — `correct` · `confused` · `sec` | 1 | 1 | 없음 |

사실 확인:

- `csat_dx_response` 의 오답 70건은 **실사용자 1명(테스트 계정 아님) · 시험 2회**(M2409 · M2509, 원점수 17 · 27)다. 이 중 27건은 듣기(문항유형 없음), **독해 43건**은 전부 선택 선지가 있고 `csat_dx_option_trap` 과 이어진다.
- **그 두 회차는 입력 신뢰도 확인이 필요하다** — M2409 는 45문항 **전부 ②**, M2509 는 **전부 ③** 으로 입력돼 있다(2026-10-03 실측). 실제로 그렇게 답했을 수도 있지만(시간이 없어 한 번호로 마킹 등), 선지 하나하나를 판단한 결과라고 볼 근거가 없다. 그래서 오답 70건은 「학생이 그 선지를 골라서 틀렸다」는 원인 판정의 입력이 되지 못한다 — **원인 Pilot 에 쓸 수 있는 오답은 현재 확인된 것이 0건이다.** 실제 풀이였는지는 그 학습자에게 확인해야 알 수 있다.
- 같은 두 회차가 Phase 1 핵심 지도 · 스냅샷(`attribute_mastery` · `trapVulnerability` · 지도 관찰값)의 입력으로도 쓰이고 있다 — §12 와 승인 요청 6.
- `csat_dx_response.confidence` 는 90건 모두 `sure` — 화면이 아직 확신도를 묻지 않는다. 지금 값은 근거로 쓸 수 없다.
- `csat_trap_attempts` 69건은 **테스트 계정 1명**의 드릴 응답이다(R-TITLE 33건 편중). 학생 원인 근거로 쓰지 않는다.
- `csat_item_attempts.error_cause` 는 컬럼과 CHECK 는 있지만 **값이 있는 행이 0건**이다. 단일 값 · 출처 없음 · 검수 상태 없음이라 이번 설계 요구(0~N개, role, source, review)를 담지 못한다.
- 학생별 오답 원인을 담는 구조는 **지금 없다.**

## 2. C 기존 데이터 사용 현황

C 는 지금 **선지 쪽 데이터만** 있다.

- `csat_dx_option_trap` 3,387행 — 문항 847개의 오답 선지마다 `trap_key`(자유 문자열). 출처는 전부 `analysis`(AI 문항 분석), **검수 0건**(`reviewed_at` 없음).
- `trap_key` 는 **서로 다른 문자열 525개**. `csat_dx_trap_family` 에는 32개 key 가 있지만 그중 「국소 어색함」(12행)은 family 가 NULL 이라, **C1~C9 에 실제로 묶이는 것은 31개 key · 2,585 / 3,387행(76%)** 이다(family 표에 있기만 한 기준으로 세면 2,597행). 나머지 802행(24%, family 표에 아예 없는 790행 + family NULL 12행)은 긴 꼬리(「분사구문 주어 일치」「지시어 선행사 절단 (This sense)」처럼 괄호 설명이 붙은 변형이 많다)라 어느 C 에도 안 들어간다.
- 지도 노드 C1~C8 과 family 표가 어긋난다: family 표에는 **C9(글 구조 단서)** 가 있지만 지도 노드가 없고, 지도의 **C8(비유 선지)** 은 family 표에 매핑된 key 가 없다.
- C5(범위·강도 변형)에 「주체 역전」「등장인물 혼동」「항목 짝 바꾸기」가 섞여 있다 — 범위 · 강도가 아니라 관계 왜곡이다.
- 코드에서 C 를 쓰는 곳 — 입력 · 분모 · 의미가 서로 다르다:

  | 계산 | 위치 | 입력 | 분모 | 지금 쓰는 의미 |
  |---|---|---|---|---|
  | `trapVulnerability` | `diagnosis/engine/rule-v1.ts` | 내 진단 응답 — 오답일 때 **고른 선지의 family** | 그 family 선지가 보기 안에 있었던 문항 수(exposure) | `picked/exposure ≥ vulnerable_ratio` 면 「취약」 → 추천 라인 `TRAP:<family>` |
  | `trapAvoidance` | `diagnosis/engine/map-evidence.ts` → 지도 C1~C8 | 같은 응답 — 그 family 선지가 있던 문항에서 「그 family 를 골라 틀리지 않았는가」 | exposure 를 **배점 · 시간 감쇠 · 모드 가중**으로 합한 값(무응답 · timeout 제외) | 지도 C 라인 관찰값 — `trapVulnerability` 의 단순 반대가 아니다(가중 · 제외 조건이 다름) |
  | `my-traps` | `lib/csat/my-traps.ts` | 함정 드릴 응답 — **문항의 `answer_trap`** 별 맞힘/틀림 | 함정별 비율은 그 함정 드릴 수, 비중(share)은 **전체 드릴 오답 수** | 「내 함정」 목록 |

  앞의 둘은 **고른 선지의 family = 학생의 약점**으로 읽는다 — 사실상 `wrong answer → C code` 규칙이다. 측정한 것은 「그 왜곡에 걸렸다(선지 함정 노출)」까지이고, 왜 걸렸는지(원인)는 아니다. `my-traps` 는 드릴 문항 단위라 원인 판정과 무관하다.
- Phase 1 화면의 C 영역 설명(「오답 원인 분류 — 틀렸을 때 왜 틀렸는지 설명하는 분류」)도 같은 혼동이다. 실제 C1~C8 노드는 선지 쪽 데이터로만 계산된다.
  다만 `.agent-goal.md` 는 「C = 오답 원인 분류」로 정해 두었으므로 **지도 C 의 역할 변경은 이번에 하지 않고 사용자 결정으로 남긴다**(승인 요청 5).

## 3. Choice Trap 과 Learner Error Cause 분리안

```
Question ── Option ──► Choice Trap          (문항 · 선지 특성 — 학생과 무관, 한 번 정하면 모든 학생에게 같다)
Student Attempt ──► Observed Response       (고른 선지 · 정오 · 시간 · 확신도 — 관찰 사실)
                 └─► Error Cause Evidence[] (학생 처리 과정에서 무엇이 실패했나 — 0~N개, 근거와 출처가 있는 주장)
```

- **Choice Trap** 은 지금처럼 `csat_dx_option_trap`(item, option) 에 둔다. 새로 만드는 것은 자유 문자열 → 표준 trap 코드 대응표 하나뿐이다(§5-3).
- **Learner Error Cause** 는 새 테이블 하나에만 둔다. Choice Trap 테이블을 참조하지 않는다 — 학생이 C5 선지를 골랐다는 사실은 AI · 검수자가 **참고**할 관찰일 뿐, 원인 코드로 자동 변환하지 않는다.
- domain type 도 분리한다: `ChoiceTrapCode`(문항 쪽)와 `ErrorCauseCode`(학생 쪽)는 다른 타입 · 다른 코드 공간이고 이름이 겹치지 않는다.

## 4. 최소 taxonomy 초안

### 4-1. Choice Trap (선지 왜곡 방식) — 9개

| 코드 | 뜻 | 기존 family |
|---|---|---|
| `lexical_overlap` | 지문 낱말을 재활용해 맞아 보이게 | C1 |
| `irrelevant_truth` | 지문과 무관하거나 핵심이 아닌 참 | C2 |
| `part_whole` | 부분을 전체로 · 일부 사실 | C3 |
| `cause_effect_reversal` | 인과 · 시간 · 조건 순서 뒤집기 | C4 |
| `scope_strength` | 범위 과대 · 과소 · 강도 · 대소 비교 | C5 일부 |
| `relation_distortion` | 주체 · 대상 · 짝 바꾸기 | C5 일부(주체 역전 · 등장인물 혼동 · 항목 짝) |
| `polarity_reversal` | 반대 진술 · 연결사 방향 | C6 |
| `outside_text` | 지문 밖 상식 | C7 |
| `structure_cue` | 순서 · 삽입의 담화 단서 위반(지시어 · 첫 등장 · 연결사) | C9 |

- C8(비유 선지)은 매핑된 key 가 0개다 — 새 코드를 만들지 않고, 사례가 생기면 `relation_distortion` / `irrelevant_truth` 로 들어가는지 Pilot 에서 본다.
- 어법 문항의 「수일치 유인」「분사 태 판별」 같은 key 는 왜곡이 아니라 **형태 판별 지점**이다 — Choice Trap 에 넣지 않고 `grammar_point` 로 따로 표시만 한다(원인 쪽 `S.*` 와 대응은 하지 않는다).

### 4-2. Learner Error Cause (학생 처리 실패) — 20개, 6 영역

제안 목록(약 30개)을 아래 기준으로 줄였다: ① Choice Trap 과 같은 것을 다시 세지 않는다 ② 지금 데이터 · 자기보고로 구별할 수 없는 쌍은 합친다 ③ 역량 원인(V · S · R · E)은 핵심 축과 1:1, 행동 원인(B)은 지도 D(행동 진단), 실행 원인(X)은 핵심 지도 X(실전 실행)와 이어진다.

코드 수: V 3 · S 4 · R 4 · E 4 · B 3 · X 2 = **20**. **B 는 역량 축이 아니다** — verified 집계(§9)에서 빠지고, V/S/R/E 원인을 판정할 때 「추측이라 원인 판단 불가」를 가르는 데 쓴다.

| 영역(축) | 코드 | 합친 것 · 뺀 것 |
|---|---|---|
| **V 어휘** | `V.unknown_word` | |
| | `V.word_sense` | wrong_word_sense |
| | `V.chunk` | phrase_chunk_failure(연어 · 구동사 포함) |
| **S 문장해석** | `S.core` | sentence_core |
| | `S.modifier_scope` | |
| | `S.clause_relation` | complex_structure 는 뺐다 — 결과 증상이고 어디가 복잡했는지는 위 셋 중 하나로 남긴다 |
| | `S.negation_comparison` | |
| **R 독해** | `R.reference` | reference_tracking |
| | `R.sentence_relation` | |
| | `R.main_idea` | information_hierarchy 를 합쳤다 — 학생 보고 · 판정에서 구별되지 않는다 |
| | `R.inference` | |
| **E 근거판단** | `E.question_demand` | |
| | `E.evidence_location` | |
| | `E.paraphrase_match` | |
| | `E.option_check` | scope · strength · polarity · relation judgment 넷을 **하나로** 합쳤다. 원인 쪽은 「선지를 지문과 대조하는 단계가 실패했다」까지만 기록한다. 학생이 **어느 면**을 놓쳤는지는 Choice Trap 으로 대신하지 않는다 — 선지의 왜곡 방식은 문항 특성일 뿐이고, 학생 쪽 facet 은 **미확정**으로 둔다 — 자기보고 2단계도 이 코드 하나만 고르므로 facet 을 모으지 못한다. facet 을 가르는 근거(확인 진단 문항 등)는 별도 설계 |
| **B 행동** | `B.guess` | |
| | `B.outside_knowledge` | |
| | `B.no_verification` | insufficient_review · answer_choice_bias 를 합쳤다 — 관찰상 「끝까지 대조하지 않고 골랐다」로 같다 |
| **X 실행** | `X.time_pressure` | unfinished 를 합쳤다(미응답 · 시간 부족은 응답 기록에서 관찰된다) |
| | `X.concentration` | |

- L(듣기)은 넣지 않았다 — 듣기 오답 27건은 있지만 문항유형 · 선지 함정 근거가 없고, Phase 1 결정대로 L 은 「데이터 없음 · 진단 필요」다. Pilot 이 독해에서 안정된 뒤 `L.*` 를 따로 설계한다.
- **버전 봉인**: 판정(AI 실행 · 검수 회차)은 **봉인된 taxonomy_version 으로만** 시작한다. 동시성: 사전 행 INSERT 트리거와 봉인 RPC 는 둘 다 부모 행(`csat_taxonomy_version` · `csat_error_review_round`)을 `select … for update` 로 잠근 뒤 `sealed_at` 을 확인 · 기록한다 — 봉인과 추가가 경쟁해도 봉인 뒤 행이 들어오지 않는다(회귀: 두 트랜잭션 동시 실행). 명부 INSERT 도 같은 방식으로 회차 행을 잠근다. 봉인 뒤에는 그 버전에 코드 · 대응 · override 를 더할 수 없다 — 더하려면 새 버전.
- **은퇴**: 코드는 지우지도 끄지도 않는다 — 다음 taxonomy_version 사전에서 빠지면 은퇴다. 현재 판정 · 승격 집계는 **현재 taxonomy_version 의 판정만** 세므로(§9) 은퇴한 코드의 옛 승인이 반영되지 않는다.
- **Pilot 전 고정할 것(taxonomy_version 1 의 `definition`)**: 코드마다 ① 한 문장 정의 ② 필수 근거(어떤 인용이 있어야 이 코드를 고를 수 있나) ③ 인접 코드와의 구별 기준(예: `V.word_sense` vs `R.inference` — 낱말 뜻을 알았는데도 틀렸으면 V 가 아니다) ④ 판단 불가 조건(이 경우 `insufficient_evidence`). 이 정의서를 판정자 · AI 지시문이 **같은 파일**로 읽는다(`docs/csat-learner/error-cause-codes.v1.md` — 승인 뒤 작성, 문서와 사전 시드가 같은 원천).
- 위 목록은 **확정안이 아니다.** Pilot(§10)에서 충돌이 많은 쌍은 합치고, 설명 못 하는 사례가 반복되면 하나씩만 더한다.

## 5. error evidence 스키마 초안

### 5-1. 새 테이블(전부 추가만 — 기존 테이블 변경은 §11 의 선택 항목뿐)

아래 SQL 은 **설명 순서**다. 마이그레이션은 참조 순서로 만든다: `csat_taxonomy_version` → `csat_error_cause_code` → `csat_choice_trap_map` · `csat_choice_trap_override` → `csat_error_evidence`(실행 FK 없이) → `csat_error_judgment_run` → evidence 의 실행 복합 FK(alter) → `csat_error_judgment_input` → `csat_error_process_note` → `csat_error_review_round` → `csat_error_review_roster` → `csat_error_review` → `csat_error_review_lock` → `csat_dx_session_attestation` → 트리거 · 함수 · 권한.

```sql
-- 사전 버전 — 봉인된 버전에는 코드 · 대응 · override 를 더 넣을 수 없다(트리거: 세 사전 테이블 INSERT 시 sealed_at IS NULL 확인)
create table csat_taxonomy_version (
  version    int primary key,
  definitions_hash text,                      -- 봉인 때 정의서 파일 해시
  sealed_at  timestamptz                      -- NULL → 값 한 번만(트리거)
);

-- 원인 코드 사전(버전 관리) — 코드를 지우지 않는다. 다음 taxonomy_version 에서 빼면 은퇴
create table csat_error_cause_code (
  code        text not null,                     -- 'S.modifier_scope'
  axis        text not null check (axis in ('V','S','R','E','B','X')),
  label_ko    text not null,
  student_group text check (student_group in ('word','sentence','flow','choice','time')),  -- 자기보고 상위 분류(§7) — B 만 NULL
  check (axis = 'B' or student_group is not null),
  taxonomy_version int not null references csat_taxonomy_version(version),
  definition  text not null,                    -- 판정 기준 문장 — 버전마다 고정(같은 버전 수정 불가 · 트리거) · 입력 해시에 정의서 해시도 넣는다
  primary key (code, taxonomy_version)
);

-- 오답 원인 evidence — attempt 하나에 0~N 행
create table csat_error_evidence (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- attempt 참조: 지금은 내 진단 응답 하나만 — 다른 응답 테이블은 Pilot 뒤 별도 결정
  session_id    uuid not null,
  item_no       smallint not null,
  foreign key (session_id, item_no) references csat_dx_response(session_id, item_no) on delete cascade,
  item_id       text not null references csat_items(id),   -- 조회용 비정규화(응답 행에서 복사)
  error_code    text,                          -- student 행만 NULL 허용(영역만 고른 자기보고, §7)
  role          text not null check (role in ('primary','contributing')),
  source        text not null check (source in ('student','ai','reviewer')),
  confidence    text check (confidence in ('low','medium','high')),
  evidence      jsonb not null,                -- §5-2
  review_status text not null default 'proposed'
                check (review_status in ('proposed','accepted','rejected','needs_review','withdrawn')),
  taxonomy_version int not null references csat_taxonomy_version(version),   -- 재판정 이력을 버전별로 보존(§8) · 코드가 NULL 인 영역 보고도 버전은 검증된다
  foreign key (error_code, taxonomy_version) references csat_error_cause_code(code, taxonomy_version),
  prompt_version  text,                        -- AI 행만 필수
  judgment_run_id bigint,                      -- AI 행: 이 행을 낸 실행(아래 표) — FK 는 표 생성 뒤 alter 로 건다
  proposed_by   uuid references auth.users(id) on delete set null,   -- student: 학생 본인 · reviewer: 판정자 사람
  proposer_agent_run text,                     -- ai · 에이전트 reviewer: 실행 id
  proposer_key  text not null,                 -- 고정 주체 식별(명부의 reviewer_key 와 같은 규칙 — AI 는 에이전트 정의 + 모델, 실행 id 는 proposer_agent_run 에 따로) — 계정 삭제 뒤에도 남는다
  input_hash    text not null,                 -- 이 행을 만들 때 본 입력(§8 해시) — 지금 해시와 다르면 집계에서 뺀다
  provenance    jsonb not null default '{}',   -- §6
  created_at    timestamptz not null default now(),
  -- source 별 규칙
  check (source = 'student' or error_code is not null),
  check (source = 'ai' or confidence is null),             -- 신뢰도는 AI 만 갖는다
  check (source <> 'ai' or confidence is not null),
  check ((source = 'ai') = (judgment_run_id is not null)),
  check (source <> 'ai' or proposer_agent_run is not null),
  check (source <> 'ai' or prompt_version is not null)
  -- review_status 는 아래 csat_error_review 의 합의 결과를 서버가 반영한다
);
-- 검수 기록 — 판정자별 개별 판정을 지우지 않고 남긴다. 두 단계:
--   phase='blind'  : 응답 하나를 보고 판정자가 **스스로 원인을 고른다**(AI · 다른 판정자 · 자기보고 비공개). 「원인 없음」도 답이다 → κ 측정용
--   phase='verify' : 그 뒤 AI · 자기보고를 열고 각 evidence 행에 accept/reject → 합의 · 승격용
create table csat_error_review (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null, item_no smallint not null,
  foreign key (session_id, item_no) references csat_dx_response(session_id, item_no) on delete cascade,
  phase         text not null check (phase in ('blind','verify')),
  review_round  int not null references csat_error_review_round(review_round),   -- 검수 회차(taxonomy 수정 뒤 재판정 = 새 회차)
  taxonomy_version int not null references csat_taxonomy_version(version),               -- 그 회차가 쓴 사전 버전(「원인 없음」 판정도 버전을 갖는다)
  input_hash    text not null,                 -- 판정자가 본 입력(§8 과 같은 해시) — 지금 해시와 다르면 그 판정은 「재검수 대기」
  evidence_id   uuid references csat_error_evidence(id) on delete cascade,   -- verify 만(blind 는 응답 단위)
  blind_outcome text check (blind_outcome in ('code','no_cause','insufficient_evidence','no_fitting_code')),  -- blind 만 필수
  chosen_code   text,                          -- blind_outcome='code' 일 때만 — primary
  contributing_code text,                      -- blind: 선택(있으면) — blind_outcome='code' 일 때만
  foreign key (contributing_code, taxonomy_version) references csat_error_cause_code(code, taxonomy_version),
  excluded_axes text[],                        -- blind: 판정자가 「이 응답에서 아니다」라고 명시한 축(반증 근거) — V · S · R · E 만,
                                               --   chosen_code · contributing_code 의 축과 겹치면 거부(트리거: 사전에서 코드의 축을 찾아 비교)
  check (excluded_axes is null or excluded_axes <@ array['V','S','R','E']),
  foreign key (chosen_code, taxonomy_version) references csat_error_cause_code(code, taxonomy_version),
  reviewer_id   uuid references auth.users(id) on delete set null,   -- 계정이 지워져도 기록은 남는다
  reviewer_label text not null,                -- 'R1' · 'R2' 처럼 Pilot 안에서 고정된 이름(감사용)
  verdict       text check (verdict in ('accept','reject','unsure')),        -- verify 만
  note          text not null,
  independent   boolean not null default true,   -- blind: **제출 시점**에 공개 이력이 있으면 false — κ 는 true 만
  created_at    timestamptz not null default now(),
  -- 단계별 필수 · 금지: blind = evidence 없음 · verdict 없음(chosen_code 는 NULL 가능) / verify = evidence · verdict 둘 다 필수 · chosen_code 없음
  check (phase <> 'blind'  or (evidence_id is null and verdict is null and blind_outcome is not null
                              and (blind_outcome = 'code') = (chosen_code is not null)
                              and (blind_outcome = 'code' or contributing_code is null))),
  check (phase <> 'verify' or (evidence_id is not null and verdict is not null and chosen_code is null
                              and contributing_code is null and blind_outcome is null and excluded_axes is null))
);
create unique index on csat_error_review (session_id, item_no, reviewer_label, review_round) where phase = 'blind';
create unique index on csat_error_review (evidence_id, reviewer_label, review_round) where phase = 'verify';
-- verify 행의 (session_id, item_no) 는 그 evidence 의 응답 키와 같아야 한다 — 트리거로 강제
-- 검수 시작 기록(잠금) — 검수표를 export 할 때 응답마다 한 행. 있으면 학생 자기보고 수정 · 철회 RPC 가 거부한다
create table csat_error_review_lock (
  session_id uuid not null, item_no smallint not null,
  foreign key (session_id, item_no) references csat_dx_response(session_id, item_no) on delete cascade,
  review_round int not null,
  input_hash text not null,                     -- 검수표에 실은 입력
  self_report_id uuid references csat_error_evidence(id),   -- 검수표에 실은 자기보고 행(없으면 NULL)
  locked_at timestamptz not null default now(),
  cancelled_at timestamptz,                    -- 회차 취소(행은 지우지 않는다)
  primary key (session_id, item_no, review_round)
);

-- 회차 — 시작 RPC 하나가 한 트랜잭션에서 ① 회차 행(대상 · 버전) ② 명부 행 ③ 사전 검사(제안자 ≠ 판정자 · 이전 공개 이력) ④ sealed_at 을 쓴다.
--   그 뒤로는 대상 · 명부 추가를 거부하고, 공개(2차 검수표) 이후에는 blind 판정도 거부한다
--   이전 공개 이력: 판정자(reviewer_key)가 **이전 회차에서 같은 문항(item_id)의 AI 가설 · 자기보고를 이미 본 적이 있으면**(그 회차 disclosed_at 이 있고 명부에 있었으면)
--   — 응답이 달라도(다른 학생 · 재응시) — 새 blind 판정은 저장하되 `independent=false` 로 표시해 κ 에서 뺀다.
--   검사 시점은 회차 시작이 아니라 **blind 제출 RPC** 다(동시에 열린 다른 회차가 그 사이 공개됐을 수 있다). 공개 RPC 와 제출 RPC 는
--   (reviewer_key, item_id) 단위 advisory lock 을 잡아 순서를 맞춘다 — 공개가 먼저 끝나면 뒤의 제출은 independent=false. taxonomy · prompt · 입력 변경 어느 재검수에도 같다.
--   공개 이력은 회차 targets(item_id 포함)와 명부로 계산한다 — **취소된 회차도 disclosed_at 이 있으면 포함**한다(별도 테이블 없이 재현 가능)
create table csat_error_review_round (
  review_round int primary key,
  targets      jsonb not null,                 -- [{session_id, item_no, item_id, input_hash, judgment_run_id, evidence_ids[]}] — 시작 때 고정 · item_id 는 응답이 지워져도 공개 이력을 재현하려고 보존
  taxonomy_version int not null references csat_taxonomy_version(version), prompt_version text not null,   -- 회차가 검수하는 판정 버전(봉인)
  sealed_at    timestamptz,                    -- 대상 · 명부 봉인(시작 RPC 가 마지막에 채운다 — NULL 인 회차는 아직 시작 중)
  disclosed_at timestamptz,                    -- 2차(AI · 자기보고) 공개 시각 — 회차 전체 blind 완료 뒤에만 채울 수 있다
  cancelled_at timestamptz
);
-- 검수 RPC: targets 밖 응답의 판정 거부 · 명부 insert 는 sealed_at 이후 거부 · disclosed_at 이후 blind 판정 거부
--   verify 는 targets 에 봉인된 evidence_ids 에만 받는다 — 회차 도중 taxonomy · prompt 가 바뀌어 새 AI 실행이 생겨도 이 회차의 대상은 바뀌지 않는다
--   (새 실행은 다음 회차 대상). 대상 하나라도 입력 해시가 바뀌거나 실행 · evidence 가 봉인값과 달라지면 **그 회차 전체를 취소**하고,
--   이미 들어온 판정은 보존한 채 바뀌지 않은 대상만으로 새 회차를 재봉인한다(바뀐 대상은 그다음 회차) — 한 응답 때문에 나머지 공개가 영구히 막히지 않는다.
-- 대상 소멸: 대상 응답이 세션 삭제로 사라지면 그 회차를 취소(cancelled_at)하고, 남은 대상으로 새 회차를 연다(봉인 · 명부 다시).
--   FK 연쇄 삭제만으로는 회차 취소 · 잠금 해제가 일어나지 않으므로 **`csat_dx_session` 의 BEFORE DELETE 트리거**가
--   같은 트랜잭션에서 ① 그 세션이 대상인 열린 회차 취소 ② 같은 회차의 다른 대상 잠금 cancelled_at 을 한다.
--   응답 단위 삭제도 같은 처리: `csat_dx_response` 에도 BEFORE DELETE 트리거(그 응답이 대상인 열린 회차 취소 · 잠금 해제)를 건다 —
--   응답 직접 삭제(service_role · 정리 스크립트)로 evidence · 검수가 연쇄 삭제될 때도 회차가 남지 않는다. 회귀: 「응답 하나만 직접 삭제 → 회차 취소」.
--   동시성: 회차 시작 RPC 는 대상 세션 행들을 `select … for share` 로 먼저 잠근다 — 진행 중인 세션 삭제(행 잠금 필요)와 충돌해 둘 중 하나가 기다린다.
--   그래서 「시작이 아직 커밋 전이라 삭제 트리거가 새 회차를 못 본다」가 생기지 않는다(회귀: 시작 · 삭제 동시 실행).
--   트리거라서 세션이 사라지는 **모든 경로**(`deleteExamSession` · 계정 삭제의 연쇄 삭제 · 관리자 정리)에 똑같이 걸린다.
--   기존 `deleteExamSession` 은 바꾸지 않는다 — 스냅샷 삭제 · 재계산 같은 기존 후처리도 그대로 돈다.
--   회귀: 「최신이 아닌 회차 삭제 → 스냅샷 재계산으로 그 회차 관찰값이 빠진다」 · 「검수 대상 세션을 계정 삭제로 지움 → 회차 취소 · 잠금 해제」.
--   회귀 검증: 「blind 진행 중 대상 세션 삭제 → 회차 취소 · 새 회차 생성 · 남은 판정 보존」.

-- 회차별 판정자 명부 — 판정은 명부에 있는 사람만, 같은 회차 안에서 서로 다른 주체여야 한다
create table csat_error_review_roster (
  review_round  int not null,
  reviewer_label text not null,                -- 'R1' · 'R2'
  reviewer_id   uuid references auth.users(id) on delete set null,   -- 사람 판정자(계정이 지워져도 명부 행 · 라벨은 남는다)
  agent_run     text,                          -- 에이전트 판정자면 실행 id(사람이면 NULL)
  pre_disclosed_items text[] not null default '{}',   -- DB 밖(리허설 등)에서 이미 본 문항 — 봉인과 함께 고정
  primary key (review_round, reviewer_label),
  reviewer_key  text not null,                -- 계정 · 실행과 무관한 **고정 주체 식별**(사람: 생성 시 user id 문자열 · 에이전트: 에이전트 정의 이름 + 모델, 예 'agent:err-judge@claude-opus-5-5') — 실행 id 가 아니다
  unique (review_round, reviewer_key)          -- 같은 주체가 R1 · R2 를 겸하지 못한다
);
-- 검수 RPC 는 명부에 없는 판정을 거부하고, 명부의 reviewer_key 가 그 evidence 의 proposer_key 와 같으면 거부한다(계정 삭제와 무관)
-- (기존 csat 독립 검수 게이트와 같은 원칙: 제안자 ≠ 판정자)

-- blind 불변 — 검수 행은 insert 만 허용. update 트리거는 **`reviewer_id` 의 기존 값 → NULL 전환 하나만** 허용하고(계정 삭제의 ON DELETE SET NULL),
--   그 밖의 모든 컬럼 변경(대상 · 응답 키 · 버전 · 판정 · 독립성 · 라벨 포함)은 거부한다 — 검수자 계정 삭제는 막히지 않는다.
--   (마이그레이션 검증에 「검수 행이 있는 판정자 계정 삭제가 성공하고 판정 내용은 그대로」 회귀를 넣는다)
--   **직접 delete 는 금지**(권한 · RLS 로 — 어떤 역할에도 delete 를 주지 않는다).
--   트리거로 delete 를 막지 않는 이유: 그러면 학생의 세션 삭제(on delete cascade)까지 막힌다. FK 연쇄 삭제는 권한 검사를 거치지 않으므로
--   「직접 삭제 불가 · 소유자의 세션 삭제에 따른 연쇄 삭제는 허용」이 된다. blind 판정을 고치려면 새 review_round 로만.
--   κ 는 각 회차의 최초 blind 행으로만 잰다 — AI 공개 뒤 고친 답이 섞이지 않는다.
-- blind 게이트 — **회차 전체 봉인**: 한 회차의 모든 응답에서 명부 판정자 전원의 blind 판정이 들어오기 전에는 그 회차의 어떤 AI · 자기보고 내용도 내주지 않고,
-- verify 판정도 받지 않는다(응답별로 열면, 같은 문항 · 선지를 고른 다른 응답을 판정할 때 이미 AI 가설을 본 상태가 된다).
-- 검수표 export 는 두 파일로 나눈다(1차: 회차 전체 입력만 · 2차: 회차 blind 봉인 뒤 AI · 자기보고 포함).

-- 합의 규칙(evidence.review_status · 현재 회차 기준):
--   합의 분모 = 그 evidence 의 **제안자를 뺀** 명부 판정자. 분모가 2명 미만이면 그 회차 명부에 판정자를 더 넣어 2명을 채운다
--   Pilot 명부는 회차 시작 전에 **R1 · R2 두 명으로 고정**한다. blind 는 두 명 모두 필수 · κ 는 R1–R2 쌍 하나로 잰다.
--   Pilot 에서는 판정자가 새 원인 행(source='reviewer')을 내지 않는다 — 대안 원인은 blind 판정(chosen_code)으로만 남긴다.
--   회차 시작 전 검사: 명부 R1 · R2 의 reviewer_key 가 그 회차 대상의 **모든 evidence 제안자**(AI 실행 · 자기보고를 낸 학생)의 proposer_key 와 겹치면 회차를 시작하지 않는다 —
--   또 **모든 대상 세션의 소유자(csat_dx_session.user_id)** 와 명부 판정자의 reviewer_id 를 따로 비교해, 겹치면 시작하지 않는다
--   (자기보고를 안 낸 학생도 자기 응답의 판정자가 될 수 없다).
--   학생은 자기 응답의 판정자가 될 수 없고,
--   AI 제안을 만든 에이전트 실행은 판정자가 될 수 없고, 그 실행의 blind 판정도 받지 않는다.
--   그래서 합의 분모는 항상 R1 · R2 둘이다. reviewer 행은 Pilot 이후 3인 명부에서만 허용한다.
--   분모 전원 accept → accepted · 전원 reject → rejected · 갈리거나 일부만 판정 → needs_review(보류)

-- 유일성 — AI 는 실행 단위(재판정은 새 실행 = 새 행), 학생은 응답 단위
create unique index on csat_error_evidence (judgment_run_id, error_code) where source = 'ai';
create unique index on csat_error_evidence (judgment_run_id) where source = 'ai' and role = 'primary';
-- 학생: 응답당 철회되지 않은 보고는 버전과 무관하게 **하나**(primary)만 — 수정 RPC 는 이전 버전 보고까지 같은 트랜잭션에서 철회한다
create unique index on csat_error_evidence (session_id, item_no) where source = 'student' and review_status <> 'withdrawn';
-- 철회된 행은 지우지 않고 남는다 = 수정 이력

-- AI 판정 실행 기록 — 「원인 0개」도 완료로 남겨 같은 버전으로 다시 내보내지 않는다
create table csat_error_judgment_run (
  id         bigint generated always as identity primary key,   -- 명시적 실행 순서
  session_id uuid not null, item_no smallint not null,
  foreign key (session_id, item_no) references csat_dx_response(session_id, item_no) on delete cascade,
  taxonomy_version int not null references csat_taxonomy_version(version), prompt_version text not null, run_id text not null,
  input_hash text not null,                     -- 판정에 쓴 전체 입력의 해시(§8)
  outcome text not null check (outcome in ('proposed','no_cause','insufficient_evidence','no_fitting_code','failed')),
  failure  text,                                -- failed 일 때 이유(인용 없음 · 사전에 없는 코드 …)
  alternatives text[],                          -- insufficient_evidence 일 때 가르지 못한 후보 코드(행으로 만들지 않는다)
  created_at timestamptz not null default now()
);
create unique index on csat_error_judgment_run (session_id, item_no, taxonomy_version, prompt_version, input_hash) where outcome <> 'failed';
alter table csat_error_judgment_run add unique (id, session_id, item_no, taxonomy_version, prompt_version);
-- 복합 FK — evidence 가 다른 응답 · 버전의 실행에 붙지 못한다
alter table csat_error_evidence add foreign key (judgment_run_id, session_id, item_no, taxonomy_version, prompt_version)
  references csat_error_judgment_run(id, session_id, item_no, taxonomy_version, prompt_version) on delete cascade;

-- 응답과의 일관성은 DB 가 강제한다(트리거): item_id = 응답의 item_id · 응답이 오답 · user_id = 세션 소유자
-- 학생 행 상태: insert 는 review_status='proposed' 만, 학생 update 금지,
--             학생은 delete 대신 철회(withdrawn) — **현재 유효한 잠금**(취소 안 됨 · 입력 해시 같음)이 있는 동안만 철회 · 수정 불가.
--             잠금이 취소되거나 입력이 바뀌면 다시 수정할 수 있고, 지난 행 · 판정은 지우지 않고 남는다(철회 행 · 지난 회차 = 감사 이력)
```

- **`system` source 는 두지 않는다.** 관찰 사실(고른 선지 · 정오 · 시간 · 확신도 · 선지의 trap)은 이미 응답 테이블과 `csat_dx_option_trap` 에 있다. 같은 사실을 원인 테이블에 다시 쓰면 「system 이 원인을 말했다」로 읽힐 위험만 생긴다.
- `role` 은 출처별로 매긴다 — 학생과 AI 가 primary 를 서로 다르게 낼 수 있고, 그 불일치가 측정 대상이다.
- **권한(신규 테이블 13개 전부)**: 생성 직후 `revoke all on … from public, anon, authenticated, service_role` — 이 DB 의 기본 권한은 **service_role 에도 DELETE · TRUNCATE 를 준다** — 그다음 아래 표의 권한만 다시 `grant` → `enable row level security`. 마이그레이션 검증 쿼리: 13개 테이블 모두 `has_table_privilege('service_role', …, 'DELETE')` 와 `'TRUNCATE'` 가 false.

  **원칙: 신규 테이블은 전부 덧붙이기 전용이다.** 어떤 역할(service role 포함)에도 DELETE · TRUNCATE 를 주지 않는다 — 행이 사라지는 길은 **학생의 세션 삭제에 따른 FK 연쇄 삭제 하나뿐**이다(연쇄 삭제는 권한 검사를 거치지 않는다). UPDATE 는 아래에 적은 컬럼 전환만 트리거로 허용하고, 그 밖의 변경은 새 행으로 한다.

  | 테이블 | anon | authenticated | service role | 허용되는 UPDATE(트리거) |
  |---|---|---|---|---|
  | `csat_taxonomy_version` | 없음 | SELECT | SELECT · INSERT · UPDATE | `definitions_hash` · `sealed_at` NULL→값 한 번(봉인 RPC 만 — 같은 트랜잭션에서 두 값을 함께 채움) · 그 밖 변경 불가 |
  | `csat_error_cause_code` · `csat_choice_trap_map` · `csat_choice_trap_override` | 없음 | SELECT | SELECT · INSERT | **없음** — 은퇴 · 정의 · 축 · 분류 · 대응 변경은 모두 **새 taxonomy_version**(새 버전에서 빼면 은퇴). 같은 버전 안의 상태 변화가 없으므로 정의서 해시가 그 버전의 의미 전체를 고정한다 |
  | `csat_error_judgment_run` | 없음 | 없음 | SELECT · INSERT | 없음 |
  | `csat_error_review_round` | 없음 | 없음 | SELECT · INSERT · UPDATE | `sealed_at` NULL→값 · `disclosed_at` NULL→값 · `cancelled_at` NULL→값 만(각각 전용 RPC) — targets · 버전 변경 불가 |
  | `csat_error_review_roster` | 없음 | 없음 | SELECT · INSERT | `reviewer_id` →NULL(계정 삭제)만 · 회차 봉인 뒤 INSERT 거부 |
  | `csat_error_review_lock` | 없음 | 없음 | SELECT · INSERT · UPDATE | `cancelled_at` NULL→값 만 |
  | `csat_dx_session_attestation` | 없음 | 자기 행 SELECT(RPC 로만 INSERT) | SELECT · INSERT | `confirmed_by` →NULL 만 |
  | `csat_error_process_note` | 없음 | 자기 행 SELECT(RPC 로만 INSERT — 소유 · 오답 · 기준 검사) | SELECT · INSERT | 없음(고치면 새 revision) |
  | `csat_error_judgment_input` | 없음 | 없음 | SELECT · INSERT | 없음 |

  아래 세부 표는 이 원칙의 테이블별 적용이다.

  | 테이블 | anon | authenticated | service role |
  |---|---|---|---|
  | `csat_error_cause_code` · `csat_choice_trap_map` · `csat_choice_trap_override` | 없음 | SELECT(정책: 전체) | 위 원칙 |
  | `csat_error_evidence` | 없음 | SELECT(정책: `user_id = auth.uid()` **and `source = 'student'`** — AI · reviewer 행은 검수 전 가설이라 학생에게 보이지 않는다) | SELECT · INSERT · UPDATE(트리거로 `review_status` 만) |

  **주장 불변**: evidence 행의 주장 내용(error_code · role · evidence · 버전 · 응답 키 · 제안자)은 insert 이후 바꿀 수 없다 — update 트리거가 `review_status` 변경과 `proposed_by` 의 → NULL 전환(계정 삭제)만 허용한다. 주장을 고치려면 새 행 · 새 검수로. 그래서 봉인된 evidence id 에 붙은 승인이 다른 내용에 붙어 있는 일이 생기지 않는다.
  | `csat_error_review_round` · `csat_error_review_roster` · `csat_error_review_lock` · `csat_error_judgment_run` | 없음 | **없음**(학생에게 명부 · 잠금 · 실행 기록을 보이지 않는다) | 위 원칙 |
  | `csat_error_review` | 없음 | **없음** | **SELECT · INSERT 만** — `revoke update, delete, truncate … from service_role` (판정 불변) |

  세션 삭제에 따른 연쇄 삭제는 권한과 무관하게 동작한다 — 마이그레이션 검증 쿼리에 「검수 행이 있는 테스트 세션을 소유자 경로로 지우면 검수 행도 사라진다 · service_role 의 직접 delete 는 거부된다」 두 가지를 넣는다(격리 브랜치에서).

  함수(RPC) 기본 권한: 이 DB 는 전역 `PUBLIC` EXECUTE 는 이미 회수돼 있지만, `public` 스키마 기본 권한으로 새 함수에 `authenticated` · `service_role` EXECUTE 가 붙는다. 그래서 **함수 생성과 같은 트랜잭션에서** `revoke execute on function … from public, anon, authenticated` 를 명시하고 필요한 역할에만 준다(기본 권한이 바뀌어도 결과가 같게):
  학생 자기보고 쓰기 · 지우기 RPC → `security definer` + `set search_path = ''` · `auth.uid()` 로 소유 확인 · `grant execute … to authenticated`.
  AI import · 검수 RPC → `grant execute … to service_role` 만.
  마이그레이션 뒤 `has_function_privilege('authenticated', …, 'execute')` 로 확인하는 검증 쿼리를 같이 낸다.
- **쓰기 경로**: 학생은 테이블에 직접 쓰지 않는다 — 서버 API 가 세션 소유자 · 응답 존재 · 오답 여부를 확인하고 `item_id` 를 응답에서 복사해 넣는다. RLS 는 자기 행 **읽기**만 연다. 위 트리거가 서버 버그에 대한 두 번째 방어선이다.
- `ai` · `reviewer` 행 · 모든 상태 변경(accepted · rejected · needs_review)은 서버(service role)만. 상태 금지를 source 별 CHECK 로 두지 않는다 — reviewer 가 자기보고를 승인할 수 있어야 하므로 권한은 쓰기 경로로 막는다.
- **현재 AI 판정** = 그 응답의 실행 중 **현재 taxonomy_version · 현재 prompt_version · 지금 다시 계산한 input_hash 가 모두 같고** `outcome <> 'failed'` 인 것 하나(같은 조건이 둘이면 큰 `id`). 없으면 **「재판정 대기」** — 옛 실행의 원인을 현재 근거로 쓰지 않는다. 그 실행이 `no_cause` 면 현재 AI 원인은 없다. `proposed` 면 그 `judgment_run_id` 의 evidence 행들이 현재 판정이다.
- **현재 검수** — verify 판정은 `evidence_id` 단위라 **그 행을 낸 실행(`judgment_run_id`) · 그 자기보고 행에만** 붙는다. 새 AI 실행이나 새 자기보고는 새 evidence 행이므로 옛 승인이 옮겨 가지 않는다. 회차는 그 응답의 가장 큰 `review_round` 이면서 회차 봉인값(taxonomy_version · prompt_version · judgment_run_id · evidence_ids(자기보고 행 포함) · input_hash)이 **모두** 지금의 현재 판정과 같은 회차. 하나라도 다르면 그 응답은 「재검수 대기」 — 옛 실행의 blind 판정 · 반증을 새 실행에 쓰지 않는다. 해시가 다르면 「재검수 대기」로 집계에서 뺀다. 이전 회차 판정은 감사 이력으로만 남고 집계에 쓰지 않는다. 한 회차는 지정된 판정자(Pilot: R1 · R2) 모두가 판정해야 **합의 완료** — 미완료 회차는 「보류」. 옛 실행 · 행은 지우지 않는다(재판정 비교용).
- **세션 삭제**: 학생이 시험 기록을 지우면(`deleteExamSession`) 응답 FK `on delete cascade` 로 그 응답의 evidence · 검수 기록도 함께 지워진다 — 학생의 자기 기록 삭제권이 우선이다. 「검수된 자기보고는 지울 수 없다」는 **행 단위 삭제**(학생 API)에만 적용된다. Pilot 측정값(일치율 · 사례표)은 판정 직후 리포트 파일로 남겨 세션 삭제와 무관하게 보존한다.

### 5-2. `evidence` jsonb 모양(종류별 키 하나만 필수)

```json
{ "kinds": ["chosen_option", "self_report"],
  "chosen_option": 3, "correct": [2],
  "option_trap": "scope_strength",           // 관찰 참고 — 원인 아님
  "self_report": { "group": "sentence", "detail": null },
  "text_refs": [{ "where": "passage", "quote": "not always easy to" }],
  "summary": "수식 범위를 'easy' 까지만 잡아 부정을 놓침",
  "note": null }
```

- AI 행은 `text_refs`(지문 · 선지 인용 — `where` 는 `passage` · `stem` · `option:<n>`) + `summary` + `input_hash` 가 **필수** — 원문에 없는 인용 · 해시 불일치는 import 에서 실패 처리한다(§8).
- reviewer 의 메모(동의 · 반대 이유)는 evidence 가 아니라 **비공개 `csat_error_review` 에만** 쓴다. reviewer 가 새 원인을 낼 때의 evidence 행에는 학생에게 보여도 되는 `summary` 만 둔다.

### 5-3. Choice Trap 대응표(추가)

```sql
create table csat_choice_trap_map (
  trap_key   text not null,                  -- csat_dx_option_trap.trap_key 원문
  trap_code  text check (trap_code in ('lexical_overlap','irrelevant_truth','part_whole','cause_effect_reversal',
               'scope_strength','relation_distortion','polarity_reversal','outside_text','structure_cue')),
  grammar_point boolean not null default false,
  taxonomy_version int not null references csat_taxonomy_version(version),
  mapped_by  text not null check (mapped_by in ('family_v1','ai','reviewer')),
  primary key (trap_key, taxonomy_version)
);
```

같은 trap_key 문자열이 문항에 따라 뜻이 다르다(예: 「최근접 명사 오인」은 어법 R-GRAMMAR 에서는 형태 판별 지점, 지칭 R-REFER · X-REFER 에서는 관계 왜곡). 그래서 위 표는 **문자열 기본 대응**이고, 문항 · 선지별 재정의를 따로 둔다:

```sql
create table csat_choice_trap_override (
  item_id text not null references csat_items(id) on delete cascade,   -- 문항이 정리되면 재정의도 함께 사라진다(기존 정리 경로를 막지 않게)
  option_no smallint not null check (option_no between 1 and 5),
  taxonomy_version int not null references csat_taxonomy_version(version),
  trap_code text check (trap_code in ('lexical_overlap','irrelevant_truth','part_whole','cause_effect_reversal',
             'scope_strength','relation_distortion','polarity_reversal','outside_text','structure_cue')),
  grammar_point boolean not null,
  mapped_by text not null check (mapped_by in ('ai','reviewer')),
  primary key (item_id, option_no, taxonomy_version)
);
```

선지의 Choice Trap = 재정의가 있으면 그것, 없으면 문자열 기본 대응. Pilot 선행 조건의 「대응」은 이 규칙으로 정해진 값이고, 입력 해시도 이 값을 쓴다. 권한은 다른 사전 테이블과 같다(덧붙이기 전용).

`csat_dx_trap_family`(C1~C9) 는 그대로 둔다 — 지도 · 엔진이 읽고 있다. 새 대응표가 525개 key 를 덮은 뒤 읽는 쪽을 옮길지 따로 정한다.

## 6. provenance / review 상태 모델

**provenance(jsonb)** — AI 행은 아래가 모두 있어야 import 된다. 나머지 source 는 `taxonomy_version` 만.

| 키 | 예 | 용도 |
|---|---|---|
| `model` | `claude-opus-5-5` | 재현 |
| `prompt_version` | `err-cause-v1` | 지시문이 바뀌면 다른 판정으로 센다 |
| `taxonomy_version` | `1` | 코드 사전 버전 |
| `analyzer_version` | `drain-2026-10` | export/import 스크립트 버전 |
| `run_id` | 청크 · 실행 id | 같은 실행의 행 묶기 · 되돌리기 |
| `blind` | `true` | 학생 자기보고를 **보지 않고** 판정했는지(§9 독립성) |

`created_at` · `taxonomy_version` · `prompt_version` · `run_id` 는 컬럼으로 둔다(조회 · 유일성 · 현재 판정 선택에 쓰여서). 나머지는 jsonb.

**review_status 전이**

```
proposed ──reviewer 동의──► accepted
    │      └reviewer 반대──► rejected
    └──판정 보류(근거 부족 · 코드 애매)──► needs_review ──► accepted / rejected
```

- 바꿀 수 있는 것: 서버가 검수 기록의 합의 규칙으로만. 학생 · AI 는 자기 행을 `proposed` 로만 만든다.
- 학생 행도 검수 합의로만 `accepted` 가 된다 — 자기보고 혼자서는 확인된 원인이 아니다.
- 판정자 개별 판정은 `csat_error_review` 에, 합의 결과만 `review_status` 에 — 두 판정자가 같은 원인에 같은 판정을 내도 충돌하지 않는다.
- 지우지 않고 `rejected` 로 남긴다 — 불일치 측정의 분모다.

**신뢰도(`confidence`) 정의** — 확률이 아니라 **판정 조건**이다. 숫자(0.83)는 쓰지 않는다.

| 값 | 조건(AI 지시문에 그대로 적는다) |
|---|---|
| `high` | 고른 선지를 정답으로 착각하게 만든 지문 위치를 인용할 수 있고, 정의서의 인접 코드 구별 기준을 **모두** 충족해 다른 코드로는 그 오답이 설명되지 않는다 |
| `medium` | 인용은 되고 원인이 하나로 서지만, 근거가 한 곳뿐이거나 인접 코드와의 구별 기준(정의서 ③)을 한 가지만 충족한다 |
| `low` | 인용은 되고 원인 하나로 서지만, 인접 코드 구별 기준을 하나도 적극적으로 충족하지는 못한다(다른 코드와 충돌하는 근거도 없다) |

**신뢰도는 「이 가설이 오답을 얼마나 잘 설명하나」(설명 적합성)다 — 「학생이 실제로 그렇게 처리했다」(학생 증거)가 아니다.** 지문 · 선지 · 고른 번호만 보는 AI 는 학생의 처리 과정을 모르므로, `high` 도 학생 원인의 증거가 아니라 「설명이 하나로 좁혀진다」는 뜻일 뿐이다. 학생 증거는 자기보고 · 확인 진단에서만 온다. 그래서 신뢰도는 승격 조건(§9)에 쓰지 않는다.

**구별 불가는 언제나 보류다**: 다른 원인(행동 원인 포함)과 구별되지 않으면 신뢰도 등급을 매기지 않고 `insufficient_evidence` · 행 0개다.

**대안 가설 ≠ 기여 원인**: 그럴듯한 원인이 둘인데 어느 쪽인지 가를 근거가 없으면 primary + contributing 으로 내지 **않는다** — 그건 「둘 다 작용했다」는 주장이 된다. 이 경우 실행 결과는 `insufficient_evidence` 이고, 두 후보는 행이 아니라 실행 기록의 메모(`failure` 옆 `alternatives` 배열)로만 남긴다. `contributing` 은 두 원인이 **함께 작용했다는 근거**(서로 다른 인용)가 각각 있을 때만 쓴다.

Pilot 뒤 등급별 reviewer 일치율을 재서 등급의 실제 뜻을 문서에 적는다. 그 전에는 등급만으로 아무것도 승격하지 않는다.

## 7. student self-report UX 초안

- **자리**: 시험 기록 › 기록 상세(`RecordDetailModal`)의 틀린 문항 **표의 각 행**. 지금 그 표는 펼침이 없고 해설 링크는 `/csat/item/[slug]` 로 세션 식별자 없이 이동하므로, 해설 화면에는 붙이지 않는다. **독해 오답 행에만** — 판정 기준은 **응답 원본의 문항 연결**(`csat_dx_response.item_id` 가 있음)이다. 화면 보고서의 `itemId` 는 해설이 미공개면 독해 문항도 NULL 이라(`lib/csat/diagnosis/report.ts`) 그대로 쓰면 일부 독해 오답에서 버튼이 빠진다 — 구현 때 보고서에 「원본 문항 연결 여부」와 「해설 공개 여부」를 따로 싣는다. 듣기 응답은 원본 `item_id` 가 비어 있고 L 은 이번 범위 밖이다. 행 끝에 「이유 남기기」 버튼(44px)을 두고, 같은 모달 안에서 작은 패널이 열린다 — 모달이 이미 `session_id` · `item_no` 를 갖고 있어 응답 키가 끊기지 않는다. 기존 열 · 링크 · 동작은 바꾸지 않는다(추가만).
- **언제**: 학생이 그 버튼을 눌렀을 때만. 자동으로 묻지 않는다. 한 문항에 한 번(다시 누르면 고친다 — 검수 전까지). 버튼은 독해 오답 행 전부에 두되, 회차 상단 안내는 「배점 높은 오답 5개만 남겨도 충분해요」로 부담을 줄인다 — 원점수 17점 학생에게 28번 묻지 않는다.
- **1단계(필수 아님)** — 「왜 틀렸다고 생각하나요?」 칩 6개, 하나만:

  단어 · 표현 / 문장 해석 / 글의 흐름 / 선지 판단 / 시간 · 집중 / 잘 모르겠음

- **2단계(선택)** — 1단계를 고른 경우에만, 그 영역의 세부 2~4개를 「더 정확히 고르면 진단이 빨라져요」와 함께 펼친다. 안 골라도 저장된다.
- **group ↔ 축 대응**(코드 사전 `student_group` 과 같다): 단어 · 표현 = V · 문장 해석 = S · 글의 흐름 = R · 선지 판단 = E · 시간 · 집중 = X. **B(행동) 코드는 group 이 없다**(학생이 「추측했다」를 원인으로 고르게 하지 않는다 — 행동은 관찰 근거로만) → 코드 사전에서 B 의 `student_group` 은 NULL 로 두고 CHECK 를 `axis = 'B' or student_group is not null` 로 바꾼다.
- **영역 일치 계산**: 자기보고에 세부 코드(2단계)가 있으면 그 코드의 축, 없으면 group 의 축. AI 쪽은 primary 코드의 축. B 는 역량 영역 일치 계산에서 뺀다.
- **저장**: 1단계만 고르면 그 영역의 대표 코드가 아니라 **영역만** 남긴다 — `evidence.self_report.group` 에 넣고 `error_code` 는 2단계를 고른 경우에만 쓴다.  `error_code` 는 student 행에 한해 NULL 을 허용한다(§5-1 CHECK).
- 「잘 모르겠음」은 새 행을 만들지 않는다 — 이벤트로만 센다.
- **고치기 · 철회**: 검수 전에는 학생이 다시 고를 수 있다. 서버 RPC 하나가 **원자적으로** 이전 행을 `withdrawn` 으로 바꾸고 새 행을 넣는다. 「잘 모르겠음」으로 바꾸면 이전 행을 `withdrawn` 으로만 바꾼다 — 철회된 보고는 영역 일치 근거로 쓰이지 않는다. 검수가 시작된 뒤(`csat_error_review_lock` 행이 있고, 그 잠금의 `input_hash` 가 지금 입력과 같으면)에는 패널에 「검수 중이라 바꿀 수 없어요」를 보이고 버튼을 막는다 — 잠금은 검수표 export 가 응답마다 만든다.
- **동시성**: 자기보고 수정 RPC 와 검수표 export(잠금 생성)는 같은 응답 행(`csat_dx_response`)을 `select … for no key update` 로 먼저 잠그고, 트랜잭션 안에서 잠금 유무 · 현재 자기보고 행을 다시 확인한 뒤 쓴다. 그래서 「잠금 확인 직후 보고가 바뀌는」 경쟁이 없다 — export 는 잠금을 만들 때 실은 자기보고 행 id 를 같은 트랜잭션에서 기록한다.
- **회차 취소**: 검수가 중단 · 실패하면 관리자가 그 회차를 취소한다 — 잠금 행에 `cancelled_at` 을 채우고(삭제하지 않음) 자기보고 수정이 다시 열린다. 이미 들어온 blind · verify 판정은 그대로 보존하되 집계에서는 빠진다(취소 회차). 잠금은 `cancelled_at IS NULL` 이고 입력 해시가 지금과 같을 때만 유효하다.
- **재확인**: 문항 원문 · 정답이 바뀌어 지금 입력 해시가 잠금 · 자기보고의 해시와 달라지면, 그 잠금은 **지난 입력에 대한 것**이라 수정을 막지 않는다. 패널은 「문항 정보가 바뀌었어요 — 다시 남겨 주세요」를 보이고, 새 자기보고는 새 해시로 들어간다. 옛 자기보고 · 검수 기록은 그대로 남는다(감사 이력).
- 고른 뒤 문구: 「기록했어요. 다른 근거와 함께 볼게요」 — 「원인이 확인됐다」고 말하지 않는다.
- **이벤트(D2 · D3)**: `csat_error_selfreport_opened` · `csat_error_selfreport_submitted { group: 닫힌 열거형, detailed: boolean }` · `csat_error_selfreport_skipped`. `events.ts` 와 `funnel_events` CHECK 마이그레이션을 **함께** 고친다(하나만 하면 조용히 0건).

## 8. AI proposal 흐름

에이전트가 직접 하는 3단 드레인(AGENTS.md). API 키를 기다리지 않는다.

1. **export** `scripts/csat/error-evidence/export.mjs` — 대상: 독해 오답 응답 중 **현재 taxonomy · prompt 버전 · 현재 입력 해시의 성공 실행(`outcome <> 'failed'`)이 없는 것**(버전을 올리거나 문항 원문 · 정답 · 선지 함정 · **과정 증거**가 바뀌면 다시 나오고, failed 는 재시도된다). 과정 증거를 고치면 입력 해시가 바뀌므로 기존 실행 · 승인은 현재 판정이 아니게 되고(§5-1 현재 판정 규칙), 다음 export · 검수 회차로 다시 판정된다. 청크마다 문항 지문 · 선지 · 정답 · **학생이 고른 선지** · 그 선지의 Choice Trap(「선지 특성 — 원인 아님」 표시). **학생 자기보고는 넣지 않는다**(blind).
   **측정되지 않은 값은 내보내지 않는다** — 실측상 두 세션의 `total_minutes` 는 NULL, 문항별 시간은 없고, `confidence` 는 화면이 묻지 않아 전부 기본값 `sure` 다. 이 값들을 넣으면 AI 가 없는 관찰로 시간 · 추측 원인을 만든다.
   **입력 보존**: 실행마다 판정에 쓴 전체 입력(정규화한 JSON)을 DB 비공개 테이블 `csat_error_judgment_input(judgment_run_id PK → 실행 FK on delete cascade, input jsonb, input_hash)` 에 덧붙이기로 저장한다 — 실행 기록과 함께 과거 판정의 입력을 문항 · 정답 · 대응표가 바뀐 뒤에도 재현한다. **Git 에는 학생 응답 · 과정 증거를 커밋하지 않는다** — 세션이 지워지면 실행 → 입력이 연쇄 삭제돼 학생의 삭제권이 지켜진다. export · 청크 · 출력 · 검수표 · 리허설 파일은 전부 **Git 제외 경로** `scripts/csat/error-evidence/.work/`(`.gitignore` 에 추가 — 리허설 · 공개 이력 · 합성 파일도 그 아래 `rehearsal/` · `synthetic/`)에만 둔다. 구현 첫 커밋에서 `git check-ignore` 로 제외를 확인하는 테스트를 둔다. import 성공 뒤 그 실행의 작업 파일을 지운다. 실패 · 리허설 파일은 원인 확인용으로 7일 보존 뒤 정리 스크립트가 지운다(`--purge` · 재실행 안전). **세션 삭제 연동**: 작업 파일 이름에 `session_id` 를 넣고(청크 · 검수표는 세션별 파일로 나눈다), 정리 스크립트가 매 실행마다 DB 에 없는 `session_id` 의 파일을 지운다 — export · import 시작 때도 먼저 돌아 지워진 학생의 로컬 사본이 다음 작업까지 남지 않는다. 정기 정리: 작업 실행과 별개로 **매일 한 번** 정리를 돌리는 예약 작업(작업자 PC 의 예약 실행)을 두고, 마지막 정리 시각을 `.work/.last-purge` 에 남겨 export · import 가 시작 때 그 시각이 24시간을 넘었으면 경고한다. 보장 범위는 「작업 PC 가 켜져 있는 한 7일」이며, 개인정보 처리 안내에는 이 범위를 그대로 적는다, Pilot 리포트에는 세션 · 학생을 가린 비식별 사례표(문항 · 고른 답 · 코드 · 판정)만 남긴다.
   청크에 응답마다 **입력 해시**를 넣는다 — 판정에 쓴 입력 전부(**그 taxonomy_version 정의서 해시** · **유효한 과정 증거(revision · note · text_refs)** · 발문 stem · 지문 · 선지 · **채점 정본 `csat_dx_answer_key.answers`** · 고른 선지 · 각 선지의 Choice Trap 대응값)를 정규화해 sha256. 실제 시험 채점은 `csat_dx_answer_key` 를 쓰므로, 그 정답과 `csat_items.answer(s)` · 저장된 `is_correct` 가 서로 어긋나는 응답은 export 하지 않고 「정답 불일치 보류」로 센다.
   **필수 입력이 없는 문항은 export 하지 않는다** — 도표(R-CHART)처럼 원본 표 · 그림이 DB 에 없는 문항, 지문 · 선지가 비어 있는 문항(`body_ok` 거짓)은 「입력 불완전 보류」. 문항 쪽에 이미 쓰는 해시 함수(`csat_item_input_hash` · `csat_item_answer_hash` 류)가 있으면 그것을 조합한다 — 구현 직전 `to_regprocedure` 로 존재와 대상 필드를 확인한다. 기존 `csat_item_answer_hash` 는 `csat_items.answer/answers` 만 해시하므로, **`csat_dx_answer_key.answers`(채점 정본) · 고른 선지 · Choice Trap 대응값은 반드시 덧붙인다.**
   재실행 안전 — 위 대상 규칙 그대로(원인 0개 완료는 성공 실행이라 다시 나오지 않는다).
2. **판정** — 청크마다 서브에이전트가 원인 0~2개(primary 1, contributing ≤1 — 함께 작용한 근거가 따로 있을 때만), 각각 인용 · 요약 · 신뢰도. 원인을 내지 않으면 행 없이 실행 결과만 남긴다(빈 원인은 허용된 답이다).
   원인을 내지 않을 때도 이유를 판정자와 같은 세 상태로 나눈다 — `no_cause`(학생 쪽 실패가 아님) · `insufficient_evidence`(지문 · 기록만으로 판단 불가) · `no_fitting_code`(taxonomy 빈틈). 그래서 AI 와 판정자의 κ 를 같은 범주에서 잰다(§10).
   **B(행동) · X(실행) 원인은 AI 가 제안하지 않는다** — 직접 관찰(측정된 시간 · 확신도)이나 학생 자기보고가 있을 때만 그 출처가 기록한다.
3. **import** `--commit` — `source='ai'`, `review_status='proposed'`, provenance 필수 키 검사. **응답 하나 단위로 원자적**(RPC 한 번 = 트랜잭션 하나)으로 evidence 행들과 실행 기록을 함께 쓴다.
   검사: ① 입력 해시가 지금 DB 의 문항 · 응답으로 다시 계산한 값과 같다(판정 뒤 문항이 바뀌었으면 실패) ② 인용마다 `where`(passage · option n · stem)가 있고, 그 원문에 **정규화 후 부분 문자열로 실제로 있다** ③ 코드가 현재 taxonomy_version 사전에 있다 ④ AI 행의 코드 축이 V · S · R · E 다(B · X 는 AI 가 낼 수 없다) ⑤ `outcome='proposed'` 실행은 primary 정확히 1개 · contributing 최대 1개. `no_cause` · `insufficient_evidence` · `no_fitting_code` 실행은 evidence **0개**여야 한다(원인 0개는 정상 결과라 failed 가 아니다).
   하나라도 어긋나면 그 응답의 evidence 는 하나도 넣지 않고 `outcome='failed'` + 이유만 남긴다 — `failed` 는 완료로 치지 않아 다음 export 에 다시 나온다(누락이 영구화되지 않는다). 끝에 **건너뛴(실패) 수를 출력**한다.

AI 는 `accepted` 행을 만들 수 없다(쓰기 경로가 `proposed` 고정). AI 결과만으로 verified 가 되지 않는다(§9).
절차는 `apps/web/src/lib/admin/help/<파이프라인>.ts` 의 `drain` 에 단계별 재실행 안전 여부와 함께 적는다.

**reviewer 검수** — Pilot 단계는 관리자 화면 없이 export 한 검수표(JSON)를 reviewer 가 채우고 import 한다. 검수표 export 가 응답마다 `csat_error_review_lock`(회차 · 입력 해시 · 실은 자기보고 행)을 만들고, import 는 잠금의 입력 해시 · 자기보고 행이 지금과 같을 때만 받는다. 하나라도 다르면 §5-1 규칙대로 **회차 전체를 취소**하고 바뀌지 않은 대상으로 재봉인한다(이미 들어온 판정은 보존). 화면은 Pilot 결과를 보고 만든다(만들면 화면도움말 동반).

## 9. verified_diagnosis 승격 조건 초안

**단위는 학생 × 역량 축(V/S/R/E)** 이다. 문항 하나 · 오답 하나로는 아무 축도 verified 가 되지 않는다. B · X 는 이 승격 대상이 아니다.

**두 층을 나눈다.** 오답 원인이 「확인됐다」는 것은 **그 오답에 대한 설명(가설)이 합의됐다**는 뜻이지, 학생의 처리 능력을 직접 쟀다는 뜻이 아니다. 그래서 이번 설계에서 Evidence 가 만드는 최고 단계는 **「원인 가설 확인(cause_confirmed)」** 까지이고, 이것은 `DiagnosisBasis` 값이 아니라 **별도 근거 상태**다 — basis 는 `rule_proxy` 그대로 둔다. `verified_diagnosis` 는 그 위에 **직접 확인 진단**이 있어야 한다.

한 원인 행이 **「확인된 원인」** 이 되는 조건(둘 중 하나):

- (a) reviewer 가 `accepted` 했다, 또는
- (b) **서로 독립인 두 출처**가 같은 축에 동의했다 — 학생 자기보고(영역 수준) + `blind=true` 인 AI 의 primary. AI 가 자기보고를 본 경우는 독립이 아니다. 이것은 **축 수준의 「영역 일치」** 일 뿐 세부 코드 확인이 아니다(아래 집계 ②).

AI 단독 · 학생 단독 · AI 신뢰도 high 는 「확인된 원인」이 아니다.

**집계 규칙** — 두 단계로 합친다.

① **코드별 주장**(응답 × 원인 코드) 하나마다 — 같은 응답 · 같은 코드의 현재 행이 출처별로 여럿(AI 행 · 학생 2단계 행 · reviewer 행)이면 그 행들의 현재 회차 합의 상태를 모아 **위에서부터 처음 맞는 줄**로 하나를 정한다(어느 한 행이라도 기각이면 기각이 우선, 확인은 전부가 기각 · 보류가 아닐 때):

| 순서 | 조건 | 결과 |
|---|---|---|
| 1 | 현재 검수 회차가 열려 있는데 합의 미완료 · 재검수 대기 | 보류 |
| 2 | 그 코드의 현재 행 중 하나라도 합의 `rejected` | 기각 |
| 3 | 그 코드의 현재 행 중 하나 이상이 합의 `accepted` · 나머지는 `accepted` 또는 아직 검수 대상 아님 | **코드 확인** |
| 4 | 그 밖(판정 갈림 = `needs_review` 포함) | 보류 |

판정자끼리 갈리면 기각이 아니라 **보류**다 — §6 상태 전이와 같다. 코드 확인은 **판정자 검수로만** 생긴다. 학생 자기보고는 영역(1단계)만 말하므로 세부 코드를 증명하지 못한다.

② **응답 × 축** 하나로 합친다(표는 **위에서부터 처음 맞는 줄**) — 먼저 **회차 유효성**을 본다: 그 응답의 현재 검수 회차가 열려 있는데 합의 미완료(verify 미완료 포함) · 재검수 대기 · 취소면 그 응답의 모든 축은 **보류**이고 아래 표로 가지 않는다(blind 가 모두 `no_cause` 여도). 회차가 완료됐거나 검수 회차가 없을 때만:

| 조건 | 결과 |
|---|---|
| blind 에서 그 축을 배제(또는 `no_cause`)했던 판정자가 verify 에서 그 축 코드 **또는 그 축 group 의 영역 자기보고**를 accept — **판단 변경** | 보류 — 공개 뒤 바뀐 판단은 확인으로도 반증으로도 쓰지 않는다(이 줄이 먼저다) |
| 그 축의 코드 중 **코드 확인**이 하나라도 있음 | 확인(한 번) |
| 코드 확인 없음 · 영역만 남긴 자기보고(`error_code` NULL)를 판정자가 합의 `accepted` | **영역 확인**(한 번) — 코드 확인과 구별해 센다 |
| 위 둘 다 없음 · 검수 회차 없음 · 학생 자기보고 영역 = blind AI primary 의 축 · **AI 가 그 학생의 과정 증거를 읽지 않았음** | **영역 일치**(한 번) — 확인과 따로 센다 |
| 같은 조건이지만 AI 가 과정 증거를 읽었음 | **해석 일치** — 기록만 하고 승격 집계에는 넣지 않는다(학생의 같은 글에서 나온 두 판단이라 독립 증거가 아니다) |
| 확인 없음 · 명부 판정자 모두 blind `no_cause` · **verify 에서도 그 응답의 어떤 원인도 accept 하지 않음** | 그 응답의 모든 역량 축 반증(한 번씩) |
| 확인 없음 · 그 축 코드가 기각됐고, 명부 판정자 모두가 blind 에서 그 축을 `excluded_axes` 로 명시 · **verify 에서 그 축 코드를 accept 한 판정자 없음** | 반증(한 번) |
| 판정자 blind 가 `insufficient_evidence` · `no_fitting_code` | 보류 — 반증이 아니다 |
| 그 밖(같은 축의 다른 코드만 기각 · 보류 · 근거 부족) | 보류 |

즉 `S.modifier_scope` 기각은 S 축 반증이 아니다. 판정자가 다른 축을 primary 로 골랐다는 것만으로도 반증이 아니다(S 가 contributing 일 수 있다) — **그 축을 명시적으로 배제했을 때만** 반증이다.

- **확인 입력은 Evidence 필수 범위다** — 학습자가 회차의 응시 · 선지별 판단을 확인 · 정정하는 경로(기록 상세 모달의 「이 기록 확인」 + `csat_dx_session_attestation` 쓰기 RPC)는 승인 요청 6 과 무관하게 Evidence 구현에 포함된다. 승인 요청 6 은 그 확인 결과를 **기존 화면 · 엔진 · 스냅샷**에도 적용할지만 정한다.
- **적격 회차만 센다** — 근거 응답의 회차가 지금 `sessionEligibility(…).observation` 이 참이어야 한다. **의존성**: 이 함수와 확인 기록(§13)은 Evidence 승격의 **필수 부품**이다 — 승인 요청 6 을 택하지 않아도 Evidence 쪽에는 이 검사가 들어간다. 승인 요청 6 의 선택 범위는 「기존 화면 · 엔진 · 스냅샷에도 같은 가드를 거는가」뿐이다. 확인을 철회 · 정정해 부적격이 되면 그 회차의 evidence 는 해시가 같아도 집계에서 즉시 빠진다. 회귀: 「확인 정정 → cause_confirmed 소멸」.
- **현재 판정만 센다** — AI 는 §5-1 의 현재 실행(최신 `no_cause` 면 AI 원인 없음), 학생은 응답당 철회되지 않은 자기보고 하나 중 `input_hash` 가 지금 값과 같은 것(다르면 「재확인 필요」로 집계 제외), 판정자는 현재 `taxonomy_version` 의 판정만. 옛 버전에서 accepted 였던 행도 현재 판정이 아니면 세지 않는다.
- **응답당 한 번** — 한 응답은 축마다 확인 1 또는 반증 1 로만 센다(같은 응답에 행이 여러 개여도).

한 축이 **「원인 가설 확인(cause_confirmed)」** 이 되는 조건(전부):

| # | 조건 | 초안 값(Pilot 뒤 조정) |
|---|---|---|
| 1 | 그 축의 응답 × 축 결과 「확인」 + 「영역 확인」 + 「영역 일치」 수(「확인」 + 「영역 확인」이 그중 절반 이상) | ≥ 4 |
| 2 | 서로 다른 문항 | ≥ 4 |
| 3 | 서로 다른 시험 회차 | ≥ 2 |
| 4 | 서로 다른 문항유형 | ≥ 2 (한 유형의 특성을 학생 특성으로 읽지 않게) |
| 5 | 판정자 「코드 확인」이 섞여 있다 | ≥ 1 |
| 6 | 최신성 — 근거 응답의 시험일이 **120일 이내(필수)** 이고, 그중에서도 그 학생의 최근 3회 안 | 둘 다(AND) — 새 시험을 안 쳐도 120일이 지나면 만료 |
| 7 | 반증 — 같은 응답 × 축 집계에서 「반증」 수가 「확인 + 영역 확인 + 영역 일치」 수보다 많지 않다 | 반증 ≤ 긍정 합 |
| 8 | 출처 품질 — 평가원 · 교육청 학평 문항만 | `csat_exams` 출처로 판정 |

- 6을 벗어나면 그 단계를 **잃는다**(만료). 상태는 저장값이 아니라 **조회할 때 주입된 현재 시각(`now` 인자)으로 다시 계산**한다 — 새 시험이 없어도 120일이 지나면 화면에서 사라진다. 스냅샷 `evidence` jsonb 에 남기는 값은 「계산 당시 기록」(감사용)일 뿐, 화면은 그 값을 그대로 쓰지 않는다. `loadMapPage` 는 스냅샷을 읽으므로, 구현 때 이 상태만은 로더에서 현재 시각으로 재계산하는 경로를 추가한다(시계 직접 읽기 금지 — `now` 주입).
- `cause_confirmed` 가 된 축도 화면은 계속 「정밀 진단: 미실시」 · Route 미정이다. 바뀌는 것은 「우선 확인 후보」 선정 순서 하나다 — 원인 가설이 다음 진단을 처방한다.
- **후보 선정(상한 유지)**: 우선 확인 후보는 **최대 2개 · 지금 필요한 진단 최대 1개**(Phase 1 수용 기준) 그대로다. 순서: ① `cause_confirmed` 축(긍정 합이 큰 순) ② 관찰 낮음 축(관찰값이 낮은 순) — 위에서부터 2개만. 진단 문구는 1번 후보 기준 하나(두 후보가 V · S 면 Phase 1 의 「구분 진단」 문구).

**`verified_diagnosis`(이번 설계 범위 밖 — 별도 설계 · 승인)**: 위 단계에 더해, 그 축만 겨냥한 **직접 확인 진단**(예: V 라면 오답 문항의 핵심 낱말 · 구 뜻 확인 문항, S 라면 같은 문장의 구조 해석 문항)에서 축 실패가 다시 관찰되고, 보정(calibration) 기준이 정해졌을 때. 그 전까지 모든 축은 `rule_proxy` 를 유지한다. 「정밀 진단: 미실시」를 거두고 Route 를 고르는 것은 이 단계에서만이다(Phase 1 `DiagnosisBasis` 규칙 그대로).
- 금지: confidence 임계값 승격 · 단일 문항 승격 · 다른 학생의 근거로 승격.

## 10. 30~50건 Pilot 계획

### 실제로 쓸 수 있는 사례(2026-10-03 실측)

| 원천 | 건수 | 쓸 수 있나 |
|---|---|---|
| `csat_dx_response` 독해 오답 | 43 | **지금은 쓰지 않는다** — 두 회차 모두 한 번호 입력(②만 · ③만), 입력 신뢰도 확인 전. 파이프라인 리허설용으로만 |
| `csat_dx_response` 듣기 오답 | 27 | 이번 Pilot 제외(L 은 데이터 없음) |
| `csat_trap_attempts` 오답 | 69 | 제외 — 테스트 계정. **파이프라인 리허설용**으로만 |
| `csat_item_attempts` 오답 | 1 | 제외 |

43건의 유형 분포: 빈칸 6 · 삽입 4 · 순서 3 · 그 외 17개 유형이 1~2건씩(대의 · 함축 · 어휘 · 어법 · 요약 · 장문 포함). 제안 분포(대의 · 어휘/어법 · 빈칸 · 순서 · 삽입 · 요약 · 장문)는 **모두 덮지만 유형당 1~6건**이다.

**도표 2건(M2409#25 · M2509#25, R-CHART)은 보류한다** — DB 지문 · 선지에 원본 표 · 그래프가 없어 텍스트 export 만으로는 인용 · 해시 검증을 할 수 없다. 형식상 남는 것은 41건이지만, 위 입력 신뢰도 문제 때문에 **확인된 실제 풀이 표본은 0건**이다.

**결론: 지금은 Pilot 을 시작할 수 없다.** 41건은 export · 해시 · 검수표 · 잠금 · import 가 끝까지 도는지 보는 **리허설 표본**으로만 쓰고, 그 결과(κ · 미분류율)는 taxonomy 판단에 쓰지 않는다.

**리허설 모드**: export · import 에 `--rehearsal` 을 주면 입력 신뢰도 가드를 건너뛰는 대신 **DB 에 쓰지 않는다** — 결과는 `scripts/csat/error-evidence/.work/rehearsal/` 파일로만 남고, import 는 검사(해시 · 인용 · 코드)만 하고 적재 대신 검사 결과를 출력한다. 그래서 리허설은 승격 · 운영 집계에 섞일 수 없다.
**리허설 공개 이력**: 리허설에서 AI 가설 · 자기보고를 본 판정자와 문항은 `scripts/csat/error-evidence/.work/rehearsal/disclosures.json`(reviewer_key · item_id · 시각)에 남기고, DB 함수는 로컬 파일을 읽을 수 없고, 이름 규칙은 바꿔 부르면 뚫린다. 그래서 강제는 **실행 방식**으로 한다:
  - 실제 Pilot 의 에이전트 판정자는 매번 **새 문맥**(대화를 이어받지 않는 독립 서브에이전트 실행)으로 띄우고, 입력은 검수표 1차 파일 하나만 준다 — 이전 리허설 · 다른 회차의 내용이 문맥으로 따라오지 않는다.
  - 사람 판정자는 리허설을 하지 않는다. 사람이 리허설 등 DB 밖에서 본 문항이 있으면 회차 시작 전에 신고하고, 시작 RPC 가 명부 행의 `pre_disclosed_items text[]`(item_id 목록)로 **봉인 데이터에 저장**한다 — blind 제출 RPC 가 공개 이력 검사 때 이 목록도 반드시 읽는다.
  - 이름 규칙(`err-judge-rehearsal` 접두사 거부)은 보조 장치로만 둔다.
파일 리허설이 검증하는 것: export 대상 선정 · 입력 해시 계산 · 청크 형식 · 인용 원문 대조 · 코드 · 개수 검사 · 검수표 2단계 분리. **검증하지 못하는 것**: FK · RLS · 함수 권한 · 원자적 적재 · 잠금에 따른 수정 차단 — 이것들은 마이그레이션 승인 뒤 **격리된 Supabase 브랜치(테스트 DB)** 에서 따로 검증하고, 결과를 적용 승인 요청에 붙인다.

**실제 표본 확보 경로**(사용자 결정):
- (가) 실사용 학습자가 실제로 푼 시험 기록이 쌓일 때까지 기다린다 — 다만 과정 증거가 없어 **설명 적합성 점검**까지만 된다(원인 검증 불가).
- (나) **권장** — 실제 학습자에게 기출 1회분을 풀게 하고 바로 틀린 문항마다 **과정 증거**(고른 이유 · 막힌 곳 인용)를 받는다. 원인 Pilot 이 성립하는 유일한 경로다. 학습자 3명 이상 · 과정 증거 있는 독해 오답 30건 이상.
- (다) 판정자가 「그럴듯한 학습자 경로」를 만든 합성 사례 — **taxonomy 표현력 점검용으로만**. 실제 응답이 없으므로 DB 에 넣지 않고 별도 파일(`scripts/csat/error-evidence/.work/synthetic/*.json`)로만 다룬다 — 판정자 blind 판정도 그 파일에 적는다. 어떤 승격 집계에도 들어가지 않는다.

**적용 범위**: 이 가드는 **시험 1회분(`mode` = `live` · `retake`, 45문항)** 에만 건다. `diagnostic`(진단 테스트 — 문항 수가 다르고 학습자가 고르는 흐름이 다름)과 `app`(앱 연습 기록)은 문항 수가 적어 같은 번호 비율이 우연히 높을 수 있으므로 이 기준을 쓰지 않는다 — 두 모드는 지금처럼 쓰고, 원인 Pilot 표본에는 넣지 않는다(시험 1회분만). 모드별 기준이 필요해지면 오탐 측정 뒤 따로 정한다.

**입력 신뢰도 확인(가드)**: 시험 1회분 응답의 90% 이상이 같은 선지 번호면 「입력 신뢰도 확인 필요」로 표시한다. 확정 제외가 아니다 —
- 학습자에게 두 가지를 따로 묻는다: ① 실제로 그 시험을 봤는가(응시 여부) ② 선지를 하나하나 판단했는가, 시간 부족 등으로 한 번호로 마킹했는가(판단 과정).
  - ①만 「예」 · ② 「한 번호로 마킹」 → 점수 · 정답률 같은 **결과 지표**에는 다시 쓸 수 있지만, 원인 판정 · 함정 지표에는 계속 쓰지 않는다(판단 과정이 없는 응답).
  - ① · ② 모두 「예」 → 원인 판정에도 쓴다.
  - ① 「아니요」(응시하지 않음 — 시험 삼아 넣어 본 기록 등) → 어떤 지표에도 쓰지 않는다. 이때 ②는 「아니요」만 허용(CHECK).

  | 응시(①) | 선지별 판단(②) | 점수 · 추이 | 역량 · 함정 관찰 · 원인 판정 |
  |---|---|---|---|
  | 예 | 예 | 쓴다 | 쓴다 |
  | 예 | 아니요 | 쓴다 | 쓰지 않는다 |
  | 아니요 | 아니요 | 쓰지 않는다 | 쓰지 않는다 |
  | 확인 없음(가드 해당) | — | 「확인 필요」 표시와 함께 쓴다 | 쓰지 않는다 |
- 원인 Pilot · 승격 집계는 ②가 확인되기 전까지 그 회차를 쓰지 않는다.
- **확인 기록 저장**(추가 테이블 1개):
  ```sql
  create table csat_dx_session_attestation (
    session_id uuid not null references csat_dx_session(id) on delete cascade,
    took_exam boolean not null,                -- ① 응시 여부
    judged_each boolean not null,              -- ② 선지별 판단 여부
    answers_hash text not null,                -- 확인 당시 그 session_id 의 전체 응답(세션당 45개)을 문항 번호순으로 해시 — 응답이 바뀌면 이 확인은 무효
    confirmed_by uuid references auth.users(id) on delete set null,   -- 학습자 본인만(서버 RPC 가 소유 확인)
    confirmed_at timestamptz not null default now(),
    revision int not null,                     -- 같은 답안에 대한 정정 = 다음 revision
    check (took_exam or not judged_each),      -- 「응시 안 함 · 선지별 판단함」은 모순 — 거부
    primary key (session_id, answers_hash, revision)
  );
  ```
  유효한 확인 = 지금 응답으로 다시 계산한 `answers_hash` 와 같은 행 중 **가장 큰 revision**. 학습자가 잘못 남긴 확인은 새 revision 으로 정정하고, 지난 revision 은 지우지 않는다. 권한은 다른 신규 테이블과 같다(학생은 RPC 로만 쓰고 자기 행 읽기).
- 오탐 검증: 지금 DB 의 실사용 회차 2개는 둘 다 실제 풀이 여부가 미확인이라 오탐 검증 표본이 될 수 없다. **90% 는 잠정값**이다 — 학습자 확인(①②)으로 「선지별 판단함」이 확인된 정상 풀이 회차가 쌓이면(최소 20회차) 그 분포에서 최댓값을 보고 기준을 확정한다. 그 전까지 가드는 「확인 요청」만 하고, 자동 제외는 원인 판정 · 함정 집계에만 건다(점수는 확인 필요 표시와 함께 유지 — 위 표).
- export 는 이 조건을 먼저 검사하고 뺀 수를 출력한다(아래 리허설 모드는 예외).

### 한계(먼저 밝힌다)

- 실제 표본이 확보돼도 초기에는 학습자 수가 적다. 원점수가 낮은 학습자는 오답 상당수가 `B.guess` 일 수 있어 V/S/R/E 구별을 시험할 사례가 적을 수 있다 — 아래 「판정 가능 조건」이 이를 「통과」와 구분한다.
- 이 Pilot 이 검증할 수 있는 것: **「같은 사례를 보고 판정자들이 같은 원인을 고르는가」(taxonomy 일관성)**. 검증할 수 없는 것: 학생 집단 사이의 일반화.

### 선행 조건 — 풀이 과정 근거(Pilot 필수 입력)

문항 · 정답 · 고른 번호만으로는 V/S/R/E 실패와 추측을 가를 수 없다 — §6 의 보류 규칙을 지키면 표본을 아무리 늘려도 역량 코드 판정이 나오지 않는다. 그래서 **Pilot 표본은 풀이 과정 근거가 있는 오답만**으로 한다:

- **수집**: 경로 (나) — 학습자가 기출 1회분을 실제로 푼 직후, 틀린 문항마다 짧게 적는다: 「고른 답을 고른 이유(한두 문장)」 + 「지문에서 막혔거나 헷갈린 곳(밑줄 · 인용)」. 범주를 고르는 자기보고(§7)와 다르다 — 이것은 판정자가 읽는 **과정 증거**다.
- **저장**: 범주 자기보고(§7)와 수명이 다르므로 **별도 테이블**에 둔다 — 범주 보고를 철회해도 과정 증거는 남는다.
  ```sql
  create table csat_error_process_note (
    session_id uuid not null, item_no smallint not null,
    foreign key (session_id, item_no) references csat_dx_response(session_id, item_no) on delete cascade,
    revision int not null,                     -- 고치면 다음 revision(지난 것은 남는다)
    note text not null,                        -- 고른 이유 · 막힌 곳(학생 글)
    text_refs jsonb not null default '[]',     -- 학생이 고른 지문 인용
    item_input_hash text not null,             -- 작성 당시 문항 · 채점 정답 · 고른 답의 해시 — 지금 값과 다르면 「재확인 필요」(export · 승격 제외)
    created_at timestamptz not null default now(),
    primary key (session_id, item_no, revision)
  );
  ```
  유효한 과정 증거 = 가장 큰 revision 이면서 `item_input_hash` 가 지금 문항 · 채점 정답 · 고른 답으로 다시 계산한 값과 같고 **기준 충족**: `note` 가 공백 제외 20자 이상 · `text_refs` 가 1개 이상 · 각 인용이 그 문항 지문 · 선지 원문에 정규화 후 부분 문자열로 있다(AI 인용과 같은 검사). 저장 RPC 가 검사하고, export · 표본 선정도 다시 검사한다 — 기준 미달 오답은 Pilot 적격 표본으로 세지 않는다.
  CHECK: `check (length(btrim(note)) >= 20)`, `check (jsonb_array_length(text_refs) >= 1)`. 권한은 다른 신규 테이블과 같다(학생은 RPC 로만 insert · 자기 행 읽기, 덧붙이기 전용).
- **수집 경로**: Pilot 은 화면을 새로 만들지 않고 **Pilot 수집 절차**로 받는다 — 참여 학습자가 기출을 풀고 시험 기록을 입력한 뒤, 운영자가 틀린 문항 목록(독해)을 문서 양식으로 주고 학습자가 「고른 이유 · 막힌 곳 인용」을 적어 돌려준다. 운영자는 `scripts/csat/error-evidence/process-note-import.mjs`(학습자 동의 확인 · 소유 확인 · 기준 검사 · 인용 원문 대조 · 실패 건수 출력 · 재실행 안전)로 `csat_error_process_note` 에 적재한다. 화면 입력(§7 패널의 2단계 「고른 이유 적기」)은 Pilot 결과를 보고 별도로 정한다.
- **blind 입력**: 판정자 blind 와 AI 는 문항 · 고른 답 · **과정 증거**를 함께 본다. 그래서 「AI blind = 자기보고 비공개」 규칙은 **범주 자기보고(§7)에만** 적용하고, 과정 증거는 공개 입력이다(AI · 판정자 모두 같은 입력 → 독립성 유지).
- **검증 대상**: 과정 증거가 있는 표본에서만 「taxonomy 로 학생 원인을 일관되게 설명할 수 있는가」를 잰다. 과정 증거 없는 오답(기존 기록 · 경로 (가)로 쌓인 기록)은 **설명 적합성**(이 가설이 그 오답을 설명하나)까지만 보고, 원인 검증 지표에 넣지 않는다.

### 선행 조건 — Pilot 문항 전체 선지의 Choice Trap 대응

입력 해시가 **모든 선지**의 Choice Trap 대응값을 포함하므로, **실제로 선정한 Pilot 표본**(리허설 41건이 아니라)의 문항 오답 선지 전부에 대응 행이 있어야 한다. 표본을 정한 뒤 필요한 key 를 다시 뽑아 채우고, 빠진 것이 0일 때만 export 한다. 참고로 리허설 41개 문항 기준으로는 학생이 고른 선지만 보면 미대응 key 가 14개(2026-10-03 실측)지만, 41개 문항의 오답 선지 전체로는 **미대응 key 53개 · 164개 오답 선지 중 53개**(family NULL 포함, 2026-10-03 실측 — 구현 직전 다시 센다)다. 먼저 채운다:

- 그 key 전부를 reviewer 가 `csat_choice_trap_map` 에 `mapped_by='reviewer'` 로 대응시킨다(9코드 중 하나 · 어법 형태 판별 지점이면 `grammar_point=true` 로 trap_code NULL — 이름이 아니라 **실제 문항을 보고** 정한다).
- 9코드 어디에도 맞지 않으면 trap_code NULL · `grammar_point=false` 로 두고 export 에 「선지 특성 미분류」로 싣는다 — AI 가 trap 을 추측하지 않게.
- 완료 조건: 선정 표본 문항의 오답 선지 **전부** 대응 행이 있다(NULL 도 명시적 대응). export 가 미대응 key 를 발견하면 시작하지 않고 목록을 출력한다. 그 밖의 긴 꼬리 key 는 Pilot 범위 밖.

### 절차

1. 적격 표본(위 가드 통과 · 도표 등 입력 불완전 제외)에서 30~50건, 문항유형이 편중되지 않게 고른다. 지금 41건은 리허설용.
2. 사례마다 표 하나: ① 고른 답 ② 정답 ③ 문항유형 ④ Choice Trap ⑤ AI 원인(blind) ⑥ 근거 인용 ⑦ reviewer 판정 ⑧ (가능하면) 학생 자기보고 — 해당 학생에게 틀린 문항 화면에서 받는다.
3. reviewer 2명이 `phase='blind'` 로 응답마다 원인을 **스스로 고른다** — 결과는 넷 중 하나: 코드 · 원인 없음(정답 근거로 볼 때 학생 쪽 실패가 아님) · 근거 부족(지문 · 기록만으로 판단 불가) · 맞는 코드 없음(taxonomy 빈틈).
   κ 계산: 영역 수준은 {V,S,R,E,B,X, 원인 없음, 근거 부족, 맞는 코드 없음} 9범주, 코드 수준은 {코드 20개 + 같은 세 상태}. 「미분류 10%」 기준은 **맞는 코드 없음** 비율만으로 잰다(근거 부족은 taxonomy 결함이 아니라 데이터 부족이라 따로 보고). → 판정자 사이 **영역 수준 · 코드 수준 일치율(Cohen's κ)**. AI(blind) 의 primary 와 각 판정자도 같은 방식으로 비교. 그 뒤 `phase='verify'` 로 AI · 자기보고 행에 accept/reject 를 남긴다 — κ 는 blind 단계 결과로만 잰다(승인 검수는 이미 AI 를 본 판정이라 독립이 아니다).
4. **판정 가능 조건**(먼저 본다): 적격 표본 N건(30~50) 중 두 판정자 모두 **V · S · R · E 코드**로 판정한 사례가 **N 의 50% 이상**, V · S · R · E 각 영역에 그런 사례가 **3건 이상**. B · X 코드 판정은 이 비율에 넣지 않고 따로 집계한다(행동 사례가 판정 가능 비율을 채우지 못하게). 못 미치면 결과는 「통과」가 아니라 **「표본 부족 — 판정 불가」**다(예: 대부분이 근거 부족 · `B.guess` 면 20개 taxonomy 를 검증하지 못한 것이다). κ 를 계산할 수 없는 경우(한 범주에 몰림)도 판정 불가로 따로 적는다.
5. 판정 기준(판정 가능할 때만) — 하나라도 걸리면 taxonomy 수정:
   - 영역 κ < 0.6
   - 코드 κ < 0.4 (영역이 같고 코드만 다른 경우를 따로 센다)
   - 「맞는 코드 없음」 > 10%
   - **코드 쌍 갈림**: 두 판정자가 같은 영역 안에서 서로 다른 코드를 고른 사례가 그 쌍으로 **3건 이상** — 그 두 코드는 합치거나 정의를 고친다
   - 한 번도 선택되지 않은 코드는 「미검증」으로 따로 적는다(통과도 기각도 아님)
   → taxonomy 를 고친다. 고친 taxonomy 의 검증은 **같은 41건을 이미 본 판정자가 하지 않는다** — 1차 blind 지표는 그대로 보존하고, 재검증은 (가) 1차 결과 · AI 를 보지 않은 새 판정자 2명이 **같은 N건**을 blind 로, 또는 (나) 같은 판정자가 **새 표본**으로 한다 — 새 표본은 그 판정자에게 **공개 이력이 없는 문항(item_id)** 의 실제 오답만으로 고른다(같은 문항을 다른 학생이 푼 응답은 `independent=false` 가 되므로 새 표본이 될 수 없다). 같은 판정자가 같은 N건을 다시 보는 것은 참고 기록일 뿐 통과 근거가 아니다.
6. 문항 하위능력 Gold Pilot(약 200문항)은 하위 태깅 단계라 별도 설계 · 승인 대상으로 남긴다.

**이번 Phase 2 의 종료점은 이 설계문서다.** Pilot 수행(드레인 · 검수 · 자기보고 수집)은 승인 뒤 별도 목표 · 수용 기준으로 시작한다.

### 사용자 결정이 필요한 것

- 실제 표본을 (가) · (나) · (다) 중 어느 경로로 확보할지 — 지금 41건은 일괄 입력이라 Pilot 표본이 될 수 없다. **실사용 학습자 오답이 더 쌓일 때까지(예: 학습자 3명 이상) Pilot 을 미룰지**.
- 판정자 2명을 누가 맡는지. 사람인지 에이전트인지가 아니라 **독립성 조건**으로 판단한다: ① 판정할 evidence 의 제안 주체(reviewer_key)와 다를 것 ② 그 문항의 공개 이력이 없을 것 ③ 서로의 판정을 보지 않을 것. 에이전트 판정자는 AI 제안을 낸 에이전트 정의 · 모델과 달라야 한다(같은 정의 · 모델이면 같은 주체).

## 11. 예상 migration 영향

| 변경 | 종류 | 영향 |
|---|---|---|
| `csat_taxonomy_version` · `csat_error_cause_code` 생성 + 시드 20행 | 추가 | 없음 |
| `csat_error_judgment_run` 생성 | 추가 | 없음 |
| `csat_error_review` · `csat_error_review_round` · `csat_error_review_roster` · `csat_error_review_lock` 생성 | 추가 | 없음 |
| `csat_dx_session_attestation` 생성 | 추가 | 없음(가드 적용 여부는 승인 요청 6) |
| `csat_error_process_note` · `csat_error_judgment_input` 생성 | 추가 | 없음 |
| 응답 하나 단위 import RPC | 추가 | 없음 |
| `csat_dx_session` · `csat_dx_response` BEFORE DELETE 트리거(회차 취소 · 잠금 해제) | 기존 테이블에 트리거 추가 | 삭제 결과 동일 · 기존 `deleteExamSession` 과 후처리는 그대로 |
| 응답 일관성 · 학생 행 상태 트리거 | 추가 | 새 테이블에만 걸린다 |
| `csat_error_evidence` 생성 + RLS + 인덱스 2 | 추가 | 없음(새 쓰기 경로만) |
| `csat_choice_trap_map` · `csat_choice_trap_override` 생성 + family_v1 시드 31행(family 있는 key) — override 는 문항 FK `on delete cascade` 라 `scripts/csat/corpus-sync.mjs` 의 잔여 문항 삭제를 막지 않는다(그 문항이 Pilot · 판정 입력이면 실행 입력 보존본에 남아 재현은 된다) | 추가 | 없음 — 「국소 어색함」(family NULL, 12행 모두 `X-VOCAB` 어휘 문항)은 시드하지 않고 Pilot 표본에 걸리면 문항을 보고 개별 대응 |
| `funnel_events` 이벤트 CHECK 에 3개 추가 | 제약 교체 | 기존 행 영향 없음 |
| `csat_dx_snapshot_trigger_check` 에 `attestation` 추가(+ 코드 `SnapshotTrigger`) | 제약 교체 | 기존 행 영향 없음 · 승인 요청 6 을 택할 때만 |
| `csat_dx_snapshot.inputs_fingerprint` · `valid_until` 컬럼 + `(user_id, settings_id, inputs_fingerprint, computed_at)` 인덱스 | 컬럼 추가 | 기존 행은 NULL → 첫 조회에서 재계산 · 승인 요청 6 을 택할 때만 |
| `csat_item_attempts.error_cause` | **변경 안 함** | 문서에 「미사용 · 새 구조로 대체 예정」 표시만 |

- 파괴적 변경(DROP · TRUNCATE · 컬럼 삭제) 없음.
- 마이그레이션 번호는 만들기 직전 `ls supabase/migrations` 로 고른다. 적용은 SQL 을 보여 드리고 승인 뒤.
- 문서 동반: DB_SCHEMA · CHANGELOG · LEARNING_MODEL(진단 근거 수준) · 해당 파이프라인 화면도움말.

## 12. 기존 코드와의 호환성

| 지점 | 지금 | 이번 설계 뒤 |
|---|---|---|
| 지도 C 영역 라벨(`lib/csat/map/core.ts`) | 「오답 원인 분류」 — 실제 데이터는 선지 쪽 | **변경 안 함** — 목표 파일과 충돌하므로 사용자 결정(승인 요청 5) |
| 지도 C1~C8 노드 · `csat_dx_trap_family` | C 라인 집계에 사용 | **승인 전**: 그대로(라벨 「오답 원인 분류」 유지). **승인 요청 5 를 택하면**: 계산은 그대로 두고 화면 의미를 「선지 함정 노출」로 |
| 엔진 `trap_vulnerability`(스냅샷) | 고른 선지의 family 를 세서 「취약」 | 계산은 유지. 화면 문구를 「선지 함정 노출」로 바꿀지는 승인 요청 5와 함께 결정 |
| `my-traps` · 함정 드릴 | 선지 함정 학습 | 영향 없음(문항 쪽 데이터) |
| `csat_item_attempts.error_cause` | 0건 사용 | 손대지 않음 |
| 핵심 지도 `DiagnosisBasis` | 전부 `rule_proxy` | **바뀌지 않는다.** `cause_confirmed` 는 basis 가 아니라 별도 근거 상태다(「확인 진단 대상」 표시에만 쓴다). basis 를 `verified_diagnosis` 로 올리는 것은 직접 확인 진단(별도 설계)이 생긴 뒤에만 |
| `csat_dx_response` | — | FK 대상으로만 쓴다. 컬럼 변경 없음 |
| 스냅샷 · 핵심 지도 관찰값 | 한 번호 입력 회차(②만 · ③만)도 역량 · 함정 관찰 입력으로 쓴다 | **구조 결함** — 용도별 적격성 분리 + 스냅샷 재계산(승인 요청 6). 이번 설계 단계에서는 고치지 않는다 |

## 13. 입력 신뢰도 가드 — 승인 요청 6 상세

한 회차 응답의 90% 이상이 같은 선지면 「입력 신뢰도 확인 필요」로 표시한다(화면: 「한 번호로 입력된 기록이에요 — 실제로 푼 결과면 알려 주세요」). 지금 실사용 기록 2회가 이 경우다. **용도별로 적격성을 나눈다** — 회차를 엔진에서 통째로 빼지 않는다:
- 점수 · 추이(원점수 · 등급 · 회차 추이) — 응시 확인(①)만 있으면 쓴다. 확인 전에도 「확인 필요」 표시와 함께 보인다.
- **기록별 내용은 거르지 않는다** — 기록 상세의 오답 표(`wrongAll`) · 해설 링크 · 자기보고 버튼은 그 기록의 사실이라 적격성과 무관하게 그대로 보인다. 적격성은 **여러 기록을 합치는 진단 집계**(유형 · 함정 · 관찰 · 승격)에만 건다.
- **기록 목록 · 상세 접근은 적격성과 무관하게 유지한다** — 「응시 안 함」으로 확인한 기록도 시험 기록 목록에 「진단에 쓰지 않는 기록」으로 남고, 상세 모달에서 확인 정정 · 삭제를 할 수 있다. 지금 상세 모달은 `report.trend` 에서 기록을 찾으므로, 보고서에 지표용 `trend`(적격만)와 목록용 `records`(전부)를 따로 싣는다.
- 역량 관찰 · 함정 지표 · 원인 판정 — 선지별 판단 확인(②) 전에는 쓰지 않는다.

**스냅샷 갱신**: 가드 도입 · 확인 기록 추가 · 정정 때마다 그 학습자의 스냅샷을 다시 계산한다. 그러려면 재계산 사유 `attestation` 을 DB `csat_dx_snapshot_trigger_check` CHECK 와 코드 `SnapshotTrigger` 타입에 **함께** 더해야 한다(한쪽만이면 저장이 실패한다 — §11).

**입력 지문**: 지금 `inputs_as_of` 는 세션 생성 · 프로필 시각만 본다(`diagnosis/server.ts`). 시각의 최댓값으로는 「최신이 아닌 세션 삭제」를 잡지 못하므로, 시각 대신 **입력 지문** = hash(적격성 규칙 버전 · 세션마다 (id · `taken_at` · `mode` · `raw_score` · 응답 해시 · 유효 확인 revision · `score` 적격 · `observation` 적격) · 프로필 버전 · **엔진이 읽는 사전 데이터의 해시**(배점 · 정답표 · 문항→역량 대응 · 선지 함정 · family 표 — 각각 테이블 내용 해시))을 스냅샷에 저장한다. 원칙은 「엔진 입력 전체」이며, 지문은 **계산에 실제로 넘긴 `EngineInput` · `MapLineInput` 객체에서** 만든다(DB 를 다시 읽어 따로 만들지 않는다 — 조립 도중 데이터가 바뀌어도 지문과 계산이 같은 입력을 가리킨다). 회귀: 「조립 중 문항 대응표가 바뀌는 동시 변경 → 저장된 지문은 계산에 쓴 입력의 지문」. 구현 때 엔진 `EngineInput` · 지도 `MapLineInput`(`csat_map_line_link` · 문항 유형) 두 입력의 필드 목록과 지문 구성 요소를 1:1 로 맞추는 테스트를 둔다(필드가 늘었는데 지문에 없으면 실패). 회귀: 「대응표 · 유형만 바뀌어도 재계산된다」.

**시간(`now`)은 지문에 넣지 않는다** — 넣으면 조회마다 바뀐다. 대신 스냅샷에 **캐시 유효기간**을 둔다: `valid_until = computed_at + 재계산 간격`. 재계산 간격은 엔진의 연속 감쇠 반감기(`half_life_days`)와 **다른 새 설정값**(`snapshot_ttl_hours`, 기본 24시간)이다 — 반감기가 길어 하루 사이 값 변화가 작으므로 하루 한 번 재계산이면 충분하다는 판단이고, 설정에서 바꿀 수 있다. 선택 조건에 `valid_until > now`(주입된 now)를 더한다지문은 새 컬럼 `inputs_fingerprint` 에 둔다. 지도 로더는 지금 계산한 지문과 최신 스냅샷의 지문이 다르면 「다시 계산 중」으로 보고 재계산을 요청한다.

**스냅샷 선택**: 지금 선택 규칙(`diagnosis/snapshot.ts`)은 워터마크보다 **세션 수**를 먼저 비교한다 — 가드로 적격 세션이 줄면 재계산해도 옛 스냅샷(세션 수가 많은)이 이긴다. 그래서 선택을 이렇게 바꾼다 — 조건은 **SQL 조회에서 먼저** 건다(지금처럼 계산 시각순 `limit + 10` 개를 가져와 거르면 유효한 스냅샷이 범위 밖으로 밀린다): `where settings_id = <활성 설정> and engine_version = <현재 엔진 버전> and inputs_fingerprint = <지금 지문> and valid_until > <now> order by computed_at desc limit 1` — 지도 관찰 계산 규칙(`map-evidence`)의 버전은 엔진 버전에 묶어 함께 올린다(지도 규칙만 바뀌어도 엔진 버전을 올린다). 없으면 재계산 대상. 회귀 검증: 「새 입력을 읽은 옛 설정 계산이 늦게 끝나도 선택되지 않는다」 · 「최신이 아닌 세션을 지우는 동안 진행되던 계산(삭제 전 지문)은 끝나도 선택되지 않는다」 · 「확인 정정 뒤 계산이 선택된다」. 그리고 세션 수는 「적격 세션 수」로 이름을 바꿔 표시용으로만 둔다. 확인 · 정정이 생기면 지문이 바뀌므로 그 뒤 계산한 스냅샷만 선택된다.

**적용 경로 전부**: 적격성 판정은 함수 하나(`sessionEligibility(session, attestation) → { score, observation }`)로 두고, 응답을 읽는 모든 경로가 그것을 쓴다 — 진단 엔진 · 스냅샷 · 지도 관찰(`map-evidence`) · **시험 기록 보고서(`loadExamReport` → `buildExamReport`, 유형 · 오답 함정 · 틀린 문항 집계)** · **`/csat` 홈(`loadHomeDiagnosis` — 최근 점수 · 등급 · 기록 수, score 적격성 + 확인 필요 표시)** · 원인 export. 구현 때 `csat_dx_response` · `csat_dx_session` 을 읽는 곳을 grep 으로 다시 전수 확인한다. 회귀 검증: 「한 번호 입력 회차 → 점수 · 추이는 남고, 유형 · 함정 · 관찰 집계에서는 빠진다」를 경로마다.

기준은 오탐 측정 뒤 확정하고, 진단 결과가 바뀌는 변경이라 승인 뒤 별도 커밋으로.

## 승인 요청 항목

1. Choice Trap / Learner Error Cause 분리와 두 taxonomy 초안(9 + 20)
2. 테이블 13개 스키마(특히 `system` source 제외 · 학생은 서버 API 로만 쓰기 · 버전별 판정 이력 · 판정자별 검수 기록 · 신뢰도 3등급 정의 · 세션 삭제 시 함께 삭제)
3. 승격 2단계 — `cause_confirmed`(별도 근거 상태 · 조건 8개 · basis 불변) / `verified_diagnosis`(직접 확인 진단 필요 · 별도 설계)
4. Pilot 표본: 현재 41건은 한 번호 입력(②만 · ③만 — 입력 신뢰도 확인 전)이라 리허설 전용. 원인 검증에는 **풀이 과정 증거**가 필수라 실제 표본은 경로 (나) — 학습자 3명 이상이 기출을 실제로 풀고 틀린 문항마다 과정 증거를 남기는 것 — 를 권장. (가) 대기는 설명 적합성 점검까지만, (다) 합성은 표현력 점검까지만. 판정자 2명 구성(독립성 조건 §10)
5. 지도 C 의 의미: 지금 「오답 원인 분류」로 쓰인 C1~C8 을 **「선지 함정(문항 특성)」** 으로 바꿀지(목표 파일 「C = 오답 원인 분류」 개정 포함) — 바꾸면 엔진 `trap_vulnerability` 화면 문구도 「선지 함정 노출」로 함께 바꾼다
6. **입력 신뢰도 가드**(§13): 시험 1회분 응답의 90%(잠정) 이상이 같은 선지면 「입력 신뢰도 확인 필요」로 표시하고, 학습자 확인(응시 · 선지별 판단) 전까지 역량 · 함정 · 원인 집계에서 뺀다(점수 · 추이와 기록 자체는 유지). 지금 실사용 기록 2회가 이 경우다. 진단 결과가 바뀌는 변경이라 승인 뒤 별도 커밋으로.
