> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_mnemonic_etymology_only.md
> category: feedback

---

사용자 명시(2026-07-17~18, 강한 어조 "절대·네버"): **니모닉/기억술은 오직 어원(어근) 근거 방식만** 허용. **경선식류 발음 말장난은 플랫폼 전체에 절대 금지** — 생성·노출·제안 어디에도 있어서는 안 됨.

**금지 대상 정확 정의(사용자 2026-07-18 명확화)** = **경선식**: 영어 단어의 **발음(소리)을 뜻 없는 한국어 소리로 흉내** 내서 이야기를 만드는 방식. 예: `advocate → 애드보킷 → "애들 보고 캣!"`. 여기서 `애들·보고·캣`은 **뜻이 없고 그냥 영어 소리를 닮은 한국어 소리**. 이게 금지의 본질.
- **허용(어원)**: `advocate → ad(~쪽으로)+voc(목소리) → 목소리를 내다 → 옹호하다`. `ad`,`voc`는 **실제 뜻을 가진 라틴 어근**.
- **차이**: 어원=뜻을 가진 진짜 어근 조각 / 경선식=뜻 없는 소리 흉내.

**Why**: 경선식은 소리에 억지로 끼워맞춰 학습효과·품질 편차 큼. 어원 니모닉은 (1) 논리적 각인 (2) 어근 전이(spec→inspect·prospect·spectator) (3) 어근 gloss 근거로 환각 없음.

**How to apply(경선식을 실제로 막는 법 = 검증 가능성)**:
- 지시("경선식 금지")만으론 약한 제약. **진짜 잠금 = 근거(etymology_text) 대조**: 니모닉에 쓴 어근 조각이 그 단어의 **실제 어원에 등장하는지** 검사. 어원=일치(통과) / 경선식 소리흉내(애들·보고·캣)=실제 어원에 없음→**거부**. 위장한 가짜어근도 어원 불일치로 거부.
- 형식 = `어근(뜻)+어근(뜻) → 다리 → 최종 뜻`(화살표). 근거 없거나 불투명하면 **skip**(억지 생성 금지).
- apply 게이트(기계 검증): (1) 화살표 필수 (2) 라틴 어근 토큰 필수·한글(한글) 소리 괄호 거부 (3) **어근 토큰이 etymology_text에 실제 등장**(diacritic strip 후 substring). 위반=apply 스킵.
- M2(v06.260) 2,358 + M3(v06.268~ etymology_text 근거 멀티세션 확대). 전부 어원 형식(화살표·어근괄호 100%, 경선식 0 검증).
- 도구: `scripts/dict/mnemonic-{chunk,apply}.mjs`(어근 인벤토리 근거) · `mnemonic-etym-{chunk,apply}.mjs`(kaikki etymology_text 근거+대조 게이트).

[[project_etymology_root_axis]] · [[project_dict_commercial_wordset_design_20260717]] 계열. 도구 `scripts/dict/mnemonic-{chunk,apply}.mjs`.

