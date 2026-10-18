<!-- docs/research/final-independent-20261018/GITHUB_HANDOFF.md -->
# 최종 독립 검증 인계

2026-10-18 · Codex-VOCAFLOW-FINAL-ACCEPT. 사용자 후속 게시 명시 승인에 따라 아래 이슈와 증거 브랜치를 게시했다. **전체 제품 REWORK · 임무 진행 중**.

증거 브랜치: `review/final-independent-20261018`, 현재 주요 내용/화면 증거 HEAD `d1a782394`. 총괄 제품 브랜치 `feat/vocaflow-final-product`의 최신 검토 HEAD는 `3c15ba23c5c60d51fd035a00a5ec3eef2b442b5f`이며 [PR303](https://github.com/KangMin098/Vocaflow/pull/303)은 OPEN이다. CI·safe-merge·실제 DB 적용 완료를 주장하지 않는다.

| 기존 ID | 이슈 | 수정/독립 재검증 상태 |
|---|---|---|
| FI-001 | [#293](https://github.com/KangMin098/Vocaflow/issues/293) | 후보에서 명시 납품/복구 개선 확인 · 전체 환류 수용 전 |
| FI-002 | [#294](https://github.com/KangMin098/Vocaflow/issues/294) | OPEN · 등록 TASK/역할과 FQ/공급 결속 |
| FI-003 | [#295](https://github.com/KangMin098/Vocaflow/issues/295) | OPEN · 동일 본문의 그룹명 우회 |
| FI-004 | [#296](https://github.com/KangMin098/Vocaflow/issues/296) | OPEN · 권리 평가 범위 |
| FI-005 | [#297](https://github.com/KangMin098/Vocaflow/issues/297) | OPEN · 연구 모집단/측정 서술 |
| FI-006 | [#298](https://github.com/KangMin098/Vocaflow/issues/298) | OPEN · 같은 지문 동시 공급 |
| FI-007 | [#299](https://github.com/KangMin098/Vocaflow/issues/299) | OPEN · 사후 철회와 현재 공급 |
| FI-008 | [#300](https://github.com/KangMin098/Vocaflow/issues/300) | OPEN · 재시도 시각/원문 멱등 |
| FI-009 | [#301](https://github.com/KangMin098/Vocaflow/issues/301) | FIX_VERIFIED_IN_CANDIDATE ·4655 수정/두 폭 독립 대조 |
| FI-010 | [#302](https://github.com/KangMin098/Vocaflow/issues/302) | OPEN · 열람만 한 별도 노출 누락 |
| FI-011 | [#304](https://github.com/KangMin098/Vocaflow/issues/304) | OPEN · Workspace/다음 요구/전이량 환류 |
| FI-012 | [#305](https://github.com/KangMin098/Vocaflow/issues/305) | OPEN · 동등한 대체 결정 근거 오답 |
| FI-013 | [#306](https://github.com/KangMin098/Vocaflow/issues/306) | OPEN · 문법 전이 단수 선행사 대안 |
| FI-014 | [#307](https://github.com/KangMin098/Vocaflow/issues/307) | OPEN · 맞는 주어/본동사 이유 오답 |

각 이슈에 고정 대상 커밋, 재현 조건/관찰, 기대 동작, 원본 결과/화면 링크를 포함했다. 수정 HEAD/PR이 오면 같은 ID에서 정상 대조군과 반례를 독립 확인한다. 동일 이슈를 다시 만들지 않는다.

현재 공개 자료는 합성 fixture의 계약/무결성·교육·UX 검증이다. 비밀값·실제 학습자 데이터·권리 미확인 기출 원문을 포함하지 않는다. 실제 권한 침해를 가능하게 하는 민감한 취약점 재현은 이 공개 디렉터리에 넣지 않고 비공개 보안 경로로 전달한다. 실제 DB 쓰기/데이터 삭제/배포/권한 변경이나 PR 병합은 게시 승인에 포함하지 않는다.

[통합 A~H 현황](./ACCEPTANCE.md) · [전체 결함 원장](./FINDINGS.md) · [SQL 검토](./AUTHORED_SQL_REVIEW.md) · [콘텐츠 검토](./AUTHORED_CONTENT_REVIEW.md) · [종단/브라우저 검토](./AUTHORED_INTEGRATION_REVIEW.md).

후속: [PR303](https://github.com/KangMin098/Vocaflow/pull/303)이 제출됐다. 첫 c4b9f434e의 명시 납품/복구 낮은 층위26건은 통과했고 검토 중 de5065b51 형식 확장이 추가됐다. [HEAD별 독립 검토](./PR303_REVIEW.md)는 REWORK다. FI-011은 [#304](https://github.com/KangMin098/Vocaflow/issues/304)로 추가했으며 Workspace/다음 요구/전이량 환류 누락을 같은 ID로 추적한다. 기존 표의 OPEN은 수정 전 보고 또는 전체 수용 대기이며, FI-001의 확인된 부분 개선을 취소하는 뜻은 아니다.

후속 게시: FI-012는 [#305](https://github.com/KangMin098/Vocaflow/issues/305)로 추적한다. FI-009는 4655e9be4 수정과 두 폭 독립 화면 대조로 FIX_VERIFIED_IN_CANDIDATE이며 [형식 검토](./AUTHORED_FORMATS_REVIEW.md)에 연결했다. 새 이슈를 만들지 않는다. PR303은 22b5e43c5까지 확장됐고 전체 제품 REWORK를 유지한다.

FI-013은 [#306](https://github.com/KangMin098/Vocaflow/issues/306)에 게시했다(증거0813144bd). FI-012의 실제 inf-guided-1 사례는 기존 #305에 추가했다. FI-009 수정 확인 댓글은 #301 issuecomment-6248205960, PR303 후속은 issuecomment-6248206150이다. 공용 VFC DL-0158에도 상태를 전달했다. [CI 브라우저 독립 판독](./PR303_BROWSER_EVIDENCE.md)은6건 중 R5 두 폭2건을 구별한다.


최신 후속: 추가10 TASK/60문항 및 새4형식 검토를 d1a782394에 push했다. FI-014는 #307, PR303 인계 댓글은 issuecomment-6248394108, 공용 상태 DL-0159다. 동일3c15 CI39115796299 실패 원인은 Runner83 unused DEMAND_LABEL이며 수정 HEAD의 필수 체크 재확인이 필요하다. 실제 DB 쓰기/사람 승인/병합은 수행하지 않았다.
