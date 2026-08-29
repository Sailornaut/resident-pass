const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i;

/**
 * Return an absolute application URL with no trailing slash.
 *
 * Vercel environment variables are commonly entered as a bare hostname. Next.js
 * redirects require an absolute URL, so normalize those values to HTTPS while
 * preserving explicit local HTTP URLs for development.
 */
export function normalizeAppUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${LOCAL_HOST_PATTERN.test(trimmed) ? "http" : "https"}://${trimmed}`;

  const url = new URL(absolute);
  return url.origin;
}

export function configuredAppUrl(fallback = "http://localhost:3000"): string {
  return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || fallback);
}
