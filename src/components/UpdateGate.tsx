/**
 * One update check for the whole app, and the sheet it drives.
 *
 * A provider rather than a leaf component because two screens need it now:
 * the sheet that appears on its own, and the row in Settings that asks on
 * demand. Calling the hook twice would mean two launch checks, two foreground
 * listeners and two disagreeing answers.
 */
import { createContext, useContext, type ReactNode } from 'react';

import { useUpdatePrompt, type ManualCheck } from '../lib/useUpdatePrompt';
import { UpdateSheet } from './UpdateSheet';

type UpdateValue = {
  /** What a manual check found, or null if nobody has asked yet. */
  manual: ManualCheck | null;
  checkNow: () => void;
};

const UpdateContext = createContext<UpdateValue>({ manual: null, checkNow: () => {} });

export function UpdateGate({ children }: { children?: ReactNode }) {
  const { release, visible, state, canInstallHere, install, dismiss, manual, checkNow } =
    useUpdatePrompt();

  return (
    <UpdateContext.Provider value={{ manual, checkNow }}>
      {children}
      <UpdateSheet
        visible={visible}
        release={release}
        state={state}
        canInstallHere={canInstallHere}
        onInstall={install}
        onDismiss={dismiss}
      />
    </UpdateContext.Provider>
  );
}

export function useUpdates(): UpdateValue {
  return useContext(UpdateContext);
}
