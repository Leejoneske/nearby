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

`src/theme/tokens.ts` holds every space, radius, shadow and type size, and
`src/theme/palettes.ts` holds the colours — one set per theme. A raw hex or a
magic number in a screen is how two lists end up with subtly different row
heights, and how a rebrand becomes a week of work. Since the app gained a dark
theme it is also how a screen ends up with a white capsule floating on a black
background, which is exactly what a hardcoded `#DEDEDE` in the tab bar did.

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

## Two themes, one set of names

A screen names a **role**, never a colour: `surface`, `textSecondary`,
`tabBar`. That is what makes switching theme switch everything without any
screen knowing which theme is on.

The mechanism is `makeStyles`:

```tsx
const useStyles = makeStyles((colors, tones) => ({
  card: { backgroundColor: colors.surface },
}));

export function Card() {
  const styles = useStyles();
  const { colors } = useTheme();   // only if a colour is named in JSX
  ...
}
```

The callback parameters are deliberately named `colors` and `tones`, so every
rule inside a stylesheet reads exactly as it did before the app had themes.
Both palettes are built once, at module load, so switching picks between two
finished stylesheets rather than rebuilding anything while somebody scrolls.

Three things worth keeping true:

- **`palettes.ts` is the only file with a hex in it.** `palettes.test.ts`
  checks that the two palettes describe the same roles, that nothing is
  undefined, and that text and icon tiles clear their contrast ratios. It
  caught three light-theme tones that had always been under 3:1, and an
  earlier dark accent that failed with white on it.
- **The dark palette is not the light one inverted.** Pure black makes white
  text vibrate and destroys the sense of a card sitting above a surface, so
  the ground is a very dark *warm* grey with each layer above it lighter. Warm
  because the accent is orange, and neutral grey beside orange reads blue.
- **The accent is the same orange in both.** The instinct is to lift it on a
  dark ground; doing so took the white label on an accent button from 3.1 to
  2.8 against it, under the bar. Readability wins over vividness.

Appearance is a three-state preference, not a switch: system, always light,
always dark. System is the default because that is what people expect,
including when the phone changes at dusk.

## What "recommended" means here

`src/lib/recommend.ts` builds a taste from what somebody saved, viewed,
searched and reviewed, then scores every listing against it alongside
distance, quality, whether it is open, price and area.

It is deliberately a set of legible rules rather than something that sounds
cleverer, and the reasoning is worth keeping. A directory of a few thousand
listings in one city, used by somebody who has opened perhaps twenty of them,
does not have the data for collaborative filtering: there are not enough
overlapping pairs to learn from, and a model trained on that would mostly
repeat the popularity it already knows.

Four decisions inside it that are easy to get backwards:

- **A bad review is evidence against a category, not for it.** Anything that
  counts "interactions" gets this wrong.
- **Distance and quality together outweigh taste.** Somebody who likes cafes
  still wants a good cafe *near them*. A recommender that sends them across
  the city because the category matched has understood the wrong half.
- **Quality is shrunk towards a prior.** One five-star review is not better
  than a 4.6 from two hundred people, and a plain average says it is.
- **Two per category, then fill.** Somebody who saved three cafes already
  knows they like cafes; the thing a directory is for is the place they have
  not found yet.

Every recommendation carries a sentence saying why, and that is not decoration.
A recommendation nobody can disagree with is one nobody can trust, and one
nobody can debug.

The whole thing runs on the device from that person's own activity. Nothing is
sent anywhere, and nothing about anybody else goes into it.

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

## A write is not done until the database says so

Three screens used to show success the moment a button was pressed and log the
failure to a console nobody would ever read: posting a review, replying to one
as the owner, and saving a listing edit. Each patched local state first and
fired the write afterwards.

That is the worst shape a write can have here, and the comment above one of
them said so while doing it: "a review nobody wrote down is worse than being
asked to sign in, because the person believes they posted it." An owner who
fixed their opening hours and saw a tick had every reason to believe it, and
found out otherwise when a customer arrived at a closed shop.

