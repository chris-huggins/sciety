import * as O from 'fp-ts/Option';

import * as T from 'fp-ts/Task';
import * as TO from 'fp-ts/TaskOption';
import { pipe } from 'fp-ts/function';
import { StatusCodes } from 'http-status-codes';
import {
  DefaultContext, DefaultState, Middleware, ParameterizedContext,
} from 'koa';
import { renderErrorPage } from './render-error-page';
import { sessionGroupProperty } from '../follow/finish-follow-command';
import { groupProperty } from '../follow/follow-handler';
import { applyStandardPageLayout } from '../shared-components';
import { Group } from '../types/group';
import * as GroupId from '../types/group-id';
import { toHtmlFragment } from '../types/html-fragment';

type Context = ParameterizedContext<DefaultState, DefaultContext>;

type Logger = (level: 'error', message: string, payload: Record<string, unknown>) => void;

type ToExistingGroup = (groupId: GroupId.GroupId) => TO.TaskOption<Group>;

type Ports = {
  logger: Logger,
  getGroup: ToExistingGroup,
};

// TODO: this side-effect could be captured differently
const saveCommandAndGroupIdToSession = (context: Context) => (group: Group): void => {
  context.session.command = 'follow';
  context.session[sessionGroupProperty] = group.id.toString();
};

export const executeIfAuthenticated = ({
  getGroup: toExistingGroup,
  logger,
}: Ports): Middleware => async (context, next) => {
  try {
    await pipe(
      context.request.body[groupProperty],
      GroupId.fromNullable,
      TO.fromOption,
      TO.chain(toExistingGroup),
      TO.map(saveCommandAndGroupIdToSession(context)),
      TO.fold(
        () => T.of(context.throw(StatusCodes.BAD_REQUEST)),
        () => next,
      ),
    )();
  } catch (error: unknown) {
    logger('error', 'Problem with /follow', { error });

    context.response.status = StatusCodes.INTERNAL_SERVER_ERROR;
    context.response.body = applyStandardPageLayout(O.none)({
      title: 'Error',
      content: renderErrorPage(toHtmlFragment('Something went wrong; we\'re looking into it.')),
    });
  }
};
