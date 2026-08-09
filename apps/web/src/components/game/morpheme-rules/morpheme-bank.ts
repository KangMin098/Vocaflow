// apps/web/src/components/game/morpheme-rules/morpheme-bank.ts
// Morpheme Rules 형태소 뱅크 + 회랑 절차 생성기.
//
// 왜 분리했나: 이전 버전은 9문제를 모듈 상수로 하드코딩해 두 번째 판의 정보량이 0이었다.
// 여기서는 접두사 8종 × 어근 28종 격자 위에 실재 단어 61개를 얹어 두고, 매 판 시드로
// 부분 격자(3×3 ~ 4×4)를 잘라낸다. 같은 격자 안에 **실재하지 않는 조합**과
// **실재하지만 이 봉인에 안 맞는 미끼**가 둘 다 남도록 강제하는 것이 생성기의 핵심 계약이다.

export interface Prefix {
  text: string;
  /** 학습자가 '해독'을 써야만 보이는 뜻. 기본 비노출(인출 보호). */
  ko: string;
  /** 오답 직후 가르치는 한 줄 — 왜 그 자리에 못 붙는지. */
  rule: string;
}

export interface Root {
  text: string;
  ko: string;
}

export interface Spell {
  /** 접두사 text */
  p: string;
  /** 어근 text */
  r: string;
  /** 조립된 실재 단어 */
  word: string;
  ko: string;
  /** 봉인 장면 — 뜻을 한국어 사전형으로 주지 않고 '상황'으로만 준다. */
  need: string;
  icon: string;
  done: string;
  /** 봉인이 풀린 뒤 한 줄. */
  effect: string;
}

export const PREFIXES: Prefix[] = [
  { text: 'un', ko: '되돌림·벗겨냄', rule: 'un- 은 이미 된 것을 되돌리거나 벗겨낸다' },
  { text: 're', ko: '다시', rule: 're- 는 한 번 있었던 일을 다시 한다' },
  { text: 'dis', ko: '부정·흩음', rule: 'dis- 는 있던 상태를 부정하거나 흩어 놓는다' },
  // over- 는 두 갈래다: 한도를 넘는 쪽(overload·overpay)과 위에서 덮어 누르는 쪽
  // (oversee·overcast·overwrite). 규칙 한 줄이 앞쪽만 말해서 뒤쪽 주문들이 설명 없이
  // 서 있었다 — 오답 직후 인쇄되는 가르치는 한 줄이므로 두 갈래를 다 담는다.
  { text: 'over', ko: '한도 너머·위에서', rule: 'over- 는 정해진 한도를 넘거나 위에서 덮어 누른다' },
  { text: 'pre', ko: '미리', rule: 'pre- 는 일이 벌어지기 전에 먼저 한다' },
  { text: 'fore', ko: '앞일·앞을', rule: 'fore- 는 앞일을 미리 알거나 앞을 막는다' },
  { text: 'en', ko: '~하게 만들다', rule: 'en- 은 형용사·명사를 "그렇게 만들다"로 바꾼다' },
  { text: 'mis', ko: '어긋나게', rule: 'mis- 는 해야 할 것을 어긋나게 한다' },
];

export const ROOTS: Root[] = [
  { text: 'lock', ko: '잠그다' },
  { text: 'load', ko: '싣다' },
  { text: 'cover', ko: '덮다' },
  { text: 'pack', ko: '싸다' },
  { text: 'wind', ko: '감다' },
  { text: 'fold', ko: '접다' },
  { text: 'do', ko: '하다' },
  { text: 'build', ko: '짓다' },
  { text: 'appear', ko: '나타나다' },
  { text: 'view', ko: '보다·전망' },
  { text: 'cast', ko: '던지다·주조하다' },
  { text: 'tell', ko: '말하다' },
  { text: 'count', ko: '세다' },
  { text: 'place', ko: '놓다' },
  { text: 'charge', ko: '채우다·값을 매기다' },
  { text: 'take', ko: '잡다·가져가다' },
  { text: 'use', ko: '쓰다' },
  { text: 'read', ko: '읽다' },
  { text: 'pay', ko: '치르다' },
  { text: 'write', ko: '글로 쓰다' },
  { text: 'print', ko: '찍어 내다' },
  { text: 'large', ko: '큰' },
  { text: 'rich', ko: '넉넉한' },
  { text: 'close', ko: '닫다' },
  { text: 'code', ko: '부호' },
  { text: 'see', ko: '보다·알다' },
  { text: 'judge', ko: '판단하다' },
  { text: 'lead', ko: '이끌다' },

  // ── v07.10 확장 어근 12종 ────────────────────────────────────────────────
  // 반증 실측: 봉인 단어 61개 중 DB vocabularies(2,034 distinct)와 겹치는 것이 7개뿐이라
  // recordGameResult 가 99.7% silent skip 됐다 — 이 게임은 FSRS 에 사실상 닿지 않았다.
  // DB 에 실제로 있으면서 **자립 어근 + 접두사** 로 정확히 쪼개지는 단어만 골라 넣는다
  // (release=re+lease 같은 가짜 분해는 넣지 않는다 — 잘못 가르치는 것이 더 나쁘다).
  { text: 'like', ko: '좋아하다' },
  { text: 'obey', ko: '따르다' },
  { text: 'courage', ko: '용기' },
  { text: 'mount', ko: '올라타다' },
  { text: 'claim', ko: '권리를 주장하다' },
  { text: 'call', ko: '부르다' },
  { text: 'gain', ko: '얻다' },
  { text: 'turn', ko: '돌리다·돌다' },
  { text: 'run', ko: '달리다' },
  { text: 'shadow', ko: '그림자' },
  { text: 'fortune', ko: '운·재물' },
  { text: 'occupy', ko: '차지하다' },
];

