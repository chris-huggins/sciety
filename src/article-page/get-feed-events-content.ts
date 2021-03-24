import { URL } from 'url';
import { sequenceS } from 'fp-ts/Apply';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { FeedItem } from './render-feed';
import { ArticleServer } from '../types/article-server';
import { Doi } from '../types/doi';
import { GroupId } from '../types/group-id';
import { HtmlFragment } from '../types/html-fragment';
import { HypothesisAnnotationId } from '../types/hypothesis-annotation-id';
import { ReviewId } from '../types/review-id';
import { sanitise } from '../types/sanitised-html-fragment';
import { UserId } from '../types/user-id';

type ReviewEvent = {
  type: 'review',
  editorialCommunityId: GroupId,
  reviewId: ReviewId,
  occurredAt: Date,
};

type ArticleVersionEvent = {
  type: 'article-version',
  source: URL,
  occurredAt: Date,
  version: number,
};

export type FeedEvent = ReviewEvent | ArticleVersionEvent;

export type FetchReview = (id: ReviewId) => TE.TaskEither<unknown, {
  fullText: HtmlFragment,
  url: URL,
}>;

export type CountReviewResponses = (reviewId: ReviewId) => T.Task<{ helpfulCount: number, notHelpfulCount: number }>;

export type GetUserReviewResponse = (reviewId: ReviewId, userId: O.Option<UserId>) => T.Task<O.Option<'helpful' | 'not-helpful'>>;

export type GetGroup = (id: GroupId) => T.Task<{
  name: string,
  avatarPath: string,
}>;

const articleVersionToFeedItem = (
  server: ArticleServer,
  feedEvent: ArticleVersionEvent,
) => (
  T.of({ ...feedEvent, server })
);

const inferredUrlFromReviewId = (reviewId: ReviewId) => {
  if (reviewId instanceof Doi) {
    return O.some(new URL(`https://doi.org/${reviewId.value}`));
  }
  if (reviewId instanceof HypothesisAnnotationId) {
    return O.some(new URL(`https://hypothes.is/a/${reviewId.value}`));
  }

  return O.none;
};

const reviewToFeedItem = (
  getReview: FetchReview,
  getEditorialCommunity: GetGroup,
  countReviewResponses: CountReviewResponses,
  getUserReviewResponse: GetUserReviewResponse,
  feedEvent: ReviewEvent,
  userId: O.Option<UserId>,
) => pipe(
  {
    editorialCommunity: getEditorialCommunity(feedEvent.editorialCommunityId),
    review: pipe(
      feedEvent.reviewId,
      getReview,
      T.map(E.fold(
        () => ({
          url: inferredUrlFromReviewId(feedEvent.reviewId),
          fullText: O.none,
        }),
        (review) => ({
          ...review,
          url: O.some(review.url),
          fullText: O.some(review.fullText),
        }),
      )),
    ),
    reviewResponses: pipe(feedEvent.reviewId, countReviewResponses),
    userReviewResponse: getUserReviewResponse(feedEvent.reviewId, userId),
  },
  sequenceS(T.task),
  T.map(({
    editorialCommunity, review, reviewResponses, userReviewResponse,
  }) => ({
    type: 'review' as const,
    id: feedEvent.reviewId,
    source: review.url,
    occurredAt: feedEvent.occurredAt,
    groupId: feedEvent.editorialCommunityId,
    groupName: editorialCommunity.name,
    groupAvatar: editorialCommunity.avatarPath,
    fullText: O.map(sanitise)(review.fullText),
    counts: reviewResponses,
    current: userReviewResponse,
  })),
);

type Dependencies = {
  fetchReview: FetchReview,
  getGroup: GetGroup,
  countReviewResponses: CountReviewResponses,
  getUserReviewResponse: GetUserReviewResponse,
};

type GetFeedEventsContent = <R extends Dependencies>(
  feedEvents: ReadonlyArray<FeedEvent>,
  server: ArticleServer,
  userId: O.Option<UserId>,
) => RT.ReaderTask<R, ReadonlyArray<FeedItem>>;

export const getFeedEventsContent: GetFeedEventsContent = (feedEvents, server, userId) => ({
  fetchReview,
  getGroup,
  countReviewResponses,
  getUserReviewResponse,
}) => {
  const toFeedItem = (feedEvent: FeedEvent): T.Task<FeedItem> => {
    switch (feedEvent.type) {
      case 'article-version':
        return articleVersionToFeedItem(server, feedEvent);
      case 'review':
        return reviewToFeedItem(
          fetchReview, getGroup, countReviewResponses, getUserReviewResponse, feedEvent, userId,
        );
    }
  };
  return pipe(
    feedEvents,
    T.traverseArray(toFeedItem),
  );
};
