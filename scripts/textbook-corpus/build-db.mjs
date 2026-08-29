// scripts/textbook-corpus/build-db.mjs
// 4단계 — SQLite 적재 (전문검색 포함).
//
// 왜 DB 인가: 페이지 5천 장 · 1,400만 자를 md 하나로 만들면 열리지도 검색되지도 않는다.
// md 는 "사람이 훑는 면"이고 원문 전량 조회·교차 비교는 SQL 이 맡는다.
// node:sqlite 는 Node 22+ 내장이라 의존성이 늘지 않는다.
//
// 통째로 다시 만든다 — manifest + pages.jsonl 이 정본이고 DB 는 파생물이다.
// 파생물을 증분 갱신하면 정본과 어긋난 채로 오래 산다.
//
//   node build-db.mjs
//   node build-db.mjs --digest   내용 지문만 출력 (재현성 검증용)

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, hasFlag, loadSources, log, readJson, sha1, storePaths,
} from './lib.mjs';

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE docs (
  id            TEXT PRIMARY KEY,
  root          TEXT NOT NULL,
  origin        TEXT NOT NULL,          -- root | archive
  rel_path      TEXT NOT NULL,
  abs_path      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  ext           TEXT NOT NULL,
  size          INTEGER NOT NULL,
  hash          TEXT NOT NULL,

  school        TEXT NOT NULL,          -- 초등 | 중등 | 고등 | 초등~중등 | 공통
  grade_band    TEXT NOT NULL,          -- 초3~초6 등 사람이 읽는 라벨
  grade_min     INTEGER,                -- 초1=1 … 고3=12 (정렬·비교용)
  grade_max     INTEGER,
  category      TEXT NOT NULL,          -- 독해 | 어휘 | 구문 | 내신 | 기출 | 문법 | 듣기
  role          TEXT NOT NULL,          -- 본책 | 본문 | 미리보기 | 정답해설 | 워크북 | 단어장 | 빠른정답
  publisher     TEXT NOT NULL,
  series        TEXT NOT NULL,
  volume        INTEGER,

  status        TEXT NOT NULL,          -- ok | scanned | failed | unsupported | pending
  page_kind     TEXT,                   -- page | chunk
  pages         INTEGER NOT NULL DEFAULT 0,
  chars         INTEGER NOT NULL DEFAULT 0,
  ko_chars      INTEGER NOT NULL DEFAULT 0,
  en_chars      INTEGER NOT NULL DEFAULT 0,
  en_ratio      REAL,

  word_tokens   INTEGER,
  word_types    INTEGER,
  ttr           REAL,
  sentences     INTEGER,
  avg_sent_len  REAL,
  syl_per_word  REAL,
  fk_grade      REAL,
  fog_index     REAL,
  unit_kind     TEXT,
  unit_count    INTEGER,

  low_confidence TEXT NOT NULL DEFAULT '',
  defaults       TEXT NOT NULL DEFAULT '',
  note           TEXT,
  first_seen     TEXT
);

CREATE INDEX idx_docs_school   ON docs(school, grade_min);
CREATE INDEX idx_docs_series   ON docs(series, volume);
CREATE INDEX idx_docs_category ON docs(category);
CREATE INDEX idx_docs_pub      ON docs(publisher);

CREATE TABLE pages (
  doc_id  TEXT NOT NULL REFERENCES docs(id),
  p       INTEGER NOT NULL,
  chars   INTEGER NOT NULL,
  ko      INTEGER NOT NULL,
  en      INTEGER NOT NULL,
  digits  INTEGER NOT NULL,
  text    TEXT NOT NULL,
  PRIMARY KEY (doc_id, p)
);

