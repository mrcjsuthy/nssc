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
 * The morality test. Each entry has 3 answers, one of three kinds:
 *   correct: true   \u2014 the Ideal answer; advances to the next question.
 *   trap: true      \u2014 instant fail, kicks the user to the Blocked screen.
 *   (neither)       \u2014 Neutral; soft reject, the gate holds, try again.
 *
 * Correct-answer pattern by question: A B B A C A B A B A.
 * Trap-answer  pattern by question:   C C A B A C A B C B.
 */
window.NSSC.questions = [
  // Q1 \u2014 ideal: A, trap: C
  {
    q: "You discover a room containing every book ever written and every book yet to be written. You may take only one.",
    a: [
      { text: "A book that explains why things are the way they are.",     correct: true },
      { text: "A book that helps others understand themselves." },
      { text: "A book that reveals the secrets of power.",                 trap: true },
    ],
  },
  // Q2 \u2014 ideal: B, trap: C
  {
    q: "What is the greater danger?",
    a: [
      { text: "Not knowing enough." },
      { text: "Believing you know enough.",   correct: true },
      { text: "Wanting to know too much.",    trap: true },
    ],
  },
  // Q3 \u2014 ideal: B, trap: A
  {
    q: "An all-knowing being offers to answer one question. What do you ask?",
    a: [
      { text: "How can I become successful?",        trap: true },
      { text: "What am I failing to understand?",    correct: true },
      { text: "What should humanity do next?" },
    ],
  },
  // Q4 \u2014 ideal: A, trap: B
  {
    q: "A bridge is collapsing. Hundreds cross it safely every day, but nobody knows why it still stands.",
    a: [
      { text: "Investigate why it stands.",                   correct: true },
      { text: "Trust that it has worked so far.",             trap: true },
      { text: "Close it until its safety is understood." },
    ],
  },
  // Q5 \u2014 ideal: C, trap: A
  {
    q: "Which quality is most important in a leader?",
    a: [
      { text: "Confidence.",                          trap: true },
      { text: "Wisdom." },
      { text: "The ability to admit they are wrong.", correct: true },
    ],
  },
  // Q6 \u2014 ideal: A, trap: C
  {
    q: "You inherit a machine that can solve any problem instantly.",
    a: [
      { text: "First understand how it works.",       correct: true },
      { text: "Use it carefully on a small problem." },
      { text: "Hide it from everyone.",               trap: true },
    ],
  },
  // Q7 \u2014 ideal: B, trap: A
  {
    q: "You enter a room where the greatest thinkers in history are debating.",
    a: [
      { text: "Present your own ideas immediately.",      trap: true },
      { text: "Listen before speaking.",                  correct: true },
      { text: "Ask the question no one else is asking." },
    ],
  },
  // Q8 \u2014 ideal: A, trap: B
  {
    q: "Which statement feels most true?",
    a: [
      { text: "Every answer creates new questions.",        correct: true },
      { text: "Some questions should never be asked.",      trap: true },
      { text: "Truth often changes those who seek it." },
    ],
  },
  // Q9 \u2014 ideal: B, trap: C
  {
    q: "Which enemy is hardest to defeat?",
    a: [
      { text: "Ignorance." },
      { text: "Certainty.",   correct: true },
      { text: "Fear.",        trap: true },
    ],
  },
  // Q10 \u2014 ideal: A, trap: B
  {
    q: "At the end of the trial, a door reads: \u201CThose who seek only entry are not ready to enter.\u201D What do you do?",
    a: [
      { text: "Consider why the inscription exists before proceeding.",   correct: true },
      { text: "Force the door open.",                                     trap: true },
      { text: "Step back and ask what the trial was really testing." },
    ],
  },
];

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
  "I understand that the Test of Worthiness is a one-time, single-attempt ordeal.",
  "I acknowledge that failure will result in my device, network signature, and IP being permanently inscribed on the Boreal Blacklist.",
  "I will not attempt to re-register, re-route, re-incarnate, or otherwise circumnavigate said blacklist.",
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
