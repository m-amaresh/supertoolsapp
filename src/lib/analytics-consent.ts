/**
 * Browser-side consent helpers and the constants that name the stored choice.
 *
 * These keys deliberately live here rather than in `analytics.ts`. `ConsentManager`
 * is a client component, so anything it imports is pulled into the client bundle —
 * and `analytics.ts` reads `VERCEL_ENV`, which only exists on the server. Keeping
 * this module as the one thing the banner imports is what keeps `analytics.ts`
 * server-only, so that read cannot silently evaluate to `undefined` in a browser.
 *
 * Import direction is therefore one-way: `analytics.ts` may import from here,
 * never the reverse.
 */

export const CONSENT_NAMESPACE = "supertools_consent";

/**
 * Silktide derives both keys from the namespace: `stcm.<ns>.consent.<typeId>`
 * and `stcm.<ns>.hasConsented`. The analytics type ID in `ConsentManager` must
 * stay "analytics" for these to line up.
 */
export const ANALYTICS_CONSENT_KEY = `stcm.${CONSENT_NAMESPACE}.consent.analytics`;
export const HAS_CONSENTED_KEY = `stcm.${CONSENT_NAMESPACE}.hasConsented`;

export const ANALYTICS_CONSENT_SIGNAL = "analytics_storage";

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remove GA cookies at the host and parent-domain scopes used by gtag.js. */
export function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => parts.slice(i).join("."))];

  for (const name of names) {
    for (const domain of domains) {
      // biome-ignore lint/suspicious/noDocumentCookie: synchronous deletion with explicit domain scopes, including browsers without Cookie Store API
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

/** The stored analytics choice, or `undefined` when storage cannot be read. */
function readStoredChoice(): string | null | undefined {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY);
  } catch {
    return undefined;
  }
}

/**
 * Make a withdrawal survive a reload.
 *
 * Silktide swallows failed localStorage writes, so a refused "false" can leave
 * an earlier "true" in place, and the bootstrap would grant consent again on
 * the next load. Removing the key is the fallback: a missing choice reads as
 * denied in both the bootstrap and Silktide, and removal cannot hit a quota.
 *
 * Returns true only when the stored value is verifiably not a grant.
 */
export function persistWithdrawal(): boolean {
  const before = readStoredChoice();
  if (before === "false" || before === null) return true;
  try {
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Reported through the check below.
  }
  const after = readStoredChoice();
  return after === "false" || after === null;
}

/**
 * Runs after Silktide records a refusal: on save, and on every load.
 *
 * Removal is always attempted first. Silktide's `localStorageAvailable` comes
 * from a write probe, so a full quota reports it false while an earlier grant
 * is still readable — and the bootstrap would replay that grant on reload.
 *
 * Only when storage cannot even be read is the warning suppressed: then the
 * bootstrap cannot read a grant either, and warning would be a false alarm on
 * every visit for anyone who blocks site data.
 */
export function onAnalyticsReject(): void {
  clearAnalyticsCookies();
  if (persistWithdrawal() || readStoredChoice() === undefined) {
    clearUnsavedStatus();
    return;
  }
  setConsentStatus("unsaved");
}

/** Clear a withdrawal warning once a later choice has been stored. */
export function clearUnsavedStatus(): void {
  if (consentStatus === "unsaved") setConsentStatus("ready");
}

/**
 * Silktide traps Tab inside the banner, wrapping from its last control to its
 * first and back. The banner has no backdrop and does not block the page, so
 * that trap only holds keyboard users in it until they answer. Stop the vendor
 * handler (registered on the banner) so Tab keeps native document order.
 * Register on document in the capture phase so this runs first.
 */
export function releaseBannerTabTrap(event: KeyboardEvent): void {
  if (
    event.key === "Tab" &&
    event.target instanceof Element &&
    event.target.closest("#stcm-banner")
  ) {
    event.stopPropagation();
  }
}

