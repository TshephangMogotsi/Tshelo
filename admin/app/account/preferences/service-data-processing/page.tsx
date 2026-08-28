import type { Metadata, Route } from 'next'
import { PolicyDocument, type PolicySection } from '@/components/account-preferences/policy-document'

export const metadata: Metadata = {
  title: 'Service data processing',
  description: 'Read how Tshelo processes information to provide account, fund, event, and reporting services.',
}

const sections: PolicySection[] = [
  {
    id: 'meaning',
    title: 'What service data processing means',
    paragraphs: [
      'Service data processing is the use of information that is necessary to create and secure your account and provide Tshelo’s fund, event, contribution, expense, reporting, notification, and support features.',
      'It is separate from optional marketing. If core processing is not active, Tshelo cannot reliably provide an account or preserve the shared records connected to it.',
    ],
  },
  {
    id: 'data',
    title: 'Data used by the service',
    paragraphs: [
      'Processing may use information you enter, information entered by another authorised member, and technical records generated while the service operates.',
    ],
    bullets: [
      'Your account identity, contact details, preferences, authentication state, and consent records.',
      'Fund and event setup, membership, roles, invitations, contributions, pledges, expenses, sponsorships, announcements, and supporting documents.',
      'Mobile-money references, submitted message details, or receipt images when you choose to use matching or receipt-reading features.',
      'Calculated totals, notifications, reports, reward and trust activity, audit history, security events, and support records.',
    ],
  },
  {
    id: 'operations',
    title: 'What Tshelo does with the data',
    paragraphs: [
      'Tshelo stores and organises records, connects them to the correct users and workspaces, calculates totals and outstanding amounts, reads user-submitted evidence, generates documents, sends relevant notifications, and preserves an audit history of important changes.',
      'Automated calculations and receipt or message reading help organise the information provided. Users and organisers should review the result and correct inaccurate records through the available controls or support process.',
    ],
  },
  {
    id: 'money',
    title: 'What Tshelo does not do',
    paragraphs: [
      'Tshelo does not hold, move, settle, or process the money recorded in a fund. Money passes between contributors and organisers through their own payment arrangements.',
      'A payment reference, message, receipt, or confirmed contribution is a record in Tshelo. It is not an independent guarantee that money moved, and members remain responsible for reconciling records with the relevant provider or supplier.',
    ],
  },
  {
    id: 'access',
    title: 'Access and service providers',
    paragraphs: [
      'Information is made available to fund and event participants according to their membership, role, and permissions. Tshelo personnel may access it when needed for support, safety, security, or service operation.',
      'Tshelo may use infrastructure and operational service providers to host, transmit, secure, analyse, or support the service. They receive only the access needed for those functions and are expected to handle information under appropriate obligations.',
    ],
  },
  {
    id: 'control',
    title: 'Accuracy, retention, and support',
    paragraphs: [
      'Users should enter accurate information, have permission to add information about other people, avoid adding unnecessary sensitive details, and keep supporting evidence appropriate to the fund or event.',
      'Core records may be kept while an account or shared fund needs them and for audit, security, dispute, or legal purposes. Corrections may be recorded as amendments rather than erasing the earlier audit history. Contact support@tshelo.co.bw to discuss a correction, account closure, or another data request.',
    ],
  },
]

export default function ServiceDataProcessingPage() {
  return (
    <PolicyDocument
      title="Service data"
      highlightedTitle="processing"
      summary="The information and operations Tshelo needs to provide accounts, shared workspaces, records, and reports."
      introduction="This page explains core service processing in practical terms: which records are involved, what Tshelo does with them, and where Tshelo's role ends. Optional marketing choices remain under your control in Account preferences."
      sections={sections}
      relatedHref={'/account/preferences/privacy-policy' as Route}
      relatedLabel="privacy policy"
    />
  )
}
