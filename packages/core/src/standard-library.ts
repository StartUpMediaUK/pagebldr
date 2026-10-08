import data0 from "./catalogue/simple-header.json" with { type: "json" };
import data1 from "./catalogue/lead-magnet-hero.json" with { type: "json" };
import data2 from "./catalogue/assessment-hero.json" with { type: "json" };
import data3 from "./catalogue/recommendation-hero.json" with { type: "json" };
import data4 from "./catalogue/consultation-hero.json" with { type: "json" };
import data5 from "./catalogue/event-hero.json" with { type: "json" };
import data6 from "./catalogue/waitlist-hero.json" with { type: "json" };
import data7 from "./catalogue/newsletter-hero.json" with { type: "json" };
import data8 from "./catalogue/problem-solution.json" with { type: "json" };
import data9 from "./catalogue/benefit-grid.json" with { type: "json" };
import data10 from "./catalogue/numbered-steps.json" with { type: "json" };
import data11 from "./catalogue/assessment-explainer.json" with { type: "json" };
import data12 from "./catalogue/authority-gallery.json" with { type: "json" };
import data13 from "./catalogue/trust-strip.json" with { type: "json" };
import data14 from "./catalogue/statistics.json" with { type: "json" };
import data15 from "./catalogue/featured-proof.json" with { type: "json" };
import data16 from "./catalogue/testimonial-grid.json" with { type: "json" };
import data17 from "./catalogue/comparison.json" with { type: "json" };
import data18 from "./catalogue/faq.json" with { type: "json" };
import data19 from "./catalogue/mid-page-cta.json" with { type: "json" };
import data20 from "./catalogue/event-countdown-cta.json" with { type: "json" };
import data21 from "./catalogue/final-cta.json" with { type: "json" };
import data22 from "./catalogue/footer-legal.json" with { type: "json" };
import index from "./catalogue/index.json" with { type: "json" };
import type { BlockDefinition } from "./factories.js";
import type { PagebldrClipboard } from "./clipboard.js";
// Immutable package-native source characterizations; factories return independent values.
const blockData = [
  data0,
  data1,
  data2,
  data3,
  data4,
  data5,
  data6,
  data7,
  data8,
  data9,
  data10,
  data11,
  data12,
  data13,
  data14,
  data15,
  data16,
  data17,
  data18,
  data19,
  data20,
  data21,
  data22,
];
export const standardBlocks: readonly BlockDefinition[] = index.blocks.map(
  (metadata, i) =>
    Object.freeze({
      ...metadata,
      create: () => structuredClone(blockData[i]) as PagebldrClipboard,
    }),
);
