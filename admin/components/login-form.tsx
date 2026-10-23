'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { createApiClient } from '@/lib/api-client'
import {
  invitationContinuation,
  onboardingPathFor,
  safePostLoginPath,
} from '@/lib/post-login'

type Step = 'details' | 'code'
type SignInMethod = 'phone' | 'email'

export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const [step, setStep] = useState<Step>('details')
  const [method, setMethod] = useState<SignInMethod>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const digits = phone.replace(/\D/g, '').replace(/^267/, '').slice(0, 8)
  const fullPhone = `+267${digits}`
  const normalizedEmail = email.trim().toLowerCase()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const invitation = invitationContinuation(nextPath)

  function changeMethod(nextMethod: SignInMethod) {
    setMethod(nextMethod)
    setCode('')
    setMessage('')
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault()
    if (method === 'phone' && digits.length !== 8) return
    if (method === 'email' && !emailIsValid) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = method === 'phone'
      ? await supabase.auth.signInWithOtp({
          phone: fullPhone,
          options: { shouldCreateUser: Boolean(invitation) },
        })
      : await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: false },
        })
    setLoading(false)

    if (error) {
      setMessage(method === 'email'
        ? 'We could not send a code. Check the email address or use your phone number.'
        : invitation
        ? 'We could not send a code. Check the number and try again.'
        : 'We could not send a code. Check the number or contact the system owner.')
      return
    }

    setStep('code')
    setMessage(`Code sent to ${method === 'phone' ? fullPhone : normalizedEmail}`)
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = method === 'phone'
      ? await supabase.auth.verifyOtp({ phone: fullPhone, token: code, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: normalizedEmail, token: code, type: 'email' })

    if (error) {
      setLoading(false)
      setMessage('That code is invalid or has expired. Request a new code and try again.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const [{ data: admin }, appUser] = user
      ? await Promise.all([
          supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle(),
          createApiClient().users.me().catch(() => null),
        ])
      : [{ data: null }, null]

    if (!appUser || appUser.status === 'banned') {
      await supabase.auth.signOut()
      setLoading(false)
      setMessage('This Tshelo account is not available. Contact support if you need help.')
      return
    }

    const continuation = safePostLoginPath(nextPath)
    if (invitation && !appUser.profile_completed) {
      window.location.replace(onboardingPathFor(invitation.path))
      return
    }
    window.location.replace(appUser && continuation ? continuation : admin ? '/mfa' : '/account/overview')
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
            <button className="back-link" type="button" onClick={() => { setStep('details'); setCode(''); setMessage('') }}>
              <ArrowLeft size={16} /> Change sign-in method
            </button>
          )}
          <div className="login-icon"><LockKeyhole size={22} /></div>
          <p className="eyebrow">Secure sign in</p>
          <h2>{step === 'details' ? (invitation ? 'Open your invitation' : 'Welcome back') : 'Enter your code'}</h2>
          <p className="form-intro">
            {step === 'details'
              ? invitation
                ? method === 'phone'
                  ? `Enter your Botswana mobile number to continue to this ${invitation.kind} invitation. We will create your Tshelo account if you are new.`
                  : 'Use the verified email linked to your existing Tshelo account.'
                : method === 'phone'
                  ? 'Use the Botswana number linked to your Tshelo account.'
                  : 'Use the verified email linked to your Tshelo account.'
              : `We sent a six-digit code to ${method === 'phone' ? fullPhone : normalizedEmail}.`}
          </p>

          {step === 'details' ? (
            <form onSubmit={sendCode}>
              <div className="sign-in-methods" role="group" aria-label="Sign-in method">
                <button className={method === 'phone' ? 'sign-in-method active' : 'sign-in-method'} type="button" onClick={() => changeMethod('phone')}>
                  Phone number
                </button>
                <button className={method === 'email' ? 'sign-in-method active' : 'sign-in-method'} type="button" onClick={() => changeMethod('email')}>
                  Email address
                </button>
              </div>
              {method === 'phone' ? (
                <>
                  <label htmlFor="phone">Phone number</label>
                  <div className="phone-field">
                    <span className="country-label">BW</span>
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
                </>
              ) : (
                <>
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    className="profile-setup-field"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-describedby="login-message"
                    autoFocus
                  />
                </>
              )}
              <button className="primary-button" disabled={(method === 'phone' ? digits.length !== 8 : !emailIsValid) || loading}>
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
                {loading ? 'Checking…' : invitation ? 'Continue to invitation' : 'Continue to dashboard'}
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
