CREATE TABLE `pets` (
  `id`              int AUTO_INCREMENT PRIMARY KEY,
  `userId`          int NOT NULL,
  `name`            varchar(60) NOT NULL,
  `species`         ENUM('dog','cat','rabbit','bird','fish','reptile','other') NOT NULL,
  `breed`           varchar(100),
  `ageYears`        int,
  `personalityTags` text,
  `photoUrl`        varchar(512),
  `isMain`          tinyint NOT NULL DEFAULT 0,
  `createdAt`       timestamp NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `petPreferences` (
  `id`                     int AUTO_INCREMENT PRIMARY KEY,
  `userId`                 int NOT NULL UNIQUE,
  `partnerPetPreference`   ENUM('must_have','open_to','no_pets','no_preference') NOT NULL DEFAULT 'no_preference',
  `incompatibleWith`       text,
  `updatedAt`              timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
