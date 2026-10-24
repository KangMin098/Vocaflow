# 원문 정정 — 범위 A · B (승인 대기 · DB 미적용)

> 대상: 개발 DB `jajenrevcbmrpaliomxv`, 테이블 `public.csat_items`. 2026-10-24 에는 SELECT 만 했다(`check.sql` 실행 결과 4행 모두 state='before').
> 두 범위는 독립이다. 순서는 상관없지만 **B 는 `B-2014A29/README.md` 의 반영 순서(해설 먼저)를 따른다.**

## 범위 A — 선지 추출 잔여물 3행

| PK `id` | 열 | 변경 전(⑤ 끝) | 변경 후 | choices md5 전 → 후 |
|---|---|---|---|---|
| 2017#24 | `choices[4]` | `… only one percent. 8` | `… only one percent.` | `eadc859e…` → `964f24d9…` |
| 2018#24 | `choices[4]` | `… ethical produce. 8` | `… ethical produce.` | `75afb175…` → `f380f7ee…` |
| M2509#25 | `choices[4]` | `… respectively. * augmented reality: 증강 현실` | `… respectively.` | `b7dad550…` → `764a8341…` |

- 영향: 세 문항 모두 수능·모평이라 자동 보류 트리거가 걸리지 않는다. 도표 이미지 연결(`csat_review_visual_heads`)도 없다. published 분석 v1~v5 는 그대로 남는다.
- 분석·강의는 ⑤ 끝 잔여물을 근거로 쓰지 않는다(f5 대조: 수치·판정 일치) → 해설 동시 정정은 필요 없다.
- 학습자 화면은 공식 문제지를 직접 추출하므로, DB 선지 정정은 내부 파이프라인(분석·검사)에만 영향이 있다. 화면에서 선지를 DB 로 그리는 경로가 있는지는 전수 확인하지 않았다.
- 원장 재발 방지: 승인 뒤 `recipe-A-choices.json` 을 `scripts/csat/data/kice-source-repairs.json` 에 합친다.

## 범위 B — 2014A#29 각주 1행

| PK `id` | 열 | 변경 전 | 변경 후 | passage md5 전 → 후 |
|---|---|---|---|---|
| 2014A#29 | `passage` | `… 5:00 p.m. month. Fees …` | `… 5:00 p.m. * The museum is closed on the first Monday of every month. Fees …` | `354dba3d…` → `6b4dd881…` |

선지(`9b38a7ff…`)는 바뀌지 않는다. 연쇄 영향과 순서는 `B-2014A29/README.md` 에 있다.

## 파일 · 전체 SHA-256

| 파일 | sha256 |
|---|---|
| `A-choices/forward.sql` | `9ce132a13d3a5b017babf15c4eee800ce3a77ec42a39d5f6bdc3f035e94f0030` |
| `A-choices/recovery.sql` | `4f1cb656b2f1f22c437a58f77de29f9eb2828a8755389b786ab708c3bbe1c61e` |
| `A-choices/check.sql` | `8e86cf2d2c56d26420d83093c51409cb51d209fb84644de667aa6af17bdf46cc` |
| `B-2014A29/forward.sql` | `e2589a4b329cf2e3ea1f02056ed2bd95dce97e1e958258393d17f45c0f90fa09` |
| `B-2014A29/recovery.sql` | `a7db5f4d8f5477ed9b70537afab77502c1ddcb08f59fc7ecd5677c84fc95781a` |
| `B-2014A29/check.sql` | `ac548da9a4a1e86b87dadc5e8fe3414156eb8f48542c74cd39bbc04d2ed932c7` |
| `recipe-A-choices.json` | `4f5edd3439be54702a9c009fb10d9a8591fd5cc7bfdc93933d6cefa375440681` |
| `recipe-B-2014A29.json` | `c1a386786184eb8d5b007e693c93663f4436b2cda15395977823b2154141ba04` |

- forward 는 compare-and-set 이다. 행 수가 기대(A 3 · B 1)와 다르면 예외로 전체를 되돌린다.
- recovery 는 정정 후 md5 가 같을 때만 원래 값으로 되돌린다. 행 삭제 · DDL 은 없다. 4행 모두 왕복 md5 를 SELECT 로 검증했다.
- 실행 방법(승인 뒤): 실행 직전 파일 sha256 을 다시 계산해 위 값과 맞춘다 → `check.sql`(before) → `forward.sql` 전문을 `mcp__supabase__execute_sql` 로 보낸다 → `check.sql`(after).
