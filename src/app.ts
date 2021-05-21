'use strict';

require('dotenv-safe').config();

import fastify from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import fastifyPrintRoutes from 'fastify-print-routes';
import fastifySensible from 'fastify-sensible';

import { healthHandlers } from './health/handlers';
import { usersHandlers } from './users/handlers';
import { tweetsHandlers } from './tweets/handlers';
// import { paymentRoutes } from './payments/routes';
// import { PAYMENTS_CONFIG } from './payments/config';
// import { paymentsNotificationsRoutes } from './payments/notifications/routes';
// import { PAYMENTS_NOTIFICATIONS_CONFIG } from './payments/notifications/config';

export function app() {
  const app = fastify({ logger: true });

  app.register(fastifyHelmet);
  app.register(fastifySensible);

  if (process.env.NODE_ENV !== 'production') {
    app.register(fastifyPrintRoutes);
  }

  // ROUTES start
  app.register(healthHandlers);
  app.register(usersHandlers);
  app.register(tweetsHandlers);
  // ROUTES end
  return app;
}
