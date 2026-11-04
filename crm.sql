-- SMART SHOP · CRM ลูกค้า → บันทึกการคุย → งาน → ใบแจ้งหนี้
-- วิธีใช้: Supabase › SQL Editor › New query › วางทั้งหมดนี้ › กด Run (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
-- เป็นตารางใหม่ทั้งหมด ไม่แก้ตารางเดิม · ทุกตารางแยกข้อมูลตามเจ้าของ (owner_id = ผู้ล็อกอิน)

create table if not exists public.biz_settings (
  owner_id uuid primary key default auth.uid(),
  biz_name text,
  phone text,
  promptpay text,
  invoice_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  contact text,
  source text,
  stage text not null default 'lead' check (stage in ('lead','contacted','interested','trial','won','lost')),
  note text,
  next_on date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.client_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  client_id uuid not null references public.clients(id),
  kind text not null default 'note' check (kind in ('note','line','call','meet','email')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  client_id uuid not null references public.clients(id),
  title text not null,
  kind text not null default 'web' check (kind in ('saas','web','other')),
  price numeric not null default 0 check (price >= 0),
  status text not null default 'quote' check (status in ('quote','doing','delivered','invoiced','paid','cancelled')),
  due_on date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  client_id uuid not null references public.clients(id),
  job_id uuid references public.jobs(id),
  no text not null,
  item text not null,
  amount numeric not null check (amount > 0),
  issued_on date not null default current_date,
  due_on date,
  paid_on date,
  status text not null default 'sent' check (status in ('sent','paid','void')),
  income_id uuid references public.incomes(id),
  created_at timestamptz not null default now()
);

create index if not exists clients_owner_idx on public.clients(owner_id);
create index if not exists client_logs_client_idx on public.client_logs(client_id);
create index if not exists client_logs_owner_idx on public.client_logs(owner_id);
create index if not exists jobs_client_idx on public.jobs(client_id);
create index if not exists jobs_owner_idx on public.jobs(owner_id);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_job_idx on public.invoices(job_id);
create index if not exists invoices_owner_idx on public.invoices(owner_id);
create index if not exists invoices_income_idx on public.invoices(income_id);

do $$
declare t text;
begin
  foreach t in array array['biz_settings','clients','client_logs','jobs','invoices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "select own" on public.%I', t);
    execute format('drop policy if exists "insert own" on public.%I', t);
    execute format('drop policy if exists "update own" on public.%I', t);
    execute format('create policy "select own" on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "insert own" on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "update own" on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;
