'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from '@/app/waitlist/waitlist.module.css'

type Turnstile = {
  render: (container: HTMLElement, options: {
    sitekey: string; action: string; theme: string; size: string
    callback: (token: string) => void
    'expired-callback': () => void; 'error-callback': () => void
  }) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

export function CountryWaitlistForm({ siteKey, countries, enabled }: {
  siteKey: string; countries: { code: string; name: string }[]; enabled: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const submitting = useRef(false)
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [message, setMessage] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')

  useEffect(() => {
    if (!ready || complete || !container.current || !window.turnstile) return
    let active = true
    try {
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey, action: 'country_waitlist', theme: 'light', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        callback: value => { if (active) { setToken(value); setVerificationMessage('') } },
        'expired-callback': () => { if (active) { setToken(''); setVerificationMessage('Verification expired. Please complete it again.') } },
        'error-callback': () => { if (active) { setToken(''); setVerificationMessage('Verification could not load. Please reload the page and try again.') } },
      })
    } catch {
      queueMicrotask(() => { if (active) setVerificationMessage('Verification could not load. Please reload the page and try again.') })
    }
    return () => {
      active = false
      if (widget.current !== null) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [ready, siteKey, complete])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || !token || submitting.current || complete) return
    const data = new FormData(event.currentTarget)
    submitting.current = true
    setLoading(true); setMessage(''); setToken('')
    try {
      const response = await fetch('/api/country-waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: data.get('country_code'), email: String(data.get('email') ?? '').trim(), captcha_token: token }),
      })
      const result = await response.json()
      if (response.ok) setComplete(true)
      else setMessage(typeof result.message === 'string' ? result.message : 'We could not accept your request. Please try again.')
    } catch { setMessage('We could not send your request. Please check your connection and try again.') }
    finally {
      submitting.current = false; setLoading(false)
      // Tokens are single-use, including when a submission fails or is retried.
      if (widget.current !== null) window.turnstile?.reset(widget.current)
    }
  }

  return <>
    <Script id="country-waitlist-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setReady(true)}
      onError={() => { setToken(''); setVerificationMessage('Verification could not load. Please reload the page and try again.') }} />
    {complete ? <div role="status" className={styles.success}>Your request has been received. Thank you for your interest in Tshelo.</div>
      : <form onSubmit={submit} className={styles.form}>
        {!enabled ? <p role="status">We’re preparing the waitlist. Submissions are not open yet.</p> : null}
        <fieldset disabled={loading || !enabled}>
          <label htmlFor="waitlist-country">Country</label>
          <select id="waitlist-country" name="country_code" defaultValue="" required>
            <option value="" disabled>Choose your country</option>
            {countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
          <label htmlFor="waitlist-email">Email address</label>
          <input id="waitlist-email" name="email" type="email" autoComplete="email" maxLength={254} required />
          <p className={styles.notice}>We use your country and email to contact you about availability. We keep your details for up to 12 months and remove them sooner after notification or sign-up. This does not subscribe you to marketing. Read our <Link href="/legal/privacy">privacy policy</Link> for contact and deletion requests.</p>
          <label className={styles.choice}><input type="checkbox" name="availability_request" required /> Email me when Tshelo becomes available in my country.</label>
        </fieldset>
        <div ref={container} aria-label="Cloudflare verification" />
        {verificationMessage || message ? <p role="alert">{verificationMessage || message}</p> : null}
        <button type="submit" disabled={!enabled || !token || loading}>{loading ? 'Submitting…' : 'Join the waitlist'}</button>
      </form>}
  </>
}
