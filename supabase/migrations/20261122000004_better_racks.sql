-- Racks were sometimes junk (one dealt four T's and could make no 5-letter word).
-- Now: at most two of any letter, and the rack must make at least 8 dictionary words of
-- 5+ letters, or it is re-dealt (up to 25 tries).
create or replace function public.deal_rack() returns text
language plpgsql volatile set search_path = public as $$
declare
  vowels constant text := 'aaaaaaaaaeeeeeeeeeeeeiiiiiiiiioooooooouuuu';
  consonants constant text :=
    'bbccddddffggghhjkllllmmnnnnnnppqrrrrrrssssttttttvvwwxyyz';
  nv int;
  tiles text[];
  ch text;
  rack text;
  n int;
begin
  for attempt in 1..25 loop
    nv := 3 + floor(random() * 2)::int;
    tiles := '{}';
    while array_length(tiles, 1) is distinct from 10 loop
      if coalesce(array_length(tiles, 1), 0) < nv then
        ch := substr(vowels, 1 + floor(random() * length(vowels))::int, 1);
      else
        ch := substr(consonants, 1 + floor(random() * length(consonants))::int, 1);
      end if;
      if (select count(*) from unnest(tiles) t where t = ch) < 2 then
        tiles := tiles || ch;
      end if;
    end loop;
    rack := (select string_agg(t, '' order by random()) from unnest(tiles) t);
    select count(*) into n from (
      select 1 from dictionary d
      where length(d.word) >= 5 and d.word ~ ('^[' || rack || ']+$') and fits_rack(d.word, rack)
      limit 8) s;
    if n >= 8 then return rack; end if;
  end loop;
  return rack;
end $$;
revoke execute on function public.deal_rack() from public, anon, authenticated;
