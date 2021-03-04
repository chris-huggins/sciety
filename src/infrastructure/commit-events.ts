import * as IO from 'fp-ts/IO';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import { constVoid, flow, pipe } from 'fp-ts/function';
import { Pool } from 'pg';
import * as L from './logger';
import { domainEvent } from '../types/codecs/DomainEvent';
import { DomainEvent, RuntimeGeneratedEvent } from '../types/domain-events';

type Dependencies = {
  inMemoryEvents: Array<DomainEvent>,
  pool: Pool,
  logger: L.LoggerIO,
};

// TODO: should return a TaskEither
type CommitEvents = (event: ReadonlyArray<RuntimeGeneratedEvent>) => RT.ReaderTask<Dependencies, void>;

export const commitEvents: CommitEvents = (events) => ({ inMemoryEvents, pool, logger }) => pipe(
  events,
  T.traverseArray(flow(
    T.of,
    T.chainFirst(flow(
      domainEvent.encode,
      ({
        id, type, date, ...payload
      }) => [id, type, date, payload],
      (values) => async () => pool.query(
        'INSERT INTO events (id, type, date, payload) VALUES ($1, $2, $3, $4);',
        values,
      ),
    )),
    T.chainFirst(flow(
      (event) => ({ event }),
      L.info('Event committed'),
      IO.chain(logger),
      T.fromIO,
    )),
    T.chainFirst(flow((event) => inMemoryEvents.push(event), T.of)),
  )),
  T.map(constVoid),
);
