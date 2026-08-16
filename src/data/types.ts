/** Domain types for Nearby. */

export type CategoryId =
  | 'restaurant'
  | 'cafe'
  | 'beauty'
  | 'shopping'
  | 'auto'
  | 'health'
  | 'fitness'
  | 'hotel'
  | 'services'
  | 'nightlife';

export type Category = {
  id: CategoryId;
  label: string;
  /** Ionicons glyph name. */
  icon: string;
};

/** Minutes from midnight, local to the business. `null` closed that day. */
export type DayHours = { open: number; close: number } | null;

/** Index 0 is Sunday, to line up with Date#getDay. */
export type WeekHours = [
  DayHours,
  DayHours,
  DayHours,
  DayHours,
  DayHours,
  DayHours,
  DayHours,
];

export type Review = {
  id: string;
  authorName: string;
  authorInitials: string;
  rating: number;
  /** ISO date. */
  date: string;
  body: string;
  /** Owner's public reply, when they have written one. */
  ownerReply?: { body: string; date: string };
};

export type Business = {
  /** The slug — stable, readable, and what routes use. */
  id: string;
  /** Database primary key. Needed for every write; never shown. */
  dbId?: string;
  name: string;
  categoryId: CategoryId;
  /** Free-text descriptor under the name, e.g. "Specialty coffee roaster". */
  tagline: string;
  description: string;
  rating: number;
  reviewCount: number;
  /** 1–4, rendered as $–$$$$. */
  priceLevel: number;
  /** Typical spend, in the local currency, for the price-range row. */
  priceFrom: number;
  priceTo: number;
  address: string;
  neighbourhood: string;
  phone: string;
  website?: string;
  lat: number;
  lng: number;
  /** Metres from the viewer. Precomputed in mock data. */
  distanceM: number;
  photos: string[];
  hours: WeekHours;
  amenities: string[];
  reviews: Review[];
  /** Set when the signed-in user owns this listing. */
  ownedByViewer?: boolean;
  /** Verified via the claim flow. */
  verified?: boolean;
  /** Promotion shown in the "Today's offers" rail. */
  offer?: { label: string; detail: string };
};

/** Why a notification was sent. Drives its icon and where tapping it goes. */
export type NotificationKind = 'review' | 'reply' | 'offer' | 'listing';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO date. */
  date: string;
  read: boolean;
  /** Set when tapping should open a business. */
  businessId?: string;
};

/**
 * Who is signed in.
 *
 * `loading` exists so a screen can tell "signed out" apart from "we have not
 * checked yet". Against a real backend that check is a network round trip,
 * and flashing a signed-out screen during it is a flicker every user notices.
 */
export type Session = {
  status: 'loading' | 'signedIn' | 'signedOut';
  phone: string | null;
};

export type SortKey = 'relevance' | 'rating' | 'distance' | 'priceLow';

export type Filters = {
  sort: SortKey;
  /** Selected price levels; empty means any. */
  priceLevels: number[];
  /** Max distance in metres; null means any. */
  radiusM: number | null;
  openNow: boolean;
  categoryId: CategoryId | null;
  /** Minimum rating; null means any. */
  minRating: number | null;
};

export const DEFAULT_FILTERS: Filters = {
  sort: 'relevance',
  priceLevels: [],
  radiusM: null,
  openNow: false,
  categoryId: null,
  minRating: null,
};
