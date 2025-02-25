import { Middleware } from '@koa/router';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { StatusCodes } from 'http-status-codes';
import { commandHandler, CommitEvents, toCommand } from './command-handler';
import { GetAllEvents } from './respond-helpful-command';
import * as ReviewId from '../types/review-id';
import { User } from '../types/user';

type Ports = {
  commitEvents: CommitEvents,
  getAllEvents: GetAllEvents,
};

export const respondHandler = (ports: Ports): Middleware<{ user: User }> => async (context, next) => {
  const { user } = context.state;

  const referrer = (context.request.headers.referer ?? '/') as string;
  await pipe(
    O.Do,
    O.apS('reviewId', pipe(context.request.body.reviewid, ReviewId.fromString)),
    O.apS('command', pipe(context.request.body.command, toCommand)),
    O.fold(
      () => context.throw(StatusCodes.BAD_REQUEST),
      commandHandler(ports.commitEvents, ports.getAllEvents, user.id),
    ),
  )();

  context.redirect(`${referrer}#${String(context.request.body.reviewid)}`); // TODO needs moving somewhere else

  await next();
};
