-- drizzle/0011_roommate.sql
-- Roommate matching feature

-- Roommate profile (one per user, optional)
CREATE TABLE IF NOT EXISTS roommate_profiles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE,

  -- What they're looking for
  has_room        BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = has room, FALSE = needs room

  -- Lifestyle signals (used for compatibility score)
  sleep_schedule  ENUM('early','normal','late','very_late') NOT NULL DEFAULT 'normal',
  cleanliness     ENUM('spotless','clean','relaxed','lived_in') NOT NULL DEFAULT 'clean',
  noise_level     ENUM('silent','background','music','loud') NOT NULL DEFAULT 'background',
  guests_policy   ENUM('rarely','occasional','regular','partner_stays') NOT NULL DEFAULT 'occasional',

  -- Practicalities
  budget_min      INT NOT NULL DEFAULT 300,   -- EUR/month
  budget_max      INT NOT NULL DEFAULT 600,
  neighbourhoods  JSON,                        -- array of neighbourhood slugs
  pets_ok         BOOLEAN NOT NULL DEFAULT TRUE,
  smoking_ok      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Free-text
  bio             TEXT,                        -- "PhD student, quiet nights…"

  created_at      DATETIME NOT NULL DEFAULT NOW(),
  updated_at      DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),

  CONSTRAINT fk_roommate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_roommate_user (user_id),
  INDEX idx_roommate_has_room (has_room),
  INDEX idx_roommate_budget (budget_min, budget_max)
);

-- Add roommate intent flag to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intent_roommate BOOLEAN NOT NULL DEFAULT FALSE;
