# v6.2 P-F6 — 연습 RPC 발행 결속(승인안 A 수정판) · FQ1.0 A~H ↔ 공급 판정

> 상태: **코드·테스트만. DB 미적용.** 승인안 A~D · B7 · 계획 저장 DB 이중 방어는 이 문서로 실행되지 않는다.
> 학습자 효과 주장 없음 — 합성·고정 데이터 검증만.

## 1. P-F6a — 연습 RPC 우회 감사

| 항목 | 실측 |
|---|---|
| 함수 | `textbook_practice_items(p_v_level smallint, p_limit int)` · owner postgres · SECURITY DEFINER · `search_path=public` |
| 실행 권한 | authenticated · service_role (anon 없음) |
| 호출처 | `apps/web/src/lib/learner/dcp-actions.ts` 1곳 |
| 권 소속 | 문항 표에 「어느 권」 이 없다. 권 → V레벨 대응은 코드 `SERIES_CATALOG` 에만 있다(19행) |
| 우회 | 학습자가 V레벨을 직접 넘기므로 **미발행 권의 V레벨 문항도 받는다** — 앱 게이트(`publish-gate.ts`)는 화면만 막는다 |
| 지금 노출 | 0 — 19권 전부 published, 카탈로그 V레벨이 모두 발행 권에 덮인다 |

**이전 제안 `textbook_practice_items_for(series, step, v_level)` 은 승인하지 않는다**: 발행된 권 이름 + 다른 V레벨을 주면 그대로 우회된다(매개변수 위조).

**수정판** — `supabase/migrations/_pending_textbook_practice_publish_gate.sql`(생성: `scripts/textbook/gen-practice-gate-sql.mts`, 손으로 고치지 않음):
1. `textbook_rung_level(series, step, v_level)` — 카탈로그에서 생성, RLS 켜고 정책 없음(함수만 읽음).
2. `textbook_practice_items_for(p_series, p_step, p_limit)` — **V레벨을 받지 않고** 대응에서 도출 · 그 권이 `published` 일 때만 · 기존 필터 동일 · anon/public 회수.
3. 앱 호출을 옮겨 배포한 뒤 옛 함수 authenticated 회수(파일 끝 주석 — 별도 실행).

**남는 한계**: 문항 풀은 V레벨 단위다. 같은 V레벨을 쓰는 다른 발행 권은 같은 문항을 본다(권별 전용 문항이 아님). 권별 소속이 필요하면 문항-권 대응 표가 따로 있어야 한다.

**적용 후 검증(픽스처)**: 미발행 권이 없으므로 트랜잭션 안에서 render 1행을 `draft` 로 바꿔 0건 → rollback · 카탈로그에 없는 (series, step) → 0 · 회수 뒤 옛 함수 → permission denied.

회귀: `lib/textbook/__tests__/practice-gate-sql.test.ts` — 대응 행 = 카탈로그 · 서명에 v_level 없음 · anon 회수 · 옛 함수 회수는 주석.

## 2. FQ1.0 A~H ↔ 공급 판정 (`lib/csat/map/v62/qualification.ts`)

| 공급 필드 | FQ 축 | 규칙 |
|---|---|---|
| rights | F | fail→false · pass **이고** 실제 승인 기록(publicQualified)→true · 그 외 null |
| content | A·B·C | 하나라도 fail→false · 전부 pass→true · 그 외 null |
| teaching | D | pass/fail/그 외 null |
| assessment | E | fail→false · pass **이고** 평가 자격(assessmentQualified)→true · 그 외 null |
| learner | G | 공급 시점 별도 계산 |
| runnable | H | — |

- unknown · not_applicable 은 **null — 통과로 바꾸지 않는다.** `supplyEligible` 은 null 을 실패로 본다.
- 결속: 결과는 (콘텐츠 id, revision, TASK, 역할)에 묶인다. 하나라도 다르면 쓰지 않는다 — **수정된 콘텐츠는 이전 검수를 상속하지 않는다.**
- 역할별 필수: 공통 rights·content·runnable · 설명/지도연습 +teaching · 독립확인/전이/지연확인 +assessment.

**실제 판정 20건 스냅샷**(`fq1-results.data.json`, `scripts/csat/map/v62/import-fq1.mjs` · 축 상태만, 원문·경로·해시 없음): 공급 가능 **0/20**.
축 분포 — A pass 8·unknown 12 · B pass 18·fail 2 · C pass 10·fail 8·unknown 2 · D pass 7·fail 1·unknown 12 · E pass 5·fail 7·unknown 8 · F unknown 18·fail 2 · G·H unknown 20.

DCP 834,311행은 **일괄 판정하지 않는다** — 판정은 주문된 콘텐츠 revision 단위로만.

R5(기존 확인 문항 재사용) 경로는 이 어댑터를 거치지 않으므로 영향 없음.

## 3. 아직 아닌 것

- 영속 표 5종(수요·주문·주문 이벤트·납품·자격) 마이그레이션 — 승인안 B/C. 설계는 [P-F4b](./P-F4b_PERSIST_MODEL.md).
- 영속 주문 → 납품 E2E — 표가 없어 차단. 순수 계약 · 모의 테스트만 존재.
- V2 지도연습 생산 — dry-run · HOLD(승인안 D).
- B7 활성화 — 별도 승인.