All three now await the write and throw, and all three screens show the
reason. The rule for anything new: **the local copy follows the database, not
the other way round.** Optimistic updates are for things that can be put back,
like a heart on a card, not for things somebody will act on.

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

## What the tests enforce about copy

`copy.test.ts` walks the real source rather than trusting anybody to remember,
and it now covers three rules:

- **No dashes as punctuation.** An em dash reads as machine-written to a lot
  of people, and once one is in a screen the next person matches it.
- **Never name an internal role.** Anything a customer reads is Nearby talking
  to them. "We read every listing" rather than "an admin reviews every
  listing": which internal role acted is not information they can use, and
  naming it makes a routine action sound like an escalation.
- **The landing page and the legal copy count as copy.** Both had drifted for
  the same reason: the walk only looked at `.ts` and `.tsx` under `src`, so
  `legal.json` and `landing/index.html` were invisible to it. The page was
  carrying three em dashes and a footer link to a privacy policy that did not
  exist, while every screen in the app obeyed the rule.

`secrets.test.ts` is the other guard. `.env` is committed on purpose: the
Android workflow has no Supabase environment of its own, so without it CI
builds an app that throws on launch, and the key in it is the publishable one
that is designed to ship. The risk is not what is in there now, it is that a
committed `.env` is an inviting place to put the next value. The test decodes
any JWT it finds in the files that ship and fails if one says `service_role`.

## The privacy policy is a page, not just a screen

`src/data/legal.json` holds the words, `src/data/legal.ts` types them for the
app, and `landing/build-legal.mjs` writes `/privacy` and `/terms` at deploy
time from the same file. One copy of the text, so the page and the screen
cannot disagree.

It is a page because it has to be. An app store submission needs a public
privacy URL, and a policy that exists only inside the app is not reachable by
somebody deciding whether to install it. The footer used to link to `#`, which
is worse than not linking at all: it looks like a policy exists and goes
nowhere.

When behaviour changes, this text changes with it or it stops being true. Four
that had already gone stale: it said you sign in with a phone number long
after that became an email address; it said nothing about the counts an owner
sees; it still said reporting needed an account; and it said nothing at all
about the device code and coarse location the fraud rules collect, which is
exactly the sort of thing a privacy policy exists to disclose.

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

## The map needs no key, and that is the point

Android's Maps SDK needs an API key tied to a billing account. Given a missing
or refused one it does not raise an error — it draws a blank grey rectangle
with a watermark in the corner, which looks precisely like a broken app. That
shipped once, from a `REPLACE_WITH_...` placeholder sitting in `app.json`.

The map is now MapLibre rendering OpenFreeMap's vector tiles, from
OpenStreetMap data. No key, no account, no card, no request quota. The style
is `liberty`, which keeps road classes and place labels legible at the zoom a
directory actually uses — street level in one neighbourhood.

Three consequences worth knowing:

- **It needs a native build.** MapLibre is native code, so Expo Go cannot run
  it. CI already prebuilds, so nothing changed there.
- **The attribution button stays.** OpenStreetMap's licence requires credit
  and MapLibre's button is how it is given. It is not ours to switch off.
- **`SchematicMap` is still the fallback**, now for a tile server that cannot
  be reached rather than for a missing key. Real projection, real pin
  positions, invented roads. A map that could not load must never be a blank
  rectangle, because that is the failure this whole thing replaced.

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

## Two ways to say a price is one too many

Owners are asked for a range in shillings, because that is a real number they
know about their own business. `price_level`, the one to four the filter and
the `$` signs read, is derived from it by a trigger. Nothing ever set it
before, so every listing kept the default of 2 no matter what its owner typed
and the price filter answered with the wrong places.

An empty range leaves the level alone rather than reading as "cheap": not
knowing what somewhere costs is not the same as it being free.

## Uploads read a file as a file

