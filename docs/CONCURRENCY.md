# CONCURRENCY — 잠금 · 상태 트랜잭션 · 신뢰 모델

## 1. 원자적 잠금 (lib/lock.mjs)

- **획득**: `fs.openSync(lock, 'wx')`. NTFS 에서 O_EXCL 생성은 원자적이라 동시 시도 중 정확히 하나만 성공한다.
- **내용**: `token`(무작위 16B = **세대**) · owner_id · session · purpose · pid(**에이전트 프로세스**) · host · acquired_at · heartbeat_at · ttl_ms.
- **판정**:
  | 상황 | 판정 |
  |---|---|
  | 같은 호스트 · pid 살아 있음 | live (heartbeat 가 오래돼도 suspect 일 뿐 stale 아님) |
  | 같은 호스트 · pid 죽음 · heartbeat ≤ TTL | suspect — 기다린다 |
  | 같은 호스트 · pid 죽음 · heartbeat > TTL | **stale** |
  | 다른 호스트 | heartbeat > 3×TTL 일 때만 stale |
  | 메타데이터 없음(생성 직후 죽음) | 파일 mtime > TTL 일 때만 stale |

### 세대 마커 — 확인 후 교체(TOCTOU) 경쟁 차단

잠금 파일을 **지우거나 바꾸는** 모든 동작(반납 · heartbeat · stale 회수 · 고아 정리)은 먼저 그 세대(token)의 **epoch 마커**
`<name>.gen-<token>.e<k>.marker` 를 `wx` 로 만든다. 마커를 쥔 쪽이 「잠금 파일이 아직 그 세대인가」를 확인하고 행동하는 사이에
다른 누구도 그 세대를 없앨 수 없고, 그 세대가 있는 한 경로가 점유돼 새 세대도 생길 수 없다.
→ 「A 가 stale 을 확인 → B 가 먼저 회수·재획득 → A 가 B 의 새 잠금을 이동」, 「옛 token 의 heartbeat/반납이 새 소유자의 잠금을 덮거나 지움」이 둘 다 불가능하다.

**epoch — 죽은 마커를 「치우지」 않는다 (WF-S5 · 2026-10-09)**: 마커를 쥔 채 프로세스가 죽으면 그 마커는 남는다. 이전 설계는 죽은 마커를
rename 으로 치웠는데, 전체 테스트 실행 중 **두 프로세스가 같은 죽은 마커를 치우는 사이 한쪽이 상대의 새 살아 있는 마커까지 치워
소유자가 둘이 되는 경쟁이 실제로 재현됐다**. 지금은 최고 epoch 마커가 죽었을 때(pid 죽음 + 10초) e<k+1> 을 `wx` 로 만든다 —
같은 epoch 는 하나만 생기고 살아 있는 최고 epoch 위로는 아무도 못 올라가므로, 남의 마커를 옮기거나 지우는 경로가 없다.
죽은 하위 epoch 는 그 세대가 끝난 뒤(잠금 파일이 다른 세대이거나 없음)에만 청소한다. 진행은 `lock.marker_epoch_advanced` 로 남는다.
회귀: 「잠금 잔여 위험 보강」(죽은 e0 + 6프로세스 동시 → 소유자 정확히 1 · 10회 반복 통과) · 「세대 마커」 · 「동시 회수 경쟁」.

- 기본 TTL 30분(`VFC_LOCK_TTL_MS`). 상태 뮤텍스는 5초(쥔 CLI 가 살아 있으면 만료되지 않는다).
- 다른 세션의 살아 있는 잠금을 해제하는 명령은 **없다**. `lock recover` 는 stale 만 처리한다.

## 2. 작업 시작 시 잡는 잠금 (순서 고정 → 교착 없음)

1. `task--<task_id>` — 같은 작업 중복 실행 차단
2. `worktree--<경로>` — 같은 worktree 동시 쓰기 차단. 경로는 실경로(junction 해소) · `/` · **Windows 는 전체 소문자**로 정규화(`D:/WORKSPACE/X` = `d:/workspace/x`)
3. `db--<target>` — `db_scope.mode=write` 일 때만
4. 제품 worktree 의 `.agent-lock` — 없으면 `wx` 로 만들어 `vfc_token` 을 넣는다(기존 `agents/scripts/lock.mjs` 도 이 worktree 가 쓰이는 중임을 안다). 같은 에이전트 pid 가 이미 쥐고 있으면 그대로 두고, **다른 pid 이거나 읽을 수 없으면 거부**한다. 반납 때는 vfc 가 만든 것(token 일치)만 지운다.

