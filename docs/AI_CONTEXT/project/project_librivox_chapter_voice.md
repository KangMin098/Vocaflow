> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_librivox_chapter_voice.md
> category: project

---

2026-06-06 — `/text/[id]` 워크스페이스에 **챕터별 LibriVox 원어민 보이스 듣기** 추가 (브라우저 음성과 선택).

**핵심 흐름**: admin 본문 검수에서 on-the-fly 로 해결되던 LibriVox 매치를 **큐레이터가 명시 저장**해야 학습자에게 노출. 저장은 `library_books.librivox_audio jsonb` (migration `add_library_books_librivox_audio`). **챕터 정합(섹션 수 == 도서 chapter_count) 일 때만** 연결 버튼 활성 + 저장.

- **저장 경로**: `POST /api/admin/library/save-librivox-audio` `{book_id, librivox_id}` → 신뢰 위해 `librivox_id` 로 섹션 **서버 재조회**(`fetchLibriVoxAudioById`) → aligned 산정 → write. `{clear:true}` 로 해제. 버튼은 `LibriVoxAudioPanel` (props: `bookId`, `savedLibriVoxId`).
- **노출 게이트**: `lib/workspace/chapter-audio.ts` `pickChapterAudio(saved, chapterIdx(1-based), bookChapterCount)` — 섹션 수 ≠ 챕터 수(재처리로 변동)면 null → 브라우저 TTS fallback. 단일 출처.
- **워크스페이스**: `layout.tsx` 가 `library_books.librivox_audio` fetch → context `chapterAudio` 주입. `FloatingAudioPlayer` 듀얼 소스: `🔊 브라우저 음성`(문장/단락/전체 TTS) vs `🎙 원어민 성우`(챕터 archive.org 스트림 — **문장/단락 단위 불가**, 타임스탬프 없음). 소스 선택은 LS 기억, 문장 클릭 시 자동 browser 전환(선호 유지). chapterAudio null 이면 기존 player 그대로(회귀 0).

**제약**: LibriVox = 1챕터=1스트림(파일 저장 X, archive.org 직접). 게시 도서 현재 1권("Twenty years after", 61장) — 정합되는 LibriVox 녹음 있어야 연결 가능. 관련: [[project_copyright_gate_us_license]].

