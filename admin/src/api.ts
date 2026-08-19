/**
 * Everything the console asks the database for.
 *
 * Same split as the app: one file knows Supabase exists, the screens do not.
 * Reads are plain queries — the admin read policies already widen what comes
 * back — and every write is an RPC, because each one records who did it.
 */
import { supabase } from './supabase';

export type BusinessStatus = 'live' | 'pending' | 'suspended';
export type ReportState = 'open' | 'actioned' | 'dismissed';

export type Overview = {
  listings_live: number;
  listings_pending: number;
  listings_suspended: number;
  listings_unverified: number;
  listings_unclaimed: number;
  listings_new_week: number;
  people: number;
  people_new_week: number;
  people_active_week: number;
  people_suspended: number;
  people_flagged: number;
  reviews_total: number;
  reviews_new_week: number;
  reviews_unanswered: number;
  rating_average: number | string | null;
  reports_open: number;
  views_week: number;
  calls_week: number;
  directions_week: number;
  errors_week: number;
  errors_people_week: number;
  notifications_unread: number;
};

/** One line in the unified feed. Every source is folded into this shape. */
export type ActivityKind =
  | 'listing'
  | 'review'
  | 'reply'
  | 'person'
  | 'report'
  | 'admin'
  | 'error';

export type Activity = {
  at: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  target_id: string | null;
  target_name: string | null;
};

export type ErrorGroup = {
  fingerprint: string;
  message: string;
  screen: string;
  occurrences: number;
  people: number;
  platforms: string | null;
  versions: string | null;
  first_seen: string;
  last_seen: string;
};

export type DailyRow = {
  day: string;
  views: number;
  calls: number;
  directions: number;
  reviews: number;
  listings: number;
  people: number;
  errors: number;
};

export type PersonDetail = {
  profile: { id: string; name: string | null; email: string | null; area: string | null; created_at: string; avatar_url: string | null };
  listings: { id: string; slug: string; name: string; status: BusinessStatus; verified: boolean; rating: number | string; review_count: number; created_at: string }[];
  reviews: { id: string; business: string; rating: number; body: string; created_at: string }[];
  saved_count: number;
  reports_filed: number;
  errors: { message: string; screen: string; platform: string; app_version: string; created_at: string }[];
  last_seen: string | null;
  platforms: string;
};

export type AdminBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  neighbourhood: string;
  address: string;
  phone: string | null;
  website: string | null;
  price_from: number;
  price_to: number;
  photos: string[];
  status: BusinessStatus;
  verified: boolean;
  owner_id: string | null;
  claimed_at: string | null;
  rating: number | string;
  review_count: number;
  created_at: string;
};

/** The columns `admin_update_business` will take. */
export type BusinessEdit = {
  name: string;
  category: string;
  tagline: string;
  description: string;
  address: string;
  neighbourhood: string;
  phone: string;
  website: string;
  price_from: number;
  price_to: number;
  photos: string[];
};

export type AdminReview = {
  id: string;
  business_id: string;
  author_name: string;
  rating: number;
  body: string;
  owner_reply: string | null;
  created_at: string;
  businesses: { name: string; slug: string } | null;
};

export type AdminReport = {
  id: string;
  target_type: 'business' | 'review';
  target_id: string;
  reason: string;
  detail: string;
  state: ReportState;
  created_at: string;
  resolved_at: string | null;
};

export type AdminPerson = {
  id: string;
  name: string | null;
  email: string | null;
  area: string | null;
  avatar_url: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  is_admin: boolean;
  listings: number;
  reviews: number;
  reports_against: number;
  fraud_score: number;
  signals: string | null;
  devices: number;
  last_seen: string | null;
};

export type AccountState = 'all' | 'active' | 'suspended' | 'flagged';

/** Accounts sharing one device, which is the signal worth seeing as a group. */
export type DeviceRing = {
  fingerprint: string;
  accounts: number;
  names: string;
  platforms: string | null;
  places: string | null;
  last_seen: string;
};

export type AdminAction = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

