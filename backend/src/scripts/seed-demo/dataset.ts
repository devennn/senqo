/**
 * Static content and deterministic helpers for the local demo seed.
 * Run with `npm run demo:seed` (see README → Demo data). Local only — the
 * script refuses non-local DATABASE_URL hosts unless `--force` is passed.
 * Demo data is Malaysian: +60 phone numbers, RM pricing, local carriers.
 */

export const DEMO_WORKSPACE_NAME = "Acme Workspace";
export const DEMO_USER_EMAIL = "demo@acme.local";
export const DEMO_USER_PASSWORD = "acme-demo-2026";
export const DEMO_USER_NAME = "Ava Thornton";
export const DEMO_WORKSPACE_TIMEZONE = "Asia/Kuala_Lumpur";
export const DEMO_SEED = 20261015;

export const DEMO_COUNTS = {
  contacts: 60,
  conversations: 90,
  reports: 12,
  leads: 24,
  tasks: 14,
} as const;

/** Deterministic PRNG (mulberry32) so every run produces the same dataset. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export function isoMinutesBefore(referenceMs: number, minutes: number): string {
  return new Date(referenceMs - minutes * 60_000).toISOString();
}

/** Malaysian mobile display: +60 12-345 6789 (digits: 60123456789). */
export function malaysianMobile(prefix: string, local7: string): string {
  return `+60 ${prefix}-${local7.slice(0, 3)} ${local7.slice(3)}`;
}

export function malaysianMobileDigits(prefix: string, local7: string): string {
  return `60${prefix}${local7}`;
}

// ---------------------------------------------------------------------------
// WhatsApp lines
// ---------------------------------------------------------------------------

export type DemoConnectionKey = "main" | "sales" | "support" | "wholesale";

export type DemoConnectionSpec = {
  key: DemoConnectionKey;
  displayName: string;
  /** Display form; digits are derived from this. */
  phoneNumber: string;
  mode: "live" | "dry_run" | "testing";
};

export const DEMO_CONNECTIONS: readonly DemoConnectionSpec[] = [
  { key: "main", displayName: "Main WhatsApp", phoneNumber: "+60 12-200 0101", mode: "live" },
  { key: "sales", displayName: "Sales Line", phoneNumber: "+60 12-200 0202", mode: "dry_run" },
  { key: "support", displayName: "Support Line", phoneNumber: "+60 12-200 0303", mode: "testing" },
  { key: "wholesale", displayName: "Wholesale Line", phoneNumber: "+60 12-200 0404", mode: "live" },
];

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export type DemoAgentKey = "sales" | "support" | "booking" | "wholesale";

export type DemoAgentSpec = {
  key: DemoAgentKey;
  profileName: string;
  behavior: string;
  connections: DemoConnectionKey[];
  contextGroups: string[];
  templateGroups: string[];
  handoffGroups: string[];
  assetGroups: string[];
  tools: string[];
  skills: string[];
  notifyDemoUser: boolean;
};

export const DEMO_AGENTS: readonly DemoAgentSpec[] = [
  {
    key: "sales",
    profileName: "Sales Assistant",
    behavior: [
      "You are the sales assistant for Acme Chocolate Co., a small-batch chocolate shop in Bangsar, Kuala Lumpur.",
      "Help customers with pricing (RM), gift boxes, availability, and delivery across Malaysia.",
      "Suggest relevant add-ons (gift wrap, larger boxes) without being pushy.",
      "Confirm delivery windows from workspace context before promising any date, and remember East Malaysia takes longer.",
      "Hand off to a human for refunds, damaged parcels, angry customers, bulk quotes, or legal/press.",
    ].join("\n"),
    connections: ["main", "sales"],
    contextGroups: ["Opening Hours & Location", "Pricing & Plans", "Shipping & Returns"],
    templateGroups: ["Pricing Questions", "Delivery & Returns", "Payment & E-Wallets"],
    handoffGroups: ["Escalations"],
    assetGroups: ["Product Catalogue"],
    tools: ["get_weather", "get_exchange_rate", "look_up_demo_order", "estimate_delivery"],
    skills: ["check_availability", "upsell_cross_sell"],
    notifyDemoUser: true,
  },
  {
    key: "support",
    profileName: "Support Concierge",
    behavior: [
      "You are the support concierge for Acme Chocolate Co. in Kuala Lumpur.",
      "Handle order status, damaged items, delivery issues, and billing questions.",
      "Always look up the order before answering status questions.",
      "Hand off to a human for refunds, disputes, and repeated complaints.",
    ].join("\n"),
    connections: ["support"],
    contextGroups: ["Shipping & Returns", "Company Overview"],
    templateGroups: ["Delivery & Returns", "Payment & E-Wallets"],
    handoffGroups: ["Escalations", "Billing Issues"],
    assetGroups: ["Brand Media"],
    tools: ["look_up_demo_order", "estimate_delivery"],
    skills: ["order_issue_triage", "purchase_history_review"],
    notifyDemoUser: true,
  },
  {
    key: "booking",
    profileName: "Booking Assistant",
    behavior: [
      "You manage chocolate workshop bookings for Acme Chocolate Co.",
      "Offer available slots at the Bangsar outlet, confirm party size, and note dietary requirements.",
    ].join("\n"),
    connections: [],
    contextGroups: ["Opening Hours & Location"],
    templateGroups: ["Booking & Availability"],
    handoffGroups: [],
    assetGroups: ["Product Catalogue"],
    tools: [],
    skills: ["check_availability"],
    notifyDemoUser: false,
  },
  {
    key: "wholesale",
    profileName: "Wholesale Assistant",
    behavior: [
      "You support wholesale and corporate accounts for Acme Chocolate Co.",
      "Quote from the corporate tiers, confirm MOQ and lead times, and explain branding options.",
      "Hand off for custom bulk quotes, invoices, and payment disputes.",
    ].join("\n"),
    connections: ["wholesale"],
    contextGroups: ["Corporate & Wholesale", "Pricing & Plans", "Shipping & Returns"],
    templateGroups: ["Pricing Questions", "Payment & E-Wallets"],
    handoffGroups: ["Escalations", "Billing Issues"],
    assetGroups: ["Corporate Gifting Kit", "Product Catalogue"],
    tools: ["get_exchange_rate", "look_up_demo_order"],
    skills: ["upsell_cross_sell", "purchase_history_review"],
    notifyDemoUser: false,
  },
];

// ---------------------------------------------------------------------------
// Knowledge content
// ---------------------------------------------------------------------------

export type DemoEntry = { title: string; body: string };

