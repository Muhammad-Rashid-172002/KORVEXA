# Accessibility audit: WCAG 2.2 AA (Phase 9)

## Method

1. **Automated:** axe-core (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) over every page the crawler reaches for four personas (`pnpm crawl`), plus the e2e suite `e2e/tests/a11y.spec.ts` on desktop and mobile in CI. Any serious or critical violation fails the build.
2. **Keyboard-only flows** (e2e, no mouse): skip link as first tab stop; log in with keyboard only; open the command palette with Ctrl/Cmd+K, filter, Enter to navigate, Escape to close; browse services and open a card; visible focus indicator (2px outline) on the first 14 tab stops of the home page.
3. **Lighthouse accessibility** on 16 public pages: 99 to 100.

## Findings fixed in this phase

| Finding                                                                 | WCAG              | Fix                                                                         |
| ----------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Links inside running text distinguished by colour only (95 instances)   | 1.4.1             | Underline for links in paragraphs and labels (`packages/ui/src/styles.css`) |
| Danger buttons white on light red, contrast below 4.5:1                 | 1.4.3             | `--gw-on-danger` token (dark text on the dark theme's red)                  |
| File input without a label (service gallery)                            | 1.3.1 / 4.1.2     | `aria-label`                                                                |
| Logo link and search button accessible names differed from visible text | 2.5.3             | Removed the overriding `aria-label`s; added `aria-keyshortcuts`             |
| React hydration mismatch on `/settings` (locale date)                   | robustness        | `suppressHydrationWarning` on the client-formatted time                     |
| Session list showed raw 150-character user-agent strings                | 3.3 / readability | "Chrome on Windows" style names                                             |
| Layout shift 0.66 on the login page (client-only render)                | 2.2 / usability   | Query params and OAuth providers resolved on the server                     |

## Verified patterns

Landmarks (`header`, `nav`, `main`, `footer`) with a skip link; one `h1` per page; form fields have visible labels; errors announced with `role="alert"`; dialogs trap focus and restore it (Radix); progress bars expose `role="progressbar"` with values and the milestone stepper has text equivalents; respects `prefers-reduced-motion` (3D hero, scroll reveals); target sizes at least 24x24 CSS px for controls; theme tokens keep text at 4.5:1 or better in both themes.

## Known limits

Automated tools find roughly a third of issues. Before launch also do a screen-reader pass (VoiceOver on Safari, NVDA on Firefox) of: sign up, order, fund, approve, dispute.
