/**
 * HMAC Authentication
 *
 * Simple HMAC-based authentication for WS connections.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const HMAC_ALGORITHM = 'sha256';

/**
 * Generate HMAC token for authentication.
 */
export function generateToken(secret: string, payload: string): string {
  const hmac = createHmac(HMAC_ALGORITHM, secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify HMAC token.
 */
export function verifyToken(
  secret: string,
  payload: string,
  token: string
): boolean {
  const expected = generateToken(secret, payload);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const tokenBuffer = Buffer.from(token, 'hex');

    if (expectedBuffer.length !== tokenBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, tokenBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a simple timestamp-based token for WS auth.
 * Token format: {timestamp}.{hmac}
 */
export function generateWsToken(secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = generateToken(secret, timestamp);
  return `${timestamp}.${hmac}`;
}

/**
 * Verify WS token.
 * Accepts tokens within maxAgeMs (default 5 minutes).
 */
export function verifyWsToken(
  secret: string,
  token: string,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [timestamp, hmac] = parts;
  const ts = parseInt(timestamp, 10);

  // Check timestamp is valid number
  if (isNaN(ts)) {
    return false;
  }

  // Check token age
  const now = Date.now();
  if (now - ts > maxAgeMs) {
    return false;
  }

  // Verify HMAC
  return verifyToken(secret, timestamp, hmac);
}
