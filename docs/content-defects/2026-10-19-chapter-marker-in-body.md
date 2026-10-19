# 콘텐츠 결함 — 장 본문 첫 줄에 장 표식(제목 + 원문 URL)이 남음

> 기록 2026-10-19 · Claude Code · 발견 경로: 학습자 화면 Tines 감사 S0 눈 확인(`docs/design/learner-tines-audit.md` B19).
> **판정: 출처 표기 자체는 정상 데이터, 본문에 표식 줄이 남은 것은 가공 결함.** DB 는 고치지 않았다(조회만). 출처를 지우지 않는다.

## 증상

읽기 화면(`/text/[id]?mode=read`) 본문 첫 줄이 `CHAPTER 1. Marley's Ghost▮https://standardebooks.org/ebooks/charles-dickens/a-christmas-carol/text/chapter-1` 로 보인다.
`▮` 자리는 제어 문자 U+001E(RECORD SEPARATOR)다. 이 URL 의 「org」 를 누르면 단어 풀이 팝업이 「사전에 없는 단어」로 열린다.

## 재현

| 항목 | 값 |
|---|---|
| 화면 | `/text/859e0b09-6dcc-4c70-97ee-7563341bf8d4?mode=read` (검증 계정 `runtime-test-0705`) |
| texts.id | `859e0b09-6dcc-4c70-97ee-7563341bf8d4` — 「A Christmas Carol — Marley's Ghost」, `content` 는 NULL(본문은 뷰가 채움) |
| library_books.id | `66b084a0-72a1-414a-98ea-3c27308772fc` · source `standard_ebooks` · published |
| 장 | `library_chapters_master` chapter_idx 1 · content_hash `ec39bf90e07d492ead941ecb37f35e093a8e79fd1ba660efb43c83a177e612d1` |
| 본문 앞 160자 | `CHAPTER 1. Marley's Ghost\u001ehttps://standardebooks.org/ebooks/charles-dickens/a-christmas-carol/text/chapter-1\n\nMarley was dead, to begin with. …` |
| 이미 분리된 값 | 같은 행 `chapter_title` = `Marley's Ghost` · `source_href` = 위 URL(정확히 일치) |

조회(읽기 전용, 2026-10-19): `select left(cc.content,160) from library_chapters_master lcm join content_chunks cc on cc.hash = lcm.content_hash where lcm.library_book_id = '66b084a0-…' order by chapter_idx;`

## 가공 경로

1. SE 수집이 장마다 표식 줄 `CHAPTER N. <제목><US><묶음><RS><href>` 를 낸다(`packages/library-pipeline/src/segment/segment.ts` 주석 — `CHAPTER_HREF_SEP = U+001E`).
2. `segment.ts` 의 `splitTitleGroup` 이 표식에서 제목 · 묶음 · `source_href` 를 분리 → `library_chapters_master.chapter_title` · `source_href` 에 저장된다(확인).
3. 그런데 **본문 덩어리(`content_chunks.content`)에는 표식 줄이 그대로 남아** 있다.
4. 뷰 `v_text_content` 가 `COALESCE(t.content, cc.content)` 로 그 본문을 내주고, 읽기 화면(`ReadingUniverse`)이 첫 줄을 문장으로 그린다.

## 범위(2026-10-19 조회)

- 장 본문이 `CHAPTER …` 뒤 같은 줄에 `http(s)://` 를 가진 장: **10,255 / 11,161**
- 본문 앞 400자에 `standardebooks.org` URL 이 있는 도서: **279권**

## 왜 바로 고치지 않았나

- **출처는 남아야 한다** — 원문 장 URL 은 PD 원문의 출처 표기다. 지우는 것이 아니라 본문에서 분리해 출처 자리(장 머리 · 도서 상세의 출처 줄)에 보이는 것이 맞다. 분리된 값은 이미 `source_href` 에 있다.
- **화면에서 첫 줄만 숨기는 것도 위험하다** — `library_chapters_master` 의 `paragraph_offsets` · `sentence_offsets` 가 표식 줄을 포함한 본문 기준으로 계산됐을 수 있다. 렌더에서 줄을 빼면 음성 동기 · 진행률 · 문장 번호(현재 `1 / 402`)가 한 칸씩 어긋날 수 있다. 오프셋 기준을 먼저 확인해야 한다.
- DB 의 1만여 장 본문을 바꾸는 일은 데이터 변경 승인 대상이다.

## 선택지(콘텐츠 · 파이프라인 담당 결정)

| 안 | 내용 | 확인할 것 |
|---|---|---|
| A. 렌더에서 분리 | 첫 줄이 `CHAPTER … U+001E <source_href>` 와 정확히 일치할 때만 장 머리로 그리고 URL 은 출처 링크로 | 오프셋이 표식 줄을 포함하는지 · 문장 번호 · 음성 동기 |
| B. 가공에서 분리 | `segment.ts` 가 본문에서 표식 줄을 빼고 오프셋을 다시 계산 → 재적재 | 재적재 범위(10,255장) · 학습 기록의 문장 위치 호환 |
| C. 유지 | 현 상태 | 학습자가 첫 문장으로 URL 을 읽고 낱말 풀이 대상이 된다 |
