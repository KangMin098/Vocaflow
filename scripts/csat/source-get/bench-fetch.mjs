// scripts/csat/source-get/bench-fetch.mjs
// 벤치마크(기준자) 코퍼스 재현 다운로드 — 발행용이 아니다. 난이도·문항 설계 비교 전용.
// 사용: node scripts/csat/source-get/bench-fetch.mjs --out <dir> [--only key]
// 산출: <dir>/bench/<key>/... + <dir>/bench/manifest.json
// 압축 해제는 시스템 tar(bsdtar: tar.gz·zip 모두 처리)를 쓴다.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const out = argOf('--out');
const only = argOf('--only');
if (!out) { console.error('usage: bench-fetch.mjs --out <dir> [--only key]'); process.exit(2); }
const root = join(out, 'bench');
mkdirSync(root, { recursive: true });

const MAX_BYTES = 300 * 1024 * 1024;

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error(`${url} too large: ${len} bytes (skip)`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}
function untar(archive, dir) {
  mkdirSync(dir, { recursive: true });
  // Windows: Git Bash 의 GNU tar 는 C: 를 원격 호스트로 읽고 zip 을 못 푼다 → 내장 bsdtar 를 쓴다.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar,['-xf', archive, '-C', dir], { stdio: 'inherit' });
}
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}
const gh = (repo, branch) => `https://codeload.github.com/${repo}/zip/refs/heads/${branch}`;

const SOURCES = {
  race: {
    url: 'http://www.cs.cmu.edu/~glai1/data/race/RACE.tar.gz',
    license: 'non-commercial research only',
    license_quote: 'RACE dataset is available for non-commercial research purpose only. (http://www.cs.cmu.edu/~glai1/data/race/)',
    async run(dir) {
      const a = join(dir, 'RACE.tar.gz');
      await download(this.url, a);
      untar(a, dir);
      const levels = {};
      let files = 0, items = 0;
      for (const f of walk(join(dir, 'RACE')).filter((p) => p.endsWith('.txt'))) {
        const lvl = /[\\/](middle|high)[\\/]/.exec(f)?.[1] ?? 'unknown';
        const q = JSON.parse(readFileSync(f, 'utf8')).questions.length;
        levels[lvl] ??= { passages: 0, questions: 0 };
        levels[lvl].passages++; levels[lvl].questions += q;
        files++; items += q;
      }
      return { files, items, levels };
    },
  },
  dream: {
    url: 'https://raw.githubusercontent.com/nlpdata/dream/master/data/',
    license: 'non-commercial research only',
    license_quote: 'DREAM dataset is intended for non-commercial research purpose only. (https://github.com/nlpdata/dream/blob/master/license.txt)',
    async run(dir) {
      let files = 0, items = 0; const levels = {};
      for (const s of ['train', 'dev', 'test']) {
        const p = join(dir, `${s}.json`);
        await download(`${this.url}${s}.json`, p);
        const d = JSON.parse(readFileSync(p, 'utf8'));
        const q = d.reduce((n, x) => n + x[1].length, 0);
        levels[s] = { dialogues: d.length, questions: q };
        files += d.length; items += q;
      }
      return { files, items, levels };
    },
  },
  clear: {
    url: gh('scrosseye/CLEAR-Corpus', 'main'),
    license: 'CC BY-NC-SA 4.0 (whole data, no separate metadata license)',
    license_quote: 'The data is provided under a CC BY-NC-SA 4.0 DEED Attribution-NonCommercial-ShareAlike 4.0 International license (https://github.com/scrosseye/CLEAR-Corpus README)',
    async run(dir) {
      const a = join(dir, 'repo.zip');
      await download(this.url, a); untar(a, dir);
      const xlsx = walk(dir).find((p) => p.endsWith('.xlsx'));
      const x = join(dir, 'xlsx'); untar(xlsx, x);
      const sheet = readFileSync(join(x, 'xl', 'worksheets', 'sheet1.xml'), 'utf8');
      const rows = (sheet.match(/<row /g) || []).length - 1;
      return { files: 1, items: rows, levels: { note: 'BT_easiness 연속값 + grade 메타 (xlsx)' } };
    },
  },
  onestopenglish: {
    url: gh('nishkalavallabhi/OneStopEnglishCorpus', 'master'),
    license: 'CC BY-SA 4.0',
    license_quote: 'This work is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License. (https://github.com/nishkalavallabhi/OneStopEnglishCorpus README)',
    async run(dir) {
      const a = join(dir, 'repo.zip');
      await download(this.url, a); untar(a, dir);
      const txt = walk(dir).filter((p) => /Texts-SeparatedByReadingLevel[\\/](Adv|Ele|Int)-Txt[\\/][^\\/]+\.txt$/.test(p)); // Int-Txt/Int-Txt 중복 폴더 제외
      const levels = {};
      for (const f of txt) { const m = /-(ele|int|adv)\.txt$/i.exec(f); const k = m ? m[1].toLowerCase() : 'other'; levels[k] = (levels[k] ?? 0) + 1; }
      return { files: txt.length, items: levels.adv ?? 0, levels };
    },
  },
  onestopqa: {
    url: gh('berzak/onestop-qa', 'master'),
    license: 'CC BY-SA 4.0',
    license_quote: 'This work is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License. (https://github.com/berzak/onestop-qa README)',
    async run(dir) {
      const a = join(dir, 'repo.zip');
      await download(this.url, a); untar(a, dir);
      const inner = walk(dir).find((p) => p.endsWith('onestop_qa.zip'));
      const x = join(dir, 'data'); untar(inner, x);
      const js = walk(x).filter((p) => p.endsWith('.json'));
      let items = 0; const levels = {};
      for (const f of js) {
        const d = JSON.parse(readFileSync(f, 'utf8'));
        const arts = Array.isArray(d) ? d : (d.data ?? Object.values(d));
        for (const art of arts) {
          const paras = art.paragraphs ?? art.Paragraphs ?? [];
          for (const p of paras) items += (p.qas ?? p.questions ?? []).length;
        }
        levels.articles = (levels.articles ?? 0) + arts.length;
        levels.paragraphs = (levels.paragraphs ?? 0) + arts.reduce((n, a) => n + (a.paragraphs?.length ?? 0), 0);
      }
      return { files: js.length, items, levels };
    },
  },
  weebit: {
    url: null,
    license: 'no public path',
    license_quote: 'WeeBit (Vajjala & Meurers 2012) is distributed only on request from the authors; no public download.',
    async run() { return { files: 0, items: 0, levels: {} }; },
  },
};

const prevPath = join(root, 'manifest.json');
const manifest = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : [];
for (const [key, s] of Object.entries(SOURCES)) {
  if (only && only !== key) continue;
  const dir = join(root, key); mkdirSync(dir, { recursive: true });
  let r;
  try { r = await s.run(dir); } catch (e) { r = { files: 0, items: 0, levels: {}, error: String(e.message ?? e) }; }
  const row = { key, url: s.url, license: s.license, license_quote: s.license_quote, ...r };
  const i = manifest.findIndex((m) => m.key === key);
  if (i >= 0) manifest[i] = row; else manifest.push(row);
  console.log(key, JSON.stringify(r));
}
writeFileSync(prevPath, JSON.stringify(manifest, null, 2));
console.log('manifest ->', prevPath);
