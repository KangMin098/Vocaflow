# S048 `/settings` — 설정 (학습 흐름·외형·음성·알림·계정)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "학습 환경이 불편할 때, 테마·음성·학습 동작을 내 방식으로 바꾸고 싶다, 그래서 편하게 계속한다"
- 주 사용자: 학생 · 인지 계층: 없음

## 흐름
- 진입: 셸 FOOTER Settings(`components/layout/sidebar-config.ts:323-326`) · 모바일 유틸리티 바 · /wordvault/review·/wordvault/study
- D7 활성화 경로 밖
- 단계: 1. 섹션 바로가기 알약 5개(영문 라벨 Study Flow·Appearance… `app/(main)/settings/page.tsx:276-280`) 2. 섹션별 토글·선택 3. 저장 배지
- 완료 조건: 변경 즉시 기기 저장 → 「저장됨」(`page.tsx:60-100`, 실제 저장 결과 반영)
- 1차 행동: 없음(설정 목록) · 보조: 비밀번호 변경, 로그아웃
- 나가는 길: /reset-password?mode=update(`page.tsx:483`) · 로그아웃 → /login

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 해당 없음 | — | — |
| 로딩 | 전역만 | `app/loading.tsx` · 로그아웃 중 `page.tsx:575-580` | — |
| 오류 | 있음 | "이 브라우저에는 저장할 수 없어요" 배지 `page.tsx:76-87` | △ 문구만 |
| 부분 | 있음 | 계정 4행 중 3행 "준비중" 비활성(`page.tsx:476-505`, ready:false) + 계정 해지 비활성(`:585-592`) | ✗ 해지는 `title` 툴팁에만 문의처 |
| 완료 | 있음 | 「저장됨」 배지 | — |

## 자산
- N1 자산: 없음 — 역할: **없음**
- 형태 씨앗: 없음
- 학습과학 원칙: 학습 흐름 섹션이 원칙 조정 표면(추정: FSRS·자동재생 등 토글) — 번호 대응은 코드로 미확인

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 56px 제목 "설정" + 부제 + 알약 TOC + 첫 섹션 카드(아이콘+제목)
- 골격 판정: **폼**(섹션 카드 5장 세로) — G1 축 불필요 화면(설정)
- 평균 신호(정적): 1 (float-hover 1)
- 참고: 한국어 섹션 제목("학습 흐름" `:299`)과 영문 TOC 라벨이 짝이 안 맞음 — 같은 섹션이 두 이름

## 근거
- `apps/web/src/app/(main)/settings/page.tsx:35-45` — "저장되지 않았는데 저장됨 금지" 경위
- `apps/web/src/app/(main)/settings/layout.tsx:10-13` — 'use client' 페이지라 metadata 를 layout 이 대신
