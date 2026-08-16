# Working on Nearby

Notes for anyone — human or AI — writing code in this repository. `README.md`
covers what the project is and how to run it; this file covers the rules that
are not obvious from reading the code.

## What visitors are allowed to read

**Nothing a customer sees may describe how the app is built.**

The landing page and the app are the product talking to a member of the
public. How the thing is made — the framework, the build, the repository, the
release process, the file formats, the hosting — is not information they can
use, and printing it makes a finished product read like somebody's side
project.

```html
<!-- Good -->
<p>The iPhone version is on the way.</p>
<p>41 MB · Updated Aug 15, 2026</p>
<span>Coming soon for Android</span>

<!-- Bad -->
<p>Clone the repo and run npm install, then npx expo start.</p>
<p>v1.0.0-build.7 · arm64-v8a</p>
<p>Phone says it cannot install? Get the universal build (62 MB).</p>
<span>No build published yet. Follow the repository to hear when one lands.</span>
```

The test: **would this sentence mean anything to somebody who has never
opened a terminal?** If it would only make sense to the person maintaining the
project, it belongs in this file, a commit message, or a code comment — not on
screen.

That includes:

- tool and framework names — Expo, React Native, Gradle, Vercel, GitHub
- build identifiers, version tags, CPU architectures, file formats
- repository links in prominent positions, and "view the source" invitations
- anything phrased as a workaround, a fallback, or a known limitation
- explanations written for the project owner rather than the customer

Two things are deliberately **not** covered by this rule. Installation help a
customer genuinely needs — allowing an install, or what a security warning
means — is customer-facing writing and belongs on the page. And the release
notes attached to a published build are read by people who went looking for
them, so they can be as technical as they need to be.

Where a limitation exists and cannot be explained without naming internals,
the answer is to say less, not to explain more. "The iPhone version is on the
way" is complete. Why it is not ready is not the visitor's problem.

## Say "we", never name the role

Anything a customer reads is Nearby talking to them. Which part of the system
acted is not something they can use.

```js
// Good
'We could not save that. Try again in a moment.';
'Your listing is being reviewed.';

// Bad
'The API returned 500.';
'An admin will approve your listing.';
```

## Everything visual comes from the tokens

`src/theme/tokens.ts` holds every colour, space, radius, shadow and type size.
A raw hex or a magic number in a screen is how two lists end up with subtly
different row heights, and how a rebrand becomes a week of work.

```tsx
// Good
<View style={{ padding: spacing.lg, borderRadius: radii.xl }} />

// Bad
<View style={{ padding: 16, borderRadius: 20 }} />
```

The landing page keeps its own copy of the palette in `landing/styles.css`,
because it cannot import TypeScript. If a brand colour changes, change it in
both.

### The accent is not the default icon colour

`tones` in the same file holds a named colour per icon: a `fg` for the glyph
and a `soft` for the tile behind it when there is one. Reach for one of those
rather than `colors.accent` whenever the icon is a **label** — a category, a
kind of notification, a sort of statistic. Orange stays reserved for what it
has always meant: the primary action, the active tab, the price, the saved
heart. When every glyph wears the accent, the accent stops picking anything
out, and ten categories in a row read as one grey block with pictures on it.

Category colours live in `CATEGORY_TONES` and deliberately track
`CATEGORY_GRADIENTS`, so a cafe looks like itself whether it is an icon, a map
pin, or a generated photo.

**A tile is not automatic either.** `InfoRow` draws the coloured square only
when it is given a tone, because a row that leads somewhere is worth marking
and a row that merely states a fact is not. A settings list where every line
carries an identical badge is a wall, not a list.

## Decisions live outside the components

Whether a shop is open, how results rank, how a distance reads — all of that
belongs in `src/lib/`, as plain functions with no React and no I/O. That is
what makes it testable without a renderer or a database, which is why
`npm test` runs in seconds and needs nothing installed.

A component should read as a description of what is on screen. If it contains
a rule worth arguing about, the rule is in the wrong file.

