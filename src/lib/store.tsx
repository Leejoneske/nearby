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

import { router } from 'expo-router';

import { DEFAULT_AREA, DEFAULT_CITY } from '../data/location';
import type { AppNotification, Business, NewBusiness, Review, Session } from '../data/types';
import * as api from './api';
import { initialsOf } from './format';
import { cleanDisplayName } from './identity';
import { supabase } from './supabase';
import { useOrigin } from './useOrigin';

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

  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;

  recentIds: string[];
  markViewed: (id: string) => void;

  getBusiness: (id: string) => Business | undefined;
  ownedBusinesses: Business[];

  /** Flags a listing for review. Throws if refused; sends you to sign in. */
  reportBusiness: (id: string, reason: string) => Promise<void>;
  updateBusiness: (id: string, patch: Partial<Business>) => void;
  /** Lists a new business. Resolves to its id, or throws with a reason. */
  addBusiness: (input: NewBusiness) => Promise<string>;
  /** Takes over an unowned listing. Throws with a reason if refused. */
  claimBusiness: (id: string) => Promise<void>;
  replyToReview: (businessId: string, reviewId: string, body: string) => void;
  addReview: (businessId: string, review: Review) => void;
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
  /** Which account's listings we have already gone and fetched. */
  const ownedFetched = useRef<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
      console.warn('[store] loading businesses failed', e);
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
          console.warn('[store] loading businesses failed', e);
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
        console.warn('[store] loading the listing failed', e);
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
        console.warn('[store] loading your data failed', e);
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
        () => {
          // Re-read rather than patch the payload in. A notification carries
          // a business slug from a joined row, which the payload does not.
          void api
            .fetchNotifications(profileId)
            .then(setNotifications)
            .catch((e) => console.warn('[store] reloading notifications failed', e));
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
      .catch((e) => console.warn('[store] loading your places failed', e));

    return () => {
      alive = false;
    };
  }, [profileId, savedIds, businessSlugs, originLat, originLng, mergeBusinesses]);

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
        console.warn('[store] saving failed', e);
        setSavedIds((prev) => (next ? prev.filter((x) => x !== id) : [id, ...prev]));
      });
    },
    [businesses, savedIds, profileId],
  );

  const markViewed = useCallback((id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 20));
  }, []);

  /* ------------------------------------------------------ notifications -- */

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void api.markNotificationReadRemote(id).catch(() => {});
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
      void api.markNotificationReadRemote(n.id).catch(() => {});
    });
  }, [notifications]);

  /** Re-reads the list. The notifications screen calls this when it opens. */
  const refreshNotifications = useCallback(async () => {
    if (!profileId) return;
    try {
      setNotifications(await api.fetchNotifications(profileId));
    } catch (e) {
      console.warn('[store] reloading notifications failed', e);
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

  const updateBusiness = useCallback(
    (id: string, patch: Partial<Business>) => {
      setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

      const business = businesses.find((b) => b.id === id);
      if (!business?.dbId) return;

      // Only the columns a listing editor can actually change.
      void api
        .updateBusinessRemote(business.dbId, {
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
        })
        .catch((e) => console.warn('[store] saving the listing failed', e));
    },
    [businesses],
  );

  /*
   * Listing and claiming both write first and reload after, rather than
   * showing an optimistic row. Everything else in here can be put back if a
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
   * Throws rather than returning quietly when there is nobody to attribute
   * the report to.
   *
   * The first version returned early, which the report sheet read as success
   * and answered with "thank you, we will take a look" — for a report that
   * was never written. A caller cannot tell "done" from "silently dropped"
   * unless the failure is a failure.
   */
  const reportBusiness = useCallback(
    async (id: string, reason: string) => {
      if (!profileId) {
        router.push('/(auth)/sign-in');
        throw new NeedsAccountError();
      }

      const business = businesses.find((b) => b.id === id);
      if (!business?.dbId) throw new Error('That listing is not loaded.');

      await api.createReport({
        targetType: 'business',
        targetId: business.dbId,
        reporterId: profileId,
        reason,
      });
    },
    [businesses, profileId],
  );

  const claimBusiness = useCallback(
    async (id: string) => {
      await api.claimBusinessRemote(id);
      await loadBusinesses();
    },
    [loadBusinesses],
  );

  const replyToReview = useCallback(
    (businessId: string, reviewId: string, body: string) => {
      const date = new Date().toISOString().slice(0, 10);
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === businessId
            ? {
                ...b,
                reviews: b.reviews.map((r) =>
                  r.id === reviewId ? { ...r, ownerReply: { body, date } } : r,
                ),
              }
            : b,
        ),
      );
      void api
        .replyToReviewRemote(reviewId, body)
        .catch((e) => console.warn('[store] replying failed', e));
    },
    [],
  );

  const addReview = useCallback(
    (businessId: string, review: Review) => {
      const business = businesses.find((b) => b.id === businessId);

      // Same reasoning as saving: a review nobody wrote down is worse than
      // being asked to sign in, because the person believes they posted it.
      if (!profileId) {
        router.push('/(auth)/sign-in');
        return;
      }

      setBusinesses((prev) =>
        prev.map((b) => {
          if (b.id !== businessId) return b;
          const total = b.rating * b.reviewCount + review.rating;
          const count = b.reviewCount + 1;
          return {
            ...b,
            reviews: [review, ...b.reviews],
            reviewCount: count,
            rating: Math.round((total / count) * 10) / 10,
          };
        }),
      );

      if (!business?.dbId) return;
      api
        .createReview({
          businessDbId: business.dbId,
          authorId: profileId,
          authorName: review.authorName,
          rating: review.rating,
          body: review.body,
        })
        // The database recomputes the rating, so reload rather than trust the
        // optimistic arithmetic above.
        .then(() => loadBusinesses())
        .catch((e) => console.warn('[store] posting the review failed', e));
    },
    [businesses, profileId, loadBusinesses],
  );

  const ownedBusinesses = useMemo(
    () => businesses.filter((b) => b.ownedByViewer),
    [businesses],
  );

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
      savedIds,
      isSaved,
      toggleSaved,
      recentIds,
      markViewed,
      getBusiness,
      ownedBusinesses,
      updateBusiness,
      addBusiness,
      claimBusiness,
      reportBusiness,
      replyToReview,
      addReview,
    }),
    [
      businesses, loading, error, loadBusinesses, precise, origin, loadDetail, recordEvent,
      viewer, session, profileId, signOut, updateViewer, profileLoaded, needsName,
      notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
      refreshNotifications,
      savedIds, isSaved, toggleSaved, recentIds, markViewed,
      getBusiness, ownedBusinesses, updateBusiness, addBusiness, claimBusiness, reportBusiness,
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
