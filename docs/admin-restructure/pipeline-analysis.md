# 관리자 기존 파이프라인·프로세스 분석

2026-10-19 · 코드 기준 조사 · [재설계 본문](../admin-submenu-redesign.md) · **운영 실행·DB 조회 없음**

이 문서의 상태는 기존 코드·도움말에 드러난 계약이다. 배포된 worker의 실제 가동, 전체 데이터의 적격 여부, 현재 권리의 적법성을 확인했다는 의미는 아니다. 정적 색인은 공유 도움말 import도 추적하므로 관찰 파일 수와 수동 독해 범위를 동일시하지 않는다.

## 공통으로 구별할 것

| 구분 | 예 | 합치면 생기는 오류 |
|---|---|---|
| 관리 대상 | 도서/글/스캔 호/단어장 run/진단 결과/연구 주장/교재 렌더 | 서로 다른 종류의 같은 ID를 같은 객체로 취급 |
| 콘텐츠 상태 | 검수 전/준비/발행/보관 | 실행 성공을 발행·노출 완료로 오인 |
| 처리 시도 | queued/running/failed, 재시도 횟수·오류·출력 | 이전 실패와 현재 콘텐츠 상태를 섞음 |
| 허용 조건 | 권리 근거/품질 검사/사람 검토/정답·태깅/설정 버전 | 공통 버튼이 원래 gate를 우회 |
| 실행 주체 | 서버 액션/worker/브라우저 반복/에이전트 CLI | 큐 등록이나 계획 등록을 실제 처리로 오인 |
| 종료 근거 | 행 변경/검사 결과/파일 manifest/적용·노출 확인 | DB status 하나로 전체 공정 완료 주장 |

공통화할 것은 탐색·표시·조회 인터페이스이며 이 여섯 계약 자체를 하나로 축약하지 않는다.

## P01. 도서 수집·큐레이션 — LCP

**입력과 화면.** 소스 카탈로그·묶음 검색·seed·ID·Wikibooks·Wikisource·OpenStax·StoryWeaver의 8개 입력 방식을 사용한다. v1은 소스 중심 진입을 목록/수집/검토 대기 3보기로 정리했다. 도서 상세는 원문·장·추출·어휘·퀴즈·삽화·오디오 등 다른 결과를 연결한다.

| 항목 | 기존 처리 계약 | 재설계에 필요한 구분 |
|---|---|---|
| 대상·입력 | `library_books`, 소스 카탈로그, seed, `book_curation_jobs` | 소스 설정과 새 도서 입력, 도서 관리 목록 구분 |
| 공정 | 수집→정규화·분할→분석·큐레이션→ready/published, 실패/재처리 | UI가 관찰한 콘텐츠 상태와 실제 worker 단계를 함께 표시 |
| 실행 주체 | enqueue/검토 액션, 별도 processor. dev-process는 production 차단 | 개발용 처리 버튼을 운영 자동 worker가 설치됐다는 근거로 쓰지 않음 |
| gate·산출물 | 도서·장·단어장/퀴즈 등 기존 준비·발행 검사 | 본문 준비와 부속 콘텐츠 준비를 별도 결과로 확인 |
| 복구 | 실패 삭제, 상태 복원, 재수집, 퀴즈/검토 job 재등록 등 서로 다른 액션 | 모든 경로를 ‘재시도’ 한 버튼으로 일반화하지 않음 |

**주의할 액션.** `bulkRequeueBooksAction`은 단순 큐 재등록이 아니라 해당 도서 행 삭제와 관련 데이터의 cascade가 포함된 재수집 경로다. 이미 발행된 단어장·학습 기록을 보호하는 조건을 보존해야 한다. 별도의 in-progress 복원은 draft 단어장 초기화와 연결된다. 선택 도서·제외 대상·삭제 영향·보호 사유를 미리 표시해야 한다.

**이행.** 콘텐츠/도서에 그대로 둔다. 도서 목록의 v1 query·25행 페이지·현재 페이지 전체 선택·페이지 밖 직접 선택 수 계약을 유지한다. 서버 액션의 보호 판정을 UI 필터로 대체하지 않는다.

근거: [curation/actions.ts](../../apps/web/src/app/admin/curation/actions.ts), [AdminCurationClient.tsx](../../apps/web/src/app/admin/curation/AdminCurationClient.tsx), [library/admin-queries.ts](../../apps/web/src/lib/library/admin-queries.ts), [도서 도움말](../../apps/web/src/lib/admin/help/curation.ts), [개발 처리 API](../../apps/web/src/app/api/lcp/dev-process/route.ts).

## P02. 짧은 글 원문 수집 — ACP

