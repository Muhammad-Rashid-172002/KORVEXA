/**
 * Realistic DEVELOPMENT demo catalogue (Phase 8). People, companies and reviews here are invented for local
 * screenshots and design work. Every row is written with is_seed=true, the script refuses to run in production,
 * and the UI marks seeded listings as "Demo". Prices are USD minor units (cents).
 */
export type DemoPackage = [title: string, description: string, usd: number, days: number, revisions: number];
export type DemoService = {
  category: string;
  slug: string;
  title: string;
  description: string;
  packages: [DemoPackage, DemoPackage, DemoPackage];
  extras: [title: string, usd: number, days: number][];
  faqs: [string, string][];
  /** Review count to seed for this service's seller is set on the seller; services only carry content. */
};
export type DemoSeller = {
  email: string;
  name: string;
  slug: string;
  headline: string;
  bio: string;
  country: string;
  timezone: string;
  languages: string[];
  skills: string[];
  years: number;
  rateUsd: number;
  availability: 'available' | 'busy' | 'away';
  verified: ('identity' | 'github' | 'portfolio' | 'play_store' | 'app_store' | 'skill_test')[];
  /** Ratings (1-5) of seeded completed projects; the count drives the seller level and "reviews" label. */
  reviews: [overall: number, comm: number, quality: number, time: number][];
  services: DemoService[];
};

const pkg = (t: string, d: string, usd: number, days: number, rev: number): DemoPackage => [
  t,
  d,
  usd,
  days,
  rev,
];

export const DEMO_BUYERS = [
  { email: 'maya.chen@demo.glasswork.test', name: 'Maya Chen', headline: 'Founder, studio booking app' },
  {
    email: 'daniel.osei@demo.glasswork.test',
    name: 'Daniel Osei',
    headline: 'Product lead at a logistics scale-up',
  },
  {
    email: 'sofia.alvarez@demo.glasswork.test',
    name: 'Sofia Alvarez',
    headline: 'Operations director, clinic group',
  },
  { email: 'tom.hughes@demo.glasswork.test', name: 'Tom Hughes', headline: 'Solo founder' },
  { email: 'priya.nair@demo.glasswork.test', name: 'Priya Nair', headline: 'Head of growth, B2B SaaS' },
  { email: 'lukas.weber@demo.glasswork.test', name: 'Lukas Weber', headline: 'CTO, fintech startup' },
];

export const DEMO_REVIEW_TEXTS = [
  'Clear communication from day one. The weekly updates meant I never had to ask where things stood, and the milestone demos were genuinely useful.',
  'Delivered exactly what we scoped, a day early. Code was clean and well documented, so our in-house team picked it up without questions.',
  'Handled a mid-project scope change calmly through a change request. The new price and timeline were clear before we agreed.',
  'Very strong on edge cases that we had not thought about. Flagged two risks early and proposed sensible alternatives.',
  'Great collaborator. Feedback on designs was incorporated quickly and the final handover included everything we needed.',
  'Solid work and fair pricing. A couple of small bugs after the first delivery were fixed within a day, no fuss.',
  'We came with a rough idea and left with a polished, working product. The board made it easy to follow progress between calls.',
  'Professional, responsive and honest about what was realistic in our budget. Would hire again for the next phase.',
];

