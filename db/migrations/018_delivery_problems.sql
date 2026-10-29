-- Problems solved in each class, as the trainer logged it in the tracker.
alter table dlv_classes add column if not exists problems integer;
-- The view's columns are fixed when it is made, so make it again to include the new one.
create or replace view dlv_classes_counted as select * from dlv_classes where not duplicate;