/** 실재 단어 61종. need 는 장면 서술 — 정답 단어의 사전 뜻을 그대로 인쇄하지 않는다. */
export const SPELLS: Spell[] = [
  { p: 'un', r: 'lock', word: 'unlock', ko: '열다', need: '쇠사슬이 감긴 철문이 길을 막는다', icon: '🔒', done: '🔓', effect: '문이 열렸다' },
  { p: 'un', r: 'load', word: 'unload', ko: '짐을 내리다', need: '수레가 짐에 눌려 꼼짝하지 않는다', icon: '🛒', done: '🪶', effect: '수레가 가벼워졌다' },
  { p: 'un', r: 'cover', word: 'uncover', ko: '드러내다', need: '두꺼운 천이 제단을 덮어 정체를 감춘다', icon: '🎪', done: '🏺', effect: '제단이 드러났다' },
  { p: 'un', r: 'pack', word: 'unpack', ko: '풀어 꺼내다', need: '필요한 도구가 봇짐 안에 묶여 있다', icon: '🎒', done: '🧰', effect: '도구를 꺼냈다' },
  { p: 'un', r: 'wind', word: 'unwind', ko: '되감아 풀다', need: '태엽이 끝까지 감겨 굳어버렸다', icon: '🧶', done: '🌀', effect: '태엽이 풀렸다' },
  { p: 'un', r: 'fold', word: 'unfold', ko: '펼치다', need: '접힌 지도가 길을 감추고 있다', icon: '🗺', done: '🧭', effect: '지도가 펼쳐졌다' },
  { p: 'un', r: 'do', word: 'undo', ko: '되돌리다', need: '방금 둔 한 수가 세계를 뒤틀었다', icon: '🪤', done: '🕊', effect: '세계가 제자리로' },

  { p: 're', r: 'build', word: 'rebuild', ko: '재건하다', need: '다리가 무너져 강을 건널 수 없다', icon: '🧱', done: '🌉', effect: '다리가 다시 섰다' },
  { p: 're', r: 'load', word: 'reload', ko: '다시 싣다', need: '화살통이 텅 비었다', icon: '🏹', done: '🎯', effect: '화살을 채웠다' },
  { p: 're', r: 'cover', word: 'recover', ko: '되찾다·회복하다', need: '수호자가 쓰러져 힘을 잃었다', icon: '🩹', done: '💪', effect: '힘을 되찾았다' },
  { p: 're', r: 'appear', word: 'reappear', ko: '다시 나타나다', need: '길잡이 불꽃이 꺼져 사라졌다', icon: '🫧', done: '🕯', effect: '불꽃이 돌아왔다' },
  { p: 're', r: 'view', word: 'review', ko: '다시 살피다', need: '흐릿한 기록에 단서가 숨어 있다', icon: '📜', done: '📖', effect: '단서를 찾았다' },
  { p: 're', r: 'cast', word: 'recast', ko: '다시 주조하다', need: '금 간 검을 녹여 다시 부어야 한다', icon: '🗡', done: '⚔️', effect: '검이 새로 벼려졌다' },
  { p: 're', r: 'tell', word: 'retell', ko: '다시 말하다', need: '잊힌 전설을 다시 들려줘야 문이 열린다', icon: '🗣', done: '📢', effect: '전설이 되살아났다' },
  { p: 're', r: 'count', word: 'recount', ko: '다시 세다', need: '문지기가 셈이 안 맞는다며 막아선다', icon: '🔢', done: '✅', effect: '셈이 맞았다' },
  { p: 're', r: 'place', word: 'replace', ko: '대체하다', need: '톱니 하나가 부서져 자리가 비었다', icon: '🧩', done: '⚙️', effect: '톱니를 갈아 끼웠다' },
  { p: 're', r: 'charge', word: 'recharge', ko: '재충전하다', need: '수정 등의 빛이 꺼져간다', icon: '🔋', done: '⚡', effect: '빛이 되살아났다' },
  { p: 're', r: 'take', word: 'retake', ko: '되찾다', need: '빼앗긴 깃발이 적진에 꽂혀 있다', icon: '🚩', done: '🏳️', effect: '깃발을 되찾았다' },
  { p: 're', r: 'use', word: 'reuse', ko: '재사용하다', need: '남은 재료가 아직 쓸 만하다', icon: '🧪', done: '♻️', effect: '재료를 다시 썼다' },
  { p: 're', r: 'pack', word: 'repack', ko: '다시 싸다', need: '짐이 삐져나와 좁은 문을 지나지 못한다', icon: '🧳', done: '📦', effect: '짐을 다시 쌌다' },
  { p: 're', r: 'wind', word: 'rewind', ko: '되감다', need: '태엽 시계를 거꾸로 돌려야 한다', icon: '⏱', done: '⏪', effect: '시간이 되감겼다' },
  { p: 're', r: 'read', word: 'reread', ko: '다시 읽다', need: '한 번 읽어선 뜻이 잡히지 않는 주문서', icon: '📕', done: '📗', effect: '뜻이 잡혔다' },
  { p: 're', r: 'pay', word: 'repay', ko: '갚다', need: '뱃사공이 묵은 빚부터 갚으라 한다', icon: '💰', done: '🪙', effect: '빚을 갚았다' },
  { p: 're', r: 'do', word: 'redo', ko: '다시 하다', need: '매듭이 엉켜 처음부터 다시 묶어야 한다', icon: '🪢', done: '🎀', effect: '매듭이 정갈해졌다' },
  { p: 're', r: 'write', word: 'rewrite', ko: '고쳐 쓰다', need: '잘못 새겨진 문장이 세계를 어긋나게 한다', icon: '✍️', done: '📝', effect: '문장을 바로잡았다' },
  { p: 're', r: 'print', word: 'reprint', ko: '다시 찍어 내다', need: '한 장뿐인 지도를 일행 수만큼 찍어야 한다', icon: '🖨', done: '🗞', effect: '지도를 더 찍었다' },

  { p: 'dis', r: 'appear', word: 'disappear', ko: '사라지다', need: '두꺼운 벽이 길을 완전히 막는다', icon: '🚧', done: '💨', effect: '벽이 사라졌다' },
  { p: 'dis', r: 'cover', word: 'discover', ko: '발견하다', need: '지도에 없는 샛길이 있다는 소문이 돈다', icon: '🔎', done: '🛤', effect: '샛길을 찾았다' },
  { p: 'dis', r: 'place', word: 'displace', ko: '밀어내다', need: '거대한 바위가 통로 한복판에 놓였다', icon: '🪨', done: '🕳', effect: '바위를 밀어냈다' },
  { p: 'dis', r: 'charge', word: 'discharge', ko: '방출하다', need: '축전지에 갇힌 번개가 웅웅댄다', icon: '🔌', done: '🌩', effect: '번개가 빠져나갔다' },
  { p: 'dis', r: 'count', word: 'discount', ko: '값을 깎다', need: '상인이 통행료를 터무니없이 부른다', icon: '🏷', done: '💵', effect: '값을 깎았다' },
  { p: 'dis', r: 'close', word: 'disclose', ko: '밝히다', need: '증인이 입을 굳게 다물고 있다', icon: '🤐', done: '🗨', effect: '증언을 얻었다' },

  { p: 'over', r: 'load', word: 'overload', ko: '과부하시키다', need: '멈추지 않는 기계를 한계 너머로 몰아야 한다', icon: '🏭', done: '🛑', effect: '기계가 멈췄다' },
  { p: 'over', r: 'take', word: 'overtake', ko: '앞지르다', need: '앞선 전령을 따라잡아야 한다', icon: '🐎', done: '🏁', effect: '전령을 앞질렀다' },
  { p: 'over', r: 'charge', word: 'overcharge', ko: '과충전하다', need: '문을 열려면 수정에 힘을 넘치도록 부어야 한다', icon: '💎', done: '💥', effect: '문이 터져 열렸다' },
  { p: 'over', r: 'use', word: 'overuse', ko: '남용하다', need: '주문을 한도 넘게 써서 마력을 태워버려야 한다', icon: '🪄', done: '🔥', effect: '마력이 타올랐다' },
  { p: 'over', r: 'see', word: 'oversee', ko: '감독하다', need: '일꾼들이 제멋대로라 일이 진척되지 않는다', icon: '👷', done: '👁', effect: '일이 정돈됐다' },
  { p: 'over', r: 'view', word: 'overview', ko: '전체를 굽어보다', need: '숲에 갇혀 전체 지형이 보이지 않는다', icon: '🏞', done: '🔭', effect: '지형이 한눈에' },
  { p: 'over', r: 'pay', word: 'overpay', ko: '웃돈을 치르다', need: '뱃사공이 정가로는 안 간다고 버틴다', icon: '💸', done: '🚤', effect: '배가 움직였다' },
  { p: 'over', r: 'write', word: 'overwrite', ko: '덮어쓰다', need: '옛 기록이 새 진실을 가리고 있다', icon: '📄', done: '🖋', effect: '기록을 덮어썼다' },
  { p: 'over', r: 'cast', word: 'overcast', ko: '흐리게 뒤덮다', need: '눈부신 빛에 눈을 뜰 수 없다', icon: '☀️', done: '☁️', effect: '하늘이 흐려졌다' },

  { p: 'pre', r: 'view', word: 'preview', ko: '미리 보다', need: '안개에 가린 앞 통로가 위험하다', icon: '🌫', done: '🔮', effect: '앞이 보인다' },
  { p: 'pre', r: 'judge', word: 'prejudge', ko: '미리 단정하다', need: '심문이 끝나기 전에 결론을 내야 한다', icon: '⚖️', done: '🔨', effect: '결론이 먼저 났다' },
  { p: 'pre', r: 'load', word: 'preload', ko: '미리 싣다', need: '출발 전에 화물을 채워 둬야 한다', icon: '🚚', done: '🧺', effect: '미리 실었다' },
  { p: 'pre', r: 'pay', word: 'prepay', ko: '선불하다', need: '통행증은 값을 먼저 치러야 나온다', icon: '🎫', done: '🪪', effect: '통행증을 받았다' },

  { p: 'fore', r: 'cast', word: 'forecast', ko: '예보하다', need: '다가올 폭풍을 미리 알려야 한다', icon: '🌪', done: '🌤', effect: '폭풍을 예보했다' },
  { p: 'fore', r: 'tell', word: 'foretell', ko: '예언하다', need: '신탁이 앞일을 말해 달라 한다', icon: '🗿', done: '✨', effect: '앞일을 말했다' },
  { p: 'fore', r: 'see', word: 'foresee', ko: '예견하다', need: '함정이 어디 있을지 미리 알아야 한다', icon: '🧿', done: '🌟', effect: '함정이 보였다' },
  { p: 'fore', r: 'close', word: 'foreclose', ko: '미리 닫아 막다', need: '추격자가 오기 전에 뒷길을 닫아야 한다', icon: '🚪', done: '🔐', effect: '뒷길이 닫혔다' },

  { p: 'en', r: 'large', word: 'enlarge', ko: '확대하다', need: '발판이 너무 작아 발을 디딜 수 없다', icon: '🔩', done: '🟦', effect: '발판이 커졌다' },
  { p: 'en', r: 'rich', word: 'enrich', ko: '풍요롭게 하다', need: '메마른 밭에서 아무것도 자라지 않는다', icon: '🌱', done: '🌾', effect: '밭이 살아났다' },
  { p: 'en', r: 'close', word: 'enclose', ko: '둘러싸다', need: '흩어진 짐승들이 자꾸 달아난다', icon: '🐑', done: '🛖', effect: '울타리가 생겼다' },
  { p: 'en', r: 'code', word: 'encode', ko: '부호로 바꾸다', need: '전갈이 적의 손에 넘어갈 수 있다', icon: '📩', done: '🔏', effect: '전갈을 부호로' },
  { p: 'en', r: 'fold', word: 'enfold', ko: '감싸다', need: '얼어붙은 아이가 떨고 있다', icon: '🥶', done: '🧣', effect: '아이를 감쌌다' },

  { p: 'mis', r: 'take', word: 'mistake', ko: '오인하다', need: '변장한 첩자를 딴 사람으로 착각하게 만들어야 한다', icon: '🎭', done: '🕵️', effect: '첩자를 놓쳤다' },
  { p: 'mis', r: 'place', word: 'misplace', ko: '엉뚱한 곳에 두다', need: '간수의 열쇠를 엉뚱한 곳에 두게 해야 한다', icon: '🗝', done: '🫥', effect: '열쇠가 사라졌다' },
  { p: 'mis', r: 'count', word: 'miscount', ko: '잘못 세다', need: '보초가 인원을 한 치도 틀리지 않고 센다', icon: '🧮', done: '😵‍💫', effect: '셈이 어긋났다' },
  { p: 'mis', r: 'judge', word: 'misjudge', ko: '잘못 판단하다', need: '심판관이 우리 편을 꿰뚫어 본다', icon: '👨‍⚖️', done: '🌀', effect: '판단이 흐려졌다' },
  { p: 'mis', r: 'use', word: 'misuse', ko: '잘못 쓰다', need: '적의 지팡이를 엉뚱하게 쓰게 만들어야 한다', icon: '🦯', done: '💫', effect: '지팡이가 헛돌았다' },
  { p: 'mis', r: 'lead', word: 'mislead', ko: '엉뚱한 길로 이끌다', need: '추격대를 다른 길로 보내야 한다', icon: '🐺', done: '🌲', effect: '추격대가 멀어졌다' },
  { p: 'mis', r: 'read', word: 'misread', ko: '잘못 읽다', need: '문지기가 통행증을 꼼꼼히 읽고 있다', icon: '📚', done: '😵', effect: '문지기가 헷갈렸다' },

  // ── v07.10 확장 주문 18종 (학습자 단어장 실측 기반) ───────────────────────
  // 선정 기준 3가지를 모두 만족하는 것만 넣었다.
  //   ① DB vocabularies 에 실제로 있는 단어이거나, 같은 어근을 공유해 격자를 채우는 짝
  //   ② 접두사 + 자립 어근으로 형태론적으로 정확히 쪼개진다
  //   ③ 뱅크 안 다른 주문과 뜻이 겹치지 않는다(장면이 두 답을 허용하면 불공정하다)
  { p: 'dis', r: 'like', word: 'dislike', ko: '싫어하다', need: '수문장이 이 향을 마음에 들어 해 문 앞을 뜨지 않는다', icon: '🌸', done: '🤢', effect: '수문장이 자리를 떴다' },
  { p: 'dis', r: 'obey', word: 'disobey', ko: '거역하다', need: '멈추라는 명령이 발을 묶는다', icon: '📯', done: '🙅', effect: '명령을 거슬렀다' },
  { p: 'dis', r: 'courage', word: 'discourage', ko: '기를 꺾다', need: '적의 사기가 하늘을 찌른다', icon: '🔥', done: '😔', effect: '적의 기가 꺾였다' },
  { p: 'en', r: 'courage', word: 'encourage', ko: '북돋우다', need: '동료가 겁에 질려 주저앉았다', icon: '😰', done: '🦁', effect: '동료가 일어섰다' },
  { p: 'dis', r: 'mount', word: 'dismount', ko: '내려서다', need: '굴 입구가 낮아 말을 탄 채로는 못 지난다', icon: '🐴', done: '🚶', effect: '말에서 내렸다' },
  { p: 'dis', r: 'claim', word: 'disclaim', ko: '관련을 부인하다', need: '남의 죄가 우리 이름으로 적혀 있다', icon: '🪧', done: '🫱', effect: '이름을 지워 냈다' },
  { p: 're', r: 'claim', word: 'reclaim', ko: '되찾아 오다', need: '빼앗긴 땅문서가 저들 금고에 있다', icon: '🧾', done: '🏔', effect: '땅문서를 되찾았다' },
  { p: 're', r: 'mount', word: 'remount', ko: '다시 올라타다', need: '떨어졌던 안장이 다시 채워졌다 — 추격을 이어야 한다', icon: '🪜', done: '🐎', effect: '다시 말에 올랐다' },
  { p: 're', r: 'call', word: 'recall', ko: '다시 불러들이다', need: '먼저 보낸 정찰대가 함정 쪽으로 가고 있다', icon: '📣', done: '🫡', effect: '정찰대가 돌아왔다' },
  { p: 're', r: 'gain', word: 'regain', ko: '다시 얻다', need: '한 번 깨진 신뢰가 성문을 닫아 두고 있다', icon: '🤝', done: '💠', effect: '신뢰를 다시 얻었다' },
  { p: 're', r: 'turn', word: 'return', ko: '돌려주다·돌아가다', need: '빌린 열쇠를 주인에게 돌려줘야 길이 열린다', icon: '🛎', done: '🙇', effect: '열쇠를 돌려줬다' },
  { p: 'over', r: 'turn', word: 'overturn', ko: '엎어 뒤집다', need: '독이 든 솥이 그대로 끓고 있다', icon: '🍯', done: '🌊', effect: '솥을 엎었다' },
  { p: 'over', r: 'run', word: 'overrun', ko: '넘쳐 뒤덮다', need: '작은 틈으로 들어간 것들이 성을 뒤덮어야 한다', icon: '🐜', done: '🏰', effect: '성이 뒤덮였다' },
  { p: 're', r: 'run', word: 'rerun', ko: '다시 돌리다', need: '멈춰 선 물레방아를 처음부터 다시 돌려야 한다', icon: '📽', done: '🎞', effect: '물레방아가 다시 돌았다' },
  { p: 'over', r: 'shadow', word: 'overshadow', ko: '가려 무색하게 하다', need: '옆 봉화가 너무 밝아 우리 신호가 묻히지 않는다', icon: '🌞', done: '🌒', effect: '옆 봉화가 묻혔다' },
  { p: 'fore', r: 'shadow', word: 'foreshadow', ko: '앞일을 비추다', need: '닥칠 일을 그림자로 미리 비춰 보여야 한다', icon: '🌘', done: '🖼', effect: '앞일이 비쳤다' },
  { p: 'mis', r: 'fortune', word: 'misfortune', ko: '불운', need: '저들의 점괘가 지나치게 길하다', icon: '🍀', done: '🌑', effect: '점괘가 뒤틀렸다' },
  { p: 'pre', r: 'occupy', word: 'preoccupy', ko: '미리 마음을 붙들다', need: '보초가 교대 전에 딴 데 정신이 팔려야 한다', icon: '💭', done: '🌫', effect: '보초가 딴생각에 잠겼다' },
];

