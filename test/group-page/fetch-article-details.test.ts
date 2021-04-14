import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import { flow, pipe } from 'fp-ts/function';
import { fetchArticleDetails } from '../../src/group-page/fetch-article-details';
import { Doi } from '../../src/types/doi';
import { toHtmlFragment } from '../../src/types/html-fragment';
import { sanitise } from '../../src/types/sanitised-html-fragment';

describe('fetch-article-details', () => {
  describe('latest version date', () => {
    it('returns the latest version date for a doi', async () => {
      const doi = new Doi('10.1101/2020.09.15.286153');
      const latestDate = new Date('2020-12-14');
      const latestVersionDate = pipe(
        await fetchArticleDetails(() => T.of(O.some(latestDate)))(doi)(),
        O.map((article) => article.latestVersionDate),
      );
      const expected = O.some(latestDate);

      expect(latestVersionDate).toStrictEqual(expected);
    });
  });

  describe('title', () => {
    it('returns the title for a doi', async () => {
      const doi = new Doi('10.1101/2020.09.15.286153');
      const title = pipe(
        await fetchArticleDetails(() => T.of(O.some(new Date())))(doi)(),
        O.map((article) => article.title),
      );
      const expected = pipe(
        'Accuracy of predicting chemical body composition of growing pigs using dual-energy X-ray absorptiometry',
        toHtmlFragment,
        sanitise,
        O.some,
      );

      expect(title).toStrictEqual(expected);
    });
  });

  describe('authors', () => {
    it('returns the authors for a doi', async () => {
      const doi = new Doi('10.1101/2020.09.15.286153');
      const authors = pipe(
        await fetchArticleDetails(() => T.of(O.some(new Date())))(doi)(),
        O.map((article) => article.authors),
      );
      const expected = pipe(
        ['Kasper C', 'Schlegel P', 'Ruiz-Ascacibar I', 'Stoll P', 'Bee G'],
        RA.map(flow(toHtmlFragment, sanitise)),
        O.some,
      );

      expect(authors).toStrictEqual(expected);
    });
  });
});
