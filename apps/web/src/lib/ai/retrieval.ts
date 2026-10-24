import type { QaResult, Question } from "@/lib/domain/qa";

/**
 * Answers questions from the sources, with citations, or declines. Sprint 1 uses the mock in
 * ./mock-retrieval.ts; the RAG service (services/ai/) plugs in here later without page changes.
 */
export interface RetrievalProvider {
  answer(question: Question): Promise<QaResult>;
}