/*
 * Silktide's modal has no backdrop here (`backdrop.show: false`), so nothing
 * stops the page behind it being clicked, focused or navigated. Make every
 * other body child inert while it is open, remembering which were inert
 * already. Inert content still takes focus away when clicked, leaving it on
 * <body>, where Silktide's Escape handler (bound to the modal) never hears a
 * key — so focus is also held inside, and Escape is handled document-wide.
 */
const inertedByModal: Element[] = [];
let isolated = false;

const preferencesModal = () => document.getElementById("stcm-modal");
const inModal = (target: EventTarget | null) =>
  target instanceof Node && Boolean(preferencesModal()?.contains(target));

/** A press outside the dialog must not move focus out of it. */
function holdFocus(event: MouseEvent): void {
  if (!inModal(event.target)) event.preventDefault();
}

/** Escape from anywhere; inside the dialog Silktide already handles it. */
function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || inModal(event.target)) return;
  window.silktideConsentManager?.getInstance()?.toggleModal(false);
}

/** Safety net for any other way focus leaves, e.g. a scripted blur. */
function reclaimFocus(event: FocusEvent): void {
  if (!inModal(event.target) || inModal(event.relatedTarget)) return;
  queueMicrotask(() => {
    // Not while the window itself is losing focus, or once closed.
    if (!isolated || !document.hasFocus() || inModal(document.activeElement))
      return;
    preferencesModal()
      ?.querySelector<HTMLElement>(".stcm-modal-close")
      ?.focus();
  });
}

/**
 * One opening of the preferences dialog: what opened it, and whether the
 * visitor answered (saved or rejected) before it closed.
 */
interface PreferencesSession {
  opener: HTMLElement | null;
  answered: boolean;
}
let pendingOpener: HTMLElement | null = null;
let session: PreferencesSession | null = null;

const ANSWER_CONTROLS = ".stcm-modal-save, .stcm-modal-reject-all";

/**
 * Record an answer before Silktide's own click handler closes the dialog.
 * Register on document in the capture phase so this runs first.
 */
export function noteConsentAnswer(event: MouseEvent): void {
  if (
    session &&
    event.target instanceof Element &&
    event.target.closest(ANSWER_CONTROLS)
  ) {
    session.answered = true;
  }
}

export function isolatePreferences(): void {
  releasePreferences();
  session = { opener: pendingOpener, answered: false };
  pendingOpener = null;
  const wrapper = document.getElementById("stcm-wrapper");
  for (const child of Array.from(document.body.children)) {
    if (child === wrapper || child.hasAttribute("inert")) continue;
    if (child.tagName === "SCRIPT" || child.tagName === "NOSCRIPT") continue;
    child.setAttribute("inert", "");
    inertedByModal.push(child);
  }
  document.addEventListener("mousedown", holdFocus, true);
  document.addEventListener("keydown", closeOnEscape, true);
  document.addEventListener("focusout", reclaimFocus, true);
  isolated = true;
}

export function releasePreferences(): void {
  isolated = false;
  document.removeEventListener("mousedown", holdFocus, true);
  document.removeEventListener("keydown", closeOnEscape, true);
  document.removeEventListener("focusout", reclaimFocus, true);
  for (const child of inertedByModal.splice(0)) child.removeAttribute("inert");
}

/**
 * Silktide fires its close hook on every `toggleModal(false)`, including the
 * one inside a banner choice when the dialog was never open. Only a real
 * session is handed on, and handling is deferred because Silktide's own close
 * handler still touches the instance after the hook returns.
 */
export function onPreferencesClosed(): void {
  releasePreferences();
  const closed = session;
  session = null;
  if (closed) queueMicrotask(() => handlePreferencesClosed(closed));
}

/**
 * Silktide removes the banner when preferences open and does not bring it
 * back when they close unanswered; its replacement icon is hidden by site CSS.
 * Restore the banner after an unanswered close on a first visit, then return
 * focus to whatever opened the dialog.
 *
 * An answered close never restores it, even if Silktide could not store the
 * answer (a full quota): the visitor would see their click undone.
 */
