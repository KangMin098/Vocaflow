# 2026-34 수용 5기능의 제품 경로 이관 명세 v1.0

T-0136 R2. **DESIGN_ONLY / NOT_IMPLEMENTED / AWAITING_INDEPENDENT_REVIEW**. `/csat/item/[slug]`의 정답 공개 후 분석만 대상이다. F01·F03·F04·F05·F07의 격리 상호작용 설계를 제품에 이관하기 위한 명세이며 S1 전체 수용, F08 최종 선정, S2 전체 착수, main 통합 승인이 아니다. 실제 코드 관측 파일·SHA는 [CODE_SCOPE.json](./CODE_SCOPE.json)에 고정한다.

## 현재 코드와 변경 책임

| 범위 | 현재 관측 | 이관 설계와 필요한 변경 |
|---|---|---|
| `apps/web/src/app/(app)/csat/item/[slug]/page.tsx` | 공개 게이트, inquiry/meaning 조회, 서버 pair 투영, 두 번째 공개 확인 후 Theater props 전달. `check=1`은 확인 활동 전용. | 서버에서 콘텐츠 승인/원문 해시/자료 상태를 결속한 읽기 전용 분석 DTO를 만든다. 게이트 이전 HTML/RSC/API/ARIA/대본에 정답·해설을 넣지 않는다. 기존 두 번째 공개 확인과 check 전용 분기 보존. 신규 client fetch로 우회하지 않는다. |
| `components/csat/theater/InquiryV3Panels.tsx` | 발문 조건, 선택지 truth/fit, 설계 근거를 이미 표시한다. | F01은 발문·한정어별 등록 anchor를 선택 가능하게 개선. F04는 한 선지 표시를 ①/③ 명제 동시 비교와 두 판단축으로 대체. 데이터 enum을 새로 추정하지 않는다. F05는 관측/공식자료/설계 가설과 적용 조건/한계를 구분한다. |
| `components/csat/theater/AnalysisTheater.tsx` | 장면·meaning bridge·판단 패널이 연결됨. `liveScene` effect에 cue 기반 `selectScene`, rail 자동 스크롤이 존재한다. | F03의 양방향 등록 관계 인덱스와 수동 장면 상태를 소유한다. F07에서는 cue→장면 자동 선택 및 자동 스크롤 경로를 제거/분리한다. 명시적 사용자 복귀/선택에 따른 이동은 유지한다. focus/scroll 변경은 사용자 명령 ID와 결속한다. |
| `components/csat/lecture/LectureStage.tsx` | 실제 LecturePlayer와 TTS adapter, 권한 확인 뒤 대본 로딩. 활성 cue의 `scrollIntoView`가 존재한다. | 재생 상태와 viewer 상태를 분리하고 자동 cue 스크롤을 억제한다. READ/TTS/SILENT/OFF는 매체 상태만 제어. 오류/취소/재시도는 viewer를 바꾸지 않는다. item 변경 시 player key 초기화는 보존한다. |
| `lib/csat/meaning-support/align.ts` | PDF loading/missing/unreadable/ready, 텍스트 pending/no_source/mismatch/ok 및 span 정렬이 있다. | 상태를 그대로 전달하고 mismatch 시 highlight/관계 활성화를 차단한다. 기존 cyrb53 정렬 지문은 보안 SHA/콘텐츠 승인 해시를 대신하지 않는다. 실제 PDF SHA와 분석 revision 결속은 별도 필드로 설계한다. |
| `lib/csat/map-return.ts`, `lib/csat/system-learning.ts` | 지도 복귀 query 검증, 준비된 활동과 요약·기록 분리가 있다. | 기존 허용 query를 사용해 왕복한다. 임의 return URL/자유서술 자동 채점/탐색=숙달 변환을 추가하지 않는다. |

위 경로는 모두 `apps/web/src/` 기준(첫 행 제외)이다. 제품 구현 시 각 하위 지시와 기존 테스트를 다시 확인해야 한다. 이번에 이 파일들을 수정하지 않았다.

## 데이터와 콘텐츠 확보 상태

