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
