# 디자인 작업과 Visual QA

기준 입구는 [DESIGN.md](../../DESIGN.md). 제품·학습·스타일 정본은 그 문서의 링크를 따른다.
새로운 `learning-method.md`를 만들어 [LEARNING_MODEL](../LEARNING_MODEL.md)을 중복 관리하지 않는다.

## 작업의 크기에 맞는 절차

1. **조사**: 요청 범위·사용자 행동·실제 라우트·기존 컴포넌트를 확인하고 변경 전 화면을 캡처한다.
2. **방향**: 모든 화면은 코드 전에 vocaflow-design §G2 세 줄(골격 · 서명 · N4)을 적는다.
   **큰 재설계(새 화면·전면 재설계)만 발산 4안** — 서명 요소가 서로 다른 사물(§G1 축이 서로 다른 넷)이어야 하고,
   최고 성능 모델·고노력으로 만든다(싼 모델은 이름만 넷인 한 안을 돌려준다). 산출물 `compare.md`(4안 표 + 익명성 자기검토).
   고르는 것은 사람이다. 선택 이유와 버릴 요소를 기록하고, 고른 안은 2회 수정 후 [골든](golden/README.md)으로 고정한다.
3. **구현**: 기존 토큰·컴포넌트·기능을 활용한다. 외부 라이브러리 추가는 기존 도구로 해결되지 않는 요구가 있을 때 검토한다.
4. **검증**: 실제 브라우저에서 캡처하고 핵심 동작을 실행한다. 아래 명령은 자동 검사의 출발점이다.
5. **비평·수정**: 이미지를 직접 연다. 순서대로 판정한다.
   (a) **익명성**: 로고·제품명을 가린 채 이 화면만으로 앱 종류와 이 제품인지 말할 수 있는가. 못 하면 재작업.
   (b) **평균 회귀**: 카드+그림자 묶음 · 3열 균등 격자 · 중앙 정렬 제목 · 의미 없는 선/아이콘 · 서명 요소 부재 ·
       같은 색이 두 의미 · 본문보다 큰 제목 — 보이는 것을 위치와 함께 적는다.
   (c) **골든 대조**: [docs/design/golden/](golden/README.md) 과 나란히. 차이 중 "의도된 새 결정 1개"가 아닌 것만. 골든이 비어 있으면 "기준 없음".
   (d) **포트폴리오**: [own-portfolio.md](own-portfolio.md) 와 팔레트·서체·서명이 겹치는가. 표가 비어 있으면 "기준 없음".
   (e) 규칙 위반(Part 2)과 접근성.
   출력: 차이 ≤5 · 가장 나쁜 것 1개 · 통과/재작업. 가장 나쁜 것 하나만 고치고 재검증. 루프는 2회까지, 그 뒤는 사람 판단.
   개수를 채우기 위한 결함을 지어내지 않는다 — 없으면 없는 만큼만 적는다.
6. **기록**: 전후 증거 경로, 라우트·상태·테마·뷰포트·실행 버전, (a)–(e) 판정, 수정 이유, 미검증 범위를 남긴다.
   캡처 산출물에는 골든 대조 쌍(같은 뷰포트의 골든 경로 + 이번 캡처 경로)을 함께 적는다.

