# PR #279 V2 F1 — Codex-C 독립 수용

**ACCEPT_WITH_LIMITS.** F1의 「B 판단 전 정답 단서 노출 제거」를 수용한다. F2 평가 타당성, R1 첫 시도 시각 무결성, 콘텐츠 출시와 학습 효과는 수용 범위에 넣지 않는다.

- 제출 HEAD: `1b025f3fec45e8aed52c77e20f5172d7fc5cb6c4`
- 제품 검증 HEAD: `80181cb776d35e5d5397eb821ed820775bdebe3d`
- 추가 제품 수정: `51e3facf5`의 서버 관문 한 줄(F5). 신규 화면·phase·RPC·DB/RLS·콘텐츠 변경 없음.
- 검증 worktree: `D:/workspace/Vocaflow-v2-f1-review`. main 동기화 충돌은 CHANGELOG 한 곳이며 양쪽 기록을 보존했다.

## 필수 수용 조건

| 조건 | 독립 검증 결과 |
|---|---|
| 1. 제출 전 서버 props·HTML·DOM·React 상태·API에 D/정답 단서 없음 | 서버 전체 투영의 키/문자열 검사, 초기 정적 HTML, 실제 패널 DOM·React props/hook 검사 통과. 비공개 파일럿 12건의 수정 전 노출 12/12 → 현재 0/12. 실제 출시 V2의 RSC 왕복은 콘텐츠 0으로 BLOCKED_CONTENT이며 완료했다고 주장하지 않는다. |
| 2. B 오답 뒤 D 없음 | 파일럿 12/12, 서버 어댑터와 두 해상도 패널 응답/DOM/React 상태에서 비노출. |
| 3. 저장 성공 전 followUp 없음 | 지연 writer가 끝나기 전 서버 결과가 반환되지 않음. 패널 저장 대기 중 결과·D·React 단서 없음. |
| 4. 유실·중복·실패에서 허위 완료 없음 | 실제 task-meta로 같은 키·본문 재전송, 이중 클릭 1요청, HTTP 401/400/409/500 및 잘못된 200에서 결과 없음. inserted/duplicate 영수증 이후만 표시. |
| 5. D가 G2/V2 성공에 합산되지 않음 | 첫 sense 포함 제출 거절, writer 답은 B/C만, D 클릭의 네트워크 요청 증가 0. grade 정오는 B뿐. V2 확인 키 미연결 유지. |
| 6. B만 맞힌 수행의 주장 한계 | 성공 문구는 「맞지 않는 낱말을 찾음」. C 실패는 별도 표시. D는 기록 없는 연습. V2 숙달·의미 생성·전이·효과를 주장하지 않음. |
| 7. F5/F6 | R/X 표지 불일치 허용 P2를 최초 재현 후 수정. 현재 원문 R=circled/X=letter만 허용. sentence_logic/미분류 출시 거절. 실제 주석 의미 분류의 타당성을 검증한 것은 아님. |
| 8. 기존 경로 보존 | E 도구 15건 충돌 주입에도 보존. T1~T4, R5, Workspace, PLAN, 보안·복귀·학습·공급 회귀 통과. Factory/연구 PR 파일 수정 없음(main에 이미 병합된 I0를 동기화만 함). |
| 9. R1 미해결 유지 | 실제 DB 뷰가 answered_at/id 순으로 첫 행 선정. 과거 30일 파서와 백데이트 재시도 우선 선정을 읽기/순수 반례로 확인. DB 수정 안 함. |

## 검증 결과

| 층위 | 결과 |
|---|---|
| 제출본 집중 단위 | 30/0, skip 0 |
| 보완 후 서버 집중 단위 | 7/0, skip 0 |
| 광역 단위 | 216파일 2,615/0, skip 0 |
| 실제 React 패널, 1280×900 / 1440×900 | 50/0. 실제 task-meta, auth/storage I/O만 대역. Tailwind+토큰의 44px 실측·키보드·가로 넘침 검사 포함. 서버 응답은 합성 fixture. |
| 실제 앱 14묶음 | 214/0, 전 묶음 sourceStable=true·계정 정리 확인. V2 차단 12, T4 28, T1 9, T2 52, T3 40, 보안 18, Workspace 36, 복귀 7, 학습 6, 공급 6. |
| 타입·lint·목적 | 표준 web typecheck exit 0(앱+scripts), 대상 lint 0, review.mjs NO_FINDINGS |
| DB 읽기 | 활성 V2 적용 0, V2 원장 0, R1 클라이언트 시각 정렬 유지 |
| 제품 HEAD CI | build/verify/e2e/TypeScript 및 faultclosed 포함 통과. 영수증은 PRODUCT-CI.json. 증거 문서 커밋 뒤 최신 HEAD CI는 병합 직전 다시 확인한다. |

패널 캡처는 `7991da63a`의 dirty 상태에서 얻었다. 렌더한 패널·task-meta·labels·tokens는 제출 HEAD부터 제품 검증 HEAD까지 변경이 없음을 대조했다. 캡처를 clean HEAD 실행으로 바꾸어 적지 않았다. 실제 앱 214조건은 별도의 고정 제품 HEAD에서 실행했다.

## 증거와 잔여 범위

- [최초 실패/수정/제외 실행](./FINDINGS.md), [최초 F5 실패 원본](./INITIAL-MARKER-FAILURE.json)
- [종합 영수증](./EVIDENCE.json), [14묶음 실행](./BROWSER.json), [제품 해시](./SOURCE-HASHES.json), [패널 50조건](./PANEL.json)
- [파일럿·E축·R1 탐침](./PROBE.json): 비공개 입력의 내용은 쓰지 않고 SHA256만 보존. [DB 읽기](./DB-READONLY.json)
- [제품 목적 검토](./PURPOSE-REVIEW.log), [제품 CI](./PRODUCT-CI.json), [화면 증거](./screens/)

F2는 PR의 [후속 명세](../../csat-learner/v62/V2_F2_FOLLOWUP_SPEC.md)대로 미해결이다. B 성공은 해당 문항의 판별 조건 성공이다. R1도 미해결이며 F1 수용으로 독립 평가 무결성 전체가 해결됐다고 하지 않는다. 실제 출시 V2 수행→원장→지도는 BLOCKED_CONTENT다. 출시 주석·knowledge_applications·PR #278의 초안과 주석을 변경하지 않았다.

병합은 [PR #279](https://github.com/KangMin098/Vocaflow/pull/279)의 최종 HEAD에 필수 CI와 목적 검토가 통과한 뒤 `safe-merge.mjs`로만 한다. 최종 HEAD·CI·병합 SHA는 PR의 체크/병합 영수증과 세션 최종 보고에서 확인한다.
