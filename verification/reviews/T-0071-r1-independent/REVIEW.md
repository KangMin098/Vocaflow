<!-- verification/reviews/T-0071-r1-independent/REVIEW.md -->
# T-0071 rev1 independent review

**HEAD `f573e31240eb6ea51f87cf090be46b35a86e9aeb` · REWORK.**

LOCAL_ONLY: 상세 범위 전환 재현은 로컬 협업 자료로만 전달한다. 공개 GitHub에 민감한 경계 재현을 게시하지 않았다. 실제 학습자 데이터나 개발 DB 쓰기는 사용하지 않았다.

8파일/1커밋의 변경과 제출 E01 로그 SHA `c85a6f465d5c644c8fbf105b7d1ca8fa8b212fc8a3fcb743f305b3fd645ca66c`를 확인했다. 관련 순수 함수/SSR12/12(skip0)를 독립 실행했다. 실제 Chromium+실제 React 패널을 사용한 GET 모의 상태 전환6개는 **2정상/4실패**다. 이는 인증 Next+DB 여정이나 실제1440/1280 디자인 수용이 아니다. 전체515파일·타입/lint는 작성자 증거이며 독립 전량 재실행하지 않았다.

## P1 T0071-P1-1 — 조회 결과의 납품 범위·현재 자격 갱신 누락

- 최초 실패 조건: 같은 TASK 패널을 열어 정상 노트를 읽은 뒤 부모가 `rows.current=false`, `listed=error`, 또는 다른 납품 id의 rows를 전달한다. 별도 반례는 상태 GET을 지연시킨 동안 납품 id를 바꾼 뒤 이전 응답을 돌려준다.
- 기대: 새 학습 링크는 최신 `current===true` 납품에만 열린다. 조회 오류는 확인 불가로 표시한다. viewer/납품 범위가 바뀌면 이전 범위의 노트·요청 결과가 새 범위에 남지 않는다. 허용된 같은 본인의 과거 노트는 철회 뒤에도 읽기만 가능하다.
- 실제: 철회 후 링크1개 유지, 납품 조회 오류 후 확인 불가 표시0/링크1개 유지, 납품 범위 변경·늦은 이전 응답에서도 이전 범위 노트가 그대로 표시된다. 실제 인증 계정 간 데이터 유출을 입증했다는 주장은 아니다. 인증 API/RLS는 변경되지 않았으며 이번 재현은 컴포넌트에 전달된 조회 범위가 바뀌는 조건이다.
- 원인: LearningNotesPanel은 불러올 때 `notesForTask(..., rows)`로 만든 groups/current를 state에 저장한다. 이후 rows/listed 변경은 state를 무효화하지 않는다. seq는 task 변경/새 load에서만 바뀌므로 캡처한 옛 rows에 대한 응답도 유효하다. viewer 입력/키도 없고 부모는 `key={task}`만 사용한다. TASK 자체가 바뀌는 대조는 remount 덕분에 정상이다.
- 최소 수정: 기존 viewer/TASK/납품 범위를 명시해 이전 상태·요청을 무효화하고 렌더의 링크 자격은 최신 납품 메타데이터로 확인한다. 현재 상태 변경과 현재 사용자 변경을 구별하고, 오류/미설치/미확인 범위에서는 이전 링크가 남지 않게 한다. 안정적인 범위 키 또는 generation을 사용해 parent의 매 렌더에 생기는 rows 배열 참조 때문에 무한 재조회하지 않는다. 기존 API/SQL/저장·동기화/판정 엔진을 바꿀 필요 없다. WorkspaceModal의 기존 viewer를 전달하거나 그 viewer를 포함한 부모 key로 분리하는 최소 방식 중 기존 코드에 맞는 쪽을 선택한다.
- 재검증: ① 최초 접힘은 GET0, 펼침은 GET1/PUT0 ② 정상 현재 납품은 링크 ③ 철회 후 같은 본인 노트는 읽되 링크0 ④ listed error/not_installed/loading은 이전 링크0·확인 불가 ⑤ 같은 TASK의 viewer/납품 교체 후 이전 노트0 ⑥ 이전 요청 지연 후 범위 변경에도 노트 혼입0 ⑦ TASK 변경 remount 정상 대조. 원본 runner는 실패 HEAD의 재현용이다. 수정 HEAD 검증에서는 새 정상 동작(오류/빈 상태 등)에 맞춰 완료 대기를 조정할 수 있으며 같은 selector를 억지로 유지할 필요 없다.

브라우저 실행기는 처음 JSX dev-runtime alias가 빠져 렌더하지 못했다. 테스트 harness alias만 보완한 뒤 위6개를 실제 실행했다. 그 초기 harness 오류는 제품 결함이나 통과로 계산하지 않았다. Vite 서버와 Chromium은 종료했다. 제품 소스·DB·타인 audit 파일은 수정하지 않았다.

같은 T0071/rev1로 이 P1만 수정해 재제출한다. 새 과제/PR/CI/worker는 필요 없다. 코드 수용 뒤 예정대로 T0070+T0071 한 공식 통합 묶음의 인증 브라우저·UI를 확인한다. T0070 E02 및 기존 코드 수용은 그대로 재사용한다.

```json
{
  "task_id":"T-0071",
  "design_revision":"rev1",
  "head":"f573e31240eb6ea51f87cf090be46b35a86e9aeb",
  "verdict":"REQUEST_CHANGES",
  "decision":"REWORK",
  "findings":[{"id":"T0071-P1-1","severity":"P1","scope":"in","claim":"이미 조회한 노트/학습 링크가 납품·사용자 범위와 현재 자격/조회 상태 변경에 무효화되지 않음","evidence":"browser-results.json: actual React+Chromium component protocol 2pass4fail; API responses and identity transitions synthetic"}],
  "ran_tests":true,
  "verification":{"unit_ssr":{"passed":12,"failed":0,"skipped":0},"component_chromium":{"passed":2,"failed":4,"authenticated_next_db":false,"full_visual_acceptance":false},"evidence_hash":"MATCH","authenticated_browser_A_B":"NOT_VERIFIED","db_writes":0,"product_changes_by_reviewer":0},
  "provenance":{"contract":"local-roles/1","task_id":"T-0071","head":"f573e31240eb6ea51f87cf090be46b35a86e9aeb","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