export const PREFIX_BY_TEXT: Record<string, Prefix> = Object.fromEntries(PREFIXES.map((p) => [p.text, p]));
export const ROOT_BY_TEXT: Record<string, Root> = Object.fromEntries(ROOTS.map((r) => [r.text, r]));
export const SPELL_BY_KEY: Record<string, Spell> = Object.fromEntries(SPELLS.map((s) => [`${s.p}+${s.r}`, s]));

const PREFIX_KEYS = PREFIXES.map((p) => p.text);
const ROOT_KEYS = ROOTS.map((r) => r.text);

const SPELLS_BY_ROOT: Record<string, Spell[]> = (() => {
  const m: Record<string, Spell[]> = {};
  for (const r of ROOT_KEYS) m[r] = [];
  for (const s of SPELLS) m[s.r].push(s);
  return m;
})();

// ─── 시드 RNG ─────────────────────────────────────────────────────────────
// 같은 시드 = 같은 4회랑. '같은 세트 다시'(복수전)와 '새 세트'를 분리할 수 있게.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rshuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 회랑 ─────────────────────────────────────────────────────────────────

export interface Seal {
  id: string;
  spell: Spell;
}

export interface Corridor {
  index: number;
  title: string;
  sub: string;
  prefixes: Prefix[];
  roots: Root[];
  seals: Seal[];
  /** 정답 1건당 되찾는 시간(ms). 회랑이 깊어질수록 준다. */
  rewardMs: number;
  /** 없는 말을 발동했을 때 잃는 시간(ms). */
  penaltyMs: number;
}

