import anyTest, { TestInterface } from 'ava';
import { FastifyInstance } from 'fastify';
import { app } from '../app';

const test = anyTest as TestInterface<{ server: FastifyInstance }>;

test.beforeEach((t) => {
  t.context.server = app();
});

test('/health', async (t) => {
  const response = await t.context.server.inject({
    method: 'GET',
    url: '/health',
  });
  const expected = { success: true };
  t.is(response.statusCode, 200);
  t.deepEqual(JSON.parse(response.body), expected);
});

test.afterEach((t) => {
  t.context.server.close();
});