export const DEMO_CONTEXT_GROUPS: readonly { name: string; entries: DemoEntry[] }[] = [
  {
    name: "Opening Hours & Location",
    entries: [
      {
        title: "Operating Hours",
        body: "Bangsar outlet: Monday to Saturday 10:00–22:00, Sunday 11:00–20:00. Last workshop booking starts one hour before closing.",
      },
      {
        title: "Store Locations",
        body: "Main store: 18 Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur. Second counter: Lot 10, Bukit Bintang, 55100 Kuala Lumpur (open Friday to Sunday).",
      },
      {
        title: "Public Holidays & Closures",
        body: "Closed on Hari Raya Puasa day 1–2, Chinese New Year day 1–2, and Deepavali. Reduced hours (12:00–18:00) on the eves of each festival and on Merdeka Day.",
      },
    ],
  },
  {
    name: "Pricing & Plans",
    entries: [
      {
        title: "Signature Box Pricing",
        body: "12-piece box RM68, 24-piece box RM128, 48-piece celebration box RM228. Gift wrap is RM12 per box. Prices include SST.",
      },
      {
        title: "Corporate Gifting Tiers",
        body: "10–49 boxes: 10% off and free branded sleeve. 50–199 boxes: 18% off and free Klang Valley delivery. 200+ boxes: custom quote from a human.",
      },
      {
        title: "Payment Methods",
        body: "In store: cards, DuitNow QR, Touch 'n Go eWallet, and GrabPay. Online: FPX and cards. Bank transfer accepted for invoices above RM1,000.",
      },
      {
        title: "Seasonal Offers",
        body: "Quiet hour every Monday 10:00–12:00: 15% off all boxes, in store only. Not combinable with corporate tiers.",
      },
    ],
  },
  {
    name: "Shipping & Returns",
    entries: [
      {
        title: "Delivery Windows",
        body: "Klang Valley 1–2 working days, West Malaysia 2–4 working days, East Malaysia (Sabah and Sarawak) 3–6 working days. Couriers: J&T Express, Pos Laju, and Ninja Van.",
      },
      {
        title: "Free Delivery Threshold",
        body: "Free standard delivery within West Malaysia on orders over RM150, including corporate orders under 50 boxes.",
      },
      {
        title: "Returns & Refunds Policy",
        body: "Unopened boxes can be returned within 14 days for a full refund. Melted or damaged chocolate is refunded or replaced on photo evidence.",
      },
      {
        title: "Damaged Parcels",
        body: "Report damage within 48 hours with a photo of the parcel. Replacements ship the next working day from Bangsar.",
      },
    ],
  },
  {
    name: "Company Overview",
    entries: [
      {
        title: "About Acme",
        body: "Acme Chocolate Co. is a family-run shop in Bangsar, Kuala Lumpur making small-batch chocolate since 2014.",
      },
      {
        title: "Sourcing & Allergens",
        body: "Couverture chocolate sourced from Sabah-grown cacao and imported Belgian couverture. All boxes may contain traces of milk, nuts, and gluten.",
      },
      {
        title: "Halal & Certification Notes",
        body: "The kitchen is not JAKIM-halal certified, but ingredients contain no pork, lard, or alcohol. A separate vegetarian line uses dedicated moulds.",
      },
      {
        title: "Contact Channels",
        body: "WhatsApp is the fastest channel. Email hello@acmechocolate.my for invoices and press.",
      },
    ],
  },
  {
    name: "Corporate & Wholesale",
    entries: [
      {
        title: "Wholesale Terms",
        body: "Wholesale MOQ is 50 boxes. Approved accounts get 30-day payment terms and a dedicated account manager.",
      },
      {
        title: "Custom Branding",
        body: "Logo sleeves and ribbon printing available from 100 boxes. Artwork needs 5 working days for approval before production.",
      },
      {
        title: "Bulk Delivery Scheduling",
        body: "Bulk deliveries run Monday to Friday, 9:00–17:00, with 3 working days notice. Split shipments to multiple office locations are possible.",
      },
    ],
  },
];

export const DEMO_TEMPLATE_GROUPS: readonly {
  name: string;
  entries: { question: string; answer: string }[];
}[] = [
  {
    name: "Pricing Questions",
    entries: [
      {
        question: "How much is the signature box?",
        answer:
          "Our 12-piece signature box is RM68, the 24-piece is RM128, and the 48-piece celebration box is RM228. Gift wrap is RM12 per box.",
      },
      {
        question: "Do you offer corporate discounts?",
        answer:
          "Yes — 10% off for 10–49 boxes, 18% off plus free Klang Valley delivery for 50–199 boxes. For 200+ boxes a teammate will prepare a custom quote.",
      },
      {
        question: "Can I pay by bank transfer?",
        answer:
          "Yes, bank transfer works for invoices above RM1,000 — just ask and we will send the invoice details.",
      },
      {
        question: "Is there a student discount?",
        answer:
          "Students get 10% off in store on weekdays with a valid student card. Not combinable with quiet-hour offers.",
      },
    ],
  },
  {
    name: "Delivery & Returns",
    entries: [
      {
        question: "How long does delivery take?",
        answer:
          "Klang Valley takes 1–2 working days, the rest of West Malaysia 2–4 working days, and East Malaysia 3–6 working days with J&T, Pos Laju, or Ninja Van.",
      },
      {
        question: "When is delivery free?",
        answer: "Standard delivery is free within West Malaysia on orders over RM150.",
      },
      {
        question: "What is your refund policy?",
        answer:
          "Unopened boxes can be returned within 14 days for a full refund. Damaged or melted chocolate is refunded or replaced on photo evidence.",
      },
      {
        question: "Do you deliver to Singapore?",
        answer:
          "Yes — Singapore orders ship with a cross-border courier and take 4–7 working days. Duties are calculated at checkout.",
      },
    ],
  },
  {
    name: "Booking & Availability",
    entries: [
      {
        question: "How do I book a workshop?",
        answer:
          "Chocolate workshops run Thursday to Sunday at the Bangsar outlet, RM50 per person (redeemable against a purchase over RM150). Tell us your preferred day and party size.",
      },
      {
        question: "How many people can join a workshop?",
        answer: "Workshops suit 2–10 people. Larger groups can book a private session by asking for a human.",
      },
      {
        question: "Can you cater dietary requirements?",
        answer: "Yes — vegan and nut-free flights are available when noted at booking at least 48 hours in advance.",
      },
    ],
  },
  {
    name: "Payment & E-Wallets",
    entries: [
      {
        question: "Can I pay with Touch 'n Go eWallet?",
        answer: "Yes — Touch 'n Go eWallet, GrabPay, and DuitNow QR all work in store. Online, we accept FPX and cards.",
      },
      {
        question: "Do you accept cash on delivery?",
        answer: "Cash on delivery is available with Ninja Van for orders up to RM300 within West Malaysia.",
      },
      {
        question: "Can I split payment between two cards?",
        answer: "In store we can split payment across up to two cards — just tell the counter staff before tapping.",
      },
    ],
  },
];

