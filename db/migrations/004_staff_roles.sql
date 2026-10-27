-- Roles for staff (see api/_access.ts):
--   super_admin  everything, and manages HQ and campus staff (built-in: 93mishra@gmail.com)
--   hq           every campus, and manages HQ and campus staff
--   campus       only the campuses in campus_ids (LMS campus ids, as in students.campus_id)

alter table staff
  add column role text not null default 'campus'
    check (role in ('super_admin', 'hq', 'campus')),
  add column campus_ids integer[] not null default '{}',
  add column added_by text,
  add column updated_at timestamptz not null default now();

insert into staff (email, role, added_by)
values ('93mishra@gmail.com', 'super_admin', 'built-in')
on conflict (email) do update set role = 'super_admin', active = true;
