# 영어교육 방법론 지식층 — 1단계

기준: 2026-09-19. **초기 연구·검증·적재 기반이 구현되었으며, 어드민 화면과 원격 DB 적용은 아직 완료되지 않았다.**
원래 워크트리의 대규모 미커밋 변경을 섞지 않기 위해 `feat/methodology-intelligence` 별도 워크트리에서 작업했다.

## 조사 결과와 한계

실제 내용이 확인된 공식 문서를 바탕으로 다음 4개 방법을 `extracted`로 구조화했다. 학생 성과를 입증하는 연구 결과로 취급하지 않는다.

| 방법 | 확인한 내용 | 원문 위치 |
|---|---|---|
| 문장 예문으로 문법 적용 | 대표 예문 학습 → 확인 문제 → 다른 문장에 적용 | [쎄듀 고등 GRAMMAR](https://www.cedubook.com/products/2312040001), 교재특징 |
| 글 계획과 자기 점검 | 예시 구조 분석 → 글 계획 → 조건에 맞게 작성 → 기준으로 자기 채점 | [쎄듀 중등 WRITING](https://cedubook.com/products/2410140001), 논술형 수행평가 설명 |
| 새 문맥으로 어휘 복습 | 문장 속 어휘 학습과 새 문맥을 활용한 누적 복습 | [쎄듀 VOCA](https://www.cedubook.com/products/2310170001), 교재특징 |
| 독해 유형 간 전이 | 유형의 관계를 연결해 배우고 풀이 뒤 확인 사항 점검 | [러셀 김지영](https://mrusseldc.megastudy.net/teacher/teacher_home.asp?code=1485), 강의특징 |

전문가 후보 11명은 순위가 아니다. 김지영·김기훈·허준석·김혜리·윤여범·마스터유진·세리나 황은 공식 본문을 읽은 프로필, 정승익·조정식·이현석·이명학은 공식 자료에서 발견한 추가 조사 후보다.
초등 교수진은 [서울교대](https://grad.snue.ac.kr/snue/cm/cntnts/cntntsView.do?cntntsId=3010&mi=3016), 허준석은 [EBS 교사 소개](https://primary.ebs.co.kr/teacher/view?subjectCd=32000002&teacherId=FEAF9DCCD254DF6EF7F28F63F0035747), 영작 진행자는 [EBS Easy Writing](https://home.ebs.co.kr/dw/etc/5/cast)를 근거로 남겼다. 목록만으로 학습 효과나 전 분야 전문성을 추정하지 않는다.

김지영 채널 영상 51건은 **제목·게시일·길이 메타데이터만** 확보했다. 자막 요청이 빈 응답을 반환했으므로 영상에서 주장이나 상세 학습법을 추출한 것으로 표시하지 않는다. 원본/쇼츠 중복 계보가 확인되지 않은 영상은 같은 origin group으로 묶었다. 이 목록이 채널의 영구적인 전체 목록이라는 보장도 없다.

초등 독서·발음, 성인 말하기·듣기, 고급 영어, 학령별 실패·예외·시간관리, 동일 방법을 독립적으로 설명한 다수 전문가 근거는 후속 조사 영역이다. 현 자료로 실제 충돌/다수 합의가 발견됐다고 주장하지 않는다.

## 실행

Windows에서는 `pnpm.cmd` 사용. repo root 기준:

```powershell
pnpm.cmd exec tsx scripts/methodology/drain.mts seed tmp/new-research.json
pnpm.cmd exec tsx scripts/methodology/drain.mts validate tmp/new-research.json
pnpm.cmd exec tsx scripts/methodology/drain.mts report tmp/new-research.json
pnpm.cmd exec tsx scripts/methodology/drain.mts prepare tmp/new-research.json
```

출력 디렉터리는 먼저 만든다. seed는 기존 파일을 덮어쓰지 않는다. `prepare`와 기본 `import`는 DB에 쓰지 않는다. 상세 추출·정규화·복구 절차는 [드레인 지시서](../../scripts/methodology/PROMPT.md).

방법론 연구 API `GET /api/admin/methodology`(2026-09-19 추가)는 **2026-09-30 삭제** — 부르는 곳이 없었다(링크 그래프·호출부 회귀). 가져오기 원장 화면 `/admin/methodology` 는 서버 함수 `lib/methodology/server.ts` 의 `readMethodologySnapshot` 으로 직접 읽는다.

## 저장소 변경안

[schema.sql](./schema.sql)은 **승인 대기 초안**이며 자동 migration 디렉터리에 넣지 않았다.

- 새 테이블 10개: batches, taxonomy, experts, channels, sources, methods, claims, evidence, relations, gaps (`methodology_` 접두사).
- RPC 2개: 원자적·멱등 적재 `methodology_import(jsonb,text,text)`, 버전 지정 조회 `methodology_read(text)`.
- 기존 테이블 수정/삭제 없음. 모든 새 테이블 RLS, anon/authenticated 직접 접근 금지, service role만 접근.
- JSON 덩어리 하나가 아닌 관계형 행과 FK로 저장. 원본 자막 열 없음. 배열 분류/참조는 import 트랜잭션 안에서 검증.
- 원문 버전·근거 위치·canonical claim·외래키·동시 편집 parent를 검사한다. import 실패는 전부 롤백. 동일 번들 재실행은 기존 ID 반환.
- 기존 스냅샷은 보존한다. 이전 스냅샷으로 되돌려 읽을 수 있으며 자동 삭제/보존기간 작업은 만들지 않았다.

승인 후 DB checkpoint → 동일 SQL을 migration 파일로 옮김 → 파일 그대로 적용 → dry-run 확인 → 소량 적재 → 조회/권한 검증 → DB_SCHEMA/통계 갱신 순서다. 현재 원격 DB에 이 SQL이나 연구 자료를 쓰지 않았다.

## 품질 확인과 남은 게이트

- 단위/관리자 API 테스트 24개 통과: 원문 버전, 메타데이터 오용, 출처 귀속, 필수 주장 근거, 권한, 조용한 폴백 금지 등.
- 외부 임시 디렉터리에 설치한 PGlite에서 SQL 실행: 권한, 원자성, 멱등성, 정확한 왕복, 필수 위치, 순환 분류, 오래된 parent 거부 확인. 앱 의존성 추가 없음. 재현 명령은 `node scripts/methodology/schema-test.mjs <PGlite 설치 디렉터리> <bundle.json>`.
- 신규 코드 lint 통과. 전체 웹 타입 검사는 기준 커밋의 기출 코드 오류 3건(`AnchorOrigin`, `anchors[].from`) 때문에 실패. 신규 방법론 코드에 보고된 오류는 없음. 기출 코드를 이 작업에서 임의 수정하지 않았다.
- [화면 4안](../design/compare/methodology.md): 사람 선택 대기. 어드민 화면/도움말/시각 QA는 아직 구현·실행하지 않았다.
- SQL 사용자 승인 대기. 운영 DB 권한/성능 검증은 로컬 테스트로 대체할 수 없다.

관련: [Gate 0](./gate0.md), [자료 계약](../../apps/web/src/lib/methodology/types.ts), [검증기](../../apps/web/src/lib/methodology/core.ts).
