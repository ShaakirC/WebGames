/*
 * Word Budget word bank (offline, no internet needed).
 * Four categories, each a comma-separated list. Lines starting with # are comments.
 * Add words freely. Duplicates (ignoring case) are dropped, keeping the first one.
 * Words should be well known and fairly guessable from a few one-word clues.
 * Exposed as GameHub.assets['word-budget'].bank = { things: [...], people: [...], actions: [...], describe: [...] }.
 */
(function () {
  'use strict';

  const RAW = {
    // Everyday nouns: animals, food, objects, places-in-general, nature, jobs, sport, SA things.
    things: `
# Animals
elephant, giraffe, lion, tiger, zebra, hippo, rhino, cheetah, leopard, hyena, warthog, meerkat, baboon,
gorilla, chimpanzee, kangaroo, koala, panda, polar bear, penguin, camel, crocodile, snake, lizard,
chameleon, tortoise, frog, shark, whale, dolphin, octopus, jellyfish, starfish, seahorse, crab, lobster,
squirrel, rabbit, hedgehog, mouse, rat, hamster, bat, owl, eagle, parrot, flamingo, ostrich, peacock,
pigeon, chicken, duck, goose, turkey, cow, pig, sheep, goat, horse, donkey, llama, dog, cat, puppy,
kitten, butterfly, bee, spider, ant, mosquito, snail, worm, ladybird, wasp, scorpion, beetle, moth,
dinosaur, unicorn, dragon, mermaid, springbok, kudu, buffalo, wildebeest, vulture, woodpecker, swan,
seal, walrus, otter, beaver, fox, wolf, deer, moose, sloth, armadillo, skunk, raccoon, gecko,
# Food and drink
pizza, burger, sandwich, hot dog, pancake, waffle, toast, cereal, porridge, omelette, spaghetti,
lasagne, noodles, sushi, curry, rice, bread, cheese, butter, yoghurt, ice cream, chocolate, cookie,
cake, cupcake, doughnut, muffin, popcorn, chips, crisps, nachos, taco, salad, soup, steak, sausage,
meatball, fish fingers, chicken wings, banana, apple, orange, lemon, lime, grape, strawberry,
watermelon, pineapple, mango, peach, pear, cherry, coconut, avocado, kiwi, pomegranate, carrot,
potato, tomato, onion, garlic, broccoli, cabbage, lettuce, cucumber, pumpkin, mushroom, corn, peas,
chilli, pepper, salt, sugar, honey, jam, peanut butter, ketchup, mustard, mayonnaise, vinegar, egg,
milk, coffee, tea, juice, lemonade, milkshake, smoothie, water, soda, hot chocolate, candy floss,
lollipop, marshmallow, jelly, custard, pudding, pie, brownie, biscuit, croissant, bagel, pretzel,
biltong, boerewors, braai, bobotie, bunny chow, koeksister, melktert, vetkoek, chakalaka, pap,
rooibos, samoosa, rusks, droëwors, malva pudding, gatsby, potjiekos, sosatie,
# Around the house
chair, table, sofa, bed, pillow, blanket, mirror, window, door, curtain, carpet, lamp, candle, clock,
fridge, oven, microwave, kettle, toaster, blender, dishwasher, washing machine, vacuum cleaner,
iron, broom, mop, bucket, sponge, towel, soap, shampoo, toothbrush, toothpaste, comb, hairdryer,
bath, shower, toilet, sink, tap, fork, spoon, knife, plate, bowl, cup, mug, glass, bottle, jar,
teapot, frying pan, saucepan, ladder, hammer, screwdriver, nail, drill, saw, tape, glue, scissors,
stapler, paperclip, envelope, stamp, key, lock, wallet, purse, umbrella, backpack, suitcase, basket,
box, bin, rope, chain, magnet, battery, light bulb, plug, remote control, doorbell, staircase,
fireplace, chimney, roof, garage, garden, fence, gate, swimming pool, hose, lawnmower, wheelbarrow,
# Clothes and accessories
shirt, T-shirt, jeans, shorts, skirt, dress, jacket, coat, jersey, hoodie, scarf, gloves, hat, cap,
beanie, socks, shoes, sneakers, boots, slippers, sandals, flip-flops, pyjamas, tie, belt, watch,
ring, necklace, earrings, bracelet, sunglasses, glasses, crown, wig, uniform, costume, apron,
swimsuit, raincoat, handbag, button, zip, pocket, takkies,
# Tech and gadgets
phone, laptop, computer, tablet, keyboard, mouse pad, headphones, speaker, television, camera,
printer, charger, robot, drone, video game, joystick, satellite, rocket, calculator, microphone,
selfie, password, email, emoji, wifi, internet, website, app, hashtag, podcast, QR code,
# Transport
car, bus, taxi, train, aeroplane, helicopter, boat, ship, submarine, bicycle, motorbike, scooter,
skateboard, truck, tractor, ambulance, fire engine, police car, limousine, bakkie, minibus taxi,
hot-air balloon, sailboat, canoe, kayak, jet ski, spaceship, tram, cable car, roller coaster,
traffic light, petrol station, parking lot, highway, bridge, tunnel, airport,
# Places (general)
school, hospital, library, museum, zoo, farm, beach, park, playground, supermarket, bakery,
restaurant, café, cinema, theatre, stadium, gym, church, castle, palace, prison, bank, post office,
hotel, campsite, island, desert, jungle, forest, mountain, volcano, cave, waterfall, river, lake,
ocean, glacier, swamp, valley, cliff, canyon, city, village, lighthouse, windmill, factory, office,
classroom, kitchen, bedroom, bathroom, attic, basement, balcony, rooftop, circus, carnival, mall,
market, spaza shop, shebeen, township, stoep, veld, game reserve, vineyard,
# Nature and weather
sun, moon, star, planet, comet, rainbow, cloud, rain, snow, hail, thunder, lightning, wind,
tornado, hurricane, earthquake, flood, fog, ice, fire, smoke, sand, rock, diamond, gold, silver,
tree, flower, rose, sunflower, cactus, grass, leaf, seed, mushroom cloud, protea, palm tree,
shell, pebble, wave, tide, sunset, sunrise, eclipse, galaxy, black hole, asteroid, iceberg,
# Jobs and people (general)
doctor, nurse, teacher, firefighter, police officer, pilot, chef, waiter, farmer, builder,
plumber, electrician, mechanic, dentist, vet, lawyer, judge, scientist, astronaut, soldier,
sailor, pirate, ninja, cowboy, wizard, witch, ghost, vampire, zombie, alien, superhero, princess,
king, queen, clown, magician, artist, singer, dancer, actor, photographer, journalist, librarian,
hairdresser, barber, cashier, postman, lifeguard, referee, coach, DJ, detective, spy, baby,
grandmother, grandfather, twins, bride, groom, neighbour, teenager, toddler, best friend, boss,
# Sport and games
soccer, rugby, cricket, tennis, golf, basketball, netball, hockey, swimming, boxing, karate,
surfing, skiing, cycling, running, marathon, chess, cards, dice, darts, bowling, snooker,
volleyball, baseball, badminton, ping pong, trophy, medal, whistle, goal, wicket, scrum, try,
penalty, red card, finish line, jigsaw puzzle, crossword, hide and seek, tag,
skipping rope, hula hoop, kite, marbles, yo-yo, frisbee, trampoline, swing, slide, sandcastle,
board game, teddy bear, doll, balloon, bubble, puppet, piñata,
# Music and art
guitar, piano, drum, violin, trumpet, flute, saxophone, harp, microphone stand, choir, orchestra,
concert, karaoke, vuvuzela, marimba, paintbrush, crayon, pencil, pen, eraser, ruler, notebook,
paint, canvas, sculpture, statue, photograph, poster, comic, novel, poem, dictionary, newspaper,
magazine, map, globe, flag, calendar, diary, postcard,
# Body and health
heart, brain, eye, ear, nose, mouth, tooth, tongue, hair, beard, moustache, hand, finger, thumb,
foot, toe, knee, elbow, shoulder, skeleton, muscle, blood, bone, skin, freckle, dimple, tattoo,
plaster, bandage, crutches, wheelchair, thermometer, injection, pill, sneeze, hiccup, yawn,
# Events and ideas
birthday, wedding, holiday, Christmas, Halloween, New Year, Easter, Valentine's Day, Eid, Diwali,
party, picnic, sleepover, road trip, honeymoon, graduation, exam, homework, weekend, Monday,
summer, winter, autumn, spring, morning, midnight, dream, nightmare, secret, surprise, gift,
wish, joke, riddle, magic trick, fireworks, parade, treasure, money, coin, credit card, receipt,
ticket, passport, queue, traffic jam, load shedding, power cut, alarm clock, deadline, selfie stick,
`,

    // Proper nouns: people, characters, places, brands, films and shows. Includes plenty of South African names.
    people: `
# Music (world)
Beyoncé, Taylor Swift, Michael Jackson, Elvis Presley, Madonna, Rihanna, Adele, Ed Sheeran, Drake,
Eminem, Lady Gaga, Justin Bieber, Bob Marley, Freddie Mercury, The Beatles, Shakira, Celine Dion,
Whitney Houston, Mariah Carey, Britney Spears, Elton John, Dolly Parton, Snoop Dogg, Billie Eilish,
Bruno Mars, Ariana Grande, Harry Styles, ABBA, Queen the band, Coldplay, BTS, Usher, Michael Bublé,
Stevie Wonder, Prince, Bon Jovi, The Rolling Stones, Spice Girls, Destiny's Child, One Direction,
Miley Cyrus, Selena Gomez, Katy Perry, Jennifer Lopez, Pharrell Williams, Kendrick Lamar, Burna Boy,
Wizkid, Tems, Bad Bunny, Dua Lipa, The Weeknd, Post Malone, Lionel Richie, Tina Turner, Cher,
Frank Sinatra, Louis Armstrong, Mozart, Beethoven, Bach,
# Film, TV and celebrities (world)
Tom Cruise, Leonardo DiCaprio, Brad Pitt, Angelina Jolie, Will Smith, Dwayne Johnson, Jim Carrey,
Tom Hanks, Meryl Streep, Morgan Freeman, Jackie Chan, Keanu Reeves, Oprah Winfrey, Marilyn Monroe,
Charlie Chaplin, Arnold Schwarzenegger, Jennifer Aniston, Zendaya, Denzel Washington, Johnny Depp,
Samuel L. Jackson, Kim Kardashian, Gordon Ramsay, David Attenborough, Steve Irwin, Mr Bean,
Emma Watson, Daniel Radcliffe, Robert Downey Jr, Scarlett Johansson, Chris Hemsworth, Nicole Kidman,
Julia Roberts, Hugh Jackman, Ryan Reynolds, Vin Diesel, Sylvester Stallone, Bruce Lee, Eddie Murphy,
Kevin Hart, Ellen DeGeneres, Simon Cowell, Mr Beast, Jason Statham, Margot Robbie, Audrey Hepburn,
Steven Spielberg, Walt Disney,
# Sport (world)
Lionel Messi, Cristiano Ronaldo, Usain Bolt, Serena Williams, Roger Federer, Michael Jordan,
LeBron James, Tiger Woods, Lewis Hamilton, Mike Tyson, Pelé, Diego Maradona, David Beckham, Neymar,
Kylian Mbappé, Mohamed Salah, Rafael Nadal, Novak Djokovic, Michael Phelps, Simone Biles,
Kobe Bryant, Muhammad Ali, Wayne Rooney, Zinedine Zidane, Sachin Tendulkar, Virat Kohli,
Max Verstappen, Ayrton Senna, Conor McGregor, Erling Haaland,
# History, science, business and world leaders
Albert Einstein, Isaac Newton, Leonardo da Vinci, William Shakespeare, Napoleon, Cleopatra,
Julius Caesar, Abraham Lincoln, Martin Luther King, Mahatma Gandhi, Queen Elizabeth,
Princess Diana, Barack Obama, Donald Trump, Winston Churchill, Mother Teresa, Christopher Columbus,
Neil Armstrong, Charles Darwin, Marie Curie, Pablo Picasso, Vincent van Gogh, Bill Gates,
Steve Jobs, Mark Zuckerberg, Elon Musk, Thomas Edison, Nikola Tesla, Florence Nightingale,
Amelia Earhart, Anne Frank, Genghis Khan, Tutankhamun, King Charles, Prince Harry, Meghan Markle,
Jeff Bezos, Stephen Hawking, Galileo, Frida Kahlo, Michelangelo, Agatha Christie, J.K. Rowling,
Dr Seuss, Roald Dahl, Charles Dickens, Malala, Rosa Parks, Yuri Gagarin, Wright brothers,
# Characters (books, films, cartoons, games)
Harry Potter, Hermione Granger, Voldemort, Gandalf, Frodo, Darth Vader, Yoda, Luke Skywalker,
Batman, Superman, Spider-Man, Iron Man, Hulk, Thor, Wonder Woman, Joker, Captain America,
Black Panther, Wolverine, Deadpool, Mickey Mouse, Donald Duck, Bugs Bunny, SpongeBob, Patrick Star,
Homer Simpson, Bart Simpson, Shrek, Elsa, Olaf, Simba, Nemo, Dory, Buzz Lightyear, Woody,
Winnie the Pooh, Pikachu, Mario, Luigi, Sonic, Pac-Man, Sherlock Holmes, James Bond, Dracula,
Frankenstein, Cinderella, Snow White, Peter Pan, Tinker Bell, Pinocchio, Santa Claus, Tooth Fairy,
Easter Bunny, Barbie, Ken, Scooby-Doo, Garfield, Tarzan, Robin Hood, King Kong, Godzilla, Kermit,
Big Bird, Cookie Monster, Peppa Pig, Dora the Explorer, Minions, The Grinch, Willy Wonka,
Mary Poppins, Captain Hook, Jack Sparrow, Indiana Jones, Rocky, The Terminator, E.T., Hello Kitty,
Lara Croft, Tom and Jerry, Popeye, Dumbo, Bambi, Aladdin, Genie, Ariel, Moana, Rapunzel, Hercules,
Zeus, Medusa, Paddington, Shaun the Sheep, Bob the Builder, Thomas the Tank Engine, Wednesday Addams,
Gollum, Chewbacca, Stitch, Puss in Boots, Optimus Prime, Wall-E, Kung Fu Panda, Cruella de Vil,
Maleficent, Little Red Riding Hood, Goldilocks, Humpty Dumpty, Rudolph,
Pinky and the Brain, Alice in Wonderland, Mad Hatter, Cheshire Cat,
# Films, shows, games and brands
Titanic, Star Wars, Jurassic Park, The Lion King, Frozen, Toy Story, Finding Nemo, Home Alone,
The Matrix, Avatar, Lord of the Rings, Game of Thrones, Friends, The Simpsons,
Squid Game, Stranger Things, Big Brother, Who Wants to Be a Millionaire,
Google, YouTube, Netflix, Instagram, TikTok, WhatsApp, Facebook, Amazon, McDonald's, KFC,
Coca-Cola, Lego, Nike, Adidas, IKEA, Disney, Ferrari, Tesla, Starbucks, Nutella, Monopoly, Uno,
PlayStation, Minecraft, Fortnite, Tetris, Wikipedia, Olympics, FIFA World Cup, iPhone, Uber,
Spotify, Pepsi, Red Bull, Mercedes-Benz, BMW, Toyota, Volkswagen Beetle, Lamborghini, Rolex,
Gucci, Pokémon, Candy Crush, Angry Birds, Among Us, Grand Theft Auto,
Oreo, Kit Kat, Pringles, Doritos, Heinz, Domino's, Burger King, Subway, Microsoft, Samsung, Apple Watch,
# Places (world)
Paris, London, New York, Tokyo, Rome, Dubai, Hollywood, Las Vegas, Venice, Sydney, Rio de Janeiro,
Cairo, Mumbai, Beijing, Moscow, Istanbul, Barcelona, Amsterdam, Nairobi, Lagos, Hawaii, Bali,
Maldives, Mauritius, Zanzibar, Egypt, Australia, Brazil, Japan, China, India, Italy, France,
Germany, Spain, Mexico, Canada, Russia, Greece, Jamaica, Ireland, Scotland, Switzerland, Kenya,
Nigeria, Namibia, Botswana, Zimbabwe, Mozambique, Madagascar, Antarctica, Alaska, Iceland,
Thailand, Turkey, Argentina, Peru, Portugal, Morocco, Ghana, Ethiopia, Lesotho, Eswatini,
Eiffel Tower, Big Ben, Statue of Liberty, Great Wall of China, Pyramids, Taj Mahal, Mount Everest,
Mount Kilimanjaro, Victoria Falls, Niagara Falls, Grand Canyon, Amazon rainforest, Sahara,
Colosseum, Leaning Tower of Pisa, Stonehenge, Machu Picchu, Sydney Opera House, Burj Khalifa,
Golden Gate Bridge, Buckingham Palace, Disneyland, Times Square, Mount Rushmore, North Pole,
Nile River, Hogwarts, Atlantis, Narnia, Neverland, Gotham City, Wakanda,
# South Africa: people
Nelson Mandela, Desmond Tutu, Siya Kolisi, Trevor Noah, Charlize Theron, Black Coffee, Master KG,
Tyla, Caster Semenya, Wayde van Niekerk, Miriam Makeba, Hugh Masekela, Brenda Fassie, Johnny Clegg,
Lucky Dube, Ladysmith Black Mambazo, Steve Biko, Winnie Mandela, Cyril Ramaphosa, Jacob Zuma,
Thabo Mbeki, F. W. de Klerk, Julius Malema, Bryan Habana, Faf de Klerk, Eben Etzebeth,
Cheslin Kolbe, AB de Villiers, Graeme Smith, Jacques Kallis, Dale Steyn, Kagiso Rabada,
Hashim Amla, Makhaya Ntini, Benni McCarthy, Lucas Radebe, Chad le Clos, Penny Heyns, Ernie Els,
Gary Player, Leon Schuster, Loyiso Gola, Marc Lottering, Connie Ferguson, Pearl Thusi,
Bonang Matheba, Somizi, Cassper Nyovest, Nasty C, Sho Madjozi, Kabza De Small, DJ Maphorisa,
Uncle Waffles, Mafikizolo, Freshlyground, Die Antwoord, Seether, Jeremy Loops, Steve Hofmeyr,
Kurt Darren, Bok van Blerk, Mi Casa, Zakes Bantwini, Babes Wodumo, Riky Rick, Shaun Pollock,
Herschelle Gibbs, Francois Pienaar, Joost van der Westhuizen, Tatjana Smith, Akani Simbine,
Elana Meyer, Zola Budd, Thuli Madonsela, Albertina Sisulu, Walter Sisulu,
Oliver Tambo, Chris Hani, Sol Plaatje, Kaizer Motaung, Doctor Khumalo, Percy Tau, Ronwen Williams,
Gareth Cliff, Riaan Cruywagen, Jan van Riebeeck, Shaka Zulu, Tannie Evita,
Thando Thabethe, Lira, Zahara, Arno Carstens, Sipho Hotstix Mabuse,
# South Africa: places, teams, brands and shows
Springboks, Proteas, Bafana Bafana, Banyana Banyana, Kaizer Chiefs, Orlando Pirates,
Mamelodi Sundowns, Stormers, Bulls, Sharks rugby, Lions rugby,
Table Mountain, Robben Island, Kruger National Park, Soweto, Durban, Cape Town, Johannesburg,
Pretoria, Bloemfontein, Gqeberha, Drakensberg, Sandton, Constitution Hill, Union Buildings,
Apartheid Museum, Sun City, Garden Route, Karoo, Kalahari, Addo Elephant Park, Cape Point,
Boulders Beach, Stellenbosch, Franschhoek, Hermanus, Knysna, Plettenberg Bay, Mossel Bay,
Jeffreys Bay, Umhlanga, uShaka Marine World, Moses Mabhida Stadium, FNB Stadium, Gold Reef City,
Hartbeespoort Dam, Blyde River Canyon, God's Window, Limpopo, Orange River, Chapman's Peak,
Lion's Head, Signal Hill, Camps Bay, Clifton Beach, V&A Waterfront, Long Street, Bo-Kaap,
District Six, Cradle of Humankind, Vilakazi Street, Ellis Park, Newlands, Loftus Versfeld,
Kings Park, Wanderers, Muizenberg, Simon's Town, Pilanesberg, Golden Gate, Wild Coast,
Sani Pass, Kimberley Big Hole, Oudtshoorn, Langebaan, Paternoster, Clarens, Pilgrim's Rest,
Nando's, Woolworths, Checkers, Pick n Pay, Spur, Steers, Wimpy, Shoprite, Castle Lager, Ouma Rusks,
Chappies, Simba chips, Nik Naks, Mrs Ball's chutney, Pronutro, Jungle Oats, Romany Creams,
Peppermint Crisp, Tennis biscuits, Marie biscuits, Mageu, Iwisa, Koo, All Gold tomato sauce,
Generations, Isidingo, 7de Laan, Carte Blanche, Takalani Sesame, Idols SA, Skeem Saam, Muvhango,
The Queen, Gomora, Uzalo, Rhythm City, Big Brother Mzansi, Tsotsi, District 9,
Spud, Kwaito, Amapiano, Gqom, Kwela, Jerusalema, Shosholoza, Nkosi Sikelel' iAfrika,
Gautrain, Rea Vaya, MyCiTi, Eskom, SAA, Vodacom, MTN, Telkom, SABC, DStv, Showmax, Takealot,
Capitec, Discovery, Comrades Marathon, Two Oceans Marathon, Cape Town Cycle Tour, Rugby World Cup,
Madiba, Heritage Day, Freedom Day, Youth Day, Braai Day, Rainbow Nation, Mzansi,
`,

    // Verbs. Base form; "swim" or "swimming" both count when guessed.
    actions: `
swim, run, jump, dance, sing, sleep, snore, sneeze, cough, laugh, cry, smile, wink, whistle, clap,
hug, kiss, wave, shout, whisper, cook, bake, fry, boil, eat, drink, chew, swallow, bite, lick,
read, write, draw, paint, colour, cut, fold, glue, build, fix, break, drop, throw, catch, kick,
hit, push, pull, lift, carry, climb, crawl, slide, skip, hop, spin, roll, fall, trip, slip,
fly, float, sink, dive, surf, ski, skate, cycle, drive, ride, park, steer, row, sail, paddle,
walk, march, tiptoe, stomp, limp, sprint, chase, hide, seek, find, lose, win, cheat, steal, borrow,
buy, sell, pay, save, spend, shop, wrap, open, close, lock, knock, ring, call, text, email, post,
talk, chat, argue, complain, apologise, promise, lie, joke, tease, gossip, brag, pray, vote,
think, dream, remember, forget, guess, learn, teach, study, count, measure, weigh, spell, solve,
listen, hear, watch, look, stare, peek, smell, sniff, taste, touch, tickle, scratch, itch, pinch,
wash, shower, bathe, brush, comb, shave, dress, iron, sweep, mop, vacuum, dust, tidy, scrub,
plant, water, dig, grow, pick, chop, mow, rake, feed, milk, fish, hunt, camp, hike, explore,
travel, pack, unpack, arrive, leave, wait, hurry, rush, relax, rest, nap, yawn, stretch, exercise,
juggle, knit, sew, pour, stir, mix, whisk, squeeze, shake, sprinkle, melt, freeze, burn, blow,
pop, bounce, flip, toss, high-five, shrug, nod, bow, salute, faint, shiver, sweat,
blush, frown, yell, scream, giggle, hiccup, burp, celebrate, cheer, propose, marry, divorce,
photograph, film, record, stream, scroll, swipe, google, download, upload, delete, charge, hack,
`,

    // Adjectives and adverbs. The hardest category, so it's dealt least often.
    describe: `
hot, cold, wet, dry, big, small, tall, short, long, wide, narrow, heavy, light, fast, slow, loud,
quiet, soft, hard, smooth, rough, sharp, blunt, sticky, slippery, fluffy, hairy, bald, shiny, dull,
bright, dark, sweet, sour, salty, bitter, spicy, crunchy, juicy, mouldy, rotten, fresh, stale,
old, new, young, ancient, modern, rich, poor, cheap, expensive, empty, full, clean, dirty, messy,
neat, broken, open, closed, early, late, happy, sad, angry, scared, brave, shy, proud, jealous,
bored, tired, sleepy, hungry, thirsty, sick, healthy, lazy, busy, clever, silly, funny, serious,
grumpy, cheeky, polite, rude, kind, mean, honest, famous, lucky, lonely, nervous, calm, crazy,
strong, weak, fit, invisible, magic, royal, secret, wild, tame, deadly, poisonous, dangerous,
safe, easy, difficult, beautiful, ugly, cute, scary, spooky, weird, normal, perfect, wrong,
round, square, flat, curly, straight, striped, spotty, golden, purple, pink, green, orange, blue,
quickly, slowly, loudly, quietly, carefully, happily, sadly, angrily, secretly, suddenly, always,
never, sometimes, together, alone, backwards, upside down, inside out, sideways, forever, tomorrow,
yesterday, tonight, twice, almost, nearly, gently, badly, politely, rudely, sleepily, hungrily,
lekker, sharp sharp, now now, just now, jislaaik,
`,
  };

  function parse(raw, seen) {
    return raw.split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join(',')
      .split(',')
      .map((w) => w.trim())
      .filter((w) => {
        const key = w.toLowerCase();
        if (!w || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const seen = new Set();
  const bank = {};
  Object.keys(RAW).forEach((cat) => { bank[cat] = parse(RAW[cat], seen); });

  GameHub.assets['word-budget'] = { bank };
})();
