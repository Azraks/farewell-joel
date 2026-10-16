interface FullscreenAdapter {
  isFullscreen: () => boolean;
  isSlideshowFullscreen: () => boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
}

/** Serialize fullscreen requests so an old exit cannot close a newly opened show. */
export function createSlideshowFullscreen(adapter: FullscreenAdapter, onExit: () => void) {
  let requested = false;
  let owned = false;
  let changing = false;
  let pending = Promise.resolve();

  function reconcile() {
    pending = pending.then(async () => {
      changing = true;
      try {
        if (requested && !adapter.isFullscreen()) {
          await adapter.enter();
          owned = adapter.isSlideshowFullscreen();
        }
        if (!requested && owned && adapter.isSlideshowFullscreen()) {
          await adapter.exit();
          owned = false;
        }
      } catch {
        // Fullscreen is optional; denied requests leave the overlay usable.
      } finally {
        changing = false;
      }
    });
    return pending;
  }

  return {
    open() {
      requested = true;
      return reconcile();
    },
    close() {
      requested = false;
      return reconcile();
    },
    changed() {
      if (!changing && requested && owned && !adapter.isFullscreen()) {
        requested = false;
        owned = false;
        onExit();
      }
    },
  };
}
