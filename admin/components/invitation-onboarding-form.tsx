'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { ShieldCheck, UserRoundCheck } from 'lucide-react'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'
import { invitationContinuation, safePostLoginPath } from '@/lib/post-login'

type InvitationOnboardingFormProps = {
  nextPath?: string | null
  phone: string
  privacyUrl?: string | null
  termsUrl?: string | null
}

export function InvitationOnboardingForm({
  nextPath,
  phone,
  privacyUrl,
  termsUrl,
}: InvitationOnboardingFormProps) {
  const [name, setName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const invitation = invitationContinuation(nextPath)
  const destination = safePostLoginPath(nextPath) ?? '/account/overview'
  const trimmedName = name.trim()
  const canSubmit = trimmedName.length >= 2 && trimmedName.length <= 100 && accepted && !loading

  async function completeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setMessage('')
    const now = new Date().toISOString()

    try {
      await createApiClient().users.updateMe({
        name: trimmedName,
        country_code: 'BW',
        preferred_currency: 'BWP',
        profile_completed: true,
        onboarding_completed: true,
        terms_accepted_at: now,
        terms_version: '1.0',
        privacy_accepted_at: now,
        privacy_version: '1.0',
        data_processing_consent: true,
        data_processing_consent_at: now,
      })
      window.location.replace(destination)
    } catch (error) {
      setLoading(false)
      setMessage(apiErrorMessage(error))
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-lockup">
          <Image src="/tshelo-icon.png" width={44} height={44} alt="" priority />
          <span>Tshelo</span>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow light">Invitation accepted</p>
          <h1>One last step.</h1>
          <p>
            Add the name other members should see. Your invitation will continue as soon as your profile is ready.
          </p>
        </div>
        <div className="security-note">
          <ShieldCheck size={19} />
          <span>Your phone number has been securely verified</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-icon"><UserRoundCheck size={22} /></div>
          <p className="eyebrow">Set up your profile</p>
          <h2>How should we identify you?</h2>
          <p className="form-intro">
            {invitation
              ? `This name will be visible when you join the ${invitation.kind}.`
              : 'This name will be visible to people you share Tshelo groups with.'}
          </p>

          <form onSubmit={completeProfile}>
            <label htmlFor="onboarding-name">Full name</label>
            <input
              id="onboarding-name"
              className="profile-setup-field"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Your full name"
              aria-describedby="onboarding-message"
              autoFocus
            />
            <p className="verified-phone">Verified number <strong>{phone}</strong></p>

            <label className="profile-consent">
              <input
                type="checkbox"
                checked={accepted}
                onChange={event => setAccepted(event.target.checked)}
              />
              <span>
                I agree to Tshelo&apos;s {termsUrl
                  ? <a href={termsUrl} target="_blank" rel="noreferrer">terms of service</a>
                  : 'terms of service'} and have read the {privacyUrl
                  ? <a href={privacyUrl} target="_blank" rel="noreferrer">privacy policy</a>
                  : <a href="/account/preferences/privacy-policy" target="_blank">privacy policy</a>}.
              </span>
            </label>

            <button className="primary-button" disabled={!canSubmit}>
              {loading ? 'Saving…' : invitation ? 'Continue to invitation' : 'Finish setup'}
            </button>
          </form>

          <p id="onboarding-message" className="form-message" role={message ? 'alert' : undefined} aria-live="polite">
            {message}
          </p>
          <form action="/logout" method="post">
            <button className="back-link profile-change-number" type="submit">Use a different phone number</button>
          </form>
        </div>
      </section>
    </main>
  )
}