`fetch(uri).arrayBuffer()` is how you read a picked image in a browser and
not how you read one on a phone. React Native's `fetch` accepts a `file:`
URI and then fails to produce an `arrayBuffer` for it, so the same code that
works in the web preview uploads an empty object from a device — with no
error anywhere, because every call succeeded. `readBytes` in `src/lib/api.ts`
picks by URI scheme: `fetch` for `blob:` and `data:`, `expo-file-system` for
everything else.

## The nearby page is not the whole directory

`businesses_nearby()` answers one question — what is close — and the store
keeps its answer as `businesses`. Two lists are not about proximity at all:
the places somebody saved, and the listings they own. Both used to be drawn
by filtering that same page.

That works until the directory outgrows one page of it. Past a hundred
listings inside the radius, a place saved on a trip to Mombasa is not in the
page any more, and the Saved tab drops it without a word. Nothing is broken
in a way a test would catch, because the bug needs data volume to appear.

So both are fetched by name — `fetchBusinessesBySlugs` and `fetchOwned` — and
merged into the same list, with the nearby copy winning on conflict because
it is the one that knows the distance. Any future list that is not "near me"
needs the same treatment.

## A picture belongs to the person, not to the review

`reviews.author_name` is copied on to the row at write time, so a review
reads as it did when it was written. The picture is not: it is read from the
author's profile every time the reviews are fetched, so changing it changes
every review at once, which is what "sync it everywhere" has to mean.

Getting it there took a function. `profiles` is readable only by the person
it belongs to — the row carries an email address and a phone number — so
joining it from `reviews` returned a picture on your own reviews and on
nobody else's. `review_author_avatars(uuid[])` hands back ids and avatar URLs
and nothing else. Do not widen the policy on `profiles` to fix a display
problem; add to that function, or write another one as narrow.

## What happens under load, and why there is no Redis

Asked and measured rather than assumed, so it can be re-checked rather than
re-argued.

The read path is one `businesses_nearby()` per app open, one detail fetch per
listing opened, and one row into `business_events` per view. The nearby query
is a GIST index lookup with a `limit`, search runs client-side over the page
already in memory so typing costs nothing, and the detail fetch is a primary
key lookup plus two indexed reads. None of that is where a directory this
size falls over.

`business_events` is. It is the only table that grows with traffic rather
than with the directory: a row per view, per call, per tap on Directions,
kept for ever, and every insight query reading across all of it to answer a
question about this week. `prune_business_events()` runs nightly on pg_cron
and keeps ninety days, which is further back than anything on the dashboard
looks.

Redis was considered and is not warranted. It would sit in front of reads
that are already index lookups against a table of a few thousand rows, and
buy a cache invalidation problem: a listing changes when its owner edits it,
when a review lands, when we approve or suspend it, and a stale directory
entry is worse than a slightly slower fresh one. The order to reach for
things in, if the numbers ever say so: raise the Supabase instance size,
then cache the nearby response at the edge with a short TTL, then Redis —
and only with a measurement in hand saying which one is the problem.

## A pin is a real fix or it is nothing

`useOrigin` answers "where is this person looking from" and is allowed to
fall back to the centre of town, because a directory that shows nothing
because it could not place you is worse than one that measures from the city.

`capturePin` in `src/lib/pinLocation.ts` is the opposite and must stay that
way. It returns a fix or a reason, never a guess. A listing placed at the city
centre because the fix timed out is worse than a listing with no pin: it sends
people to the wrong street and it looks deliberate. When there is no pin the
form says so, in as many words, and the listing goes in at the centre of the
area the owner typed.

## Numbers must be measured

The owner dashboard once read a `insights` field that nothing ever wrote, so
the section rendered blank and typechecked perfectly. Counts now come from
`business_events`, recorded when somebody opens a listing, calls, or asks for
directions.

If a number cannot be measured yet, show nothing and say so — never a
plausible-looking figure. "Nobody has looked at this listing yet" is a real
answer; a fabricated view count is not.

