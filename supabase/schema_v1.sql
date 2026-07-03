-- ═══════════════════════════════════════════════════════════
--  PET GESTOR — Schema Supabase (Multi-tenant SaaS)
--  Cole este SQL no SQL Editor do seu projeto Supabase
-- ═══════════════════════════════════════════════════════════

-- EXTENSÕES
create extension if not exists "uuid-ossp";

-- ─── LOJAS (cada cliente = 1 loja = 1 tenant) ───────────────
create table if not exists public.stores (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text unique not null,          -- ex: "petshop-silva"
  phone       text,
  city        text,
  state       text default 'CE',
  plan        text not null default 'free',  -- free | pro | premium
  plan_expires_at timestamptz,
  logo_emoji  text default '🐾',
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ─── PRODUTOS ────────────────────────────────────────────────
create table if not exists public.products (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  category    text not null default 'racao',
  species     text not null default 'todos',
  price       numeric(10,2) not null default 0,
  cost        numeric(10,2) not null default 0,
  stock       numeric(10,3) not null default 0,
  min_stock   numeric(10,3) not null default 5,
  unit        text not null default 'un',
  emoji       text default '📦',
  barcode     text,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── CAIXA ───────────────────────────────────────────────────
create table if not exists public.cash_sessions (
  id            uuid primary key default uuid_generate_v4(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  opened_by     uuid references auth.users(id),
  opened_at     timestamptz default now(),
  closed_at     timestamptz,
  initial_amount numeric(10,2) default 0,
  final_amount   numeric(10,2),
  status        text default 'open'  -- open | closed
);

-- ─── VENDAS ──────────────────────────────────────────────────
create table if not exists public.sales (
  id            uuid primary key default uuid_generate_v4(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  cash_session_id uuid references public.cash_sessions(id),
  operator_id   uuid references auth.users(id),
  customer_name text default 'Consumidor Final',
  subtotal      numeric(10,2) not null,
  discount      numeric(10,2) default 0,
  total         numeric(10,2) not null,
  payment       text not null default 'PIX',
  status        text default 'completed',   -- completed | cancelled
  created_at    timestamptz default now()
);

-- ─── ITENS DA VENDA ──────────────────────────────────────────
create table if not exists public.sale_items (
  id          uuid primary key default uuid_generate_v4(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid references public.products(id),
  product_name text not null,
  qty         numeric(10,3) not null,
  unit_price  numeric(10,2) not null,
  unit_cost   numeric(10,2) default 0,
  total       numeric(10,2) not null
);

-- ─── DESPESAS ────────────────────────────────────────────────
create table if not exists public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  description text not null,
  category    text not null default 'despesa',
  amount      numeric(10,2) not null,
  expense_date date not null default current_date,
  created_at  timestamptz default now()
);

-- ─── USUÁRIOS DA LOJA (funcionários) ─────────────────────────
create table if not exists public.store_users (
  id          uuid primary key default uuid_generate_v4(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'operator',  -- owner | manager | operator
  name        text,
  active      boolean default true,
  created_at  timestamptz default now(),
  unique(store_id, user_id)
);

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY — cada loja só vê seus próprios dados
-- ═══════════════════════════════════════════════════════════

alter table public.stores        enable row level security;
alter table public.products      enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales         enable row level security;
alter table public.sale_items    enable row level security;
alter table public.expenses      enable row level security;
alter table public.store_users   enable row level security;

-- Helper: retorna store_ids que o usuário atual tem acesso
create or replace function public.my_store_ids()
returns setof uuid language sql security definer as $$
  select store_id from public.store_users
  where user_id = auth.uid() and active = true
  union
  select id from public.stores
  where owner_id = auth.uid();
$$;

-- STORES
create policy "stores_select" on public.stores for select using (id in (select public.my_store_ids()));
create policy "stores_insert" on public.stores for insert with check (owner_id = auth.uid());
create policy "stores_update" on public.stores for update using (owner_id = auth.uid());

-- PRODUCTS
create policy "products_all" on public.products for all using (store_id in (select public.my_store_ids()));

-- CASH SESSIONS
create policy "cash_all" on public.cash_sessions for all using (store_id in (select public.my_store_ids()));

-- SALES
create policy "sales_all" on public.sales for all using (store_id in (select public.my_store_ids()));

-- SALE ITEMS
create policy "sale_items_all" on public.sale_items for all
  using (sale_id in (select id from public.sales where store_id in (select public.my_store_ids())));

-- EXPENSES
create policy "expenses_all" on public.expenses for all using (store_id in (select public.my_store_ids()));

-- STORE USERS
create policy "store_users_all" on public.store_users for all using (store_id in (select public.my_store_ids()));

-- ═══════════════════════════════════════════════════════════
--  FUNÇÃO: decrementa estoque ao salvar venda
-- ═══════════════════════════════════════════════════════════
create or replace function public.decrement_stock()
returns trigger language plpgsql as $$
begin
  if new.product_id is not null then
    update public.products
    set stock = stock - new.qty,
        updated_at = now()
    where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger on_sale_item_insert
  after insert on public.sale_items
  for each row execute procedure public.decrement_stock();

-- ═══════════════════════════════════════════════════════════
--  FUNÇÃO: cria store_user owner ao criar loja
-- ═══════════════════════════════════════════════════════════
create or replace function public.on_store_created()
returns trigger language plpgsql security definer as $$
begin
  insert into public.store_users(store_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger store_created_trigger
  after insert on public.stores
  for each row execute procedure public.on_store_created();
