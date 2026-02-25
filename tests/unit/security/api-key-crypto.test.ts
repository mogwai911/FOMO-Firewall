import { describe, expect, it } from "vitest";
import {
  decryptApiKeyValue,
  encryptApiKeyValue,
  getSettingsEncryptionKey,
  isEncryptedApiKey
} from "@/lib/security/api-key-crypto";

describe("api-key-crypto", () => {
  const env = {
    APP_SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64")
  };

  it("encrypts and decrypts api key value with aes-256-gcm", () => {
    const key = getSettingsEncryptionKey(env);
    const encrypted = encryptApiKeyValue("sk-test-123456", key);
    expect(isEncryptedApiKey(encrypted)).toBe(true);

    const decrypted = decryptApiKeyValue(encrypted, key);
    expect(decrypted).toBe("sk-test-123456");
  });

  it("rejects missing encryption key env", () => {
    expect(() => getSettingsEncryptionKey({})).toThrowError(/ENCRYPTION_KEY_MISSING/);
  });
});
