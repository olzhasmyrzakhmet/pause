// ==UserScript==
// @name         Pause
// @description  Instagram/TikTok only through your pause screen. Instagram without Reels.
// @version      3
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
  if (app === "instagram") {
    const style = document.createElement("style");
    style.textContent = 'a[href="/reels/"], a[href^="/reels/?"] { display: none !important; }';
    (document.head || document.documentElement).append(style);
    const guard = () => {
      const p = location.pathname;
      if (/^\/reels(\/|$)/.test(p)) location.replace("/"); // a single reel from a friend is /reel/<id> and stays
      else if (p === "/explore/") location.replace("/explore/search/"); // keep search, drop the Reels-heavy grid
    };
    guard();
    setInterval(guard, 500); // Instagram is a single-page app; URL changes without reloads
  }

  // Pass handed over by the pause screen: #pause-pass=<expiry ms>
  const m = location.hash.match(/pause-pass=(\d+)/);
  if (m) {
    history.replaceState(null, "", location.pathname + location.search);
    await GM.setValue(KEY, Math.min(+m[1], Date.now() + MAX_PASS));
  }
  const passOk = async () => Date.now() < (+(await GM.getValue(KEY, 0)) || 0);
  const kick = () => location.replace(`${SITE}?app=${app}&back=${encodeURIComponent(location.href)}`);

  // No pass -> pause screen. Pass runs out while scrolling -> pause screen.
  if (!(await passOk())) return kick();
  setInterval(async () => { if (!(await passOk())) kick(); }, 5000);
})();
