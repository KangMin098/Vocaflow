# ChatGPT Work 이벤트 연결 PoC (WF-S8) — 2026-10-09

판정(현재): **미판정 — 사용자 설정 대기.** 실측된 Work 자동 실행 0회. `EVENT_DRIVEN_WORK_BRIDGE` 아님.
현재 운영 경로는 검증된 반자동(HUMAN_IN_THE_LOOP: 사람이 요청 파일을 ChatGPT 에 올리고 응답을 저장 → `vfc ugoal intake`)을 그대로 쓴다.

## 공식 문서로 확인된 것

| 항목 | 내용 | 근거 |
|---|---|---|
| GitHub 트리거 | 저장소의 **PR 활동**. 필터: PR·작성자·제목·라벨. 리뷰·댓글·커밋 갱신·머지만 고를 수 있다 | learn.chatgpt.com/docs/automations |
| 다른 트리거 | Gmail(새 메일, 보낸이·제목 필터) · Slack(채널 새 메시지) | 같은 문서 |
| 실행 위치 | **ChatGPT 웹·모바일만**. 데스크톱 앱·Codex CLI·IDE 확장 불가 | 같은 문서 |
| 결과 위치 | **Scheduled** 화면(대기 이벤트 검토·결과 확인). 외부로 쓰는지는 문서에 없음 | 같은 문서 |
| 묶음 실행 | 가까이 온 이벤트는 한 실행으로 합칠 수 있다 | 같은 문서 |
| 권한 | 연결 앱이 저장소 접근 권한을 가져야 · 플랜·워크스페이스 설정에 따름 · 관리형은 관리자 권한 | 같은 문서 · help.openai.com 「Connecting GitHub to ChatGPT」(검색 요약, 본문은 403 으로 직접 확인 못 함) |

## 문서로 확인되지 않은 것(실측 대상)

- **Work 가 GitHub 에 쓸 수 있는가**(PR 댓글·파일 커밋). 2차 자료끼리 엇갈린다: GitHub 커넥터는 읽기 전용이고 쓰기는 Codex 라는 글 · 쓰기가 403 으로 거절된 사용자 보고 · Enterprise 에서 쓰기가 되던 권한 결함 보고. → **실측 전에는 UNSUPPORTED 로 가정**한다.
- 쓰기가 된다면 매번 사람 확인이 필요한가.
- 같은 PR 에 이벤트가 여러 번 오면 몇 번 실행되는가(묶음 실행 규칙).

## 이 저장소에서 실측한 것

- `KangMin098/Vocaflow` 의 이슈·PR 댓글 작성자는 사용자 본인뿐 — ChatGPT/Codex GitHub 앱의 활동 흔적 없음(2026-10-09 `gh api`).
- 사용자 토큰으로는 설치된 GitHub 앱 목록을 볼 수 없다(403) — 설치 여부는 사용자가 GitHub 설정에서 확인해야 한다.

## 준비한 것 (PoC, 본체 미통합)

`poc/work-bridge.mjs`
- `publish <REQ> --repo owner/exchange` — thread 요청서를 교환 저장소 브랜치 `vfc/<REQ>` 에 올리고 라벨 `vfc-request` PR 을 연다(= Work 트리거). 요청서 안에 goal_ref·thread_id·round_id·design_version·base_commit 이 들어 있다.
- `collect --repo owner/exchange [--authors …]` — 그 PR 의 댓글·`responses/<REQ>.response.md` 에서 `vfc-response` 블록 하나를 찾아 `planning/responses/` 에 원자적으로(.part→rename) 쓴다. 판정은 기존 `vfc ugoal intake`(thread·목표·라운드·버전·중복·승인 경계)가 한다 — 새 판정 로직 없음.
- dry-run 확인 완료. 실제 GitHub 쓰기는 아직 0회(교환 저장소가 없다).

## 교환 프로토콜 vfc-bridge/1 (WF-S10 확정)

| 단계 | 누가 | 무엇 | 검증 |
|---|---|---|---|
| 요청 | AI-Control | `vfc ugoal request-design` — thread 요청서(goal_ref·thread_id·round_id·design_version·base_commit·context_base_commit) + Context Packet | 같은 목표에 대기 중 요청이 있으면 새 요청 거부 · 재질의 예산 |
| 게시 | `work-bridge publish` | 브랜치 `vfc/<REQ>` · `requests/<REQ>.md` · `requests/<REQ>.context/*`(패킷만 — 다른 로컬 파일 금지) · 라벨 `vfc-request` PR | 같은 요청 재게시 거부(bridge-log) |
| 실행 | **Work(미실측)** | PR 이벤트로 시작 → 요청서·패킷 읽기 → `vfc-response` 블록 하나를 PR 댓글로 | 미실측 |
| 수집 | `work-bridge collect` | PR 댓글·`responses/<REQ>.response.md` 에서 블록 하나 → `planning/responses/`(.part→rename) | 요청 id 일치 · 작성자 제한(--authors) · 중복 수집 차단 |
| 인수 | `vfc ugoal intake` | 기존 판정 그대로 | schema·thread·목표·라운드·설계 버전·중복·승인 경계 |
| 재개 | 사용자 승인 → `vfc ugoal approve` | 설계 쟁점으로 멈춘 작업 자동 READY → 오케스트레이터 | 승인은 사용자만 |

턴 시간: `node poc/work-bridge.mjs status` — published · Work 댓글 시각 · collected → Work 대기·수집 지연. 구현·리뷰 시간은 `vfc perf report`.

