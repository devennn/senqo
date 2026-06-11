import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { instanceSettings } from "../db/schema/index.js";

const scope = "InstanceSettingsRepository";
const SINGLETON_ID = "default";

export async function getAllowPublicRegistration(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ allowPublicRegistration: instanceSettings.allowPublicRegistration })
      .from(instanceSettings)
      .where(eq(instanceSettings.id, SINGLETON_ID));

    const value = row?.allowPublicRegistration ?? true;
    console.info(`[${scope}/getAllowPublicRegistration] Success: value=${value}`);
    return value;
  } catch (error) {
    console.error(`[${scope}/getAllowPublicRegistration] Unexpected error: ${String(error)}`);
    return true;
  }
}

export async function setAllowPublicRegistration(value: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db
      .insert(instanceSettings)
      .values({
        id: SINGLETON_ID,
        allowPublicRegistration: value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: instanceSettings.id,
        set: {
          allowPublicRegistration: value,
          updatedAt: new Date(),
        },
      });

    console.info(`[${scope}/setAllowPublicRegistration] Success: value=${value}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/setAllowPublicRegistration] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function seedInstanceSettings(allowPublicRegistration: boolean): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: instanceSettings.id })
      .from(instanceSettings)
      .where(eq(instanceSettings.id, SINGLETON_ID));

    if (existing) {
      console.info(`[${scope}/seedInstanceSettings] Success (existing): skipped`);
      return;
    }

    await db.insert(instanceSettings).values({
      id: SINGLETON_ID,
      allowPublicRegistration,
    });
    console.info(`[${scope}/seedInstanceSettings] Success: allowPublicRegistration=${allowPublicRegistration}`);
  } catch (error) {
    console.error(`[${scope}/seedInstanceSettings] Unexpected error: ${String(error)}`);
  }
}
