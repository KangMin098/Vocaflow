# 두 참조의 확보·적용·검증 기록

> 2026-10-03 · 사용자 지정 디자인의 정본은 [DESIGN.md](../../DESIGN.md).
> 대상은 디자인 기반·공통 틀·지속 적용 지침이다. 아래 검증은 전체 개별 화면을 재설계했다는 뜻이 아니다.

## 반복해서 어긋났던 경로와 이번 조치

| 확인된 원인 | 조치 |
|---|---|
| DESIGN/디자인 시스템이 옛 주묵 판면을 동결·수정 금지로 안내 | DESIGN을 두 참조의 라우트별 적용 정본으로 교체. AGENTS·웹 가이드·토큰 가이드·디자인 시스템·작업 절차·매핑의 우선순위 정리 |
| `skin=off` URL/저장값·환경변수가 기본 스킨 해제 | 루트 Tines 고정. 취향으로 디자인을 해제하는 코드를 제거. 테마·모션 감소는 유지 |
| 관리자는 3B 예외, CSAT 일부만 국소 3B 값 | 새 사용자 범위대로 관리자도 Tines. 두 CSAT 그룹의 서버 레이아웃 표식으로 CSAT 전체에 3B 적용 |
| SpaceScreen 국소 토큰과 body Dialog가 다른 스킨 | 국소 브랜드·서체 선언 제거. `:root:has([data-design-scope="csat"])`가 포털도 같은 토큰으로 칠함 |
| Tines 전역 컨트롤 보정이 CSAT에도 적용 | 해당 전역 규칙에서 CSAT 표식을 제외 |
| 실제 캡처에서 다크 CSAT 버튼이 흰 면·흰 글자 | 행동 배경/전경을 `--p`/`--on-p`로 짝지음. 추가 버튼 44px, 정적·브라우저 회귀 |
| 모바일 상태 카드가 absolute SVG 패턴 아래에 그려짐 | 카드의 relative 배치 유지·띠 높이를 내용에 맞춤. 모바일 렌더 회귀 |
| 지도·지도 팝업이 밝은 면을 고정 | 기하 명세 유지, 공통 면·글자·선·배경막 토큰 상속 |
| 추가 코드 리뷰에서 시험 기록 모달의 밝은 색 고정과 지도 상태/오류 잉크의 다크 대비 부족 확인 | 모달 전경/배경과 상태 잉크/틴트면을 같은 테마 토큰에 연결. 네이티브 날짜/선택 컨트롤도 CSAT 테마 사용. 실제 렌더 대비 4.5 이상 회귀 |

## 확보 자산 — 현재 확보와 과거 자료를 구별한다

| 자산 | 확보 상태 / 위치 | 적용 |
|---|---|---|
| Tines 현재 홈 화면 | **이번에 재확인**. `show-screen.mjs` → `docs/design/shots/replica/screen-www.tines.com-1440-01.png` | 크림·보라 타이포·알약 내비/CTA·패턴·제품 액자 확인 |
| Tines 현재 계산 스타일 | **이번에 재확보**, 1440/375. `tmp/design-reference-20261003/tines/computed.json` 및 요약. 각 뷰포트 root 변수 537개. 1440 h1=64px/400/line-height 67.2px | 새 작업에서 기존 측정이 낡았는지 비교. 기존 스킨 값은 이번 범위에서 변경하지 않음 |
| Tines HTML/CSS/JS·이미지 원본 | **기존 로컬 미러 확인**: `tmp/tines-capture/`의 server/rendered HTML·assets·메뉴 캡처, `tmp/tines-corpus/`의 페이지 자료 | 원본은 분석용. 구현은 자체 부품·자체 삽화·무료 대체 서체 |
| Tines 페이지/부품/폼·팝업·동작 자료 | **기존 저장소 자산**: `refs/tines/{sections,components,ui-kit,interactions,corpus,css-authored,computed}.json` 및 요약 | 메가메뉴·검색·서랍·탭·FAQ·영상·폼의 대응 패턴. 상세 적용표 `tines-mapping.md` |
| 자체 삽화·모션·셸 | **기존 구현**: `public/illustrations/tines`, marketing/site·sections, AppHeader, ui, 모션 토큰 | 새 화면은 이 부품을 조합. 색 변경만으로 참조의 골격을 대체하지 않음 |
| 3B 앱 스크린/DOM 계산값 | **기존 로컬 실물 확보 확인**: `docs/design/shots/reference-app/`의 Recents·Monitoring·Connectors·Skills·Links·Chats·워크플로 상세·Create space 캡처 및 extract JSON | 앱 스타일 근거는 `reference-analysis.md`(당시 관리자 적용 연구). 이번에는 CSAT 공통 스킨으로 적용 범위를 변경 |
| 3B Access map·Skill 팝업 | **기존 PNG 및 측정 명세 확인**: `refs/3b/access-map/{access-map-page.png,skill-modal.png,spec.json}` | 지도/모달 기하 + PopupParts. 부품별 추정 여부는 popup-patterns에 명시 |
| 3B 현재 인증 앱 | **이번 세션에서 새로 확보하지 못함**. 웹 읽기 접근 실패, 자동 캡처는 로그인 이동으로 중단. CUA 브라우저 연결도 없음 | 로그인 화면을 앱 증거로 쓰지 않음. 기존 확보 자료로 진행. 보강 경로는 아래 |

