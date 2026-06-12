/** True when a UDP notification belongs to the configured session app world. */
export function notificationMatchesApp(
  notificationAppId: bigint | string | number | null | undefined,
  sessionAppId: string,
): boolean {
  if (notificationAppId == null) return false;
  return String(notificationAppId) === sessionAppId.trim();
}
