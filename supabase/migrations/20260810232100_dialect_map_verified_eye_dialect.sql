-- 20260811090000_dialect_map_verified_eye_dialect.sql
-- ADR 0004 D4c — 검증된 eye-dialect 만 dialect_map 에 등록.
--
-- D4b 로 dialect 티어가 coverage-clean 보다 앞서게 됐으므로, 여기 등록하는 순간
-- 읽기 중 탭이 정확한 표준어 뜻을 준다.
--
-- 선정 절차 (자동 아님 — 전수 수기 검토):
--   ① 카탈로그에서 coverage-clean 계열로 해석 중인 단어 중 spelling_norm 에 표준형이 있고
--   ② 그 표준형이 shared_dictionary 정식 표제어(classified_by+meaning_ko)이며
--   ③ proper_noun_forms 에 없는 것 251건을 뽑아
--   ④ 현재 뜻 vs 표준어 뜻을 나란히 놓고 **개선되는 것만** 골랐다.
--
-- 제외한 것들 (spelling_norm 이 자동 생성이라 오매핑이 섞여 있다):
--   de→the(프랑스어 관사) · al→all · les→less · il→ill · ta/te/ter→to · se→see · ly→lie
--   · ing→king · tu→to · sub→substitute · mis→miss · pas→pass · ha→would · hey→heigh
--     → 짧은 파편·외국어·약어. 표준형 연결이 근거 없다.
--   slue→slew · greave→grieve · banquette→banquet
--     → 현재 뜻이 실제로 맞다 (slue=비스듬히 돌리다 · greave=정강이 갑옷 · banquette=벤치).
--   hee→he → hee-hee(웃음소리)일 수 있어 현재 뜻이 더 안전.
--   es→is → 독일어/스페인어 혼동 위험.
--
-- em→they 주의: 목적격 `them` 은 shared_dictionary 정식 표제어가 아니다(아래 참고).
--   dialect 티어가 en_inflection_bases(standard) 도 뒤지므로 주격 `they`(V1, 등재됨)로
--   연결해 "그들" 을 준다. `em` 은 90회 출현하며 현재 "인쇄에 사용되는 선형 단위(1/6인치)".
--
-- 참고 — 별건 결함: shared_dictionary 에 주격 대명사(i·you·he·she·it·we·they·myself·itself)는
--   있는데 목적격·소유격·재귀형(him·her·his·their·them·your·himself·herself)이 **없다**.
--   그래서 thy→your, hisself→himself 매핑이 dialect 티어를 못 탄다(둘 다 현재 답이 방향은
--   맞아 급하지 않음). 대명사 굴절 계열 등재는 VCB 쪽에서 별도로 다뤄야 한다.

INSERT INTO public.dialect_map (variant, standard, note) VALUES
  ('mought',    'might',     'might (방언) — 현재 오역 "5월의"'),
  ('wot',       'what',      'what (방언) — 현재 오역 "1차 및 3차 인원. 노래하다…"'),
  ('whilst',    'while',     'while (고어/영국) — 현재 오역 "황제가 안디옥에 누워 있는 동안"'),
  ('sich',      'such',      'such (방언)'),
  ('dat',       'that',      'that (방언) — 현재 오역 "소리를 녹음한 디지털 테이프(DAT)"'),
  ('der',       'there',     'there (방언)'),
  ('ter',       'to',        'to (방언, 축약 발음)'),
  ('yo',        'you',       'you (방언)'),
  ('dern',      'darn',      'darn (방언) — 현재 오역 "문기둥 또는 문설주"'),
  ('lak',       'like',      'like (방언) — 현재 오역 "라크족 (다게스탄 남부 민족)"'),
  ('inclosure', 'enclosure', 'enclosure (역사 철자)'),
  ('hookey',    'hooky',     'hooky (변이 철자) — 현재 오역 "고리 던지기 게임"'),
  ('sperrit',   'spirit',    'spirit (방언) — 현재 프랑스어 sperrit 로 오해석 "정념"'),
  ('em',        'they',      '''em = them (구어 축약). them 미등재라 주격 they 로 연결 — 현재 오역 "인쇄 단위(1/6인치)"')
ON CONFLICT (variant) DO UPDATE
  SET standard = EXCLUDED.standard,
      note     = EXCLUDED.note;
