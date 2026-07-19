import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;

/** Returns false when push isn't configured, so callers can quietly skip it. */
function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:daskitchen03@gmail.com",
      publicKey,
      privateKey
    );
    configured = true;
  }
  return true;
}

/**
 * Pushes a notification to every device the admins have registered — this is
 * what reaches the owner when the browser is closed and the laptop is shut.
 *
 * Never throws: a notification failing must not take an order down with it.
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!configure()) return;
    const admin = createAdminClient();
    if (!admin) return;

    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    const ids = (admins ?? []).map((a) => a.id);
    if (ids.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", ids);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // 404/410 mean the device unsubscribed or the browser was removed.
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );
  } catch {
    /* never let notifications break an order */
  }
}
