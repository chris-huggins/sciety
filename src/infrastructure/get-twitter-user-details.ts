import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/lib/TaskEither';
import { GetTwitterResponse, TwitterResponse } from './get-twitter-response';
import isAxiosError from './is-axios-error';
import { Logger, Payload } from './logger';
import { UserId } from '../types/user-id';

type TwitterUserDetails = {
  avatarUrl: string,
  displayName: string,
  handle: string;
};

export type GetTwitterUserDetails = (userId: UserId) => TE.TaskEither<'not-found' | 'unavailable', TwitterUserDetails>;

const handleOk = (
  logger: Logger,
  userId: UserId,
) => (
  data: TwitterResponse,
): TE.TaskEither<'not-found' | 'unavailable', TwitterUserDetails> => {
  if (data.data) {
    logger('debug', 'Data from Twitter', { userId, data });
    return TE.right({
      avatarUrl: data.data.profile_image_url,
      displayName: data.data.name,
      handle: data.data.username,
    });
  }
  logger('debug', 'Twitter user not found', { userId, data });
  return TE.left('not-found');
};

const handleError = (logger: Logger, userId: UserId) => (error: unknown): 'not-found' | 'unavailable' => {
  const payload: Payload = { error, userId };

  if (isAxiosError(error) && error.response) {
    payload.status = error.response.status;
    payload.data = error.response.data;

    if (error.response.status === 400) {
      logger('debug', 'Twitter user not found', payload);
      return 'not-found';
    }
  }

  logger('error', 'Request to Twitter API for user details failed', payload);
  return 'unavailable';
};

export default (
  getTwitterResponse: GetTwitterResponse,
  logger: Logger,
): GetTwitterUserDetails => (
  (userId) => pipe(
    TE.tryCatch(
      async () => getTwitterResponse(`https://api.twitter.com/2/users/${userId}?user.fields=profile_image_url`),
      handleError(logger, userId),
    ),
    TE.chain(handleOk(logger, userId)),
  )
);
