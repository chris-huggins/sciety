import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as A from 'fp-ts/Array';
import * as I from 'fp-ts/Identity';
import { Json } from 'fp-ts/Json';
import * as O from 'fp-ts/Option';
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { identity, pipe } from 'fp-ts/function';
import { Pool } from 'pg';
import { Adapters } from './adapters';
import { biorxivCache } from './biorxiv-cache';
import { commitEvents } from './commit-events';
import { createEventSourceFollowListRepository } from './event-sourced-follow-list-repository';
import { fetchCrossrefArticle } from './fetch-crossref-article';
import { fetchDataciteReview } from './fetch-datacite-review';
import { fetchDataset } from './fetch-dataset';
import { fetchHypothesisAnnotation } from './fetch-hypothesis-annotation';
import { fetchNcrcReview } from './fetch-ncrc-review';
import { fetchReview } from './fetch-review';
import { fetchStaticFile } from './fetch-static-file';
import { findGroups } from './find-groups';
import { findReviewsForArticleDoi } from './find-reviews-for-article-doi';
import { follows } from './follows';
import { getArticleVersionEventsFromBiorxiv } from './get-article-version-events-from-biorxiv';
import { getEventsFromDataFiles } from './get-events-from-data-files';
import { getEventsFromDatabase } from './get-events-from-database';
import { getTwitterResponse } from './get-twitter-response';
import { getTwitterUserDetails } from './get-twitter-user-details';
import { getXmlFromCrossrefRestApi } from './get-xml-from-crossref-rest-api';
import { inMemoryGroupRepository } from './in-memory-groups';
import {
  jsonSerializer, loggerIO, rTracerLogger, streamLogger,
} from './logger';
import { responseCache } from './response-cache';
import { searchEuropePmc } from './search-europe-pmc';
import { bootstrapGroups } from '../data/bootstrap-groups';
import * as DomainEvent from '../types/domain-events';

type Dependencies = {
  prettyLog: boolean,
  logLevel: string, // TODO: Make this a level name
  crossrefApiBearerToken: O.Option<string>,
  twitterApiBearerToken: string,
};

export const createInfrastructure = (dependencies: Dependencies): TE.TaskEither<unknown, Adapters> => pipe(
  I.Do,
  I.apS('logger', pipe(
    dependencies.prettyLog,
    jsonSerializer,
    (serializer) => streamLogger(process.stdout, serializer, dependencies.logLevel),
    rTracerLogger,
  )),
  I.apS('pool', new Pool()),
  TE.right,
  TE.chainFirst(({ pool }) => TE.tryCatch(
    async () => pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id uuid,
        type varchar,
        date timestamp,
        payload jsonb,
        PRIMARY KEY (id)
      );
    `),
    identity,
  )),
  TE.bindW('eventsFromDatabase', ({ pool, logger }) => getEventsFromDatabase(pool, loggerIO(logger))),
  TE.apSW('eventsFromDataFiles', pipe(
    bootstrapGroups,
    RNEA.map(({ id }) => id),
    getEventsFromDataFiles,
  )),
  TE.bindW('events', ({ eventsFromDataFiles, eventsFromDatabase }) => pipe(
    eventsFromDataFiles.concat(eventsFromDatabase),
    A.sort(DomainEvent.byDate),
    TE.right,
  )),
  TE.chain((adapters) => TE.tryCatch(
    async () => {
      const { events, logger, pool } = adapters;

      const getJson = async (uri: string) => {
        const response = await axios.get<Json>(uri);
        return response.data;
      };

      const retryingClient = axios.create();
      axiosRetry(retryingClient, {
        retryDelay: (count, error) => {
          logger('debug', 'Retrying HTTP request', { count, error });
          return 0;
        },
        retries: 3,
      });
      const getJsonWithRetries = async (uri: string) => {
        const response = await retryingClient.get<Json>(uri);
        return response.data;
      };

      const groups = inMemoryGroupRepository(bootstrapGroups);
      const getAllEvents = T.of(events);
      const getFollowList = createEventSourceFollowListRepository(getAllEvents);
      const fetchFile = (f: string) => fetchStaticFile(f)(loggerIO(logger));

      return {
        fetchArticle: fetchCrossrefArticle(responseCache(getXmlFromCrossrefRestApi(
          logger,
          dependencies.crossrefApiBearerToken,
        ), logger), logger),
        fetchReview: fetchReview(
          fetchDataciteReview(fetchDataset(logger), logger),
          fetchHypothesisAnnotation(getJson, logger),
          fetchNcrcReview(logger),
        ),
        fetchStaticFile: fetchFile,
        findGroups: findGroups(fetchFile, bootstrapGroups),
        searchEuropePmc: (...args) => searchEuropePmc(...args)({ getJson: getJsonWithRetries, logger }),
        getGroup: groups.lookup,
        getAllGroups: groups.all,
        findReviewsForArticleDoi: (...args) => findReviewsForArticleDoi(...args)(getAllEvents),
        getAllEvents,
        commitEvents: (...args) => commitEvents(...args)({ inMemoryEvents: events, pool, logger: loggerIO(logger) }),
        getFollowList,
        getUserDetails: getTwitterUserDetails(
          getTwitterResponse(dependencies.twitterApiBearerToken, logger),
          logger,
        ),
        follows: (...args) => follows(...args)(getAllEvents),
        findVersionsForArticleDoi: biorxivCache(
          (...args) => getArticleVersionEventsFromBiorxiv(...args)({ getJson, logger: loggerIO(logger) }),
          logger,
        ),
        ...adapters,
      };
    },
    identity,
  )),
);
