/**
 * What to call a listing's state, wherever its owner sees it.
 *
 * Only the owner ever sees anything but `live` — the policy hides a pending
 * or suspended row from everybody else — but they see it in the directory
 * alongside published ones, and until this existed it looked identical to
 * them. Somebody reasonably concluded that listings go live without approval.
 */
export type ListingState = 'live' | 'pending' | 'suspended';

export type StateBadge = {
  label: string;
  tone: 'success' | 'danger' | 'neutral' | 'accent';
  icon: string;
  /** One line for a detail screen, where there is room to explain. */
  note: string;
};

export function stateBadge(status: ListingState | undefined): StateBadge | null {
  if (status === 'pending') {
    return {
      label: 'Waiting for review',
      tone: 'accent',
      icon: 'time-outline',
      note: 'Only you can see this. We read every listing before it goes live, which usually takes a day.',
    };
  }
  if (status === 'suspended') {
    return {
      label: 'Taken down',
      tone: 'danger',
      icon: 'remove-circle-outline',
      note: 'Only you can see this. Get in touch and we will go through what needs to change.',
    };
  }
  return null;
}
