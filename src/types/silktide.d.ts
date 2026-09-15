/**
 * Ambient types for the vendored Silktide Consent Manager v2.0
 * (`public/consent/silktide-consent-manager.js`). The library ships no types,
 * so only the surface this site actually uses is declared here.
 */

interface SilktideConsentType {
  /** Also the localStorage suffix: `stcm.consent.<id>`. */
  id: string;
  label: string;
  description: string;
  /** Cannot be switched off, and is granted on first load. */
  required?: boolean;
  defaultValue?: boolean;
  /** Consent Mode signal(s) this type grants; the library calls gtag itself. */
  gtag?: string | string[];
  onReject?: () => void;
}

interface SilktideConfig {
  namespace?: string;
  consentTypes: SilktideConsentType[];
  prompt?: {
    position?: "center" | "bottomLeft" | "bottomCenter" | "bottomRight";
  };
  icon?: { position?: "bottomLeft" | "bottomRight" };
  backdrop?: { show?: boolean };
  autoShow?: boolean;
  eventName?: string;
  debug?: boolean;
  text?: {
    prompt?: {
      description?: string;
      acceptAllButtonText?: string;
      acceptAllButtonAccessibleLabel?: string;
      rejectNonEssentialButtonText?: string;
      rejectNonEssentialButtonAccessibleLabel?: string;
      preferencesButtonText?: string;
      preferencesButtonAccessibleLabel?: string;
    };
    preferences?: {
      title?: string;
      description?: string;
      saveButtonText?: string;
      saveButtonAccessibleLabel?: string;
      creditLinkText?: string;
      creditLinkAccessibleLabel?: string;
    };
  };
}

interface SilktideInstance {
  /** Opens or closes the preferences modal. */
  toggleModal(show: boolean): void;
  updateCheckboxState(save: boolean): void;
  getHasConsented(): boolean;
  removeBanner(): void;
}

interface Window {
  gtag?: (
    command: "consent",
    action: "update",
    values: { analytics_storage: "granted" | "denied" },
  ) => void;
  silktideConsentManager?: {
    init(config: SilktideConfig): void;
    update(config: Partial<SilktideConfig>): void;
    resetConsent(): void;
    getInstance(): SilktideInstance | null;
  };
}
