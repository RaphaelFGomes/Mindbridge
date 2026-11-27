'use client';

import { setNonce } from 'get-nonce';
import { useEffect } from 'react';

/**
 * Radix's dialog locks scrolling by injecting a <style> element at runtime
 * (react-remove-scroll), which reads its nonce from `get-nonce`. Handing it the
 * request's CSP nonce keeps `style-src` strict instead of allowing 'unsafe-inline'.
 * Must be the same get-nonce copy Radix uses (pinned to 1.0.1); the E2E suite
 * fails on any CSP violation if they ever drift apart.
 */
export function StyleNonce({ nonce }: { nonce: string | undefined }) {
  useEffect(() => {
    if (nonce) setNonce(nonce);
  }, [nonce]);
  return null;
}
