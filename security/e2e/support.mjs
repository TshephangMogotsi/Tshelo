import { createHmac } from 'node:crypto'

export function requireLocalUrl(value, port) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== String(port)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`MFA tests require http://127.0.0.1:${port}; hosted targets are prohibited.`)
  }
  return url.origin
}

export function totp(secret, time = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const letter of secret.toUpperCase().replace(/=+$/, '')) {
    const value = alphabet.indexOf(letter)
    if (value < 0) throw new Error('Invalid authenticator setup key')
    bits += value.toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}

export function invalidTotp(secret, time = Date.now()) {
  const valid = [-30000, 0, 30000].map(delta => totp(secret, time + delta))
  return ['000000', '111111', '222222', '333333'].find(code => !valid.includes(code))
}

export function fixturePhone(index) {
  return `26770000${String(index).padStart(3, '0')}`
}

export function ciSupabaseConfig() {
  return `project_id = "tshelo-mfa-ci"

[auth]
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100"]

[auth.sms]
enable_signup = true
enable_confirmations = true
max_frequency = "1s"

[auth.sms.test_otp]
${Array.from({ length: 6 }, (_, index) => `"${fixturePhone(index + 1)}" = "123456"`).join('\n')}

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
`
}
