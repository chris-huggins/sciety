import { DOMParser } from 'xmldom';
import {
  getAbstract, getAuthors, getPublicationDate, getTitle,
} from '../../src/infrastructure/parse-crossref-article';
import Doi from '../../src/types/doi';
import dummyLogger from '../dummy-logger';

const crossrefResponseWith = (content: string): string => `
  <?xml version="1.0" encoding="UTF-8"?>
  <doi_records>
    <doi_record>
      <crossref>
        <posted_content>
          ${content}
        </posted_content>
      </crossref>
    </doi_record>
  </doi_records>
`;

describe('parse-crossref-article', () => {
  const parser = new DOMParser({
    errorHandler: (_, msg) => {
      throw msg;
    },
  });
  const doi = new Doi('10.1101/339747');

  describe('parsing the abstract', () => {
    it('extracts the abstract text from the XML response', async () => {
      const response = crossrefResponseWith(`
        <abstract>
          Some random nonsense.
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('Some random nonsense.'));
    });

    it('removes the <abstract> element', async () => {
      const response = crossrefResponseWith(`
        <abstract class="something">
          Some random nonsense.
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.not.stringContaining('<abstract>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('</abstract>'));
    });

    it('removes the first <title> if present', async () => {
      const response = crossrefResponseWith(`
        <abstract>
          <title class="something">Abstract</title>
          Some random nonsense.
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.not.stringContaining('Abstract'));
    });

    it('replaces remaining <title>s with HTML <h3>s', async () => {
      const response = crossrefResponseWith(`
        <abstract>
          <title class="something">expected to be removed</title>
          <p>Lorem ipsum</p>
          <title class="something">should be an h3</title>
          <p>Lorem ipsum</p>
          <title class="something">should also be an h3</title>
          </sec>
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('<h3>should be an h3</h3>'));
      expect(abstract).toStrictEqual(expect.stringContaining('<h3>should also be an h3</h3>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('<title>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('</title>'));
    });

    it('renders italic if present', async () => {
      const response = crossrefResponseWith(`
        <abstract>
          <title>Abstract</title>
          <p>
            The spread of antimicrobial resistance continues to be a priority health concern worldwide, necessitating exploration of alternative therapies.
            <italic class="something">Cannabis sativa</italic>
            has long been known to contain antibacterial cannabinoids, but their potential to address antibiotic resistance has only been superficially investigated. Here, we show that cannabinoids exhibit antibacterial activity against MRSA, inhibit its ability to form biofilms and eradicate pre-formed biofilms and stationary phase cells persistent to antibiotics. We show that the mechanism of action of cannabigerol is through targeting the cytoplasmic membrane of Gram-positive bacteria and demonstrate
            <italic class="something">in vivo</italic>
            efficacy of cannabigerol in a murine systemic infection model caused by MRSA. We also show that cannabinoids are effective against Gram-negative organisms whose outer membrane is permeabilized, where cannabigerol acts on the inner membrane. Finally, we demonstrate that cannabinoids work in combination with polymyxin B against multi-drug resistant Gram-negative pathogens, revealing the broad-spectrum therapeutic potential for cannabinoids.
          </p>
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('<i>Cannabis sativa</i>'));
      expect(abstract).toStrictEqual(expect.stringContaining('<i>in vivo</i>'));
    });

    it('replaces <list> unordered list with HTML <ul>', async () => {
      const response = crossrefResponseWith(`
        <abstract>
          <list class="something" list-type="bullet" id="id-1">
            <list-item class="something">
              <p>Transcriptional regulation of ESRP2.</p>
            </list-item>
            <list-item class="something">
              <p>Both ESRP1 and ESRP2 are highly expressed in prostate cancer tissue.</p>
            </list-item>
          </list>
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('<ul>'));
      expect(abstract).toStrictEqual(expect.stringContaining('</ul>'));
      expect(abstract).toStrictEqual(expect.stringContaining('<li>'));
      expect(abstract).toStrictEqual(expect.stringContaining('</li>'));
    });

    it('replaces <sec> with HTML <section>', () => {
      const response = crossrefResponseWith(`
        <abstract>
          <sec class="something">
            <p>Lorem ipsum</p>
          </sec>
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('<section>'));
      expect(abstract).toStrictEqual(expect.stringContaining('</section>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('<sec>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('</sec>'));
    });

    it('strips <title> named Graphical abstract', () => {
      const response = crossrefResponseWith(`
        <abstract>
          <title>First title</title>
          <sec>
            <title>Graphical abstract</title>
            <fig id="ufig1" position="float" fig-type="figure" orientation="portrait">
              <graphic href="222794v2_ufig1" position="float" orientation="portrait" />
            </fig>
          </sec>
        </abstract>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.not.stringContaining('Graphical abstract'));
    });

    it('strips <section> elements that are empty or only contain whitespace', () => {
      const response = crossrefResponseWith(`
        <abstract>
          <sec>
            <fig id="ufig1" position="float" fig-type="figure" orientation="portrait">
              <graphic href="222794v2_ufig1" position="float" orientation="portrait" />
            </fig>
          </sec>
        </abstract>`);

      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.not.stringContaining('<section>'));
      expect(abstract).toStrictEqual(expect.not.stringContaining('</section>'));
    });

    it('doesn\'t strip <section> elements that are not empty', () => {
      const response = crossrefResponseWith(`
        <abstract>
          <sec>
            Lorem ipsum
          </sec>
        </abstract>`);

      const doc = parser.parseFromString(response, 'text/xml');
      const abstract = getAbstract(doc, doi, dummyLogger);

      expect(abstract).toStrictEqual(expect.stringContaining('<section>'));
      expect(abstract).toStrictEqual(expect.stringContaining('Lorem ipsum'));
      expect(abstract).toStrictEqual(expect.stringContaining('</section>'));
    });
  });

  describe('parsing the publication date', () => {
    it('extracts the date', async () => {
      const response = crossrefResponseWith(`
        <posted_date>
          <month>03</month>
          <day>22</day>
          <year>2020</year>
        </posted_date>`);

      const doc = parser.parseFromString(response, 'text/xml');
      const publicationDate = getPublicationDate(doc);

      expect(publicationDate).toStrictEqual(new Date('2020-03-22'));
    });
  });

  describe('parsing the authors', () => {
    it('extracts no authors from the XML response when there are no contributors', async () => {
      const response = crossrefResponseWith('');
      const doc = parser.parseFromString(response, 'text/xml');
      const authors = getAuthors(doc, doi, dummyLogger);

      expect(authors).toHaveLength(0);
    });

    it('extracts authors from the XML response', async () => {
      const response = crossrefResponseWith(`
        <contributors>
          <person_name contributor_role="author" sequence="first">
            <given_name>Eesha</given_name>
            <surname>Ross</surname>
          </person_name>
          <person_name contributor_role="author" sequence="additional">
            <given_name>Fergus</given_name>
            <surname>Fountain</surname>
          </person_name>
        </contributors>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const authors = getAuthors(doc, doi, dummyLogger);

      expect(authors).toStrictEqual(['Eesha Ross', 'Fergus Fountain']);
    });

    it('handles a person without a given_name', async () => {
      const response = crossrefResponseWith(`
        <contributors>
          <person_name contributor_role="author" sequence="first">
            <surname>Ross</surname>
          </person_name>
        </contributors>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const authors = getAuthors(doc, doi, dummyLogger);

      expect(authors).toStrictEqual(['Ross']);
    });

    it('only includes authors', async () => {
      const response = crossrefResponseWith(`
        <contributors>
          <person_name contributor_role="author" sequence="first">
            <given_name>Eesha</given_name>
            <surname>Ross</surname>
          </person_name>
          <person_name contributor_role="reviewer" sequence="additional">
            <given_name>Fergus</given_name>
            <surname>Fountain</surname>
          </person_name>
        </contributors>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const authors = getAuthors(doc, doi, dummyLogger);

      expect(authors).toStrictEqual(['Eesha Ross']);
    });
  });

  describe('parsing the title', () => {
    it('extracts a title from the XML response', async () => {
      const response = crossrefResponseWith(`
        <titles>
          <title>An article title</title>
        </titles>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const title = getTitle(doc, doi, dummyLogger);

      expect(title).toStrictEqual('An article title');
    });

    it('returns `Unknown title` when no title present', async () => {
      const response = crossrefResponseWith('');
      const doc = parser.parseFromString(response, 'text/xml');
      const title = getTitle(doc, doi, dummyLogger);

      expect(title).toStrictEqual('Unknown title');
    });

    it('extracts a title containing inline HTML tags from the XML response', async () => {
      const response = crossrefResponseWith(`
        <titles>
          <title>An article title for <i>C. elegans</i></title>
        </titles>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const title = getTitle(doc, doi, dummyLogger);

      expect(title).toStrictEqual('An article title for <i>C. elegans</i>');
    });

    it('strips non html tags from the title', async () => {
      const response = crossrefResponseWith(`
        <titles>
          <title>An article title for <scp>C. elegans</scp></title>
        </titles>`);
      const doc = parser.parseFromString(response, 'text/xml');
      const title = getTitle(doc, doi, dummyLogger);

      expect(title).toStrictEqual('An article title for C. elegans');
    });
  });
});
