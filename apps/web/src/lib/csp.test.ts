import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, createNonce } from './csp';

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split('; ').map((directive) => {
      const [name = '', ...values] = directive.split(' ');
      return [name, values];
    }),
  );

describe('contentSecurityPolicy (production)', () => {
  const policy = directives(contentSecurityPolicy('abc123'));

  it('is exactly this policy', () => {
    expect(policy).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'nonce-abc123'", "'strict-dynamic'"],
      'style-src': ["'self'", "'nonce-abc123'"],
      'style-src-attr': ["'unsafe-inline'"],
      'img-src': ["'self'", 'blob:', 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    });
  });

  it('only runs scripts carrying the request nonce', () => {
    expect(policy['script-src']).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(policy['style-src']).toEqual(["'self'", "'nonce-abc123'"]);
  });

  it('never allows eval or inline code', () => {
    const all = Object.values(policy).flat();
    expect(all).not.toContain("'unsafe-eval'");
    expect(policy['script-src']).not.toContain("'unsafe-inline'");
    expect(policy['style-src']).not.toContain("'unsafe-inline'");
  });

  it('blocks plugins, framing, foreign forms and base-tag hijacking', () => {
    expect(policy).toMatchObject({
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
    });
  });
});

describe('contentSecurityPolicy (development)', () => {
  it('relaxes only what the dev server needs (eval, injected styles, HMR socket)', () => {
    const policy = directives(contentSecurityPolicy('abc123', { development: true }));
    expect(policy['script-src']).toContain("'unsafe-eval'");
    expect(policy['style-src']).toContain("'unsafe-inline'");
    expect(policy['connect-src']).toEqual(["'self'", 'ws:', 'wss:']);
  });
});

describe('createNonce', () => {
  it('is unique per call and base64', () => {
    const nonces = new Set(Array.from({ length: 100 }, createNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
