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
    glyph: "\u{1F3DB}\uFE0F",
    tagline: "You create order from chaos.",
    description:
      "You move from possibility to artifact. Where others see ruins, you see foundations. The Order needs Builders to give its ideas weight in the world.",
    values: ["Action", "Progress", "Practicality", "Creation"],
  },
  {
    id: "scholar",
    name: "The Scholar",
    glyph: "\u{1F4DA}",
    tagline: "You seek understanding above all else.",
    description:
      "You distrust answers that come too easily. You want to know why before you act, and you would rather be quietly right than loudly first. The Order needs Scholars to remember what others forget.",
    values: ["Learning", "Curiosity", "Knowledge", "Reflection"],
  },
  {
    id: "guardian",
    name: "The Guardian",
    glyph: "\u{1F6E1}\uFE0F",
    tagline: "You protect people, traditions, and institutions.",
    description:
      "You feel responsibility in your bones. You'd rather be the one who held the line than the one who got the credit. The Order needs Guardians to keep its house standing through storms.",
    values: ["Duty", "Stability", "Responsibility", "Stewardship"],
  },
  {
    id: "explorer",
    name: "The Explorer",
    glyph: "\u{1F9ED}",
    tagline: "You are driven by discovery.",
    description:
      "You can't stand a closed door. The point isn't always the destination; sometimes it's the looking. The Order needs Explorers to bring back what nobody else even knew to ask about.",
    values: ["Adventure", "Risk", "Possibility", "Growth"],
  },
  {
    id: "sovereign",
    name: "The Sovereign",
    glyph: "\u{1F451}",
    tagline: "You guide others through uncertainty.",
    description:
      "You think in systems and in people simultaneously. You read the room and then move it. The Order needs Sovereigns to keep its loose threads bound to a shared horizon.",
    values: ["Vision", "Coordination", "Legacy", "Responsibility"],
  },
  {
    id: "wizard",
    name: "The Wizard",
    glyph: "\u2728",
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
  "I am at least 21 years of age. The Shore is no place for minors.",
  "I understand that the Trial is a one-time crossing. No retakes, no second draws, no quiet rerolls at 3am.",
  "I accept that the archetype revealed to me at the end will be mine, within this Order, for as long as the Order endures.",
  "I will not attempt to game the Trial, brute-force the sequence, or otherwise reach for an outcome that is not honestly mine.",
  "I accept that membership, once granted, is permanent and cannot be revoked by myself, the Club, or any external authority.",
  "I will not disclose the contents of this portal, the questions herein, or the Handshake to non-members.",
  "I enter of my own free will, of sound mind, and with full understanding that this is all in good fun \u2014 until it isn't.",
];

/**
 * Available T-shirt sizes.
 */
window.NSSC.sizes = ["XS", "S", "M", "L", "XL", "XXL"];

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

window.NSSC.numerologyTokens = [
  "01001110", "1010", "0xN5C", "7·7·7", "111", "333", "666", "1111",
  "PI = 3.14159", "PHI = 1.618", "e = 2.718", "ALEPH·0",
  "MMXXVI", "VI·VI·VI", "XCIX", "C·L·X", "ORDO·BOREALIS",
  "36.7949\u00b0S", "174.7480\u00b0E", "NSSC", "INIT()", "TRUST=0",
];
