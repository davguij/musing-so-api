import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { ROUTE_URLS } from '../../constants';
import { db } from '../../services/db';

import {
  // CheckoutSessionCompletedPayload,
  // CustomerSubscriptionUpdatedData,
  // InvoiceStatusPayload,
  PaymentsNotificationsPost,
  StripeSubscriptionWithPlan,
} from './types';

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: '2020-08-27',
});

export async function paymentsNotificationsHandlers(server: FastifyInstance) {
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    function (_req, body, done) {
      try {
        var newBody = {
          raw: body,
        };
        done(null, newBody);
      } catch (error) {
        error.statusCode = 400;
        done(error, undefined);
      }
    }
  );

  server.post<PaymentsNotificationsPost>(
    ROUTE_URLS.paymentNotifications,
    async ({ headers, body }) => {
      const signature = headers['stripe-signature'];
      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          body.raw,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        server.log.error(err);
        throw server.httpErrors.badRequest();
      }

      const { data, type } = event;
      const { object: stripeData } = data;

      // It might be that we need to listen to the
      // 'customer.subscription.created' event too.
      // However, because listening to them both could potentially
      // cause a nasty race condition, because when created most likely
      // the subscription will not be active yet, because it wasn't paid for,
      // we'll keep it like this for now and hope that all new subscriptions
      // trigger the "updated" event.
      if (type === 'customer.subscription.updated') {
        try {
          const customerSubscriptionUpdatedData = <StripeSubscriptionWithPlan>(
            stripeData
          );

          let remainingQuota = 0;
          if (customerSubscriptionUpdatedData.status === 'active') {
            if (
              customerSubscriptionUpdatedData.plan.id ===
              process.env.BASIC_PLAN_STRIPE_ID
            ) {
              remainingQuota = parseInt(process.env.BASIC_PLAN_QUOTA);
            } else if (
              customerSubscriptionUpdatedData.plan.id ===
              process.env.UNLIMITED_PLAN_STRIPE_ID
            ) {
              remainingQuota = -1;
            }
          }

          await db.user.update({
            where: {
              stripeCustomerId: <string>(
                customerSubscriptionUpdatedData.customer
              ),
            },
            data: {
              stripeSubscriptionId: customerSubscriptionUpdatedData.id,
              quotaRefreshDate: new Date(
                customerSubscriptionUpdatedData.current_period_end * 1000
              ),
              remainingQuota,
            },
          });
        } catch (err) {
          server.log.error(err);
          throw server.httpErrors.internalServerError();
        }
      }

      return { success: true };
    }
  );
}
