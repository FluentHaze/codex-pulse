import type { UpdateState } from '../electron/types';

/** A failed check alone does not establish that an update exists. */
export function hasUpdateNotice(state: UpdateState | undefined): boolean {
  return Boolean(
    state?.version &&
    ['available', 'downloading', 'downloaded', 'installing', 'error'].includes(state.status),
  );
}
