const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;

export const DEFAULT_DOC_STORAGE_STUDENT_MB = 50;
export const DEFAULT_DOC_STORAGE_WORKSPACE_MB = 100;

export function mbToBytes(mb: number): number {
  if (!Number.isFinite(mb) || mb <= 0) return 0;
  return Math.round(mb * BYTES_PER_MB);
}

export function bytesToWholeMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.ceil(bytes / BYTES_PER_MB);
}

export function formatStorageSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";
  if (bytes >= BYTES_PER_GB) return `${parseFloat((bytes / BYTES_PER_GB).toFixed(1))} GB`;
  if (bytes >= BYTES_PER_MB) return `${parseFloat((bytes / BYTES_PER_MB).toFixed(1))} MB`;
  if (bytes >= BYTES_PER_KB) return `${parseFloat((bytes / BYTES_PER_KB).toFixed(1))} KB`;
  return `${Math.round(bytes)} Bytes`;
}

export function getStoragePercentage(usedBytes: number, limitBytes: number): number {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(limitBytes) || limitBytes <= 0) return 0;
  return Math.max(0, Math.min(100, (usedBytes / limitBytes) * 100));
}

export function getStorageSliderStepMb(maxMb: number): number {
  if (!Number.isFinite(maxMb) || maxMb <= 0) return 10;
  if (maxMb <= 500) return 10;
  if (maxMb <= 5_000) return 50;
  return 100;
}

export function getStorageLimitExceededMessage(remainingBytes: number, incomingBytes: number): string {
  return `Storage limit exceeded. Remaining: ${formatStorageSize(Math.max(0, remainingBytes))}. Attempted: ${formatStorageSize(Math.max(0, incomingBytes))}.`;
}
