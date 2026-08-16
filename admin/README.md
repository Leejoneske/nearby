# The console

The moderation and oversight screens, served at `/admin` on the same domain as
the landing page. Vercel builds it as part of the site deploy; there is no
separate project to keep in step.

## What actually protects it

Not this app. Every read and every write is refused by Postgres for anybody
without a row in `public.admins`, checked by `is_admin()` inside each policy
and each function. Finding the URL gets you a sign-in box and nothing else;
signing in as an ordinary Nearby user gets you a page saying so.

That ordering is the point. A console that hides its buttons from
non-admins is a console that can be bypassed with `curl`. This one cannot,
because the buttons were never what was stopping you.

There is **no service role key here and there must never be one.** It bypasses
every policy, and anything shipped to a browser is readable by whoever opens
the page.

## Adding the first admin

Deliberately manual. There is no INSERT policy on `admins`, so no amount of
clicking anywhere makes somebody an admin — it takes SQL, run by whoever holds
the database.

The account must exist in `auth.users` first, which means signing in through
the app or the console once. Then, in the Supabase SQL editor:

```sql
insert into public.admins (id, note)
select id, 'first admin'
from auth.users
where email = 'you@example.com'
on conflict (id) do nothing;
```

Check it took:

```sql
select u.email, a.added_at from public.admins a join auth.users u on u.id = a.id;
```

To remove somebody, `delete from public.admins where id = '…'`. Their listings
and reviews are untouched; they simply stop being an admin.

## Signing in when email is not working

The code is emailed by Supabase, which needs an SMTP provider configured. If
that is not set up yet, the console also takes a password, so it does not
depend on the thing it might be needed to fix.

Create the account in the Supabase dashboard under **Authentication → Users →
Add user**, with a password and "auto confirm" on. Then add the `admins` row
above and sign in with **Use a password instead**.

## What it can do

| Screen    | Actions |
|-----------|---------|
| Overview  | Counts, and the full log of every change made here |
| Listings  | Verify / unverify, suspend / restore, search and filter |
| Reviews   | Remove a review, with the reason recorded |
| Reports   | Work the queue: actioned or dismissed |
| People    | Read-only list of accounts |

Suspending hides a listing from search, the map and its own page for everybody
except its owner and admins. It is a status change, never a delete — a deleted
row takes its reviews and its history with it, and "why did this disappear" is
a question that gets asked later.

Every write goes through a function that records who did it in
`admin_actions`. That log is on the Overview screen and cannot be written to
directly.

## Why People is read-only

Suspending a person touches their reviews, their saved places and anything
they manage, and none of those rules are written yet. Shipping the button
before the rules exist is how somebody gets removed by accident. Listings are
the lever that exists today.

## Running it locally

```sh
npm --prefix admin install
npm --prefix admin run dev
```

It reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` from the
repository's `.env`, so it points at the same project as the app with nothing
extra to configure. Setting `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`
overrides that.
