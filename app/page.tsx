"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Reminder = {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  completed: boolean;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  sender?: Profile;
  receiver?: Profile;
};

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
};

export default function Home() {
  const [checking, setChecking] = useState(true);

const [userId, setUserId] = useState("");
const [username, setUsername] = useState("");
const [needsProfile, setNeedsProfile] = useState(false);
const [profileUsername, setProfileUsername] = useState("");
const [savingProfile, setSavingProfile] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "reminders" | "friends"
  >("reminders");

  // Reminders
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loadingReminder, setLoadingReminder] = useState(false);

  // Friends
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<
    FriendRequest[]
  >([]);

  const [outgoingRequests, setOutgoingRequests] = useState<
    FriendRequest[]
  >([]);

  const [friends, setFriends] = useState<Profile[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      window.location.href = "/login";
      return;
    }

    const id = data.session.user.id;

    setUserId(id);

    await loadProfile(id);
    await loadReminders(id);
    await loadFriends(id);

    setChecking(false);
  }

  async function loadProfile(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    setUsername(data.username);
  }

  async function createProfile(e: React.FormEvent) {
  e.preventDefault();

  const cleanUsername = profileUsername.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    alert("Username must be at least 3 characters.");
    return;
  }

  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    alert("Username can only contain letters, numbers and underscores.");
    return;
  }

  setSavingProfile(true);

  const { error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: cleanUsername,
    });

  if (error) {
    if (error.code === "23505") {
      alert("That username is already taken.");
    } else {
      alert(error.message);
    }

    setSavingProfile(false);
    return;
  }

  setUsername(cleanUsername);
  setNeedsProfile(false);
  setSavingProfile(false);

  await loadReminders(userId);
  await loadFriends(userId);
}
}

  // =========================
  // REMINDERS
  // =========================

  async function loadReminders(id: string) {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", id)
      .order("remind_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setReminders(data || []);
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !remindAt) return;

    setLoadingReminder(true);

    const { data, error } = await supabase
      .from("reminders")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        remind_at: new Date(remindAt).toISOString(),
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      setLoadingReminder(false);
      return;
    }

    setReminders((current) =>
      [...current, data].sort(
        (a, b) =>
          new Date(a.remind_at).getTime() -
          new Date(b.remind_at).getTime()
      )
    );

    setTitle("");
    setDescription("");
    setRemindAt("");
    setShowAdd(false);

    setLoadingReminder(false);
  }

  async function toggleReminder(
    id: string,
    completed: boolean
  ) {
    const { error } = await supabase
      .from("reminders")
      .update({
        completed: !completed,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === id
          ? {
              ...reminder,
              completed: !completed,
            }
          : reminder
      )
    );
  }

  async function deleteReminder(id: string) {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    setReminders((current) =>
      current.filter((reminder) => reminder.id !== id)
    );
  }

  // =========================
  // FRIENDS
  // =========================

  async function loadFriends(id: string) {
    const { data: requests, error: requestError } =
      await supabase
        .from("friend_requests")
        .select("*")
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order("created_at", {
          ascending: false,
        });

    if (requestError) {
      console.error(requestError);
    }

    const allRequests = requests || [];

    const incoming = allRequests.filter(
      (request) =>
        request.receiver_id === id &&
        request.status === "pending"
    );

    const outgoing = allRequests.filter(
      (request) =>
        request.sender_id === id &&
        request.status === "pending"
    );

    // Load profiles for requests
    const requestUserIds = [
      ...incoming.map((r) => r.sender_id),
      ...outgoing.map((r) => r.receiver_id),
    ];

    let requestProfiles: Profile[] = [];

    if (requestUserIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", requestUserIds);

      requestProfiles = data || [];
    }

    const incomingWithProfiles = incoming.map((request) => ({
      ...request,
      sender: requestProfiles.find(
        (profile) => profile.id === request.sender_id
      ),
    }));

    const outgoingWithProfiles = outgoing.map((request) => ({
      ...request,
      receiver: requestProfiles.find(
        (profile) => profile.id === request.receiver_id
      ),
    }));

    setIncomingRequests(incomingWithProfiles);
    setOutgoingRequests(outgoingWithProfiles);

    // Load friendships
    const { data: friendshipData, error: friendshipError } =
      await supabase
        .from("friendships")
        .select("*")
        .or(`user_id.eq.${id},friend_id.eq.${id}`);

    if (friendshipError) {
      console.error(friendshipError);
      return;
    }

    const friendshipRows: Friendship[] =
      friendshipData || [];

    const friendIds = friendshipRows.map((friendship) =>
      friendship.user_id === id
        ? friendship.friend_id
        : friendship.user_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    const { data: friendProfiles, error: friendError } =
      await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", friendIds);

    if (friendError) {
      console.error(friendError);
      return;
    }

    setFriends(friendProfiles || []);
  }

  async function searchUser() {
    const cleanUsername = searchUsername
      .trim()
      .toLowerCase();

    if (!cleanUsername) return;

    setSearching(true);
    setSearchResult(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert(error.message);
    } else if (!data) {
      alert("No user found with that username.");
    } else if (data.id === userId) {
      alert("You cannot add yourself.");
    } else {
      setSearchResult(data);
    }

    setSearching(false);
  }

  async function sendFriendRequest(friendId: string) {
    const alreadyFriend = friends.some(
      (friend) => friend.id === friendId
    );

    if (alreadyFriend) {
      alert("You are already friends.");
      return;
    }

    const existingIncoming = incomingRequests.some(
      (request) => request.sender_id === friendId
    );

    if (existingIncoming) {
      alert("This user has already sent you a request.");
      return;
    }

    const existingOutgoing = outgoingRequests.some(
      (request) => request.receiver_id === friendId
    );

    if (existingOutgoing) {
      alert("Friend request already sent.");
      return;
    }

    const { error } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: userId,
        receiver_id: friendId,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Friend request sent!");

    setSearchResult(null);
    setSearchUsername("");

    await loadFriends(userId);
  }

  async function acceptRequest(
  request: FriendRequest
) {
  const { error: updateError } = await supabase
    .from("friend_requests")
    .update({
      status: "accepted",
    })
    .eq("id", request.id)
    .eq("receiver_id", userId);

  if (updateError) {
    alert(updateError.message);
    return;
  }

  // One friendship row is enough.
  // The RLS policy allows the current user to create
  // a row where they are user_id.
  const { error: friendshipError } = await supabase
    .from("friendships")
    .insert({
      user_id: userId,
      friend_id: request.sender_id,
    });

  if (friendshipError) {
    alert(friendshipError.message);
    return;
  }

  await loadFriends(userId);
}
async function createProfile(e: React.FormEvent) {
  e.preventDefault();

  const cleanUsername = profileUsername.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    alert("Username must be at least 3 characters.");
    return;
  }

  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    alert("Username can only contain letters, numbers and underscores.");
    return;
  }

  setSavingProfile(true);

  const { error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: cleanUsername,
    });

  if (error) {
    if (error.code === "23505") {
      alert("That username is already taken.");
    } else {
      alert(error.message);
    }

    setSavingProfile(false);
    return;
  }

  setUsername(cleanUsername);
  setNeedsProfile(false);
  setSavingProfile(false);

  await loadReminders(userId);
  await loadFriends(userId);
}

  async function rejectRequest(
    requestId: string
  ) {
    const { error } = await supabase
      .from("friend_requests")
      .update({
        status: "rejected",
      })
      .eq("id", requestId)
      .eq("receiver_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFriends(userId);
  }

  async function removeFriend(friendId: string) {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      );

    if (error) {
      alert(error.message);
      return;
    }

    await loadFriends(userId);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  

  if (checking) {
    return (
      <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-white/40 animate-pulse">
          Loading Remindly...
        </div>
      </main>
    );
  }
  if (needsProfile) {
  return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">
            Remindly
          </h1>

          <p className="text-white/40 mt-2">
            One last step — choose your username.
          </p>
        </div>

        <form
          onSubmit={createProfile}
          className="rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-7 shadow-2xl"
        >
          <label className="block text-sm text-white/50 mb-2">
            Username
          </label>

          <input
            type="text"
            placeholder="yourusername"
            value={profileUsername}
            onChange={(e) =>
              setProfileUsername(e.target.value.toLowerCase())
            }
            required
            minLength={3}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
          />

          <p className="text-white/25 text-xs mt-3">
            Letters, numbers and underscores only.
          </p>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full mt-5 rounded-2xl bg-white text-black py-3.5 font-medium disabled:opacity-50"
          >
            {savingProfile
              ? "Creating profile..."
              : "Continue"}
          </button>
        </form>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="w-full mt-4 text-sm text-white/30 hover:text-white/60"
        >
          Log out
        </button>

      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      <div className="max-w-6xl mx-auto px-5 py-6 md:px-8">

        {/* HEADER */}

        <header className="flex items-center justify-between">

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Remindly
            </h1>

            <p className="text-white/35 text-sm mt-1">
              Welcome back
              {username ? `, @${username}` : ""} 👋
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/60 hover:bg-white/10"
          >
            Log out
          </button>

        </header>


        {/* TABS */}

        <div className="flex gap-2 mt-8">

          <button
            onClick={() => setActiveTab("reminders")}
            className={`rounded-2xl px-5 py-3 text-sm ${
              activeTab === "reminders"
                ? "bg-white text-black font-medium"
                : "border border-white/10 bg-white/[0.05] text-white/50"
            }`}
          >
            📝 Reminders
          </button>

          <button
            onClick={() => setActiveTab("friends")}
            className={`rounded-2xl px-5 py-3 text-sm ${
              activeTab === "friends"
                ? "bg-white text-black font-medium"
                : "border border-white/10 bg-white/[0.05] text-white/50"
            }`}
          >
            👥 Friends
          </button>

        </div>


        {/* ========================= */}
        {/* REMINDERS */}
        {/* ========================= */}

        {activeTab === "reminders" && (

          <section className="mt-8">

            <div className="flex items-center justify-between mb-5">

              <div>
                <h2 className="text-xl font-medium">
                  Your reminders
                </h2>

                <p className="text-white/35 text-sm mt-1">
                  {reminders.length} reminder
                  {reminders.length !== 1 ? "s" : ""}
                </p>
              </div>

              <button
                onClick={() => setShowAdd(!showAdd)}
                className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-medium"
              >
                + Add reminder
              </button>

            </div>


            {/* ADD REMINDER */}

            {showAdd && (
              <form
                onSubmit={addReminder}
                className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-6"
              >

                <h3 className="text-lg font-medium mb-5">
                  New reminder
                </h3>

                <div className="space-y-4">

                  <input
                    type="text"
                    placeholder="What do you need to remember?"
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
                  />

                  <textarea
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
                  />

                  <input
                    type="datetime-local"
                    value={remindAt}
                    onChange={(e) =>
                      setRemindAt(e.target.value)
                    }
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none text-white"
                  />

                  <div className="flex gap-3">

                    <button
                      type="submit"
                      disabled={loadingReminder}
                      className="rounded-2xl bg-white text-black px-5 py-3 font-medium disabled:opacity-50"
                    >
                      {loadingReminder
                        ? "Saving..."
                        : "Save reminder"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowAdd(false)
                      }
                      className="rounded-2xl border border-white/10 px-5 py-3 text-white/50"
                    >
                      Cancel
                    </button>

                  </div>

                </div>

              </form>
            )}


            {/* REMINDER LIST */}

            {reminders.length === 0 ? (

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center">

                <div className="text-4xl mb-4">
                  📝
                </div>

                <h3 className="text-lg">
                  No reminders yet
                </h3>

                <p className="text-white/35 text-sm mt-2">
                  Add your first reminder.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {reminders.map((reminder) => (

                  <div
                    key={reminder.id}
                    className={`rounded-[24px] border border-white/10 bg-white/[0.05] backdrop-blur-xl p-5 ${
                      reminder.completed
                        ? "opacity-45"
                        : ""
                    }`}
                  >

                    <div className="flex items-start gap-4">

                      <button
                        onClick={() =>
                          toggleReminder(
                            reminder.id,
                            reminder.completed
                          )
                        }
                        className={`mt-1 h-6 w-6 shrink-0 rounded-lg border ${
                          reminder.completed
                            ? "bg-white border-white"
                            : "border-white/20"
                        }`}
                      >
                        {reminder.completed && (
                          <span className="text-black text-sm">
                            ✓
                          </span>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">

                        <h3
                          className={`font-medium ${
                            reminder.completed
                              ? "line-through"
                              : ""
                          }`}
                        >
                          {reminder.title}
                        </h3>

                        {reminder.description && (
                          <p className="text-white/40 text-sm mt-1">
                            {reminder.description}
                          </p>
                        )}

                        <p className="text-white/30 text-xs mt-3">
                          🕒 {formatDate(reminder.remind_at)}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          deleteReminder(reminder.id)
                        }
                        className="text-white/25 hover:text-white/70 text-sm"
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </section>
        )}


        {/* ========================= */}
        {/* FRIENDS */}
        {/* ========================= */}

        {activeTab === "friends" && (

          <section className="mt-8">

            <div className="mb-8">

              <h2 className="text-xl font-medium">
                Friends
              </h2>

              <p className="text-white/35 text-sm mt-1">
                Connect with people on Remindly.
              </p>

            </div>


            {/* SEARCH */}

            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-6">

              <h3 className="font-medium mb-4">
                Find someone
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">

                <input
                  type="text"
                  placeholder="Enter username..."
                  value={searchUsername}
                  onChange={(e) =>
                    setSearchUsername(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchUser();
                    }
                  }}
                  className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none placeholder:text-white/20 focus:border-white/25"
                />

                <button
                  onClick={searchUser}
                  disabled={searching}
                  className="rounded-2xl bg-white text-black px-6 py-3.5 font-medium disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>

              </div>


              {/* SEARCH RESULT */}

              {searchResult && (

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between">

                  <div>

                    <p className="font-medium">
                      {searchResult.display_name ||
                        `@${searchResult.username}`}
                    </p>

                    <p className="text-white/35 text-sm">
                      @{searchResult.username}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      sendFriendRequest(searchResult.id)
                    }
                    className="rounded-xl bg-white text-black px-4 py-2 text-sm font-medium"
                  >
                    + Add
                  </button>

                </div>

              )}

            </div>


            {/* INCOMING REQUESTS */}

            {incomingRequests.length > 0 && (

              <div className="mt-6">

                <h3 className="font-medium mb-3">
                  Friend requests
                </h3>

                <div className="space-y-3">

                  {incomingRequests.map((request) => (

                    <div
                      key={request.id}
                      className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5"
                    >

                      <div className="flex items-center justify-between gap-4">

                        <div>

                          <p className="font-medium">
                            {request.sender?.display_name ||
                              `@${request.sender?.username}`}
                          </p>

                          <p className="text-white/35 text-sm">
                            @{request.sender?.username}
                          </p>

                        </div>

                        <div className="flex gap-2">

                          <button
                            onClick={() =>
                              acceptRequest(request)
                            }
                            className="rounded-xl bg-white text-black px-4 py-2 text-sm font-medium"
                          >
                            Accept
                          </button>

                          <button
                            onClick={() =>
                              rejectRequest(request.id)
                            }
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50"
                          >
                            Reject
                          </button>

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            )}


            {/* OUTGOING */}

            {outgoingRequests.length > 0 && (

              <div className="mt-6">

                <h3 className="font-medium mb-3">
                  Sent requests
                </h3>

                <div className="space-y-3">

                  {outgoingRequests.map((request) => (

                    <div
                      key={request.id}
                      className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4"
                    >

                      <p className="font-medium">
                        @{request.receiver?.username}
                      </p>

                      <p className="text-white/30 text-sm mt-1">
                        Request pending
                      </p>

                    </div>

                  ))}

                </div>

              </div>

            )}


            {/* FRIENDS LIST */}

            <div className="mt-8">

              <h3 className="font-medium mb-3">
                Your friends
              </h3>

              {friends.length === 0 ? (

                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">

                  <div className="text-3xl mb-3">
                    👥
                  </div>

                  <p className="text-white/50">
                    You don't have any friends yet.
                  </p>

                  <p className="text-white/25 text-sm mt-1">
                    Search for a username above to add someone.
                  </p>

                </div>

              ) : (

                <div className="space-y-3">

                  {friends.map((friend) => (

                    <div
                      key={friend.id}
                      className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5 flex items-center justify-between"
                    >

                      <div>

                        <p className="font-medium">
                          {friend.display_name ||
                            `@${friend.username}`}
                        </p>

                        <p className="text-white/35 text-sm">
                          @{friend.username}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          removeFriend(friend.id)
                        }
                        className="text-white/30 hover:text-white/70 text-sm"
                      >
                        Remove
                      </button>

                    </div>

                  ))}

                </div>

              )}

            </div>

          </section>

        )}

      </div>

    </main>
  );
}