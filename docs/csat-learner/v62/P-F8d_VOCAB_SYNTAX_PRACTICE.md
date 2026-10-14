# v6.2 P-F8d — 어휘 · 구문 교재 12권 연습 복구 · 첫 수직 경로 `vocab_choice`

> 상태: 실행기 · 화면 계약 · 격리 화면 완료. **학습자 화면 비공개** — DB 채점 확장(승인안 A3)과 공급 자격이 없다.
> 학습자 효과 주장 없음. 격리 화면은 합성 문항(직접 지은 문장)만 쓴다.

## 1. 왜 12권이 연습을 못 내나 — 재고가 아니라 실행 경로

| 유형 | 재고 V2~V7(해설) | 저장 모양(실측) | 화면 재생 | DB 채점 |
|---|---|---|---|---|
| vocab_choice | 49,353 (46,227) | 문장 + 밑줄 ①~⑤ · `position` | **이번에 추가(격리)** | 없음 → A3 |
| unit_vocab | 123,402 | 밑줄 낱말 + 한국어 뜻 5지 · `answer` | 없음 | 없음 |
| blank_word | 214,389 | 빈칸 문장 + 힌트 · 단답 `text` | 없음(쓰기 입력 필요) | 없음 |
| grammar_choice | 15,186 (14,502) | vocab_choice 와 같은 모양 + `tokenIdx` · `rule` | 같은 컴포넌트로 확장 가능 | 없음 |
| grammar_fix | 129,726 | 틀린 문장 · 고쳐 쓰기 단답 | 없음 | 없음 |
| unit_grammar | 30,301 | 밑줄 5 + `answer` | 없음 | 없음 |
| word_order | 43,161 | 낱말 은행 → 문장 배열 | 없음 | 없음 |

`textbook_shelf_inventory()` 실측 2026-10-15. 연습 RPC(옛 · 2판 모두)는 기사 독해 17유형만 재생 목록에 두고, `grade_dcp_item` 도 그 17종만 채점한다 — 그래서 어휘 · 구문 권은 (옛 RPC) 그 권에 없는 독해 문항을 내거나 (2판) 0을 낸다.
독해 1단(`rhyme` · `word_meaning` · `spell_blank`)도 재생 · 채점 경로가 없다 — 별도 지원 공백.

**품질 주의(실측 표본)**: `unit_vocab` 표본 하나가 "will **take on** a new level of significance" 의 take 뜻을 「가지고 가다」로 채점한다(구동사 「띠다」). 재생 경로가 생겨도 공장 문항은 **문항 단위 검수 전 공급 자격이 없다** — 자동 승격 금지의 실례.

## 2. 실행기 재사용 조사

| 후보 | 판정 |
|---|---|
| `DcpPlayer`(오늘 처방 · 교재 연습) | **재사용** — 제출 → 서버 채점 → 정답/오답 + 정답 공개 → 오답 원인 1-tap → 다음 → 요약, 기록은 `csat_item_attempts`. 제출 계약 `{choice:1..5}` 이 같다 |
| 기출 `csat/session/ItemScreen` | 재사용 안 함 — 원본 시험지 이미지 위 밑줄 · 진단 표(`csat_dx_*`) 기록 · 3B 스킨. DCP 문항(합성 지문 · 텍스트 payload)과 계약이 다르다 |
| WordVault · Flashcard · SpellForge | 낱말 카드 · 철자 — 지문 문맥 문항 형식이 없다. `blank_word`(단답)는 SpellForge 입력 방식 재사용 후보(다음 단계) |

권마다 플레이어를 만들지 않는다 — 「밑줄 다섯 중 하나」 한 컴포넌트가 vocab_choice · grammar_choice(+ tokenIdx) · unit_grammar 를 덮도록 만들었다.

## 3. 첫 수직 경로 — 구현

- `lib/learner/dcp-underline.ts` — 저장 payload 파서(밑줄 5 · 라벨 순서 · 문장 범위 · 낱말 실재 · 중복 검사, 실패면 그 문항을 내지 않음) · 문장 분할 · 채점 규칙(`position`).
- `components/practice/DcpItems.tsx` `DcpUnderlineChoiceItem` — 지문 속 ①~⑤ 와 버튼이 같은 번호, 고르면 지문 낱말 굵게 + 버튼 면 채움(색만으로 구분 안 함) · 44px.
- `DcpPlayer` — 채점 · 오답 원인 기록을 주입 가능(기본 = 서버). 피드백: 「② ~~ignored~~ → watered 가 와야 뜻이 이어져요」 + 해설. 완료 문구 「어휘 연습을 마쳤어요」.
- 학습자 경로 불변: `PLAYABLE_DCP_TYPES` · `parseItem` 에 vocab_choice 를 넣지 않았다(시험이 지킨다).
- 격리 화면 `/dev/vocab-practice` — 프로덕션 빌드에서 404(`DEV_PRACTICE_ROUTES=on` 일 때만), 합성 문항 2, 로컬 채점(같은 규칙), 기록 없음.

브라우저 실측(1280, 개발 서버): 오답 → 정답 공개 · 해설 · 원인 칩 → 다음 → 정답 → 「어휘 연습을 마쳤어요 · 2문항 중 1문항」, 페이지 오류 0. 고른 칸이 스킨 색 때문에 안 보이던 것을 면 채움으로 고쳤다.

## 4. 승인안 A3 — `grade_dcp_item` 에 vocab_choice 분기

`supabase/migrations/_pending_grade_dcp_underline_choice.sql` — 현재 정의(md5 `ad87205a…`, 적용 직전 재확인)에 분기 하나: 고른 번호 = `answer_key.position`.
**함께 고친 기존 결함**: 선택지 분기의 `(p_answer->>'choice') !~ '^[1-5]$'` 는 choice 가 없으면 NULL 이라 검사를 통과해 `is_correct = NULL` 을 기록할 수 있었다 → `coalesce`. 실측 영향: DCP 시도 20건 중 NULL 0(앱이 항상 choice 를 보내서).
격리 Postgres 시험(`grade-underline.pglite.test.ts` 6): SQL 판정 = 앱 규칙(1~5) · 정답 공개 규칙 · 기록 모양 · 잘못된 선택/정답 위치 없음/로그아웃/닫힌 원천 거절 · 기존 유형 채점 불변 · 다른 교재 유형은 여전히 Unknown type.

적용 순서: ① A3 ② 연습 RPC 2판(승인안 A) 재생성 시 재생 목록에 vocab_choice 추가 ③ 앱 `parseItem` 이 vocab_choice 를 받게. **①이 먼저** — 채점 못 하는 문항이 화면에 나가면 맞혀도 「채점하지 못했어요」가 된다.

## 5. 교육적 위치 — 공급 자격과 구분

- vocab_choice 는 V TASK `v.contextual_sense`(문맥 속 낱말 의미) 의 **지도 연습(guided_practice) 후보**다. 독립 확인 · 전이 평가가 아니다(Gold · 노출 · 유일 정답 검수 없음).
- 학습자에게 내려면: A3 채점 + 연습 RPC 재생 목록 + 권 발행 + (Workspace 공급이라면) 문항 단위 자격 원장 · 승인(승인안 B · C).

## 6. 다음

grammar_choice(같은 컴포넌트 + tokenIdx) → unit_grammar · unit_vocab(5지 뜻 · 품질 검수 우선) → blank_word · grammar_fix(단답 입력 · 대안 답 처리 설계 필요) → word_order(배열).
