# ChatGPT — 전달 경로 (API 없음 · 사람이 옮긴다)

역할(정본 AI_WORKFLOW_REQUIREMENTS §1): 제품·교육·시스템 목표 정합성 검토, 우선순위, 이견 조정, 증거와 가설 분리.
ChatGPT 는 로컬 파일에 접근하지 못한다고 가정한다. OpenAI API · 비공식 브라우저 자동화는 쓰지 않는다.

## 흐름

1. 로컬 에이전트가 `vfc planning request …` 로 `planning/requests/REQ-YYYYMMDD-NNN.md` 를 만든다.
   - 머리의 `vfc-request` 블록: 요청 id · 정본 버전 · 관련 goal_id · 첨부 파일 sha256.
   - 끝의 `vfc-response` 템플릿: ChatGPT 가 채워야 할 형식.
2. 사용자가 요청 파일과 첨부를 ChatGPT 웹/Work 에 올린다.
3. ChatGPT 는 답변 끝에 `vfc-response` JSON 블록을 **정확히 하나** 넣는다.
4. 사용자가 답 전체를 `planning/responses/REQ-….response.md` 로 저장한다.
5. `vfc planning validate REQ-…` → `vfc planning import REQ-…`.

## 검증 규칙 (lib/planning.mjs)

- 요청이 존재해야 한다 · request_id 가 파일 이름과 같다 · canon_version 이 요청과 같다.
- verdict ∈ approve|revise|reject|needs_info · findings 의 severity P0~P3 · goal_ids 는 정본 id 만.
- proposed_decisions 는 `requires_user_approval: true` 여야 한다 — **ChatGPT 는 결정을 승인할 수 없다.**
- 가져온 내용은 DECISION_LOG 에 RECORDED(판정)·PROPOSED(제안)·OPEN_QUESTION(질문)으로만 들어간다. 같은 응답은 두 번 가져올 수 없다.

## STEP 4 에서 확인할 것

ChatGPT 의 GitHub 커넥터나 Work 의 파일 연결로 이 저장소(브랜치 `ai-control`)를 직접 읽을 수 있으면, 요청 파일 대신 경로·커밋 sha 를 넘기는 방식으로 바꿀 수 있다 — 실측 후 적용.
