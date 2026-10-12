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

## 미검증

- 인증된 정상 화면·실제 TTS·픽셀 측정: 이번 문서 작성에서 재실행하지 않음(CUA 연결 없음).
- DB 최신 자료·원본 도표 수치: 직접 확인하지 않음.
- 새 교수 콘텐츠 독립 검수: 시나리오는 작성 초안, Claude 파일럿 C1/C3에서 수행.
- 실사용자 사용성과 교육 효과: 미검증.
