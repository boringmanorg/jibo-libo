import { describe, expect, it } from 'vitest';
import { TRANSPORT_QUESTIONS, TRANSPORT_REFERENCE, TRANSPORT_SOURCES, transportReferenceSchema } from '../src/data/meghalayaTransportReference';
import { rankedQuestionsFor } from '../src/data/rankedPageQuestions';
import { BRAND } from '../src/data/brandFacts';

describe('transport reference schema', () => {
  it('reuses the visible FAQ data rather than a separate answer snapshot', () => {
    expect(rankedQuestionsFor(TRANSPORT_REFERENCE.path)).toBe(TRANSPORT_QUESTIONS);
    const faq = transportReferenceSchema().find(node => node['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.map(node => node.acceptedAnswer.text)).toEqual(TRANSPORT_QUESTIONS.map(node => node.a));
  });

  it('attributes the article to the shared company and its checked sources', () => {
    const article = transportReferenceSchema().find(node => node['@type'] === 'Article');
    expect(article?.publisher?.name).toBe(BRAND.legalName);
    expect(article?.mainEntityOfPage).toBe('https://xtsy.one/travel-guide/guwahati-to-shillong-transport');
    expect(article?.citation).toEqual(TRANSPORT_SOURCES.map(node => node.url));
    expect(article?.dateModified).toBe('2026-11-18');
  });
});