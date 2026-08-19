/**
 * Sharing a listing.
 *
 * The link has to work for somebody who has never heard of this app, which
 * rules out a `nearby://` deep link on its own: tapped on a phone without the
 * app it does nothing at all, and the person who sent it never finds out.
 * So the link is a web page — one that shows the business and offers the app
 * underneath it.
 */
import { Share } from 'react-native';

import type { Business } from '../data/types';

/** Where the landing page lives. The share link is a page on it. */
export const SITE = 'https://nearby-lake.vercel.app';

export function shareUrl(slug: string): string {
  return `${SITE}/b/${slug}`;
}

/**
 * What gets sent.
 *
 * The name and the area, then the link. Not the tagline: shares get read as a
 * single line in a chat list, and the two things somebody needs to decide
 * whether to tap are what it is called and roughly where it is.
 */
export function shareMessage(business: Pick<Business, 'name' | 'neighbourhood' | 'id'>): string {
  const where = business.neighbourhood ? ` in ${business.neighbourhood}` : '';
  return `${business.name}${where} on Nearby\n${shareUrl(business.id)}`;
}

/**
 * Opens the system share sheet.
 *
 * Resolves either way. Somebody dismissing the sheet is not an error, and
 * neither is a platform that cannot share — the button simply does nothing
 * visible, which is better than an alert about an action they abandoned.
 */
export async function shareBusiness(
  business: Pick<Business, 'name' | 'neighbourhood' | 'id'>,
): Promise<void> {
  try {
    await Share.share(
      {
        title: business.name,
        message: shareMessage(business),
        url: shareUrl(business.id),
      },
      { subject: `${business.name} on Nearby` },
    );
  } catch (e) {
    console.warn('[share] the sheet could not open', e);
  }
}
