# Tshelo Admin

Private web console for platform-wide Tshelo operations. It shares Supabase Auth
and the production data model with the mobile application, but platform staff
access is controlled by the separate `platform_admins` allowlist.

The same phone-OTP page also supports existing mobile-app users. Staff are
routed to the admin dashboard; regular users are routed to the read-only
`/account` area and remain subject to the existing Supabase row-level policies.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the same Supabase project URL used by the mobile app.
3. Prefer a publishable key. The legacy public anon key also works during the
   project's key migration.
4. From this directory, run `npm install` and `npm run dev`.

The initial release is read-only. It does not need a Supabase secret key.

## Enable the database model

Apply the repository migrations through the normal Supabase deployment flow:

```sh
supabase db push
```

## Add the first administrator

The person must already have a Tshelo account. After applying the migration,
run this once using a trusted database session, replacing the phone number:

```sql
insert into public.platform_admins (user_id, role, created_by)
select id, 'super_admin', id
from public.users
where phone = '+26771000000'
on conflict (user_id) do update
set role = excluded.role,
    is_active = true,
    updated_at = now();
```

Available roles are `support`, `operations`, `finance`, and `super_admin`.
Administrators sign in using the same phone OTP flow as the mobile app. Public
account creation is disabled in the admin login request.

## Deploy from the existing GitHub repository

Create a Vercel project from the existing `Tshelo` repository and set:

- Root Directory: `admin`
- Production Branch: `main`
- Framework Preset: Next.js
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Add the deployed URL to the Supabase Auth redirect allowlist. No GitHub
organization or second repository is required.
