import { FastifyInstance } from 'fastify';
import { ROUTE_URLS } from '../constants';

export async function healthHandlers(server: FastifyInstance) {
  server.get(ROUTE_URLS.health, async () => {
    return { success: true };
  });
}
