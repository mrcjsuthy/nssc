/* =========================================================
   NSSC // Data: questions, rules, handshake, config.
   ========================================================= */

window.NSSC = window.NSSC || {};

/**
 * CONFIG — edit these to customise.
 *
 * notifyEndpoint:
 *   - Optional. Paste your Formspree / Web3Forms / Make.com / Zapier webhook URL here
 *     to receive a JSON POST when a member claims their tee.
 *   - If empty, the form falls back to a `mailto:` to `notifyEmail` so you still get
 *     the order without any backend setup.
 *
 * notifyEmail:
 *   - The address the mailto fallback will draft to.
 */
window.NSSC.config = {
  // ---- Supabase (see supabase/SETUP.md) ----
  // Leave both empty to run in legacy local-only mode (no auth/dashboard).
  supabaseUrl: "https://bsqzskkbhemrviaqraio.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzcXpza2tiaGVtcnZpYXFyYWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDgzNzksImV4cCI6MjA5NjEyNDM3OX0.MxYFvPeuac98LKphVbhu-T9R6acyROHrLeU2VydiCVg",

  // ---- Tee order notifications ----
  notifyEndpoint: "",
  notifyEmail: "orders@northshore.club",

  // ---- Flow ----
  totalQuestions: 10,
  blockKey: "nssc_blocked_v1",
  memberKey: "nssc_member_v1",
  rememberKey: "nssc_remember_v1",
};

/**
 * The Trial. Ten questions. No answer is wrong \u2014 each one reveals a worldview.
 * Every (question, answer) tuple awards points to one or more archetypes.
 *
 * A hidden sixth archetype \u2014 the Wizard \u2014 is unlocked only by the exact
 * sequence A B B A C A B A B A.
 */
window.NSSC.questions = [
  {
    q: "You arrive at an ancient library that contains all human knowledge. A fire has started and only one section can be saved.",
    a: [
      { letter: "A", text: "The section explaining why things happen." },
      { letter: "B", text: "The section teaching future generations." },
      { letter: "C", text: "The section preserving history." },
    ],
  },
  {
    q: "A stranger asks for your help crossing a dangerous desert.",
    a: [
      { letter: "A", text: "Give them supplies." },
      { letter: "B", text: "Teach them how to navigate." },
      { letter: "C", text: "Escort them yourself." },
    ],
  },
  {
    q: "You discover a machine that predicts the future with perfect accuracy.",
    a: [
      { letter: "A", text: "Use it to improve your life." },
      { letter: "B", text: "Study how it works." },
      { letter: "C", text: "Share it with humanity." },
    ],
  },
  {
    q: "You are offered leadership of a prosperous city.",
    a: [
      { letter: "A", text: "Understand the city before changing anything." },
      { letter: "B", text: "Implement your vision immediately." },
      { letter: "C", text: "Ask the citizens what they need." },
    ],
  },
  {
    q: "A student asks you the meaning of life.",
    a: [
      { letter: "A", text: "Give them your answer." },
      { letter: "B", text: "Explain there are many answers." },
      { letter: "C", text: "Help them discover their own." },
    ],
  },
  {
    q: "You find a locked door that nobody has opened for a thousand years.",
    a: [
      { letter: "A", text: "Try to understand why it was locked." },
      { letter: "B", text: "Open it." },
      { letter: "C", text: "Guard it." },
    ],
  },
  {
    q: "The greatest minds in history are debating a question.",
    a: [
      { letter: "A", text: "Challenge their assumptions." },
      { letter: "B", text: "Listen first." },
      { letter: "C", text: "Search for a new question entirely." },
    ],
  },
  {
    q: "You discover a map showing lands nobody has ever explored.",
    a: [
      { letter: "A", text: "Study the map carefully." },
      { letter: "B", text: "Sell it." },
      { letter: "C", text: "Begin the journey." },
    ],
  },
  {
    q: "Which is more important?",
    a: [
      { letter: "A", text: "Knowledge." },
      { letter: "B", text: "Understanding." },
      { letter: "C", text: "Experience." },
    ],
  },
  {
    q: "At the end of the trial, a voice asks: \u201CWhat is the purpose of wisdom?\u201D",
    a: [
      { letter: "A", text: "To seek truth." },
      { letter: "B", text: "To help others." },
      { letter: "C", text: "To live well." },
    ],
  },
];

