# Design System

2026-10-23 TASK 밀도·연결 미리보기: 개요도 `--g-core-node-h:46px`·최대206px를 사용한다. `--g-hover-reach:12px` 안의 포인터/키보드 포커스에 연결을 강조하고 벗어나면 선택 문맥을 복원한다. 이 미리보기는 선택·URL·단일 상세를 열지 않는다. 실선/연구 중 점선의 의미는 유지한다.

2026-10-23 CSAT 메뉴 정정: 홈/탐구/문항/기록/진단/공식/연습은 CsatRail의 같은 항목·순서·248px 레일을 쓴다. HomeLanding은 메뉴나 메뉴 전용 CSS를 주입하지 않는다. 접힘64px와 저장된 선택은 공통이며 개인 화면은 자신의 링크만 현재 위치로 표시한다. 기출 찾기는 공통 레일이 단일 팝업과 포커스 복귀를 소유한다.

2026-10-22 첫 진입 홈 정정: PC 기본 화면은 펼친 왼쪽 메뉴·240px 패턴 배너·Workspace/학습지도 탭·흰 목록 작업면이다. 기본 Workspace 탭에서는 목표/기록/지도가 아래에 노출되지 않는다. 같은 지도를 마운트한 채 숨겨 선택/편집 상태를 보존하고, 지도 탭이나 행의 지도 아이콘으로 노출한다. 단일 상세·키보드 좌우/Home/End·복귀 문맥은 유지한다.

2026-10-22 CSAT 메인 후속: 첨부 Recents처럼 중립 기하 패턴과 청록/초록/분홍 포인트 배너에 실제 다음 행동 카드를 두고 흰 Workspace 목록을 먼저 보여 준다. 행은 아이콘·짧은 이름/연결 TASK·단계·수행량·상태·간결한 실행으로 정리한다. 배지/박스/중복 범례를 줄이며 상세는 기존 한 팝업이다.

CSAT 학습계획은 계획·가능·수행·남음을 단위가 있는 숫자 칸으로 표시하고 목표/산정 규칙/판단 기준을 아이콘 펼침 영역에 둔다. 상세의 탭·연결 항목이 바뀌면 본문 스크롤을 처음으로 돌린다. 학습 단계 시트는 현재 기록과 다음 행동을 먼저 보여 주며 수능/목표 관계 설명은 아래에 접는다.

2026-10-22 CSAT PC 정정: 보라색 일괄 변경을 중립 캔버스·먹색 본문·얇은 중립선·먹색 배경막으로 복원했다. 학습지도는 영역 아이콘/두 줄 노드/관계선, 학습단위 Workspace는 리스트형 고정과 상세 안의 단계별 다색 카드, 상세는 고정 헤더/탭/바닥 행동이 있는 하나의 창이다. LearningDetailDialog가 개요·근거·계획을 전환하고 기존 단계 근거도 인라인 영역으로 표시한다. PC 중앙 팝업은 공통 `--csat-modal-*`로 참조680×760·머리/바닥56을 사용하며 작은 PC 높이에서는64px 여백 안으로 줄어든다. 목표 설정도 공통 MapDialog를 사용한다(작은 화면은 기존 팝오버). 전체 노드206×46·피치272는 참조 명세이며 개요 노드도 2026-10-23 정정으로 같은 높이를 쓴다. Workspace는 단계별 아이콘/준비 수 카드, 첫 시작은 계획→자료→확인 도식으로 표현한다. 중복 설명과 상세 근거는 아이콘이 있는 펼침 영역으로 옮긴다. [구조 대응 정본](../DESIGN.md).

공용 훅의 경계 보완: 여러 이력을 한 번에 건너뛰면 목적지 위의 창을 함께 닫고 이미 소비한 이력을 다시 걷지 않는다. 닫힘 대상 중 처리 중인 창이 있으면 전체 이동을 복구한다. 호출부가 최상위 창 안의 검색 입력에 명시적으로 둔 초기 포커스는 유지한다. 격리 브라우저 검사는 사설 Next 빌드 대신 실제 globals·토큰 CSS와 Tailwind 설정을 직접 컴파일한다.

실물 사용성 보완(2026-10-20): 공용 Dialog는 React 초기 자식 effect 순서와 포털 DOM 순서에 의존하지 않고 최상위 창의 Tab/Escape·시각 층·부모 포커스 복원을 처리한다. 논리적 식별자가 있는 목록 트리거는 같은 경로의 DOM 교체 후에도 복원하되 다른 사용자 포커스와 남은 부모 팝업을 우선한다. URL로 선택한 상세는 `historyReturnHref`로 닫힌 목록을 이전 이력에 보관하며, 종료 후 이동은 Router의 popstate 처리 뒤 실행한다. 마지막 Dialog가 닫힐 때 배경 스크롤을 원래 값으로 복원한다. 긴 본문은 이름 있는 키보드 스크롤 영역이며 `closeDisabled`는 작업 중 닫기와 Back 이력 소비를 함께 막는다. 관리자 작은 상태 글자는 `adminTextInk`로 기존 `-ink` 토큰을 사용하고 점·막대·면의 원색은 유지한다. 채운 배지는 잉크 배경과 테마별 반전 글자를 함께 쓴다. 새 스타일/외부 참조 일치 검증은 아니다. [관리자 실물 점검](admin-restructure/usability-audit.md).

> **[동결]** 아트디렉션 · 벤치마크 · 이력 절은 **실물 확인 전 초안**이다. Stage 5 에서 실물(실제 라우트 캡처) 기준으로 교체된다. **수정 금지** — 고칠 것이 보이면 화면을 먼저 고치고 그 화면에서 값을 다시 뽑는다(DD-62).
2026-10-21 삽화 품질: `lib/design/editorial-art.ts`가 PC 큰 장면과 모듈 안내의 버전을 연결한다. 내장 imagegen으로 만든 장면10종은 원본 PNG를 보존하며 Next Image가 전달 크기를 최적화한다. 재인/생성/청취/조립/추론/유창성의 실루엣을 분리하고 연습 주 그림은440px, 보조는156px로 배치한다. 작은 분류 소품을 큰 대표 그림으로 확대하지 않는다. 작은 화면의 기존 타일과3B, 실제 콘텐츠 이미지는 별개로 유지한다. [자산과 생성 지시](design/illustration-quality-v5.json) · [감사§0-31](design/learner-tines-audit.md).

2026-10-21 학습 환경: `learning-colors.ts`의 활동별 색을 라우트/연습 선택이 공유한다. PC 명시적 `data-learner-tone`은 중립 본문·24% 틴트와 작은 범주 잉크로 표시하며 기존 순환색/진한 면은 작은 화면 호환층이다. 허브 주제는 기사 계열, 단어장 단계는 중립/현재 단계 표시다. 플래시카드는 두 면의 내용 높이를 같은 grid cell에서 계산해 긴 해설/확대 후 잘림을 방지하고, PC 숨긴 면은 inert/aria-hidden으로 구분한다. 정답면 그림은 원래 URL의 전체 구도·키보드 확대/공통 Dialog를 사용하며 듣기 표식을 예문 위에 겹치지 않게 배치한다. [검증과 사람 평가 경계 §0-30](design/learner-tines-audit.md).

2026-10-21 공개 미디어 잔여: PC 학습자의 `ComponentVideo`는 외부 포스터 실패 시 `video/poster-art.ts`에서 메시지/유형에 맞는 기존 자체 선화를 선택한다. 실제 영상 프레임으로 오인하지 않도록 안내 그림 표기를 붙인다. 정상 포스터는 유지하며 PC 재생 실패에는 영상 중단 아이콘·재시도·버튼 포커스를 제공한다. 작은 화면·3B의 기존 포스터 처리는 유지한다. 실제 원본 영상 전송/보호 화면 수용과 실패 주입/합성 미디어 검사는 [감사 §0-29](design/learner-tines-audit.md)에서 구분한다.

