import { StatusCodes } from 'http-status-codes';
import { FastifyInstance } from 'fastify';
import firebaseAuth from '@useship/fastify-firebase-auth';

import { CREDENTIALS, ROUTE_URLS } from '../constants';
import { db } from '../services/db';

import { UsersPost, UsersPut } from './types';

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
        },
        select: { sub: true, isActive: true, email: true },
      });

      reply.code(StatusCodes.CREATED);
      return savedUser;
    }
  );

  // Check if user is active
  server.get(ROUTE_URLS.users, async ({ userDetails }) => {
    return db.user.findUnique({
      where: { sub: userDetails.sub },
      select: { sub: true, isActive: true },
    });
  });

  server.put<UsersPut>(ROUTE_URLS.users, async ({ userDetails, body }) => {
    return db.user.update({
      where: { sub: userDetails.sub },
      data: { email: body.email },
      select: { sub: true },
    });
  });
}
