-- 고빈도 잔여 curate — 정착 방언·오철자·loanword를 확정 해소(제안모드→정식). 표준형 게이트로 정밀.
-- 음성 제안모드 검토 결과: 고빈도 잔여의 제안 정밀 ~60%(고유명사·외국어 혼입). 확정 가능한 것만 spelling_norm/dialect_map 승격.
-- 고유명사(balu)·SF조어(neutroid)·외국어(menzil)·약어(acct) 제외. +47 lemma/1,021 등장.
insert into spelling_norm (variant, standard, source) values
  ('probily','probably','curated'),('hyeh','here','curated'),('onct','once','curated'),
  ('diffrunt','different','curated'),('nivver','never','curated'),('gandher','gander','curated'),
  ('terble','terrible','curated'),('tarrible','terrible','curated'),('thim','them','curated'),
  ('invatation','invitation','curated'),('unlest','unless','curated'),('hawss','horse','curated'),
  ('cept','except','curated'),('contrack','contract','curated'),('contrackter','contractor','curated'),
  ('beffore','before','curated'),('befoh','before','curated'),('realy','really','curated'),
  ('gitten','gotten','curated'),('stumach','stomach','curated'),('chancet','chance','curated'),
  ('garrage','garage','curated'),('nout','nought','curated'),('snuck','sneak','curated'),
  ('awfu','awful','curated'),('salery','salary','curated'),('juss','just','curated'),
  ('tommorow','tomorrow','curated'),('archateck','architect','curated'),('ett','ate','curated'),
  ('youd','you','curated'),('wessel','vessel','curated'),('huntert','hunter','curated'),
  ('sausige','sausage','curated'),('edicated','educated','curated'),('suport','support','curated'),
  ('measter','master','curated'),('byby','baby','curated'),('sheykh','sheikh','curated'),
  ('crickit','cricket','curated'),('divilment','devilment','curated'),('deppend','depend','curated'),
  ('ireverent','irreverent','curated'),('continted','contented','curated'),('loight','light','curated'),
  ('organizd','organized','curated'),('yunderstanding','understanding','curated')
on conflict (variant) do nothing;
insert into dialect_map (variant, standard, note) values
  ('doan','do','don''t (방언 부정)')
on conflict (variant) do update set standard=excluded.standard;
