/**
 * Formatting for values that come from real stored reading sessions.
 *
 * Durations are only ever rendered for sessions the database actually contains;
 * there is no placeholder that implies unrecorded reading.
 */
export function formatReadingDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Percentage of a book that has actually been read, or null when unknown. */
export function readingPercent(progressPercentage: number | null | undefined): number | null {
  if (progressPercentage === null || progressPercentage === undefined) return null;
  if (!Number.isFinite(progressPercentage)) return null;
  return Math.round(Math.min(1, Math.max(0, progressPercentage)) * 100);
}