**입력→산출물.** 원천·커버리지 확인 → 수집 enqueue → 수집 결과 검토 → 게시. 원문 수집으로 저장한 article이 대상이다. 콘솔은 coverage/get/review/publish를 구분하고 실제 목록은 필요한 단계에서만 조회한다.

| 항목 | 기존 처리 계약 | 재설계 결정 |
|---|---|---|
| 목록 | `stage/status/src/page`, 서버 페이지 100행, page는 0부터 | 도서 페이지와 공통 숫자 체계로 몰래 바꾸지 않음 |
| 실행 | enqueue, 개발용 처리·드레인·재대기 API | production 차단과 외부 worker의 실제 존재를 구분 |
| 검수 | 본문·출처·오디오 등 article별 확인 | 원천별 상태 필터와 기사 상세를 유지 |
| 산출물 | 원문 수집 article의 준비·게시 상태 | Compose 생성물과 같은 결과 목록에 모아도 계보·gate 구별 |
| 실패 | 큐/원문 수집 실패, 재대기, 개별 처리 | 선택 범위와 기존 중복 방지·보호 규칙 유지 |

`acp/dev-process` 주석은 production worker를 별도·추후 구현 대상으로 설명하며 production 요청은 403이다. 따라서 ‘서버가 계속 자동 처리한다’는 문구는 배포·스케줄 증거를 확인한 뒤에만 쓸 수 있다.

**이행.** 콘텐츠/짧은 글의 ‘원문 수집’ 방식. coverage와 소스 GET은 수집 준비/입력, review/publish는 결과 확인의 보기다. 기존 4보기와 query를 먼저 유지하고 UI 문구·도움말을 함께 정리한다.

근거: [CurationConsole.tsx](../../apps/web/src/app/admin/articles/CurationConsole.tsx), [console-view.ts](../../apps/web/src/lib/articles/console-view.ts), [개발 처리 API](../../apps/web/src/app/api/acp/dev-process/route.ts), [짧은 글 도움말](../../apps/web/src/lib/admin/help/articles.ts).

## P03. 사실 재저작 — Compose

**입력→산출물.** 소스·피드 → 발견 후보 → 사실 카드·attestation → batch → compose job → 가공 article → gate → 발행. 원문 수집과 달리 독립 출처·사실 근거를 사용한 새 글을 생산하는 계약이다. 원문 저장/재사용·권리 검토를 ACP의 규칙과 같다고 보지 않는다.

| 기존 탭 | 실제 책임 | 제안 배치 |
|---|---|---|
| 소스/피드 | 입력처·호스트·robots 등 소스 관리 | 방식 설정. 소스 확인은 제작 준비에서 교차 연결 |
| 발견 | 후보·발견 실행·커버리지 | 자료 목록 |
| 원장 | fact card, 독립 근거·attestation | 선택 batch의 사실 검증 |
| 작성/가공 | batch·job 생성·외부 작성 결과·가공 | 작성·가공 |
| 발행 | article별 gate·게시 | 검토·발행 |

탭 상태는 현재 `usePersistedTab`을 통한 localStorage 기반이다. 새 URL만 붙이고 복귀가 구현됐다고 보고하지 않는다. batch ID→job ID→article ID를 단계마다 명시하고, 다른 batch의 근거·생성 결과가 섞이지 않게 조회를 묶어야 한다.

**실행과 복구.** UI가 모든 본문을 즉시 생성하는 구조가 아니다. 에이전트 배치 드레인과 큐·검수 절차가 있다. job 실행에는 상태 확인·갱신이 있으며 일괄 실행 실패는 해당 job/batch로 복구해야 한다. 기존 발행 액션·DB gate를 일반 article update로 대체하지 않는다.

근거: [ComposeConsoleClient.tsx](../../apps/web/src/app/admin/compose/ComposeConsoleClient.tsx), [compose/actions.ts](../../apps/web/src/app/admin/compose/actions.ts), [compose-tabs.ts](../../apps/web/src/lib/admin/compose-tabs.ts), [도움말](../../apps/web/src/lib/admin/help/compose.ts).

## P04. 디지털 만화 제작 — CCP

**입력→산출물.** 도서 후보 → 제작 job 등록 → 외부 생성/페이지·패널 결과 → QC → 검토 → 발행·회수. book ID가 중심이며 실행·패널·스타일/모델·테스트 객체는 별개다.