interface CorridorCfg {
  nPre: number;
  nRoot: number;
  seals: number;
  /** 격자 안 실재 단어 목표 수 — 봉인 수보다 커야 '미끼'가 생긴다. */
  targetValid: number;
  rewardMs: number;
  penaltyMs: number;
  title: string;
  sub: string;
}

// v07.10 — 보상 곡선을 킷의 가산 상한 안으로 넣었다.
//
// useCountdown 은 "가산 총량 ≤ 총 제한시간의 75%" 를 강제한다(세션이 무한히 늘어나지
// 않도록). 이전 곡선(9/8/7/6 + 회랑 통과 5, 확신 +2×3)은 완주 시 129초를 요청하는데
// 상한은 97.5초였다 → **회랑 4의 봉인 2~4번과 통과 보너스, 확신 보너스 전부가 0초**로
// 들어갔다. 화면은 그동안 "+6초"라고 계속 인쇄했다(시뮬 실측: 완주당 거짓 표기 6건 ·
// 25.5초). 잘하는 학습자일수록 보상이 사라지는, 방향이 뒤집힌 설계이기도 했다.
//
// 조정: 총 제한시간 140초(상한 105초) · 보상 9/8/5/3 · 통과 3초 · 확신 +2×3
//   = 최대 요청 101초 ≤ 105초 → 거짓 표기 0건.
// 난이도는 그대로다(사람 속도 모델 n=4,000/셀 시뮬): 전 회랑 통과율
//   p=0.7 93.7% → 94.0% · p=0.55 53.7% → 55.0% · 평균 봉인 12.50 → 12.50.
// 보상 감쇠가 가팔라진 만큼(9→8→5→3) 깊은 회랑의 "시간이 안 돌아온다"는 긴장은 커진다.
export const CORRIDOR_CFG: CorridorCfg[] = [
  { nPre: 3, nRoot: 3, seals: 3, targetValid: 5, rewardMs: 9000, penaltyMs: 5000, title: '봉인된 회랑', sub: '장면이 원하는 뜻을 형태소로 만들어 발동해라.' },
  { nPre: 3, nRoot: 4, seals: 3, targetValid: 6, rewardMs: 8000, penaltyMs: 6000, title: '흩어진 방', sub: '실재하는 말이 늘었다 — 뜻까지 맞아야 통한다.' },
  { nPre: 4, nRoot: 4, seals: 4, targetValid: 8, rewardMs: 5000, penaltyMs: 6000, title: '시간의 계단', sub: '미끼가 많다. 확신할 때만 확신해라.' },
  { nPre: 4, nRoot: 4, seals: 4, targetValid: 9, rewardMs: 3000, penaltyMs: 7000, title: '마지막 문', sub: '시간은 줄고 미끼는 늘었다.' },
];

