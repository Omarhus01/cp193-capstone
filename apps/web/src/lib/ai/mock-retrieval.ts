import type { PreparedAnswer } from "@/lib/domain/qa";
import type { RetrievalProvider } from "./retrieval";

/**
 * Serves the owner's prepared answers to fixed questions and declines everything else,
 * including a prepared answer that has no citations.
 */
export function createMockRetrievalProvider(prepared: PreparedAnswer[]): RetrievalProvider {
  const byQuestionId = new Map(prepared.map((p) => [p.fixedQuestionId, p.answer]));

  return {
    async answer(question) {
      const answer = question.fixedQuestionId
        ? byQuestionId.get(question.fixedQuestionId)
        : undefined;
      if (!answer || answer.citations.length === 0) {
        return { kind: "declined", reason: "noSupportingSources" };
      }
      return { kind: "answered", answer };
    },
  };
}
