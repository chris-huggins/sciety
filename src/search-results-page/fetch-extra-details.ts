import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { flow, pipe } from 'fp-ts/function';
import { ArticleItem, GroupItem } from './data-types';
import { ItemViewModel } from './render-search-result';
import { SearchResults } from './render-search-results';
import { updateGroupMeta } from './update-group-meta';
import { Doi } from '../types/doi';
import { DomainEvent } from '../types/domain-events';
import { Group } from '../types/group';
import { GroupId } from '../types/group-id';
import { toHtmlFragment } from '../types/html-fragment';
import { ReviewId } from '../types/review-id';
import { sanitise } from '../types/sanitised-html-fragment';

type Ports = {
  findReviewsForArticleDoi: FindReviewsForArticleDoi,
  getAllEvents: GetAllEvents,
  getGroup: GetGroup,
};

export type GetGroup = (groupId: GroupId) => T.Task<O.Option<Group>>;

export type GetAllEvents = T.Task<ReadonlyArray<DomainEvent>>;

export type FindReviewsForArticleDoi = (articleDoi: Doi) => T.Task<ReadonlyArray<{
  reviewId: ReviewId,
  groupId: GroupId,
}>>;

const populateArticleViewModel = (findReviewsForArticleDoi: FindReviewsForArticleDoi) => (item: ArticleItem) => pipe(
  item.doi,
  findReviewsForArticleDoi, // TODO: Find reviewsForArticleDoi should return a TaskEither
  T.map((reviews) => ({
    ...item,
    latestVersionDate: O.none,
    reviewCount: reviews.length,
  })),
  TE.rightTask,
);

const populateGroupViewModel = (getGroup: GetGroup, getAllEvents: GetAllEvents) => flow(
  (item: GroupItem) => item.id,
  getGroup,
  T.map(E.fromOption(() => 'not-found' as const)),
  TE.chainW((group) => pipe(
    getAllEvents,
    T.map(RA.reduce({ reviewCount: 0, followerCount: 0 }, updateGroupMeta(group.id))),
    T.map((meta) => ({
      _tag: 'Group' as const,
      ...group,
      ...meta,
      description: pipe(group.shortDescription, toHtmlFragment, sanitise),
    })),
    TE.rightTask,
  )),
);

const fetchItemDetails = (ports: Ports) => (item: GroupItem | ArticleItem): TE.TaskEither<'not-found', ItemViewModel> => {
  switch (item._tag) {
    case 'Article':
      return pipe(item, populateArticleViewModel(ports.findReviewsForArticleDoi));
    case 'Group':
      return pipe(item, populateGroupViewModel(ports.getGroup, ports.getAllEvents));
  }
};

export type LimitedSet = {
  query: string,
  availableMatches: number,
  itemsToDisplay: ReadonlyArray<GroupItem | ArticleItem>,
};

export const fetchExtraDetails = (ports: Ports) => (state: LimitedSet): T.Task<SearchResults> => pipe(
  state.itemsToDisplay,
  T.traverseArray(fetchItemDetails(ports)),
  T.map(flow(
    RA.rights,
    (itemsToDisplay) => ({
      ...state,
      itemsToDisplay,
    }),
  )),
);
