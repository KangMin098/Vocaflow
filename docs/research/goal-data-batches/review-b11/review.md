# T-0118 · b11-v24 독립 검증

조건부 가능: v2.4 연구 확대만, 양 트랙 허용 입력/금지 문서와 실제 프롬프트를 보존하고 b11을 미노출 기준선으로 재사용하지 않는다.

검증 수행 완료(pass), skip_count=0. 새 P0 0 · P1 1. 오염 부재나 봉인 승인이라는 뜻은 아니다. 입력 @48fa2a404d33219f1560edb4996030dd31513349, 비교 2b3f3bafb..48fa2a404d33219f1560edb4996030dd31513349. 최초 task show에서 IN_PROGRESS/session t-0118-codex 일치 확인, PID 조회 없음. 중앙 dev-minimal-20261020 읽음. 입력 worktree에는 쓰지 않았다. Git 객체는 리뷰 worktree에서 읽고 ignored local 패킷을 한 번 복사해 이후 고정했다.

## 수용 기준

- AC0 **unclear** — 80행 최종 v2.4 통과; A E1 회피는 문항별 이유로 설명 가능하지만 §4의 사실형 확장·금지로는 설명 불가. 최초 B19는 v2.5 §3에만 적합; 실제 열람/유입 경로는 원 프롬프트·대화 부재로 미확정. (docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:28; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:33; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:8; scripts/research/goal-data/d2-validate.mjs:85; scripts/research/goal-data/local/b11-v24/history/2026-10-23T09-02-24-937Z-B01-first/chunk-B-01.out.json:108)
- AC1 **confirmed** — B02-first M2309#41 구 검증기 허용/신 검증기 거부 재현. 최종 b2–b11 전체 18트랙 결함 0. 단일·복수·fallback·answers 우선·정당 오답 반례 확인. (scripts/research/goal-data/d2-validate.mjs:35; scripts/research/goal-data/local/b11-v24/history/2026-10-23T09-04-05-104Z-B02-first/chunk-B-02.out.json:54)
- AC2 **confirmed** — 선정40·도표2·해시·생성4파일 재현·227/240·κ .899452·주36·경보 ok. 동결 3차이는 종료 후 수정3파일뿐, 기준선 복원16/16 및 비교2파일 불변. (docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:235; docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:229; docs/research/goal-data-batches/D2-task-mapping/b11-v24-agreement.json:43)
- AC3 **unclear** — 후보10·갈림10·주TASK4 전수 원문대조 완료; E2/E3 3 및 E1/R4 분해는 기록한 모호함과 일치. R4/E2 직접성·오답 경로 가설의 유일한 Gold는 미확정. (scripts/research/goal-data/local/b11-v24/input.json:2514; scripts/research/goal-data/local/b11-v24/input.json:4124; scripts/research/goal-data/local/b11-v24/input.json:5540; scripts/research/goal-data/local/b11-v24/input.json:5676)
- AC4 **confirmed** — verdict.json/review.md, 새 P0/P1, 다음 배치 및 unclear 명시 (docs/research/goal-data-batches/review-b11/review.md:1; docs/research/goal-data-batches/review-b11/verdict.json:1)

## 재계산·가드·동결

97개 검사 통과. 지정 diff 17파일을 저장하고 코드·계약·JSON 전체 구조/행 추가를 대조했다. 기존 JSONL 행 삭제/변경은 0이다. M2309 27+M2306 13=40, 도표 M2309#25/M2306#25 제외, 기존 선정과 중복 0. 선정·본문·원천·계약·입력 해시 일치, D2 생성물 4개 바이트 재현. 일치227/240=.9458333333, κ=.8994521431(저장 .9458/.8995). 주36/40, R1 80, 갈림13. 안정5 경보 모두 ok; R4는 .875/κ .7745로 최약이나 두 임계치를 함께 밑돌지 않는다.

b2/b3/b4/b5/b6/b7/b8/b9/b11 각 A/B에서40/8/40/38/40/40/40/40/40행 통과, 결함0. 이는 구조/계약 회귀이지 의미 Gold 인증은 아니다. 새 가드는 B02-first M2309#41을 거부하고 구 검증기는 그 행을 허용한다. B02 원본의 다른 3행 발문 누락은 구/신 모두 거부하므로 전체 트랙 통과라고 하지 않는다. 단일 정답·answer fallback·복수 정답·answers 우선·정당 오답 반례 확인. 최초→최종 수정은 B01 secondary 1/발문7/오답 설명1, B02 발문3/정답 distractor 삭제1, A01 오답 설명1, A02 무수정. primary·primary_reason·links·decision_path·outside 변경0.

