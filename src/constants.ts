export const ROUTE_URLS = {
  health: '/health',
  users: '/users',
  tweets: '/tweets',
} as const;

export const CREDENTIALS = require('../credentials/machine-d1643-firebase-adminsdk-9jpc7-5876bbb667.json');

export const GPT3_SETTINGS = {
  temperature: 0.8,
  presencePenalty: 0.4,
  frequencyPenalty: 0.75,
} as const;
