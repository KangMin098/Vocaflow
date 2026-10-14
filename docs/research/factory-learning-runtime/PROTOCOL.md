# FQR1 실행·채점·피드백 계약 연구 등록

2026-10-15, T-0032. 연구 기준 `a658fa39a0cd986506eac5c1aec68ebbb0aa2bac`, 별도 worktree/브랜치 `research/factory-learning-runtime-v1`. 최신 main 및 Claude P-F8는 별도 읽기 전용 snapshot으로 감사한다. 기존 연구를 다시 시작하거나 제품 코드를 병합·수정하지 않는다.

## 범위와 질문

핵심7유형은 vocab_choice/unit_vocab/blank_word/grammar_choice/grammar_fix/unit_grammar/word_order다. 실제 kind/type·payload·자극·발문·입력·키·해설·채점 RPC·기록·실행기·자격을 서로 대조한다. rhyme/word_meaning/spell_blank는 후속 범위로 분리한다. 어휘6권/구문6권/독해1단의13조합에서 재고 부재·구조/품질·실행기/채점/권리 공백을 구별한다.

## metadata-first 표본

실제 스키마/유형 분포를 확인하고 고정 seed `FQR1-20261015`로 유형당2개를 목표로 선정한다. 가능한 경우 코드에서 정의한 필수 필드의 존재/형식·해설 존재·원천 cache 상태 등 구조 metadata 층을 사용한다. 전문·키 값·해설 내용을 읽기 전에 선정ID/분모/코드/hash를 봉인한다. 부족한 유형은 부족 수와 이유를 남기고 다른 유형으로 대체하지 않는다. 기존 FQ1 표본12 ID 및 동일 원천을 새 독립 표본에서 제외하거나 불가피한 중복을 별도로 표시한다. 전문 확인 뒤 성공 사례로 교체하지 않는다.

14개 목표는 표본 목적이며 모집단 결함률 추정의 근거가 아니다. 개별 문항/원천 공유/권/유형/역할/응답/테스트의 분모를 분리한다. 필드별 완전성의 null은 미측정과 실제 부재를 구별한다.

## 실제 내용·호환성 검토

제공된 실제 원문/자극/보기/키/해설을 직접 확인한다. 필요한 원천 범위와 미읽은 범위를 기록한다. 원문 계보·cache freshness·현재 span 결속·생성 당시 revision·권리 승인은 서로 다르다. 전문 미확인이나 불충분한 근거를 pass로 승격하지 않는다.

선택지는 실제 개수를 유지하고 key index/ID/token을 구분한다. 배열형은 원문 의미와 중복 token의 식별을 검토한다. 단답형은 명시 대안과 정규화 정책을 확인하고 의미 동등 자유응답을 문자열 검사로 확정하지 않는다. 단순 선택형 정답은 V2/S5 직접 수행·숙달 증거가 아니다. 현행 TASK 코드북과 학생이 실제 제출한 수행을 대조한다.

## 실행·채점·피드백 검사

LearningActivitySpecification은 public presentation과 server grading secret을 분리하고 artifact/source/Gold/rules/TASK/role·시리즈/단계·입력형·출력형·피드백·힌트·노출·실행기·A–H를 결속한다. 화면 표시/구조 호환/채점 가능/내용 검토/공급 자격을 따로 표시한다. supported_by_existing_runner, requires_runner_adapter, requires_new_input_contract, requires_scoring_contract, requires_content_repair, requires_qualification, unsupported를 구분한다.

미지원·RPC 오류·키 누락은 학생 오답이나 학습 실패로 저장하지 않는다. correct/partial/incorrect/defer/scoring_error를 분리한다. 학생에게 요구하지 않은 산출물을 채점에 쓰지 않는다. 최초 응답→도움→수정→봉인→해설의 순서, assisted 표시, 노출·반복 시도의 기록과 교재/Workspace 복귀를 검토한다. 실제 DB 채점 RPC는 호출하지 않고 정의·호출 코드로 지원을 감사한다. RPC가 저장을 수행할 수 있기 때문이다.

## 독립 검토와 반례

신규 표본의 저자 내용 판정과 새 AI 문맥의 독립 검토를 분리하고 첫 결과를 hash로 보존한다. 검사기의 변이 fixture와 실제 신규 문항·개발 재사용 FQ 사례를 합산하지 않는다. 불일치는 합의로 지우지 않는다. FQ1.1의 문법 대체문 대안 해석·불완전 해설·사전 노출·강도 확대를 회귀로 유지한다. AI 검수·단위 검사·합성 응답은 인간/학생/교수 효과/권리의 증거가 아니다.

## 수용과 제외

9보고서, 유형별 JSON 계약/재사용/13권 원장, 실제 신규 표본과 첫 검토, 독립 반례, 순수 검사기·회귀·재현/hash/privacy, commit/push/REVIEW 제출까지 수행한다. 실제 신규 자료가 없으면 해당 유형 내용 검증만 HOLD하고 계약·오류 보호 연구를 계속한다. 제품/DB/RPC/RLS/UI/MAP/PLAN/기존 연구/원문/Gold/생산/공개/main을 변경하지 않는다. 전문·키·Gold·학생 응답은 ignored local에만 보존한다.
