# Session Lost on Back-Navigation — Investigation Report

## Summary Answer

**The session IS persisted in Supabase the moment the user clicks "Start Session."** It is not lost. The root cause is that the **homepage (`/`) never queries Supabase for existing sessions and provides no "resume" entry point** — it only offers "Start New Session" and "Join with Code." When the user navigates back to `/`, the session still exists in the database but is invisible because the UI has no awareness of it. A secondary compounding issue is that `BackButton.tsx` uses `router.back()` through browser history, which means a full back-navigation chain from the session page eventually lands the user on `/` with no path back to their in-progress session (unless they know and paste the session UUID).

---

## Evidence

### 1. Session creation is fully atomic and immediate

**File: `src/app/session/new/page.tsx` — `handleStart()` function**

When the user clicks "Start Session" (step 2), `handleStart()` runs a complete multi-step write to Supabase **before** calling `router.push`:

```
1. INSERT into sessions   → produces session.id (status: 'active')
2. INSERT into courts     → references session.id
3. INSERT into players    → one per player, references session.id
4. INSERT into queue_entries → one per player (status: 'waiting' or 'playing')
5. UPDATE courts status   → 'occupied' for filled courts
router.push(`/session/${session.id}`)
```

All writes use `await` and `throw` on error. If any step throws, `router.push` is never reached and an error is displayed. The session row is durably written to Supabase with `status: 'active'` before navigation occurs.

**Conclusion:** The session is never "not saved." It is fully persisted from the moment `router.push` fires.

### 2. Session schema — no ephemeral/draft status exists

**File: `supabase-schema.sql`**

```sql
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  ...
  status text not null default 'active' check (status in ('active', 'ended'))
);
```

There is no `draft`, `pending`, or `temporary` status. Sessions are born `active` and stay `active` until explicitly ended. There is no TTL or expiry mechanism. RLS permits public reads (`create policy "Public read sessions" on sessions for select using (true)`), so auth is not a barrier to finding the session later.

### 3. Homepage makes zero Supabase queries

**File: `src/app/page.tsx`**

The homepage is a fully static React Server Component. It contains:
- No `useEffect`, no `useState`, no data fetching
- No Supabase client call
- No display of "your active sessions" or "continue session"
- Two navigation links: `/session/new` (start fresh) and `/session/join` (enter a code)

**Conclusion:** The session is in Supabase but the homepage has no code to surface it. It is invisible by design omission — there is no "resume" feature.

### 4. No client-side session ID persistence

**grep result across all `.tsx` files:** Only `localStorage` usage found is for theme (`qp-theme`) in `ThemeToggle.tsx` and `layout.tsx`. Zero uses of `localStorage`, `sessionStorage`, or cookies for session IDs.

**Conclusion:** Once the user navigates away from `/session/<id>`, the session UUID is gone from their browser context. There is no mechanism to recover "what session was I in."

### 5. BackButton behaviour — adds to the problem

**File: `src/components/BackButton.tsx`**

```ts
const handleClick = () => {
  if (window.history.length > 1) {
    router.back();   // always true in practice
  } else if (fallback) {
    router.push(fallback);
  }
};
```

`window.history.length` is virtually always > 1 (the browser starts with a history entry), so `router.back()` is always called. On the **session hub** (`/session/[id]/page.tsx`), `BackButton` is rendered with `fallback="/" label="Home"`. But because `router.back()` is used, pressing it goes to the previous history entry — which is `/session/new` — not directly to `/`. The user then presses back again on `/session/new`, landing at `/`.

At that point they are on the homepage with no visible reference to their session. The session UUID is not in the URL, not in localStorage, and not displayed anywhere on `/`.

**Note:** The `session/new` page uses its own inline back button (`router.push("/")` for step 1, `setStep(1)` for step 2), so BackButton's fallback is not in play there. But the navigation chain is still: `session/[id]` → browser back → `session/new` → browser back → `/`.

### 6. RLS — not a barrier for guest sessions

**File: `supabase-schema.sql`**

All tables have `Public read` and `Public insert/update` policies using `with check (true)`. No authentication is required to read sessions. A session created without login is fully accessible by UUID by any client.

**Conclusion:** RLS is not causing the session to disappear. If the user visits `/session/<uuid>` directly, the session loads correctly from the database.

### 7. Supabase inserts — no silent failure risk

All inserts in `handleStart()` use `throw` on error:
```ts
const { data: session, error: se } = await supabase.from("sessions").insert(...).select().single();
if (se) throw se;
```
The `setLoading(false)` in the `finally` block and the `setError(...)` in the `catch` block ensure failures surface to the user. No fire-and-forget patterns exist in the creation flow.

### 8. Session sub-pages — all use URL-based session ID

