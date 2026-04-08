/**
 * @file lib/keyVault.ts — Azure Key Vault secret fetching
 * @description Fetches secrets from Azure Key Vault for production use.
 *   Falls back to environment variables in development.
 *   Caches secrets in memory for the lifetime of the lambda invocation.
 */
import { SecretClient } from '@azure/keyvault-secrets';
import { ClientSecretCredential } from '@azure/identity';

let client: SecretClient | null = null;
const secretCache = new Map<string, string>();

function getClient(): SecretClient | null {
  if (client) return client;

  const vaultUrl = process.env.AZURE_KEYVAULT_URL;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!vaultUrl || !tenantId || !clientId || !clientSecret) return null;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  client = new SecretClient(vaultUrl, credential);
  return client;
}

/**
 * Fetches a secret from Azure Key Vault, falling back to env var.
 * @param secretName - Key Vault secret name
 * @param envFallback - Environment variable name to use if Key Vault is unavailable
 * @returns Secret value or undefined
 */
export async function getSecret(secretName: string, envFallback?: string): Promise<string | undefined> {
  // Return from cache if available
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName);
  }

  const kvClient = getClient();
  if (kvClient) {
    try {
      const secret = await kvClient.getSecret(secretName);
      const value = secret.value;
      if (value) {
        secretCache.set(secretName, value);
        return value;
      }
    } catch (err) {
      console.warn(`[KeyVault] Could not fetch ${secretName}, falling back to env:`, (err as Error).message);
    }
  }

  // Fall back to environment variable
  const fallback = envFallback ? process.env[envFallback] : undefined;
  if (fallback) {
    secretCache.set(secretName, fallback);
  }
  return fallback;
}
