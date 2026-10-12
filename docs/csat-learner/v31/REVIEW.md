# v3.1 설계 검수 기록

## 범위

설계 기준 main `521944f227c9cf5b957cb8b366fb27a6d81a3d42`. 제품·DB 변경 없음. 사용자 제공 AGENTS.md의 반대 에이전트 계획 검토 요구를 적용한다. 현재 main review.mjs에는 --plan 기능이 없고 자동 Codex 리뷰도 폐지되어 있으므로 읽기 전용 Claude CLI로 실제 문서를 검토한다.

## 증거

1차: Claude CLI를 plan/read-only 도구(Read/Grep/Glob), 세션 저장 없음으로 실행하여 목적 파일과 네 설계 문서를 대조했다. P3 3건을 받았다.

| 지적 | 처리 |
|---|---|
| DB 체크포인트 스킬 이름만 있어 main에서 찾기 어려움 | 실제 main의 `.claude/commands/db-checkpoint.md`(`/db-checkpoint`)를 명시. 환경 스킬은 실제 경로 확인 후 사용 |
| C2 초안 조건에 로그아웃 초기화가 빠지고 C5만 검사 | C2에 로그아웃 초기화 명시(설계 본문에도 존재) |
| isolated E2E 실행 명령 누락 | `playwright.isolated.config.ts`를 사용하는 실행 명령과 로컬 DB 전제 추가 |

자가 대조에서 어법 교정 예가 원문 anchor와 혼동될 수 있어 correction은 별도 설명 필드로 분리했다. 모든 anchor는 실제 원문으로만 결속한다. 최종 재검토 결과와 정합성 검증은 아래에 추가한다.

2차: 같은 읽기 전용 검토에서 blocking 결함 없음, P3 2건을 받았다. navigation 공용 parser가 현재 없음을 명시하고 새 pure parser/URL builder·기존 pair 맥락 유지 회귀를 요구했다. 실제 읽은 원문 입력 경로와 대상 문항을 C0에도 명시해 새 작업트리에 입력이 없다는 이유만으로 잘못 보류하지 않게 했다. 다른 작업트리 원 파일은 수정하지 않는다.

3차: P2 2건·P3 1건. writer 해시 manifest만으로는 배포된 base 항목의 변경을 못 잡을 수 있어 binding을 실제 배포 item 전체 레코드의 직접 canonical SHA-256(`basePublicHash`)으로 변경했다. 짧은 anchor.quote의 8단어 상한·기존 공개 인용과 합산 예산 가드를 명시하고 전체 원문 입력 커밋 금지와 구별했다. dissection-passage.ts의 전체 경로를 명시했다. 최종 main #236의 E2E/검수표도 대조해 최신 현황을 반영했다.

4차: P2 3건·P3 3건을 받았다. 파일럿 신규 영어 인용0과 기존 expression 범위 기준선·sourceRange/해시를 구체화했다. 콘텐츠 기준 정본과 독립 세션을 명시했다. 새 public guard와 isolated 비노출/fallback 스펙의 CI 실행을 필수화했다. 보수적 전체 해시의 stale 집계/실패 조건, scope→facet 참고표, 비공개 입력 안내를 보강했다. ‘새 설명 자체를 검수자에게 숨김’ 제안은 그 설명의 정확성을 판정할 수 없어 미채택하고 작성자의 자기평가/합리화만 배제했다.

5차: P1 1건(격리 DB에 문항 라우트 데이터가 없어 새 필수 E2E가 notFound), 다른 확인 항목 결함 없음. C1에 문항/회차/분석/공개 fixture의 실제 스키마 조사, 신규 guarded isolated seed, CI 적재 단계, 원문/사용자 자료 제외, 루프백+소유 namespace 확인, 기존 권한 경로, 멱등·케이스 격리·skip0 증거를 추가했다. 공유 DB/스키마 변경은 별도 승인 범위다.

6차: P2 1건(held의 검수 보류와 접근 보류가 혼용). review_hold는 builder/Node guard에서 제외, access_withheld는 이미 pass인 sidecar의 실제 접근 gate/SSR/Flight 검사로 분리했다. 정상 접근 양성 대조→접근 제외 음성 대조로 실제 검수 자료가 대상임을 확인한다. 가짜 held 콘텐츠를 production JSON에 넣는 주입 경로는 만들지 않는다.

7차: P2 1건(새 namespace 가드의 실제 판정 표식 미정의). C1의 신규 CI 환경 변수, run ID 형식, 루프백 대상, gitignore 소유 manifest와 충돌 거부/멱등 계약을 명시했다. 이것을 현재 CI에 이미 있는 기능이라고 주장하지 않는다.

8차: P2 3건(소유 marker 경로 ignore 미등록, run 형식, 음성 가드 테스트 범위). marker를 실제 기존 ignore `.agent-logs/` 안으로 옮겨 Playwright 결과 정리와도 분리했다. run 형식은 앞서 보강한 명시 regex/64자 상한을 유지했다. namespace 값·run·소유 충돌·기존 ID·allowlist·대상/port의 실패에서 쓰기0 검사와 멱등/manifest 충돌 테스트를 모두 요구했다.

9차 최종 잔여 지적 확인: Claude가 C1의 marker/namespace/run/음성 가드와 8차 조치를 읽기 대조해 **NO_FINDINGS**를 반환했다. 이 마지막 확인은 해당 잔여 지적의 해소 범위이며 실제 화면/콘텐츠 의미/DB 실행 인증이 아니다. 앞선 전반 검토 결과와 수정은 위 회차별 기록을 따른다.

## 문서 정합성 검증

- 공개 JSON 읽기 계수 재현 결과와 corpus-audit.json deep equality 일치. 26유형·8대표·C0~C5·F01~F16 누락 없음.
- Markdown6개, 상대 링크10개, 기존 구현 경로27개 존재·코드 fence 정합성 확인.
- audit-corpus.mjs 실제 실행·Node syntax, git diff check 통과. agents 설정 검사15/15 통과.
- origin/main 대비 apps/packages/scripts/supabase 변경0. 앱 테스트·빌드는 설계 문서 검사의 통과 결과로 대체하지 않으며 이번 설계 작업에서는 실행하지 않았다.

## 미검증

- 인증된 정상 화면·실제 TTS·픽셀 측정: 이번 문서 작성에서 재실행하지 않음(CUA 연결 없음).
- DB 최신 자료·원본 도표 수치: 직접 확인하지 않음.
- 새 교수 콘텐츠 독립 검수: 시나리오는 작성 초안, Claude 파일럿 C1/C3에서 수행.
- 실사용자 사용성과 교육 효과: 미검증.