```ts
// Good — the decision is a function, and the test asserts it directly
export function openState(hours: WeekHours, at: Date): OpenState;

// Bad — the same rule buried in a component, reachable only by rendering it
const isOpen = hours[now.getDay()] && now.getHours() >= /* ... */;
```

Anything time-dependent takes the current moment as an argument rather than
calling `new Date()` internally. Tests cannot pin down a clock they cannot
reach, and a screen that computes the time on render is a hydration bug on the
web build.

## Data goes through the store

Screens never talk to the database. They use `useStore()`, which talks to
`src/lib/api.ts`, which is the only file that knows Supabase exists. A screen
that imports `supabase` directly has skipped both layers and will be the first
thing to break when a query changes.

`api.ts` also owns the mapping between database rows and the domain types in
`src/data/types.ts`. Column names are snake_case and the app is camelCase on
purpose: the seam is visible, so nobody accidentally leaks a row shape into a
component.

## The database enforces the rules, not the screens

Row level security is on for every table. "An owner may edit only their own
listing" is a policy in Postgres, not an `if` in a component — a screen can be
bypassed with a REST client and a policy cannot.

Two consequences worth remembering:

- **Reading is public, writing needs a session.** Browsing, searching and
  reading reviews all work signed out, because a sign-in wall in front of a
  directory is how people leave. Everything that writes goes through a policy.
- **Derived values are not writable.** `rating` and `review_count` are
  recomputed by a trigger whenever a review changes, and `UPDATE` on those
  columns is revoked. Computing them in the client is how a rating and its
  review list end up disagreeing.

Anything in the `public` schema is published as a REST endpoint, trigger
functions included. New `SECURITY DEFINER` functions need their `EXECUTE`
revoked from `anon` and `authenticated` unless they are genuinely meant to be
called from the app. Run the Supabase security advisor after any schema change
— it catches exactly this.

## Two rules the linter enforces, and why

**Never mutate a ref during render, and never call setState straight from an
effect body.** Both are easy to reach for and both broke this codebase once.

A ref written during render was covering for a callback that would otherwise
be rebuilt on every list change and re-trigger the effect that used it. The
real fix was to stop needing the lookup: pass the id the caller already holds,
so the callback has no dependencies at all.

State synced from an effect was copying the device's place name into the
viewer. The fix was to derive it — `viewer` is now computed from the stored
profile plus wherever the device says it is, so there is nothing to keep in
step.

Both are the same lesson: if a value can be computed from what you already
have, computing it is cheaper and safer than storing a second copy.

## A write that needs an account has to say so

Saving a place and posting a review both used to work perfectly while signed
out: the heart filled in, the review appeared, and the row was never written.
The person finds out on next launch, when it is gone and nothing explains why.

`toggleSaved` and `addReview` now send you to sign-in instead of pretending.
The rule generalises: if a write cannot land, do not move the UI as though it
did. Optimistic updates are for writes that will almost certainly succeed and
can be rolled back — not for writes that are guaranteed to fail.

The same reasoning killed the old claim flow's verification step, which
offered a text message, an email and a postcard, none of which existed, and
then said "we have sent a verification code" to a number nobody had messaged.
An honest "we will be in touch to confirm" is a smaller promise and a true
one.

## Claiming is not the same as creating

A listing already on the map that somebody says is theirs gets **claimed** —
`/owner/claim?business=<id>`, which calls `claim_business()` and sets
`owner_id`. Sending that person to the create form instead produces a second
row for the same shop, which is what the button used to do.

`claim_business()` takes ownership only when nobody owns it, locks the row
while it checks, and leaves `verified` false. Claiming is a request to manage
a listing, not proof it is yours, and until there is something that reviews
those requests, `claimed_at`/`claimed_by` is the record that it happened.

## The map has two implementations, and one is not a failure

