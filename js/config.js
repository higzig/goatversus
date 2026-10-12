// Paste your Supabase project details here (see README.md).
// The anon key is designed to be public: Row Level Security in
// supabase/schema.sql is what protects the data.
//
// Leave both blank to run in DEMO MODE (everything is stored in this
// browser only, which is handy for trying the site locally).
export const CONFIG = {
  SUPABASE_URL: "https://zkgkglnzzenqbisnqhvl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_L2zPUNSik6bGt9VPkBSvxg_tK4hdkLC",

  // Only used in demo mode. In live mode the week comes from the `weeks` table.
  DEMO_WEEK: {
    id: 1,
    category: "Best X-Men",
    description: "Rank your ten greatest X-Men from the comics.",
    roster: "xmen", // loads data/xmen.json
  },
};

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
