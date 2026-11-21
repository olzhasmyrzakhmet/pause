// All data lives in this browser's localStorage. No server.
const KEY = "pause.v1";
const DEFAULTS = {
  intention: "",           // note to self
  intentionAt: 0,          // when it was written (ms)
  waitSec: 10,             // timer on "Still true?" screen
  growSec: 5,              // Growing Wait: +N sec per open the same day
  lockMin: 30,             // after the picked time runs out, locked for N min
  log: [],                 // [{t, app, action: "open"|"closed"|"continued", min?}]
};

export function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
export function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export const dayKey = (t) => new Date(t).toDateString();

export function opensToday(s, app, now = Date.now()) {
  return s.log.filter((e) => e.action === "open" && e.app === app && dayKey(e.t) === dayKey(now)).length;
}

export function ordinal(n) {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return n + suf;
}

// "YOU, YESTERDAY" / "YOU, TODAY" / "YOU, 5 DAYS AGO"
export function agoLabel(t, now = Date.now()) {
  const d = Math.round((new Date(dayKey(now)) - new Date(dayKey(t))) / 864e5);
  return d <= 0 ? "You, today" : d === 1 ? "You, yesterday" : `You, ${d} days ago`;
}

// Words for Type-it-out: case, punctuation, emoji, ё/е and Unicode forms don't matter.
export const normWord = (w) => w.normalize("NFKC").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");
export const words = (str) => str.trim().split(/\s+/).filter((w) => normWord(w));

// Only allow going back to the sites we guard (the back URL comes from the query string).
export function safeBack(url) {
  try {
    const u = new URL(url);
    return /(^|\.)(instagram|tiktok)\.com$/.test(u.hostname) && u.protocol === "https:" ? u.href : null;
  } catch { return null; }
}
