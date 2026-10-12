-- supabase/migrations/20261005140000_csat_ec_taxonomy_v01_restore.sql
--
-- **오답 원인 taxonomy v0.1 — 기존 봉인 정본 복원(시드).** 새 taxonomy 를 만들거나 봉인 규칙을 바꾸지 않는다.
--
-- 왜: 정본 ①(20261003230000)이 taxonomy 표 쓰기 권한을 모든 런타임 역할에서 회수하고 「버전 · 코드 생성은 마이그레이션(시드)로」
--     정했다(① 1103행). 개발 DB 의 v0.1 은 2026-10-05 에 봉인돼 있으나 그 시드가 저장소에 없어, 빈 DB(격리 CI)에서는
--     Reveal Gate(④)의 보류 경로가 요구하는 sealed taxonomy 를 정본 경로로 만들 수 없었다.
-- 출처: 개발 DB(jajenrevcbmrpaliomxv) 2026-10-13 읽기 전용 추출 — csat_ec_taxonomy_version · csat_ec_code(19) · csat_ec_boundary(1)
--       의 to_jsonb 행 전체. 추출 텍스트 md5 39d938549f294a3dfda615d7a4f4dee8 = DB 계산값. 학습자 기록 · 응답 · 증거 없음.
--       v99.x(note TEST · smoke 전용)는 넣지 않는다.
-- 봉인값: definitions_hash 303e5140a2d54b2d58a8df99bc7be6c1c55cceaa63294111bf17f02aeb934ced
--       = ② csat_ec_taxonomy_seal 과 같은 식: sha256( 코드 to_jsonb 행을 code 순 줄바꿈 연결
--                                              || 경계가 있으면 '\n--boundaries--\n' || 경계 (to_jsonb - created_at) 를 boundary_key 순 연결 )
--
-- 동작(한 트랜잭션):
--   · v0.1 이 없으면: draft 로 버전 행 → 코드 · 경계 행(트리거가 draft 에만 허용) → 같은 식으로 해시 재계산 →
--     추출 봉인값과 다르면 중단 → draft→sealed 전이(sealed_at · definitions_hash 를 추출값으로) → 최종 행 전체 대조
--   · v0.1 이 있으면: 버전 행 · 코드 집합 · 경계 집합 전체를 추출값과 대조하고 해시를 재계산한다.
--     완전히 같으면 아무것도 바꾸지 않고 통과. 누락 · 초과 · 내용 차이 · 상태 차이 · 해시 불일치는 중단(무엇이 다른지 메시지).
--   · ON CONFLICT DO NOTHING · 봉인된 행 UPDATE · 트리거/RLS/권한 변경 없음.
-- 이 시드는 기존 봉인 정본의 **복원**이다 — 관리자 봉인 RPC(csat_ec_taxonomy_seal) · 관리자 JWT 를 검증하지 않는다.
-- 복구: 공유 DB 에서는 이 마이그레이션이 데이터를 바꾸지 않는다(같으면 통과 · 다르면 중단 → 원인 조사). 빈 DB 에서
--       적재 뒤 되돌리려면 봉인 트리거가 삭제를 막으므로 DB 를 다시 만든다(격리 러너는 폐기된다). 본문 아래 「실패 시」 참고.

begin;

