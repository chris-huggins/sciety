import axios from 'axios';
import { Middleware } from 'koa';
import createLogger from '../logger';
import templateListItems from '../templates/list-items';
import { Adapters } from '../types/adapters';

type RenderSearchResults = (query: string) => Promise<string>;

export type GetJson = (uri: string) => Promise<object>;

interface SearchResult {
  doi: string;
  title: string;
  authorString: string;
}

interface EuropePmcQueryResponse {
  hitCount: number;
  resultList: { result: Array<SearchResult> };
}

const log = createLogger('article-search-page:index');

const resolveToCanonicalUri = (doi: string): string => `https://www.biorxiv.org/content/${doi}v1`;

const renderSearchResult = async (result: SearchResult): Promise<string> => {
  const uri = resolveToCanonicalUri(result.doi);
  log(`Resolved URI = ${uri}`);
  try {
    const disqusResponse = await axios.get(`https://disqus.com/api/3.0/threads/list.json?api_key=[API_KEY]&forum=biorxivstage&thread=link:${uri}`);
    log(`${disqusResponse}`);
  } catch (e) {
    log(`Disqus API error: ${e.message}`);
  }
  return `
    <div class="content">
      <a class="header" href="/articles/${result.doi}">${result.title}</a>
      <div class="meta">
        ${result.authorString}
      </div>
      <div class="extra">
        <div class="ui label">
          Comments
          <span class="detail">n/a</span>
        </div>
      </div>
    </div>
  `;
};

export const createRenderSearchResults = (getJson: GetJson): RenderSearchResults => (
  async (query) => {
    const uri = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}%20PUBLISHER%3A%22bioRxiv%22&format=json&pageSize=10`;
    const data = await getJson(uri) as EuropePmcQueryResponse;
    log(data);
    const articles = await Promise.all(data.resultList.result.map(renderSearchResult));
    let searchResultsList = '';
    if (articles.length) {
      searchResultsList = `
        <ul class="ui relaxed divided items">
          ${templateListItems(articles)}
        </ul>
      `;
    }

    return `
      <p>${data.hitCount} search results.</p>
      ${searchResultsList}
    `;
  }
);

export default (adapters: Adapters): Middleware => {
  const renderSearchResults = createRenderSearchResults(adapters.getJson);
  return async (ctx, next) => {
    ctx.response.body = `
      <h1 class="header">Search results</h1>
      ${await renderSearchResults(ctx.request.query.query)}
    `;

    await next();
  };
};