| 항목 | 기존 계약 | 재설계 결정 |
|---|---|---|
| 탭 | Catalog/Published/스타일/테스트/모델 | 작업 목록/처리/검수·발행, 설정·테스트는 문맥에 맞게 이동 |
| 명칭 | Published 목록이 status!=none인 draft·archived도 포함 가능 | ‘제작본’+정확한 상태 필터. 발행만 포함한다고 표시하지 않음 |
| 실행 | enqueue는 큐 등록, 테스트 생성은 planned 기록 | 실제 모델 실행·출력 확인과 구분 |
| 발행 | `admin_set_comic_published` RPC에서 QC 강제 | RPC·사람 검토·연결 도서의 노출 조건 유지 |
| 복구 | 재등록·재생성·회수, 재생성 시 published→draft 가능 | 기존 발행본·패널 대체 영향과 실행 후 확인을 명시 |

CCP의 페이지/패널 QC와 PDCP의 권리 근거를 하나의 check boolean으로 합치지 않는다. 특정 도서의 drain 화면과 생성 이력은 도서 상세에서 접근한다. 모델·스타일 변경은 이후 생성에 적용되는 설정임을 명확히 한다.

근거: [AdminComicClient.tsx](../../apps/web/src/app/admin/comic/AdminComicClient.tsx), [comic/actions.ts](../../apps/web/src/app/admin/comic/actions.ts), [comic/admin-queries.ts](../../apps/web/src/lib/comic/admin-queries.ts), [도움말](../../apps/web/src/lib/admin/help/comic.ts).

## P05. 스캔 만화 복원 — PDCP

**입력→산출물.** 소스·대량 적재 → queued → acquired → restored → segmented → OCR/검토 → published. 대상은 issue ID다. OCR이 불필요한 입력과 실패를 구분하고 소스에 따른 hOCR·대사 현대화 등 별도 작업을 유지한다.

| 현재 구성 | 책임·실행 | 제안 배치 |
|---|---|---|
| 소스·대량적재 | 대상 발견·소스 선택·등록 | 작업 목록의 수집, 소스 설정 |
| 큐·드레인 | 브라우저가 1호·1단계를 반복 요청 | 처리와 실행 상세, 중단/재진입 안내 |
| PD근거확인 | pd_basis / pd_checked_at / pd_checked_by / source_url | 해당 호의 검수 필수 항목 |
| 테스트·모니터 | 처리 상태·테스트 결과 관찰 | 실행 상세·검수 결과 |
| 도구 | 환경 점검·수정·보조 작업 | 환경 설정과 활성 복구 작업을 구별 |

`/api/pdcp/drain`은 production 차단이며 로컬 CLI·미디어 도구에 의존한다. 브라우저 반복이 멈춘 사실은 이미 진행 중인 서버 처리의 취소를 의미하지 않는다. 재시도는 원래 issue·단계의 상태를 확인해야 한다. ‘모든 과정 자동 운영’ 문구를 새로 넣지 않는다.

**이행.** 콘텐츠/만화의 스캔 복원 방식. 권리 근거는 독립 gate로 남기고 원문·복원 페이지 reader를 상세에 연결한다. 도움말에 적힌 법적 설명을 이 조사에서 새로 검증한 법률 판단으로 취급하지 않는다.

근거: [AdminPdComicsClient.tsx](../../apps/web/src/app/admin/pd-comics/AdminPdComicsClient.tsx), [drain API](../../apps/web/src/app/api/pdcp/drain/route.ts), [도움말](../../apps/web/src/lib/admin/help/pd-comics.ts).

## P06. 주제 코퍼스 관측 — TCP

**입력→산출물.** 주제·소스 → discover/enqueue → 문서에서 어휘 관측 → 누락 후보 → category 승격 미리보기 → 적용. 읽기 본문의 공개 발행이 핵심 산출물이 아니므로 **어휘·사전/관측·분류**가 정본 소속이다.

| 항목 | 기존 계약 | 메뉴·프로세스 변경 |
|---|---|---|
| 실행 | 브라우저 반복 drain과 CLI가 같은 핵심 함수 사용 | 탭 종료·중단과 worker 상태 구분 |
| 경합·실패 | SKIP LOCKED, 오래된 실행 회수, 실패 횟수 제한 | UI 재시도가 새로운 병렬 작업 엔진이 되지 않게 함 |
| 관측 결과 | 단어·문맥 관측, 사전 누락 후보·분류 연결 | 관측 출처→사전 보강/분류 상세로 연결 |
| 승격 | 미리보기 후 category 링크 적용, 일괄 상한·보호 규칙 | 미리본 범위와 실제 적용 범위 일치 확인 |
| 복구 | 단계별 재실행과 링크 보정은 다른 절차 | 모든 승격에 일반 undo가 있다고 표시하지 않음 |

소스 본문을 저장하는 독서 콘텐츠 수집과 용어 관측을 구분한다. 기존 도구·overview RPC와 drain/promote 구현을 재사용하며, 이동을 이유로 새 큐·새 카테고리 테이블을 만들지 않는다.