CREATE VIRTUAL TABLE pages_fts USING fts5(
  text,
  doc_id UNINDEXED,
  p UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE units (
  doc_id TEXT NOT NULL REFERENCES docs(id),
  kind   TEXT NOT NULL,
  no     INTEGER NOT NULL,
  page   INTEGER NOT NULL,
  PRIMARY KEY (doc_id, kind, no)
);

CREATE TABLE top_words (
  doc_id TEXT NOT NULL REFERENCES docs(id),
  word   TEXT NOT NULL,
  n      INTEGER NOT NULL,
  rank   INTEGER NOT NULL,
  PRIMARY KEY (doc_id, word)
);
CREATE INDEX idx_top_words_word ON top_words(word);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- 학년대별 난이도 비교 — "출판사가 붙인 학년" 과 "실제로 잰 난이도" 를 나란히 본다.
CREATE VIEW v_difficulty AS
SELECT school, grade_band, grade_min, category, series, volume, role, file_name,
       pages, word_tokens, ROUND(avg_sent_len, 2) AS avg_sent_len,
       ROUND(fk_grade, 2) AS fk_grade, ROUND(fog_index, 2) AS fog_index,
       ROUND(ttr, 4) AS ttr, ROUND(en_ratio, 3) AS en_ratio
FROM docs
WHERE status = 'ok' AND fk_grade IS NOT NULL
ORDER BY grade_min, fk_grade;

-- 시리즈 한 눈에 — 권별로 본책/미리보기/해설이 갖춰졌는지.
CREATE VIEW v_series AS
SELECT series, publisher, category, volume,
       COUNT(*) AS files,
       SUM(role IN ('본책','본문')) AS main,
       SUM(role = '미리보기') AS preview,
       SUM(role = '정답해설') AS answers,
       SUM(role = '워크북') AS workbook,
       MIN(grade_min) AS grade_min, MAX(grade_max) AS grade_max,
       SUM(pages) AS pages
FROM docs GROUP BY series, volume ORDER BY series, volume;

-- 구멍 목록 — 손대야 할 것만.
CREATE VIEW v_gaps AS
SELECT id, rel_path, status, publisher, series, low_confidence,
       CASE
         WHEN status = 'scanned' THEN 'OCR 필요 (텍스트 레이어 없음)'
         WHEN status IN ('failed','unsupported') THEN '추출 불가'
         WHEN low_confidence <> '' THEN '분류 미확정: ' || low_confidence
       END AS gap
FROM docs
WHERE status <> 'ok' OR low_confidence <> '';
`;

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const manifest = readJson(sp.manifest, null);
  if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }

  ensureDir(sp.root);
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${sp.db}${suffix}`, { force: true });
  }

  const db = new DatabaseSync(sp.db);
  db.exec(SCHEMA);

  const insDoc = db.prepare(`INSERT INTO docs (
    id, root, origin, rel_path, abs_path, file_name, ext, size, hash,
    school, grade_band, grade_min, grade_max, category, role, publisher, series, volume,
    status, page_kind, pages, chars, ko_chars, en_chars, en_ratio,
    word_tokens, word_types, ttr, sentences, avg_sent_len, syl_per_word, fk_grade, fog_index,
    unit_kind, unit_count, low_confidence, defaults, note, first_seen
  ) VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?, ?,?,?,?,?,?)`);
  const insPage = db.prepare('INSERT INTO pages (doc_id,p,chars,ko,en,digits,text) VALUES (?,?,?,?,?,?,?)');
  const insFts = db.prepare('INSERT INTO pages_fts (text,doc_id,p) VALUES (?,?,?)');
  const insUnit = db.prepare('INSERT OR IGNORE INTO units (doc_id,kind,no,page) VALUES (?,?,?,?)');
  const insTop = db.prepare('INSERT OR IGNORE INTO top_words (doc_id,word,n,rank) VALUES (?,?,?,?)');
  const insMeta = db.prepare('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)');

  const docs = Object.values(manifest.docs).sort((a, b) => a.id.localeCompare(b.id));
  let pageRows = 0;

  db.exec('BEGIN');
  for (const d of docs) {
    const e = d.extract || {};
    const a = d.analysis || {};
    const t = e.totals || { chars: 0, ko: 0, en: 0 };
    const enRatio = t.chars ? t.en / t.chars : null;

    insDoc.run(
      d.id, d.root, d.origin, d.relPath, d.absPath, d.fileName, d.ext, d.size, d.hash,
      d.school, d.grade_band, d.grade_min, d.grade_max, d.category, d.role, d.publisher, d.series, d.volume,
      e.status || 'pending', e.pageKind || 'page', e.pages || 0, t.chars || 0, t.ko || 0, t.en || 0, enRatio,
      a.wordTokens ?? null, a.wordTypes ?? null, a.ttr ?? null, a.sentences ?? null,
      a.avgSentenceLen ?? null, a.sylPerWord ?? null, a.fkGrade ?? null, a.fogIndex ?? null,
      a.unitKind ?? null, a.unitCount ?? null,
      (d.low_confidence || []).join(','), (d.defaults || []).join(','), e.note || null, d.firstSeen || null,
    );

    const pagesPath = path.join(sp.text, d.id, 'pages.jsonl');
    if (fs.existsSync(pagesPath)) {
      const raw = fs.readFileSync(pagesPath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line) continue;
        let pg;
        try { pg = JSON.parse(line); } catch { continue; }
        insPage.run(d.id, pg.p, pg.chars, pg.ko, pg.en, pg.digits, pg.text);
        if (pg.chars > 0) insFts.run(pg.text, d.id, pg.p);
        pageRows += 1;
      }
    }
    for (const u of a.units || []) insUnit.run(d.id, a.unitKind || 'UNIT', u.no, u.page);
    (a.topWords || []).forEach((w, i) => insTop.run(d.id, w.w, w.n, i + 1));
  }
  db.exec('COMMIT');

  // 재현성 지문 — 시각을 뺀 내용만으로 계산한다. verify.mjs 가 두 번 돌려 비교한다.
  const digestRows = db.prepare(`
    SELECT id, school, grade_band, category, role, publisher, series, volume,
           status, pages, chars, word_tokens, sentences, fk_grade, unit_count
    FROM docs ORDER BY id`).all();
  const digest = sha1(JSON.stringify(digestRows) + `|pages:${pageRows}`);

  insMeta.run('built_at', new Date().toISOString());
  insMeta.run('docs', String(docs.length));
  insMeta.run('page_rows', String(pageRows));
  insMeta.run('content_digest', digest);
  insMeta.run('manifest_generated_at', manifest.generatedAt || '');

  if (hasFlag('--digest')) { console.log(digest); db.close(); return; }

  log(`DB ${sp.db}`);
  log(`  문서 ${docs.length} · 페이지 ${pageRows.toLocaleString()} · 지문 ${digest.slice(0, 12)}`);
  const size = fs.statSync(sp.db).size;
  log(`  크기 ${(size / 1024 / 1024).toFixed(1)} MB`);
  db.close();
}

main();