하나라도 실패하면 잡은 것을 되돌리고 거부한다. 모든 작업은 worktree 가 있어야 시작된다(`WORKTREE_REQUIRED`).
추가 검사: worktree 가 owner 에 묶여 있는가 · 현재 브랜치 = 작업 브랜치 · DB 쓰기면 사용자 승인(SQL sha256) + owner 의 `db_scopes`(대상별 소유자 하나).

## 3. 상태 트랜잭션 (lib/state.mjs)

```
상태 뮤텍스 → 남은 journal 재적용 → 5개 파일 읽기 → 변경
→ state/.journal.json 에 바뀐 파일 전체를 원자 기록  ← 커밋 지점
→ 각 파일 원자 교체(임시+fsync → 정상 본만 .bak → rename) → journal 삭제
→ 커밋 후 동작(잠금 반납·응답 보관 이동) → 뮤텍스 반납
```

| 죽는 지점 | 결과 |
|---|---|
| journal 기록 전 | 아무것도 안 바뀜(본 파일 옛 판) |
| journal 기록 후 · 파일 교체 중 | 다음 명령이 journal 을 재적용 → 5개 파일이 한꺼번에 새 판(부분 커밋 없음) |
| 커밋 후 · 잠금 반납 전 | 상태는 REVIEW 등으로 넘어갔고 잠금만 남음(vfc 잠금 + 제품 `.agent-lock`) → 다음 시작/reap 의 **고아 정리**가 vfc 잠금과, vfc 가 만든(`vfc_token`) 제품 잠금 중 「어떤 IN_PROGRESS 의 run 에도 없는 token」을 치운다. 작업 잠금 획득과 기록이 모두 같은 뮤텍스 안이므로 이 판정은 진행 중인 시작과 경쟁하지 않는다 |
| 시작 중 잠금 획득 후 · 커밋 전 | 같은 고아 정리 대상 |

본 파일이 깨지면 `.bak` 으로 읽고 `recovered_from_bak` 으로 보고한다. 다음 쓰기는 깨진 본을 `.corrupt-<시각>` 으로 격리하고 **정상 `.bak` 을 덮지 않는다**.
위험 작업 전후: `node bin/vfc.mjs checkpoint --label <이름>`.

## 4. 상태 기계와 판정 규칙

```
READY ──start──▶ IN_PROGRESS ──submit──▶ REVIEW ──complete──▶ COMPLETED
  ▲                │   │                    └──reject──▶ READY(다음 start = 새 run)
  └──unblock── BLOCKED ◀┘  └──fail──▶ FAILED
```

- start · submit · block · unblock · fail · evidence(실행 중) 은 **작업 owner** 만.
- complete · reject · evidence(REVIEW 중) 는 **등록된 다른 owner**(리뷰어)만. complete 는 리뷰 기록 파일(`--review`)이 실제로 있어야 하고, **이번 run** 의 증거가 모든 acceptance 번호를 `covers` 로 덮으며 전부 `pass · skip_count 0` 이어야 한다. 이전 run 의 증거는 세지 않는다.
- 증거의 artifact 는 실제 파일(공간 루트·작업 worktree·절대경로) 또는 URL 이어야 한다. `observed_at` 은 과거 ISO 시각.
- 목표 PASS·FAIL 은 `verification/` 아래 실제 증거 파일 + 사유가 있어야 한다. 보고서 경로만으로는 거부(`REPORTED_ONLY`).

## 5. 신뢰 모델

이 공간은 **로컬 신뢰 모델**이다. 하나의 Windows 계정을 Claude Code · Codex · 사람이 공유하므로 호출자 신원(`--by`·`--owner`)은 **선언**이다.
규칙은 선언을 기준으로 강제하고(owner 아닌 쪽의 전이·자기 완료·가짜 리뷰어 거부), 모든 전이를 `task.history` 와 `runtime/logs/events.jsonl` 에 남겨
사후에 드러나게 한다. 선언을 속이는 행위 자체는 막지 못한다 — 이를 막으려면 에이전트별 OS 계정 분리가 필요하다(STEP 5 후보).
사용자 승인(`task approve --by user`)도 같은 모델이다: 에이전트는 사용자가 그 대화에서 명시적으로 승인했을 때만 대신 기록하고, `--ref` 에 근거를 적는다.
