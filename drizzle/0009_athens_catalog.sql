-- Events catalog — all scraped events from all Athens sources
CREATE TABLE `eventsCatalog` (
  `id`           int AUTO_INCREMENT PRIMARY KEY,
  `city`         varchar(60) NOT NULL DEFAULT 'athens',
  `category`     varchar(40) NOT NULL,  -- theatre, music, cinema, festival, art, sports, other
  `title`        varchar(255) NOT NULL,
  `subtitle`     varchar(255),          -- e.g. "by Chekhov" or "at Odeon"
  `venue`        varchar(255) NOT NULL,
  `neighbourhood` varchar(100),
  `dateStart`    date,
  `dateEnd`      date,
  `ticketUrl`    text,
  `sourceUrl`    text NOT NULL,
  `icon`         varchar(10) DEFAULT '🎟️',
  `externalId`   varchar(255) UNIQUE,   -- prevents duplicate inserts
  `isActive`     tinyint NOT NULL DEFAULT 1,
  `scrapedAt`    timestamp NOT NULL DEFAULT NOW(),
  INDEX `idx_city_category` (`city`, `category`),
  INDEX `idx_date` (`dateStart`)
);

-- City venues — static venue data from Google Places
CREATE TABLE `cityVenues` (
  `id`           int AUTO_INCREMENT PRIMARY KEY,
  `city`         varchar(60) NOT NULL DEFAULT 'athens',
  `placeId`      varchar(255) UNIQUE NOT NULL, -- Google Place ID
  `name`         varchar(255) NOT NULL,
  `category`     varchar(60) NOT NULL,    -- cinema, restaurant, bar, museum, gallery, cafe, outdoor, nightlife
  `icon`         varchar(10),
  `neighbourhood` varchar(100),
  `lat`          varchar(30),
  `lng`          varchar(30),
  `rating`       varchar(10),             -- stored as integer * 10 (e.g. 45 = 4.5 stars)
  `priceLevel`   varchar(5),             -- 1-4 (Google's price_level)
  `googleMapsUrl` text,
  `website`      text,
  `refreshedAt`  timestamp NOT NULL DEFAULT NOW(),
  INDEX `idx_city_cat` (`city`, `category`)
);
