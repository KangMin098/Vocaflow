# 학습자 장면 삽화 — 2026-10-19

## 2026-10-21 최신 이미지 품질 재판정

사용자는 v4의 평범한 소품·약한 디테일을 재지적했다. PC의 핵심 장면은 v5로 대체하며, 아래 v4/S12 기록은 이전 승인 이력이다. 자체 삽화94개 전수 판정과 실제/격리 검증 경계는 [감사§0-31](learner-tines-audit.md)을 따른다. 기존9종 목적별 장면, 작은 식별자, 실제 표지/학습 그림은 구분하여 보존했다.

| 제품 파일 | 장면의 구조·구별점 | PC 소비 역할 |
|---|---|---|
| `scene-recall-v5.png` | 방사형 인출 카드·선택 입구·복귀 레일 | 재인·플래시카드 |
| `scene-produce-v5.png` | 조판기·분리된 활자·배열 트레이 | 철자 생성 |
| `scene-listen-v5.png` | 공진판·여러 소리 리본·기록 띠 | 듣기·따라 말하기 |
| `scene-build-v5.png` | 분해/조립 교각·결합부·부품 트레이 | 형태소 조립 |
| `scene-reason-v5.png` | 원문 면·근거 프레임·연결 받침 | 맥락·추론 |
| `scene-fluency-v5.png` | 원형 궤도·리듬 탈진기·연동 바퀴 | 유창성 |
| `scene-library-v5.png` | 책 속 열람 갤러리·페이지 다리·분류 탑 | 서가·읽기 입구 |
| `scene-vault-v5.png` | 레일형 분류 갤러리·자료 구획·펼친 사전 | 단어 보관·수집 |
| `scene-growth-v5.png` | 접힌 경로·층별 창·이어지는 리본 | 성장·회고 |
| `scene-journey-v5.png` | 읽기/소리/조립을 잇는 학습 정거장 | 허브·플랫폼 안내 |

모두 내장 imagegen으로 생성한1536×1024 투명 PNG다. 원본10개17,944,345bytes는 변환/재색칠/강제 알파 수정 없이 저장했다. 실제 전달은 Next Image가 최적화하며 정적 원본 URL은 제작 자산 확인용이다. v4와 이전 변형을 덮어쓰지 않았다. 생성/편집 지시 원문은 [illustration-quality-v5.json](illustration-quality-v5.json)에 보존했다. 실제 크림·다크 지면에서 확인했고, 생성물이 벡터/단일색 픽셀로 완벽하다고 주장하지 않는다.

PC 연습은 주 그림440px·보조156px, 허브 구간 머리는300px로 표현한다. 작은 아이콘을 크게 늘려 디테일을 대신하지 않는다. 전체 계정의 정상 배치·사용자 최종 미감 판단은 공개/격리 검증과 별개다.

2026-10-20 잔여 분리: Game Lab `/arcade`=`scene-arcade-lab-v1`(게임 보드·짝 타일), Dispatches `/library/scripts`=`scene-dispatch-news-v1`(신문·지구본·봉투), `/settings`=`scene-settings-tune-v1`(슬라이더·선택 다이얼·색 견본). 자체 생성 투명 PNG 원본은 `tmp/learner-residual/originals/`, 프롬프트는 `provenance.json`, 전달본 크기/해시는 `assets.json`이다. 1536×1024 WebP로 원래 크기와 알파를 보존했으며 색/배경을 프로그램으로 편집하지 않았다. 기존 자산은 덮어쓰지 않았다. 실제 3000 전후와 12조건은 `tmp/learner-residual/index.html`·감사 §0-23을 따른다. 아래 S13의 Dispatches=journey 및 설정=auth 공유 기록은 이 3곳에서 대체된다.

S18 추가(2026-10-20): `scene-video-v1.webp`는 내장 imagegen으로 새로 생성한 영상 장면이다. 1200×800 WebP로 인코딩하며 생성 알파/색을 보존했고 프로그램으로 배경/색을 편집하지 않았다. 원본과 프롬프트/변환 도구는 로컬 `tmp/s18/`에 보존한다. 실제 영상 포스터·프레임·내용을 생성한 것으로 소개하지 않는다. 외부 원본 포스터가 실패할 때만 장식 대체 이미지로 사용하며 실제 영상 경로/자막은 기존 자료를 유지한다.

