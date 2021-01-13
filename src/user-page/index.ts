import { URL } from 'url';
import { flow, pipe } from 'fp-ts/function';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
import { Maybe } from 'true-myth';
import createGetFollowedEditorialCommunitiesFromIds, { GetEditorialCommunity } from './get-followed-editorial-communities-from-ids';
import { getUserDisplayName } from './get-user-display-name';
import { GetArticleFromCrossref, getSavedArticles } from './hardcoded-get-saved-articles';
import createProjectFollowedEditorialCommunityIds, { GetAllEvents } from './project-followed-editorial-community-ids';
import { projectSavedArticleDois } from './project-saved-article-dois';
import createRenderFollowList from './render-follow-list';
import createRenderFollowToggle, { Follows } from './render-follow-toggle';
import createRenderFollowedEditorialCommunity from './render-followed-editorial-community';
import createRenderHeader, { UserDetails } from './render-header';
import createRenderPage, { RenderPage } from './render-page';
import { renderSavedArticles } from './render-saved-articles';
import EditorialCommunityId from '../types/editorial-community-id';
import { User } from '../types/user';
import toUserId, { UserId } from '../types/user-id';

type FetchEditorialCommunity = (editorialCommunityId: EditorialCommunityId) => T.Task<Maybe<{
  name: string;
  avatar: URL;
}>>;

type GetUserDetails = (userId: UserId) => TE.TaskEither<'not-found' | 'unavailable', UserDetails>;

type Ports = {
  getEditorialCommunity: FetchEditorialCommunity,
  getAllEvents: GetAllEvents,
  follows: Follows,
  getUserDetails: GetUserDetails,
  fetchArticle: GetArticleFromCrossref,
};

interface Params {
  id?: string;
  user: O.Option<User>;
}

type UserPage = (params: Params) => ReturnType<RenderPage>;

export default (ports: Ports): UserPage => {
  const getEditorialCommunity: GetEditorialCommunity = (editorialCommunityId) => async () => (
    (await ports.getEditorialCommunity(editorialCommunityId)()).unsafelyUnwrap()
  );

  const renderFollowToggle = createRenderFollowToggle(ports.follows);
  const renderFollowedEditorialCommunity = createRenderFollowedEditorialCommunity(renderFollowToggle);
  const getFollowedEditorialCommunities = createGetFollowedEditorialCommunitiesFromIds(
    createProjectFollowedEditorialCommunityIds(ports.getAllEvents),
    getEditorialCommunity,
  );
  const renderHeader = createRenderHeader(ports.getUserDetails);
  const renderFollowList = createRenderFollowList(
    getFollowedEditorialCommunities,
    renderFollowedEditorialCommunity,
  );

  const renderPage = createRenderPage(
    renderHeader,
    renderFollowList,
    getUserDisplayName(ports.getUserDetails),
    flow(
      getSavedArticles(
        ports.fetchArticle,
        projectSavedArticleDois(ports.getAllEvents),
      ),
      T.map(renderSavedArticles),
      TE.rightTask,
    ),
  );

  return (params) => {
    const userId = toUserId(params.id ?? '');
    const viewingUserId = pipe(
      params.user,
      O.map((user) => user.id),
    );

    return renderPage(userId, viewingUserId);
  };
};
