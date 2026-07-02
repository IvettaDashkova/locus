import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/feedback — a visitor's suggestion or note, delivered by email.
 *
 * Provider-agnostic on purpose so it works on the project's free stack: it uses Resend if
 * RESEND_API_KEY is set (free tier sends from onboarding@resend.dev to the owner's own inbox with no
 * domain to verify), else SendGrid if SENDGRID_API_KEY is set. With neither configured it logs the
 * message server-side (retrievable from the platform logs) and still returns success, so the form
 * never breaks and nothing is silently lost. Set RESEND_API_KEY in Vercel to start receiving mail.
 */

const TO = process.env.FEEDBACK_TO ?? "ivettadashkovafsd@gmail.com";
const RESEND_FROM = process.env.FEEDBACK_FROM ?? "Locus Feedback <onboarding@resend.dev>";
const SENDGRID_FROM = process.env.SENDGRID_FROM ?? "no-reply@locus-dun.vercel.app";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Best-effort in-memory rate limit (per warm instance): 5 submissions / 10 min / IP.
const recent = new Map<string, number[]>();
function rateLimited(ip: string, now: number): boolean {
  const windowMs = 10 * 60_000;
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 5;
}

async function deliver(subject: string, text: string, replyTo?: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [TO], subject, text, reply_to: replyTo || undefined }),
    });
    if (res.ok) return true;
    console.error("[feedback] Resend failed", res.status, await res.text().catch(() => ""));
    return false;
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${sendgridKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: TO }] }],
        from: { email: SENDGRID_FROM, name: "Locus Feedback" },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (res.ok) return true;
    console.error("[feedback] SendGrid failed", res.status, await res.text().catch(() => ""));
    return false;
  }

  // No provider wired up yet — keep the message in the logs rather than dropping it.
  console.warn(`[feedback] no email provider configured — message kept in logs:\n${text}`);
  return false;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Pretend success and drop it.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const message = String(body.message ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 200);

  if (message.length < 3) {
    return NextResponse.json({ error: "Message is too short." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip, Date.now())) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  const subject = `Locus feedback${name ? ` — ${name}` : ""}`;
  const text = [
    `From: ${name || "Anonymous"}${email ? ` <${email}>` : ""}`,
    `IP: ${ip}`,
    "",
    message,
  ].join("\n");

  const delivered = await deliver(subject, text, email && EMAIL_RE.test(email) ? email : undefined);
  return NextResponse.json({ ok: true, delivered });
}
