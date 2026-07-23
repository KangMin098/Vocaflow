-- 부정축약(아포스트로피 탈락) 폐쇄집합 → 조동사 base. 200권 잔여 1,134 등장(dident 335·wouldent 254·wasent 241).
-- 표준형=조동사 base(부정 소실은 note+문맥). dialect tier(표준형 사전해소 게이트)가 소비. 실단어 wont은 direct 우선(무회귀).
insert into dialect_map (variant, standard, note) values
  ('dident','did','didn''t (부정)'),('didnt','did','didn''t (부정)'),('doesnt','do','doesn''t (부정)'),
  ('doesent','do','doesn''t (부정)'),('dont','do','don''t (부정)'),('doant','do','don''t (방언 부정)'),
  ('wasent','was','wasn''t (부정)'),('wasnt','was','wasn''t (부정)'),('isent','is','isn''t (부정)'),
  ('isnt','is','isn''t (부정)'),('arent','are','aren''t (부정)'),('werent','were','weren''t (부정)'),
  ('wernt','were','weren''t (부정)'),('hadent','had','hadn''t (부정)'),('hadnt','had','hadn''t (부정)'),
  ('hasent','has','hasn''t (부정)'),('hasnt','has','hasn''t (부정)'),('havent','have','haven''t (부정)'),
  ('havnt','have','haven''t (부정)'),('wouldent','would','wouldn''t (부정)'),('wouldnt','would','wouldn''t (부정)'),
  ('wouldna','would','wouldn''t (Scots 부정)'),('couldent','could','couldn''t (부정)'),('couldnt','could','couldn''t (부정)'),
  ('couldna','could','couldn''t (Scots 부정)'),('shouldent','should','shouldn''t (부정)'),('shouldnt','should','shouldn''t (부정)'),
  ('shouldna','should','shouldn''t (Scots 부정)'),('cant','can','can''t (부정)'),('canna','can','can''t (Scots 부정)'),
  ('caint','can','can''t (방언 부정)'),('mustnt','must','mustn''t (부정)'),('mustent','must','mustn''t (부정)'),
  ('neednt','need','needn''t (부정)'),('darent','dare','daren''t (부정)'),('dinna','do','don''t/didn''t (Scots 부정)'),
  ('dinnae','do','don''t (Scots 부정)'),('maunna','must','mustn''t (Scots 부정)')
on conflict (variant) do update set standard=excluded.standard, note=excluded.note;
