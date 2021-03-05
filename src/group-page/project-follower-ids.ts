import * as T from 'fp-ts/Task';
import { pipe } from 'fp-ts/function';
import {
  DomainEvent,
  isUserFollowedEditorialCommunityEvent,
  isUserUnfollowedEditorialCommunityEvent,
  UserFollowedEditorialCommunityEvent,
  UserUnfollowedEditorialCommunityEvent,
} from '../types/domain-events';
import { eqGroupId, GroupId } from '../types/group-id';
import { UserId } from '../types/user-id';

type ProjectFollowerIds = (groupId: GroupId) => T.Task<ReadonlyArray<UserId>>;

type GetAllEvents = T.Task<ReadonlyArray<DomainEvent>>;

const isInterestingEvent = (event: DomainEvent) : event is (
UserFollowedEditorialCommunityEvent |
UserUnfollowedEditorialCommunityEvent) => isUserFollowedEditorialCommunityEvent(event)
  || isUserUnfollowedEditorialCommunityEvent(event);

const projection = (groupId: GroupId) => (
  events: ReadonlyArray<DomainEvent>,
) => (
  events.filter(isInterestingEvent)
    .filter((event) => eqGroupId.equals(event.editorialCommunityId, groupId))
    .reduce<Array<UserId>>(
    (userIds, event) => {
      if (isUserFollowedEditorialCommunityEvent(event)) {
        return userIds.concat([event.userId]);
      }
      return userIds.filter((userId) => userId !== event.userId);
    },
    [],
  )
);

export const projectFollowerIds = (getAllEvents: GetAllEvents): ProjectFollowerIds => (
  (groupId) => pipe(
    getAllEvents,
    T.map(projection(groupId)),
  )
);
