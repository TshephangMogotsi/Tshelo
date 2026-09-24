'use client'

import { type FormEvent, useState } from 'react'
import { CheckCircle2, LoaderCircle, Mail } from 'lucide-react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export function AccountDeletionRequestForm() {
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')
  const [receiptSent, setReceiptSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setError('')

    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/account-deletion-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        phone: form.get('phone'),
        notes: form.get('notes'),
        acknowledged: form.get('acknowledged') === 'on',
        website: form.get('website'),
      }),
    }).catch(() => null)

    if (!response?.ok) {
      const body = await response?.json().catch(() => null)
      setError(body?.message ?? 'We could not send the request. Please try again or email support@tshelo.co.bw.')
      setState('error')
      return
    }

    const body = await response.json().catch(() => null) as { receiptSent?: boolean } | null
    setReceiptSent(body?.receiptSent === true)
    setState('success')
  }

  if (state === 'success') {
    return (
      <section className="deletion-request-success" aria-live="polite">
        <CheckCircle2 size={22} />
        <div>
          <h2>Request received</h2>
          <p>We have recorded your request. {receiptSent ? 'A receipt is on its way to your email address.' : 'Please contact support to confirm receipt.'} We will verify account ownership before closing anything. If you need help, email <a href="mailto:support@tshelo.co.bw">support@tshelo.co.bw</a>.</p>
        </div>
      </section>
    )
  }

  return (
    <form className="deletion-request-form" onSubmit={submit}>
      <div className="deletion-request-form-heading">
        <Mail size={18} />
        <div><h2>Send a deletion request</h2><p>We will use these details only to locate and verify your account.</p></div>
      </div>

      <label>
        <span>Email address <b>*</b></span>
        <input name="email" type="email" autoComplete="email" maxLength={255} required placeholder="you@example.com" />
        <small>We send your receipt and any follow-up here.</small>
      </label>
      <label>
        <span>Tshelo mobile number</span>
        <input name="phone" type="tel" autoComplete="tel" maxLength={24} placeholder="For example, +267 71 234 567" />
        <small>Include it if you use it to sign in.</small>
      </label>
      <label>
        <span>Notes <i>(optional)</i></span>
        <textarea name="notes" rows={4} maxLength={500} placeholder="For example, I no longer have access to the app." />
      </label>
      <label className="deletion-request-check">
        <input name="acknowledged" type="checkbox" required />
        <span>I understand that Tshelo will verify ownership and that shared fund and event records may need to be retained.</span>
      </label>
      <label className="deletion-request-honeypot" aria-hidden="true">
        <span>Website</span><input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {state === 'error' && <p className="deletion-request-error" role="alert">{error}</p>}
      <button type="submit" disabled={state === 'submitting'}>
        {state === 'submitting' ? <><LoaderCircle className="spin" size={16} /> Sending request…</> : 'Send deletion request'}
      </button>
      <p className="deletion-request-fallback">Prefer email? <a href="mailto:support@tshelo.co.bw?subject=Tshelo%20account%20deletion%20request">Contact support directly</a>. Never send a password, one-time code, or bank details.</p>
    </form>
  )
}
