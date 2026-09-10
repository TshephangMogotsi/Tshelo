export type LegalSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type LegalDocumentContent = {
  title: string
  highlightedTitle: string
  summary: string
  introduction: string
  version: string
  effectiveDate: string
  sections: LegalSection[]
}

export const PRIVACY_POLICY: LegalDocumentContent = {
  title: 'Privacy',
  highlightedTitle: 'policy',
  summary: 'How Tshelo collects, uses, shares, and protects information connected to your account, funds, and events.',
  introduction: "This is a plain-language explanation of Tshelo's current privacy practices. Read it together with the service data processing explanation, which describes the operations needed to provide your account.",
  version: '1.0',
  effectiveDate: '27 August 2026',
  sections: [
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
  ],
}

export const TERMS_OF_SERVICE: LegalDocumentContent = {
  title: 'Terms of',
  highlightedTitle: 'service',
  summary: 'The rules that apply when you use Tshelo to organise funds, events, contributions, expenses, and shared records.',
  introduction: 'These terms are an agreement between you and the operator of the Tshelo service. They explain what Tshelo provides, what members and organisers remain responsible for, and the limits of the service.',
  version: '1.0',
  effectiveDate: '10 September 2026',
  sections: [
    {
      id: 'agreement',
      title: 'Agreement and eligibility',
      paragraphs: [
        'By creating an account, accepting an invitation, or using Tshelo, you agree to these terms and acknowledge the Privacy Policy. If you use Tshelo for an organisation or group, you confirm that you have authority to act for it.',
        'You must be legally capable of entering this agreement. A person who is not legally able to agree independently may use Tshelo only with the involvement and permission of a parent, guardian, or other authorised representative, where permitted by law.',
      ],
    },
    {
      id: 'account',
      title: 'Your account and security',
      paragraphs: [
        'Provide accurate information, keep your phone and one-time sign-in codes secure, and notify us promptly if you believe your account has been misused. You are responsible for activity performed through your account unless applicable law provides otherwise.',
        'Your display name and relevant activity may be visible to people who share a fund or event with you. Do not impersonate another person or create an account using information you are not authorised to use.',
      ],
    },
    {
      id: 'service',
      title: 'What Tshelo provides',
      paragraphs: [
        'Tshelo provides tools for creating and managing funds and events, inviting participants, recording pledges, contributions and expenses, storing supporting records, sending notifications, and producing summaries or reports.',
        'Organisers control many workspace settings and records. Members remain responsible for understanding the rules of each group, reviewing records made available to them, and raising mistakes or disputes promptly.',
      ],
    },
    {
      id: 'money',
      title: 'Money, contributions, and payment records',
      paragraphs: [
        'Tshelo does not hold, receive, transfer, settle, invest, or safeguard money contributed to a fund. Members and organisers use their own payment arrangements or third-party payment providers.',
        'A contribution entry, payment reference, message, receipt, calculated balance, or confirmation in Tshelo is a record supplied or reviewed by users. It is not an independent guarantee that money moved, that a payment cannot be reversed, or that a member or organiser fulfilled an obligation.',
        'Users must reconcile important records with the relevant bank, mobile-money provider, supplier, and other participants. Disputes about an underlying payment or group obligation remain between the affected parties, although Tshelo may provide available records or support.',
      ],
    },
    {
      id: 'paid-features',
      title: 'Tokens, plans, and paid features',
      paragraphs: [
        'Where Tshelo offers tokens, plans, or other paid features, the price and included service will be shown before purchase. Payment may be processed by an external provider under that provider’s terms.',
        'Tshelo tokens are limited-purpose service credits. They are not money, electronic money, a deposit, an investment, or a transferable asset, and they cannot be redeemed for cash. Trust points are reputation indicators and cannot be bought, transferred, redeemed, or converted into tokens or cash.',
        'Refunds, cancellations, and corrections are handled according to the offer shown at purchase and any rights that cannot lawfully be excluded.',
      ],
    },
    {
      id: 'content',
      title: 'Information and content you provide',
      paragraphs: [
        'You retain ownership of content you submit. You give Tshelo permission to host, copy, process, display, and transmit that content only as needed to operate, secure, improve, and support the service and the workspaces in which you participate.',
        'Only submit information, contact details, messages, receipts, images, or documents that you are authorised to use and share. Avoid unnecessary sensitive information, and make sure records are accurate and relevant to the fund or event.',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      paragraphs: [
        'Do not use Tshelo to break the law, deceive or harass others, misappropriate money, falsify records, distribute malware, interfere with security, probe the service without authorisation, scrape information, or access another person’s account or workspace without permission.',
        'We may investigate suspected misuse, preserve relevant records, restrict content or features, and cooperate with lawful requests where appropriate.',
      ],
    },
    {
      id: 'availability',
      title: 'Availability and changes',
      paragraphs: [
        'We aim to provide a reliable service, but Tshelo may occasionally be unavailable because of maintenance, connectivity, security events, third-party services, or circumstances outside our reasonable control.',
        'We may add, change, suspend, or retire features. Where a material change affects paid access or important user rights, we will provide reasonable notice when practicable.',
      ],
    },
    {
      id: 'closure',
      title: 'Suspension and account closure',
      paragraphs: [
        'You may request account closure by contacting support. We may suspend or close an account that creates security risk, seriously or repeatedly breaches these terms, or must be restricted to comply with law.',
        'Because funds and events contain shared records, closing an account may not erase contributions, expenses, audit entries, or other information that remaining participants reasonably need for an accurate history. Access to personal information remains subject to the Privacy Policy and applicable law.',
      ],
    },
    {
      id: 'responsibility',
      title: 'Responsibility and legal limits',
      paragraphs: [
        'Tshelo is provided on an “as available” basis. To the fullest extent permitted by law, we do not guarantee that user-entered information is accurate, that third-party services will remain available, or that participants will meet their commitments.',
        'Nothing in these terms excludes a right or responsibility that cannot lawfully be excluded. Subject to those rights, Tshelo is not responsible for an underlying payment, loss caused by another user, a dispute between participants, or the acts or failures of a bank, mobile-money operator, merchant, network, or other third party.',
        'These terms are governed by the laws of Botswana. The parties should first try to resolve a concern through support; unresolved matters may be brought before a court or other competent authority with jurisdiction in Botswana.',
      ],
    },
    {
      id: 'changes-contact',
      title: 'Updates and contact',
      paragraphs: [
        'We may update these terms as the service, law, or operating model changes. The version and effective date at the top identify the terms currently shown. If a change is material, we may ask you to review and accept the updated terms before continuing to use affected features.',
        'Questions, complaints, or account-closure requests can be sent to support@tshelo.co.bw.',
      ],
    },
  ],
}
