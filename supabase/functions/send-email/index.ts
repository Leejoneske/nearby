/**
 * Sends every authentication email through Brevo.
 *
 * Supabase Auth calls this as its "send email" hook instead of using its own
 * built-in sender, which exists for testing and is rate limited to a handful
 * of messages an hour.
 *
 * Doing it here rather than by pointing Supabase at Brevo's SMTP relay buys
 * one thing that matters: the message is built in code. The dashboard's
 * template editor is locked behind having custom SMTP configured, and the
 * default template sends a magic link, so the app's six digit code screen had
 * nothing to type. This owns the subject and the body outright.
 *
 * ── What this needs, as function secrets ─────────────────────────────────
 *
 *   BREVO_API_KEY            a v3 API key from Brevo
 *   BREVO_SENDER_EMAIL       an address verified as a sender in Brevo
 *   BREVO_SENDER_NAME        optional, defaults to Nearby
 *   SEND_EMAIL_HOOK_SECRET   generated when the hook is enabled in the
 *                            dashboard, in the form v1,whsec_…
 *
 * The last one is not optional and there is no unverified fallback. This
 * endpoint is reachable without a JWT, so the signature is the only thing
 * standing between it and anybody who can send it a POST. A version that
 * skipped verification when the secret was missing would be an open relay
 * that mails arbitrary text to arbitrary addresses from your domain.
 */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type EmailAction =
  | 'signup'
  | 'login'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'email_change_current'
  | 'email_change_new'
  | 'reauthentication';

type HookPayload = {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailAction | string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

const BRAND = 'Nearby';

/**
 * What each kind of email says.
 *
 * All of them carry the six digit code rather than a link. A link has to
 * survive being opened in whichever browser the phone picked and then handed
 * back to the app; a code does not, and the app already asks for one.
 *
 * The code goes in the subject as well as the body, so it can be read off a
 * notification without opening anything.
 */
function compose(action: string, token: string): { subject: string; heading: string; line: string } {
  switch (action) {
    case 'recovery':
      return {
        subject: `${token} is your ${BRAND} recovery code`,
        heading: 'Get back into your account',
        line: 'Enter this code to sign in. If you did not ask to recover your account, you can ignore this email.',
      };
    case 'email_change':
    case 'email_change_new':
    case 'email_change_current':
      return {
        subject: `${token} confirms your new ${BRAND} address`,
        heading: 'Confirm your new email address',
        line: 'Enter this code in the app to finish changing the address you sign in with.',
      };
    case 'invite':
      return {
        subject: `${token} is your ${BRAND} invitation code`,
        heading: `You have been invited to ${BRAND}`,
        line: 'Enter this code in the app to set up your account.',
      };
    case 'reauthentication':
      return {
        subject: `${token} is your ${BRAND} confirmation code`,
        heading: 'Confirm it is you',
        line: 'Enter this code to confirm the change you just asked for.',
      };
    default:
      // signup, login and magiclink are the same thing from the app's side:
      // somebody typed their address into the sign-in screen.
      return {
        subject: `${token} is your ${BRAND} code`,
        heading: `Sign in to ${BRAND}`,
        line: 'Enter this code in the app. It expires shortly, and it only works once.',
      };
  }
}

/** Escapes anything interpolated into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The message body.
 *
 * Tables and inline styles, because email clients are not browsers: Gmail
 * strips <style> blocks, and Outlook lays out with a word processor. Anything
 * cleverer than this renders differently in half the inboxes it reaches.
 */
function html(heading: string, line: string, token: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="font-size:20px;font-weight:700;color:#111111;padding-bottom:8px;">
                ${escapeHtml(heading)}
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:21px;color:#6b6b6b;padding-bottom:24px;">
                ${escapeHtml(line)}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;background:#ffe9e0;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:700;letter-spacing:8px;color:#111111;">
                  ${escapeHtml(token)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:18px;color:#9a9a9a;border-top:1px solid #e6e6e6;padding-top:16px;">
                If you did not ask for this, nothing has happened to your account and you can ignore this email.
              </td>
            </tr>
          </table>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9a9a9a;padding-top:16px;">
            ${BRAND}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The plain text part, for clients that will not render HTML. */
function text(heading: string, line: string, token: string): string {
  return `${heading}\n\n${line}\n\nYour code: ${token}\n\nIf you did not ask for this, nothing has happened to your account and you can ignore this email.\n\n${BRAND}`;
}

function fail(status: number, message: string): Response {
  console.error('[send-email]', message);
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'Only POST is accepted.');

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const sender = Deno.env.get('BREVO_SENDER_EMAIL');
  const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? BRAND;
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');

  // Configuration problems are named exactly. "Something went wrong" in a
  // function log costs an hour of guessing which of four secrets is missing.
  if (!hookSecret) return fail(500, 'SEND_EMAIL_HOOK_SECRET is not set.');
  if (!apiKey) return fail(500, 'BREVO_API_KEY is not set.');
  if (!sender) return fail(500, 'BREVO_SENDER_EMAIL is not set.');

  const body = await req.text();

  let payload: HookPayload;
  try {
    const webhook = new Webhook(hookSecret.replace('v1,whsec_', ''));
    payload = webhook.verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch (error) {
    // A bad signature is somebody else calling this endpoint, not a bug.
    return fail(401, `Signature rejected: ${(error as Error).message}`);
  }

  const { user, email_data: data } = payload;
  const { subject, heading, line } = compose(data.email_action_type, data.token);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: sender },
      to: [{ email: user.email }],
      subject,
      htmlContent: html(heading, line, data.token),
      textContent: text(heading, line, data.token),
    }),
  });

  if (!response.ok) {
    // Brevo's message is the useful part: an unverified sender and a bad key
    // are different problems with different fixes, and it says which.
    const detail = await response.text();
    return fail(502, `Brevo refused the message (${response.status}): ${detail}`);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