근거: [topic-corpus/page.tsx](../../apps/web/src/app/admin/topic-corpus/page.tsx), [drain.ts](../../apps/web/src/lib/topic-corpus/drain.ts), [promote API](../../apps/web/src/app/api/topic-corpus/promote/route.ts), [도움말](../../apps/web/src/lib/admin/help/topic-corpus.ts).

## P07. 기존 사전으로 단어장 조립 — VCB Studio

**입력→산출물.** 기존 사전/코퍼스 → 조건·레시피 → 읽기 전용 미리보기 → 품질 검사 → 서버 재조립·발행 → 카탈로그 후처리. 새 seed를 보강하는 Runs와 다른 경로다.

미리보기의 품질 검사는 총점과 개별 지표를 모두 본다. 미리보기 목록을 그대로 신뢰해서 발행하는 대신 서버에서 실제 입력을 다시 조립하는 기존 규칙을 유지한다. 발행 slug가 기존 단어장을 대체할 수 있는 경로는 대체 대상·영향을 명확히 해야 한다.

**종료 조건.** 발행 API 성공뿐 아니라 도움말에 정의한 커버·published words 갱신·imprint·계단 정합성 후처리를 구별한다. 후속 CLI가 필요한 경우 해당 단계의 실행 주체와 완료 근거를 보여준다. UI의 발행 성공을 모든 카탈로그 준비 완료로 표현하지 않는다.

**이행.** 어휘·사전/단어장의 ‘기존 사전으로 조립’. 입력 자료는 이 방식의 준비/설정으로 연결하고 발행 컬렉션은 결과 목록으로 유지한다.

근거: [studio/page.tsx](../../apps/web/src/app/admin/vocab/studio/page.tsx), [Studio 서버 액션](../../apps/web/src/lib/vcb/server/compose-studio.ts), [VcbSectionNav.tsx](../../apps/web/src/components/admin/vcb/VcbSectionNav.tsx), [단어장 도움말](../../apps/web/src/lib/admin/help/vocab.ts).

## P08. 새 seed로 단어장 제작 — VCB Runs

**입력→산출물.** seed 파일/생성 → 사전 매칭 → 부족 엔트리 보강 → QA → 큐레이션 → 발행. run ID·seed·보강 queue·발행 단어장을 추적한다. 현재 8단계의 자세한 작업은 해당 run 안에서 유지한다.

| 위험 지점 | 기존 동작 | 제안 표시 |
|---|---|---|
| 보강 비율 | 보강이 끝나도 QA·큐레이션·발행은 남음 | 단계별 완료 조건, 보강 100%와 출판 완료 구분 |
| seed 검토 | 제외 판단 일부가 sessionStorage에 의존 | 새 URL/다른 창의 판정 복원 범위를 명시 |
| 재생성 | seed 파일·제외 판단을 초기화할 수 있음 | 재생성 전에 대상·초안 손실 범위 확인 |
| import | 에이전트가 채운 결과를 검증 후 적재 | 재실행 안전·건너뛴 수·이미 적재한 값 보호 유지 |

새 seed 제작을 Studio의 다음 단계로 이어 붙이지 않는다. 같은 발행 컬렉션으로 끝나더라도 중간 준비물과 복구 단위가 다르다. 큐레이션 상세·seed preview의 기존 URL을 run 상세에서 계속 연결한다.

근거: [runs/page.tsx](../../apps/web/src/app/admin/vocab/runs/page.tsx), [발행 서버 액션](../../apps/web/src/lib/vcb/server/publish.ts), [보강 서버 액션](../../apps/web/src/lib/vcb/server/enrich.ts), [단어장 도움말](../../apps/web/src/lib/admin/help/vocab.ts), [VcbSectionNav.tsx](../../apps/web/src/components/admin/vcb/VcbSectionNav.tsx).

## P09. 공용 사전 보강 — Pending Words

**입력→산출물.** 누락 관측 → 진짜 사전 누락/파생형/철자 변이/하이픈·분절 등 분류 → 에이전트 보강 또는 resolver 조치 → 실제 적재 검증 → 상태 종결. 모든 후보를 새 표제어로 추가하는 과정이 아니다.

현재 상태는 pending/reviewing/auto-classify/rejected/added로 나뉜다. `transitionPendingWord`는 `update_pending_word_status`를 호출하는 상태 전이 액션이다. **added로 바꾸는 것만으로 사전 행을 생성한 것은 아니다.** 일반 상태 변경과 실제 보강 import·검증 결과를 구분해야 한다.

