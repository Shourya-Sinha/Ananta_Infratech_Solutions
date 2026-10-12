const { validateContent, defaultContentCopy, SECTION_KEYS } = require("../../src/modules/cms/cms.content");

// Pure validation tests for the public website CMS content (no DB needed).
describe("CMS content validation", () => {
  test("the bundled default content is valid", () => {
    const out = validateContent(defaultContentCopy());
    expect(Object.keys(out).sort()).toEqual([...SECTION_KEYS].sort());
  });

  test("drops unknown top-level keys", () => {
    const input = { ...defaultContentCopy(), secretAdminNote: "do not publish" };
    const out = validateContent(input);
    expect(out.secretAdminNote).toBeUndefined();
  });

  test("rejects a missing section", () => {
    const input = defaultContentCopy();
    delete input.projects;
    expect(() => validateContent(input)).toThrow(/Missing section "projects"/);
  });

  test("rejects a list section given as an object, and vice versa", () => {
    const input = defaultContentCopy();
    input.services = {};
    expect(() => validateContent(input)).toThrow(/must be a list/);
    const input2 = defaultContentCopy();
    input2.home = [];
    expect(() => validateContent(input2)).toThrow(/must be an object/);
  });

  test("rejects javascript: and data: links and image sources", () => {
    const input = defaultContentCopy();
    input.home.primaryCta.href = "javascript:alert(1)";
    expect(() => validateContent(input)).toThrow(/must start with/);
    const input2 = defaultContentCopy();
    input2.home.heroImage = "data:text/html,boom";
    expect(() => validateContent(input2)).toThrow(/must start with/);
  });

  test("accepts relative paths, anchors, https and mailto/tel links", () => {
    const input = defaultContentCopy();
    input.home.primaryCta.href = "/contact";
    input.home.secondaryCta.href = "https://example.com/brochure.pdf";
    input.company.email = "info@example.com";
    input.company.social.linkedin = "https://www.linkedin.com/company/example";
    expect(() => validateContent(input)).not.toThrow();
  });

  test("rejects overly long text", () => {
    const input = defaultContentCopy();
    input.home.heroTitle = "x".repeat(5001);
    expect(() => validateContent(input)).toThrow(/too long/);
  });
});
