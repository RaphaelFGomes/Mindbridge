/**
 * Content-Security-Policy with a fresh nonce per request: only scripts that
 * Next.js renders (and stamps with the nonce) can run, so injected markup
 * cannot execute code.
 */
export function contentSecurityPolicy(nonce: string, { development = false } = {}): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by trusted scripts are trusted; dev needs eval for HMR.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    // The dev server injects <style> tags without a nonce; production CSS is a same-origin file.
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Radix sets inline style *attributes* (dialog positioning); nonces cannot cover attributes.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}