/**
 * Scoring matrix. For each question, each answer letter awards points to
 * one or more archetypes. Tuned so each non-Wizard archetype is reachable.
 */
window.NSSC._archetypeScoring = [
  // Q1: ancient library
  { A: { scholar: 1 },                B: { builder: 2 },               C: { guardian: 2 } },
  // Q2: stranger crossing desert
  { A: { builder: 2 },                B: { scholar: 2 },                C: { guardian: 2 } },
  // Q3: future-predicting machine
  { A: { sovereign: 2 },              B: { scholar: 2 },                C: { sovereign: 1, guardian: 1 } },
  // Q4: leadership of city
  { A: { scholar: 1, sovereign: 1 },  B: { builder: 2 },                C: { sovereign: 1, guardian: 1 } },
  // Q5: meaning of life
  { A: { sovereign: 2 },              B: { scholar: 1 },                C: { guardian: 2 } },
  // Q6: locked 1000-year door
  { A: { scholar: 2 },                B: { explorer: 2 },               C: { guardian: 2 } },
  // Q7: minds debating
  { A: { sovereign: 1, builder: 1 },  B: { scholar: 1 },                C: { explorer: 2 } },
  // Q8: map of unexplored lands
  { A: { scholar: 2 },                B: { builder: 1, sovereign: 1 },  C: { explorer: 2 } },
  // Q9: knowledge vs understanding vs experience
  { A: { scholar: 2 },                B: { sovereign: 2 },              C: { explorer: 2 } },
  // Q10: purpose of wisdom
  { A: { scholar: 1 },                B: { guardian: 2 },               C: { builder: 1, explorer: 1 } },
];

/**
 * The six archetypes. The Wizard (id: "wizard") is the hidden one \u2014 only
 * revealed if the answer sequence is exactly A B B A C A B A B A.
 */
window.NSSC.archetypes = [
  {
    id: "builder",
    name: "The Builder",
    image: "assets/img/archetypes/builder.png",
    tagline: "You create order from chaos.",
    description:
      "You move from possibility to artifact. Where others see ruins, you see foundations. The Order needs Builders to give its ideas weight in the world.",
    values: ["Action", "Progress", "Practicality", "Creation"],
  },
  {
    id: "scholar",
    name: "The Scholar",
    image: "assets/img/archetypes/scholar.png",
    tagline: "You seek understanding above all else.",
    description:
      "You distrust answers that come too easily. You want to know why before you act, and you would rather be quietly right than loudly first. The Order needs Scholars to remember what others forget.",
    values: ["Learning", "Curiosity", "Knowledge", "Reflection"],
  },
  {
    id: "guardian",
    name: "The Guardian",
    image: "assets/img/archetypes/guardian.png",
    tagline: "You protect people, traditions, and institutions.",
    description:
      "You feel responsibility in your bones. You'd rather be the one who held the line than the one who got the credit. The Order needs Guardians to keep its house standing through storms.",
    values: ["Duty", "Stability", "Responsibility", "Stewardship"],
  },
  {
    id: "explorer",
    name: "The Explorer",
    image: "assets/img/archetypes/explorer.png",
    tagline: "You are driven by discovery.",
    description:
      "You can't stand a closed door. The point isn't always the destination; sometimes it's the looking. The Order needs Explorers to bring back what nobody else even knew to ask about.",
    values: ["Adventure", "Risk", "Possibility", "Growth"],
  },
  {
    id: "sovereign",
    name: "The Sovereign",
    image: "assets/img/archetypes/sovereign.png",
    tagline: "You guide others through uncertainty.",
    description:
      "You think in systems and in people simultaneously. You read the room and then move it. The Order needs Sovereigns to keep its loose threads bound to a shared horizon.",
    values: ["Vision", "Coordination", "Legacy", "Responsibility"],
  },
  {
    id: "wizard",
    name: "The Wizard",
    image: "assets/img/archetypes/wizard.png",
    secret: true,
    tagline: "You walk the path of understanding.",
    description:
      "Where others seek answers, you seek the questions beneath them. Knowledge is accumulated. Wisdom is uncovered. Almost no one finds this door. You did.",
    values: [
      "Understanding over possession",
      "Questions over answers",
      "Humility over certainty",
      "First principles over reaction",
      "Teaching over authority",
    ],
  },
];

