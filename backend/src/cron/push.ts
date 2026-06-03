// backend/src/cron/push.ts
// Shared helpers for cron notification tasks

export type SupportedLanguage = 'tr' | 'en';

export function resolveLanguage(value: unknown): SupportedLanguage {
  if (typeof value !== 'string') return 'tr';
  return value.trim().toLowerCase().startsWith('en') ? 'en' : 'tr';
}

export async function sendExpoPush(token: string, title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high', channelId: 'default' }),
    });
    if (!res.ok) return false;
    const payload = await res.json().catch(() => null) as any;
    if (!payload) return true;
    const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    return data?.status !== 'error';
  } catch {
    return false;
  }
}
