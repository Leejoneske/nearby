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
  listings_suspended: number;
  listings_unverified: number;
  listings_unclaimed: number;
  listings_new_week: number;
  people: number;
  people_new_week: number;
  reviews_total: number;
  reviews_new_week: number;
  reports_open: number;
};

export type AdminBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  neighbourhood: string;
  address: string;
  phone: string | null;
  status: BusinessStatus;
  verified: boolean;
  owner_id: string | null;
  claimed_at: string | null;
  rating: number | string;
  review_count: number;
  created_at: string;
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
  created_at: string;
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
      'id, slug, name, category, neighbourhood, address, phone, status, verified, ' +
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

export async function fetchPeople(): Promise<AdminPerson[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, area, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AdminPerson[];
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
