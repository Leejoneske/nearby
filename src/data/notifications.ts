import type { AppNotification } from './types';

/** Seed notifications. Replaced by the API alongside the rest of the data. */
export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'review',
    title: 'New review on JW Coffee House',
    body: 'Anne Wairimu left 5 stars: "My morning stop. The cortado is consistently good."',
    date: '2026-08-14',
    read: false,
    businessId: 'jw-coffee-house',
  },
  {
    id: 'n2',
    kind: 'review',
    title: 'A review needs your reply',
    body: 'Sam Gitau left 3 stars on JW Coffee House. Replying publicly takes a minute.',
    date: '2026-08-11',
    read: false,
    businessId: 'jw-coffee-house',
  },
  {
    id: 'n3',
    kind: 'offer',
    title: '20% off at Kahawa Collective',
    body: 'Any brew before 9am on weekdays, a few minutes from you.',
    date: '2026-08-09',
    read: true,
    businessId: 'kahawa-collective',
  },
  {
    id: 'n4',
    kind: 'listing',
    title: 'Your listing is verified',
    body: 'JW Coffee House now shows the verified badge in search and on the map.',
    date: '2026-08-02',
    read: true,
    businessId: 'jw-coffee-house',
  },
  {
    id: 'n5',
    kind: 'reply',
    title: 'Sarabi Kitchen replied to you',
    body: '"Apologies for the wait — we have added a second host on weekend evenings since."',
    date: '2026-07-29',
    read: true,
    businessId: 'sarabi-kitchen',
  },
];
