import * as B from 'fp-ts/boolean';
import { flow } from 'fp-ts/function';
import { GroupId } from '../types/group-id';
import { HtmlFragment, toHtmlFragment } from '../types/html-fragment';

export type RenderFollowToggle = (
  groupId: GroupId,
  editorialCommunityName: string,
) => (
  isFollowing: boolean
) => HtmlFragment;

const renderFollowButton = (groupId: GroupId, groupName: string) => `
  <form method="post" action="/follow">
    <input type="hidden" name="editorialcommunityid" value="${groupId.value}" />
    <button type="submit" class="button button--primary button--small" aria-label="Follow ${groupName}">
      Follow
    </button>
  </form>
`;

const renderUnfollowButton = (groupId: GroupId, groupName: string) => `
  <form method="post" action="/unfollow">
    <input type="hidden" name="editorialcommunityid" value="${groupId.value}" />
    <button type="submit" class="button button--small" aria-label="Unfollow ${groupName}">
      Unfollow
    </button>
  </form>
`;

export const renderFollowToggle: RenderFollowToggle = (groupId, groupName) => flow(
  B.fold(
    () => renderFollowButton(groupId, groupName),
    () => renderUnfollowButton(groupId, groupName),
  ),
  toHtmlFragment,
);
