import { RequestGenericInterface } from 'fastify';

export interface UsersPost extends RequestGenericInterface {
  Body: {
    twitterId: string;
    oauthAccessToken: string;
    oauthTokenSecret: string;
  };
}

export interface UsersPut extends RequestGenericInterface {
  Body: {
    email: string;
  };
}
