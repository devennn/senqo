import { hashPassword } from "../lib/auth-users.js";
import { env } from "./env.js";
import { countUsers, createUser, findUserByEmail } from "../repositories/auth-users.js";
import { provisionOwnerWorkspace } from "../repositories/profiles.js";
import { seedInstanceSettings } from "../repositories/instance-settings.js";

const scope = "BootstrapAdmin";

export async function bootstrapAdminIfNeeded(): Promise<void> {
  const userCount = await countUsers();
  if (userCount > 0) {
    console.info(`[${scope}] Success: users exist, skipping bootstrap`);
    return;
  }

  await seedInstanceSettings(env.initialAllowPublicRegistration);

  const email = env.bootstrapAdminEmail?.trim().toLowerCase();
  const password = env.bootstrapAdminPassword;

  if (!email || !password) {
    if (!env.initialAllowPublicRegistration) {
      throw new Error(
        "[BootstrapAdmin] ALLOW_PUBLIC_REGISTRATION=false but BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are not set",
      );
    }
    console.info(`[${scope}] Success: open registration, no bootstrap admin required`);
    return;
  }

  if (password.length < 8) {
    throw new Error("[BootstrapAdmin] BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    console.info(`[${scope}] Success: bootstrap email already exists`);
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash, userId, { isInstanceAdmin: true });

  await provisionOwnerWorkspace(
    user.id,
    user.email,
    "",
    env.bootstrapWorkspaceName,
  );

  console.info(`[${scope}] Success: created bootstrap superadmin email=${email}`);
}
