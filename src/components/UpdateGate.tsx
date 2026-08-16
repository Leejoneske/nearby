/**
 * Wires the update check to the sheet, once, above every screen.
 *
 * Kept apart from the layout so the layout stays a description of the
 * navigation and nothing else.
 */
import { UpdateSheet } from './UpdateSheet';
import { useUpdatePrompt } from '../lib/useUpdatePrompt';

export function UpdateGate() {
  const { release, visible, state, canInstallHere, install, dismiss } = useUpdatePrompt();

  return (
    <UpdateSheet
      visible={visible}
      release={release}
      state={state}
      canInstallHere={canInstallHere}
      onInstall={install}
      onDismiss={dismiss}
    />
  );
}
