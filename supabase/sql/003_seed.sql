-- 003_seed.sql
-- Seed initial coral species (placeholder data)

begin;

insert into public.coral_species (common_name, latin_name)
values
  ('Elkhorn coral', 'Acropora palmata'),
  ('Brain coral', 'Diploria labyrinthiformis'),
  ('Bubble coral', 'Plerogyra sinuosa'),
  ('Mushroom coral', 'Fungia fungites'),
  ('Acropora palmata', 'Acropora palmata'),
  ('Grooved brain coral', 'Diploria strigosa'),
  ('Tube coral', 'Tubastraea coccinea'),
  ('Black coral', 'Antipatharia'),
  ('Finger coral', 'Porites porites'),
  ('Star coral', 'Montastraea cavernosa')
on conflict do nothing;

commit;

