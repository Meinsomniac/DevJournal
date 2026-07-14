/**
 * Defers `task` until the current frame/interactions have had a chance to
 * settle, so heavy background work doesn't block the initial render.
 *
 * Replaces the deprecated `InteractionManager.runAfterInteractions` (RN 0.81
 * deprecated the whole API). A zero-delay timeout is sufficient here because
 * the scheduled work already yields between batches, so the UI thread stays
 * responsive.
 */
export function runAfterInteractions<T>(task: () => Promise<T> | T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      Promise.resolve()
        .then(() => task())
        .then(resolve, reject);
    }, 0);
  });
}
