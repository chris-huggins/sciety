import path from 'path';
import Router from '@koa/router';
import { isHttpError } from 'http-errors';
import { Middleware } from 'koa';
import bodyParser from 'koa-bodyparser';
import koaPassport from 'koa-passport';
import send from 'koa-send';
import { v4 } from 'uuid';
import identifyUser from './identify-user';
import pageHandler from './page-handler';
import ping from './ping';
import { createRedirectAfterAuthenticating, createRequireAuthentication } from './require-authentication';
import robots from './robots';
import createAboutPage from '../about-page';
import createArticlePage from '../article-page';
import createArticleSearchPage from '../article-search-page';
import createEditorialCommunityPage from '../editorial-community-page';
import createFollowHandler from '../follow';
import createFinishFollowCommand from '../follow/finish-follow-command';
import createSaveFollowCommand from '../follow/save-follow-command';
import createHomePage from '../home-page';
import { Adapters } from '../infrastructure/adapters';
import createLogOutHandler from '../log-out';
import { generate } from '../types/event-id';
import createUnfollowHandler from '../unfollow';
import createFinishUnfollowCommand from '../unfollow/finish-unfollow-command';
import createSaveUnfollowCommand from '../unfollow/save-unfollow-command';
import createUserPage from '../user-page';

export default (adapters: Adapters): Router => {
  const router = new Router();

  router.get('/ping',
    ping());

  router.get('/',
    identifyUser(adapters.logger),
    pageHandler(createHomePage(adapters)));

  router.get('/about',
    identifyUser(adapters.logger),
    pageHandler(createAboutPage(adapters)));

  router.get('/users/:id(.+)',
    identifyUser(adapters.logger),
    pageHandler(createUserPage(adapters)));

  router.get('/articles',
    identifyUser(adapters.logger),
    pageHandler(createArticleSearchPage(adapters)));

  router.get('/articles/:doi(.+)',
    identifyUser(adapters.logger),
    pageHandler(createArticlePage(adapters)));

  router.get('/editorial-communities/:id',
    identifyUser(adapters.logger),
    pageHandler(createEditorialCommunityPage(adapters)));

  router.post('/follow',
    identifyUser(adapters.logger),
    bodyParser({ enableTypes: ['form'] }),
    createSaveFollowCommand(),
    createRequireAuthentication(),
    createFollowHandler(adapters));

  router.post('/unfollow',
    identifyUser(adapters.logger),
    bodyParser({ enableTypes: ['form'] }),
    createSaveUnfollowCommand(),
    createRequireAuthentication(),
    createUnfollowHandler(adapters));

  const authenticate = koaPassport.authenticate(
    'twitter',
    {
      failureRedirect: '/',
    },
  );

  const loggingInMiddleware: Middleware = async (context, next) => {
    if (!context.session.visitorId) {
      const visitorId = v4();
      context.session.visitorId = visitorId;
    }
    await adapters.commitEvents([
      {
        id: generate(),
        type: 'VisitorTookAction',
        date: new Date(),
        visitorId: context.session.visitorId,
      },
    ]);

    await next();
  };

  router.get('/log-in',
    loggingInMiddleware,
    authenticate);

  router.get('/log-out',
    createLogOutHandler());

  const loggedInMiddleware: Middleware = async (context, next) => {
    const { user } = context.state;
    await adapters.commitEvents([
      {
        id: generate(),
        type: 'UserLoggedIn',
        date: new Date(),
        userId: user.id,
      },
    ]);

    await next();
  };

  const acquiredMiddleware: Middleware = async (context, next) => {
    const { user } = context.state;
    // rebuild of state should be in a UserRepository
    const matchingAcquiredEvents = (await adapters.getAllEvents()).filter((candidate) => candidate.type === 'UserAcquired' && candidate.userId === user.id).length;
    if (matchingAcquiredEvents === 0) {
      await adapters.commitEvents([
        {
          id: generate(),
          type: 'UserAcquired',
          date: new Date(),
          userId: user.id,
        },
      ]);
    }

    await next();
  };

  router.get('/twitter/callback',
    authenticate,
    createFinishFollowCommand(adapters),
    createFinishUnfollowCommand(adapters),
    acquiredMiddleware,
    loggedInMiddleware,
    createRedirectAfterAuthenticating());

  router.get('/robots.txt',
    robots());

  router.get('/static/:file(.+)', async (context) => {
    try {
      await send(context, context.params.file, { root: path.resolve(__dirname, '../../static') });
    } catch (error: unknown) {
      if (isHttpError(error) && error.status === 404) {
        context.response.status = 404;
        return;
      }
      throw error;
    }
  });

  return router;
};