do $restore$
declare
  p          jsonb := $payload${"codes": [{"axis": "B", "code": "B.no_verification", "label": "다른 선지를 확인하지 않음", "status": "active", "version": "v0.1", "exclusion": "시간이 없어서 → X.time. 확인했지만 차이를 못 가림 → E.option_mismatch.", "inclusion": "「①이 맞는 것 같아서 나머지는 안 봤다」 · 「대충 다 맞는 말 같아서 하나 골랐다」.", "definition": "이 attempt 에서 학생이 그럴듯한 첫 선지에서 **멈추거나 나머지 선지 · 근거를 확인하지 않고** 골랐다는 증거가 있고, 시간 부족 때문이라는 증거는 없을 때.", "student_group": null}, {"axis": "B", "code": "B.outside_knowledge", "label": "글 밖 지식으로 판단", "status": "active", "version": "v0.1", "exclusion": "글의 근거에서 잘못 추론 → R.inference. 배경지식을 **글의 단서와 함께** 써서 이해를 도운 것은 정상 독해다(평가원 출제 방향은 배경지식 · 글의 단서를 함께 쓰는 독해를 전제한다 — [SOURCES.md](./SOURCES.md)) — 이 코드는 글과 **충돌하거나 글을 대신한** 경우만.", "inclusion": "「상식적으로 맞는 말이라서」 · 「원래 그런 거니까」 · 글과 무관하거나 글과 반대인 사실을 근거로 듦.", "definition": "이 attempt 에서 학생이 선지 · 결론을 **글의 내용과 맞지 않거나 글이 말하지 않는 자기 상식 · 배경지식 · 가치 판단**에 근거해 골랐다는 증거가 있을 때.", "student_group": null}, {"axis": "B", "code": "B.surface_match", "label": "겹치는 낱말로 고름", "status": "active", "version": "v0.1", "exclusion": "뜻을 대조했는데 차이를 못 가림 → E.option_mismatch. 그 낱말 뜻을 잘못 앎 → V.", "inclusion": "「지문에 나온 단어가 있어서」 · 「이 단어가 계속 나와서」.", "definition": "이 attempt 에서 학생이 **선지와 글에 같은 낱말 · 비슷한 낱말이 있다는 것**을 주된 근거로 골랐고, 뜻 대조 흔적이 없다는 증거가 있을 때.", "student_group": null}, {"axis": "E", "code": "E.evidence_location", "label": "근거 위치를 잘못 대응", "status": "active", "version": "v0.1", "exclusion": "맞는 위치를 봤는데 그 문장을 오역 → V/S. 맞는 위치 · 맞는 해석인데 선지와의 차이를 못 봄 → E.option_mismatch. 숫자를 잘못 읽음(위치는 맞음) → X.attention.", "inclusion": "내용 일치에서 선지를 다른 인물 · 다른 연도 · 다른 항목 문장과 대조 · 도표 문항에서 다른 행 · 열을 읽음 · 빈칸의 단서를 빈칸과 무관한 문단에서 가져옴.", "definition": "이 attempt 에서 학생이 글은 맞게 읽었으나 선지 · 빈칸 · 문항이 요구하는 정보에 **글의 다른 부분을 대응시켜** 판단한 증거가 있을 때.", "student_group": "evidence"}, {"axis": "E", "code": "E.option_mismatch", "label": "선지와 글의 차이를 못 가림", "status": "active", "version": "v0.1", "exclusion": "글 자체를 틀리게 이해 → V/S/R(먼저). 선지 낱말 뜻을 몰라서 재진술을 못 알아봄 → V(선지 낱말이라도 V). 대조 없이 골랐다 → B. 선지 왜곡의 **종류**(범위/강도/방향)는 원인 코드가 아니다 — Choice Trap 으로 따로 기록돼 있다.", "inclusion": "「글에도 비슷한 말이 있어서」(실제로 '일부'→'모두') · 정답이 다른 말로 바꿔 써서 「글에 없는 말이라」 버림(학생이 글 내용은 맞게 말함) · 요약문에서 (A)는 맞고 (B)의 방향을 거꾸로 받아들임(글 이해는 맞음).", "definition": "이 attempt 에서 학생이 글의 해당 부분을 맞게 이해했으나 **선지가 그 내용과 범위 · 강도 · 방향 · 관계(주체 · 인과 · 대상)에서 다르다는 것**을 가리지 못해 오답을 받아들였거나, 정답 선지가 글을 다른 말로 바꿔 쓴 것(재진술)을 알아보지 못해 버린 증거가 있을 때.", "student_group": "choice"}, {"axis": "E", "code": "E.task_misread", "label": "묻는 것을 다르게 이해", "status": "active", "version": "v0.1", "exclusion": "발문은 알았는데 훑다가 NOT 을 놓쳤다는 증거(「다시 보니 not 이었다」 · 시간 기록) → `X.attention`. 지문 안 부정을 잘못 처리 → S.operator_scope.", "inclusion": "불일치 문항에서 일치하는 선지를 고르고 「지문에 있는 내용이라서」라고 씀 · 목적 문항에서 세부 내용을 고름 · 무관 문장 문항에서 「가장 중요한 문장」을 찾음.", "definition": "이 attempt 에서 학생이 **발문이 요구하는 것**(일치 vs 불일치 · 가장 적절한 vs 적절하지 않은 · 밑줄의 의미 vs 밑줄 자체 · 글의 목적 vs 내용 · 요약문 빈칸 (A)(B) 대응)을 다르게 이해해 다른 기준으로 답을 고른 증거가 있을 때.", "student_group": "choice"}, {"axis": "R", "code": "R.inference", "label": "함축 · 추론을 잘못 구성", "status": "active", "version": "v0.1", "exclusion": "밑줄이 사전상 숙어인데 몰랐다 → V.multiword. 글 밖 상식으로 결론을 채움 → `B.outside_knowledge`. 글의 중심 주장을 잘못 잡아 함축이 틀어짐(중심 오류가 먼저 보임) → R.main_point primary.", "inclusion": "함축 문항에서 밑줄을 문자 그대로 해석 · 근거 없이 지나치게 나아간 추론 · 심경 변화의 방향을 반대로.", "definition": "이 attempt 에서 학생이 글에 직접 쓰이지 않은 뜻(밑줄 비유의 의미 · 글쓴이의 태도 · 함축된 결론 · 인물 심경)을 **글의 근거에서 잘못 이끌어 내거나 문자 그대로 읽어** 판단에 실패했다는 증거가 있을 때.", "student_group": "flow"}, {"axis": "R", "code": "R.main_point", "label": "글의 중심 · 위계를 잘못 잡음", "status": "active", "version": "v0.1", "exclusion": "중심을 맞게 잡았는데 선지가 그 중심을 과대 · 과소 진술한 것을 못 가림 → `E.option_mismatch`. 문장 사이 관계를 틀려서 중심이 틀어짐(연결 오류가 먼저 보임) → R.relation primary.", "inclusion": "예시 · 통념(도입부 반박 대상)을 주장으로 고름 · 세부 하나를 전체로 · 글쓴이 주장과 인용된 남의 주장을 바꿈.", "definition": "이 attempt 에서 학생이 문장들은 처리했으나 **글 전체에서 무엇이 중심 주장이고 무엇이 뒷받침 · 예시 · 배경인지**를 잘못 정해 요지 · 주제 · 제목 · 요약 판단에 실패했다는 증거가 있을 때.", "student_group": "flow"}, {"axis": "R", "code": "R.reference", "label": "지시 대상 추적 실패", "status": "active", "version": "v0.1", "exclusion": "한 문장 안의 수식 관계 → S.attachment. 지시어가 아닌 연결어(however · thus)의 논리 → R.relation.", "inclusion": "순서 · 삽입 문항에서 「this problem 이 (A)의 문제라고 생각」이 틀림 · 지칭 대상 문항에서 등장인물을 바꿈.", "definition": "이 attempt 에서 학생이 대명사 · 재귀대명사 · 지시어(this · such · these + 명사 · the former) · 대용어가 **무엇을 가리키는지**(앞 · 뒤 문장, 또는 같은 문장 안 — 규칙 R7)를 잘못 이어 글의 내용 · 순서를 틀리게 구성했다는 증거가 있을 때.", "student_group": "flow"}, {"axis": "R", "code": "R.relation", "label": "문장 사이 관계를 잘못 연결", "status": "active", "version": "v0.1", "exclusion": "문장 하나의 해석이 틀림 → V/S. 관계는 맞게 봤는데 글 전체의 중심을 잘못 잡음 → R.main_point. 지시어 대상 → R.reference.", "inclusion": "However 앞뒤를 같은 방향으로 읽음 · 예시를 주장으로 읽음 · 빈칸에서 앞 문장과 반대 방향이 와야 하는데 같은 방향을 고름(낱말 뜻은 앎) · 무관 문장 문항에서 흐름 이탈을 못 봄.", "definition": "이 attempt 에서 학생이 각 문장과 참조 대상은 맞게 파악했으나 문장 · 단락 사이의 **논리 관계**(대조 · 인과 · 예시 · 일반화 · 양보 · 시간 순서 · 문제-해결)를 잘못 이어 글의 흐름을 틀리게 구성했다는 증거가 있을 때.", "student_group": "flow"}, {"axis": "S", "code": "S.attachment", "label": "꾸밈 · 연결 대상을 잘못 붙임", "status": "active", "version": "v0.1", "exclusion": "문장 성분 자체가 바뀜 → core_structure. 문장 사이의 대명사 · 지시어 → `R.reference`.", "inclusion": "「~하는 사람들의 ~」에서 수식 대상을 바꿈 · and 로 이어진 병렬 짝을 잘못 묶음.", "definition": "이 attempt 에서 학생이 수식어(전치사구 · 분사구 · to부정사 · 관계절 · 부사)나 대명사가 아닌 **문장 안의 연결어가 어느 말에 걸리는지**를 잘못 붙여 문장 뜻이 바뀌었다는 증거가 있을 때.", "student_group": "sentence"}, {"axis": "S", "code": "S.core_structure", "label": "문장 뼈대를 잘못 잡음", "status": "active", "version": "v0.1", "exclusion": "뼈대는 맞는데 수식어가 어느 말에 붙는지 틀렸다 → `S.attachment`. 부정 · 비교 · 조건의 범위 · 방향만 틀렸다 → `S.operator_scope`. 구조는 맞게 봤는데 문법 형태 규칙(분사 태 · 관계사 선택)을 모른다 → `S.form_rule`.", "inclusion": "해석에서 주어와 목적어가 바뀌었다 · 관계절 동사를 본동사로 읽었다 · 도치 · 생략을 못 풀었다. 어법 문항에서 주어를 잘못 찾아 수일치를 틀렸다.", "definition": "이 attempt 에서 학생이 한 문장의 **주어 · 동사 · 절의 경계**(어디까지가 주어인지 · 본동사가 무엇인지 · 관계절/명사절이 어디서 끝나는지 · 생략 · 도치)를 잘못 잡아 그 문장의 뜻을 틀리게 구성했다는 증거가 있을 때.", "student_group": "sentence"}, {"axis": "S", "code": "S.form_rule", "label": "문법 형태 판단 규칙", "status": "active", "version": "v0.1", "exclusion": "주어를 잘못 찾아 수일치를 틀림 → core_structure(구조 파악 실패가 먼저). 낱말 뜻을 몰라 문장을 못 읽음 → V.", "inclusion": "어법 문항에서 「주어가 사물이라 능동」처럼 틀린 규칙을 이유로 댐 · 규칙을 모른다고 표시.", "definition": "이 attempt 에서 학생이 문장 구조는 맞게 파악했으나 **형태를 고르는 규칙**(능동/수동 분사 · 관계사 what/that/which · 동사/준동사 자리 · 대명사 수 · 형용사/부사 · 병렬 형태)을 틀리게 적용해 어법 판단에 실패했다는 증거가 있을 때.", "student_group": "sentence"}, {"axis": "S", "code": "S.operator_scope", "label": "부정 · 비교 · 조건의 범위 · 방향", "status": "active", "version": "v0.1", "exclusion": "발문의 NOT/불일치를 놓침 → `E.task_misread`. 선지의 강도(always · only)를 지문과 비교하지 않음 → `E.option_mismatch`. 지문 문장은 맞게 읽고 문장 사이 대조(However)를 놓침 → `R.relation`.", "inclusion": "해석에서 부정이 빠지거나 다른 말에 걸림 · 비교의 두 대상이 바뀜 · `not A but B` 를 반대로.", "definition": "이 attempt 에서 학생이 부정(not · no · hardly · fail to · without) · 비교(more/less than · as … as · rather than · the -er) · 조건 · 양보 · 정도(only · too … to) 표현이 **무엇을 얼마나 뒤집거나 제한하는지**를 잘못 처리해 문장 뜻이 반대 · 다른 강도가 됐다는 증거가 있을 때.", "student_group": "sentence"}, {"axis": "V", "code": "V.multiword", "label": "덩어리 뜻을 놓침", "status": "active", "version": "v0.1", "exclusion": "표현 중 한 낱말을 몰랐다 → unknown_word. 고정 표현이 아닌 자리의 한 낱말을 다른 사전 뜻으로 읽었다 → `V.wrong_sense`(R12 ②). 문장 구조상 어디에 붙는지를 잘못 잡았다 → `S.attachment`. 밑줄 친 비유가 글에서 가리키는 뜻(함축)을 못 잡았다 → `R.inference`.", "inclusion": "해석이 낱말별 직역이고 고정 표현의 뜻과 어긋난다(예: `turn down` → '아래로 돌리다').", "definition": "이 attempt 에서 학생이 각 낱말은 처리했으나 **여러 낱말이 이루는 고정 표현**(구동사 · 숙어 · 연어 · 관용 비유)의 뜻을 낱말 합으로 처리해 판단에 실패했다는 증거가 있을 때.", "student_group": "word"}, {"axis": "V", "code": "V.unknown_word", "label": "모르는 낱말", "status": "active", "version": "v0.1", "exclusion": "아는 뜻이 있는데 이 문맥의 뜻과 다르다 → `V.wrong_sense`. 낱말은 다 아는데 덩어리(숙어 · 구동사 · 연어) 뜻이 틀렸다 → `V.multiword`. 모르는 낱말이 있었지만 판단과 무관한 자리다 → 원인 아님.", "inclusion": "학생이 특정 낱말을 「몰랐다」고 표시하거나, 해석에서 그 낱말을 빼먹고 / 엉뚱한 추측으로 채웠고, 그 낱말이 정답 판단에 필요한 자리에 있다.", "definition": "이 attempt 에서 학생이 판단에 필요한 낱말의 뜻을 **얻지 못해**(모름 · 비워 둠) 정답 판단에 실패했다는 증거가 있을 때.", "student_group": "word"}, {"axis": "V", "code": "V.wrong_sense", "label": "다른 뜻으로 읽음", "status": "active", "version": "v0.1", "exclusion": "뜻을 몰랐다 · 채운 뜻이 그 낱말의 사전 뜻이 아니다 → unknown_word(R12 ①). 고정 표현 안의 한 낱말을 다른 사전 뜻으로 읽어 표현 전체를 낱말 합으로 처리했다 → `V.multiword`(R12 ②). 낱말 뜻은 맞는데 문장 안 역할 · 범위가 틀렸다 → S. 낱말 뜻은 맞는데 글 흐름상 반대가 와야 한다는 것을 못 봤다(어휘 문항) → `R.relation`. 낱말 뜻은 맞게 잡았는데 글쓴이가 만든 구절 비유를 잘못 옮겼다 → `R.inference`(R6 ②).", "inclusion": "학생 해석에 그 낱말이 문맥과 다른 확정 뜻으로 들어 있다. 어휘 문항(문맥상 낱말 쓰임)에서 낱말 뜻 자체를 다르게 잡은 경우 포함.", "definition": "이 attempt 에서 학생이 낱말을 **아는 다른 뜻**(1차 뜻 · 다의어의 다른 뜻 · 비슷한 철자 낱말의 뜻)으로 처리해 정답 판단에 실패했다는 증거가 있을 때.", "student_group": "word"}, {"axis": "X", "code": "X.attention", "label": "주의 이탈 · 표기 실수", "status": "active", "version": "v0.1", "exclusion": "발문 기준을 다르게 이해 → E.task_misread. 시간 부족 → X.time.", "inclusion": "「다시 보니 not 이 있었다」 · 「답은 ③이라고 생각했는데 ④에 마킹」 · 도표에서 2를 7로 봄.", "definition": "이 attempt 에서 학생이 처리할 수 있는 정보를 **순간적으로 놓치거나 잘못 옮긴** 증거가 있을 때(숫자 · 낱말을 잘못 봄 · 발문의 NOT 을 알면서 놓침 · 답을 알았는데 다른 번호에 표시).", "student_group": "time"}, {"axis": "X", "code": "X.time", "label": "시간 부족", "status": "active", "version": "v0.1", "exclusion": "시간은 있었는데 확인을 생략 → B.no_verification. 시간이 있었는데 처리 실패 → 해당 V/S/R/E.", "inclusion": "상황 기록(남은 시간 · 마지막 몇 문항 · 풀이 시간이 매우 짧음) + 「시간이 없어서」.", "definition": "이 attempt 에서 **남은 시간이 부족해** 학생이 정상 풀이(읽기 · 대조)를 끝내지 못하고 골랐다는 증거가 있을 때.", "student_group": "time"}], "version": {"note": "v0.1 conditional seed candidate — rev4 did not pass the preregistered v0.1 seed gate. 제품 결정: 2026-10-05 사용자 결정 — 2(R6 경계 provisional 로 seed 포함) + 3(Pilot 에서도 provisional 유지). validated · verified taxonomy 가 아니다.", "status": "sealed", "version": "v0.1", "sealed_at": "2026-10-05T06:09:09.81796+00:00", "created_at": "2026-10-05T06:09:09.81796+00:00", "definitions_hash": "303e5140a2d54b2d58a8df99bc7be6c1c55cceaa63294111bf17f02aeb934ced"}, "boundaries": [{"code_a": "R.inference", "code_b": "V.wrong_sense", "status": "provisional", "version": "v0.1", "probe_key": "r6_derivation_probe", "created_at": "2026-10-05T06:09:09.81796+00:00", "provenance": {"codebook": "CODEBOOK.rev4.2.md@c7001aff97b0", "decision": "SEED_DECISION.md 제품 결정 2026-10-05 (2+3)", "evidence": ["REV43_EVAL.md", "ADJUDICATION_REV43.md", "ADJUDICATION_REV42_C411.md", "REV42_EVAL.md", "REV41_EVAL.md", "REV4_EVAL.md"], "auto_confirm": false, "decision_json_id": "V.wrong_sense|R.inference", "on_undistinguished": "multiple_plausible(두 후보가 각각 최소 증거) 또는 insufficient_evidence(아니면) — 다수결 · 모델 합의 · 단계 우선(R3)만으로 primary 를 만들지 않는다"}, "boundary_key": "r.inference__v.wrong_sense", "decision_note": "학생이 어떤 낱말의 뜻을 언급하면서 동시에 그 뜻에서 문맥 · 비유적 해석을 도출하는 형태의 설명(「X 가 Y 라는 뜻이니까 …」) — 이 증거로는 「사전 뜻을 직접 골랐다」 와 「기본 뜻에서 비유를 도출했다」 가 구별되지 않는다(rev4.3 HA · R4-H1 adjudication 이 같은 지점에서 반대로 갈림)"}]}$payload$::jsonb;
  v_ver      text  := p->'version'->>'version';
  v_expect   text  := p->'version'->>'definitions_hash';
  v_row      public.csat_ec_taxonomy_version;
  v_want     public.csat_ec_taxonomy_version := jsonb_populate_record(null::public.csat_ec_taxonomy_version, p->'version');
  v_hash     text;
  v_missing  int;
  v_extra    int;