window.NSSC.archetypeById = function (id) {
  return window.NSSC.archetypes.find(function (a) { return a.id === id; }) || null;
};

/**
 * Score a sequence of answers (array of "A" / "B" / "C") into one archetype.
 *   1. The exact sequence A B B A C A B A B A unlocks the Wizard.
 *   2. Otherwise the highest-scoring archetype from the matrix wins.
 *   3. A balance bonus rewards the Sovereign for evenly spread answers.
 *   4. Tie-break order: explorer \u2192 guardian \u2192 builder \u2192 sovereign \u2192 scholar.
 */
window.NSSC.scoreArchetype = function (answers) {
  const seq = (answers || []).join("");
  if (seq === "ABBACABABA") return "wizard";

  const totals = { builder: 0, scholar: 0, guardian: 0, explorer: 0, sovereign: 0 };
  const counts = { A: 0, B: 0, C: 0 };
  (answers || []).forEach(function (ans, i) {
    if (counts[ans] !== undefined) counts[ans] += 1;
    const row = window.NSSC._archetypeScoring[i] || {};
    const pts = row[ans] || {};
    for (const k in pts) {
      if (totals[k] !== undefined) totals[k] += pts[k];
    }
  });

  const minCount = Math.min(counts.A, counts.B, counts.C);
  totals.sovereign += minCount;

  const order = ["explorer", "guardian", "builder", "sovereign", "scholar"];
  let best = "scholar";
  let bestScore = -1;
  order.forEach(function (id) {
    if (totals[id] > bestScore) {
      bestScore = totals[id];
      best = id;
    }
  });
  return best;
};

/**
 * The Five Tenets. Read aloud at induction.
 */
window.NSSC.rules = [
  {
    title: "Don't be a cunt.",
    body: "This is the foundation. It applies in all weather, to all people, in all timezones. There is no exemption.",
  },
  {
    title: "Look after your own — and the next person, too.",
    body: "The Shore is small. So is your reputation. Hold the door, shout the round, check on your mate.",
  },
  {
    title: "What's said inside the Club, stays inside the Club.",
    body: "Discretion is mandatory. Members' business is members' business. Loose lips lose privileges.",
  },
  {
    title: "Membership is permanent.",
    body: "There is no leaving. There is no resignation. There is no expulsion. Once initiated, always a member — across oceans, decades, and disagreements.",
  },
  {
    title: "Recognise your own.",
    body: "When you meet another member in the wild, exchange the handshake. Treat them as kin. Then keep walking.",
  },
];

/**
 * The Handshake. Memorise. Do not write it down outside this portal.
 *
 * Two bumps, left hand only. Tall taps first.
 */
window.NSSC.handshake = [
  "Both members make a closed fist \u2014 left hand only.",
  "Determine who is taller. (If even, the elder goes first.)",
  "The taller member taps once, downward, on top of the other's closed fist.",
  "Both fists then meet for a single horizontal bump.",
  "Walk on. No words required.",
];

/**
 * Waiver clauses — designed to feel serious without being legally binding (it isn't).
 */
window.NSSC.waiver = [
  "I am at least 21 years of age.",
  "I live on the North Shore, Auckland.",
  "I accept membership is eternal.",
  "I will protect the order.",
  "I enter of my own free will.",
];

/**
 * Available T-shirt sizes.
 */
window.NSSC.sizes = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Portal changelog — newest first. Add an entry whenever you ship features.
 */
