import { URL } from 'url';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
import { flow, pipe } from 'fp-ts/lib/function';
import { RenderFollowedEditorialCommunity } from './render-followed-editorial-community';
import templateListItems from '../shared-components/list-items';
import EditorialCommunityId from '../types/editorial-community-id';
import { HtmlFragment, toHtmlFragment } from '../types/html-fragment';
import { UserId } from '../types/user-id';

type RenderFollowList = (userId: UserId, viewingUserId: O.Option<UserId>) => TE.TaskEither<never, HtmlFragment>;

export type GetFollowedEditorialCommunities = (userId: UserId) => T.Task<ReadonlyArray<{
  id: EditorialCommunityId,
  name: string,
  avatar: URL,
}>>;

const followingNothing = `
  <p>They’re not following anything. When they do, they’ll be listed here.</p>
`;

const followListSection = (list: string): string => `
  <section class="followed-communities">
    <h2>
      Following
    </h2>
    ${list}
  </section>
`;

const renderList = (list: ReadonlyArray<HtmlFragment>): string => ((list.length === 0) ? followingNothing : `
  <ol class="followed-communities__list" role="list">
    ${templateListItems(list, 'followed-communities__item')}
  </ol>
`);

export default (
  getFollowedEditorialCommunities: GetFollowedEditorialCommunities,
  renderFollowedEditorialCommunity: RenderFollowedEditorialCommunity,
): RenderFollowList => (
  (userId, viewingUserId) => pipe(
    userId,
    getFollowedEditorialCommunities,
    T.chain(T.traverseArray(renderFollowedEditorialCommunity(viewingUserId))),
    T.map(flow(
      renderList,
      followListSection,
      toHtmlFragment,
    )),
    TE.rightTask,
  )
);
