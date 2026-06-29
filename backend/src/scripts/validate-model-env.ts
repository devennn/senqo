import { loadRepoEnv } from "../lib/load-repo-env.js";
import { validateActiveModelEnv } from "../lib/model-env.js";

loadRepoEnv();

try {
  const provider = validateActiveModelEnv();
  console.info(`[validate-model-env] Success: provider=${provider}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[validate-model-env] Failed: ${message}`);
  process.exit(1);
}