## The landing page ships with the app, not after it

`landing/` is a sales pitch for whatever the app currently does, so a change
to what the app does is not finished until the page says the same thing. It
went wrong exactly the way you would expect: claiming was taken out of the
app and the page went on offering "Claim your listing" to anybody reading it,
which is a promise nobody could keep.

Before calling a feature change done, read the page for anything it now
contradicts:

- the copy in `landing/index.html`, including the footer link list
- the screenshots in `landing/img/`, which are of real screens and go stale
  when those screens change
- the legal pages in `src/data/legal.ts`, which describe the app that exists

This is not a nice-to-have. Everything else in this file is about the app
telling the truth to the person using it; the page is the same app talking to
somebody who has not installed it yet.

## The claim flow was removed, and should not come back

The directory used to let anybody browsing it take over a listing on one tap.
Nothing checked that the business was theirs, and there was nothing that
could have: the app has no way to tell whether the person tapping owns the
shop.

A listing is now worth something precisely because the person who runs the
place put it there. If ownership transfer is ever needed, it is a support
process with evidence behind it, not a button on a page a stranger is
reading.

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

## Errors have to leave the device

A `console.warn` on a phone we do not have is not a bug report, and "it does
not work" was the whole of what we used to get. `reportError(screen, error)`
in `src/lib/errorReporting.ts` sends the message to `client_errors`, where the
console groups it.

Three rules it keeps, and all three matter:

- **It never throws.** Something that reports errors and then fails loudly is
  worse than no reporting.
- **It never blocks.** Every call is fire and forget.
- **It sends a message, not a stack.** A stack from a minified bundle says
  nothing useful and is the field most likely to carry something private that
  was passed into an error.

The grouping is the point. `fingerprint()` strips ids, numbers and quoted
values out of the message before hashing it, so "no row with id 4f2c…" is one
fault rather than five hundred, and the console can show that forty people hit
it rather than that something happened forty times. It is pure and lives in
`src/lib/errors.ts` — separate from the reporting module, because importing
that builds a database client and a test of a hash function should not need a
Supabase project.

Repeats of the same fingerprint are dropped for five minutes. A render loop
throws thousands of times a second, and without that the app would spend the
evening posting the same row.

## The console answers "what is happening", not "what exists"

Counting rows was the whole of the old overview: seven listings, four people.
That is a fact about the database. What somebody opening a moderation console
wants is whether anybody is using it, whether anything is broken, and what
needs them today — so the page opens with the three things waiting on a human,
then use, then the directory, then health.

Two rules carried over from the app and worth restating here:

- **Nothing is estimated.** Every figure comes from `admin_overview()` or
  `admin_daily()`. A plausible-looking number on a console is worse than no
  number, because somebody acts on it. "People who did something" counts
  accounts that opened a listing, because that is what is recorded; there is
  no "opened the app" figure and inventing one would be a measurement that is
  not.
- **Zero is shown, not hidden.** "No listings waiting" is information. A tile
  that disappears is ambiguous between nothing to do and a page that failed.

`admin_activity()` is a union across six tables rather than an events table of
its own. Nothing new is written, so there is no second copy of the truth to
drift out of step, and dropping a source is deleting a branch rather than
migrating rows. It reads and does not act: acting on a listing belongs on
Listings, where the listing and its context are, and a feed with buttons in it
is a place to do things by accident.

## What the console can do that a page of tables cannot

Four things were added because the console is a tool somebody is in for an
hour, not a page they read once:

- **One box that goes anywhere** (`⌘K`, `Ctrl+K`, or `/`). Sections match
  locally and appear instantly; listings and accounts are a debounced query
  and are appended when they land. Picking one opens its section with the
  search already filled in — delivered by remounting the screen with a `key`,
  not by an effect that copies a prop into state.
- **CSV from every table**, of exactly the rows on screen — the filters are
  the query. Everything is quoted and the file starts with a BOM, because a
  business name with a comma in it and an owner who opens files in Excel are
  both the normal case, not the edge one. `toCsv` is in `lib.ts` with tests.
