import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';

import firebaseAuth from '@useship/fastify-firebase-auth';
import { db } from '../services/db';
import { CREDENTIALS, ROUTE_URLS } from '../constants';

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: '2020-08-27',
});

export async function paymentHandlers(server: FastifyInstance) {
  server.register(firebaseAuth, { serviceAccount: CREDENTIALS });

  server.post<{ Body: { priceId: string } }>(
    ROUTE_URLS.payments,
    async ({ userDetails, ip, body: { priceId } }) => {
      let { sub, email, isEmailVerified, stripeCustomerId } =
        await db.user.findUnique({
          where: { sub: userDetails.sub },
          select: {
            sub: true,
            email: true,
            isEmailVerified: true,
            stripeCustomerId: true,
          },
        });

      if (isEmailVerified !== true) {
        throw server.httpErrors.failedDependency();
      }
      try {
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email,
            tax: {
              ip_address: ip,
            },
            expand: ['tax'],
          });
          stripeCustomerId = customer.id;
        }

        await db.user.update({
          where: { sub: userDetails.sub },
          data: {
            stripeCustomerId,
          },
        });

        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: sub,
          customer: stripeCustomerId,

          // {CHECKOUT_SESSION_ID} is a string literal; do not change it!
          // the actual Session ID is returned in the query parameter when your customer
          // is redirected to the success page.
          success_url: `${process.env.STRIPE_CHECKOUT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: process.env.STRIPE_CHECKOUT_CANCEL_URL,
          automatic_tax: {
            enabled: true,
          },
          customer_update: {
            address: 'auto',
          },
        });

        return { sessionId: session.id };
      } catch (err) {
        throw server.httpErrors.badRequest(err.message);
      }
    }
  );

  // TODO this method might need to go in its own file
  server.post(ROUTE_URLS.subscriptions, async ({ userDetails }) => {
    // This method generates an Stripe customer portal session
    const { stripeCustomerId } = await db.user.findUnique({
      where: { sub: userDetails.sub },
    });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: process.env.STRIPE_CHECKOUT_SUCCESS_URL,
    });

    return { url: portalSession.url };
  });
}
