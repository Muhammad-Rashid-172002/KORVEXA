/**
 * Per-category guidance for the gig wizard: example titles, suggested package contents, requirement questions and
 * FAQs. These are starting points the seller always edits; prices are typical ranges, not promises, and the same
 * data feeds the offline AI helper so the wizard works without an API key.
 */

export interface PackageSuggestion {
  title: string;
  description: string;
  /** USD whole dollars. */
  price: number;
  days: number;
  revisions: number;
}

export interface GigTemplate {
  /** Brand hue used for covers and cards (degrees). */
  hue: number;
  /** Plain-language example titles shown while the seller types. */
  titleExamples: string[];
  packages: Record<'basic' | 'standard' | 'premium', PackageSuggestion>;
  requirements: string[];
  faqs: { question: string; answer: string }[];
  tags: string[];
}

const pkg = (
  title: string,
  description: string,
  price: number,
  days: number,
  revisions: number,
): PackageSuggestion => ({ title, description, price, days, revisions });

export const GIG_TEMPLATES: Record<string, GigTemplate> = {
  'web-development': {
    hue: 160,
    titleExamples: [
      'I will build a fast, mobile-friendly website for your business',
      'I will create your online shop with Next.js',
    ],
    packages: {
      basic: pkg(
        'Starter site',
        'One-page website, mobile friendly, contact form, basic SEO setup.',
        150,
        5,
        1,
      ),
      standard: pkg(
        'Business site',
        'Up to 5 pages, contact form, SEO setup, analytics, and a short handover video.',
        400,
        10,
        2,
      ),
      premium: pkg(
        'Full web app',
        'Custom web app with login, database, admin page, deployment, and 30 days of support.',
        1200,
        30,
        3,
      ),
    },
    requirements: [
      'What is your business and who are your customers?',
      'Share links to 2-3 websites you like.',
      'Do you already have a logo, colours and text? Attach them if yes.',
    ],
    faqs: [
      {
        question: 'Will my site work on phones?',
        answer: 'Yes. Every site is built mobile-first and tested on small screens.',
      },
      {
        question: 'Can I edit the text myself later?',
        answer: 'Yes. I can set it up so you can change text and images without coding.',
      },
    ],
    tags: ['website', 'nextjs', 'react', 'responsive'],
  },
  'mobile-apps': {
    hue: 190,
    titleExamples: [
      'I will build a Flutter app for your business',
      'I will turn your idea into an iPhone and Android app',
    ],
    packages: {
      basic: pkg(
        'Simple app',
        '3 screens, clean design, runs on Android or iPhone, source code included.',
        300,
        10,
        1,
      ),
      standard: pkg(
        'Business app',
        'Up to 8 screens, login, backend connection, push notifications, runs on both Android and iPhone.',
        900,
        25,
        2,
      ),
      premium: pkg(
        'Launch-ready app',
        'Full app with payments, admin tools, store listing help, and 30 days of fixes after launch.',
        2500,
        45,
        3,
      ),
    },
    requirements: [
      'Describe what the app should do in a few sentences.',
      'Which phones should it run on: Android, iPhone, or both?',
      'Do you have designs already? Attach them if yes.',
    ],
    faqs: [
      {
        question: 'Do you publish the app to the stores?',
        answer: 'Yes in Standard and Premium. You keep ownership of the store accounts.',
      },
      {
        question: 'Do I get the source code?',
        answer: 'Yes. All code is yours once the final milestone is paid.',
      },
    ],
    tags: ['flutter', 'android', 'ios', 'mobile app'],
  },
  'ai-ml': {
    hue: 140,
    titleExamples: [
      'I will build an AI chatbot trained on your own documents',
      'I will add AI features to your app',
    ],
    packages: {
      basic: pkg('Proof of concept', 'A working demo of one AI feature using your example data.', 200, 7, 1),
      standard: pkg(
        'Working feature',
        'AI feature added to your product, tested, with usage limits and a short guide.',
        700,
        14,
        2,
      ),
      premium: pkg(
        'Production AI',
        'Full AI workflow with monitoring, cost controls, safety checks and 30 days of support.',
        2000,
        30,
        3,
      ),
    },
    requirements: [
      'What should the AI help your users do?',
      'Share example questions or documents it should know about.',
      'Which tools or apps does it need to connect to?',
    ],
    faqs: [
      {
        question: 'Will the AI make things up?',
        answer: 'I add checks and sources so answers stay grounded in your data, and I explain the limits.',
      },
      {
        question: 'What will it cost to run?',
        answer: 'I give you an estimate of monthly usage cost before we start.',
      },
    ],
    tags: ['ai', 'chatbot', 'automation', 'llm'],
  },
  saas: {
    hue: 170,
    titleExamples: [
      'I will build your SaaS MVP so you can start getting users',
      'I will create a secure backend and API for your app',
    ],
    packages: {
      basic: pkg(
        'API starter',
        'A secure backend with up to 5 endpoints, documentation and tests.',
        250,
        7,
        1,
      ),
      standard: pkg(
        'MVP core',
        'Login, billing-ready accounts, database, admin page and a working first version.',
        1500,
        25,
        2,
      ),
      premium: pkg(
        'Full MVP',
        'Everything in MVP core plus payments, emails, monitoring and 30 days of support.',
        4000,
        50,
        3,
      ),
    },
    requirements: [
      'What problem does your product solve and for whom?',
      'List the 3 most important features for the first version.',
      'Do you have a preferred technology? If not, I will suggest one.',
    ],
    faqs: [
      {
        question: 'Can it grow with my users?',
        answer: 'Yes. I build on common tools so it scales without a rewrite.',
      },
      { question: 'Who owns the code?', answer: 'You do, once the final payment is released.' },
    ],
    tags: ['saas', 'api', 'backend', 'mvp'],
  },
  design: {
    hue: 150,
    titleExamples: [
      'I will design a clean, modern app screen set in Figma',
      'I will create your logo and brand colours',
    ],
    packages: {
      basic: pkg('Quick design', '1 concept, 3 screens or 1 logo, editable files included.', 80, 3, 1),
      standard: pkg(
        'Full design',
        'Up to 10 screens or logo with colours and fonts, plus a clickable prototype.',
        300,
        7,
        3,
      ),
      premium: pkg(
        'Design system',
        'Complete screens, reusable components, brand guide and developer handover.',
        800,
        14,
        5,
      ),
    },
    requirements: [
      'What is your project about, in a few sentences?',
      'Share examples of designs you love.',
      'Do you have brand colours or a logo already?',
    ],
    faqs: [
      { question: 'Which files do I get?', answer: 'Editable Figma files plus exported images.' },
      {
        question: 'Can I ask for changes?',
        answer: 'Yes. Each package lists how many rounds of changes are included.',
      },
    ],
    tags: ['figma', 'ui design', 'logo', 'branding'],
  },
  devops: {
    hue: 200,
    titleExamples: [
      'I will set up your app on the cloud with automatic deployments',
      'I will make your website faster and more reliable',
    ],
    packages: {
      basic: pkg(
        'Hosting setup',
        'Your app live on a cloud server with HTTPS and a simple guide.',
        120,
        3,
        1,
      ),
      standard: pkg(
        'Auto deploy',
        'Hosting plus automatic deployments, backups and basic monitoring.',
        450,
        7,
        2,
      ),
      premium: pkg(
        'Production setup',
        'Zero-downtime deploys, alerts, backup tests, security hardening and a runbook.',
        1200,
        14,
        3,
      ),
    },
    requirements: [
      'Where does your app run today?',
      'Give me read access to the code repository.',
      'How many users do you expect?',
    ],
    faqs: [
      {
        question: 'Will my site go down while you work?',
        answer: 'No. I prepare everything first and switch over at a time you choose.',
      },
      { question: 'Do I keep access?', answer: 'Yes. All accounts stay in your name.' },
    ],
    tags: ['aws', 'docker', 'ci cd', 'hosting'],
  },
  'qa-testing': {
    hue: 130,
    titleExamples: [
      'I will test your app and send you a clear list of bugs',
      'I will write automated tests so your app stays stable',
    ],
    packages: {
      basic: pkg('Bug hunt', 'Manual testing of one flow with a clear bug report and screenshots.', 60, 3, 1),
      standard: pkg(
        'Full test pass',
        'Manual testing across devices plus a prioritised fix list and a retest.',
        200,
        7,
        1,
      ),
      premium: pkg(
        'Automated tests',
        'Automated tests for key flows running on every change, with a short guide.',
        600,
        14,
        2,
      ),
    },
    requirements: [
      'Share the link or app build to test.',
      'Which are the most important things users do?',
      'Are there known problems I should look at first?',
    ],
    faqs: [
      {
        question: 'What does the bug report look like?',
        answer: 'Each bug has steps, a screenshot or video, and how serious it is.',
      },
      { question: 'Do you fix the bugs?', answer: 'I report them; fixing can be added as an extra.' },
    ],
    tags: ['testing', 'qa', 'bug report', 'automation'],
  },
  data: {
    hue: 180,
    titleExamples: [
      'I will build a dashboard that shows your business numbers clearly',
      'I will clean and connect your data sources',
    ],
    packages: {
      basic: pkg('Simple report', 'One dashboard page from your spreadsheet or database.', 100, 4, 1),
      standard: pkg(
        'Live dashboard',
        'Multi-page dashboard that updates automatically, with filters.',
        400,
        10,
        2,
      ),
      premium: pkg(
        'Data system',
        'Data pipeline, clean database, dashboards and alerts, with documentation.',
        1200,
        25,
        3,
      ),
    },
    requirements: [
      'Which questions should the dashboard answer?',
      'Where is your data today (spreadsheet, database, app)?',
      'Who will use it and how often?',
    ],
    faqs: [
      {
        question: 'Is my data safe?',
        answer: 'I work with read-only access when possible and never copy data outside agreed tools.',
      },
      {
        question: 'Can I change charts later?',
        answer: 'Yes. I show you how, or you can order a small update.',
      },
    ],
    tags: ['dashboard', 'analytics', 'data', 'reports'],
  },
};

