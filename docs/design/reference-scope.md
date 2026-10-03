# 참조 사이트·앱 전반의 범위와 적용표

> 2026-10-03 · 사용자 범위 보완. 디자인 정본은 [DESIGN.md](../../DESIGN.md).
> 두 URL은 진입점이며 하위 대부분의 화면·기능·프로세스·팝업·탭·이미지·아이콘 등 모든 디자인 요소를 참조한다.
> 이 표의 「대응」은 구현할 때 고르는 위치다. 개별 화면/프로세스의 적용 완료를 뜻하지 않는다.

## 확보 자료를 직접 확인한 범위

2026-10-03에 아래 JSON을 읽어 항목 수와 경로를 확인했다. 기존 자료를 최신 화면 캡처로 표시하지 않는다.

| 자료 | 저장된 범위 | 확인 수준 |
|---|---|---|
| Tines [corpus.json](refs/tines/corpus.json) | 151페이지·80템플릿. 이미지/패턴/도해 역할 6종(hero·band·card·spot·inline·logo) | 기존 수집의 통계. 사이트 전체 URL 수나 모든 상태의 확보율은 아니다 |
| Tines [sections.json](refs/tines/sections.json) | 33 대표 페이지(목록과 상세 포함)·오버레이 6항목 | 2026-09-21 DOM 구획·레이아웃·컨트롤·모션 자료 |
| Tines [components.json](refs/tines/components.json) | CSS 이름 313개·실제 DOM 등장 156개 | 2026-09-21. CSS에 이름만 있는 부품은 렌더 확보로 보지 않는다 |
| Tines [ui-kit.json](refs/tines/ui-kit.json) | 대표 80페이지의 버튼·호버·탭·필터·칩·입력·카드·레이어·그림자 | 부품의 계산 스타일 서명. 전체 사용자 흐름 검증은 아니다 |
| Tines [interactions.json](refs/tines/interactions.json) | 시나리오 11항목, 열린 층 발견 10항목, 이벤트 필터 1항목은 미발견 | 2026-09-21. FAQ 항목은 포착 부품이 SiteNav26이므로 답변 펼침의 기하 증거로 쓰지 않는다 |
| 3B `shots/reference-app/extract-screens.json` | Recents·Monitoring·Connectors·Skills·Links·Chats·Create space 팝업·워크플로 상세, 8상태 | 기존 인증 앱의 캡처/계산 스타일. 흐름의 모든 단계가 확보된 것은 아니다 |
| 3B [Access map 명세](refs/3b/access-map/spec.json)·[팝업 조사](refs/3b/access-map/popup-patterns.md) | 지도·Skill 모달의 파일/기하, 설정·접근·멤버십·역할 팝업의 사용자 제공 캡처 조사 | 기하 측정과 부품 추정은 조사 문서에서 구별한다. 조사된 모든 팝업의 원본 파일이 확보됐다는 뜻은 아니다 |