사용자 피드백: 진한 색판·단편적 소품·텍스트만 놓인 구획을 줄이고, 화면 구성에 맞춰 다양하고 자세한 이미지를 사용한다. 기존 24장 소품과 별개로 Codex 내장 imagegen에서 자체 삽화 4장을 생성했다. 참조 원본·로고·상용 서체를 넣지 않았다.

| 파일(`apps/web/public/illustrations/tines/`) | 내용 | 용도 |
|---|---|---|
| `scene-library-v4.webp` | 직선 서가·독서대·관절 램프·북카트·책갈피 | 서가의 열린 머리, 읽을거리 구간 |
| `scene-vault-v4.webp` | 분류 서랍·탭 카드·분류함·노트·모래시계 | 단어장 머리, 단어 수집 구간 |
| `scene-growth-v4.webp` | 기록 노트·달력·시간·간격을 둔 경로 | 성장 기록 머리 |
| `scene-journey-v4.webp` | 펼친 책·기능 카드·듣기 헤드폰과 연결선 | 허브 첫 화면, 플랫폼 구간 |
| `scene-comics-v1.webp` | 여섯 기호 패널이 있는 펼친 만화책·낱장 패널·말풍선·연필·책갈피 | 만화 서가·도서 만화 상세의 열린 머리(S14 추가) |
| `scene-auth-v1.webp` | 봉투와 편지·열쇠·계정 카드·펼친 책·분류 탭 | 로그인·가입·재설정·이메일 확인의 열린 안내(S17 추가) |
| `scene-video-v1.webp` | 재생/자막 노트북·릴/조작 다이얼 영사기·책갈피·읽기/듣기/자막 카드 | 영상 목록의 열린 머리·외부 포스터 실패 시 장식 대체(S18 추가) |

1200×800 WebP, 투명 알파를 유지했다. 현행 원본 PNG는 로컬 `tmp/s12/`에 보존하며 실제 제품은 저장소 안 WebP만 사용한다. 사각형 배경을 그리지 않고 지면 위에 장면이 놓인다. 작은 아이콘은 lucide-react 기존 체계를 쓴다. 설명이 있는 제목·링크와 함께 배치한 장식 이미지는 `alt=""`로 두어 같은 내용을 두 번 읽지 않는다.

S10의 v2는 사용자에게 갈색·세이지 색감이 참조와 다르다는 재판정을 받았다. 비교 원본은 `tmp/s10/`에 남기고 제품 호출은 v3로 바꿨다. S11에서는 자체 v2 장면을 편집 대상으로, Tines Product 캡처를 색상·평면 채색 참고로 함께 제공해 내장 imagegen으로 4장을 각각 편집했다. 참조의 장면·로고를 복제하지 않고 기존 자체 구도·사물·디테일을 유지했다.

편집 공통 지시: preserve original composition and meaningful details; use measured lavender `#d3caff`/`#bcabff`, pink `#ff97d0`, mint `#aedac2`/`#57be90`, orange `#ff9f5f`, yellow `#ffd077`, purple outlines `#412478`; lavender furniture instead of brown wood, mint leaves instead of olive; flat fills, no sepia/aged paper/watercolor haze, no new text/logos/solid background; transparent landscape 3:2. 기술상 생성 알파의 중간값을 보존하며 키잉·프로그램 색 치환은 하지 않았다.

팔레트 근거: `tmp/s8/tines/product-0.png`의 삽화 영역 픽셀 표본(`tmp/s11/reference-palette.json`). UI 스킨은 기존 Tines 토큰을 유지하며, 삽화가 참조와 픽셀 단위로 같다고 주장하지 않는다. 전후 비교는 `tmp/s11/compare/index.html`의 같은 구성 격리 미리보기다.

S12의 최신 재판정은 「색감과 삽화 모두 참조에 더 가깝게」다. v3에 남은 촘촘한 식물·빈티지 세공·장식 정원을 줄이고 분리된 사물·균일한 보라 윤곽·명확한 색 면으로 4장을 다시 편집했다. 이전 v3의 주제는 유지하되 구도는 더 열린 사물 묶음으로 바꿨다. 제품 연결은 v4이며 v2/v3 원본은 비교용으로 보존했다.

