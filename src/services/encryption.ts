/**
 * Data Encryption Service
 * Provides encryption/decryption for sensitive user data
 * Uses AES-256 encryption via crypto-js
 */

import CryptoJS from 'crypto-js';

/**
 * Get encryption key from environment or generate a secure one
 * In production, this should come from a secure key management service
 */
const getEncryptionKey = (): string => {
  // Should be stored in environment variable: VITE_ENCRYPTION_KEY
  const key = import.meta.env.VITE_ENCRYPTION_KEY;
  
  if (!key) {
    console.warn(
      'VITE_ENCRYPTION_KEY is not set. Encryption will use a default key. ' +
      'For production, set VITE_ENCRYPTION_KEY in your environment variables.'
    );
    return 'youfi-default-key-change-in-production';
  }
  
  return key;
};

/**
 * Get salt for additional security (changes per encryption)
 */
const generateSalt = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

class EncryptionService {
  private key: string;

  constructor() {
    this.key = getEncryptionKey();
  }

  /**
   * Encrypt a string value
   * Returns format: iv:salt:encrypted (for decryption)
   */
  encrypt(plainText: string): string {
    try {
      if (!plainText) return '';

      // Generate random IV and salt for additional security
      const iv = CryptoJS.lib.WordArray.random(128 / 8);
      const salt = generateSalt();

      // Derive key from password + salt
      const key = CryptoJS.PBKDF2(this.key, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });

      // Encrypt
      const encrypted = CryptoJS.AES.encrypt(plainText, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // Return in format: iv:salt:ciphertext
      return `${iv.toString()}:${salt}:${encrypted.toString()}`;
    } catch (error) {
      console.error('Encryption error:', error);
      return plainText; // Fallback to plaintext if encryption fails
    }
  }

  /**
   * Decrypt a string that was encrypted with encrypt()
   * Expects format: iv:salt:encrypted
   */
  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData || !encryptedData.includes(':')) {
        return encryptedData; // Not in encrypted format
      }

      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        return encryptedData; // Invalid format
      }

      const [ivStr, salt, ciphertext] = parts;

      // Recreate IV and derive key with same salt
      const iv = CryptoJS.enc.Hex.parse(ivStr);
      const key = CryptoJS.PBKDF2(this.key, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Return encrypted data if decryption fails
    }
  }

  /**
   * Encrypt an object's sensitive fields
   * Example: { ssn: '123456789', bankAccount: 'XXXX' }
   */
  encryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[]
  ): T {
    const encrypted = { ...obj };

    for (const field of fieldsToEncrypt) {
      if (field in encrypted && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field] as string) as any;
      }
    }

    return encrypted;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  decryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToDecrypt: (keyof T)[]
  ): T {
    const decrypted = { ...obj };

    for (const field of fieldsToDecrypt) {
      if (field in decrypted && typeof decrypted[field] === 'string') {
        decrypted[field] = this.decrypt(decrypted[field] as string) as any;
      }
    }

    return decrypted;
  }

  /**
   * Hash a password using PBKDF2
   * Should be used on the backend before storing passwords
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const usedSalt = salt || generateSalt();
    const hash = CryptoJS.PBKDF2(password, usedSalt, {
      keySize: 256 / 32,
      iterations: 10000
    }).toString();

    return { hash, salt: usedSalt };
  }

  /**
   * Verify a password against a stored hash
   */
  verifyPassword(password: string, storedHash: string, salt: string): boolean {
    try {
      const { hash: newHash } = this.hashPassword(password, salt);
      return newHash === storedHash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token (e.g., for API keys)
   */
  generateToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Create an HMAC signature for data integrity
   * Used to verify data hasn't been tampered with
   */
  createSignature(data: string, secret?: string): string {
    const key = secret || this.key;
    return CryptoJS.HmacSHA256(data, key).toString();
  }

  /**
   * Verify an HMAC signature
   */
  verifySignature(data: string, signature: string, secret?: string): boolean {
    try {
      const key = secret || this.key;
      const expectedSignature = CryptoJS.HmacSHA256(data, key).toString();
      return expectedSignature === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
