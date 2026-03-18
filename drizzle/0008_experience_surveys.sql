CREATE TABLE `surveyQuestions` (
  `id`           int AUTO_INCREMENT PRIMARY KEY,
  `category`     varchar(60) NOT NULL,
  `categoryIcon` varchar(10),
  `question`     text NOT NULL,
  `subtitle`     text,
  `options`      text NOT NULL,
  `isActive`     tinyint NOT NULL DEFAULT 1,
  `sortOrder`    int NOT NULL DEFAULT 0,
  `createdAt`    timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE `experienceResponses` (
  `id`                int AUTO_INCREMENT PRIMARY KEY,
  `userId`            int NOT NULL,
  `questionId`        int NOT NULL,
  `selectedOptionIds` text NOT NULL,
  `skipped`           tinyint NOT NULL DEFAULT 0,
  `answeredAt`        timestamp NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`userId`)     REFERENCES `users`(`id`)            ON DELETE CASCADE,
  FOREIGN KEY (`questionId`) REFERENCES `surveyQuestions`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_question` (`userId`, `questionId`)
);

-- Seed initial survey questions
INSERT INTO `surveyQuestions` (`category`, `categoryIcon`, `question`, `subtitle`, `options`, `sortOrder`) VALUES
('theatre', '🎭', 'Which of these have you seen recently?', 'Select all that apply — this helps us find people who share your taste', '[
  {"id":"cherry-orchard","icon":"🌹","label":"The Cherry Orchard","sublabel":"Chekhov · Almeida Theatre","externalUrl":"https://www.almeida.co.uk"},
  {"id":"hamilton","icon":"🎼","label":"Hamilton — West End","sublabel":"Musical · Victoria Palace","externalUrl":"https://hamiltonmusical.com/london"},
  {"id":"cabaret","icon":"🎪","label":"Cabaret — Kit Kat Club","sublabel":"Immersive · London","externalUrl":"https://www.kitkatclub.co.uk"},
  {"id":"hamlet","icon":"🎭","label":"Hamlet — National Theatre","sublabel":"Shakespeare · London","externalUrl":"https://www.nationaltheatre.org.uk"},
  {"id":"none","icon":"✨","label":"None of these","sublabel":"Show me others"}
]', 1),

('travel', '✈️', 'Which of these have you visited?', 'Select all — we find people who''ve shared the same experiences', '[
  {"id":"japan","icon":"🇯🇵","label":"Japan","sublabel":"Any region"},
  {"id":"portugal","icon":"🇵🇹","label":"Portugal","sublabel":"Lisbon, Porto, Alentejo"},
  {"id":"greece","icon":"🇬🇷","label":"Greek islands","sublabel":"Santorini, Mykonos, Hydra"},
  {"id":"italy","icon":"🇮🇹","label":"Italy","sublabel":"Rome, Florence, Amalfi"},
  {"id":"bucket","icon":"🏔️","label":"None yet — bucket list","sublabel":"Share where you dream of going"}
]', 2),

('music', '🎵', 'What kind of live music moves you?', 'Select everything that resonates', '[
  {"id":"jazz","icon":"🎷","label":"Jazz","sublabel":"Live clubs, intimate venues","externalUrl":"https://www.ronniescotts.co.uk"},
  {"id":"classical","icon":"🎻","label":"Classical & opera","sublabel":"Concerts, recitals"},
  {"id":"indie","icon":"🎸","label":"Indie & alternative","sublabel":"Small venues, gigs"},
  {"id":"electronic","icon":"🎛️","label":"Electronic & club","sublabel":"Festivals, nights out"},
  {"id":"folk","icon":"🪕","label":"Folk & acoustic","sublabel":"Intimate, storytelling"}
]', 3),

('happiness', '☀️', 'What fills you up most?', 'Be honest — this helps us find people with similar energy', '[
  {"id":"quiet","icon":"🤫","label":"Quiet evenings at home","sublabel":"Books, cooking, rest"},
  {"id":"social","icon":"🎉","label":"Being around people","sublabel":"Dinner parties, gatherings"},
  {"id":"nature","icon":"🌲","label":"Nature & outdoors","sublabel":"Hiking, parks, sea"},
  {"id":"creative","icon":"🎨","label":"Creative flow","sublabel":"Art, music, writing"},
  {"id":"movement","icon":"🏃","label":"Movement & sport","sublabel":"Running, gym, yoga"}
]', 4),

('food', '🍽️', 'What kind of food experiences do you love?', 'Select all that fit you', '[
  {"id":"farmtotable","icon":"🌿","label":"Farm-to-table","sublabel":"Seasonal, local, conscious"},
  {"id":"street","icon":"🌮","label":"Street food & markets","sublabel":"Spontaneous, authentic"},
  {"id":"finedining","icon":"🕯️","label":"Fine dining","sublabel":"Special occasions, tasting menus"},
  {"id":"cooking","icon":"👨‍🍳","label":"Cooking at home","sublabel":"Experimenting, hosting"},
  {"id":"world","icon":"🌍","label":"World cuisines","sublabel":"Exploring different cultures through food"}
]', 5),

('going-out', '🌆', 'Where do you prefer to spend your evenings?', 'Pick what feels like you', '[
  {"id":"bars","icon":"🍸","label":"Cocktail bars","sublabel":"Good drinks, good conversation"},
  {"id":"parks","icon":"🌳","label":"Parks & outdoors","sublabel":"Picnics, walks, sunsets"},
  {"id":"galleries","icon":"🖼️","label":"Galleries & exhibitions","sublabel":"Art, culture, openings"},
  {"id":"cafes","icon":"☕","label":"Cafés & bookshops","sublabel":"Slow, quiet, thoughtful"},
  {"id":"theatre","icon":"🎭","label":"Theatre & live shows","sublabel":"Performance, storytelling"},
  {"id":"home","icon":"🏠","label":"At home or a friend''s","sublabel":"Intimate, cosy, real"}
]', 6);
