let syncApplyGuardDepth = 0;

/** True while cloud snapshot replace/import or remote op apply is mutating Dexie. */
export function isCloudSyncApplying(): boolean {
  return syncApplyGuardDepth > 0;
}

export async function withCloudSyncApply<T>(fn: () => Promise<T>): Promise<T> {
  syncApplyGuardDepth++;
  try {
    return await fn();
  } finally {
    syncApplyGuardDepth--;
  }
}
