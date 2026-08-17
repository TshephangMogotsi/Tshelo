'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

type Step = 'phone' | 'code'

export function LoginForm() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const digits = phone.replace(/\D/g, '').replace(/^267/, '').slice(0, 8)
  const fullPhone = `+267${digits}`

  async function sendCode(event: FormEvent) {
    event.preventDefault()
    if (digits.length !== 8) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    })
    setLoading(false)

    if (error) {
      setMessage('We could not send a code. Check the number or contact the system owner.')
      return
    }

    setStep('code')
    setMessage(`Code sent to ${fullPhone}`)
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    })

    if (error) {
      setLoading(false)
      setMessage('That code is invalid or has expired. Request a new code and try again.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const [{ data: admin }, { data: appUser }] = user
      ? await Promise.all([
          supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .eq('is_banned', false)
            .is('deleted_at', null)
            .maybeSingle(),
        ])
      : [{ data: null }, { data: null }]

    if (!appUser) {
      await supabase.auth.signOut()
      setLoading(false)
      setMessage('This Tshelo account is not available. Contact support if you need help.')
      return
    }

    window.location.replace(admin ? '/' : '/account')
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-lockup">
          <Image src="/tshelo-icon.png" width={44} height={44} alt="" priority />
          <span>Tshelo</span>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow light">Secure web access</p>
          <h1>Your Tshelo, wherever you are.</h1>
          <p>
            App users can review their account, while authorised staff continue to the operations dashboard.
          </p>
        </div>
        <div className="security-note">
          <ShieldCheck size={19} />
          <span>Protected by secure phone verification</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          {step === 'code' && (
            <button className="back-link" type="button" onClick={() => { setStep('phone'); setCode(''); setMessage('') }}>
              <ArrowLeft size={16} /> Change number
            </button>
          )}
          <div className="login-icon"><LockKeyhole size={22} /></div>
          <p className="eyebrow">Secure sign in</p>
          <h2>{step === 'phone' ? 'Welcome back' : 'Enter your code'}</h2>
          <p className="form-intro">
            {step === 'phone'
              ? 'Use the Botswana number linked to your Tshelo account.'
              : `We sent a six-digit code to ${fullPhone}.`}
          </p>

          {step === 'phone' ? (
            <form onSubmit={sendCode}>
              <label htmlFor="phone">Phone number</label>
              <div className="phone-field">
                <span>🇧🇼</span>
                <span className="country-code">+267</span>
                <input
                  id="phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={digits}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="71 000 000"
                  aria-describedby="login-message"
                  autoFocus
                />
              </div>
              <button className="primary-button" disabled={digits.length !== 8 || loading}>
                {loading ? 'Sending…' : 'Send secure code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode}>
              <label htmlFor="code">Verification code</label>
              <input
                id="code"
                className="code-field"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                aria-describedby="login-message"
                autoFocus
              />
              <button className="primary-button" disabled={code.length !== 6 || loading}>
                {loading ? 'Checking…' : 'Continue to dashboard'}
              </button>
            </form>
          )}

          <p id="login-message" className={`form-message ${message.includes('sent') ? 'success' : ''}`} aria-live="polite">
            {message}
          </p>
          <p className="login-help">App users open My Tshelo. Authorised staff continue to the admin dashboard.</p>
        </div>
      </section>
    </main>
  )
}
