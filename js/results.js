import { getWeek, getResults, getBallotCount, weekState } from "./api.js";
import { DEMO } from "./config.js";
import { mountChrome, loadRoster, esc, $, countdown, fmtDate } from "./common.js";

await mountChrome("results");

const params = new URLSearchParams(location.search);

try {
  const week = await getWeek(params.get("week") || undefined);
  if (!week) {
    $("#results-app").innerHTML = `<p class="notice">No category yet. Check back soon.</p>`;
  } else {
    $("#category").textContent = week.category;
    const state = weekState(week);
    // In demo mode only, ?reveal=1 lets you preview the results page early.
    const reveal = state === "closed" || (DEMO && params.get("reveal") === "1");
    if (reveal) {
      await showResults(week);
    } else {
      await showLocked(week, state);
    }
  }
} catch (err) {
  $("#results-app").innerHTML = `<p class="notice err">Could not load results: ${esc(err.message)}</p>`;
}

async function showLocked(week, state) {
  const count = await getBallotCount(week).catch(() => null);
  $("#locked").hidden = false;
  $("#locked-title").textContent = state === "upcoming" ? "Voting has not opened yet" : "The tally is locked";
  $("#locked-text").textContent =
    state === "upcoming"
      ? `Voting opens ${fmtDate(week.startsAt)}.`
      : "Nobody can see the standings, not even us. The top 50 appears when voting closes.";
  $("#voters").textContent = count === null ? "" : `${count} ${count === 1 ? "ballot" : "ballots"} locked in so far`;
  if (state === "open") {
    $("#locked-label").textContent = "Reveal in";
    countdown($("#countdown"), week.endsAt, () => location.reload());
  } else {
    $("#countdown").textContent = fmtDate(week.startsAt);
  }
}

async function showResults(week) {
  const [roster, rows] = await Promise.all([loadRoster(week.roster), getResults(week)]);
  const byId = new Map(roster.map((c) => [c.id, c]));
  $("#revealed").hidden = false;

  if (!rows.length) {
    $("#ranking").innerHTML = `<li class="empty">Nobody voted this week.</li>`;
    return;
  }
  const max = rows[0].points || 1;
  $("#ranking").innerHTML = rows
    .map((r, i) => {
      const c = byId.get(r.character_id);
      const pct = Math.max(4, Math.round((r.points / max) * 100));
      return `<li class="row r${i + 1 <= 3 ? i + 1 : ""}">
        <span class="rk">${i + 1}</span>
        <span class="nm"><strong>${esc(c ? c.name : r.character_id)}</strong><small>${esc(c ? c.real : "")}</small></span>
        <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="sc">${r.points}<small> pts &middot; ${r.voters} ${r.voters === 1 ? "voter" : "voters"}</small></span>
      </li>`;
    })
    .join("");
}