2026-10-20 콘텐츠/활동 색 역할 후속(최신): `learner-palette.ts`는 자료 종류뿐 아니라 학습 그룹·예상 반복도·집중/탐색·핵심/보조를 구분한다. 활동 트랙은 React 미술 없이 공유하는 `game/learning-tracks.ts`가 소유하며 카탈로그의 기존 분류/함수는 그대로 재노출한다. 재인 라벤더·생성 노랑·추론 복숭아를 목록/안내/팝업에서 이어 쓴다. 빈번한 작업의 `--area-surface`는 범주 틴트32%+지면, 집중 화면 제목은 중립이다. 같은 책/기사와 허브 기능 카드는 순번이 아니라 자료/활동에 따라 색을 유지한다. WordVault 복습·교재 실제 문항은 부모 서가와 다른 활동색을 쓸 수 있다. 색의 면적을 줄이되 글자 대비·CTA·기억4색은 유지한다. 실제 빈도·예상 반복도와 실제/격리 검사의 구분은 [감사 §0-28](design/learner-tines-audit.md)을 따른다.

2026-10-20 전수 색 보완: `learner-palette.ts` → `LearnerColorScope`의 팔레트 표식 → PC `--area-ink`/`--area-surface` 순서로 91경로의 기능별 제목/면을 정한다. `--p`는 브랜드/핵심 조작이며 모든 h1/본문의 기본색이 아니다. 명시적 `tone-*`는 실제 color를 자신의 `--t1`에 연결해 상위에서 계산된 중립/보라 색이 그대로 상속되지 않게 한다. 포털 Dialog 제목도 구역 잉크를 쓰되 명시적 면과 게임 보드 미술은 유지한다. 공개/아케이드/순위표/인증의 일괄 보라 글자를 정리했다. 실제 익명40조건·공통143조건·전수91경로 소스/스타일과 계정 수용 미검증은 [감사 §0-27](design/learner-tines-audit.md)을 따른다. 아래 §0-26 결과는 이전 회차 기록이다.

2026-10-20 색상 재디자인: PC 학습자는 `skins/learner-pc.css`에서 읽기/보조 문구·구분선을 중립색으로 두고, 콘텐츠 면은 초록/복숭아/분홍/청록/라벤더의 대응 잉크를 쓴다. 보라는 브랜드 제목·중요 조작에 둔다. `LearnerColorScope`는 `/csat`·`/admin`·개발 경로에서 표식을 제거하며 1024px 미만에는 새 색 재정의가 적용되지 않는다. 기존 표지/삽화와 기억 의미색4종은 유지한다. 근거/실제8조건·격리22조건·새 참조 렌더 제한은 [감사 §0-26](design/learner-tines-audit.md).

2026-10-20 최종 보완: My Library PC는 중복 범주 판/광택 타일을 접고 승인 서가 장면과 열린 제목을 사용한다. 자료 조회 실패는 신규 빈 상태와 분리하며 재시도·삽화를 낸다. 개인 인사이트는 실제 값 미연결 시 기억 예시 수치를 표시하지 않고 단어장 링크를 낸다. 순위표 캔버스는 존재하는 `--bg`를 쓴다. 실제/격리·91개 수용 미달·DB 사고42행 복구 승인 대기는 [감사 §0-25](design/learner-tines-audit.md)에 기록했다.

2026-10-20 읽기 팝업 후속: 비모달 타이포/목차는 `usePopoverFocus`로 선택 항목 진입·Esc 복귀를 보장하고 바깥 포커스는 유지한다. 인사이트는 기존 `useFocusTrap`으로 첫 포커스·Tab 순환·복귀, 원래 body overflow 복원을 처리한다. 읽기 헤더/목차/인사이트 닫기는 PC44px이며 모서리10px/내용형16px 등 기존 Tines 껍데기는 유지했다. 실제 컴포넌트 격리16/16과 실제3000 대표4 R16/I18을 구분한다. [감사 §0-24](design/learner-tines-audit.md).

2026-10-20 잔여 보완: 게임 공간/짧은 글/설정의 장면을 게임 보드·신문/지구본·조절 장치로 분리했다. 학습자 PC(`lg` 이상)의 목차 그룹/행 및 사전 팝업 조작부는 44px다. `WordLookupPopover`의 `desktopLearner`는 공개 미리보기와 개인 읽기에서 켜며, PC에서 조회 실패를 미등재와 구분하고 아이콘/재시도 버튼을 낸다. 관리자 기본 호출·작은 화면의 기존 표현은 유지한다. 실제 정상 사전 뜻의 브라우저 전송은 네트워크 차단으로 미검증이며 읽기 전용 RPC 확인/실패 회귀와 구분한다. 증거: 감사 §0-23/25·`tmp/learner-residual/`.

2026-10-20 이미지 다양성 보완: 계획 `scene-plan-board-v1`, 리포트 `scene-report-analysis-v1`, 진단 이력 `scene-history-route-v1`은 서로 다른 사물/실루엣의 투명 선화다. 기존 성장 장면/자산은 보존한다. Read 메뉴의 My Library는 광택 `tile-read` 대신 기존 평면 `spot-reading`을 쓴다. AppHeader의 열린 패널 안에서 Esc를 누르면 열기 버튼으로 포커스가 돌아가며, 패널 밖 포커스는 옮기지 않는다. 실제 3000의 증거는 `tmp/scene-diversity/`에 보존한다.

전역 검색 결과는 도서·단어·화면·영상의 lucide 아이콘을 텍스트와 함께 표시한다. 정보형 팝업에 장식 그림을 무조건 넣는 대신 유형 인식을 돕는 시각 표식을 쓴다. 링크/정의 행의 의미와 검색 결과 계약은 유지한다.

S20/S21(2026-10-20): PC 허브의 상태·추천 도서 병렬 배치와 표지 실패 비율을 `learner-reference.css`에서 보완했다. 개인 관리의 목차 레일·열린 머리/장면은 `account-reference.css`의4개 페이지 루트에만 적용한다. S20 최초 실제 R16/I14, S21 after는 외부 연결 차단으로 미검증이다. 상세는 [감사 §0-20](design/learner-tines-audit.md).

> **[과거 기록 · 현행 규칙 아님]** v07 주묵 판면과 그 뒤 스킨 기록이 섞인 재료 문서다. 토큰 이름·접근성·기억 4색 규칙은 코드(`tokens.css`·`skins/*`)가 정본이다. 2026-10-03 사용자 결정으로 스타일 정본은 [DESIGN.md](../DESIGN.md)(PC 학습자 = Tines · /csat·/admin = 3B · PC 웹만)이다(DD-83). 옛 「동결 · 수정 금지」(DD-62)는 해제됐다 — 이 문서는 근거·이력으로만 읽는다.

> 디자인 작업 진입: [DESIGN.md](../DESIGN.md) · 캡처·비평·수정과 로컬 픽셀 비교: [디자인 작업 절차](design/06-workflow.md).

> Vocaflow 디자인 시스템 **v07 「주묵 판면」 기록(2026-10-03 대체됨 — 정본은 DESIGN.md)**(Reading Room 지면 위 주묵 한 색) · 2026-09-18 축약판.
> **값의 정본은 코드다**: `packages/design-tokens/src/tokens.css`(웹) · `colors.ts`(RN) · `apps/web/src/app/globals.css`(앱 도메인 토큰).
> 이 문서의 값은 2026-09-18 에 그 파일들에서 읽었다. 어긋나면 코드가 맞고 이 문서가 낡은 것이다.
>
> **이력은 본문에 두지 않는다** — iOS Indigo SSoT(v06.38, 폐기값) · World-class 벤치마크 · Reading Room 정제 경위 ·
> 옛 CSS 변수 블록(Tailwind 기본색) · 버튼 클래스 문자열 · 매대 실측 서사 · 정정 이력 원문은
> [design/archive/DESIGN_SYSTEM_history.md](design/archive/DESIGN_SYSTEM_history.md) 에 1,509줄 그대로 있다.
> 형태를 **만드는** 절차(§G)는 [vocaflow-design](../.claude/skills/vocaflow-design/SKILL.md), 이 문서는 **재료**다.

