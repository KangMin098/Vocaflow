# Learning Modules

> LCP Story D5 I01/I02(T-0191, 2026-10-27): Story 단어 창에서 사전이 확정한 낱말만 「내 단어장에 담기」로 명시 저장한다(서버가 본문 · 사전을 다시 확인 · text_id null · manual · 기존 행/FSRS 보존). 담은 뒤 「내 단어장에서 보기」는 `story_release` · `story_unit` 두 값만 실어 단어장 위 작은 복귀 줄로 같은 단위에 돌아온다(지도 복귀와 섞이면 중립 · 영구 출처 없음). `WordVaultViewerGate`는 서버 주인과 브라우저 신원이 같다고 확인한 뒤 전체 개인 화면을 보여 주며 계정 전환·확인 실패·BFCache 재확인 때 목록·칩·듣기·복귀 줄을 함께 숨긴다. 저장의 신원·접근 거절은 기존 Story 세션 거부 전이로 연결한다. [D5 §12.2](./lcp-story/LCP_D5_INTEGRATION.md).
>
> LCP Story D4(T-0190, 2026-10-27): 서가 로그인은 고른 판본 입구로 돌아오고, 입구는 첫 장면 첫 문장 · 편집 목표 · 접힌 주의 → 시작 → 선택 펼침(첫 장면 전체 · 원천 · 도움) 순서다. 단위 화면은 단위 제목이 h1 이고 도구 줄에 결속된 맥락 설명 진입과 단어 창의 Stories 전용 비모달 초점 · 44px 대체 단추가 있다. 이어 읽기는 「마지막으로 연 단위」, 완료 뒤 행동은 실제 서가 공급에 맞춰 본문 한 곳에만 둔다. 실제 사람 효과는 미검증. [D4 구현](./lcp-story/D4_IMPLEMENTATION.md).
>
> LCP Story D3 W2(T-0189, 2026-10-27): 기존 독서 본문 뒤 `StoryContextNotes`가 단위별 시대적 맥락을 기본 접힌 native details로 제공한다. 현재 C01 R2 u03 두 항목/u04 한 항목이며 다른 단위는 무표시다. 실제 dev 원장20261026235109의 인증 읽기 API와 연결했고, 없음/미적용·오류/결속 불일치를 구분한다. 인증 확인·계정 전환 때 본문과 함께 숨기며 위치·완료 저장은 바꾸지 않는다. 352단위/40격리 브라우저와 정상 Auth A1440/B1280 실제 화면을 구분해 수용했다. B2는 편집 목표, 실제 사람 적합성·효과는 미검증이다. [D3 후속](./lcp-story/D3_FOLLOWUP.md).

2026-10-28 기사 연습 실패 뒤 읽던 글 복귀(T-0206): `loadArticlePractice` 는 본인 글 · 현재 판본 · 계정 관문을 통과한 뒤 후보 조회만 실패했을 때(not_installed · query_failed · no_items) 지금 계정을 다시 확인하고 서버가 찾은 본인 글 id(`returnTextId`)를 함께 돌려준다. `/practice/article/[articleId]` 는 그때만 사유 문구 아래 「읽던 글로 돌아가기」(/text/<id>)를 더한다. 관문 실패 · 계정 미확인은 기존 글 목록만이며 주소 · referer 로 추정하지 않는다. 채점 · 기록 · DB 변경 없음.
2026-10-28 의미 근거 견주기 관계 판단(T-0205): `MeaningEvidence` 는 견줄 선택지와 근거 문장을 모두 고른 견주기 결과 안에서만 「이 문장과 두 선택지의 관계 · 내 판단」(내 답 · 견준 선택지 · 둘 다 · 어느 쪽도 아님 · 아직 어려움) 하나를 고르고 고치게 한다. 학습자 자기 판단이며 채점·정답 표시·기록·이벤트가 없고(컴포넌트 메모리뿐), 대상·문장을 다르게 바꾸면 판단만 비운다. 고르지 않아도 다음·건너뛰기·완료는 그대로다.
2026-10-23 학습 정리: SystemLearningSummary는 근거 추적/조건 비교/다음 활동 탐색면이다. 선택지 선택에 따라 검수 해설 하나와 연결 문장을 함께 강조하며, 적용 조건/반례 선택에 따라 원리 분기와 경계 표시가 바뀐다. AnalysisTheater는 v3 문장 수가 현재 지도와 일치할 때만 원문 근거 연결을 제공한다. 탐색 이벤트에는 행동 종류·숫자 인덱스만 보내며 탐색 상태를 숙달·학습 기록으로 저장하지 않는다. 키보드 조작·읽기 전용 과거 기록·준비된 확인 과제 이동을 보존한다.
2026-10-23 목표 계획·평가 통합 후보: `goalLearning`이 현재 목표/PLAN 버전·TASK 근거·시간·일정·시험 관찰·수정 이유를 한 번 공급한다. 기존 `replanOf`·`planDrift`·`scheduleChanges`와 PLAN 재확정을 재사용한다. 재풀이/기존 노출·선후 미확인은 독립 후속 시험에서 제외하고, 점수 기준 충족과 최종 목표 미확인을 구분한다. 화면은 목표일·주간 계획·다음 점검 제안일을 표시한다. [독립 수용·미적용 SQL](csat-learner/GOAL_ACHIEVEMENT_ACCEPTANCE.md).

2026-10-23 목표 시간 배분(공유 DB 승인 대기): GoalEditor의 주간·선택 요일·단위 시간과 GoalSchedule의 현재 TASK PLAN 기반 오늘·주간·목표일까지 배분 제안을 추가했다. 기존 단계·수량·실행 링크·목표 변경 재확정 관문을 재사용하고 시간·자료·조회·관련성 제약을 미배정으로 구분한다. 달력은 자동 확정·전체 필요 학습량·목표 달성률이 아니다. 예산 저장 SQL은 미적용이며 설치 전503을 저장 성공으로 표시하지 않는다. [수용 범위](csat-learner/GOAL_ACHIEVEMENT.md).

2026-10-23 TASK 상태 표시: taskInspector는 AsIs의 analysis_pending/insufficient/unmeasured를 각각 시험 분석 대기/관찰 근거 부족/확인 기록 없음으로 구분한다. NEED_V62_LABEL의 CONFIRM은 다음 활동 「직접 확인 필요」다. 원본 학습 판정·기록·완료 조건은 그대로이며 unmeasurable은 플랫폼 측정 도구 준비 중으로 표시한다. 여러 열을 건너는 관계선은 빈 행으로 우회하고 활성선 대비·다른 카드 교차를 격리 검증한다.

2026-10-23 학습지도 TASK: UnifiedLearningMap은 카드 주변12px의 포인터·키보드 포커스를 임시 연결 미리보기로 처리한다. 클릭 선택·Workspace·복귀 주소와 독립적이며 이탈하면 기존 연결을 복원한다. 개요 카드는 높이46px·최대206px이고 상세는 기존 단일 창을 유지한다.

2026-10-23 CSAT 공통 메뉴: CsatRail이 공간/탐구·개인 자료5종·첫3문항·기출 찾기를 모든 화면에 동일하게 제공한다. PERSONAL_LINKS가 개인 메뉴의 단일 출처이고 활성 항목은 RailPlace로 정한다. HomeLanding의 children 메뉴 주입과 별도 Finder 인스턴스는 제거했다. 홈/탐구/기록/진단 격리 화면에서 접힘 유지·폭·Finder 복귀를 검증하며 실제 DB 조회/학습 쓰기는 실행하지 않는다.

2026-10-22 CSAT 홈 구성: HomeLanding 첫 진입은 패턴 배너 아래 Workspace 탭의 목록만 표시한다. 학습지도 탭으로 목표/기록/지도를 전환하며 기록·복습·진단·공식·연습·기출 찾기는 왼쪽 메뉴로 이동했다. 학습 복귀 문맥이 있으면 지도 탭에서 시작한다. MapScreen의 workspaceFirst 표시 옵션은 UnifiedLearningMap의 같은 상태/행/상세를 재사용하며 다른 진입의 지도 우선 순서는 유지한다. 지도 아이콘의 노드 이동·행 클릭 상세·복귀 문맥·실행 링크는 동일하다.

2026-10-22 CSAT 팝업·설명: PC 중앙 팝업은 참조680×760·머리/바닥56 공통 치수를 사용한다. 목표 편집도 MapDialog에 통합하며 저장/API 계약은 유지한다. Workspace는 단계 아이콘·자료 수 카드·접힌 안내, 홈 첫 시작은 계획→자료→확인 도식으로 표시한다.

2026-10-22 CSAT 지도 상세: 노드 한 번 클릭으로 LearningDetailDialog를 열고 개요·근거/학습 경로·학습계획을 같은 창 안에서 전환한다. 연결 TASK/Workspace 전환과 단계 근거 펼치기도 창을 겹치지 않는다. WorkspaceList는 리스트형으로 고정하며(보드 전환 없음) 지도 강조는 별도 지도 아이콘이다. 기존 계획 저장·활동 복귀·판정 출처는 유지한다. 디자인 정본은 [DESIGN.md](../DESIGN.md).

도서 큐의 초기 상태 조회와 폴링은 관리자 GET `/api/admin/library/curation-jobs?kind=voice|quiz|review`를 사용한다. 기존 세션/RLS·큐 조회 함수·응답 형식을 유지하며, 읽기 Server Action과 URL 선택이 겹쳐 목록·상세가 재마운트되던 경합을 제거한다. 적재·삭제 등 변경 액션은 그대로다.

관리자 사용성 점검(2026-10-20): 도서 검수 제목·상태 표시·어휘 필터 이름·VRL 구간 링크와 중첩 Dialog의 포커스/Back/스크롤 복원을 보완했다. 작업 중 닫기 거부는 `closeDisabled`/`canClose`로 이력까지 보존한다. 지도 셀과 진단 팝업 컨트롤은 44px, 선택 체크박스는 그림 대신 레이블의 클릭 영역을 보장한다. 만화 실행 시각은 KST 고정 표시를 사용한다. 관리자 경로·학습자 판정 규칙·DB 계약은 바꾸지 않는다. [범위와 실제 실행 결과](admin-restructure/usability-audit.md).

관리자 주문 계보(2026-10-20): `AdminWorkspaceSupply`는 인증된 행위자와 대상 사용자·Workspace로 서버 RPC를 조회하며 `ProductOrderLineageView`가 현재/철회/이전 판/개인 변경 및 미설치/실패/빈 목록을 구분한다. 이 패널은 계획 연결량만 표시하며 학습자 수요·생산 진척·개인 납품 판정을 바꾸지 않는다. [계약과 적용 대기](admin-restructure/product-order-lineage.md).

도서 검수 이동(2026-10-20): `BookDetailModal`은 닫기 전에 검색·선택 복귀 주소를 보존하고 공용 `Dialog`의 선택적 `afterUnwindRef`로 오버레이 이력을 걷은 뒤 이동한다. 기존 `useCloseOnBack` 계약을 재사용한다.

적용 추적의 보류 관문(2026-10-20): 과제와 audience의 단일·복수 대상 전체를 검사한다. 수행 메타와 버전만 먼저 읽고 허용된 시도·문항의 정오를 뒤에 읽으며, 과거 보류 수행이 있으면 결속이 불명인 trial·효과 결과도 가린다. 미상 문항의 정오는 읽지 않고 조회·판정 실패를 0건으로 바꾸지 않는다.

관리자 후속(2026-10-20): `AdminLearnerActivity`는 문항별 Reveal Gate 뒤 허용한 시도의 정오와 정확한 `workspace_delivery_attempt` 결속, 보류 판정을 거친 저장 진단을 읽는다. 전부 보류된 페이지도 원본 커서로 이동하며 문항 식별자가 없는 기록의 정오는 조회하지 않는다. `AdminWorkspaceSupply`는 기존 개인 공급 reader를 재사용하며 주문·공급 없음으로 수요 없음까지 단정하지 않는다. 적용 추적은 저장 적용 버전·비합성 표시·trial과 전역 원리 효과 상태를 구분하며 학습자 판정 엔진을 바꾸지 않는다. [최종 인계](admin-restructure/final-delivery.md).

관리자 v2.1(2026-10-19): `AdminWorkInbox`는 기존 실집계의 처리 대상 링크를 제공한다. `AdminItemHandoff`는 기출의 기존 지문 설계 주석·근거 검수·등록 적용을 잇고, `AdminLearnerPlans`는 확인한 동일 사용자 ID의 저장 목표·Workspace·TASK 계획을 읽는다. 공개 학습 흐름과 학습자 개인 분석은 바꾸지 않는다. [지원 범위·미연결 단계](admin-restructure/v21-delivery.md).
> PC 학습 환경(2026-10-21): 연습 선택은 모듈 소품이 아닌 실제 인출 활동으로 색을 구분한다(Build=직접 생성). 플래시카드 긴 해설·글자 확대의 잘림, 숨긴 앞/뒷면 포커스, 그림 확대의 카드 뒤집힘과 포커스 복귀를 보완했다. 이미지·힌트·채점/FSRS 데이터의 내용은 바꾸지 않았다. 실제 부품 격리와 정상 계정/사람 수용은 [감사§0-30](design/learner-tines-audit.md)에서 구분한다.

PC 학습자 모달의 키 입력은 모달이 소유한다. `learnerModalOwnsKeyboard()`를 Flashcard 공통 키보드 훅과 별도 세션 키 핸들러에서 확인해 모달 뒤의 평가/종료를 차단하며 닫은 뒤 기존 단축키를 재개한다. 평가 값/FSRS 알고리즘은 변경하지 않았다.

> PC 공개 영상 보완(2026-10-21): `ComponentVideo`의 외부 포스터 실패를 내용별 자체 안내 그림으로 대체하며, 재생 오류는 재시도/포커스와 구분된 안내를 낸다. PC 학습자 `video_started`는 재생 요청만으로 기록하지 않고 실제 `playing`에서 한 번 기록한다. 정상 원본 영상 전달과 전체 학습 세션 수용은 미검증이다. [감사 §0-29](design/learner-tines-audit.md).

> PC 콘텐츠/활동 색 후속(2026-10-20): 같은 학습 활동의 입구·안내·팝업 색을 묶고 반복 작업면은 중립/옅은 면으로 낮췄다. WordVault 학습/복습은 재인, 교재 문항은 맥락/추론으로 표시하되 부모 서가의 자료색은 보존한다. 게임 트랙 분류는 순수 공유 모듈로 이동해 카탈로그/색 역할이 함께 사용한다. 분류 값·학습 실행·채점·FSRS는 변경하지 않았다. 실제/격리 범위는 [감사 §0-28](design/learner-tines-audit.md).

> PC 전수 색 역할 후속(2026-10-20): 91경로에 기능별 7계열 제목/콘텐츠 면을 배정하고 공통 Dialog 제목까지 이어지게 했다. 목록/상세/세션은 같은 기능의 역할을 유지하며, 실제 게임 보드의 색·학습/채점/FSRS·기억4색은 보존한다. 실제 익명10화면40조건과 공통 스타일/부품143조건을 전체 정상 계정 수용과 구분한다. [감사 §0-27](design/learner-tines-audit.md).

> PC 색 역할 재디자인(2026-10-20): 허브·서가·성장·단어장 콘텐츠 면에 대응 잉크를 적용하고, 읽기/보조 문구는 중립색으로 분리했다. 3B/작은 화면 색과 FSRS/채점·기억4색은 유지한다. 보호 화면의 실제 정상 계정 재검증과 격리 부품 검증은 [감사 §0-26](design/learner-tines-audit.md)에서 구분한다.

> PC 최종 보완(2026-10-20): 실제 게임19종의 시작 안내76/76·DCP 문항 없는 복귀4/4를 확인했으며 활성 학습/점수 수용과 구분한다. 내 라이브러리는 조회 실패/빈 상태를 구분하고 별도 교재 슬롯을 유지한다. 개인 읽기 인사이트의 고정 예시 인용/기억 수치는 제거했으며 PC 사전 안내는 학습자 호출에만 적용한다. 인증 글 상세 GET가 검증 DB에42행을 추가한 사고와 복구 승인 대기·강화한 캡처 가드는 [감사 §0-25](design/learner-tines-audit.md)에 기록했다. 이 회차의 DB 무변경 주장은 하지 않는다.

> PC 읽기 팝업 후속(2026-10-20): 타이포/목차 Esc 포커스 복귀·인사이트 Tab 순환/복귀와 스크롤 복원, 헤더/목차 PC44px를 보완했다. 실제 컴포넌트 격리16/16·실제3000 대표4 렌더16/상호작용18이며 개인 본문 통합과 학습 데이터 검증은 별도다. [감사 §0-24](design/learner-tines-audit.md).

> PC 잔여 개선(2026-10-20): Game Lab·Dispatches·설정의 반복 삽화를 기능별 장면으로 분리했다. 공개 도서 미리보기 목차/사전 조작은 PC 44px로 보완하고, 사전 연결 실패를 미등재로 안내하던 문제는 실패/재시도로 구분했다. 학습 진도·본문·점수·FSRS는 변경하지 않았다. 실제 3000 렌더12/12·정보/목차8/8·실패 회귀4/4와 미검증 경계는 [감사 §0-23](design/learner-tines-audit.md)에 기록했다.

> PC 표현 보완(2026-10-20): 계획·주간 리포트·진단 이력의 공통 성장 그림을 주간 보드/분석 도해/변화 경로로 분리했다. 데이터·저장·학습 동작은 유지하며, 3000의 기존 개인 관리 after 검증은 감사 §0-21에 기록했다. 상단 Read 메뉴의 Esc 포커스 복귀와 메뉴 소품도 보완했다.

> PC 학습자 S20/S21(2026-10-20): 허브의 상태/추천 배치·실제 표지 실패 표시, 성장 기록의 첫 복습 전 삽화를 보완했다. 설정/계획/리포트/진단 이력의 PC 표현도 수정했으나 after 검증 전이다. 저장·학습·채점·FSRS 변경 없음. [실제 검증과 남은 범위](design/learner-tines-audit.md).

> Factory I1 독립 검증(2026-10-17, DB 미적용): 학습지도 Inspector는 전체 canonical 수요별 공급을 선택해 PLAN 간 집계를 분리한다. 역사적 주문 종결과 현재 유효 공급은 별도이며 supersede·권리/공개 철회는 부족분으로 복귀한다. [독립 수용 기록](./research/factory-i1-280-independent/ACCEPTANCE.md).

> 9개 학습 모듈 + 베타. 각 모듈의 목적·라우트·인지 깊이·데이터 모델. 작성 시점: 2026-06-08 (v06.34).
>
> 학습 모델 9계층 (L0~L7) 자세한 설계는 [LEARNING_MODEL.md](./LEARNING_MODEL.md) 참조.

---

## 모듈 카탈로그

공개 상세(S19, 2026-10-20): 도서/아티클 미리보기·교재 상세/연습 안내·랭킹의 PC 표현을 정리하고 서가/스텁 실제 착지를 재확인했다. 복원 만화 공개 호출부만 `publicPresentation`으로 원본 그림 실패/재시도·복구 포커스 처리를 선택한다. 원본 URL·말풍선/TTS·뜻 조회·등록/공유/채점/순위 계산은 유지한다. 실제 화면/상태36조건·조회/키보드12조건과 격리 이미지 복구2조건·변경 구획 axe24조건을 구분해 감사 §0-19에 기록했다. 로그인 뒤 문항·개인화 랭킹·원본 만화 품질은 미검증이다.

공개 진입(S18, 2026-10-20): 홈·요금·법률·영상 목록/상세·사이트맵·잘못된 초대 링크의 PC 구성과 탐색을 정리했다. 영상 상세/초대의 중복 main을 없애고 법률 목차에 현재 위치/44px/focus를 연결했다. 사이트맵은 `sidebar-config` 목록과 아이콘을 그대로 사용한다. 실제 영상/자막·요금 사실·법률 문구·가입/학급 참여 로직은 유지한다. 실제 공개9주소36렌더·14조회/키보드 조건·변경 구획 axe32조건은 감사 §0-18에 기록한다. 실제 영상 재생과 유효 학급 참여는 미검증이다.

인증 진입(S17, 2026-10-20): 로그인/가입/재설정/메일 확인의 PC 공통 머리·폼을 열린 두 열과 자체 계정 장면으로 정리했다. 로그인↔가입 링크는 `loginUrlWithReturn`·`resolveReturnTo`로 원래 목적지를 보존한다. 인증/권한·가입/발송/변경 처리와 검증 규칙은 유지한다. 실제 폼24조건·입력/안내18조건과 계정 쓰기0을 감사 §0-17에 기록했다. 새 비밀번호 화면의 URL 표식 렌더를 복구 인증 완료로 세지 않는다.

Game Lab 목록(S16, 2026-10-19): `/arcade`의 목차·추천·코스·19게임 링크와 자료 스코프는 유지하며 PC 지면/마크/설명 배치를 개선했다. `catalogPresentation`은 허브에서만 설명 규칙 접기·넓은 보드 그림/코스 아이콘을 선택한다. 실제 세션/점수/기록과 기본 브리핑 호출부는 유지한다. 공개1라우트4상태·16렌더조건과12조회/연습 시나리오는 감사 §0-16에 기록했다. 실제 플레이·랭킹·개인화는 이번 검증 밖이다.

공개 지문 진단(S15, 2026-10-19): `PublicFitClient`와 `LevelProfilePanel`의 기존 분석/공유/수업 한 장 동작을 유지하며, `/fit`·`/fit/s/[payload]`의 PC 머리·입력/판정 배치·단어 행을 정리했다. 실제 서버 예시와 읽기 전용 분석 API, 공유 링크 재진입을 검사했다. 로그인 `/diagnostic`·`/plan`은 정상 화면 미검증으로 남기며 공개 진단 결과로 대체하지 않는다. 감사 §0-15.

만화 진입면(S14, 2026-10-19): Book Comics·Vintage Comics·복원 시리즈·도서 만화 상세에 PC 자료 유형 레일·열린 제목·자체 장면을 적용했다. 표지와 미리보기 원본 주소는 유지하며 외부 실패 시 제목/아이콘/안내를 표시한다. `ComicFormatChoice`의 추천·등록·원문 연결과 복원 호/진도 계산은 변경하지 않았다. 실제 공개3라우트 패턴·4주소/상태와 읽기 전용 상호작용은 학습자 감사 §0-14에 기록한다.

