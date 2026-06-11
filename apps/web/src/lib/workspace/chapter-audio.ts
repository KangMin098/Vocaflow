// apps/web/src/lib/workspace/chapter-audio.ts
//
// 챕터 단위 LibriVox 보이스 — 워크스페이스(/text/[id]) 듣기 소스.
//
// 정책:
//   - LibriVox 보이스는 도서 큐레이션(본문 검수) 단계에서 "챕터 일치"가 확인된 경우에만
//     library_books.librivox_audio (jsonb) 로 영구 저장된다.
//   - 저장 구조는 섹션 배열(낭독 1챕터 = 1섹션, archive.org 스트리밍 URL).
//   - 워크스페이스는 현재 챕터(chapter_idx, 1-based)에 해당하는 섹션 1개만 노출.
//   - 정합 게이트(pickChapterAudio): 저장 후 도서가 재처리되어 챕터 수가 달라지면
//     index 매핑이 어긋나므로 섹션 수 ≠ 챕터 수면 노출하지 않는다 (브라우저 TTS fallback).
//
//   ⚠ LibriVox 는 1챕터 전체 오디오 스트림 — 문장/단락 단위 듣기 불가 (타임스탬프 없음).
//      문장/단락 듣기는 브라우저 TTS 만 제공. 소스 토글로 둘을 분리한다.

export type VoiceConsistency = 'solo' | 'multi' | 'unknown';

/** 챕터를 구성하는 단일 오디오 파트 (다권 저작은 한 챕터가 "Part 1..N" 으로 쪼개짐). */
export interface ChapterAudioPart {
  url: string;
  title: string | null;
  reader: string | null;
  secs: number | null;
}

/** 워크스페이스에 전달되는 현재 챕터의 오디오. parts 가 여러 개면 순차 재생. */
export interface ChapterAudio {
  /** archive.org 스트리밍 URL (= parts[0].url, 하위호환) */
  url: string;
  /** 섹션 제목 (LibriVox) */
  title: string | null;
  /** 낭독자 이름 */
  reader: string | null;
  /** 재생 길이(초) */
  secs: number | null;
  /** LibriVox 프로젝트 페이지 (출처 표기) */
  librivoxUrl: string | null;
  /** 목소리 일관성 — solo=단일 낭독(권장) / multi=챕터마다 바뀜 */
  consistency: VoiceConsistency;
  /** 표시용 섹션 번호 (flat=챕터 인덱스 / chapter_parts=Roman 챕터 번호) */
  sectionNumber: number;
  /** 전체 섹션/챕터 수 */
  sectionCount: number;
  /** 이 챕터의 오디오 파트들 (flat=1개, 다권 멀티파트=N개). 플레이어가 순차 재생. */
  parts: ChapterAudioPart[];
}

/** library_books.librivox_audio 에 저장되는 jsonb 구조. */
export interface LibriVoxSavedAudio {
  librivox_id: string;
  librivox_title?: string | null;
  archive_url?: string | null;
  librivox_url?: string | null;
  total_secs?: number | null;
  section_count: number;
  /** 저장 시점에 섹션 수 == 도서 챕터 수 였는지 (flat 모드) */
  aligned?: boolean;
  chapter_count_at_save?: number | null;
  consistency?: VoiceConsistency;
  via?: 'gutenberg_id' | 'title_author';
  saved_at?: string;
  saved_by?: string | null;
  /** 'flat'(기본·1섹션=1챕터) | 'chapter_parts'(다권·챕터별 멀티파트 매핑) */
  mode?: 'flat' | 'chapter_parts';
  sections: Array<{
    n: number;
    title: string;
    url: string;
    secs: number | null;
    reader: string | null;
  }>;
  // ── chapter_parts 모드 (다권 저작) ──
  /** chapter_idx → { roman, parts[] }. (JSON 키는 문자열) */
  chapter_map?: Record<string, { roman: number; parts: Array<{
    url: string;
    title: string | null;
    secs: number | null;
    reader: string | null;
  }> }>;
  /** 매핑된 챕터 수 */
  mapped_chapters?: number;
  /** 소스 LibriVox 권 id 들 */
  volume_ids?: string[];
}

