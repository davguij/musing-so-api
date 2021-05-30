import { FastifyInstance } from 'fastify';
import fastifyAuth from 'fastify-auth';
import fastifyBasicAuth from 'fastify-basic-auth';
import Twitter from 'twitter-v2';
import BadWords from 'bad-words';
import emojiRegexRGI from 'emoji-regex/RGI_Emoji';
import { nanoid } from 'nanoid';

import { GPT3_SETTINGS, ROUTE_URLS } from '../constants';
import { TweetsResponse } from '../tweets/types';
import { completion } from '../services/openai';

const profanityFilter = new BadWords();

async function validate(username: string, password: string) {
  if (username !== process.env.DEMO_USER || password !== process.env.DEMO_PW) {
    throw new Error('Unauthorized');
  }
}

export async function demoHandlers(server: FastifyInstance) {
  await server.register(fastifyAuth);
  await server.register(fastifyBasicAuth, { validate });

  server.addHook('preHandler', server.auth([server.basicAuth]));

  server.get(ROUTE_URLS.demo, async () => {
    // Most of this code is shared (copied) from the tweetsHandler
    // It will need to be cleaned up after passing OpenAI review process

    const twitterClient = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      // Using davguij tokens as a shortcut
      // They will need to be rotated afterwards
      access_token_key: '304488825-inWBThZcrjbPuwOK1iIFZglOAdcKFiOK0fJIXG78',
      access_token_secret: 'bOOdsS1UpnHi6lBmO4XPj3KkTCjukUzXwuvcfZAPPiif3',
    });

    const twitterId = '745273'; // @naval
    const userTweets = await twitterClient.get<TweetsResponse>(
      `users/${twitterId}/tweets`,
      {
        exclude: ['retweets', 'replies'],
        max_results: '100',
      }
    );

    const cleanTweets = userTweets.data
      .filter((tweet) => profanityFilter.isProfane(tweet.text) === false)
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

    const result = generated.map((item) => {
      if (profanityFilter.isProfane(item.text)) {
        throw server.httpErrors.unprocessableEntity();
      }
      return { id: nanoid(), text: item.text.trim() };
    });

    return result;
  });
}
