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
  /** TODO(Rashid): final product domain (Q3). */
  domain: 'TODO-domain',
  parentDomain: 'korvenzatech.com',
  parentUrl: 'https://korvenzatech.com',
  /** TODO(Rashid): exact registered company name (Q2). */
  legalEntity: 'KorvenzaTech',
  /** TODO(Rashid): registered address (Q2). */
  legalAddress: 'TODO-address',
  /** TODO(Rashid): support inbox on the final domain (Q9). */
  supportEmail: 'support@example.com',
  /** Label for services run by KorvenzaTech's own agency (DECISIONS D-002). */
  operatedByLabel: 'Operated by KorvenzaTech',
  colors: {
    ink: '#07110E',
    emerald: '#087F5B',
    emeraldBright: '#19C784',
  },
} as const;

export type Brand = typeof brand;
