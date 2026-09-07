import Link from 'next/link'

export default function InvitationNotFound() {
  return (
    <main className="login-page">
      <section className="login-form-panel">
        <div className="login-card">
          <p className="eyebrow">Invitation unavailable</p>
          <h1>That invitation link is not valid.</h1>
          <p className="form-intro">Ask the organiser for a new Tshelo invitation link or enter the code from your account.</p>
          <Link className="primary-button" href="/login">Sign in to Tshelo</Link>
        </div>
      </section>
    </main>
  )
}
