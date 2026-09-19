# S018 `/comics/restored/[slug]` — 복원 만화 리더 (한 호)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "옛 만화 한 호를 읽을 때, 말풍선을 듣고 모르는 단어 뜻을 바로 보고 싶다, 그래서 다음 호로 이어 읽는다"
- 주 사용자: 학생 · 방문자(호 단위 구조화 데이터 `page.tsx:139-151`) · 인지 계층: L0~L1

## 흐름
- 진입: 서가 호 카드(`restored/page.tsx:246`) · `ComicInfoDialog.tsx:236` · 이전/다음 호(`page.tsx:297`)
- 단계: 1. 「서가」 뒤로 + 제목 2. `PdModernReader` 세로 페이지 + 말풍선 오버레이(`page.tsx:169-179`) 3. 말풍선 TTS · 단어 탭 → 뜻(`PdModernReader.tsx:5, 58, 73-81`) 4. 이전/다음 호(`page.tsx:281-282`) 5. 출처(`:183`)
- 완료 조건: 호를 끝까지 읽고 다음 호로(명시 완료 기록 없음 — 추정)
- 1차 행동: 읽기(스크롤) · 보조: 단어 탭, 말풍선 듣기
- 나가는 길: /comics/restored(`page.tsx:156, 319`) · 이전/다음 호 · 원본 아카이브(`:224`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 페이지 0 → 404 `page.tsx:131` | △ 전역 404(/ · /fit) — 서가로 안 감 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 스키마 없음 `NotReady` `page.tsx:130` · 그 밖은 `app/error.tsx` | ○ NotReady |
| 부분 | 있음 | 좌표 없는 말풍선은 제외 `page.tsx:176` · info 없으면 출처 생략 `:183` | — |
| 완료 | 있음 | 다음 호 링크 `page.tsx:281-282`, 마지막 호면 서가로 `:318-319` | ○ |

## 자산
- N1 자산: 사전(`lookup_word_meaning` RPC `PdModernReader.tsx:58`) — 역할: **상호작용**(단어 탭 팝업), 골격 아님. 찾은 단어를 WordVault/FSRS 로 보내는 호출이 없음(`PdModernReader.tsx` 에 insert·save grep 0) — 읽기 맥락이 복습으로 이어지지 않음
- 형태 씨앗: 없음
- 학습과학 원칙: #4 Dual Coding(그림+대사) · #5 Context-Dependent(맥락 속 뜻) — 인출(#1)·간격(#2)으로는 안 이어짐

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 얇은 머리(뒤로+제목) → 원본 페이지 이미지(최대 820px `page.tsx:134`) — 콘텐츠가 곧 화면
- 골격 판정: 리더(세로 스크롤 판면). G1 없음 — h1 은 15px truncate(`PdModernReader.tsx:94`)
- 평균 신호(정적): 0
- 문서 불일치: 머리 주석은 "컷으로 쪼개 한 컷씩"(`page.tsx:5-6`), 서가 설명은 "원본 지면 그대로"(`restored/page.tsx:60-65`)

## 근거
- `apps/web/src/app/(main)/comics/restored/[slug]/page.tsx:122-185` — 조회 1회 + 리더 + 시리즈 내비 + 출처
