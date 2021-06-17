export const ROUTE_URLS = {
  health: '/health',
  users: '/users',
  userTwitterInfo: '/users/twitter',
  tweets: '/tweets',
  payments: '/payments',
  subscriptions: '/subscriptions',
  paymentNotifications: '/payments/notifications',
} as const;

export const CREDENTIALS = JSON.parse(
  Buffer.from(process.env.FIREBASE_ADMIN_CONFIG_B64, 'base64').toString('ascii')
);

export const GPT3_SETTINGS = {
  temperature: { max: 1, min: 0.6 },
  presencePenalty: { min: 0.4, max: 0.8 },
  frequencyPenalty: { min: 0.3, max: 0.7 },
} as const;

export const GPT_NEO_SETTINGS = {
  temperature: { max: 1, min: 0.6 },
  presencePenalty: { min: 0.4, max: 0.8 },
  frequencyPenalty: { min: 0.3, max: 0.7 },
} as const;
