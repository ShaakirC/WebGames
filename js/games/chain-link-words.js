/*
 * Chain Link word list (offline, no internet needed).
 * Format: one line per word -> "word: follower, follower, …"
 * A follower is a word that joins onto it as a compound or common phrase
 * (book + case = bookcase, case + closed = "case closed").
 * Add lines freely. Duplicate heads are merged.
 * Exposed as GameHub.assets['chain-link'].links = { word: [followers] }.
 */
(function () {
  'use strict';

  const RAW = `
air: bag, bed, craft, field, line, lock, mail, plane, port, ship, space, strike, time, way, show
apple: pie, sauce, cart, tree, juice, core, seed, crumble
arm: chair, band, pit, rest, hole
baby: sitter, shower, face, boom, food, tooth, talk, doll
back: bone, door, drop, fire, ground, hand, lash, log, pack, side, space, stage, stroke, track, up, yard, pain, seat
ball: room, park, game, point, boy, gown
band: stand, width, wagon, aid, leader
bar: code, tender, bell, maid, man, stool, chart
bath: room, robe, tub, time, water
bean: bag, pole, stalk, sprout, counter
bear: hug, trap, cub, skin, market, pit
bed: room, time, side, rock, bug, sheet, spread, post
bee: hive, keeper, line, sting, wax
bell: boy, hop, tower, ringer, pepper
big: mouth, foot, wig, top, shot, time, bang, wheel, brother, apple
bird: cage, house, song, bath, seed, brain, call
black: board, bird, berry, mail, smith, out, jack, list, hole, magic, market, sheep, belt, light
blue: berry, bird, print, bell, cheese, moon, whale, grass
board: room, walk, game, meeting, member
boat: house, yard, load, race, man
body: guard, work, builder, language, double, bag
bone: dry, fire, marrow, yard
book: case, end, keeper, mark, shelf, store, worm, club, cover, let, bag, deal, fair
bottle: neck, cap, opener, green
box: office, room, set, car, kite
boy: friend, band, hood, scout
brain: storm, wash, child, wave, power, teaser, food, dead
bread: crumb, board, stick, winner, basket, roll, knife
break: fast, down, through, water, point, time, dance
brick: layer, wall, work, house
brush: wood, fire, stroke, off
bull: dog, frog, fight, ring, horn, dozer, pen, whip
bus: stop, station, driver, ticket, lane, pass
butter: fly, cup, milk, scotch, knife, nut, finger
cake: walk, tin, stand, shop, mix
call: centre, sign, box, back, girl
camp: fire, site, ground, bed
candle: light, stick, wax, maker
car: park, pool, port, wash, pet, phone, seat, key, alarm, boot
card: board, game, shark, trick, table, holder
case: closed, study, work, file, load, law
cat: fish, walk, nap, nip, call, flap, food, burglar
chain: saw, mail, link, reaction, smoker, store, gang
check: mate, list, point, out, book, up, mark
cheese: cake, board, burger, cloth, knife, grater
chicken: pox, wing, feed, coop, soup, run
chip: board, shop, set
class: room, mate, work, act
clock: work, wise, tower, face, maker
closed: book, door, shop, circuit, mind
cloud: burst, nine, cover, storage
club: house, foot, sandwich
coat: hanger, tail, rack, room, check
code: word, name, book, breaker
coffee: table, break, cup, shop, bean, pot, maker, mug
cook: book, ware, house, top, out, off
copy: cat, right, writer, book
corn: flake, field, flour, bread, starch, wall, row, dog
cotton: wool, candy, bud, field, mouth
court: yard, room, house, case, ship, side
cover: story, up, letter, girl, charge, art, version
cow: boy, girl, bell, shed, hide, pat
crab: apple, meat, cake, grass
cream: cheese, cake, puff, tea, soda
cross: word, roads, bow, fire, walk, bar, check, over, fit
cup: board, cake, holder, final, tie
curtain: call, rail, rod, raiser
cut: back, off, out, throat, glass
dark: room, horse, side, knight, matter, web
day: break, dream, light, time, care, bed, trip, job, off
dead: line, lock, end, bolt, weight, beat, pan, wood
desk: top, job, lamp, chair
dinner: party, table, time, plate, jacket, lady
dish: washer, cloth, rack, water, towel
dog: house, fight, food, sled, tired, walker, bowl, leg, ear, days
door: bell, knob, mat, step, way, man, stop, frame, handle
down: town, pour, fall, hill, load, stairs, size, time, side, grade
dragon: fly, fruit, slayer
dream: land, catcher, boat, team, world, job
drop: out, box, kick, shot, let, zone
drum: stick, roll, beat, kit
duck: pond, bill, ling, tape, walk, egg
ear: ring, phone, plug, wax, drum, lobe, shot, mark
earth: quake, worm, ling, bound, day, work
egg: shell, cup, nog, plant, head, timer, white, roll
eye: ball, brow, lash, lid, sight, witness, liner, shadow, opener, sore, drop, wash
face: book, lift, time, mask, value, palm, off, paint, cloth
fair: way, ground, play, trade, weather, game, share
fall: out, guy, back
field: work, trip, mouse, day, marshal
fight: back, club, night
file: name, cabinet, share
film: star, maker, set, studio, crew, buff
finger: print, nail, tip, food
fire: work, place, fly, man, wood, truck, alarm, ball, side, arm, cracker, wall, drill, proof, escape
fish: bowl, cake, finger, net, hook, tank, bone, monger, food, market
flash: light, back, card, point, mob, drive, flood
flower: pot, bed, shop, girl, power
fly: paper, wheel, swatter, trap, weight, over, catcher
foot: ball, print, path, note, step, wear, hill, light, stool, bridge
force: field, feed
friend: ship, zone, request
frog: man, spawn
fruit: fly, cake, salad, bowl, juice, loop, tree
game: show, play, plan, room, night, over, changer, keeper, board
garden: party, shed, gnome, centre, path, hose, wall
gate: way, house, keeper, crash, post
girl: friend, band, hood, power, guide, boss
glass: house, ware, blower, ceiling
gold: fish, mine, smith, rush, medal, coast, finger, dust, star
grand: father, mother, stand, piano, slam, child, master
grass: hopper, land, roots, snake, cutter
green: house, light, room, belt, card, grocer, land, field, peace, tea
ground: floor, work, hog, water, nut, rules, swell, breaking
gun: fire, man, point, shot, powder, smith, boat, slinger
hair: cut, brush, dryer, line, spray, band, pin, style, net, piece
hammer: head, time, toe
hand: bag, ball, book, cuff, shake, writing, made, rail, stand, some, set, out, print, brake
hat: trick, stand, pin, box
head: ache, band, board, light, line, master, phone, quarter, rest, start, way, stone, set, hunter, case, lock
heart: beat, break, burn, land, throb, ache, felt, strings, attack
high: way, light, land, chair, school, lander, rise, ball, tide, five, street
holiday: home, maker, season, camp, romance
home: work, made, sick, town, land, page, run, coming, owner, grown, wrecker, office, base
honey: moon, comb, bee, pot, dew, suckle
horse: shoe, power, play, back, fly, radish, race, box, hair
hot: dog, cake, pot, spot, head, house, line, plate, rod, tub, shot, water, sauce
house: boat, hold, keeper, wife, work, plant, warming, party, guest, fly, mate, coat, music
ice: berg, cream, cube, land, cap, pack, box, pick, rink, breaker, age
ink: well, jet, blot, pot
iron: man, work, clad, board, age, fist
jack: pot, knife, rabbit, hammer, fruit, frost, daw, boot
jelly: fish, bean, roll
jump: suit, start, rope, shot
key: board, hole, note, ring, stone, word, card, pad, chain
kick: off, back, start, boxing, stand, ball
king: dom, fisher, pin, size, maker, cobra, crab, prawn
kitchen: sink, table, roll, garden, towel, ware, knife
knee: cap, pad, jerk, deep, high, sock
lady: bird, bug, like, finger, killer
lamp: post, shade, light, oil
land: lord, mark, mine, slide, scape, fill, line, lady, owner, locked, mass
law: suit, maker, school, firm, breaker, man
leader: board, ship
lemon: grass, juice, tree, drop, squash, zest, curd
life: boat, guard, line, long, style, time, jacket, saver, span, cycle, size
light: house, bulb, weight, year, switch, saber, show, foot, speed
lime: stone, light, juice, green
line: up, man, backer, dance, judge
lip: stick, gloss, service, balm, read
lock: smith, down, jaw, out, step, box, nut
love: bird, seat, letter, song, struck, sick, bug, heart, life, nest, handles, story
lunch: box, time, break, room, money, hour, bag
mail: box, man, bag, order, room
man: hole, kind, hunt, power, hood, made, go, date, cave
master: mind, piece, plan, card, class, chef, key, stroke
milk: shake, man, maid, tooth, bottle, float, carton
moon: light, beam, walk, shine, stone, struck, cake, lit
motor: bike, cycle, way, boat, home, mouth, sport
mouse: trap, pad, hole, tail
mouth: wash, piece, guard, organ
nail: polish, file, brush, biter, bed
name: tag, sake, plate, drop, day
news: paper, reader, room, agent, flash, letter, cast, feed
night: club, mare, fall, gown, life, shift, owl, light, time, cap, dress, stand, watch
note: book, pad, worthy, card, paper
number: plate, one, cruncher
nut: shell, cracker, case, meg, butter
orange: juice, peel, squash, zest, tree
out: side, door, break, line, put, look, cast, fit, back, run, law, rage, source, house, burst, post
over: board, coat, time, all, come, look, night, seas, sight, take, weight, turn, flow, cast, head, haul
page: boy, turner, number
paint: brush, ball, work, box, pot, stripper
paper: back, weight, work, clip, boy, chase, cut, mill, trail, plane, towel, bag, round
party: animal, line, popper, trick, time, hat
pass: word, port, over, book, key, code, mark
pea: nut, cock, pod, shooter, soup, green
peace: keeper, maker, time, offering, pipe, sign
peanut: butter, gallery
pen: knife, pal, friend, name, holder
phone: book, call, box, number, line, card, case
pie: chart, crust, dish
pig: tail, pen, sty, skin, let, headed, iron
pillow: case, fight, talk
pine: apple, cone, tree, wood, nut, needle
pipe: line, dream, cleaner, work
pit: stop, bull, fall, crew
play: ground, house, time, mate, room, book, list, wright, boy, date, pen, off, back, station, group
pocket: book, knife, money, watch, size
point: blank, less, guard
police: man, car, station, officer, force
pool: table, side, house, cue, party, boy
pop: corn, star, gun, up, art, music, quiz, tart
post: man, card, box, code, mark, age, office, script, war
pot: hole, luck, belly, ash, head, roast, plant, shot, pie
power: house, point, line, plant, cut, nap, play, station, tool
print: out, run, shop
quarter: back, final, master, deck, pounder
queen: bee, size, mother
radio: active, wave, station, show, host
rail: way, road, card, gun
rain: bow, coat, drop, fall, forest, storm, water, check, maker, cloud
ray: gun
red: head, neck, wood, wine, carpet, light, eye, cross, coat, brick
ring: tone, leader, side, master, worm, finger, road, bearer
road: block, map, house, kill, side, trip, work, rage, runner, show, sign
rock: star, fall, garden, pool, salt, band, bottom, solid
roll: call, over, back, cage, neck, top, out, bar
room: mate, service, key, temperature, divider
rose: bud, wood, mary, garden, water, bush, hip, gold
round: about, table, trip, house, up, robin
sand: castle, paper, box, storm, bank, bag, stone, pit, dune, piper, wich, fly
saw: dust, mill, horse, fish, tooth
school: boy, girl, house, work, yard, bag, teacher, bus, day, run, master, mate
sea: shell, side, food, horse, weed, gull, son, sick, bed, port, lion, salt, breeze, shore, level, dog
set: back, up, piece, list, top, off
shell: fish, shock, fire, suit
ship: wreck, yard, mate, shape, builder
shoe: lace, horn, box, string, maker, shop, polish, tree
shop: keeper, lifter, front, floor, talk, assistant, window
shot: gun, glass, put, caller
show: case, down, room, time, man, girl, off, stopper, business, boat, piece
shower: head, cap, gel, curtain, room
side: walk, board, kick, line, show, step, ways, car, burn, effect, salad, table, track
silver: ware, fish, smith, screen, spoon, lining, back
sky: line, light, scraper, diver, lark, rocket, walker, high, blue
sleep: walk, over, wear, less, mode, talk
snake: bite, skin, pit, charmer, oil
snow: ball, flake, man, board, fall, storm, drift, plough, boot, globe, mobile, white, cone, angel, day
soap: box, opera, dish, stone, suds, bar
song: bird, book, writer, list
spot: light, check, lit, less
spring: board, time, roll, clean, water, bok, onion
stand: still, point, off, by, up, alone, pipe
star: fish, light, dust, ship, gazer, struck, board, sign, fruit, burst
step: ladder, mother, father, son, stool, child, sister, brother, stone, dad
stick: man, shift, insect, figure, up
stone: wall, mason, work, age, fruit, cold, henge, ware, washed
stop: watch, light, gap, sign, over
storm: cloud, drain, trooper, chaser, front, water
straw: berry, man, hat, poll, bale
street: light, wise, car, art, food, smart, view, party, market
suit: case
summer: time, house, holiday, camp, school
sun: flower, shine, light, glasses, burn, set, rise, day, dial, bed, screen, block, tan, roof, beam, dress, spot, stroke, lounger, hat
super: market, man, star, hero, model, glue, power, nova, bowl, food, charge, store
sweet: heart, corn, bread, potato, shop, tooth, spot, talk, pea, wrapper
swim: suit, wear, cap, team, lane
table: cloth, spoon, top, tennis, ware, land, mat, manners, salt
tag: line, team
tail: gate, spin, light, coat, bone, pipe, wind
tea: pot, cup, spoon, time, bag, cake, towel, room, party, light, shop, cosy, leaf, set, break
team: work, mate, player, spirit, leader, building
time: table, line, keeper, piece, zone, bomb, frame, share, out, travel, lapse, machine, slot, sheet
toe: nail, cap, hold, ring
tooth: brush, paste, pick, ache, fairy, decay, less
top: hat, coat, soil, side, secret, floor, dog, gun, notch, spin
town: house, hall, ship, centre, square
toy: box, shop, boy, story, town, soldier
trap: door
tree: house, top, line, trunk, hugger, frog
trip: wire
under: ground, water, wear, dog, cover, line, cut, stand, take, study, world, arm, pass, score, current, coat, growth
up: town, stairs, hill, side, grade, load, date, beat, lift, set, start, stage, shot, keep, right, turn, front, root
walk: way, over, out, about, man
wall: paper, flower, chart, street, nut, plug, light
war: path, head, ship, fare, lord, zone, time, game, cry, paint, horse
wash: room, basin, cloth, board, out, day, bag, machine, load
watch: dog, man, word, tower, maker, strap, list, keeper
water: fall, melon, proof, front, colour, bed, mark, way, park, slide, bottle, mill, tight, lily, line, logged, pistol, ski, sports, gun, shed, works
way: side, ward, farer, lay, point
web: site, cam, page, master, browser, foot
wheel: chair, barrow, base, house, spin, wright
white: board, wash, water, wine, house, noise, collar, out, bait, chocolate, knight, lie, sauce, wedding, space, light, flag
wind: mill, screen, fall, pipe, shield, surf, chime, sock, turbine, breaker, bag, storm, up, power
window: sill, pane, shop, box, cleaner, seat, frame, dressing, ledge
wine: glass, bottle, cellar, list, tasting, rack, bar, cooler, gum, press
winter: time, coat, wonderland, sports, garden
wire: less, tap, frame, cutter
wood: work, pecker, land, cutter, shed, pile, stock, wind, chip, chuck, louse, worm, fire, burner
word: play, search, smith, count, list, game, wrap, perfect, processor
work: shop, place, out, load, force, bench, man, book, station, day, horse, mate, flow, life, top
worm: hole, wood, food, cast, farm
yard: stick, work, sale, arm, bird
`;

  const links = {};
  for (const line of RAW.split('\n')) {
    const [head, tails] = line.split(':');
    if (!tails) continue;
    const key = head.trim().toLowerCase();
    const set = new Set(links[key] || []);
    for (const t of tails.split(',')) {
      const word = t.trim().toLowerCase();
      if (word && word !== key) set.add(word);
    }
    links[key] = [...set];
  }

  GameHub.assets['chain-link'] = { links };
})();
