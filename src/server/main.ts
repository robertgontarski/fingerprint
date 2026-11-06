import { createServer } from 'node:http';
import { createRequestListener } from './app.ts';
import { loadConfig } from './config.ts';
import { createRepository } from './db/repository.ts';
import { openDatabase } from './db/schema.ts';
import { createJsonLogger } from './logger.ts';

const config = loadConfig(process.env);
const logger = createJsonLogger((line) => process.stdout.write(line));
const database = openDatabase(config.databasePath);
const clock = (): Date => new Date();
const server = createServer(createRequestListener({ config, repository: createRepository(database, clock), logger, clock }));

server.listen(config.port, config.listenHost, () => {
  logger.info('server-started', { listen: `${config.listenHost}:${config.port}`, database: config.databasePath });
  config.sites.forEach(({ name, origin }) => logger.info('site-ready', { name, url: origin, lab: `${origin}/lab` }));
});

const shutdown = (): void => {
  server.close(() => {
    database.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