const DEFAULT_TEMPLATE = GIG_TEMPLATES['web-development']!;

/** Template for a category slug (sub-categories pass their parent's slug). */
export function gigTemplate(topLevelSlug: string | null | undefined): GigTemplate {
  return (topLevelSlug && GIG_TEMPLATES[topLevelSlug]) || DEFAULT_TEMPLATE;
}

export const DESCRIPTION_TEMPLATE = `What you get
- (Describe the result the buyer receives, in plain words)
- (Mention anything that is included with every order)

How it works
1. You order and answer a few questions about your project.
2. I send a plan and work in steps, so you can see progress.
3. You review each step and ask for changes before it is paid out.

Why me
- (Your experience, past projects, tools you use, how fast you reply)
`;

/** Gig quality checklist used by the Publish step. Each check is worth points; the score is out of 100. */
export interface QualityInput {
  title: string;
  categoryId: string;
  description: string;
  packageCount: number;
  imageCount: number;
  faqCount: number;
  requirementCount: number;
  tagCount: number;
}
export interface QualityCheck {
  key: string;
  label: string;
  points: number;
  ok: boolean;
  /** What to do when not ok. */
  tip: string;
}

export function gigQuality(i: QualityInput): { score: number; checks: QualityCheck[] } {
  const checks: QualityCheck[] = [
    {
      key: 'title',
      label: 'Clear title',
      points: 15,
      ok: i.title.trim().length >= 30 && /^i will/i.test(i.title.trim()),
      tip: 'Start with “I will” and say what the buyer gets, in 30-100 characters.',
    },
    {
      key: 'category',
      label: 'Category chosen',
      points: 5,
      ok: !!i.categoryId,
      tip: 'Pick the category buyers will browse.',
    },
    {
      key: 'pricing',
      label: 'Three packages',
      points: 20,
      ok: i.packageCount >= 3,
      tip: 'Offer Basic, Standard and Premium. Buyers like choices, and most pick the middle one.',
    },
    {
      key: 'description',
      label: 'Detailed description',
      points: 20,
      ok: i.description.trim().length >= 300,
      tip: 'Write at least 300 characters: what they get, how it works, why you.',
    },
    {
      key: 'images',
      label: 'Your own images',
      points: 25,
      ok: i.imageCount >= 1,
      tip: 'Upload at least one image of your real work. Gigs with their own images get far more clicks.',
    },
    {
      key: 'faq',
      label: 'Answers to common questions',
      points: 10,
      ok: i.faqCount >= 2,
      tip: 'Add two or more questions buyers usually ask.',
    },
    {
      key: 'requirements',
      label: 'Questions for the buyer',
      points: 5,
      ok: i.requirementCount >= 1,
      tip: 'Ask what you need to start, so you do not have to chase buyers later.',
    },
  ];
  const score = checks.reduce((n, c) => n + (c.ok ? c.points : 0), 0);
  return { score, checks };
}
