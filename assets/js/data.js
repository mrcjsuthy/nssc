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
 * The morality test. Each entry has 3 answers; exactly one is correct.
 * Correct-answer pattern by question: A B B A C A B A B A.
 * Tone: the right answer still beats the wrong ones, but with a smirk.
 */
window.NSSC.questions = [
  // Q1 — correct: A
  {
    q: "You watch a stranger drop a $50 note while boarding the Devonport ferry. The doors are about to close. You…",
    a: [
      { text: "Call out, sprint, hand it back. Pretend you needed the cardio.", correct: true },
      { text: "Pocket it. Finders keepers.", correct: false },
      { text: "Hand it to a random kid like a budget Robin Hood.", correct: false },
    ],
  },
  // Q2 — correct: B
  {
    q: "Your mate is loudly bragging about cheating on his partner. You're the only one not laughing. You…",
    a: [
      { text: "Laugh with the boys to keep the peace.", correct: false },
      { text: "Pull him aside and tell him, quietly but firmly, that he's being a dickhead.", correct: true },
      { text: "Stay quiet now, save it for gossip later.", correct: false },
    ],
  },
  // Q3 — correct: B
  {
    q: "A tired barman undercharges you by $30. He won't notice. You…",
    a: [
      { text: "Walk out. His mistake, your win.", correct: false },
      { text: "Point it out, pay the difference, and tip him for the rough shift.", correct: true },
      { text: "Demand a fresh round 'to make up for it'.", correct: false },
    ],
  },
  // Q4 — correct: A
  {
    q: "A scrap is brewing outside a Takapuna bar. One side is clearly outnumbered. You…",
    a: [
      { text: "Call it in. Position yourself as the calmest adult on the footpath.", correct: true },
      { text: "Pretend you didn't see it and keep walking.", correct: false },
      { text: "Whip the phone out and film the carnage.", correct: false },
    ],
  },
  // Q5 — correct: C
  {
    q: "A new neighbour moves in. The street group chat starts getting snide about where they're from. You…",
    a: [
      { text: "Stay neutral. Not your fight.", correct: false },
      { text: "Forward the chat so 'they know what to expect'.", correct: false },
      { text: "Drop a welcome note in their letterbox and tell the chat to wind their necks in.", correct: true },
    ],
  },
  // Q6 — correct: A
  {
    q: "You reverse into a parked Hilux at Albany Westfield. No witnesses. You…",
    a: [
      { text: "Leave a note with your name, number, and an apology. Then go have the small panic privately in your car.", correct: true },
      { text: "Drive off — it's barely a scratch.", correct: false },
      { text: "Wait, see who comes back, then bolt if they look hostile.", correct: false },
    ],
  },
  // Q7 — correct: B
  {
    q: "A drunk stranger spills her drink at the pub and quietly starts crying. You…",
    a: [
      { text: "Ignore it. Not your problem.", correct: false },
      { text: "Slide a water across, ask if her people know where she is, help her find them.", correct: true },
      { text: "Take a video for the boys' group chat.", correct: false },
    ],
  },
  // Q8 — correct: A
  {
    q: "A close friend asks for honest feedback on their genuinely awful business idea. You…",
    a: [
      { text: "Be honest, kind, specific — then offer to help them find the version of it that doesn't suck.", correct: true },
      { text: "Tell them it's brilliant so they feel good.", correct: false },
      { text: "Dodge the question and change the subject.", correct: false },
    ],
  },
  // Q9 — correct: B
  {
    q: "Your boss takes credit for your work in front of the team. You…",
    a: [
      { text: "Quietly sabotage their next project.", correct: false },
      { text: "Book 15 minutes with them. Use it. Keep it calm. Keep the receipts.", correct: true },
      { text: "Say nothing and seethe for six months.", correct: false },
    ],
  },
  // Q10 — correct: A
  {
    q: "Someone is being needlessly rude to a server at your local Browns Bay café. You…",
    a: [
      { text: "Step in respectfully. Tip the server harder than usual on the way out.", correct: true },
      { text: "Mind your business. You're hungry.", correct: false },
      { text: "Leave a one-star review on the café out of frustration.", correct: false },
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
