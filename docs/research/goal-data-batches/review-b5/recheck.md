# T-0104 b5-v22 보완 독립 재검증

입력: e81b759f1b4fce33b4d4327b7820a70d55b3e4e7 (기준 7ad98fda08f3739a14bcff1c41273968f7fe2fa6). owner goal-data-independent / session t-0104-codex. 첫 task show에서 IN_PROGRESS·세션 일치 확인. PID/프로세스 조회 없음. 입력 worktree 쓰기·DB 접근 없음.

**판정: 검증 수행 완료. 기존 보완은 대부분 재현되며 primary-null의 엄밀한 배열 조건은 미해결, E3/V4 및 과거 제외 원천 상태는 unclear 유지. 새 P0/P1 없음.**

전체 git diff를 ignored *.local.json에 보존하고 10파일을 읽음. 큰 결합 JSONL은 모든 행/모든 필드의 before/after를 전량 비교함. 변화는 contract 라벨 101개(v2.1→v2.2), refuted_rationale 2개 및 coverage 생성시각뿐. 계약/코드는 git show @e81b759f1로 고정. local 패킷은 읽기 전용. D2 validate·D3 passed 및 combine/export를 메모리에서 실행; 파일 쓰기와 fetch는 메모리 대체. source 코드 검증 로직은 변경하지 않음. safe.directory는 이 읽기 명령에만 -c로 지정하며 전역 설정/원본 worktree 쓰기 없음.

## 수용 기준

### 0. resolved

반박 2건은 정확한 트랙의 refuted_rationale로 결합본에 표시되고 DISPUTED/R0·unknown·candidateRelevance=null 유지. 다른 트랙 승격 없음. 결합기 메모리 재실행 결과 두 JSONL은 커밋과 바이트 단위 일치. R1 511·갈림 328 및 b5 210/228·κ .8594761171 불변.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b5-v22-corrections.json:5 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-combine.mjs:40 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/disputed-links.jsonl:311 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b5-v22-agreement.json:35 (@e81b759f1)

### 1. unresolved

기존 반례(v2.1, 유효 nonempty secondary) 차단 및 v2.2/v2.3 정상 null 허용은 해결. direct 존재·부분 집합 없음도 차단. 그러나 secondary_tasks 누락/null은 []로 간주되어 D2·D3 양쪽에서 통과한다. 계약의 명시 secondary_tasks=[]를 엄밀히 보장하지 못한다(P2-01). b2–b5 D2·D3 A/B 각각 40·8·40·38 통과, 현재 패킷 회귀 결함 0.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:96 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:36 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_2.md:9 (@e81b759f1)

### 2. unclear

§1은 청크 내부 primary와 문항 실제 주 수행을 구분해 §1/§4 운용 의미를 해소. §4는 R3 한 문장 기능과 R4 다문장 배열을 명시, §5는 다른 후보에 특정 오답 결속을 요구, §6은 원문 근거와 명시/비명시를 명시한다. §2·§3은 E3 결정/보조 및 R5/R6 경계의 진전이나, V4 고유 수행과 E3 비교의 분리는 직접 규정하지 않으며 M2509#31의 의미 대응을 별도 결정 단계로 볼지까지 독립 확정하지 않는다. direct의 별도 필요와 indirect의 먼저 정해짐은 원문 경로 판단을 여전히 요구한다. 문서 보완을 과거 갈림 6의 자동 해소로 삼지 않고 unclear 유지. 새로운 필연적 모순 또는 새 P0/P1은 확인하지 못했다.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:6 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:12 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:22 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:27 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:31 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:35 (@e81b759f1)

### 3. resolved

앞으로 내보내는 제외 행의 snapshot·excluded_raw 및 해시 저장 구현 확인. 커밋 코드의 메모리 exporter 실행에서 도표·choices 결손·없는 문항을 재현했고 실제 b6 제외 1행도 source/passsage 해시 일치. 원문 type_id가 excluded_raw에 없어 유형의 독립 재계산에는 한계(P2-02). b5 동결 파일에는 당시 excluded_raw가 없어 2행의 과거 원천 상태는 unclear 유지. 변경된 계약·정정·결합본에 E2/E1 인과 개선 확정 주장은 없음. 규칙의 인과 효과 자체는 unclear.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:60 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:63 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:78 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b6-v23-selection.json:22 (@e81b759f1)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:4 (@e81b759f1)

### 4. resolved

