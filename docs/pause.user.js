// ==UserScript==
// @name         Pause
// @description  Instagram/TikTok only through your pause screen. Instagram without Reels.
// @match        *://www.instagram.com/*
// @match        *://instagram.com/*
// @match        *://www.tiktok.com/*
// @match        *://tiktok.com/*
// @noframes
// @run-at       document-start
// ==/UserScript==

(() => {
  const SITE = "https://olzhasmyrzakhmet.github.io/pause/pause.html";
  const MAX_PASS = 60 * 60e3;         // a pass from the hash can never be longer than 1 hour
  const app = /tiktok\.com$/.test(location.hostname) ? "tiktok" : "instagram";
  const K = "pause-pass-until";

  // 1. Pass handed over by the pause screen: #pause-pass=<expiry ms>
  const m = location.hash.match(/pause-pass=(\d+)/);
  if (m) {
    localStorage.setItem(K, String(Math.min(+m[1], Date.now() + MAX_PASS)));
    history.replaceState(null, "", location.pathname + location.search);
  }
  const passOk = () => Date.now() < (+localStorage.getItem(K) || 0);
  const kick = () => location.replace(`${SITE}?app=${app}&back=${encodeURIComponent(location.href)}`);

  // 2. No pass -> pause screen. Pass runs out while scrolling -> pause screen.
  if (!passOk()) return kick();
  setInterval(() => { if (!passOk()) kick(); }, 5000);

  // 3. Instagram without Reels: hide the tab, bounce the feed. Single /reel/<id> from a friend's DM stays.
  if (app !== "instagram") return;
  const style = document.createElement("style");
  style.textContent = 'a[href="/reels/"], a[href^="/reels/?"] { display: none !important; }';
  (document.head || document.documentElement).append(style);
  const guard = () => {
    const p = location.pathname;
    if (/^\/reels(\/|$)/.test(p)) {
      location.replace("/"); // the Reels feed; a single reel a friend sends is /reel/<id> and stays
    } else if (p === "/explore/") {
      location.replace("/explore/search/"); // keep search, drop the Explore grid (it is mostly Reels)
    }
  };
  guard();
  setInterval(guard, 500); // Instagram is a single-page app; URL changes without reloads
})();
