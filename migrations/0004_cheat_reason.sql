-- Reason shown on the Cheat board. Empty = generic cheat (star / gold spawn).
-- Applied on next deploy (Grok Build runs db:migrate against Neon).
alter table scores add column if not exists cheat_reason text not null default '';

-- Manual review: these fair rows are suspected AI / bot clears.
update scores
set
  cheat = true,
  cheat_reason = 'AI bot detected / suspected'
where cheat = false
  and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) in (
    'sley',
    'garytc',
    'gary tc',
    'nam ai'
  );

create index if not exists scores_cheat_reason_idx
  on scores (difficulty, cheat, cheat_reason);
