import templateListItems from './list-items';
import { FeedEvent, RenderSummaryFeedItem } from './render-summary-feed-item';

export type RenderFeedList = (events: ReadonlyArray<FeedEvent>) => Promise<string>;

export default (
  renderSummaryFeedItem: RenderSummaryFeedItem,
): RenderFeedList => async (events) => {
  const items = await Promise.all(events.map(renderSummaryFeedItem));
  return `
    <ol class="summary-feed-list" role="list">
      ${templateListItems(items, 'summary-feed-list__list_item')}
    </ol>
  `;
};
