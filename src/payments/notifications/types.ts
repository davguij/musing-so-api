import { RouteGenericInterface } from 'fastify/types/route';
import Stripe from 'stripe';

export interface PaymentsNotificationsPost extends RouteGenericInterface {
  Body: {
    raw: string | Buffer;
  };
}

// export interface PaymentNotificationPayload {
//   customer: string;
//   subscription: string;
// }

// export interface CheckoutSessionCompletedPayload
//   extends PaymentNotificationPayload {
//   client_reference_id: string;
//   payment_status: 'paid';
// }

// export interface InvoiceStatusPayload extends PaymentNotificationPayload {
//   billing_reason: 'subscription_create';
//   paid: boolean;
// }

// export interface CustomerSubscriptionUpdatedData {
//   id: string;
//   customer: string;
//   current_period_end: number;
//   stat
// }

export interface StripeSubscriptionWithPlan extends Stripe.Subscription {
  plan: {
    id: string;
  };
}
