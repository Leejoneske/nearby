/**
 * App state, backed by Supabase.
 *
 * The surface screens use has not changed — they still call `useStore()` and
 * get listings, saved ids and mutations. What changed is where the data comes
 * from. Anything that talks to the network lives in `lib/api.ts`; this file
 * decides what to hold in memory and when to reload it.
 *
 * Two rules worth keeping:
 *
 *   Reading is public. Browsing, searching and reading reviews all work with
 *   nobody signed in, because most people arrive without an account and a
 *   sign-in wall in front of a directory is how they leave.
 *
 *   Writing needs a session. Saving, reviewing and editing a listing all go
 *   through row level security, so the client cannot fake its way past them
 *   even if this file were wrong.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { DEFAULT_AREA, DEFAULT_CITY } from '../data/location';
import type { AppNotification, Business, NewBusiness, Review, Session } from '../data/types';
import * as api from './api';
import { initialsOf } from './format';
import { cleanDisplayName } from './identity';
import { deviceFingerprint } from './deviceId';
import { reportError } from './errorReporting';
import { buildTaste, recommend, type Recommendation } from './recommend';
import { supabase } from './supabase';
import { useOrigin } from './useOrigin';

/** What you looked at, kept on the device. Twenty is a page of scrolling. */
const RECENT_KEY = 'nearby.recent.v1';
const RECENT_LIMIT = 20;

/*
 * What you searched for, also kept on the device.
 *
 * A search is the clearest statement of intent anybody makes in this app, and
 * it was the one signal being thrown away. Ten is plenty: the recommender
 * fades them fast, and a longer history is a longer record of somebody's
 * business for no gain.
 */
const QUERY_KEY = 'nearby.queries.v1';
const QUERY_LIMIT = 10;

export type Viewer = {
  name: string;
  initials: string;
  email: string;
  city: string;
  area: string;
  verified: boolean;
  /** A preset reference or an uploaded file's URL. Undefined means initials. */
  avatar?: string;
};

const GUEST: Viewer = {
  name: 'Guest',
  initials: 'G',
  email: '',
  city: DEFAULT_CITY,
  area: DEFAULT_AREA,
  verified: false,
};

type StoreValue = {
  businesses: Business[];
  /** True while the first load is in flight, so lists can say so. */
  loading: boolean;
  /** Set when the last load failed, so a screen can offer to retry. */
  error: string | null;
  refresh: () => Promise<void>;
  /** True once distances are measured from the device rather than the city. */
  locationPrecise: boolean;
  /** Where "near you" is measured from. The map centres here. */
  origin: { lat: number; lng: number };

  /** Loads the reviews for one listing, which lists do not carry. */
  loadDetail: (id: string) => Promise<void>;
  recordEvent: (dbId: string, kind: 'view' | 'call' | 'directions') => void;

  viewer: Viewer;
  session: Session;
  /** The signed in account's id, or null. Storage paths are named after it. */
  userId: string | null;
  signOut: () => Promise<void>;
  /** Saves a profile edit. Resolves when stored, throws with a reason. */
  updateViewer: (patch: Partial<Viewer>) => Promise<void>;
  /** True once the profile row has been read, so onboarding can wait. */
  profileLoaded: boolean;
  /**
   * True when somebody is signed in and we still do not know their name.
   *
   * A new account is created with an empty name, so this is the whole of the
   * onboarding question: it is set for a first sign in and for anybody who
   * made an account before there was anywhere to type one.
   */
  needsName: boolean;

  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  /** Re-reads the list from the database. */
  refreshNotifications: () => Promise<void>;
  /** A notification that arrived just now, for the banner over the app. */
  incoming: AppNotification | null;
  dismissIncoming: () => void;

  /**
   * The reason this account was suspended, if it was. Empty string means
   * suspended with no reason recorded; null means not suspended.
   */
  suspension: string | null;
  clearSuspension: () => void;
  /** Removes the account and everything of it. Throws with a reason. */
  deleteAccount: () => Promise<void>;

  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;

  recentIds: string[];
  markViewed: (id: string) => void;

  /** What was searched for, newest first. Never leaves the device. */
  recentQueries: string[];
  recordSearch: (query: string) => void;
  /** Places worth putting in front of this person, with a reason each. */
  recommendations: Recommendation[];

  getBusiness: (id: string) => Business | undefined;
  ownedBusinesses: Business[];

  /** Flags a listing for review. Throws if refused; sends you to sign in. */
  reportBusiness: (id: string, reason: string) => Promise<void>;
  /** Saves a listing edit. Resolves when stored, throws with a reason. */
  updateBusiness: (id: string, patch: Partial<Business>) => Promise<void>;
  /** Lists a new business. Resolves to its id, or throws with a reason. */
  addBusiness: (input: NewBusiness) => Promise<string>;
  /** Answers a review as the owner. Resolves when stored, throws otherwise. */
  replyToReview: (businessId: string, reviewId: string, body: string) => Promise<void>;
  /** Posts a review. Resolves when stored, throws with a reason. */
  addReview: (businessId: string, review: Review) => Promise<void>;
};

