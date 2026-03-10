/**
 * HMAC Token Generation
 *
 * Compatible with PR#1 LiYe Gateway HMAC authentication.
 */

import { createHmac } from 'crypto';

const HMAC_ALGORITHM = 'sha256';

/**
 * Generate HMAC token for a payload.
 */
export function generateToken(secret: string, payload: string): string {
  const hmac = createHmac(HMAC_ALGORITHM, secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Generate a WebSocket authentication token.
 * Format: {timestamp}.{hmac}
 *
 * This must match the format expected by LiYe Gateway.
 */
export function generateWsToken(secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = generateToken(secret, timestamp);
  return `${timestamp}.${hmac}`;
}
