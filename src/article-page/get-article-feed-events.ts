import { URL } from 'url';
import * as O from 'fp-ts/Option';
import * as RT from 'fp-ts/ReaderTask';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray';
import * as T from 'fp-ts/Task';
import * as TO from 'fp-ts/TaskOption';
import { constant, flow, pipe } from 'fp-ts/function';
import {
  CountReviewResponses,
  FetchReview,
  getFeedEventsContent,
  GetGroup,
  GetUserReviewResponse,
} from './get-feed-events-content';
import { handleArticleVersionErrors } from './handle-article-version-errors';
import { mergeFeeds } from './merge-feeds';
import { FeedItem } from './render-feed';
import { ArticleServer } from '../types/article-server';
import { Doi } from '../types/doi';
import { GroupId } from '../types/group-id';
import { ReviewId } from '../types/review-id';
import { UserId } from '../types/user-id';

export type FindReviewsForArticleDoi = (articleVersionDoi: Doi) => T.Task<ReadonlyArray<{
  reviewId: ReviewId,
  groupId: GroupId,
  occurredAt: Date,
}>>;

export type FindVersionsForArticleDoi = (
  doi: Doi,
  server: ArticleServer
) => TO.TaskOption<RNEA.ReadonlyNonEmptyArray<{
  source: URL,
  occurredAt: Date,
  version: number,
}>>;

type GetArticleFeedEvents = (
  doi: Doi,
  server: ArticleServer,
  userId: O.Option<UserId>,
) => RT.ReaderTask<Dependencies, RNEA.ReadonlyNonEmptyArray<FeedItem>>;

type Dependencies = {
  findReviewsForArticleDoi: FindReviewsForArticleDoi,
  findVersionsForArticleDoi: FindVersionsForArticleDoi,
  fetchReview: FetchReview,
  getGroup: GetGroup,
  countReviewResponses: CountReviewResponses,
  getUserReviewResponse: GetUserReviewResponse,
};

export const getArticleFeedEvents: GetArticleFeedEvents = (doi, server, userId) => pipe(
  [
    pipe(
      RT.asks((deps: Dependencies) => deps.findReviewsForArticleDoi),
      RT.chainTaskK((findReviewsForArticleDoi) => findReviewsForArticleDoi(doi)),
      RT.map(RA.map((review) => ({ type: 'review', ...review } as const))),
    ),
    pipe(
      RT.asks((deps: Dependencies) => deps.findVersionsForArticleDoi),
      RT.chainTaskK(flow(
        (findVersionsForArticleDoi) => findVersionsForArticleDoi(doi, server),
        TO.matchW(
          constant([]),
          RNEA.map((version) => ({ type: 'article-version', ...version } as const)),
        ),
      )),
    ),
  ] as const,
  mergeFeeds,
  RT.chain((feedEvents) => getFeedEventsContent(feedEvents, server, userId)),
  RT.map((feedEvents) => handleArticleVersionErrors(feedEvents, server)),
);
