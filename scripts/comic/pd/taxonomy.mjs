// scripts/comic/pd/taxonomy.mjs
//
// PD 만화 분류 정본 — 원본 제목 한 줄 → **유형(kind) · 시리즈(series) · 호수(issueNo)**.
// 네트워크·fs 없는 순수 모듈. 대량 적재(ingest-bulk)와 콘솔 API 가 공유한다.
//
// ── 왜 휴리스틱이 아니라 규칙표인가 ───────────────────────────────
// 이 분류가 **학습자 서가의 묶음 그 자체**다. "앞 4토큰이 같으면 같은 시리즈" 같은 추정을 쓰면
// 실측 제목에서 이런 일이 벌어진다:
//     "Fawcett Comics: Whiz Comics 002 (1940-02)"        → whiz comics
//     "Fawcett Comics: Whiz comics 015 (alt scan)"        → whiz comics      (같음 — 다행)
//     "Whiz Comics 022 (b and w) (coverless) (24p)"       → whiz comics      (같음 — 다행)
//     "Fawcett Comics: Mighty Midget Comics  Bulletman (" → mighty midget    (틀림: Bulletman 이 본편)
//     "Fawcett Comics: Captain Marvel Jr in Ski Jump"     → captain marvel   (맞음, 우연히)
// 우연히 맞는 것과 규칙으로 맞는 것을 구분할 수 없으면, 어느 날 조용히 갈라져도 알 수 없다.
// 그래서 **순서 있는 명시 규칙표**로 판정하고, 어디에도 안 걸리면 `other` 로 떨어뜨려 **보이게** 한다.
// (추정으로 그럴듯한 시리즈를 만들어내는 것보다, 미분류로 남아 검수에 걸리는 편이 낫다.)
//
// 실측 기준: Internet Archive `fawcett-comics` 811건 + `ace-comics` 209건 (2026-08-16 수집).

/**
 * 유형 — **어휘 도메인**이 갈리는 단위로 나눈다. 장르 취향이 아니라 학습 축이다.
 * `label` 은 학습자에게 보이는 이름, `learnerNote` 는 "이걸 읽으면 어떤 영어를 얻나".
 * key 는 DB `pd_comic_kinds.key` 와 **같은 문자열이어야 한다** (FK 로 강제됨).
 */
export const KINDS = [
  {
    key: 'classic-adaptation',
    label: '고전 각색',
    sort: 1,
    blurb: '소설 고전을 만화로 옮긴 각색물.',
    learnerNote: '그레이디드 리더·수능 지문과 어휘가 겹칩니다. 원작 도서로 이어가기 가장 쉬운 유형.',
  },
  {
    key: 'superhero',
    label: '슈퍼히어로',
    sort: 2,
    blurb: '1940년대 골든에이지 영웅물. Captain Marvel 계열이 중심.',
    learnerNote: '짧은 명령문·감탄문이 많아 회화 리듬을 익히기 좋습니다. 의성어와 구어체 축약형이 빈번합니다.',
  },
  {
    key: 'humor-daily',
    label: '명랑 일상',
    sort: 3,
    blurb: '가정·학교의 일상 소동을 다룬 유머물.',
    learnerNote: '생활 영어 회화 밀도가 가장 높습니다. 문장이 짧고 현재시제 중심이라 진입 난이도가 낮습니다.',
  },
  {
    key: 'funny-animal',
    label: '명랑 동물',
    sort: 4,
    blurb: '의인화된 동물 주인공의 코믹물.',
    learnerNote: '어휘가 구체적이고 반복이 많아 초급 진입에 적합합니다.',
  },
  {
    key: 'adventure',
    label: '모험',
    sort: 5,
    blurb: '정글·항해·탐험 활극.',
    learnerNote: '지형·이동·자연 어휘가 집중적으로 나옵니다. 과거시제 서술 비중이 높습니다.',
  },
  {
    key: 'western',
    label: '서부',
    sort: 6,
    blurb: '카우보이·보안관·개척지 이야기.',
    learnerNote: '방언과 축약형(ain’t, reckon)이 많습니다. 표준 어휘를 먼저 다진 뒤 읽기를 권합니다.',
  },
  {
    key: 'mystery-horror',
    label: '괴기·미스터리',
    sort: 7,
    blurb: '괴담·초자연·서스펜스 단편집.',
    learnerNote: '분위기 묘사 형용사와 심리 어휘가 풍부합니다. 문장이 길어 중급 이상에 적합합니다.',
  },
  {
    key: 'crime',
    label: '범죄 수사',
    sort: 8,
    blurb: '형사·법정·범죄 실화 각색.',
    learnerNote: '법·수사 용어와 인과 접속사(therefore, thus)가 자주 등장합니다.',
  },
  {
    key: 'scifi',
    label: 'SF',
    sort: 9,
    blurb: '우주·미래·핵시대 상상물.',
    learnerNote: '과학·기술 어휘와 가정법 문장이 많습니다. 과학 지문 독해와 어휘가 겹칩니다.',
  },
  {
    key: 'war',
    label: '전쟁',
    sort: 10,
    blurb: '2차대전·한국전 배경 전투물.',
    learnerNote: '군사·지휘 어휘와 명령문이 중심입니다. 소재가 무거워 연령 확인이 필요합니다.',
  },
  {
    key: 'romance',
    label: '로맨스',
    sort: 11,
    blurb: '1950년대 연애 단편집.',
    learnerNote: '감정·관계 어휘와 대화체 1인칭 서술이 많습니다.',
  },
  {
    key: 'other',
    label: '미분류',
    sort: 99,
    blurb: '규칙표에 걸리지 않은 항목.',
    learnerNote: '검수에서 유형을 지정해야 학습자 서가에 묶여 나갑니다.',
  },
]

