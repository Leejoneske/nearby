/**
 * App state.
 *
 * A React context rather than a state library — the surface is small and every
 * screen wants the same three things: the listings, what the viewer saved, and
 * which listing the viewer owns. When this moves onto a real API, the
 * mutations below become the request layer and screens stay unchanged.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ALL_BUSINESSES, VIEWER_AREA, VIEWER_CITY } from '../data/businesses';
import type { Business, Review } from '../data/types';

export type Viewer = {
  name: string;
  initials: string;
  email: string;
  city: string;
  area: string;
  verified: boolean;
};

type StoreValue = {
  businesses: Business[];
  viewer: Viewer;

  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;

  recentIds: string[];
  markViewed: (id: string) => void;

  getBusiness: (id: string) => Business | undefined;
  /** Listings the viewer owns, most recently claimed first. */
  ownedBusinesses: Business[];

  updateBusiness: (id: string, patch: Partial<Business>) => void;
  addBusiness: (business: Business) => void;
  replyToReview: (businessId: string, reviewId: string, body: string) => void;
  addReview: (businessId: string, review: Review) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

const VIEWER: Viewer = {
  name: 'John Wanderi',
  initials: 'JW',
  email: 'john@jwcoffee.co.ke',
  city: VIEWER_CITY,
  area: VIEWER_AREA,
  verified: true,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>(ALL_BUSINESSES);
  const [savedIds, setSavedIds] = useState<string[]>(['sarabi-kitchen', 'the-cut-room']);
  const [recentIds, setRecentIds] = useState<string[]>(['kahawa-collective', 'iron-yard-gym']);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  }, []);

  const markViewed = useCallback((id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 20));
  }, []);

  const getBusiness = useCallback(
    (id: string) => businesses.find((b) => b.id === id),
    [businesses],
  );

  const updateBusiness = useCallback((id: string, patch: Partial<Business>) => {
    setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const addBusiness = useCallback((business: Business) => {
    setBusinesses((prev) => [business, ...prev]);
  }, []);

  const replyToReview = useCallback((businessId: string, reviewId: string, body: string) => {
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
  }, []);

  const addReview = useCallback((businessId: string, review: Review) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        const reviews = [review, ...b.reviews];
        const total = b.rating * b.reviewCount + review.rating;
        const count = b.reviewCount + 1;
        return {
          ...b,
          reviews,
          reviewCount: count,
          rating: Math.round((total / count) * 10) / 10,
        };
      }),
    );
  }, []);

  const ownedBusinesses = useMemo(
    () => businesses.filter((b) => b.ownedByViewer),
    [businesses],
  );

  const value = useMemo<StoreValue>(
    () => ({
      businesses,
      viewer: VIEWER,
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
      businesses,
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
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