recheck.json·recheck.md 및 재현 스크립트 작성. 원문 포함 전체 diff는 ignored diff.local.json에만 저장. 이전 8 unclear 및 두 반박의 대체 판정 unknown 유지. 검증 완료와 미해결 판정을 구분.

- docs/research/goal-data-batches/review-b5/recheck.json:1
- scripts/research/goal-data/review-b5/recheck.mjs:1
- scripts/research/goal-data/review-b5/.gitignore:1

## 재계산·반례

D2·D3 b2/b3/b4/b5 A/B 각각 40/8/40/38 전부 통과(현재 패킷 회귀 결함 0). 결합 재생성 R1 511·갈림 328이며 두 JSONL이 커밋과 정확히 같다. b5 210/228 = .9210526316, κ=.8594761171(보고 .8595) 불변. 모든 결합 링크 relevance=unknown.

| TASK | 일치 | κ |
|---|---:|---:|
| r.central_meaning | 34/38 | 0.808080808 |
| r.inference | 37/38 | 0.941984733 |
| e.task_demand | 38/38 | 1.000000000 |
| e.option_correspondence | 32/38 | 0.721271394 |
| r.discourse_structure | 32/38 | 0.741496599 |
| e.evidence_location | 37/38 | 0.956422018 |

18 반례(3계약 × 6조건)를 D2·D3에 각각 실행. v2.1 모두 거절, v2.2/v2.3 정상 []만 허용되어야 하지만 누락/null도 허용된다. nonempty secondary·direct 존재·부분 집합 없음은 거절. v2.3 boolean은 다른 행에도 주입해 대상 결함을 다른 필드 오류로 가리지 않았다. no_subset 반례에는 full-task 누락 오류도 있으나 primary null 오류가 함께 존재한다.

실행: node scripts/research/goal-data/review-b5/recheck.mjs. 증거: docs/research/goal-data-batches/review-b5/recheck.json:759, docs/research/goal-data-batches/review-b5/recheck.json:1169, docs/research/goal-data-batches/review-b5/recheck.json:1191. observed-defect assertion 통과는 결함 해결을 뜻하지 않는다.

## 계약 §1–§6

- §1 **resolved**: primary는 청크 내부 최선 direct. outside_subset boolean은 실제 주 수행이 범위 밖임을 별도 기록. b5는 동결되어 v2.3 필드 소급 요구 없음. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:6 (@e81b759f1)
- §2 **unclear**: E3 direct/indirect/NA 조건 신설과 추론 흡수만으로 배제 금지는 개선. V4와의 역할 경계 및 동일 문항에서 별도 결정의 필요성 판정은 원문별 검토 필요. b5 6갈림을 재판정하거나 승격하지 않음. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:12 (@e81b759f1)
- §3 **resolved**: 기진술 재진술 vs 근거로부터 도출 기준을 명시. 연결의 비명시 여부는 개별 문항 증거로 남음. 2023#31 기존 unclear 유지. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:22 (@e81b759f1)
- §4 **resolved**: R3 단일 기능과 R4 복수 배열을 구분. 2023#22 A는 배열 전체도 주장하므로 규칙 추가만으로 기존 A/B 승자를 정하지 않음. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:27 (@e81b759f1)
- §5 **resolved**: 다른 후보 문장→특정 오답 결속 요구. 여러 정답 근거가 흩어진 경로는 v2.2 규칙을 계속 적용. 2023#34 B direct 자동 확정 없음. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:31 (@e81b759f1)
- §6 **resolved**: 2023#34의 오류는 선지에 용어가 존재한다는 사실 자체가 아니라 본문 앞쪽에 있다는 잘못된 위치 전제. 정정 note는 이를 정확히 명시. M2509#19는 명시 정서 근거 누락을 지적. 근거 D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:35 (@e81b759f1)

## 새 발견 및 유지할 공백

- **P2-01 P2 / unresolved** — primary-null 면제에서 secondary 배열 누락/null도 통과. 내용상 비어 있는 보조 TASK라 현재 R1/κ 오염은 관측되지 않으나 계약상 [] 스키마 보장은 실패. v2.2/v2.3 × missing/null 4반례가 양쪽 통과. Array.isArray(secondary_tasks) && secondary_tasks.length === 0으로 면제 조건을 고정하고 누락/null 반례를 유지한다. 근거 D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:96 (@e81b759f1), D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:36 (@e81b759f1)
- **P2-02 P2 / unclear** — 제외 raw에는 type_id가 없어 도표 유형을 raw에서 재계산할 수 없음. 원문/선지/정답 SHA 및 공개 snapshot 유형은 저장되지만 raw에서 유형은 독립 복원 불가. body_ok도 source_sha256의 대상 밖이다. 현재 도표 분류가 틀렸다는 판정은 아님. 향후 excluded_raw에 type_id 및 제외 판단에 필요한 메타데이터도 보존하고 메타데이터 포함 해시를 별도로 결속한다. 근거 D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:60 (@e81b759f1), D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:63 (@e81b759f1)

