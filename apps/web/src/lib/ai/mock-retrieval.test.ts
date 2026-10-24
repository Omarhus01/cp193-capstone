import { describe, expect, it } from "vitest";
import type { PreparedAnswer } from "@/lib/domain/qa";
import { getRetrievalProvider } from "./index";
import { createMockRetrievalProvider } from "./mock-retrieval";

// Placeholder text only: real answers are written and validated by the content owner.
const cited: PreparedAnswer = {
  fixedQuestionId: "q-cited",
  answer: {
    text: "Test answer",
    citations: [{ sourceId: "test-source", title: "Test source", locator: "p. 1" }],
  },
};
const uncited: PreparedAnswer = {
  fixedQuestionId: "q-uncited",
  answer: { text: "Test answer without a source", citations: [] },
};

describe("mock RetrievalProvider", () => {
  const provider = createMockRetrievalProvider([cited, uncited]);

  it("answers a fixed question with its prepared answer and citations", async () => {
    const result = await provider.answer({
      verseKey: "1:1",
      text: "Test question",
      fixedQuestionId: "q-cited",
    });
    expect(result).toEqual({ kind: "answered", answer: cited.answer });
  });

  it("declines a question the user typed", async () => {
    const result = await provider.answer({ verseKey: "1:1", text: "Test question" });
    expect(result).toEqual({ kind: "declined", reason: "noSupportingSources" });
  });

  it("declines an unknown fixed question", async () => {
    const result = await provider.answer({
      verseKey: "1:1",
      text: "Test question",
      fixedQuestionId: "q-missing",
    });
    expect(result.kind).toBe("declined");
  });

  it("declines rather than show an answer without a source", async () => {
    const result = await provider.answer({
      verseKey: "1:1",
      text: "Test question",
      fixedQuestionId: "q-uncited",
    });
    expect(result.kind).toBe("declined");
  });

  it("is what getRetrievalProvider returns until a real provider is plugged in", async () => {
    const result = await getRetrievalProvider().answer({ verseKey: "1:1", text: "Test question" });
    expect(result.kind).toBe("declined");
  });
});