| 기능 | 필요한 데이터 / 연결 | 확보·승인 상태와 부족 조건 |
|---|---|---|
| F01 IMPROVE | 공식 발문, Ideally/If/cannot be, 문장/구절 anchor 및 적용 범위 | 공식 PDF/정답표 해시와 저장 발문·조건 대조 완료. 격리 인용/조건 projection 존재. 실제 PDF span 정렬·권한은 미검증. 세 표현을 같은 종류의 독립 조건으로 단순화하지 않고 조건절·이상적 목표·불가능 판단의 관계를 설명해야 한다. |
| F03 IMPROVE | 원문→meaning→등록 관계→선지, 역방향 인덱스; item/revision/source SHA | 보존 v3의 meaning_ids/sentences와 서버 pair projection 존재. schema-ready는 내용 승인 아님. 등록 없는 조합의 관계를 LLM/근접성으로 생성하지 않는다. |
| F04 REPLACE | ①/③ 완성 명제, truth/fit/결정 근거, ② unknown/fails | 저장 한국어 명제는 기존 decisive 안의 인용이며 공식 영어 선지 전문이 아님. 공식 정답③. ① false/fails, ③ true/satisfies, ② unknown/fails의 축을 보존한다. 최종 콘텐츠 검수 없이 schema 통과로 승격 금지. |
| F05 IMPROVE | 출제 원리·조건·한계·반례의 실제 basis와 연결 근거 | 보존 설계 근거 존재, 관측/공식/가설 구별 필요. 적용 조건 비교는 저장 자료 범위만. 없는 원문·선지·비교 짝 생성 금지. 학습 효과 미검증. |
| F07 IMPROVE | 원본 cue ID/텍스트/scene 참조/모드, 승인된 script revision, player 상태 | 기존 3문항 37cue 원본 보존. 별도 6개 수정 후보는 미승인. 기능 수용은 대본 내용 승인 아님. 실제 TTS·정상 인증 API는 미검증. cue 참조 부재 시 현재 장면을 유지하고 등록 없음 상태 표시. |

초기 DTO 명세: `itemId, analysisRevision, sourceSha256, approval{status,version,payloadSha256}, revealScope, task, qualifiers[], meaningUnits[], registeredRelations[], choices[], principles[], lectureRef, paperState, returnContext`. 각 관계는 출발/도착 ID·basis·승인 상태를 가진다. 콘텐츠 승인이 없는 단위는 learner DTO에서 설명·관계·대본까지 제거/보류하고 검토 전용 DTO와 분리한다. 클라이언트의 query 토글로 권한을 부여하지 않는다. DTO 타입/필드는 제안이며 새 API나 DB가 구현되었다는 뜻이 아니다.

## 공개·상태·탐색 계약

초기 범위는 **OFFICIAL_ANSWER** 공개 후 분석이다. 공개 전/권한 없음/held에는 해설·정답·대본·ARIA 설명·client bootstrap을 전달하지 않는다. 미래 SOURCE_ONLY는 별도 서버 필터와 검증 없이는 활성화하지 않는다. 정상 로그인과 RLS 수용은 서버 정적 검토와 별개이다.

상태는 구분한다: `REGISTERED`는 결속된 승인 관계, `UNREGISTERED`는 관계 미등록, `HELD_CONTENT_APPROVAL`은 존재하지만 승인 보류, `SOURCE_MISMATCH`는 revision/SHA 불일치, `MISSING`은 원자료 부재, `FORBIDDEN`은 권한 부족. 보류를 미등록으로 위장하거나 불일치에 근접 highlight를 붙이지 않는다. PDF loading은 대기, missing/unreadable은 원문 사용 불가, mismatch는 연결 비활성으로 표시한다. 재시도는 공개·권한·SHA를 다시 확인한다. 대체 원문을 생성하지 않는다.

사용자가 조건→원문→선지→근거를 왕복할 때 item/revision·선택·근거·장면·PDF 페이지/확대/scroll·focus를 동일 item 범위에서 보존한다. 강의 재생은 이 상태를 덮어쓰지 않는다. 수동 장면 선택과 강의 cue 선택은 별도 명령이다. 장면 선택만으로 정답 제출/강의 재생/숙달을 유발하지 않는다. 관계 없음/승인 보류에는 이유가 있는 비활성 동작과 원문 직접 탐색 경로를 제공한다.

