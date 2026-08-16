/**
 * Everything the app asks the database for.
 *
 * Screens never import this directly — they go through the store, which is
 * still the only thing they know about. This file's job is to turn database
 * rows into the domain types in `src/data/types.ts` and back, so the shape
 * the UI works with does not change just because the storage did.
 */
import type {
  AppNotification,
  Business,
  CategoryId,
  NotificationKind,
  Review,
  WeekHours,
} from '../data/types';
import { supabase } from './supabase';

/* ------------------------------------------------------------------ rows -- */

type BusinessRow = {
  id: string;
  slug: string;
  owner_id: string | null;
  name: string;
  category: CategoryId;
  tagline: string;
  description: string;
  price_level: number;
  price_from: number;
  price_to: number;
  address: string;
  neighbourhood: string;
  phone: string | null;
  website: string | null;
  hours: WeekHours;
  amenities: string[];
  photos: string[];
  verified: boolean;
  offer: { label: string; detail: string } | null;
  rating: number | string;
  review_count: number;
  /** Present on the nearby RPC, absent on a plain select. */
  lat?: number;
  lng?: number;
  distance_m?: number;
  location?: unknown;
};

type ReviewRow = {
  id: string;
  business_id: string;
  author_id: string | null;
  author_name: string;
  rating: number;
  body: string;
  owner_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

/* -------------------------------------------------------------- mapping -- */

/** "John Wanderi" → "JW". Kept here so a row maps in one place. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    authorName: row.author_name,
    authorInitials: initials(row.author_name),
    rating: row.rating,
    date: row.created_at.slice(0, 10),
    body: row.body,
    ownerReply: row.owner_reply
      ? { body: row.owner_reply, date: (row.replied_at ?? row.created_at).slice(0, 10) }
      : undefined,
  };
}

export function toBusiness(
  row: BusinessRow,
  extras: { reviews?: Review[]; viewerId?: string | null } = {},
): Business {
  return {
    // The slug is the app's id: stable, readable, and safe in a URL. The uuid
    // travels alongside it because every write needs the primary key.
    id: row.slug,
    dbId: row.id,
    name: row.name,
    categoryId: row.category,
    tagline: row.tagline,
    description: row.description,
    // Postgres returns numeric as a string to avoid precision loss.
    rating: Number(row.rating),
    reviewCount: row.review_count,
    priceLevel: row.price_level,
    priceFrom: row.price_from,
    priceTo: row.price_to,
    address: row.address,
    neighbourhood: row.neighbourhood,
    phone: row.phone ?? '',
    website: row.website ?? undefined,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    distanceM: Math.round(row.distance_m ?? 0),
    photos: row.photos ?? [],
    hours: row.hours,
    amenities: row.amenities ?? [],
    reviews: extras.reviews ?? [],
    ownedByViewer: !!row.owner_id && row.owner_id === extras.viewerId,
    verified: row.verified,
    offer: row.offer ?? undefined,
  };
}

/* ------------------------------------------------------------- queries --- */

export type Origin = { lat: number; lng: number };

/**
 * Businesses within `radiusM` of a point, nearest first.
 *
 * The filtering that needs an index — distance and category — happens in the
 * database. Ranking by rating and price still happens in `lib/search.ts`,
 * because those rules are the product's opinion and belong where they can be
 * tested without a database.
 */
export async function fetchNearby(
  origin: Origin,
  options: {
    radiusM?: number;
    category?: CategoryId | null;
    query?: string;
    limit?: number;
    /** Widen to everywhere when nothing is close. On by default. */
    widenIfEmpty?: boolean;
  } = {},
): Promise<Business[]> {
  const run = async (radius: number) => {
    const { data, error } = await supabase.rpc('businesses_nearby', {
      in_lat: origin.lat,
      in_lng: origin.lng,
      in_radius_m: radius,
      in_category: options.category ?? null,
      in_query: options.query ?? null,
      in_limit: options.limit ?? 100,
    });
    if (error) throw error;
    return (data as BusinessRow[]).map((row) => toBusiness(row));
  };

  const rows = await run(options.radiusM ?? 25_000);
  if (rows.length > 0 || options.widenIfEmpty === false) return rows;

  /*
   * Nothing within the radius. Rather than an empty screen, widen to the
   * whole world and show the nearest anyway — a directory with two entries
   * on another continent is still more use than "no results", and the
   * distance shown tells the truth about how far away they are.
   *
   * EARTH_M is half the planet's circumference, so the search cannot miss.
   */
  const EARTH_M = 20_100_000;
  return run(EARTH_M);
}

/** One listing with its reviews, by slug. */
export async function fetchBusiness(
  slug: string,
  origin?: Origin,
  viewerId?: string | null,
): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, location')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const reviews = await fetchReviews(data.id);

  // A plain select returns the geography column, not lat/lng, so distance is
  // worked out here rather than asking the database for a second round trip.
  const row = data as BusinessRow;
  const coords = parsePoint(row.location);
  const business = toBusiness(
    { ...row, lat: coords?.lat, lng: coords?.lng },
    { reviews, viewerId },
  );
  if (origin && coords) business.distanceM = Math.round(haversine(origin, coords));
  return business;
}

export async function fetchReviews(businessId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReviewRow[]).map(toReview);
}

