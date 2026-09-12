// scripts/textbook-corpus/lib.mjs
// 시중교재 코퍼스 파이프라인 공용 유틸 — 경로 · 해시 · JSON I/O · 로그.
//
// 산출물은 저장소 밖(sources.json 의 store)에 둔다. 저작권 존속 상업 교재의
// 원문이므로 git 에 들어가면 배포가 된다. 저장소에는 이 파이프라인 코드와
// 원문을 담지 않는 집계 지표만 남는다.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));

export function loadSources() {
  const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'sources.json'), 'utf8'));
  const store = process.env.TEXTBOOK_CORPUS_STORE || raw.store;
  // 임시 원본 루트를 하나 더 붙이는 갈고리. verify.mjs 가 "파일 하나 추가" 를
  // 사용자 폴더를 건드리지 않고 시험하는 데 쓴다. 형식: `id=절대경로`.
  const extra = process.env.TEXTBOOK_CORPUS_EXTRA_ROOT;
  const roots = [...raw.roots];
  if (extra) {
    const [id, ...rest] = extra.split('=');
    roots.push({ id, path: rest.join('='), label: `임시 루트 ${id}` });
  }
  return { ...raw, roots, store: path.resolve(store) };
}

export function storePaths(store) {
  return {
    root: store,
    staging: path.join(store, 'staging'),
    manifest: path.join(store, 'manifest.json'),
    text: path.join(store, 'text'),
    md: path.join(store, 'md'),
    index: path.join(store, 'index'),
    db: path.join(store, 'corpus.db'),
    logs: path.join(store, 'logs'),
  };
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** 파일 내용 해시 — 큰 PDF 도 스트리밍으로 읽는다. */
export function fileHash(file) {
  const h = createHash('sha1');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      h.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

export function sha1(text) {
  return createHash('sha1').update(text).digest('hex');
}

/** 경로 구분자를 슬래시로 통일한다. */
export function slash(p) {
  return p.split(path.sep).join('/');
}

/** 문서 식별자 — 원본 위치(root:상대경로)에서 유도한다. 내용이 바뀌어도 같은 문서다. */
export function docId(rootId, relPath) {
  return sha1(`${rootId}:${slash(relPath)}`).slice(0, 12);
}

/** 파일명으로 안전한 슬러그. 한글은 보존한다 (사람이 md 를 직접 읽는다). */
export function safeSlug(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 원자적 쓰기 — 중단돼도 반쪽 파일이 남지 않는다. */
export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

export function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function log(...args) {
  console.log(...args);
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function flagValue(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
