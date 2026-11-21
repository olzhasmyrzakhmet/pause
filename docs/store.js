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

export const hourLabel = (h) => (h % 12 || 12) + (h < 12 ? "am" : "pm");

// Monday 00:00 of the week containing t
export function weekStart(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.getTime();
}

export function stats(log, now = Date.now()) {
  const w0 = weekStart(now), w1 = weekStart(w0 - 1);
  const sum = (from, to) => {
    const es = log.filter((e) => e.t >= from && e.t < to);
    return {
      opens: es.filter((e) => e.action === "open").length,
      closed: es.filter((e) => e.action === "closed").length,
      minutes: es.reduce((a, e) => a + (e.action === "continued" ? e.min || 0 : 0), 0),
    };
  };
  const byHour = Array(24).fill(0);
  for (const e of log) if (e.action === "open") byHour[new Date(e.t).getHours()]++;
  const top = Math.max(...byHour);
  const first = log.length ? Math.min(...log.map((e) => e.t)) : null;
  return {
    thisWeek: sum(w0, Infinity), lastWeek: sum(w1, w0), all: sum(0, Infinity), byHour,
    peakHour: top ? byHour.indexOf(top) : null,
    days: first == null ? 0 : Math.round((new Date(dayKey(now)) - new Date(dayKey(first))) / 864e5) + 1,
  };
}

// Words for Type-it-out: case, punctuation, emoji, ё/е and Unicode forms don't matter.
export const normWord = (w) => w.normalize("NFKC").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");
export const words = (str) => str.trim().split(/\s+/).filter((w) => normWord(w));

// Instagram modes: what the pass lets you into (the userscript enforces it)
export const IG_MODES = { dm: "Messages", stories: "Stories", saved: "Saved", all: "Everything" };
export function modeTarget(mode, igUser) {
  const ig = "https://www.instagram.com";
  if (mode === "dm") return ig + "/direct/inbox/";
  if (mode === "saved" && igUser) return `${ig}/${encodeURIComponent(igUser)}/saved/`;
  return ig + "/";
}
// home = where the userscript sends you back to inside the mode (the mode's start page)
export const passUrl = (target, until, mode, home = "/") => {
  const u = new URL(target);
  u.hash = `pause-pass=${until}&pause-mode=${mode}&pause-home=${encodeURIComponent(home)}`;
  return u.href;
};
// Instagram usernames: letters, digits, _ and . — and at least one letter/digit ("." or ".." would change the path)
export const cleanIgUser = (v) => {
  const u = String(v).trim().replace(/^@/, "").replace(/[^\w.]/g, "");
  return /\w/.test(u) ? u : "";
};

// Only allow going back to the sites we guard (the back URL comes from the query string).
export function safeBack(url) {
  try {
    const u = new URL(url);
    return /(^|\.)(instagram|tiktok)\.com$/.test(u.hostname) && u.protocol === "https:" ? u.href : null;
  } catch { return null; }
}