**새 P0/P1: 없음.** E3 경계는 규칙 보완을 확인한 상태이며 독립적인 과거 갈림의 해소/타당도까지 확정하지 않는다. 이전 unclear 8건은 승격하지 않았다. 두 반박의 대체 라벨도 unknown이다.

- unclear: b5 제외 2행의 내보내기 당시 원천 상태
- unclear: E3 갈림 6 및 원문별 R5/R6·R3/R4 경계
- unclear: 2023#34 B 대체 라벨
- unclear: E2/E1 규칙 개선의 인과 효과
- unclear: 사람 Gold·학생 측정·권리·실제 세션 상호 독립성

제외 스냅샷 구현은 향후 저장 보완으로 확인했다. synthetic 2행 및 실제 b6 제외 1행의 source/passage 해시가 일치한다. b5의 원천 결손은 과거 raw가 없으므로 소급 확정하지 않는다. 정정·계약·결합 변경은 인과 효과 실험이 아니며 개선 수치에서 인과를 주장하지 않는다.

위 항목은 검증 필수 실행의 skip이 아니라 범위 밖 또는 증거 한계다. skip_count=0은 unresolved/unclear를 pass로 바꾸지 않는다. b6 판정 산출물은 읽거나 수정하지 않았다. b6 선정 및 제외 raw 1행만 스냅샷 구현 확인에 사용했다.

## 마무리

검증 evidence의 result=pass는 검증 수행 완료를 뜻한다. task complete/제품 승인은 주장하지 않는다. Git add/commit 및 evidence/submit 출력 원문은 recheck.md 아래에 기록한다.

Git add exit 1:

```text
fatal: Unable to create 'D:/workspace/Vocaflow/.git/worktrees/vocaflow-goal-data-review-b5/index.lock': Permission denied
```

Git commit --only exit 1:

```text
error: pathspec 'docs/research/goal-data-batches/review-b5/recheck.json' did not match any file(s) known to git
error: pathspec 'docs/research/goal-data-batches/review-b5/recheck.md' did not match any file(s) known to git
error: pathspec 'scripts/research/goal-data/review-b5/recheck.mjs' did not match any file(s) known to git
error: pathspec 'scripts/research/goal-data/review-b5/write-recheck.mjs' did not match any file(s) known to git
```

커밋·통합 미완료. 권한을 우회하거나 입력 worktree를 수정하지 않았다.

task evidence exit 0 출력 원문:

```json
{
  "evidence_id": "T-0104-R1-E01",
  "run_seq": 1,
  "recorded_by": "goal-data-independent",
  "type": "review",
  "command_or_protocol": "T-0104 independent recheck @e81b759f1: node scripts/research/goal-data/review-b5/recheck.mjs; contract and raw-sample review. pass means verification performed, acceptance findings retained.",
  "result": "pass",
  "skip_count": 0,
  "artifact_path_or_url": "docs/research/goal-data-batches/review-b5/recheck.json",
  "observed_at": "2026-10-23T06:21:58.553Z",
  "covers": [
    0,
    1,
    2,
    3,
    4
  ],
  "artifact_sha256": "057514192594c4e718589dd59592f071707c54eca44f9582a9f790f7022ef2fa",
  "recorded_at": "2026-10-23T06:22:02.576Z"
}
```

task submit exit 0 출력 원문:

