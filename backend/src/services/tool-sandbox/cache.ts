const bundleCache = new Map<string, string>();

export function getCachedBundle(sourceHash: string): string | undefined {
  return bundleCache.get(sourceHash);
}

export function setCachedBundle(sourceHash: string, bundle: string): void {
  if (bundleCache.size > 200) {
    bundleCache.clear();
  }
  bundleCache.set(sourceHash, bundle);
}
