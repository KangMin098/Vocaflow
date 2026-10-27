# 유형 전용 판단 도구 — 구현 단위 공통 지시 (대량작업 D)

저장소 `D:/workspace/Vocaflow` (Windows, Git Bash). 웹앱 `apps/web` (Next 14 · React 18 · TS). 한국어로 보고.

## 목적
수능 영어 유형마다 **학습자가 출제 사고·근거 관계·정답/오답 설계 논리를 직접 분석하는 판단 도구**를 만든다. 답 고르기 퀴즈가 아니다.
학습자가 실제로 무언가를 비교·연결·조작하고, 그 판단이 원문 근거 문장과 화면에서 연결돼야 한다.
긴 설명 카드·문단 덤프를 주된 교수 방식으로 쓰지 않는다. 글은 지금 하는 행동의 이유를 보조할 뿐이다.
단순 펼치기·「다음」 클릭·장식 모션은 상호작용으로 치지 않는다. 모든 유형에 같은 카드/3단계 화면을 강제하지 않는다.

각 도구에 반드시 들어갈 것:
1. 학습자가 비교할 실제 판단 대상(유형 고유 구조)
2. 근거 문장·표현·구조와의 연결(원문 단위 하이라이트 · [uN] 링크)
3. 판단이 성립하는 이유 / 판단이 실패하는 조건(반례) / 원리의 적용 한계(이 원리가 통하지 않는 경우)
4. 자유 탐색(강제 순서 없음, 언제든 원문↔판단 왕복, 선택 상태 보존)
5. 해설 우선 학습 지원: 학습자가 먼저 풀지 않아도 「해설 보기」로 바로 볼 수 있다(풀이 강요 금지). 단 공개는 학습자 요청 뒤.
6. 키보드(Tab/Enter/Space, 필요 시 화살표 — 전역 window keydown 금지, 컴포넌트 내부 onKeyDown 만) · 스크린리더(aria-pressed/aria-label/aria-live) · 주요 조작 44px 이상 · 색만으로 정보 전달 금지(글자/기호 병행) · 한글 `word-break: keep-all`.

