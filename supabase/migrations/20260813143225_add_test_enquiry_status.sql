-- Widens the status workflow with a 'test' state, so submissions made by the
-- end-to-end suite can be told apart from real enquiries in the inbox.
alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries add constraint enquiries_status_check
  check (status in ('new', 'contacted', 'quoted', 'closed', 'test'));
