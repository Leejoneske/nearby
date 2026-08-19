/**
 * Legal copy, kept as data so the screen stays a renderer.
 *
 * It lives in `legal.json` rather than in this file, for one reason: the
 * landing page has to publish the same words at a public URL — an app store
 * submission needs one, and a policy that exists only inside the app is not
 * reachable by somebody deciding whether to install it. A build script reads
 * the JSON and writes those pages, so there is one copy of the text and it
 * cannot drift.
 *
 * Written to describe what the app actually does today. When behaviour
 * changes, this text has to change with it or it stops being true. Three that
 * had already gone stale: it said you sign in with a phone number long after
 * that became an email address, it said nothing about the view and call
 * counts an owner can see, and it still said reporting needed an account
 * after that stopped being true.
 *
 * No dashes as punctuation anywhere in here. See DEVELOPER.md.
 *
 * Have a lawyer read both before submitting to the app stores.
 */
import data from './legal.json';

export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL: Record<'privacy' | 'terms', LegalDoc> = data;
