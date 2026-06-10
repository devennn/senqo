import {
  decryptWorkspaceSecretValue,
  getWorkspaceSecretByName,
  normalizeSecretName,
} from "../repositories/workspace-secrets.js";

export async function resolveCustomToolEnv(
  workspaceId: string,
  requiredEnv: string[],
): Promise<Record<string, string | undefined>> {
  const env: Record<string, string | undefined> = {};
  for (const rawName of requiredEnv) {
    const name = normalizeSecretName(rawName);
    if (!name) {
      env[rawName.trim()] = undefined;
      continue;
    }
    const record = await getWorkspaceSecretByName(workspaceId, name);
    if (!record) {
      env[name] = undefined;
      continue;
    }
    env[name] = (await decryptWorkspaceSecretValue(record)) ?? undefined;
  }
  return env;
}