export const TOTAL_SEALS = CORRIDOR_CFG.reduce((n, c) => n + c.seals, 0);

interface Pick {
  prefixes: string[];
  roots: string[];
  valid: Spell[];
  cost: number;
}

function countValid(pset: Set<string>, root: string): number {
  return SPELLS_BY_ROOT[root].reduce((n, s) => n + (pset.has(s.p) ? 1 : 0), 0);
}

// ─── 학습자 단어장 연결 ────────────────────────────────────────────────────
//
// v07.10. 이전 bias 는 `en.includes(root)` 부분문자열이었다. 실 DB(vocabularies 2,106행)
// 에서 이 규칙은 'do'→abandon/doctor/anecdote, 'read'→already/spread, 'tell'→intelligent
// 처럼 오탐이 지배적이라 "내 단어와 연결됐다"가 사실상 무작위였다.
//
// 지금은 **정확 일치만** 쓴다 — 세 경로 모두 양쪽 형태소가 큐레이션된 것이라 오탐이 0이다:
//   ① 학습자 단어가 어근 자체와 같다        (cover, place, …)
//   ② 학습자 단어가 뱅크 주문과 같다        (discover → 어근 cover)
//   ③ 학습자 단어가 접두사+어근과 같다      (unread 처럼 뱅크에 없는 조합도 어근은 유효)
//
// 자동 형태소 분해(임의 단어를 접두사+나머지로 쪼개기)는 **일부러 하지 않는다**.
// 실제로 돌려보면 release=re+lease, display=dis+play, remain=re+main, repair=re+pair,
// disease=dis+ease, prepare=pre+pare 처럼 '진짜 단어 + 진짜 접두사'인데 형태론적으로는
// 틀린 분해가 대량으로 나온다. 잘못 가르치는 것은 안 가르치는 것보다 나쁘다.
export interface SessionBias {
  /** 회랑 격자에 우선 배치할 어근. */
  roots: Set<string>;
  /** 학습자 단어장에 실제로 있는 단어(소문자). 봉인 우선 선정 + FSRS 적재 대상. */
  words: Set<string>;
}