window.NSSC.changelog = {
  current: "0.0.I",
  entries: [
    {
      version: "0.0.I",
      date: "2026-06-04",
      items: [
        "Changelog with in-portal feature requests (founder inbox)",
        "Meetup modals: join, leave, attendee list, founder glyph rewards",
        "Profile glyph collection and directory glyph strips",
        "Members tier filter, Transmit share card, and The Reliquary tallies shop",
        "Shore Picks: member recommendations for food, activities, and date nights",
        "Reliquary redemptions, public tallies on directory, 100 signup bonus, +10 daily tribute",
        "Founder redemption inbox when members purchase from The Reliquary",
        "The Pit casino tab with blackjack, poker, dice, slots, and ~5% house edge",
        "Remember-me quick login (Enter \u00b7 number)",
        "Persistent sessions with token refresh on return",
        "Live HUD member count (total / online)",
        "Simplified waiver, login, and landing copy",
        "New neon lettermark logo across site and favicon",
        "Archetype trial with reveal screen and dashboard badges",
        "Hidden Wizard archetype easter egg",
        "Member dashboard: chat, meetups, directory",
        "Mobile tab layout for dashboard panes",
        "Member ranks (Tier 1\u2013Founder) with founder rank editing",
        "Tee claim flow with Later option and dashboard reminder",
        "Login by member number (0001) via Supabase lookup",
      ],
    },
  ],
};

/**
 * Member ranks. Order matters \u2014 it mirrors the Postgres enum and
 * determines the privilege hierarchy (later entries inherit earlier ones).
 *
 *   tier_1  : observe; one chat message per 24h.
 *   tier_2  : free chat.
 *   tier_3  : free chat; can host meetups.
 *   admin   : free chat; can host meetups; can manage tee orders.
 *   founder : god tier; can edit member ranks.
 */
window.NSSC.ranks = [
  { id: "tier_1",  label: "Tier 1",  short: "T1",     desc: "Observer. One chat message per day." },
  { id: "tier_2",  label: "Tier 2",  short: "T2",     desc: "Free chat." },
  { id: "tier_3",  label: "Tier 3",  short: "T3",     desc: "Free chat. Can host meetups." },
  { id: "admin",   label: "Admin",   short: "ADMIN",  desc: "Manages tee orders. Plus all Tier 3 rights." },
  { id: "founder", label: "Founder", short: "FOUNDER",desc: "God tier. Edits ranks. Plus everything." },
];

window.NSSC.rankIndex = function (rank) {
  return window.NSSC.ranks.findIndex(function (r) { return r.id === rank; });
};
window.NSSC.rankAtLeast = function (rank, target) {
  return window.NSSC.rankIndex(rank) >= window.NSSC.rankIndex(target);
};
window.NSSC.rankLabel = function (rank) {
  const r = window.NSSC.ranks.find(function (x) { return x.id === rank; });
  return r ? r.label : rank;
};
window.NSSC.rankShort = function (rank) {
  const r = window.NSSC.ranks.find(function (x) { return x.id === rank; });
  return r ? r.short : rank;
};

/**
 * Pool of glyphs / numerology used for ambient effects + answer markers.
 */
window.NSSC.glyphs = [
  "\u{13080}", "\u{13171}", "\u{131CB}", "\u{13153}", "\u{13191}",
  "\u{1308C}", "\u{1304B}", "\u{13283}", "\u{132F4}", "\u{1337F}",
  "\u{13399}", "\u{133CF}", "\u26B7", "\u2625", "\u2627",
];

/** Reward glyphs earned from meetups (shown on member profiles). */
window.NSSC.rewardGlyphs = [
  {
    id: "shore_presence",
    char: "\u{13080}",
    name: "Shore Presence",
    desc: "Joined a meetup on the North Shore",
  },
  {
    id: "gathering_seal",
    char: "\u{13153}",
    name: "Gathering Seal",
    desc: "Marked present after a meetup concluded",
  },
];

window.NSSC.defaultEventRewardGlyph = function () {
  return window.NSSC.rewardGlyphs[0];
};

