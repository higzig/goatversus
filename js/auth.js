import { signIn, signUp } from "./api.js";
import { mountChrome, $ } from "./common.js";

const session = await mountChrome("");

// Only allow redirects to pages on this site, e.g. "vote.html".
const requested = new URLSearchParams(location.search).get("next") || "";
const next = /^[a-z0-9-]+\.html(\?[\w=&-]*)?$/i.test(requested) ? requested : "vote.html";

if (session) location.replace(next);

let mode = "login";
const form = $("#auth-form");
const msg = $("#auth-msg");

function setMode(m) {
  mode = m;
  $("#tab-login").setAttribute("aria-selected", String(m === "login"));
  $("#tab-register").setAttribute("aria-selected", String(m === "register"));
  $("#auth-submit").textContent = m === "login" ? "Log in" : "Create account";
  $("#password").autocomplete = m === "login" ? "current-password" : "new-password";
  msg.textContent = "";
  msg.className = "msg";
}

$("#tab-login").addEventListener("click", () => setMode("login"));
$("#tab-register").addEventListener("click", () => setMode("register"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const btn = $("#auth-submit");
  btn.disabled = true;
  msg.className = "msg";
  msg.textContent = "";
  try {
    if (mode === "register") {
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      const { needsConfirm } = await signUp(email, password);
      if (needsConfirm) {
        msg.className = "msg ok";
        msg.textContent = "Account created. Check your email and confirm your address, then log in.";
        setMode("login");
        msg.className = "msg ok";
        msg.textContent = "Account created. Check your email and confirm your address, then log in.";
        return;
      }
    } else {
      await signIn(email, password);
    }
    location.href = next;
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = err.message || "Something went wrong. Try again.";
  } finally {
    btn.disabled = false;
  }
});
