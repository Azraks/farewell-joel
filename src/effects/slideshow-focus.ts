/** Keep keyboard navigation in the overlay even when fullscreen is unavailable. */
export function createSlideshowFocus(root: HTMLElement, initialFocus: HTMLElement) {
  const savedInert = new Map<HTMLElement, boolean>();
  let returnFocus: HTMLElement | null = null;
  let savedOverflow = '';

  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Farewell slideshow');

  root.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || root.querySelector('dialog[open]')) return;
    const focusable = [...root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], video[controls], iframe, [tabindex="0"]',
    )].filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  });

  return {
    open() {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      savedOverflow = document.body.style.overflow;
      // Also works if the overlay is later wrapped in a layout container.
      let child: HTMLElement = root;
      while (child.parentElement) {
        for (const sibling of child.parentElement.children) {
          if (sibling !== child && sibling instanceof HTMLElement) {
            savedInert.set(sibling, sibling.inert);
            sibling.inert = true;
          }
        }
        if (child.parentElement === document.body) break;
        child = child.parentElement;
      }
      document.body.style.overflow = 'hidden';
      initialFocus.focus({ preventScroll: true });
    },
    close() {
      savedInert.forEach((inert, element) => { element.inert = inert; });
      savedInert.clear();
      document.body.style.overflow = savedOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    },
  };
}
