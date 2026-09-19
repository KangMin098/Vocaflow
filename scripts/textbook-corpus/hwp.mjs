// scripts/textbook-corpus/hwp.mjs
// HWP 5.0 본문 텍스트 추출 — 외부 도구 없이.
//
// 이 환경에는 한글·LibreOffice 가 없다. 그런데 HWP 5.0 파일은 CFB(OLE 복합문서)
// 컨테이너이고, 저장소에 이미 들어와 있는 `xlsx` 패키지가 CFB 리더를 내보낸다.
// BodyText/SectionN 스트림을 raw-deflate 로 풀고 HWPTAG_PARA_TEXT 레코드만
// 모으면 본문이 나온다. 표·글상자 안 글은 별도 컨트롤이라 빠질 수 있다 —
// 그래서 결과에 `partial` 로 한계를 적어 둔다.
//
// 참조: 한글과컴퓨터 «한글문서파일형식 5.0» 공개 규격 — 레코드 헤더 32비트
// (tag 10bit · level 10bit · size 12bit, size==0xFFF 이면 다음 4바이트가 실제 크기).

import zlib from 'node:zlib';
import xlsx from 'xlsx'; // CommonJS — 이름 붙은 내보내기가 없어 기본 내보내기로 받는다

const { CFB } = xlsx;

const HWPTAG_BEGIN = 0x10;
const HWPTAG_PARA_TEXT = HWPTAG_BEGIN + 51; // 0x43

/** 1 코드유닛만 차지하는 제어문자. 나머지 32 미만은 8 코드유닛을 차지한다. */
const SINGLE_UNIT_CONTROLS = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);

function toBuffer(x) {
  return Buffer.isBuffer(x) ? x : Buffer.from(x);
}

function decodeParaText(data) {
  let out = '';
  for (let i = 0; i + 1 < data.length; i += 2) {
    const code = data.readUInt16LE(i);
    if (code < 32) {
      if (SINGLE_UNIT_CONTROLS.has(code)) {
        if (code === 10 || code === 13) out += '\n';
        else if (code === 24) out += '-';
        else if (code === 30 || code === 31) out += ' ';
        continue;
      }
      i += 14; // 확장/인라인 컨트롤은 8 코드유닛(16바이트) — 헤더 2바이트는 루프가 더한다
      continue;
    }
    out += String.fromCharCode(code);
  }
  return out;
}

function readRecords(buf, onRecord) {
  let pos = 0;
  while (pos + 4 <= buf.length) {
    const header = buf.readUInt32LE(pos);
    pos += 4;
    const tag = header & 0x3ff;
    const level = (header >> 10) & 0x3ff;
    let size = (header >> 20) & 0xfff;
    if (size === 0xfff) {
      if (pos + 4 > buf.length) break;
      size = buf.readUInt32LE(pos);
      pos += 4;
    }
    if (pos + size > buf.length) break;
    onRecord(tag, level, buf.subarray(pos, pos + size));
    pos += size;
  }
}

/**
 * @param {Buffer} fileBuf .hwp 파일 전체
 * @returns {{ok:boolean, sections:string[], reason?:string, compressed?:boolean, version?:string}}
 */
export function extractHwpText(fileBuf) {
  if (fileBuf.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1') {
    return { ok: false, sections: [], reason: 'CFB 서명이 아니다 — HWP 3.0(비 OLE) 이거나 HWPX(zip) 일 수 있다' };
  }
  const cfb = CFB.read(fileBuf, { type: 'buffer' });

  const fh = CFB.find(cfb, '/FileHeader');
  if (!fh) return { ok: false, sections: [], reason: 'FileHeader 스트림이 없다' };
  const head = toBuffer(fh.content);
  if (head.subarray(0, 17).toString('latin1') !== 'HWP Document File') {
    return { ok: false, sections: [], reason: 'HWP 서명 문자열이 없다' };
  }
  const version = head.readUInt32LE(32).toString(16);
  const props = head.readUInt32LE(36);
  const compressed = (props & 0x1) !== 0;
  if ((props & 0x2) !== 0) {
    return { ok: false, sections: [], reason: '암호가 걸린 문서다', version };
  }

  const sectionPaths = cfb.FullPaths
    .filter((p) => /BodyText\/Section\d+$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)$/)[1]) - Number(b.match(/(\d+)$/)[1]));
  if (sectionPaths.length === 0) {
    return { ok: false, sections: [], reason: 'BodyText/Section 스트림이 없다', version };
  }

  const sections = [];
  for (const p of sectionPaths) {
    const entry = CFB.find(cfb, p);
    if (!entry) continue;
    let raw = toBuffer(entry.content);
    if (compressed) {
      try {
        raw = zlib.inflateRawSync(raw);
      } catch {
        try { raw = zlib.inflateSync(raw); } catch { continue; }
      }
    }
    const paras = [];
    readRecords(raw, (tag, _level, data) => {
      if (tag === HWPTAG_PARA_TEXT) paras.push(decodeParaText(data));
    });
    sections.push(paras.join('\n').replace(/\n{3,}/g, '\n\n').trim());
  }

  return { ok: true, sections, compressed, version };
}
