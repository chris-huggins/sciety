import * as T from 'fp-ts/Task';
import { pipe } from 'fp-ts/function';
import { UserUnfollowedEditorialCommunityEvent } from '../types/domain-events';
import { FollowList } from '../types/follow-list';
import { GroupId } from '../types/group-id';
import { User } from '../types/user';
import { UserId } from '../types/user-id';

export type CommitEvents = (events: ReadonlyArray<UserUnfollowedEditorialCommunityEvent>) => T.Task<void>;
export type GetFollowList = (userId: UserId) => T.Task<FollowList>;

type UnfollowCommand = (user: User, editorialCommunityId: GroupId) => T.Task<void>;

export const unfollowCommand = (
  getFollowList: GetFollowList,
  commitEvents: CommitEvents,
): UnfollowCommand => (user, editorialCommunityId) => pipe(
  user.id,
  getFollowList,
  T.map((followList) => followList.unfollow(editorialCommunityId)),
  T.chain(commitEvents),
);
