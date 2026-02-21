/**
 * Enterprise WeChat Signature Verification
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 * Implements SHA1 signature for URL verification and message validation.
 */

/**
 * Calculate SHA1 hash
 */
async function sha1(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate SHA256 hash (for dedupeKey)
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify WeChat callback signature
 *
 * Signature = SHA1(sort([token, timestamp, nonce, encrypt]))
 *
 * @param token - Verification token from WeChat admin
 * @param timestamp - Timestamp from request
 * @param nonce - Nonce from request
 * @param encrypt - Encrypted message (echostr for URL verification)
 * @param signature - Expected signature from request
 * @returns true if signature matches
 */
export async function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
  signature: string
): Promise<boolean> {
  // Sort parameters alphabetically
  const params = [token, timestamp, nonce, encrypt].sort();
  const str = params.join('');

  // Calculate SHA1 hash
  const hash = await sha1(str);

  return hash === signature;
}

/**
 * Generate signature for outgoing messages
 *
 * @param token - Verification token
 * @param timestamp - Current timestamp
 * @param nonce - Random nonce
 * @param encrypt - Encrypted message
 * @returns Signature string
 */
export async function generateSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string
): Promise<string> {
  const params = [token, timestamp, nonce, encrypt].sort();
  const str = params.join('');
  return sha1(str);
}

/**
 * Generate HMAC-SHA256 signature for S2S authentication
 *
 * @param data - Data to sign (timestamp.nonce.payload)
 * @param secret - HMAC secret key
 * @returns Hex-encoded signature
 */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  return Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