동결 현재 불일치는 정확히3: CONTRACT_V2_5 머리말, d2-export b11 정의, d2-validate 가드. 나머지13은 일치하고 이3파일만 이전 바이트로 복원한 메모리 실행은16/16이다. Git에서 종료 결정 a89bd3c(17:56:06+09:00) 뒤 export319a455(17:56:21), 가드48fa2a404(18:06:27) 순서. 비교 결과 v2_5-comparison.json 및 v2_5-prereg-run.json은 기준 커밋과 바이트 불변. 파일시각/실제 역사적 미열람은 이 사실만으로 입증하지 않는다.

## v2.5 흔적·사용 범위

A01/A02/B01/B02 최종80행을 각각 v2.4/v2.5 row 검사와 primary 이유로 대조했다(아래 행별 표). A/B의 사실·안내·서사 일치7행 모두 E1 primary가 아니지만, 위치·대조를 문항별로 더 결정적이라 설명하는 것은 v2.4 §3과 양립한다. **v2.4 §4의 적용 대상은 빈칸·요약·제목·요지·주제다. 이를 사실·안내문에 고정 확장하거나 E1 금지를 v2.4 규칙으로 설명하는 주장은 refuted**. 해당 행의 primary를 E1로 바꾼 대조에서 v2.4에는 v2.5 금지 오류가 없고 v2.5에만 생긴다. (docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:33; scripts/research/goal-data/d2-validate.mjs:76)

M2309#26/#27/M2306#26은 각각 지속/중단·하루/일주일·사임 전/후를 대조하며, #28은 흩어진 등록 항목 탐색, M2309#45/M2306#27/#28은 두 direct 사이에 양쪽 이유가 성립한다. A01의 회피 자진 보고는 mapping-review에 있지만 원 발언/도구 transcript는 제공되지 않아 하드 금지를 실제 적용했는지 unclear. A02도 유형 금지 선언이나 v2.5 인용을 확인하지 못했다. 함축2행의 R6, 심경2행 null도 v2.3/v2.4로 설명 가능하다. A의 null secondary=[]는 v2.4와 맞고 indirect가 있는 행에서는 v2.5 secondary 규칙과 다르다.

추가 발견은 최초 B01 M2309#19: direct0·primary null에서 secondary에 indirect R4가 남아 v2.4는 거부하고 v2.5만 허용한다. 따라서 **최초 산출물에 v2.5 §3과 일치하는 구조적 흔적이 없음**은 refuted. 그러나 이 한 번의 필드 실수는 실제 열람이나 고유 규칙 채택의 확정 증거가 아니다. b9의 불가능한 검증 오류 문구를 사실로 보고한 사건과 달리, 이곳에는 그와 같은 원 주장 transcript가 없다. 같은 판정 방법으로 검사 출력을 나눠 보되 오염 원인 확정은 unclear로 둔다. 최종은 secondary[]로 바로잡았고 link/primary는 불변이다. (scripts/research/goal-data/d2-validate.mjs:85; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:22)

B11-P1-01(confirmed)은 이 최초 흔적과 독립성 증거 공백이다. 지정 local/b11-v24에는 prompts/ 폴더가 없고 입력/출력/history만 있다. 그러므로 A 프롬프트의 V2_5_PREREGISTRATION 금지 누락은 담당 보고 이상의 독립 확인이 안 된다. snapshot은 상대 트랙 판정도 복사하지만 실제 열람 여부는 unclear다. b11 최종 A/B는 **제한을 붙인 v2.4 연구 후보 링크**로 보존 가능하나 미노출 기준선·버전 효과·일반화 근거로 사용 불가. P2: README docs/research/goal-data-batches/README.md:10의 봉인 후보·수동 대기는 종료 결정과 충돌한다.

## 원문 표본 후보10·갈림10·주 TASK4

