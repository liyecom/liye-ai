/**
 * Enterprise WeChat AES-256-CBC Encryption/Decryption
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 * Implements PKCS7 padding and WeChat message structure parsing.
 */

/**
 * Decode base64 EncodingAESKey to ArrayBuffer
 * WeChat uses a modified base64 (43 chars + '=' padding)
 */
export function decodeAESKey(encodingAESKey: string): ArrayBuffer {
  // Add padding if needed (WeChat key is 43 chars, needs 1 '=' for standard base64)
  const padded = encodingAESKey + '=';
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decrypt WeChat message using AES-256-CBC
 *
 * @param ciphertext - Base64 encoded ciphertext
 * @param encodingAESKey - 43-character EncodingAESKey
 * @returns Decrypted message object { message, corpId }
 */
export async function decryptMessage(
  ciphertext: string,
  encodingAESKey: string
): Promise<{ message: string; corpId: string }> {
  // Decode AES key
  const keyBuffer = decodeAESKey(encodingAESKey);

  // Decode ciphertext from base64
  const ciphertextBinary = atob(ciphertext);
  const ciphertextBytes = new Uint8Array(ciphertextBinary.length);
  for (let i = 0; i < ciphertextBinary.length; i++) {
    ciphertextBytes[i] = ciphertextBinary.charCodeAt(i);
  }

  // Import key for AES-CBC
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  // IV is first 16 bytes of key
  const iv = keyBuffer.slice(0, 16);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    ciphertextBytes
  );

  // Remove PKCS7 padding
  const decryptedBytes = new Uint8Array(decrypted);
  const padLength = decryptedBytes[decryptedBytes.length - 1];
  const unpaddedBytes = decryptedBytes.slice(0, decryptedBytes.length - padLength);

  // Parse WeChat message structure:
  // [random(16)] [msg_len(4, big-endian)] [msg(msg_len)] [corpId]
  const random = unpaddedBytes.slice(0, 16);
  const msgLenBytes = unpaddedBytes.slice(16, 20);
  const msgLen = (msgLenBytes[0] << 24) | (msgLenBytes[1] << 16) | (msgLenBytes[2] << 8) | msgLenBytes[3];

  const msgBytes = unpaddedBytes.slice(20, 20 + msgLen);
  const corpIdBytes = unpaddedBytes.slice(20 + msgLen);

  // Decode UTF-8
  const decoder = new TextDecoder('utf-8');
  const message = decoder.decode(msgBytes);
  const corpId = decoder.decode(corpIdBytes);

  return { message, corpId };
}

/**
 * Encrypt message for WeChat (for sending messages back)
 *
 * @param message - Plain text message
 * @param encodingAESKey - 43-character EncodingAESKey
 * @param corpId - Corporation ID
 * @returns Base64 encoded ciphertext
 */
export async function encryptMessage(
  message: string,
  encodingAESKey: string,
  corpId: string
): Promise<string> {
  // Decode AES key
  const keyBuffer = decodeAESKey(encodingAESKey);

  // Generate 16 random bytes
  const random = crypto.getRandomValues(new Uint8Array(16));

  // Encode message and corpId to UTF-8
  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(message);
  const corpIdBytes = encoder.encode(corpId);

  // Build message length (4 bytes, big-endian)
  const msgLen = msgBytes.length;
  const msgLenBytes = new Uint8Array([
    (msgLen >> 24) & 0xff,
    (msgLen >> 16) & 0xff,
    (msgLen >> 8) & 0xff,
    msgLen & 0xff
  ]);

  // Combine: [random(16)] [msg_len(4)] [msg] [corpId]
  const plainLength = 16 + 4 + msgLen + corpIdBytes.length;

  // Add PKCS7 padding
  const blockSize = 32; // AES block size
  const padLength = blockSize - (plainLength % blockSize);
  const paddedLength = plainLength + padLength;

  const plainBytes = new Uint8Array(paddedLength);
  plainBytes.set(random, 0);
  plainBytes.set(msgLenBytes, 16);
  plainBytes.set(msgBytes, 20);
  plainBytes.set(corpIdBytes, 20 + msgLen);
  // PKCS7 padding
  for (let i = plainLength; i < paddedLength; i++) {
    plainBytes[i] = padLength;
  }

  // Import key for AES-CBC
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  // IV is first 16 bytes of key
  const iv = keyBuffer.slice(0, 16);

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    plainBytes
  );

  // Encode to base64
  const encryptedBytes = new Uint8Array(encrypted);
  let binary = '';
  for (let i = 0; i < encryptedBytes.length; i++) {
    binary += String.fromCharCode(encryptedBytes[i]);
  }
  return btoa(binary);
}