export const DEMO_SELLERS: DemoSeller[] = [
  {
    email: 'amara.okafor@demo.glasswork.test',
    name: 'Amara Okafor',
    slug: 'amara-okafor',
    headline: 'Full-stack engineer · Next.js, Node, PostgreSQL',
    bio: 'I build web products for early-stage teams: marketplaces, dashboards and internal tools. Eight years shipping React and Node, the last four mostly for seed-stage startups that need a reliable first version and a clean handover.',
    country: 'NG',
    timezone: 'Africa/Lagos',
    languages: ['English'],
    skills: ['React', 'Next.js', 'Node.js', 'PostgreSQL', 'TypeScript'],
    years: 8,
    rateUsd: 65,
    availability: 'available',
    verified: ['identity', 'github', 'portfolio'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 4],
      [5, 5, 5, 5],
      [4, 5, 4, 4],
      [5, 5, 5, 5],
      [5, 4, 5, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'web-development',
        slug: 'demo-nextjs-saas-mvp',
        title: 'I will build your SaaS MVP with Next.js, Postgres and Stripe-ready billing',
        description:
          'A production-ready first version of your SaaS: authentication, a clean data model, a responsive dashboard, and a deployment pipeline. I work in weekly milestones with a live demo at each one, and hand over documented code you own.\n\nIdeal for founders validating an idea who want something solid enough to put in front of paying customers.',
        packages: [
          pkg('Starter MVP', 'Auth, one core feature, responsive UI, deployed to staging.', 1800, 14, 2),
          pkg(
            'Launch MVP',
            'Everything in Starter plus billing, admin panel, transactional email and analytics.',
            4200,
            28,
            3,
          ),
          pkg(
            'Scale-ready',
            'Launch MVP plus roles and teams, audit log, background jobs and a load-tested API.',
            8500,
            49,
            4,
          ),
        ],
        extras: [
          ['Extra integration (CRM, Slack, calendar)', 400, 3],
          ['Written technical handover + recorded walkthrough', 250, 2],
        ],
        faqs: [
          [
            'Do I own the code?',
            'Yes. Ownership of each milestone transfers to you on final payment, and the repository is yours from day one.',
          ],
          [
            'Which stack do you use?',
            'Next.js, TypeScript, PostgreSQL, deployed on Vercel or a container host of your choice.',
          ],
          [
            'Can you start from my Figma?',
            'Yes, I implement designs faithfully and flag anything that is hard to build before we start.',
          ],
        ],
      },
      {
        category: 'web-development',
        slug: 'demo-marketplace-web-app',
        title: 'I will build a two-sided marketplace web app with payments and messaging',
        description:
          'Listings, search, orders, in-app messaging and payouts, designed for trust from the start. I have shipped three marketplaces and know where the edge cases hide: refunds, disputes, fee splits and fraud basics.',
        packages: [
          pkg('Core flows', 'Listings, search and filters, user profiles, basic orders.', 3200, 21, 2),
          pkg(
            'With payments',
            'Core flows plus payments, fee splitting, payouts and email notifications.',
            6800,
            35,
            3,
          ),
          pkg(
            'Full platform',
            'Payments plus messaging, reviews, admin tools and moderation queue.',
            12500,
            63,
            4,
          ),
        ],
        extras: [['SEO landing pages', 350, 4]],
        faqs: [
          [
            'Which payment providers do you support?',
            'Stripe Connect is my default. I can integrate others where marketplace payouts are supported.',
          ],
        ],
      },
    ],
  },
  {
    email: 'rohan.mehta@demo.glasswork.test',
    name: 'Rohan Mehta',
    slug: 'rohan-mehta',
    headline: 'Mobile engineer · Flutter & React Native',
    bio: 'Mobile developer with 7 years of experience and 14 apps in the stores. I focus on fast, offline-friendly apps with clean architecture, and I handle store submission end to end.',
    country: 'IN',
    timezone: 'Asia/Kolkata',
    languages: ['English', 'Hindi'],
    skills: ['Flutter', 'Dart', 'React Native', 'Firebase', 'Kotlin'],
    years: 7,
    rateUsd: 48,
    availability: 'available',
    verified: ['identity', 'github', 'play_store', 'app_store'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [4, 4, 5, 4],
      [5, 5, 5, 5],
      [5, 5, 4, 5],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'mobile-apps',
        slug: 'demo-flutter-app-ios-android',
        title: 'I will build your iOS and Android app with Flutter from a single codebase',
        description:
          'One codebase, two stores. I design the architecture for maintainability, set up CI builds, and take the app through TestFlight and Play review with you.\n\nIncludes push notifications, deep links and analytics wiring where needed.',
        packages: [
          pkg(
            'Prototype',
            'Clickable, working prototype of up to 5 screens connected to a mock API.',
            900,
            7,
            2,
          ),
          pkg(
            'App v1',
            'Up to 12 screens, auth, API integration, push notifications and store submission.',
            3600,
            30,
            3,
          ),
          pkg('App v1 + backend', 'App v1 plus a custom API and admin dashboard.', 7400, 50, 4),
        ],
        extras: [
          ['Offline mode with sync', 600, 6],
          ['App Store / Play listing assets and submission', 200, 2],
        ],
        faqs: [
          [
            'Will you publish under my developer accounts?',
            'Yes. I never publish under my own accounts, so the app is yours from the start.',
          ],
          [
            'Can you take over an existing Flutter app?',
            'Yes. I begin with a code review and give you a fixed-scope fix list before any work starts.',
          ],
        ],
      },
    ],
  },
  {
    email: 'elena.petrova@demo.glasswork.test',
    name: 'Elena Petrova',
    slug: 'elena-petrova',
    headline: 'Product designer · SaaS, fintech, design systems',
    bio: 'I design interfaces that are easy to build and easy to use. Former in-house designer at two B2B SaaS companies; now independent. I deliver Figma files organised for developers, with components, tokens and states documented.',
    country: 'RS',
    timezone: 'Europe/Belgrade',
    languages: ['English', 'Serbian', 'Russian'],
    skills: ['Figma', 'UX research', 'Design systems', 'Prototyping', 'Accessibility'],
    years: 9,
    rateUsd: 70,
    availability: 'busy',
    verified: ['identity', 'portfolio'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 4, 5, 5],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'design',
        slug: 'demo-saas-ui-ux-design',
        title: 'I will design your SaaS product UI/UX in Figma, ready for developers',
        description:
          'From user flows to high-fidelity screens. I start with a short discovery call, map the key journeys, then deliver a Figma file with components, states and spacing documented so your developers can build without guessing.',
        packages: [
          pkg('Key screens', 'Up to 6 high-fidelity screens plus a clickable prototype.', 700, 7, 2),
          pkg(
            'Product design',
            'Flows, up to 20 screens, responsive variants and a component library.',
            2400,
            21,
            3,
          ),
          pkg(
            'Design system',
            'Product design plus full design system with tokens, documentation and dark mode.',
            5200,
            35,
            4,
          ),
        ],
        extras: [['Usability test with 5 participants + report', 900, 7]],
        faqs: [
          [
            'Do you code?',
            'No, but I work closely with developers and review the built result against the designs.',
          ],
        ],
      },
    ],
  },
  {
    email: 'kenji.watanabe@demo.glasswork.test',
    name: 'Kenji Watanabe',
    slug: 'kenji-watanabe',
    headline: 'ML engineer · LLM apps, RAG, evaluation',
    bio: 'I build practical AI features: retrieval-augmented assistants, document extraction and classification pipelines, with evaluation harnesses so you can measure quality instead of guessing.',
    country: 'JP',
    timezone: 'Asia/Tokyo',
    languages: ['English', 'Japanese'],
    skills: ['Python', 'LLM applications', 'RAG', 'FastAPI', 'Evaluation'],
    years: 6,
    rateUsd: 95,
    availability: 'available',
    verified: ['identity', 'github', 'skill_test'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 4],
      [4, 5, 4, 4],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'ai-ml',
        slug: 'demo-rag-assistant-for-your-docs',
        title: 'I will build a retrieval-augmented AI assistant over your documents',
        description:
          'A chat assistant that answers from your own knowledge base with citations, access control and an evaluation set so you know how well it works. Includes guardrails and cost monitoring.',
        packages: [
          pkg(
            'Proof of concept',
            'Ingest up to 200 documents, working chat with citations, 25-question eval set.',
            1500,
            10,
            2,
          ),
          pkg(
            'Production assistant',
            'Auth, permissions, admin ingest UI, monitoring and an evaluation report.',
            5600,
            28,
            3,
          ),
          pkg(
            'Enterprise rollout',
            'Production assistant plus SSO, audit logging and a security review document.',
            11000,
            49,
            4,
          ),
        ],
        extras: [['Additional data connector (Drive, Notion, Confluence)', 500, 4]],
        faqs: [
          [
            'Which models do you use?',
            'I choose per task and budget, and keep the model behind an interface so you can switch later.',
          ],
          [
            'Where does our data go?',
            'We agree this up front. I can design for provider-hosted APIs or self-hosted models depending on your constraints.',
          ],
        ],
      },
    ],
  },
  {
    email: 'sara.lindqvist@demo.glasswork.test',
    name: 'Sara Lindqvist',
    slug: 'sara-lindqvist',
    headline: 'DevOps engineer · AWS, Docker, CI/CD, observability',
    bio: 'Platform engineer helping small teams ship reliably: infrastructure as code, zero-downtime deploys, backups that are actually restored in tests, and dashboards that tell you something.',
    country: 'SE',
    timezone: 'Europe/Stockholm',
    languages: ['English', 'Swedish'],
    skills: ['AWS', 'Docker', 'Terraform', 'GitHub Actions', 'Observability'],
    years: 10,
    rateUsd: 85,
    availability: 'available',
    verified: ['identity', 'github'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 5, 4, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'devops',
        slug: 'demo-ci-cd-and-cloud-setup',
        title: 'I will set up CI/CD, infrastructure as code and monitoring for your app',
        description:
          'Automated tests and deploys on every push, reproducible environments, secrets handled properly, alerting you will not mute. I document everything and walk your team through it.',
        packages: [
          pkg('CI/CD pipeline', 'Build, test and deploy pipeline with preview environments.', 800, 5, 2),
          pkg(
            'Cloud foundation',
            'Pipeline plus infrastructure as code, staging and production, backups and alerting.',
            2900,
            14,
            3,
          ),
          pkg(
            'Reliability package',
            'Foundation plus load testing, runbooks, restore drills and on-call setup.',
            5400,
            28,
            3,
          ),
        ],
        extras: [['Cost review and savings plan', 300, 3]],
        faqs: [
          [
            'Do you work with our existing cloud?',
            'Yes. I start with a read-only audit and propose changes before touching anything.',
          ],
        ],
      },
    ],
  },
  {
    email: 'diego.fernandez@demo.glasswork.test',
    name: 'Diego Fernández',
    slug: 'diego-fernandez',
    headline: 'Backend engineer · APIs, payments, data pipelines',
    bio: 'I build backends that hold up: well-modelled data, idempotent payment flows, and APIs your mobile and web teams will actually enjoy using.',
    country: 'AR',
    timezone: 'America/Argentina/Buenos_Aires',
    languages: ['English', 'Spanish'],
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'Stripe', 'Redis'],
    years: 11,
    rateUsd: 72,
    availability: 'available',
    verified: ['identity', 'github', 'portfolio'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 4, 5, 5],
      [4, 4, 4, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
    ],
    services: [
      {
        category: 'saas',
        slug: 'demo-rest-api-and-payments-backend',
        title: 'I will build a secure REST API with authentication and Stripe payments',
        description:
          'A documented, tested API with proper authorisation, rate limiting and an OpenAPI spec, plus Stripe checkout and webhooks done the safe way: signature verification, idempotency and a reconciliation report.',
        packages: [
          pkg(
            'API foundation',
            'Auth, 5 resources with CRUD, validation, OpenAPI docs and tests.',
            1400,
            10,
            2,
          ),
          pkg(
            'API + payments',
            'Foundation plus Stripe checkout, webhooks, invoices and refunds.',
            3800,
            24,
            3,
          ),
          pkg(
            'Platform backend',
            'API + payments plus background jobs, audit log, admin endpoints and monitoring.',
            7200,
            42,
            4,
          ),
        ],
        extras: [['Generated client SDK (TypeScript or Dart)', 300, 2]],
        faqs: [
          [
            'Can you extend my existing backend?',
            'Yes, after a short code review. I will tell you honestly if a rewrite would be cheaper.',
          ],
        ],
      },
    ],
  },
  {
    email: 'hannah.brooks@demo.glasswork.test',
    name: 'Hannah Brooks',
    slug: 'hannah-brooks',
    headline: 'QA engineer · test automation, Playwright, accessibility',
    bio: 'I find the bugs your users would, before they do. Manual exploratory testing plus automated end-to-end suites that run in CI and stay maintainable.',
    country: 'GB',
    timezone: 'Europe/London',
    languages: ['English'],
    skills: ['Playwright', 'Cypress', 'Accessibility', 'API testing', 'Test strategy'],
    years: 8,
    rateUsd: 55,
    availability: 'available',
    verified: ['identity', 'skill_test'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [4, 5, 4, 4],
    ],
    services: [
      {
        category: 'qa-testing',
        slug: 'demo-e2e-test-automation',
        title: 'I will write a Playwright end-to-end test suite for your web app',
        description:
          'Reliable, readable tests for your critical user journeys, wired into CI with screenshots and traces on failure. I also leave you a short guide so your team can extend them.',
        packages: [
          pkg('Smoke suite', '10 critical-path tests plus CI integration.', 600, 5, 1),
          pkg(
            'Regression suite',
            '30 tests across desktop and mobile viewports, test data helpers and reports.',
            1700,
            12,
            2,
          ),
          pkg(
            'Quality program',
            'Regression suite plus accessibility checks, API tests and a test strategy document.',
            3300,
            24,
            3,
          ),
        ],
        extras: [['WCAG 2.2 AA audit with prioritised fixes', 700, 5]],
        faqs: [
          [
            'Do you test mobile apps?',
            'Web and responsive web. For native apps, ask me first so I can tell you if it is a fit.',
          ],
        ],
      },
    ],
  },
  {
    email: 'yusuf.demir@demo.glasswork.test',
    name: 'Yusuf Demir',
    slug: 'yusuf-demir',
    headline: 'Data engineer · analytics, dashboards, ETL',
    bio: 'I turn scattered data into dashboards people trust: clean pipelines, a sensible warehouse model and BI that answers the questions your team actually asks.',
    country: 'TR',
    timezone: 'Europe/Istanbul',
    languages: ['English', 'Turkish'],
    skills: ['SQL', 'dbt', 'Python', 'BigQuery', 'Metabase'],
    years: 7,
    rateUsd: 60,
    availability: 'away',
    verified: ['identity', 'github'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 4],
    ],
    services: [
      {
        category: 'data',
        slug: 'demo-analytics-dashboard-and-pipeline',
        title: 'I will build an analytics pipeline and dashboard from your product data',
        description:
          'Connect your database and tools, model the data once, and ship a dashboard with the 10 metrics that matter for your stage. Fully documented so your team can extend it.',
        packages: [
          pkg('Starter dashboard', 'Up to 3 data sources, 8 charts in Metabase or Looker Studio.', 900, 7, 2),
          pkg(
            'Warehouse + BI',
            'Pipeline to a warehouse, modelled tables and 20 charts with scheduled reports.',
            2600,
            18,
            3,
          ),
          pkg(
            'Data platform',
            'Warehouse + BI plus data quality tests, lineage docs and a metrics glossary.',
            5200,
            35,
            3,
          ),
        ],
        extras: [['Embedded customer-facing analytics', 800, 7]],
        faqs: [
          [
            'Do I need a data warehouse?',
            'Not at the start. I will recommend the simplest setup that fits your volume and budget.',
          ],
        ],
      },
    ],
  },
  {
    email: 'nadia.rahman@demo.glasswork.test',
    name: 'Nadia Rahman',
    slug: 'nadia-rahman',
    headline: 'Frontend engineer · React, animation, accessibility',
    bio: 'I build polished, accessible interfaces and marketing sites that load fast and feel alive. Strong on design-to-code fidelity, motion and performance budgets.',
    country: 'BD',
    timezone: 'Asia/Dhaka',
    languages: ['English', 'Bengali'],
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Three.js', 'Accessibility'],
    years: 5,
    rateUsd: 42,
    availability: 'available',
    verified: ['identity', 'portfolio'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [4, 5, 4, 5],
    ],
    services: [
      {
        category: 'web-development',
        slug: 'demo-pixel-perfect-react-frontend',
        title: 'I will turn your Figma design into a fast, accessible React front end',
        description:
          'Responsive, accessible components built to match your design, with a performance budget and Lighthouse scores above 90 on key pages. Tailwind or your preferred styling approach.',
        packages: [
          pkg(
            'Landing page',
            'One responsive page with animations, SEO basics and a contact form.',
            500,
            5,
            2,
          ),
          pkg('Marketing site', 'Up to 6 pages with CMS-ready content structure and analytics.', 1600, 14, 3),
          pkg(
            'App front end',
            'Up to 15 app screens with state management and API integration.',
            3900,
            28,
            3,
          ),
        ],
        extras: [['3D hero section (Three.js)', 600, 5]],
        faqs: [
          [
            'Do you do accessibility?',
            'Yes, WCAG 2.2 AA is my default target and I test with a screen reader.',
          ],
        ],
      },
    ],
  },
  {
    email: 'oliver.grant@demo.glasswork.test',
    name: 'Oliver Grant',
    slug: 'oliver-grant',
    headline: 'Security engineer · application security reviews',
    bio: 'I review web apps and APIs for the vulnerabilities that actually get exploited, and hand you a short, prioritised fix list your developers can act on. I only test systems you own or are authorised to test.',
    country: 'AU',
    timezone: 'Australia/Sydney',
    languages: ['English'],
    skills: ['Application security', 'OWASP', 'Threat modelling', 'Node.js', 'Cloud security'],
    years: 12,
    rateUsd: 110,
    availability: 'busy',
    verified: ['identity', 'github', 'skill_test'],
    reviews: [
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 5, 5, 5],
      [5, 4, 5, 5],
    ],
    services: [
      {
        category: 'devops',
        slug: 'demo-web-app-security-review',
        title: 'I will review your web app and API against the OWASP Top 10 and report fixes',
        description:
          'A focused security review of your app: authentication, authorisation, input handling, file uploads, secrets and dependencies. You get a plain-language report with severity, proof and a recommended fix for each finding, then a retest after you patch.\n\nScope and written authorisation are agreed before any testing starts.',
        packages: [
          pkg(
            'Quick review',
            'Targeted review of auth and authorisation for one app, report and one retest.',
            1200,
            7,
            1,
          ),
          pkg(
            'Full app review',
            'OWASP Top 10 review of web app and API, threat model and a retest.',
            3600,
            14,
            2,
          ),
          pkg(
            'Release readiness',
            'Full review plus dependency and infrastructure review and a pre-launch checklist.',
            6800,
            24,
            2,
          ),
        ],
        extras: [['Developer workshop on secure coding (2 hours)', 450, 2]],
        faqs: [
          [
            'Is testing safe for production?',
            'I prefer staging. Anything touching production is agreed in writing with limits on what I will do.',
          ],
        ],
      },
    ],
  },
];