**이행.** ‘사전 보강’ 안에서 누락 판정/보강 대상/적재 확인으로 묶되 원천 상태값·판정 사유는 유지한다. reject/proper noun/noise/derived 처리 등 의미가 다른 결과를 하나의 성공 카운트로 합산하지 않는다. 이미 추가된 단어를 재분류할 때도 실제 사전 상태부터 확인한다.

근거: [pending-words/page.tsx](../../apps/web/src/app/admin/pending-words/page.tsx), [actions.ts](../../apps/web/src/app/admin/pending-words/actions.ts), [queue.ts](../../apps/web/src/lib/admin/pending-words/queue.ts).

## P10. 어휘 품질·분류 — VRL 공급 측

**대상.** 수준·트랙·도메인·스킬 분류, 의심 단어·자동화·사전 품질 지표다. 학습자의 진단·수준 기록은 공급 측 분류 기준과 소속을 분리해야 한다.

VRL 루트는 Overall/R1–R4/9Dims/Defects/Impact/Schema/DistRounds/Backlog의 8개 고정 섹션으로 현재 상태·기술 이력·개선 계획을 함께 보여준다. 새 구성은 현재 품질·결함을 먼저 보여주고 과거 배포·스키마 설명은 기술 이력으로 접는다. taxonomy의 4축을 UI 단순화를 이유로 삭제하거나 합치지 않는다.

**이행.** 어휘·사전/관측·분류에 주제 관측·분류 기준·품질 점검을 둔다. dictionary 상세에서도 해당 단어의 분류·의심 사유로 연결한다. 자동화가 실제 적용하는 범위와 사람이 검토할 대상을 따로 표시한다. 과거 migration 완료를 현재 사전 품질로 환산하지 않는다.

근거: [vrl/page.tsx](../../apps/web/src/app/admin/vrl/page.tsx), [taxonomy/page.tsx](../../apps/web/src/app/admin/vrl/taxonomy/page.tsx), [concerns/page.tsx](../../apps/web/src/app/admin/vrl/concerns/page.tsx), [automation/page.tsx](../../apps/web/src/app/admin/vrl/automation/page.tsx).

## P11. 영어 진단 운영·학습자 기록

**입력→산출물.** 시험·정답·문항 태깅 검토 → 버전이 있는 진단 엔진 → 참여자 응답·점수·진단 결과. 현재 현황/시험·태깅/학습자/엔진 설정으로 연결된다.

| 계약 | 기존 처리 | 재설계 경계 |
|---|---|---|
| 검사 준비 | 정답 키·태깅 검토가 필요한 readiness 판정 | 준비 부족 시 기존 score-only 제한 유지 |
| 설정 | `csat_dx_settings`의 버전·활성 설정, 이전 결과 스냅샷 유지 | 설정은 사용자 프로필 옵션과 별개, 변경 범위 명시 |
| 참여자 | 진단 응답이 있는 실제 명단·상세 | 학습자 기록에 정본 소속, 시험 운영에서 교차 링크 |
| 상세 상태 | tab/view/modal/record/focus | 상세 진입·복귀에서 보존 |

**이행.** 영어/어휘를 ‘진단 운영’ 안의 방식으로 제공하되 점수 체계·검사·설정을 통합하지 않는다. 영어 학습자 목록·상세는 학습자 기록에 둔다. 사용자의 실제 목록/권한/동일 인물 조인이 없는 상태에서 전체 CRM·일반 사용자 편집을 새로 만들지 않는다.

근거: [diagnosis/actions.ts](../../apps/web/src/app/admin/csat/diagnosis/actions.ts), [diagnosis/page.tsx](../../apps/web/src/app/admin/csat/diagnosis/page.tsx), [도움말](../../apps/web/src/lib/admin/help/csat-diagnosis.ts), [users/page.tsx](../../apps/web/src/app/admin/users/page.tsx).

## P12. 어휘 진단·수준 이력과 활동 분석

현재 어휘 진단 페이지는 검사·문항·결과 현황을 **조회**한다. 사용자 수준과 snapshot도 관찰·이력 성격이다. 기존 이름이 ‘관리’라고 해서 검사 편집·재채점 기능이 있다고 가정하지 않는다.

**이행.** 검사·문항·결과 조회는 진단 운영/어휘에, 사용자 수준과 수준 이력은 학습자 기록/어휘에 둔다. 통합 프로필은 사용자 식별자·진단 참여자·이력의 조인과 서버 권한을 검증하는 reader가 선행되어야 한다. 1단계는 기존 명단을 종류별로 선택하는 구조다.

