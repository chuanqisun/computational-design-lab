import { describe, expect, it } from "vitest";
import {
  buildGridConfig,
  getFeedbackPosition,
  getHeaderItemPosition,
  getPersonaPosition,
  getRankedItemPosition,
} from "./user-testing-layout";

describe("user-testing grid layout", () => {
  const items = [
    { width: 200, height: 300 },
    { width: 200, height: 300 },
    { width: 200, height: 300 },
  ];
  const numUsers = 2;
  const origin = { x: 100, y: 50 };
  const gaps = { colGap: 20, rowGap: 20 };
  const config = buildGridConfig(items, numUsers, origin, gaps);

  it("derives card dimensions from items", () => {
    expect(config.cardWidth).toBe(200);
    expect(config.cardHeight).toBe(300);
  });

  describe("header item positions", () => {
    it("places first item at origin", () => {
      const pos = getHeaderItemPosition(0, config);
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(50);
    });

    it("places second item one column to the right", () => {
      const pos = getHeaderItemPosition(1, config);
      expect(pos.x).toBe(100 + 200 + 20); // origin.x + cardWidth + colGap
      expect(pos.y).toBe(50);
    });

    it("places third item two columns to the right", () => {
      const pos = getHeaderItemPosition(2, config);
      expect(pos.x).toBe(100 + 2 * (200 + 20));
      expect(pos.y).toBe(50);
    });
  });

  describe("persona positions", () => {
    it("places persona to the left of col 1", () => {
      const pos = getPersonaPosition(0, config);
      expect(pos.x).toBe(100 - 200 - 20); // origin.x - personaWidth - colGap
      expect(pos.y).toBe(50 + 300 + 20); // header height + rowGap
    });

    it("second persona is below first", () => {
      const pos0 = getPersonaPosition(0, config);
      const pos1 = getPersonaPosition(1, config);
      expect(pos1.y).toBe(pos0.y + 300 + 20); // cardHeight + rowGap
    });
  });

  describe("ranked item positions", () => {
    it("rank 0 (least matching) is in col 1 at origin x", () => {
      const pos = getRankedItemPosition(0, 0, config);
      expect(pos.x).toBe(100); // col 1 = origin.x
      expect(pos.y).toBe(50 + 300 + 20); // first user row
    });

    it("rank N-1 (most matching) is in col N", () => {
      const pos = getRankedItemPosition(0, 2, config);
      expect(pos.x).toBe(100 + 2 * (200 + 20)); // col 3
      expect(pos.y).toBe(50 + 300 + 20);
    });

    it("second user row is below first", () => {
      const pos0 = getRankedItemPosition(0, 0, config);
      const pos1 = getRankedItemPosition(1, 0, config);
      expect(pos1.y).toBe(pos0.y + 300 + 20);
    });
  });

  describe("feedback positions", () => {
    it("is to the right of last item column", () => {
      const pos = getFeedbackPosition(0, config);
      expect(pos.x).toBe(100 + 3 * (200 + 20)); // after 3 item cols
      expect(pos.y).toBe(50 + 300 + 20); // first user row
    });

    it("second user feedback is below first", () => {
      const pos0 = getFeedbackPosition(0, config);
      const pos1 = getFeedbackPosition(1, config);
      expect(pos1.y).toBe(pos0.y + 300 + 20);
    });
  });

  describe("flexible order of arrival", () => {
    it("computes valid positions for any (userIndex, rankPosition) combination", () => {
      for (let k = 0; k < numUsers; k++) {
        for (let r = 0; r < items.length; r++) {
          const pos = getRankedItemPosition(k, r, config);
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.width).toBe(200);
          expect(pos.height).toBe(300);
        }
      }
    });
  });

  describe("non-uniform card sizes", () => {
    it("uses max dimensions from items", () => {
      const mixedItems = [
        { width: 200, height: 300 },
        { width: 250, height: 200 },
        { width: 180, height: 350 },
      ];
      const c = buildGridConfig(mixedItems, 2, { x: 0, y: 0 }, { colGap: 10, rowGap: 10 });
      expect(c.cardWidth).toBe(250);
      expect(c.cardHeight).toBe(350);
    });
  });

  describe("persona is left of header items, feedback is right", () => {
    it("persona x is less than first header item x", () => {
      const persona = getPersonaPosition(0, config);
      const header = getHeaderItemPosition(0, config);
      expect(persona.x).toBeLessThan(header.x);
    });

    it("feedback x is greater than last header item x", () => {
      const feedback = getFeedbackPosition(0, config);
      const lastHeader = getHeaderItemPosition(items.length - 1, config);
      expect(feedback.x).toBeGreaterThan(lastHeader.x);
    });
  });
});
