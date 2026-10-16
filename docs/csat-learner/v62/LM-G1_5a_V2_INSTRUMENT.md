# LM-G1.5a — V2 문맥 의미 선택 instrument 계약

> TASK `v.contextual_sense`(V2). 구현은 `apps/web/src/lib/knowledge/contextual-sense.ts`(순수), 레지스트리는 `item-tasks.ts` 의 `contextual-sense`, 화면은 `components/csat/theater/ContextSensePanel.tsx`.
> **현재 상태: 계약 · 채점 · 연결 완료, 합의 주석 0개라 비활성.** 지도의 V2 `direct_check` 는 `content_needed` 그대로다. DB · RPC · RLS 변경은 없다.

## 1. 무엇을 재는가

대상은 기출 어휘 문항이다(「밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?」, 유형 R-VOCAB · X-VOCAB).

| 층 | 질문 | 정답 근거 | 자동 채점 | 정오(isCorrect)에 넣나 |
|---|---|---|---|---|
| A 기본 뜻 | 낱말의 사전 뜻 | — | 하지 않음(V1 범위) | — |
| B 판별 | 밑줄 다섯 중 이 문맥에 맞지 않는 것 | 공식 정답 번호(주석 `misfit` = 정답 − 1) | 예 | 예 |
| D 대안 | 그 자리에 문맥이 요구하는 뜻(한국어 뜻 선택지) | 주석 `sense.correct` + 오답 뜻마다 배제 이유 `rejectWhy` | 예. 단 B 를 맞혔을 때만 성공 | 예 |
| C 근거 | 판단을 뒷받침하는 문장(번호) | 주석 `cue.sentences`(+ 허용 `accepted`) | `cue.reviewed` 일 때만, 아니면 null | **아니오** — 따로 보고 |
| E 새 글 | 다른 문항에서 같은 판단 | 서로 다른 지문 수 | 기존 T4 증거(전이 경험) | — |

- 정답: B 와 D 를 모두 맞혀야 조건 성공이다. 낱말 자리만 찍은 것은 성공이 아니다(V01).
- 엉뚱한 자리를 고르면 그 뒤에 고른 뜻은 이 문맥의 판단이 아니다. 우연히 같은 번호여도 실패다(V02).
- 근거 문장은 정오와 섞지 않는다. 뜻은 맞혔고 근거만 틀린 경우가 따로 보인다(V03).
- 자유 설명은 받지 않는다. 자동 판정이 불가능하므로 기록하지도 채점하지도 않는다.
- 관찰하지 않는 것: 낱말 기본 뜻(V1) · 문장 구조(S5) · 자유 설명 · 다른 유형으로의 일반화 · V2 전체 숙달.

## 2. 주석(annotation) 형식 — `ContextualSenseAnnotation`

| 필드 | 뜻 |
|---|---|
| `version` · `itemId` | 주석 버전 · 문항(평가원 `M2609#30` 형식) |
| `skeletonSig` · `sentenceCount` | 구운 골격 문장 길이 서명. 다르면 `currentItemTask` 가 채점하지 않는다(revision 결속) |
| `targets[5]` | 밑줄 ①~⑤ 가 놓인 문장 번호. 낱말 원문은 담지 않는다(평가원 저작물) |
| `misfit` | 맞지 않는 밑줄(0–4) |
| `sense.options` · `correct` · `rejectWhy` | 이 문맥의 뜻 선택지(2–5, 중복 금지) · 정답 · 오답마다 배제 이유(없으면 주석 무효) |
| `cue.sentences` · `accepted` · `reviewed` | 근거 문장 · 함께 허용할 문장 · 검수 여부(검수 전이면 채점하지 않음) |
| `review` | `draft / accepted / rejected` · 주석자 · 맹검 독립 검수자 · 합의 · 날짜 |

- 노출 자격(`releasable`): 모양이 맞고, `accepted` 이고, 맹검 독립 검수자와 검수 날짜가 있을 때만 레지스트리에 올라간다(V15).
- 학습자에게 열리는 것은 그 다음 단계인 `knowledge_applications` 활성(사람 출시 승인) 뒤다. 등록만으로는 열리지 않는다.
- `content_hash` 는 주석 JSON 의 sha256 이다. 주석이 바뀌면 옛 수행 기록은 T4 계약에 따라 STALE 이 된다(V05 · V06).

## 3. 서버 · 원장 연결(기존 것 재사용, 새 테이블 없음)

```
문항 화면 과제 칸 → POST /api/csat/item/{slug}/task → recordItemTaskAttempt
  → currentItemTask(주석 · 골격 서명) → loadLiveApplication(출시 · 채택 사슬) → def.grade(서버 채점)
  → G2 writer(learning_task_attempts · learning_first_attempts 원자 저장 · 요청키 멱등 · 서버 시각 · 도움 수준)
```

