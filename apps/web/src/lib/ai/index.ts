import { createMockRetrievalProvider } from "./mock-retrieval";
import type { RetrievalProvider } from "./retrieval";

export type { RetrievalProvider } from "./retrieval";

/**
 * The provider the services use. For now a mock with no prepared answers, so every question is
 * declined; the answers from content/ arrive with the Q&A panel (issue #5).
 */
export function getRetrievalProvider(): RetrievalProvider {
  return createMockRetrievalProvider([]);
}
