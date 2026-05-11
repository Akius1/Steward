-- ── AI Coach usage columns on profiles ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_messages_used  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_messages_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_messages_year  INTEGER DEFAULT 2024;

-- ── Debts table (for Debt Planner) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id     UUID REFERENCES households(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  balance          NUMERIC(15,2) NOT NULL DEFAULT 0,
  interest_rate    NUMERIC(6,2)  NOT NULL DEFAULT 0,  -- annual %
  minimum_payment  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debts" ON debts
  FOR ALL USING (auth.uid() = user_id);
