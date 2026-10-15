import { brand } from '@glasswork/shared/brand';

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { slug: string; title: string; summary: string; sections: LegalSection[] };

const P = brand.productName;
const E = brand.legalEntity;

/**
 * DRAFTS. Every page renders a visible "pending lawyer review" notice (brief §9). The registered entity name and
 * address are TODOs in brand.ts (Q2). Nothing here is legal advice.
 */
export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    summary: `The agreement between you and ${E} for using ${P}.`,
    sections: [
      {
        heading: '1. Who we are',
        body: [
          `${P} is operated by ${E} ("we", "us"). By creating an account or using the service you agree to these terms.`,
        ],
      },
      {
        heading: '2. Accounts',
        body: [
          'You must be at least 18 and provide accurate information. One account can act as buyer and seller. You are responsible for activity under your account and for keeping your credentials and two-factor methods secure.',
        ],
      },
      {
        heading: '3. The marketplace',
        body: [
          `${P} provides tools for buyers and independent sellers to agree, fund, deliver and review software work. Sellers are independent contractors, not our employees. A contract for services is formed between the buyer and the seller; we are not a party to it, except for holding and releasing escrow funds.`,
          `Services listed by ${E}'s own agency are labelled "${brand.operatedByLabel}". They receive no ranking advantage.`,
        ],
      },
      {
        heading: '4. Orders, milestones and escrow',
        body: [
          'Each milestone is funded separately and held until the buyer approves it, or it is auto-approved after the review window described in the product with reminders beforehand. A funded milestone under dispute is frozen until resolved. Amounts, fees and the total are shown before payment and are calculated on our servers.',
        ],
      },
      {
        heading: '5. Fees',
        body: [
          'Buyer service fees and seller commissions, if any, are shown in the checkout and the earnings pages. The commission applicable to a milestone is fixed when it is funded.',
        ],
      },
      {
        heading: '6. Changes, cancellations and refunds',
        body: [
          'Scope changes must be made through a change request accepted by both parties. Cancellation and refund rules are described in the Buyer Protection policy. Where a dispute is opened, our operations team may release, refund or split a held milestone based on the evidence.',
        ],
      },
      {
        heading: '7. Intellectual property',
        body: [
          'Unless the parties agree otherwise in writing, ownership of the deliverables for a milestone transfers to the buyer upon the seller receiving final payment for that work. Sellers keep pre-existing tools and know-how and grant the buyer a licence to use anything of theirs embedded in the deliverables. Sellers may show non-confidential work in their portfolio unless an NDA applies.',
        ],
      },
      {
        heading: '8. Conduct',
        body: [
          'You must follow the Acceptable Use Policy. Do not move payment or contact details off-platform before an order exists; doing so removes escrow and dispute protection. We may warn, suspend or remove accounts and listings that break the rules.',
        ],
      },
      {
        heading: '9. AI features',
        body: [
          'AI features draft briefs, explain matches and summarise progress. Outputs may be inaccurate, are labelled as estimates or drafts where relevant, and do not constitute a quote, advice or a guarantee.',
        ],
      },
      {
        heading: '10. Liability',
        body: [
          'To the extent permitted by law, we are not liable for indirect or consequential loss, and our total liability is limited to the fees we received for the transaction concerned. Nothing limits liability that cannot be limited by law.',
        ],
      },
      {
        heading: '11. Governing law and disputes',
        body: [
          'TODO (lawyer): governing law, jurisdiction and arbitration clause depend on the registered entity and country (open question Q1/Q2).',
        ],
      },
      {
        heading: '12. Changes to these terms',
        body: [
          'We will give notice of material changes. Continued use after the effective date means acceptance.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What personal data we collect, why, and the choices you have.',
    sections: [
      { heading: '1. Controller', body: [`${E}, ${brand.legalAddress}. Contact: ${brand.supportEmail}.`] },
      {
        heading: '2. Data we collect',
        body: [
          'Account data (name, email, password hash, two-factor settings), profile and portfolio content, messages and files in projects, payment and payout records (card data is handled by our payment provider and never stored by us), meeting metadata and, with consent, recordings, device and log data, and usage analytics if you accept analytics cookies.',
        ],
      },
      {
        heading: '3. Why we use it',
        body: [
          'To provide the marketplace and escrow, to keep the platform safe (fraud, abuse, chat-safety warnings), to send transactional notifications, to meet legal obligations, and, with your consent, to measure and improve the product.',
        ],
      },
      {
        heading: '4. AI processing',
        body: [
          'When you use AI features, relevant text (for example your idea or project activity) is sent to our AI provider to produce the output. We do not allow the provider to train on your content under our agreement, and we keep usage records (token counts and cost), not prompts, for cost control.',
        ],
      },
      {
        heading: '5. Sharing',
        body: [
          'With the other party in a project, with service providers (hosting, email, payments, video, error tracking, analytics) under contract, and where the law requires. We do not sell personal data.',
        ],
      },
      {
        heading: '6. Retention',
        body: [
          'We keep data while your account is active and as required for financial records and disputes. TODO (lawyer): exact retention periods.',
        ],
      },
      {
        heading: '7. Your rights',
        body: [
          'You can access, correct, export and delete your data, and withdraw consent, subject to legal retention duties. Contact us to exercise these rights.',
        ],
      },
      {
        heading: '8. Security and transfers',
        body: [
          'We use encryption in transit, hashed passwords, access controls and audit logs. Data may be processed in countries other than yours; TODO (lawyer): transfer mechanisms.',
        ],
      },
    ],
  },
  {
    slug: 'seller-agreement',
    title: 'Seller Agreement',
    summary: `Additional terms for people and agencies who sell on ${P}.`,
    sections: [
      {
        heading: '1. Independent contractor',
        body: [
          'You sell as an independent business. You are responsible for your taxes, equipment, staff and subcontractors, and for having the right to deliver what you sell.',
        ],
      },
      {
        heading: '2. Accurate listings and verification',
        body: [
          'Your profile, portfolio and services must be accurate. Verification badges are displayed only when verification succeeds. You will not claim credentials or work that is not yours.',
        ],
      },
      {
        heading: '3. Delivery',
        body: [
          'Deliver milestones as described, on time, through the project room. Keep buyers informed; the board, previews and deliverables are the record of progress.',
        ],
      },
      {
        heading: '4. Payment and commission',
        body: [
          'You are paid for approved or auto-approved milestones, net of the commission fixed at funding. Payout availability depends on your payout method and verification, and may be delayed for fraud review or disputes.',
        ],
      },
      {
        heading: '5. Intellectual property',
        body: [
          'Ownership of milestone deliverables passes to the buyer on final payment, unless otherwise agreed in writing. You warrant that your work does not infringe third-party rights and that open-source licences used are disclosed to the buyer.',
        ],
      },
      {
        heading: '6. Confidentiality',
        body: [
          'Treat buyer information as confidential. Where an NDA template is accepted in-app, its terms also apply.',
        ],
      },
      {
        heading: '7. Off-platform dealings',
        body: [
          'Do not take payment or move communication off the platform to avoid fees or protections. We may remove accounts that do.',
        ],
      },
      {
        heading: '8. Termination',
        body: [
          'You may stop selling at any time after completing open projects. We may suspend or remove sellers for breach, fraud or repeated poor outcomes, with reasons given where practicable.',
        ],
      },
    ],
  },
  {
    slug: 'buyer-protection',
    title: 'Buyer Protection',
    summary: 'How your payments and projects are protected.',
    sections: [
      {
        heading: 'Escrow per milestone',
        body: [
          'Your payment for a milestone is held and is released to the seller only after you approve the work, or the review window ends with reminders sent first.',
        ],
      },
      {
        heading: 'Revisions',
        body: [
          'If a delivery does not meet the agreed scope, request changes with feedback pinned to the exact file or region. The package states how many revisions are included.',
        ],
      },
      {
        heading: 'Disputes',
        body: [
          'If you cannot agree, open a dispute on a funded, unfinished milestone. We freeze the milestone, collect a case file (messages, deliverable versions, approvals, change requests and timeline), and our operations team decides: release, refund, or a split with exact amounts recorded.',
        ],
      },
      {
        heading: 'What is not covered',
        body: [
          'Payments made outside the platform, scope the seller never agreed to deliver, and work you approved. Always keep communication and payment on the platform.',
        ],
      },
      {
        heading: 'Your data',
        body: [
          'Files are scanned before they can be downloaded and are visible only to project participants.',
        ],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    summary: 'What is and is not allowed on the platform.',
    sections: [
      {
        heading: 'Not allowed',
        body: [
          'Illegal content or services; malware, credential theft or tools designed for unauthorised access; impersonation or fake credentials; fake reviews or manipulation of ratings; harassment or hate; infringing others’ intellectual property; circumventing fees or protections; scraping or abusing the service; attempting to access other users’ data.',
        ],
      },
      {
        heading: 'Security testing',
        body: [
          'Services involving security testing are allowed only for systems the buyer owns or is authorised to test, and the scope must be stated in the listing.',
        ],
      },
      {
        heading: 'Reporting',
        body: [
          'Use the Report button on users, services, messages and reviews. Operations staff review reports and may warn, take down listings, or suspend accounts.',
        ],
      },
      {
        heading: 'Enforcement',
        body: [
          'We may remove content and suspend accounts. Repeated or serious breaches lead to permanent removal. Funds under dispute are handled according to the Terms.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    summary: 'The cookies and similar storage we use.',
    sections: [
      {
        heading: 'Essential',
        body: [
          'A secure, httpOnly session cookie keeps you signed in, and a theme preference remembers light or dark mode. These do not require consent.',
        ],
      },
      {
        heading: 'Analytics (optional)',
        body: [
          'When product analytics is enabled, we ask first: if you accept, we use it to understand which features are used; if you decline, no analytics scripts are loaded. You can change your choice any time from the cookie settings link in the footer. When analytics is not enabled, we use no analytics cookies at all.',
        ],
      },
      {
        heading: 'Third parties',
        body: [
          'Payment and video providers may set their own cookies on their hosted pages. See their policies.',
        ],
      },
    ],
  },
];

export const getLegalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);
