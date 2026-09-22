# Parity acceptance Documents

These immutable, product-neutral Documents define the target data exercised by
the Quizr-experience parity program. They use the `pagebldr` format and contain
no Quizr identifiers, routes or adoption compatibility data.

They intentionally use target Document schema version 2. The current package
supports version 1 and must reject these fixtures as future Documents until
Parity Phase 1 implements and tests the new package-native schema. They become
green public-interface fixtures incrementally:

| Fixture                           | Purpose                                                                                                                                                                                               | First green gate |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `project-enquiry.document.json`   | A 132-Element neutral recreation of the deeply designed page inspected in staging. It exercises a realistic hierarchy, Classes, Variables, anchors, destinations, responsive styles and SEO settings. | Parity Phase 2   |
| `all-elements.document.json`      | One instance of every target standard Element type with definition defaults. It freezes the 24-type standard library inventory.                                                                       | Parity Phase 2   |
| `responsive-states.document.json` | Compact deterministic coverage of Desktop/Tablet/Mobile declarations, Normal/Hover/Focus Visible states, Classes, Variables and responsive hiding.                                                    | Parity Phase 1   |

## Fixture rules

- Tests load these files through public `builder.documents` interfaces.
- A fixture is never rewritten merely to make an implementation test pass. A
  behavior change requires product-owner review and an explanation in the
  current parity-phase audit.
- IDs and content are deterministic. Tests must not depend on generated values.
- Visual tests may prepare Host Resources, but may not mutate the stored
  Document to produce the expected page.
- The 132-Element fixture is the seeded Document on the Reference Host's default
  editor route once its required Element definitions are available.
- The all-Elements fixture is a contract fixture, not a recommended page design.

## Target standard Element inventory

1. Container
2. Heading
3. Rich Text
4. Button
5. Logo
6. Menu
7. Copyright
8. Image
9. Video
10. Icon
11. Divider
12. Spacer
13. List
14. Icon List
15. Accordion
16. Tabs
17. Testimonial
18. Star Rating
19. Counter
20. Progress
21. Countdown
22. Social Links
23. Logo Cloud
24. Gallery / Carousel
