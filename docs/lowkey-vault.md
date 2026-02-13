# Lowkey Vault — Gotchas & Notes

[Lowkey Vault](https://github.com/nagyesta/lowkey-vault) is an open-source Azure Key Vault emulator used for local development via Docker. This document captures non-obvious behaviors that differ from production Azure Key Vault.

## No persistence (in-memory only)

Lowkey Vault stores everything in JVM heap memory. There is no disk persistence — **all secrets are lost when the container stops**, regardless of whether you use `docker compose down` or `docker compose down -v`. Every restart is a clean slate.

To work around this, a `vault-init` Docker container runs `scripts/lowkey-vault-init.mjs` at startup. It reads `.env.local`, generates the Lowkey Vault import JSON, and writes it to a shared Docker volume. Lowkey Vault then imports the file on startup. No files are created on the host — the generated JSON lives entirely inside the Docker volume.

Secrets live **only** in `.env.local` — they are never passed as env vars to webhook/worker containers. This prevents code from accidentally reading `process.env.<SECRET>` instead of going through the secrets manager.

The `.env.local` file is the durable source of truth for local dev. Secrets updated via the dashboard only last until the containers stop.

## Image versioning

Use a **pinned tag** (e.g. `nagyesta/lowkey-vault:7.1.9`). The `:latest` tag has been unreliable on Docker Hub and may fail to pull.

## Default vault registration

Lowkey Vault only registers a vault for `https://localhost:8443` on startup. When services connect via a Docker hostname (e.g. `https://lowkey-vault:8443`), the vault must be registered under that hostname. We handle this via the import file (`LOWKEY_IMPORT_TEMPLATE_HOST=lowkey-vault`), which creates the vault at the correct URL at startup.

If you ever need to register a vault manually (e.g. without import):

```
POST https://lowkey-vault:8443/management/vault
Content-Type: application/json

{ "baseUri": "https://lowkey-vault:8443", "recoveryLevel": "Recoverable+Purgeable", "recoverableDays": 90 }
```

**Warning:** `POST /management/vault` is NOT idempotent — calling it for a `baseUri` that already exists **recreates** the vault, wiping all stored secrets. Check first with `GET /management/vault` (returns an array of `{ baseUri }` objects).

## Recovery level must be `Recoverable+Purgeable`

- `recoveryLevel` is a **required** field when creating a vault — omitting it causes a validation error.
- Do **not** use `Purgeable` (no soft-delete). The Azure SDK's `beginDeleteSecret()` expects soft-delete semantics and will fail with a 404 on `Purgeable` vaults in Lowkey Vault.
- Use `Recoverable+Purgeable` with `recoverableDays: 90`. This enables soft-delete, which `beginDeleteSecret` needs, while still allowing `purgeDeletedSecret()` to permanently remove secrets afterward.

## Deleting secrets requires soft-delete + purge

Because the vault uses `Recoverable+Purgeable`:

```typescript
const poller = await client.beginDeleteSecret(name);
await poller.pollUntilDone();          // wait for soft-delete to finish
await client.purgeDeletedSecret(name); // permanently remove
```

Skipping `purgeDeletedSecret` leaves the secret in a "deleted" state where it can't be re-created with the same name.

## Challenge resource verification

The Azure SDK performs domain verification during the authentication challenge. Lowkey Vault's challenge resource doesn't match Docker hostnames, so you must disable this for non-Azure endpoints:

```typescript
new SecretClient(vaultUrl, credential, {
  disableChallengeResourceVerification: !vaultUrl.includes(".vault.azure.net"),
});
```

Keep verification **enabled** in production.

## Error code differences

Azure Key Vault returns `code: "SecretNotFound"` for missing secrets. Lowkey Vault returns:

```json
{
  "code": "com.github.nagyesta.lowkeyvault.service.exception.NotFoundException",
  "statusCode": 404
}
```

Check **both** `code === "SecretNotFound"` and `statusCode === 404` when detecting not-found errors.

## Startup timing

Lowkey Vault takes ~6 seconds to become ready after the container starts. Services that depend on it need retry logic with backoff. `docker-compose.yml` `depends_on` only waits for the container to start, not for the HTTP server to be ready.

## Seeding & log noise

Calling `getSecret()` for a key that doesn't exist generates noisy `ERROR` + full Java stack traces in the Lowkey Vault container logs. The import file approach avoids this entirely. If runtime seeding is ever needed, use `listPropertiesOfSecrets()` first to discover which keys already exist, then only `setSecret()` for the missing ones.

## Identity endpoint

Lowkey Vault exposes a mock managed identity endpoint on port **8080** (HTTP, not HTTPS):

```
http://lowkey-vault:8080/metadata/identity/oauth2/token
```

This simulates Azure's managed identity token endpoint. Set `AZURE_IDENTITY_HEADER` to any non-empty string (e.g. `dummy`).

## TLS

Lowkey Vault serves HTTPS on port 8443 with a self-signed certificate. Containers that connect to it need `NODE_TLS_REJECT_UNAUTHORIZED=0`.
