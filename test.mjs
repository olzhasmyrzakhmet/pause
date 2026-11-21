// Self-check: node test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
const st = await import("./docs/store.js");

assert.equal(st.ordinal(1), "1st"); assert.equal(st.ordinal(2), "2nd"); assert.equal(st.ordinal(3), "3rd");
assert.equal(st.ordinal(11), "11th"); assert.equal(st.ordinal(22), "22nd");
const now = new Date(2026, 10, 21, 12).getTime();
assert.equal(st.agoLabel(now - 864e5, now), "You, yesterday");
assert.equal(st.agoLabel(now, now), "You, today");
assert.equal(st.safeBack("https://www.instagram.com/direct/inbox/"), "https://www.instagram.com/direct/inbox/");
assert.equal(st.safeBack("https://evil.com/?instagram.com"), null);
assert.equal(st.safeBack("https://instagram.com.evil.com/"), null);
assert.equal(st.safeBack("javascript:alert(1)"), null);
// stats
assert.equal(st.hourLabel(0), "12am"); assert.equal(st.hourLabel(15), "3pm"); assert.equal(st.hourLabel(12), "12pm");
const sat = new Date(2026, 10, 21, 15).getTime(); // Saturday
assert.equal(new Date(st.weekStart(sat)).getDay(), 1);
const L = [
  { t: sat, action: "open" }, { t: sat, action: "closed" },
  { t: sat - 7 * 864e5, action: "open" }, { t: sat - 7 * 864e5, action: "open" }, { t: sat - 7 * 864e5, action: "continued", min: 15 },
];
const S = st.stats(L, sat);
assert.deepEqual(S.thisWeek, { opens: 1, closed: 1, minutes: 0 });
assert.deepEqual(S.lastWeek, { opens: 2, closed: 0, minutes: 15 });
assert.equal(S.peakHour, 15); assert.equal(S.days, 8);
assert.equal(st.stats([], sat).peakHour, null);

// Type-it-out matching
const same = (a, b) => { const x = st.words(a).map(st.normWord), y = st.words(b).map(st.normWord); return x.join(" ") === y.join(" "); };
assert.ok(same("read — then sleep", "read then sleep"));
assert.ok(same("sleep early 🌙", "Sleep early"));
assert.ok(same("café", "café"));
assert.ok(same("хочу всё успеть", "хочу все успеть"));
assert.ok(same("Я — читаю!", "я - читаю"));
assert.ok(!same("want to be more", "want to be"));
const s = st.load(); s.log.push({ t: now, app: "instagram", action: "open" }, { t: now - 864e5, app: "instagram", action: "open" });
assert.equal(st.opensToday(s, "instagram", now), 1);

// userscript: run it with a fake page
async function run(url, stored, gm = {}) {
  const u = new URL(url);
  const app = u.hostname.includes("tiktok") ? "tiktok" : "instagram";
  if (stored) gm["pass-" + app] = stored;
  const env = {
    redirected: null, styles: 0, gm,
    location: { hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash, href: u.href,
      replace(x) { env.redirected ??= x; } },
    GM: { getValue: async (k, d) => gm[k] ?? d, setValue: async (k, v) => { gm[k] = v; } },
    history: { replaceState() {} },
    document: { head: { append() { env.styles++; } }, createElement: () => ({}) },
    setInterval() {}, Date, encodeURIComponent,
  };
  await vm.runInNewContext(readFileSync("docs/pause.user.js", "utf8").replace("https://olzhasmyrzakhmet.github.io/pause", "https://x.test"), env);
  return env;
}
const later = Date.now() + 10 * 60e3;
let e = await run("https://www.instagram.com/");
assert.match(e.redirected, /^https:\/\/x\.test\/pause\.html\?app=instagram&back=https%3A%2F%2Fwww\.instagram\.com%2F$/);
e = await run("https://www.tiktok.com/foryou");
assert.match(e.redirected, /app=tiktok/);
e = await run("https://www.instagram.com/#pause-pass=" + later);
assert.equal(e.redirected, null); assert.equal(e.styles, 1);
// pass lives in extension storage, so it survives Instagram wiping its own localStorage and www <-> bare domain hops
e = await run("https://instagram.com/", null, e.gm);
assert.equal(e.redirected, null);
e = await run("https://www.instagram.com/#pause-pass=99999999999999"); // forged huge pass gets capped
assert.ok(e.gm["pass-instagram"] <= Date.now() + 60 * 60e3);
e = await run("https://www.instagram.com/reels/", later);
assert.equal(e.redirected, "/");
e = await run("https://www.instagram.com/reel/abc123/", later);
assert.equal(e.redirected, null);
e = await run("https://www.instagram.com/reelsbyanna/", later); // a profile, not the Reels feed
assert.equal(e.redirected, null);
e = await run("https://www.instagram.com/explore/", later);
assert.equal(e.redirected, "/explore/search/");
e = await run("https://www.instagram.com/", Date.now() - 1);
assert.match(e.redirected, /pause\.html/);
e = await run("https://www.tiktok.com/", later); // instagram pass doesn't open tiktok
assert.equal(e.redirected, null);
e = await run("https://www.tiktok.com/", null, { "pass-instagram": later });
assert.match(e.redirected, /app=tiktok/);
// backup / restore on the Pause site
async function runSite(localVal, gm) {
  const env = {
    reloaded: false, gm,
    location: { hostname: "olzhasmyrzakhmet.github.io", pathname: "/pause/", hash: "", reload() { env.reloaded = true; } },
    localStorage: { d: localVal ? { "pause.v1": localVal } : {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } },
    GM: { getValue: async (k, d) => gm[k] ?? d, setValue: async (k, v) => { gm[k] = v; } },
    setInterval() {}, Date, JSON,
  };
  await vm.runInNewContext(readFileSync("docs/pause.user.js", "utf8"), env);
  return env;
}
const withNote = JSON.stringify({ intention: "be more with friends", log: [] });
let gm = {};
let x = await runSite(withNote, gm);                 // note written on the site -> backed up
assert.equal(gm.state, withNote); assert.equal(x.reloaded, false);
x = await runSite(null, gm);                          // Safari wiped the site -> restored + reload
assert.equal(x.localStorage.d["pause.v1"], withNote); assert.equal(x.reloaded, true);
x = await runSite(null, {});                          // nothing to restore -> no reload
assert.equal(x.reloaded, false);
const cleared = JSON.stringify({ intention: "", log: [] });
x = await runSite(cleared, gm);                       // note cleared on purpose -> stays cleared, backup follows
assert.equal(x.reloaded, false); assert.equal(gm.state, cleared);
console.log("all checks passed");
