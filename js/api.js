import { CONFIG, DEMO } from "./config.js";

/* ---------- helpers ---------- */

let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"
  );
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return sb;
}

const ls = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

/** Position 1..10 -> points 10..1 */
export const pointsForRank = (rank) => 11 - rank;

/* ---------- auth ---------- */

export async function getSession() {
  if (DEMO) return ls.get("gvs_demo_session", null);
  const s = await client();
  const { data } = await s.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email } : null;
}

export async function signUp(email, password) {
  if (DEMO) {
    const users = ls.get("gvs_demo_users", {});
    if (users[email]) throw new Error("That email is already registered. Log in instead.");
    users[email] = password;
    ls.set("gvs_demo_users", users);
    ls.set("gvs_demo_session", { id: email, email });
    return { needsConfirm: false };
  }
  const s = await client();
  const { data, error } = await s.auth.signUp({ email, password });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signIn(email, password) {
  if (DEMO) {
    const users = ls.get("gvs_demo_users", {});
    if (users[email] !== password) throw new Error("Wrong email or password.");
    ls.set("gvs_demo_session", { id: email, email });
    return;
  }
  const s = await client();
  const { error } = await s.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (DEMO) {
    localStorage.removeItem("gvs_demo_session");
    return;
  }
  const s = await client();
  await s.auth.signOut();
}

/* ---------- weeks ---------- */

function demoWeek() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // this Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { ...CONFIG.DEMO_WEEK, startsAt: start, endsAt: end };
}

const mapWeek = (r) => ({
  id: r.id,
  category: r.category,
  description: r.description,
  roster: r.roster,
  startsAt: new Date(r.starts_at),
  endsAt: new Date(r.ends_at),
});

/** Current week, or a specific one by id. */
export async function getWeek(id) {
  if (DEMO) return demoWeek();
  const s = await client();
  let q = s.from("weeks").select("*");
  q = id
    ? q.eq("id", id)
    : q.lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(1);
  const { data, error } = await q;
  if (error) throw error;
  return data?.length ? mapWeek(data[0]) : null;
}

export function weekState(week) {
  const now = Date.now();
  if (now < week.startsAt.getTime()) return "upcoming";
  if (now >= week.endsAt.getTime()) return "closed";
  return "open";
}

/* ---------- ballots ---------- */

export async function getMyBallot(week) {
  const me = await getSession();
  if (!me) return null;
  if (DEMO) return ls.get("gvs_demo_ballots", {})[`${week.id}:${me.id}`] ?? null;
  const s = await client();
  const { data, error } = await s
    .from("ballots")
    .select("picks")
    .eq("week_id", week.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (error) throw error;
  return data?.picks ?? null;
}

export async function submitBallot(week, picks) {
  const me = await getSession();
  if (!me) throw new Error("Log in to save your top 10.");
  if (picks.length !== 10 || new Set(picks).size !== 10) {
    throw new Error("Choose exactly 10 different characters.");
  }
  if (DEMO) {
    const all = ls.get("gvs_demo_ballots", {});
    all[`${week.id}:${me.id}`] = picks;
    ls.set("gvs_demo_ballots", all);
    return;
  }
  const s = await client();
  const { error } = await s
    .from("ballots")
    .upsert({ user_id: me.id, week_id: week.id, picks }, { onConflict: "user_id,week_id" });
  if (error) throw error;
}

/* ---------- results (locked until the week ends) ---------- */

export async function getBallotCount(week) {
  if (DEMO) {
    return Object.keys(ls.get("gvs_demo_ballots", {})).filter((k) => k.startsWith(`${week.id}:`)).length;
  }
  const s = await client();
  const { data, error } = await s.rpc("ballot_count", { p_week: week.id });
  if (error) throw error;
  return Number(data);
}

/** Returns [{ character_id, points, voters }] sorted best first (max 50). */
export async function getResults(week) {
  if (DEMO) {
    const totals = new Map();
    for (const [key, picks] of Object.entries(ls.get("gvs_demo_ballots", {}))) {
      if (!key.startsWith(`${week.id}:`)) continue;
      picks.forEach((id, i) => {
        const t = totals.get(id) ?? { character_id: id, points: 0, voters: 0 };
        t.points += pointsForRank(i + 1);
        t.voters += 1;
        totals.set(id, t);
      });
    }
    return [...totals.values()].sort((a, b) => b.points - a.points || b.voters - a.voters).slice(0, 50);
  }
  const s = await client();
  const { data, error } = await s.rpc("get_results", { p_week: week.id });
  if (error) throw error;
  return data.map((r) => ({ ...r, points: Number(r.points), voters: Number(r.voters) }));
}
