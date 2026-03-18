ALTER TABLE `users`
  ADD COLUMN `socialX`           varchar(100),
  ADD COLUMN `socialInstagram`   varchar(100),
  ADD COLUMN `socialLinkedin`    varchar(200),
  ADD COLUMN `socialFacebook`    varchar(200),
  ADD COLUMN `socialVisibility`  ENUM('connected_only','everyone') NOT NULL DEFAULT 'connected_only';
