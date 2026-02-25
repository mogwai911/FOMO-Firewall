import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export class ApiKeyCryptoError extends Error {
  code:
    | "ENCRYPTION_KEY_MISSING"
    | "ENCRYPTION_KEY_INVALID"
    | "API_KEY_DECRYPT_FAILED";

  constructor(
    code:
      | "ENCRYPTION_KEY_MISSING"
      | "ENCRYPTION_KEY_INVALID"
      | "API_KEY_DECRYPT_FAILED",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

function parseKeyFromBase64(value: string): Buffer | null {
  try {
    const key = Buffer.from(value, "base64");
    return key.length === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

function parseKeyFromHex(value: string): Buffer | null {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    return null;
  }
  try {
    const key = Buffer.from(value, "hex");
    return key.length === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

export function getSettingsEncryptionKey(
  env: Record<string, string | undefined> = process.env
): Buffer {
  const raw = env.APP_SETTINGS_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new ApiKeyCryptoError(
      "ENCRYPTION_KEY_MISSING",
      "ENCRYPTION_KEY_MISSING: APP_SETTINGS_ENCRYPTION_KEY is required"
    );
  }

  const parsed = parseKeyFromBase64(raw) ?? parseKeyFromHex(raw);
  if (!parsed) {
    throw new ApiKeyCryptoError(
      "ENCRYPTION_KEY_INVALID",
      "ENCRYPTION_KEY_INVALID: must be base64(32 bytes) or hex(64 chars)"
    );
  }
  return parsed;
}

export function isEncryptedApiKey(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptApiKeyValue(plainText: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKeyValue(cipherText: string, key: Buffer): string {
  try {
    if (!isEncryptedApiKey(cipherText)) {
      throw new Error("invalid cipher prefix");
    }
    const encoded = cipherText.slice(`${PREFIX}:`.length);
    const [ivB64, tagB64, payloadB64] = encoded.split(":");
    if (!ivB64 || !tagB64 || !payloadB64) {
      throw new Error("invalid cipher segments");
    }
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const payload = Buffer.from(payloadB64, "base64");

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || payload.length === 0) {
      throw new Error("invalid cipher payload");
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    throw new ApiKeyCryptoError("API_KEY_DECRYPT_FAILED", "API_KEY_DECRYPT_FAILED");
  }
}