## 엄격한 금지
- 수정 금지 파일: 아래 「당신의 파일」 밖은 **읽기만**. 특히 `apps/web/src/components/csat/judgment/{EvidencePassage,RefText,useReveal,JudgmentShell}.tsx·ts`, `judgment.module.css`, `apps/web/src/lib/csat/judgment/{types,evidence,fixtures}.ts`, `fixtures/*.json`, `scripts/judgment-harness/{build,run}.mjs`, `cases/_mount.tsx` 는 공통(D7) — 고치지 말고, 필요하면 보고서에 「공통 변경 요청」으로 적는다.
- 기존 제품 코드(Interactive34, AnalysisTheater, LectureStage, session/*, theater/*, API 라우트, DB) 수정 금지. git add/commit/stash/checkout/reset 금지(공유 인덱스). DB 접속 금지.
- 정답 공개 전 props 에 정답 번호·verdict·answerLocus 를 넣지 않는다. `*.reveal.json` 을 컴포넌트에서 import 하지 않는다. 공개 자료는 `useReveal(item, reveal)` 의 `request()` 를 학습자가 눌렀을 때만.
- 공개 전 도구 안에서 학습자 판단을 「정답/오답」으로 채점하지 않는다(정답을 모르므로). 공개 뒤에 학습자 판단과 해설 근거를 나란히 대조하는 것은 좋다.
- 숙달·진도·학습기록·analytics 호출 금지. `scrollIntoView` 금지(위치 칩은 EvidencePassage 가 한다). `Date.now()`/`new Date()` 로직 금지.
- 출제 의도(designIntent)는 확정 사실이 아니라 「근거에 따른 재구성·가설」로 표시(공통 CSS `.hypothesis` 사용 가능).
- 데이터를 지어내지 않는다. 실제 픽스처만 쓰고, 테스트용 합성 자료가 필요하면 파일·이름에 `synthetic` 을 넣고 화면/학습자 콘텐츠로 쓰지 않는다. 자료가 없으면 빈 상태를 정직하게 보인다.
- 원문 파싱 결함(예: 선지 문자열이 잘못 잘림)은 화면이 그 결함에 기대지 않게 하고 보고서에 적는다.

## 쓸 수 있는 공통 부품 (먼저 전부 읽어라)
- `apps/web/src/lib/csat/judgment/types.ts` — JudgmentItem(공개 전) · RevealData(공개 뒤: answer, designIntent, answerLocus{quote,reasoning,sentence_index}, choices[{n, verdict, trap, why_tempting, how_to_reject | why_correct, confirmed_at}]) · JudgmentToolProps{item, reveal}
- `evidence.ts` — splitRefs/refsOf/unitsAtIndex/checkReveal
- `fixtures.ts` — itemsOf(type), fixtureProvider(type). 픽스처 `fixtures/<slug>.items.json` · `.reveal.json`(읽어서 실제 내용을 파악하라. reveal 은 컴포넌트에서 import 금지, 테스트·하네스만)
- 컴포넌트: `EvidencePassage`(units, focus, pinned, dimmed, onPick, marks) · `RefText`(text, units, active, onRef) · `useReveal` + `REVEAL_ERROR_TEXT` · `JudgmentShell`(title, stem, evidence, judgment) · `judgmentStyles`(judgment.module.css 클래스: button, primary, section, note, hypothesis, status, error, empty, srOnly)
- 디자인: PC 1280·1440 전용(모바일 고려 금지), 밝고 명료, 토큰 변수(`--t1 --t2 --bd --bg --bg2 --info --error --r-md --dur-fast --ease`). 장식 일러스트·틴트카드 남발·알약칩 반복·번호라벨 장식 금지.
- 기존 참고(읽기만): `docs/csat-learner/all-types-research-20261024/01_TYPE_MATRIX.md`, `04_UI_MODELS_UX.md`, 그리고 유형별 `05~13_*.md` 중 해당 유형 문서.

## 당신의 파일(이것만 생성)
- `apps/web/src/lib/csat/judgment/<slug>.ts` — 순수 모델(상태·판단 로직·근거 매핑). 유형 구조 해석(예: (A)(B)(C) 단락 분해)도 여기.
- `apps/web/src/lib/csat/judgment/__tests__/<slug>.test.ts` — vitest(environment node). 실제 픽스처 2문항(있으면) 모두로: 근거↔선지 대응, 판단 기능 동작, 잘못된 조건·범위 일반화 방지(예: 한 표지어만으로 결론 내리지 않음), 기본 공개 상태(공개 전 모델 출력에 정답 없음), 오류·자료 없음.
- `apps/web/src/components/csat/judgment/<Name>Tool.tsx` (+ 필요하면 `<Name>Tool.module.css`) — `export function <Name>Tool(props: JudgmentToolProps)`. 파일 첫 줄 경로 주석, TODO/placeholder 금지.
- `apps/web/src/components/csat/judgment/__tests__/<Name>Tool.test.tsx` — `react-dom/server` renderToString 마크업 불변식(초기 HTML 에 정답 표지 없음, 44px 클래스·aria 존재 등).
- `apps/web/scripts/judgment-harness/cases/<slug>.tsx` — `import { mount } from './_mount'` 후 `mount('<TYPE>', (item, reveal) => <<Name>Tool item={item} reveal={reveal} />)`.
- `apps/web/scripts/judgment-harness/cases/<slug>.check.mjs` — `export async function check(page, t)`; `await t.open('?…')` 로 열고 `t.check(name, pass, detail)` 기록, `await t.shot('label')` 캡처. 반드시 검사: 마운트 직후 `window.__REVEAL_CALLS__===0` 과 DOM 에 정답 표지 없음 · 키보드만으로 핵심 판단 수행 · 원문↔판단 왕복 시 선택 상태와 판단면 scrollTop 보존 · 해설 보기 후 근거 링크 클릭 → 원문 해당 `[data-unit]` 이 `data-state="focus"` · `?reveal=fail`/`?reveal=version` 오류 문구 · `?empty=1` · `?item=1` 두 번째 문항 · 주요 버튼 높이 ≥44 · 가로 스크롤 없음. 1280/1440 은 run.mjs 가 돈다.

## 검증 명령 (cwd = apps/web)
- `pnpm exec vitest run src/lib/csat/judgment src/components/csat/judgment`
- `pnpm exec tsc --noEmit -p .` (전체가 느리면 출력에서 자기 파일 오류만 확인 — 남의 기존 오류는 무시하되 보고)
- `pnpm exec eslint <당신의 파일들>`
- `node scripts/judgment-harness/run.mjs <slug>` → `scripts/judgment-harness/out/results-<slug>.json`, 스크린샷. 실패 0 이 될 때까지 고친다. 스크린샷은 Read 로 직접 보고 시각 품질을 판단·개선한다.

## 보고(최종 메시지, 짧게)
① 구현한 판단 기능(학습자가 무엇을 비교/조작하는가) ② 테스트·하네스 결과 수치(통과/전체) ③ 사용한 실제 문항 ID·판본 / 데이터 공백 ④ 공유 화면 연결 인터페이스(props) ⑤ 공통 변경 요청·한계. 「격리 검사」와 「제품 E2E」를 구분하고 제품 서버 공개 계약을 검증했다고 주장하지 않는다.
