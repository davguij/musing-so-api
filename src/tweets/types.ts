import { RequestGenericInterface } from 'fastify';

export type TweetsResponse = {
  data: Tweet[];
  meta: any;
};

export type Tweet = {
  id: string;
  text: string;
  public_metrics: any;
  non_public_metrics: any;
};

export interface TweetsGet extends RequestGenericInterface {
  Querystring: {
    page: number;
  };
}

export interface TweetsPatch extends RequestGenericInterface {
  Body: {
    liked: boolean;
  };
  Params: {
    id: string;
  };
}
