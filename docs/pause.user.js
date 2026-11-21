// ==UserScript==
// @name         Pause
// @description  Instagram/TikTok only through your pause screen. Instagram without Reels.
// @version      5
// @match        *://olzhasmyrzakhmet.github.io/pause/*
// @match        *://www.instagram.com/*
// @match        *://instagram.com/*
// @match        *://www.tiktok.com/*
// @match        *://tiktok.com/*
// @noframes
// @run-at       document-start
// @inject-into  content
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(async () => {
  const SITE = "https://olzhasmyrzakhmet.github.io/pause/pause.html";

  // On the Pause site itself: back up note/settings/stats to the extension's storage, and restore them
  // if Safari wiped the site's localStorage (private tab, cleared data, 7-day cleanup).
  if (location.hostname.endsWith("github.io")) {
    const K = "pause.v1";
    const local = localStorage.getItem(K);
    const backup = await GM.getValue("state", null);
    if (local == null && backup) { // wiped entirely (a note you cleared yourself stays cleared)
      localStorage.setItem(K, backup);
      // reload once so the page reads the restored data; skip if storage is blocked (would loop)
      if (localStorage.getItem(K) === backup) return location.reload();
    }
    let last = null;
    const sync = () => { const v = localStorage.getItem(K); if (v != null && v !== last) { last = v; GM.setValue("state", v); } };
    sync();
    setInterval(sync, 500);
    return;
  }

  const MAX_PASS = 60 * 60e3;         // a pass from the hash can never be longer than 1 hour
  const app = /tiktok\.com$/.test(location.hostname) ? "tiktok" : "instagram";
  const KEY = "pass-" + app;           // kept in the extension's own storage: the site can't wipe it

  // Instagram without Reels: hide the tab and bounce the feed (sync, before any await, so nothing flashes)
  const addCss = (css) => {
    const style = document.createElement("style"); style.textContent = css;
    (document.head || document.documentElement).append(style);
  };
  if (app === "instagram") {
    addCss('a[href="/reels/"], a[href^="/reels/?"] { display: none !important; }');
    const reels = () => {
      const p = location.pathname;
      if (/^\/reels(\/|$)/.test(p)) location.replace("/"); // a single reel from a friend is /reel/<id> and stays
      else if (p === "/explore/") location.replace("/explore/search/"); // keep search, drop the Reels-heavy grid
    };
    reels();
    setInterval(reels, 500); // Instagram is a single-page app; URL changes without reloads
  }

  // Pass handed over by the pause screen: #pause-pass=<expiry ms>&pause-mode=<dm|stories|saved|all>&pause-home=<path>
  const m = location.hash.match(/pause-pass=(\d+)(?:&pause-mode=(\w+))?(?:&pause-home=([^&]+))?/);
  if (m) {
    history.replaceState(null, "", location.pathname + location.search);
    await GM.setValue(KEY, Math.min(+m[1], Date.now() + MAX_PASS));
    await GM.setValue("mode-" + app, m[2] || "all"); // old passes without a mode = everything
    // home comes from the pause screen, not from where we landed (Instagram may have redirected us to login)
    let home = "/"; try { home = decodeURIComponent(m[3] || "/"); } catch {}
    await GM.setValue("home-" + app, home);
  }
  const passOk = async () => Date.now() < (+(await GM.getValue(KEY, 0)) || 0);
  const kick = () => location.replace(`${SITE}?app=${app}&back=${encodeURIComponent(location.href)}`);

  // No pass -> pause screen. Pass runs out while scrolling -> pause screen.
  if (!(await passOk())) return kick();
  setInterval(async () => { if (!(await passOk())) kick(); }, 5000);

  // Mode: stay inside the part of Instagram you picked
  if (app !== "instagram") return;
  let mode = await GM.getValue("mode-instagram", "all");
  const POST = "([^/]+/)?(p|reel)/";               // /p/x/ and the newer /<user>/p/x/
  const RULES = {
    dm: { allow: new RegExp(`^/(direct/|${POST})`), home: "/direct/inbox/" },   // chats + posts/reels friends send
    stories: { allow: /^\/(stories\/.*)?$/, home: "/" },                        // home (feed hidden) + story viewer
    saved: { allow: new RegExp(`^/(${POST}|[^/]+/saved(/|$))`), home: null },   // your saved grid + a saved post
  };
  if (mode === "all") return;
  if (!RULES[mode]) mode = "dm";                    // unknown mode -> the strictest, not everything
  const { allow } = RULES[mode];
  let home = await GM.getValue("home-instagram", "/");
  if (!allow.test(home)) home = RULES[mode].home || "/direct/inbox/"; // never a page this mode itself blocks
  if (!allow.test(home)) return;                   // shortcut: no valid home -> don't enforce rather than loop
  // login, 2FA, consent and terms pages must always work, or you get stuck between them and home
  const ALWAYS = /^\/(accounts|challenge|api|auth_platform|session|privacy|consent|terms|emails|legal)\//;
  if (mode === "stories") addCss("main article { display: none !important; }"); // keep the story tray, drop the feed

  // Loop guard: if Instagram keeps sending us somewhere blocked, give up for this page instead of reloading forever
  const hops = await GM.getValue("hops", { t: 0, n: 0 });
  if (Date.now() - hops.t > 10e3) hops.n = 0;
  if (hops.n >= 3) { await GM.setValue("hops", { t: 0, n: 0 }); return; }
  const stay = async () => {
    const p = location.pathname;
    if (ALWAYS.test(p) || allow.test(p) || p === home) return;
    await GM.setValue("hops", { t: Date.now(), n: hops.n + 1 });
    location.replace(home);
  };
  await stay();
  setInterval(stay, 500);
})();
