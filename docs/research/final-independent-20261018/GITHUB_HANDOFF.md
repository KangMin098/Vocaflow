<!-- docs/research/final-independent-20261018/GITHUB_HANDOFF.md -->
# 최종 독립 검증 인계

2026-10-18 · Codex-VOCAFLOW-FINAL-ACCEPT. 사용자 후속 게시 명시 승인에 따라 아래 이슈와 증거 브랜치를 게시했다. **전체 제품 REWORK · 임무 진행 중**.

증거 브랜치: `review/final-independent-20261018`, SQL 재검증 증거 HEAD `5c6d57824`. 총괄 제품 브랜치 `feat/vocaflow-final-product`의 최신 관찰 HEAD는 `9bd249dd714e4ad3125b96f25f9fd245fbe25ea0`(제품 함수 검증 고정 HEAD는7e638e63d)이며 [PR303](https://github.com/KangMin098/Vocaflow/pull/303)은 OPEN이다. CI·safe-merge·실제 DB 적용 완료를 주장하지 않는다.

| 기존 ID | 이슈 | 수정/독립 재검증 상태 |
|---|---|---|
| FI-001 | [#293](https://github.com/KangMin098/Vocaflow/issues/293) | 후보에서 명시 납품/복구 개선 확인 · 전체 환류 수용 전 |
| FI-002 | [#294](https://github.com/KangMin098/Vocaflow/issues/294) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL 공급 차단 확인 |
| FI-003 | [#295](https://github.com/KangMin098/Vocaflow/issues/295) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL 양방향 정체성 확인 |
| FI-004 | [#296](https://github.com/KangMin098/Vocaflow/issues/296) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL assess 권리 별도 확인 |
| FI-005 | [#297](https://github.com/KangMin098/Vocaflow/issues/297) | FIX_VERIFIED_IN_CANDIDATE · 원래 모집단/측정 오기, 사람 내용 검수 별도 |
| FI-006 | [#298](https://github.com/KangMin098/Vocaflow/issues/298) | PARTIAL_FIX / OPEN · 같은 ref/같은 그룹 잔여 조합 |
| FI-007 | [#299](https://github.com/KangMin098/Vocaflow/issues/299) | FIX_VERIFIED_IN_CANDIDATE ·7e 서버 열기/충족/목록 확인 |
| FI-008 | [#300](https://github.com/KangMin098/Vocaflow/issues/300) | FIX_VERIFIED_IN_CANDIDATE · 두 폭 Runner/G2 재생 |
| FI-009 | [#301](https://github.com/KangMin098/Vocaflow/issues/301) | FIX_VERIFIED_IN_CANDIDATE ·4655 수정/두 폭 독립 대조 |
| FI-010 | [#302](https://github.com/KangMin098/Vocaflow/issues/302) | PARTIAL_FIX / OPEN · 정상 열기 기록 개선/기록 실패 후 가짜 첫 근거 |
| FI-011 | [#304](https://github.com/KangMin098/Vocaflow/issues/304) | PARTIAL_FIX / OPEN · 중심 의미 개선/확장3 Workspace 목록 제외 |
| FI-012 | [#305](https://github.com/KangMin098/Vocaflow/issues/305) | FIX_VERIFIED_IN_CANDIDATE · 대체 집합/불완전 대조/두 폭 UI |
| FI-013 | [#306](https://github.com/KangMin098/Vocaflow/issues/306) | FIX_VERIFIED_IN_CANDIDATE · 단수 ditch 제거 |
| FI-014 | [#307](https://github.com/KangMin098/Vocaflow/issues/307) | OPEN · 맞는 주어/본동사 이유 오답 |

각 이슈에 고정 대상 커밋, 재현 조건/관찰, 기대 동작, 원본 결과/화면 링크를 포함했다. 수정 HEAD/PR이 오면 같은 ID에서 정상 대조군과 반례를 독립 확인한다. 동일 이슈를 다시 만들지 않는다.

현재 공개 자료는 합성 fixture의 계약/무결성·교육·UX 검증이다. 비밀값·실제 학습자 데이터·권리 미확인 기출 원문을 포함하지 않는다. 실제 권한 침해를 가능하게 하는 민감한 취약점 재현은 이 공개 디렉터리에 넣지 않고 비공개 보안 경로로 전달한다. 실제 DB 쓰기/데이터 삭제/배포/권한 변경이나 PR 병합은 게시 승인에 포함하지 않는다.

[통합 A~H 현황](./ACCEPTANCE.md) · [전체 결함 원장](./FINDINGS.md) · [SQL 검토](./AUTHORED_SQL_REVIEW.md) · [콘텐츠 검토](./AUTHORED_CONTENT_REVIEW.md) · [종단/브라우저 검토](./AUTHORED_INTEGRATION_REVIEW.md).

후속: [PR303](https://github.com/KangMin098/Vocaflow/pull/303)이 제출됐다. 첫 c4b9f434e의 명시 납품/복구 낮은 층위26건은 통과했고 검토 중 de5065b51 형식 확장이 추가됐다. [HEAD별 독립 검토](./PR303_REVIEW.md)는 REWORK다. FI-011은 [#304](https://github.com/KangMin098/Vocaflow/issues/304)로 추가했으며 Workspace/다음 요구/전이량 환류 누락을 같은 ID로 추적한다. 기존 표의 OPEN은 수정 전 보고 또는 전체 수용 대기이며, FI-001의 확인된 부분 개선을 취소하는 뜻은 아니다.

후속 게시: FI-012는 [#305](https://github.com/KangMin098/Vocaflow/issues/305)로 추적한다. FI-009는 4655e9be4 수정과 두 폭 독립 화면 대조로 FIX_VERIFIED_IN_CANDIDATE이며 [형식 검토](./AUTHORED_FORMATS_REVIEW.md)에 연결했다. 새 이슈를 만들지 않는다. PR303은 22b5e43c5까지 확장됐고 전체 제품 REWORK를 유지한다.

FI-013은 [#306](https://github.com/KangMin098/Vocaflow/issues/306)에 게시했다(증거0813144bd). FI-012의 실제 inf-guided-1 사례는 기존 #305에 추가했다. FI-009 수정 확인 댓글은 #301 issuecomment-6248205960, PR303 후속은 issuecomment-6248206150이다. 공용 VFC DL-0158에도 상태를 전달했다. [CI 브라우저 독립 판독](./PR303_BROWSER_EVIDENCE.md)은6건 중 R5 두 폭2건을 구별한다.


최신 후속: 추가10 TASK/60문항 및 새4형식 검토를 d1a782394에 push했다. FI-014는 #307, PR303 인계 댓글은 issuecomment-6248394108, 공용 상태 DL-0159다. 동일3c15 CI39115796299 실패 원인은 Runner83 unused DEMAND_LABEL이며 수정 HEAD의 필수 체크 재확인이 필요하다. 실제 DB 쓰기/사람 승인/병합은 수행하지 않았다.

후속 SQL 재검증 게시: #294 issuecomment-6248673835, #295 issuecomment-6248674062, #296 issuecomment-6248674203, #298 issuecomment-6248674365, PR303 issuecomment-6248674507. 공동 인계 DL-0160. [실제7e SQL](./SQL_REPAIR_REVERIFY.md)과 [서버/RSC](./SERVER_REPAIR_REVERIFY.md)를 함께 보며 과거 HEAD의 미수정 판단을 최신에 그대로 적용하지 않는다. 전체 A~H REWORK는 유지한다.

## 지속 자동 승인 기준

2026-10-18 사용자 「방금 같은 승인은 자동 승인으로 기준 변경해」에 따라 이번 임무의 검증·관련 GitHub 이슈/PR 검토 게시·검증 브랜치 commit/push·Claude 총괄 인계를 추가 확인 없이 진행한다. 신규 결함과 수정 후 재검증에도 적용한다. 공동 원장 DL-0162와 로컬 목적 파일에 기록했다. 비밀값/실제 학습자 개인정보·응답/권리 미확인 기출 원문 제외, 민감한 보안 재현의 비공개 전달, 실제 DB 쓰기·삭제·배포·권한 변경·사람 Gold/권리 승인 제한, 기존 CI·safe-merge 조건은 유지한다. 시스템 차단을 우회하지 않는다.

7e 앱·환류 후속: FI-008 AuthoredRunner 재시도는 두 폭의 동일 의미 요청과 G2 duplicate/변경시각 conflict로 수정 확인, FI-012 대체 결정 근거도 실제 채점기/두 폭 UI에서 수정 확인했다. FI-005 원래 모집단/측정 오기와 FI-013 단수 ditch 대안은 후보 수정 확인이며 사람 내용/Gold 승인은 아니다. FI-011 중심 의미3반례는 개선됐지만 기존 추론·어법·문맥 어휘 Workspace가 적격 링크에도 목록에서 제외돼 PARTIAL_FIX / OPEN이다. [통합 후속 근거](./APP_REPAIR_REVERIFY.md).689 CI9형식 timeout은 trace의 trial 대기이며9bd 수정 후 새 run39120198955는 관찰 시 진행 중이다. 전체 A~H REWORK 유지.
