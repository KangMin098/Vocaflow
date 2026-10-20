# 개발환경 권한·승인 정책 감사 — 2026-10-20

사용자 목표는 저위험 개발을 기획→구현→검증→개선→Git→CI→범위 검증 후 안전 병합까지 재승인 없이 완결하는 것이다. 운영 DB가 없다는 사용자 설명을 적용하며 개발 DB도 데이터 삭제·파괴적 변경의 보호 대상이다. 아래 구현/준비/실제 실행을 구분한다.

## 1. 기존 제약과 필요성

| 계층 | 실측 | 판단 |
|---|---|---|
| 현재 실행 세션 | workspace-write, 승인 never, CLI 네트워크 제한, MCP 쓰기는 승인 필요/never로 거절 | 관리형 실행 제약. 프로젝트 파일 변경으로 해제할 수 없음 |
| 전역 Codex | Windows sandbox elevated. 출력한 허용 키에서 승인/네트워크 강제값 없음 | elevated는 관리자 권한으로 작업한다는 뜻이 아님. 그대로 유지 |
| 프로젝트 Codex | approval_policy=on-request, workspace-write, network_access=false | 향후 정상 개발 CLI/IDE 세션의 네트워크 차단을 true로 변경한 브랜치 준비 |
| managed/requirements 파일 | 확인한 사용자/ProgramData 경로에 없음 | 관리형 제한이 없다는 증거는 아님. 현재 주입 정책이 존재함 |
| VS Code | Codex 확장26.1007.21434. 설정에서 별도 CLI/WSL/승인 덮어쓰기 발견 안 됨 | 실행한 클라이언트와 관리형 채팅을 혼동하지 않음 |
| AI-Control | 모드 LOCAL_FAST, runCodex의 명시적 approval_policy=never | 비대화형 배치에 never는 유효. 권한 부족을 승인 요청으로 해결할 수 없으므로 실행 전 능력 점검 필요 |
| Claude 구현 워커 | 허용 명령/DB sentinel, git push 명시적 금지 | 구현 격리는 유지. 검증 후 Git/PR 전달은 호스트 역할에서 처리 |
| 공유 Git | 원본 metadata가 workspace 밖. 잠금 파일 없음에도 index.lock 생성 거절 | 다른 셸/도구로 우회하지 않음. 허용된 루트의 독립 저장소에서 실제 커밋 검증 |
| GitHub CLI | api 호출이 소켓 권한에서 실패, HTTP401 아님 | CLI 인증은 UNKNOWN. 네트워크 실패를 토큰 무효로 판정하지 않음 |
| GitHub 연결 도구 | 계정 읽기/PR/CI 조회 성공, 쓰기는 승인 정책으로 거절 | 연결 도구의 인증 성공은 CLI 인증/쓰기 능력의 증거가 아님 |

## 2. 완화한 프로젝트 제약

- 정책v1.2는 기획·설계·코드·UI·테스트·평가·개선·문서·commit/push/PR/CI·범위/검증 게이트 후 병합을 상시 승인 범위로 명시한다. 이미 승인된 작업의 소규모 단계에서 재확인하지 않는다.
- 향후 프로젝트 Codex workspace 실행의 network_access=true를 준비했다. 관리형 현재 세션과 전역 설정에 적용됐다고 주장하지 않는다. MCP 생성 영역과 기존 훅/작업 경계는 유지한다.
- 중앙 LOCAL_FAST는 공식 원격 통합(kind=official)을 이미 허용한다. 기존 로컬 개발/검증과 공식 납품 경로를 재사용하고 이 저장소의 원격 납품 단계에 VFC_DEV_MODE=GITHUB를 명시한다. 중앙 기본값 변경 없이 저위험 납품을 상시 승인하며 로컬 통합/백업 계약을 유지한다.

## 3. 유지한 통제

- 데이터 삭제·파괴적/비가역 DB 변경·중대한 보안/인증정보 변경은 승인 대상이다. 기존 DB 배포 러너/티켓/적용 이력 검증은 이 작업에서 완화하지 않았다. 비파괴 마이그레이션의 자동 적용을 새로 구현·입증한 것은 아니다.
- main 직접 push, force, no-verify, 공유 변경 초기화, 비밀값 출력, 샌드박스/OS 제한 우회는 금지다. 워커 DB sentinel과 역할 분리를 유지한다.
- PR_SCOPE_GUARD는 기존8필수 체크와 DB/브랜치 보호를 대체하지 않는다. 범위 계약이 없으면 Git/gh 접근 전에 종료한다. 정확한 경로/HEAD/base/커밋 수와 병합 직전 결속을 검사한다.

## 4. 설정·코드 변경

