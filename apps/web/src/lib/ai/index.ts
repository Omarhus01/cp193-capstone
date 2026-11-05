import { createMockRetrievalProvider } from "./mock-retrieval";
import type { RetrievalProvider } from "./retrieval";

export type { RetrievalProvider } from "./retrieval";

/**
 * The provider for questions a reader types. For now a mock with no prepared answers, so every
 * question is declined; the RAG service plugs in here (#10). The fixed questions and their answers
 * are stored content and don't go through it (lib/services/qa.ts, ADR 0018).
 */
export function getRetrievalProvider(): RetrievalProvider {
  return createMockRetrievalProvider([]);
}
