/** Product mark (D-043): a stacked glass pane with a progress arc. Pure SVG, themed via CSS variables. */
export function ProductMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden focusable="false">
      <rect x="3" y="7" width="22" height="22" rx="6" className="fill-primary/20 stroke-primary/40" />
      <rect
        x="7"
        y="3"
        width="22"
        height="22"
        rx="6"
        className="fill-surface stroke-border"
        strokeWidth="1.5"
      />
      <path
        d="M24 13.5A7.5 7.5 0 1 0 22.4 20"
        className="stroke-primary"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M17.5 14.2h5.2" className="stroke-primary" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