function handlePreferencesClosed(closed: PreferencesSession): void {
  const instance = window.silktideConsentManager?.getInstance();
  if (!instance) return;
  if (
    !closed.answered &&
    !instance.getHasConsented() &&
    // Without storage nothing can be answered, so restoring would never end.
    instance.localStorageAvailable
  ) {
    reinitConsentManager();
  }
  if (closed.opener?.isConnected) {
    closed.opener.focus();
  } else if (!instance.getHasConsented()) {
    // Opened from the banner, whose button is gone: the visitor was working in
    // the banner, so continue there. (Build-time focus is off, see `mode`.)
    document
      .querySelector<HTMLElement>("#stcm-banner .stcm-accept-all")
      ?.focus();
  }
}

/** Open the preferences dialog, returning focus to `opener` when it closes. */
export function openConsentPreferences(opener: HTMLElement): void {
  pendingOpener = opener;
  window.silktideConsentManager?.getInstance()?.toggleModal(true);
}

/**
 * Fill the accessibility gaps in Silktide's generated markup. It rebuilds its
 * DOM on every `init`/`update`, so this runs after each of them.
 */
export function enhanceConsentUi(): void {
  const banner = document.getElementById("stcm-banner");
  if (banner) {
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie consent");
  }

  const modal = document.getElementById("stcm-modal");
  if (!modal) return;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const title = modal.querySelector("header h1");
  if (title) {
    title.id = "stcm-modal-title";
    modal.setAttribute("aria-labelledby", title.id);
  }
  // Silktide labels this only from a config key that would also rename the
  // banner's preferences button; otherwise it is an unnamed SVG button.
  modal
    .querySelector(".stcm-modal-close")
    ?.setAttribute("aria-label", "Close cookie preferences");

  // Each toggle's <label> holds only aria-hidden decoration, so name the
  // checkbox from its fieldset legend and describe it with the description.
  for (const fieldset of Array.from(
    modal.querySelectorAll("#stcm-form fieldset"),
  )) {
    const input = fieldset.querySelector('input[type="checkbox"]');
    if (!input?.id) continue;
    const legend = fieldset.querySelector("legend");
    if (legend) {
      legend.id = `${input.id}-label`;
      input.setAttribute("aria-labelledby", legend.id);
    }
    const description = fieldset.querySelector(".stcm-consent-description");
    if (description) {
      description.id = `${input.id}-description`;
      input.setAttribute("aria-describedby", description.id);
    }
  }
}

/** Rebuild Silktide's UI from its current config, keeping our patches. */
export function reinitConsentManager(): void {
  // A rebuild destroys an open modal without running its close hook.
  releasePreferences();
  session = null;
  window.silktideConsentManager?.update({});
  enhanceConsentUi();
}

/** Synchronize storage permission without stopping cookieless measurement. */
export function syncAnalyticsConsent(): void {
  const granted = hasAnalyticsConsent();
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
  if (!granted) clearAnalyticsCookies();
  const instance = window.silktideConsentManager?.getInstance();
  if (!instance) return;
  instance.updateCheckboxState(false);
  if (instance.getHasConsented()) {
    instance.removeBanner();
  } else if (!document.getElementById("stcm-banner")) {
    // Reinitialization restores the prompt and its listeners after storage
    // clearing. Ordinary answers preserve any open preferences modal.
    reinitConsentManager();
  }
}

/** `unsaved`: a withdrawal could not be stored; the manager still works. */
export type ConsentStatus = "loading" | "ready" | "unavailable" | "unsaved";
let consentStatus: ConsentStatus = "loading";
const statusListeners = new Set<() => void>();
export const getConsentStatus = () => consentStatus;
export const getServerConsentStatus = (): ConsentStatus => "loading";
export function subscribeConsentStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}
export function setConsentStatus(status: ConsentStatus): void {
  consentStatus = status;
  for (const listener of statusListeners) listener();
}
