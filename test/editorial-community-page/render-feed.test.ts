import { URL } from 'url';
import * as O from 'fp-ts/lib/Option';
import * as T from 'fp-ts/lib/Task';
import { FeedEvent } from '../../src/editorial-community-page/construct-feed-item';
import createRenderFeed, { GetEvents, RenderSummaryFeedList } from '../../src/editorial-community-page/render-feed';
import { RenderFollowToggle } from '../../src/editorial-community-page/render-follow-toggle';
import { EditorialCommunityId } from '../../src/types/editorial-community-id';
import { toHtmlFragment } from '../../src/types/html-fragment';

describe('render feed', () => {
  const stubGetEvents: GetEvents<FeedEvent> = () => T.of([]);
  const stubRenderFollowToggle: RenderFollowToggle = () => T.of(toHtmlFragment(''));
  const anEditorialCommunityId = new EditorialCommunityId('');
  const aUserId = O.none;

  describe('with community events', () => {
    it('returns a list of events', async () => {
      const renderSummaryFeedList: RenderSummaryFeedList<FeedEvent> = () => T.of(O.some(toHtmlFragment('a list')));

      const renderFeed = createRenderFeed(stubGetEvents, renderSummaryFeedList, stubRenderFollowToggle);

      const rendered = await renderFeed({
        id: anEditorialCommunityId,
        name: 'name',
        avatar: new URL('http://example.com/image'),
        descriptionPath: 'path',
      }, aUserId)();

      expect(rendered).toContain('a list');
    });
  });

  describe('without community events', () => {
    it('returns fallback text', async () => {
      const renderSummaryFeedList: RenderSummaryFeedList<FeedEvent> = () => T.of(O.none);

      const renderFeed = createRenderFeed(stubGetEvents, renderSummaryFeedList, stubRenderFollowToggle);

      const rendered = await renderFeed({
        id: anEditorialCommunityId,
        name: 'name',
        avatar: new URL('http://example.com/image'),
        descriptionPath: 'path',
      }, aUserId)();

      expect(rendered).toContain('community hasn’t evaluated');
    });
  });
});