```json
{
  "task": {
    "task_id": "T-0104",
    "goal_id": "VG-L3-A1-01",
    "related_goal_ids": [],
    "template": null,
    "title": "b5-v22 보완(e81b759f1) · 계약 v2.3 재검증(Codex)",
    "description": "T-0103 보완 5항목(반박 2 정정 · d2-run primary-null 버전·secondary 결속 · CONTRACT_V2_3 · 제외 스냅샷 봉인 · 인과 주장 없음)이 data/goal-batches-20261023 @e81b759f1 에서 해소됐는지 독립 재검증한다. 읽기 전용.",
    "priority": "P1",
    "status": "REVIEW",
    "owner_id": "goal-data-independent",
    "branch": "review/goal-data-b5-20261023",
    "worktree": "d:/workspace/vocaflow-goal-data-review-b5",
    "allowed_paths": [
      "docs/research/goal-data-batches/review-b5/**",
      "scripts/research/goal-data/review-b5/**",
      ".agent-goal.md"
    ],
    "forbidden_paths": [
      "supabase/**",
      ".env*",
      "apps/**",
      "docs/research/goal-data-batches/D2-task-mapping/**"
    ],
    "db_scope": {
      "mode": "none",
      "targets": []
    },
    "approval_required": false,
    "approval_kinds": [],
    "approval": null,
    "acceptance": [
      "반박 2(2023#34 E2 A · M2509#19 R6 B) refuted_rationale 처리와 R1 511 · 갈림 328 · b5 일치/κ 불변 재계산",
      "d2-run · d3-build primary-null 면제 조건(부분 집합 + 계약 v2.2/v2.3 + secondary=[] + direct 0) 반례 재실행, b2–b5 회귀 결함 0",
      "CONTRACT_V2_3 §1–§6 이 T-0103 경계 지적(E3 결정/보조 · §1/§4 · R3/R4 · E2 다른 후보)을 해소하는지, 새 P0/P1 여부",
      "제외 행 스냅샷 봉인 구현 확인, 인과 주장 부재 확인",
      "review-b5/recheck.json + recheck.md, unclear 유지"
    ],
    "evidence": [
      {
        "evidence_id": "T-0104-R1-E01",
        "run_seq": 1,
        "recorded_by": "goal-data-independent",
        "type": "review",
        "command_or_protocol": "T-0104 independent recheck @e81b759f1: node scripts/research/goal-data/review-b5/recheck.mjs; contract and raw-sample review. pass means verification performed, acceptance findings retained.",
        "result": "pass",
        "skip_count": 0,
        "artifact_path_or_url": "docs/research/goal-data-batches/review-b5/recheck.json",
        "observed_at": "2026-10-23T06:21:58.553Z",
        "covers": [
          0,
          1,
          2,
          3,
          4
        ],
        "artifact_sha256": "057514192594c4e718589dd59592f071707c54eca44f9582a9f790f7022ef2fa",
        "recorded_at": "2026-10-23T06:22:02.576Z"
      }
    ],
    "run_seq": 1,
    "depends_on": [],
    "criterion_claims": [],
    "impact": {
      "kind": "independent",
      "parent_goal_id": null,
      "acceptance_ids": [],
      "current_gap": "T-0103 보완이 독립 확인 전이라 b6 이후 배치 근거가 없다",
      "expected_impact": "advances",
      "evidence_required": [
        "재계산",
        "반례 재실행",
        "recheck.json"
      ],
      "next_dependency": "b6-v23 검증",
      "out_of_scope": [
        "DB 쓰기",
        "D2 산출물 수정"
      ],
      "dependency_type": "direct",
      "user_request_ref": "2026-10-23 사용자: codex 와 협의하여 진행",
      "canon_version": "1.1.0",
      "base_commit": null,
      "gate_ms": 0.66
    },
    "flags": [],
    "pr": null,
    "requires_ci": false,
    "verified_commit": null,
    "orchestration": {
      "rounds": 0,
      "failures": {},
      "budget_used_usd": 0
    },
    "source": null,
    "created_at": "2026-10-23T06:13:56.716Z",
    "updated_at": "2026-10-23T06:22:09.032Z",
    "history": [
      {
        "at": "2026-10-23T06:13:56.716Z",
        "from": null,
        "to": "READY",
        "by": "platform-goal",
        "note": "created"
      },
      {
        "at": "2026-10-23T06:14:06.228Z",
        "from": "READY",
        "to": "IN_PROGRESS",
        "by": "goal-data-independent",
        "note": "t-0104-codex"
      },
      {
        "at": "2026-10-23T06:22:09.032Z",
        "from": "IN_PROGRESS",
        "to": "REVIEW",
        "by": "goal-data-independent",
        "note": null
      }
    ],
    "run": {
      "run_seq": 1,
      "session": "t-0104-codex",
      "agent": "codex",
      "pid": 29496,
      "host": "SKCC23N00265",
      "started_at": "2026-10-23T06:14:06.228Z",
      "locks": [],
      "product_lock_token": null,
      "start_head": "079eb08d035ee209061c101d03261dafe070a110",
      "ended_at": "2026-10-23T06:22:09.032Z"
    }
  },
  "released": [
    "task--T-0104",
    "worktree--d__workspace_vocaflow-goal-data-review-b5"
  ]
}
```
