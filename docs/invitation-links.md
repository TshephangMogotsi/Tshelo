# Invitation links

Tshelo shares one canonical HTTPS format for both web and native clients:

- `https://app.tshelo.com/invite/event/{code}`
- `https://app.tshelo.com/invite/fund/{code}`

If the native app is installed and the operating system has verified the domain association, the link opens the appropriate join screen. Otherwise it opens the web app. Signed-out users are sent through phone verification and returned to the same invitation; the destination is restricted to local `/account` paths to prevent open redirects.

## Production association values

Configure these variables on the deployment serving `app.tshelo.com`:

- `TSHELO_APPLE_TEAM_ID`: the ten-character Apple Developer team ID. For certificate rotation or multiple apps, `TSHELO_APPLE_APP_IDS` may instead contain comma-separated full application IDs.
- `TSHELO_ANDROID_SHA256_FINGERPRINTS`: comma-separated SHA-256 fingerprints for every active production Android signing certificate.

The deployment then serves:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

Keep both old and new signing identifiers in these lists during certificate rotation. After changing them, verify the two public files return `200` without redirects and install a newly signed native build before testing links from Messages or WhatsApp.
