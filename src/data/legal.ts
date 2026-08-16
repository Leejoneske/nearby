/**
 * Legal copy, kept as data so the screen stays a renderer.
 *
 * Written to describe what the app actually does today. When behaviour
 * changes, this text has to change with it or it stops being true. Two
 * examples that had already gone stale: it still said you sign in with a
 * phone number, long after that became an email address, and it said nothing
 * at all about the view and call counts an owner can see.
 *
 * No dashes as punctuation anywhere in here. See DEVELOPER.md.
 *
 * Have a lawyer read both before submitting to the app stores.
 */

export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '16 August 2026',
    intro:
      'This explains what Nearby collects, why, and what we will never do with it. We have tried to write it in plain language rather than legal shorthand.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: [
          'Your email address, because it is how you sign in. We send a six digit code to it each time, so there is no password to remember or to lose.',
          'Anything you type in: your name, the reviews you write, and the details of any business you list.',
          'Your approximate location, but only while the app is open and only if you allow it. We use it to sort places by how close they are. We do not track you in the background, and refusing simply means distances are measured from the city instead.',
          'Which listings get opened, called or asked directions to. That is counted against the business rather than against you, so an owner sees how many people found them and never who.',
        ],
      },
      {
        heading: 'What we do not do',
        paragraphs: [
          'We do not sell your information to anyone.',
          'We do not show adverts, so nothing about you is shared with advertisers.',
          'We do not read your contacts, photos, messages or files.',
        ],
      },
      {
        heading: 'What other people can see',
        paragraphs: [
          'Reviews are public. Your name and the review appear on the listing, and the owner can reply in public.',
          'If you list a business, everything on that listing is public: the name, address, hours, prices, photos and contact details you enter.',
          'The places you save and the places you have looked at are private to you.',
          'Your email address is never shown to anybody else, including the owner of a business you review.',
        ],
      },
      {
        heading: 'When you report something',
        paragraphs: [
          'A report records what you flagged, the reason you picked, and that it came from you. We need that last part so one account cannot flood the queue.',
          'The business or the reviewer is never told who reported them.',
        ],
      },
      {
        heading: 'Keeping it',
        paragraphs: [
          'We keep your information while your account exists. Ask us to delete your account and we remove it, along with your saved places and history.',
          'Reviews you have written stay up but stop showing your name, so the rating on a business does not silently change when someone leaves.',
        ],
      },
      {
        heading: 'Where it is kept',
        paragraphs: [
          'Your information is held on servers run by our hosting provider, which may be outside your country. Access is limited to the people who keep Nearby running.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'Nearby is not intended for children under 13, and we do not knowingly collect their information.',
        ],
      },
      {
        heading: 'Asking us anything',
        paragraphs: [
          'You can ask for a copy of what we hold, ask us to correct it, or ask us to delete it. Get in touch and we will sort it out.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Use',
    updated: '16 August 2026',
    intro: 'The rules for using Nearby. Using the app means you agree to them.',
    sections: [
      {
        heading: 'Your account',
        paragraphs: [
          'You sign in with an email address, and we send a six digit code to it. Keep that inbox to yourself, because anything done from your account is treated as done by you.',
          'You can browse, search and read reviews without an account. Saving a place, writing a review, listing a business and reporting something all need one.',
          'You must be at least 13 years old to use Nearby.',
        ],
      },
      {
        heading: 'Reviews',
        paragraphs: [
          'Write about somewhere you actually went. Do not post reviews for a business you own or compete with, and do not accept anything in exchange for a review.',
          'No abuse, no threats, no personal information about other people, and nothing untrue about a business.',
          'We remove reviews that break these rules, and we may suspend an account that keeps doing it.',
        ],
      },
      {
        heading: 'Listing a business',
        paragraphs: [
          'Only list a business you own or are authorised to manage.',
          'A new listing goes live straight away and shows as unverified until we have confirmed it is yours. Verifying is our decision, and we may ask you for something that proves the connection.',
          'Keep the details accurate. Wrong hours or a wrong price is the fastest way to lose the trust of the people the listing brings you.',
          'Listing a business is free. Nothing on it is for sale, and paying us does not move you up the results.',
        ],
      },
      {
        heading: 'When we take something down',
        paragraphs: [
          'We may hide a listing while we look into a report about it. While it is hidden, nobody but you can find it, and you will be told in the app.',
          'We put it back if the report does not hold up.',
        ],
      },
      {
        heading: 'What we can and cannot promise',
        paragraphs: [
          'Listings come from business owners and reviews come from members of the public, so we cannot guarantee everything you read is accurate or current. Check with the business before relying on it.',
          'Distances and opening hours are worked out from what a listing says and from where your phone reports it is. Treat both as a good guess rather than a guarantee.',
          'We work to keep the app running, but we cannot promise it is available every minute.',
        ],
      },
      {
        heading: 'Ending it',
        paragraphs: [
          'You can stop using Nearby and delete your account whenever you like.',
          'We may suspend an account that breaks these rules or is used to harm somebody.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'If these terms change in a way that affects you, we will say so in the app rather than quietly editing this page.',
        ],
      },
    ],
  },
};
