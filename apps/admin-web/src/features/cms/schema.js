// Describes every editable field of the public website. The CMS editor renders
// its forms from this schema, and the shape must match packages/cms-defaults/content.json
// (the API rejects unknown sections and enforces the list/object shapes).
//
// Field types:
//   text | textarea | url | date | bool | select | icon
//   group        — nested object with `fields`
//   stringList   — array of strings
//   collection   — array of objects with `fields`; `empty` is the new-item template

export const ICON_NAMES = ["ShieldCheck", "Clock", "BadgeCheck", "Users", "Wallet", "Handshake", "Home", "Building2", "Route", "Factory", "PaintRoller", "HardHat", "Star"];
export const PROJECT_CATEGORIES = ["Residential", "Commercial", "Infrastructure", "Industrial", "Institutional"];
export const PROJECT_STATUSES = ["Completed", "Ongoing", "Upcoming"];
export const NEWS_CATEGORIES = ["Company", "Safety", "Technology", "Projects", "Careers"];

export const CMS_SECTIONS = [
  {
    id: "company",
    label: "Company & contact",
    description: "Name, phone, email, address and social links. Shown in the header, footer and contact page.",
    kind: "object",
    fields: [
      { type: "text", key: "name", label: "Legal / display name" },
      { type: "text", key: "shortName", label: "Short name (header logo)" },
      { type: "text", key: "tagline", label: "Tagline" },
      { type: "text", key: "established", label: "Established (year)" },
      { type: "text", key: "registration", label: "Registration (CIN)" },
      { type: "text", key: "phone", label: "Phone" },
      { type: "text", key: "altPhone", label: "Alternate phone" },
      { type: "text", key: "whatsapp", label: "WhatsApp number", help: "Digits with country code, e.g. 919876543210" },
      { type: "text", key: "email", label: "Email" },
      { type: "textarea", key: "address", label: "Office address", rows: 2 },
      { type: "text", key: "hours", label: "Working hours" },
      { type: "url", key: "mapEmbedUrl", label: "Google Maps embed URL", help: "Optional. Paste the embed src from Google Maps → Share → Embed." },
      { type: "group", key: "social", label: "Social links", fields: [
        { type: "url", key: "linkedin", label: "LinkedIn" },
        { type: "url", key: "facebook", label: "Facebook" },
        { type: "url", key: "instagram", label: "Instagram" },
        { type: "url", key: "youtube", label: "YouTube" }
      ] }
    ]
  },
  {
    id: "announcement",
    label: "Announcement bar",
    description: "A thin banner shown above every page. Turn it off when there is nothing to announce.",
    kind: "object",
    fields: [
      { type: "bool", key: "enabled", label: "Show announcement bar" },
      { type: "textarea", key: "text", label: "Message", rows: 2 },
      { type: "text", key: "linkLabel", label: "Link text" },
      { type: "url", key: "link", label: "Link" }
    ]
  },
  {
    id: "home",
    label: "Home page",
    description: "Hero, statistics, introduction, capabilities, process and closing call-to-action.",
    kind: "object",
    fields: [
      { type: "text", key: "heroEyebrow", label: "Hero eyebrow line" },
      { type: "textarea", key: "heroTitle", label: "Hero headline", rows: 2 },
      { type: "textarea", key: "heroSubtitle", label: "Hero subtitle", rows: 3 },
      { type: "url", key: "heroImage", label: "Hero image", help: "Path like /images/hero-site.jpg, or an https:// image URL" },
      { type: "group", key: "primaryCta", label: "Primary button", fields: [
        { type: "text", key: "label", label: "Button text" },
        { type: "url", key: "href", label: "Link" }
      ] },
      { type: "group", key: "secondaryCta", label: "Secondary button", fields: [
        { type: "text", key: "label", label: "Button text" },
        { type: "url", key: "href", label: "Link" }
      ] },
      { type: "collection", key: "stats", label: "Statistics strip", itemLabel: "Statistic", empty: { value: "0", label: "New statistic" }, fields: [
        { type: "text", key: "value", label: "Value (e.g. 150+)" },
        { type: "text", key: "label", label: "Label" }
      ] },
      { type: "group", key: "intro", label: "Introduction", fields: [
        { type: "text", key: "eyebrow", label: "Eyebrow" },
        { type: "textarea", key: "title", label: "Heading", rows: 2 },
        { type: "textarea", key: "body", label: "Body", rows: 4 }
      ] },
      { type: "collection", key: "whyUs", label: "Why choose us (cards)", itemLabel: "Card", empty: { icon: "Star", title: "New point", body: "" }, fields: [
        { type: "icon", key: "icon", label: "Icon" },
        { type: "text", key: "title", label: "Title" },
        { type: "textarea", key: "body", label: "Text", rows: 2 }
      ] },
      { type: "collection", key: "process", label: "Our process (steps)", itemLabel: "Step", empty: { title: "New step", body: "" }, fields: [
        { type: "text", key: "title", label: "Step title" },
        { type: "textarea", key: "body", label: "Step text", rows: 2 }
      ] },
      { type: "text", key: "ctaTitle", label: "Closing call-to-action heading" },
      { type: "textarea", key: "ctaBody", label: "Closing call-to-action text", rows: 2 }
    ]
  },
  {
    id: "about",
    label: "About us",
    description: "Company story, mission, vision, values, leadership, milestones and compliance points.",
    kind: "object",
    fields: [
      { type: "text", key: "title", label: "Page title" },
      { type: "textarea", key: "intro", label: "Intro", rows: 3 },
      { type: "url", key: "image", label: "Page image" },
      { type: "textarea", key: "story", label: "Our story (blank line between paragraphs)", rows: 8 },
      { type: "textarea", key: "mission", label: "Mission", rows: 2 },
      { type: "textarea", key: "vision", label: "Vision", rows: 2 },
      { type: "collection", key: "values", label: "Values", itemLabel: "Value", empty: { title: "New value", body: "" }, fields: [
        { type: "text", key: "title", label: "Title" },
        { type: "textarea", key: "body", label: "Text", rows: 2 }
      ] },
      { type: "collection", key: "leadership", label: "Leadership team", itemLabel: "Person", empty: { name: "", role: "Director", bio: "" }, fields: [
        { type: "text", key: "name", label: "Name" },
        { type: "text", key: "role", label: "Role" },
        { type: "textarea", key: "bio", label: "Short bio", rows: 2 }
      ] },
      { type: "collection", key: "milestones", label: "Milestones timeline", itemLabel: "Milestone", empty: { year: "2026", title: "", body: "" }, fields: [
        { type: "text", key: "year", label: "Year" },
        { type: "text", key: "title", label: "Title" },
        { type: "textarea", key: "body", label: "Text", rows: 2 }
      ] },
      { type: "collection", key: "certifications", label: "Compliance & certifications", itemLabel: "Item", empty: { title: "", body: "" }, fields: [
        { type: "text", key: "title", label: "Title" },
        { type: "textarea", key: "body", label: "Text", rows: 2 }
      ] }
    ]
  },
  {
    id: "services",
    label: "Services",
    description: "Each service gets its own page at /services/<slug>.",
    kind: "list",
    itemLabel: "Service",
    empty: { slug: "new-service", title: "New service", icon: "Star", summary: "", description: "", highlights: [] },
    titleKey: "title",
    fields: [
      { type: "text", key: "title", label: "Service name" },
      { type: "text", key: "slug", label: "URL slug", help: "Lowercase letters, numbers and hyphens. Used in /services/<slug>." },
      { type: "icon", key: "icon", label: "Icon" },
      { type: "textarea", key: "summary", label: "Summary (cards)", rows: 2 },
      { type: "textarea", key: "description", label: "Full description", rows: 4 },
      { type: "stringList", key: "highlights", label: "Highlights" }
    ]
  },
  {
    id: "projects",
    label: "Projects",
    description: "Portfolio of completed and ongoing work. Mark up to three as featured for the home page.",
    kind: "list",
    itemLabel: "Project",
    empty: { slug: "new-project", title: "New project", category: "Residential", status: "Ongoing", location: "", client: "", year: "2026", value: "", area: "", image: "/images/hero-site.jpg", featured: false, description: "", highlights: [] },
    titleKey: "title",
    fields: [
      { type: "text", key: "title", label: "Project name" },
      { type: "text", key: "slug", label: "URL slug", help: "Used in /projects/<slug>." },
      { type: "select", key: "category", label: "Category", options: PROJECT_CATEGORIES },
      { type: "select", key: "status", label: "Status", options: PROJECT_STATUSES },
      { type: "text", key: "location", label: "Location" },
      { type: "text", key: "client", label: "Client" },
      { type: "text", key: "year", label: "Year" },
      { type: "text", key: "area", label: "Area (e.g. 1.2 lakh sq. ft.)" },
      { type: "text", key: "value", label: "Project value (or 'Confidential')" },
      { type: "url", key: "image", label: "Image" },
      { type: "bool", key: "featured", label: "Featured on home page" },
      { type: "textarea", key: "description", label: "Description", rows: 4 },
      { type: "stringList", key: "highlights", label: "Highlights" }
    ]
  },
  {
    id: "clients",
    label: "Clients",
    description: "Client sectors shown as logo-style chips on the home and clients pages.",
    kind: "list",
    itemLabel: "Client",
    empty: { name: "New client", sector: "" },
    titleKey: "name",
    fields: [
      { type: "text", key: "name", label: "Name (or client type)" },
      { type: "text", key: "sector", label: "Sector" }
    ]
  },
  {
    id: "testimonials",
    label: "Testimonials",
    description: "Client quotes. Only use quotes you have permission to publish.",
    kind: "list",
    itemLabel: "Testimonial",
    empty: { quote: "", name: "", role: "" },
    titleKey: "name",
    fields: [
      { type: "textarea", key: "quote", label: "Quote", rows: 3 },
      { type: "text", key: "name", label: "Name" },
      { type: "text", key: "role", label: "Role / company" }
    ]
  },
  {
    id: "safety",
    label: "Safety",
    description: "Health, safety and environment commitments.",
    kind: "object",
    fields: [
      { type: "text", key: "title", label: "Headline" },
      { type: "textarea", key: "intro", label: "Intro", rows: 3 },
      { type: "url", key: "image", label: "Image" },
      { type: "collection", key: "points", label: "Safety controls", itemLabel: "Control", empty: { title: "", body: "" }, fields: [
        { type: "text", key: "title", label: "Title" },
        { type: "textarea", key: "body", label: "Text", rows: 2 }
      ] }
    ]
  },
  {
    id: "careers",
    label: "Careers & registration",
    description: "Contractor and worker registration (launching soon), plus open roles.",
    kind: "object",
    fields: [
      { type: "text", key: "title", label: "Headline" },
      { type: "textarea", key: "intro", label: "Intro", rows: 3 },
      { type: "text", key: "launchLabel", label: "Status badge text", help: "e.g. Application launching soon" },
      ...["contractor", "worker"].map((who) => ({
        type: "group",
        key: who,
        label: who === "contractor" ? "Contractor registration card" : "Worker registration card",
        fields: [
          { type: "text", key: "title", label: "Card title" },
          { type: "textarea", key: "body", label: "Card text", rows: 2 },
          { type: "stringList", key: "benefits", label: "Benefits" }
        ]
      })),
      { type: "collection", key: "openings", label: "Open roles", itemLabel: "Role", empty: { title: "New role", location: "", type: "Full-time", department: "" }, fields: [
        { type: "text", key: "title", label: "Job title" },
        { type: "text", key: "location", label: "Location" },
        { type: "text", key: "type", label: "Type (Full-time, Contract…)" },
        { type: "text", key: "department", label: "Department" }
      ] }
    ]
  },
  {
    id: "news",
    label: "News",
    description: "Articles and announcements. Each gets a page at /news/<slug>.",
    kind: "list",
    itemLabel: "Article",
    empty: { slug: "new-article", date: new Date().toISOString().slice(0, 10), category: "Company", title: "New article", excerpt: "", body: "" },
    titleKey: "title",
    fields: [
      { type: "text", key: "title", label: "Headline" },
      { type: "text", key: "slug", label: "URL slug", help: "Used in /news/<slug>." },
      { type: "date", key: "date", label: "Date" },
      { type: "select", key: "category", label: "Category", options: NEWS_CATEGORIES },
      { type: "textarea", key: "excerpt", label: "Excerpt (cards)", rows: 2 },
      { type: "textarea", key: "body", label: "Article body (blank line between paragraphs)", rows: 6 }
    ]
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Questions shown on the FAQ page.",
    kind: "list",
    itemLabel: "Question",
    empty: { question: "New question?", answer: "" },
    titleKey: "question",
    fields: [
      { type: "text", key: "question", label: "Question" },
      { type: "textarea", key: "answer", label: "Answer", rows: 3 }
    ]
  },
  {
    id: "contact",
    label: "Contact page",
    description: "Heading and the service options in the enquiry form.",
    kind: "object",
    fields: [
      { type: "text", key: "title", label: "Headline" },
      { type: "textarea", key: "intro", label: "Intro", rows: 2 },
      { type: "stringList", key: "services", label: "Service options in the enquiry form" }
    ]
  }
];

/** Public routes the preview can jump to. Detail pages use the first item of each list. */
export function previewRoutes(draft) {
  const routes = [
    { path: "/", label: "Home" },
    { path: "/about", label: "About" },
    { path: "/services", label: "Services" },
    ...(draft.services?.[0] ? [{ path: `/services/${draft.services[0].slug}`, label: `Service: ${draft.services[0].title}` }] : []),
    { path: "/projects", label: "Projects" },
    ...(draft.projects?.[0] ? [{ path: `/projects/${draft.projects[0].slug}`, label: `Project: ${draft.projects[0].title}` }] : []),
    { path: "/safety", label: "Safety" },
    { path: "/clients", label: "Clients" },
    { path: "/careers", label: "Careers & registration" },
    { path: "/news", label: "News" },
    ...(draft.news?.[0] ? [{ path: `/news/${draft.news[0].slug}`, label: `Article: ${draft.news[0].title}` }] : []),
    { path: "/faq", label: "FAQ" },
    { path: "/contact", label: "Contact" }
  ];
  return routes;
}

