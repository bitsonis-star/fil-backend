-- Add identity & onboarding columns to users
ALTER TABLE `users`
  ADD COLUMN `gender` ENUM('man','woman','non_binary','other'),
  ADD COLUMN `interestedIn` text,
  ADD COLUMN `dateOfBirth` timestamp NULL,
  ADD COLUMN `bio` text,
  ADD COLUMN `onboardingComplete` tinyint NOT NULL DEFAULT 0;

-- Connection requests table
CREATE TABLE `connectionRequests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `senderId` int NOT NULL,
  `receiverId` int NOT NULL,
  `status` ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `pokeCount` tinyint NOT NULL DEFAULT 0,
  `lastPokedAt` timestamp NULL,
  `respondedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiverId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_connection` (`senderId`, `receiverId`)
);
