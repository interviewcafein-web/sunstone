-- A staff member's profile: shown in the header menu, on My profile and on the Team page.
-- name and picture already exist (Google fills them at sign-in unless set by hand).
alter table staff
  add column mobile text,
  add column designation text,
  add column bio text