- **Approve all**, on the pending queue, sequentially. Each approval writes an
  audit row and notifies an owner, so a refusal halfway through has to leave a
  half-done queue that says how many landed rather than an unknown number.
- **A link to the page a customer sees** (`/b/<slug>`) on every listing row.
  The console is served from the same origin as the share page, so it is a
  relative link.

`lib.ts` holds the decisions and has no imports; the screens hold the wiring.
Same split as `src/lib/` in the app, for the same reason: the part worth being
sure about should be runnable in a test without a browser or a database.

## Suspension means one thing everywhere

A half suspension — cannot post, but the listings stay up and the reviews
still count towards a rating — is the worst of both: the person is punished
and the damage stays on the site. So it is enforced in four places, all in the
database, and `admin_suspend_account` does all four:

1. **Sign in.** `auth.users.banned_until` is what Supabase itself checks
   before issuing a token. It is the only one of the four that stops somebody
   at the door, and nothing in this schema could do it alone.
2. **Writes.** Every insert and update policy requires a caller who is not
   suspended, so a token issued *before* the suspension is useless.
3. **Reads about them.** Their listings and reviews leave the directory, and
   the ratings they contributed are recomputed without them.
4. **Anything sent to them.** `notify` returns without writing.

Restoring reverses all four by clearing two columns, which is the whole reason
for doing it this way rather than deleting anything. A restored account finds
its work exactly where it left it.

The app still has to be told, because a token already issued keeps working
until it expires: `my_account_state()` is asked once per sign-in, and a yes
ends the session there rather than letting somebody wander a half-working app
finding every action refused.

## Fraud signals are rules, not a model

`assess_account` is a set of named rules, each of which is a thing a person
could check by hand, and each of which records in words what it saw. That
transparency is the design, not a limitation of it. An opaque score that
suspends somebody's business listing is a liability: the person cannot be told
what they did, and nobody internally can tell a false positive from a real
one.

The weights are coarse on purpose. Pretending to two decimal places of
certainty about somebody's honesty would be a lie told in arithmetic.

**No single rule reaches the auto-suspend bar.** Being on a shared device is
not fraud; neither is signing up and reviewing the cafe you are sitting in.
Seven takes at least two independent rules agreeing, usually three. Everything
below the bar waits in a queue for a person, which is where most of these
belong. If you add a rule, keep that property — the moment one signal can
suspend an account on its own, this stops being a queue-ordering device and
becomes a way to remove real businesses by accident.

The device fingerprint is a random value the app generates once and keeps,
hashed with the coarse device model. Deliberately not an advertising id or a
hardware serial: it identifies "the phone Nearby was installed on" and nothing
else, and clearing the app's data resets it. That is a real limitation and the
right trade.

## Deleting an account has to actually delete

`delete_my_account` removes the profile, the reviews, the listings and their
reviews, the saves, the notifications, the reports filed, the recorded events
and the auth row. A right to erasure that leaves the data behind is not one.

Two things worth knowing before changing it:

- **Storage goes first, from the client.** Only a live session satisfies the
  storage policies, and after the auth row is gone there is nobody left who
  may remove the files.
- **Listings go too, and the app says so before asking twice.** There is no
  claim flow any more, so a listing whose owner is gone can never be managed
  by anybody — leaving it would leave an unmaintainable entry naming a real
  business.

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

## Why /admin is a public URL, and what that is worth

Anybody can type `/admin` and reach the sign-in card. That is not a leak, and
hiding the URL would not be a fix. Three things are true at once:

- **The console is a client.** It ships to a browser with the publishable key,
  the same one the app uses. There is nothing secret in the bundle to protect.
- **Signing in is not being an admin.** An ordinary Nearby account can get
  through the sign-in card, and lands on "Not your console" with a sign-out
  button. Every query behind it is refused by `is_admin()` inside the database.