export const DEMO_HANDOFF_GROUPS: readonly {
  name: string;
  topics: { title: string; description: string }[];
}[] = [
  {
    name: "Escalations",
    topics: [
      {
        title: "Refund request",
        description: "Customer asks for a refund or threatens a chargeback — a teammate confirms eligibility.",
      },
      {
        title: "Damaged order",
        description: "Parcel arrived damaged or melted and the customer wants a replacement.",
      },
      {
        title: "Angry customer",
        description: "Customer is upset or repeating a complaint after an attempted resolution.",
      },
      {
        title: "Custom bulk quote",
        description: "Requests for 200+ boxes or bespoke corporate gifting need a human quote.",
      },
      {
        title: "Legal or press",
        description: "Anything mentioning lawyers, regulators, or press must reach a human immediately.",
      },
    ],
  },
  {
    name: "Billing Issues",
    topics: [
      {
        title: "Double charge",
        description: "Customer sees two charges for one order — teammate verifies and refunds.",
      },
      {
        title: "Invoice dispute",
        description: "Questions about B2B invoice amounts, SST details, or missing tax invoices.",
      },
      {
        title: "Payment failed",
        description: "Checkout payment keeps failing and the customer wants another route.",
      },
      {
        title: "Refund delay",
        description: "Approved refund has not arrived after five working days.",
      },
    ],
  },
  {
    name: "Product Quality",
    topics: [
      {
        title: "Wrong item received",
        description: "The box delivered does not match the order — teammate arranges the correct items.",
      },
      {
        title: "Foreign object concern",
        description: "Customer reports something unexpected in the chocolate; treat as safety-critical.",
      },
      {
        title: "Allergen safety concern",
        description: "Customer with a severe allergy needs written ingredient confirmation.",
      },
    ],
  },
];