- candidates M2309#38/R4: **confirmed** — ②. 사회심리학자 주체 뒤에 정의가 들어가고 다음 문장이 그 정의를 받는다. 통념→정의→부연의 R4 후보를 지지한다. 삽입 E2 unknown·독립 평가 부적격 유지. (scripts/research/goal-data/local/b11-v24/input.json:3043; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:2254; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:2213)
- candidates M2309#39/R4: **confirmed** — ⑤. 접근 장벽과 부담 뒤에 확인 전화가 추가되고 다음 문장의 전화 지칭을 채운다. R4 묶음 관찰 후보 지지; R2의 별도 측정으로 올리지 않는다. (scripts/research/goal-data/local/b11-v24/input.json:3196; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:3; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:2)
- candidates M2306#21/E1: **confirmed** — ⑤. 특정 관점으로만 본다는 이유에서 관점 없는 객관적 시각을 역으로 끌어낸다. E1 indirect의 발문 대상/글 주장 혼동①은 가능. E3 indirect/무관 우열은 unclear. (scripts/research/goal-data/local/b11-v24/input.json:4753; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:303; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:262)
- candidates M2306#26/E1: **confirmed** — ③. Kidd 사임 후 임명을 사임 전으로 뒤집었다. 부정 발문 E1 direct와 시간 대조 E3 지지. (scripts/research/goal-data/local/b11-v24/input.json:5389; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:423; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:366)
- candidates M2306#27/E1: **confirmed** — ⑤. 전시되지만 구매 불가라는 항목이 구입 가능 선지와 반대다. E1 direct 지지. A E3/B E2는 부정 표현 대조와 항목 찾기를 각각 강조해 양립; primary 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:5540; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:453; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:392)
- candidates M2306#29/E1: **confirmed** — ③. 관계사 뒤 절이 완전하고 소유 관계여서 소유격이 필요하다. 부정 요구 E1 후보·실제 어법 수행 범위 밖 지지. (scripts/research/goal-data/local/b11-v24/input.json:5827; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:513; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:444)
- candidates M2306#30/E1: **confirmed** — ④. 비용 인상·규제는 자동차 수요 수용과 반대다. 부정 요구 E1 후보·V축 범위 밖 지지. (scripts/research/goal-data/local/b11-v24/input.json:5979; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:543; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:470)
- candidates M2309#26/E1: **confirmed** — ③. Stanford에서도 연구를 지속했으므로 중단했다는 진술이 반대다. E1/E3/E2 direct 및 E3 primary가 문항별로 설명된다. (scripts/research/goal-data/local/b11-v24/input.json:1158; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:845; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:839)
- candidates M2309#27/E1: **confirmed** — ⑤. 예약 최소 하루 전과 일주일 전의 차이. E1 direct 지지; E3 primary는 수치 대조로 설명되지만 E1을 유형상 금지하는 v2.4 규칙은 없다. (scripts/research/goal-data/local/b11-v24/input.json:1294; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:965; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:957)
- candidates M2309#29/E1: **confirmed** — ②. requires의 주어 자리에 동명사가 필요하다. 부정 요구 E1 후보·S축 범위 밖 지지. (scripts/research/goal-data/local/b11-v24/input.json:1579; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1199; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1187)
- disputed M2306#21/E3: **unclear** — ⑤. 특정 관점으로만 본다는 이유에서 관점 없는 객관적 시각을 역으로 끌어낸다. E1 indirect의 발문 대상/글 주장 혼동①은 가능. E3 indirect/무관 우열은 unclear. (scripts/research/goal-data/local/b11-v24/input.json:4753; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:303; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:262)
- disputed M2309#18/E3: **unclear** — ③. 시장이 고향 선수를 응원한다는 편지 용건으로 닫힌다. A의 전국 대회 관련 낱말 유인으로 요청 선지에 가는 E3 indirect는 가능한 가설이나 B 무관도 배제 못해 unclear. (scripts/research/goal-data/local/b11-v24/input.json:16; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:4; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:4)
- disputed M2309#19/E3: **unclear** — ④. 앞의 궁금함과 끝의 명시된 기쁨 대응. R6 무관·primary null은 설명 가능. A E3 indirect/B 무관의 필요성은 unclear. 최초 B의 secondary R4는 v2.4 거부·v2.5 허용이나 최종 []로 수정됨. (scripts/research/goal-data/local/b11-v24/input.json:188; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:119; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:108)
- disputed M2306#31/R5: **unclear** — ⑤. 작가 자칭·비평가 반응과 과거/현재 대조를 결합해 컴퓨터 작가 범주 소멸을 도출한다. R6 direct 지지. 중심을 반대로 잡는 R5 indirect와 과거 근거 선택의 E2 직접성은 unclear. (scripts/research/goal-data/local/b11-v24/input.json:6131; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:573; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:496)
- disputed M2309#21/E2: **unclear** — ①. 취향 수렴 우려를 반박하고 각자의 취향에 따른 음악으로 귀결한다. R6 primary 설명 가능. 다른 음악가 탐색④로 가는 근거 선택은 가능하나 E2 direct/indirect 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:511; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:342; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:331)
- disputed M2309#33/R4: **unclear** — ④. 디자이너가 예술가 같은 창작자가 됐다는 진술이 디자인과 예술의 연결을 지지한다. 과거/전환 R4를 놓쳐 보존 기관③으로 간다는 경로는 약한 가설로 남겨 unclear. (scripts/research/goal-data/local/b11-v24/input.json:2195; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1645; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1633)
- disputed M2309#34/R4: **unclear** — ①. 문학의 황야 비유와 아이의 자유로운 사고를 결합한다. R6와 경쟁 근거 E2는 지지. A/B R4 indirect/무관 경계는 확정하지 않는다. 최초 양쪽 오답③ 설명 보완만 확인. (scripts/research/goal-data/local/b11-v24/input.json:2368; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1771; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1749)
- disputed M2309#35/R4: **unclear** — ④. 재해 회복의 원인→기제→예시→다른 회복 경로에서 물순환·대기 조절 기능만 이탈한다. A는 한 문장 기능 R3로 분해해 E1 primary·outside true, B는 배열 R4 direct/primary·outside false. 두 분해 가능하여 E1/R4 갈림은 기록과 일치하나 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:2514; scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1918; scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1882)
- disputed M2309#40/E2: **unclear** — ①. 소형/대규모 대비가 규모, 집단 작업의 관리가 조율을 정한다. R5 주 수행·E1 두 칸 조건 지지. 두 근거 위치가 있다는 사실만으로 E2 direct 필수임을 확정하지 않아 A direct/B 무관은 unclear. (scripts/research/goal-data/local/b11-v24/input.json:3349; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:33; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:28)
- disputed M2309#44/E2: **unclear** — ②. Emilia가 Layla에게 말하는 지칭만 다르고 나머지는 Emilia다. B는 인접 화자 표지 누락→③을 E2 indirect로 보며 A는 같은 문장 해결로 무관. 가능 경로/필수성 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:3974; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:153; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:132)
- primary M2309#45: **unclear** — ③. Emilia의 기차 제안은 점심 뒤다. A는 두 기차 대사 중 화자 선택(E2), B는 점심 전/후 대조(E3)를 강조한다. 양쪽 direct는 지지하나 primary 단일 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:4124; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:183; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:158)
- primary M2306#28: **unclear** — ④. 날씨 취소 시 문자 공지, ③의 집합 시각은 9시가 아닌 8시다. A는 일정 줄 찾기(E2), B는 시각-활동 대조(E3). 기록한 경계와 일치하고 primary 우열 unclear. (scripts/research/goal-data/local/b11-v24/input.json:5676; scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:483; scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:418)