export function deriveBias(pool: { en: string }[] | undefined): SessionBias {
  const words = new Set<string>();
  const roots = new Set<string>();
  if (!pool || pool.length === 0) return { roots, words };
  for (const w of pool) {
    const en = w.en.trim().toLowerCase();
    if (en) words.add(en);
  }
  for (const r of ROOT_KEYS) if (words.has(r)) roots.add(r); // ①
  for (const s of SPELLS) if (words.has(s.word)) roots.add(s.r); // ②
  for (const p of PREFIX_KEYS) for (const r of ROOT_KEYS) if (words.has(p + r)) roots.add(r); // ③
  return { roots, words };
}

// ─── 봉인 접두사 다양성 (익스플로짓 3) ─────────────────────────────────────
//
// 반증 실측: 봉인 전원이 같은 접두사인 회랑이 회랑1 기준 15.1%. 그러면 첫 봉인에서
// 접두사를 알아낸 순간 나머지는 어근 n지선다로 줄어 형태론 판단 자체가 사라진다.
// 이전 가드(:300-307)는 "어근이 안 겹치는 대체 주문"을 찾다가 없으면 조용히 포기했다 —
// 좁은 격자에서 그 대체는 대개 없으므로 가드가 사실상 꺼져 있었다.
//
// 지금은 두 단계에서 막는다:
//   (a) 격자 단계 — '접두사도 어근도 서로 다른' 주문을 몇 개까지 뽑을 수 있는지
//       이분 최대매칭으로 **실제로 계산**해, 목표 종수를 못 만드는 격자는 아예 거른다.
//   (b) 선정 단계 — 그 매칭을 먼저 깔고 남은 자리를 채운다(포기 경로 없음).
const PREFIX_DIVERSITY_TARGET = 3;

