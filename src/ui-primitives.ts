/**
 * Cohesive accessible UI primitives for ShiftChess's vanilla TypeScript + Vite stack.
 * Interaction & keyboard semantics follow WAI-ARIA APG, Radix UI (MIT),
 * and React Aria Components (Apache 2.0) patterns without adding a framework runtime.
 */

export function bindRovingTablist<T extends HTMLElement>(
  tabs: T[],
  onSelect: (tab: T) => void,
) {
  const activate = (target: T, focus = false) => {
    for (const tab of tabs) {
      const selected = tab === target;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    onSelect(target);
    if (focus) target.focus();
  };

  tabs.forEach((tab, index) => {
    const selected = tab.getAttribute("aria-selected") === "true";
    tab.tabIndex = selected ? 0 : -1;
    tab.addEventListener("click", () => activate(tab, false));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const map: Record<string, number | undefined> = {
        ArrowLeft: index === 0 ? last : index - 1,
        ArrowRight: index === last ? 0 : index + 1,
        Home: 0,
        End: last,
      };
      const nextIndex = map[event.key];
      if (nextIndex === undefined) return;
      event.preventDefault();
      activate(tabs[nextIndex], true);
    });
  });

  return { activate };
}

export function bindDialogAccessibility(
  dialog: HTMLDialogElement,
  { dismissOnBackdrop = true }: { dismissOnBackdrop?: boolean } = {},
) {
  let invoker: HTMLElement | null = null;

  const rememberInvoker = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !dialog.contains(active)) {
      invoker = active;
    }
  };

  const originalShowModal = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    rememberInvoker();
    originalShowModal();
  };

  dialog.addEventListener("close", () => {
    if (invoker && invoker.isConnected && !invoker.closest("[hidden]")) {
      invoker.focus({ preventScroll: true });
    }
    invoker = null;
  });

  if (dismissOnBackdrop) {
    dialog.addEventListener("pointerdown", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  }
}