활동 분석의 실집계·RetentionPanel·TeacherFunnelPanel은 그대로 재사용한다. 내부·검증된 외부·미분류 집단을 유지하고, 퍼널 이벤트·활동량을 독립적인 학습 효과 검증으로 해석하지 않는다.

근거: [diagnostic/page.tsx](../../apps/web/src/app/admin/vrl/diagnostic/page.tsx), [vrl/users/page.tsx](../../apps/web/src/app/admin/vrl/users/page.tsx), [snapshots/page.tsx](../../apps/web/src/app/admin/vrl/snapshots/page.tsx), [analytics/page.tsx](../../apps/web/src/app/admin/analytics/page.tsx).

## P13. 탐구·근거·학습 설계·제품 적용

**입력→산출물.** 탐구 질문 → 여러 근거·반례 → 주장 비교 → 검토·채택 → 실행 과제·trial → 제품 적용 → 실제 결과·재검토 신호. 연구 자료와 학습자에게 적용한 결과는 다른 객체다.

| 기존 공간 | 정본 대상·계약 | 제안 |
|---|---|---|
| 원리 운영실 | 업무 현황·작업 연결 | 연구 현황 |
| 지도 | 역량·기제·방법·과제, 관계, 항목 상세 | 역량·원리 |
| 연구소 9링크 | 질문/서지/비교/검토/출처/기출 원천/전문가/공백/가져오기 | 탐구 질문/근거 자료/비교·검토로 묶고 원래 상세·유형·원장은 유지 |
| 설계·검증 | 실행 과제·trial, 계획·진행·분석·중단 | 설계·검증/학습 설계 |
| 제품 적용 | draft/active/paused/rolled_back, 실제 결과 신호 | 적용·성과 |

근거 수준·채택·trial·실제 적용에는 별도 gate가 있다. AI 주장 일치·합성 데이터는 효과 근거와 다르며, 제품 적용에는 채택한 항목과 실험 조건이 필요하다. 근거가 바뀌어 적용을 중단해야 하는 규칙과 버전 충돌 검사(`seenVersion`)를 유지한다.

탭 개수를 줄이면서 출처 유형·주장-근거 관계를 잃으면 목적 이탈이다. 통합은 같은 목록에 무작정 합치는 것이 아니라 선택 질문의 근거·비교·검토를 가까이 배치하는 작업이다. 교재 설계와 학습 trial은 한 공간에 두되 같은 DB 객체나 동일 승인 규칙으로 합치지 않는다.

근거: [vnext-labels.ts](../../apps/web/src/lib/knowledge/vnext-labels.ts), [knowledge/actions.ts](../../apps/web/src/app/admin/knowledge/actions.ts), [vnext-actions.ts](../../apps/web/src/app/admin/knowledge/vnext-actions.ts), [연구 도움말](../../apps/web/src/lib/admin/help/knowledge.ts).

## P14. 기출 분석과 교재 설계 기준

**입력→산출물.** 시험 범위(주관기관·학년·시험) → 문항/유형 관측·분포·최근 출제 빈도 → 분석 운영·리포트 → 연구 근거/제작 기준 참조. KICE 읽기 뷰와 `/csat/evidence`의 분석 운영은 같은 화면의 중복본이 아니다.

`/predict`는 관측한 출제 빈도를 읽는 기능이므로 검증된 미래 예측처럼 이름 붙이지 않는다. 지도와 최근 출제 보기는 ‘분포·출제 빈도’ 아래 두 보기로 배치할 수 있다. 시험 scope는 이동 때 유지한다.

`/kice/plan`은 `loadCsatPlan(scope)`와 로그인한 계정의 `loadMyTraps(db)`를 함께 조회한다. 첫 화면 `/admin/kice`도 `loadMyTraps(db)`의 결과를 TrapAtlas의 ‘내 기록’ 칩에 넘긴다. 두 화면 모두 공용 분석과 관리자 개인 이력을 구분해야 한다. 이는 타인의 이력이 유출됐다는 관찰이 아니라 **공용 연구와 관리자 개인 학습 이력의 책임 혼재**다. 공용 분석 우선순위를 기본으로 하고 학습자 개인화는 명시한 사람의 기록·권한에 결속된 별도 reader가 있을 때만 제공한다.

시장 교재 비교와 blueprint는 연구/설계·검증의 교재 설계 보기에 둔다. 기출 원천의 정본은 탐구·근거에 남기고 분석 운영에서 교차 연결한다. 기출 원문 창고와 연구 출처 메타데이터도 복제하지 않는다.