/** Whether the signed-in account is an admin. False for everybody else. */
export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.warn('[admin] the admin check failed', error);
    return false;
  }
  return data === true;
}

export async function fetchOverview(): Promise<Overview> {
  const { data, error } = await supabase.rpc('admin_overview').single();
  if (error) throw error;
  return data as Overview;
}

export async function fetchBusinesses(options: {
  query?: string;
  status?: BusinessStatus | 'all';
  unverifiedOnly?: boolean;
  unclaimedOnly?: boolean;
} = {}): Promise<AdminBusiness[]> {
  let q = supabase
    .from('businesses')
    .select(
      'id, slug, name, category, tagline, description, neighbourhood, address, phone, ' +
        'website, price_from, price_to, photos, status, verified, ' +
        'owner_id, claimed_at, rating, review_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (options.status && options.status !== 'all') q = q.eq('status', options.status);
  if (options.unverifiedOnly) q = q.eq('verified', false);
  if (options.unclaimedOnly) q = q.is('owner_id', null);

  const term = options.query?.trim();
  if (term) {
    // PostgREST needs the commas escaped or they end the or() list.
    const safe = term.replace(/[,()]/g, ' ');
    q = q.or(`name.ilike.%${safe}%,neighbourhood.ilike.%${safe}%,address.ilike.%${safe}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  // The generated row type widens once `.or()` is in play, so the cast goes
  // through `unknown`. The shape is pinned by the select list above.
  return (data ?? []) as unknown as AdminBusiness[];
}

/**
 * Everything that happened, newest first.
 *
 * One call rather than six, because an admin trying to understand a morning
 * should not have to line five screens up by eye.
 */
export async function fetchActivity(
  options: { kinds?: ActivityKind[]; days?: number; limit?: number } = {},
): Promise<Activity[]> {
  const since =
    options.days === undefined
      ? null
      : new Date(Date.now() - options.days * 86_400_000).toISOString();

  const { data, error } = await supabase.rpc('admin_activity', {
    in_kinds: options.kinds && options.kinds.length > 0 ? options.kinds : null,
    in_since: since,
    in_limit: options.limit ?? 200,
  });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

/** Errors grouped by what they are, because a hundred of one is one problem. */
export async function fetchErrorGroups(days = 7): Promise<ErrorGroup[]> {
  const { data, error } = await supabase.rpc('admin_error_groups', { in_days: days });
  if (error) throw error;
  return (data ?? []) as ErrorGroup[];
}

/** Daily counts, with the quiet days present as zero rather than missing. */
export async function fetchDaily(days = 30): Promise<DailyRow[]> {
  const { data, error } = await supabase.rpc('admin_daily', { in_days: days });
  if (error) throw error;
  return (data ?? []) as DailyRow[];
}

/** Everything one account has done. */
export async function fetchPerson(id: string): Promise<PersonDetail> {
  const { data, error } = await supabase.rpc('admin_person', { in_profile_id: id });
  if (error) throw error;
  return data as PersonDetail;
}

export async function fetchReviews(options: { unansweredOnly?: boolean } = {}) {
  let q = supabase
    .from('reviews')
    .select(
      'id, business_id, author_name, rating, body, owner_reply, created_at, businesses(name, slug)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (options.unansweredOnly) q = q.is('owner_reply', null);

  const { data, error } = await q;
  if (error) throw error;
  // An embedded to-one relation is typed as an array by PostgREST.
  return (data ?? []).map((row) => {
    const joined = row.businesses as unknown as
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
    return {
      ...row,
      businesses: Array.isArray(joined) ? (joined[0] ?? null) : joined,
    } as AdminReview;
  });
}

export async function fetchReports(state: ReportState | 'all' = 'open') {
  let q = supabase
    .from('reports')
    .select('id, target_type, target_id, reason, detail, state, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (state !== 'all') q = q.eq('state', state);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AdminReport[];
}

/**
 * Accounts, with their state and their score.
 *
 * An RPC rather than a select, because the table now needs the suspension,
 * the fraud signals and four counts per row — and doing that from a plain
 * select is one query to list them and one per row to fill them in.
 *
 * The order is the queue: flagged and not yet suspended first, worst score at
 * the top, then newest. What an admin opens this page to find is the thing
 * nobody has looked at yet.
 */
export async function fetchPeople(
  options: { query?: string; state?: AccountState } = {},
): Promise<AdminPerson[]> {
  const { data, error } = await supabase.rpc('admin_accounts', {
    in_query: options.query?.trim() || null,
    in_state: options.state ?? 'all',
    in_limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as AdminPerson[];
}

export async function fetchDeviceRings(): Promise<DeviceRing[]> {
  const { data, error } = await supabase.rpc('admin_device_rings', { in_min: 2 });
  if (error) throw error;
  return (data ?? []) as DeviceRing[];
}

/**
 * Suspends an account, entirely.
 *
 * Not a soft block. They cannot sign in, their token stops being able to
 * write, their listings and reviews leave the directory, and nothing is sent
 * to them. Restoring puts all four back.
 */
export async function suspendAccount(id: string, reason: string) {
  const { error } = await supabase.rpc('admin_suspend_account', {
    in_profile_id: id,
    in_reason: reason,
  });
  if (error) throw error;
}

export async function restoreAccount(id: string) {
  const { error } = await supabase.rpc('admin_restore_account', { in_profile_id: id });
  if (error) throw error;
}

/** Clears the fraud flags on an account somebody has decided is fine. */
export async function clearSignals(id: string, note = '') {
  const { error } = await supabase.rpc('admin_clear_signals', {
    in_profile_id: id,
    in_note: note,
  });
  if (error) throw error;
}

export async function fetchActions(): Promise<AdminAction[]> {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('id, action, target_type, target_id, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AdminAction[];
}

/* ------------------------------------------------------------- writes -- */

export async function setBusinessStatus(id: string, status: BusinessStatus, note = '') {
  const { error } = await supabase.rpc('admin_set_business_status', {
    in_business_id: id,
    in_status: status,
    in_note: note,
  });
  if (error) throw error;
}

/**
 * Approves a listing somebody submitted, or turns it down.
 *
 * The note is not paperwork. A decline sends it to the owner as the reason,
 * and a decline with no reason is one they cannot act on.
 */
export async function reviewListing(id: string, approve: boolean, note = '') {
  const { error } = await supabase.rpc('admin_review_listing', {
    in_business_id: id,
    in_approve: approve,
    in_note: note,
  });
  if (error) throw error;
}

export async function updateBusiness(id: string, patch: BusinessEdit) {
  const { error } = await supabase.rpc('admin_update_business', {
    in_business_id: id,
    in_name: patch.name,
    in_category: patch.category,
    in_tagline: patch.tagline,
    in_description: patch.description,
    in_address: patch.address,
    in_neighbourhood: patch.neighbourhood,
    in_phone: patch.phone,
    in_website: patch.website || null,
    in_price_from: patch.price_from,
    in_price_to: patch.price_to,
    in_photos: patch.photos,
  });
  if (error) throw error;
}

/**
 * Removes a listing for good, along with its reviews and its history.
 *
 * Suspending is almost always the right answer instead. This exists for the
 * cases where the row should never have been there: a duplicate, or a test.
 */
export async function deleteBusiness(id: string, reason = '') {
  const { error } = await supabase.rpc('admin_delete_business', {
    in_business_id: id,
    in_reason: reason,
  });
  if (error) throw error;
}

export async function setVerified(id: string, verified: boolean) {
  const { error } = await supabase.rpc('admin_set_verified', {
    in_business_id: id,
    in_verified: verified,
  });
  if (error) throw error;
}

export async function removeReview(id: string, reason = '') {
  const { error } = await supabase.rpc('admin_remove_review', {
    in_review_id: id,
    in_reason: reason,
  });
  if (error) throw error;
}

export async function resolveReport(id: string, state: 'actioned' | 'dismissed', note = '') {
  const { error } = await supabase.rpc('admin_resolve_report', {
    in_report_id: id,
    in_state: state,
    in_note: note,
  });
  if (error) throw error;
}
