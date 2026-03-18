-- Add city to users for event discovery
ALTER TABLE `users` ADD COLUMN `city` varchar(120);

-- Saved events table
CREATE TABLE `savedEvents` (
  `id`        int AUTO_INCREMENT PRIMARY KEY,
  `userId`    int NOT NULL,
  `eventData` text NOT NULL,
  `savedAt`   timestamp NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