/**
 * Thrown when a write needs an account and there is not one.
 *
 * The store has already sent them to sign in by the time this lands, so a
 * screen catching it should close quietly rather than showing an error on top
 * of the sign-in page.
 */
export class NeedsAccountError extends Error {
  constructor() {
    super('An account is needed for that.');
    this.name = 'NeedsAccountError';
  }
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { origin, ready: originReady, precise, city, area } = useOrigin();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<Session>({ status: 'loading', email: null });
  const [profileId, setProfileId] = useState<string | null>(null);
  // Only the parts a person edits are stored. Where they are comes from the
  // device, so it is derived below rather than copied into state and kept in
  // step with an effect.
  const [profile, setProfile] = useState({
    name: GUEST.name,
    initials: GUEST.initials,
    email: GUEST.email,
    verified: GUEST.verified,
    avatar: undefined as string | undefined,
    /** Whether the stored name is theirs rather than the placeholder. */
    named: false,
  });
  /** True once the profile row has been read, so onboarding can wait for it. */
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  /** Which account's listings we have already gone and fetched. */
  const ownedFetched = useRef<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  /** The one just delivered, for the banner. Cleared when it is dismissed. */
  const [incoming, setIncoming] = useState<AppNotification | null>(null);
  /** Set when this account was found suspended, so the app can say why. */
  const [suspension, setSuspension] = useState<string | null>(null);

  /* ------------------------------------------------------------ loading -- */

  /**
   * Folds rows fetched by name into the directory already in memory.
   *
   * What is already there wins on conflict: it came from the nearby search,
   * which is the one that knows how far away things are.
   */
  const mergeBusinesses = useCallback((rows: Business[]) => {
    if (rows.length === 0) return;
    setBusinesses((prev) => {
      const have = new Set(prev.map((b) => b.id));
      const extra = rows.filter((b) => !have.has(b.id));
      return extra.length === 0 ? prev : [...prev, ...extra];
    });
  }, []);

  const { lat: originLat, lng: originLng } = origin;
  const businessSlugs = useMemo(() => new Set(businesses.map((b) => b.id)), [businesses]);

  const loadBusinesses = useCallback(async () => {
    try {
      setError(null);
      const rows = await api.fetchNearby(origin, { radiusM: 50_000 });
      setBusinesses(rows);
    } catch (e) {
      // Deliberately not the raw Postgres message — that is for the log.
      setError('We could not load places near you. Check your connection.');
      reportError('store/businesses', e);
    } finally {
      setLoading(false);
    }
  }, [origin]);