현행 편집 지시: clean uniform thin purple outlines; broad flat lavender/near-white fields with measured mint/orange/pink accents; separate functional objects with transparent air; functional details such as bookmarks, index tabs, handles, waveforms; remove ornate arches, ivy, flowers, carving, watercolor/hatching/gradient/glow and rendered 3D; no text/logos/background. 자체 v3와 Tines Product 캡처를 제공해 내장 imagegen으로 편집했고, 프로그램으로 색·알파를 강제 치환하지 않았다. 최종 평가는 생성 원본의 검은 투명 뷰어가 아니라 실제 크림/다크 지면에서 한다. 생성 결과가 벡터 파일이거나 모든 색이 단일 픽셀값이라고 주장하지 않는다.

최신 전후 비교는 `tmp/s12/compare/index.html`이며 같은 가상 데이터 구성의 v3→v4다. 사용자는 2026-10-19 「적용,승인」으로 이 색감·삽화 방향을 채택했다. 실제 정상 화면·상호작용·전체90화면의 검증 완료와는 구분한다.

S13 재사용: Dispatches 머리=journey, Decks 머리=vault, Textbooks 머리=library. 교재 영상의 외부 포스터 실패 시 journey를 사용한다. 추가 이미지를 무조건 생성하지 않고 승인 장면과 주제별 lucide 아이콘을 조합했다. 실제 공개 서가의 전후는 `tmp/s13/compare/index.html`이다.

S14 추가: 만화라는 자료 유형이 즉시 읽히도록 내장 imagegen으로 자체 만화 장면1장을 생성했다. 자체 library v4와 Tines Product 캡처를 표현 참고로 제공하고, 동일 팔레트·균일한 보라 윤곽·평면 색·분리된 사물·투명 여백을 지정했다. 생성 지시의 내용은 open comic book with six symbolic panels, two loose panels, empty speech bubble, pencil, mint bookmark; no text, characters, logos, ornate furniture, garden or 3D다. 생성 PNG는 `tmp/s14/scene-comics-v1.png`, 제품은1200×800 WebP이며 프로그램은 크기/인코딩만 바꿨다. 실제 크림·다크 지면에서 확인했다. 장식 장면이며 실패한 원본 표지·만화 컷의 대체 콘텐츠로 사용하지 않는다. 전후는 `tmp/s14/compare/index.html`이다.

S15 재사용: 공개 지문 진단과 공유 결과의 머리는 journey v4를 쓴다. 글/카드라는 기존 주제가 지문 분석과 맞으므로 새 장면을 늘리지 않았다. 단계에는 기존 page/teacher/dashboard 소품, 근거에는 lucide 아이콘, 결과에는 실제 학년별 범위·표식·단어 행을 쓴다. 전후는 `tmp/s15/compare/index.html`이다.

S16 재사용: Game Lab 머리에는 vault v4, 코스에는 lucide Layers3, 각 게임에는 정본 `GAME_MARKS`를 확대해 사용한다. 별도 게임 그림을 생성하지 않고 기존 실제 `BriefBoard`가 규칙3장과 연습 보드를 그린다. 목록의 마크는 보라/민트/살구 틴트, 실제 보드는 기존 게임 표면을 유지한다. 전후는 `tmp/s16/compare/index.html`이다.

S17 추가(2026-10-20): 인증의 역할이 책장 그림만으로는 읽히지 않아 내장 imagegen으로 계정 장면1장을 생성했다. 봉투/편지·열쇠/계정 카드·책/분류 탭을 서로 떨어진 사물로 구성했다. 지시: transparent landscape 3:2, uniform thin purple outlines, broad lavender/cream fields with measured mint/orange/pink/yellow accents; meaningful folds, key teeth, index tabs, bookmark and paper edges; no text/numerals/logos/flowers/ornate furniture/3D/watercolor/glow/background. Tines 원본을 제품에 복제하지 않았으며 기존 승인 표현을 언어로 지정했다. 원본은 `tmp/s17/scene-auth-v1.png`, 제품은1200×800 투명 WebP다. 프로그램은 크기/인코딩만 바꿨고 생성 색/알파를 강제 치환하지 않았다. 최종 크림/다크 지면에서 직접 확인했다. 전후는 `tmp/s17/compare/index.html`이다.
