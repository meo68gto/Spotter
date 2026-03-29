-- EPIC 18 Phase 2: Financials, Invoicing, Waitlist, Contests
-- Adds tables for P&L tracking, sponsor invoicing, waitlist management, and contest tracking

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Invoice enums and tables
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded');

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  tournament_id uuid references public.organizer_events(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'usd',
  paid_at timestamptz,
  stripe_payment_intent_id text,
  notes text,
  created_by uuid references public.organizer_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  total_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Payouts table
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  tournament_id uuid references public.organizer_events(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status public.payout_status not null default 'pending',
  stripe_transfer_id text,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Operator financials view (aggregated P&L per event)
create or replace view public.operator_financials as
select
  oe.organizer_id,
  oe.id as tournament_id,
  oe.name as tournament_name,
  oe.event_date,
  coalesce(sum(case when oer.payment_status = 'paid' then 1 else 0 end), 0)::integer as paid_registrations,
  coalesce(sum(case when oer.payment_status = 'paid' then oer.amount_paid_cents else 0 end), 0) as registration_revenue_cents,
  coalesce(sum(sc.value_cents), 0) as sponsor_revenue_cents,
  (coalesce(sum(case when oer.payment_status = 'paid' then oer.amount_paid_cents else 0 end), 0) * 0.10)::integer as platform_fees_cents,
  (
    coalesce(sum(case when oer.payment_status = 'paid' then oer.amount_paid_cents else 0 end), 0)
    + coalesce(sum(sc.value_cents), 0)
    - (coalesce(sum(case when oer.payment_status = 'paid' then oer.amount_paid_cents else 0 end), 0) * 0.10)::integer
  ) as net_revenue_cents,
  coalesce(sum(case when po.status = 'paid' then po.amount_cents else 0 end), 0) as payouts_cents,
  coalesce(sum(case when po.status in ('pending', 'processing') then po.amount_cents else 0 end), 0) as pending_payout_cents
from organizer_events oe
left join organizer_event_registrations oer on oer.event_id = oe.id
left join sponsor_contracts sc on sc.tournament_id = oe.id and sc.status = 'active'
left join payouts po on po.tournament_id = oe.id
group by oe.organizer_id, oe.id, oe.name, oe.event_date;

-- 4. Waitlist queue
create type public.waitlist_status as enum ('waiting', 'offered', 'accepted', 'declined', 'expired');

create table if not exists public.waitlist_queue (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.organizer_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position integer not null,
  status public.waitlist_status not null default 'waiting',
  offered_at timestamptz,
  offer_expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tournament_id, user_id)
);

-- 5. Contests
create type public.contest_type as enum ('closest_to_pin', 'longest_drive', 'straightest_shot', 'skin', 'putting', 'custom');
create type public.contest_status as enum ('open', 'closed', 'cancelled');

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.organizer_events(id) on delete cascade,
  name text not null,
  description text,
  contest_type public.contest_type not null default 'custom',
  status public.contest_status not null default 'open',
  prize_description text,
  prize_value_cents integer,
  hole_number integer,
  winner_user_id uuid references public.users(id) on delete set null,
  winner_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Indexes
create index idx_invoices_organizer on public.invoices(organizer_id);
create index idx_invoices_sponsor on public.invoices(sponsor_id) where sponsor_id is not null;
create index idx_invoices_status on public.invoices(status) where status in ('sent', 'overdue');
create index idx_invoice_line_items_invoice on public.invoice_line_items(invoice_id);
create index idx_payouts_organizer on public.payouts(organizer_id);
create index idx_payouts_status on public.payouts(status) where status = 'pending';
create index idx_waitlist_tournament_position on public.waitlist_queue(tournament_id, position) where status = 'waiting';
create index idx_contests_tournament on public.contests(tournament_id);

-- 7. RLS policies for new tables
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payouts enable row level security;
alter table public.waitlist_queue enable row level security;
alter table public.contests enable row level security;

-- Operators can only see/manage their own invoices
create policy invoices_select on public.invoices for select using (
  exists (
    select 1 from public.organizer_members om
    where om.organizer_id = invoices.organizer_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

create policy invoices_insert on public.invoices for insert with check (
  exists (
    select 1 from public.organizer_members om
    where om.organizer_id = invoices.organizer_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

create policy invoices_update on public.invoices for update using (
  exists (
    select 1 from public.organizer_members om
    where om.organizer_id = invoices.organizer_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

create policy invoice_line_items_select on public.invoice_line_items for select using (
  exists (
    select 1 from public.invoices inv
    join public.organizer_members om on om.organizer_id = inv.organizer_id
    where inv.id = invoice_line_items.invoice_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

create policy invoice_line_items_all on public.invoice_line_items for all using (
  exists (
    select 1 from public.invoices inv
    join public.organizer_members om on om.organizer_id = inv.organizer_id
    where inv.id = invoice_line_items.invoice_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

create policy payouts_select on public.payouts for select using (
  exists (
    select 1 from public.organizer_members om
    where om.organizer_id = payouts.organizer_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

create policy payouts_insert on public.payouts for insert with check (
  exists (
    select 1 from public.organizer_members om
    where om.organizer_id = payouts.organizer_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

create policy waitlist_select on public.waitlist_queue for select using (
  exists (
    select 1 from public.organizer_events oe
    join public.organizer_members om on om.organizer_id = oe.organizer_id
    where oe.id = waitlist_queue.tournament_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

create policy waitlist_modify on public.waitlist_queue for all using (
  exists (
    select 1 from public.organizer_events oe
    join public.organizer_members om on om.organizer_id = oe.organizer_id
    where oe.id = waitlist_queue.tournament_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

create policy contests_select on public.contests for select using (
  exists (
    select 1 from public.organizer_events oe
    join public.organizer_members om on om.organizer_id = oe.organizer_id
    where oe.id = contests.tournament_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

create policy contests_modify on public.contests for all using (
  exists (
    select 1 from public.organizer_events oe
    join public.organizer_members om on om.organizer_id = oe.organizer_id
    where oe.id = contests.tournament_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin', 'manager')
  )
);

-- ============================================
-- DOWN MIGRATION
-- ============================================
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoice_line_items_select on public.invoice_line_items;
drop policy if exists invoice_line_items_all on public.invoice_line_items;
drop policy if exists payouts_select on public.payouts;
drop policy if exists payouts_insert on public.payouts;
drop policy if exists waitlist_select on public.waitlist_queue;
drop policy if exists waitlist_modify on public.waitlist_queue;
drop policy if exists contests_select on public.contests;
drop policy if exists contests_modify on public.contests;

drop index if exists idx_contests_tournament;
drop index if exists idx_waitlist_tournament_position;
drop index if exists idx_payouts_status;
drop index if exists idx_payouts_organizer;
drop index if exists idx_invoice_line_items_invoice;
drop index if exists idx_invoices_status;
drop index if exists idx_invoices_sponsor;
drop index if exists idx_invoices_organizer;

drop table if exists public.contests;
drop table if exists public.waitlist_queue;
drop table if exists public.payouts;
drop table if exists public.invoice_line_items;
drop table if exists public.invoices;

drop type if exists public.contest_status;
drop type if exists public.contest_type;
drop type if exists public.waitlist_status;
drop type if exists public.payout_status;
drop type if exists public.invoice_status;

drop view if exists public.operator_financials;