export async function fetchSavedIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_businesses')
    .select('business_id, businesses(slug)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // PostgREST types an embedded relation as an array even when it is to-one.
  return (data ?? [])
    .map((row) => {
      const joined = row.businesses as unknown as { slug: string } | { slug: string }[] | null;
      if (!joined) return undefined;
      return Array.isArray(joined) ? joined[0]?.slug : joined.slug;
    })
    .filter((slug): slug is string => !!slug);
}

export async function setSaved(profileId: string, businessDbId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase
      .from('saved_businesses')
      .upsert({ profile_id: profileId, business_id: businessDbId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('saved_businesses')
      .delete()
      .eq('profile_id', profileId)
      .eq('business_id', businessDbId);
    if (error) throw error;
  }
}

export async function createReview(input: {
  businessDbId: string;
  authorId: string;
  authorName: string;
  rating: number;
  body: string;
}) {
  const { error } = await supabase.from('reviews').insert({
    business_id: input.businessDbId,
    author_id: input.authorId,
    author_name: input.authorName,
    rating: input.rating,
    body: input.body,
  });
  if (error) throw error;
}

/** Goes through the function that checks the caller owns the business. */
export async function replyToReviewRemote(reviewId: string, body: string) {
  const { error } = await supabase.rpc('reply_to_review', {
    in_review_id: reviewId,
    in_body: body,
  });
  if (error) throw error;
}

export async function updateBusinessRemote(dbId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('businesses').update(patch).eq('id', dbId);
  if (error) throw error;
}

/**
 * Lists a new business owned by whoever is signed in. Returns its slug.
 *
 * The slug is generated in the database rather than here: it has to be unique
 * across every listing, and only the database can check that without a race.
 */
export async function createBusinessRemote(input: {
  name: string;
  category: CategoryId;
  tagline: string;
  address: string;
  neighbourhood: string;
  phone: string;
  lat: number;
  lng: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_business', {
    in_name: input.name,
    in_category: input.category,
    in_tagline: input.tagline,
    in_address: input.address,
    in_neighbourhood: input.neighbourhood,
    in_phone: input.phone,
    in_lat: input.lat,
    in_lng: input.lng,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Takes over a listing that nobody manages yet.
 *
 * The database refuses this when the listing already belongs to somebody
 * else, and leaves `verified` false either way — a claim is a request to
 * manage, not proof of ownership.
 */
export async function claimBusinessRemote(slug: string): Promise<void> {
  const { error } = await supabase.rpc('claim_business', { in_slug: slug });
  if (error) throw error;
}

/**
 * Flags a listing or a review for somebody to look at.
 *
 * Requires an account: a report names its reporter, and an anonymous flag is
 * both unactionable and trivially spammable.
 */
export async function createReport(input: {
  targetType: 'business' | 'review';
  targetId: string;
  reporterId: string;
  reason: string;
  detail?: string;
}) {
  const { error } = await supabase.from('reports').insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reporter_id: input.reporterId,
    reason: input.reason,
    detail: input.detail ?? '',
  });
  if (error) throw error;
}

/** Records that somebody looked at, called, or asked directions to a listing. */
export async function recordEvent(
  businessDbId: string,
  kind: 'view' | 'call' | 'directions',
) {
  // Fire and forget: a lost analytics event must never interrupt a tap.
  const { error } = await supabase.rpc('record_business_event', {
    in_business_id: businessDbId,
    in_kind: kind,
  });
  if (error) console.warn('[api] recording an event failed', error);
}

export type Insights = {
  viewsThisWeek: number;
  viewsLastWeek: number;
  callsThisWeek: number;
  directionsThisWeek: number;
  searchAppearances: number;
};

/** Counts for a listing. The database refuses this unless you own it. */
export async function fetchInsights(businessDbId: string): Promise<Insights | null> {
  const { data, error } = await supabase
    .rpc('business_insights', { in_business_id: businessDbId })
    .maybeSingle();
  if (error) {
    console.warn('[api] loading insights failed', error);
    return null;
  }
  if (!data) return null;
  const row = data as Record<string, number>;
  return {
    viewsThisWeek: row.views_this_week ?? 0,
    viewsLastWeek: row.views_last_week ?? 0,
    callsThisWeek: row.calls_this_week ?? 0,
    directionsThisWeek: row.directions_this_week ?? 0,
    searchAppearances: row.search_appearances ?? 0,
  };
}

export async function fetchNotifications(profileId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, businesses(slug)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const joined = row.businesses as unknown as { slug: string } | { slug: string }[] | null;
    const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
    return {
      id: row.id as string,
      kind: row.kind as NotificationKind,
      title: row.title as string,
      body: row.body as string,
      date: (row.created_at as string).slice(0, 10),
      read: row.read as boolean,
      businessId: slug,
    };
  });
}

export async function markNotificationReadRemote(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

/* --------------------------------------------------------------- geo ----- */

/** PostgREST hands back a geography column as WKB hex or GeoJSON. */
function parsePoint(value: unknown): Origin | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'coordinates' in value) {
    const coords = (value as { coordinates: [number, number] }).coordinates;
    return { lng: coords[0], lat: coords[1] };
  }
  return null;
}

function haversine(a: Origin, b: Origin): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
