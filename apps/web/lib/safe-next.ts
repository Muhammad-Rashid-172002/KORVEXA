/** Only same-site relative paths may be used as a post-login destination (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}
