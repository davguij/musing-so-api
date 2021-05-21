'use strict';
import 'make-promises-safe';
import { app } from './app';

const server = app();
const start = async () => {
  try {
    await server.listen(parseInt(process.env.PORT) || 3001, '0.0.0.0');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
