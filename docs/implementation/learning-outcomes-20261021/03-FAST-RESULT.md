<!-- docs/implementation/learning-outcomes-20261021/03-FAST-RESULT.md -->
# 3 — FAST 결과 (구현 세션, 2026-10-21)

## Codex 최종 확인

신규 구현 세션 `5fd8e8ec-7e26-44a3-91a6-8727711c263f` 종료 뒤, 실제 CLI 편집 출력 `b6af5630…8221bc`를 신규 Claude 검토 세션 `40aee72b-32f0-4011-9335-65ca83ea630c`에 전달했다. B/C/D pass, A/F/H unknown의 로컬 검수 초안으로 수락했다. 실제 DB 원천을 12:04:44 UTC에 다시 SELECT한 snapshot으로 CLI를 실행했고 기존 패킷과 source digest가 같았다. 문제지·해설지·검수 결속·manifest 등 6파일을 생성했다. PC1440 브라우저에서 문제지의 정답/해설 비노출, 해설지의 설명 포함, 스크립트/가로 넘침/화면 오류 없음을 확인하고 직접 캡처를 읽었다.

추가 반례에서 종합 conclusion=pass지만 C=fail인 검수로도 HTML이 생성되던 결함을 확인했다. B/C/D를 각각 pass로 확인하도록 수정했으며 실패·미상·해당 없음 9조합은 HTML을 만들지 않는다. 수정 뒤 관련19개와 FAST 격리 브라우저1개 PASS다. 이번 작업에서 만든 하네스 3개의 transitive esbuild 타입 참조도 바로잡아 **web/scripts 타입 검사와 변경 파일 lint를 통과**했다. 아래의 새 검수/현재 원천 NOT_RUN 및 scripts 실패는 구현 세션 종료 시점 기록이며 이 확인으로 대체한다.

CLI 경과 시간은 묶음 6,672ms·검수 요청 출력 3,550ms·검수 후 출력 3,541ms다. AI 응답 대기·사용자 작업 시간과 분리한 해당 회차 기록이며 사람 절약 시간/상용 제품 우위로 해석하지 않는다. 상용 비교는 NOT_RUN이다.

## 구현

- 순수 판정 `apps/web/src/lib/csat/map/v62/factory-bridge/fast-worksheet.ts` — `evaluateFast(bundle, currentSource)`: `checkPacketIntegrity` → 범위(guided_practice × r.central_meaning × topic/title/main_point) → 원본 `validateOutput` → 원천 경계 → 편집 적용 → 편집본 `validateOutput` → 검수 판정(`checkReview` + 전 문항 포함 + pass). 원천 경계는 `local-production.ts` 에서 뽑은 공용 `sourceBindingFacts`(source_digest 와 같은 값)로 has_items 외 키를 비교한다. 1C 입고 규칙은 변경 없음.
- 편집 가능: 순서(원래 문항 id 전부), 발문, 선지 텍스트. 금지: answer·근거·해설·원문·수량(`quantity_change_requires_new_order`)·모르는 키. 원 작성자 `author` 는 그대로, 편집자는 `edit.editor`(AI 면 세션 필수, 사람이면 null)로 따로 기록.
- 내보내기: 검수 전 `edited-output.json`·`review-request.json` 만. 통과 뒤 `student.html`(기존 `renderSheet`, 정답·해설 없음)·`teacher.html`(같은 CSP/escape)·`review-binding.json`·`manifest.json`(기존 `buildManifestRecord` 포함, `fq.status=held`, claims 전부 false).
- API `POST /api/admin/csat/fast-worksheet` — requireAdminApi · same-origin · JSON · UTF-8 600KB · 닫힌 `{action, bundle}` · 요청마다 `currentSourceReader(createAdminClient(), new Date())`. 조회 실패 503 · 행 없음 409 · DB 쓰기 없음.
- 화면 `/admin/csat/new/fast`(`FastWorksheet.tsx`, `/admin/csat/new` 에서 링크) — 범위 표시, 묶음 열기/저장/다시 판정, ↑↓·발문·선지 편집, 검수 상태·거절 사유, 검수 요청/결과 가져오기, 실패 시 같은 묶음 재시도, sandbox iframe 미리보기, 내려받기. 도움말 `csat-fast`(AdminScreenHelp 연결).
- CLI `scripts/textbook/fast-worksheet.mts bundle|verify|export --help` — 새 파일/새 디렉터리만, 기존 `writeNewFile`/`newFileSet` 롤백. tsconfig.scripts 포함.

