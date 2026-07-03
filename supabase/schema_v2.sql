-- ═══════════════════════════════════════════════════════════
--  PET GESTOR — Schema v2 (cole no SQL Editor do Supabase)
--  Rode DEPOIS do schema v1
-- ═══════════════════════════════════════════════════════════

-- ─── ASSINATURAS / COBRANÇA ──────────────────────────────────
create table if not exists public.subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  plan            text not null default 'free',       -- free | pro | premium
  status          text not null default 'active',     -- active | suspended | cancelled
  asaas_id        text,                               -- ID da cobrança no Asaas
  asaas_cust_id   text,                               -- ID do cliente no Asaas
  price_cents     int  not null default 0,
  billing_cycle   text default 'monthly',             -- monthly | yearly
  trial_ends_at   timestamptz default (now() + interval '14 days'),
  current_period_start timestamptz default now(),
  current_period_end   timestamptz default (now() + interval '14 days'),
  cancelled_at    timestamptz,
  created_at      timestamptz default now()
);

-- ─── MOVIMENTAÇÃO DE ESTOQUE ──────────────────────────────────
create table if not exists public.stock_movements (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  type        text not null,   -- entry | exit | adjustment | loss
  qty         numeric(10,3) not null,
  qty_before  numeric(10,3) not null,
  qty_after   numeric(10,3) not null,
  cost        numeric(10,2),
  note        text,
  ref_sale_id uuid references public.sales(id),
  operator_id uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- ─── FUNCIONÁRIOS CONVIDADOS ──────────────────────────────────
create table if not exists public.invites (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  email       text not null,
  role        text not null default 'operator',
  token       text unique not null default encode(gen_random_bytes(24), 'hex'),
  accepted    boolean default false,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

-- ─── RLS para novas tabelas ───────────────────────────────────
alter table public.subscriptions    enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.invites          enable row level security;

create policy "subs_all"    on public.subscriptions   for all using (store_id in (select public.my_store_ids()));
create policy "stock_mv_all" on public.stock_movements for all using (store_id in (select public.my_store_ids()));
create policy "invites_all" on public.invites          for all using (store_id in (select public.my_store_ids()));

-- ─── TRIGGER: registra movimentação ao decrementar estoque ────
create or replace function public.log_stock_movement()
returns trigger language plpgsql as $$
begin
  -- disparado pelo trigger on_sale_item_insert existente
  -- aqui só registramos o movimento
  insert into public.stock_movements(store_id, product_id, type, qty, qty_before, qty_after, ref_sale_id)
  select p.store_id, new.product_id, 'exit', new.qty,
         p.stock + new.qty, p.stock, new.sale_id
  from public.products p where p.id = new.product_id;
  return new;
end;
$$;

-- ─── VIEW: admin master — stats de todas as lojas ─────────────
-- Acesso restrito: só funciona com service_role key no backend
create or replace view public.admin_store_stats as
select
  s.id, s.name, s.city, s.state, s.plan, s.created_at,
  count(distinct sa.id) as total_sales,
  coalesce(sum(sa.total), 0) as total_revenue,
  count(distinct p.id) as total_products,
  sub.status as sub_status,
  sub.current_period_end as plan_expires
from public.stores s
left join public.sales sa on sa.store_id = s.id
left join public.products p on p.store_id = s.id and p.active = true
left join public.subscriptions sub on sub.store_id = s.id
group by s.id, sub.status, sub.current_period_end;

-- ─── FUNÇÃO: criar assinatura trial ao criar loja ─────────────
create or replace function public.on_store_created_v2()
returns trigger language plpgsql security definer as $$
begin
  -- cria assinatura trial gratuita de 14 dias
  insert into public.subscriptions(store_id, plan, status, price_cents,
    trial_ends_at, current_period_end)
  values (new.id, 'free', 'active', 0,
    now() + interval '14 days', now() + interval '14 days');
  return new;
end;
$$;

create trigger store_created_sub_trigger
  after insert on public.stores
  for each row execute procedure public.on_store_created_v2();

-- ─── ATUALIZA plan na store quando assinatura muda ────────────
create or replace function public.sync_store_plan()
returns trigger language plpgsql security definer as $$
begin
  update public.stores set plan = new.plan where id = new.store_id;
  return new;
end;
$$;

create trigger sub_plan_sync
  after insert or update on public.subscriptions
  for each row execute procedure public.sync_store_plan();
