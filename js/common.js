import { getSession, signOut } from "./api.js";
import { DEMO } from "./config.js";

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function loadRoster(name) {
  const res = await fetch(`data/${encodeURIComponent(name)}.json`);
  if (!res.ok) throw new Error(`Could not load the ${name} roster.`);
  return res.json();
}

/** Renders the header + footer and returns the current session (or null). */
export async function mountChrome(active = "") {
  const session = await getSession();
  const links = [
    ["index.html", "Home", "home"],
    ["vote.html", "Vote", "vote"],
    ["results.html", "Results", "results"],
  ];

  $("#site-header").innerHTML = `
    ${DEMO ? `<div class="demo-banner">Demo mode: data is stored in this browser only. Add your Supabase details in <code>js/config.js</code> to go live.</div>` : ""}
    <div class="bar">
      <a class="brand" href="index.html">
        <img src="assets/logo.svg" alt="" width="72" height="36">
        <span>GOAT<b>Versus</b></span>
      </a>
      <nav aria-label="Main">
        ${links.map(([href, label, key]) => `<a href="${href}" ${active === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
        ${session
          ? `<button id="logout" class="linklike" type="button">Log out</button>`
          : `<a href="login.html" class="btn small">Log in</a>`}
      </nav>
    </div>`;

  const logout = $("#logout");
  if (logout) {
    logout.addEventListener("click", async () => {
      await signOut();
      location.href = "index.html";
    });
  }

  const footer = $("#site-footer");
  if (footer) {
    footer.innerHTML = `<p>GOATVersus is an unofficial fan project. X-Men and all related characters are trademarks of Marvel.</p>`;
  }
  return session;
}

/** Live countdown. Calls onDone once when the time runs out. */
export function countdown(el, endDate, onDone) {
  const tick = () => {
    const ms = endDate.getTime() - Date.now();
    if (ms <= 0) {
      el.textContent = "Voting has closed";
      clearInterval(timer);
      if (onDone) onDone();
      return;
    }
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    el.textContent = `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
  };
  const timer = setInterval(tick, 1000);
  tick();
}

export const fmtDate = (d) =>
  d.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