근거: [kice/plan/page.tsx](../../apps/web/src/app/admin/kice/plan/page.tsx), [kice/predict/page.tsx](../../apps/web/src/app/admin/kice/predict/page.tsx), [csat/evidence/page.tsx](../../apps/web/src/app/admin/csat/evidence/page.tsx), [strategy/page.tsx](../../apps/web/src/app/admin/csat/strategy/page.tsx), [blueprint/page.tsx](../../apps/web/src/app/admin/csat/blueprint/page.tsx).

## P15. 교재 제작·검수·발행

**현재 화면 흐름.** 제작 기준 → 글감 후보 → 지문 → 문항 → 해설 → 검수 → 발행 승인 → 발행본. 연구·용어·전체 재고의 숫자는 이 공정의 옆에서 참조하는 정보다.

| 층 | 확인한 상태 | 설계 결정 |
|---|---|---|
| 탐색 기준 | v1 URL로 series/band/grade/type/volume 전달 | 저장된 주문이라고 표시하지 않음 |
| 문항·해설 reader | `loadAuthorView()`/`loadExplainView()`에 scope 인자 없음. 공용 shelf inventory 조회 | 현재 전체 재고 표시. 선택 기준을 받은 서버 reader가 있어야 대상별 진척 허용 |
| 검수·발행 reader | render·explanation·검수·브랜드·내용 등 기존 gate | 기존 판정 이유·계보·보호 규칙 유지 |
| 발행 액션 | 승인 근거 기록 후 render/colophon 갱신 경로 | 부분 성공·실패를 구분. 승인과 실제 학습자 납품·노출 구별 |
| 정본 연결 | 기존 FactoryRequest/ProductionNeed 및 계보 계약 존재 | 새 관리자 주문 DB/중복 생산 큐 신설 금지. 현재 UI와 정본의 연결을 추가 점검 |

**핵심 수정.** ‘한 권 만들기’를 당장은 ‘제작 공정’으로 바꾸고, 각 단계에서 선택 기준과 실제 조회 범위를 표시한다. 기준을 선택했다고 전체 재고를 해당 권의 수치로 이름 바꾸지 않는다. 정본 `product_order_id/revision/hash`, cell/drain/manifest 근거와 연결된 reader가 생긴 뒤 주문별 현황·실행·발행판으로 확장한다.

I0 문서는 CONTRACT_ONLY 단계의 참고 계약이다. 이후 I1/I2 등 DB 변경 문서도 있으므로 I0만 보고 전체 Factory가 존재하지 않는다고 결론 내리지 않는다. 이번 조사에서 확인한 결함은 **현재 관리자 문항·해설 조회가 선택 주문에 결속되지 않은 것**이다. 별도 브랜치/DB의 후속 구현 유무와 배포 상태는 현재 UI 연결의 증거가 아니다.

근거: [authoring/page.tsx](../../apps/web/src/app/admin/csat/authoring/page.tsx), [factory-line-views.ts](../../apps/web/src/lib/csat/factory-line-views.ts), [press/actions.ts](../../apps/web/src/app/admin/csat/press/actions.ts), [factory-plain.ts](../../apps/web/src/lib/csat/factory-plain.ts), [I0 계약](../csat-learner/v62/FACTORY_BRIDGE_I0.md), [factory bridge](../../apps/web/src/lib/csat/map/v62/factory-bridge/production-need.ts).

## P16. 콘텐츠 품질·검사 실행·추출 판정

품질 지표는 관찰, gate 검사는 명시적 실행, 추출 판정은 사람이 제출하는 작업이다. 단순 설정 화면 세 가지가 아니다.

| 기능 | 기존 계약 | 제안 배치 |
|---|---|---|
| 품질 현황 | 실제 지표·결과 조회 | 품질·실행/품질 현황 |
| 검사 | `run_content_quality_gates` 등 실행 액션·결과 | 품질·실행/검사 실행. 초기 SSR에서 무조건 비싼 실행을 시작하지 않음 |
| 추출 판정 | 샘플을 맹검으로 판단 후 정답/출처 공개, 판정 저장 | 품질·실행/추출 판정. 활성 쓰기 작업이므로 설정으로 숨기지 않음 |
| 연결 상태 | 실제 저장 경로 없는 설정·신고·결제 안내 | 보조 정보 패널, 기존 URL 보존 |

글로벌 품질 검사 결과가 존재한다고 해서 모든 파이프라인의 발행을 하나의 gate가 자동 차단한다고 주장하지 않는다. 도서·Compose·만화·교재 각각의 실제 발행 경로와 연결된 조건을 확인해야 한다. 공통 실행 조회는 도메인별 기존 기록을 연결하는 어댑터 이후에만 추가한다.

