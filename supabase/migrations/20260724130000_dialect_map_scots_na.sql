-- Scots -na/-nae 부정 완성 폐쇄집합 → 조동사 base. 이전 부정축약(couldna·wouldna·canna·dinna) 누락분 보완.
-- 표준형 사전해소 게이트로 정밀(arena·henna 등 실단어는 direct 우선, 무회귀). 200권 +49 등장(Scots 텍스트 일반화).
insert into dialect_map (variant, standard, note) values
  ('wasna','was','wasna (Scots wasn''t)'),('wasnae','was','wasnae (Scots wasn''t)'),
  ('wisna','was','wisna (Scots wasn''t)'),('wisnae','was','wisnae (Scots wasn''t)'),
  ('didna','did','didna (Scots didn''t)'),('didnae','did','didnae (Scots didn''t)'),
  ('isna','is','isna (Scots isn''t)'),('isnae','is','isnae (Scots isn''t)'),
  ('hadna','had','hadna (Scots hadn''t)'),('hadnae','had','hadnae (Scots hadn''t)'),
  ('hasna','has','hasna (Scots hasn''t)'),('hasnae','has','hasnae (Scots hasn''t)'),
  ('wadna','would','wadna (Scots wouldn''t)'),('wadnae','would','wadnae (Scots wouldn''t)'),
  ('disna','do','disna (Scots doesn''t)'),('disnae','do','disnae (Scots doesn''t)'),
  ('winna','will','winna (Scots won''t)'),('winnae','will','winnae (Scots won''t)'),
  ('willna','will','willna (Scots won''t)'),('willnae','will','willnae (Scots won''t)'),
  ('sanna','shall','sanna (Scots shan''t)'),('needna','need','needna (Scots needn''t)'),
  ('michtna','might','michtna (Scots mightn''t)'),('binna','be','binna (Scots be not)'),
  ('arena','are','arena (aren''t)'),('werena','were','werena (weren''t)'),
  ('havena','have','havena (haven''t)'),('hivna','have','hivna (Scots haven''t)'),
  ('amna','am','amna (Scots am not)'),('couldnae','could','couldnae (Scots couldn''t)'),
  ('wouldnae','would','wouldnae (Scots wouldn''t)'),('shouldnae','should','shouldnae (Scots shouldn''t)'),
  ('cannae','can','cannae (Scots can''t)')
on conflict (variant) do update set standard=excluded.standard, note=excluded.note;