Codex 진입 스킬은 `.agents/skills/vocaflow-design-loop/SKILL.md`, 비평은
`.agents/skills/vocaflow-visual-critic/SKILL.md`다. 기존 `.claude/skills/vocaflow-design/SKILL.md`가
학습 원칙과 미감의 정본이다. 스킬 위치는 [공식 Codex 문서](https://learn.chatgpt.com/docs/build-skills)의
저장소 탐색 경로를 따른다. 현재 세션에 새 스킬이 표시되지 않으면 해당 파일을 직접 읽거나 세션을 다시 시작한다.

## 실행: 캡처와 자동 검사

이미 실행 중인 개발 서버를 재사용한다. 아래는 저장소 루트에서 실행하는 PowerShell 예시다.
`PLAYWRIGHT_BASE_URL`을 지정하면 서버를 새로 띄우지 않는다. 서버가 없다면 `pnpm --filter web dev`를 실행한다.
Windows 실행 정책이 `pnpm.ps1`을 차단하면 아래 명령의 `pnpm`을 `pnpm.cmd`로 바꾼다.

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
pnpm --filter web test:design
```

기본 대상은 로그인 없는 `/fit`. 375×812, 390×844, 768×1024, 1280×900, 1440×900의
밝은/어두운 테마를 검사한다. 첫 화면(`fold.png`)과 전체 화면(`full.png`)을 모두 남긴다.
`/fit`에서는 예시 결과가 있는지 확인하고 지우기 버튼을 키보드로 실행해 입력·disabled 상태 변화를 검증한다.

```powershell
# 수정 중인 화면 조건만 빠르게 확인
pnpm --filter web test:design screens --project=390-light

# 로그인·헤딩·넘침 가드 자체의 회귀 (실제 앱·DB 내용과 독립)
pnpm --filter web test:design checks --project=390-light

# 기존 검증 세션을 재사용 — 인증 파일 내용을 출력하거나 커밋하지 않는다
$env:DESIGN_STORAGE_STATE = 'playwright-auth/.auth-csat-learner.json'
$env:DESIGN_ROUTES = '/csat,/csat/formulas'
pnpm --filter web test:design screens
Remove-Item Env:DESIGN_ROUTES, Env:DESIGN_STORAGE_STATE
```

등록하지 않은 경로·잘못된 모드는 즉시 실패한다. CSAT 인증 파일은 기존 인증 도구로 준비한다.
만료·리다이렉트를 정상 화면으로 캡처하지 않는다. CSAT의 `/dissect` PDF·문장 선택·TTS 동작은
`tests/e2e/47-csat-session.spec.ts`의 기존 시나리오를 이용한다. 홈페이지 캡처만으로 이 흐름까지 검증했다고 보고하지 않는다.

## 픽셀 비교 기준선

캡처 모드는 기준선을 만들거나 바꾸지 않는다. 먼저 실제 이미지를 열어 화면·상태가 올바른지 확인한다.
검토한 상태를 기준선으로 정할 때만 다음 명령을 실행한다.

```powershell
$env:DESIGN_MODE = 'compare'
pnpm --filter web test:design screens --update-snapshots
# 같은 OS·브라우저·폰트·데이터·상태에서 변경 검출
pnpm --filter web test:design screens
Remove-Item Env:DESIGN_MODE
```

비교 모드에서 기준선이 없으면 실패한다(`updateSnapshots: none`). 실패를 없애려고 자동 갱신하지 않는다.
OS와 프로젝트(뷰포트·테마)별 기준선을 분리한다. 앱 데이터가 바뀌었으면 차이의 원인을 먼저 확인한다.
라이브 데이터가 변하는 화면은 장기 CI 픽셀 기준으로 삼기 전에 고정된 입력·데이터 조건을 마련한다.
스크린샷 기준은 실행 환경 영향을 받는다([Playwright 공식 문서](https://playwright.dev/docs/test-snapshots)).

| 산출물 | 경로 (`apps/web/` 기준) | 보존 |
|---|---|---|
| 캡처·감사 첨부 | `test-results/design-qa/` | 다음 실행 때 교체 |
| HTML·JSON 보고서 | `playwright-report/design-qa/` | 다음 실행 때 교체 |
| 로컬 픽셀 기준선 | `test-results-csat-learner/design-baselines/` | 비교 실행은 보존, 명시적 갱신만 변경 |
| 손으로 찍은 디자인 캡처 | `docs/design/shots/`(저장소 루트 기준) | **gitignore — 커밋하지 않는다**(기출 원문·실제 사용자 데이터가 찍힐 수 있다). (v07 전후 16장은 archive 로 옮겼다 — DD-47) |
| 결정 증거 보관 | `docs/design/archive/`(저장소 루트 기준 — 예: `archive/shots-v07/`) | **커밋한다** — 지난 결정의 근거가 된 캡처·원문만. 기출 원문·실제 사용자 데이터가 없는 것만(검증 계정 시드 데이터는 가능) |
| 골든 스크린 · 삽화 골든 | `docs/design/golden/`(저장소 루트 기준) | **커밋한다** — 단 `design-empty` 계정(`scripts/design/seed-empty-account.mjs`)·`/dev/components` 검수대 데이터로 찍은 것만. 기출 원문·실제 사용자 데이터 화면 금지 |

골든을 뺀 모두가 gitignore 범위 안이다. 특히 기출 원문·개인 기록이 담긴 화면을 저장소에 올리지 않는다.
변경 전 증거를 보존하려면 다음 실행 전에 별도의 로컬 작업 폴더로 복사한다.
이 환경은 로컬 비교 도구이며 CI에 기준선이나 전역 통과 게이트를 추가하지 않는다.

## 자동 검사와 사람이 확인할 경계

자동: HTTP 성공, 정확한 라우트·헤딩·테마, 준비 상태, 폰트 로드 대기, 가로 넘침,
axe WCAG A/AA, 브라우저 실행 오류, 지정된 키보드 행동.
**평균 금지(유닛, CI)**: 새 화면의 `// @form:` 골격 선언(`apps/web/src/app/__tests__/form-declaration-ratchet.test.ts`)과
평균 신호 8종 출현 수(`apps/web/src/components/__tests__/average-signal-ratchet.test.ts`). 기준선을 올려 통과시키지 않는다. 실패해도 캡처와 감사 결과를 남긴다.
Next 개발 도구(`nextjs-portal`)는 캡처·axe 대상에서 제외한다. 실제 페이지 예외는 실패로 처리하고,
콘솔 오류는 감사 첨부에 보존한다. 콘솔 내용은 별도로 원인을 확인한다.
화면 응답·로그인·준비 단계에서 실패하면 정상 캡처 대신 Playwright 실패 증거를 확인한다.

직접 확인: 첫 시선·위계·가독성·불필요한 컨테이너·정보 관계, 44px 조작 크기,
Tab/Shift+Tab 순서와 포커스 표시, 적용되는 위젯의 Space/Escape/방향키·포커스 복원,
TTS와 강조·이동·취소 연결. 모달이 없는 화면에 포커스 트랩 조건을 억지로 적용하지 않는다.
캡처는 reduced-motion 조건이므로 일반 모션과 감소 모션의 실제 차이는 별도로 확인한다.

Figma 연동은 선택 도구다. 이 세션에서 연결·파일 접근이 확인되지 않았으므로 설치 완료로 보고하지 않는다.
사용 가능한 MCP로 디자인 맥락·스크린샷을 읽는 경우에도 외부 파일 생성·게시 권한까지 추론하지 않는다.
이미지 생성 역시 래스터 시안·자산이 필요한 작업에만 사용한다. 현재 로컬 절차는 이 연동 없이 실행된다.