---

> **화면 바탕(2026-10-20 재확인)** — `--canvas`와 `--bg` 모두 기본 `tines.css`에 정의되어 있다. 이전 「canvas 미정의」 설명은 스킨 파일을 읽지 않은 검사기의 오탐이었다. 검사기는 globals가 실제 import한 스킨 정의도 읽도록 고쳤다. PC 학습자 다크 캔버스 재정의는 `learner-pc.css`가 소유한다.

## 🎯 공개 화면 · 계측 · 모션 토큰

공개 상세(S19, 2026-10-20): `detail-reference.css`는 공개 도서/글/교재의 PC 폭과 열린 구획·중복 머리 접기, `ranking-reference.css`는 공개 순위표의 현재 테마/승인 growth v4/밑줄 기간 탭/큰 기존 마크를 소유한다. 교재의 가변 수치 열은 auto-fit으로 실제 항목 수를 따라 빈 색 칸을 만들지 않는다. `PdModernReader.publicPresentation`은 공개 호출부만 선택하며 PC 실패 안내·원본 재시도·복구 후 그림으로 포커스 복귀를 제공한다. 실패한 숨긴 img의 재시도는 eager로 읽어 lazy에 막히지 않게 하며, 관리자 기본 호출과 작은 화면의 기존 표현은 유지한다.

공개 진입(S18, 2026-10-20): `public-reference.css`가 PC 홈의 짧은 제목/승인 library v4 두 열, 요금제의 열린 비교 열, 영상 머리/상세, 법률 읽기 칸/44px 목차와 잘못된 초대 링크 안내를 소유한다. `sitemap-reference.css`는 정본 내비 아이콘과 열린 두 열을 표시한다. 두 파일은 1024px 이상에 적용하며 작은 화면의 기존 표현을 보존한다. 법률/가격/영상 자막 내용·실제 영상 경로·계정 처리 규칙은 유지한다.

인증 화면(S17, 2026-10-20): `(auth)/layout.tsx`의 `auth-reference.css`가 PC 열린 안내/폼 두 열과 자체 계정 장면을 제공한다. 입력48px·주 CTA 알약·명확한 포커스·동의 행과 안내 링크44px을 유지하며 작은 화면의 기존 카드 구조는 그대로다. 예전 범주 틴트의 잉크가 남지 않도록 안내 문구는 공통 보라 잉크를 쓴다. 폼/오류/권한/인증 쓰기는 각 기존 페이지가 소유한다.

공개 Game Lab(S16, 2026-10-19): `arcade-reference.css`가 PC 목록의 목차 레일·열린 머리·구역별 틴트 마크·현재 테마 상태 줄/자료 배너를 제공한다. 자체 머리가 있으므로 `data-module-banner`는 이 PC 목록에서만 접는다. 허브에서 `BriefButton`/`GameBriefModal`/`CourseBoard.catalogPresentation`을 지정하고 기본 호출은 유지한다. 설명은 긴 규칙을 details로 접고 실제 보드3장을 넓은 행으로 배치하며 게임 자체의 보드/성공/실패 표현은 보존한다.

공개 지문 진단(S15, 2026-10-19): `/fit` 하위 layout이 `fit-reference.css`를 로드한다. PC screen 미디어에서만 세 겹 Frame 면을 걷고 지문/판정을 두 열로 배치한다. 공유 결과도 같은 폭/머리를 쓴다. 어려운 낱말은 기존 값/목록을 열린 행으로 표시하며, 인쇄 CSS·분석·공유 페이로드는 변경하지 않는다. 승인 journey v4와 기존 단계 그림·근거 lucide 아이콘을 재사용한다.

만화 서가 확장(S14, 2026-10-19): `LibraryBrowseFrame.rail`에 `ComicsTabs` 레일을 지정한다. PC에서만 열린 머리·자체 만화 삽화·표지 격자/행을 적용하고 기존 모바일 형태는 유지한다. `ReferenceBookImage.kind`는 기존 book 외 comic/preview의 아이콘과 실패 안내를 구분한다. 장식 삽화로 원본 만화 내용을 대신하지 않는다. 정보 팝업은 공통 `Dialog`를 유지한다.

공개 서가 확장(S13, 2026-10-19): `LibraryBrowseFrame`의 288px 자료 유형 레일과 열린 머리를 Dispatches·Decks·Textbooks가 공유한다. 스타일은 `learner-reference.css`의 PC 범위에서만 적용하고 검색·필터·정렬 상태는 기존 부품에 유지한다. 머리에는 승인 v4, 아티클 주제에는 기존 lucide 체계를 사용한다. 캐러셀의 viewport 탈출 폭은 본문 폭에 맞추며 다섯 표지가 경계를 넘지 않는지 실제 키보드 시나리오로 검사한다.

삽화 표현 재조정(2026-10-19, 감사 §0-12): v3의 촘촘한 정원 표현을 자체 v4 장면4장으로 대체했다. Tines Product 삽화를 기준으로 보라 선·평면 색·분리된 사물·기능 디테일을 사용한다. 기존 UI 토큰과 기억 4색은 유지했다. [자산 근거](design/learner-scene-assets.md).

색감 재정정(2026-10-19, 감사 §0-11): 자체 장면은 `scene-*-v3.webp`로 교체했다. 이전 v2의 갈색·세이지 해석을 대체하고 Tines 참조 삽화에서 측정한 라벤더·민트·주황·분홍·보라 윤곽을 사용한다. 가벼움은 색 면적과 열린 구성으로 조절한다. UI 토큰·기억 4색은 유지한다. [자산 근거](design/learner-scene-assets.md).

사용자 재판정(2026-10-19, 감사 §0-10): 아래의 411px 단색 머리·틴트 추천 카드 후보는 열린 지면·상세 장면·표지 중심 목록으로 대체한다. `AreaHero.desktopScene/desktopSub`는 PC에서만 장면·짧은 부제를 쓰고 기존 호출부는 그대로다. 허브의 진한 플랫폼·통판·효익·마지막 액자는 화면 안 PC 선택자로 옅은 면과 열린 배치로 바꾼다. 글자 대비·기억 색은 유지한다. 자산 목록은 [learner-scene-assets](design/learner-scene-assets.md).

