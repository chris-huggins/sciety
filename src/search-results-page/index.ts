import { sequenceS } from 'fp-ts/Apply';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { FetchStaticFile, findGroups } from './find-groups';
import { projectGroupMeta } from './project-group-meta';
import { renderErrorPage, RenderPage, renderPage } from './render-page';
import { ItemViewModel } from './render-search-result';
import { SearchResults } from './render-search-results';
import {
  constructGroupResult,
  FindReviewsForArticleDoi,
  GetAllEvents, GetGroup, MatchedArticle, toArticleViewModel,
} from './search';
import { bootstrapEditorialCommunities } from '../data/bootstrap-editorial-communities';
import { Doi } from '../types/doi';
import { GroupId } from '../types/group-id';

type ArticleSearchResults = {
  items: ReadonlyArray<MatchedArticle>,
  total: number,
};

type FindArticles = (query: string) => TE.TaskEither<'unavailable', ArticleSearchResults>;

type Ports = {
  searchEuropePmc: FindArticles,
  findReviewsForArticleDoi: FindReviewsForArticleDoi,
  getGroup: GetGroup,
  getAllEvents: GetAllEvents,
  fetchStaticFile: FetchStaticFile,
};

type Params = {
  query: string,
};

type Matches = {
  query: string,
  groups: ReadonlyArray<{
    _tag: 'Group',
    id: GroupId,
  }>,
  articles: {
    items: ReadonlyArray<{
      _tag: 'Article',
      doi: Doi,
      title: string,
      authors: string,
      postedDate: Date,
    }>,
    total: number,
  },
};

type LimitedSet = {
  query: string,
  availableMatches: number,
  itemsToDisplay: ReadonlyArray<{
    _tag: 'Group',
    id: GroupId,
  } | {
    _tag: 'Article',
    doi: Doi,
    title: string,
    authors: string,
    postedDate: Date,
  }>,
};

const selectSubsetToDisplay = (limit: number) => (state: Matches): LimitedSet => ({
  ...state,
  availableMatches: state.groups.length + state.articles.total,
  itemsToDisplay: pipe(
    [...state.groups, ...state.articles.items],
    RA.takeLeft(limit),
  ),
});

type SearchResultsPage = (params: Params) => ReturnType<RenderPage>;

/* Solution sketch:

pipe(
  {
    query: params.query,
    groups: findMatchingGroups(ports.fetchStaticFile, bootstrapEditorialCommunities, 10)(params.query),
    articles: ports.searchEuropePmc(params.query, 10),
  },
  sequenceS(TE.taskEither),
  TE.map(selectSubsetToDisplay(10)),
  TE.chain(fetchExtraDetails(ports)),
  TE.bimap(renderErrorPage, renderPage),
)

*/

const fetchExtraDetails = (ports: Ports) => (state: LimitedSet): TE.TaskEither<never, SearchResults> => pipe(
  {
    query: T.of(state.query),
    availableMatches: T.of(state.availableMatches),
    itemsToDisplay: pipe(
      state.itemsToDisplay,
      T.traverseArray((item) => {
        if (item._tag === 'Article') {
          return pipe(
            item,
            // TODO: Find reviewsForArticleDoi should return a TaskEither
            toArticleViewModel(ports.findReviewsForArticleDoi),
            (f) => TE.rightTask<'not-found', ItemViewModel>(f),
          );
        }
        return pipe(
          item.id,
          constructGroupResult(ports.getGroup, projectGroupMeta(ports.getAllEvents)),
        );
      }),
      T.map(RA.rights),
    ),
  },
  sequenceS(T.task),
  TE.rightTask,
);

export const searchResultsPage = (ports: Ports): SearchResultsPage => (params) => pipe(
  {
    query: TE.right(params.query),
    articles: pipe(
      params.query,
      ports.searchEuropePmc,
      TE.map((results) => ({
        ...results,
        items: results.items.map((article) => ({
          _tag: 'Article' as const,
          ...article,
        })),
      })),
    ),
    groups: pipe(
      params.query,
      findGroups(ports.fetchStaticFile, bootstrapEditorialCommunities),
      T.map(RA.map((groupId) => ({
        _tag: 'Group' as const,
        id: groupId,
      }))),
      TE.rightTask,
    ),
  },
  sequenceS(TE.taskEither),
  TE.map(selectSubsetToDisplay(10)),
  TE.chainW(fetchExtraDetails(ports)),
  TE.bimap(renderErrorPage, renderPage),
);