## 실제 실행 (runtime/learning-outcomes-20261021/fast-stage3-actual/)

- 입력: 1B `chunk-01.json`(task `LP-0ab61720e15eba1220c7cca1`) + `chunk-01.reviewed.out.json` + `source-snapshot.json`, 편집 `teacher-edit.json` = Codex 교사 선택(세션 `01a15de1-…`)을 FAST 편집 형식으로 옮긴 것(새 교사 실행 아님).
- 결과: topic→main_point→title, 편집 1곳. 새 출력 sha256 `b6af5630bd1f321a99c8cc21b06231ddd9e95a8eae14de6b458bcf05df8221bc`(준비 파일 `e4e4e584…` 와 다름 — 원 author 를 유지하는 직렬화. 맞추도록 코드를 바꾸지 않음).
- 준비 검수(`fast-edited-content-review.bound.json`, 세션 `421f9eb0-…`)를 넣은 묶음 → **review_rejected**(대상 바이트 불일치). 의도대로.
- `review-target/`: `edited-output.json`(b6af5630…) · `review-request.json` sha256 `0a94df388d4c63ba8903c2ab644910b636756fe30bc2c6017ff3011e22c0edc1` · `receipt.json`. **신규 독립 Claude 검수 = NOT_RUN(root 몫)**. 검수를 받으면 `bundle --review` → `export` 로 문제지·해설지·manifest 를 만든다.
- 이 CLI 실행의 current-source 는 원 snapshot 파일(source_drift=none). 공유 DB 현재 행으로 재판정 = NOT_RUN(API 경로는 시험으로만 확인).

## 검증

| 항목 | 결과 |
|---|---|
| 순수 시험 `fast-worksheet.test.ts` 11 (편집·수량/금지 필드·validateOutput 재실행·없는 인용·변조 패킷·has_items 전용 drift·본문/라이선스/상태 변경·snapshot 불일치·옛 검수·변조 target·일부 문항·F pass·fail·문제지 정답 없음·XSS escape) | PASS |
| API `route.test.ts` 4 (guard·origin·415·413·닫힌 본문·503·409·실제 판정·source_changed) | PASS |
| CLI 프로세스 시험 3 (--help·옛 검수 거절·덮어쓰기 거절·디렉터리 충돌·검수 전/후 산출물·원천 변경 시 디렉터리 미생성) | PASS |
| 기존 factory-bridge 시험(local-production 등, 리팩터 영향) | PASS(218) |
| 부분 쓰기 롤백 | 기존 `newFileSet` 시험 재사용 — FAST 전용 장애 주입 NOT_RUN |
| web tsc · tsconfig.scripts tsc | web PASS · scripts: 새 파일 오류 0(기존 harness 2파일 esbuild 타입 오류 유지) |
| ESLint 변경 web 파일 | PASS · scripts/*.mts 는 lint 설정 밖 NOT_RUN |
| 격리 브라우저 PC1440 `fast-worksheet.isolated.spec.ts`(실제 컴포넌트 + globals.css/admin 스킨, API 응답은 실제 evaluateFast 자식 프로세스) | PASS — 편집·옛 검수 거절·503 재시도·신규 검수·sandbox·문제지 정답 없음·해설지 정답·6파일 내려받기 |
| 화면 확인 | 캡처 `playwright-auth/shots-fast/`. 전체 페이지 캡처에서 미리보기 iframe 이 비어 보임(내용은 frameLocator 로 확인) — 캡처 한계로 기록. 웹폰트 미적재(대체 글꼴). 참조 기하 비교 미실행 |
| 독립 디자인/코드 검토 | NOT_RUN |
| 시간 측정 · 사람 교사 절약 · 상용 비교 | NOT_RUN — 주장하지 않음 |

## 한계

- 결과물은 로컬 검수 초안. 원천 CC0 표시는 관측이며 AI 는 권리를 주지 않는다(F unknown → FQ held). 등록·출시·납품·DB 쓰기 없음.
- 편집 시 해설 문구는 바꿀 수 없어 발문 변경과 해설 용어가 어긋날 수 있다(검수 D 축이 확인).