PC 본문 적용(2026-10-19, [감사 §0-9](design/learner-tines-audit.md#0-9-codex-본문-재구성2026-10-19)): `learner-reference.css`는 1024px 이상에서 서가의 288px 레일·411px 머리·2열 추천 카드, 허브의 열린 레일·표, 성장의 좌우 구획, 단어장의 격자 머리·열린 기억 분포를 배치한다. `AreaNav`는 PC에서 같은 링크 DOM을 `CompassRibbon`의 슬롯으로 옮기고, 옮길 곳이 없으면 원래 위치를 쓴다. 모노에 한글이 없으므로 한글 CTA는 기존 `PILL`의 산세리프 14px/700을 유지한다. 캡처의 서버 컴포넌트 표시만으로 hydration 완료를 판단하지 않으며, 서가는 옮겨진 내비까지 기다린다.

### 1. 공개 화면 — 정직성 · 줄바꿈

(첫인상 규칙 I1–I4 · I6 · I8 과 히어로 순서 규칙은 DD-66 으로 삭제.)

| # | 규칙 | 검사법 |
|---|---|---|
| **I5** | 수치는 **DB 실측 또는 그 자리 계산값**만 | `components/marketing/__tests__/no-hardcoded-stats.test.ts` |
| **I7** | 한글에 `break-keep` — 없으면 390px 에서 낱말이 쪼개진다 | 2026-09-04 랜딩 H1 "다른 겁니 / 다" |

### 2. 계측 · 데이터

(이탈 방지 규칙 D1 · D5(빈 상태) · D6(비난 금지) · D7(화면 전환 ≤ 3)은 DD-66 으로 삭제.)

| # | 규칙 | 근거 |
|---|---|---|
| **D2** | 새 공개 화면은 **진입 + 내부 상호작용 이벤트**를 같은 커밋에 | `lib/analytics/events.ts` 닫힌 목록 |
| **D3** | 이벤트 속성은 숫자·불리언·닫힌 열거형만 | 타입이 강제(지문 유출 차단) |
| **D4** | 파생 가능한 것은 수집하지 않는다 | `lib/admin/retention-math.ts` |

### 3. 모션 토큰

(모션 예산 상한 — 스태거·이동 거리·총 1초·`transform`/`opacity` 한정 — 은 DD-66 으로 삭제. 아래는 토큰 값이다.)

| 항목 | 값 | 토큰 |
|---|---|---|
| 마이크로 (호버·프레스·토글) | 100–200ms | `--dur-fast` 100ms · `--dur-quick` 150ms · `--dur-normal` 200ms |
| 표준 전환 (패널·모달·페이지) | 200–300ms | `--dur-normal` · `--dur-slow` 300ms |
| 이징 | `cubic-bezier(.4, 0, .2, 1)` · 진입 `cubic-bezier(.22, 1, .36, 1)` | `--ease` · `--ease-out-quint` |
| 정지 배경 앰비언트 | 4s | `--dur-breath` |
| 반복 모션 한 바퀴 | 2s · 4s · 30s | `--dur-loop-fast` · `--dur-loop` · `--dur-loop-slow` (DD-65) |

#### 3.1 `prefers-reduced-motion` 은 끄기가 아니라 **낮추기**

`globals.css` 전역 블록 — 회귀 `lib/a11y/__tests__/reduced-motion.test.ts`:

| 대상 | 처리 | 왜 |
|---|---|---|
| 키프레임 애니메이션 | `0.01ms` + `iteration-count: 1` | 늘리면 4s 앰비언트가 빠른 팝이 된다 |
| 전환 시간 | `--dur-fast`(100ms) — 죽이지 않고 낮춘다 | 상태가 바뀌었다는 사실은 남아야 한다 |
| 전환 대상 | `opacity·color·background-color·border-color·outline-color·box-shadow·fill·stroke` 만 | 이동·회전·스케일은 즉시 최종값 |

⚠️ `transform: none` 으로 지우지 않는다(`-translate-x-1/2` 중앙 정렬이 무너진다). 대상 제한과 시간 완화는 **한 쌍**이다.
진입 연출이 꼭 필요한 표면은 자기 규칙으로 **페이드만** 되살린다(`.wayfinder-reveal` → `wayfinder-fade`).
앱 안 토글은 `html[data-reduced-motion='on']`(`components/layout/DevicePreferences.tsx`), JS 구동 모션은 `useReduceMotion()` 분기.

#### 3.2 (학습 화면 모션 화이트리스트 7종 · 「항상 금지」 목록 — DD-66 으로 삭제)

현재 학습 화면에 쓰이는 모션은 §Motion 사용 매핑에 있다.

---

## 🖋 판면 — 지면 · 잉크 · 주묵

**방향 한 줄**: 헤어라인으로 긋고, 자국(권점·붓 자국)으로 강조하며, 밑줄 두께는 데이터다.
(Reading Room 의 지면·잉크 위에 v07 이 **면적을 가진 색 하나 `--ju`** 와 **데이터가 그리는 표식**을 더했다 — 결정 경위 [design/02-directions.md](design/02-directions.md) · 상세 [design/03-system.md](design/03-system.md).)

| # | 원칙 | 값 |
|---|---|---|
| 1 | 지면·잉크 | 지면 `--bg #FBFAF6` · 잉크 `--t1 #1A1714` |
| 2 | 카드가 아니라 판면 | 기존 `--sh-xs…xl` = `0 0 0 1px var(--bd)`(헤어라인 링). 실제 그림자는 `--sh-soft` · `--sh-drop` · `--sh-overlay`(DD-65, 제약 해제) · 모달류는 `--sh-float` |
| 3 | radius 램프 | `--r-sm/md/lg/xl/2xl` = 2/3/4/5/6px · `--r-3xl/4xl/5xl/6xl` = 8/12/16/24px(DD-65, 6px 상한 해제) · `--r-full` |
| 4 | 주묵은 앱이 지면에 남기는 표식 | 현행 쓰임: 1차 CTA · 활성 표식 · 완료 체크 · 권점 |
| 5 | (동시 노출 색 ≤ 3 — DD-66 으로 삭제) | |
| 6 | 눌리면 들어간다 | 현행 버튼: `active:translate-y-[1px]` · `transition-all` 대신 속성 나열 |

### 면(fill) vs 잉크(ink) — 작은 글자는 반드시 `-ink`

| 용도 | 면/아이콘/테두리 | 글자 (AA 4.5:1) |
|---|---|---|
| 주묵 | `--ju` | `--ju-ink` · 채움 위 `--on-ju` |
| 골드 강조 | `--active` | `--active-ink` |
| 브랜드 채움 / tint | `--p` / `--p-light` | `--on-p` / `--on-p-tint` (테마별 반전) |
| 학습 상태 | `--learn-*` | `--learn-*-ink` |
| semantic | `--success`/`--error`/`--warning`/`--info` | `--*-ink` · 채움 위 `--on-semantic` |
| Memory Decay | `--memory-*` | `--memory-*-ink` |
| ACP 트랙 | `--track-*` | 같은 토큰(라이트=진한 원색 · 다크=밝은 톤) |

**`--t3` 이하를 의미 있는 글자에 쓰지 않는다** — 메타·저자명·설명은 `--t2` 이상, `--t4` 는 장식·비활성 전용.
측정 근거 ADR-004([DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)) · 회귀 `apps/web/tests/e2e/14-learner-quality.spec.ts`(axe AA · 라이트/다크 · 44px).

### 구역 스킨 — Admin 앱 (DD-82)

`/admin` 이하(`app/admin/layout.tsx` 의 `data-area="admin"`)에서는 `packages/design-tokens/src/skins/admin-app.css` 가 Tines 스킨 **위에** 같은 토큰 이름을 레퍼런스 앱(`neon-currant.3b.dev`) 실측값으로 덮는다 — 선택자 `:root:has([data-area="admin"])` 라 body 포털(Dialog)도 받는다. 값: `--p`/`--admin`/`--ju` 먹색 `#0d0d17` · `--on-p` `#fcf9f5` · `--bg` `#fff` · `--bg2` `#fbf9f7` · `--bg3` `#eeebe7` · `--t1/2/3` `#0d0d17`/`#5e5f6c`/`#62616a` · `--bd` `rgba(13,13,23,.1)` · `--ju-wash`(선택 면) `rgba(84,50,0,.08)` · `--r-md` 8px · `--r-lg` 12px · 서체 `--font-admin-sans`(Inter)/`--font-admin-mono`(JetBrains Mono). Dialog 는 `--dialog-backdrop` · `--dialog-blur` · `--dialog-title-{sm,md,lg}` 변수를 읽는다(없으면 기존 값). 다크는 레퍼런스 `light-dark()` 두 번째 값. 대비표·출처 [design/reference-analysis](./design/reference-analysis.md).

> **투명도는 `color-mix` 로 쓴다.** Tailwind 3.4 는 `bg-[var(--p)]/10` 처럼 변수 색에 붙은 `/N` 을 CSS 로 만들지 않는다(조용히 사라진다). `bg-[color-mix(in_srgb,var(--p)_10%,transparent)]` · 인라인은 `color-mix(in srgb, var(--p) 10%, transparent)`. 템플릿 `${색}40` 도 색이 `var()` 면 무효다. admin 은 `admin-color-tokens.test.ts` 가 막는다.

### 화면 스킨 — Tines (DD-68)

`<html data-skin="tines">` 이면 `packages/design-tokens/src/skins/tines.css` 가 같은 토큰 이름(`--p` · `--bg*` · `--t*` · `--bd` · 의미색 · `--r-sm…2xl` · 서체 변수)을 참조 사이트 실측값으로 덮어쓴다. 기본값은 켜짐(`NEXT_PUBLIC_SKIN`, 끄기 `off`), 브라우저 `?skin=off|tines`. 앱(RN) 값은 `skins/tines.ts` — 두 출처는 `skin-parity.test.ts` 가 묶는다.

| 자리 | 라이트 | 다크 |
|---|---|---|
| `--bg` · `--bg2` · `--bg3` | `#fcf9f5` · `#f5f2fb` · `#ece8fd` | `#191226` · `#211735` · `#2a1b49` |
| `--t1` · `--t2…t3` | 제목 `#5d38ae`(7.57:1) · 본문 `#714bd0`(5.53:1) — 참조 dna §2 | `#ded8ff` · `#c3b5ff` · `#aa94ff` |
| `--tint-*` 6 | lavender `#ece8fd` · green `#e4eee6` · peach `#ffeedd` · yellow `#fff1d1` · pink `#ffc7e5` · teal `#bee9e4` — 위 글자는 `--t1`(5.5:1↑) | 다크 짙은 틴트 6 · 기본(스킨 끔)은 기존 옅은 의미색을 가리킨다 |
| `--p` · `--on-p` | `#542f9c` · `#fcf9f5` | `#aa94ff` · `#191226` |
| `--bd` | `#c3b5ff` | `#3f2374` |
| `--r-sm…2xl` | 4 · 6 · 12 · 14 · 24px | (라이트와 같음) |
| 서체 | Figtree · Petrona · Space Mono · 한글 Pretendard / Hahmlet | |

면 톤 · 범주 색(DD-68 · tines-mapping §13, 참조 151페이지 실측): 틴트 6 은 **짝 글자**(`--tint-*-ink` — 초록 `#005d35` · 살구 `#8a3701` · 노랑 `#7a4d16` · 분홍 `#8a1f57` · 청록 `#006d6d` · 라벤더 `#5d38ae`, 5.2~7.0:1)를 갖고, 진한 면 6(`--deep-purple/green/orange/magenta/ink/charcoal`, 위 글자 `--on-deep` 크림 4.9~13.1:1)이 있다. 면에는 `globals.css` 의 `.tone-<틴트>` · `.tone-deep-<색>` 클래스를 쓴다 — 면 안의 `--t1/--t2/--t3/--ju/--bd` 를 그 색상으로 바꾸므로 기존 부품이 고치지 않고 따라온다. 범주 색은 `lib/design/tone.ts`(`MATERIAL_TONE` 도서 초록 · 기사 살구 · 단어장 분홍 · 교재 라벤더 · 만화 노랑 / `MODULE_TONE` 모듈 10).

참조 UI 부품(DD-68 · tines-mapping §14): 클래스 키트 `components/ui/tines-kit.ts`(`BTN.primary/secondary/soft/onDeep/text` · `CHIP` · `INPUT` · `CARD` · `SEG`) · 색 탭 `components/ui/ToneTabs` · 빈 상태 틀 `components/ui/SpotState`(용도별 소품) · 스킨 모양 층(globals.css — 버튼 조합 알약 · 검은 막 → 라벤더 유리 · 입력 테두리 `--bd-input`). 토큰 `--bd-input` · 스킨 `--bd-strong #aa94ff` · iOS 글로우 없음.

스킨 위 앱 부품(DD-68): `components/layout/AreaNav` — 구역 하위 내비(라벤더 알약 막대, 선택 면 = 막대 면에 `--ju` 12% 섞음) · `.dots` — 옅은 면 위 점 격자 질감(면 글자색 12% · 12px, tines-mapping §25) · `components/layout/AreaHero` — 앱 구역 머리(범주 색 **진한 판** 안 2열 · 오른쪽 타일 · 선택 `tabs` = 판 아랫변 폴더 탭, 고른 탭 면 `--bg2` · tines-mapping §24). 틴트 면 위 본문은 `--t2` 까지 — 분홍 · 청록 면에는 `--t1` 만 쓴다(`#714bd0` 가 4.0 · 4.4:1).

팝업 골격(DD-68 · tines-mapping §28): `components/ui/Dialog` 하나가 저장소의 모든 팝업 껍데기다 — 밝은 배경막(`--bg` 72% + blur, 어둡게 덮지 않는다) · 크림 패널 1px `--bd` · `--r-2xl` · `--sh-float` · 머리(빵부스러기 알약 → 40px 제목 → 작성자 줄 → 윤곽선 태그 + 오른쪽 메타) → 가로선 → 본문 → 바닥 알약 버튼 줄. 부품 `DialogColumns`(1.8:1 2열) · `DialogTintPanel`(`.tone-*` 면 패널) · `DialogSection`. 클래스는 `tines-kit.ts` 의 `DIALOG`(overlay · panel · header · crumbs · title · tag · iconBtn 44px · edgeBtn) · `TINT_PANEL` · `BTN_STACKED`(색 어긋난 겹친 그림자 — 참조 「COPY PROMPT」). Esc · 바깥 · 뒤로가기 · 포커스 가둠·복원 · 스크롤 잠금은 부품의 계약이고, **마운트 = 열림**이다(`isOpen` 없음). `ui/Modal` 은 `isOpen` 을 받는 얇은 호환 층으로 남는다.

### 색 토큰 카탈로그 (현행 · 2026-09-18 실측)

| 토큰 | 라이트 | 다크 | 역할 |
|---|---|---|---|
| `--p` | `#0F2540` | `#6B9BD1` | Deep Ink — 브랜드 행동·링크·포커스(`--bdf`) |
| `--p-hover` / `--p-light` | `#081832` / `#E3E8EE` | `#87B0DC` / `rgba(107,155,209,.18)` | |
| `--ju` / `--ju-ink` | `#C0392B` / `#A8342A` | `#E0705C` / `#E0705C` | 주묵 면·선 / 작은 글자 |
| `--ju-light` / `--ju-wash` | `#F5E4E0` / `rgba(192,57,43,.13)` | `rgba(224,112,92,.18)` / `.20` | 활성 행 / 붓 자국 |
| `--active` / `--active-ink` | `#B0843A` / `#7E5A1B` | `#D4A856` / `#D4A856` | 골드 강조 |
| `--success` · `--error` · `--warning` · `--info` | `#2E7D5A` · `#9C3A30` · `#B5803A` · `#50697F` | `#5BA47D` · `#A8443A` · `#CEA254` · `#8AA8C0` | semantic |
| `--accent-plum` | `#7A4A6B` | `#C79AB6` | 여섯 번째 분류 색조(주묵과 헷갈리지 않게 자주 쪽) |
| `--bg` · `--bg2` · `--bg3` | `#FBFAF6` · `#F4F0E9` · `#ECE6DA` | `#231D17` · `#181410` · `#2D261F` | 지면 · 캔버스 · 채움 |
| `--t1` · `--t2` · `--t3` · `--t4` | `#1A1714` · α.74 · α.62 · α.20 | `#F0EAE0` · α.74 · α.62 · α.20 | 잉크 알파 4단 |
| `--bd` · `--bde` | `#E0DBD0` · `#9C3A30` | `#3D362D` · — | 헤어라인 · 오류 테두리 |
| `--grid-line` | `color-mix(--bd 40%, transparent)` | `color-mix(--bd 55%, transparent)` | 모눈 무대(1px · 24px) — 현행 자리: 삽화·증명 액자·공개 히어로·빈 상태 바탕. SVG `<pattern>` 으로 그린다 · [03-system §3-9](design/03-system.md) |
| `--learn-error` / `-ink` | `#6B6258` / `#57504A` | — | **오답은 중립 흑연**(빨강 아님) |

분류 팔레트(POS 8 · 사이드바 6)는 일반 Tailwind 색조를 지면 색조로 **개수를 보존해** 1:1 로 옮긴 것이다 — 표는 [design/03-system.md §3-2](design/03-system.md).
⚠️ canvas 는 `var()` 를 못 읽는다(조용히 검정). `components/echo/PitchVisualizer.tsx` 두 상수만 hex 로 두고 이유를 적었다.

---

## Memory Decay 색 체계 (앱 전용)

R(t) = `exp(ln(0.9) × t / S)` 를 **동적 계산**한다(`memory_state` 컬럼 저장 금지). 4단계는 모든 학습 모듈에서 동일.

| 상태 | 이름 | 원색 토큰 | 값 | 글자용 잉크 | 조건 |
|---|---|---|---|---|---|
| stable | **안정** | `--memory-stable` | `#2E7D5A` | `--memory-stable-ink` `#1F6B49` | R ≥ 0.95 |
| shaky | **흔들림** | `--memory-shaky` | `#B5803A` | `--memory-shaky-ink` `#7A5200` | 0.70 ≤ R < 0.95 |
| risk | **흐릿함** | `--memory-risk` | `#9C3A30` | `--memory-risk-ink` `#9C3A30` | R < 0.70 |
| new | **새 단어** | `--memory-new` | `#8A8278` | `--memory-new-ink` `#5F5A52` | D/S 미부여 |

- **이름은 `lib/framework/memory-labels.ts` 가 소유한다** — `MEMORY_LABEL[state].{label,says,token}` 을 import. 화면에서 짓지 않는다(2026-08-16 여섯 곳이 다섯 벌을 쓰고 있었다). `위급` 은 쓰지 않는다(압박 말투).
- `shaky + risk` **합계**에는 상태 이름을 붙이지 않는다 → `MEMORY_ATTENTION_LABEL`(`'다시 볼'`). 래칫 `lib/framework/__tests__/memory-labels.test.ts`.
- **원색 vs 잉크**: 면·점·막대는 원색, 작은 글자는 잉크(shaky 원색은 `--bg` 위 3.29:1).
- `--memory-risk` 는 망각도이지 평가가 아니다 — 주묵과 색이 가깝지만 **두께가 함께 말한다**(아래 형태 문법 F1).

---

## ✒ 형태 문법 — 데이터가 선을 긋는다 (공용)

> **2026-09-18 승격.** 이 문법은 CSAT 분석 화면(`visual-analysis.module.css`)과 `components/ui/press` 에서 먼저 자랐고,
> 원 결정은 "모듈 CSS 가 소유 · 공용 토큰 신설 금지"였다. 이 절은 그 결정을 존중해 **토큰을 새로 만들지 않고**
> 기존 토큰만으로 **문법(선의 뜻)** 을 공용으로 적는다. 다른 모듈이 같은 선을 쓰면 **같은 뜻**이어야 한다.
> 두 모듈 이상이 같은 값을 복사하기 시작하면 그때 토큰을 신설하는 개정을 연다(→ [design/DECISIONS.md](design/DECISIONS.md) DD-03).
> 이 문법을 **어떤 화면의 골격으로 세우는가**의 절차는 vocaflow-design §G 에 있다(참고).

### F1. 선의 두께 = 망각도 (`DecayUnderline`)

| 상태 | 두께 | 선 | 색 |
|---|---|---|---|
| risk | **3px** | solid | `--memory-risk` |
| shaky | **2px** | solid | `--memory-shaky` |
| stable | **1px** | solid | `--memory-stable` |
| new | 2px | **dotted** | `--memory-new` |

R(t) 없이는 그을 수 없는 선이다. 정보는 **두께**가 나르므로 색 단독 전달 금지를 장치 자체가 충족한다(`sr-only` 상태명 동반).
FSRS 상태가 없는 표면은 `bandFromOverdue(overdueDays)` 로 **가진 값**만 두께로 옮긴다 — 상태를 지어내지 않는다.
`components/workspace/ReadingUniverse.tsx`(`/text/[id]`)도 2026-09-18 에 F1 로 옮겼다 — 그 전의 v06 표현(1.5px dashed + `word-pulse` 4s **무한** + 하드코딩 `rgba`)은
끝나는 상태가 없는 모션이었다([design/DECISIONS.md](design/DECISIONS.md) DD-06). 이 금지는 DD-65 로 해제됐다(라쳇 `infinite-anim` 삭제).

### F2. 관계 선 — 지지 · 배제 · 유인 · 합류

| 관계 | 선 | 끝 | 라벨 | 선택 시 면 |
|---|---|---|---|---|
| **지지** (근거 → 정답) | `--ju` **실선** | 화살표 | 「정답」 | `--ju-light` + 실선 테두리 |
| **배제** (근거 → 오답 제거, origin `reject`) | `--t2` **점선** | **막대 끝** | 「오답 배제」 | `--bg3` + 점선 테두리 |
| **유인** (오답이 끌어당기는 표현, origin `tempt`) | `--t2` 점선 | **화살표** | 「오답 유인」 | — |
| **합류** (두 문항 → 같은 출제 공식) | 연결선 | `=` 기호 | 공식 이름 | — |

- 배제와 유인은 선이 같고 **끝이 다르다** — 막대는 "여기서 끊긴다", 화살표는 "여기로 끌려간다". 원문 주석도 같은 origin 을 따른다.
- 음성(TTS) focus 에는 별도 「현재 설명」 라벨을 함께 표시한다.
- **막대 길이 = 문장 길이**다. 중요도·숙련도 수치로 쓰지 않는다.

### F3. 기록 지도 — 네 기호 × 네 선

| 상태 | 기호 | 선 |
|---|---|---|
| 탐색 전 | ○ | 점선 |
| 살펴봄 | • | 실선 |
| 공식 보관 | ✓ | 이중선 |
| 재확인 | ↻ | 라벨 |

기호·선·라벨이 셋 다 말한다 — 색만으로 의미를 구분하지 않는다.

### F4. 판면 어휘 (`components/ui/press`)

| 컴포넌트 | 문법 |
|---|---|
| `Rule` | 구획은 상자가 아니라 **괘선 + 번호(`01`) + 라벨** |
| `Panel` | 판면 표면 `paper` / `canvas` / `ju` 3톤 |
| `Wash` | 숫자·낱말 뒤 붓 자국(9° skew, `--ju-wash`, `aria-hidden`) |
| `JuMark` | `dot` 권점 · `check` 마친 것 · `now` 지금 할 것 — 스크린리더 라벨 필수 |
| `SealMark` | 낙관 — 라벨 첫 글자를 Hahmlet 으로 주묵 테두리 안에(28/36/44px). 이모지 얼굴의 자리를 대신한다 |
| `Gwonjeom` | 권점 아이콘 — lucide `Sparkles` 의 자리(「추천·새것·눈여겨볼 것」) |
| `PressButton` | 1차 주묵 채움 / 2차 잉크 외곽 / 3차 글자만 · 48px 하한 · 4상태 |
| `Eyebrow` | 작은 라벨 — 현행: 대문자 변환·넓은 트래킹 없음 |

### F5. 비교 판면

두 소재 → 하나의 출제 공식 관계를 **CSS Grid + 괘선**으로 나란히 놓는다(CSAT 홈 `learning-home.module.css` — 2026-09-19 기준 다른 세션의 미커밋 작업).
wrapper 최대 68rem, 읽기면은 42rem. 패턴 교체 `button[aria-pressed]` · 심화 `details/summary` · 필터 `label/select`.

---

## Typography — 현행 4종 (v07)

| 역할 | 글꼴 | Tailwind | 자리 |
|---|---|---|---|
| 한글 디스플레이 | **Hahmlet** 500–600 | `font-editorial` · `font-ko-display` | 제목 · 단어 뜻 · 감성 문장(**이탤릭 없음**) |
| 영어 원문·표제어 | **Lora** 400–600 | `font-english` · `font-editorial` | 지문 · 예문 · 표제어 · 워드마크 · 영어 감성 문장(italic) |
| UI·본문 (한글+라틴) | **IBM Plex Sans KR** 400–700 | `font-display` · `font-body` | 라벨 · 버튼 · 설명 · 내비 |
| 숫자·코드 | **JetBrains Mono** | `font-mono` | 수치 · 키 힌트 · 식별자 (`tabular-nums`) |

```
editorial : var(--font-serif) → var(--font-ko-display) → Lora → Hahmlet → Georgia → serif   (글리프 단위 폴백)
english   : var(--font-serif) → Lora → Georgia → serif        ← 한글을 일부러 넣지 않는다
mono      : … JetBrains Mono → … → var(--font-body) → monospace  ← 한글이 모노 폴백으로 떨어지지 않게
```

- v07 에서 Plus Jakarta Sans / DM Sans 를 제거했다(한글 글리프 0). (금지 서체 목록은 DD-66 으로 삭제.)
- 한글 두 벌은 **`preload: false`**, `subsets` 미지정(수백 조각 전량 preload 방지 — 회귀 `learning-tone.test.ts`).
- `h1~h6` 기본은 세리프(영문 Lora + 한글 Hahmlet, 600) + `word-break: keep-all`.

| 자리 | 크기 |
|---|---|
| Hero · 페이지 제목 (`font-editorial`) | 42–56px (숫자 히어로 72–96px) |
| 섹션 제목 | 22px / 600 |
| 영어 본문 (`font-english`) | 17–20px / 400 / 1.8 |
| 한글 본문 (`font-body`) | 14–17px / 400 / 1.6 |
| 캡션·메타 (`font-mono` / `font-body`) | 11–13px |

---

## Spacing — 4px 기반

`--s-0` 0 · `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · **`--s-4` 16(기본 패딩)** · `--s-5` 20 · **`--s-6` 24(판면 내부)** · `--s-8` 32(섹션 간격) · `--s-10` 40 · `--s-12` 48(페이지 상하) · `--s-16` 64(히어로) · `--s-24` 96 · `--s-40` 160(공개 화면 섹션 간격 390 / 1280+ — [03-system §3-9](design/03-system.md)).

## Elevation · Radius

| | 값 | 쓰는 자리 |
|---|---|---|
| `--sh-xs … --sh-xl` · `--sh-ios-1…3` · `--sh-card` | `0 0 0 1px var(--bd)` | 판면·카드(헤어라인 링) |
| `--sh-float` · `--sh-ios-4` | 링 + `0 18px 48px -12px rgba(26,23,20,.22)` | 모달 · 바텀시트 · 토스트 · 팝오버 |
| `--sh-soft` · `--sh-drop` · `--sh-overlay` | `0 1px 3px` 6% · `0 16px 16px -8px` 10% · `0 24px 80px` 25% (다크 35/50/60%) | 참조 작성값 — DD-65 |
| `--blur-sm` · `--blur-md` · `--blur-lg` | 8 · 12 · 20px | `backdrop-filter` 흐림 — DD-65 |
| `--r-sm` · `--r-md` · `--r-lg` · `--r-xl` · `--r-2xl` | 2 · 3 · 4 · 5 · 6px | 입력 · 버튼 · 판면 · 시트 |
| `--r-3xl` · `--r-4xl` · `--r-5xl` · `--r-6xl` | 8 · 12 · 16 · 24px | 카드 · 패널 (Tailwind `rounded-4xl…6xl`) — DD-65 |
| `--r-ios-modal` | 10px | 실제로 뜨는 시트 |
| `--r-full` | 9999px | 칩 · 아바타 · 진행바 |

## Motion 사용 매핑

```
버튼 호버:      background-color/border-color/color, var(--dur-normal) var(--ease)
버튼 프레스:    translateY(1px)                                                       — 스케일 대신
카드 뒤집기:    rotateY(180deg), 0.55s var(--ease)
정답 피드백:    scale(1.05)→scale(1), --dur-slow, --ease-spring
오답 피드백:    translateX shake 3회, --dur-slow
페이지 전환:    opacity 0→1 + translateY 20→0, stagger 50ms
진행률 바:      width 전환, --dur-slow, --ease-out
점수 카운트업:  0→실제값, 1s, --ease-out
```

## Breakpoints

**390 / 768 / 1280px** (`sm` / `md` / `lg`). 모바일 1열 · 앱 셸 480px · 학습 콘텐츠 `max-w-2xl`(672px) · 대시보드 `max-w-6xl`(1152px).
모바일 하단은 탭이 쓰는 자리 — 페이지 소유 하단 고정 UI 는 `bottom-[var(--tabbar-h)]`(md 이상 0). 겹침은 z-index 가 아니라 `elementFromPoint` 로 판정([CONVENTIONS.md](./CONVENTIONS.md) §하단 고정 UI).

---

### 게임 전용 하드코딩 색상 — 2026-09-06 실측으로 정정

```css
/* ── WordBlitz 정글 전용 ── */
#FFE234  /* 황금 점수 텍스트 */
#3d8a3d  /* 정글 배경 기본 그린 */

/* ── SpellForge 파란 패널 ── */
#4A9FCF  /* 패널 메인 */
#5CB8E0  /* 패널 라이트 (그러데이션 시작) */
#3A7FAF  /* 패널 다크 */

/* ── PairFlip Editorial ── */
#1E3A8A → #1E1B4B  /* 네이비/인디고 그라디언트 */
#F59E0B            /* 골드 */
#FCD34D            /* 골드 라이트 (진행바 그러데이션 끝) */
```

이 목록은 스스로 검증된다 — `components/__tests__/learning-tone.test.ts` 가 모든 색이 **코드에 실재**하는지 검사한다(유령 예외 금지).
목록 밖 학습자 하드코딩 hex 약 308건(2026-09-06)은 측정만 했고 아직 결정 전이다 — 경위는 archive.
만화 표지 장르색(아트워크)도 예외다. **CEFR 분포 색** `--cefr-a1…c2` 는 WordVault `CEFRDistribution` 6막대 전용.

---

## 매대 — 표지 · 진열 · 식별색 (규칙만; 실측 서사는 archive)

- **교재 표지 정본 = `textbook/cover.ts`** — 매대(웹)와 조판기(책)가 같은 함수. 인라인 SVG(토큰·서체·다크 상속). 싣는 것: 시리즈명 · 권 번호 · 학령 · 깊이. **그림 없음**. 클라이언트는 서브패스 `@vocaflow/library-pipeline/textbook-cover` 로 import(루트 import 는 `child_process` 가 딸려 와 500).
- **단어장 표지 정본 = DB 의 각인** `shared_word_sets.curation_query.brand`(`VocabBrandCanvas`). 코드 값은 하한일 뿐 — 규격이 안 맞으면 **캔버스를 고친다**. 격자 타일(150px)은 `drawLockup={false}`. 회귀 `lib/vcb/covers/__tests__/lockup.test.ts`.
- **진열 기본 = 격자** (목록 대비 이미지 면적·첫 화면 상품 수·표지 크기 세 축 모두 우위). 묶음 해제 조건은 *정렬 선택*이지 *격자 선택*이 아니다.
- **배지 = 셀 수 있는 것만** (`해설 100%`). '베스트'·'추천'·'인기' 금지.
- **식별색 = 색상은 갈래 · 명도는 수준** — 교재 `RUNG_INK` 7색 · 단어장 `CATEGORY_HUE` 10색(색상환 36° 균등), 표지 아래 42% 색면. 표는 한 벌(`categoryIdentity()` → `bookCover()`). 옅은 바탕은 유형을 말하지 못한다 — 구별은 글자색(`ink`)이 진다. 회귀 `packages/library-pipeline/src/textbook/cover.test.ts` · `apps/web/src/lib/library/__tests__/book-cover-category.test.ts`.

---

## 기출 탐구 작업공간 — 컴팩트 도크 패턴 (2026-10-13)

- 위치: `/csat/item/[slug]`(3B 스킨 · `theater.module.css` `.workspace` 토큰). 고유 기하는 `--csat-workspace-*` 변수 하나로 · 값의 정본은 [docs/design/refs/3b/workspace/spec.json](./design/refs/3b/workspace/spec.json)(가드 `workspace-geometry.test.ts`).
- 하단 도크: 요소 48px · 도크 65px · 네 요소 동일 폭 한 줄 · 이름 11px + 아이콘 13px(선택 면 23px) 가로 배치. **작은 시각 요소와 44×44 조작 영역을 구분**한다 — 아이콘 단추는 44×44, 보이는 면은 23px.
- 선택 표현은 면색 + 테두리 + aria 상태(색만으로 전달하지 않음). 아이콘 이름은 호버 · 포커스 툴팁(`title` 만으로 키보드 이름을 주지 않는다).
- 판: 프레임 머리 · 판 머리 44px · 판 간격/바깥 여백 10px · 본문 여백 15px · 질문 17px · 판 제목 12px · 한국어 설명 13.5px/1.72.
- 원문 열 최대 폭 = 본문 − 메인 최소 712px(도크 제목이 잘리지 않는 폭). 선호 폭 ≠ 표시 폭.

## 컴포넌트 규약

- **구획 컴포넌트**: 판면 어휘 `components/ui/press`(F4)와 iOS 프리미티브(`@/components/ui/ios` — Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen) 두 벌이 있고, 후자는 토큰 교체로 판면 톤을 받는다.
- **섹션 껍데기는 `Frame`** — 손으로 `border + p-4` 를 만들면 그 구역만 한 단계 작아 보인다.
- **카드 + 보조 액션 = `.arc-slot`** — `<a>` 안에 `<button>` 금지. 형제로 두고 버튼은 우상단 44×44, 카드 상단 `padding-right: 44px`, DOM 순서 = 탭 순서.
- **설명 오버레이**(`components/game/brief/`, 현행은 세션 진입 전) — `role="dialog"` + `aria-modal` · Esc · Tab 트랩 · 포커스 복귀 · ≤620px 바텀시트 · 상태는 색+아이콘+테두리 3중.
- **CSAT 찾기형 팝업(3B Storage 구조)** — `components/csat/browse/ItemFinderDialog.tsx` + `item-finder.module.css`. 공통 `Dialog`(Tines 큰 머리)를 쓰지 않고 같은 `useCloseOnBack` · `useFocusTrap` 을 쓰는 CSAT 전용 껍데기: 중앙 흰 면 · 옅은 막(`#0d0d1729`, 학습 지도 팝업과 같은 값) · 구획선 · 머리 48 / 검색 줄 48 / 바닥 52 · 열 176 / 208 / 220 / 나머지 · 폭 `min(1160px, 100vw - 64px)` · 높이 `min(760px, 100dvh - 64px)` · 글자 13/12/11px · 행과 버튼 44px. 머리 · 바닥은 랜드마크가 아닌 `div`(페이지 banner 와 겹치지 않게 — axe). 여는 버튼 `.trigger` 는 상자가 44px(투명)이고 보이는 32px 면은 안쪽 `.triggerFace` — `::after` 확장은 아래 판에 덮여 실패했다(e2e). 계약 · 실측 [ITEM_FINDER](./csat-learner/ITEM_FINDER.md).
- **아이콘 = lucide-react** 12–20px · `strokeWidth` 2 · `currentColor`. 세션 머리·채점 표식은 현행 `SealMark` · 채움 눈금 1~4칸.
- **삽화 = `components/illustrations/Illustration`** + `generated/<id>.ts`(드레인 import 가 쓴다 — 손으로 고치지 않는다). 인라인 SVG 라 토큰·다크를 그대로 받는다. 현행 자리는 공개 화면 섹션 머리 · 빈 상태. 규칙 [design/03-system.md §3-9](design/03-system.md) · 목록 `docs/design/asset-manifest.json`.
- **폼**: 레이블 필수(placeholder 대체 금지) · 오류는 `--bde` 테두리 + 문구 · disabled 는 `opacity-50` + `cursor-not-allowed`.

## 화면 계측 훅

`tests/e2e/91-hub-design-capture.spec.ts` 는 판정 도구다(카드 높이 균질성 · 제목 줄 수 · 첫 콘텐츠까지 거리).
새 화면: 반복 카드 루트에 `data-design-card`, 메타데이터 제목에 `data-design-title`. 반복 카드가 원래 없으면 `ALL_ROUTES` 에 `nocards: '이유'`.
**수치가 이상하면 화면보다 먼저 그 수치를 만든 코드를 의심한다**(계측이 만든 가짜 결함 5종 — archive).

---

## 접근성 / 안티패턴

### 접근성 필수
- 모든 인터랙티브 ≥ 44×44 · WCAG AA 대비 · `:focus-visible { outline: 2px solid var(--bdf) }`
- 색 + 형태 + 텍스트 3중 표현 · `aria-label` / `role` / `aria-live`
- 클릭되는 것은 `<button>`/`<a>` — `div onClick` 에 `role`·`tabIndex` 를 붙였으면 **`onKeyDown` 도**(Enter/Space 는 div 에서 click 을 만들지 않는다)
- 키보드: Tab / Esc / Enter / Space / 방향키 · 한국어 IME 조합 보호는 입력 컴포넌트 책임

### 안티패턴 (접근성 · 정직성)
- "오답"을 색만으로 표시(→ 색 + 아이콘 + 텍스트)
- 낡은 산출물을 현재 것처럼 내걸기 — 나이를 함께 적는다

(디자인·학습 UX 금지 항목 — 빨간 글씨 압박 · 모달로 학습 중단 · 폭죽·트로피 · 빈 상태 두 칸 · 오류 색 용도 — 은 DD-66 으로 삭제.)

### PR 자가 점검 (머지 전)
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여? (철학 4 · 원칙 7 정본은 [AGENTS.md](../AGENTS.md) · [LEARNING_MODEL](./LEARNING_MODEL.md))
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 진행을 환경으로 보여주는가?
- [ ] 맥락을 보존하는가? (단어는 스크립트/예문과 결합)

(Calm UI · 비난 · 평균 회귀 점검 항목은 DD-66 으로 삭제.)

## 관리자 업무 레일과 작업 패널 (2026-10-19)

PC 관리자 레일은 7개 업무, 작업 패널 상단은 현재 영역의 화면·도구를 표시한다. 기존 3B 관리자 토큰과 44px 포커스 가능한 컨트롤을 쓴다. 기하는 components/admin/AdminShell.module.css의 CSS 변수와 [관리자 참조 명세](./design/refs/3b/admin/spec.json)에 둔다. 상단 56px·레일 216px·1440×900 패널 채움 (228,58,1200,min-height 830). `pnpm design:ref-compare --admin --base <URL>`는 외곽·색 토큰만 대조하며 표·상세·팝업 기능 검증을 대신하지 않는다. 모바일 전용 디자인은 추가하지 않았다.
