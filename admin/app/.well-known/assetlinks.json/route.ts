const ANDROID_PACKAGE = 'com.digitalnatives.tshelo'
const SHA256_FINGERPRINT = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/

function configuredFingerprints() {
  return [...new Set(process.env.TSHELO_ANDROID_SHA256_FINGERPRINTS
    ?.split(',')
    .map((value: string) => value.trim().toUpperCase())
    .filter((value: string) => SHA256_FINGERPRINT.test(value)) ?? [])]
}

export function GET() {
  const fingerprints = configuredFingerprints()
  const configured = fingerprints.length > 0
  const body = fingerprints.length ? [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: fingerprints,
    },
  }] : []

  return Response.json(body, {
    status: configured ? 200 : 503,
    headers: {
      'Cache-Control': configured ? 'public, max-age=300, s-maxage=300' : 'no-store',
      'Content-Type': 'application/json',
      'X-Tshelo-Association-Configured': configured ? 'true' : 'false',
    },
  })
}
