import { RequestGenericInterface } from 'fastify';

export interface VerifyUsersGet extends RequestGenericInterface {
  Params: {
    userSub: string;
    verificationCode: string;
  };
}
