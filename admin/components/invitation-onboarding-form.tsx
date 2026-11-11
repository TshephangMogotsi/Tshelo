'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, Check, CreditCard, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'
import { invitationContinuation, safePostLoginPath } from '@/lib/post-login'
import { SIGNUP_COUNTRIES } from '@/lib/signup-countries'

type OnboardingProps = {
  nextPath?: string | null
  phone: string
  email?: string | null
  initialName?: string | null
  initialCountry?: string | null
  privacyUrl?: string | null
  termsUrl?: string | null
}

type Step = 'profile' | 'payment' | 'review' | 'success'
const BANKS = [
  { name: 'First National Bank', branch: '282267' },
  { name: 'Standard Chartered', branch: '662167' },
  { name: 'Stanbic Bank', branch: '060144' },
  { name: 'ABSA', branch: '290099' },
  { name: 'Access Bank', branch: '061067' },
  { name: 'BBS', branch: '340099' },
  { name: 'Other', branch: '' },
]

export function InvitationOnboardingForm({ nextPath, phone, email, initialName, initialCountry, privacyUrl, termsUrl }: OnboardingProps) {
  const [step, setStep] = useState<Step>('profile')
  const [name, setName] = useState(initialName ?? '')
  const [countryCode, setCountryCode] = useState(initialCountry || 'BW')
  const [accepted, setAccepted] = useState(false)
  const [addBank, setAddBank] = useState(false)
  const [bankName, setBankName] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const invitation = invitationContinuation(nextPath)
  const country = SIGNUP_COUNTRIES.find(item => item.code === countryCode)
  const destination = safePostLoginPath(nextPath) ?? '/account/overview'
  const trimmedName = name.trim()
  const canSaveProfile = trimmedName.length >= 2 && trimmedName.length <= 100 && Boolean(country) && accepted && !loading
  const canReview = !addBank || (Boolean(bankName) && accountNumber.replace(/\D/g, '').length >= 8)
  const maskedAccount = accountNumber.replace(/\D/g, '').slice(-4)

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSaveProfile || !country) return
    setLoading(true)
    setMessage('')
    try {
      await createApiClient().users.updateMe({
        name: trimmedName, country_code: country.code, preferred_currency: country.currency,
        terms_version: '1.0', privacy_version: '1.0', data_processing_consent: true,
      })
      setStep('payment')
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || (addBank && !confirmed)) return
    setLoading(true)
    setMessage('')
    try {
      if (addBank) {
        await createApiClient().users.updateMe({
          bank_name: bankName, bank_branch_code: branchCode.trim(), bank_account_number: accountNumber.replace(/\D/g, ''),
        })
      }
      setStep('success')
    } catch (error) {
      setMessage(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function finishSetup() {
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      await createApiClient().users.updateMe({ profile_completed: true, onboarding_completed: true })
      window.location.replace(destination)
    } catch (error) {
      setMessage(apiErrorMessage(error))
      setLoading(false)
    }
  }

  const titles: Record<Step, string> = { profile: 'Your details', payment: 'Payment details', review: 'How you’ll receive money', success: 'You’re all set!' }
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-lockup"><Image src="/tshelo-icon.png" width={44} height={44} alt="" priority /><span>Tshelo</span></div>
        <div className="login-brand-copy">
          <p className="eyebrow light">{invitation ? 'Your invitation' : 'Welcome to Tshelo'}</p>
          <h1>Let’s get you started.</h1>
          <p>Set up your profile and choose how you would like to receive contributions.</p>
        </div>
        <div className="security-note"><ShieldCheck size={19} /><span>Your {phone ? 'phone number' : 'email address'} has been securely verified</span></div>
      </section>

      <section className="login-form-panel">
        <div className="login-card onboarding-card">
          {step !== 'profile' && step !== 'success' && <button className="back-link" type="button" onClick={() => { setStep(step === 'review' ? 'payment' : 'profile'); setMessage('') }}><ArrowLeft size={16} /> Back</button>}
          <div className="login-icon">{step === 'success' ? <Check size={22} /> : step === 'profile' ? <UserRoundCheck size={22} /> : <CreditCard size={22} />}</div>
          <p className="eyebrow">{step === 'success' ? 'Account ready' : `Account setup · ${step === 'profile' ? '1' : step === 'payment' ? '2' : '3'} of 3`}</p>
          <h2>{titles[step]}</h2>

          {step === 'profile' && <>
            <p className="form-intro">Add your name and country to set up your Tshelo account.</p>
            <form onSubmit={saveProfile}>
              <label htmlFor="onboarding-name">Full name</label>
              <input id="onboarding-name" className="profile-setup-field" autoComplete="name" minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Your full name" aria-describedby="onboarding-message" autoFocus />
              <p className="verified-phone">Verified {phone ? 'number' : 'email'} <strong>{phone || email}</strong></p>
              <label htmlFor="onboarding-country">Country</label>
              <select id="onboarding-country" className="profile-setup-field" value={countryCode} onChange={event => setCountryCode(event.target.value)}>
                {SIGNUP_COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <label className="profile-consent onboarding-consent">
                <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
                <span>I agree to Tshelo&apos;s <a href={termsUrl ?? '/legal/terms'} target="_blank" rel="noreferrer">terms of service</a> and have read the <a href={privacyUrl ?? '/legal/privacy'} target="_blank" rel="noreferrer">privacy policy</a>.</span>
              </label>
              <button className="primary-button" disabled={!canSaveProfile}>{loading ? 'Saving…' : 'Continue'}</button>
            </form>
          </>}

          {step === 'payment' && <>
            <p className="form-intro">Choose how you&apos;d like to receive contributions, or continue without payment details.</p>
            <div className="onboarding-payment-card">
              <div className="onboarding-payment-heading"><div><strong>Bank account</strong><span>Optional · receive contributions by bank transfer</span></div><CreditCard size={20} /></div>
              {!addBank ? <button className="onboarding-secondary" type="button" onClick={() => setAddBank(true)}>Add a bank account</button> : <div className="onboarding-bank-fields">
                <label htmlFor="onboarding-bank">Bank</label>
                <select id="onboarding-bank" className="profile-setup-field" value={bankName} onChange={event => { const bank = BANKS.find(item => item.name === event.target.value); setBankName(event.target.value); setBranchCode(bank?.branch ?? '') }}>
                  <option value="">Select a bank</option>{BANKS.map(bank => <option key={bank.name} value={bank.name}>{bank.name}</option>)}
                </select>
                <label htmlFor="onboarding-branch">Branch code</label>
                <input id="onboarding-branch" className="profile-setup-field" value={branchCode} onChange={event => setBranchCode(event.target.value)} maxLength={50} placeholder="Branch code" />
                <label htmlFor="onboarding-account">Account number</label>
                <input id="onboarding-account" className="profile-setup-field" inputMode="numeric" autoComplete="off" maxLength={50} value={accountNumber} onChange={event => setAccountNumber(event.target.value.replace(/\D/g, ''))} placeholder="At least 8 digits" />
                <button className="onboarding-text-button" type="button" onClick={() => { setAddBank(false); setBankName(''); setBranchCode(''); setAccountNumber(''); setConfirmed(false) }}>Remove bank account</button>
              </div>}
            </div>
            <div className="onboarding-payment-card"><div className="onboarding-payment-heading"><div><strong>Mobile money</strong><span>{phone ? 'Your sign-in number has been verified. Mobile-money ownership requires separate verification.' : 'A verified mobile number is needed before mobile money can be added.'}</span></div></div></div>
            <button className="primary-button" type="button" disabled={!canReview} onClick={() => { setConfirmed(false); setStep('review') }}>Continue</button>
          </>}

          {step === 'review' && <>
            <p className="form-intro">Review how you&apos;ll receive contributions.</p>
            <div className="onboarding-payment-card"><div className="onboarding-payment-heading"><div><strong>{addBank ? bankName : 'No bank account added'}</strong><span>{addBank ? `Account ending ${maskedAccount}` : 'Continue without bank details.'}</span></div>{addBank && <CreditCard size={20} />}</div></div>
            {phone && <div className="onboarding-payment-card"><div className="onboarding-payment-heading"><div><strong>Verified sign-in number</strong><span>{phone}</span></div></div></div>}
            <form onSubmit={savePayment}>
              {addBank && <label className="profile-consent onboarding-consent"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm this is my bank account and I will receive contributions here.</span></label>}
              <button className="primary-button" disabled={loading || (addBank && !confirmed)}>{loading ? 'Saving…' : addBank ? 'Confirm & continue' : 'Continue'}</button>
            </form>
          </>}

          {step === 'success' && <><p className="form-intro">Your account is ready. Let&apos;s get started with Tshelo.</p><button className="primary-button" type="button" disabled={loading} onClick={() => void finishSetup()}>{loading ? 'Finishing…' : invitation ? 'Continue to invitation' : 'Get started'}</button></>}
          <p id="onboarding-message" className="form-message" role={message ? 'alert' : undefined} aria-live="polite">{message}</p>
          {step !== 'success' && <form action="/logout" method="post"><button className="back-link profile-change-number" type="submit">Use a different {phone ? 'phone number' : 'email address'}</button></form>}
        </div>
      </section>
    </main>
  )
}
