# CHATGPT_CONNECTION — ChatGPT 연결 방식 실측 (WF-S4 · 2026-10-09)

OpenAI API · 로그인 쿠키 추출 · 비공식 브라우저 자동화는 쓰지 않는다. 아래는 이 PC와 공개 자료로 **확인한 것**과 **확인하지 못한 것**을 나눈 기록이다.

## 실측 사실

| 항목 | 결과 | 방법 |
|---|---|---|
| 저장소 공개 범위 | **PUBLIC** (`KangMin098/Vocaflow`) — `ai-control` 브랜치 정본은 누구나 URL 로 읽을 수 있다 | `gh repo view --json visibility` |
| 정본 원격 URL | `https://github.com/KangMin098/Vocaflow/tree/ai-control/goals` · raw: `https://raw.githubusercontent.com/KangMin098/Vocaflow/ai-control/goals/PROJECT_GOAL.md` | push 결과 |
| 이 PC 의 ChatGPT 데스크톱 앱 | **설치 안 됨** — OpenAI 앱은 `OpenAI.Codex 26.1002.7124.0` 만 | `Get-AppxPackage *ChatGPT*` · `*OpenAI*` |
| ChatGPT 로그인 세션 | 이 CLI 세션에는 없다(사용자 브라우저에만 있음) — 접근하지 않았다 | — |

## 방식별 판정

| | A. ChatGPT 웹(로그인) | B. ChatGPT Work | C. Windows 데스크톱 앱 파일 접근 |
|---|---|---|---|
| 정본 읽기 | **가능**: 파일 업로드 · 공개 저장소 URL(브라우징) · GitHub 연결(계정이 저장소를 연결한 경우, 요청 시 실시간 조회 · 읽기 전용). GitHub 연결의 **브랜치 지정은 공식 문서로 확인 못 함** | 웹: 브라우저 도구로 공개 URL · 연결(Apps). 데스크톱: 아래 C | 2026-07-09 통합 앱 릴리스 노트: 「On desktop, Work can use local files and desktop apps with your permission」 — **이 PC 미설치라 실측 불가** |
| 요청 파일 전달 | 사용자가 `planning/requests/REQ-….md` 를 업로드(또는 내용 붙여넣기) | 같음 | 권한 부여 시 로컬 파일 직접 참조(미실측) |
| 결과를 로컬에 저장 | **불가(자동)** — 사용자가 답을 `planning/responses/REQ-….response.md` 로 저장 | 웹: 산출물 다운로드 후 사용자가 이동 | 릴리스 노트가 로컬 **쓰기**를 언급하지 않음 — 미확인 |
| 사용자 수동 단계 | 업로드 1회 + 응답 저장 1회 | 같음 | 앱 설치 · 로그인 · 폴더 권한 부여(최초) · 저장 확인 |
| 인증·권한 경계 | ChatGPT 계정 로그인은 사용자만. GitHub 연결은 GitHub 앱 권한(선택 저장소)·플랜·워크스페이스 관리자 승인에 따름 | 같음 + Work 의 도구 권한 | 앱이 요청하는 파일·앱 접근 권한(사용자 승인) |

## 선택: A — Human-in-the-loop 파일 교환 (+ 공개 URL 교차 확인)

- 가장 적은 권한으로 재현 가능하고, 지금 이 PC 에서 동작이 보장되는 유일한 경로다.
- 요청서에 정본 **커밋 sha** 와 공개 raw URL 을 함께 적는다 → ChatGPT 가 첨부본과 원격본이 같은지 교차 확인할 수 있다(브랜치 지정 불확실성 회피).
- 응답은 `vfc planning validate/import` 가 구조를 검증하고 PROPOSED 로만 넣는다. **완전 무인 연동이 아니다.**
- C(데스크톱 Work 로컬 파일)는 설치·권한 부여 후 실측하면 「응답 저장」 단계를 줄일 수 있다 — 그 전까지 채택하지 않는다(WF-S5 후보).

## 출처

- [ChatGPT desktop app unifies Chat, Work and Codex — releases.sh (2026-07-09)](https://releases.sh/release/rel_GKfuaFZioeFajr6Ui2nnb-chatgpt-desktop-app-unifies-chat-work-and-codex)
- [Connecting GitHub to ChatGPT — OpenAI Help Center](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt) (본문은 403 으로 직접 열람 실패 — 검색 요약 기준)
- [ChatGPT's deep research gets a GitHub connector — TechCrunch](https://techcrunch.com/2025/05/08/chatgpts-deep-research-tool-gets-a-github-connector-to-answer-questions-about-code/embed/)
- [ChatGPT connectors (Dropbox·Drive 등) — heise](https://heise.de/-10426599)
