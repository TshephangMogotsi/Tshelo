-- Event announcement managers can update the attachment metadata when editing
-- an announcement. Row-level policies continue to enforce event permissions.

GRANT UPDATE (attachments)
  ON TABLE public.event_announcements TO authenticated;
