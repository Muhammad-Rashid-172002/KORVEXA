/**
 * The ONLY place product/company names, domains and legal details live (DECISIONS D-001).
 * Renaming the product is a one-line change here. A lint rule blocks these strings elsewhere.
 */
export const brand = {
  productName: 'Glasswork',
  parentName: 'KorvenzaTech',
  /** Always present the product as "<productName> by <parentName>". */
  lockup: 'Glasswork by KorvenzaTech',
  tagline: 'Hire verified builders. Watch your project move.',
  /** Final product domain (Q3). `null` hides it everywhere until set. */
  domain: null as string | null,
  parentDomain: 'korvenzatech.com',
  parentUrl: 'https://korvenzatech.com',
  /** TODO(Rashid): exact registered company name (Q2). */
  legalEntity: 'KorvenzaTech',
  /** Registered address (Q2). `null` hides it everywhere until set. */
  legalAddress: null as string | null,
  /** Support inbox on the final domain (Q9). `null` hides it everywhere until set. */
  supportEmail: null as string | null,
  /** Label for services run by KorvenzaTech's own agency (DECISIONS D-002). */
  operatedByLabel: 'Operated by KorvenzaTech',
  colors: {
    ink: '#07110E',
    emerald: '#087F5B',
    emeraldBright: '#19C784',
  },
} as const;

export type Brand = typeof brand;
