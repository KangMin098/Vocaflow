# S054 `/text/[id]/comic` — 만화로 읽기 (CCP 리더)

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "책 챕터를 읽기 전에, 이야기 흐름을 만화로 먼저 잡고 싶다, 그래서 본문을 덜 막히며 읽는다"
- 주 사용자: 학생 · 인지 계층: L0–L2 (입력 채널)

## 흐름
- 진입(정적 분석은 0 — 템플릿 문자열로 존재): 읽기 모드 알약 `ModePills.tsx:131` · `/comics/adapted` `comics/adapted/page.tsx:104` · `/comics/adapted/[bookId]` `:237` · `/library/books` `library/books/page.tsx:318,360`
- 단계: 1. 컷 넘김(페이지/스크롤 전환 `ComicReader.tsx:401`) 2. 정본 대사는 흐림 → 「기억나면 탭」으로 인출 후 확인(`:318-332`) 3. 학습 단어 칩 → 단어 시트(`:342-347`)
- 완료 조건: 마지막 컷 뒤 끝 패널 `ComicReader.tsx:354-374` · 진도 저장 `save_comic_progress` `:133`
- 1차 행동: 다음 컷(`ComicReader.tsx:479`) · 보조: 대사 인출 탭 · 단어장 추가(`:517`)
- 나가는 길: 본문 `/text/[id]?mode=read`(`:367,396`) · `/scriptquiz`(`:370`) · `/wordvault/browse?q=`(`:514`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 사용자 글 미지원 `comic/page.tsx:76-78` · 미발행 `:129-131` → ComicEmpty `:26-54` | ✓ 「본문 읽기」 |
| 로딩 | △ | 서버 렌더 대기(전용 없음) · 컷 이미지 lazy `ComicReader.tsx:296` | — |
| 오류 | △ | RPC 오류·예외를 빈 상태로 강등 `comic/page.tsx:96-127` — 「준비 중」과 「실패」가 구별 안 됨 · 깨진 컷 자리 `ComicReader.tsx:293` · 없는 글 notFound `:65` | △ 본문 읽기뿐 |
| 부분 | ○ | 이어보기 initialIndex `comic/page.tsx:134-145` + localStorage `ComicReader.tsx:112-117` | — |
| 완료 | ○ | 「여기까지 잘 읽었어요」 + 기억한 대사 수 `ComicReader.tsx:358-364` | ✓ 본문 읽기 · 퀴즈 |

## 자산
- N1 자산: 도서 코퍼스(`library_books` 발행 만화 · `target_vocab` · `book_v_level` `comic/page.tsx:107-123`) — 역할: **칩**(학습 단어 칩). 만화 이미지 자체는 N1 형태가 아니다
- 형태 씨앗: 없음 · 대사 흐림→인출은 Active Recall 장치지만 G1 축 아님
- 학습과학 원칙: #4 Dual Coding(그림+대사) · #1 Active Recall(정본 대사 흐림 `ComicReader.tsx:322`) · #7 Emotional(「기억했어요」 `:328`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 글래스 상단 바(본문으로·보기 전환·밝기 `ComicReader.tsx:396-404`) + 컷 이미지(`max-h-[56vh]` `:296`) + 대사 목록 + 하단 stave-dot 레일(`:448-479`)
- 골격 판정(코드 추정): **이미지 리더(컷 + 대사 목록)** — G1 축 아님. 평균이지만 콘텐츠(만화) 자체가 시선을 차지한다
- 평균 신호(정적, 자기 트리): 8 (glass 7 — `backdrop-blur-xl` `:396,401,404,457-479,485` · float-hover 1 `:367`)
- 참고: 끝 패널 주 버튼이 `--active`(`:367`) — 본문과 다른 강조색(추정: 만화 전용 금색)

## 근거
- `apps/web/src/app/(main)/text/[id]/comic/page.tsx:85-105` — 전권 RPC → 챕터 RPC 폴백
- `apps/web/src/components/comic/ComicReader.tsx:309-323` — verbatim 대사만 흐림
