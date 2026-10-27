import { brand } from '@glasswork/shared/brand';
import { SELLER_LEVELS } from '@glasswork/shared';

/** Help center articles. Written to match what the product actually does; update them with the feature. */
export interface HelpSection {
  heading?: string;
  body?: string[];
  steps?: string[];
  bullets?: string[];
}
export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategory;
  summary: string;
  sections: HelpSection[];
}
export const HELP_CATEGORIES = [
  { key: 'getting-started', label: 'Getting started', blurb: 'Accounts, modes and your first project.' },
  { key: 'buying', label: 'Buying', blurb: 'Briefs, offers, funding and approving work.' },
  { key: 'selling', label: 'Selling', blurb: 'Onboarding, listings, levels and getting paid.' },
  { key: 'payments', label: 'Payments & protection', blurb: 'Escrow, fees, refunds and disputes.' },
  { key: 'account', label: 'Account & privacy', blurb: 'Security, notifications and your data.' },
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number]['key'];

const P = brand.productName;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'create-an-account',
    title: 'Create an account and switch between buying and selling',
    category: 'getting-started',
    summary: 'One account works as both a buyer and a seller.',
    sections: [
      {
        steps: [
          'Choose Sign up and register with your email and a password, or continue with Google or GitHub when those options are shown.',
          'Open the verification email we send you and follow the link. Verification protects your account and is needed before some actions.',
          'Use the mode switch in the header to move between buying and selling. You do not need a second account.',
        ],
      },
      {
        heading: 'Good to know',
        bullets: [
          'You can browse services, requests and seller profiles without an account.',
          'Turn on two-factor authentication under Settings → Security.',
        ],
      },
    ],
  },
  {
    slug: 'how-a-project-works',
    title: 'How a project works from first message to final approval',
    category: 'getting-started',
    summary: `The life of a project on ${P}, step by step.`,
    sections: [
      {
        steps: [
          'Agree the scope: pick a service package, accept a proposal, or accept a custom offer from chat.',
          'The project is split into milestones. Each milestone has its own price and is funded separately.',
          'Fund the first milestone. The money is held in escrow, not paid to the seller yet.',
          'The seller starts work and updates the Project Room. You see overall progress, health, tasks, deliverables and previews as they change.',
          'The seller submits the milestone. You approve it, or request changes with feedback.',
          'On approval the funds are released to the seller. Fund the next milestone and repeat.',
          'After the final milestone you can leave a public review.',
        ],
      },
      {
        body: [
          'If you do not respond to a submitted milestone, you get reminders first. After the review window the milestone is approved automatically, so sellers are not left waiting indefinitely.',
        ],
      },
    ],
  },
  {
    slug: 'write-a-brief-with-ai',
    title: 'Describe your idea with the AI brief builder',
    category: 'buying',
    summary: 'Turn a rough idea into a structured brief with suggested milestones.',
    sections: [
      {
        steps: [
          'Open AI brief builder from the home page or Requests → New request.',
          'Describe what you want to build in a few sentences. Do not worry about technical wording.',
          'Answer the clarifying questions. You can skip any you are unsure about.',
          'Review the structured brief: goals, user stories, platforms, integrations and suggested milestones.',
          'Edit anything you like, then post it as a request or use it to find matching sellers.',
        ],
      },
      {
        heading: 'About the estimates',
        body: [
          'Budget and timeline ranges are always labelled as estimates. They help you plan; the real price is whatever a seller proposes and you accept. The AI assists you, it never accepts offers or spends money on your behalf.',
        ],
      },
    ],
  },
  {
    slug: 'find-the-right-seller',
    title: 'Find and compare sellers',
    category: 'buying',
    summary: 'Search, filter, and use AI matching with explanations.',
    sections: [
      {
        heading: 'Browse and filter',
        body: [
          'Use Browse services to filter by category, budget, delivery time, seller level, rating and verified-only. Save services you like with the heart icon.',
        ],
      },
      {
        heading: 'Use matching',
        body: [
          'Find a match ranks sellers using skills, portfolio, ratings, response time, availability and budget fit, and explains each match in plain language, so you can see why a seller was suggested.',
        ],
      },
      {
        heading: 'What to check on a profile',
        bullets: [
          'Verification badges appear only once actually verified.',
          'The seller level is computed from completed projects, reviews, rating and on-time delivery.',
          'Reviews come only from paying buyers whose project was completed.',
          'Ask questions in chat before ordering. Keep payments on the platform so you stay protected.',
        ],
      },
    ],
  },
  {
    slug: 'post-a-request',
    title: 'Post a request and choose a proposal',
    category: 'buying',
    summary: 'Let sellers come to you with a plan and a price.',
    sections: [
      {
        steps: [
          'Go to Requests → New request, or start from the AI brief builder.',
          'Add a title, description, budget range and timeline. Clear scope gets better proposals.',
          'Sellers send proposals with a milestone plan and a price. You are notified as they arrive.',
          'Compare proposals, ask questions in chat, and accept one. The project is created with the proposed milestones.',
        ],
      },
      { body: ['You can close a request at any time. Nothing is charged until you fund a milestone.'] },
    ],
  },
  {
    slug: 'fund-and-approve-milestones',
    title: 'Fund, review and approve a milestone',
    category: 'buying',
    summary: 'How you stay in control of your money.',
    sections: [
      {
        heading: 'Funding',
        body: [
          'Before paying you see the milestone price, any service fee and the total. The amounts are calculated on our servers, never in your browser. Funds are held in escrow for that milestone only.',
        ],
      },
      {
        heading: 'Reviewing submitted work',
        steps: [
          'Open the Deliverables tab in the Project Room and look at the files, previews or builds.',
          'Pin feedback to a file or a region of a screenshot if something needs to change.',
          'Choose Approve to release the funds, or Request changes to send the milestone back with your notes.',
        ],
      },
      {
        body: [
          'If the work is not what was agreed and you cannot resolve it in chat, open a dispute before approving. See “Open a dispute”.',
        ],
      },
    ],
  },
  {
    slug: 'change-requests',
    title: 'Change the scope with a change request',
    category: 'buying',
    summary: 'Scope changes are written down with their time and price impact.',
    sections: [
      {
        body: [
          'Either side can propose a change from the Project Room. A change request states what changes, the effect on the timeline and the price difference.',
        ],
      },
      {
        steps: [
          'The other side reviews it and accepts or declines.',
          'If accepted, the milestones are updated. Any added amount must be funded before that work starts.',
        ],
      },
      {
        body: [
          'Because every change is recorded, there are no surprise invoices and disputes have a clear history.',
        ],
      },
    ],
  },
  {
    slug: 'become-a-seller',
    title: 'Become a seller: onboarding checklist',
    category: 'selling',
    summary: 'What you need to publish your first service.',
    sections: [
      {
        steps: [
          'Open Become a seller and complete your profile: display name, headline, bio, skills and rates.',
          'Add portfolio items that show real work you did.',
          'Connect a payout method when payouts are enabled for your country.',
          'Submit identity verification and any optional badges (GitHub, store links).',
          'Create your first service with three packages, an image gallery and a requirements form.',
        ],
      },
      {
        body: [
          'Listings go through moderation before they appear publicly. You can edit or pause a service at any time.',
        ],
      },
    ],
  },
  {
    slug: 'write-a-great-service',
    title: 'Write a service that converts',
    category: 'selling',
    summary: 'Practical advice for titles, packages and requirements.',
    sections: [
      {
        bullets: [
          'Title: say what the buyer gets (“Production-ready Next.js SaaS MVP”), not who you are.',
          'Packages: make Basic, Standard and Premium differ in scope and delivery time, not just price.',
          'Milestones: split work into steps the buyer can verify. Smaller milestones mean faster, safer payouts.',
          'Gallery: use real screenshots from your own work. Images that are not yours break the rules.',
          'Requirements: ask only what you need to start, so buyers can answer in one sitting.',
          'FAQs: answer the three questions you hear most.',
        ],
      },
    ],
  },
  {
    slug: 'seller-levels',
    title: 'How seller levels work',
    category: 'selling',
    summary: 'Levels are earned from real data, never bought or granted.',
    sections: [
      {
        body: [
          'A seller needs every criterion of a level. Levels recalculate automatically from completed projects, public reviews, average rating and the share of milestones submitted on time.',
        ],
      },
      {
        bullets: SELLER_LEVELS.filter((l) => l.key !== 'new').map(
          (l) =>
            `${l.label}: ${l.criteria.completedProjects}+ completed projects, ${l.criteria.reviewCount}+ reviews, ${l.criteria.avgRating.toFixed(1)}+ rating, ${Math.round(l.criteria.onTimeRate * 100)}%+ on time.`,
        ),
      },
      {
        body: [
          'Your seller dashboard shows exactly what is missing for the next level. If there is not enough data for a metric, we show “not enough data yet” rather than a made-up number.',
        ],
      },
    ],
  },
  {
    slug: 'get-paid',
    title: 'Getting paid as a seller',
    category: 'selling',
    summary: 'When money is released and how it reaches you.',
    sections: [
      {
        steps: [
          'The buyer funds a milestone. You see it as funded in the Project Room, which is your signal to start.',
          'Submit the milestone when the work is ready. Include a note describing what changed.',
          'Funds are released when the buyer approves, or automatically after the review window.',
          'Your earnings page shows released amounts, the commission applied and payout status.',
        ],
      },
      {
        body: [
          'The commission for a milestone is fixed when it is funded, so it cannot change mid-project. Payout availability depends on your country and the payout provider.',
        ],
      },
    ],
  },
  {
    slug: 'escrow-and-fees',
    title: 'How escrow and fees work',
    category: 'payments',
    summary: 'Where your money is, and what it costs.',
    sections: [
      {
        body: [
          'Each milestone is funded and held separately. Money is released only when the buyer approves the work or the review window passes after reminders. A milestone under dispute is frozen until our team resolves it.',
          'Every movement is recorded in an append-only ledger, so balances can always be explained.',
        ],
      },
      {
        heading: 'Fees',
        body: [
          'Checkout shows a full breakdown before you pay: milestone price, service fee if any, and total. Sellers see the commission on each milestone. See the Fees & escrow page for the current rules.',
        ],
      },
    ],
  },
  {
    slug: 'refunds-and-cancellations',
    title: 'Refunds and cancellations',
    category: 'payments',
    summary: 'What happens if a project cannot continue.',
    sections: [
      {
        body: [
          'Escrow covers funded milestones that have not been approved. Money already released for approved work is not refunded automatically.',
        ],
      },
      {
        steps: [
          'Either side can request cancellation from the Project Room, with a reason.',
          'If both sides agree, unreleased funds are returned to the buyer according to the agreement.',
          'If you cannot agree, open a dispute and our team will decide based on the recorded evidence.',
        ],
      },
    ],
  },
  {
    slug: 'open-a-dispute',
    title: 'Open a dispute',
    category: 'payments',
    summary: 'A structured case file instead of a screenshot argument.',
    sections: [
      {
        steps: [
          'Try to resolve it in chat first. Many issues are misunderstandings that a revision fixes.',
          'In the Project Room choose Open a dispute and select the milestone concerned.',
          'Describe the problem and attach any extra evidence.',
          'We automatically assemble the case file: messages, deliverable versions, approvals, change requests and the timeline.',
          'Both sides can respond. Our team reviews the evidence and decides on a refund, a release or a split.',
        ],
      },
      {
        body: [
          'While a milestone is disputed its funds stay frozen. Decisions and their reasons are recorded.',
        ],
      },
    ],
  },
  {
    slug: 'account-security',
    title: 'Keep your account secure',
    category: 'account',
    summary: 'Two-factor authentication, sessions and safe habits.',
    sections: [
      {
        steps: [
          'Open Settings → Security.',
          'Turn on two-factor authentication and save the recovery codes somewhere safe.',
          'Review active sessions and sign out of any you do not recognise, or use Log out everywhere.',
        ],
      },
      {
        bullets: [
          `Staff never ask for your password or codes. Anyone who does is not from ${P}.`,
          'Keep conversations and payments on the platform. We warn you when payment or contact details are shared before an order exists.',
        ],
      },
    ],
  },
  {
    slug: 'notifications',
    title: 'Control your notifications',
    category: 'account',
    summary: 'Choose what reaches you in the app, by email and on the web.',
    sections: [
      {
        body: [
          'Open Settings → Notifications to choose, per type of event, whether you are told in the app, by email, or both. Milestone, payment and dispute updates matter most for staying on schedule.',
        ],
      },
    ],
  },
  {
    slug: 'export-or-delete-your-data',
    title: 'Export or delete your data',
    category: 'account',
    summary: 'Your data is yours.',
    sections: [
      {
        heading: 'Export',
        body: ['Settings → Your data → Download my data saves your account data as a JSON file.'],
      },
      {
        heading: 'Delete your account',
        body: [
          'Settings → Your data → Delete my account removes your personal information and signs you out everywhere. Records needed for financial integrity and disputes are kept without your personal details and appear as “Deleted user”.',
          'Deletion is not possible while a project is live, a dispute is open, a payout is pending or a balance is unpaid. Finish or settle those first.',
        ],
      },
    ],
  },
];

export const getHelpArticle = (slug: string) => HELP_ARTICLES.find((a) => a.slug === slug);
