'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Factor = { id: string; friendly_name?: string }
type Enrollment = { id: string; qrCode: string; secret: string }

export function MfaForm() {
  const router = useRouter()
  const [client] = useState<SupabaseClient>(() => createClient())
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    let active = true
    client.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setMessage('Authenticator settings could not be loaded. Reload to try again.')
        return
      }
      const verified = data.totp.filter(factor => factor.status === 'verified')
      setFactors(verified)
      setFactorId(verified[0]?.id ?? '')
    }).catch(() => {
      if (active) setMessage('Authenticator settings could not be loaded. Reload to try again.')
    })
    return () => { active = false }
  }, [client])

  async function enroll() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setMessage('')
    try {
      // Remove abandoned, unverified TOTP enrollments before retrying. Never
      // remove a verified factor here; recovery requires a separate procedure.
      const { data: existing, error: listError } = await client.auth.mfa.listFactors()
      if (listError) throw listError
      if (existing.totp.some(factor => factor.status === 'verified')) {
        setFactors(existing.totp.filter(factor => factor.status === 'verified'))
        setFactorId(existing.totp.find(factor => factor.status === 'verified')!.id)
        return
      }
      for (const factor of existing.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          const { error } = await client.auth.mfa.unenroll({ factorId: factor.id })
          if (error) throw error
        }
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Tshelo' })
      if (error) throw error
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setFactorId(data.id)
      setCode('')
    } catch {
      setMessage('Authenticator setup failed. Try again, or contact your platform administrator.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !factorId || !/^\d{6}$/.test(code)) return
    inFlight.current = true
    setBusy(true)
    setMessage('')
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw error
      const { data, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError || data.currentLevel !== 'aal2') throw new Error('Verification required')
      setEnrollment(null)
      setCode('')
      router.replace('/')
      router.refresh()
    } catch {
      setCode('')
      setMessage('Verification failed. Enter a new code from your authenticator, or sign in again if your session expired.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <main className="login-form-panel">
      <section className="login-card" aria-labelledby="mfa-title">
        <p className="eyebrow">Administrator security</p>
        <h1 id="mfa-title">Verify with your authenticator</h1>
        <p>Platform administrators must complete authenticator verification before accessing the dashboard.</p>
        {factors === null && !message && <p role="status">Loading authenticator settings…</p>}
        {factors?.length === 0 && !enrollment && (
          <>
            <p>Set up an authenticator app, then enter its six-digit code to finish enrollment.</p>
            <button type="button" className="primary-button" disabled={busy} onClick={enroll}>
              {busy ? 'Setting up…' : 'Set up authenticator'}
            </button>
          </>
        )}
        {enrollment && (
          <div>
            <p>Scan this QR code with your authenticator app. Keep the setup key private.</p>
            {/* Supabase supplies a data URI; render as an image, never inline SVG markup. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="Authenticator enrollment QR code" width={240} height={240} />
            <details><summary>Enter the setup key manually</summary><code>{enrollment.secret}</code></details>
          </div>
        )}
        {factorId && (
          <form onSubmit={verify}>
            {(factors?.length ?? 0) > 1 && (
              <>
                <label htmlFor="mfa-factor">Authenticator</label>
                <select id="mfa-factor" value={factorId} disabled={busy} onChange={event => { setFactorId(event.target.value); setCode('') }}>
                  {factors?.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}
                </select>
              </>
            )}
            <label htmlFor="mfa-code">Authenticator code</label>
            <input id="mfa-code" className="code-field" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} value={code} disabled={busy} aria-describedby="mfa-message"
              onChange={event => setCode(event.target.value.replace(/\D/g, ''))} />
            <button className="primary-button" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>
        )}
        <p id="mfa-message" role="status" aria-live="polite">{message}</p>
        <p>Lost access to your authenticator? Contact your designated platform administrator for recovery.</p>
        <form action="/logout" method="post"><button type="submit">Sign out</button></form>
      </section>
    </main>
  )
}
