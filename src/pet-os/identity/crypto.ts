/**
 * Pet OS Sprint 2 - Cryptographic Primitives
 * Implements Volume XXXI (Security & Privacy) & Step 9:
 * - Industry-standard adaptive password hashing (Salted PBKDF2-SHA256)
 * - Constant-time comparison to prevent timing side-channel attacks
 * - Cryptographically secure random tokens for email verification & password resets
 * - SHA-256 token hashing for database storage (no raw tokens stored)
 */

// Simple deterministic hash & random generator using Web Crypto API or Node crypto
export class CryptoUtils {
  private static async getSubtleCrypto(): Promise<SubtleCrypto> {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    // Node.js fallback
    const nodeCrypto = await import('crypto');
    return (nodeCrypto.webcrypto as unknown as { subtle: SubtleCrypto }).subtle;
  }

  /**
   * Generates a cryptographically strong random token of specified byte length.
   * Returns a URL-safe hex string.
   */
  static generateSecureToken(bytesCount = 32): string {
    const bytes = new Uint8Array(bytesCount);
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytesCount; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Computes SHA-256 hash of a string (used for tokens before database storage).
   */
  static async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const subtle = await this.getSubtleCrypto();
    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and 16-byte random salt.
   * Format: $pbkdf2-sha256$i=100000$<saltHex>$<derivedHex>
   */
  static async hashPassword(password: string): Promise<string> {
    const saltBytes = new Uint8Array(16);
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues(saltBytes);
    } else {
      for (let i = 0; i < 16; i++) {
        saltBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const subtle = await this.getSubtleCrypto();
    const passwordKey = await subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const iterations = 100000;
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      256 // 32 bytes
    );

    const derivedHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `$pbkdf2-sha256$i=${iterations}$${saltHex}$${derivedHex}`;
  }

  /**
   * Verifies a password against the stored PBKDF2 hash using constant-time comparison.
   */
  static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const parts = storedHash.split('$');
      if (parts.length < 5 || parts[1] !== 'pbkdf2-sha256') {
        return false;
      }

      const iterations = parseInt(parts[2].replace('i=', ''), 10);
      const saltHex = parts[3];
      const expectedDerivedHex = parts[4];

      const saltBytes = new Uint8Array(
        saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );

      const subtle = await this.getSubtleCrypto();
      const passwordKey = await subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations,
          hash: 'SHA-256'
        },
        passwordKey,
        256
      );

      const actualDerivedHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return this.constantTimeCompare(actualDerivedHex, expectedDerivedHex);
    } catch {
      return false;
    }
  }

  /**
   * Constant-time comparison between two strings to prevent timing attacks.
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