- 입력: `{ misfit: 0–4, sense: 0–n, cue: number[] }`. 범위 밖 · 중복 · 형식 오류는 `invalid_input` 이다(V13).
- 응답(`grade`): `{ misfitOk, senseOk, cueOk | null, isCorrect }`. 정답 키 · 배제 이유 · 근거 문장은 제출 전에도 후에도 내려보내지 않는다(V07). `panel` 은 `sentenceCount · targets · senseOptions · cueGraded` 만 담는다.
- 멱등성 · 다른 본문 요청키 충돌 · 소유권 · 첫 시도/반복 구분 · 도움 선노출 · 서버 시각은 기존 writer 계약을 그대로 따른다. claim-support 와 같은 경로다.
- 저장이 실패하면 화면은 결과를 보이지 않고 오류만 보인다(허위 완료 없음, V14).
- DCP `vocab_choice` 결과는 이 원장으로 복사하지 않는다(경로 분리).

## 4. 개발 도구 재사용 판정

| 자산 | 판정 |
|---|---|
| `/dev/vocab-practice` · `VocabPracticeDev` | 재사용 안 함. 합성 문항 · 로컬 채점 · 기록 없음인 개발 전용 경로이고 V2 완료로 표시하지 않는다 |
| `DcpUnderlineChoiceItem` · `dcp-underline` 파서 | UI 형식(밑줄 ①~⑤ 고르기, 44px, 색 외 구분)만 참고했다. DCP 플레이어는 `csat_item_attempts` 에 기록해 G2 원장 · 증거 계약과 다르므로 쓰지 않았다 |
| `grade_dcp_item` · A3(`_pending_grade_dcp_underline_choice.sql`) | 손대지 않음. A3 는 교재 연습(지도 연습 후보)의 채점 확장이고, V2 직접 확인 도구가 아니다 |
| 교재 `vocab_choice` 49,353개 | 문항 단위 검수 전이라 확인 도구로 승격하지 않는다(P-F8d 실측 품질 사례) |

## 5. T4 증거 계약과의 관계

- 출시되면 `checkKeysOfTask` 에 `contextual-sense` 를 잇는 V2 템플릿 결정이 필요하다(PENDING_DELTA D3). 그 뒤 `evidenceView` 가 A–F 를 그대로 적용한다.
- 지금은 확인 키가 없으므로 V2 증거 · 실행 링크 · ActionRank 실행 가능 표시가 생기지 않는다(V18).
- `contextual-sense` 기록은 R5 · S5 증거 시도에 섞이지 않는다(V21, 단위).
- R5 의 resolved 정책(FIND 2 · CHECK 연속 2 · 120일)을 V2 에 자동 적용하지 않는다. V2 판정 기준은 정의의 「서로 다른 두 문맥에서 맞힌다」이며, 적용 정책은 승인 대기다(PENDING_DELTA D4).

## 독립 수용 보완(2026-10-17)

`releasable`은 메타데이터 형식 관문이며 실제 맹검 실행의 증명이 아니다. 서로 다른 비어 있지 않은 actor, 합의와 유효 날짜, 정확한 reviewerBlind=true를 요구한다. 실제 독립 검수 입력·첫 제출 hash·합의 원장·같은 문제지 밑줄 다섯 위치·뜻과 오답 배제 이유의 교육적 타당도는 콘텐츠 단계에서 별도 검증한다. 두 AI의 일치는 사람 전문가 검수가 아니다. 중복/충돌 주석은 해당 문항 전체를 닫는다.

출시 후보에는 원문 그대로의 SHA256 `sourceRevision`, 1부터 세는 `officialAnswer`(misfit+1)를 요구한다. 서버 anchorGate는 선택된 V2에 대해 현재 passage/answer/answer_unknown을 조회해 대조한다. 조회 실패·같은 길이 원문 변경·정답 변경·미확정 답은 닫는다. 현재 주석 0개이므로 실제 원문/밑줄/검수 원장 검증을 완료했다는 뜻이 아니다.

기존 손 주석 → 기존 E축 → V2 순서로 선택해 V2 추가가 기존 E 도구를 가리지 않게 한다. 기존 문항의 과제를 바꾸려면 별도 전환 검토가 필요하다. 기록 key와 hash는 기존 writer가 분리하며 과거 행을 바꾸지 않는다.

B+D 성공은 해당 선택 형식의 조건 성공이다. 공식 정답을 알고 있으면 B가 알려지고, D는 2–5지선다로 추측 가능하므로 독립 문맥 추론/숙달의 확증이 아니다. C는 문장 식별만 관찰하며 근거 표현 지목·자유 논증을 측정하지 않는다. C 실패여도 B+D 정오는 유지되며, 근거 성공을 주장하지 않는다.

기본 문항 화면은 해설 극장 뒤에 과제 칸이 있다. check=1은 해설을 숨기지만 과거 노출을 지우지 않는다. 기존 task-meta·reveal·crossSessionHelp/evidence 자격 검사를 유지하며, V2 확인 키는 여전히 비어 있다. 다른 문항/공유지문의 노출 정책 C2/G를 새로 확정하지 않는다.
