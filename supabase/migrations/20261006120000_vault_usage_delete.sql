-- =============================================================================
-- 0011 · Cancellare un account con dati nel cloud
-- =============================================================================
-- Problema trovato nella revisione di sicurezza del 6/10/2026: cancellando un
-- utente (pannello di Supabase o futura "cancella account"), le sue righe di
-- vault_records spariscono a cascata e il contatore dello spazio provava a
-- riscrivere una riga di vault_usage per un utente che non esiste più: errore
-- di chiave esterna e cancellazione bloccata.
-- Ora una riga tolta aggiorna solo il contatore che c'è già (se c'è ancora).
-- Prova: src/lib/storage/schema.test.ts ("cancellare un account").

create or replace function public.vault_usage_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_delta bigint;
  v_bytes bigint;
begin
  if tg_op = 'DELETE' then
    -- Mai un inserimento qui: durante la cancellazione dell'account l'utente non esiste più.
    update public.vault_usage
       set bytes = greatest(bytes - octet_length(old.payload), 0)
     where user_id = old.user_id;
    return null;
  end if;

  v_user := new.user_id;
  v_delta := octet_length(new.payload) - (case when tg_op = 'UPDATE' then octet_length(old.payload) else 0 end);
  insert into public.vault_usage (user_id, bytes) values (v_user, greatest(v_delta, 0))
  on conflict (user_id) do update set bytes = greatest(public.vault_usage.bytes + v_delta, 0)
  returning bytes into v_bytes;
  if v_delta > 0 and auth.uid() is not null and v_bytes > 268435456 then
    raise exception 'Spazio dell''account esaurito.' using errcode = 'RL002';
  end if;
  return null;
end;
$$;