function prefixTarget(cfg: CorridorCfg): number {
  return Math.min(cfg.seals, cfg.nPre, PREFIX_DIVERSITY_TARGET);
}

/** valid 안에서 접두사·어근이 모두 서로 다른 주문을 최대 몇 개 뽑을 수 있나(이분 최대매칭). */
function maxDistinctMatch(valid: Spell[]): number {
  const byPre = new Map<string, string[]>();
  for (const s of valid) {
    const a = byPre.get(s.p);
    if (a) a.push(s.r);
    else byPre.set(s.p, [s.r]);
  }
  const matchRoot = new Map<string, string>();
  const augment = (p: string, seen: Set<string>): boolean => {
    for (const r of byPre.get(p) ?? []) {
      if (seen.has(r)) continue;
      seen.add(r);
      const cur = matchRoot.get(r);
      if (cur === undefined || augment(cur, seen)) {
        matchRoot.set(r, p);
        return true;
      }
    }
    return false;
  };
  let m = 0;
  for (const p of byPre.keys()) if (augment(p, new Set())) m++;
  return m;
}

/**
 * 격자를 고른다. 계약:
 *  (a) 실재 단어 수 ≥ 봉인 수 + 2  → 반드시 미끼가 존재한다.
 *  (b) 실재 단어 수 < 전체 칸 수    → 반드시 '없는 말' 칸이 존재한다.
 *  (c) 접두사 다양성 목표를 실제로 달성 가능한 격자여야 한다(strict 2 에서만 강제).
 * 조건을 못 맞추면 단계적으로 완화한다(항상 판이 성립하도록).
 */
function choosePick(rng: () => number, cfg: CorridorCfg, bias: SessionBias, strict: number): Pick | null {
  let best: Pick | null = null;
  const cells = cfg.nPre * cfg.nRoot;
  const minValid = strict >= 2 ? cfg.seals + 2 : strict === 1 ? cfg.seals + 1 : cfg.seals;
  const wantPre = prefixTarget(cfg);
  // '더 볼 필요 없는' 격자 비용 — 미끼 밀도 정확 + 학습자 단어 3개(또는 가능한 만큼) 포함.
  // 단어장이 비면 exitCost = 0 이라 기존과 같은 속도로 즉시 빠진다.
  // 실측(4,000 세션 시뮬): 전수 탐색 대비 세션 생성 16.4ms → 1.4ms, 학습자 단어 봉인 9.21 → 7.52개.
  const ownGlobal = SPELLS.reduce((n, s) => n + (bias.words.has(s.word) ? 1 : 0), 0);
  const exitCost = -Math.min(cfg.seals, 3, ownGlobal) * 1.2;

  for (let a = 0; a < 40; a++) {
    const prefixes = rshuffle(rng, PREFIX_KEYS).slice(0, cfg.nPre);
    const pset = new Set(prefixes);
    const cand = ROOT_KEYS.map((r) => ({ r, n: countValid(pset, r) })).filter((x) => x.n > 0);
    if (cand.length < cfg.nRoot) continue;

    for (let b = 0; b < 24; b++) {
      const picked = rshuffle(rng, cand).slice(0, cfg.nRoot);
      const total = picked.reduce((n, x) => n + x.n, 0);
      if (total < minValid) continue;
      if (strict >= 2 && total >= cells) continue;
      const roots = picked.map((x) => x.r);
      const rset = new Set(roots);
      const valid = SPELLS.filter((s) => pset.has(s.p) && rset.has(s.r));
      // 봉인은 어근이 겹치지 않게 뽑는다 → 서로 다른 어근이 최소 seals 개 필요.
      const distinctRoots = new Set(valid.map((s) => s.r)).size;
      if (distinctRoots < cfg.seals) continue;
      const biasHit = roots.filter((r) => bias.roots.has(r)).length;
      const ownHit = valid.reduce((n, s) => n + (bias.words.has(s.word) ? 1 : 0), 0);
      // 격자 비용: 미끼 밀도 목표에서 벗어난 만큼 벌점, 학습자 어근·단어는 감점(우대).
      // 학습자 단어 가중치(1.2)를 어근(0.7)보다 크게 둔 이유 — 봉인이 학습자 단어일 때만
      // recordGameResult 가 실제로 카드를 갱신한다(그 외는 vocabularies 미존재로 skip).
      const cost = Math.abs(total - cfg.targetValid) - biasHit * 0.7 - Math.min(ownHit, cfg.seals) * 1.2;
      if (best && cost >= best.cost) continue; // 최대매칭 계산 전에 걸러 비용을 아낀다
      if (strict >= 2 && maxDistinctMatch(valid) < wantPre) continue;
      best = { prefixes, roots, valid, cost };
      if (cost <= exitCost) return best;
    }
  }
  return best;
}

