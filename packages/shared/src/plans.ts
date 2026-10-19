export const BILLING_CYCLES = ['DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const;
export const SUBSCRIPTION_STATUSES = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'EXPIRED',
  'PAUSED',
  'CANCELED',
] as const;
export const EXPIRY_ACTIONS = ['NOTIFY_ONLY', 'SWITCH_TO_FREE', 'PAUSE', 'CANCEL'] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type ExpiryAction = (typeof EXPIRY_ACTIONS)[number];