### 저장소 없이 검증한 것 (가짜 gh + 모의 Work 응답 · tests/bridge.test.mjs — 실제 Work 근거 아님)

게시(요청서+패킷, 패킷 밖 파일 미업로드) · 재게시 거부 · 수집→인수→설계 v · 중복 수집 차단 · 목표 A/B 교차 응답 거부(인수 단계) · 요청 id 불일치 거부(수집 단계) · 다른 설계 버전 응답 거부 · 두 턴 연속(설계 → 승인 → 구현 중 설계 충돌 → 재질의 게시 → 응답 → v2 승인 → 자동 재개 → 완료).

### 승인 뒤 실측 계획(실험 A~D)

| 실험 | 기록 | 성공 조건 |
|---|---|---|
| A 게시 → Work 자동 실행 | publish 시각 · Work Scheduled 의 실행 시각(사람이 화면에서 확인해 bridge-log 에 남김) | 사람 조작 없이 실행 1회 |
| B Work 응답 게시 → 자동 인수 | 댓글 작성자·시각 · collect · intake 결과 | 사람이 옮기지 않은 댓글이 intake applied |
| C 같은 목표 두 차례 | 위 A·B 두 번 + 승인 2회(사람) | 두 라운드 모두 B 충족 |
| D 목표 둘 | 두 요청 동시 게시 | 각 응답이 자기 목표에만 적용 |

B 가 안 되면(Work 가 GitHub 에 쓰지 못함) 판정은 「이벤트 자동 시작 · 응답 수동」 — 완전 자동 아님.

## 사용자가 해야 할 것 (Work UI · GitHub)

1. **교환 저장소 생성 승인** — 비공개 `KangMin098/vocaflow-exchange`(코드 없음 · 요청·응답 파일만). 만들기는 외부 작업이라 확인 후에 한다.
2. ChatGPT 웹 → 설정 → 앱(Connectors) → GitHub 연결 → 저장소 접근에 `vocaflow-exchange` **만** 허용.
3. ChatGPT 웹에서 이벤트 작업 만들기(문장 예):
   「GitHub 저장소 KangMin098/vocaflow-exchange 에서 라벨 vfc-request 인 PR 이 열리면 실행해. PR 의 requests/ 아래 .md 파일을 읽고 그 파일의 '응답 규칙'대로 ```json vfc-response``` 블록 하나를 만들어 그 PR 에 댓글로 남겨. 다른 저장소·파일은 건드리지 마.」
4. 관리형 워크스페이스라면 관리자에게 「Allow event-triggered scheduled tasks」 허용 요청.
5. 설정 뒤 알려주면 아래 실험을 돈다.

## 실험 계획과 판정 칸

| 실험 | 절차 | 판정 |
|---|---|---|
| A 요청 → 이벤트 → Work 자동 실행 | `ugoal request-design` → `publish` → Scheduled 에 실행이 생기는지(사람 개입 없이) | 미실시 |
| B Work 응답 게시 → 자동 인수 | Work 가 PR 댓글을 남기면 `collect` → `ugoal intake` 적용 | 미실시(쓰기 미확인 — UNSUPPORTED 가능) |
| C 설계 충돌 → 두 번째 요청 → v2 | Claude `design_issue` → 재질의 publish → 응답 → v2 PROPOSED | 미실시 |
| D 목표 A·B 교차 | 두 목표 요청을 동시에 publish → 응답이 각 목표에만 적용 | 미실시(로컬 격리는 WF-S7 테스트 G 로 검증됨 — Work 실측 아님) |
| E 지연·실패·승인 필요 | 응답 없음/거절 상태에서 다른 독립 작업 진행 | 미실시(로컬 동작은 WF-S7 테스트 F 로 검증됨) |

성공 기준(전부 실측 필요): Work 실제 이벤트 자동 실행 · 실제 응답 게시 · 자동 인수 · 설계 보완 2회 연속 왕복 · 두 목표 응답 격리 · 승인 경계 · 중복 방지 · 오류 뒤 복구.

## 대안 경로(B 가 UNSUPPORTED 일 때)

1. **트리거만 자동, 응답은 사람이 복사** — A 만 되면: 사람은 Scheduled 결과를 열어 `planning/responses/` 에 저장만. 지금 경로보다 한 단계(요청 올리기)가 줄어든다.
2. **Gmail** — 트리거(새 메일)는 공식 지원. 응답 메일 발송이 되는지는 문서에 없다 → 같은 방식으로 실측 필요. 메일 수신 → 로컬 인수 경로는 별도 구현이 필요해 B 가 막혔을 때만 검토.
3. **Windows 데스크톱 Work** — 문서상 이벤트 작업을 지원하지 않는다(데스크톱 앱 제외) → 이벤트 경로로는 쓸 수 없다. 로컬 파일 접근은 별도 확인 대상.

어느 경우에도 쿠키·브라우저 매크로·OpenAI API 는 쓰지 않는다. 미지원이면 전체를 재설계하지 않고 현재 반자동 경로를 유지한다.

## 출처

- https://learn.chatgpt.com/docs/automations
- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt (본문 직접 조회는 403 — 검색 요약만)
- 2차: https://www.usecarly.com/blog/chatgpt-github-integration/ · https://github.com/Jhg12345Git/project-partners/issues/2 · https://www.tego.ai/blog/chatgpt-enterprise-said-read-only-but-it-could-delete-your-files-and-push-to-your-repos · https://github.com/amitkarpe/agent-os/issues/20
