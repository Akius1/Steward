# Steward

A personal finance app for people who get paid irregularly.

Most budgeting apps assume a salary lands on the same day every month. That assumption breaks for freelancers, contractors, small business owners and anyone with several income sources arriving at different times. Steward is built the other way round: you record income as it actually arrives, allocate it deliberately, and the app tracks whether your plan still holds.

Built with Expo and React Native, backed by Supabase, with an AI coach running on Anthropic's API.

## What it does

**Income first, not salary first.** You add income sources of any type, including custom ones, and record money as it comes in rather than assuming a fixed monthly figure.

**Deliberate allocation.** Income gets assigned to categories on arrival instead of being spent and reconciled later. There is a tax reserve feature specifically for self-employed users who need to hold money back before they think it is theirs.

**Financial health scorecard.** The report screen grades your position across several dimensions and gives a health tier rather than a single number, so it is clear which part is weak.

**Debt planner.** Track balances, plan payoff order, and see the effect of changing what you pay each month.

**AI coach.** A conversational coach that can see your actual numbers and answer questions about them. It runs server side as a Supabase Edge Function calling Claude, so the API key never reaches the device.

**Shared households.** Two people can share a budget through an invite flow, with row level security in Postgres deciding what each member can read and write.

**Practical details that matter in daily use.** 16 currencies, light and dark themes, biometric unlock, local notifications, and statement import.

## Stack

| Layer | Choice |
|---|---|
| App | Expo (SDK 54), React Native 0.81, React 19, TypeScript |
| Routing | Expo Router, file based |
| UI | Reanimated, Gesture Handler, Bottom Sheet, custom design system |
| Auth | Supabase Auth, with Google and Apple OAuth |
| Data | Supabase Postgres with row level security |
| Serverless | Supabase Edge Functions (Deno) |
| AI | Anthropic API, claude-3-haiku |
| Storage | Expo SecureStore for tokens, AsyncStorage for preferences |
| Builds | EAS |

## Architecture notes

**The AI key stays server side.** The coach calls a Supabase Edge Function, which holds the Anthropic key as a secret and talks to the API. A mobile bundle is not a safe place for a credential, so the device never sees it.

**Row level security does the authorisation, not the client.** Household sharing is enforced by RLS policies in Postgres rather than by conditionals in the app. Ordering matters here: `household_id` has to exist on a table before a policy can reference it, which is why the migrations are sequenced the way they are.

**Web compatibility is deliberate.** React Native Web is supported, which meant working around a few native only assumptions. Bottom sheet text inputs needed a web safe wrapper, and `TextInput.State.currentlyFocusedInput` needed a polyfill.

**Custom types without losing type safety at the edges.** Users can create their own income and transaction types, so the relevant fields widen to `string` while the known values stay documented in `types/database.ts`.

## Running it locally

Requires Node 20 or later, and the Expo CLI.

```bash
npm install
npx expo start
```

Create a `.env` file with your own Supabase project values:

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Apply the database schema from `supabase/schema.sql`, then the migrations in `supabase/migrations/` in filename order.

The AI coach needs its own secret set on the deployed function, not in `.env`:

```bash
supabase secrets set ANTHROPIC_API_KEY=your-key
supabase functions deploy ai-coach
```

## Layout

```
app/                  screens, Expo Router file based routes
  (auth)/             login and signup
  (tabs)/             dashboard, allocate, plan, report
  ai-coach.tsx        conversational coach
  debt-planner.tsx    payoff planning
  transactions.tsx    transaction history
components/           shared UI
contexts/             app level state
src/                  screen implementations and services
types/                TypeScript types, including generated database types
supabase/
  schema.sql          base schema
  migrations/         ordered migrations
  functions/ai-coach/ Edge Function calling Anthropic
utils/                helpers
```

## Status

Built and maintained solo. Version 1 is feature complete and running as a preview build. I use it for my own finances, which is the main reason the awkward parts got fixed.

## Licence

See [LICENSE](LICENSE).