/**
 * The Reliquary — tallies redeemed for real-world goods (fulfilled by the Order).
 */
window.NSSC.reliquary = {
  title: "The Reliquary",
  eyebrow: "VAULT \u00b7 OBSCURA",
  currency: "Tallies",
  currencySymbol: "\u25C8",
  tagline: "Earn tallies. Redeem for real goods. Fulfillment routed through the Order.",
  tributeReward: 10,
  signupBonus: 100,
  items: [
    {
      id: "enamel_pin",
      name: "Enamel Pin",
      cost: 2000,
      desc: "NSSC enamel pin. Redeemable IRL.",
    },
    {
      id: "hat",
      name: "Hat",
      cost: 5000,
      desc: "Club hat. Redeemable IRL.",
    },
    {
      id: "hyoketsu_apple",
      name: "Box of Hyoketsu Apple",
      cost: 10000,
      desc: "A box of Hyoketsu apple. Redeemable IRL.",
    },
    {
      id: "bbq",
      name: "BBQ",
      cost: 15000,
      desc: "A BBQ for the Shore. Redeemable IRL.",
    },
    {
      id: "pokemon_cards",
      name: "Pack of Pokemon Cards",
      cost: 20000,
      desc: "One pack of Pokemon cards. Redeemable IRL.",
    },
    {
      id: "prezzy_card",
      name: "$100 Prezzy Card",
      cost: 50000,
      desc: "$100 Prezzy Card. Redeemable IRL.",
    },
  ],
  casino: {
    minWager: 1,
    maxWager: 500,
    defaultWager: 10,
    houseEdgeNote: "~5% house edge across all tables",
  },
  casinoGames: [
    {
      id: "wheel",
      name: "Wheel of Fates",
      tag: "SPIN",
      desc: "47.5% chance to double your stake.",
      needsChoice: false,
    },
    {
      id: "coin",
      name: "Coin of the Shore",
      tag: "FLIP",
      desc: "Call heads or tails. Double or nothing.",
      needsChoice: true,
      choices: [
        { id: "heads", label: "Heads" },
        { id: "tails", label: "Tails" },
      ],
    },
    {
      id: "dice",
      name: "Bone Dice",
      tag: "ROLL",
      desc: "High (4–6) or Low (1–3). Win pays 1.9×.",
      needsChoice: true,
      choices: [
        { id: "high", label: "High" },
        { id: "low", label: "Low" },
      ],
    },
    {
      id: "blackjack",
      name: "Void Blackjack",
      tag: "DEAL",
      desc: "Instant deal 16–21. Beat the House to win.",
      needsChoice: false,
    },
    {
      id: "poker",
      name: "Shore Showdown",
      tag: "DRAW",
      desc: "High card duel vs the House. Win pays 1.9×.",
      needsChoice: false,
    },
    {
      id: "slots",
      name: "Neon Slots",
      tag: "PULL",
      desc: "Three reels. Match to win. Rare jackpot.",
      needsChoice: false,
    },
  ],
};

/** Categories for Shore Picks (meetups column). */
window.NSSC.shorePickCategories = [
  { id: "food", label: "Food" },
  { id: "activity", label: "Activity" },
  { id: "date", label: "Date Night" },
  { id: "other", label: "Other" },
];

/** Mysterious invite copy for the Transmit share card. */
window.NSSC.shareInvite = {
  eyebrow: "TRANSMISSION \u00b7 CLASSIFIED",
  title: "Extend the Threshold",
  prelude:
    "A sealed channel from the North Shore. Not a link. A summons.",
};

window.NSSC.numerologyTokens = [
  "01001110", "1010", "0xN5C", "7·7·7", "111", "333", "666", "1111",
  "PI = 3.14159", "PHI = 1.618", "e = 2.718", "ALEPH·0",
  "MMXXVI", "VI·VI·VI", "XCIX", "C·L·X", "ORDO·BOREALIS",
  "36.7949\u00b0S", "174.7480\u00b0E", "NSSC", "INIT()", "TRUST=0",
];