현재 Tines의 [가격](https://www.tines.com/pricing/)·[라이브러리](https://www.tines.com/library/)·[제품](https://www.tines.com/3b/) 하위 페이지가 공개로 열리는 것은 2026-10-03 다시 확인했다.
이번 보완에서 이 페이지들의 모든 열린 상태를 새로 캡처한 것은 아니다.
3B의 현재 인증 앱은 새로 확보하지 못했다. 기존 인증 자료를 사용하며 정상 인증 화면을 확보하는 절차는 [CAPTURE](refs/3b/CAPTURE.md)다.
현재/과거 확보와 구현 검증의 상세 기록은 [reference-contract](reference-contract.md)에 있다.

## 하위 화면·기능·프로세스 대응

| 기준 | 참조 화면/경로 | 가져올 화면·부품·흐름 | Vocaflow 대응 위치 |
|---|---|---|---|
| 3B | `/recents`, 공간 화면 | 레일·상단·패턴 띠·명령 상자·탭·최근 목록 → 공간/작업 열기 | `/csat`·CSAT 셸·`components/csat/space` |
| 3B | `/monitoring/workflows` | 대시보드·요약·표·필터·상태 → 항목 상세 | `/csat/diagnosis`의 개요·유형·오답·기록 |
| 3B | `/connectors/library`, `/skills/list`, `/links` | 라이브러리/목록·검색·행/카드·아이콘 타일·선택 → 상세 | CSAT 문항/공식/유형 목록과 상세 |
| 3B | `/chats`, `/spaces/…/workflows/…` | 작업면·곁단·입력/실행·상태 피드백·타임라인 | CSAT 워크스페이스·문항 해설 작업면 |
| 3B | `/recents?modal=createSpace` | 생성 팝업·입력·취소/확인 | CSAT 생성/기록 팝업. 제출 이후 상태는 추가 참조 필요 |
| 3B | Access map·Skill/Space/Group/Member/역할 팝업 | 노드/연결선·선택·접기 → 상세 팝업 → 탭·검색·목록·닫기/지도 복귀 | `/csat/diagnosis?tab=map`·`PopupParts`·지도 팝업 |
| Tines | `/3b/`, `/solutions/it/`, `/solutions/security/`, `/public-sector/`, `/enterprise/` | 기능 소개·2열·제품 액자·도해·벤토·CTA·영상/FAQ | 공개 소개·교사·기능 설명. `/csat`에는 3B 앱 기준 적용 |
| Tines | `/customers/`, `/case-studies/r3/`, `/blog/` 및 글 상세 | 목록 → 필터/카드 → 상세·본문·관련 항목 | 도서/콘텐츠/영상의 목록·상세·읽기 |
| Tines | `/library/`, `/library/tools/thinkst-canary/` | 분류 내비·검색·컬렉션·도구 목록 → 상세 → 사용 진입 | 서가·단어장·학습 허브·선택 화면 |
| Tines | `/pricing/`, `/workflow-capability-matrix/` | 비교 카드/표·상태 선택·설명 펼침 → 행동 | 요금제·적합성·비교/선택 부품 |
| Tines | `/university/`, `/events/`, `/webinars/` 및 상세 | 과정/행사 목록·필터·상세 → 시작/등록 | 학습 경로·콘텐츠 탐색·시작 안내 |
| Tines | `/contact/`, 법률·404 | 폼·첨부·동의·검증 메시지·긴 글·회복 행동 | 계정/설정/지원/관리자 폼·정책·오류 화면 |
| Tines | 모든 페이지의 공통 셸 | 메가메뉴 → 하위 이동, 검색 입력 → 결과 → 이동, 모바일 서랍 → 하위 메뉴 | `marketing/site`·`AppHeader`·검색·내비 |

관리자·학습·게임 화면도 Tines의 관련 목록·입력·카드·작업 패널·피드백 재료로 대응시킨다.
마케팅 페이지와 제품 기능이 다르므로 필요한 부품과 진행 구조를 선택한다.
상세 화면 대응은 [tines-mapping](tines-mapping.md), CSAT 지도/팝업은 [popup-patterns](refs/3b/access-map/popup-patterns.md)를 함께 본다.

## 이미지·아이콘·상태의 대응

| 요소 | 참조 근거 | 제품 적용 |
|---|---|---|
| 이미지/삽화 | corpus의 역할·표시 크기·배치·색면, sections/components의 매체 부품 | `public/illustrations/tines` 및 제품 자산에서 대응 장면을 선택. 구도·크기·역할까지 기록 |
| 패턴·액자·도해 | Tines의 격자/꽃/액자·3B 공간 띠/노드/연결선 | 기존 `marketing/sections`·CSAT 부품 사용. 화면 전체에 임의로 같은 배경을 깔지 않음 |
| 기능 아이콘 | 3B 추출의 `icons`·Tines SVG/부품·팝업 아이콘 타일 | 기존 lucide/자체 SVG로 역할·크기·선 굵기·색·배경 타일 대응. 상태는 글자/형태도 함께 표시 |
| 부품 상태 | ui-kit의 호버/선택 서명·components의 상태 선택자·interactions의 열린 층 | `components/ui`와 스킨을 재사용. 변경하는 부품의 열린/선택/실패 상태도 구현·확인 |
| 모션·반응형 | sections의 animations·components의 breakpoints·390 메뉴 자료 | 공통 모션 토큰·모션 감소 설정 사용. 같은 기능을 데스크톱/모바일에서 완주 |

## 다음 구현에서 남길 기록과 자료 보강

기능을 추가하거나 바꾸는 작업은 별도 디자인 지시 없이 다음 내용을 구현 기록/PR에 남긴다.

1. 제품 라우트·핵심 행동, 대응하는 **하위 참조 URL/화면**·자료 경로·확보 날짜.
2. 화면 틀·컨트롤·팝업·탭·이미지·아이콘의 대응 부품/자산과 측정값. 없는 요소는 해당 없음과 이유.
3. 진입 → 선택/입력 → 실행 → 결과, 뒤로/취소·빈 상태·로딩·검증 오류/실패·재시도의 상태별 근거.
   참조에서 관찰한 상태와 제품에서 추가한 상태를 구별한다. 정상 화면 한 장은 전체 프로세스 증거가 아니다.
4. 1440/390·테마·키보드에서 실제 기능 완주, 팝업/탭 전환과 이미지/아이콘 렌더, 전후 캡처·측정 비교·남은 차이.

자료가 부족하면 기존 JSON/원본/캡처를 먼저 찾고 하위 링크·탭·메뉴를 따라 보강한다.
공개 Tines 수집은 `tines-corpus.mjs --list`로 대상을 찾고 `extract-sections.mjs --only <key>`로 해당 구획을 갱신할 수 있다.
부품은 `extract-components.mjs`·`extract-ui-kit.mjs`, 열린 상태는 `extract-interactions.mjs`를 재사용한다.
이벤트 필터 미발견, FAQ 기하 오포착, 제출 이후/실패 상태, 3B의 미확보 인증 하위 화면은 별도로 확보·측정한다.
원본 HTML/CSS/JS·매체·스크린샷은 로컬 분석 자료로 보관하고 공개 지침에는 출처·측정·자체 구현을 남긴다.
쿠키·인증·계정 데이터는 출력/커밋하지 않는다. 참조 서비스에 제출·생성·삭제하며 제품 기능을 검증하지 않는다.
참조 범위와 확보 범위, 적용 범위와 검증 범위를 각각 표시한다.