  /*
   * Waits for the device to answer before the first fetch, then refetches if
   * the answer changes. Loading twice — once from the city centre and again
   * from the real position — would make every distance on screen jump.
   *
   * The state updates sit inside the async function, after an await, which is
   * the shape the hooks rules expect for loading from somewhere external.
   */
  useEffect(() => {
    if (!originReady) return;
    let alive = true;
    (async () => {
      const rows = await api
        .fetchNearby(origin, { radiusM: 50_000 })
        .catch((e) => {
          reportError('store/businesses', e);
          return null;
        });
      if (!alive) return;
      if (rows) {
        setBusinesses(rows);
        setError(null);
      } else {
        setError('We could not load places near you. Check your connection.');
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [originReady, origin]);

  /*
   * Lists do not carry reviews — fetching them for every row would be a query
   * per listing. The detail screens ask for them when they open, and the
   * result is merged into the listing already in memory.
   */
  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const full = await api.fetchBusiness(id, origin, profileId);
        if (!full) return;
        setBusinesses((prev) => {
          const known = prev.some((b) => b.id === id);
          return known ? prev.map((b) => (b.id === id ? { ...b, ...full } : b)) : [...prev, full];
        });
      } catch (e) {
        reportError('store/detail', e);
      }
    },
    // Depends only on things that change rarely, so a screen can put this in
    // an effect's dependencies without re-fetching on every render.
    [origin, profileId],
  );

  /**
   * Takes the database id rather than the slug: the caller already has the
   * listing in hand, and looking it up here would tie this callback to the
   * whole list and re-create it on every change.
   */
  const recordEvent = useCallback((dbId: string, kind: 'view' | 'call' | 'directions') => {
    void api.recordEvent(dbId, kind);
  }, []);

  /* --------------------------------------------------------------- auth -- */

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    function applySession(next: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      if (!next?.user) {
        setSession({ status: 'signedOut', email: null });
        setProfileId(null);
        setProfile({
          name: GUEST.name,
          initials: GUEST.initials,
          email: GUEST.email,
          verified: GUEST.verified,
          avatar: undefined,
          named: false,
        });
        setProfileLoaded(false);
        setSavedIds([]);
        setNotifications([]);
        return;
      }
      setSession({ status: 'signedIn', email: next.user.email ?? null });
      setProfileId(next.user.id);
      // The address they signed in with is the address we know them by, so
      // it is read from the session rather than kept as a second editable
      // copy that can disagree with it.
      setProfile((prev) => ({ ...prev, email: next.user.email ?? '' }));
    }

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Everything that belongs to a person loads once there is a person.
  useEffect(() => {
    if (!profileId) return;
    let alive = true;

    (async () => {
      try {
        const [saved, notes, row] = await Promise.all([
          api.fetchSavedIds(profileId),
          api.fetchNotifications(profileId),
          api.fetchProfile(profileId),
        ]);
        if (!alive) return;
        setSavedIds(saved);
        setNotifications(notes);

        /*
         * The name lives in the database and nothing was ever reading it, so
         * everybody with an account still saw "Guest". It is read here, once,
         * when there is somebody to read it for.
         */
        if (row) {
          const stored = (row.name ?? '').trim();
          setProfile((prev) => ({
            ...prev,
            // A new account has no name yet. Until they give us one they are
            // shown the same placeholder as a signed out visitor rather than
            // a blank space where a name should be.
            name: stored || GUEST.name,
            initials: stored ? initialsOf(stored) : GUEST.initials,
            named: stored.length > 0,
            avatar: row.avatar_url ?? undefined,
          }));
        }
        setProfileLoaded(true);
      } catch (e) {
        reportError('store/profile', e);
        if (alive) setProfileLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profileId]);

  /*
   * Notifications as they are written, not only at sign in.
   *
   * Everything that writes one happens while somebody is looking at the app:
   * a review lands on their listing, we approve it, somebody replies. Reading
   * the table once meant the row existed and the bell stayed empty until the
   * next cold start, which is why this looked like a feature the app did not
   * have. `notifications_select_own` still decides what a subscriber may
   * hear, so this carries their own rows and nobody else's.
   */
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          // Re-read rather than patch the payload in. A notification carries
          // a business slug from a joined row, which the payload does not.
          void api
            .fetchNotifications(profileId)
            .then((rows) => {
              setNotifications(rows);
              /*
               * A new one that arrives while somebody is looking at the app
               * shows itself, rather than waiting in a list nobody has a
               * reason to open. This is the whole of "in-app notifications":
               * being told when it happens, not finding out later.
               *
               * Only inserts. An update is a read receipt coming back from
               * another device, and announcing that would be announcing
               * something the person just did.
               */
              if (payload.eventType !== 'INSERT') return;
              const id = (payload.new as { id?: string } | null)?.id;
              const arrived = rows.find((n) => n.id === id);
              if (arrived && !arrived.read) setIncoming(arrived);
            })
            .catch((e) => reportError('store/notifications', e));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  /*
   * Saved places and listings you own, fetched by name rather than by radius.
   *
   * The directory in memory is one page of what is near you, which is the
   * right answer to "what is near me" and the wrong one to both of these.
   * Past a hundred listings inside the radius that page stops containing a
   * place saved in another town, and the Saved tab drops it without saying
   * anything — a bug that cannot appear until there is enough data for it to.
   */
  useEffect(() => {
    if (!profileId) return;

    const missing = savedIds.filter((slug) => !businessSlugs.has(slug));
    if (missing.length === 0 && ownedFetched.current === profileId) return;
    ownedFetched.current = profileId;

    let alive = true;
    const at = { lat: originLat, lng: originLng };
    void Promise.all([
      api.fetchBusinessesBySlugs(missing, at, profileId),
      api.fetchOwned(profileId, at),
    ])
      .then(([savedRows, ownedRows]) => {
        if (alive) mergeBusinesses([...savedRows, ...ownedRows]);
      })
      .catch((e) => reportError('store/places', e));

    return () => {
      alive = false;
    };
  }, [profileId, savedIds, businessSlugs, originLat, originLng, mergeBusinesses]);

  // What was viewed last time, and the listings behind those slugs. The
  // nearby page will not contain all of them — that is the same reason Saved
  // fetches by name — so anything missing is fetched the same way.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const queriesRaw = await AsyncStorage.getItem(QUERY_KEY);
        const storedQueries: unknown = queriesRaw ? JSON.parse(queriesRaw) : [];
        if (alive && Array.isArray(storedQueries)) {
          setRecentQueries(
            storedQueries.filter((v): v is string => typeof v === 'string').slice(0, QUERY_LIMIT),
          );
        }

        const raw = await AsyncStorage.getItem(RECENT_KEY);
        const stored: unknown = raw ? JSON.parse(raw) : [];
        if (!alive || !Array.isArray(stored)) return;

        const ids = stored.filter((v): v is string => typeof v === 'string').slice(0, RECENT_LIMIT);
        if (ids.length === 0) return;

        // Anything viewed since launch stays in front of the stored list
        // rather than being replaced by it.
        setRecentIds((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))].slice(0, RECENT_LIMIT));
        const rows = await api.fetchBusinessesBySlugs(ids, { lat: originLat, lng: originLng });
        if (alive) mergeBusinesses(rows);
      } catch (e) {
        reportError('store/recent', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [originLat, originLng, mergeBusinesses]);

  /*
   * Two things the account has to be asked about once it exists.
   *
   * A token issued before a suspension keeps working until it expires, so
   * "am I still allowed in" is a question rather than an assumption — and the
   * answer, when it is no, has to end the session here rather than let
   * somebody wander a half-working app finding every write refused.
   *
   * The device goes with it, because one phone with many sign-ins is the only
   * signal that catches a ring of accounts, and it is worth recording at the
   * moment a sign-in happens.
   */
  useEffect(() => {
    if (!profileId) return;
    let alive = true;

    (async () => {
      try {
        const state = await api.fetchAccountState();
        if (!alive) return;

        if (state.suspended) {
          setSuspension(state.reason ?? '');
          await supabase.auth.signOut();
          return;
        }

        const fingerprint = await deviceFingerprint();
        if (!alive) return;
        await api.recordDevice({
          fingerprint,
          platform: `${Platform.OS}${Platform.Version ? ` ${Platform.Version}` : ''}`,
          lat: precise ? origin.lat : undefined,
          lng: precise ? origin.lng : undefined,
        });
      } catch (e) {
        // Not being able to ask is not the same as being suspended, and
        // locking somebody out because a request failed is the worse mistake.
        reportError('store/account', e);
      }
    })();

    return () => {
      alive = false;
    };
    // Deliberately not re-run when the position changes: this is a sign-in
    // time record, not a movement log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /**
   * Saves the parts of a profile a person edits.
   *
   * Rewritten from a version that had three problems. It fired the write from
   * inside a setState updater, which React is allowed to call twice and does
   * in development, so every save was sent twice. It sent `area` even when
   * the caller had not touched it, and that column is NOT NULL, so an
   * unrelated edit could be refused outright. And it swallowed the refusal,
   * which is why saving a name appeared to work and changed nothing.
   *
   * It resolves when the write lands, and throws when it does not, so the
   * screen can say so.
   */
  const updateViewer = useCallback(
    async (patch: Partial<Viewer>) => {
      const name = patch.name === undefined ? undefined : cleanDisplayName(patch.name);
      if (patch.name !== undefined && !name) {
        throw new Error('Tell us what to call you.');
      }

      if (!profileId) {
        router.push('/(auth)/sign-in');
        throw new NeedsAccountError();
      }

      await api.updateProfileRemote(profileId, {
        name,
        area: patch.area,
        avatarUrl: patch.avatar,
        avatarKind:
          patch.avatar === undefined
            ? undefined
            : patch.avatar === null || patch.avatar === ''
              ? null
              : patch.avatar.startsWith('preset:')
                ? 'preset'
                : 'upload',
      });

      // Only after the database has taken it. Showing the new name and then
      // finding out it was refused is the bug this replaced.
      setProfile((prev) => ({
        ...prev,
        ...(name !== undefined ? { name, initials: initialsOf(name), named: true } : {}),
        ...(patch.avatar !== undefined ? { avatar: patch.avatar || undefined } : {}),
      }));
    },
    [profileId],
  );

  const viewer = useMemo<Viewer>(
    () => {
      const { named: _named, ...rest } = profile;
      return { ...rest, city, area };
    },
    [profile, city, area],
  );

  const needsName = session.status === 'signedIn' && profileLoaded && !profile.named;

  /* -------------------------------------------------------------- saved -- */

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    (id: string) => {
      const business = businesses.find((b) => b.id === id);
      const next = !savedIds.includes(id);

      /*
       * Nothing to save it to. This used to fill the heart in anyway and
       * drop the write on the floor, so the place was gone on next launch
       * with nothing to explain why. Ask for the account instead.
       */
      if (!profileId) {
        router.push('/(auth)/sign-in');
        return;
      }

      // Move the heart immediately; put it back if the write is refused.
      setSavedIds((prev) => (next ? [id, ...prev] : prev.filter((x) => x !== id)));

      if (!business?.dbId) return;
      api.setSaved(profileId, business.dbId, next).catch((e) => {
        reportError('store/saving', e);
        setSavedIds((prev) => (next ? prev.filter((x) => x !== id) : [id, ...prev]));
      });
    },
    [businesses, savedIds, profileId],
  );

  /*
   * Recent is kept on the device, not in the database.
   *
   * It is a convenience, not a record: it should work signed out, it should
   * not follow somebody to another phone, and what you looked at is nobody
   * else's business. Before this it was React state alone, so the list
   * emptied itself on every restart and looked broken.
   */
  const markViewed = useCallback((id: string) => {
    setRecentIds((prev) => {
      if (prev[0] === id) return prev;
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next))
        .catch((e) => reportError('store/recent-write', e));
      return next;
    });
  }, []);

  /* ------------------------------------------------------ notifications -- */

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void api.markNotificationReadRemote(id).catch((e) => reportError('store/read-receipt', e));
  }, []);

  /*
   * The writes happen here rather than inside the updater. React is allowed
   * to call an updater twice, and does in development, so a version that
   * sent them from in there sent every one of them twice.
   */
  const markAllNotificationsRead = useCallback(() => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    unread.forEach((n) => {
      void api.markNotificationReadRemote(n.id).catch((e) => reportError('store/read-receipt', e));
    });
  }, [notifications]);

  /*
   * Only whole searches, not every keystroke, and only ones long enough to
   * mean something. Storing "c", "co", "cof" would drown the signal in its
   * own prefixes.
   */
  const recordSearch = useCallback((query: string) => {
    const term = query.trim().toLowerCase();
    if (term.length < 3) return;

    setRecentQueries((prev) => {
      if (prev[0] === term) return prev;
      const next = [term, ...prev.filter((q) => q !== term)].slice(0, QUERY_LIMIT);
      void AsyncStorage.setItem(QUERY_KEY, JSON.stringify(next))
        .catch((e) => reportError('store/queries-write', e));
      return next;
    });
  }, []);

  const dismissIncoming = useCallback(() => setIncoming(null), []);
  const clearSuspension = useCallback(() => setSuspension(null), []);

  /**
   * Deletes the account, then signs out.
   *
   * The order matters: the storage clean-up inside `deleteMyAccount` needs a
   * session the storage policies will accept, and there is nobody left to do
   * it afterwards.
   */
  const deleteAccount = useCallback(async () => {
    if (!profileId) throw new Error('There is no account to delete.');
    await api.deleteMyAccount(profileId);
    await supabase.auth.signOut();
  }, [profileId]);

  /** Re-reads the list. The notifications screen calls this when it opens. */
  const refreshNotifications = useCallback(async () => {
    if (!profileId) return;
    try {
      setNotifications(await api.fetchNotifications(profileId));
    } catch (e) {
      reportError('store/notifications', e);
    }
  }, [profileId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  /* --------------------------------------------------------- businesses -- */

  const getBusiness = useCallback(
    (id: string) => businesses.find((b) => b.id === id),
    [businesses],
  );

  /**
   * Saves an edit to a listing.
   *
   * The write comes first and the local copy follows, rather than the other
   * way round. Showing the new hours and finding out later that the row still
   * has the old ones is the bug this replaced — and it is one an owner only
   * discovers when a customer turns up at a closed shop.
   */
  const updateBusiness = useCallback(
    async (id: string, patch: Partial<Business>) => {
      const business = businesses.find((b) => b.id === id);
      if (!business?.dbId) throw new Error('That listing is not loaded.');

      // Only the columns a listing editor can actually change.
      await api.updateBusinessRemote(business.dbId, {
        name: patch.name,
        category: patch.categoryId,
        tagline: patch.tagline,
        description: patch.description,
        address: patch.address,
        phone: patch.phone,
        website: patch.website,
        price_from: patch.priceFrom,
        price_to: patch.priceTo,
        hours: patch.hours,
        amenities: patch.amenities,
        photos: patch.photos,
      });

      setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [businesses],
  );

  /*
   * Listing writes first and reloads after, rather than showing an
   * optimistic row. Everything else in here can be put back if a
   * write is refused; a listing cannot — it has a database-generated id that
   * the detail screen immediately navigates to, and inventing one locally is
   * how you get a screen pointing at a listing that does not exist.
   */
  const addBusiness = useCallback(
    async (input: NewBusiness) => {
      const slug = await api.createBusinessRemote({
        name: input.name,
        category: input.categoryId,
        tagline: input.tagline,
        address: input.address,
        neighbourhood: input.neighbourhood,
        phone: input.phone,
        lat: input.lat ?? origin.lat,
        lng: input.lng ?? origin.lng,
        description: input.description,
        website: input.website,
        priceFrom: input.priceFrom,
        priceTo: input.priceTo,
        hours: input.hours,
        amenities: input.amenities,
        photos: input.photos,
      });
      await loadBusinesses();
      return slug;
    },
    [origin.lat, origin.lng, loadBusinesses],
  );

  /*
   * Reporting a listing needs no account, deliberately.
   *
   * The people most likely to notice that a listing is a fake, a duplicate,
   * or a business that closed two years ago are the people walking past it,
   * and most of them are not signed in. Requiring an account meant refusing
   * the reports we most needed. A report is not a claim about the reporter.
   *
   * It still throws rather than returning quietly when the write fails. An
   * earlier version returned early, which the sheet read as success and
   * answered with "thank you, we will take a look" — for a report that was
   * never written.
   */
  const reportBusiness = useCallback(
    async (id: string, reason: string) => {
      const business = businesses.find((b) => b.id === id);
      if (!business?.dbId) throw new Error('That listing is not loaded.');

      await api.createReport({
        targetType: 'business',
        targetId: business.dbId,
        reason,
      });
    },
    [businesses],
  );

  /**
   * Answers a review as the owner.
   *
   * Same correction as `addReview`: it used to patch the reply in locally and
   * report a failure to nobody, so an owner whose reply was refused watched it
   * appear under the review and it was never published.
   */
  const replyToReview = useCallback(
    async (businessId: string, reviewId: string, body: string) => {
      await api.replyToReviewRemote(reviewId, body);
      await loadDetail(businessId);
    },
    [loadDetail],
  );

  const addReview = useCallback(
    async (businessId: string, review: Review) => {
      if (!profileId) {
        router.push('/(auth)/sign-in');
        throw new NeedsAccountError();
      }

      const business = businesses.find((b) => b.id === businessId);
      if (!business?.dbId) throw new Error('That listing is not loaded.');

      await api.createReview({
        businessDbId: business.dbId,
        authorId: profileId,
        authorName: review.authorName,
        rating: review.rating,
        body: review.body,
      });

      // The database recomputes the rating, so reload rather than trust
      // arithmetic done here.
      await loadBusinesses();
      await loadDetail(businessId);
    },
    [businesses, profileId, loadBusinesses, loadDetail],
  );

  const ownedBusinesses = useMemo(
    () => businesses.filter((b) => b.ownedByViewer),
    [businesses],
  );

  /*
   * What to put in front of this person, worked out here rather than on a
   * screen so every rail and every list agrees about it.
   *
   * All of it is derived on the device from their own activity, and none of
   * it is sent anywhere. `src/lib/recommend.ts` holds the reasoning.
   */
  const recommendations = useMemo(() => {
    const byId = new Map(businesses.map((b) => [b.id, b]));
    const pick = (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter((b): b is Business => !!b);

    const taste = buildTaste({
      saved: pick(savedIds),
      recent: pick(recentIds),
      queries: recentQueries,
      reviewed: businesses.flatMap((business) =>
        business.reviews
          .filter((r) => r.authorName === profile.name && profile.named)
          .map((r) => ({ business, rating: r.rating })),
      ),
      all: businesses,
    });

    return recommend(businesses, taste, { limit: 8 });
  }, [businesses, savedIds, recentIds, recentQueries, profile.name, profile.named]);

  const value = useMemo<StoreValue>(
    () => ({
      businesses,
      loading,
      error,
      refresh: loadBusinesses,
      origin,
      locationPrecise: precise,
      loadDetail,
      recordEvent,
      viewer,
      session,
      userId: profileId,
      signOut,
      updateViewer,
      profileLoaded,
      needsName,
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      refreshNotifications,
      incoming,
      dismissIncoming,
      suspension,
      clearSuspension,
      deleteAccount,
      savedIds,
      isSaved,
      toggleSaved,
      recentIds,
      markViewed,
      recentQueries,
      recordSearch,
      recommendations,
      getBusiness,
      ownedBusinesses,
      updateBusiness,
      addBusiness,
      reportBusiness,
      replyToReview,
      addReview,
    }),
    [
      businesses, loading, error, loadBusinesses, precise, origin, loadDetail, recordEvent,
      viewer, session, profileId, signOut, updateViewer, profileLoaded, needsName,
      notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
      refreshNotifications, incoming, dismissIncoming,
      suspension, clearSuspension, deleteAccount,
      savedIds, isSaved, toggleSaved, recentIds, markViewed,
      recentQueries, recordSearch, recommendations,
      getBusiness, ownedBusinesses, updateBusiness, addBusiness, reportBusiness,
      replyToReview, addReview,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