/**
 * 저장된 LibriVox 오디오에서 현재 챕터(1-based)에 해당하는 섹션을 안전하게 추출.
 * 정합이 깨졌거나(재처리로 챕터 수 변경) URL 이 archive.org 가 아니면 null → 브라우저 TTS fallback.
 */
export function pickChapterAudio(
  saved: unknown,
  chapterIdx: number,
  bookChapterCount: number,
): ChapterAudio | null {
  if (!saved || typeof saved !== 'object') return null;
  const a = saved as LibriVoxSavedAudio;

  // ── chapter_parts 모드 (다권 저작 — 챕터별 멀티파트 매핑) ──
  if (a.mode === 'chapter_parts' && a.chapter_map) {
    const entry = a.chapter_map[String(chapterIdx)];
    if (!entry || !Array.isArray(entry.parts) || entry.parts.length === 0) return null;
    const parts = entry.parts.filter((p) => typeof p?.url === 'string' && isArchiveOrgUrl(p.url));
    if (parts.length === 0) return null;
    const first = parts[0]!;
    return {
      url: first.url,
      title: (typeof first.title === 'string' && first.title.trim()) || null,
      reader: (typeof first.reader === 'string' && first.reader.trim()) || null,
      secs: typeof first.secs === 'number' ? first.secs : null,
      librivoxUrl: a.librivox_url ?? null,
      consistency: a.consistency ?? 'multi',
      sectionNumber: typeof entry.roman === 'number' ? entry.roman : chapterIdx,
      sectionCount: a.mapped_chapters ?? Object.keys(a.chapter_map).length,
      parts: parts.map((p) => ({
        url: p.url,
        title: (typeof p.title === 'string' && p.title.trim()) || null,
        reader: (typeof p.reader === 'string' && p.reader.trim()) || null,
        secs: typeof p.secs === 'number' ? p.secs : null,
      })),
    };
  }

  // ── flat 모드 (1섹션=1챕터, 기존) ──
  if (!Array.isArray(a.sections) || a.sections.length === 0) return null;

  // 정합 게이트
  if (a.aligned === false) return null;
  if (a.section_count !== a.sections.length) return null;
  if (bookChapterCount > 0 && a.section_count !== bookChapterCount) return null;
  if (chapterIdx < 1 || chapterIdx > a.sections.length) return null;

  const s = a.sections[chapterIdx - 1];
  if (!s || typeof s.url !== 'string' || !isArchiveOrgUrl(s.url)) return null;

  const title = (typeof s.title === 'string' && s.title.trim()) || null;
  const reader = (typeof s.reader === 'string' && s.reader.trim()) || null;
  const secs = typeof s.secs === 'number' ? s.secs : null;
  return {
    url: s.url,
    title,
    reader,
    secs,
    librivoxUrl: a.librivox_url ?? null,
    consistency: a.consistency ?? deriveConsistency(a.sections),
    sectionNumber: typeof s.n === 'number' ? s.n : chapterIdx,
    sectionCount: a.section_count,
    parts: [{ url: s.url, title, reader, secs }],
  };
}

/** 낭독자 distinct 수로 일관성 판정 (저장 시 consistency 누락 시 fallback). */
export function deriveConsistency(
  sections: Array<{ reader: string | null }>,
): VoiceConsistency {
  const set = new Set<string>();
  for (const s of sections) {
    const r = (s.reader ?? '').trim();
    if (r) set.add(r);
  }
  return set.size === 0 ? 'unknown' : set.size === 1 ? 'solo' : 'multi';
}

function isArchiveOrgUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)archive\.org$/i.test(u.hostname);
  } catch {
    return false;
  }
}

// (제거됨) LibriVox 시간→문장 추정 — 타임스탬프 부재로 정확도 100% 불가.
//   부정확한 추정 하이라이트는 표시하지 않음. 정확 동기화는 forced alignment (Phase 2) 필요.

/** mm:ss / h:mm:ss 포맷 (플레이어 시간 표시 공용). */
export function formatAudioTime(total: number): string {
  if (!Number.isFinite(total) || total < 0) return '0:00';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
