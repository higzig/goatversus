import { getWeek, weekState } from "./api.js";
import { mountChrome, countdown, $, fmtDate } from "./common.js";

const session = await mountChrome("home");

try {
  const week = await getWeek();
  if (!week) {
    $("#category").textContent = "No category is live";
    $("#desc").textContent = "The next one starts soon. Check back shortly.";
  } else {
    const state = weekState(week);
    $("#category").textContent = week.category;
    $("#desc").textContent = week.description || "";
    $("#cta-vote").textContent = session ? "Build your top 10" : "Join and vote";
    $("#cta-vote").href = session ? "vote.html" : "login.html?next=vote.html";

    if (state === "open") {
      $("#countdown-label").textContent = "Votes lock in";
      countdown($("#countdown"), week.endsAt, () => location.reload());
    } else if (state === "closed") {
      $("#countdown-label").textContent = "This week has ended";
      $("#countdown").textContent = "Results are in";
      $("#cta-results").textContent = "See the top 50";
    } else {
      $("#countdown-label").textContent = "Voting opens";
      $("#countdown").textContent = fmtDate(week.startsAt);
    }
  }
} catch (err) {
  $("#desc").textContent = `Something went wrong loading this week: ${err.message}`;
}
