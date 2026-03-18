import { createNotification } from "./db";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@fil-app.com";
const APP_URL = process.env.APP_URL ?? "https://fil-app.com";

const BRAND_COLOR = "#0d7a6b";
const BRAND_NAME = "FiL";
const TAGLINE = "A new chapter starts here.";

function emailWrapper(body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1e293b;background:#ffffff">
      <div style="padding:24px 28px 16px;border-bottom:1px solid #f1f5f9">
        <span style="font-size:22px;font-weight:600;color:#1e293b;letter-spacing:-.02em">
          F<span style="color:${BRAND_COLOR}">i</span>L
        </span>
        <span style="font-size:11px;color:#94a3b8;margin-left:8px;text-transform:uppercase;letter-spacing:.08em">${TAGLINE}</span>
      </div>
      <div style="padding:28px">
        ${body}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;text-align:center">
        ${BRAND_NAME} · ${TAGLINE}<br>
        <a href="${APP_URL}/settings" style="color:#94a3b8">Manage notifications</a>
      </div>
    </div>`;
}

const emailTemplates = {
  newMatch: (userName: string, matchName: string, compatibilityScore: number) => ({
    subject: `You have a new match on FiL`,
    html: emailWrapper(`
      <h2 style="font-size:20px;font-weight:600;color:#1e293b;margin-bottom:6px">New match found</h2>
      <p style="color:#64748b;margin-bottom:18px">Hi ${userName},</p>
      <p style="color:#475569;line-height:1.6;margin-bottom:20px">
        You've been matched with <strong style="color:#1e293b">${matchName}</strong> with a
        <strong style="color:${BRAND_COLOR}">${compatibilityScore}%</strong> narrative compatibility score.
        Their story complements yours in ways worth exploring.
      </p>
      <a href="${APP_URL}/matches" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">View match →</a>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">A new chapter starts here.</p>
    `),
  }),

  profileView: (userName: string, viewerName: string) => ({
    subject: `${viewerName} viewed your FiL profile`,
    html: emailWrapper(`
      <h2 style="font-size:20px;font-weight:600;color:#1e293b;margin-bottom:6px">Someone visited your profile</h2>
      <p style="color:#64748b;margin-bottom:18px">Hi ${userName},</p>
      <p style="color:#475569;line-height:1.6;margin-bottom:20px">
        <strong style="color:#1e293b">${viewerName}</strong> just viewed your profile on FiL.
        Check out their narrative and see if there's a connection worth making.
      </p>
      <a href="${APP_URL}/matches" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">View their profile →</a>
    `),
  }),

  newMessage: (userName: string, senderName: string) => ({
    subject: `New message from ${senderName} on FiL`,
    html: emailWrapper(`
      <h2 style="font-size:20px;font-weight:600;color:#1e293b;margin-bottom:6px">You have a new message</h2>
      <p style="color:#64748b;margin-bottom:18px">Hi ${userName},</p>
      <p style="color:#475569;line-height:1.6;margin-bottom:20px">
        <strong style="color:#1e293b">${senderName}</strong> sent you a message on FiL.
        Don't leave them waiting — real connection starts with a reply.
      </p>
      <a href="${APP_URL}/messages" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Read message →</a>
    `),
  }),
};

async function sendViaSendGrid(toEmail: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("[Email] SENDGRID_API_KEY not set — skipping");
    return false;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: FROM_EMAIL, name: BRAND_NAME },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!res.ok) {
      console.error("[Email] SendGrid error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Failed:", err);
    return false;
  }
}

export async function sendEmailNotification(
  userId: number,
  userEmail: string,
  userName: string,
  type: "newMatch" | "profileView" | "newMessage",
  additionalData: Record<string, string>
) {
  try {
    let template: { subject: string; html: string };
    switch (type) {
      case "newMatch":
        template = emailTemplates.newMatch(
          userName,
          additionalData.matchName ?? "Someone",
          parseInt(additionalData.compatibilityScore ?? "0")
        );
        await createNotification(userId, "new_match",
          additionalData.relatedUserId ? parseInt(additionalData.relatedUserId) : undefined,
          additionalData.matchId ? parseInt(additionalData.matchId) : undefined
        );
        break;
      case "profileView":
        template = emailTemplates.profileView(userName, additionalData.viewerName ?? "Someone");
        await createNotification(userId, "profile_view",
          additionalData.viewerUserId ? parseInt(additionalData.viewerUserId) : undefined
        );
        break;
      case "newMessage":
        template = emailTemplates.newMessage(userName, additionalData.senderName ?? "Someone");
        break;
      default:
        return;
    }
    const sent = await sendViaSendGrid(userEmail, template.subject, template.html);
    console.log(`[Email] ${type} → ${userEmail} | sent=${sent}`);
  } catch (err) {
    console.error("[Email] Error:", err);
  }
}
