import { StatusCodes } from 'http-status-codes';
import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import Twitter from 'twitter-v2';
import firebaseAuth from '@useship/fastify-firebase-auth';

import { CREDENTIALS, ROUTE_URLS } from '../constants';
import { db } from '../services/db';

import { UsersPost, UsersPatch } from './types';
import { sendVerificationMail } from '../services/email';
import { addMonths, isPast } from 'date-fns';

export async function usersHandlers(server: FastifyInstance) {
  server.register(firebaseAuth, { serviceAccount: CREDENTIALS });

  server.post<UsersPost>(
    ROUTE_URLS.users,
    async ({ userDetails, body }, reply) => {
      const { oauthAccessToken, oauthTokenSecret, twitterId } = body;

      const savedUser = await db.user.upsert({
        where: { sub: userDetails.sub },
        update: {
          email: userDetails.email,
          isEmailVerified: userDetails.email_verified,
          twitterUserId: twitterId,
          twitterAccessToken: oauthAccessToken,
          twitterTokenSecret: oauthTokenSecret,
        },
        create: {
          sub: userDetails.sub,
          email: userDetails.email,
          isEmailVerified: userDetails.email_verified,
          twitterUserId: twitterId,
          twitterAccessToken: oauthAccessToken,
          twitterTokenSecret: oauthTokenSecret,
          remainingQuota: 20,
          quotaRefreshDate: addMonths(new Date(), 1),
        },
        select: {
          sub: true,
          email: true,
          remainingQuota: true,
          quotaRefreshDate: true,
          isEmailVerified: true,
        },
      });

      reply.code(StatusCodes.CREATED);
      const { sub, email, remainingQuota, quotaRefreshDate, isEmailVerified } =
        savedUser;
      const isActive = remainingQuota > 0 && !isPast(quotaRefreshDate);
      return { sub, email, isEmailVerified, isActive };
    }
  );

  // Check if user is active and has a valid email address
  server.get(ROUTE_URLS.users, async ({ userDetails }) => {
    const savedUser = await db.user.findUnique({
      where: { sub: userDetails.sub },
    });
    const { sub, email, remainingQuota, quotaRefreshDate, isEmailVerified } =
      savedUser;
    const isActive = remainingQuota > 0 && !isPast(quotaRefreshDate);
    return { sub, email, isEmailVerified, isActive };
  });

  // Retrieve user's Twitter details
  server.get(ROUTE_URLS.userTwitterInfo, async ({ userDetails }) => {
    const user = await db.user.findUnique({ where: { sub: userDetails.sub } });

    // Fetch the Twitter user details
    // (displayName, username, avatar)
    const twitterClient = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: user.twitterAccessToken,
      access_token_secret: user.twitterTokenSecret,
    });

    const userInfo = await twitterClient.get<{ data: any }>(
      `users/${user.twitterUserId}`,
      {
        'user.fields': ['name', 'username', 'profile_image_url'],
      }
    );
    return userInfo.data;
  });

  // Add/change user's email
  server.patch<UsersPatch>(ROUTE_URLS.users, async ({ userDetails, body }) => {
    const updatedUser = await db.user.update({
      where: { sub: userDetails.sub },
      data: {
        email: body.email,
        isEmailVerified: false,
        verificationCode: { create: { code: nanoid() } },
      },
      select: { sub: true, email: true, verificationCode: true },
    });

    try {
      await sendVerificationMail(
        updatedUser.email,
        updatedUser.sub,
        updatedUser.verificationCode.code
      );

      return { sub: updatedUser.sub };
    } catch (err) {
      server.log.error(err);
      throw server.httpErrors.badGateway(JSON.stringify(err));
    }
  });
}
