import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: { absolute: 'Delete your Tshelo account' },
  description: 'Request deletion of your Tshelo account and understand which shared records may need to be retained.',
}

const sections = [
  {
    id: 'request',
    title: 'Request account deletion',
    paragraphs: [
      'The quickest way is in the Tshelo app: open Account, choose Security, then choose Request account closure. You must be signed in to submit that request.',
      'If you no longer have the app, use the request link above or email support@tshelo.co.bw with the subject “Tshelo account deletion request”. Include the mobile number or email address registered to your Tshelo account. Do not send passwords, one-time codes, or bank details by email.',
    ],
  },
  {
    id: 'before-closure',
    title: 'Before we close the account',
    paragraphs: [
      'We verify that the request comes from the account holder and check whether the account has an active responsibility in a shared fund or event. An organiser may need to transfer ownership or appoint another organiser before closure can be completed.',
      'Account closure does not cancel or reverse a payment made outside Tshelo. Download any reports you need before requesting deletion.',
    ],
  },
  {
    id: 'deleted-data',
    title: 'Data we delete',
    paragraphs: [
      'After a verified request is completed, Tshelo deletes or anonymises the account profile and sign-in record, including the account name, phone number, email address, avatar, notification-device identifiers, account preferences, and private account settings that are not required to be retained.',
      'We also ask service providers processing this data for Tshelo to delete it where applicable, subject to their lawful retention requirements.',
    ],
  },
  {
    id: 'retained-data',
    title: 'Data we may retain',
    paragraphs: [
      'Tshelo funds and events are shared records. To preserve an accurate history for other participants, we may retain contribution, expense, pledge, approval, audit, support, and report records that are connected to a shared fund or event.',
      'We may also retain the minimum information needed for security, fraud prevention, dispute handling, tax or legal compliance. Retained records are restricted to those purposes and are deleted or anonymised when they are no longer required.',
    ],
  },
  {
    id: 'timing',
    title: 'Timing and confirmation',
    paragraphs: [
      'Our target is to complete a verified, straightforward account-deletion request within 30 days. It can take longer when shared-record responsibilities, a security concern, a dispute, or a legal retention obligation needs review.',
      'We will confirm the outcome using the contact details associated with the request. If you need help, contact support@tshelo.co.bw.',
    ],
  },
]

export default function AccountDeletionPage() {
  return (
    <section className="member-policy-page">
      <Link className="member-policy-back" href={'/login' as Route}>
        <ArrowLeft size={15} /> Back to Tshelo
      </Link>

      <header className="member-policy-hero">
        <span className="member-policy-eyebrow"><ShieldCheck size={14} /> Account and data controls</span>
        <h1>Delete your <em>Tshelo account</em></h1>
        <p>Request the deletion of your Tshelo account and associated personal data. We explain the small set of shared records that may need to be retained below.</p>
        <a className="deletion-request-link" href="mailto:support@tshelo.co.bw?subject=Tshelo%20account%20deletion%20request">
          <Mail size={16} /> Request account deletion
        </a>
      </header>

      <div className="member-policy-layout">
        <nav className="member-policy-toc" aria-label="Account deletion contents">
          <strong>On this page</strong>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}><a href={`#${section.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="member-policy-document">
          <p className="member-policy-introduction">You can request deletion from within the app or from this page. Closing an account is not the same as freezing it: we process the request and remove the associated personal account data unless a legitimate retention reason applies.</p>
          {sections.map((section, index) => (
            <section id={section.id} key={section.id} className="member-policy-section">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </article>
      </div>
    </section>
  )
}