원본·캡처·쿠키는 gitignore 로컬 영역이다. 공유되는 것은 수치·출처·자체 구현·검증 절차다.
3B 앱에 새 기능/팝업이 생겨 기존 자료가 부족하면 [CAPTURE](refs/3b/CAPTURE.md)의 저장 페이지 또는
정상 인증된 브라우저 자료를 사용해 `workspace-skeleton.mjs`로 측정한다. 공개 번들만으로 인증된 화면의
상태·사용자 프로세스를 모두 확보했다고 주장하지 않는다. 자료가 없는 항목은 측정/추정을 구분한다.

## 재실행 가능한 검증

```powershell
pnpm.cmd --filter web exec vitest run src/lib/design/__tests__/reference-design.test.ts src/lib/design/__tests__/skin-parity.test.ts src/components/csat/diagnosis/map/__tests__/geometry.test.ts src/components/admin/__tests__/admin-color-tokens.test.ts
pnpm.cmd --filter web exec playwright test tests/e2e/92-reference-design.spec.ts --workers=1
pnpm.cmd design:ref-compare
node agents/scripts/check.mjs
```

브라우저 검증은 기존 런타임 계정으로 로그인한다. 새 인증 상태는 `playwright-auth/.auth-reference-design.json`에
보관한다(출력·커밋 안 함). 1440/390 × 라이트/다크에서 `/pricing`, `/fit`, `/hub`, `/admin/csat`, `/csat`,
`/csat/diagnosis?tab=map`, `/csat/formulas`와 익명 `/`를 확인한다. 서버 응답·정상 경로·실제 팔레트·넘침,
옛 저장값/skin URL, CSAT Workspace body 포털·Escape·CSAT→Today 클라이언트 이동을 검사한다.
시험 기록의 입력·회차 선택·활성 행동 버튼의 대비(4.5 이상)·44px 터치 영역과
지도 상태 잉크/면의 실제 대비(4.5 이상)도 검사한다.
시험 기록은 저장하지 않는다. 익명 테마별 검증은 별도 브라우저 컨텍스트로 초기화 순서를 분리한다.
캡처는 기록 로딩과 글꼴 준비가 끝난 뒤 `docs/design/shots/reference-contract/`에 남긴다.

## 지도/팝업 실측 대조

`pnpm design:ref-compare`, 2094×950, DPR 1, 허용 ±2px. 2026-10-03 실행 결과:

| 항목 | 참조(px) | 구현(px) | 차이 |
|---|---:|---:|---:|
| 노드 폭 | 206 | 206 | 0 |
| 노드 높이 | 46 | 46 | 0 |
| 열 피치 | 272 | 272 | 0 |
| 행 피치 | 60 | 60 | 0 |
| 머리 줄 높이 | 49 | 49 | 0 |
| 머리 줄 → 첫 노드 | 25 | 25 | 0 |
| 모달 폭 | 680 | 680 | 0 |
| 모달 높이 | 760 | 760 | 0 |
| 모달 머리 | 56 | 56 | 0 |
| 모달 바닥 | 56 | 56 | 0 |
| 카드 폭 | 646 | 646 | 0 |
| 카드 간격 | 18 | 18 | 0 |
| 머리 → 첫 카드 | 18 | 18 | 0 |

이 표는 **지도/팝업의 해당 기하 13항목**을 검증한다. 다른 CSAT 화면·글꼴 픽셀·소품 크기·전체 프로세스가
참조와 완전히 같다는 근거가 아니다. 한국어·제품 기능·접근성 차이는 제품에 맞게 유지한다.

## 이후 기능 요청에서의 수용 기준

최종 실행: 회귀 **16/16**, 브라우저 시나리오 **5/5**, 지도/팝업 실측 **13/13**, 타입 검사 통과,
전체 web lint 오류 0(기존 경고 11), 에이전트 설정 검사 **11/11**, DESIGN 계획 리뷰 `NO_FINDINGS`.
프로덕션 빌드는 별도 `.next-reference-design-verify`에서 **263 정적 페이지 생성까지 통과**했다.
첫 빌드는 PDF worker 압축 중 메모리가 부족해 실패했고, 재실행에서 `CIRCLE_NODE_TOTAL=2`로
Next 14.2의 압축/빌드 작업 수를 1로 제한해 통과했다. 저장소 빌드 설정은 변경하지 않았다.
빌드가 자동으로 추가한 tsconfig의 임시 distDir 항목은 제거한다.

- 디자인 변경을 따로 요청하지 않아도 DESIGN의 라우트 기준을 선택한다.
- 새 화면/부품은 대응 참조·확보 날짜·측정값/추정값·기존 구현을 지정한 후 적용한다.
- 색·서체·골격·폭/간격·팝업·동작을 함께 검증한다. 테스트가 통과해도 캡처를 실제로 연다.
- 전체 화면 일치, 특정 기하 일치, 자동 스킨 적용을 구별해 보고한다. 미확보·미검증을 완료로 표시하지 않는다.