- **A hidden URL is guessed.** `/admin`, `/console`, `/staff` and a hundred
  others are in every scanner's word list, so renaming the path buys a week of
  quiet and costs everyone who has to remember it.

What is actually worth doing, and is done:

- `noindex, nofollow` in the page and as an `X-Robots-Tag`, `Disallow: /admin`
  in `robots.txt`, `Cache-Control: no-store` on `/admin/*`. Not security —
  this is so the console does not turn up in a search for the business name.
- The sign-in card never says whether an address has an account. It shows the
  same "a code is on its way" either way, and logs the real reason. Otherwise
  the page is an oracle for who the admins are.
- No account is created from here: `shouldCreateUser: false`. Without it the
  console is a signup form for the whole project.
- The session closes itself after thirty minutes of nothing, with two minutes
  of warning (`lib.ts`, `useIdleSignOut.ts`). Supabase refreshes a token
  indefinitely, so without this a laptop left open in a café stays signed in
  for a week. This is the one that matters in practice — the realistic way
  somebody who is not an admin ends up in the console is by sitting down at a
  desk where one already is.

If the page really should not be reachable at all, the way to do that is
Vercel deployment protection on the path — Vercel Authentication, or Trusted
IPs — which refuses the request at the edge before any of this loads. That is
a project setting, not code, and it is worth turning on if the console is only
ever opened from known machines. Do not try to reimplement it in the app: a
check that runs after the bundle has been served is a check that has already
served the bundle.

The rule stays the one above: none of this is the boundary. `is_admin()` is.

## Reporting needs no account

The people most likely to notice that a listing is a fake, a duplicate, or a
business that closed two years ago are the people walking past it, and most of
them are not signed in. Requiring an account meant refusing the reports we
most needed, so `report_target` takes an anonymous one.

It is a function rather than an open INSERT policy, because an open insert on
`reports` is a queue anybody can fill. It pins the reporter to the caller — a
signed-in report cannot be attributed to somebody else, an anonymous one
cannot be attributed to anybody — and refuses a second identical open report,
so tapping twice files one thing.

Anonymous reports deliberately do not count towards the `many_reporters` fraud
signal. "Several anonymous reports" is one person tapping a button until
proven otherwise.

## Reporting has to exist for moderation to mean anything

The reports queue was empty by construction until the app grew a way to flag
something. If you add a new kind of moderatable thing, add the affordance that
reports it in the same change — a screen full of controls for a queue nothing
can fill is worse than not having built it.

Reasons are a fixed list, not a text box. A queue of prose takes longer to
triage than it takes to write.

## Updating without a store

Three ways a copy of this app can exist, and each updates differently. Which
one a build is comes from `EXPO_PUBLIC_DISTRIBUTION` at build time, not from
sniffing at runtime — Android does expose the installing package, but not
through any Expo API, and guessing wrong means offering somebody a download
their store will refuse to install over.

- **sideload** (the default, and what the APK workflow produces) fetches the
  next build from the published release and hands it to Android's installer.
- **play** never prompts. Play already updates apps by itself, and Play's own
  in-app update flow needs a native module we do not have.
- **appStore** asks Apple's public lookup what version is live and opens the
  listing. iOS has no in-app install path at all.

**Android's install confirmation cannot be skipped, and should not be.** No
app may install another without the person agreeing. What we remove is
everything before it: no browser, no downloads folder, no hunting for a file.

The prompt is never mandatory. Somebody who opened the app to find a plumber
has not agreed to a 45 MB download first, and a wall they cannot dismiss is
how an app gets deleted. Declining records the version, so the next release
asks again and the same one does not.

The decisions — is this newer, should we look yet, was this one turned down —
are pure functions in `src/lib/updates.ts` with no network in sight, which is
why they have thirty-one tests and the service has none.

## Skeletons are for the first load, and only the essentials

`src/components/Skeleton.tsx`. Two rules, both easy to get wrong:

- **Only when there is genuinely nothing to show.** A refresh keeps whatever
  is on screen. Replacing real listings with grey boxes because a background
  reload started is a downgrade, not a loading state — hence
  `loading && businesses.length === 0` rather than `loading`.
- **Only where content is certain to arrive.** A skeleton is a promise that
  something is coming. Putting one over a section that is empty half the time
  anyway — today's offers, say — promises something that was never on its way.

The same reasoning applies to any text derived from data that has not landed.
"0 businesses open near you" is a false statement during a load, not a neutral
one, so the hero says it is still looking.

## One piece of artwork, seven icons

`assets/source/icon.png` is the only drawing of the mark. Everything else —
the launcher icon, the adaptive foreground, the themed silhouette, the splash
mark, both favicons, the touch icon, the landing page's nav mark and the
social card — is rendered from it by `node scripts/generate-icons.mjs`. Change
the source, re-run the script, commit what falls out. Never hand-edit a file
in `assets/images/` or `landing/img/mark.png`.

Two things about that source shape the script, and would shape a replacement:

- **It is transparent inside the ring as well as outside it.** The white
  circle you see is whatever is behind the file. So compositing the mark onto
  a colour puts that colour inside the ring too, and an orange counter inside
  an orange ring is not a ring. `fillCounter` floods in from the edges and
  fills whatever transparency it could not reach.
- **It is not square and not tightly cropped.** Resizing it as-is centres the
  canvas rather than the mark. It is trimmed and re-padded first.

The mark is orange, so **it needs a light ground**: the adaptive-icon
background and the splash background are white for that reason. They were
orange when the mark was white. If the mark ever changes colour, those two
change with it, or the pin's outline disappears and only the storefront is
left floating.

### sharp does not run calls in the order you write them

This cost two broken renders. `.extend()` chained onto `.resize()` resizes
first and pads second; `.composite()` chained onto `.resize()` shrinks the
canvas before pasting. Both produce either a buffer whose dimensions do not
match what was asked for — read back at the wrong stride, which is a page of
stripes — or an outright "image to composite must have same dimensions or
smaller".

Materialise to a buffer between steps whenever the order matters.

## No dashes in anything a customer reads

No em dash, no en dash, anywhere in a string literal or JSX text under
`src/app`, `src/components` or `src/data`. Rewrite the sentence instead: a
full stop, a comma, a colon or the word "because" will do the job, and the
result is usually shorter.

```ts
// Good
'Optional. One line under your name in search results.'
'No photos yet, add some'
'KSh 350 to 1,200'

// Bad
'Optional — one line under your name in search results'
'No photos yet — add some'
'KSh 350 – 1,200'
```

Ranges are included. An en dash between two numbers is ordinary typography,
but "to" is not worse and the rule stays simple enough that nobody has to
think about it.

**Comments and commit messages are exempt.** The rule is about what a
customer reads, not what a developer reads.

Enforced by `src/lib/__tests__/copy.test.ts`, which strips comments with a
small scanner rather than a regex, because `'https://x'` contains `//` and is
not a comment.

## Legal copy has to describe the app that exists

`src/data/legal.ts`. It had drifted twice over: still telling people they sign
in with a phone number months after that became an email address, and saying
nothing at all about the view and call counts an owner can see, which is
collection that a privacy policy has to disclose.

When you change what the app collects, who can see it, or what we do about a
report, that file changes in the same commit. A policy describing an older
version of the product is worse than none, because somebody relied on it.

## The schema lives in Supabase, not in this repository

Every migration is applied to the hosted project and recorded there, in
`supabase_migrations.schema_migrations`. There is no `supabase/migrations`
directory here, so a clone of this repository is not enough to stand the
database up from nothing — you need the project as well.

That is worth knowing before it matters rather than after. Naming stays
sequential and descriptive (`019_audit_indexes_policies_and_grants`) so the
list reads as a history, and each migration carries its reasoning in comments
for the same reason the code does.

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