begin
  if v_ver is distinct from 'v0.1' or v_want.status <> 'sealed' or v_expect !~ '^[0-9a-f]{64}$' then
    raise exception 'taxonomy 복원: 시드 자료가 v0.1 봉인 정본이 아니다';
  end if;

  select * into v_row from public.csat_ec_taxonomy_version where version = v_ver;

  if found then
    -- ── 이미 있다: 전체 대조만(바꾸지 않는다) ──
    if v_row is distinct from v_want then
      raise exception 'taxonomy 복원: 기존 % 버전 행이 정본과 다르다(status % · hash % · sealed_at % · created_at % · note 동일 %) — 바꾸지 않고 멈춘다',
        v_ver, v_row.status, v_row.definitions_hash, v_row.sealed_at, v_row.created_at, (v_row.note is not distinct from v_want.note);
    end if;
    select count(*) into v_missing from (
      select * from jsonb_populate_recordset(null::public.csat_ec_code, p->'codes')
      except select * from public.csat_ec_code where version = v_ver) d;
    select count(*) into v_extra from (
      select * from public.csat_ec_code where version = v_ver
      except select * from jsonb_populate_recordset(null::public.csat_ec_code, p->'codes')) d;
    if v_missing > 0 or v_extra > 0 then
      raise exception 'taxonomy 복원: 기존 % 코드가 정본과 다르다(정본에만 % · DB 에만 %) — 바꾸지 않고 멈춘다', v_ver, v_missing, v_extra;
    end if;
    select count(*) into v_missing from (
      select * from jsonb_populate_recordset(null::public.csat_ec_boundary, p->'boundaries')
      except select * from public.csat_ec_boundary where version = v_ver) d;
    select count(*) into v_extra from (
      select * from public.csat_ec_boundary where version = v_ver
      except select * from jsonb_populate_recordset(null::public.csat_ec_boundary, p->'boundaries')) d;
    if v_missing > 0 or v_extra > 0 then
      raise exception 'taxonomy 복원: 기존 % 경계가 정본과 다르다(정본에만 % · DB 에만 %) — 바꾸지 않고 멈춘다', v_ver, v_missing, v_extra;
    end if;
  else
    -- ── 없다: draft 로 넣고 같은 식으로 봉인 ──
    insert into public.csat_ec_taxonomy_version (version, status, definitions_hash, note, created_at, sealed_at)
      values (v_ver, 'draft', null, v_want.note, v_want.created_at, null);
    insert into public.csat_ec_code select * from jsonb_populate_recordset(null::public.csat_ec_code, p->'codes');
    insert into public.csat_ec_boundary select * from jsonb_populate_recordset(null::public.csat_ec_boundary, p->'boundaries');
  end if;

  -- ── 봉인 식 재계산(② csat_ec_taxonomy_seal 과 같은 식) ──
  select encode(extensions.digest(
           coalesce((select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = v_ver), '')
           || coalesce(chr(10) || '--boundaries--' || chr(10)
                       || (select string_agg((to_jsonb(b) - 'created_at')::text, chr(10) order by b.boundary_key)
                             from public.csat_ec_boundary b where b.version = v_ver), ''),
           'sha256'), 'hex') into v_hash;
  if v_hash is distinct from v_expect then
    raise exception 'taxonomy 복원: 재계산 해시 % ≠ 정본 봉인값 % — 중단(트랜잭션 전체 취소)', v_hash, v_expect;
  end if;

  if v_row.version is null then
    -- draft → sealed 한 번(① taxonomy_guard 가 허용하는 유일한 전이 — 식별 컬럼 불변)
    update public.csat_ec_taxonomy_version
       set status = 'sealed', sealed_at = v_want.sealed_at, definitions_hash = v_hash
     where version = v_ver and status = 'draft';
    select * into v_row from public.csat_ec_taxonomy_version where version = v_ver;
    if v_row is distinct from v_want then
      raise exception 'taxonomy 복원: 적재 뒤 버전 행이 정본과 다르다 — 중단';
    end if;
    raise notice 'taxonomy 복원: % 를 새로 적재 · 봉인값 일치 %', v_ver, v_hash;
  else
    raise notice 'taxonomy 복원: % 가 이미 정본과 같다 — 변경 없음', v_ver;
  end if;
end $restore$;

commit;

-- 실패 시(예상 결과와 복구):
--   신규 적재(빈 DB)      → 버전 1 · 코드 19 · 경계 1 적재, NOTICE 「새로 적재」. 재계산 해시 = 303e5140….
--   동일 데이터 재실행    → NOTICE 「변경 없음」, 쓰기 0.
--   내용 충돌(행 다름)    → EXCEPTION 「정본과 다르다」(버전/코드/경계 중 어디인지 · 개수), 트랜잭션 취소 · 쓰기 0.
--                          복구: 그 DB 의 v0.1 이 언제 · 어떻게 바뀌었는지 조사(봉인 트리거가 막으므로 정상 경로로는 바뀌지 않는다).
--   부분 적재(일부 행만)  → 버전 행이 있으면 코드/경계 누락 · 초과로 EXCEPTION. 버전 행 없이 코드만 있는 상태는 FK 로 불가.
--   해시 불일치           → EXCEPTION 「재계산 해시 ≠ 정본 봉인값」, 트랜잭션 취소 · 쓰기 0. 복구: 추출 자료 · 표 구조(컬럼 추가 등) 확인.