인접 공개 서가(S13, 2026-10-19): `LibraryBrowseFrame`이 Dispatches·Decks·Textbooks의 PC 자료 유형 레일과 본문 폭을 공유하고 각 서가의 검색·분류·주소 상태는 유지한다. `ShelfScreen`은 시리즈 정본에서 제목을 표시하며, `ComponentVideo.posterFallback`은 지정한 교재 호출부에서 외부 포스터 실패를 로컬 장면으로 대체한다. 단어장 캐러셀도 외부 에디션 표지 실패 시 기존 도판을 사용한다. 학습·구독·추천·재고 계산은 변경하지 않았다. [검증](design/learner-tines-audit.md#0-13-승인-스타일의-공개-서가-확장2026-10-19).

학습자 삽화 재조정(2026-10-19): 허브·서가·성장·단어장 장면은 v4가 현행이다. 책·카드·시간·듣기라는 기존 주제를 사물과 기능 디테일로 명확히 표현했다. 학습 동작·기억 계산·데이터는 유지한다. [검증 범위](design/learner-tines-audit.md#0-12-색감과-삽화-표현-재조정2026-10-19).

학습자 장면 색감 정정(2026-10-19): 허브·서가·성장·단어장은 자체 장면 v3를 사용한다. 기존 v2의 갈색·세이지 대신 Tines 참조에서 측정한 라벤더·민트·주황·분홍을 적용했으며 학습 동작·기억 계산·데이터는 유지한다. [검증 범위](design/learner-tines-audit.md#0-11-tines-참조-팔레트로-장면-색상-교정2026-10-19).

색·그림 재판정 후속(2026-10-19): 대표 4화면의 큰 단색 머리를 열고 `scene-library/vault/growth/journey-v2` 자체 장면을 사용한다. 서가는 표지 중심 추천 목록, 단어장·성장·필터는 역할별 아이콘, 허브는 짧은 PC 문구·분산된 장면·옅은 구획을 쓴다. `AreaHero`에 PC 장면·부제 선택 속성을 추가했다. 학습 로직 변경은 없으며 현재 인증 만료·네트워크 제한으로 새 정상 화면/상호작용 검증은 미완료다([감사 §0-10](design/learner-tines-audit.md)).

PC 학습자 본문 재배치(2026-10-19): `/library/books`의 검색·분류를 머리 왼쪽으로 옮기고 `FeaturedBookCard`가 기존 상세 시트를 연다. `/hub`는 열린 레일·표, `/dashboard`는 기억·최근 기록의 좌우 구획, `/wordvault`는 격자 머리·열린 기억 분포·자료 목록으로 배치한다. `ReferenceBookImage`는 허브 표와 단어장 추천의 외부 표지가 실패하면 PC에서 서명을 표시한다. 같은 데이터·쿼리·기억 계산·학습 진입 경로를 유지한다. 실제 검증 범위는 [학습자 감사 §0-9](design/learner-tines-audit.md#0-9-codex-본문-재구성2026-10-19)다.

학습지도 v6.2 T4(2026-10-16): `EvidenceClaims`는 TASK 팝업·근거 드로어·Workspace 모달이 공유하는 `evidenceView`를 표시한다. 첫 시도는 DB 원장 ID로 연결하고, 원장 정오·독립 관찰·주석 현재성을 구별한다. 조회 실패는 0건과 구분하며, 현재 원문 기준의 전이 운영 집계와 지연·효과 미확정을 별도로 설명한다. 기존 skillDiagnosis/lifecycle 정책은 변경하지 않는다.

기출 문제지 표시(2026-10-05): 브라우저 `reflowExam`은 밑줄의 끝·도표를 보존하지 못하는 지칭·어법·어휘·함축 의미·도표 7유형에 `needsOriginal`을 기록하고 기존 원본 크롭을 만든다. 문항 극장은 원본을 표시하고, 세션 예측·분석 읽기는 원본을 문자 분석과 함께 표시한다. 추출기 5판은 이전 캐시를 무효화한다. 원본·크롭은 서버에 전송하거나 영구 저장하지 않으며 탭 메모리의 크롭이 없으면 PDF를 다시 놓아야 한다.

<!-- csat-sources-workspace:start -->
관리자 원문 작업 공간(`/admin/csat/sources`, 2026-09-18)은 `SourceWorkspace`가 보기·검색·필터·정렬·선택을,
`SourceInventoryTable`과 `SourceDetail`이 원천 검토와 ACP 이동을 담당한다.
`lib/textbook/source-workspace.ts`는 재고의 확인 항목과 URL만 계산하며 적격 판정을 복제하지 않는다.
기존 `SourceEligibilityClient`의 7축·등급·학령·결함·문항 계획은 판정/처리 보기에 유지한다.
학습 모듈·판정 정본·DB 스키마는 바꾸지 않는다.
<!-- csat-sources-workspace:end -->

이야기 서가 · 판본 독서(LCP Story S5, 기존 코드 `9b39634c5` 독립 수용): `/library/stories`는 작품별 HOOK·편집 목표·판본을 보이고, `/library/stories/[releaseKey]`는 입구 → 명시적 시작 → 본문 → 단위별 읽음 표시 → 이어 읽기를 기록한다(`components/library/story/**`·`lib/library/story/learner.ts`). 원문 대응·기존 `WordLookupPopover` 뜻은 요청 시에만 열고 독서 완료로 세지 않는다. 원본 Books·`texts`·단어장·FSRS를 쓰지 않는다. 승인 SQL r3(원장 `20261025143031`)이 없는 환경은 「준비 중」이다. 2026-10-26 대표 실제 dev 발행본과 정상 학습자 A1440/B1280에서 독서·도움·저장·재로그인·완료 구분·계정 격리·철회 접근을 검증했다. 진도는 release key별이며 새 발행본에 자동 이전하지 않는다. B2는 편집 목표이고 사전 주의와 시대적 맥락은 U1/W2 후속에서 전달됐고 실제 수준 적합성·파일럿 효과는 미검증이다. [S7 실제 증거](./lcp-story/S7_PILOT.md)·[정본 §12](./LCP_STORY.md).

Story D2 U1(T-0187)은 같은 서가·입구에 접힌 주의와 편집 판단 부담을 추가하고 시작 전에 실제 도움을 설명한다. 새 공개 읽기 RPC는 **승인 v2 적용 완료(원장20261026110732)**이며, 없는 환경에서는 안내를 못 불러온 상태와 주의 없음이 다름을 표시한다. 합성 콘텐츠의1440/1280·키보드·axe 및 기존 S5 회귀를 검사했으며 실제 dev 양성 안내/사람 적합성·교육 효과와 구분한다. [후속 결과](./lcp-story/D2_S7_FOLLOWUP.md).

FAST 빠른 학습지(`/admin/csat/new/fast`, 2026-10-21): 원문 파생 지도 연습 DCP 팩(중심 의미 3유형) 하나를 고쳐 교사가 내려받는 **로컬 검수 초안**이다. 학습자 화면·DB 공급 판본과 별개이며 authored 세트나 DEEP 교수 순서를 바꾸지 않는다. 학생용 문제지에는 정답·해설·Gold 가 없고 교사용 해설지는 관리자 응답에서만 만든다.

| # | 모듈 | 계층 | 인지 유형 | 라우트 | 구현 상태 |
|---|---|---|---|---|---|
| 1 | **TextViewer** | L0~L2 | 획득·이해 | `/text`, `/text/new`, `/text/[id]` | ✅ v06.34 (책 모드 추가) |
| 2 | **WordVault** | L3 | 능동 부호화 | `/wordvault`, `/wordvault/browse` | ✅ v06.22 (Browse 풀스크린 분리) |
| 3 | **Flashcard** | L4a 재인 | Recognition + 메타인지 | `/flashcard`, `/flashcard/play` | ✅ React + FSRS |
| 4 | **SpellForge** | L4b 시각생성 | Generation Effect | `/spellforge`, `/spellforge/play` | ✅ React + IME 분리 |
| 5 | **WordBlitz** | L4a 자동화 | Recognition + 속도 | `/wordblitz`, `/play/wordblitz` | 완료 (2D 속사 인지) |
| 6 | **PairFlip** | L4a 공간기억 | Recognition + Spatial | `/pairflip`, `/pairflip/play`, `/pairflip/results` | ✅ MVP (v06.21) |
| 7 | **ScriptQuiz** | L5 정복 | Recognition + Transfer | `/scriptquiz`, `/scriptquiz/play` | ✅ React + AI 생성 |
| 8 | **Dictation** | L6 완성 | Free Recall + Production | `/dictate`, `/dictate/setup`, `/dictate/session`, `/dictate/results` | ✅ MVP (v06.7) |
| 9 | **Dashboard** | L7 회고 | 메타인지 | `/dashboard` | ✅ 설계 완료 |
| 10 | **EchoMatch** ★v06.33 | L4c 청각생성 | Shadow Reading | `/text/[id]/echo` | ✅ v06.33 PoC (4 한계) |
| 11 | **Comic Reader** ★CCP | L0~L2 입력/프리뷰 | Dual Coding 정독 프리뷰 | `/text/[id]/comic` | ✅ P1 (리더 실 · 발행 시 노출) |
| (베타) | **Pirate Quest** | — | 단어 모험 | `/play/pirate-quest` | 베타 (R3F) |

---

## 1. TextViewer (L0~L2)

### 목적
사용자가 영어 스크립트을 라이브러리에 추가·관리하고, 워크스페이스에서 통독·통청 + 단어 hover 능동 학습.

### 라우트
- `/text` — 허브 (내 스크립트 그리드)
- `/text/new` — 입력 (단일 / 책 모드 — v06.34)
- `/text/[id]` — 워크스페이스 (ReadingUniverse + ChapterSidebar)
- `/text/[id]/echo` — EchoMatch 따라읽기

### v06.34 — 책 모드 추가

기존 단일 스크립트만 지원하던 입력에 **챕터별 책 모드** 추가. 데이터 모델:
- `texts.user_book_group_id` UUID — 그룹 식별 token (FK 없음)
- CHECK 가 `library_book_id` + `user_book_group_id` 동시 사용 차단
- `chapter_idx` + `chapter_title` (기존 컬럼 재활용)

저장 helper: [`lib/text-viewer/save-user-book.ts`](../apps/web/src/lib/text-viewer/save-user-book.ts) — UUID 생성 + N row 일괄 INSERT + 부분 실패 rollback.

집계: [`useTexts.ts`](../apps/web/src/hooks/useTexts.ts) `aggregateUserBookChapters` — 그룹 → 1 LibraryText 카드 (category="내 책").

### v06.37 — TextFit (지문 적합도 판정)

`/text/new` 에서 **추출 패널보다 위**에 붙는다. 순서에 의미가 있다 — 추출은 "무엇을 배울까" 고
TextFit 은 "이 글이 지금 나에게 맞나" 라서 뒤가 앞선다.

| | |
|---|---|
| 엔진 | [`lib/textfit/coverage.ts`](../apps/web/src/lib/textfit/coverage.ts) — 순수 계산(DB·시계 접근 0, `now` 주입) |
| 데이터 | [`lib/textfit/queries.ts`](../apps/web/src/lib/textfit/queries.ts) — **기존 테이블만 읽음. 새 테이블·쓰기 0** |
| 화면 | [`components/textfit/TextFitVerdict.tsx`](../apps/web/src/components/textfit/TextFitVerdict.tsx) |
| 회귀 | 엔진 34 + 렌더 11 |

**판정 신호 3중** (강한 순 — 앞이 뒤를 이긴다):

| 근거 | 출처 | 가중치 |
|---|---|---|
| 자기보고 known | `word_familiarity.verdict` | 1.0 |
| 학습 중 | `vocabularies` FSRS | **R(t) = exp(ln 0.9 × t / S)** |
| 자기보고 unknown | `word_familiarity.verdict` | 0.0 |
| 레벨 추정 | `user_profiles.current_v_level` ≥ 사전 `v_level` | 0.85 (보수값) |

FSRS 가 자기보고 unknown 을 이긴다 — 그 뒤로 학습을 시작했다는 뜻이라 최신 사실이 FSRS 쪽이다.

**대역** — 임계는 `csat_stage_gates` 값을 그대로 쓴다(코드에 다시 적지 않는다):

| 대역 | coverage | 지원 단계 | 학습자에게 |
|---|---|---|---|
| flow | ≥ 0.98 | S1 | 사전 없이 읽힘 — 다독 |
| growth | 0.95~0.98 | S2 | **i+1 최적 구간** |
| study | 0.90~0.95 | S3 | 정독 — 논증 지문 |
| hard | 0.85~0.90 | S4 | 문항 훈련용 |
| overload | < 0.85 | — | 읽기가 아니라 해독이 된다 |

**이 모듈만의 성질** — 커버리지가 **시간에 따라 내려간다**. 같은 지문·같은 학습자라도 복습을 미루면
R(t) 가 감쇠해 커버리지가 떨어지고, 화면은 14일 뒤 위치를 고스트 마커로 함께 그린다.
Lexile·ATOS 는 글만 재고 LingQ 의 known-word 카운트는 이진값이라 이 성질을 가진 도구가 없다.

**정직성 장치** — 레벨 추정에 기댄 질량만큼 하한/상한을 벌리고 `confidence` 를 깎는다.
`confidence < 0.85` 면 단일 숫자 대신 범위를 표시한다(있지도 않은 정밀도를 주장하지 않는다).

### v06.38 — 공개 레벨 프로파일 (`/fit`)

같은 엔진의 **익명 모드**. 개인 기억이 없으므로 학년(V-Level) 기준으로 잰다 —
교사에게는 이쪽이 열화판이 아니라 정확한 모드다("내가 아는가" 가 아니라 "우리 반에 맞나").

| | |
|---|---|
| 엔진 | [`lib/textfit/profile.ts`](../apps/web/src/lib/textfit/profile.ts) · [`inflect.ts`](../apps/web/src/lib/textfit/inflect.ts) — 순수 |
| 데이터 | [`lib/textfit/public-queries.ts`](../apps/web/src/lib/textfit/public-queries.ts) — **anon 권한만** (`shared_words`·`lexicon_clean`) |
| 화면 | [`LevelProfilePanel`](../apps/web/src/components/textfit/LevelProfilePanel.tsx) · [`PublicFitClient`](../apps/web/src/components/textfit/PublicFitClient.tsx) |
| 라우트 | `(marketing)/fit` — 학습자 표면 아님 |

**출력**: 지문 하나 → V3~V10 **8개 학년의 커버리지 곡선** + 적정 레벨 + 가장 어려운 단어(V-Level 동반).

**2026-09-19 재설계(골든 1호, `docs/design/golden/fit.md`)** — 첫 시선이 **칠해지는 입력칸**이다:
[`PaintedPassage`](../apps/web/src/components/textfit/PaintedPassage.tsx)(원문 위 처음 만나는 낱말 면 + 학년 8단 슬라이더 눈금 = 커버리지)
· [`ClassSheet`](../apps/web/src/components/textfit/ClassSheet.tsx)(「학급에 나눠 줄 한 장」 — 권점 · 난외 풀이 · 적정 도장, 인쇄 첫 장)
· 칠하기 규칙 [`lib/textfit/paint.ts`](../apps/web/src/lib/textfit/paint.ts)(랜딩 히어로와 공용). 원문은 서버로 가지 않고,
`/api/fit` 이 받은 빈도표의 **표면형 → 레벨 표**(`surfaces`)만 돌려준다. 학년 사다리(`LevelProfilePanel`)는 「학년별 범위 자세히」 접힘으로 내려갔다.
`textVLevel` 은 `extract_vocabulary_for_user_v2` 와 **같은 통계**(percentile_disc 0.75)를 쓴다 —
다르면 같은 지문을 두고 추출 화면과 공개 화면이 서로 다른 난도를 말한다.

**RLS 를 우회하지 않는다** — `shared_dictionary` 는 authenticated 전용이고 `service_role` 은
"requireAdmin 뒤에서만" 이 규약이라 둘 다 후보가 아니었다. anon 이 읽는 `shared_words`(20,776 표제어)로 푼다.

**사각지대 공개** — 실측 적중 91.5%(내용어 토큰). 레벨 미상 8.4% 는 각 줄의 하한~상한 띠로 표시하고,
적정 레벨은 낙관 상한이 아니라 **중앙 추정**으로 판정한다.

**굴절 처리** — `inflect.ts` 가 후보만 만들고 판정은 DB 가 한다(오탐 유출 경로 없음).
⚠️ `-ly/-ily` 만 어간 4자 하한이 있다 — 이 규칙의 과생성은 실재하는 다른 단어를 만든다
(apply→app · only→on · family→fam · reply→rep).

### v06.39 — 결과 공유 링크

[`lib/textfit/share.ts`](../apps/web/src/lib/textfit/share.ts) — 결과를 URL 에 담는다. **서버 저장 0 · 테이블 0.**

| 담는 것 | 담지 않는 것 |
|---|---|
| 레벨별 커버리지 8개(‰) · 적정 레벨 · textVLevel · 토큰 수 · 불확실 폭 · resolvedShare · 낱말 최대 16개 | **지문 본문** · 근거 분해(breakdown) · 개인정보 |

⚠️ **지문 미포함은 최적화가 아니라 설계 제약이다** — 붙여넣는 것은 대체로 검정교과서·모의고사이고,
저장·유통하면 우리가 복제·배포 주체가 된다. 낱말 목록은 표현을 재현하지 않는다(문장·순서가 사라진다).
회귀가 "공백 포함 문자열이 페이로드에 없을 것"으로 이 계약을 강제한다.

**디코더 계약** — 어떤 입력에도 throw 하지 않는다(공유 링크는 외부가 손댈 수 있는 유일한 입력).
버전·길이·형식·값 범위 + **단조성**(레벨↑ 인데 커버리지↓ 면 위조)을 검사하고 실패하면 `null`.

**서명하지 않는다** — 위조 가능하다는 사실을 화면이 "공유받은 결과"로 밝히고, 받은 사람이
자기 지문으로 다시 돌릴 수 있게 한다. 서명은 키 관리를 부르는데 얻는 것은 자랑 방지뿐이다.

**동적 OG** — `generateMetadata` 가 같은 디코더를 써서 미리보기 제목을 결과로 바꾼다
(`이 지문은 고2 · 수능 기본 수준`). 공유 링크는 `robots: noindex`.

⚠️ `resolvedShare`(내용어 분모)와 불확실 폭(러닝워드 분모)은 **분모가 달라 서로 파생 불가**다 —
역산하려다 틀렸고, 지금은 둘 다 명시적으로 싣는다.

### v06.40 — `/fit` 분석 경로 (DB 를 경로에서 뺐다)

| | |
|---|---|
| API | [`app/api/fit/route.ts`](../apps/web/src/app/api/fit/route.ts) — 공개 화면의 **유일한** 분석 경로 |
| 맵 | [`lib/textfit/level-map.ts`](../apps/web/src/lib/textfit/level-map.ts) — 프로세스당 1회 적재 · TTL 30분 |
| 한도 | [`lib/textfit/rate-limit.ts`](../apps/web/src/lib/textfit/rate-limit.ts) — 토큰 버킷(용량 20 · 초당 0.5 · IP별) |

**왜 옮겼나**: 원래 브라우저가 Supabase 를 직접 쳤다. 지문 하나에 왕복 30회 이상이 나갔고,
그 경로에 서버가 없어 **한도를 놓을 자리조차 없었다**. 맵 전체가 200 KB 라 담을 수 있었다.

| | 이전(브라우저 직행) | 지금(서버 + 메모리 맵) |
|---|---|---|
| 지문당 DB 왕복 | 30+ | **0~1** (잔여 실재어 확인만) |
| 응답 | — | 콜드 2.7s · **웜 41ms** |
| e2e 5건 | 54s | **14.7s** |
| 레이트리밋 | 불가(경로에 없음) | IP별 토큰 버킷 |

⚠️ **맵은 "전체 어휘" 가 아니라 "공개적으로 읽을 수 있는 어휘" 다.** 정책
`read words of published` 가 도서·아티클 파생을 **원본 발행 + `copyright_safe_in_kr`** 로 제한한다.
관리자 시점 81,409행/21,503 표제어 → anon **59,203행/18,271 표제어**(정책 전문 재현으로 대조).
차이는 결함이 아니라 저작권 게이트다.

⚠️ **적재 루프 두 가지 함정** (둘 다 실측으로 물림):
- 서버가 페이지를 1,000으로 깎는다 → 요청 크기로 종료 판정하면 **맵이 조용히 1,000개로 잘린다**.
  받은 개수만큼 커서를 옮긴다.
- 깊은 OFFSET 은 느리고 경계에서 어긋난다 → `id > 마지막id` 키셋 페이지네이션.

⚠️ 레이트리밋은 **프로세스 메모리**다. 인스턴스가 여러 개면 한도도 그만큼 곱해진다.
목적이 "실수·스크립트 한 대" 차단이라 지금 수준엔 충분하고, Redis 는 트래픽이 붙은 뒤에 넣는다.

**적용 완료** — `textfit_resolve_levels` RPC
(`supabase/migrations/20260826102758_textfit_resolve_levels.sql`).
⚠️ 2026-08-30 이전 이 자리는 "승인 대기 · 미적용" 이라 적고 있었다 — 적용된 뒤에도 문서가 안 따라와서,
읽는 사람이 **멀쩡한 기능을 폴백 상태로** 오해하게 만들고 있었다.
없을 때는 정확 일치 폴백으로 내려가 굴절형이 미지어로 남는다 → 커버리지를 **낮게** 잡는 방향이며,
화면 근거 패널이 그 사실을 밝힌다.

### 컴포넌트 (`components/textviewer/`)
- `EmptyState.tsx` — Cold 첫 진입
- `DiscoveryFooter.tsx` — Library 전환

### 입력 폼 (`components/text-viewer/`)
- `InputModeTabs.tsx` — 직접/파일/URL 탭
- `TextInput.tsx` / `FileUploadArea.tsx` / `UrlInput.tsx`
- `BookChapterInput.tsx` — v06.34 책 모드 워크벤치 (가로 레일 + Alt+←/→)
- `SampleScripts.tsx` — 샘플 스크립트
- `ScriptDisplay.tsx` / `AnalysisResult.tsx` / `WordList.tsx` / `WordCard.tsx`

### 워크스페이스 (`/text/[id]/`)
- `layout.tsx` — RSC 진입, `v_text_content` 1쿼리 + `library_book_id` / `user_book_group_id` 분기
- `page.tsx` — `'use client'` ReadingUniverse
- `text-content-context.tsx` — TextContentProvider
- `article-practice-entry.tsx` — 기사 발췌 연습 진입. layout 이 `article_practice_items` 응답을 `lib/learner/reader-article-practice.ts` 로 failed(오류·배열 아님)/none(빈 배열)/available 로 나눈다. available 은 기존 연습 링크, none 은 표시 없음, failed 는 「연습 여부를 확인하지 못했어요」 + 같은 글 `/practice/article/<id>` 링크(그 페이지 loader 가 본인 글·계정·판본을 다시 확인 — 화면 안 재호출·자동 재시도 없음). 기사가 아닌 글·책·Story 는 상태 없음(T-0204, 2026-10-28)
- `text-content-helpers.ts` — buildParagraphsFromContent
- `echo/page.tsx` — EchoMatch 라우트
  - 결과 화면 다시 듣기(2026-10-28): `components/echo/ReplayPanel.tsx` + `lib/echo/replay-controller.ts`. 예시는 문장 내용 키 캐시, 내 발화는 현재 문장·화면 수명 동안 메모리에만 두고 다음 녹음·이동·계정 변경·이탈에 놓는다. 앱은 녹음을 저장·업로드하지 않으며, 단어 인식(브라우저 SpeechRecognition)은 브라우저에 따라 원격 처리될 수 있다. 재생은 저장·점수·SRS 를 부르지 않는다.

### 컴포넌트 (`components/workspace/`)
- `ContextBar.tsx` (sticky · 북마크·타이포·인사이트·집중)
- `ReadingUniverse.tsx` (Lora 본문 + hover/click + 문장 재생)
- `RecallCard.tsx` (의미 회상 카드, 3단계 판정)
- `ModePills.tsx` (7모듈 진입 — read/listen/shadow/words/flashcard/spellforge/wordblitz/quiz)
- `Pagination.tsx`
- `FloatingAudioPlayer.tsx` (v06.35 풀 재설계) — 하단 dock + 글라스 + Step Hero
  - **하단 dock**: `fixed inset-x-0 bottom-0` 전체 폭, max-w 920px 콘텐츠, `border-t` + `backdrop-blur-2xl` 글라스
  - **4 mode**: 문장 / 단락 / 전체 / **따라하기** (underline 탭 style)
  - **Step (따라하기)** mode: 문장 hero (Lora 17-19px) + countdown ring (play button 주변 SVG) + pulsing 상태 dot (듣는 중 / 따라 말해 보세요)
  - **듀얼 소스**: 브라우저 TTS + LibriVox (별도 source 토글 row)
- `FloatingSparkle.tsx` (다음 단계 추천)
- `InsightPanel.tsx` (북마크·기억 상태)
- `KeyboardHints.tsx`

### 소스 내비 (2026-08-30 정정)
`components/wordvault/ScriptsChipNav.tsx` — 전체 + 구독 단어장(보라) + 스크립트(인디고) 칩 행.
도서 컨텍스트(`?book=&chapter=`)로 들어오면 대신 `BrowseSourceBar.tsx` 가 챕터 셀렉터를 그린다.

⚠️ 이 자리는 `components/wordvault/WordSetSidebar.tsx`(320px 고정 사이드바)를 가리키고 있었는데
**그런 파일은 저장소에 없다** — 만들어진 적이 없거나 이름이 바뀐 뒤 문서가 안 따라왔다.
없는 파일을 가리키는 문서는 "구현돼 있다" 는 말과 같다.

---

## 2. WordVault (L3 Encode)

### 목적
사용자 자산(단어) 차원별 관리. Memory Decay 4색 분포 시각화 + 자산 정체성 강화.

### 라우트
- `/wordvault` — 허브 v6 (6 Tier IA)
- `/wordvault/browse` — 풀스크린 브라우즈 세션 (v06.22)
- `/wordvault?view=study` / `?view=review` — 학습/복습 모드

### 데이터 모델
`vocabularies` 테이블:
- FSRS 6 컬럼: difficulty (1.0~10.0) · stability · last_review_at · next_review_at · module_history TEXT[] · review_count
- UNIQUE(user_id, word) — 중복 방지
- `lemma` REFERENCES `shared_dictionary(word)` — 사전 연결

### Memory Decay 4색 (R(t) 동적 계산)
```
신규 등록(D/S 미부여)  → new      #94A3B8 (회색)
R ≥ 0.95              → stable   #22C55E (초록)
0.70 ≤ R < 0.95       → shaky    #F59E0B (주황)
R < 0.70              → risk     #EF4444 (빨강)
```

**중요**: `memory_state` 컬럼 의도적 부재 — DB 저장 X, R(t) 동적 계산만 (저장 + 시간 흐름 = 데이터 stale).

### Hub 컴포넌트 (`components/wordvault/hub/`) — v06.35 4 Zone Editorial 재설계

**현재 활성 (6 Section — 단어 관점 종합 포트폴리오)** v06.35 Portfolio 재설계:
- `WordVaultHub.tsx` — 6 Section 조립 + 주간 목표 fetch · max-w 5xl
- `VaultIdentity.tsx` ★v06.35 — Section 1 Mastery Hero (큰 숫자 + V-Level 메타 칩 + 4 bucket 가로 비교 막대 + 단일 CTA + 주간 목표)
- `VocabularyLevelMap.tsx` ★v06.35 — Section 2 단어 수준 지도 (V0-V11 분포 + i+1 zone 강조 + 트랙별 수준)
- `FacetProgressSection.tsx` ★2026-08-15 — Section 3 **면(facet) 상태** — 가장 뒤처진 면 하나를 처방으로 + 6면 내역(접힘). `/api/wordvault/facets` 실데이터. 폐기된 `LearningDimensionSection`(임포터 0 · 목업 63/47/27 · 모듈명 4개 하드코딩으로 아케이드 19종 비가시)의 자리
- `ResourcePortfolio.tsx` ★v06.35 — Section 3 학습 자산 (도서/스크립트/공용 단어장 3-col grid)
- `RecommendedBooks.tsx` ★v06.35 — Section 4 i+1 권장 도서 4권 (`scoreBook` + `judgeIPlusOne`)
- `NextStepList.tsx` ★v06.35 — Section 5 단어장 추천 (`recommend_word_sets_for_user`)
- `FlowStripe.tsx` ★v06.35 — Section 6 28일 sparkline + 평균/활동/총합 + 마지막 활동

**보존 (현재 hub 미사용)**:
- `AssetGrid.tsx` ★v06.35 — 단어장 grid (browse view 등에서 재활용 가능)

**보존 (현재 hub 미사용 — Phase 2 추가 view 재활용 가능)**:
- `VaultBar.tsx` — Hero 슬림 8px 4색 막대 (v06.18)
- `AssetCollectionsRow.tsx` — 출처별 컬렉션 카드
- `BookShelfSection.tsx` — 5 Book Type 카드 (v06.20) · `VaultBook` 타입은 AssetGrid 가 재사용
- `CEFRDistribution.tsx` — 6단계 horizontal bar (v06.19)
- `FindAndMore.tsx` — 인라인 검색 진입 (AssetGrid 검색바로 흡수)
- `MemoryDecayDistribution.tsx` — 4색 stacked bar + Bucket 카드 (VaultIdentity 가 통합)
- `TrendIndicator.tsx` — week-over-week 추세 (FlowStripe 가 통합)
- `WordPeekStrip.tsx` — 데스크톱 최근 단어 5개 chip
- `RecommendedSetsSection.tsx` — 진단 후 추천 (NextStepList 가 단순화)
- `VLevelPromotionCheck.tsx` — i+1 자동 promotion 확인

**Editorial 디자인 톤** (v06.35):
- gradient · 이모지 · 큰 그림자 모두 제거
- 회색 (`--t1`/`--t2`/`--t3`/`--t4`) + brand `--p` 액센트만
- 큰 여백 + 1px border (`--bd`)
- 수치는 모두 `tabular-nums` (전문 인상)
- 4 Memory Decay 색은 정보 전달용으로만 유지 (`#22C55E`/`#F59E0B`/`#EF4444`/`#94A3B8`)

### Browse (`/wordvault/browse`)
- `WordVaultBrowseClient.tsx` — 풀스크린 클라이언트
- `ScriptsChipNav.tsx` — 스크립트 칩 nav (전체+스크립트별 단어 수)
- `WordRow.tsx` v4 — 16px 컴팩트
- `HideToggleBar.tsx` — Active Recall 토글
- `ListenPanel.tsx` — 듣기 패널 (설정 항상 노출)

---

## 3. Flashcard (L4a 재인)

### 목적
단어 단어 1개 시각 단서 → 자가 판정 (Active Recall). SM-2 SRS 기반 (실 구현: `ts-fsrs` 패키지 wrapper).

### 라우트
- `/flashcard` — Hub (Continue · Queue · 정확도 · 시작 설정)
- `/flashcard/play` — 세션 (SM-2 SRS · 4단계 평가: Again/Hard/Good/Easy)

### 이탈 저장 — 완주하지 않아도 평가는 남는다 (2026-09-05)

flush 는 원래 `isComplete` 에만 걸려 있었다. ✕ · Esc · 뒤로가기 · 사이드바 · 탭 닫기로 나가면
그때까지의 평가가 `sessionStorage` 에 갇혀 있다가 탭이 닫히면 사라졌다. 지금은:

| 층 | 파일 | 하는 일 |
|---|---|---|
| 큐 | `lib/srs/session-storage.ts` | `localStorage`(탭 수명보다 오래) · 옛 `sessionStorage` 큐 1회 이관 |
| 서버 | `lib/srs/flush-actions.ts` | `(vocabulary_id, attempted_at)` **멱등** — 재전송해도 D/S 이중 누적 없음 |
| 문 | `app/api/srs/flush/route.ts` | `sendBeacon` / `fetch(keepalive)` 가 들어오는 HTTP 창구(로직은 server action 재사용) |
| 훅 | `hooks/useSrsFlushOnLeave.ts` | 진입(지난 큐 정리) · 숨김(`visibilitychange`) · 언마운트/`pagehide` |

배선된 세션 4곳: `FlashcardSession` · `wordvault/StudyMode`(study·review) · `SpellForge` ·
`PairFlipGameScreen`. 새 세션 모듈은 이 훅 한 줄을 부르면 된다 — 저장을 "나가는 길" 마다
붙이지 말 것(길은 다섯 갈래고 언제든 늘어난다).
회귀: `lib/srs/__tests__/flush-durability.test.ts`(6).

### FSRS 한국 학습자 파라미터
| | FSRS 표준 | Vocaflow 초기값 | 근거 |
|---|---|---|---|
| Target Retention | 0.90 | **0.85** | 한국 학습자 평균 학습 시간 부족 |
| Initial Difficulty | 5.0 | **6.0** | 외국어 처리 어려움 |
| Maximum Interval | 36500일 | **365일** | 1년 이상 무의미 |
| Learning Steps | [1m, 10m] | **[1d, 3d]** | 게임 세션 단위 |

### 컴포넌트 (`components/flashcard/`)
- `FlashcardSession.tsx` — 세션 컨테이너
- `Card.tsx` / `CardFront.tsx` / `CardBack.tsx` — 3D flip (CSS perspective + rotateY)
- `RecallPhase.tsx` / `FirstJudge.tsx` — 능동 회상 단계
- `HonestyHint.tsx` / `MicroPause.tsx` — 학습 과학 보조
- `SRSBar.tsx` / `ForgettingCurve.tsx` — 진행 가시화
- `CompletionState.tsx`

### 환경
- 하늘 배경 (`from-[#87CEEB] via-[#56CCF2] to-[#1A9898]`)
- 카드 황금 gradient (앞면) ↔ 초록 gradient (뒷면)
- 레인보우 FLASHCARDS 로고 (글자별 색상)

---

## 4. SpellForge (L4b 시각생성)

### 목적
뜻 → 철자 직접 생성 (시각+운동). Generation Effect 활용.

### 라우트
- `/spellforge` — Hub (Memory Decay · Best 점수)
- `/spellforge/play` — 세션 (스펠링 타이핑 · IME 분리)

### 컴포넌트 (`components/spellforge/`)
- `SpellForge.tsx` — 메인 컨테이너
- `ModeSelector.tsx` — 단어→철자 / 뜻→철자
- `MeaningDisplay.tsx` / `InputSlots.tsx` / `SingleBox.tsx`
- `ConfirmButton.tsx` / `IMEIndicator.tsx`
- `ReflectionHint.tsx` / `MicroPause.tsx`

### 환경
- 파란 패널 (`from-[#5CB8E0] via-[#4A9FCF] to-[#3A7FAF]`)
- 전구 힌트 바 (`#FFE234 → #F59E0B` gradient + bulbGlow 애니메이션)
- JetBrains Mono 셀 (50×54px)

### 입력
- 자동 제출 (typed.length === word.length → checkAnswer)
- 힌트 (-20점 / 첫 빈 칸 정답 글자 삽입)
- 숨김 input (`opacity:0 left:-9999px`, autocorrect off)

---

## 5. WordBlitz (L4a 자동화)

### 목적
4지선다 빠른 인지(ko 뜻 → en 단어). 시간 압박·콤보로 자동화 형성.

### 라우트
- `/wordblitz` — Hub
- `/play/wordblitz` — 풀스크린 (셸 메뉴 X · SessionFrame 자동 주입)

### 게임 — 속사 인지 (v07 재설계, 2026-07)
- ko 뜻 프롬프트 → 4개 en 타일(2×2) 중 정답을 탭/키(`1`–`4`)로 선택.
- 문항별 타이머 바(레벨 상승 시 단축) · 콤보(연속 정답 → 배수·레벨업) · 점수(시간보너스×콤보배수).
- 절제된 게임 주스: 정답 초록+체크, 오답 앰버 shake, 콤보 범프. 차분한 종료("오늘 잘 마쳤어요" — 폭죽 없음).
- **이전 Three.js 3D 인형뽑기 대체** — ~5초/단어 → ~1-2초/단어, 모바일 우선(3D 자산·useWordBlitzGame·WordBlitzUI.css 삭제).

### 디자인
- 순수 2D DOM · **테마 토큰(라이트/다크 자동)** · 게임 예외 토큰 `--combo`/`--streak`.
- 접근성: 키보드 `1`–`4` · aria-live · `prefers-reduced-motion` · 44px+ 타일.

### 컴포넌트
`components/game/wordblitz/WordBlitzGame.tsx`(게임 본체 · 계약 wordPool/onExit/onCorrect/onWrong FSRS) · `WordBlitzUI.tsx`(로딩 폴백) · `lib/wordblitz/data.ts`(Word/SAMPLE_WORDS/POINTS).

- 끝화면 놓친 단어 대조(2026-10-28): `WordBlitzMistakes.tsx` — 이번 판 메모리에 처음 놓친 순간의 target·chosen·form·prompt 를 보관(en 중복 제거·횟수, 시간 초과는 「선택하지 못함」), 전체 목록에서 하나를 골라 당시 질문·내 선택·정답·단어 예문(원문 아님)을 나란히. 점수·콤보·재출제·FSRS·기록 콜백 불변, 끝화면만 자체 스크롤.

---

## 6. PairFlip (L4a 공간기억 · v06.21)

### 목적
짝맞추기 카드 게임 — Working Memory + Spatial + Recognition 3중 활성화.

### 라우트
- `/pairflip` — Hub (Hero + StartScreen 통합)
- `/pairflip/play` — 세션 (3D flip + O/X 코너 배지)
- `/pairflip/results` — 결과 (ScoreRing · PairsList · NextActionCard)

### 디자인
- Editorial 네이비/골드/크림 팔레트 (`#1E3A8A → #1E1B4B + #F59E0B`)
- 카드 1px 골드 테두리 + 4 모서리 코너 장식 + 페이퍼 인셋 그림자
- 부엉이 마스코트 4상태 (idle/cheer/happy/clap)
- 5단계 난이도 (Easy 8장 ~ Master 20장) — 모든 레벨 2줄 고정

### 컴포넌트 (`components/pairflip/`, 16개)
- `PairFlipEnv.tsx` — warm ivory + 골드 라디얼 + 미세 폴카
- `PairFlipMascot.tsx` (부엉이 4상태)
- `PairFlipLogo.tsx` — Editorial 네이비/골드 글자별 라이즈
- `PairFlipLevelSelector.tsx` (5단계)
- `PairFlipModeSelector.tsx` (word_meaning / word_definition Phase 2)
- `PairFlipStartScreen.tsx` / `PairFlipHub.tsx`
- `PairFlipCard.tsx` (3D flip + 5상태 + O/X 코너 배지)
- `PairFlipGrid.tsx` (cols × 2 rows + 좁은 viewport 가로 스크롤)
- `PairFlipHUD.tsx` (타이머·점수·콤보·힌트 sticky)
- `PairFlipFeedback.tsx` / `PairFlipProgress.tsx`
- `PairFlipGameScreen.tsx` / `PairFlipScoreRing.tsx` / `PairFlipPairsList.tsx`
- `PairFlipNextActionCard.tsx` / `PairFlipResultScreen.tsx`

### FSRS rating 매핑
- 1회 = Easy / 2 = Good / 3-4 = Hard / 5+ = Again
- `lib/pairflip/learning-records.ts` — Phase 2 Supabase 적재

### 매칭 카드 영구 유지
`gone` 전환 X — 시각적 진행도 누적.

---

## 7. ScriptQuiz (L5 정복)

### 목적
스크립트 맥락 4지선다. Recognition + Transfer — 텍스트 단위 의미 통합 검증.

### 라우트
- `/scriptquiz/play` 범위(T-0193): 읽기 화면 Quiz 는 그 챕터(`?book&ch&text`)·글(`?text`) 퀴즈로 연다. 채점 뒤 본문 문장 4개 중 근거를 고르면 **등록 근거와 대조만** 한다(정오 판정·기록·점수 아님). 본문은 본인 texts·같은 도서/챕터일 때만, 근거가 한 문장에 유일하게 대응할 때만 피커. 범위가 잘못됐거나(`ch=1junk` 등) 문항이 없으면 데모 대신 빈 상태. 범위 없음만 데모.
- `/scriptquiz` — **확인 대기열** (v08.6 재설계) — server `page.tsx` → `lib/scriptquiz/queue.ts`(카탈로그 × `texts.status` × `scores`) → client `ScriptQuizQueue`.
  **읽은 챕터만** 내준다: 이전 `ScriptQuizHub`(삭제)는 카탈로그 129챕터를 전부 나열해 **미열람 41챕터의 줄거리를 스포일러**했다.
  구성 = 다음 한 걸음 1개(읽은 지 가장 오래된 미확인 챕터 · 간격 인출) + 책 카드(기본 접힘, 펼치면 읽은 챕터 칩) + 한영 토글
- `/scriptquiz/play` — 3-screen flow · `?book=&ch=` 큐레이션 공유 챕터 퀴즈(`select_book_chapter_quiz`) · `?text=` 개인 퀴즈(`quiz_questions`) · 미지정 시 MOCK

### 문제 출처 (v06.114)
- **큐레이션 공유** — `library_chapter_quiz` (도서 챕터별 스토리 퀴즈, 문항 수 = 도서 V-Level 곡선 3~10). LCP 큐레이션 드레인(Claude Code, `scripts/lcp/generate-chapter-quiz.mjs`)이 챕터 본문을 읽어 생성 → 전 학습자 공유. Admin `/admin/curation` "스크립트 퀴즈 큐" → `book_quiz_jobs`.
- **개인** — `quiz_questions` (per user+text) 는 개인 스크립트용으로 병행 유지.
- 앱 런타임 LLM 0 — 문항은 드레인 시 사전 생성.

### 3-Screen Flow
1. **Start Screen** — QUIZ 로고 (gradient text `#5BC8F5→#1A7AB8`) + 스크립트 제목/챕터 + Start
2. **Question Screen** — HUD 바 (Time + Score JetBrains Mono 22px) + 문제 박스 (Lora) + 선택지 5상태
3. **Result Screen** — SVG 점수 링 + 정확도 s2 (40px/800) + 통계 3칸 + 오답 복습

### 선택지 5상태
- idle / selected / correct / wrong / other (opacity-45)

### O/X 피드백 오버레이
- `fixed inset-0 pointer-events-none z-50`
- 컨테이너: 140×140 · `bg-white/90 backdrop-blur`
- O: border-10 solid var(--p) · opacity-60
- X: 80px · error · opacity-70

### AI 문제 생성
```typescript
const QUIZ_GENERATION_PROMPT = `
다음 영어 스크립트을 읽고 독해 퀴즈 ${count}개를 생성하세요.
[규칙]
- 문제 유형: multiple(4지선다) 위주, truefalse(OX) 혼합
- 스크립트 내용 근거 문제만 출제 (추론 금지)
- 각 문제에 sourceSnippet(근거 문장) 포함
[출력 — JSON only]
{ "questions": [{ "type":"multiple","question":"...","options":[{"text":"..."}],"correctIndex":0,"sourceSnippet":"..." }] }
`;
```

### DB
`quiz_questions` 테이블 — type CHECK ('multiple'/'truefalse'/'blank') · options JSONB · correct_index · source_snippet · source_sentence_idx.

---

## 8. Dictation (L6 완성 · v07 — 학습 자산 연결)

### 목적
스크립트 단위 다중 채널 재생산 (음운+의미+문법+철자). Free Recall + Production — 학습의 정점.
**v07 부터 문장 안의 "내 단어"(타깃)를 인출 대상으로 삼아 받아쓰기가 곧 그 단어의 복습이 된다.**

### 라우트
- `/dictate` — Hub (오늘의 받아쓰기 CTA · 자료 3탭 · 약점 · 최근). **서버 컴포넌트** —
  조회는 `lib/dictation/hub-query.ts` 가 서버에서 한 벌로 하고 화면은 props 만 받는다.
  2026-09-06 전까지 페이지 전체가 `'use client'` 라 브라우저 데이터 요청이 **15건**이었다
  (학습자 화면 중 최다) → **0건**. 이어하기의 `localStorage` 확인만 클라이언트에 남고,
  갱신은 `router.refresh()`. 조회 실패는 `failed` 로 내려 「못 불러왔어요 + 다시 시도」를 그린다.
  ⚠️ 읽기 4종은 `lib/dictation/reads.ts` 에 있다 — `persist.ts` 는 쓰기 경로 때문에 파일 전체가
  `'use client'` 라 서버에서 꺼내면 함수가 아니라 클라이언트 참조가 온다.
- `/dictate/setup?text=|set=|custom=1` — Setup (미리보기 3지표 + 분량/문항수/순서/채점/듣기)
- `/dictate/session?sessionId=` — 세션 (TTS · 단어별 채점 · 4단계 힌트 · Focus Mode)
- `/dictate/results?sessionId=` — 결과 (**DB 조회** · 복습 반영 단어 · 청취 폭 · 반복된 태그)
- 들어온 자리 `?from=`(읽던 글 등)은 설정 → 세션 → 결과 → 같은 자료 재시도로 이어진다(`lib/dictation/return.ts` · 기존 `sanitizeInternalPath` 만 통과). 세션 틀의 닫기/Esc 는 그 from 으로, 결과에는 from 이 있을 때만 「하던 학습으로 돌아가기」(`DictationResultActions`). 붙여넣기 · 오늘의 받아쓰기 재시도는 허브(from 없음).

### 자료 4소스 (v07)
| 소스 | 스코프 | 문장 출처 | 타깃 단어 |
|---|---|---|---|
| 도서 챕터 | `?text=`(library_book_id 有) | `get_chapter_content` RPC (content_chunks) | 그 챕터 vocabularies |
| 내 스크립트 | `?text=` | `texts.content` | text_id 로 묶인 vocabularies |
| 공용 단어장 | `?set=`(+`?chapter=`) | `shared_words.source_sentence` → `example_en` | 그 단어 자체 |
| 오늘의 받아쓰기 | 기본값 | 복습 임박 예문 3 + 재도전 1 + 읽던 자료 1 | 복습 임박 단어 |
| 붙여넣기 | `?custom=1` | sessionStorage (자료로 저장 안 함) | 내 vocabularies 중 등장하는 것 |

### 난이도 적응 — 청취 폭 i+1 (v07)
문항을 **고르는 단계**에만 적응을 넣는다. 순서는 건드리지 않는다 — 도서 챕터를 길이순으로
재정렬하면 이야기가 무너진다.

| 함수 (`source.ts`) | 규칙 |
|---|---|
| `spanBand(span)` | 상한 `span×1.5`(i+1, ≤34) · 하한 `span×0.6`(≥4). 기록 없으면 `4~14` |
| `pickBySpan(items, count, band)` | 길이대 안 우선 → 부족분은 길이대에서 가까운 순. **원본 순서로 복원** |

`count='전체'` 거나 오늘의 받아쓰기(이미 이유별로 골라 온 목록)면 적용하지 않는다.
setup 미리보기는 **실제 조립과 같은 규칙**으로 계산한다(예상과 실제가 다르면 화면이 거짓말이 된다).
단위 테스트: `lib/dictation/__tests__/adaptation.test.ts` 22건(적응 + FSRS 등급 + 오류 태그).

### 설정
- **한 번에 받아쓸 분량 1·2·3문장** (v07 — 기존 '단위 문장/단락/전체' 대체. 단락·전체는
  연속 본문에서만 성립해 단어장·오늘에는 적용 불가였다). 단어장·오늘은 1문장 고정.
- 채점 2종: Smart / Strict · 순서: 순차 / 섞기
- CEFR A1~C2 자동 감지 (v06.22 수동 선택 제거) → 분량·속도·반복·힌트 추천값 자동 적용

### 인프라 (`lib/dictation/`, 11 파일)
- `types.ts` — Config(chunkSize) · Session · Item(targetWords·maxHintLevel·replayCount) · WordResult
- `source.ts` — **자료 해석 단일 출처**. 4소스 → `DictationSentence[]` + 타깃 단어 부착
- `daily.ts` — 오늘의 받아쓰기 조립 (due 3 / retry 1 / fresh 1 · 오늘 받아쓴 문장 제외)
- `catalog.ts` — 허브 자료 목록 (내 도서 · 스크립트 · 구독 단어장)
- `targets.ts` — 타깃 적중 판정 → FSRS 1~4 (힌트 4단계 사용 시 Again)
- `error-tags.ts` — 누적 가능한 오류 태그 9종 + 처방 문구
- `persist.ts` — 세션/문항 적재 · 완주(scores + FSRS flush) · 통계 RPC 3종 read
- `cefr.ts` — A1~C2 + 그룹별 추천(chunkSize)
- `text-splitter.ts` — 약어 처리 + 문장 분리
- `scoring.ts` — Levenshtein + Word alignment + Smart/Strict
- `analyzer.ts` — 세션 내 설명용 패턴 6종 (누적은 error-tags 가 담당)
- `audio-control.ts` — Web Speech API + autoRepeat + 무음 간격
- `neural-voice.ts` — **v07** Piper WASM(en_US-amy-medium · EchoMatch 자산 재사용). 영어 음성이
  없는 기기의 무음 해소. 문장 LRU 캐시 + 다음 문항 선합성. **자동 다운로드 안 함**(17MB 명시 후 1회 동의)
- `hint.ts` — 4단계
- `storage.ts` — **진행 중 세션 런타임 캐시만** (기록 원본은 DB)

### Hooks
- `useAudioControl.ts` — 엔진 2종(기기 음성 / 내려받은 음성)을 한 표면 뒤에. 합성 실패 시 즉시 폴백
- `useDictationSession.ts` — 문항 진행 + 채점 + 적재 3시점 (`createDictationSession` 포함)

### 컴포넌트 (`components/dictation/`)
- `DictationHubClient.tsx` — 오늘의 받아쓰기 카드 + 이어하기 + 최근 세션
- `SourcePicker.tsx` — 도서/스크립트/단어장 3탭 + 붙여넣기
- `WeaknessPanel.tsx` — 최근 2주 오류 태그 Top3 + 처방 + 예시
- `DictationSetupClient.tsx` · `DictationSessionClient.tsx` · `DictationResultsClient.tsx`

### 영속화 (v07)
`dictation_sessions` / `dictation_attempts` (RLS) · 완주 시 `scores`(module='dictation') +
`vocabularies`/`learning_records`(FSRS). `learning_records` INSERT 트리거가 `daily_activity`
를 갱신하므로 streak 도 자동. 상세: [DB_SCHEMA.md](./DB_SCHEMA.md)

### 키보드
- Space (재생/정지) / 1-5 (속도) / F (Focus) / Tab / Enter / Esc

### Phonological Loop 보호
입력 시 음성 자동 정지.

### Smart Suggestion
70~90% 우선 추천 (정서적 부호화).

---

## 9. Growth / Dashboard (L7 회고)

### 목적 (v06.201 재정의)
"내 기억은 **얼마나 오래 버티나**, 이번 주에 무엇을 **되찾았나**".
개수(노력의 양)가 아니라 지속 시간(학습의 질)을 회고의 축으로 둔다.
forward(오늘 할 일·조치)는 `/hub` 와 셸 나침반 띠 소관 — 이 화면은 backward 만.

### 라우트
- `/dashboard` — page.tsx (RSC) + layout.tsx

### 데이터 (`lib/learner/`)
- `growth-math.ts` — **순수**. `RUNGS`(지속 5칸) · `rungFor` · `computeStreak` ·
  `formatDuration` · `median` + DTO(`Ladder`·`RescuedWords`·`TraceDay`·`Reach`).
  ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
- `memory-horizon.ts` — 조회(`fetchMemoryHorizon`). `vocabularies.stability` +
  `learning_records` + `shared_dictionary.frequency_rank`
- `growth-stats.ts` — 셸 공용(기억 4상태 · 28일 · streak 단일 정의)

### 컴포넌트 (`components/dashboard/`)
- `DurabilityLadder.tsx` — **히어로**. 지속 중앙값 + 5칸 사다리(하루/사흘/한 주/한 달/계절)
- `RescuedWords.tsx` — 이번 주 다시 만나 맞힌 단어 (실물 단어 5개)
- `ActivityTrace.tsx` — 28일 흐름(**리뷰 건수** 기준) + 요일 리듬. **분(minutes) 안 그림**
- `LexicalReach.tsx` — 빈도 밴드 분포 (커버리지 %로 환산하지 않음)
- `ManageSection.tsx` — 진단·계획·리포트 3카드 (`/manage` 흡수)
- `RecentActivity.tsx` — 컴팩트 칩 행 (연속 run 접기 `딕테 ×5`)
- `StatCard.tsx` · `ModuleAccuracyRing.tsx` · `ScoreTrendChart.tsx` — 현재 미사용(다른 화면용)

### 레이아웃
1. Header — 날짜 + 이름 (인사·오늘 진행 없음)
2. DurabilityLadder (히어로)
3. RescuedWords + ActivityTrace 2열
4. LexicalReach
5. ManageSection
6. RecentActivity

### 제거된 것
- `WeeklyHeatmap.tsx` — `total_minutes>0` 을 학습일로 판정해 8일 연속 학습을 "28일 중 1일"로
  그렸다. `ActivityTrace` 로 대체(파일은 남아 있으나 이 화면에서 미사용)
- `MemoryStatus`(기억 4상태) — ADR 0006 D2 대로 셸 나침반 띠가 소유. 조치 표면 이중화 해소

---

## 전역 셸 — 나침반 띠 (v06.34)

`(main)/layout.tsx` 최상단의 **유일한 상태 표면**. 학습 세션(풀스크린)에서는 통째로 사라진다.

### 왜 다시 만들었나 (실측 2026-09-05 · dev 1280×900 · 계정 lexicon-test)

이전 `StatusRibbon` 을 학습자 라우트 9곳에서 순회 계측한 결과:

| | 이전 | 지금 |
|---|---|---|
| 띠 높이 | 69px (뷰포트 6.2%) | **60px** |
| 담긴 항목 | 칩 1개 (`새 단어 8`) | 위치 · 계단 · 다음 걸음 문장 · CTA · 펼침 |
| 라우트별 변화 | **9/9 텍스트 동일** | 표면마다 다름 (LIBRARY · VAULT · GROWTH · TODAY) |
| 답하는 질문 | 0.5 / 6 | **6 / 6** |

게다가 이전 띠의 "전부 0이면 격려 문장" 규칙이 `fresh=8` 때문에 켜지지 않아, 격려도 상태도
아닌 **고아 숫자 하나**였다 — 가장 방향이 필요한 미진단 학습자에게 가장 적게 말하고 있었다.

### 두 층

| 층 | 무엇 | 파일 |
|---|---|---|
| 상시 (60px) | Q1 위치 · Q2 계단 점 · Q3 지금 한 걸음 + CTA 1개 + 연속일 | `components/layout/CompassRibbon.tsx` |
| 펼침 | Q4 사정권 · Q5 7일 예보 · Q6 지난 7일 · 기억 칩 2종 | `components/layout/WayfinderPanel.tsx` · `MemorySparkline.tsx` |

여섯을 한 줄에 다 그리지 않는 이유는 철학 ② Progressive Disclosure + 학습원칙 ⑥(작업기억 ~4항목).

### 데이터 — 왕복 수는 이전과 같다

| 값 | 출처 | 추가 쿼리 |
|---|---|---|
| 오늘 5블록 · V-Level | `fetchTodayPrescription` (`cache()`) — `current_v_level` 을 읽고도 버리던 것을 실어 보낸다 | 0 |
| 기억 4상태 · 28일 · 연속일 · **7일 예보** | `fetchGrowthStats` (`cache()`) — 예보는 이미 읽던 `vocabularies` 행을 7번 더 접은 것 | 0 |
| 사정권(발행 도서 레벨 분포) | `library-reach.ts` 프로세스 TTL 캐시 10분 (사용자 무관 전역값) | 대부분 0 |

- 순수/조회 분리: `wayfinder.ts` ↔ `wayfinder-query.ts` · `reach-math.ts` ↔ `library-reach.ts`
  (클라이언트가 `server-only` 모듈에서 값을 import 하면 앱 전체가 500 — CONVENTIONS 참조)
- 계측 2종: `wayfinder_opened` · `wayfinder_cta_clicked` (속성은 국면 열거형 + 개수뿐)
- 회귀 40 — `lib/learner/__tests__/wayfinder.test.ts` 24 · `components/layout/__tests__/compass-ribbon.test.tsx` 16

---

## 10. EchoMatch (v06.33 · L4c 청각생성)

### 목적
Shadow Reading — 원어민 발화 따라하기. 음운+발화 쌍둥이.

### 라우트
- `/text/[id]/echo` — 별도 라우트. ModePills 'shadow' 는 같은 글의 인라인 따라읽기(`?mode=shadow` · `ShadowReadAlong`)를 열고, 그 패널의 시작 전 · 완료 화면에 「내 녹음과 억양 비교」 링크(`echoHref` = 같은 `text.id` 의 echo)가 있다. 진행 중에는 링크가 없다.

### 4-Phase Cycle
1. **idle** — 대기
2. **listening** — TTS 재생 (Web Speech API)
3. **recording** — MediaRecorder (getUserMedia: echoCancel/noiseSuppress/AGC + webm/opus)
4. **comparing** — DTW (Dynamic Time Warping)
5. **scored** — 3축 점수 + 격려 메시지

### 3축 점수 (40/30/30 가중)
| 축 | 측정 | Threshold |
|---|---|---|
| 인토네이션 (40) | 피치 contour DTW (`pitchfinder` YIN) | PITCH_THRESHOLD=80Hz |
| 강세 (30) | RMS energy DTW | ENERGY_THRESHOLD=0.08 |
| 리듬 (30) | durationMs ratio | MAX 2.5 |

### 인프라 (`lib/echo/`)
- `pitch-extractor.ts` — YIN frame 2048 / hop 512 + voicedFrames
- `dtw-comparator.ts` — 3축 + `scoreFeedback` (great/good/fair/try)
- `audio-recorder.ts` — getUserMedia + MediaRecorder + playBothOverlay
- `tts-player.ts` — Web Speech API + voice 선택
- `sentence-splitter.ts` — 약어 Mr/Dr 처리
- `save-attempt.ts` — 세션 캐시 + attempt INSERT + finalize 통계 집계

### 컴포넌트 (`components/echo/`)
- `EchoMatchPlayer.tsx` — 4-Phase 컨트롤러 + sessionCache + attemptCountRef
- `MicPermissionGate.tsx` — 권한 요청 + 음성 즉시 삭제 안내
- `PhaseProgress.tsx` — 4 pill + 진행 %
- `SentenceCarousel.tsx` — Lora 18-22px
- `PitchVisualizer.tsx` — Canvas 2D devicePixelRatio + 원어민 var(--p) vs 사용자 var(--success) overlay + 정규화 min×0.9 max×1.1
- `ScoreCard.tsx` — overall 48px mono + 3축 weight % + tone 색

### DB (2 migrations)
- `echo_match_sessions` — user/text/library_book FK + avg/best/worst + retried_sentence_ids TEXT[] + RLS
- `echo_match_attempts` — session FK + sentence_id TEXT + attempt_number + 3축 점수 + duration_ms + RLS + idx user_date

### 알려진 한계 (4건)
1. Web Speech API TTS 출력 직접 audio 추출 불가 — `buildSyntheticRefContour` 합성 reference (자기 발화 변동성 측정에 가까움). Phase 2 에서 cloud TTS + Storage 캐싱으로 진짜 비교.
2. DTW threshold (80Hz/0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행.

---

## 11. Comic Reader (CCP · L0~L2 입력/프리뷰)

### 목적
도서를 만화(그림+정본 대사)로 읽는 **동기부여 프리뷰 정독**. Dual Coding(그림+언어) + Emotional Encoding(서사). 읽기 전 schema 형성 → 본문/ScriptQuiz/Dictation 유입 (소비 time-sink 아닌 방향성 있는 진입).

### 라우트
- `/text/[id]/comic` — ModePills input 그룹 "만화" 진입 (라이브러리 도서 + 발행 만화 존재 시). 없으면 EmptyState.
- `/comics` — **만화 단일 메뉴**(레일 밖 · 상단 Read 패널 하단 링크 줄 · `/library` 하위 탭 아님). redirect → `/comics/adapted`. 메뉴 안에서 **출처**로 나뉜다(ComicsTabs):
  - **Adapted `/comics/adapted`** — 도서 각색(CCP). 우리가 가진 원서를 모델로 각색. 카탈로그 + 이어서 보기(`comic_read_progress`). 등록 도서면 리더 직행, 미등록이면 상세로.
  - **Restored `/comics/restored`** — 원본 복원(PDCP). 저작권 만료 만화 원본을 수집·복원. 호 단위 독립 콘텐츠(원작이 만화 자체).
- `/comics/adapted/[bookId]` — 만화 상세. **미등록·비로그인도 프리뷰 3컷 열람**(아트만 — 정본 대사/vocab 은 리더 자산) + 포맷 선택. 시작 시 `enroll_library_book`(멱등) 후 리더 직행.
  - 명명: 기술(AI/스캔)이 아니라 **원작에 무슨 일이 있었는지**로 지은 과거분사 쌍 — 기술이 바뀌어도 이름이 낡지 않는다.

### 발견 (v07 CCP × Library — `docs/CCP_LIBRARY_INTEGRATION.md`)
만화는 **별도 콘텐츠가 아니라 같은 책(Work)의 다른 표현형(Expression)** — 데이터는 `library_books` 앵커, 탐색 UI 만 독립 코너화.
- **메뉴**: 상단 Read 패널의 **하단 링크 줄**(열 밖 · 번호 밖 — 학습 단계가 아니라 읽는 방식. v08.6 이전에는 사이드바 최상위). 2026-08-09 사용자 결정으로 LibraryTabs 4번째 탭에서 승격 — `/library` 탭은 3탭(도서/스크립트/공용 단어장)으로 복귀. 만화 액센트 = gold `--active`.
- **포맷 facet**: 장르 축과 직교. `BookFilterBar` "포맷" 구획(만화/원어민 음성) + QuickPick "만화로" + `BookGridCard` 배지(아이콘+sr-only).
- **선택**: `NetflixDetailSheet` 도서 상세에 gold 보조 CTA(만화로 읽기 / 만화 미리보기) + 만화 상세의 `ComicFormatChoice`(만화/원문/듣기 3카드, **권장 1개만** "지금 추천").
- **처방**: `lib/comic/prescribe.ts` — 이어보기 > 복습 > 난이도 > 미진단 순. 적정 난이도(ideal)에선 **본문을 권장**(만화는 스캐폴드).
- **조회 단일 출처**: `lib/comic/catalog.ts` (`fetchComicCatalog` / `fetchComicPreview` / `comicBookIdsOf`) — 도서 히어로 · 만화 탭 · 만화 상세 공유. `list_comic_catalog`(P1) 우선 + 구 RPC 폴백 2단.
- **분리 회계**: 만화 완주는 챕터 완료(`texts.status`)를 만들지 않음 — `comic_read_progress` 만 갱신(seductive details 방어).

### 리더 (`components/comic/ComicReader.tsx`)
- **Calm UI**: 앱 토큰 재스킨 · 2D 페이지 전환 + `prefers-reduced-motion` 즉시 컷 (아티팩트 3D 쇼케이스와 분리).
- **대사 non-cover**: 아트는 contain(온전) · 대사는 아래 대사존 (캐릭터 안 가림).
- **Desirable Difficulty**: verbatim(정본) 버블 blur→tap-reveal **기본**(회상 유도).
- **Context-Dependent vocab**: `target_vocab`(verbatim 버블 정합) 칩 → 단어 팝오버. 원문/퀴즈와 단어 일치.
- **Journey**: 마지막 = 본문 읽기 / 퀴즈 CTA. 폭죽/트로피 없음(차분한 "잘 읽었어요").

### 데이터 (발행 게이트 DEFINER RPC)
- `select_book_comic(book, chapter)` — published 만화만. 리더 RSC(`comic/page.tsx`)가 texts→library_book 분기 후 호출, 실패/미발행 EmptyState degrade.
- 생성/발행은 Admin `/admin/comic`(CCP). 상세: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.

### Phase
- P1: 리더 실 구현 + 안전 degrade. P2: blur→reveal 자가판정→`learning_records`(FSRS) + 이해 micro-check. P3: 진도(module_history 'comic') + FloatingSparkle 유입.

---

## 아케이드 스위트 — Game Lab (게임 19종 · v08.3)

### 목적
9모듈이 커버하지 않는 인지 채널(문맥 추론 · 철자 규칙 귀납 · 의미망 · 형태론 · 청각)을
검증된 인디 게임 원형으로 훈련. 모듈이 아니라 **모듈 위에 얹히는 놀이 표면**.

### 라우트
- `(main)/arcade` — 허브 (상단 Practice 패널 「놀이로」 열의 Game Lab ③ · `/hub` ArcadeEntryCard)
- `(app)/play/<slug>` — 게임 본체 19종 (풀스크린 · SessionFrame 자동 주입)

### 카탈로그 SSoT — `lib/game/catalog.tsx`
게임 정의(이름 · 태그라인 · 인지계층 · 무드 4색 · 라인 마크 · `source` · `minWords` · `closeHref`)의 유일한 출처.
`GameMark`(gamekit) · `SESSION_META`(SessionFrame) · 진입 카드 문구 · 아케이드 그리드가 전부 여기서 파생된다.
**게임을 추가할 때 손대는 곳은 카탈로그 1곳 + `/play/<slug>/page.tsx` + `ArcadeGameId`/`ModuleId` enum.**

### 계열(family) — 같은 인지 루프는 한 장으로 접는다
실측 대조 결과 **`wordblitz`·`daily-blitz`·`word-economy`·`ghost-race` 4종(1,604줄)이 완전히 같은 루프**였다 —
`target.ko` 프롬프트 → 4지선다 en 타일 → `o.en === target.en`. 다른 건 게임이 아니라 위에 얹은 메타(타이머·데일리·경제·경쟁)뿐.

지우지 않는 이유: 학습적으로 같아도 **동기 장치로는 다르고**, 같은 문답 위에 모드를 얹는 구조는 Gimkit이 검증했다.
진짜 문제는 존재가 아니라 **19장을 동급 카드로 평평하게 깔아 "또 같은 거네"로 읽힌 것** → 허브에서 계열 1장으로 접는다.

- `GAME_FAMILIES` (계열 정의) + `GameEntry.family` / `modeLabel` / `modeNote` / `modeOrder`
- `hubSections()` → 섹션별 `HubItem[]`(`{kind:'game'}` | `{kind:'family', modes}`). `countHubGames()` 로 배지 산출
- 계열은 **쪼개지지 않는다** — 멤버 다수가 속한 섹션으로 통째 이동(blitz = mine). 소수파 모드는 칩 설명에 명시(데일리 = 내장 뱅크)
- 계열 카드는 `<a>` 가 아니다(중첩 앵커 금지) — 카드는 컨테이너, **모드 칩 하나하나가 플레이 링크**
- 멤버가 1개면 접지 않는다. 게임 코드는 무변경 — 접기는 순수 표시 계층

**유지한 약한 중복** — `letter-forge`(글자 제공) → `wordsmith-vigil`(무단서 타이핑)는 Desirable Difficulty 계단,
`connections`(선택 분류) ↔ `lexicon-estate`(공간 배치)는 입력 방식이 달라 학습 경험이 구분된다.

### 데이터 소스 (`source`) — 옛 1차 분류축, 지금은 죽어 있다
| source | 수 | 의미 |
|---|---|---|
| `mine` | 19 | 내 단어로 플레이 → FSRS 갱신 (`minWords` 1~8) |
| `bank` | 0 | 내장 뱅크 전용 — v07.8 에서 전 게임이 학습자 단어를 쓰게 되며 소멸 |

v07.8 이후 19종 전부가 `mine` 이라 이 축으로는 아무것도 갈리지 않는다(허브 분류축이
학습 동사 = `HUB_TRACKS` 로 교체된 이유). 필드 자체는 `pickDailyGame`·타입 호환을 위해 남아 있다.

### 스코프 3단 (`lib/game/use-word-scope.ts`)
1. **explicit** — `?set=` / `?text=` (+`?chapter=`) → `fetchScopedWords`. 단어 부족 시 `NotEnoughWords` 안내(몰래 바꿔치지 않음).
2. **mine** — 스코프 없음 + `minWords>0` → `fetchDueGameWords`(due 우선 cap 40). **아케이드 기본값.**
3. **demo** — ①②로 최소 단어 미달 → 게임 내장 맛보기 풀. 브레드크럼에 "맛보기 단어"로 명시(기록되지 않는 플레이를 오인시키지 않음).

**훅으로 뽑은 이유** — 스캐폴드(17종)와 독립 3D `/play/wordblitz` 가 스코프 로직을 각자 복제하고 있었다.
카탈로그가 `source:'mine'` 이라 광고하는데 실제로는 내 단어를 안 쓰는 불일치가 실제로 발생했으므로,
두 경로가 같은 훅을 쓰게 강제한다. 브레드크럼 매핑은 `lib/game/scope-resource.ts`.

### 세션 기록 (`lib/game/use-session-recorder.ts`)
정/오답 집계 → `scores` 적재 + 아케이드 XP·스트릭 적립. **언마운트에서도 flush**(1회 가드).
게임 내부 종료 버튼뿐 아니라 세션 셸 X·Esc·브라우저 뒤로까지 덮는다 —
예전엔 `onExit` 에만 걸려 있어 X 로 나가면 `learning_records` 만 남고 `scores`·XP 는 통째로 유실됐다.

### 허브 IA — Game Lab (v08.3)
① **Lab Status**(스트릭·랭크·오늘의 할당량·앰비언트) → ② **Lab Index**(구역 목차) →
③ **Today's Experiment** 1종(KST 날짜 시드 결정론 회전) → ④ **Bay 01/02/03**.
근거: choice overload(선택지 과다 = 마비) vs SDT 자율성 → "추천 하나 + 전부 열람".
19장이 한 화면에 깔리므로 목차(Lab Index)가 앞에 선다.

**연구소 은유 · 영문 구조 라벨** — 이 화면이 실제로 하는 일은 19개의 서로 다른 실험 장치 중
오늘 어느 것을 돌릴지 고르게 하는 것이다. "아케이드(오락실)" 은 각 게임이 왜 다른 판돈 구조
(시계·거리·자본·박)를 갖는지 말할 자리를 주지 못했다. 구역(Bay) · 실험 코드(`RC-01`) ·
프로토콜(브리핑) · 시운전(Trial Run) 이 그 자리를 만든다.
**구조 라벨만 영문**이고 설명 문장은 한국어다 — 대상 독자(한국 고등학생~성인)에게
설명까지 영어로 주면 비용만 는다.

- `HUB_TRACKS[].code` = 구역 접두(`RC`/`SY`/`IN`) → 카드 코드는 표시 순번에서 파생(`labCode`)
- 카드 = `.arc-slot`(컨테이너) > `<a class="arc-card">` + `<button class="arc-brief">` **형제**
  (중첩 인터랙티브 금지 · e2e 가 `.arc-grid a[href^="/play/"]` 수로 도달 가능 게임 수를 못박는다)

### Protocol 브리핑 — `lib/game/brief/` + `components/game/brief/*`
게임을 고르는 근거가 이름·색·태그라인뿐이라 선택이 사실상 찍기였다. 카드 우상단 `(?)` 가
**보드 그림 3장 + 눌러서 통과하는 Trial Run** 을 연다.

- `GAME_BRIEFS` — 게임당 `objective` · `board` · `figures[3]` · `trial` · `facts`. 문구는 전부
  각 게임 소스 헤더의 계약에서 끌어왔고, 추측한 수치 대신 게임이 정의한 단위(3랩·20틱·4회랑)로 말한다.
- **아키타입 5개** `pick` / `group` / `assemble` / `judge` / `type` — 19종의 표면은 다 달라도
  학습자의 손동작은 다섯으로 수렴한다. 하나의 렌더러(`BriefBoard`)가 `figure`(정적 삽화)와
  `trial`(실제 클릭) 두 모드로 쓰인다 — 설명에서 본 그림과 눌러 보는 그림이 같아야 배운 것이 이어진다.
- 스크린샷을 쓰지 않는 이유: 게임이 바뀌면 조용히 거짓이 되고, 스크린리더·대비·터치 타겟을 통제할 수 없다.
- 계열은 탭으로 4모드 전환(`GameBriefModal entries[]`). `Launch` 는 허브가 계산한 **스코프 포함 URL**.
- 이 다이얼로그는 세션 진입 **전** 국면에만 열린다(세션 중 인출을 끊지 않는다). (모달 금지 규칙은 DD-66 으로 삭제.)

#### v08.4 — 전수 평가 → 표현력 확장 → 19종 재설계

읽기 전용 평가자 5명이 소스 대조로 채점한 결과 **평균 9.6/20**(결함 132건), 축별로
identity 2.32 · motion 2.32 · **decisive 1.11** · truth 2.05 · surface 1.79. 다섯 평가자가
독립적으로 같은 결론에 도달했다 — **계열 안에서 브리핑이 구별되지 않는다.** 19종 중 11종이
`pick` + 1스텝 "뜻 고르기"라서 trial 을 서로 바꿔 끼워도 통과했다(그건 19종 공통 동작이므로
그 게임을 아무것도 구별해 주지 못한다).

원인은 문안이 아니라 **데이터 모델**이었다. 게이지가 하나뿐이라 판돈의 절반이 지워지고,
프롬프트가 판 전체에 고정이라 국면 전환을 말로만 알리고, 판돈 2택을 정답 타일과 같은 격자에
섞어야 했고, 타이핑 표면이 없어 세 게임(`wordsmith-vigil` · `ghost-race` 아웃코스 ·
`silent-rule` 봉인)의 손동작을 **거짓으로 적을 수밖에 없었다**(motion 0점).

| 확장 프리미티브 | 여는 것 | 채택 |
|---|---|--:|
| `hud: BriefGauge[]` + `pips` + `value` | 압력이 둘 이상인 게임 · 셀 수 있는 예산(촛불 3·목숨 3·기회 4) | 게이지 48개 · 핍 14종 |
| `BriefSurface`(스텝·프레임별 `prompt`/`doc`/`headword`/`hud`) | "D 를 누르면 화면이 바뀐다" 같은 국면 전환 | 19종 |
| `board.choices` 결정 스트립(격자 **밖**) | 판돈 2택 — 답이 아니라 결정임을 형태로 구별 · `lines` 로 손익 수치 대비 | 18종 |
| `token.at: [row, col]` 좌표 격자 | 위치 자체가 결정(cascade "가장 낮은 장/돌 옆/뭉친 장" · lexicon-estate 도면 인접) | 2종 |
| `token.effect` 비용 타일 | 대가를 내고 정보를 사는 타일 — 누르면 게이지가 실제로 깎이고 **오답이 아니라 지출**로 처리 | 7종 |
| `kind:'type'` + `step.type` 타이핑 | 후보 없이 칸 수만 보고 철자를 치는 게임 | 3종 |

결과: trial 스텝 평균 **1.1 → 2.7**. 1스텝 재인만 시키는 게임 0.

- 파일을 계열별로 나눴다(`brief/{recall,stake,assemble,rule,special}.ts` + `types.ts` + `index.ts`).
  한 파일에 19종을 몰면 **옆 게임의 브리핑이 보이지 않아 서로 베낀 튜토리얼이 된다** — 실제 원인.
- 무결성은 `__tests__/brief.test.ts` **33개**가 강제 — `want`/`focus` 참조 무결성(누를 수 있는 것
  = 토큰 + 결정 카드), 슬롯 수 = 정답 길이, ok 고아 검출, 비용 타일의 `want` 금지, 좌표 충돌,
  핍 `left ≤ total`. 오타 하나가 "영원히 통과 못 하는 튜토리얼"을 만들기 때문에 눈으로는 안 잡힌다.
- **최적합 계약 4개**(같은 파일)가 회귀를 막는다 — ① 1스텝 재인 금지 ② 판돈이 화면에 보임
  ③ 두 게임의 트라이얼 서명이 겹치면 실패 ④ objective 가 19종 공통 서술이면 실패.
  ③은 계열을 가로지르는 충돌(`daily-blitz` ↔ `word-economy`)을 실제로 잡았고, 확인해 보니
  구별은 실재했다 — 전자는 선택지를 **보기 전에** 걸고 후자는 체결에 **성공한 뒤에만** 열린다.
  서명이 결정의 위치를 담지 않아 생긴 오탐이라 서명에 그 차원을 넣었다.
- `tests/e2e/15-arcade-brief.spec.ts` — **19종 전수**를 브리핑 데이터로 구동한다(`want` 를
  순서대로 누르고 타이핑 스텝은 실제 입력). 데이터와 화면이 어긋나면 즉시 실패한다.
  단위 테스트가 잡지 못하는 것 — 렌더러가 그 프리미티브를 실제로 그리는지, 판정이 결정 카드·
  타이핑·비용 타일을 받는지 — 은 눌러 봐야만 안다. 22/22 통과(1.7분).
  타일 셀렉터는 `data-id` — cascade 는 같은 정답이 세 자리에 깔려 텍스트로 구별이 불가능하다.

### 리텐션 메타
`lib/game/arcade-meta.ts` — localStorage 스트릭(하루 유예) · XP/레벨(√곡선) · 데일리 목표 30XP.
`ArcadeMetaStrip` 노출(v08.3 라벨: Streak · Rank · Daily quota · Ambient).

### 배경음악
### v07.8 — 19종 전수 재설계 (감사 → 재설계 → 적대적 반증 → 강화)

게임별 병렬 에이전트로 4라운드를 돌렸다. 루브릭 10축 평균 **23.1 → 34.8 / 50**.

**1R 감사** — 재미 이전에 **제품 유효성** 결함이 나왔다. 게임 7종 이상이 영어를 한 글자도
몰라도 이길 수 있었고(정답이 화면에 인쇄돼 있었다) 그 결과가 FSRS 로 "학습했다"고 기록됐다.
축 평균 tensionCurve 1.42 · decisions 1.47 · streakHook 1.79 · learningIntegrity 1.95.

**2R 적대적 반증** — 재설계 결과를 점수 재측정이 아니라 **싸게 이기는 방법 찾기**로 검증했다.
익스플로잇 **42건**, 구현자 주장 중 **불성립 27건**. 전부 코드 근거 + 시뮬 수치 동반
(예: word-economy 의 "지분 상시 매입"이 7개 정답률 밴드 전부에서 자산 2~3배).

**3R 강화** — 수정 후 같은 시뮬로 재계산해 숫자로 확인: 지분 자산비 2.25~2.95 → 0.62~1.28 ·
정답률 0.5~0.7 학습자 파산률 83% → 17% · ghost-race 리빌 후 4문항 내 재출제율 100% → 2% ·
word-orrery 소거 확정 문항 16.67% → 0%.

⚠️ **분류축 교체** — 19종이 전부 학습자 단어를 쓰게 되면서 `source`(mine/bank) 축이 죽었다.
그대로 두면 "큐레이션 세계" 섹션이 비고, `pickDailyGame` 이 빈 후보로 크래시한다
(`from[NaN]` → undefined → 단어 6개 미만 학습자의 `/arcade` 사망). 새 축은 **학습 동사**
(L계층 진행과 같은 순서): `빠르게 떠올리기(6)` · `직접 만들어 내기(6)` · `읽고 추론하기(7)`.
`HUB_TRACKS` + `trackOf()` 로 카탈로그에 명시 — layer 문자열 파싱 금지(오분류가 조용히 생긴다).

**FSRS 무결성 (중앙 · `lib/game/record-result.ts`)** — 가장 큰 남은 결함은 재미가 아니라
학습 스케줄 오염이었다. 게임마다 판단하게 두면 19가지 기준이 생기므로 중앙에서 막는다:
- `assisted: true` → 카드 미갱신. 정답을 이미 보여준 뒤의 입력은 인출이 아니다.
- **같은 카드 10분 재채점 금지.** FSRS 는 독립 인출 1회를 전제하는데 실측상 ghost-race 는
  레이스당 36회 채점, word-economy 는 방치만으로 90초에 lapse 7회였다.
- 스캐폴드 계약 `onCorrect(word, { assisted })` — 기존 호출은 그대로 동작.
- ⚠️ 게임이 `onCorrect/onWrong` 을 **아예 안 부르는 쪽으로 도망가면 안 된다**. letter-forge 가
  그랬고 결과는 "합리적 플레이어일수록 모르는 단어를 FSRS 에서 지운다"였다.

**minWords 와 자료 크기** — 강화로 요구 단어가 올라가면 도서 챕터가 게임을 못 연다
(`useGameWordScope` 는 explicit 스코프 미달 시 NotEnoughWords 로 **차단**한다).
DB 실측 653세트: ≥24단어 371(57%) · ≥20 414 · ≥16 448 · ≥12 487 · ≥8 554(85%) · 최소 1.
게임은 **풀 크기의 함수로 스케일 다운**해야 한다(cascade 가 goal·장수·시간 곡선을 전부
함수화해 5단어 챕터도 성립시킨 것이 모범). 카탈로그 `minWords` 는 라우트 실값과 반드시 일치.

**회귀 스펙** — `07-arcade-games`(19종 마운트+첫 입력+콘솔에러 0 · 준비 마커는 **조작 가능한
요소**로 잡을 것) · `13-arcade-integrity`(자료 연계 — A 라벨 · **A3 실제 단어 노출** ·
B 허브 팬아웃 · C 스크립트 진입).
⚠️ A3 가 필요한 이유: 라벨만 맞고 실제 문제는 내장 콘텐츠인 경우를 A 가 못 잡는다
(morpheme-rules 가 그랬고 `onCorrect/onWrong` 의 99.7% 가 silent skip 됐다).

---

**v07.7 — 측정으로 선곡 + 마디 정렬 루프.** 요구는 "웅장하면서 긴장감과 긴박감, 빠른 템포".
v07.6 의 Scott Buckley 세트가 이를 못 맞춘 이유는 **측정 가능했다**: 후보 118곡
(Buckley 72 + Nakarada 46)을 재보니 Buckley 라이브러리 대부분이 `pulse`(자기상관 피크 선명도)
≈ 1.0 — 박이 노이즈와 구별되지 않는 앰비언트였다. 제목이 아무리 장엄해도 몰아치지 않는다.

측정 축: `bpm`(온셋 포락선 자기상관) · `onset/s`(초당 어택 = **긴박**) · `pulse`(박 선명도 = 추진) ·
`low%`(150Hz 이하 온셋 에너지 = 타격) · `full%`(RMS 가 피크 60% 이상인 시간 비율 = **웅장**) ·
`tension`(2~6kHz 시간 변동 = 트레몰로·스타카토·불협).
**Alexander Nakarada**(creatorchords.com · CC-BY 4.0)가 전 축에서 크게 앞서 19슬롯 중 16을 가져갔다.
전 곡 **129~161 BPM**, 19종 고유 트랙(재사용 0), 총 33.3 MB.

루프는 **마디 정수배**로 자른다 — `loopLen = bars × 4 × 60/bpm`, 크로스페이드도 1마디.
그래야 꼬리(start+loopLen)와 머리(start)의 **박 위상이 같아져** 크로스페이드가 박 위에 얹힌다.
임의 길이로 자르면 겹박(플램)이 나 추진력이 뭉개진다. 길이는 템포에 따라 109.5~110.6초(59~74마디).
정규화 -16 LUFS / TP -1.5 dBTP → VBR MP3(-q:a 5) 44.1kHz 스테레오.

⚠️ 루프를 다시 구울 때 **크로스페이드가 조용히 사라지는 경로가 둘** 있다. 둘 다 파일은 HTTP 200 이고
재생도 되는데 딱 1마디 짧고 루프마다 클릭이 난다:
① 한 입력을 `asplit=3` 으로 쪼개 `atrim` 셋을 물리면 `acrossfade` 가 빈 스트림을 받는다 →
head/tail/body 를 각각 별도 `-i` 로 열 것.
② `-t X` 로 뜬 조각이 MP3 프레임 경계 때문에 X 보다 살짝 짧으면 `acrossfade=d=X` 가 성립하지 않는다 →
`X+0.4`초를 떠서 필터 안에서 `atrim` 으로 정확히 자를 것.
빌드 스크립트에 출력 길이 == loopLen 단언을 두고, 회귀는 `tests/e2e/12-arcade-audio.spec.ts` 가 잡는다.

트랙은 카탈로그 `GameEntry.music`(`public/audio/games/<slug>.mp3`). 크레딧은 같은 폴더 `CREDITS.txt`
+ `/arcade` 푸터 표기(CC-BY 4.0 은 표기 의무 — 두 아티스트 모두 명시).
선호는 `lib/game/music-pref.ts` 단일 키(`vocaflow-arcade-music`) — **허브 토글**(`ArcadeMetaStrip`)과 **게임 내 버튼**(`GameMusic`)이 공유.
**기본 ON**(v07.6 사용자 결정 — 단어 게임에 음악이 중요). 이전 기본 OFF 는 Calm UI 근거였지만 결과가
무음이었다(토글 전에는 트랙을 내려받지도 않음). 자동재생 정책은 `play()` 거부 시
다음 제스처(`pointerdown`/`keydown`)에 시작하는 방식으로 처리 — 타이핑 전용 게임 때문에 `keydown` 이 필수.
미결정 상태에선 게임 내 버튼이 "배경음악" 라벨을 펼쳐 지금 나는 소리의 출처와 끄는 길을 알린다.
`readMusicPref()` 는 미설정을 `null` 로 유지하고, 실제 on/off 판단은 `readMusicOn()`(= `?? DEFAULT_MUSIC_ON`)을 쓴다
— 명시적 OFF 를 기본값 변경이 덮어쓰지 않게 하기 위해서.

**효과음(v07.6)** — Kenney "Interface Sounds"(CC0) → **Mixkit 실녹음**. FFT 실측상 기존 6종은 전부 모노 ·
8 kHz 이상 에너지 0~0.6% · `correct`/`complete` 는 스펙트럴 평탄도 0.0000 인 대역제한 합성음이었다.
교체본은 스테레오 실녹음(벨 · 나무 타격 · 반짝임 · 타자기 타건 · 실제 동전 · 금관 합주 · 총 494 KB).
`useSfx` API·`SFX_SRC` 확장자 매핑 불변 → 게임 코드 변경 0. 오답이 버저가 아니라 나무 타격인 것은
Empathetic Feedback 의 적용이다.

⚠️ `.gk-root > :not(...)` / `.wbz-root > :not(...)` 같은 자식 일괄 규칙에 **반드시 `:not(.gk-music-btn)` 을 넣을 것** —
빠뜨리면 명시도에 밀려 `position: fixed` 가 죽고 버튼이 흐름에 박힌다(v07.4 이전 전 게임 증상).
gamekit 을 쓰지 않는 게임(WordBlitz · Pirate's Bounty)은 `GameKitStyles` 를 함께 렌더해야 버튼 스타일이 적용된다.

---

## 기출 분석 — 오답 지도 · 시간 띠 (v06.34 · 2026-09-15)

전달 모델 정본은 **[CSAT_LEARNER_DELIVERY.md](./CSAT_LEARNER_DELIVERY.md)** 다 (왜 이 구조인가 ·
5단계 중 무엇이 아직 없는가 · 이 작업에서 실제로 틀렸던 것 6건). 여기에는 **무엇이 어디 있는지**만 적는다.

**정보 구조를 뒤집었다.** 1급 시민이 「유형 26개」에서 **「오답 만드는 법 9개」**로 옮겨 갔다 —
`choice_analysis` 의 오답 선지 **3,208개**(문항마다 최신 버전 하나)를 전부 세면 아홉 가지가
**60.3%** 이고 각각 **26유형 중 13~17유형**에 걸친다. 10위부터는 4~5유형으로 뚝 떨어진다.

| | |
|---|---|
| 굽는 쪽 | [`scripts/csat/build-trap-atlas.mjs`](../scripts/csat/build-trap-atlas.mjs) — DB 집계 → JSON. `--check` 로 낡음 판정 · 재실행 안전 · 영어 연속 200자 유출 검사(걸리면 아무것도 안 쓴다) |
| 산출물 | `lib/csat/trap-atlas.json` (59KB) |
| 순수 모델 | [`lib/csat/trap-atlas.ts`](../apps/web/src/lib/csat/trap-atlas.ts) — `rankFor`(범위별 재집계) · `baselineShare`/`liftOf`(배수 · **분모를 이름 붙은 것끼리 맞춘다**) · `standoutFor`(카드가 같은 말을 반복하지 않게) · `DETECTOR`(우리가 쓴 「잡는 법」 20줄 — **센 값이 아니다**) |
| 화면 | [`components/csat/TrapAtlas.tsx`](../apps/web/src/components/csat/TrapAtlas.tsx) — 허브(`as="h1"` · 유형 칩)와 유형 화면(`showLift` · 칩 없음) 둘이 같은 컴포넌트를 쓴다 |
| 작업 공간 | [`components/csat/space/SpaceScreen.tsx`](../apps/web/src/components/csat/space/SpaceScreen.tsx) + [`lib/csat/space-model.ts`](../apps/web/src/lib/csat/space-model.ts)(순수) — `/csat/space`. **같은 구운 JSON 을 세 번째로 쓰는 화면**이고 DB 왕복이 0 이다. 유형 26 · 함정 32 를 한 표에 놓고, 무늬 띠는 그 표의 그림이다(원 하나 = 한 줄 · 지름 = 그 줄의 양 · 난수 없음). 줄을 펼치면 `DETECTOR` 한 줄 · 넓이 · 예시 기출(`/csat/item/[slug]`) · 서가 카드 넷 |
| 시간 띠 | [`lib/csat/plan-timeline.ts`](../apps/web/src/lib/csat/plan-timeline.ts)(순수 — `buildTimeline`·`clampSpeed`) · [`components/csat/PlanTimeline.tsx`](../apps/web/src/components/csat/PlanTimeline.tsx) |
| 내 기록 (④재기) | [`lib/csat/my-traps.ts`](../apps/web/src/lib/csat/my-traps.ts) — **표본 문턱을 여기서 쥔다**(함정당 3회 · 전체 20회). 넘기 전에는 배수를 말하지 않고 센 것만 보여 준다. `returningCardIds`·`drillBias` 가 기록을 **다음 훈련 세트**로 되먹인다(24시간 지난 최근 오답 · 문턱 넘은 약한 수법) |
| 순서 (⑤주파) | [`lib/csat/plan-order.ts`](../apps/web/src/lib/csat/plan-order.ts)(순수 — 내 약점 × 유형 구성) · `plan/PlanList.tsx`(토글). ⚠️ **시간 띠는 정렬하지 않는다** — 시험은 번호대로 치러진다 |
| 계측 | `csat_atlas_scoped` · `csat_trap_opened` · `csat_plan_speed_set` (`lib/analytics/events.ts` 닫힌 목록 · 훈련 2종은 2026-09-17, 개인 정렬 `csat_plan_ordered`는 관리자 공용 계획 분리와 함께 은퇴) |
| 자 | [`apps/web/scripts/csat-surface-measure.mts`](../apps/web/scripts/csat-surface-measure.mts)(수치) · [`csat-shot.mts`](../apps/web/scripts/csat-shot.mts)(눈) |
| 훈련 (③겨루기) | [`lib/csat/trap-drill.ts`](../apps/web/src/lib/csat/trap-drill.ts)(순수 — 보기 만들기·채점·누설 검사) · [`drill-loader.ts`](../apps/web/src/lib/csat/drill-loader.ts)(구운 풀에서 여덟을 고른다 · **DB 0**) · [`components/csat/TrapDrill.tsx`](../apps/web/src/components/csat/TrapDrill.tsx) · [`scripts/csat/build-trap-drill.mjs`](../scripts/csat/build-trap-drill.mjs) → `drill-data/pool.json` (**1,013문제** · 539KB) |
| 굽기 | `pnpm csat:atlas` · `csat:atlas:check` · `pnpm csat:drill` · `csat:drill:check` (전부 낡으면 exit 1) |
| 회귀 | 순수 **96**(`trap-atlas` 18 · `plan-timeline` 12 · `trap-drill` 16 · `trap-drill-pool` 13 · `my-traps` 12 · `plan-order` 11 · `drill-feedback` 15) + **실 DB 2**(`trap-atlas-fresh.integration.test.ts` — 실 DB 에서 셈을 다시 해 구운 값과 견준다. **2026-09-16 에 실제로 잡았다**: 분석이 늘어 함정 이름 513→518 · 구운 지도가 낡음) + `trap-drill-fresh`(훈련이 **옛 정답으로 채점**하는 것을 잡는다 — 변이로 확인) + 런타임 **27**(`tests/e2e/45-csat-trap-atlas.spec.ts`) |

**실측 — 학습자 7화면 합계 (2026-09-15)**

| | 전 (6화면) | 후 (7화면 — 훈련이 새로 생겼다) |
|---|---|---|
| 보이는 글자 | 27,772 | **15,634** (-44%) |
| 가장 긴 산문 덩어리 | **1,084** | **274** |
| 접힌 위 글자 (1280×900) | 6,531 | **3,525** (-46%) |
| 접힌 위 **작동하는 증명** | **0** | **9** (7화면 전부 ≥1) |
| 조작 컨트롤 | 1 | **71** (7화면 전부 ≥1) |

⚠️ **`data-proof` 는 계측기가 보는 표식이다** — 막대가 `div`/`span` 이라 `svg` 로는 안 세어진다.
그런데 표식만 보므로 **칠해지지 않은 막대도 「증명 1개」로 센다**(실제로 한 번 그랬다 — 위 문서 §6-3).
그래서 런타임 회귀가 「칸의 배경이 투명하지 않은가」를 따로 본다.

---

## 기출 해설 강의 — 하이라이트 동기 TTS (2026-09-17)

`/admin/kice/item/[slug]`(분석 뷰)와 기존 학습자 세션 ② 이해(현재 해부 흐름으로 대체)에서 **강의 듣기**를 누르면 브라우저 목소리가 강의식 대본을 읽고, 대본이 지금 설명하는
분석 블록(또는 지문 지도의 문장 막대)만 진하게 빛난다. 대본은 화면에 글로 나오지 않는다 — **낭독이 아니라
지목**이 강의를 만든다(원문은 「여기 세 번째 문장」처럼 자리로 가리킨다). 지시문
[docs/csat-lecture-tts-brief.md](./csat-lecture-tts-brief.md) · 결정 [docs/csat-lecture/DECISIONS.md](./csat-lecture/DECISIONS.md).

| | |
|---|---|
| 스키마 | [`lib/csat/lecture/types.ts`](../apps/web/src/lib/csat/lecture/types.ts) — 강의 = 큐 목록. 큐 = 역할(intro→…→wrapup) · 타깃(`analysis:<블록>` · `anchor:sentence:k`) · 한/영 조각 · 추정 초 · 쉼. **엔진에 관한 필드가 없다** — 서버 TTS 로 바꿔도 그대로 |
| 타깃 목록 | [`targets.ts`](../apps/web/src/lib/csat/lecture/targets.ts) — 해설 화면이 **실제로 그리는** 블록 id. 화면과 드레인이 같은 함수를 부른다 |
| 낭독 표기 | [`speakable.ts`](../apps/web/src/lib/csat/lecture/speakable.ts) — ①→「일 번」 · 학년도 · 번 · 달(유월·시월) · 퍼센트 · (A)→「에이」. 추정 초 계수는 Gate 0 실측(한국어 초당 4.0음절) |
| 검사기 | [`validate.ts`](../apps/web/src/lib/csat/lecture/validate.ts) — 구조·타깃·낭독 표기·원문 8단어 인용·분석 베껴 읽기·길이·지시어·무근거 판정·**pointing**(「여기 N번째 문장」↔ 켜진 막대) + 기계 채점(낭독 10 · 시간 10) |
| 말한 막대 | [`focus.ts`](../apps/web/src/lib/csat/lecture/focus.ts) — 칩·지도를 켠 큐가 「N번째 문장」이라 말하면 그 번호(`focus`)를 싣고, 지도가 켜려던 막대에 없으면 **말한 막대를 켠다**(판정은 그릴 때). 소급 `backfill-focus.mts` |
| 어댑터 | [`tts.ts`](../apps/web/src/lib/csat/lecture/tts.ts) — `WebSpeechAdapter`(문장 단위 발화 · 언어별 목소리 · 감시 시한 · 발화 준비 시간 이동평균) · `SilentAdapter`(목소리 없는 기기) |
| 엔진 | [`player.ts`](../apps/web/src/lib/csat/lecture/player.ts) — 큐 순서 · 붙들기(쉼 − 앞당김) · 건너뛰기(앞 발화를 끝까지 취소한 뒤) · 탭 이탈 시 멈춤·복귀 · 기록 |
| 읽기 | [`store.ts`](../apps/web/src/lib/csat/lecture/store.ts) — 커밋된 `lecture-data/<회차>.json`. 화면은 **길이만**, 대본은 `GET /api/csat/lecture` 로만 |
| 무대 | [`components/csat/lecture/LectureStage.tsx`](../apps/web/src/components/csat/lecture/LectureStage.tsx) — 재생 중에만 `data-lecture-state`(active·path·inside·dim)를 DOM 에 단다 · 접힌 층을 편다 · 큐마다 스크롤 한 번 · 블록 클릭 = 그 블록 설명부터 · Space/←/→ |
| 재생 바 | [`LecturePlayerBar.tsx`](../apps/web/src/components/csat/lecture/LecturePlayerBar.tsx) — 재생/멈춤 · 속도 0.9/1.0/1.15 · 이전/다음 · 역할 아이콘 눈금(글자 없음) · 무음 모드 안내 |
| 지문 지도 연동 | `PassageMap` — 섹션·칩·문장 막대에 타깃 속성, 강의가 칩을 가리키면 그 근거를 편다(계측 안 셈) |
| 드레인 | `scripts/csat-lecture/drain-export.mts` → 작성(`WRITER.md`) → 독립 심사(`GRADER.md`) → `drain-import.mts`(검사·채점 합산·**stale-grade** · 사실 오류 탈락 · 적재) · 재작업은 고친 문항만 `.regrade.json` 에 새로 채점해 `merge-regrade.mts` 로 합친다 · 현황 `gate4-status.mts` · 최종 `final-checks.mts`(F3·F4·F5) · `f2-bundle.mts --dist` |
| 게이트 | Gate 0 `tts-probe.mts` · Gate 2 `gate2-play.mts`(진짜 Chrome·Edge 를 CDP 로 — Playwright 가 띄운 브라우저는 음성 0개) · Gate 3 `gate3-input.mts`(정답표 없는 학습자 역할) — 리포트 `docs/csat-lecture/` |
| 계측 | `csat_lecture_played`(mode·from·rate) · `csat_lecture_ended`(cues·jumps·mode) — 허용 목록 마이그레이션 `20260917150000` |
| 회귀 | 순수 33(`lib/csat/lecture/__tests__/core.test.ts`) + 런타임 3(`tests/e2e/46-csat-lecture.spec.ts` — 무음 완주 · 375px · 키보드 · 서버 HTML 에 대본 0 · 블록 클릭) |

---

## 기출 서가 · 출제 사고(옛 「해설 극장」) — 802문항 자유 탐색 (2026-09-23)

학습자가 열 수 있는 문항이 **12개**였다(오늘의 해부가 요구하는 손질된 메타데이터를 가진 것만).
자료는 처음부터 **802문항 전부 공개 분석 · 792 강의 · 666 지문 지도**였다. 게이트를 걷고 두 화면을 세운다:
**서가**(`/csat` 안 · 네 축으로 좁혀 고른다)와 **극장**(`/csat/item/[slug]` · 왼쪽 차례 · 오른쪽 지도와 블록).
설계 정본 [csat-learner/analysis-theater.md](./csat-learner/analysis-theater.md).

| | |
|---|---|
| 서가 규칙(순수) | [`lib/csat/browse-model.ts`](../apps/web/src/lib/csat/browse-model.ts) — `examAxis`(수능/모의·학년도·월) · `browseExamOrder`(최근 학년도 → 수능 → 9월 → 6월) · `filterBrowse`(축 넷 **AND** + 찾기, 번호는 완전 일치) · `groupByExam` |
| 서가 로더(서버) | [`lib/csat/browse.ts`](../apps/web/src/lib/csat/browse.ts) — `csat_items_public` 802행 + 강의 색인 + 골격 앵커 → 문항마다 `lecture`·`map` 플래그. 프로세스 캐시 10분. **지문·선지·발문은 읽지 않는다**(`stem` 컬럼이 있어도) |
| 서가 화면 | [`components/csat/browse/CsatWorkspace.tsx`](../apps/web/src/components/csat/browse/CsatWorkspace.tsx) — `/csat/browse`. 홈과 같은 메뉴 · 결. 회차 단위 번호 칩 · 강의 없는 문항은 **점선**, 연 문항은 옅게 · 「아무거나 한 문항」 · 쿼리 `?type` `?exam` `?status` `?from` `?q` |
| 기출 찾기 | [`components/csat/browse/ItemFinderDialog.tsx`](../apps/web/src/components/csat/browse/ItemFinderDialog.tsx) — 4구획 팝업(조건 · 회차 · 문항 · 요약). 입구: 문항 머리 `item-finder-open-btn` · 비교 없음 `V3CompareExplorer onFindOther` · 서가 `browse-finder-open` · 지도 홈 `home-finder-open`(check=1 엔 없음). 순수 모델 `lib/csat/item-finder.ts`(필터 + 목적 · 회차 열 ↔ `exam` · allowlist 투영 · 이동 주소 `finderItemHref` · 복귀 주소 `safeItemReturn` · 탭 메모리 「찾기 전 문항으로」) · 문항별 탭 메모리 `lib/csat/item-tab-memory.ts`(장면별 근거 · 판 스크롤 · 자기 설명/원리 노트/원문 이해 초안 — 문항을 다녀와도 남음) · 검색 해석 `lib/csat/browse-search.ts`(서가 `filterBrowse` 와 공유) · API 본체 `lib/csat/item-finder-server.ts`. 계약 [ITEM_FINDER](./csat-learner/ITEM_FINDER.md) |
| 기출분석공간 메뉴 | [`components/csat/home/CsatRail.tsx`](../apps/web/src/components/csat/home/CsatRail.tsx) — 홈 · 이어서·복습(개수) · 내 기록 · 내 진단 · 전체 서가 · 연습(주장과 근거) · 내 공식 / 목적별 5 / 유형별 / 회차별. 어느 축이든 같은 서가 → 같은 문항 화면(docs/csat/ia-design.md §1) |
| 기출분석공간 셸 | [`components/csat/home/CsatShell.tsx`](../apps/web/src/components/csat/home/CsatShell.tsx) — 2026-10-10. 목록이 아닌 화면(해설 극장 `/csat/item` · 연습 · 내 공식 · 해부)을 같은 레일 + 상단 바(지금 위치 알약) 안에 둔다. 본문으로 건너뛰기 링크 포함 · `bare` 는 캔버스 테두리 없이(스스로 판면을 가진 화면) |
| 상태 카드 · 이어서 판 · 내 기록 | [`home/ContinueCard.tsx`](../apps/web/src/components/csat/home/ContinueCard.tsx)(첫 방문 · 재방문 · 공백 복귀) · [`home/ContinuePanel.tsx`](../apps/web/src/components/csat/home/ContinuePanel.tsx) · [`home/RecordScreen.tsx`](../apps/web/src/components/csat/home/RecordScreen.tsx) · Today 한 줄 [`home/CsatContinueLine.tsx`](../apps/web/src/components/csat/home/CsatContinueLine.tsx) · 기록 훅 [`home/useCsatRecord.ts`](../apps/web/src/components/csat/home/useCsatRecord.ts) |
| 지속 학습 규칙(순수) | [`lib/csat/continuity.ts`](../apps/web/src/lib/csat/continuity.ts) — 방문 상태 · 밀린 복습 ≤3 압축 · 넓이 · 학습한 날 · 기기↔서버 **항목 단위 병합**(`/api/csat/state` PUT 도 이것으로 합친다) |
| 극장 골격(순수) | [`lib/csat/theater.ts`](../apps/web/src/lib/csat/theater.ts) — 강의 큐 → 왼쪽 단계 이름(역할·타깃에서만 짓는다) · 역할 → 효과음 · 분석 층 → 오른쪽 블록(**빈 칸은 만들지 않는다**) · `blockKeyForTarget`(문장 앵커는 지도로) |
| 대본 없는 차례 | `lecture/store.ts` `lectureOutline` + `lecture/types.ts` `LectureStep` — 역할·타깃·길이·말한 문장 번호만. **재생 전에도 레일이 선다**(대본은 여전히 API 로만) |
| 읽기 원리 확인 과제 | [`components/csat/theater/PrinciplePanel.tsx`](../apps/web/src/components/csat/theater/PrinciplePanel.tsx) — 문항 해설 아래 「이 문항에서 확인할 읽기 원리」 · 직접 확인하기(주장 · 뒷받침 · 관계를 문장 번호로) · 서버 채점 결과. 게이트 `lib/knowledge/product-server.ts`(채택 사슬 · 적용 active · 주석 서명) · 주석 `lib/knowledge/annotations/` · [vertical/claim-support](./methodology/vertical/claim-support.md) |
| 응집 단서 확인 과제 | [`components/csat/theater/CohesionPanel.tsx`](../apps/web/src/components/csat/theater/CohesionPanel.tsx) — 순서 문항에서 단서(지시어 · the + 명사 · 연결어)가 가리키는 문장을 번호로 고르고 단락 순서를 고른다 · 채점은 서버(`lib/knowledge/cohesion-link.ts`) · 과제 선택은 레지스트리 `lib/knowledge/item-tasks.ts` (2026-10-08 · DB 빌드 전 노출 0) |
| 극장 화면 | [`components/csat/theater/AnalysisTheater.tsx`](../apps/web/src/components/csat/theater/AnalysisTheater.tsx) — 레일(차례) · 무대(`PassageMap` + 블록) · 장 카드 · 「전부 펼쳐 읽기」 · ←/→ · 배속. 기출 탐구 작업공간(2026-10-13 · [WORKSPACE_COMPACT](./csat-learner/WORKSPACE_COMPACT.md)): 원문 열 → 메인 프레임(근거·관계 판 36% · 설명·판단 판 64% · 근거 판 접기) → 하단 탐구 도크 `InquiryDock`(네 요소 · 일곱 장면 아이콘 · `lib/csat/inquiry/dock.ts`) · 강의 도구(읽기 강의 · 진행 · 같은 유형 · 재생) · 자기 설명/원리 노트 초안 문항별 탭 메모리 · 저장 실제 결과(`lib/csat/explain-draft.ts`) · 원리 노트 근거 연결(`evidence`) · 원문 폭 선호 ≠ 표시(`lib/csat/paper-width.ts`). 일곱 장면(v3 · 옛 `SceneNav` 탭은 도크로 대체 · 배정 `lib/csat/inquiry/scenes.ts` `parseScene` — 블록 하나는 한 장면 · 정답·오답은 문항 성립, 출제 의도는 설계 재구성 · 재생 중이면 강의가 가리키는 블록의 장면으로 따라감). 장면 도식 `SceneDiagrams`(설계 주석 `passage_design`): 본질=이 지문을 고른 이유 · 지문 구조=역할 사슬·패턴·허용 대안·단서(지도 문장 수와 다르면 번호 없음) · 정답 설계=원문→정답 변환. 모두 「설계 가설」 라벨. 오답 설계=선지별 유지/바뀜/변환(`DistractorDesign`) · 공통 원리=통하는/적용 안 되는 조건(`PrincipleDesign`) — v3 패널 `InquiryV3Panels`(평가 과제 · 원문 의미 · 문항 성립 · 설계 — verified 문항만, 근거 버튼 → `PassageMap focusSentences`) · 데이터 `lib/csat/inquiry-data.json`(분석 버전이 같을 때만 · 계약 docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md). v3 M4/M5: `V3CompareExplorer`(검수된 비교 쌍 — 종류 필터 · listbox 선택 `?pair=` · 대응 표 · 근거 강조/해제 · 상대 이동 `back` · 상대 상태별 withheld/absence, 서버 projection `lib/csat/inquiry/compare-v3.ts`) · `V3PrincipleLevels`(candidate/bounded) · `ReasoningNoteForm`(원리 노트 → `DissectionRecord.reasoningNotes`, 검수된 원리와 스스로 대조 · 채점 없음) · `mapReturn`(「학습 지도로」) · `PaperResizer`(기출 원문 열 폭 — 끌기 · ←/→ · Home/End · 더블클릭 기본 · `--paper-w` · 기기 저장). v3.1: `MeaningSupportPanel`(원문 이해 장면 안 선택적 탐구 — 의미 · 관계(`MeaningRelationView`) · 깊이 brief/why/deep · `MeaningDraft`(v3.2 「내 말로 이해하기」 — 펼쳐야 보이는 입력 → 저장 `DissectionRecord.meaningNotes`(문항|의미 id · 분석 버전 + 교수 본문 해시 결속 · `lib/csat/meaning-note.ts`) → 검수된 쉬운 말 · 지킬 조건과 나란히(점수 없음) → 고쳐 쓰기(처음 설명 보존 · 달라진 점 선택) → 앞뒤 관계 · 글 전체 단계로 · 예전 설명으로 쓴 노트 표시) · 글 전체 통합 단계 · 읽기의 경계 `MeaningWholeView` · 읽어 주기 `useMeaningNarration`(검수 본문만 큐로 `lib/csat/meaning-support/narration.ts`) · 지도 `PassageMap onSentenceSelect` · URL `meaning=` `depth=` allowlist · 서버 결속 + 검수 재확인 `lib/csat/meaning-support/data.ts` — 맞지 않으면 기존 `V3Meaning` · 구절 대응 행 · 원문 대조 `lib/csat/meaning-support/align.ts`(기기 문제지 `ItemPaper` status/highlight) · v3 F08: 원본 크롭 위 밑줄 강조(`ItemPaper mark` — 근거로 고른 선지 `choice-n` · 평가 과제 장면의 함축 밑줄 어구, 크롭 비율 좌표 · 대응 확정분만 · 아니면 이유 한 줄 `lib/csat/reflow/crop-mark-view.ts`, 위치 계산 `lib/csat/reflow/paper-marks.ts` · 크롭과 같은 PDF 해시에 묶인 탭 메모리 `read-paper cropEntryOf`) · 성립/설계 이어 가기 `MeaningBridgeFocus`) · 레일 `CsatRail` 은 상시 메뉴 두 개(내 학습 지도 · 기출 탐구 — v3 M1) · 지도 홈 `home/HomeLanding`(첫 제안 `lib/csat/home-suggestion` · 핵심 학습 지도 · 내 자료) · 서가 조건 ↔ 주소 `lib/csat/browse-url` · 기본 아이콘 64px(왼쪽 위 표지 = 펼침/접힘 토글 · `csat-rail` 기기 저장) |
| 효과음 | [`lib/csat/theater-sfx.ts`](../apps/web/src/lib/csat/theater-sfx.ts) — 넷(step·mark·trap·seal), 큐 경계에서만. 기존 **실녹음 샘플을 배속으로** 다시 쓴다(새 자산 0). `wrong.wav` 는 쓰지 않는다 · 기본 끔 · 샘플을 못 받으면 무음 |
| 엔진 | **변경 없음** — `LecturePlayer` · `LectureStage` · `PassageMap` 그대로 |
| 학습 세션 (G1 · 2026-10-08) | [`lib/csat/learning-session.ts`](../apps/web/src/lib/csat/learning-session.ts) — 연 문항마다 세션(시도 0건이어도) · 단계 위치 저장 → 재개 · 마지막 단계 「이 문항 마치기」 → [`SessionDone`](../apps/web/src/components/csat/theater/SessionDone.tsx)(독립/도움 문구 · 다음 문항 · 3일 뒤 다시 보기 · 처음부터 다시) · 「모르겠어요」= `viewed_first`(적중률 제외). 이어서 판에 「하다 만 문항 · 다시 볼 문항」. 계약 [G0](./csat-learner/G0_LEARNING_CONTRACT.md) · 회귀 단위 26 + E2E [`csat-learning-loop.spec.ts`](../apps/web/tests/e2e/csat-learning-loop.spec.ts) 11(DB 무쓰기) |
| 회귀 | 순수 **28** — [`theater.test.ts`](../apps/web/src/lib/csat/__tests__/theater.test.ts) 16(차례·이름·소리·블록·빈 칸 없음·정답표 없는 회차) + [`browse-model.test.ts`](../apps/web/src/lib/csat/__tests__/browse-model.test.ts) 12(축 AND · 거르지 않음 · 번호 완전 일치 · 회차 순서) |

---

## 교재 연습 — `/library/textbooks/[series]/[step]/practice` (2026-10-28)

- 조회 경로를 알린다: `fetchTextbookPracticeItems` 가 `scope`(volume | legacy_v_level)와 서버 `getUser` owner 를 돌려준다. 권 함수 `textbook_practice_items_for` 가 없으면 V레벨 공통 풀로 대체하며, 이때(및 미확인)는 「선택한 교재의 기준 수준으로 고른 공통 문항 · 수록 문제와 같다는 뜻 아님」 안내 뒤 「공통 문항으로 연습하기」를 눌러야 문항이 나온다. volume 도 인쇄본 수록 일치를 약속하지 않는다.
- `TextbookPracticeBridge` 가 기존 `useStoryAuthGuard` 로 감싼다: checking/changed 에 문항·답·해설을 그리지 않고 「연습 다시 열기」·권 복귀만. 같은 계정일 때만 DcpPlayer `revisit`(이미 본 답·해설, 새 채점·기록 없음).
- 채점은 `gradeTextbookPracticeItem(expectedOwner, …)`: 요청 사용자가 없거나 다르면 `grade_dcp_item` 호출 전에 실패로 거부. 지원 유형은 `dcp-types.ts` PLAYABLE(순서·삽입 + 선택형).
- 미완: 인쇄본 수록 문항 ID/판본 결속, 권 전용 단어 복습, 완료 문구.

## 기출 주장과 근거 연습 — `/csat/practice` (2026-10-08 이식)

- 화면 `components/knowledge/ClaimPractice.tsx`. 규칙(순수) `lib/knowledge/practice.ts` · `protocol.ts`, 서버 `practice-server.ts`, 쓰기 어댑터 `practice-writer.ts`.
- 채점은 정본 `claim-support.ts` `gradeClaimSupport`(주석 문항)다. 골격 정답 근거 앵커로 만든 키(골격 문항)는 효과 계산에서 뺀다.
- 기록은 `learning_task_attempts`에 남긴다: `task_key` `claim-support` / `claim-support-skeleton` · phase practice/transfer · `response.activity='practice'`.
- 상세 · 수용 기준 대응은 [PRACTICE_PORT](./csat-learner/PRACTICE_PORT.md).
- 2026-10-17 연습 ↔ 독립 확인 경계(#281 E01): 지도가 독립 확인 문항으로 쓰는 문항(과제 키 무관)은 그 학습자가 어떤 경로로도 아직 안 봤으면 연습에서 뺀다(`practiceReservation` — 노출 원장 `lib/csat/map/v62/exposure-ledger.ts`: G2 시도 · 세션(삭제 포함) · 함정 · 문제지 · 복습 큐 · 진단 응답 + 정규화 지문). 제출 · 해설 열람 · 복습 예약 API 도 409로 막는다. 원장을 못 읽으면 전부 예약(fail-closed). 남는 문항이 없으면 404 대신 `PracticeReservedNotice`(학습 지도 확인 과제 안내). 전이(주제 · 제목) 문항은 이 화면이 전이 수행 경로라 예약하지 않는다.
- 같은 날 공급 판정(`supply.ts`): 독립 확인 · 전이 · 지연 줄은 정식 자격(FQ) reader 가 적격이라 한 미노출 문항만 `available`. 기존 출시 경로로 열 수 있을 뿐이면 `open_unqualified`(「기존 과제로 풀 수 있어요 · 정식 자격 확인 전」 · 7필드 true 없음 · 공급 수 0). FQ 표가 없으면 `not_installed`, 조회 실패는 `error`로 구별한다(`loadFqReader`).

## 원문 교수 자기 설명 — `/csat/factory/[deliveryId]` 안 (2B · 2026-10-21)

- **T-0091(2026-10-23) 학습 정리 전환**: 관계 · 절차 서술 칸 대신 시스템 카드(`lib/csat/system-learning.ts` `RELATION_CARDS` · `TITLE_RELATION_CARDS` · `PROCEDURE_CARDS`)를 고르고, 요지의 「시범과의 대조」 는 고른 문장과 시범 문장을 센 자동 사실 문장이다(학습자 글 · 자기 평가 아님). 저장 계약 · 서버 형성 피드백 · 다음 단계 연결은 그대로, 2C 재진입 때 예전에 직접 쓴 설명은 「저장된 기록 · 읽기 전용」. 같은 날 기출 문항 `scene=explain` 은 「학습 정리」(SystemLearningSummary)로 바뀌었다 — 사용자별 콘텐츠 평가는 지원하지 않는다([DECISIONS CL-SL-1](./csat-learner/DECISIONS.md)).

- 교수 자료 원문의 납품이면 `page.tsx`가 단계별 답변 전 지원(`beforeAnswerSupport`)만 `FactoryDcpRunner`에 넘긴다. 풀이 저장(영수증 id) 뒤 `SourceLessonPanel`이 열린다: 번호 붙은 문장 목록 · 주장/근거 선택 · 관계 · (요지) 시범 + 비교 · (주제) 절차 → `POST …/lesson`. 같은 본문 재시도 = 같은 키, 실패해도 글 유지, 저장 확인 뒤 「다음: 같은 글의 제목/주제」 또는 Workspace 복귀.
- 2C 재진입: `page.tsx` 가 `savedReflection`(본인 · 납품 · Workspace · 교수 자료 SHA 로 좁힌 닫힌 값)을 읽어 `lesson.restored` 로 넘기면 Runner 는 풀이 칸을 그리지 않고 패널을 저장값으로 잠가 보여 주며 다음 단계/Workspace 링크를 낸다. 읽기 실패는 `restoreFailed` 안내(새 풀이로 덮지 않음).
- 코드: `lib/csat/map/v62/factory-bridge/source-lesson.ts` · `components/csat/factory/SourceLessonPanel.tsx` · `app/api/csat/factory/[deliveryId]/lesson/route.ts`. `FactoryDcpCard` 목록 응답은 `readFactoryList`로 닫힌 모양만 받는다(미상 수치를 0으로 바꾸지 않음).

## 공장 DCP 안내 연습 — `/csat/factory/[deliveryId]` (1D · 2026-10-21)

- 2F 요청: 같은 카드가 미설치가 아니면 「공장 연습 자료 요청」 단추를 보인다(`POST /api/csat/factory/request` · 서비스 `factory-bridge/dcp-request.ts`). 결과는 받음(첫 「요지 고르기부터 시작」 링크 + 목록 새로고침) · 제작 연결 대기 · 승인 대기 · 지금 단계 아님 · 계획 먼저 · 실패(「다시 요청」, 같은 키라 중복 없음)로 나뉘고 0건/완료로 삼키지 않는다. 응답은 `readFactoryRequest`가 닫힌 모양만 받는다. 학습자 화면에 내부 id는 보이지 않는다.
- 진입: 학습 지도 Workspace 팝업 `FactoryDcpCard`(r.central_meaning · 납품이 있을 때만). 화면 `components/csat/factory/FactoryDcpRunner.tsx` 가 기존 `DcpPlayer` 를 쓰고, 채점만 `POST /api/csat/factory/[id]/attempt`(실제 `grade_dcp_item` + 납품 결속 영수증, 같은 응답 = 같은 UUID 키로 멱등) 로 바꾼다. 서비스 `lib/csat/map/v62/factory-bridge/dcp-learning.ts`.
- 저장 실패 · 모양이 다른 200(영수증 · 실제 채점 시도 id 없음)은 「채점을 못 했어요」(오답 · 완료 아님 · 고른 답 유지). 완료 문구는 `DcpPlayer` 의 `doneCopy` 로 연습 기록 경계를 말하고, 돌아가기는 같은 Workspace 의 기존 다음 행동으로 간다. 근거 경계는 [LEARNING_MODEL](./LEARNING_MODEL.md) §공장 DCP 안내 연습.
- 계측 `csat_factory_dcp_opened`(type · attempts) · `_submitted`(type · correct · replayed) · `_returned`(finished). DB 허용 목록은 보류 SQL 에 있어 적용 전에는 0건이다.

## 창작 평가 자료의 AI 검토 공급 (2A · 2026-10-21)

- 관리자 세션 서비스 `lib/csat/authored/ai-review.ts`(`verifyAiReviewReceipt` → `recordAiReviewedSupply`: 등록 → `content_ai_decision_record` → `authored_ai_qualify` → 승인). 영수증 원본 `docs/implementation/learning-outcomes-20261021/evidence/2a-ai-review/`. 학습자 화면 · 라우트는 기존 창작 경로(`/api/csat/authored/*`) 그대로이며, `server.ts` 재고 선택은 `authored_supply_decision_state` 가 `human`·`ai` 인 자격만 후보로 둔다(함수 미설치 시 기존 동작).
- 관리자 API 라우트는 아직 없다(2B 이후). SQL 미적용 상태에서는 아무 행도 만들지 않는다.

---

## 기출 해부 — 예측 · 대조 · 공식 (2026-09-17)

학습자 라우트는 /csat, /csat/dissect, /csat/formulas 세 개다. 정답을 처음부터 공개하고
근거 문장 → 오답 제조법 → 출제 의도를 예측한 뒤 해당 분석을 인라인으로 렌더한다.
같은 유형·다른 소재 두 문항을 대조하고 세 번째 문항에 전이한다. 설계도는 앞서 본 다섯 항목만 접는다.

- lib/csat/dissect.ts: 후보 검증, 낮은 계열 커버리지 우선 구성, 보기 셔플, 공식 중복 병합, 3일 뒤 다른 문항 전이.
- dissect-catalog.ts: 공개 문항·published 최신 분석을 페이지 조회. 필수 자료 누락은 후보에서 제외하고 관리자 evidence에서 원인을 표시한다.
- 기출 운영 Evidence: `evidence-operations.ts`가 실제 학습 후보 판정과 원천 결함을 분리하여 작업 우선순위·최초 제외 단계·URL 필터를 계산한다. `EvidenceInspector`는 분석·근거·버전 이력과 작업 대상 내보내기를 연결한다. 관리자 `evidence-operations-loader.ts`는 학습자 캐시를 재사용하지 않는다.
- dissect-metadata.ts: 분석·강의 wrapup을 검토한 소재·형식·공식. 형식이 같은 실제 기출만 변형 가설의 근거로 제시한다.
- dissect-anchors.json: 로컬 PDF 대조로 검증한 문장 길이·해시·위치·구간. 원문 문자열 없음. 공유 skeleton-data는 수정하지 않는다.
- reflow/*, session/passage-model.ts, PaperDrop: 기존 브라우저 PDF 추출·문장 대응·bbox 폴백 재사용. PDF 업로드 API는 없다.
- session/store.ts: 예측·공식·전이 큐는 IndexedDB dissection-v1 별도 키. 기존 풀이 기록/API 계약을 유지하며 두 정확도를 섞지 않는다. 새 기록은 기기 간 동기화되지 않는다.
- components/csat/session/*: 홈 카드·문항 상태 흐름·두 문항 대조·내 공식. 풀기/타이머/점수/유형 필터 없음. 지표는 공식 수·최근 30예측 적중률·계열 커버리지다.
- 기존 강의/관리자 분석, 풀이 모델과 /api/csat/session/{record,reveal}는 호환 경계로 유지한다. 강의 재생은 관리자에서 검수한다.
- 계측: csat_session_started, csat_session_explained, csat_paper_read 기존 계약 사용. 이전 채점 이벤트는 새 학습 화면에서 발생하지 않는다.
- 검증: tests/e2e/47-csat-session.spec.ts — 375/768/1440에서 3수 미렌더, 키보드 선택, 설계도 출처, 공식 저장, 전이, axe와 overflow.

상세 결정과 실측은 [DECISIONS](./csat-learner/DECISIONS.md)와 [해부 검증 기록](./csat-learner/dissection-report.md)을 따른다.

## 기출 분석 — 지문 지도 (v06.34 · 2026-09-15)

**인용 표시 방어(2026-10-01)**: `/csat/item/[slug]`의 분석 인용 블록은 `ItemPaper`가 읽은 현재 기기 지문에 `findQuote`로 매칭될 때만 표시한다. 문제지 미확보·추출 실패·불일치는 인용을 숨기고, 근거 설명·정답/오답 이유·풀이 절차는 유지한다. 문항 이동·문제지 다시 놓기 시 이전 지문으로 검증하지 않는다. 40단어 표시 상한이 붙인 말줄임은 대조에서만 제외하며 원래 인용의 말줄임은 보존한다. DB 원문을 새로 읽거나 쓰지 않는다.

`/csat/item/[slug]` 는 산문 네 덩어리를 세로로 쌓는 화면이었다. 그 자리에 **조작면**을 놓았다.

**핵심 제약이 설계를 정했다.** 지문·선지는 평가원 저작물이라 실을 수 없다
(`csat_items_public` 뷰에 컬럼 자체가 없다). 그래서 **글자 대신 모양**을 그린다 — 문장마다
길이 비례 막대가 쌓이고, 칩을 누르면 그 근거가 든 막대가 그 자리에서 열려 인용문이
**막대 안의 정확한 위치**에 드러난다. 업로드 0 · 로그인 0 이라 클릭 0 으로도 증명이 보인다.

| | |
|---|---|
| 매칭 엔진 | [`lib/csat/quote-match.ts`](../apps/web/src/lib/csat/quote-match.ts) — 인용문 → 원본 인덱스 구간. **정규화가 길이를 바꾸므로 원본 인덱스 지도를 함께 만든다** |
| 골격 | [`lib/csat/passage-skeleton.ts`](../apps/web/src/lib/csat/passage-skeleton.ts) — 문장 길이 + 드러낼 구간. 지문 글자는 `Reveal.text` 하나로만 나간다 |
| 판단부 | [`lib/csat/passage-map-model.ts`](../apps/web/src/lib/csat/passage-map-model.ts) — 무엇이 열리는가 · 계측을 셀 것인가 |
| 로더 | [`lib/csat/skeleton.ts`](../apps/web/src/lib/csat/skeleton.ts) — **커밋된 JSON 만 읽는다.** 런타임이 `passage` 를 만질 길이 없다 |
| 산출물 | `lib/csat/skeleton-data/*.json` — 29회차 415KB. `scripts/csat/build-skeleton-data.mjs` 가 굽는다 |
| 학평 골격 | DB `csat_item_skeletons`(발행분만 RLS) — `build-skeleton-data.mjs --set hakpyeong --commit` 이 굽는다. 학습자 로더는 요청 앞머리 `primeLearnerHakpyeongSkeletons(학습자 RLS 클라이언트)` 로 읽어 두고(학습자 전용 캐시), 관리자는 `loadHakpyeongSkeletonAdmin` |
| 화면 | [`components/csat/PassageMap.tsx`](../apps/web/src/components/csat/PassageMap.tsx) · [`ReportText.tsx`](../apps/web/src/components/csat/ReportText.tsx) |
| 다음 걸음 | [`lib/csat/next-item.ts`](../apps/web/src/lib/csat/next-item.ts) — 해설 있고 **지도 있는 것을 먼저** |
| PDF 결합 | [`lib/csat/pdf-text-locate.ts`](../apps/web/src/lib/csat/pdf-text-locate.ts) — 학습자 PDF 텍스트 레이어에서 근거를 찾아 밑줄 |
| 근거 위치 분포 | [`lib/csat/locus-model.ts`](../apps/web/src/lib/csat/locus-model.ts)(순수) · [`type-locus.ts`](../apps/web/src/lib/csat/type-locus.ts)(골격에서 집계 · DB 0) · [`components/csat/LocusBar.tsx`](../apps/web/src/components/csat/LocusBar.tsx) |
| 회귀 | 순수 132 + 실 DB 통합 4 + 접근성 하네스 11 + 런타임 7(미확인) |

**실측 (2026-09-15)**

| | 값 |
|---|---|
| 지도가 뜨는 문항 | **589 / 589** (`body_ok = true` 전량) |
| 화면이 가리키는 앵커 | **1,704** (정답 589 + 오답 1,115) |
| 인용문 → 원문 매칭 | **589 / 589 = 100.00%** |
| 첫 화면 산문 | 2,100 → **964자** |
| 유형 화면 가장 긴 덩어리 | 5,931 → **1,579자** |
| 다음 걸음을 받는 문항 | **801 / 802** (전부 지도로 이어진다) |
| 노출 (지문 대비) | 14.8% · 한 문항 최대 37.1% (= 현행 배포본의 최대치) |

⚠️ **지도는 오답을 다 들지 못한다 — 못 든 것은 글로 내려온다.** 앵커 수 분포는
1개 **136** · 2개 113 · 3개 115 · 4개 128 · 5개 97 이다(2026-09-15 실측). `reject:n` 앵커는
`how_to_reject` 속 영어 조각이 **지문에서 찾힐 때만** 붙고, 노출 예산에 걸려 버려지기도 한다.
그래서 「골격이 있으면 산문 절을 안 그린다」를 **문항 단위**로 걸면 answer 하나뿐인 136문항
(23.1%)에서 오답 분석 **544문단(평균 867자)** 이 통째로 사라진다 — 실제로 사라져 있었고,
지도가 정답 칩 하나만 띄운 채 멀쩡해 보여 아무 검사에도 안 걸렸다. 조건은 **선지 단위**다
(`offMapChoices`) — **모든 선지는 칩이거나 글이거나 둘 중 하나로 반드시 닿는다.**
회귀가 세는 것도 「칩이 있는가」가 아니라 `chips - 1 + prose === 4` 다.

⚠️ **`answer_locus.sentence_index` 를 쓰지 않는다.** 1-기반으로 봐도 일치율 **65.0%** 라
3문항 중 1문항이 틀린 문장을 칠한다. 규약이 저장소 어디에도 없는, 분석가가 자기 방식으로 센
값이다. **문장은 인용 위치에서 역산한다.** 재고조사: `scripts/csat/anchor-inventory.mjs`.

⚠️ **노출 예산에 임계값을 지어내지 않았다.** 규칙은 «새 화면은 어느 지문에서도 지금보다 더
드러내지 않는다» 이고, 그 «지금» 은 배포 중인 `evidence_quote` 단독 노출(최대 37.1%)을 재서 쓴다.
예산 없이는 전체 18.0% 뒤에 **한 문항 59.5%** 가 숨어 있었다.

---

## 베타 — Pirate Quest

### 목적
단어 모험 3D 게임 (R3F · @react-three/fiber + drei). 아케이드 카탈로그 `source: bank` · `beta`.

### 라우트
- `/play/pirate-quest` — 풀스크린 (셸 메뉴 X · SessionFrame ✓ · 복귀 `/arcade`)

### 컴포넌트 (`components/pirate-quest/`)
- `PirateQuestGame.tsx` / `PirateQuestUI.tsx` / `PirateQuestUI.css`
- `PirateScene.tsx` — R3F 3D 씬
- `PirateModel.tsx` — GLB 모델

### Data
- `lib/pirate-quest/data.ts` — 단어 풀 + 스테이지 매핑
- `lib/pirate-quest/types.ts`

---

## 인지 깊이 매트릭스

같은 L4a 안에서도 인지 채널이 다름:

| 모듈 | 단서 | 응답 | 회상 깊이 | 적합 단어 상태 |
|---|---|---|---|---|
| Flashcard (L4a) | 단어 1개 (시각) | 자가판정 | 재인 + 메타인지 | new → shaky |
| WordBlitz (L4a) | 4지선다 | 클릭/탭 (속도) | 재인 + 자동화 | shaky → stable 가속 |
| PairFlip (L4a) | 카드 한쪽 (단어/뜻) | 짝 위치 식별·클릭 | 재인 + 공간 기억 + 매칭 인지 | new → shaky / shaky → stable |
| SpellForge (L4b) | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 시각·의미 생성 인출 | shaky → stable 검증 |
| EchoMatch (L4c) | TTS 청취 | 발화 (청각 재생산) | 음운 + 발화 쌍둥이 | shaky 견고화 |
| ScriptQuiz (L5) | 스크립트 맥락 전체 | 4지선다 | 의미 통합 (Recognition + Transfer) | 텍스트 단위 검증 |
| Dictation (L6) | TTS (청각) | 타이핑 (자유 재생산) | 음운+의미+문법+철자 통합 | 텍스트 단위 완성 |

### CSAT 분석 읽기와 듣기 (2026-09-18)

SessionHome은 추천 3문항과 유형별 탐색·이어하기를 제공한다. SessionRunner는 `?item=`에서 AnalysisReading을 열고 `?resume=1`에서 기기에 저장한 문항·예측 단계·선택값을 복원한다. analysis-sections의 동일 설명을 화면과 LecturePlayer/WebSpeechAdapter가 공유한다. 자동 스크롤 없이 현재 설명 위치로 이동하며 문항 변경은 발화를 취소한다. 분석을 먼저 읽은 문항은 새 예측 적중 통계에 넣지 않는다.

### CSAT Learning Home (2026-09-18)

SessionHome의 첫 화면은 실제 기출 두 문항의 같은 공식 관계를 비교한다. learning-home.ts는 기존 추천 결과의 이유와 원리별 기록 상태를 계산한다. 보관/예측/열람/재확인을 숙달로 표현하지 않는다. 홈에서 패턴 지도, 문항 필터, 기기 이어하기와 분석 듣기로 연결한다. PDF 사전 준비는 native details로 접고 시작을 먼저 노출한다.


### CSAT 시각 분석 (2026-09-18)

`QuestionArchitecture`는 실제 skeleton의 문장 길이·근거 위치에서 정답/오답 선지로 연결한다. 홈의 `PatternComparison`은 같은 공식 문항 두 개의 선택을 동기화하며 `PatternMap`은 공식 소속과 기기 기록을 표현한다. `AnalysisWorkbench`는 PDF 원문 선택 ↔ 구조도 ↔ 설명/TTS focus를 연결한다. `buildDissectionPassage`의 검증 구절 위치를 예측 화면과 분석 화면에서 공유한다. 데스크톱 학습 판면이며 새 API/저장 형식/패키지는 없다.

## 영어 진단 — 시험 기록 시계열 진단 (2026-10-01)

- 학습자 진단 계산: `lib/csat/diagnosis/engine/exam-report.ts`(점수 흐름 · 유형별 정답률 · 듣기/독해 · 끌린 함정 · 틀린 문항) · 조회 `report.ts`.
- 관리자·태깅용 규칙 엔진 `engine/rule-v1.ts`(스냅샷)는 그대로 — 학습자 화면은 쓰지 않는다.
- 컴포넌트(`components/csat/diagnosis`): `DiagnosisBoard`(판 · 알약 탭 · 벤토 · 표, `board.module.css`) · `charts`(도넛 · 막대 · 레이더 · 스파크라인) · `RecordsList` · `RecordModal`(새 기록 팝업) · `RecordDetailModal`(기록 팝업 · 삭제) · `ResultParts`(영역 막대 · 45칸 결과판) · `tints`(등급 · 영역 · 함정 색) · `DiagnosisHomeCard` · `DiagnosisShell`.
- 입력 신뢰도(`lib/csat/diagnosis/engine/record-quality.ts`, rq-1): 기록 한 회의 응답 패턴(답한 수 · 최빈 번호 비율 · 같은 번호 최장 연속 · 번호 종류)으로 trusted / suspicious / excluded_pending_review 판정 — 저장 없음. `diagnosticInput()` 이 진단 집계 입력을 거른다(엔진 · 지도 지표 · 시험 기록 보고서). 기록 · 점수 · 오답 표는 그대로, 목록에 「진단 제외」 칩 · 개요 안내.
- 학습 지도(`components/csat/diagnosis/map`): `MapScreen`(첫 화면 핵심 요약 ↔ `?view=full` 기존 상세 지도) · `GoalBar`(`useGoal` · `GoalEditor` · `GoalPopover` — 목표 점수는 최종 목표 카드 · 노드의 팝오버에서, 상단 줄 없음) · `CoreSummary`(V/S/R/E/L + X 카드 — 표시명 어휘 · 표현 / 문장 이해 / 글 이해 / 근거 · 선지 판단 / 듣기 / 실전 수행 · 기존 라인 대응은 「현재 계산」(A4 · A6 는 카드에 이동 예정 표시) · 구분선 = 표시 기준 문구 · 성장 경로 8단계(값 없음) · 우선 확인 후보 ≤2 · 지금 필요한 진단 ≤1 · 오답 원인 ≠ 카드 상태 문구, 계산 `lib/csat/map/core` · 2026-10-07 vNext 정렬, 회귀 `vnext-alignment.test.ts`) · `LearningMap`(노드 마우스 → 연결선 강조 · 오른쪽 ⋯ → 상세, 클릭 = 경로 강조 · 기존 상세 지도 — 종류별 6열: 최종 목표 | 핵심 능력(A) | 측정 정보(B) | 문항 특성(C) | 학습 · 행동(D · I) | 실전 · 상황(J), 열 정의 `core.LAYER_COLUMNS`, 참조 3B 「종류별 열」 측정 spec.json `layout` · 영역 노드는 열 묶음 머리, 선은 목표 → 영역만 · 관찰 막대는 역량 A 만, B/C/D/I/J 는 「능력 아님」 역할 라벨(측정 정보 · 문항 특성 · 학습 · 행동 정보 · 실전 · 상황) · P/T 노드 없음) · `NodePopup`(목표(목표율 = 시험 수행 전략) · 관찰 · 학습 활동(과제 ≠ 능력 상태 · 처방 단계 찾기 → 고치기 → 옮기기 → 확인 묶음, 진단 전에는 찾기만 열림 — `lib/csat/map/prescription`) · 근거 — P 설계 근거 · T 처방 접근은 근거 탭에만) · `MapPreparing` · `format`(표시 반올림 · 상태 라벨) · `map.module.css`(neon-currant 실측 토큰, 이 범위만). 계산은 `lib/csat/map`(`target`(목표율 · 손실 예산 · 보수적 집계) · `memberships`(문항↔라인) · `model` · `graph` · `load`(DB) · `evidence`(스냅샷 지도 지표, 실패 격리) · `server`/`payload`(목표 · 과제 쓰기)) · 스냅샷 지도 지표 `diagnosis/engine/map-evidence`.
  - 2026-10-14 학습지도 v6.2 P-M1 단일 지도: `MapScreen` 은 기본 · `view=full` · `/csat` 홈 모두 `UnifiedLearningMap` 하나(옛 `LearnerMap` 읽기 7단계 · `LearningMap` 54라인 열 · `NeedPanel` 을 화면에서 뺌 — 파일은 남음) · ① `GoalRecordBar`(저장된 목표 점수만 · 기록 전체/진단 활용/제외 사유) ② 영역 6열 × TASK 30 관계도(개요는 6열 압축 · 고른 영역만 노드 폭 206 · full 은 전부 206 + 캔버스 안 가로 스크롤 · 승인 관계 실선/제안 점선 · 통합 관찰 점선 칸 · 검색) ③ `TaskInspector`(360 · 다음 한 행동 고정 · 현재와 목표 / 기출과 출제 논리 / 교재 · 학습 · 계획 / 지원 상태 접힘 · 「기출 근거 자세히」 = 기존 `StepSheet`) · 학습계획 편집 `PlanSection` 은 관계도 아래. 계산 `lib/csat/map/v62`(graph · rank · coverage) · 복귀 문맥 `map_task`(영구 TASK id) 추가.
  - 2026-10-15 학습지도 v6.2 P-M4: `FocusStrip`(목표 · 기록 아래 2층 「지금 무엇부터」 — ActionRank 1~3 카드 · 왜(확정 아님) · 지금 근거 · 다음 행동(복귀 문맥) · 지금 할 수 없는 TASK 와 이유, 상태별 첫 문장: 목표 없음 · 기록 없음 · 준비됨 · 이어 할 활동 없음) · `TaskInspector` 기본/근거 분리(현재와 목표 → 학습 경로 · 필요한 자료 · 기출 해부 학습 → 「자세한 근거 — 기출 · 출제 논리 · 연구」 접힘 → 지원 상태 접힘). 판정은 그대로 `ranksOf` · `taskInspector` · `supplyFor`.
  - 2026-10-15 LM-W1 학습지도 × Workspace 통합: 순서 = `GoalRecordBar`(한 줄 띠 — 목표 · 기록 · 상태 · ActionRank 1번 다음 행동; `FocusStrip` 삭제 · 우선 2·3번은 노드 번호 표지) → 관계도(화면 폭 전체 · 오른쪽 상시 Inspector 제거) → `WorkspaceList`(지도 바로 아래 · 행 모델 `lib/csat/map/v62/workspace-list.ts` = plan · plans 그대로) → `TaskPopup`(노드 옆 비모달) · `WorkspaceModal`(3B 모달 · 개요/학습계획 탭 — `PlanSection` 재사용) · 근거 드로어(`MapDialog` 안 `TaskInspector`). 선택(TASK · Workspace)은 `UnifiedLearningMap` 한 곳 · 주소 `map_task` · `ws`. 문서 [LM-W1](./csat-learner/v62/LM-W1_MAP_WORKSPACE.md). 독립 수용 보강: 지도 머리 Workspace 이동 링크 · 팝업→관련 행/행→관련 TASK의 실제 스크롤·초점 · 선택 노드 상세 표지 · 비모달 키보드 진입. 판정/저장 계약은 재사용. LM-G1.1은 실패한 바로잡기의 수행량과 성공 준비를 분리하고, PLAN·리스트 실행 링크는 같은 TASK의 기록만 사용한다. [독립 T1 수용](./research/lm-g1-1-independent/ACCEPTANCE.md) 참조.
  - 2026-10-16 LM-G1.3a 독립 보완: 목표 저장은 재전송 사전 비교와 RPC 후 불변 저장 행 대조, 신규 목표일은 서울 달력, 동일 목표 재전송은 날짜 경과 허용. 한 목표 snapshot이 화면 점수·시험 범위·PLAN 근거를 공급하며 요청 중 입력값은 저장된 계산에 섞지 않는다. 수능은 kind로 식별하고 학평 일부 오답률로 전체 자격을 승격하지 않는다. 최근20 밖 PLAN 목표는 상세 확인 불가를 명시. DB/RPC/RLS 변경 없음.
  - 2026-10-07 학습자 관점 재구성: 첫 화면 `LearnerMap`(읽기 길 7단계 어휘·표현 → 문장 이해 → 문장 관계 → 글 구조·핵심 → 본문↔선지 → 근거 판단 → 시간 내 통합 + 듣기 보조 4단계 · 「지금 먼저 확인할 것」 하나(+ 다음 후보 하나) · 여정 기출에서 보인 모습 → 먼저 확인할 것 → 원인 확인 → 맞춤 학습 · 기출 상세 분석 링크) · `StepSheet`(무엇 · 왜 · 내 기록 · 지금 확인할 것(확인하기 과제) · 원인 확인 뒤 학습 · 상세 근거(접힘)) · 계산 `lib/csat/map/learner-path`(표현 층 — 새 taxonomy 아님, 상태 = 기록 없음 · 분석 준비 중 · 기록 더 필요 · 기출에서 관찰됨 · 먼저 확인 · 직접 확인됨). 54라인 화면 이름 = 기출 상세 분석. `CoreSummary` 삭제.
  - 2026-10-08 목표 중심 재설계: 첫 화면 순서 = ⓪ 「내 목표 · 현재 위치」 바(목표 점수 · 등급 구간(절대평가) · 목표 미설정이면 「아직 정하지 않았어요」 / 시험 기록으로 본 지금(실제 최근 원점수 · 등급 · 회차 · 날짜 · 기록 수 · 이전 ↔ 최근) / 목표까지(목표와 기록이 둘 다 있을 때만) / 읽기 7단계 근거 상태 개수) → ① 가운데 「목표 N점으로 가는 영어 독해의 길」 → ② 오른쪽 「지금 먼저 할 일」 하나(목표 미설정이면 목표 정하기). 기준 시험(목표 계산용 평가원 최근 6회)과 내 기록을 문장으로 구분. `StepSheet` 에 「목표와의 관계」(기준 시험의 그 단계 문항 · 배점 — 사실만, 점수 상승 약속 없음) · 「아직 모르는 것」. 계산 `lib/csat/map/goal-view`(등급 · 목표 요약 · 단계-목표 관계 · 근거 4갈래). 데이터: `MapModel.goalSet` · `lineRefItems` · `MapPageData.records`(스냅샷 점수 흐름에 든 세션만).
  - 2026-10-08 결과 환류: 단계 시트의 FIND 과제에 실행 과제 링크가 있으면 그 아래 「내가 한 확인」(`data-testid="find-practice-result"` · `data-next` retry/move_on) — 횟수 · 처음 결과(도움 여부는 기록에 있을 때만) · 최근 결과(한국 날짜) · 다른 지문 적용(같은 과제 키의 `phase=transfer`) · 다시 보기 예약(`learning_sessions.review_at`) · 다음 행동(retry · review(예약일 지남) · move_on). 실력 판정 아님을 함께 쓴다. 데이터 `lib/csat/map/practice-results.ts`(순수 요약) · `load.ts` `practiceResults`(learning_task_attempts · learning_first_attempts, user_id 로 좁힘 · 뷰를 못 읽어도 지도는 그린다). E2E `scripts/csat/map/e2e-map-practice-feedback.mts`
  - 2026-10-09 결과 환류 다음 칸: 마친 확인(move_on) · 전이 없음 → 「같은 원리를 다른 지문에 적용해 보기 →」(`/csat/practice/claim-support` · `find-next-practice` · 실학습 Practice 풀에 그 문항 말고 다른 문항이 있을 때만 — `practiceHrefBeyond`), 전이까지 했으면 「새 기출을 풀고 기록해 목표 대비 변화 보기 →」(`/csat/diagnosis?tab=records&modal=new` · `find-next-reassess`). 문항 → Practice 링크 · 복습 예약은 PR #164. E2E `e2e-learning-loop-real.mts` · `e2e-map-practice-feedback.mts`
  - 2026-10-10 큰 틀: 기준 정본 `lib/csat/map/curriculum.ts`(11단계 × 학교급 권장 노출 · 확인 과제 키 · §13 바로잡기 절차 · 적용 방식 · 준비 상태 live/ready/content_needed/blocked) · `StepSheet` 에 생애주기 4칸(`LifecycleStrip`) · 확인 문항 없는 단계의 준비 상태(`StepReadiness`) · 처방 칸 바로잡기 절차(`rx-repair-protocol`) · `LearnerMap` 학교급 선택(잠금 아님 · 이 기기에만 기억). E축 문항 과제 `EvidencePanel`(option-restate · evidence-locate · 합의 주석).
  - 2026-10-11 rev4.0 3차: `PlanSection`(NeedPanel 안 학습 묶음별 학습계획 — 중심/보조 TASK · 학습목표 · 계획 문항(출처 · 규칙 · 가용량) · 수행/남음 · 「다 했다고 보는 기준」과 확인 상태(별도 줄) · 활동 시작 · 순서/계획량 조정(이 기기 초안 · 저장은 승인 대기 명시)) · 목표 순서의 TASK 이름 → 그 TASK 의 묶음 계획. 계산 `lib/csat/map/v4/plan`(정량 ≠ 정성 · 가용 콘텐츠에서만 계획량 · `applyDraft` 는 계획 칸만). 학습자 문장은 코드북 `learner_criterion`(설계 메모 `criterion` 과 분리 · 내부 코드 가드).
  - 2026-10-10 rev4.0 2차: `NeedPanel`(「목표까지 필요한 학습」 — LearnerMap 아래 읽기 전용 · 기준 시험 · 시점 / 시험 기록 · 목표 / 영역별 근거와 세부 상태 / 우선 추천 학습 묶음(단계 4칸 · 실제 문항 수 · 다음 행동 링크) / 목표 관련 확인 · 학습 순서 / 아직 계산하지 않는 것) · `needs.module.css`. 계산 `lib/csat/map/v4`(`definition`(생성물 `definition.data.ts` 정적 import · TASK 30) · `as-is` · `to-be` · `workspace` · `compose`). `graph.pathOf` 가 경로 안 미확정 연결선(`unconfirmed`)을 따로 돌려주고 `LearningMap` 은 그 선을 흐리게(확정 경로처럼 진하게 칠하지 않음). 이벤트 `csat_workspace_opened` · `csat_workspace_suggestion_applied`(DB 허용 목록은 기존).

### R5 연습·독립 평가 경계 독립 보완(2026-10-17 · PR #285)

노출 원장 6종은 exact count와 반환 행 수가 같고 LIMIT 미만일 때만 완전 조회로 인정한다. 서버의 더 작은 응답 상한이나 count 부재는 오류로 예약을 유지한다. 실제 출시 연습 풀이 0건인 경우도 404 대신 자료 부족·지도 복귀를 제공한다. Inspector는 후보 유무와 별개로 FQ 미설치·오류·설치 및 적격 수를 표시한다. `loadFqReader()`는 원장(관리자 전용 RLS)을 서버 전용 클라이언트로만 읽고, 행마다 `fqRowVerdict`로 역할 축(DB `fq_role_ok`와 같은 규칙) · TASK · 원천/Gold 결속 · 철회 안 된 공개(+평가 역할은 평가) 승인 · 대체 여부 · 현재 문항 revision(`supply_artifact_revision`) · 현재 주석 해시(`evidence_ids` 의 `annotation:<sha256>`, I2 전용 칸 전까지)를 대 본다. 하나라도 모르면 거절하며, 적격은 `{ref, task, role, qualificationId}`로 역할·TASK에 묶여 다른 역할·TASK 줄을 채우지 않는다. 자격 행이 없으면 0건이고 출시 과제 열람은 공급 0인 `open_unqualified`다.

확인과 전이 표본 모두 활동·세션·TASK·현재 hash 결속을 요구한다. 줄바꿈·탭은 JSON 인코딩 전 정규화해 동일 지문을 놓치지 않는다. 읽기 전용 E2E는 `pnpm --filter web test:e2e:r5`로 전용 서버 장벽까지 자동 적용한다.

미노출 전이 후보와 예약 지문을 공유하는 문항도 연습에서 보호한다. 서버가 Workspace·공급에 전달하는 실행 후보는 이 예약 경계를 적용한다. 예약된 연습 전이를 「기존 과제로 풀 수 있음」으로 안내하지 않으며, 이미 노출된 문항은 일반 경험으로 유지한다. 미노출 전이를 보호하는 것과 독립 전이 실행·자격을 확보하는 것은 별개다.

과거 노출 문항의 지문 식별이 누락됐으면 새로운 후보의 미노출을 증명하지 않는다. 화면용 축약 원장은 타 기록 ID 대신 불확실성 플래그만 보존한다. 보호 서버의 기존 주소는 `R5_READ_ONLY_BASE_URL`, 자동 기동 포트는 `R5_READ_ONLY_PORT`로 지정하며 일반 `PLAYWRIGHT_BASE_URL`과 분리한다.

연습 전이는 T4·Workspace·PLAN에서 적용 경험과 운영량으로만 남는다. 효과 신호는 `activity=practice`를 제외하며 전이는 활동·세션·TASK·현재 주석 해시를 `attemptRole()`로 결속한 경우만 적격 후보로 쓴다. 납품↔G2 결속·실제 콘텐츠 자격 승인은 추가하지 않았다. [실패·화면·추적 근거](./research/r5-285-independent-20261017/ACCEPTANCE.md).

### V2 Instrument 독립 수용 경계(2026-10-17)

ContextSensePanel은 B 판별 조건 성공과 C 문장 선택을 분리하고(V2-F1: 제출 전 뜻 선택지 없음 · 뜻 D 는 B 정답 저장 뒤의 기록 없는 연습 · 유형별 밑줄 표지, [V2_F1_CUE_LEAK](./csat-learner/v62/V2_F1_CUE_LEAK.md)), writer inserted/duplicate 영수증을 받은 경우만 기록 완료를 표시한다. 제출 중 편집/중복 클릭을 잠근다. 주석·출시는 0개이며 V2 실제 학습 수직은 BLOCKED_CONTENT다. [계약](./csat-learner/v62/LM-G1_5a_V2_INSTRUMENT.md)과 [독립 반례](./research/lm-g1-5a-independent/FINDINGS.md)를 따른다.

## 관리자 작업 영역 (2026-10-19)

AdminShell·AdminSidebar·lib/admin/navigation.ts가 작업 홈/콘텐츠/교재/어휘/학습자/연구/운영의 소속·내부 내비를 공유한다. 영어·어휘 진단 엔진과 학습 데이터 계약은 변경하지 않았다. 문항·해설은 authoring의 두 보기이며 도서 입력은 세 작업 보기 안에서 선택한다. 상세는 [ADMIN_CONSOLE](./ADMIN_CONSOLE.md).