export const DEMO_ASSET_GROUPS: readonly {
  name: string;
  docs: { fileName: string; mimeType: string; driveFileId: string; description: string }[];
  uploads: { fileName: string; mimeType: string; description: string; contentBase64: string }[];
}[] = [
  {
    name: "Product Catalogue",
    docs: [
      {
        fileName: "acme-price-list.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        driveFileId: "demo-drive-price-list",
        description: "Live price list with per-SKU pricing in RM, box sizes, corporate tiers, and gift-wrap fees.",
      },
      {
        fileName: "acme-catalogue.pdf",
        mimeType: "application/pdf",
        driveFileId: "demo-drive-catalogue",
        description: "Seasonal catalogue with product photos, tasting notes, and packaging options.",
      },
      {
        fileName: "stock-levels.csv",
        mimeType: "text/csv",
        driveFileId: "demo-drive-stock",
        description: "Daily stock snapshot per SKU including limited seasonal items and East Malaysia allocation.",
      },
    ],
    uploads: [
      {
        fileName: "price-list-summary.csv",
        mimeType: "text/csv",
        description: "One-page sendable price summary shared with customers who ask for prices.",
        contentBase64: Buffer.from(
          "sku,product,box_size,price_myr\nSIG-12,Signature,12,68.00\nSIG-24,Signature,24,128.00\nCEL-48,Celebration,48,228.00\n",
          "utf8",
        ).toString("base64"),
      },
      {
        fileName: "gift-box-photo.png",
        mimeType: "image/png",
        description: "Studio photo of the ribbon-tied gift box, used when customers ask what packaging looks like.",
        contentBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ],
  },
  {
    name: "Brand Media",
    docs: [
      {
        fileName: "brand-guide.pdf",
        mimeType: "application/pdf",
        driveFileId: "demo-drive-brand-guide",
        description: "Brand guide covering logo use, colours, and co-branding rules for partners.",
      },
    ],
    uploads: [
      {
        fileName: "logo-square.png",
        mimeType: "image/png",
        description: "Square Acme Chocolate Co. logo on cream background for partner co-branding.",
        contentBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ],
  },
  {
    name: "Corporate Gifting Kit",
    docs: [
      {
        fileName: "corporate-tiers.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        driveFileId: "demo-drive-corporate-tiers",
        description: "Corporate tier calculator with MOQ, discount bands, branding add-ons, and lead times.",
      },
      {
        fileName: "delivery-schedule.pdf",
        mimeType: "application/pdf",
        driveFileId: "demo-drive-delivery-schedule",
        description: "Bulk delivery calendar for Klang Valley and outstation pallet shipments.",
      },
    ],
    uploads: [
      {
        fileName: "wholesale-order-form.csv",
        mimeType: "text/csv",
        description: "Sendable wholesale order form with SKU list and account fields.",
        contentBase64: Buffer.from(
          "account,sku,quantity,delivery_date\n,SIG-24,, \n,CEL-48,, \n",
          "utf8",
        ).toString("base64"),
      },
    ],
  },
];

export const DEMO_SKILLS: readonly { displayName: string; description: string; content: string }[] = [
  {
    displayName: "Check Availability",
    description: "Confirm chocolate stock and packaging readiness before quoting.",
    content: `# Check Availability

## Goal
Confirm product availability before committing to customer delivery date.

## Steps
1. Confirm requested chocolate type (dark, milk, white, mix).
2. Check available box sizes and gift packaging options.
3. Verify quantity available for requested delivery timeline.
4. Reply with in-stock items and nearest alternatives for out-of-stock SKUs.
`,
  },
  {
    displayName: "Purchase History Review",
    description: "Use previous orders to personalize repeat purchase offers.",
    content: `# Purchase History Review

## Goal
Increase conversion by using customer past buying behavior.

## Steps
1. Retrieve latest 3 completed orders.
2. Identify preferred flavors, packaging style, and order quantity.
3. Suggest repeat bundle with a small upgrade or seasonal variant.
4. Mention previous delivery success to increase confidence.
`,
  },
  {
    displayName: "Upsell Cross Sell",
    description: "Recommend relevant add-ons for chocolate purchases.",
    content: `# Upsell Cross Sell

## Goal
Increase average order value with relevant suggestions.

## Steps
1. Start from confirmed base order.
2. Offer 1 upsell (premium box, larger size, premium mix).
3. Offer 1 cross-sell (gift card, ribbon, express delivery).
4. Keep options concise with clear price difference.
`,
  },
  {
    displayName: "Order Issue Triage",
    description: "Handle delivery and damaged-item issues quickly and clearly.",
    content: `# Order Issue Triage

## Goal
Resolve order issues quickly and preserve customer trust.

## Steps
1. Confirm order number and customer phone.
2. Classify issue: late delivery, damaged item, wrong item, missing item.
3. Capture evidence (photo/video) and timestamp.
4. Provide next action with ETA (replacement/refund/escalation).
`,
  },
];

export const DEMO_LABELS: readonly { name: string; description: string }[] = [
  { name: "VIP", description: "High-value or repeat customers" },
  { name: "Pricing question", description: "Asked about prices, discounts, or quotes" },
  { name: "Complaint", description: "Order or service complaint" },
  { name: "New lead", description: "First contact, potential wholesale or corporate customer" },
  { name: "Follow-up", description: "Waiting on customer or teammate response" },
  { name: "Refund", description: "Refund or chargeback discussed" },
  { name: "Wholesale", description: "Wholesale or corporate account enquiry" },
  { name: "Delivery issue", description: "Courier delays, damaged parcels, or wrong address" },
];

// ---------------------------------------------------------------------------
// Custom tool source code (compiled by the Tool Catalog on save)
// ---------------------------------------------------------------------------

export const DEMO_CUSTOM_TOOLS: readonly { displayName: string; description: string; sourceCode: string }[] = [
  {
    displayName: "Get Exchange Rate",
    description: "Convert MYR prices into another currency using free Open Exchange Rates (er-api) data.",
    sourceCode: `export async function execute(
  input: { base: string; target: string },
  _ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  const base = String(input.base || "MYR").trim().toUpperCase();
  const target = String(input.target || "SGD").trim().toUpperCase();
  const response = await fetch(\`https://open.er-api.com/v6/latest/\${encodeURIComponent(base)}\`);
  if (!response.ok) {
    return { ok: false, error: \`Exchange rate request failed: HTTP \${response.status}\` };
  }
  const data = await response.json();
  const rate = data?.rates?.[target];
  if (typeof rate !== "number") {
    return { ok: false, error: \`No rate for \${base} -> \${target}.\` };
  }
  return { ok: true, base, target, rate, updated_at: data.time_last_update_utc ?? null };
}
`,
  },
  {
    displayName: "Look Up Demo Order",
    description: "Look up a demo order status by order id (seeded sample orders, no external API).",
    sourceCode: `const DEMO_ORDERS: Record<string, { status: string; carrier: string; placed: string; eta: string; items: string }> = {
  "AC-1001": { status: "Delivered", carrier: "Pos Laju", placed: "2026-09-28", eta: "2026-10-01", items: "12-piece signature box" },
  "AC-1042": { status: "In transit", carrier: "J&T Express", placed: "2026-10-08", eta: "2026-10-16", items: "24-piece signature box + gift wrap" },
  "AC-1107": { status: "Processing", carrier: "Ninja Van", placed: "2026-10-13", eta: "2026-10-17", items: "48-piece celebration box" },
  "AC-1130": { status: "Delayed", carrier: "Pos Laju", placed: "2026-10-05", eta: "2026-10-18", items: "Corporate order, 30 x 12-piece boxes" },
  "AC-1188": { status: "Out for delivery", carrier: "J&T Express", placed: "2026-10-12", eta: "2026-10-15", items: "24-piece dark chocolate box" },
};

export async function execute(
  input: { order_id: string },
  _ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  const key = String(input.order_id || "").trim().toUpperCase();
  const order = DEMO_ORDERS[key];
  if (!order) {
    return { ok: false, error: "No demo order found for that id. Try AC-1001, AC-1042, AC-1107, AC-1130, or AC-1188." };
  }
  return { ok: true, order_id: key, ...order };
}
`,
  },
  {
    displayName: "Estimate Delivery",
    description: "Estimate Malaysian delivery window from a postcode (static demo zones).",
    sourceCode: `const ZONES: Record<string, { area: string; window: string; carrier: string }> = {
  "0": { area: "Perlis and Kedah (Alor Setar, Kangar)", window: "3-4 working days", carrier: "Pos Laju" },
  "1": { area: "Penang (George Town, Bayan Lepas)", window: "2-3 working days", carrier: "Pos Laju" },
  "2": { area: "Kelantan and Terengganu (Kota Bharu, Kuala Terengganu)", window: "3-4 working days", carrier: "Ninja Van" },
  "3": { area: "Perak (Ipoh, Taiping)", window: "2-3 working days", carrier: "J&T Express" },
  "4": { area: "Selangor (Shah Alam, Petaling Jaya, Klang)", window: "1-2 working days", carrier: "J&T Express" },
  "5": { area: "Kuala Lumpur and Putrajaya", window: "1-2 working days", carrier: "J&T Express" },
  "6": { area: "Pahang (Kuantan, Genting)", window: "2-3 working days", carrier: "Ninja Van" },
  "7": { area: "Johor (Johor Bahru, Batu Pahat)", window: "2-4 working days", carrier: "J&T Express" },
  "8": { area: "Sabah and Sarawak (Kota Kinabalu, Kuching)", window: "3-6 working days", carrier: "Ninja Van" },
  "9": { area: "East Malaysia (Labuan, Sibu, Miri)", window: "3-6 working days", carrier: "Ninja Van" },
};

export async function execute(
  input: { postcode: string },
  _ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  const postcode = String(input.postcode || "").trim();
  const match = postcode.match(/^(\\d{5})$/);
  if (!match) {
    return { ok: false, error: "Enter a 5-digit Malaysian postcode, for example 59100." };
  }
  const zone = ZONES[match[1].charAt(0)];
  if (!zone) {
    return { ok: false, error: \`No demo delivery zone for \${postcode}.\` };
  }
  return { ok: true, postcode, area: zone.area, window: zone.window, carrier: zone.carrier };
}
`,
  },
];

// ---------------------------------------------------------------------------
// Conversation scenarios (scripted multi-turn chats + knowledge references)
// ---------------------------------------------------------------------------

export type DemoKnowledgeRef = {
  kind: "context" | "template" | "handoff" | "skill";
  group: string;
  label: string;
};

export type DemoScenario = {
  key: string;
  userTurns: string[];
  aiReplies: { text: string; reasoning: string; sources: DemoKnowledgeRef[] }[];
  handoff?: { topicGroup: string; topic: string; reason: string };
  humanReplies?: string[];
  labels: string[];
};

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    key: "pricing",
    userTurns: [
      "Hi! How much is the 24-piece signature box?",
      "Does that include gift wrap?",
      "Can I pay with Touch 'n Go eWallet when I collect?",
    ],
    aiReplies: [
      {
        text: "The 24-piece signature box is RM128. Gift wrap is +RM12 per box if you would like it ribbon-tied.",
        reasoning: "Answered from the signature box pricing fact and the pricing template.",
        sources: [
          { kind: "context", group: "Pricing & Plans", label: "Signature Box Pricing" },
          { kind: "template", group: "Pricing Questions", label: "How much is the signature box?" },
        ],
      },
      {
        text: "Gift wrap is not included — it is +RM12 per box. Want me to add it?",
        reasoning: "Follow-up pricing answer using the same fact.",
        sources: [{ kind: "context", group: "Pricing & Plans", label: "Signature Box Pricing" }],
      },
      {
        text: "Yes — Touch 'n Go eWallet works in store, along with GrabPay and DuitNow QR.",
        reasoning: "Answered payment options from the e-wallet template and payment fact.",
        sources: [
          { kind: "template", group: "Payment & E-Wallets", label: "Can I pay with Touch 'n Go eWallet?" },
          { kind: "context", group: "Pricing & Plans", label: "Payment Methods" },
        ],
      },
    ],
    labels: ["Pricing question"],
  },
  {
    key: "delivery-penang",
    userTurns: [
      "Do you deliver to Penang?",
      "How long will it take to George Town?",
      "What if it arrives late?",
    ],
    aiReplies: [
      {
        text: "Yes — we deliver across Malaysia. Penang is West Malaysia, so standard delivery takes 2–3 working days with Pos Laju or J&T.",
        reasoning: "Used the delivery windows fact for a West Malaysia destination.",
        sources: [
          { kind: "context", group: "Shipping & Returns", label: "Delivery Windows" },
          { kind: "template", group: "Delivery & Returns", label: "How long does delivery take?" },
        ],
      },
      {
        text: "George Town is typically 2–3 working days. Orders over RM150 ship free within West Malaysia.",
        reasoning: "Combined delivery windows with the free-delivery threshold.",
        sources: [
          { kind: "context", group: "Shipping & Returns", label: "Delivery Windows" },
          { kind: "context", group: "Shipping & Returns", label: "Free Delivery Threshold" },
        ],
      },
      {
        text: "If a courier delay is confirmed, we refund the shipping upgrade and can reship from Bangsar the same day.",
        reasoning: "Explained the delay remedy from the returns policy.",
        sources: [{ kind: "context", group: "Shipping & Returns", label: "Returns & Refunds Policy" }],
      },
    ],
    labels: ["Follow-up"],
  },
  {
    key: "order-status",
    userTurns: [
      "Where is my order AC-1042?",
      "It arrived and the box is squashed...",
      "Can someone help me today?",
    ],
    aiReplies: [
      {
        text: "Order AC-1042 is in transit with J&T Express and due 16 October — 24-piece signature box with gift wrap.",
        reasoning: "Looked up order AC-1042 with the demo order tool.",
        sources: [{ kind: "context", group: "Shipping & Returns", label: "Delivery Windows" }],
      },
      {
        text: "Sorry to hear that — please send a photo of the parcel and we will arrange a replacement from Bangsar.",
        reasoning: "Damaged parcel path; handing off for replacement approval.",
        sources: [{ kind: "context", group: "Shipping & Returns", label: "Damaged Parcels" }],
      },
    ],
    handoff: {
      topicGroup: "Escalations",
      topic: "Damaged order",
      reason: "Damage reported; photo pending and replacement needs human approval.",
    },
    humanReplies: [
      "Hi, this is Priya from Acme — I have queued a replacement 24-piece box to ship from Bangsar tomorrow. No need to return the damaged one.",
    ],
    labels: ["Complaint", "Delivery issue"],
  },
  {
    key: "refund",
    userTurns: [
      "I want a refund for my last order.",
      "How long does the refund take after approval?",
    ],
    aiReplies: [
      {
        text: "I can help start that — unopened boxes are refundable within 14 days. Let me bring in a teammate to confirm the refund for your order.",
        reasoning: "Refund request matches the escalation topic; switching to a human.",
        sources: [
          { kind: "template", group: "Delivery & Returns", label: "What is your refund policy?" },
          { kind: "handoff", group: "Escalations", label: "Refund request" },
        ],
      },
    ],
    handoff: {
      topicGroup: "Escalations",
      topic: "Refund request",
      reason: "Customer requested a refund on a delivered order.",
    },
    humanReplies: [
      "Hello, Daniel here from Acme — refund approved, and it reaches most Malaysian banks within 3–5 working days.",
    ],
    labels: ["Refund"],
  },
  {
    key: "workshop-booking",
    userTurns: [
      "Can I book a workshop for Saturday?",
      "There will be four of us.",
      "One of us is vegan — is that okay?",
    ],
    aiReplies: [
      {
        text: "Workshops run Thursday to Sunday at the Bangsar outlet — Saturday works. It is RM50 per person, redeemable against a purchase over RM150. How many people?",
        reasoning: "Quoted the workshop booking template and availability entry.",
        sources: [
          { kind: "template", group: "Booking & Availability", label: "How do I book a workshop?" },
        ],
      },
      {
        text: "Lovely — a table for four on Saturday. Any dietary requirements? Vegan and nut-free flights need 48 hours notice.",
        reasoning: "Booking details from availability template.",
        sources: [
          { kind: "template", group: "Booking & Availability", label: "Can you cater dietary requirements?" },
        ],
      },
      {
        text: "Noted — one vegan flight, and we will keep nut-free moulds separate for the session.",
        reasoning: "Confirmed the vegan requirement from the dietary template.",
        sources: [
          { kind: "template", group: "Booking & Availability", label: "Can you cater dietary requirements?" },
        ],
      },
    ],
    labels: ["Follow-up"],
  },
  {
    key: "bulk-quote",
    userTurns: [
      "We would like 300 boxes for a client event in December. Can you quote?",
      "Can you also print our logo on the sleeves?",
    ],
    aiReplies: [
      {
        text: "That is a fantastic order size. For 200+ boxes a teammate prepares a custom quote — I am passing this to someone now.",
        reasoning: "Bulk quote above the corporate tier boundary; handing off.",
        sources: [
          { kind: "context", group: "Pricing & Plans", label: "Corporate Gifting Tiers" },
          { kind: "handoff", group: "Escalations", label: "Custom bulk quote" },
        ],
      },
    ],
    handoff: {
      topicGroup: "Escalations",
      topic: "Custom bulk quote",
      reason: "300-box corporate request needs a custom quote.",
    },
    humanReplies: [
      "Hello, Nurul from Acme here — I will send a formal quote for 300 boxes with logo sleeves by tomorrow morning.",
    ],
    labels: ["New lead", "Wholesale"],
  },
  {
    key: "hours-location",
    userTurns: [
      "Are you open on Sunday?",
      "Where exactly in Bangsar are you?",
      "And on Merdeka Day?",
    ],
    aiReplies: [
      {
        text: "Yes — Sunday hours are 11:00–20:00. The Lot 10 counter in Bukit Bintang is also open Friday to Sunday.",
        reasoning: "Answered opening hours and locations from workspace context.",
        sources: [
          { kind: "context", group: "Opening Hours & Location", label: "Operating Hours" },
          { kind: "context", group: "Opening Hours & Location", label: "Store Locations" },
        ],
      },
      {
        text: "We are at 18 Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur — two doors from the Telawi night market stretch.",
        reasoning: "Shared the store location fact.",
        sources: [{ kind: "context", group: "Opening Hours & Location", label: "Store Locations" }],
      },
      {
        text: "On Merdeka Day we run reduced hours, 12:00–18:00. We are fully closed on Hari Raya day 1–2 and Chinese New Year day 1–2.",
        reasoning: "Used the public holidays fact for the follow-up.",
        sources: [{ kind: "context", group: "Opening Hours & Location", label: "Public Holidays & Closures" }],
      },
    ],
    labels: [],
  },
  {
    key: "late-complaint",
    userTurns: [
      "My delivery was promised Tuesday and it is still not here!",
      "This is the second time this month.",
    ],
    aiReplies: [
      {
        text: "I am sorry about that — let me check the order and get a teammate on it right away.",
        reasoning: "Repeat complaint matches angry-customer escalation.",
        sources: [
          { kind: "template", group: "Delivery & Returns", label: "How long does delivery take?" },
          { kind: "handoff", group: "Escalations", label: "Angry customer" },
        ],
      },
    ],
    handoff: {
      topicGroup: "Escalations",
      topic: "Angry customer",
      reason: "Second late delivery this month; customer is upset.",
    },
    humanReplies: [
      "Hi, Sam from Acme — I have escalated with J&T, refunded the express upgrade, and your replacement goes out first thing tomorrow.",
    ],
    labels: ["Complaint", "Delivery issue"],
  },
  {
    key: "vip-repeat",
    userTurns: [
      "It is our anniversary again — same order as last year please!",
      "Add the seasonal praline upgrade too.",
    ],
    aiReplies: [
      {
        text: "Happy anniversary! Last year you ordered the 24-piece mix with gift wrap — shall I repeat that, or try the seasonal praline upgrade this time?",
        reasoning: "Used the purchase history review playbook for a repeat-customer offer.",
        sources: [
          { kind: "skill", group: "Skills", label: "Purchase History Review" },
          { kind: "skill", group: "Skills", label: "Upsell Cross Sell" },
        ],
      },
      {
        text: "Done — 24-piece mix with gift wrap and the praline upgrade added. Delivery stays within Klang Valley in 1–2 working days.",
        reasoning: "Confirmed the upsell and restated the delivery window.",
        sources: [
          { kind: "skill", group: "Skills", label: "Upsell Cross Sell" },
          { kind: "context", group: "Shipping & Returns", label: "Delivery Windows" },
        ],
      },
    ],
    labels: ["VIP"],
  },
  {
    key: "allergens-halal",
    userTurns: [
      "Does the dark chocolate contain nuts?",
      "Is it halal certified?",
    ],
    aiReplies: [
      {
        text: "The dark chocolate itself has no nuts, but all boxes are made in a kitchen that also handles nuts, so we label traces of nuts, milk, and gluten.",
        reasoning: "Answered from the sourcing and allergens fact.",
        sources: [{ kind: "context", group: "Company Overview", label: "Sourcing & Allergens" }],
      },
      {
        text: "The kitchen is not JAKIM-halal certified, but there is no pork, lard, or alcohol in any recipe. I can loop in a teammate for written ingredient confirmation.",
        reasoning: "Gave the honest certification position from context.",
        sources: [{ kind: "context", group: "Company Overview", label: "Halal & Certification Notes" }],
      },
    ],
    labels: [],
  },
  {
    key: "double-charge",
    userTurns: [
      "I have been charged twice for order AC-1107!",
      "It was on my card via FPX.",
      "Can someone look into it today?",
    ],
    aiReplies: [
      {
        text: "I can see how alarming that is — I am bringing in a teammate who can verify the charges and refund any duplicate right away.",
        reasoning: "Billing dispute matched the double-charge handoff topic.",
        sources: [{ kind: "handoff", group: "Billing Issues", label: "Double charge" }],
      },
    ],
    handoff: {
      topicGroup: "Billing Issues",
      topic: "Double charge",
      reason: "Duplicate charge reported for order AC-1107.",
    },
    labels: ["Complaint", "Refund"],
  },
  {
    key: "availability",
    userTurns: [
      "Is the white chocolate praline box still in stock for Friday?",
      "Can I collect from Lot 10 instead of Bangsar?",
    ],
    aiReplies: [
      {
        text: "Yes — white praline boxes are in stock in 12 and 24-piece sizes, and Friday collection is fine. The 48-piece is sold out until Thursday's batch.",
        reasoning: "Ran the check availability playbook before quoting.",
        sources: [{ kind: "skill", group: "Skills", label: "Check Availability" }],
      },
      {
        text: "Collection works at either outlet — tell the counter your order name and they will pull it from the chiller.",
        reasoning: "Confirmed pickup at the Bukit Bintang counter.",
        sources: [{ kind: "context", group: "Opening Hours & Location", label: "Store Locations" }],
      },
    ],
    labels: ["Pricing question"],
  },
  {
    key: "ewallet-help",
    userTurns: [
      "Can I pay with Touch 'n Go eWallet when I collect?",
      "And can I split the payment with my wife's card?",
    ],
    aiReplies: [
      {
        text: "Yes — Touch 'n Go eWallet, GrabPay, and DuitNow QR all work in store.",
        reasoning: "Answered from the e-wallet template.",
        sources: [
          { kind: "template", group: "Payment & E-Wallets", label: "Can I pay with Touch 'n Go eWallet?" },
        ],
      },
      {
        text: "We can split across up to two cards at the counter — just tell the staff before tapping.",
        reasoning: "Split-payment answer from the templates.",
        sources: [
          { kind: "template", group: "Payment & E-Wallets", label: "Can I split payment between two cards?" },
        ],
      },
    ],
    labels: [],
  },
  {
    key: "postcode-eta",
    userTurns: [
      "I'm in 40150 Shah Alam — how fast can you deliver?",
      "And to Kota Kinabalu, 88000?",
    ],
    aiReplies: [
      {
        text: "40150 is Selangor — 1–2 working days with J&T Express, and free over RM150.",
        reasoning: "Estimated the delivery window from the postcode zone.",
        sources: [
          { kind: "context", group: "Shipping & Returns", label: "Delivery Windows" },
          { kind: "context", group: "Shipping & Returns", label: "Free Delivery Threshold" },
        ],
      },
      {
        text: "88000 is Sabah — 3–6 working days with Ninja Van. East Malaysia shipping is quoted at checkout.",
        reasoning: "Answered the East Malaysia ETA from the delivery windows fact.",
        sources: [{ kind: "context", group: "Shipping & Returns", label: "Delivery Windows" }],
      },
    ],
    labels: ["Follow-up"],
  },
  {
    key: "invoice-sst",
    userTurns: [
      "Can you issue a tax invoice with SST for our company order?",
      "We are in Cyberjaya and need it before month end.",
    ],
    aiReplies: [
      {
        text: "For company invoices and SST details a teammate takes over so the tax invoice is issued correctly — I am handing this over now.",
        reasoning: "Invoice dispute topic matched; handing off to billing.",
        sources: [
          { kind: "context", group: "Pricing & Plans", label: "Payment Methods" },
          { kind: "handoff", group: "Billing Issues", label: "Invoice dispute" },
        ],
      },
    ],
    handoff: {
      topicGroup: "Billing Issues",
      topic: "Invoice dispute",
      reason: "Corporate customer needs an SST tax invoice before month end.",
    },
    humanReplies: [
      "Hi, Mei Ling from Acme accounts — I will email the SST tax invoice to your finance team today.",
    ],
    labels: ["Wholesale"],
  },
  {
    key: "wholesale-terms",
    userTurns: [
      "We run a cafe in George Town and want to stock your boxes.",
      "What is the minimum order and terms?",
      "Do you do logo sleeves for us?",
    ],
    aiReplies: [
      {
        text: "Lovely to hear — wholesale MOQ is 50 boxes, and approved accounts get 30-day payment terms with an account manager.",
        reasoning: "Quoted wholesale terms from the corporate context group.",
        sources: [{ kind: "context", group: "Corporate & Wholesale", label: "Wholesale Terms" }],
      },
      {
        text: "Logo sleeves are available from 100 boxes, and we need artwork 5 working days before production.",
        reasoning: "Answered branding options from context.",
        sources: [{ kind: "context", group: "Corporate & Wholesale", label: "Custom Branding" }],
      },
      {
        text: "Bulk deliveries run Monday to Friday, 9:00–17:00, with 3 working days notice — Penang usually lands in 2–3 working days.",
        reasoning: "Explained delivery scheduling and the outstation window.",
        sources: [
          { kind: "context", group: "Corporate & Wholesale", label: "Bulk Delivery Scheduling" },
          { kind: "context", group: "Shipping & Returns", label: "Delivery Windows" },
        ],
      },
    ],
    labels: ["New lead", "Wholesale"],
  },
];

