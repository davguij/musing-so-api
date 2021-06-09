'use strict';

require('dotenv-safe').config();

import fastify from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import fastifyPrintRoutes from 'fastify-print-routes';
import fastifySensible from 'fastify-sensible';

import { healthHandlers } from './health/handlers';
import { usersHandlers } from './users/handlers';
import { tweetsHandlers } from './tweets/handlers';
import { verifyUsersHandlers } from './users/verify/handlers';
import { paymentHandlers } from './payments/handlers';
import { paymentsNotificationsHandlers } from './payments/notifications/handlers';

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
  app.register(verifyUsersHandlers);
  app.register(tweetsHandlers);
  app.register(paymentHandlers);
  app.register(paymentsNotificationsHandlers);
  // ROUTES end
  return app;
}
