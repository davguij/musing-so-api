export const ROUTE_URLS = {
  health: '/health',
  users: '/users',
  userTwitterInfo: '/users/twitter',
  tweets: '/tweets',
  demo: '/demo',
} as const;

export const CREDENTIALS = JSON.parse(
  Buffer.from(process.env.FIREBASE_ADMIN_CONFIG_B64, 'base64').toString('ascii')
);

export const GPT3_SETTINGS = {
  temperature: 0.8,
  presencePenalty: 0.4,
  frequencyPenalty: 0.75,
} as const;
