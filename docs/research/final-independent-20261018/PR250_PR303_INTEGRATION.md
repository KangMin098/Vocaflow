<!-- docs/research/final-independent-20261018/PR250_PR303_INTEGRATION.md -->
# 관련 두 PR 통합의 독립 검증

FI-017 · 핵심 P2 · [#310](https://github.com/KangMin098/Vocaflow/issues/310) · **REWORK**.

main c3a03d168을 기준으로 PR250 HEAD `4fdc7ba76ac5f50493da668b85c1735e09a208ff`와 PR303 HEAD `9647b45e1db1f719b8f778c22cbefa7e742fc689`를 가상 병합했다. `git merge-tree --write-tree --messages --name-only <303HEAD> <250HEAD>`는 충돌 없이 트리 `b390ffd21ab3c1fd1e13790b9641531e83d1c6b6`을 만들었다. 제품 브랜치·인덱스·개발 DB는 변경하지 않았다.

가상 트리의 실제 웹 소스·시험 보조 모듈·설치된 의존성과 표준 Next ambient 선언으로 전체 웹 tsc를 실행했다. 최종 원본 실행은 MeaningSupportPanel.tsx12/22의 useState 중복 식별자 TS2300 두 건으로 exit2다. Git 자동 병합 성공과 개별 HEAD의 CI 성공을 통합 소스 호환으로 대신할 수 없다.

| 고정 스냅샷 | 웹 타입 검사 | 범위 |
|---|---|---|
|두 HEAD의 실제 병합 트리|exit2 · TS2300 두 건|[원본 로그](./composed-original-typecheck.log)|
|중복 단독 import 한 줄만 제거한 격리 후보|exit0|[후보 로그](./composed-candidate-typecheck.log). 기존 useEffect/useState import와 모든 기능 본문 유지|

[소스 해시·실행 메타데이터](./pr250-pr303-integration.json). 초기 스냅샷에는 Next 선언/스크립트·시험 보조 파일이 부족했다. 보완 전의 모듈 누락 오류를 제품 결함으로 세지 않았으며, 위 원본2오류는 보완 후 결과다. 후보 확인 뒤 스냅샷 원본을 복원했고 제품 파일은 수정하지 않았다.

기대: 총괄이 두 기능을 합친 최종 HEAD에서 중복 import를 해소하고 타입/필수 CI를 다시 확인해야 한다. 한 기능을 제거하지 않는다. 독립 후보의 exit0는 총괄 제품 브랜치의 수정 확인·새 CI·전체 브라우저 흐름 수용이 아니다.

별도 FI-018([#311](https://github.com/KangMin098/Vocaflow/issues/311))은 병합 안전 게이트의 변경 범위 검증 문제로 비공개 인계했다. 상세 위치/재현/수정은 공동 원장 DL-0168의 로컬 비공개 보고서로만 전달한다. 실제 safe-merge dry-run은 수행했지만 병합하지 않았다. 이 코드 게이트와 미해결 기능·교육·외부 승인 조건을 함께 만족하기 전 전체 수용하지 않는다.
