-- =============================================================================
-- Steward V1 Remaining Features Migration  (v2 — safe to re-run)
-- =============================================================================
-- IMPORTANT: household_id is added to milestones FIRST (before policies)
-- because the table may already exist from a prior partial migration.
-- =============================================================================


-- =============================================================================
-- STEP 0: PATCH PRE-EXISTING milestones TABLE (add household_id if absent)
-- Must come before any policy that references household_id.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'milestones'
      and column_name  = 'household_id'
  ) then
    alter table milestones
      add column household_id uuid references households(id) on delete set null;
    create index if not exists milestones_household_id_idx on milestones(household_id);
  end if;
end
$$;


-- =============================================================================
-- SECTION 1: MILESTONES TABLE  (create only if it doesn't exist yet)
-- =============================================================================

create table if not exists milestones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references households(id) on delete set null,
  name            text not null,
  icon            text not null default 'flag-outline',
  target_amount   numeric not null,
  saved_amount    numeric not null default 0,
  monthly_saving  numeric not null default 0,
  deadline_months integer,
  created_at      timestamptz not null default now()
);

create index if not exists milestones_user_id_idx      on milestones(user_id);
create index if not exists milestones_household_id_idx on milestones(household_id);

alter table milestones enable row level security;

drop policy if exists "milestones: owner read"     on milestones;
drop policy if exists "milestones: owner insert"   on milestones;
drop policy if exists "milestones: owner update"   on milestones;
drop policy if exists "milestones: owner delete"   on milestones;
drop policy if exists "milestones: household read"   on milestones;
drop policy if exists "milestones: household insert" on milestones;
drop policy if exists "milestones: household update" on milestones;
drop policy if exists "milestones: household delete" on milestones;

create policy "milestones: owner read"
  on milestones for select using (auth.uid() = user_id);

create policy "milestones: owner insert"
  on milestones for insert with check (auth.uid() = user_id);

create policy "milestones: owner update"
  on milestones for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "milestones: owner delete"
  on milestones for delete using (auth.uid() = user_id);

create policy "milestones: household read"
  on milestones for select
  using (household_id is not null and is_household_member(household_id));

create policy "milestones: household insert"
  on milestones for insert
  with check (household_id is not null and is_household_member(household_id));

create policy "milestones: household update"
  on milestones for update
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));

create policy "milestones: household delete"
  on milestones for delete
  using (household_id is not null and is_household_member(household_id));


-- =============================================================================
-- SECTION 2: SINKING FUNDS TABLE
-- =============================================================================

create table if not exists sinking_funds (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  household_id   uuid references households(id) on delete set null,
  name           text not null,
  icon           text not null default 'wallet-outline',
  color          text not null default '#ebc076',
  target_amount  numeric not null,
  saved_amount   numeric not null default 0,
  monthly_target numeric not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists sinking_funds_user_id_idx      on sinking_funds(user_id);
create index if not exists sinking_funds_household_id_idx on sinking_funds(household_id);

alter table sinking_funds enable row level security;

drop policy if exists "sinking_funds: owner read"     on sinking_funds;
drop policy if exists "sinking_funds: owner insert"   on sinking_funds;
drop policy if exists "sinking_funds: owner update"   on sinking_funds;
drop policy if exists "sinking_funds: owner delete"   on sinking_funds;
drop policy if exists "sinking_funds: household read"   on sinking_funds;
drop policy if exists "sinking_funds: household insert" on sinking_funds;
drop policy if exists "sinking_funds: household update" on sinking_funds;
drop policy if exists "sinking_funds: household delete" on sinking_funds;

create policy "sinking_funds: owner read"
  on sinking_funds for select using (auth.uid() = user_id);

create policy "sinking_funds: owner insert"
  on sinking_funds for insert with check (auth.uid() = user_id);

create policy "sinking_funds: owner update"
  on sinking_funds for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sinking_funds: owner delete"
  on sinking_funds for delete using (auth.uid() = user_id);

create policy "sinking_funds: household read"
  on sinking_funds for select
  using (household_id is not null and is_household_member(household_id));

create policy "sinking_funds: household insert"
  on sinking_funds for insert
  with check (household_id is not null and is_household_member(household_id));

create policy "sinking_funds: household update"
  on sinking_funds for update
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));

create policy "sinking_funds: household delete"
  on sinking_funds for delete
  using (household_id is not null and is_household_member(household_id));


-- =============================================================================
-- SECTION 3: TRANSACTIONS TABLE
-- =============================================================================

create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  type         text not null check (type in ('income', 'expense')),
  amount       numeric not null,
  category     text not null,
  note         text,
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists transactions_user_id_idx      on transactions(user_id);
create index if not exists transactions_household_id_idx on transactions(household_id);
create index if not exists transactions_user_date_idx    on transactions(user_id, date desc);

alter table transactions enable row level security;

drop policy if exists "transactions: owner read"     on transactions;
drop policy if exists "transactions: owner insert"   on transactions;
drop policy if exists "transactions: owner update"   on transactions;
drop policy if exists "transactions: owner delete"   on transactions;
drop policy if exists "transactions: household read"   on transactions;
drop policy if exists "transactions: household insert" on transactions;
drop policy if exists "transactions: household update" on transactions;
drop policy if exists "transactions: household delete" on transactions;

create policy "transactions: owner read"
  on transactions for select using (auth.uid() = user_id);

create policy "transactions: owner insert"
  on transactions for insert with check (auth.uid() = user_id);

create policy "transactions: owner update"
  on transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions: owner delete"
  on transactions for delete using (auth.uid() = user_id);

create policy "transactions: household read"
  on transactions for select
  using (household_id is not null and is_household_member(household_id));

create policy "transactions: household insert"
  on transactions for insert
  with check (household_id is not null and is_household_member(household_id));

create policy "transactions: household update"
  on transactions for update
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));

create policy "transactions: household delete"
  on transactions for delete
  using (household_id is not null and is_household_member(household_id));


-- =============================================================================
-- SECTION 4: ADD subscription COLUMN TO profiles
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'subscription'
  ) then
    alter table profiles
      add column subscription text not null default 'free'
        check (subscription in ('free', 'premium'));
  end if;
end
$$;