근거: [quality/page.tsx](../../apps/web/src/app/admin/quality/page.tsx), [gates/actions.ts](../../apps/web/src/app/admin/quality/gates/actions.ts), [JudgeClient.tsx](../../apps/web/src/app/admin/quality/judge/JudgeClient.tsx), [settings/page.tsx](../../apps/web/src/app/admin/settings/page.tsx), [품질 도움말](../../apps/web/src/lib/admin/help/quality.ts).

## P17. DB 상태·발견·허용 조치

**입력→산출물.** 상태 수집 → 발견 목록 → 원인·허용 조치 검토 → 기존 허용 액션 → 조치 이력·체크포인트·재검증. UI의 허용 액션과 에이전트가 수행하는 감사·복구 작업을 구분한다.

**이행.** 운영/DB 점검의 발견·점검 실행·조치/이력으로 묶는다. 기존 allowlist·승인·스냅샷·action log 경계를 유지한다. 임의 SQL 입력이나 자동 migration 버튼을 신설하는 설계가 아니다. 부분 실패나 재검증 실패를 ‘조치 완료’로 바꾸지 않는다.

이 문서에서는 진단 RPC·DB 조치도 실행하지 않았다. 메뉴 재설계의 근거로 실제 DB 결함·수치·성능을 새로 주장하지 않는다.

근거: [db/page.tsx](../../apps/web/src/app/admin/db/page.tsx), [운영 도움말](../../apps/web/src/lib/admin/help/ops.ts).

## P18. 홍보 영상 요청·설계·렌더·배치

**입력→산출물.** 요청 ID → needs/problem/promise/message/action 계획 → 장면 설계 → 검토/평가 → 실제 렌더·오디오·패키징 → 형식별 파일·manifest → 플랫폼 배치·점검. 현재 UI의 7탭은 요청/현황/기획/평가/구성요소/수치낡음/내보내기다.

| 제안 보기 | 흡수할 기능 | 선택 상세·실행 경계 |
|---|---|---|
| 요청·제작 | 요청, 작업 현황, 기획·설계 | 요청 ID와 검토 버전, 외부 드레인/렌더 실행 절차 |
| 발행 영상 | 실제 영상 목록·생성물·내보내기 | 형식별 파일·manifest·배치 위치·회수 상태 |
| 성과·점검 | 평가·수치 낡음·노출 점검 | 해당 영상의 근거 수치·평가 결과·재제작 요청 |
| 제작 설정 | 구성요소·생성 방식 | 선택 작업과 관련된 자산·설정, 실행 목록과 분리 |

**실행과 복구.** 요청 생성·검토·취소·retire/restore 액션과 실제 파일 생성/배포는 다르다. 요청의 설계가 완료됐다는 기록만으로 렌더가 실행됐다고 표시하지 않는다. retire는 DB 변경 뒤 `retire:sync --commit` 및 배포 등 별도 반영이 필요한 경로다. purge는 일반적인 UI undo가 가능한 작업으로 표현하지 않는다.

각 포맷의 파일·manifest·플랫폼 배치를 확인해야 실제 노출 완료를 말할 수 있다. 전체 영상 공장 메뉴를 콘텐츠 생산의 공통 wizard로 합치지 않고 운영/홍보 영상에서 업무를 끝낸다.

근거: [VideoConsoleClient.tsx](../../apps/web/src/app/admin/video/VideoConsoleClient.tsx), [video/actions.ts](../../apps/web/src/app/admin/video/actions.ts), [video/page.tsx](../../apps/web/src/app/admin/video/page.tsx), [VIDEO_FACTORY.md](../VIDEO_FACTORY.md).

## 프로세스 재배치 요약

| 입력/활동 | 정본 책임 | 다음 영역으로 넘길 때의 계약 |
|---|---|---|
| 읽기 도서·글·만화 생산 | 콘텐츠 | 발행 대상 kind+id와 해당 원천 gate·계보 유지 |
| 주제 관측·사전 보강·단어장 | 어휘·사전 | 사전 적재/단어장 발행 결과, 관측·품질 근거 |
| 시험·진단·개인 결과 | 학습자·진단 | 사용자·검사·결과 ID, 엔진 버전·조회 권한 |
| 기출·논문·주장·원리·설계 | 연구·기준 | 채택한 기준의 revision·근거, 실제 적용·trial 분리 |
| 교재 생산·검수·발행 | 교재 제작 | 정본 주문·cell·산출물 계보, 승인과 납품/노출 구분 |
| 글로벌 품질·DB·홍보 영상 | 운영·시스템 | 원래 도메인 액션·실행 근거로 연결, 공통 큐에 쓰기 금지 |

화면상의 이동은 데이터 복제·처리 엔진 합병이 아니다. 원래 처리 경계가 없는 공통 상태를 만들어 운영을 단순해 보이게 하지 않는다.