// ---------------------------------------------------------------------------
// Evals (cases + run history, seeded across agents)
// ---------------------------------------------------------------------------

export type DemoEvalRunSpec = {
  status: "passed" | "failed" | "error";
  actualReply: string;
  analysis: string | null;
  reasoning?: string;
  handoffCalled?: boolean;
  errorMessage?: string;
};

export type DemoEvalTurnSpec = {
  role: "user" | "assistant";
  content: string;
  whyReply?: string;
  sources?: { kind: "context" | "template" | "skill" | "handoff"; label: string }[];
};

export type DemoEvalSpec = {
  agent: DemoAgentKey;
  title: string;
  source: "manual" | "conversation" | "template" | "context" | "handoff";
  status?: "draft" | "ready";
  /** Links the case to a seeded conversation of the same scenario key. */
  scenarioKey?: string;
  turns: DemoEvalTurnSpec[];
  expectedReply: string;
  expectedAction?: "reply" | "handoff";
  expectedTopic?: { group: string; topic: string };
  runs: DemoEvalRunSpec[];
  schedule?: {
    repeat: "daily" | "weekly" | "monthly";
    weekdays: number[];
    monthDay: number | null;
    hour: number;
    minute: number;
  };
};

export const DEMO_EVALS: readonly DemoEvalSpec[] = [
  {
    agent: "sales",
    title: "Opening hours on a Sunday",
    source: "manual",
    turns: [
      { role: "user", content: "Are you open on Sunday?" },
      {
        role: "assistant",
        content: "Yes — Sunday hours are 11:00–20:00 at the Bangsar outlet.",
        whyReply: "Answered from the operating hours fact.",
        sources: [{ kind: "context", label: "Operating Hours" }],
      },
      { role: "user", content: "And the Lot 10 counter on Sunday?" },
    ],
    expectedReply: "The Lot 10 counter is open Friday to Sunday.",
    runs: [
      {
        status: "passed",
        actualReply: "Yes — Sunday hours are 11:00–20:00.",
        analysis: "Reply matches the operating hours fact.",
      },
      {
        status: "passed",
        actualReply: "Sunday hours are 11:00–20:00 — the Lot 10 counter is open too.",
        analysis: "Correct hours and an accurate extra detail.",
      },
      {
        status: "failed",
        actualReply: "We are closed on Sundays.",
        analysis: "Contradicts the operating hours fact; Sunday is 11:00–20:00.",
      },
    ],
    schedule: { repeat: "daily", weekdays: [], monthDay: null, hour: 9, minute: 0 },
  },
  {
    agent: "sales",
    title: "24-piece price captured from the inbox",
    source: "conversation",
    scenarioKey: "pricing",
    turns: [
      { role: "user", content: "Hi! How much is the 24-piece signature box?" },
      {
        role: "assistant",
        content: "The 24-piece signature box is RM128. Gift wrap is +RM12 per box.",
        whyReply: "Quoted the signature box pricing fact.",
        sources: [{ kind: "context", label: "Signature Box Pricing" }],
      },
    ],
    expectedReply: "The 24-piece signature box is RM128.",
    runs: [
      {
        status: "failed",
        actualReply: "The 24-piece box is RM118.",
        analysis: "Wrong price — the fact says RM128.",
        reasoning: "Answered from pricing context but misread the tier.",
      },
    ],
  },
  {
    agent: "sales",
    title: "Refund policy answer",
    source: "template",
    turns: [{ role: "user", content: "What is your refund policy?" }],
    expectedReply:
      "Unopened boxes can be returned within 14 days for a full refund. Damaged chocolate is refunded or replaced on photo evidence.",
    runs: [
      {
        status: "passed",
        actualReply:
          "Unopened boxes can be returned within 14 days for a full refund. Damaged chocolate is replaced with a photo.",
        analysis: "Matches the refund policy template.",
        reasoning: "Used the refund policy response template.",
      },
    ],
  },
  {
    agent: "sales",
    title: "Refund request hands off with the right topic",
    source: "handoff",
    turns: [{ role: "user", content: "I want a refund for my last order." }],
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopic: { group: "Escalations", topic: "Refund request" },
    runs: [
      {
        status: "passed",
        actualReply: "",
        analysis: "Handoff called with the Refund request topic.",
        handoffCalled: true,
      },
      {
        status: "error",
        actualReply: "",
        analysis: null,
        errorMessage: "Subject agent run threw before producing output (demo).",
      },
    ],
  },
  {
    agent: "sales",
    title: "Halal certification question",
    source: "context",
    turns: [{ role: "user", content: "Is your chocolate halal certified?" }],
    expectedReply:
      "The kitchen is not JAKIM-halal certified, but there is no pork, lard, or alcohol in any recipe.",
    runs: [
      {
        status: "passed",
        actualReply:
          "We are not JAKIM-halal certified, though everything is pork-free and alcohol-free.",
        analysis: "Honest certification position matching the context fact.",
        reasoning: "Answered from the halal and certification notes.",
      },
    ],
  },
  {
    agent: "sales",
    title: "Delivery ETA for a Shah Alam postcode",
    source: "manual",
    turns: [{ role: "user", content: "I'm in 40150 Shah Alam — how fast can you deliver?" }],
    expectedReply: "40150 is Selangor — 1–2 working days with J&T Express.",
    runs: [
      {
        status: "passed",
        actualReply: "Selangor takes 1–2 working days with J&T Express.",
        analysis: "Correct zone and carrier.",
        reasoning: "Estimated delivery from the postcode zone.",
      },
      {
        status: "failed",
        actualReply: "Sabah usually takes 1–2 working days.",
        analysis: "Wrong region — 40150 is Selangor, not Sabah.",
      },
    ],
  },
  {
    agent: "sales",
    title: "Late delivery complaint escalates",
    source: "handoff",
    turns: [{ role: "user", content: "My delivery is late again and nobody has called me back!" }],
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopic: { group: "Escalations", topic: "Angry customer" },
    runs: [
      {
        status: "passed",
        actualReply: "",
        analysis: "Handoff called with the Angry customer topic.",
        handoffCalled: true,
      },
    ],
  },
  {
    agent: "support",
    title: "Order status for AC-1042",
    source: "manual",
    turns: [
      { role: "user", content: "Where is my order AC-1042?" },
      {
        role: "assistant",
        content: "It is in transit with J&T Express and due 16 October.",
        whyReply: "Looked up the order with the demo order tool.",
        sources: [{ kind: "context", label: "Delivery Windows" }],
      },
      { role: "user", content: "Can it get here any faster?" },
    ],
    expectedReply:
      "Express upgrades are not available mid-transit, but deliveries usually arrive within the quoted window.",
    runs: [
      {
        status: "passed",
        actualReply: "AC-1042 is in transit with J&T — due 16 October.",
        analysis: "Used the demo order lookup with the right order.",
        reasoning: "Called look_up_demo_order for AC-1042.",
      },
      {
        status: "passed",
        actualReply: "It shipped with J&T Express and should reach you by 16 October.",
        analysis: "Correct carrier and ETA.",
      },
    ],
  },
  {
    agent: "support",
    title: "Damaged parcel wording",
    source: "template",
    turns: [{ role: "user", content: "My box arrived melted and squashed." }],
    expectedReply:
      "Please send a photo of the parcel and we will arrange a replacement from Bangsar.",
    runs: [
      {
        status: "failed",
        actualReply: "Please ship the box back to us within 14 days.",
        analysis: "Wrong remedy — damaged orders get a replacement, not a return.",
      },
    ],
  },
  {
    agent: "support",
    title: "Double charge handoff",
    source: "handoff",
    turns: [{ role: "user", content: "I was charged twice for order AC-1107 on FPX." }],
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopic: { group: "Billing Issues", topic: "Double charge" },
    runs: [
      {
        status: "passed",
        actualReply: "",
        analysis: "Handoff called with the Double charge topic.",
        handoffCalled: true,
      },
    ],
  },
  {
    agent: "wholesale",
    title: "300-box corporate quote",
    source: "handoff",
    turns: [{ role: "user", content: "We would like 300 boxes for a December client event." }],
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopic: { group: "Escalations", topic: "Custom bulk quote" },
    runs: [
      {
        status: "passed",
        actualReply: "",
        analysis: "Handoff called with the Custom bulk quote topic.",
        handoffCalled: true,
      },
      {
        status: "failed",
        actualReply: "Enjoy 18% off, the order is confirmed.",
        analysis: "Should have handed off; 200+ boxes need a human quote.",
        handoffCalled: false,
      },
    ],
    schedule: { repeat: "weekly", weekdays: [1], monthDay: null, hour: 10, minute: 0 },
  },
  {
    agent: "wholesale",
    title: "SST invoice question",
    source: "handoff",
    turns: [{ role: "user", content: "Can you issue an SST tax invoice for our company order?" }],
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopic: { group: "Billing Issues", topic: "Invoice dispute" },
    runs: [
      {
        status: "passed",
        actualReply: "",
        analysis: "Handoff called with the Invoice dispute topic.",
        handoffCalled: true,
      },
    ],
  },
  {
    agent: "wholesale",
    title: "Custom branding sleeves (draft)",
    source: "context",
    status: "draft",
    turns: [{ role: "user", content: "Can you print our cafe logo on the sleeves?" }],
    expectedReply: "",
    runs: [],
  },
];

