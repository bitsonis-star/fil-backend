ALTER TABLE `users`
  ADD COLUMN `latitude` double,
  ADD COLUMN `longitude` double,
  ADD COLUMN `maxDistanceKm` int DEFAULT 50;
