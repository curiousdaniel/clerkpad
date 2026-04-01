import { db } from "./db";

const SETTINGS_ID = 1;

export async function ensureSettingsRow(): Promise<void> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) {
    await db.settings.add({
      id: SETTINGS_ID,
      currentEventId: null,
    });
  }
}

export async function getCurrentEventId(): Promise<number | null> {
  await ensureSettingsRow();
  const row = await db.settings.get(SETTINGS_ID);
  return row?.currentEventId ?? null;
}

export async function setCurrentEventId(eventId: number | null): Promise<void> {
  await ensureSettingsRow();
  await db.settings.update(SETTINGS_ID, { currentEventId: eventId });
}
