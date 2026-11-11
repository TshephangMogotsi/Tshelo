'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase-client'
import { sendRecoveryVerification, type RecoverySession, type RecoveryTarget } from '@/lib/recovery-contacts'

type Stage = 'select' | 'source' | 'destination' | 'confirm' | 'done'

async function recoveryRequest(body: Record<string, string>) {
  const client = createClient()
  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Please sign in again.')
  const response = await fetch('/api/v1/users/me/contact-recovery', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body), cache: 'no-store',
  })
  const result = await response.json().catch(() => ({})) as { message?: string; challengeId?: string; proof?: string; completed?: boolean; noticeSent?: boolean; sessionsRevoked?: boolean }
  if (!response.ok) throw new Error(result.message || 'Recovery is unavailable. Please try again.')
  return result
}

export function RecoveryContacts() {
  const [stage, setStage] = useState<Stage>('select')
  const [context, setContext] = useState<RecoverySession | null>(null)
  const [code, setCode] = useState('')
  const [sourceCode, setSourceCode] = useState('')
  const [destination, setDestination] = useState('')
  const [challenge, setChallenge] = useState<{ id: string; proof: string } | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function run(action: () => Promise<void>) {
    setLoading(true); setMessage('')
    try { await action() } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete this request. Please try again.')
    } finally { setLoading(false) }
  }
  function reset() { setStage('select'); setContext(null); setDestination(''); setCode(''); setSourceCode(''); setChallenge(null); setMessage('') }
  function start(target: RecoveryTarget) { void run(async () => { const next = await sendRecoveryVerification(createClient(), target); setContext(next); setStage('source') }) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!context) return
    void run(async () => {
      if (stage === 'source') {
        if (!/^\d{6,10}$/.test(code)) throw new Error('Enter the complete verification code.')
        setSourceCode(code); setCode(''); setStage('destination')
      } else if (stage === 'destination') {
        const result = await recoveryRequest({ action: 'start', target: context.target, code: sourceCode, destination })
        setSourceCode('')
        if (!result.challengeId || !result.proof) throw new Error('Could not start recovery. Try again.')
        setChallenge({ id: result.challengeId, proof: result.proof }); setCode(''); setStage('confirm')
      } else if (stage === 'confirm' && challenge) {
        const result = await recoveryRequest({ action: 'finish', target: context.target, challengeId: challenge.id, proof: challenge.proof, code })
        if (!result.completed) throw new Error('The change is not complete. Contact support.')
        setCode(''); setChallenge(null)
        if (result.noticeSent === false || result.sessionsRevoked === false) setMessage('Your sign-in details changed, but a security notification or session sign-out could not be completed. Contact support.')
        setStage('done')
      }
    })
  }
  return <div className="member-card-body">
    <p className="member-preference-note">Replace a sign-in method using another method already verified on your account.</p>
    {stage === 'select' && <div className="member-form-actions">
      <button type="button" className="primary" disabled={loading} onClick={() => start('phone')}>Add or change phone using email</button>
      <button type="button" className="primary" disabled={loading} onClick={() => start('email')}>Add or change email using phone</button>
    </div>}
    {stage !== 'select' && stage !== 'done' && context && <form className="member-form" onSubmit={submit}>
      {stage === 'source' && <><p>Enter the code sent to your verified {context.target === 'phone' ? 'email' : 'phone'}.</p><label><span>Verification code</span><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} maxLength={10} required /></label></>}
      {stage === 'destination' && <><label><span>New {context.target === 'phone' ? 'mobile number, including country code' : 'email address'}</span><input type={context.target === 'email' ? 'email' : 'tel'} value={destination} onChange={e => setDestination(e.target.value)} placeholder={context.target === 'phone' ? '+267 71 000 000' : 'you@example.com'} required /></label></>}
      {stage === 'confirm' && <><p>Enter the code sent to your new {context.target === 'phone' ? 'number' : 'email address'}.</p><label><span>Verification code</span><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} maxLength={10} required /></label></>}
      <div className="member-form-actions"><button className="primary" type="submit" disabled={loading}>{loading ? 'Please wait…' : stage === 'destination' ? 'Send code' : 'Continue'}</button><button type="button" disabled={loading} onClick={reset}>Cancel</button></div>
    </form>}
    {stage === 'done' && <p role="status">Your sign-in {context?.target === 'phone' ? 'number' : 'email address'} has been updated and verified. Please sign in again. <a href="/login">Go to sign in</a></p>}
    {message && <p className="member-form-error" role="alert">{message}</p>}
  </div>
}