후보 confirmed는 지정 TASK 관련 근거를 지지한다는 뜻이고 행 전체/primary 우열 인증은 아니다. E2↔E3 세 갈림과 E1/R4 한 갈림은 기록한 경계와 맞는다. 다만 표본은 모호함의 존재를 뒷받침할 뿐 모든 미래 문항이 고유하게 모호하다거나 규칙 개선이 불가능함을 입증하지 않는다.

## 최종80행 계약 대조

모든 행 v2.4 오류0. 아래 v2.5 오류는 버전 차이를 확인하는 보조 검사이며 v2.5 합격을 요구하지 않는다. 선택 이유 원문은 *.local.json에만 두고 다음은 판정 요약이다.

|트랙|문항|primary|v2.4|v2.5|근거|
|---|---|---|---|---|---|
|A|M2309#18|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:4|
|A|M2309#19|null|통과|secondary 계약 차이|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:119|
|A|M2309#20|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:227|
|A|M2309#21|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:342|
|A|M2309#22|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:478|
|A|M2309#23|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:604|
|A|M2309#24|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:730|
|A|M2309#26|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:845|
|A|M2309#27|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:965|
|A|M2309#28|e.evidence_location|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1085|
|A|M2309#29|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1199|
|A|M2309#30|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1302|
|A|M2309#31|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1405|
|A|M2309#32|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1520|
|A|M2309#33|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1645|
|A|M2309#34|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1771|
|A|M2309#35|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:1918|
|A|M2309#36|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:2044|
|A|M2309#37|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:2149|
|A|M2309#38|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-01.out.json:2254|
|A|M2309#39|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:3|
|A|M2309#40|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:33|
|A|M2309#41|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:63|
|A|M2309#42|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:93|
|A|M2309#43|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:123|
|A|M2309#44|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:153|
|A|M2309#45|e.evidence_location|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:183|
|A|M2306#18|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:213|
|A|M2306#19|null|통과|secondary 계약 차이|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:243|
|A|M2306#20|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:273|
|A|M2306#21|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:303|
|A|M2306#22|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:333|
|A|M2306#23|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:363|
|A|M2306#24|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:393|
|A|M2306#26|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:423|
|A|M2306#27|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:453|
|A|M2306#28|e.evidence_location|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:483|
|A|M2306#29|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:513|
|A|M2306#30|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:543|
|A|M2306#31|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-A-02.out.json:573|
|B|M2309#18|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:4|
|B|M2309#19|null|통과|secondary 계약 차이|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:108|
|B|M2309#20|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:215|
|B|M2309#21|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:331|
|B|M2309#22|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:469|
|B|M2309#23|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:596|
|B|M2309#24|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:723|
|B|M2309#26|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:839|
|B|M2309#27|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:957|
|B|M2309#28|e.evidence_location|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1075|
|B|M2309#29|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1187|
|B|M2309#30|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1291|
|B|M2309#31|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1395|
|B|M2309#32|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1511|
|B|M2309#33|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1633|
|B|M2309#34|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1749|
|B|M2309#35|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:1882|
|B|M2309#36|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:2005|
|B|M2309#37|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:2109|
|B|M2309#38|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-01.out.json:2213|
|B|M2309#39|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:2|
|B|M2309#40|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:28|
|B|M2309#41|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:54|
|B|M2309#42|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:80|
|B|M2309#43|r.discourse_structure|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:106|
|B|M2309#44|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:132|
|B|M2309#45|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:158|
|B|M2306#18|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:184|
|B|M2306#19|null|통과|secondary 계약 차이|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:210|
|B|M2306#20|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:236|
|B|M2306#21|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:262|
|B|M2306#22|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:288|
|B|M2306#23|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:314|
|B|M2306#24|r.central_meaning|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:340|
|B|M2306#26|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:366|
|B|M2306#27|e.evidence_location|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:392|
|B|M2306#28|e.option_correspondence|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:418|
|B|M2306#29|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:444|
|B|M2306#30|e.task_demand|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:470|
|B|M2306#31|r.inference|통과|오류0|scripts/research/goal-data/local/b11-v24/chunk-B-02.out.json:496|

## 한계·미실행

- v2.5 실제 열람·노출 경로와 의미 판정에 미친 영향
- 원 b11 프롬프트의 금지 누락 사실 독립 입증(보고만 있음)
- 다중 direct primary의 유일한 정답·실제 학습자 오답 경로
- 학생 성취·제품 진단·NeedRank 적격성

원문·명령 출력은 지정 두 폴더의 ignored *.local.json에만 보존. 실행기는 원 소스 모듈을 지정 커밋에서 읽어 메모리 FS로 실행해 입력 쓰기를 차단했다. 실행기 작성 중 복수 정답 fixture에 기존 distractor와 추가 distractor가 함께 정답이 되어 오류가2개였던 기대값을 교정했다(검증기 결함 아님). rg 미설치·입력 worktree Git 조회 실패는 PowerShell 검색·공유 Git 객체 조회로 대체했다.

DB·입력 수정·새 AI 판정·제품 E2E·학생 측정·봉인·main/원격 통합은 미실행이며 통과가 아니다. 요청된 검증 항목은 모두 수행하여 skip_count0. Git add/commit 시도 및 evidence/submit 출력은 finish.local.json에 보존한다.
