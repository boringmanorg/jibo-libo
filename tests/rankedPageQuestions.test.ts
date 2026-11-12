import { describe, expect, it } from 'vitest';
import { RANKED_PAGE_QUESTIONS, rankedQuestionsFor } from '../src/data/rankedPageQuestions';

describe('ranked page selection', () => {
  it('covers exactly the requested 30 distinct ranking pages', () => {
    expect(Object.keys(RANKED_PAGE_QUESTIONS)).toHaveLength(30);
    expect(rankedQuestionsFor('/')).toBeDefined();
    expect(rankedQuestionsFor('/best-hostel-in-shillong')).toBeDefined();
    expect(rankedQuestionsFor('/destinations/meghalaya/nongstoin/langshiang-falls')).toBeDefined();
  });
  it('does not add answers to unselected pages', () => {
    expect(rankedQuestionsFor('/admin')).toBeUndefined();
    expect(rankedQuestionsFor('/unknown-page')).toBeUndefined();
  });
});