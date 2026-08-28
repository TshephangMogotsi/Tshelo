import type { Metadata, Route } from 'next'
import { PolicyDocument, type PolicySection } from '@/components/account-preferences/policy-document'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'Read how Tshelo collects, uses, shares, and protects account and workspace information.',
}

const sections: PolicySection[] = [
  {
    id: 'scope',
    title: 'What this policy covers',
    paragraphs: [
      'This policy applies when you use Tshelo on the web or in the mobile app. It covers your personal account and the information created when you join, contribute to, or organise a fund or event.',
      'A fund or event may contain information entered by several people. The visibility of that information depends on membership, the role a person has, and the fund or event settings.',
    ],
  },
  {
    id: 'information',
    title: 'Information we collect',
    paragraphs: [
      'We collect information you provide, information other authorised members add to a shared workspace, and service records created as Tshelo operates.',
    ],
    bullets: [
      'Account details such as your name, mobile number, optional email address, preferred currency, and consent choices.',
      'Fund and event records such as memberships, invitations, pledges, contributions, expenses, sponsorships, announcements, receipts, and payment references.',
      'Payment details from a mobile-money message or receipt only when that information is submitted to Tshelo for matching, recording, or receipt reading.',
      'Service records such as notifications, trust and reward activity, report exports, audit entries, support requests, and account security activity.',
    ],
  },
  {
    id: 'use',
    title: 'How we use information',
    paragraphs: [
      'We use this information to authenticate your account, provide shared fund and event workspaces, calculate recorded balances and progress, create reports, maintain an audit history, send service notifications, provide rewards, prevent misuse, and support users.',
      'Optional product news by email or SMS is controlled separately in Account preferences. Turning off marketing does not stop important account, fund, event, or security messages.',
    ],
  },
  {
    id: 'visibility',
    title: 'Who can see information',
    paragraphs: [
      'Members and organisers can see the records made available to their role in a fund or event. Organisers may be able to create, review, correct, export, or manage records where their permissions allow it.',
      'Tshelo personnel and service providers may access information when necessary to operate, secure, maintain, or support the service. Information may also be disclosed when required by law or to protect users, Tshelo, or the public.',
    ],
  },
  {
    id: 'retention',
    title: 'Retention and your choices',
    paragraphs: [
      'We keep information for as long as it is needed to provide the service and to preserve legitimate fund records, audit history, security, dispute handling, and legal obligations. Because funds are shared records, closing an account may not remove entries that other members need for an accurate history.',
      'You can update your profile and communication choices from the Account section. Contact support to request access, correction, account closure, or help with information you cannot manage yourself. We will assess requests against the shared record and any obligations that apply.',
    ],
  },
  {
    id: 'security',
    title: 'Security, changes, and contact',
    paragraphs: [
      'Tshelo uses mobile one-time codes, authenticated access, and role and permission checks to protect account and workspace information. No online service can guarantee absolute security, so keep your phone and sign-in codes secure and report suspicious activity promptly.',
      'We may update this policy when the service or its data practices change. The version and effective date at the top identify the document currently shown here. Questions can be sent to support@tshelo.co.bw.',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <PolicyDocument
      title="Privacy"
      highlightedTitle="policy"
      summary="How Tshelo collects, uses, shares, and protects information connected to your account, funds, and events."
      introduction="This is a plain-language explanation of Tshelo's current privacy practices. Read it together with the service data processing explanation, which describes the operations needed to provide your account."
      sections={sections}
      relatedHref={'/account/preferences/service-data-processing' as Route}
      relatedLabel="service data processing"
    />
  )
}
