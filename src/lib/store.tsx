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
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_AREA, DEFAULT_CITY } from '../data/location';
import type { AppNotification, Business, Review, Session } from '../data/types';
import * as api from './api';
import { initialsOf } from './format';
import { supabase } from './supabase';
import { useOrigin } from './useOrigin';

export type Viewer = {
  name: string;
  initials: string;
  email: string;
  city: string;
  area: string;
  verified: boolean;
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

  /** Loads the reviews for one listing, which lists do not carry. */
  loadDetail: (id: string) => Promise<void>;
  recordEvent: (dbId: string, kind: 'view' | 'call' | 'directions') => void;

  viewer: Viewer;
  session: Session;
  signOut: () => Promise<void>;
  updateViewer: (patch: Partial<Viewer>) => void;

  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;

  recentIds: string[];
  markViewed: (id: string) => void;

  getBusiness: (id: string) => Business | undefined;
  ownedBusinesses: Business[];

  updateBusiness: (id: string, patch: Partial<Business>) => void;
  addBusiness: (business: Business) => void;
  replyToReview: (businessId: string, reviewId: string, body: string) => void;
  addReview: (businessId: string, review: Review) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { origin, ready: originReady, precise, city, area } = useOrigin();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<Session>({ status: 'loading', phone: null });
  const [profileId, setProfileId] = useState<string | null>(null);
  // Only the parts a person edits are stored. Where they are comes from the
  // device, so it is derived below rather than copied into state and kept in
  // step with an effect.
  const [profile, setProfile] = useState({
    name: GUEST.name,
    initials: GUEST.initials,
    email: GUEST.email,
    verified: GUEST.verified,
  });

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  /* ------------------------------------------------------------ loading -- */

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
        setSession({ status: 'signedOut', phone: null });
        setProfileId(null);
        setProfile({
          name: GUEST.name,
          initials: GUEST.initials,
          email: GUEST.email,
          verified: GUEST.verified,
        });
        setSavedIds([]);
        setNotifications([]);
        return;
      }
      setSession({ status: 'signedIn', phone: next.user.phone ?? null });
      setProfileId(next.user.id);
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
        const [saved, notes] = await Promise.all([
          api.fetchSavedIds(profileId),
          api.fetchNotifications(profileId),
        ]);
        if (!alive) return;
        setSavedIds(saved);
        setNotifications(notes);
      } catch (e) {
        console.warn('[store] loading your data failed', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profileId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateViewer = useCallback(
    (patch: Partial<Viewer>) => {
      setProfile((prev) => {
        const next = {
          ...prev,
          ...(patch.name !== undefined ? { name: patch.name, initials: initialsOf(patch.name) } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
        };
        if (profileId) {
          void supabase
            .from('profiles')
            .update({ name: next.name, email: next.email, area: patch.area })
            .eq('id', profileId)
            .then(({ error: e }) => {
              if (e) console.warn('[store] saving your profile failed', e);
            });
        }
        return next;
      });
    },
    [profileId],
  );

  const viewer = useMemo<Viewer>(
    () => ({ ...profile, city, area }),
    [profile, city, area],
  );

  /* -------------------------------------------------------------- saved -- */

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback(
    (id: string) => {
      const business = businesses.find((b) => b.id === id);
      const next = !savedIds.includes(id);

      // Move the heart immediately; put it back if the write is refused.
      setSavedIds((prev) => (next ? [id, ...prev] : prev.filter((x) => x !== id)));

      if (!profileId || !business?.dbId) return;
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

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      prev.filter((n) => !n.read).forEach((n) => {
        void api.markNotificationReadRemote(n.id).catch(() => {});
      });
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

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
        })
        .catch((e) => console.warn('[store] saving the listing failed', e));
    },
    [businesses],
  );

  const addBusiness = useCallback((business: Business) => {
    setBusinesses((prev) => [business, ...prev]);
  }, []);

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

      if (!profileId || !business?.dbId) return;
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
      locationPrecise: precise,
      loadDetail,
      recordEvent,
      viewer,
      session,
      signOut,
      updateViewer,
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      savedIds,
      isSaved,
      toggleSaved,
      recentIds,
      markViewed,
      getBusiness,
      ownedBusinesses,
      updateBusiness,
      addBusiness,
      replyToReview,
      addReview,
    }),
    [
      businesses, loading, error, loadBusinesses, precise, loadDetail, recordEvent,
      viewer, session, signOut, updateViewer,
      notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
      savedIds, isSaved, toggleSaved, recentIds, markViewed,
      getBusiness, ownedBusinesses, updateBusiness, addBusiness,
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
