import { httpClient } from "./httpClient";

export type PlatformEmailStatus = {
  sendingReady: boolean;
  emailEnabled: boolean;
  hasApiKey: boolean;
  hasFromAddress: boolean;
  fromAddress: string | null;
  hint: string;
};

export type ReviewDeliveryMode = "google_sheet" | "email_app";

export type EmailSettings = {
  platformEmail: PlatformEmailStatus;
  reviewRequestEnabled: boolean;
  reviewDeliveryMode: ReviewDeliveryMode;
  checkoutDigitalEnabled: boolean;
  checkoutEmailEnabled: boolean;
  companyName: string | null;
  displayName: string;
  emailFromName: string | null;
  emailReplyTo: string | null;
  reviewLinkUrl: string | null;
  reviewEmailSubject: string | null;
  reviewEmailBody: string | null;
  checkoutEmailSubject: string | null;
  checkoutEmailBody: string | null;
  defaults: {
    reviewEmailSubject: string;
    reviewEmailBody: string;
    checkoutEmailSubject: string;
    checkoutEmailBody: string;
  };
  canEditReviewEmail: boolean;
  canEditCheckoutEmail: boolean;
  sendingWillWorkWhenConfigured: boolean;
};

export type EmailSettingsUpdate = {
  emailFromName?: string | null;
  emailReplyTo?: string | null;
  reviewLinkUrl?: string | null;
  reviewEmailSubject?: string | null;
  reviewEmailBody?: string | null;
  checkoutEmailSubject?: string | null;
  checkoutEmailBody?: string | null;
};

export const emailSettingsAPI = {
  get(): Promise<EmailSettings> {
    return httpClient.get<EmailSettings>("/email-settings");
  },

  update(payload: EmailSettingsUpdate): Promise<EmailSettings> {
    return httpClient.put<EmailSettings>("/email-settings", payload);
  },
};
