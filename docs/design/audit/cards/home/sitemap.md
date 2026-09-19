# S049 `/sitemap` — 전체 보기 (학습자 화면 지도)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "원하는 화면을 못 찾을 때, 제품의 모든 화면을 한 장에서 보고 싶다, 그래서 바로 이동한다"
- 주 사용자: 학생(특히 모바일·키보드 사용자) · 인지 계층: 없음 — WCAG 2.2 §2.4.5 Multiple Ways 대응(`app/(main)/sitemap/page.tsx:5-13`)

## 흐름
- 진입: 셸 FOOTER Sitemap(`components/layout/sidebar-config.ts:344`) — 데스크톱 Sidebar·모바일 유틸리티 바 양쪽
- D7 활성화 경로 밖
- 단계: 1. 헤더 문장 2. 메타(Today·Growth) → 레일 5묶음 → 곁 묶음 → 푸터 항목 훑기 3. 항목 클릭
- 완료 조건: 목적 화면 이동
- 1차 행동: 항목 링크(동급 다수 — 1차 없음) · 보조: 없음
- 나가는 길: sidebar-config 전 항목(정적 그래프 out 0 — `href={item.href}` 템플릿 `page.tsx:65`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 해당 없음 | 설정 배열에서 정적 생성 | — |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 해당 없음 | 서버 조회 없음 | — |
| 부분 | 해당 없음 | — | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: 없음 — 역할: **없음**
- 형태 씨앗: 없음
- 학습과학 원칙: #6 Cognitive Load(잠금·진도 표시 없음 `page.tsx:21-23`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 26–30px "전체 보기" + 설명 + "어디서든 돌아오는 자리" 블록(`page.tsx:113-131`)
- 골격 판정: **목록**(묶음별 중첩 링크 목록) — 레일 번호가 있으나 형태가 아닌 텍스트
- 평균 신호(정적): 1 (float-hover 1)
- ⚠️ 항목 설명을 `ariaLabel` 에서 재활용(`page.tsx:44-55`) → 내부 용어가 학습자 화면에 인쇄됨: Class "교사용 클래스 개설·초대코드 (L3 B2B, P4.2)"(`sidebar-config.ts:321`), Today "(이어하기·모듈·추천)"(`:111` — 현 /hub 구성과 다름)

## 근거
- `apps/web/src/app/(main)/sitemap/page.tsx:15-19` — 목록을 손으로 적지 않는다(설정 배열 직접 읽기)
- `apps/web/src/app/(main)/sitemap/page.tsx:114` — `asMain={false}`