// ---------------------------------------------------------------------------
// CRM seed pools
// ---------------------------------------------------------------------------

export const DEMO_FIRST_NAMES: readonly string[] = [
  "Olivia", "Noah", "Amelia", "George", "Isla", "Leo", "Freya", "Arthur", "Grace", "Oscar",
  "Priya", "Daniel", "Sofia", "Marcus", "Hannah", "Tom", "Zara", "Kofi", "Elena", "Jamal",
  "Nina", "Ravi", "Clara", "Felix", "Nurul", "Aisyah", "Siti", "Farah", "Hafiz", "Amir",
  "Wei Ming", "Mei Ling", "Jia Hui", "Kavitha", "Arjun", "Zulaikha",
];

export const DEMO_LAST_NAMES: readonly string[] = [
  "Bennett", "Okafor", "Nakamura", "Silva", "Kowalski", "Patel", "Novak", "Fischer",
  "Moreau", "Rossi", "Johansson", "Ahmed", "Costa", "Weber", "Kelly", "Dubois",
  "Sato", "Ivanov", "Larsen", "Mbeki", "Hughes", "Romano", "Nguyen", "Schmidt",
  "Tan", "Lim", "Wong", "Lee", "Ng", "Ibrahim", "Rahman", "Abdullah", "Hassan", "Ismail",
  "Chua", "Loh", "Yeoh", "Raj", "Pillai", "Devi",
];

export const DEMO_CONTACT_NOTES: readonly string[] = [
  "Prefers dark chocolate; nut allergy (severe) — always double-check.",
  "Corporate buyer in Cyberjaya — orders staff gifts every quarter.",
  "Repeat customer since 2019; always adds gift wrap.",
  "Wants delivery to Kota Kinabalu; ask about Ninja Van ETA first.",
  "Wholesale enquiry from a cafe in George Town, Penang.",
  "Wedding door gifts for a March wedding — 120 boxes.",
  "Asks about halal certification before every order.",
  "Prefers WhatsApp over email; responds after 8pm.",
  "Collects from the Lot 10 counter on weekends.",
  "Requests SST tax invoices for every corporate order.",
  "Sends orders to multiple office branches — split shipments.",
  "Quiet-hour regular at the Bangsar outlet on Mondays.",
];
