-- PRIME coding domain delivery, copied nightly from the delivery tracker (a separate Supabase
-- database) by scripts/sync-delivery.ts. Campuses match ours by their short code (IITM,
-- SAGE…); programs are our names (B.Tech, BCA, MCA) and batches the admission year.

-- Allocated (agreed) and planned hours, per campus, program, batch and section.
create table if not exists dlv_targets (
  campus_code  text not null,
  program      text not null,
  batch_year   integer,
  section      text,
  students     integer,
  planned_hours integer,
  allocated_hours integer
);

-- One row per class taught.
create table if not exists dlv_classes (
  id           uuid primary key,
  class_date   date not null,
  campus_code  text not null,
  program      text not null,
  batch_year   integer,
  section      text,
  trainer      text,
  curriculum   text,
  topic        text,
  topic_order  integer,
  subtopic     text,
  minutes      integer,
  present      integer,
  total        integer,
  status       text not null          -- VERIFIED, PENDING VERIFICATION, REJECTED
);
create index if not exists dlv_classes_campus_idx on dlv_classes (campus_code, program, batch_year);

-- The syllabus: each curriculum's topics in teaching order, and which programs/batches use it.
create table if not exists dlv_topics (
  curriculum   text not null,
  program      text not null,
  batch_years  integer[] not null,
  topic        text not null,
  topic_order  integer,
  subtopics    integer
);