export const KIND_KEYS = new Set(KINDS.map((k) => k.key))

/**
 * 시리즈 규칙표 — **순서가 의미를 갖는다** (위에서부터 첫 매치).
 *
 * 순서가 중요한 실제 사례:
 *   · `Captain Marvel Jr` 는 `Captain Marvel` 보다 먼저 와야 한다. 아니면 전부 본편으로 먹힌다.
 *   · `Mighty Midget Comics  Bulletman` 은 Bulletman 규칙보다 먼저 와야 한다 —
 *     Mighty Midget 은 여러 캐릭터를 묶은 **별도 판형 시리즈**이지 Bulletman 의 일부가 아니다.
 *   · `Dennis the Menace Giant/Bonus` 는 본편보다 먼저. 별도 간행물이다.
 *
 * @type {Array<{ re: RegExp, key: string, title: string, kind: string, publisher?: string }>}
 */
export const SERIES_RULES = [
  // ── 고전 각색 ────────────────────────────────────────────────
  { re: /classics?[\s._-]*illustrated|illustrated[\s._-]*classics/i, key: 'classics-illustrated', title: 'Classics Illustrated', kind: 'classic-adaptation', publisher: 'Gilberton' },

  // ── 슈퍼히어로 (Fawcett) — 파생 간행물을 본편보다 먼저 ────────
  { re: /mighty\s*midget/i, key: 'mighty-midget-comics', title: 'Mighty Midget Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /captain\s*marvel\s*(jr|junior)/i, key: 'captain-marvel-jr', title: 'Captain Marvel Jr.', kind: 'superhero', publisher: 'Fawcett' },
  { re: /captain\s*marvel\s*(story\s*book|fun\s*book)/i, key: 'captain-marvel-storybook', title: 'Captain Marvel Story Book', kind: 'superhero', publisher: 'Fawcett' },
  { re: /mary\s*marvel/i, key: 'mary-marvel', title: 'Mary Marvel', kind: 'superhero', publisher: 'Fawcett' },
  { re: /marvel\s*family/i, key: 'marvel-family', title: 'The Marvel Family', kind: 'superhero', publisher: 'Fawcett' },
  { re: /hoppy\s*the\s*marvel\s*bunny/i, key: 'hoppy-marvel-bunny', title: 'Hoppy the Marvel Bunny', kind: 'funny-animal', publisher: 'Fawcett' },
  { re: /captain\s*marvel/i, key: 'captain-marvel', title: 'Captain Marvel Adventures', kind: 'superhero', publisher: 'Fawcett' },
  { re: /whiz\s*comics/i, key: 'whiz-comics', title: 'Whiz Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /master\s*comics/i, key: 'master-comics', title: 'Master Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /wow\s*comics/i, key: 'wow-comics', title: 'Wow Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /bulletman/i, key: 'bulletman', title: 'Bulletman', kind: 'superhero', publisher: 'Fawcett' },
  { re: /spy\s*smasher/i, key: 'spy-smasher', title: 'Spy Smasher', kind: 'superhero', publisher: 'Fawcett' },
  { re: /captain\s*midnight/i, key: 'captain-midnight', title: 'Captain Midnight', kind: 'superhero', publisher: 'Fawcett' },
  { re: /ibis\s*the\s*invincible/i, key: 'ibis-the-invincible', title: 'Ibis the Invincible', kind: 'superhero', publisher: 'Fawcett' },
  { re: /minute\s*man/i, key: 'minute-man', title: 'Minute Man', kind: 'superhero', publisher: 'Fawcett' },
  { re: /america'?s\s*greatest\s*comics/i, key: 'americas-greatest-comics', title: "America's Greatest Comics", kind: 'superhero', publisher: 'Fawcett' },
  { re: /nickel\s*comics/i, key: 'nickel-comics', title: 'Nickel Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /slam\s*bang/i, key: 'slam-bang-comics', title: 'Slam-Bang Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /special\s*edition\s*comics/i, key: 'special-edition-comics', title: 'Special Edition Comics', kind: 'superhero', publisher: 'Fawcett' },
  { re: /lightning\s*comics/i, key: 'lightning-comics', title: 'Lightning Comics', kind: 'superhero', publisher: 'Ace' },
  { re: /four\s*favorites/i, key: 'four-favorites', title: 'Four Favorites', kind: 'superhero', publisher: 'Ace' },
  { re: /sure\s*fire\s*comics/i, key: 'sure-fire-comics', title: 'Sure-Fire Comics', kind: 'superhero', publisher: 'Ace' },
  { re: /our\s*flag\s*comics/i, key: 'our-flag-comics', title: 'Our Flag Comics', kind: 'superhero', publisher: 'Ace' },

  // ── 명랑 일상 — 파생 간행물 우선 ──────────────────────────────
  { re: /dennis\s*the\s*menace\s*(giant|bonus)/i, key: 'dennis-the-menace-giant', title: 'Dennis the Menace Giant/Bonus', kind: 'humor-daily', publisher: 'Fawcett' },
  { re: /dennis\s*the\s*menace/i, key: 'dennis-the-menace', title: 'Dennis the Menace', kind: 'humor-daily', publisher: 'Fawcett' },
  { re: /ozzie\s*and\s*babs/i, key: 'ozzie-and-babs', title: 'Ozzie and Babs', kind: 'humor-daily', publisher: 'Fawcett' },
  { re: /four\s*teen+ers|four\s*tenners/i, key: 'four-teeners', title: 'Four Teeners', kind: 'humor-daily', publisher: 'Ace' },
  { re: /\bernie\b/i, key: 'ernie', title: 'Ernie', kind: 'humor-daily', publisher: 'Ace' },
  { re: /\bvicky\b/i, key: 'vicky', title: 'Vicky', kind: 'humor-daily', publisher: 'Ace' },

  // ── 명랑 동물 ────────────────────────────────────────────────
  { re: /funny\s*animals/i, key: 'funny-animals', title: "Fawcett's Funny Animals", kind: 'funny-animal', publisher: 'Fawcett' },
  { re: /puppetoons/i, key: 'puppetoons', title: "George Pal's Puppetoons", kind: 'funny-animal', publisher: 'Fawcett' },
  { re: /andy\s*comics/i, key: 'andy-comics', title: 'Andy Comics', kind: 'funny-animal', publisher: 'Ace' },
  { re: /monkeyshines/i, key: 'monkeyshines', title: 'Monkeyshines Comics', kind: 'funny-animal', publisher: 'Ace' },
  { re: /comic\s*comics/i, key: 'comic-comics', title: 'Comic Comics', kind: 'funny-animal', publisher: 'Fawcett' },

  // ── 모험 ─────────────────────────────────────────────────────
  { re: /nyoka/i, key: 'nyoka-jungle-girl', title: 'Nyoka the Jungle Girl', kind: 'adventure', publisher: 'Fawcett' },
  { re: /don\s*winslow/i, key: 'don-winslow', title: 'Don Winslow of the Navy', kind: 'adventure', publisher: 'Fawcett' },
  { re: /bob\s*swift/i, key: 'bob-swift', title: 'Bob Swift, Boy Sportsman', kind: 'adventure', publisher: 'Fawcett' },
  { re: /ten\s*tall\s*men/i, key: 'ten-tall-men', title: 'Ten Tall Men', kind: 'adventure', publisher: 'Fawcett' },
  { re: /thrilling\s*true\s*story|baseball\s*giants/i, key: 'true-sports-story', title: 'Thrilling True Story of the Baseball Giants', kind: 'adventure', publisher: 'Fawcett' },
  { re: /hot\s*rod\s*comics/i, key: 'hot-rod-comics', title: 'Hot Rod Comics', kind: 'adventure', publisher: 'Fawcett' },

  // ── 서부 ─────────────────────────────────────────────────────
  { re: /hopalong\s*cassidy/i, key: 'hopalong-cassidy', title: 'Hopalong Cassidy', kind: 'western', publisher: 'Fawcett' },
  { re: /rocky\s*lane/i, key: 'rocky-lane-western', title: 'Rocky Lane Western', kind: 'western', publisher: 'Fawcett' },
  { re: /monte\s*hale/i, key: 'monte-hale-western', title: 'Monte Hale Western', kind: 'western', publisher: 'Fawcett' },
  { re: /bill\s*boyd/i, key: 'bill-boyd-western', title: 'Bill Boyd Western', kind: 'western', publisher: 'Fawcett' },
  { re: /lash\s*larue/i, key: 'lash-larue-western', title: 'Lash LaRue Western', kind: 'western', publisher: 'Fawcett' },
  { re: /tom\s*mix/i, key: 'tom-mix-western', title: 'Tom Mix Western', kind: 'western', publisher: 'Fawcett' },
  { re: /gabby\s*hayes/i, key: 'gabby-hayes-western', title: 'Gabby Hayes Western', kind: 'western', publisher: 'Fawcett' },
  { re: /ken\s*maynard/i, key: 'ken-maynard-western', title: 'Ken Maynard Western', kind: 'western', publisher: 'Fawcett' },
  { re: /tex\s*ritter/i, key: 'tex-ritter-western', title: 'Tex Ritter Western', kind: 'western', publisher: 'Fawcett' },
  { re: /six\s*gun\s*heroes/i, key: 'six-gun-heroes', title: 'Six Gun Heroes', kind: 'western', publisher: 'Fawcett' },
  { re: /billy\s*the\s*kid/i, key: 'billy-the-kid', title: 'Billy the Kid and Oscar', kind: 'western', publisher: 'Fawcett' },
  { re: /young\s*eagle/i, key: 'young-eagle', title: 'Young Eagle', kind: 'western', publisher: 'Fawcett' },
  { re: /pioneer\s*marshall/i, key: 'pioneer-marshall', title: 'Pioneer Marshall', kind: 'western', publisher: 'Fawcett' },
  { re: /golden\s*arrow/i, key: 'golden-arrow', title: 'Golden Arrow', kind: 'western', publisher: 'Fawcett' },
  { re: /gene\s*autry/i, key: 'gene-autry', title: 'Gene Autry Comics', kind: 'western', publisher: 'Fawcett' },
  { re: /rod\s*cameron/i, key: 'rod-cameron-western', title: 'Rod Cameron Western', kind: 'western', publisher: 'Fawcett' },
  { re: /indian\s*braves/i, key: 'indian-braves', title: 'Indian Braves', kind: 'western', publisher: 'Ace' },
  { re: /western\s*adventures/i, key: 'western-adventures', title: 'Western Adventures Comics', kind: 'western', publisher: 'Ace' },
  { re: /western\s*hero/i, key: 'western-hero', title: 'Western Hero', kind: 'western', publisher: 'Fawcett' },
  { re: /rex\s*allen|hoot\s*gibson|straight\s*arrow/i, key: 'western-movie-stars', title: 'Western Movie Stars', kind: 'western', publisher: 'Fawcett' },
  { re: /motion\s*picture\s*comics/i, key: 'motion-picture-comics', title: 'Motion Picture Comics', kind: 'western', publisher: 'Fawcett' },

  // ── 괴기·미스터리 ────────────────────────────────────────────
  { re: /super\s*mystery/i, key: 'super-mystery-comics', title: 'Super-Mystery Comics', kind: 'mystery-horror', publisher: 'Ace' },
  { re: /web\s*of\s*mystery/i, key: 'web-of-mystery', title: 'Web of Mystery', kind: 'mystery-horror', publisher: 'Ace' },
  // 실측 오타 'Bafflng' 이 6건 있다(업로더가 i 를 빠뜨렸다). 원본 제목이라 고칠 수 없으니 규칙이 흡수한다 — `i?`.
  { re: /baf+l+i?ng\s*mysteries/i, key: 'baffling-mysteries', title: 'Baffling Mysteries', kind: 'mystery-horror', publisher: 'Ace' },
  { re: /beware\s*terror\s*tales/i, key: 'beware-terror-tales', title: 'Beware! Terror Tales', kind: 'mystery-horror', publisher: 'Fawcett' },
  { re: /this\s*magazine\s*is\s*haunted/i, key: 'this-magazine-is-haunted', title: 'This Magazine Is Haunted', kind: 'mystery-horror', publisher: 'Fawcett' },
  { re: /worlds\s*of\s*fear/i, key: 'worlds-of-fear', title: 'Worlds of Fear', kind: 'mystery-horror', publisher: 'Fawcett' },
  { re: /strange\s*suspense/i, key: 'strange-suspense-stories', title: 'Strange Suspense Stories', kind: 'mystery-horror', publisher: 'Fawcett' },
  { re: /hand\s*of\s*fate/i, key: 'hand-of-fate', title: 'The Hand of Fate', kind: 'mystery-horror', publisher: 'Ace' },
  { re: /^\W*beyond\b|the\s*beyond/i, key: 'the-beyond', title: 'The Beyond', kind: 'mystery-horror', publisher: 'Ace' },
  { re: /unknown\s*world|strange\s*stories\s*from\s*another\s*world/i, key: 'unknown-world', title: 'Unknown World', kind: 'mystery-horror', publisher: 'Fawcett' },
  { re: /challenge\s*of\s*the\s*unknown/i, key: 'challenge-of-the-unknown', title: 'Challenge of the Unknown', kind: 'mystery-horror', publisher: 'Ace' },

  // ── 범죄 수사 ────────────────────────────────────────────────
  { re: /crime\s*must\s*pay/i, key: 'crime-must-pay-the-penalty', title: 'Crime Must Pay the Penalty', kind: 'crime', publisher: 'Ace' },
  { re: /underworld\s*crime/i, key: 'underworld-crime', title: 'Underworld Crime', kind: 'crime', publisher: 'Fawcett' },
  { re: /mike\s*barnett|man\s*against\s*crime/i, key: 'mike-barnett', title: 'Mike Barnett, Man Against Crime', kind: 'crime', publisher: 'Fawcett' },
  { re: /down\s*with\s*crime/i, key: 'down-with-crime', title: 'Down With Crime', kind: 'crime', publisher: 'Fawcett' },
  // Ace 의 후속 개제(改題)판 — Fawcett 의 `Mike Barnett` 과 발행사가 달라 별도 시리즈로 둔다.
  { re: /men\s*against\s*crime/i, key: 'men-against-crime', title: 'Men Against Crime', kind: 'crime', publisher: 'Ace' },
  { re: /^\W*trapped\b|\btrapped!/i, key: 'trapped', title: 'Trapped!', kind: 'crime', publisher: 'Ace' },

  // ── SF ───────────────────────────────────────────────────────
  { re: /captain\s*video/i, key: 'captain-video', title: 'Captain Video', kind: 'scifi', publisher: 'Fawcett' },
  { re: /space\s*action/i, key: 'space-action', title: 'Space Action', kind: 'scifi', publisher: 'Ace' },
  { re: /destination\s*moon/i, key: 'destination-moon', title: 'Destination Moon', kind: 'scifi', publisher: 'Fawcett' },
  { re: /worlds\s*beyond/i, key: 'worlds-beyond', title: 'Worlds Beyond', kind: 'scifi', publisher: 'Fawcett' },
  { re: /vic\s*torry|flying\s*saucer/i, key: 'vic-torry', title: 'Vic Torry and His Flying Saucer', kind: 'scifi', publisher: 'Fawcett' },
  { re: /science\s*comics/i, key: 'science-comics', title: 'Science Comics', kind: 'scifi', publisher: 'Ace' },

  // ── 전쟁 ─────────────────────────────────────────────────────
  { re: /atomic\s*war/i, key: 'atomic-war', title: 'Atomic War!', kind: 'war', publisher: 'Ace' },
  { re: /soldier\s*comics/i, key: 'soldier-comics', title: 'Soldier Comics', kind: 'war', publisher: 'Fawcett' },
  { re: /war\s*heroes/i, key: 'war-heroes', title: 'War Heroes', kind: 'war', publisher: 'Ace' },
  { re: /world\s*war\s*(iii|3)\b/i, key: 'world-war-iii', title: 'World War III', kind: 'war', publisher: 'Ace' },

  // ── 로맨스 ───────────────────────────────────────────────────
  { re: /cowboy\s*love/i, key: 'cowboy-love', title: 'Cowboy Love', kind: 'romance', publisher: 'Fawcett' },
  { re: /glamorous\s*romances/i, key: 'glamorous-romances', title: 'Glamorous Romances', kind: 'romance', publisher: 'Ace' },
  { re: /romantic\s*story/i, key: 'romantic-story', title: 'Romantic Story', kind: 'romance', publisher: 'Fawcett' },
  { re: /romantic\s*secrets/i, key: 'romantic-secrets', title: 'Romantic Secrets', kind: 'romance', publisher: 'Fawcett' },
  // `sweetheart diary` 를 `sweethearts` 보다 먼저 — 별개 간행물인데 접두가 겹친다.
  { re: /sweetheart\s*diary/i, key: 'sweetheart-diary', title: 'Sweetheart Diary', kind: 'romance', publisher: 'Fawcett' },
  { re: /sweethearts/i, key: 'sweethearts', title: 'Sweethearts', kind: 'romance', publisher: 'Fawcett' },
  { re: /complete\s*love/i, key: 'complete-love', title: 'Complete Love Magazine', kind: 'romance', publisher: 'Ace' },
  { re: /all\s*romances/i, key: 'all-romances', title: 'All Romances', kind: 'romance', publisher: 'Ace' },
  { re: /love\s*experiences/i, key: 'love-experiences', title: 'Love Experiences', kind: 'romance', publisher: 'Ace' },
  { re: /life\s*story/i, key: 'life-story', title: 'Life Story', kind: 'romance', publisher: 'Fawcett' },
  { re: /love\s*at\s*first\s*sight/i, key: 'love-at-first-sight', title: 'Love at First Sight', kind: 'romance', publisher: 'Ace' },
  { re: /real\s*love/i, key: 'real-love', title: 'Real Love', kind: 'romance', publisher: 'Ace' },
]

// 자체 점검 — 규칙이 없는 kind 를 쓰면 DB FK 가 아니라 **여기서** 먼저 터지게 한다.
for (const r of SERIES_RULES) {
  if (!KIND_KEYS.has(r.kind)) throw new Error(`taxonomy: 알 수 없는 kind "${r.kind}" (규칙 ${r.key})`)
}

/**
 * 컬렉션 접두·판본 꼬리표를 걷어낸 "판정용" 제목.
 * 스캔 변형 표기(coverless · alt scan · b and w · 24p · fiche …)는 같은 시리즈의 다른 스캔일 뿐이라
 * 시리즈 판정에서 제외한다. 이걸 안 걷으면 같은 시리즈가 표기마다 갈라진다.
 */
/**
 * **읽을 수 있는 한 호가 아닌 것** — 분류 이전에 걸러야 하는 항목.
 *
 * 실측: `Ace Comics Cover Collection` 은 표지만 모은 갤러리라 컷도 대사도 없다.
 * 이런 항목을 시리즈로 분류해 큐에 넣으면 취득·복원·분할을 다 돌린 뒤
 * **대사 0개짜리 호**가 검수 큐에 쌓인다 — 파이프라인 전체를 낭비하고 나서야 알게 된다.
 * 분류가 아니라 적재 입구에서 막는다.
 */
const NOT_AN_ISSUE = /cover\s*(collection|gallery|scans?)\b|\bindex\b|checklist|price\s*guide|catalog(ue)?\s*of/i

/** @returns {string|null} 제외 사유. null 이면 정상 항목. */
export function excludeReason(item) {
  const hay = separatorsToSpace(`${item?.title ?? ''} ${item?.identifier ?? ''}`)
  if (NOT_AN_ISSUE.test(hay)) return '표지 모음·색인 — 읽을 수 있는 호가 아님'
  return null
}

/**
 * 구분자 통일 — 하이픈·언더스코어·점을 공백으로. 규칙 정규식이 `\s*` 하나만 신경 쓰면 되게 한다.
 * (아포스트로피는 남긴다 — `America's Greatest` 처럼 규칙이 실제로 쓰는 문자다.)
 */
export function separatorsToSpace(s) {
  return String(s ?? '').replace(/[._\-–—/]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function normalizeTitle(raw) {
  return String(raw ?? '')
    .replace(/^\s*(fawcett|ace)\s*comics\s*:\s*/i, '')
    .replace(/\((fawcett|ace)\s*comics\)/gi, ' ')
    .replace(/\b(coverless|alt\s*scan|coverless\s*scan|original\s*art|legal\s*notice|re[\s-]*edit|fiche|excerpt|missing(\s*\w+)?|canadian\s*edition|uk\s*edition|b\s*(and|&)\s*w|black\s*and\s*white|\d+\s*p|paper|rescan|upgrade|version\s*\d+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 호수 추출 — 시리즈 안에서 읽는 순서를 만든다.
 *
 * 함정: 만화 제목의 숫자는 호수·연도·페이지수가 뒤섞여 있다.
 *   "Whiz Comics 002 (1940-02) (24p)"  → 호수 2   (연도 1940·페이지 24 를 집으면 안 됨)
 *   "Master Comics 100"                → 호수 100
 *   "Dennis the Menace 031"            → 호수 31
 * 그래서 **연도로 보이는 4자리와 페이지 표기(\d+p)를 먼저 제거한 뒤** 첫 정수를 집고,
 * 만화 호수로 그럴듯한 범위(1~999)만 인정한다.
 */
export function extractIssueNo(raw) {
  const t = String(raw ?? '')
    .replace(/\(\s*\d{4}(-\d{1,2})*\s*\)/g, ' ') // (1940-02)
    .replace(/\b(1[89]\d{2}|20[0-2]\d)\b/g, ' ') // 연도
    .replace(/\b\d+\s*p\b/gi, ' ') // 24p
    .replace(/\bv\d+\b/gi, ' ') // v2 (권 표기)
  const m = t.match(/(?:^|[\s#\-_])(\d{1,3})(?:\b|_)/)
  const n = m ? Number(m[1]) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null
}

/** 미분류 항목의 시리즈 키 — 제목에서 만든다(추정 시리즈를 만들지 않기 위해 접두사를 붙여 표시). */
function fallbackKey(norm) {
  const s = norm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((w) => w && !/^\d+$/.test(w))
    .slice(0, 4)
    .join('-')
  return `unclassified-${s || 'item'}`
}

/**
 * 한 항목 분류.
 * @param {{ title?: string, identifier?: string }} item
 * @returns {{ kind: string, seriesKey: string, seriesTitle: string, issueNo: number|null,
 *             publisher: string|null, matched: boolean }}
 *   `matched:false` = 규칙표 미적중. 학습자 서가에 내보내지 않고 검수 대상으로 남긴다.
 */
export function classify(item) {
  const norm = normalizeTitle(item?.title)
  // 제목이 부실한 업로드가 있어 identifier 도 같이 본다(실측: 제목이 "Classics Illustrated" 뿐인 항목).
  // **구분자를 먼저 공백으로 통일한다** — 규칙마다 `[\s._-]*` 를 적는 대신 건초더미 쪽을 정규화한다.
  // 안 하면 같은 시리즈가 표기별로 갈린다(실측: `Slam-Bang`·`Spy_Smasher_6` 가 미분류로 떨어졌다).
  const hay = separatorsToSpace(`${norm} ${item?.identifier ?? ''}`)
  const rule = SERIES_RULES.find((r) => r.re.test(hay))
  const issueNo = extractIssueNo(norm) ?? extractIssueNo(item?.identifier)

  if (!rule) {
    return {
      kind: 'other',
      seriesKey: fallbackKey(norm || String(item?.identifier ?? '')),
      seriesTitle: norm || String(item?.identifier ?? 'Unknown'),
      issueNo,
      publisher: null,
      matched: false,
    }
  }
  return {
    kind: rule.kind,
    seriesKey: rule.key,
    seriesTitle: rule.title,
    issueNo,
    publisher: rule.publisher ?? null,
    matched: true,
  }
}

/** 시리즈 목록(규칙표 기준) — 마스터 테이블 시딩용. */
export function seriesCatalog() {
  return SERIES_RULES.map((r) => ({
    key: r.key,
    title: r.title,
    kind: r.kind,
    publisher: r.publisher ?? null,
  }))
}
