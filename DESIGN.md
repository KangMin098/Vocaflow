# Vocaflow 디자인 적용 기준

> **확정: 2026-10-03 · 사용자 지정 기본 디자인.** 디자인을 별도로 요청하지 않은 기능 추가·수정에도 적용한다.
> 스타일과 화면 틀의 정본이다. 과거 주묵 판면·동결·DD-82 관리자 예외와 충돌하면 이 기준을 따른다.
> **디자인 작업 범위는 PC 웹만이다. 모바일 웹(390px 등)과 `apps/mobile`은 제외한다**(2026-10-03 사용자 재확인). 별도 요청 없이 모바일 전용 디자인·메뉴·화면·검증을 작업에 추가하지 않는다. 이 범위는 옛 모바일 퍼스트·390px 포함 문구보다 우선한다.

| 라우트 | 기준 | 자동 적용 |
|---|---|---|
| `/csat`, `/csat/` 및 `/csat/*` | [neon-currant.3b.dev](https://neon-currant.3b.dev/)의 **3B 앱** | 두 CSAT 레이아웃의 `data-design-scope="csat"` → `skins/csat-app.css` |
| 그 외 모든 화면 | [www.tines.com](https://www.tines.com/)의 **웹사이트** | 루트 `data-skin="tines"` → `skins/tines.css` |

`/admin/csat/*`는 `/csat/*`가 아니므로 **Tines**다. 인증·설정·관리자·학습·게임 화면도 기본 Tines다.
본문·모달·시트·팝오버·토스트는 현재 라우트의 토큰을 함께 쓴다. CSAT 표식은 서버 HTML에 있으며
`:root:has(...)`로 루트 토큰을 선택하므로 body 포털도 같은 스타일이고, 경로 이동 시 자동 복귀한다.
`?skin=off`, `vocaflow-skin` 저장값, `NEXT_PUBLIC_SKIN`으로 이 기준을 해제하지 않는다.
라이트/다크·모션 감소 설정은 유지한다. 다크는 각 스킨의 대응 디자인이다.

## 참조 범위 — 사이트·앱 전반

**두 URL은 참조의 진입점이다. 메인 화면과 색·서체에 한정하지 않고, 하위 대부분의 화면·기능·프로세스와 모든 디자인 요소를 기준으로 삼는다.**
디자인 요청이 없는 작업에도 이 범위를 적용한다. 새 화면을 홈의 변형으로만 만들지 않고 기능에 대응하는 하위 화면과 동작을 찾는다.

| 참조 층 | 포함하는 요소 | 적용 방식 |
|---|---|---|
| 화면 | 목록·상세·작업면·설정·검색·필터·대시보드·생성/편집·빈 상태 | 참조의 해당 유형에서 정보 배치·밀도·폭·간격·스크롤을 가져온다 |
| 기능·프로세스 | 진입 → 선택/입력 → 확인/실행 → 결과, 뒤로·취소·오류·재시도 | 여러 화면에 걸친 진행 방식과 피드백을 제품의 실제 기능에 대응시킨다 |
| 팝업·탭 | 모달·시트·팝오버·툴팁·메뉴·서랍·탭·아코디언·토스트 | 닫힌/열린/선택 상태, 배경막·포커스·닫기·내부 스크롤·전환을 함께 적용한다 |
| 입력·표시 부품 | 버튼·링크·폼·선택기·체크박스·표·카드·칩·배지·차트·노드·연결선 | 크기·위계·배치와 호버·포커스·활성·비활성·검증 상태를 대응시킨다 |
| 이미지·아이콘 | 삽화·썸네일·패턴·도해·제품 액자·장식·기능 아이콘 | 구도·역할·선 굵기·크기·색 조합·상태별 표현을 맞추고 자체/허용 자산을 쓴다 |
| 표현·환경 | 서체·색·테두리·모서리·그림자·반응형·모션·테마 | 하위 화면에서도 같은 계열을 유지하며 제품의 한국어·접근성·테마에 대응한다 |

3B는 인증 앱의 Recents·Monitoring·Connectors·Skills·Links·Chats·워크플로 작업면·Access map·설정/접근 팝업까지 참조한다.
Tines는 제품·솔루션·목록·상세·라이브러리·가격·교육·이벤트·문의·법률 화면과 공통 검색·메뉴·탭·폼·미디어 동작까지 참조한다.
원래 서비스의 사업 기능은 Vocaflow의 학습·운영 기능으로 대응시킨다. 하위 디자인 적용은 필요 없는 기능을 새로 만드는 근거가 아니다.
확보 범위와 부족한 상태는 [참조 범위·적용표](docs/design/reference-scope.md)에 기록한다. **자료가 부족해도 참조 범위가 홈으로 축소되지는 않는다.**

## 두 디자인의 기본과 틀

| 요소 | CSAT — 3B 앱 | 나머지 — Tines 웹사이트 |
|---|---|---|
| 지면·텍스트 | 흰 패널 `--bg`, 웜 중립 캔버스 `--bg2`, 먹색 `--t1`, 회색 보조 글자 | 크림 지면 `--bg`, 웜 중립 구획, 보라 제목·본문, 다색 틴트·진한 구획 |
| 서체 | Inter + 한글 Pretendard, 수치 JetBrains Mono. UI 제목도 산세리프 | Figtree + 한글 Pretendard(UI), Petrona + Hahmlet(편집 제목), Space Mono(라벨). 참조 상용 서체의 무료 대체 |
| 화면 골격 | 좌측 레일 → 상단 줄 → 작업 패널 → 탭·목록 → 상세/팝업. SpaceScreen·워크스페이스·지도 활용 | 공개/학습 셸의 상단 내비·메가메뉴 → 페이지 머리 → 목적에 맞는 구획/목록/작업면. 관리자의 운영 내비는 유지하며 Tines 재료 사용 |
| 모서리·선 | 얇은 중립선·작은 컨트롤·분리된 패널, 지도/모달 기하는 측정 명세 | 알약 CTA·내비, 얇은 라벤더선, 둥근 액자·카드. 값은 Tines 스킨/기존 부품 |
| 그림 | 3B 패턴 띠·노드·관계도에 대응하는 제품 자체 자산 | `public/illustrations/tines/`의 자체 삽화, 틴트면·패턴·액자 조합 |
| 팝업 | 먹색 16% 배경막, 블러 0, 산세리프 제목. Dialog + PopupParts | 공통 Dialog/SearchDialog/시트·Tines 토큰. 메뉴는 기존 메가메뉴/모바일 서랍 |
| 동작 | 선택 → 상세 → 실행/기록. 화면·상태·취소 동작을 실제 기능으로 연결 | 호버/포커스·메뉴 열기·탭·검색·폼·확인 단계는 확보한 대응 패턴 재사용 |

**색만 바꾸면 적용 완료가 아니다.** 화면 골격, 타이포 위계, 폭·간격, 버튼·입력·팝업,
삽화 역할, 핵심 동작을 대응시킨다. 페이지 유형이 다르면 참조의 해당 부품/템플릿을 고른다.
예를 들어 관리 표와 학습 세션에 마케팅 히어로·푸터를 끼워 넣지 않는다.
학습 기록·문항·FSRS·기억 4색·정보 이름·접근성은 제품 정본을 따른다.

## 별도 디자인 요청이 없어도 수행할 절차

1. 라우트로 디자인을 결정한다. 현재 정상 화면을 캡처하고 핵심 행동을 확인한다.
2. 아래 자산에서 **대응하는 하위 참조 화면·부품·프로세스**를 지정한다. CSS/DOM 측정값과 캡처를 함께 본다.
   변경 기능에 포함된 팝업·탭·이미지·아이콘까지 대응시킨다. 대응 자료가 부족하면 하위 링크/탭/메뉴를 따라 확보하고 미확보 상태를 남긴다.
3. 기존 셸·공통 부품·스킨을 사용한다. 페이지 `.root`에 브랜드 색·글꼴을 다시 선언하지 않는다.
   지도처럼 고유한 기하는 명세와 CSS 변수에 둔다. 신규 CSAT 라우트는 두 CSAT 세그먼트 중 하나에 둔다.
4. 진입 → 선택/입력 → 실행 → 결과의 흐름과 메뉴 열림·팝업·탭 전환·빈 상태·실패·취소를 실제 기능으로 연결한다.
5. 1440/390, 라이트/다크에서 정상 렌더·키보드·터치·넘침·팝업·경로 이동을 확인한다.
   변경 부품은 같은 뷰포트의 참조와 대조한다. 크기·간격은 측정값으로 설명한다.
6. 참조 URL/화면·확보 날짜·대응 부품/자산·흐름별 상태·전후 캡처·비교표·검사 결과·남은 차이를 기록한다.
   변경 기능의 하위 화면·팝업·탭·이미지·아이콘을 확인한다. 로그인/오류/로딩 캡처는 정상 화면 증거가 아니다.
   색 테스트·문서 수정만으로 모든 화면의 참조 일치를 선언하지 않는다.

사용자가 이미 두 기준을 선택했다. 일반적인 구현마다 새 디자인 4안이나 재승인을 요구하지 않는다.
새로운 방향이 필요하면 최신 사용자 지시가 이 문서를 변경하는 근거가 된다.

## 확보 자산과 적용 위치

| 필요한 것 | 기존 정본/부품 |
|---|---|
| 참조 확보 상태·이번 검증 | [reference-contract](docs/design/reference-contract.md) |
| 하위 화면·프로세스·전체 요소의 범위/대응 | [reference-scope](docs/design/reference-scope.md) |
| Tines DOM·CSS·서체·색 | [computed](docs/design/refs/tines/computed-summary.md), [css-authored](docs/design/refs/tines/css-authored-summary.md), [font-lookalike](docs/design/refs/tines/font-lookalike.md) |
| Tines 페이지·이미지·템플릿 대응 | [tines-mapping](docs/design/tines-mapping.md), [sections](docs/design/refs/tines/sections-summary.md), [corpus](docs/design/refs/tines/corpus-summary.md) |
| Tines 버튼·폼·팝업·프로세스 | [ui-kit](docs/design/refs/tines/ui-kit-summary.md), [components](docs/design/refs/tines/components-summary.md), [interactions](docs/design/refs/tines/interactions-summary.md) |
| 3B 앱 색·서체 | [reference-analysis](docs/design/reference-analysis.md), `packages/design-tokens/src/skins/csat-app.css` |
| 3B 지도·팝업 크기 | [spec.json](docs/design/refs/3b/access-map/spec.json), [측정 절차](docs/design/refs/3b/access-map/README.md), [popup-patterns](docs/design/refs/3b/access-map/popup-patterns.md) |
| 3B 실제 DOM 보강 | [CAPTURE](docs/design/refs/3b/CAPTURE.md), `scripts/design/workspace-skeleton.mjs` |
| 구현 | `components/marketing/site`, `components/marketing/sections`, `components/layout/AppHeader`, `components/ui`, `components/csat/space`, `components/csat/diagnosis/map/PopupParts` |
| 검증 | [06-workflow](docs/design/06-workflow.md), `reference-design.test.ts`, `92-reference-design.spec.ts`, `pnpm design:ref-compare` |
| 학습·운영 기능 | [LEARNING_MODEL](docs/LEARNING_MODEL.md), [MODULES](docs/MODULES.md), [ADMIN_CONSOLE](docs/ADMIN_CONSOLE.md) |

외부 원본 HTML/CSS/JS·이미지·캡처는 로컬 분석용으로 보관한다. 제품은 자체 구현·자체 삽화·허용된 서체를 사용한다.
쿠키·로그인 상태·사용자 데이터는 출력하거나 커밋하지 않는다. 접근 가능한 공개 자산부터 확보하며,
인증된 화면을 확보하지 못한 범위는 명시하고 기존 측정 자료로 진행한다.