Android's Maps SDK needs an API key. Given a missing or wrong one it does not
raise an error — it draws a blank grey rectangle with a watermark in the
corner, which looks precisely like a broken app. A `REPLACE_WITH_...`
placeholder sat in `app.json` doing exactly that.

The key now comes from `GOOGLE_MAPS_API_KEY` through `app.config.js`, and
`hasRealMap()` decides what to render. With no key, and on web, the app draws
`SchematicMap` instead: real projection, real pin positions, invented roads.
A build without the key has a worse map, not a broken one.

If you add a key, restrict it to the package name and signing certificate.
Anyone can pull an unrestricted key back out of the APK.

## Directions stay in the app

`openDirections` leaves for the phone's map app, and that is a big thing to do
to somebody who asked a small question. The Directions button opens our own
map focused on the listing instead. Handing off to Google or Apple Maps is
still there, as "Open in Maps" on the location card, because turn-by-turn
navigation is a real want and not one we serve.

## Lists do not carry everything

`businesses_nearby()` returns listings without their reviews, because
fetching reviews for every row is a query per listing. Detail screens call
`loadDetail(id)` when they open, which fetches the listing with its reviews
and merges it into the copy already in memory.

This is worth remembering when adding a field: if it is expensive per row, it
belongs on the detail fetch, not the list.

## Numbers must be measured

The owner dashboard once read a `insights` field that nothing ever wrote, so
the section rendered blank and typechecked perfectly. Counts now come from
`business_events`, recorded when somebody opens a listing, calls, or asks for
directions.

If a number cannot be measured yet, show nothing and say so — never a
plausible-looking figure. "Nobody has looked at this listing yet" is a real
answer; a fabricated view count is not.

## The web build is not the app

`react-native-maps` has no web implementation, so `MapCanvas.web.tsx` stands
in for it. Anything else that reaches for a native module needs the same
treatment, or the browser build breaks.

The web build is a plain client-rendered SPA on purpose. The app prints text
that depends on the current moment, which a server cannot compute at build
time without disagreeing with the browser at page load. That disagreement
breaks hydration, and the visible symptom is a stale copy of the UI stacked on
top of the live one — which is exactly the bug that cost an afternoon once
already.

## The console is not the security boundary

`admin/` is a small Vite app served at `/admin`, built into the landing site
by the same Vercel deploy. What makes somebody an admin is a row in
`public.admins`, checked by `is_admin()` inside every policy and every
`admin_*` function — not anything the console does.

So: hiding a button is a courtesy, never a control. Any new admin capability
is a function that checks `is_admin()` first and writes to `admin_actions`
after, and the console is one way to call it. If a capability would still
work when called with `curl` and an ordinary user's token, it is not finished.

Three consequences worth keeping:

- **No service role key in `admin/`, ever.** It bypasses every policy, and
  everything in that folder ships to a browser.
- **There is no INSERT policy on `admins`.** The first admin — and every one
  after — is added by hand in SQL. A self-serve path to becoming an admin is a
  self-serve path to owning the directory.
- **Suspending is a status, not a delete.** `businesses.status` drives
  visibility through the SELECT policy, which is why `businesses_nearby()`
  needed no change: it runs as the caller, so it inherits the policy.

## Reporting has to exist for moderation to mean anything

The reports queue was empty by construction until the app grew a way to flag
something. If you add a new kind of moderatable thing, add the affordance that
reports it in the same change — a screen full of controls for a queue nothing
can fill is worse than not having built it.

Reasons are a fixed list, not a text box. A queue of prose takes longer to
triage than it takes to write.

## Tests

`npm test`. Prefer tests that need no renderer and no network: `src/lib/` is
written to be testable that way, and the newer code should stay that way.

`npm run typecheck` before pushing. `tsc` catches the entire class of mistakes
that a screenshot never will.

## Builds are deliberate, not automatic

Pushing to `main` redeploys the landing page. It does **not** build the app —
that only happens on a manual run or a `v*` tag, so work in progress can land
without shipping a half-finished build to anyone. Cut a build when there is
something worth downloading.
