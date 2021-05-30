import { FastifyInstance } from 'fastify';
import Twitter from 'twitter-v2';
import emojiRegexRGI from 'emoji-regex/RGI_Emoji';
import BadWords from 'bad-words';

import firebaseAuth from '@useship/fastify-firebase-auth';
import { CREDENTIALS, GPT3_SETTINGS, ROUTE_URLS } from '../constants';
import { db } from '../services/db';
import { TweetsPatch, TweetsResponse } from './types';
import { completion } from '../services/openai';

const profanityFilter = new BadWords();

export async function tweetsHandlers(server: FastifyInstance) {
  server.register(firebaseAuth, { serviceAccount: CREDENTIALS });

  server.get(ROUTE_URLS.tweets, async ({ userDetails }) => {
    // 1st find user by sub and get Twitter credentials
    const user = await db.user.findUnique({ where: { sub: userDetails.sub } });

    // Now check if the user is marked as active,
    // otherwise they can't create the suggestions
    if (user.isActive !== true) {
      throw server.httpErrors.forbidden();
    }

    // 2nd retrieve a lot of tweets from user
    const twitterClient = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: user.twitterAccessToken,
      access_token_secret: user.twitterTokenSecret,
    });

    // let twitterId = '31077598';

    const userTweets = await twitterClient.get<TweetsResponse>(
      `users/${user.twitterUserId}/tweets`,
      // `users/${twitterId}/tweets`,
      {
        exclude: ['retweets', 'replies'],
        max_results: '100',
        'tweet.fields': ['non_public_metrics', 'public_metrics'],
      }
    );

    // TODO save the retrieved tweets in a cache (Redis or in-memory)

    // Remove mentions, urls and emojis from the text of each tweet
    const cleanTweets = userTweets.data
      // Remove the tweets that include profanity
      .filter((tweet) => profanityFilter.isProfane(tweet.text) === false)
      // Sort found tweets by their popularity
      .sort((tweetA, tweetB) => {
        if (
          tweetA.non_public_metrics.impression_count >
          tweetB.non_public_metrics.impression_count
        ) {
          return -1;
        }
        if (
          tweetA.non_public_metrics.impression_count <
          tweetB.non_public_metrics.impression_count
        ) {
          return 1;
        }
        return 0;
      })
      .map((tweet) => ({
        // Remove mentions, urls and emojis from the text of each tweet
        ...tweet,
        text: tweet.text
          .replace(/(^|[^@\w])@(\w{1,15})\b/gi, '')
          .replace(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/g,
            ''
          )
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

    // 4th build gpt-3 prompt
    const tweetsForPrompt = cleanTweets
      .map((tweet) => `tweet: ${tweet.text}\n###`)
      .join('\n');
    const prompt = `This is a tweet generator. It writes new tweets inspired by the already existing ones.\n###\n${tweetsForPrompt}\ntweet:`;

    // return prompt;
    // 5th generate a few tweet ideas (3 to 5? or 1 by 1?)
    const generated = await completion(
      prompt,
      // is this a good temperature?
      // It could be a range in between 0.5 and 0.9
      // Maybe make it random at first to experiment?
      GPT3_SETTINGS.temperature,
      GPT3_SETTINGS.presencePenalty, // could also be a range
      GPT3_SETTINGS.frequencyPenalty // could be a range
    );
    const result = generated.map(async (item) => {
      // Deactivating the openAi profanity endpoint
      // because it's currently not working as it should
      // const isProfane = await isContentProfane(item.text);

      if (profanityFilter.isProfane(item.text)) {
        throw server.httpErrors.unprocessableEntity();
      }

      return db.generatedTweets.create({
        data: {
          text: item.text.trim(),
          userSub: userDetails.sub,
          settingsTemperature: GPT3_SETTINGS.temperature,
          settingsFrequencyPenalty: GPT3_SETTINGS.frequencyPenalty,
          settingsPresencePenalty: GPT3_SETTINGS.presencePenalty,
        },
        select: { id: true, text: true },
      });
    });

    return Promise.all(result);
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
