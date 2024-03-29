import { FastifyInstance } from 'fastify';
import Twitter from 'twitter-v2';
import emojiRegexRGI from 'emoji-regex/RGI_Emoji';
import BadWords from 'bad-words';
import { isPast } from 'date-fns';
import { shuffle, Direction, ArrayInput } from 'weighted-shuffle';

import firebaseAuth from '@useship/fastify-firebase-auth';
import { CREDENTIALS, GPT_NEO_SETTINGS, ROUTE_URLS } from '../constants';
import { db } from '../services/db';
import { Tweet, TweetsGet, TweetsPatch, TweetsResponse } from './types';
import { completion } from '../services/gpt-neo';
import fastifyRateLimit from 'fastify-rate-limit';
import { randomFloat } from '../utils';

const profanityFilter = new BadWords();

export async function tweetsHandlers(server: FastifyInstance) {
  server.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
  });
  server.register(firebaseAuth, { serviceAccount: CREDENTIALS });

  server.post(ROUTE_URLS.tweets, async ({ userDetails }) => {
    // 1st find user by sub and get Twitter credentials
    const user = await db.user.findUnique({ where: { sub: userDetails.sub } });

    // Let's check if the user still has quota this billing period
    // - Is the quote refresh date in the past?
    // - Is the remaining quota higher than zero?
    // If any of those is no, then we reject the generation attempt
    if (isPast(user.quotaRefreshDate) || user.remainingQuota === 0) {
      throw server.httpErrors.paymentRequired();
    }

    // 2nd retrieve a lot of tweets from user
    const twitterClient = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: user.twitterAccessToken,
      access_token_secret: user.twitterTokenSecret,
    });

    // let twitterUserId = '745273';

    const userTweets = await twitterClient.get<TweetsResponse>(
      `users/${user.twitterUserId}/tweets`,
      // `users/${twitterUserId}/tweets`,
      {
        exclude: ['retweets', 'replies'],
        max_results: '100',
        'tweet.fields': [
          // 'non_public_metrics',
          'public_metrics',
        ],
      }
    );

    // TODO save the retrieved tweets in a cache (Redis or in-memory)

    // Remove mentions, urls and emojis from the text of each tweet
    const cleanTweets = userTweets.data
      // Remove the tweets that include profanity
      .filter((tweet) => profanityFilter.isProfane(tweet.text) === false)
      // Directly remove tweets that have links on them
      .filter((tweet) => {
        const urlRegexp =
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/g;
        return urlRegexp.test(tweet.text) === false;
      });

    // Sort found tweets by their popularity
    // .sort((tweetA, tweetB) => {
    //   if (
    //     tweetA.non_public_metrics.impression_count >
    //     tweetB.non_public_metrics.impression_count
    //   ) {
    //     return -1;
    //   }
    //   if (
    //     tweetA.non_public_metrics.impression_count <
    //     tweetB.non_public_metrics.impression_count
    //   ) {
    //     return 1;
    //   }
    //   return 0;
    // })

    // Do a weighted shuffle so that more popular items are more likely to be first
    const tweetsTuples: ArrayInput<Tweet> = cleanTweets.map((tweet) => {
      const weight =
        parseInt(tweet.public_metrics.like_count) / 5 +
        parseInt(tweet.public_metrics.reply_count) / 2 +
        parseInt(tweet.public_metrics.retweet_count);
      return [{ ...tweet }, Math.round((weight + Number.EPSILON) * 100) / 100];
    });
    const shuffledTweets = shuffle(tweetsTuples, Direction.desc);

    const finalTweets = shuffledTweets
      .map((tweet) => tweet[0])
      .map((tweet) => ({
        // Remove mentions, urls and emojis from the text of each tweet
        ...tweet,
        text: tweet.text
          .replace(/(^|[^@\w])@(\w{1,15})\b/gi, '')
          // .replace(
          //   /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/g,
          //   ''
          // )
          .replace(emojiRegexRGI(), '')
          .replace(/\r?\n|\r/g, ' ')
          .replace(/\s\s+/g, ' ')
          .trim(),
      }))
      .filter((tweet) => tweet.text.length > 0)
      // 25 tweets are 1750 gpt-3 tokens at most
      // Too many tokens, get 10 tweets only instead!!
      // Maybe make it a random number between 5 and 25 and
      // save how many tweets where used for each?
      .slice(0, 10);
    // .reverse();

    // 4th build gpt prompt
    const tweetsForPrompt = finalTweets
      .map((tweet) => `tweet: ${tweet.text}\n###`)
      .join('\n');
    const prompt = `${tweetsForPrompt}\ntweet:`;

    // Generate random settings (within ranges) for GPT-NEO
    const settingsTemperature = randomFloat(
      GPT_NEO_SETTINGS.temperature.min,
      GPT_NEO_SETTINGS.temperature.max
    );
    const settingsPresencePenalty = randomFloat(
      GPT_NEO_SETTINGS.presencePenalty.min,
      GPT_NEO_SETTINGS.presencePenalty.max
    );
    const settingsFrequencyPenalty = randomFloat(
      GPT_NEO_SETTINGS.frequencyPenalty.min,
      GPT_NEO_SETTINGS.frequencyPenalty.max
    );

    // 5th generate a few tweet ideas (3 to 5? or 1 by 1?)
    const generated = await completion(
      prompt,
      settingsTemperature,
      settingsPresencePenalty,
      settingsFrequencyPenalty
    );

    const result = generated.replace('###', '').trim();

    const { text, id } = await db.generatedTweets.create({
      data: {
        text: result,
        userSub: userDetails.sub,
        settingsTemperature,
        settingsPresencePenalty,
        settingsFrequencyPenalty,
      },
      select: {
        text: true,
        id: true,
      },
    });

    await db.user.update({
      where: { sub: userDetails.sub },
      data: { remainingQuota: { decrement: 1 } },
    });

    return { id, text };
  });

  server.get<TweetsGet>(ROUTE_URLS.tweets, async ({ userDetails, query }) => {
    const page = query.page || 0;
    const resultsPerPage = 20 as const;
    return db.generatedTweets.findMany({
      where: { userSub: userDetails.sub },
      select: { id: true, text: true, createdAt: true },
      orderBy: {
        createdAt: 'desc',
      },
      take: resultsPerPage,
      skip: page * resultsPerPage,
    });
  });

  server.patch<TweetsPatch>(
    `${ROUTE_URLS.tweets}/:id`,
    async ({ userDetails, body, params }) => {
      const tweet = await db.generatedTweets.findUnique({
        where: { id: params.id },
      });

      if (tweet.userSub !== userDetails.sub) {
        throw server.httpErrors.forbidden();
      }

      return db.generatedTweets.update({
        where: { id: params.id },
        data: { liked: body.liked },
        select: { id: true, liked: true },
      });
    }
  );
}
