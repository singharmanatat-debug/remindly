"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const cleanUsername = username.trim().toLowerCase();

      if (cleanUsername.length < 3) {
        setMessage("Username must be at least 3 characters.");
        setLoading(false);
        return;
      }

      // Check username availability
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingProfile) {
        setMessage("That username is already taken.");
        setLoading(false);
        return;
      }

      // Create account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      // If Supabase gives us a session immediately,
      // create the profile now.
      if (data.user && data.session) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            username: cleanUsername,
          });

        if (profileError) {
          setMessage(profileError.message);
          setLoading(false);
          return;
        }

        setMessage("Account created successfully!");
      } else {
        setMessage(
          "Account created! Check your email to confirm your account, then log in."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Logged in successfully!");

        setTimeout(() => {
          window.location.href = "/";
        }, 700);
      }
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">
            Remindly
          </h1>

          <p className="text-white/40 mt-2">
            Your reminders, everywhere.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-7 shadow-2xl">

          {/* Tabs */}
          <div className="grid grid-cols-2 bg-white/[0.05] rounded-2xl p-1 mb-7">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-xl py-3 text-sm ${
                mode === "login"
                  ? "bg-white/10 text-white"
                  : "text-white/40"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={`rounded-xl py-3 text-sm ${
                mode === "signup"
                  ? "bg-white/10 text-white"
                  : "text-white/40"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm text-white/50 mb-2">
                  Username
                </label>

                <input
                  type="text"
                  placeholder="yourusername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm text-white/50 mb-2">
                Email
              </label>

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-white/50 mb-2">
                Password
              </label>

              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
              />
            </div>

            {/* Message */}
            {message && (
              <div className="rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3 text-sm text-white/60">
                {message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-white text-black py-3.5 font-medium disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}