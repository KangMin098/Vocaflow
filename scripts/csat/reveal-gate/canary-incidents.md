# canary 부산물 기록

## 2026-10-05 · `csat_source_snapshots` 1행 (보존)

- snapshot id: `a48a88c5-e764-41c3-938e-4d956f53d335` · `taken_by = 'x'` · `taken_at = 2026-10-05 13:23:00 UTC`
- 만든 실행: Reveal Gate ① 적용 직후 첫 canary 전수 검사(스캐너 401acf1ff 판 · run ID 없음 — 스캐너가 run ID 를 남기지 않던 판). anon 행위자가 `call: none` 계약을 무시하고 `csat_source_snapshot_take('x')` 를 불렀다. cc32a3632 에서 `none` 을 모든 행위자에 먼저 적용하도록 고쳤다.
- 내용: 원문 재고 집계(`csat_source_rollup`) 한 번 — 학습자 · 시험 · 응답과 무관. 외래키로 이 행을 가리키는 표 없음 · 트리거 없음.
- **지우지 않은 이유**: 설계된 삭제 경로가 「최근 60행 유지」(snapshot_take 안의 retention) 하나뿐이고 이 행만 골라 지우는 RPC · cleanup 함수가 없다. 직접 DELETE 는 설계 경로가 아니라 2026-10-05 사용자 조건에 따라 보존한다.
- 처리: retention 이 약 60회 cron(6시간 간격, 약 15일) 뒤 자연히 밀어낸다. 그때까지 「어제 대비」 시계열에 13:23 점 하나가 더 있을 뿐 Pilot · 집계 · 노출 검사 대상이 아니다(canary 는 이 표를 읽기 검사만 한다).
- 생애주기 검증: 고친 스캐너는 이 함수를 부르지 않으므로(`none`) snapshot 을 만들지 않는다 — 2026-10-05 재실행 371 PASS · 0 FAIL, 13:23 이후 새 행 0 · `taken_by = 'x'` 행 1(이 행)뿐임을 확인했다.
