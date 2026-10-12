import { getWeek, getMyBallot, submitBallot, weekState, pointsForRank } from "./api.js";
import { mountChrome, loadRoster, esc, $, countdown } from "./common.js";

const MAX = 10;
const state = { week: null, roster: [], byId: new Map(), picks: [], q: "", open: false, saved: false };

const session = await mountChrome("vote");
if (!session) {
  location.replace("login.html?next=vote.html");
} else {
  await init();
}

async function init() {
  try {
    const week = await getWeek();
    if (!week) {
      $("#vote-app").innerHTML = `<p class="notice">No category is live right now. Check back soon.</p>`;
      return;
    }
    state.week = week;
    state.roster = await loadRoster(week.roster);
    state.byId = new Map(state.roster.map((c) => [c.id, c]));
    state.open = weekState(week) === "open";

    const existing = await getMyBallot(week);
    if (existing) {
      state.picks = existing.filter((id) => state.byId.has(id));
      state.saved = state.picks.length === MAX;
    }

    $("#category").textContent = week.category;
    if (state.open) {
      countdown($("#countdown"), week.endsAt, () => location.reload());
    } else {
      $("#countdown").textContent = weekState(week) === "closed" ? "Voting has closed" : "Voting has not opened yet";
    }

    bind();
    render();
  } catch (err) {
    $("#vote-app").innerHTML = `<p class="notice err">Could not load the voting page: ${esc(err.message)}</p>`;
  }
}

function bind() {
  $("#search").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderRoster();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !state.open) return;
    const { add, up, down, rm } = btn.dataset;
    if (add !== undefined && state.picks.length < MAX && !state.picks.includes(add)) {
      state.picks.push(add);
    } else if (up !== undefined) {
      const i = Number(up);
      [state.picks[i - 1], state.picks[i]] = [state.picks[i], state.picks[i - 1]];
    } else if (down !== undefined) {
      const i = Number(down);
      [state.picks[i + 1], state.picks[i]] = [state.picks[i], state.picks[i + 1]];
    } else if (rm !== undefined) {
      state.picks.splice(Number(rm), 1);
    } else {
      return;
    }
    state.saved = false;
    render();
  });

  $("#submit").addEventListener("click", save);
  $("#copy").addEventListener("click", copyShare);
  $("#native-share").addEventListener("click", nativeShare);
  if (!navigator.share) $("#native-share").hidden = true;
}

function render() {
  renderRoster();
  renderPicks();
  const full = state.picks.length === MAX;
  $("#submit").disabled = !state.open || !full;
  $("#picks-count").textContent = `${state.picks.length} of ${MAX} chosen`;
  $("#submit").textContent = state.saved ? "Saved. Update top 10" : "Lock in my top 10";
  $("#share").hidden = !state.saved;
  if (state.saved) renderShare();
  if (!state.open) $("#closed-note").hidden = false;
}

function renderRoster() {
  const q = state.q.trim().toLowerCase();
  const list = state.roster.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.real.toLowerCase().includes(q)
  );
  $("#roster").innerHTML =
    list
      .map((c) => {
        const idx = state.picks.indexOf(c.id);
        const picked = idx >= 0;
        return `<li><button type="button" class="pick${picked ? " picked" : ""}" data-add="${esc(c.id)}"
          ${picked || !state.open || state.picks.length >= MAX ? "disabled" : ""}>
          <span class="n">${esc(c.name)}</span><span class="r">${esc(c.real)}</span>
          ${picked ? `<span class="tag">#${idx + 1}</span>` : ""}</button></li>`;
      })
      .join("") || `<li class="empty">No X-Men match "${esc(state.q)}".</li>`;
}

function renderPicks() {
  $("#picks").innerHTML = Array.from({ length: MAX }, (_, i) => {
    const c = state.byId.get(state.picks[i]);
    const pts = pointsForRank(i + 1);
    const controls =
      c && state.open
        ? `<span class="ctl">
            <button type="button" data-up="${i}" aria-label="Move ${esc(c.name)} up" ${i === 0 ? "disabled" : ""}>&uarr;</button>
            <button type="button" data-down="${i}" aria-label="Move ${esc(c.name)} down" ${i === state.picks.length - 1 ? "disabled" : ""}>&darr;</button>
            <button type="button" data-rm="${i}" aria-label="Remove ${esc(c.name)}">&times;</button>
          </span>`
        : "";
    return `<li class="slot${c ? " filled" : ""}">
      <span class="rank">${i + 1}</span>
      <span class="who">${c ? `<strong>${esc(c.name)}</strong><small>${esc(c.real)}</small>` : `<em>Choose your #${i + 1}</em>`}</span>
      <span class="pts">${pts} pt${pts > 1 ? "s" : ""}</span>
      ${controls}
    </li>`;
  }).join("");
}

async function save() {
  const btn = $("#submit");
  const msg = $("#vote-msg");
  btn.disabled = true;
  msg.className = "msg";
  msg.textContent = "";
  try {
    await submitBallot(state.week, state.picks);
    state.saved = true;
    msg.className = "msg ok";
    msg.textContent = "Saved. Totals stay hidden until voting closes. You can change your list until then.";
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = err.message || "Could not save your top 10. Try again.";
  }
  render();
}

/* ---------- sharing ---------- */

function shareText() {
  const lines = state.picks.map((id, i) => `${i + 1}. ${state.byId.get(id).name}`);
  const link = new URL("index.html", location.href).href;
  return `My GOATVersus top 10 (${state.week.category}):\n${lines.join("\n")}\n\nBuild yours: ${link}`;
}

function renderShare() {
  const text = shareText();
  $("#share-text").textContent = text;
  $("#share-x").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

async function copyShare() {
  const msg = $("#share-msg");
  try {
    await navigator.clipboard.writeText(shareText());
    msg.textContent = "Copied to clipboard.";
  } catch {
    msg.textContent = "Could not copy. Select the text above and copy it manually.";
  }
}

async function nativeShare() {
  try {
    await navigator.share({ title: "My GOATVersus top 10", text: shareText() });
  } catch {
    /* the person closed the share sheet */
  }
}