/**
 * 봉인 선정 — 어근 중복 없이, 접두사는 목표 종수 이상, 학습자 단어는 우선.
 * 최대매칭을 먼저 깔기 때문에 "대체가 없어 조용히 포기"하는 경로가 존재하지 않는다.
 */
function selectSeals(rng: () => number, valid: Spell[], cfg: CorridorCfg, bias: SessionBias): Spell[] {
  const wantPre = Math.min(prefixTarget(cfg), maxDistinctMatch(valid));
  const ownValid = valid.filter((s) => bias.words.has(s.word));
  const wantOwn = Math.min(cfg.seals, new Set(ownValid.map((s) => s.r)).size);

  let best: Spell[] = [];
  let bestRank = -1;

  for (let t = 0; t < 16; t++) {
    // 학습자 단어를 앞으로(안정 정렬) — 접두사 다양성 목표를 깨지 않는 선에서만 반영된다.
    const ordered = rshuffle(rng, valid).sort((a, b) => (bias.words.has(b.word) ? 1 : 0) - (bias.words.has(a.word) ? 1 : 0));
    const seals: Spell[] = [];
    const usedRoots = new Set<string>();
    const usedPre = new Set<string>();
    // ① 접두사·어근 모두 새로운 것 — 다양성을 먼저 확보한다.
    for (const s of ordered) {
      if (seals.length >= cfg.seals) break;
      if (usedRoots.has(s.r) || usedPre.has(s.p)) continue;
      seals.push(s);
      usedRoots.add(s.r);
      usedPre.add(s.p);
    }
    // ② 어근만 새로운 것 — 남은 자리를 채운다(접두사 재사용 허용).
    for (const s of ordered) {
      if (seals.length >= cfg.seals) break;
      if (usedRoots.has(s.r)) continue;
      seals.push(s);
      usedRoots.add(s.r);
      usedPre.add(s.p);
    }
    // ③ 격자가 극단적으로 좁을 때만 어근 중복 허용(실측 0회 — 판이 멈추지 않게 하는 보험).
    for (const s of ordered) {
      if (seals.length >= cfg.seals) break;
      if (seals.includes(s)) continue;
      seals.push(s);
    }

    const dp = new Set(seals.map((s) => s.p)).size;
    const own = seals.reduce((n, s) => n + (bias.words.has(s.word) ? 1 : 0), 0);
    // 다양성이 우선(×100), 학습자 단어는 그 안에서의 우대.
    const rank = Math.min(dp, wantPre) * 100 + own;
    if (rank > bestRank) {
      bestRank = rank;
      best = seals;
    }
    if (dp >= wantPre && own >= wantOwn) break;
  }
  return best;
}

function buildCorridor(rng: () => number, index: number, bias: SessionBias): Corridor {
  const cfg = CORRIDOR_CFG[index];
  const pick = choosePick(rng, cfg, bias, 2) ?? choosePick(rng, cfg, bias, 1) ?? choosePick(rng, cfg, bias, 0);

  // 이론상 도달 불가(어근 28종 중 유효 조합이 늘 충분하다)이지만, 게임이 절대 멈추면
  // 안 되므로 손으로 검증한 안전 격자를 최후 폴백으로 둔다.
  const safePrefixes = cfg.nPre === 3 ? ['re', 'un', 'dis'] : ['re', 'un', 'dis', 'over'];
  const safeRoots = cfg.nRoot === 3 ? ['cover', 'load', 'appear'] : ['cover', 'load', 'charge', 'place'];
  const prefixes = pick ? pick.prefixes : safePrefixes;
  const roots = pick ? pick.roots : safeRoots;
  const pset = new Set(prefixes);
  const rset = new Set(roots);
  const valid = pick ? pick.valid : SPELLS.filter((s) => pset.has(s.p) && rset.has(s.r));
  const seals = selectSeals(rng, valid, cfg, bias);

  return {
    index,
    title: cfg.title,
    sub: cfg.sub,
    prefixes: rshuffle(rng, prefixes).map((t) => PREFIX_BY_TEXT[t]),
    roots: rshuffle(rng, roots).map((t) => ROOT_BY_TEXT[t]),
    seals: rshuffle(rng, seals).map((spell, i) => ({ id: `c${index}s${i}`, spell })),
    rewardMs: cfg.rewardMs,
    penaltyMs: cfg.penaltyMs,
  };
}

/** 시드 하나로 4회랑 전부를 만든다. bias 는 학습자 단어장 정확 일치 결과(deriveBias). */
export function makeSession(seed: number, bias: SessionBias): Corridor[] {
  const rng = mulberry32(seed);
  return CORRIDOR_CFG.map((_, i) => buildCorridor(rng, i, bias));
}

/**
 * 학습자 단어장에 이 단어가 실제로 있으면 그 항목 — 없으면 null.
 *
 * 이전에는 `en.includes(root)` 폴백이 있어서 실 DB 에서 undo 옆에 '내 단어장 · abandon'
 * 이 떴다. 거짓 연결은 Context-Dependent 를 돕기는커녕 학습자를 헷갈리게 한다.
 */
export function findOwnWord(pool: { en: string; ko: string }[] | undefined, word: string) {
  if (!pool || pool.length === 0) return null;
  const lower = word.toLowerCase();
  return pool.find((w) => w.en.trim().toLowerCase() === lower) ?? null;
}

export { ROOT_KEYS, PREFIX_KEYS };
