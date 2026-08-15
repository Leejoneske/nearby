# Nearby

A business directory for phones — the Google Business Profile idea, built as a
real native app. People find businesses around them by search, category or map;
owners claim their listing and run it themselves.

One codebase, both stores: Expo / React Native builds an `.aab` for Google Play
and an `.ipa` for the App Store, and the same screens render in a browser for
review.

## Running it

```bash
npm install
npm start          # dev server; scan the QR with Expo Go
npm run android    # Android emulator or a connected device
npm run ios        # iOS simulator (needs macOS)
npm run web        # browser, for a quick look
```

```bash
npm test           # 55 unit tests over the logic layer
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate app icons from the vector mark
```

## What is real and what is not

Everything you can tap is built. What sits behind it is not yet a server.

| Real | Placeholder |
| --- | --- |
| All screens, navigation, filtering, sorting, search ranking, opening-hours logic | Listings come from `src/data/businesses.ts`, not an API |
| Owner dashboard, listing editor, review replies, the claim flow | Nothing persists across an app restart |
| Native map with real coordinates and styling | Photos are generated from the category, not uploaded |
| Distance, price, rating and date formatting | Verification codes are not actually sent |

## Landing page

`landing/` is a plain static site — no build step, no dependencies. Open
`landing/index.html` in a browser, or drop the folder on any host:

```bash
npx serve landing              # local preview
node landing/build-inline.mjs  # one self-contained HTML file, for sharing
```

Screenshots in it come from `landing/img/`, exported from the real app. Two
things to change before it goes live:

- The App Store and Google Play buttons are marked "coming soon" and link
  nowhere. Swap in the real URLs, and replace the buttons with Apple's and
  Google's official badge artwork — their brand guidelines require it.
- The social links and Privacy in the footer are `#` placeholders.

State lives in one React context (`src/lib/store.tsx`). Its mutations —
`updateBusiness`, `addBusiness`, `replyToReview` — are the shape the API calls
will take, so wiring a backend is a change to that one file rather than to
every screen.

## Structure

```
src/
  app/                  routes (expo-router: the file tree is the navigation)
    (tabs)/             Home, Saved, Map, Recent, Profile
    business/[id]       public listing page
    owner/              dashboard, listing editor, review replies
    owner/claim         add or claim a business
    search              results list with filters
  components/           shared UI, all styled from the tokens
  data/                 domain types, categories, seed listings
  lib/                  the decision layer — search, hours, formatting, store
  theme/tokens.ts       every colour, space, radius and type size
```

Two rules keep this from drifting:

**Nothing hardcodes a colour or a spacing.** They all come from
`theme/tokens.ts`. A raw hex in a screen is how two lists end up with subtly
different row heights.

**Decisions live outside the components.** Whether a shop is open, how results
rank, how a distance reads — all of it is in `src/lib/`, pure and free of React.
That is why there are tests: the interesting behaviour does not need a renderer
to check. Anything with a rule worth arguing about belongs there, not in a
screen.

## The map

`react-native-maps` draws the real map on device — Google Maps on Android,
Apple Maps on iOS. It has no web implementation, so `MapCanvas.web.tsx` stands
in for the browser: it projects latitude and longitude with the same maths, so
pin positions are honest, but the roads and parks under them are decoration.

Android needs a Maps API key before the map will render in a build. Replace
`REPLACE_WITH_ANDROID_MAPS_API_KEY` in `app.json` with a key from the Google
Cloud console. iOS needs nothing.

## Web build

`app.json` sets `web.output` to `single` — a plain client-rendered SPA.

Static rendering was the default and had to go. The app prints things that
depend on the current moment ("Open · closes 9 PM", "10 businesses open near
you"), which the server computes at build time and the browser computes at page
load. When those disagree React abandons hydration, leaving the pre-rendered
tab bar stacked on top of the live one — icons vanish and the active tab sticks
on Home. None of it touches iOS or Android, which never server-render, but the
browser is how this gets reviewed, so the browser has to be right.

## Shipping to the stores

Builds go through EAS, which does not need a Mac for either platform:

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
npx eas submit --platform android
npx eas submit --platform ios
```

Before the first submission:

- Apple Developer Program membership ($99/year) and App Store Connect record
- Google Play Developer account ($25 once)
- The Android Maps API key above
- Bundle identifier and package name are both `app.nearby.directory` — change
  them in `app.json` if you own a different domain

## Next

The backend is the gap. Postgres with PostGIS handles "businesses near me"
properly, and the schema is already described by `src/data/types.ts`. After
that: photo upload, real verification, and push notifications when a review
lands.
