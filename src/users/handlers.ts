import { StatusCodes } from 'http-status-codes';
import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import firebaseAuth from '@useship/fastify-firebase-auth';

import { CREDENTIALS, ROUTE_URLS } from '../constants';
import { db } from '../services/db';

import { UsersPost, UsersPatch } from './types';
import { sendVerificationMail } from '../services/email';

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

  // Check if user is active and has a valid email address
  server.get(ROUTE_URLS.users, async ({ userDetails }) => {
    return db.user.findUnique({
      where: { sub: userDetails.sub },
      select: { sub: true, isActive: true, email: true, isEmailVerified: true },
    });
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
