# AttendMate — Supabase Setup Guide

Follow these steps to configure your Supabase project for AttendMate.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose an organization, set a project name (e.g., `attendmate`), set a database password, and select a region.
4. Wait for the project to finish provisioning.

---

## 2. Get Your API Keys

1. Go to **Settings → API** in your Supabase dashboard.
2. Copy:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon / public key** → this is your `VITE_SUPABASE_ANON_KEY`
3. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 3. Run the Database Schema

Go to **SQL Editor** in Supabase dashboard and run the following:

### 3a. Create Tables

```sql
-- Faculty profile (auto-created on first login via trigger)
create table faculty (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  onboarded boolean default false,
  created_at timestamptz default now()
);

-- Master list of sections
create table sections (
  id uuid primary key default gen_random_uuid(),
  year text not null check (year in ('E1','E2','E3','E4')),
  semester int not null check (semester in (1,2)),
  section_name text not null,
  unique (year, semester, section_name)
);

-- Faculty-to-section-subject assignments (many-to-many)
create table faculty_assignments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references faculty(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  subject_name text not null,
  created_at timestamptz default now(),
  unique (faculty_id, section_id, subject_name)
);

-- Student roster per section (uploaded via Excel)
create table students (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade,
  roll_number text not null,
  student_id text not null,
  full_name text not null,
  unique (section_id, roll_number)
);

-- One attendance session = one faculty + subject + section + date + type
create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references faculty(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  subject_name text not null,
  session_date date not null,
  session_type text default 'class' check (session_type in ('class','lab')),
  created_at timestamptz default now(),
  unique (faculty_id, section_id, subject_name, session_date, session_type)
);

-- Per-student attendance record within a session
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references attendance_sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text not null default 'absent' check (status in ('present','absent')),
  unique (session_id, student_id)
);
```

### 3b. Create Auto-Profile Trigger

This automatically creates a `faculty` row when a new user signs up:

```sql
-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.faculty (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

-- Trigger on auth.users insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 3c. Enable Row Level Security

```sql
-- Enable RLS on all tables
alter table faculty enable row level security;
alter table sections enable row level security;
alter table faculty_assignments enable row level security;
alter table students enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;

-- ============================================
-- FACULTY: users can only read/update their own row
-- ============================================
create policy "Faculty can view own profile"
  on faculty for select
  using (id = auth.uid());

create policy "Faculty can update own profile"
  on faculty for update
  using (id = auth.uid());

-- ============================================
-- SECTIONS: any authenticated user can read; insert allowed for creating new sections
-- ============================================
create policy "Authenticated users can view sections"
  on sections for select
  to authenticated
  using (true);

create policy "Authenticated users can insert sections"
  on sections for insert
  to authenticated
  with check (true);

-- ============================================
-- FACULTY_ASSIGNMENTS: faculty can manage their own assignments
-- ============================================
create policy "Faculty can view own assignments"
  on faculty_assignments for select
  using (faculty_id = auth.uid());

create policy "Faculty can insert own assignments"
  on faculty_assignments for insert
  with check (faculty_id = auth.uid());

create policy "Faculty can delete own assignments"
  on faculty_assignments for delete
  using (faculty_id = auth.uid());

-- ============================================
-- STUDENTS: any authenticated user can read; assigned faculty can write
-- ============================================
create policy "Authenticated users can view students"
  on students for select
  to authenticated
  using (true);

create policy "Assigned faculty can insert students"
  on students for insert
  to authenticated
  with check (
    exists (
      select 1 from faculty_assignments
      where faculty_assignments.section_id = students.section_id
        and faculty_assignments.faculty_id = auth.uid()
    )
  );

create policy "Assigned faculty can update students"
  on students for update
  to authenticated
  using (
    exists (
      select 1 from faculty_assignments
      where faculty_assignments.section_id = students.section_id
        and faculty_assignments.faculty_id = auth.uid()
    )
  );

create policy "Assigned faculty can delete students"
  on students for delete
  to authenticated
  using (
    exists (
      select 1 from faculty_assignments
      where faculty_assignments.section_id = students.section_id
        and faculty_assignments.faculty_id = auth.uid()
    )
  );

-- ============================================
-- ATTENDANCE_SESSIONS: faculty can manage their own sessions
-- ============================================
create policy "Faculty can view own sessions"
  on attendance_sessions for select
  using (faculty_id = auth.uid());

create policy "Faculty can insert own sessions"
  on attendance_sessions for insert
  with check (faculty_id = auth.uid());

create policy "Faculty can update own sessions"
  on attendance_sessions for update
  using (faculty_id = auth.uid());

-- ============================================
-- ATTENDANCE_RECORDS: faculty can manage records in their sessions
-- ============================================
create policy "Faculty can view own session records"
  on attendance_records for select
  using (
    exists (
      select 1 from attendance_sessions
      where attendance_sessions.id = attendance_records.session_id
        and attendance_sessions.faculty_id = auth.uid()
    )
  );

create policy "Faculty can insert records in own sessions"
  on attendance_records for insert
  with check (
    exists (
      select 1 from attendance_sessions
      where attendance_sessions.id = attendance_records.session_id
        and attendance_sessions.faculty_id = auth.uid()
    )
  );

create policy "Faculty can update records in own sessions"
  on attendance_records for update
  using (
    exists (
      select 1 from attendance_sessions
      where attendance_sessions.id = attendance_records.session_id
        and attendance_sessions.faculty_id = auth.uid()
    )
  );
```

---

## 4. Configure Google OAuth

1. Go to **Authentication → Providers** in Supabase dashboard.
2. Enable **Google** provider.
3. Set up Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use existing)
   - Go to **APIs & Services → Credentials**
   - Create **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** back into Supabase Google provider settings.
4. **Restrict email domain** (optional but recommended):
   - In Supabase **Authentication → Settings**, you can add allowed email domains to restrict signups.
   - Alternatively, the trigger function can be modified to reject non-matching domains.

---

## 5. Set the Site URL

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed app URL:
   - Local dev: `http://localhost:5173`
   - Production: `https://vasu-rguktn.github.io/attendmate`
3. Add both URLs to **Redirect URLs** list.

---

## 6. GitHub Secrets (for deployment)

In your GitHub repo settings (**Settings → Secrets and variables → Actions**), add:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

These are injected at build time by the GitHub Actions workflow.
- setup github secrets and variables also

-- Heloooo DBs