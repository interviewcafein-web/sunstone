-- The tracker has classes submitted more than once (the same trainer, day, batch, section, start
-- and end time and subtopic, seconds apart), each verified on its own. The copy keeps them but
-- flags every repeat after the first, and the dashboard counts each class once.
alter table dlv_classes add column if not exists duplicate boolean not null default false;
create or replace view dlv_classes_counted as select * from dlv_classes where not duplicate;
