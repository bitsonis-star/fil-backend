-- drizzle/0010_calls.sql
-- Voice and video calls table
-- Stores call metadata only — Agora/Daily.co handles the actual media

CREATE TABLE IF NOT EXISTS calls (
  id            INT AUTO_INCREMENT PRIMARY KEY,

  -- Participants
  caller_id     INT NOT NULL,
  callee_id     INT NOT NULL,

  -- Call details
  call_type     ENUM('voice', 'video') NOT NULL DEFAULT 'voice',
  status        ENUM('ringing', 'active', 'ended', 'declined', 'missed', 'failed')
                NOT NULL DEFAULT 'ringing',

  -- Agora / Daily.co channel
  channel_name  VARCHAR(128) NOT NULL,

  -- Timing
  accepted_at   DATETIME NULL,         -- when callee picked up
  ended_at      DATETIME NULL,
  duration_sec  INT NULL,              -- populated on end

  created_at    DATETIME NOT NULL DEFAULT NOW(),
  updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),

  -- Foreign keys
  CONSTRAINT fk_calls_caller FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_calls_callee FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_calls_caller    (caller_id),
  INDEX idx_calls_callee    (callee_id),
  INDEX idx_calls_status    (status),
  INDEX idx_calls_created   (created_at)
);

-- Add isPremium to users if not already there (required for call gating)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_premium       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_since    DATETIME NULL,
  ADD COLUMN IF NOT EXISTS expo_push_token  VARCHAR(256) NULL;   -- for call push notifications
