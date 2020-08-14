import fs from 'fs';
import axios from 'axios';
import csvParseSync from 'csv-parse/lib/sync';
import { Adapters } from './adapters';
import createFetchCrossrefArticle from './fetch-crossref-article';
import createFetchDataciteReview from './fetch-datacite-review';
import createFetchDataset from './fetch-dataset';
import createFetchHypothesisAnnotation from './fetch-hypothesis-annotation';
import createFetchReview from './fetch-review';
import createFetchStaticFile from './fetch-static-file';
import createFilterEvents from './filter-events';
import createGetBiorxivCommentCount from './get-biorxiv-comment-count';
import createGetDisqusPostCount from './get-disqus-post-count';
import createGetXml from './get-xml';
import createEditorialCommunityRepository from './in-memory-editorial-communities';
import createEndorsementsRepository from './in-memory-endorsements-repository';
import createReviewReferenceRepository from './in-memory-review-references';
import {
  createJsonSerializer, createRTracerLogger, createStreamLogger, Logger,
} from './logger';
import createSearchEuropePmc from './search-europe-pmc';
import bootstrapEditorialCommunities from '../data/bootstrap-editorial-communities';
import Doi from '../types/doi';
import { DomainEvent, isArticleEndorsedEvent, isArticleReviewedEvent } from '../types/domain-events';
import EditorialCommunityId from '../types/editorial-community-id';
import EditorialCommunityRepository from '../types/editorial-community-repository';
import EndorsementsRepository from '../types/endorsements-repository';
import HypothesisAnnotationId from '../types/hypothesis-annotation-id';
import { Json } from '../types/json';
import { NonEmptyArray } from '../types/non-empty-array';
import { ReviewId } from '../types/review-id';
import ReviewReferenceRepository from '../types/review-reference-repository';

const populateEditorialCommunities = (logger: Logger): EditorialCommunityRepository => {
  const repository = createEditorialCommunityRepository(logger);
  for (const editorialCommunity of bootstrapEditorialCommunities) {
    void repository.add(editorialCommunity);
  }
  return repository;
};

const populateEndorsementsRepository = (
  events: ReadonlyArray<DomainEvent>,
): EndorsementsRepository => (
  createEndorsementsRepository(events.filter(isArticleEndorsedEvent))
);

const populateReviewReferenceRepository = (
  events: ReadonlyArray<DomainEvent>,
): ReviewReferenceRepository => createReviewReferenceRepository(events.filter(isArticleReviewedEvent));

const getJson = async (uri: string): Promise<Json> => {
  const response = await axios.get<Json>(uri);
  return response.data;
};

const getEventsFromDataFiles = (): ReadonlyArray<DomainEvent> => {
  const editorialCommunities = [
    '53ed5364-a016-11ea-bb37-0242ac130002',
    '74fd66e9-3b90-4b5a-a4ab-5be83db4c5de',
    '316db7d9-88cc-4c26-b386-f067e0f56334',
    '10360d97-bf52-4aef-b2fa-2f60d319edd7',
    '10360d97-bf52-4aef-b2fa-2f60d319edd8',
    'b560187e-f2fb-4ff9-a861-a204f3fc0fb0',
  ];

  const parsedEvents: Array<DomainEvent> = [];

  for (const editorialCommunityId of editorialCommunities) {
    const fileContents = fs.readFileSync(`./data/endorsements/${editorialCommunityId}.csv`);
    parsedEvents.push(...csvParseSync(fileContents, { fromLine: 2 })
      .map(([date, articleDoi]: [string, string]): DomainEvent => ({
        type: 'ArticleEndorsed',
        date: new Date(date),
        actorId: new EditorialCommunityId(editorialCommunityId),
        articleId: new Doi(articleDoi),
      })));
  }

  const unserializeReviewId = (reviewId: string): ReviewId => {
    const [protocol, value] = reviewId.split(':', 2);
    switch (protocol) {
      case 'doi':
        return new Doi(value);
      case 'hypothesis':
        return new HypothesisAnnotationId(value);
      default:
        throw new Error(`Unable to unserialize ReviewId: "${reviewId}"`);
    }
  };
  for (const editorialCommunityId of editorialCommunities) {
    const fileContents = fs.readFileSync(`./data/reviews/${editorialCommunityId}.csv`);
    parsedEvents.push(...csvParseSync(fileContents, { fromLine: 2 })
      .map(([date, articleDoi, reviewId]: [string, string, string]): DomainEvent => ({
        type: 'ArticleReviewed',
        date: new Date(date),
        actorId: new EditorialCommunityId(editorialCommunityId),
        articleId: new Doi(articleDoi),
        reviewId: unserializeReviewId(reviewId),
      })));
  }

  const fileContents = fs.readFileSync('./data/editorial-community-joined.csv');
  parsedEvents.push(...csvParseSync(fileContents, { fromLine: 2 })
    .map(([date, editorialCommunityId]: [string, string]): DomainEvent => ({
      type: 'EditorialCommunityJoined',
      date: new Date(date),
      actorId: new EditorialCommunityId(editorialCommunityId),
    })));

  return parsedEvents;
};

const createInfrastructure = (): Adapters => {
  const logger = createRTracerLogger(
    createStreamLogger(
      process.stdout,
      createJsonSerializer(!!process.env.PRETTY_LOG),
    ),
  );
  const getXml = createGetXml();
  const fetchDataset = createFetchDataset(logger);
  const fetchDataciteReview = createFetchDataciteReview(fetchDataset, logger);
  const fetchHypothesisAnnotation = createFetchHypothesisAnnotation(getJson, logger);
  const searchEuropePmc = createSearchEuropePmc(getJson, logger);
  const editorialCommunities = populateEditorialCommunities(logger);
  const events = getEventsFromDataFiles() as unknown as NonEmptyArray<DomainEvent>;
  const reviewReferenceRepository = populateReviewReferenceRepository(events);
  const { findReviewsForArticleVersionDoi, findReviewsForEditorialCommunityId } = reviewReferenceRepository;

  return {
    fetchArticle: createFetchCrossrefArticle(getXml, logger),
    getBiorxivCommentCount: createGetBiorxivCommentCount(createGetDisqusPostCount(getJson, logger), logger),
    fetchReview: createFetchReview(fetchDataciteReview, fetchHypothesisAnnotation),
    fetchStaticFile: createFetchStaticFile(logger),
    searchEuropePmc,
    editorialCommunities,
    endorsements: populateEndorsementsRepository(events),
    reviewReferenceRepository,
    findReviewsForArticleVersionDoi,
    findReviewsForEditorialCommunityId,
    filterEvents: createFilterEvents(events),
    logger,
  };
};

export default createInfrastructure;
