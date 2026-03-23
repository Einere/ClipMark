function formatMessage(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

export async function clearDebugLog() {
  return;
}

export function logDebug(message: string) {
  if (import.meta.env.DEV) {
    console.debug(formatMessage(message));
  }
}