지도에서 들어온 경우 기존 `parseMapReturn`/허용 query와 지도 anchor를 유지한다. 현 item page의 복귀는 `/csat?from=item&item=<slug>`에 검증된 문맥을 붙이며, `backHref`는 허용된 browseReturn 또는 `/csat`이다. `task/ws/step/map_task`와 학습자 Workspace의 `map_ws`(UUID), `map_plan/map_goal`(양의 정수)을 구분한다. `map_ws/map_plan/map_goal`은 복귀 후 동일 문맥 여부 비교용이며 다른 사용자 자료 조회 키가 아니다. 실제 제출 응답이 없는 탐색에는 `map_attempt`를 생성하지 않는다. `map_item/map_attempt`를 기출 탐색에서 창작 수행으로 위조하지 않는다. 어휘용 `MAP_HOME_HREF`를 item 복귀 주소로 임의 교체하지 않는다. Workspace 왕복은 이 계약을 보존하며, 별도 Workspace 진입 화면과의 통합 실행은 미검증으로 둔다. 같은 item 복귀는 분석 문맥 복원, 다른 item/버전 복귀는 오래된 연결 폐기·안내. 지도/Workspace 복귀는 학습 완료 이벤트가 아니다.

해설 후 확인 활동은 기존 `check=1` 분기를 보존하고 분석을 보기 전 확인 활동으로 오인하지 않게 표시한다. 자기 설명·선택·원문 왕복은 활동 로그이며 숙달 근거와 분리한다. 준비되지 않은 확인 활동은 준비 중으로 두고 가짜 문항/자유서술 자동 채점/단순 클릭 합격을 만들지 않는다.

## 구현 순서와 수용 테스트(이번에는 미실행)

| 순서 | 제한된 변경 | 필수 수용 테스트 |
|---|---|---|
| 1 | 독립 설계 검토 후 서버 DTO·공개/승인·SHA 상태 정의 | held/권한 거부/공개 변경 race에서 HTML/RSC/API/ARIA/대본 누출 0, stale SHA 차단, schema와 내용 승인 분리. 정상 인증·RLS 실기 별도. |
| 2 F01 | 기존 Task 개선 | 발문·Ideally·If·cannot be를 선택하면 등록된 실제 구절로 이동, 적용 범위 보존, 없는 anchor는 미등록. |
| 3 F03 | 양방향 인덱스·수동 상태 | 등록 근거↔선지 왕복 및 focus 복귀, 미등록 추정 생성 0, PDF 누락/권한/해시 불일치 상태 각각 검증. |
| 4 F04 | 명제 비교 표시 대체 | ①/③을 같은 조건으로 대조, 공식 선지 전문과 구별, truth/fit 별개, ② unknown 보존. 22③ true/fails 회귀. |
| 5 F05 | 원리·한계 연결 개선 | 실제 basis 라벨·근거 연결, 적용 조건과 반례 한계 구별, 자료 부재에서 생성 0. 38 앞뒤/기존 연결 보존 검토 및 미승인 C1 학습자 노출 0. |
| 6 F07 | viewer/player 상태 분리 | 재생·cue진행·일시정지·계속·오류·OFF 중 직접 장면/scroll/focus 유지, READ/SILENT 분리, 실제 TTS 취소, item 교체 초기화. |
| 7 | 지도/Workspace/확인 활동 왕복 및 접근성 | 허용 복귀 query, 문맥 복원/버전 무효화, check 전용 화면 누출 0, 활동≠숙달, 1280/1440·확대·키보드·스크린리더·색 대비. |

각 단계는 별도 승인된 제품 구현 범위에서만 실행하며, 기존 경로로 되돌릴 수 있는 표시 전환과 불일치 시 fail-closed를 설계한다. F08은 두 작업면에 동일 기능 계약을 적용할 수 있게 유지하고 레이아웃 종속 데이터 모델을 만들지 않는다. 실제 PDF·콘텐츠 승인·인증/RLS·접근성·TTS·학습 효과와 F02/F06/F09/F10의 BLOCKED_EVIDENCE를 이번 명세로 해소했다고 기록하지 않는다.
