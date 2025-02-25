import {
  userFollowedEditorialCommunity,
  UserFollowedEditorialCommunityEvent,
  userUnfollowedEditorialCommunity,
  UserUnfollowedEditorialCommunityEvent,
} from './domain-events';
import { GroupId } from './group-id';
import { UserId } from './user-id';

export class FollowList {
  private readonly userId: UserId;

  private items: Array<string>;

  constructor(userId: UserId, items: Array<string> = []) {
    this.userId = userId;
    this.items = items;
  }

  follow(groupId: GroupId): ReadonlyArray<UserFollowedEditorialCommunityEvent> {
    if (this.items.includes(groupId.value)) {
      return [];
    }

    this.items.push(groupId.value);

    return [
      userFollowedEditorialCommunity(this.userId, groupId),
    ];
  }

  unfollow(groupId: GroupId): ReadonlyArray<UserUnfollowedEditorialCommunityEvent> {
    if (!this.items.includes(groupId.value)) {
      return [];
    }

    this.items = this.items.filter((item) => item !== groupId.value);

    return [
      userUnfollowedEditorialCommunity(this.userId, groupId),
    ];
  }
}
