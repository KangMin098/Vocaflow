// scripts/methodology/list-channel-videos.mjs
// 채널 URL → channel_id → YouTube 공식 RSS 피드(채널당 최근 15편) → 영상 메타데이터 JSON.
// 자막은 받지 않는다(PoToken 우회 금지 — docs/methodology/README.md). 전체 목록은 Data API 키가 필요하다.
// 사용: node scripts/methodology/list-channel-videos.mjs <out.json> <channelUrl>...
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126';
const [out, ...urls] = process.argv.slice(2);
if (!out || urls.length === 0) {
  console.error('사용: list-channel-videos.mjs <out.json> <channelUrl>...');
  process.exit(1);
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function channelId(url) {
  const direct = url.match(/channel\/(UC[\w-]{22})/)?.[1];
  if (direct) return direct;
  const page = await (await fetch(url.startsWith('http') ? url : 'https://www.' + url, { headers: { 'user-agent': UA } })).text();
  return page.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ?? null;
}

const channels = [];
let failed = 0;
for (const url of urls) {
  const id = await channelId(url);
  if (!id) {
    console.log(`실패  ${url} — channel_id 없음`);
    failed += 1;
    continue;
  }
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)).text();
  const name = decode(xml.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const videoId = e.match(/<yt:videoId>([^<]+)/)[1];
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: decode(e.match(/<title>([^<]*)/)?.[1] ?? ''),
      publishedAt: e.match(/<published>([^<]+)/)?.[1]?.slice(0, 10) ?? null,
      isShort: /#shorts/i.test(e),
    };
  });
  channels.push({ sourceUrl: url, channelId: id, name, videos });
  console.log(`완료  ${name} (${id}) — ${videos.length}편`);
}

writeFileSync(out, JSON.stringify({ source: 'youtube-rss', collectedAt: new Date().toISOString().slice(0, 10), channels }, null, 2));
console.log(`채널 ${channels.length} · 실패 ${failed} · 영상 ${channels.reduce((n, c) => n + c.videos.length, 0)} → ${out}`);
