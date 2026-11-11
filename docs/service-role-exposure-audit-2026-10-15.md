# Service-role exposure audit — 15 October 2026

**Result:** no embedded Supabase service-role JWT, modern secret API key or
management token was found in the inspected configuration, source/history,
local build outputs, public deployed web bundles or latest production mobile
archives. This is a scoped audit of the artifacts below, not a guarantee about
every historical release or runtime response. No credentials were changed and
no release was triggered.

## Configuration and source boundaries

- Mobile `lib/supabase.ts` uses `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The inspected local/EAS value under the latter
  name is a public publishable key, not a privileged key.
- Browser `admin/lib/config.ts:getSupabaseConfig` uses only
  `NEXT_PUBLIC_SUPABASE_URL` and publishable/anon key variables.
- `getSupabaseAdminConfig` reads the non-public `SUPABASE_SERVICE_ROLE_KEY`.
  Its callers are server API routes for account-deletion requests/verification,
  country-waitlist submission and internal waitlist cleanup. The shared config
  module contains both getters; the privileged getter and its environment
  variable name were absent from inspected browser JavaScript.
- Other service-key references are in Supabase Edge Functions (`parse-receipt`,
  `fund-preview`, `send-push`) and the operator script
  `scripts/provision-google-play-reviewer.mjs`.
- No Next.js `env` mapping injects server keys. Public Expo configuration and
  `app.json`/`eas.json` did not expose privileged keys.
- `.env`, `.env.local` and `admin/.env.local` are ignored and untracked. Their
  inspected Supabase values contained no privileged credential. The readable
  project-level EAS production environment listed only the public Supabase URL
  and public key; preview/development listed no variables. Account-level EAS
  environment listings were empty for all three environments.

## Inspected artifacts

All rows below returned zero privileged-key findings. Counts reflect the files
available at audit time, including unrelated uncommitted working-tree changes.

| Surface | Coverage |
| --- | --- |
| Tracked working-tree files | 695 files; 12,535,229 bytes |
| Untracked, nonignored working-tree files | 31 files; 1,464,426 bytes |
| Locally reachable Git history | 1,686 unique blobs; 33,976,197 bytes; no large blobs skipped |
| Expo public config | Successful `expo config --type public --json`; 2,197 bytes |
| Local mobile export (`dist`) | 40 files; 17,265,114 bytes |
| Local Next.js browser output (`admin/.next/static`) | 47 files; 2,581,740 bytes |
| Local Next.js server output | 1,664 files; 36,031,902 bytes; checked additionally, not classified as browser output |
| Local iOS simulator app | 268 files; 96,248,741 bytes |
| Local Android debug APK | 1,311 archive members; 96,771,627 uncompressed bytes |
| Production iOS IPA, 1.0.1 (9) | 88 archive members; 51,149,045 uncompressed bytes; no members skipped |
| Production Android AAB, 1.0.1 (12) | 1,454 archive members; 212,710,960 uncompressed bytes; no members skipped |

The latest finished production builds accessible through EAS were:

| Platform | Build ID | Download SHA-256 |
| --- | --- | --- |
| iOS | `78bfcb96-a088-4fbe-8c48-6c3fc01f17d6` | `05906c2d38262391ce9d3bd56cdccd7ae0b944ca1eef83038e8cf7446ea05581` |
| Android | `4d6d07fe-56df-4749-bcf0-a0b1ed433815` | `5da570e1f6425f0bcc299a48c32a46c78fed62f75b2a5b09bd5b048da246dc27` |

Both builds reference source commit `91421bb`. Download sizes were 16,205,670
bytes (IPA) and 73,553,742 bytes (AAB). These are EAS build artifacts, not a
separate download of the packages currently distributed by each app store.

## Deployed web checks

Fetched the public root/login pages and discovered same-origin Next.js assets
for each origin, including dependency references and source-map probes:

| Origin | Successful files / JavaScript responses | Bytes scanned | Published maps found |
| --- | --- | --- | --- |
| `https://app.tshelo.com` | 13 / 9 | 1,094,411 | 0 |
| `https://tshelo-admin.vercel.app` | 13 / 9 | 1,100,161 | 0 |
| `https://tshelo-admin-diginav.vercel.app` | 13 / 9 | 1,100,247 | 0 |

Each origin had 22 requests including nine map probes returning 404. No
deployment protection was encountered and the crawl limit was not reached.
The 27 JavaScript responses can overlap in content across aliases; they are
not claimed to be 27 unique bundles. Neither `SUPABASE_SERVICE_ROLE_KEY` nor
`getSupabaseAdminConfig` appeared in these scripts or local browser scripts.
Bare `sb_secret_` SDK prefix checks were distinguished from actual credentials.

## Method and validation

Scanned file/archive bytes for full JWTs, decoded their payloads and flagged
`service_role`/`supabase_admin` roles. Also checked modern `sb_secret_` keys and
`sbp_` management tokens; public anon/publishable keys and example placeholders
were not treated as privileged credentials. No local privileged key was found
to use as an additional exact-match control.

Both production main bundles are Hermes bytecode. In addition to scanning all
archive members and null-stripped main bundles, disassembled
`Payload/Tshelo.app/main.jsbundle` and `base/assets/index.android.bundle` with
the installed Hermes compiler and scanned the reconstructed string output
(37,050,610 and 22,787,038 bytes respectively). Both disassemblies completed
successfully with no privileged-key findings. Synthetic service-role JWTs,
including a realistic 225-byte JWT, and modern secret keys were compiled to
Hermes and successfully detected after disassembly. Public-key/placeholder
negative controls also passed.

Raw environment captures, signed download links and decoded bundles were kept
in a restricted temporary audit directory and are not included in the repo.
Only credential-free results and artifact identifiers are recorded here.

## Limits

- Coverage is the current local checkout/history, listed build artifacts and
  public root/login web assets. Other historical builds, inaccessible branches,
  authenticated lazy-loaded routes, browser storage, runtime API responses,
  logs and external backups were not exhaustively inspected.
- EAS listings cover values readable to the current account. Hidden secret
  values were not exported. Private Vercel environment values were not audited:
  the local CLI account lacks access to the intended team. Public deployment
  assets remained accessible and were inspected directly.
- Pattern and decoded-string checks cannot prove the absence of a credential
  deliberately encrypted, obfuscated or assembled from fragments at runtime.
- This audit found no exposed key requiring rotation. It does not independently
  certify the trustworthiness or authorization logic of server key consumers.

Suggested review update: “We audited public client configuration, local source
and reachable Git history, local build outputs, the latest production iOS and
Android archives, and public bundles from the three accessible web origins.
No privileged Supabase keys were found. Current client configuration uses
public keys; service-role references are confined to server/Edge/operator code.
Historical releases and authenticated/runtime surfaces remain outside this
audit's complete coverage.”
