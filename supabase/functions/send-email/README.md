# Authentication emails

Supabase Auth calls `send-email` as its **send email hook** rather than using
its own built-in sender, which exists for testing and is rate limited to a
handful of messages an hour.

Building the message in code rather than pointing Supabase at Brevo's SMTP
relay buys one thing: the dashboard's template editor is locked behind having
custom SMTP configured, and the stock template sends a magic link. The app
asks for a six digit code, so the email has to carry one.

## Secrets it reads

| Secret | Needed | What it is |
|---|---|---|
| `BREVO_API_KEY` | yes | A v3 API key from Brevo |
| `BREVO_SENDER_EMAIL` | yes | An address **verified as a sender** in Brevo |
| `BREVO_SENDER_NAME` | no | Defaults to `Nearby` |
| `SEND_EMAIL_HOOK_SECRET` | yes | Generated when the hook is enabled, `v1,whsec_…` |

## Why the hook secret has no fallback

The function runs with `verify_jwt` off, because Auth calls it with a webhook
signature rather than a token. That signature is the only thing between this
endpoint and anybody who can send it a POST. A version that skipped
verification when the secret was missing would be an open relay that mails
arbitrary text to arbitrary addresses from your domain, so a missing secret is
a hard 500 instead.

## Deploying

`supabase functions deploy send-email --no-verify-jwt`, or through the
dashboard. The version in this folder is the one that was deployed.

## If mail stops arriving

Check the function logs first. Every failure names its own cause: which secret
is missing, that a signature was rejected, or Brevo's own message with its
status code. An unverified sender and a bad key are different problems and
Brevo says which one it is.
