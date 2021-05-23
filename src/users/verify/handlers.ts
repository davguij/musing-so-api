import { FastifyInstance } from 'fastify';
import { isAfter, add, isBefore } from 'date-fns';

import { ROUTE_URLS } from '../../constants';
import { db } from '../../services/db';
import { VerifyUsersGet } from './types';

export async function verifyUsersHandlers(server: FastifyInstance) {
  server.get<VerifyUsersGet>(
    `${ROUTE_URLS.users}/:userSub/:verificationCode`,
    async ({ params }, reply) => {
      const savedCode = await db.verificationCode.findUnique({
        where: { code: params.verificationCode },
        include: { user: true },
      });

      if (savedCode === null) {
        return server.httpErrors.notFound('Verification code not found');
      }

      const isExpired = isBefore(
        add(savedCode.createdAt, {
          minutes: parseInt(
            process.env.EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES
          ),
        }),
        new Date()
      );

      if (isExpired) {
        return server.httpErrors.gone('Verification code expired');
      }

      if (savedCode.userSub !== params.userSub) {
        return server.httpErrors.forbidden('User/code mismatch');
      }

      // Mark email as verified
      await db.user.update({
        where: { sub: savedCode.userSub },
        data: { isEmailVerified: true },
      });

      // Delete the code as it has been used successfully
      await db.verificationCode.delete({ where: { code: savedCode.code } });

      // Redirect the user to success page
      reply.redirect('/welcome');
      return;
    }
  );
}
