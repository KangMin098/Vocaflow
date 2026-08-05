# 만화 저작·하드닝 규칙 원장 (self-improving ratchet)

> 평가(lint·preflight·QC·교차·T3)에서 나온 교훈을 **매번 이 원장에 규칙으로 승격**한다.
> 다음 스크립트는 이 규칙을 **처음부터** 적용하므로, 스테이지가 쌓일수록 시작 품질이 올라간다.
> "발견 → 규칙화 → 가능하면 lint/NEG/코드로 자동화 → 버전업."

## 규칙 (버전 누적)

### v1 — Stave 1 에서 승격 (전부 lint/NEG/코드로 자동화됨)
- **R1 색상어 금지**(scene): red/blue/… → 잉크 표현. *(lint-script 자동)*
- **R2 베이크 텍스트 금지**(scene): "reading X"·따옴표·ALLCAPS 간판 금지 → 빈 판 + HTML 캡션. *(lint 자동)*
- **R3 무배경 금지**: "plain white background"·isolated·checkerboard 금지, 구체 배경 강제. *(lint + NEG)*
- **R4 메타 프리픽스 금지**: scene 은 "drawn as…" 로 시작 금지(INK/HARDBW 가 담당). *(lint 자동)*
- **R5 화자=화면 내 인물**: 모든 speech 의 화자는 그 패널에 등장. 화면 밖 화자는 narration 으로. *(lint 자동)*
- **R6 캡션 ≤2 블록/패널** (인지부하). *(lint warn)*
- **R7 edit 참조 = 단일뷰 + 중앙 자동크롭**: 다중뷰 시트는 2번째 인물 누출 → 단일 전신 1인 + buildRef 중앙 52% 크롭. *(comic-prompt + gen-comfy 자동)*
- **R8 seed 랜덤화**: 재생성이 다른 이미지가 되도록(교정수리 전제). *(gen-comfy 자동)*
- **R9 캐릭터 차별화 락**: 헷갈리는 두 인물은 canonical + distinct_from 로 시각 분리(예: Scrooge 불투명·대머리 vs Marley 반투명·턱붕대·돈사슬).

### v2 — Stave 2 에서 승격 (신규)
- **R10 나이 변형 = 별도 캐스트**: 같은 인물의 다른 生涯 단계(늙은 Scrooge vs 젊은 Scrooge)는 **별개 cast 항목**(`young_scrooge`)으로 둔다. 하나의 참조로 두 나이를 못 낸다. distinct_from 에 "젊고 머리 있음 — 늙은 대머리 아님" 명시.
- **R11 추상/비인간 캐릭터 시그니처 락**: 유령·정령은 **재현 불가한 2~3개 표식**을 canonical 에 고정하고 등장 패널마다 주입(예: 과거의 유령 = 머리 정수리에서 솟는 촛불 + 순백 로브 + child-old). 표식이 흔들리면 정체성 붕괴.
- **R12 소품 정합(prop coherence)**: 캡션이 언급한 소품(홀리·사슬·촛불끄개)은 scene 에도 반드시 존재해야 한다. 캡션 "holly branch in its hand" ↔ scene "빈 손" 같은 모순 금지. *(preflight S0.5 가 생성 전 검출)*
- **R13 단역(minor) 화자 처리**: cast 참조가 없는 단역(Fan·남편·Mrs Fezziwig)이 말하면 → 그 단역을 **scene 에 그려서 화면에 있게 하고**(t2i/noref 로) 화자로 두거나, 대사를 narration 으로 전환. (R5 의 확장.)

## 자동화 상태
| 규칙 | 자동 강제 | 수단 |
|---|---|---|
| R1–R6, R10(부분) | ✅ | `lint-script.mjs` |
| R3 | ✅ | NEG(`comic-prompt.mjs`) |
| R7,R8 | ✅ | `gen-comfy.mjs` |
| R12 | ✅ | `preflight.mjs`(S0.5) |
| R9,R11,R13 | 🟡 저작 규율(부분 lint) | 저자/Claude 준수 |

## 다음 승격 후보 (열려 있음)
- R11 을 lint 로: 스테이지의 각 유령/정령 cast 에 signature 표식 필드 필수화.
- 다중 인물 패널 = 다중 참조(image1/2/3) 지원(현재 단일 참조 → 2인 비트는 R13 로 우회).