| 위치 | 상태 |
|---|---|
| .codex/config.toml | 새 정책 브랜치에서 개발 네트워크 true. 기존 on-request/workspace-write 유지 |
| 정책 JSON·AGENTS·router·WORKTREE·DECISIONS | 개발 자동화/중대 보안 승인/범위 계약 정합화 |
| safe-merge.mjs·pr-scope.mjs | --scope-file 필수, 실제 PR 전체 경로·커밋 수·SHA 대조, 병합 직전 재조회 |
| 중앙 config/dev-mode.json | LOCAL_FAST 유지. 기존 official 통합 경로를 확인했으므로 전역 모드 변경은 불필요 |
| 전역/VS Code/관리형 정책 | 읽기 점검만. 활성 권한은 변경하지 않음 |

범위 계약은 다음 형식이다. 예시 SHA는 형식 설명이며 실제 작업의 확인된 SHA로 생성한다.

```json
{"version":1,"head_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","base_ref":"main","base_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","expected_commits":1,"expected_paths":["AGENTS.md"]}
```

## 5. LOCAL_FAST 독립 납품

- 원본 디자인 브랜치/미커밋111파일 보존. 독립 ci/local-fast-only의 커밋165b20666d380d041f341426032d7131d59eb661은 공개 main fcb40034d43ccfbf1a429c76de97ed840d0bac5d 위 추가커밋1개·설정15파일이다.
- 독립 저장소에서 회귀162/162, 설정15/15, 훅을 유지한 commit --only, 정확한 경로·내용·부모/커밋 수·깨끗한 작업 트리를 실제 검증했다. bundle 검증도 통과했다.
- push는 github.com:443 연결 실패. PR #318 Draft 요청은 MCP 승인 필요/never로 거절. 새 PR/새 CI/병합은 미완료다.
- 기존 #318은24커밋160파일이며 필수8CI가 통과했어도 이15파일의 납품으로 병합하지 않는다. 현재 일반 PR 상태를 Draft로 차단했다고 주장하지 않는다.

## 6. 실행·재발 방지 검증

| 항목 | 현재 증거 |
|---|---|
| 독립 Git metadata/commit | PASS, 실제165b206 생성 |
| 원본 디자인 보존 | PASS, 원본HEAD/누적 패치 역적용 확인 |
| CLI push/PR 상태 변경 | BLOCKED, 네트워크/MCP 정책을 각각 구분 |
| 기존 원격 CI 조회 | PASS, #318 HEAD에 필수8개 success |
| 새 PR CI/실패 수정·재실행/병합 | NOT RUN. 기존/로컬 통과로 대체하지 않음 |
| 새 범위 가드 | 전체 에이전트169/169·실패/skip0, 설정15/15 통과. 실제 #318의 원격24커밋160경로를 가져와 계약 불일치로 거부함. 경로 교체·SHA 이동·계약 부재 회귀 포함. 새 원격 병합 E2E는 미실행 |
| AI-Control 재실행 | 실제 워커를 기동하지 않음. 현재 관리형 권한은 여전히 제한돼 있어 재발 해결을 입증하지 못함 |

기존 읽기 전용 execution-status 진단은 정상 실행했다. 실제 active run은0이며 이 작업에 결속된 중앙 task는 없었다. 플랫폼 실행 경로는 goal-orchestrator이고 standalone owner-worker는 legacy owner_session 호환용이라는 기존 진단 결과를 재사용했다. 파일 인계가 인터랙티브 세션을 자동 기동한다는 가정으로 실행 성공을 표시하지 않는다.

## 7. 강제 제한과 정상 적용 경로

네트워크/쓰기 권한을 실제로 허용한 호스트에서 기존 finish-local-fast-only.sh를 실행한다. 이 세션의 자식 Bash나 다른 API를 이용해 현재 제한을 우회하지 않는다. 중앙 goal-orchestrator와 기존 공식 납품 경로를 재사용하며 전역 모드/worker 권한을 일괄 완화하는 새 시스템은 만들지 않는다. 관리형 현재 채팅은 로컬 Codex config 수정/재시작만으로 고쳐진다고 가정하지 않는다.

OpenAI는 [명령 권한과 별도 MCP/연결 도구 권한](https://learn.chatgpt.com/docs/permissions), [관리형 설정의 우선순위](https://learn.chatgpt.com/docs/enterprise/managed-configuration), [관리형 채팅과 로컬 Codex 설정의 차이](https://learn.chatgpt.com/docs/developer-settings)를 각각 설명한다. 파일/네트워크 허용과 승인 정책을 분리해 적용하며 포괄적 full-access나 보호 정책 약화를 기본값으로 삼지 않는다.

## 8. 개발 속도 영향

일반 개발의 재승인 요구를 줄이고 동일한 Git 실패를 반복하는 대신 능력/원인을 구분한다. 범위 계약은 CI 성공 뒤 잘못된 큰 PR을 병합해 복구하는 일을 방지한다. 새 worktree/워커를 상시 추가하지 않고 기존 독립 저장소의 별도 브랜치를 재사용했다. 시간/CI 비용 절감량은 측정하지 않았으므로 수치로 주장하지 않는다. 원격/중앙 실행 E2E 미완료가 남아 있어 플랫폼 자동 완결 목표 전체는 미달이다.