All session sub-pages (`/session/[id]`, `/session/[id]/queue`, `/session/[id]/checkin`, `/session/[id]/leaderboard`) derive the session ID from `useParams().id`. They are stateless between page loads — they re-fetch from Supabase on mount. This is correct behaviour and is not the problem; the problem is getting back to those pages after leaving.

---

## Root Cause Diagnosis

**The session is not lost — it is orphaned in the UI.** The session exists in Supabase and is fully accessible, but the homepage provides no mechanism for the user to discover or re-enter their active session after navigation. There is no session ID persistence client-side, and the homepage makes no Supabase queries. The combination means: the moment the user's browser URL is no longer `/session/<id>/...`, the session becomes unreachable without knowing the exact UUID.

Secondary issue: `BackButton` uses `router.back()` unconditionally, so pressing "Home" on the session hub doesn't go directly to `/` — it goes to the previous history entry (`/session/new`), making the user press back twice and feel more disoriented.

---

## Ranked Fix Proposals

### Fix 1 — Persist the session ID in `localStorage` (simplest, high impact)
**Effort:** Low  
**Effect:** Immediate "resume" capability

In `handleStart()` in `session/new/page.tsx`, after the session is created and before `router.push`, store the session ID:
```ts
localStorage.setItem("qp-last-session", session.id);
```
On the homepage (`page.tsx`), convert it to a Client Component, read `localStorage` on mount, query Supabase to confirm the session is still `active`, and show a "Continue Session →" card above the CTAs if one exists. Clear `localStorage` when a session ends (status set to `ended`).

**Why first:** Zero schema changes, zero API changes, the session is already in Supabase. This is purely a UI-layer addition. The "Continue Session" card can be a soft prompt — user ignores it and starts fresh if they want.

### Fix 2 — Fix BackButton to navigate directly to `/` from the session hub
**Effort:** Very low  
**Effect:** Eliminates confusing double-back UX

In `/session/[id]/page.tsx`, replace `<BackButton fallback="/" label="Home" />` with a direct `router.push("/")` button (or pass a `href="/"` prop) instead of using `router.back()`. The user should be able to get home in one tap, not two. This doesn't fix the "lost session" problem but removes the confusion that makes it feel lost.

Alternatively, update `BackButton.tsx` to accept a `href` prop that bypasses `router.back()` entirely and uses `router.push(href)` — making it an explicit "go to home" rather than a history traversal.

### Fix 3 — Show active sessions list on homepage (most complete)
**Effort:** Medium  
**Effect:** Fully solves the problem even without localStorage

Convert `src/app/page.tsx` to a Server Component that queries Supabase for sessions `where status = 'active'` created in the last N hours. Display them as a card list above the main CTAs. Since there is no auth, this would show all recent public sessions — acceptable for a guest-mode app, and practical for a single-device/single-operator use case.

This is complementary to Fix 1; together they cover both "operator returning after navigation" and "spectator/player joining on a different device."

### Fix 4 — Store the session ID in a cookie or URL (alternative to Fix 1)
**Effort:** Low-medium  
**Effect:** More persistent than localStorage (survives browser restart)

Use a `Set-Cookie` response after session creation, or encode the session ID in a query parameter on the homepage redirect (e.g., redirect to `/?resume=<id>` instead of `/`). A cookie approach would let a server component on `/` query Supabase for the session without any client-side JS.

### Fix 5 — Add an explicit "End Session" button that clears state
**Effort:** Low (orthogonal fix)  
**Effect:** Prevents confusion when intentionally leaving

Users may not realise the session persists. Adding a clearly labelled "End Session" button on the session hub that sets `status = 'ended'` and clears `localStorage` makes the session lifecycle explicit. This doesn't fix recovery but prevents the scenario where a user creates a new session thinking the old one was gone, only to have two "active" sessions in the database.

---

## Conclusions

| Question | Answer |
|---|---|
| Is the session saved to Supabase? | **Yes, immediately and atomically** before navigation fires |
| What status does it get? | `active` — stays that way indefinitely unless explicitly ended |
| Does the homepage try to resume sessions? | **No** — it is a static component with no data fetching |
| Is session ID stored client-side? | **No** — only theme preference is stored in localStorage |
| Is RLS blocking access? | **No** — all policies are fully public |
| What does BackButton do? | Uses `router.back()` (goes to previous history entry, not necessarily `/`) |
| Are Supabase inserts reliable? | Yes — all errors are thrown and caught, no silent failures |
| Root cause? | **The session exists in Supabase but the UI has no path back to it after navigation away from `/session/[id]`** |

**Recommended immediate action:** Implement Fix 1 (localStorage persistence + "Continue Session" card on homepage) combined with Fix 2 (direct navigation home from session hub). Both are low-effort and fully self-contained.
