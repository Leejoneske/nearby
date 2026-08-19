/**
 * Everything the app asks the database for.
 *
 * Screens never import this directly — they go through the store, which is
 * still the only thing they know about. This file's job is to turn database
 * rows into the domain types in `src/data/types.ts` and back, so the shape
 * the UI works with does not change just because the storage did.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  AppNotification,
  Business,
  CategoryId,
  NotificationKind,
  Review,
  WeekHours,
} from '../data/types';
import { deviceFingerprint } from './deviceId';
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
  status?: 'live' | 'pending' | 'suspended';
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

export type ReviewAuthor = { name: string; avatar: string | null };

/**
 * @param authors the author's current name and picture by profile id, from
 * `review_authors`.
 *
 * Both are read at fetch time rather than copied on to the review, so
 * changing either changes every review at once. The name used to be the
 * copied one, on the reasoning that a review should read as it did when it
 * was written — which fell apart the first time somebody reviewed a place
 * before setting a name, got stamped "Guest", set their name, and watched the
 * review go on saying Guest for ever.
 *
 * `author_name` on the row is the fallback, and it is the only thing left
 * once the account is gone.
 */
export function toReview(
  row: ReviewRow,
  authors: Map<string, ReviewAuthor> = new Map(),
): Review {
  const author = row.author_id ? authors.get(row.author_id) : undefined;
  const name = author?.name?.trim() || row.author_name;

  return {
    id: row.id,
    authorName: name,
    authorInitials: initials(name),
    authorAvatar: author?.avatar ?? undefined,
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
    status: row.status,
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

/**
 * Listings by slug, wherever they are.
 *
 * The rest of the app works off one page of nearby results, which is right
 * for a directory and wrong for the two lists that are not about proximity.
 * Somewhere past a hundred listings inside the radius, a place you saved in
 * another town stops being in that page, and the Saved tab quietly drops it.
 * This fetches those rows by name instead of hoping they were nearby.
 */
export async function fetchBusinessesBySlugs(
  slugs: string[],
  origin?: Origin,
  viewerId?: string | null,
): Promise<Business[]> {
  if (slugs.length === 0) return [];

  const { data, error } = await supabase
    .from('businesses')
    .select('*, location')
    .in('slug', slugs);
  if (error) throw error;
  return (data ?? []).map((row) => withDistance(row as BusinessRow, origin, viewerId));
}

/** Every listing an account owns, however far away it is. */
export async function fetchOwned(
  profileId: string,
  origin?: Origin,
): Promise<Business[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, location')
    .eq('owner_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => withDistance(row as BusinessRow, origin, profileId));
}

/** A plain select returns the geography column, so distance is worked out here. */
function withDistance(row: BusinessRow, origin?: Origin, viewerId?: string | null): Business {
  const coords = parsePoint(row.location);
  const business = toBusiness({ ...row, lat: coords?.lat, lng: coords?.lng }, { viewerId });
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

  const rows = data as ReviewRow[];
  const authors = await fetchReviewAuthors(rows);
  return rows.map((row) => toReview(row, authors));
}

/**
 * Who wrote a page of reviews, as they are now.
 *
 * A second call rather than a join, because a profile row is readable only by
 * the person it belongs to — it holds their email address and phone number —
 * so joining it returned an answer on your own reviews and on nobody else's.
 * The function hands back the display name and the picture and nothing else.
 */
export async function fetchReviewAuthors(
  rows: { author_id: string | null }[],
): Promise<Map<string, ReviewAuthor>> {
  const ids = Array.from(new Set(rows.map((r) => r.author_id).filter((v): v is string => !!v)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.rpc('review_authors', { in_ids: ids });
  if (error) {
    // The row carries a name to fall back to, so this is not worth failing a
    // page of reviews over.
    console.warn('[api] reading review authors failed', error);
    return new Map();
  }
  return new Map(
    ((data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).map(
      (row) => [row.id, { name: row.name ?? '', avatar: row.avatar_url }],
    ),
  );
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
  description?: string;
  website?: string;
  priceFrom?: number;
  priceTo?: number;
  hours?: WeekHours;
  amenities?: string[];
  photos?: string[];
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
    in_description: input.description ?? '',
    in_website: input.website || null,
    in_price_from: input.priceFrom ?? 0,
    in_price_to: input.priceTo ?? 0,
    in_hours: input.hours ?? [null, null, null, null, null, null, null],
    in_amenities: input.amenities ?? [],
    in_photos: input.photos ?? [],
  });
  if (error) throw error;
  return data as string;
}

/**
 * Flags a listing or a review for somebody to look at.
 *
 * Requires an account: a report names its reporter, and an anonymous flag is
 * both unactionable and trivially spammable.
 */
/**
 * Flags a listing or a review, with or without an account.
 *
 * Through a function rather than an insert, for two reasons. It pins the
 * reporter to the caller, so a signed-in report cannot be attributed to
 * somebody else and an anonymous one cannot be attributed to anybody. And it
 * refuses a second identical open report, so tapping the button twice files
 * one thing rather than two.
 */
export async function createReport(input: {
  targetType: 'business' | 'review';
  targetId: string;
  reason: string;
  detail?: string;
}) {
  const { error } = await supabase.rpc('report_target', {
    in_target_type: input.targetType,
    in_target_id: input.targetId,
    in_reason: input.reason,
    in_detail: input.detail ?? '',
  });
  if (error) throw error;
}

/* ------------------------------------------------------------ accounts --- */

export type AccountState = { suspended: boolean; reason: string | null };

/**
 * Whether this account is still allowed in.
 *
 * A token issued before a suspension keeps working until it expires, so the
 * app has to ask rather than assume. It is a function call rather than a
 * column read because `profiles` is readable only by its owner and this has
 * to answer in the moment where a session exists and the profile has not
 * loaded yet.
 */
export async function fetchAccountState(): Promise<AccountState> {
  const { data, error } = await supabase.rpc('my_account_state');
  if (error) throw error;
  const row = (data ?? {}) as Partial<AccountState>;
  return { suspended: row.suspended === true, reason: row.reason ?? null };
}

/**
 * Deletes the account and everything of it.
 *
 * Storage first, because only this client holds a session the storage
 * policies will accept — after the auth row is gone there is nobody left who
 * may remove the files. A failure there is logged and does not stop the
 * deletion: a leftover image is a smaller wrong than an account somebody
 * asked to be rid of and still has.
 */
export async function deleteMyAccount(userId: string, reason = ''): Promise<void> {
  for (const bucket of ['avatars', 'business-photos'] as const) {
    try {
      const { data } = await supabase.storage.from(bucket).list(userId);
      const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
      if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
    } catch (e) {
      console.warn(`[account] could not clear ${bucket}`, e);
    }
  }

  const { error } = await supabase.rpc('delete_my_account', { in_reason: reason.trim() });
  if (error) throw error;
}

/**
 * Every device that has signed in to this account.
 *
 * The same rows the fraud rules read, shown to the person they are about.
 * Coarse on purpose: a rounded position and a device family, never an IP
 * address or a street. Enough to notice a sign-in from somewhere you have
 * never been, not enough to be a tracking log.
 */
export type KnownDevice = {
  fingerprint: string;
  platform: string;
  country: string;
  lat: number | null;
  lng: number | null;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
};

/**
 * The session this app is running on right now.
 *
 * Read from the client rather than the database: a session is a token held
 * here, and asking the server "which of my sessions is this one" is a
 * question it cannot answer about a bearer token it was merely shown.
 */
export type CurrentSession = {
  email: string | null;
  signedInAt: string | null;
  expiresAt: string | null;
};

export async function fetchCurrentSession(): Promise<CurrentSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const { session } = data;
  return {
    email: session.user.email ?? null,
    signedInAt: session.user.last_sign_in_at ?? null,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

export async function fetchMyDevices(): Promise<KnownDevice[]> {
  const { data, error } = await supabase.rpc('my_devices');
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    fingerprint: String(row.fingerprint ?? ''),
    platform: String(row.platform ?? ''),
    country: String(row.country ?? ''),
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    firstSeen: String(row.first_seen ?? ''),
    lastSeen: String(row.last_seen ?? ''),
    seenCount: Number(row.seen_count ?? 0),
  }));
}

/**
 * Removes a listing the signed-in person owns.
 *
 * The reviews on it go with it, and there is no way back — the database
 * checks the ownership, so a wrong id is refused rather than obeyed.
 */
export async function deleteMyBusiness(businessDbId: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('delete_my_business', {
    in_business_id: businessDbId,
    in_reason: reason.trim(),
  });
  if (error) throw new Error(error.message || 'We could not remove that listing.');
}

/**
 * Tells the database which device this is.
 *
 * The one signal that catches a person running a ring of accounts, because
 * that is one phone with many sign-ins. The position is rounded to two
 * decimal places before it is sent — about a kilometre, which is enough to
 * see that ten accounts are in the same place and not enough to see which
 * building anybody is in.
 */
export async function recordDevice(input: {
  fingerprint: string;
  platform: string;
  lat?: number;
  lng?: number;
}): Promise<void> {
  const { error } = await supabase.rpc('record_device', {
    in_fingerprint: input.fingerprint,
    in_platform: input.platform,
    in_lat: input.lat ?? null,
    in_lng: input.lng ?? null,
    in_country: '',
  });
  if (error) console.warn('[device] could not record this device', error);
}

/**
 * Records that somebody looked at, called, or asked directions to a listing.
 *
 * The platform rides along so the console can tell a fault that is everywhere
 * from one that is only on Android. It is the device family and version, and
 * deliberately nothing that identifies a handset.
 */
export async function recordEvent(
  businessDbId: string,
  kind: 'view' | 'call' | 'directions',
) {
  /*
   * The device rides along so a visit can be counted once.
   *
   * Without it there is nothing to tell one signed-out person opening a
   * listing eight times from eight different people opening it once, and the
   * database has to count each row — which is how one listing came to show
   * nineteen views with one person looking at it. It is the same opaque
   * fingerprint the fraud rules use: no advertising id, nothing that follows
   * anybody between apps.
   */
  const device = await deviceFingerprint().catch(() => '');

  // Fire and forget: a lost count must never interrupt a tap.
  const { error } = await supabase.rpc('record_business_event', {
    in_business_id: businessDbId,
    in_kind: kind,
    in_platform: `${Platform.OS}${Platform.Version ? ` ${Platform.Version}` : ''}`,
    in_device: device,
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


/* ------------------------------------------------------------ profiles --- */

export type ProfileRow = {
  name: string;
  area: string;
  avatar_url: string | null;
  avatar_kind: 'preset' | 'upload' | null;
};

/**
 * The signed-in person's own row.
 *
 * The store never read this, which is why somebody with an account still saw
 * "Guest": the name existed in the database and nothing ever fetched it.
 */
export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, area, avatar_url, avatar_kind')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

/**
 * Saves the parts of a profile a person edits.
 *
 * `area` is NOT NULL in the database, so an undefined here would be sent as
 * null and the whole update refused — which is what made saving a name look
 * like it worked and change nothing. Only keys with a value are sent.
 */
export async function updateProfileRemote(
  id: string,
  patch: { name?: string; area?: string; avatarUrl?: string | null; avatarKind?: 'preset' | 'upload' | null },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.area !== undefined) row.area = patch.area;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (patch.avatarKind !== undefined) row.avatar_kind = patch.avatarKind;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('profiles').update(row).eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------- uploads --- */

/**
 * Puts an image in a bucket and returns the URL to store.
 *
 * The path always starts with the uploader's id, because that is what the
 * storage policy checks. The bucket also caps the size and the type, so a
 * file that got past the app's own check is still refused here.
 *
 * React Native's fetch can read a local file URI into a blob, which is the
 * shortest honest route from a picker result to an upload.
 */
export async function uploadImage(
  bucket: 'avatars' | 'business-photos',
  path: string,
  localUri: string,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, await readBytes(localUri), {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * The bytes behind whatever the image picker handed back.
 *
 * Two paths because there are two kinds of URI. In the browser the picker
 * gives a `blob:` or `data:` URI and `fetch` is the way to read it. On a
 * phone it gives a `file:` URI, which React Native's `fetch` will happily
 * accept and then fail to give an `arrayBuffer` for, so an upload written
 * against the browser path silently produced an empty file. `expo-file-system`
 * reads the file as a file.
 */
async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) {
    return (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
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
