"""Who am I? clue sets for pawn promotion. Run:

    python3 tools/build_whoami.py data/whoami.json

Each set: five clues from hardest to easiest, the player, three decoys (bots
still guess from four names) and extra accepted spellings (`aliases`). Players
type their answer: the game ignores capitals and accents, accepts the full name,
the surname alone or an alias, and allows a typo or two. Guessing right after
clue 1 or 2 earns a queen, clue 3 a rook, clue 4 a bishop and clue 5 a knight. Every clue was checked against the player's English
Wikipedia page (the `source`) on 2026-11-04.
"""

import json
import random
import sys

W = "https://en.wikipedia.org/wiki/"

# (id, answer, decoys, club or None, wikipedia page, [clue1..clue5])
SETS = [
    ("who-henry", "Thierry Henry", ["Robert Pirès", "Nicolas Anelka", "Sylvain Wiltord"], None, "Thierry_Henry", [
        "I was born in Les Ulis, France, in 1977.",
        "I started my senior career at Monaco, then had a short spell at Juventus.",
        "I won the World Cup in 1998 and the European Championship in 2000.",
        "I won the Premier League Golden Boot in 2002, 2004, 2005 and 2006.",
        "I'm Arsenal's all-time record goalscorer, and there's a statue of me outside the Emirates.",
    ]),
    ("who-shearer", "Alan Shearer", ["Les Ferdinand", "Andy Cole", "Michael Owen"], None, "Alan_Shearer", [
        "I was born in Gosforth, Newcastle upon Tyne, in 1970.",
        "I scored a hat-trick on my full debut for Southampton, against Arsenal, aged 17.",
        "I won the Premier League with Blackburn Rovers in 1995.",
        "I'm Newcastle's record goalscorer, and I had a short spell as their manager.",
        "I'm the Premier League's all-time top scorer with 260 goals.",
    ]),
    ("who-lampard", "Frank Lampard", ["Steven Gerrard", "Michael Carrick", "Joe Cole"], None, "Frank_Lampard", [
        "I was born in Romford in 1978, and my dad played for the same first club as me.",
        "I started at West Ham and had a loan spell at Swansea.",
        "I managed Derby County before going back to my old club as manager in 2019.",
        "I was FWA Footballer of the Year in 2005.",
        "I'm Chelsea's all-time top scorer, from midfield.",
    ]),
    ("who-gerrard", "Steven Gerrard", ["Jamie Carragher", "Frank Lampard", "Danny Murphy"], None, "Steven_Gerrard", [
        "I was born in Whiston, Merseyside, in 1980.",
        "I ended my playing career with LA Galaxy in the United States.",
        "As a manager, I won the Scottish Premiership with Rangers in 2020-21.",
        "I scored a late long-range equaliser in the 2006 FA Cup final against West Ham.",
        "I captained Liverpool to the 2005 Champions League in Istanbul after being 3-0 down.",
    ]),
    ("who-rooney", "Wayne Rooney", ["Michael Owen", "Ross Barkley", "Jermain Defoe"], None, "Wayne_Rooney", [
        "I was born in Croxteth, Liverpool, in 1985.",
        "I later played in the United States for DC United.",
        "As a 16-year-old I scored a late winner against Arsenal that ended their 30-game unbeaten run.",
        "I'm Manchester United's all-time top goalscorer.",
        "I started at Everton and joined Manchester United in 2004.",
    ]),
    ("who-drogba", "Didier Drogba", ["Nicolas Anelka", "Salomon Kalou", "Samuel Eto'o"], None, "Didier_Drogba", [
        "I was born in Abidjan in 1978.",
        "I joined my most famous club from Marseille in 2004.",
        "I'm the Ivory Coast's all-time top goalscorer.",
        "I scored in four FA Cup finals.",
        "I scored the equaliser and the winning penalty for Chelsea in the 2012 Champions League final.",
    ]),
    ("who-ronaldo", "Cristiano Ronaldo", ["Nani", "Luís Figo", "Ricardo Quaresma"], None, "Cristiano_Ronaldo", [
        "I was born in Funchal, Madeira, in 1985.",
        "I joined my first English club from Sporting CP in 2003.",
        "I won my first Ballon d'Or in 2008.",
        "I captained Portugal to the European Championship in 2016.",
        "I've played for Manchester United, Real Madrid and Juventus.",
    ]),
    ("who-aguero", "Sergio Agüero", ["Carlos Tevez", "Edin Džeko", "Gonzalo Higuaín"], None, "Sergio_Agüero", [
        "I was born in Buenos Aires in 1988.",
        "I played for Atlético Madrid before moving to England in 2011.",
        "I retired in 2021, shortly after joining Barcelona, because of a heart condition.",
        "I'm Manchester City's all-time top goalscorer.",
        "I scored in stoppage time against QPR to win the 2011-12 title.",
    ]),
    ("who-salah", "Mohamed Salah", ["Sadio Mané", "Riyad Mahrez", "Roberto Firmino"], None, "Mohamed_Salah", [
        "I was born in Nagrig, Egypt, in 1992.",
        "I played for Basel, then had a short spell at Chelsea.",
        "I played for Fiorentina and Roma in Italy.",
        "I scored 32 Premier League goals in 2017-18, a record for a 38-game season at the time.",
        "I'm Egypt's star forward and won the league with Liverpool in 2020.",
    ]),
    ("who-kane", "Harry Kane", ["Jamie Vardy", "Dele Alli", "Son Heung-min"], None, "Harry_Kane", [
        "I was born in Leytonstone, London, in 1993.",
        "I went on loan to Leyton Orient, Millwall, Norwich and Leicester.",
        "I joined Bayern Munich in 2023.",
        "I won the Premier League Golden Boot three times, most recently in 2020-21.",
        "I'm England's and Tottenham's all-time record goalscorer.",
    ]),
    ("who-vardy", "Jamie Vardy", ["Riyad Mahrez", "Shinji Okazaki", "Danny Drinkwater"], None, "Jamie_Vardy", [
        "I was born in Sheffield in 1987.",
        "I played non-league football for Stocksbridge Park Steels, Halifax Town and Fleetwood Town.",
        "I scored in 11 Premier League games in a row in 2015, a record.",
        "I won the FA Cup in 2021.",
        "I was Premier League Player of the Season as Leicester won the title in 2016.",
    ]),
    ("who-kante", "N'Golo Kanté", ["Claude Makélélé", "Blaise Matuidi", "Paul Pogba"], None, "N%27Golo_Kant%C3%A9", [
        "I was born in Paris in 1991.",
        "I played for Boulogne and Caen in France.",
        "I won the World Cup with France in 2018.",
        "I won the Premier League in back-to-back seasons with two different clubs.",
        "I won the title with Leicester in 2016, then with Chelsea in 2017.",
    ]),
    ("who-debruyne", "Kevin De Bruyne", ["Eden Hazard", "Dries Mertens", "Bernardo Silva"], None, "Kevin_De_Bruyne", [
        "I was born in Drongen, Belgium, in 1991.",
        "I started at Genk.",
        "I left Chelsea for Wolfsburg, where I was German Footballer of the Year.",
        "I won PFA Players' Player of the Year twice, in 2020 and 2021.",
        "I joined Manchester City in 2015 and left for Napoli in 2025.",
    ]),
    ("who-hazard", "Eden Hazard", ["Kevin De Bruyne", "Juan Mata", "Willian"], None, "Eden_Hazard", [
        "I was born in La Louvière, Belgium, in 1991.",
        "I won Ligue 1 with Lille in 2011.",
        "I was PFA Players' Player of the Year in 2015.",
        "I joined Real Madrid in 2019.",
        "I won two Premier League titles with Chelsea after joining in 2012.",
    ]),
    ("who-haaland", "Erling Haaland", ["Alexander Sørloth", "Darwin Núñez", "Viktor Gyökeres"], None, "Erling_Haaland", [
        "I was born in Leeds in 2000, while my dad was playing for Leeds United.",
        "I played for Molde and Red Bull Salzburg.",
        "I scored a lot of goals for Borussia Dortmund.",
        "I won the treble with Manchester City in my first season.",
        "I scored 36 Premier League goals in 2022-23, a record for a season.",
    ]),
    ("who-cech", "Petr Čech", ["Edwin van der Sar", "David de Gea", "Carlo Cudicini"], None, "Petr_Čech", [
        "I was born in Plzeň in 1982.",
        "I played for Rennes in France before moving to England.",
        "I wore a protective head guard after fracturing my skull in 2006.",
        "I kept a record 24 clean sheets in the 2004-05 Premier League season.",
        "I'm a goalkeeper who joined Chelsea in 2004 and later played for Arsenal.",
    ]),
    ("who-terry", "John Terry", ["Ricardo Carvalho", "Gary Cahill", "Rio Ferdinand"], None, "John_Terry", [
        "I was born in Barking in 1980.",
        "I finished my playing career at Aston Villa in 2018.",
        "I slipped while taking a penalty in the 2008 Champions League final shoot-out against Manchester United.",
        "I won five Premier League titles as a centre-back.",
        "I'm Chelsea's most successful captain.",
    ]),
    ("who-ferdinand", "Rio Ferdinand", ["John Terry", "Sol Campbell", "Jonathan Woodgate"], None, "Rio_Ferdinand", [
        "I was born in Camberwell in 1978 and grew up in Peckham.",
        "I came through West Ham's academy.",
        "Leeds United paid a British record fee for me in 2000.",
        "My brother Anton also played as a centre-back for West Ham and Sunderland.",
        "I won six Premier League titles with Manchester United.",
    ]),
    ("who-scholes", "Paul Scholes", ["Nicky Butt", "Ryan Giggs", "Michael Carrick"], None, "Paul_Scholes", [
        "I was born in Salford in 1974.",
        "I came out of retirement in January 2012.",
        "I scored the winner against Barcelona in the 2008 Champions League semi-final.",
        "I was one of the 'Class of '92'.",
        "I won 11 Premier League titles in midfield for Manchester United.",
    ]),
    ("who-giggs", "Ryan Giggs", ["Gary Neville", "Lee Sharpe", "Paul Scholes"], None, "Ryan_Giggs", [
        "I was born in Cardiff in 1973.",
        "I was interim manager of my club at the end of 2013-14.",
        "I later managed Wales.",
        "I scored in each of the first 21 Premier League seasons.",
        "I won a record 13 Premier League titles with Manchester United.",
    ]),
    ("who-bergkamp", "Dennis Bergkamp", ["Marc Overmars", "Robin van Persie", "Patrick Kluivert"], None, "Dennis_Bergkamp", [
        "I was born in Amsterdam in 1969.",
        "I played for Inter Milan before moving to England.",
        "My fear of flying earned me the nickname 'The Non-Flying Dutchman'.",
        "I scored a famous flick-and-turn goal at Newcastle in 2002.",
        "I was one of Arsenal's 'Invincibles' and have a statue at the Emirates.",
    ]),
    ("who-vanpersie", "Robin van Persie", ["Dirk Kuyt", "Arjen Robben", "Klaas-Jan Huntelaar"], None, "Robin_van_Persie", [
        "I was born in Rotterdam in 1983.",
        "I started at Excelsior and joined Feyenoord at 16.",
        "I won the Premier League Golden Boot in 2011-12 and 2012-13.",
        "I scored a famous flying header against Spain at the 2014 World Cup.",
        "I left Arsenal for Manchester United in 2012 and won the title.",
    ]),
    ("who-suarez", "Luis Suárez", ["Edinson Cavani", "Diego Forlán", "Sebastián Abreu"], None, "Luis_Suárez", [
        "I was born in Salto, Uruguay, in 1987.",
        "I played for Groningen and Ajax in the Netherlands.",
        "I scored 31 Premier League goals in 2013-14.",
        "I joined Barcelona in 2014.",
        "I joined Liverpool in January 2011.",
    ]),
    ("who-bale", "Gareth Bale", ["Aaron Ramsey", "Craig Bellamy", "Joe Allen"], None, "Gareth_Bale", [
        "I was born in Cardiff in 1989.",
        "I started at Southampton.",
        "I was PFA Players' Player of the Year in 2011 and 2013.",
        "I scored an overhead kick in the 2018 Champions League final.",
        "I left Tottenham for Real Madrid in 2013 for a world record fee.",
    ]),
    ("who-son", "Son Heung-min", ["Park Ji-sung", "Ki Sung-yueng", "Hwang Hee-chan"], None, "Son_Heung-min", [
        "I was born in Chuncheon in 1992.",
        "I played for Hamburg and Bayer Leverkusen in Germany.",
        "I won the FIFA Puskás Award for a solo goal against Burnley.",
        "I shared the Premier League Golden Boot in 2021-22.",
        "I'm South Korea's captain and lifted the Europa League with Tottenham in 2025.",
    ]),
    ("who-yaya", "Yaya Touré", ["Kolo Touré", "Gervinho", "Seydou Keita"], None, "Yaya_Touré", [
        "I was born in Bouaké in 1983.",
        "I won the Champions League with Barcelona in 2009.",
        "I scored the winner in the 2011 FA Cup final.",
        "My brother Kolo was my teammate at Manchester City and for Ivory Coast.",
        "I scored 20 Premier League goals from midfield for Manchester City in 2013-14.",
    ]),
    ("who-kompany", "Vincent Kompany", ["Thomas Vermaelen", "Jan Vertonghen", "Toby Alderweireld"], None, "Vincent_Kompany", [
        "I was born in Uccle, Belgium, in 1986.",
        "I played for Anderlecht and Hamburg.",
        "As a manager, I won the Championship with Burnley in 2023.",
        "I scored a long-range winner against Leicester in May 2019.",
        "I captained Manchester City for eight seasons and won four Premier League titles with them.",
    ]),
    ("who-vandijk", "Virgil van Dijk", ["Matthijs de Ligt", "Joël Matip", "Stefan de Vrij"], None, "Virgil_van_Dijk", [
        "I was born in Breda in 1991.",
        "I played for Groningen and Celtic.",
        "I joined my current club from Southampton in January 2018.",
        "I was PFA Players' Player of the Year in 2019.",
        "I captained Liverpool to the Premier League title in 2025.",
    ]),
    ("who-owen", "Michael Owen", ["Robbie Fowler", "Emile Heskey", "Wayne Rooney"], None, "Michael_Owen", [
        "I was born in Chester in 1979.",
        "I won the Ballon d'Or in 2001.",
        "I scored twice in the 2001 FA Cup final against Arsenal.",
        "I played for Real Madrid, Newcastle, Manchester United and Stoke.",
        "I burst onto the scene at Liverpool as a teenager.",
    ]),
    ("who-crouch", "Peter Crouch", ["Kevin Davies", "Emile Heskey", "Andy Carroll"], None, "Peter_Crouch", [
        "I was born in Macclesfield in 1981.",
        "I played for Portsmouth, Aston Villa and Southampton early in my career.",
        "I scored a record number of headed goals in the Premier League.",
        "I celebrated with a robot dance.",
        "I'm the tall striker who played for Liverpool, Tottenham and Stoke.",
    ]),

    # ---------------------------------------------------------------- West Ham
    ("who-whu-noble", "Mark Noble", ["Scott Parker", "Kevin Nolan", "James Collins"], "west-ham", "Mark_Noble", [
        "I was born in Canning Town in 1987.",
        "I had loan spells at Hull City and Ipswich Town.",
        "I took penalties for my club for over a decade.",
        "After retiring in 2022 I came back as sporting director.",
        "I'm 'Mr West Ham': a one-club captain from the academy.",
    ]),
    ("who-whu-bowen", "Jarrod Bowen", ["Michail Antonio", "Saïd Benrahma", "Tomáš Souček"], "west-ham", "Jarrod_Bowen", [
        "I was born in Leominster in 1996.",
        "I joined from Hull City in January 2020.",
        "I made my England debut in 2022.",
        "I became club captain in 2024.",
        "I scored a 90th-minute winner against Fiorentina in the 2023 Europa Conference League final.",
    ]),
    ("who-whu-rice", "Declan Rice", ["Tomáš Souček", "Mark Noble", "Pablo Zabaleta"], "west-ham", "Declan_Rice", [
        "I was born in Kingston upon Thames in 1999.",
        "I was released by Chelsea's academy at 14.",
        "I played for the Republic of Ireland before switching to England.",
        "I captained West Ham to the Europa Conference League in 2023.",
        "I left for Arsenal in 2023 for a club-record £100m, the joint-highest fee for an English player.",
    ]),
    ("who-whu-payet", "Dimitri Payet", ["Manuel Lanzini", "Enner Valencia", "Andy Carroll"], "west-ham", "Dimitri_Payet", [
        "I was born on Réunion in 1987.",
        "I played for Saint-Étienne and Lille.",
        "I scored a stunning winner for France in the opening game of Euro 2016.",
        "My free kicks lit up my first season at West Ham, 2015-16.",
        "I went back to Marseille in January 2017, after my manager said I no longer wanted to play for the club.",
    ]),
    ("who-whu-tevez", "Carlos Tevez", ["Javier Mascherano", "Bobby Zamora", "Marlon Harewood"], "west-ham", "Carlos_Tevez", [
        "I was born in Ciudadela, Buenos Aires, in 1984.",
        "I joined from Corinthians in 2006 with Javier Mascherano.",
        "I later won the league with Manchester United and Manchester City.",
        "My third-party ownership led to a long dispute with Sheffield United, and West Ham paid them £20 million.",
        "I scored the only goal against Manchester United on the last day of 2006-07 to keep West Ham up.",
    ]),
    ("who-whu-dicanio", "Paolo Di Canio", ["Frédéric Kanouté", "Paulo Wanchope", "Trevor Sinclair"], "west-ham", "Paolo_Di_Canio", [
        "I was born in Rome in 1968.",
        "I pushed referee Paul Alcock over while at Sheffield Wednesday.",
        "I won a FIFA Fair Play award for catching the ball instead of shooting when Everton's keeper was injured.",
        "I later managed Swindon Town and Sunderland.",
        "I scored a flying volley against Wimbledon in 2000 that won Goal of the Season.",
    ]),
    ("who-whu-antonio", "Michail Antonio", ["Jarrod Bowen", "Andy Carroll", "Diafra Sakho"], "west-ham", "Michail_Antonio", [
        "I was born in Wandsworth in 1990.",
        "I played for Reading, Sheffield Wednesday and Nottingham Forest.",
        "I play international football for Jamaica.",
        "I joined West Ham in 2015 and played as both a winger and a striker.",
        "In 2021 I overtook Paolo Di Canio as West Ham's top Premier League scorer.",
    ]),
    ("who-whu-parker", "Scott Parker", ["Mark Noble", "Kevin Nolan", "Matthew Upson"], "west-ham", "Scott_Parker", [
        "I was born in Lambeth in 1980.",
        "I came through at Charlton Athletic.",
        "I played for Chelsea and Newcastle before joining West Ham.",
        "I was FWA Footballer of the Year in 2011, in a season my team went down.",
        "As a manager, I won promotion with Fulham and Bournemouth.",
    ]),
    ("who-whu-ashton", "Dean Ashton", ["Bobby Zamora", "Marlon Harewood", "Teddy Sheringham"], "west-ham", "Dean_Ashton", [
        "I was born in Swindon in 1983.",
        "I started my career at Crewe Alexandra.",
        "I joined West Ham from Norwich City in January 2006.",
        "I scored in the 2006 FA Cup final against Liverpool.",
        "I retired at 26 after an ankle injury from an England training session.",
    ]),
    ("who-whu-soucek", "Tomáš Souček", ["Vladimír Coufal", "Declan Rice", "Pablo Fornals"], "west-ham", "Tomáš_Souček", [
        "I was born in Havlíčkův Brod in 1995.",
        "I played for Slavia Prague.",
        "I joined West Ham on loan in January 2020 before signing permanently.",
        "I was named captain of the Czech Republic in 2021.",
        "I'm a 6ft 4in box-to-box midfielder, and José Mourinho compared me to Marouane Fellaini.",
    ]),

    # ---------------------------------------------------------------- Brighton
    ("who-bha-gross", "Pascal Groß", ["Solly March", "Davy Pröpper", "Dale Stephens"], "brighton", "Pascal_Groß", [
        "I was born in Mannheim in 1991.",
        "I joined Brighton from FC Ingolstadt in 2017.",
        "I scored Brighton's first ever Premier League goals, two against West Brom.",
        "I made my Germany debut in 2023.",
        "I joined Borussia Dortmund in 2024.",
    ]),
    ("who-bha-dunk", "Lewis Dunk", ["Shane Duffy", "Adam Webster", "Gordon Greer"], "brighton", "Lewis_Dunk", [
        "I was born in Brighton in 1991.",
        "I had a loan spell at Bristol City.",
        "I won my first England cap in 2018.",
        "I came through Brighton's academy and played for them in League One.",
        "I'm Brighton's long-serving centre-back and captain.",
    ]),
    ("who-bha-mitoma", "Kaoru Mitoma", ["Takumi Minamino", "Ritsu Dōan", "Takehiro Tomiyasu"], "brighton", "Kaoru_Mitoma", [
        "I was born in Hita, Ōita, in 1997 and grew up in Kawasaki.",
        "I wrote my university thesis on dribbling.",
        "I spent a season on loan at Union Saint-Gilloise in Belgium.",
        "I'm a winger for Japan.",
        "I joined Brighton from Kawasaki Frontale in 2021.",
    ]),
    ("who-bha-macallister", "Alexis Mac Allister", ["Moisés Caicedo", "Enzo Fernández", "Julio Enciso"], "brighton", "Alexis_Mac_Allister", [
        "I was born in Santa Rosa, Argentina, in 1998.",
        "I came through the youth set-up at Argentinos Juniors.",
        "After signing for Brighton I was loaned back to Argentinos Juniors, then to Boca Juniors.",
        "I won the World Cup with Argentina in 2022.",
        "I left Brighton for Liverpool in 2023.",
    ]),
    ("who-bha-caicedo", "Moisés Caicedo", ["Alexis Mac Allister", "Pervis Estupiñán", "Enzo Fernández"], "brighton", "Moisés_Caicedo", [
        "I was born in Santo Domingo, Ecuador, in 2001.",
        "I came through at Independiente del Valle.",
        "Brighton loaned me to Beerschot in Belgium.",
        "I play in midfield for Ecuador.",
        "Chelsea paid a British record fee for me in 2023.",
    ]),
    ("who-bha-zamora", "Bobby Zamora", ["Leon Knight", "Glenn Murray", "Gary Hart"], "brighton", "Bobby_Zamora", [
        "I was born in Barking in 1981.",
        "I was released by West Ham's academy and started my career at Bristol Rovers.",
        "I scored the goal that won West Ham promotion in the 2005 play-off final.",
        "I was at Fulham when they reached the 2010 Europa League final.",
        "I scored lots of goals in Brighton's back-to-back promotions in 2001 and 2002, and came back in 2015.",
    ]),
    ("who-bha-welbeck", "Danny Welbeck", ["Glenn Murray", "Neal Maupay", "Leandro Trossard"], "brighton", "Danny_Welbeck", [
        "I was born in Manchester in 1990.",
        "I came through Manchester United's academy.",
        "I played for Arsenal and Watford.",
        "I've scored more than 15 goals for England.",
        "I joined Brighton in 2020.",
    ]),
    ("who-bha-trossard", "Leandro Trossard", ["Kaoru Mitoma", "Danny Welbeck", "Yves Bissouma"], "brighton", "Leandro_Trossard", [
        "I was born in Maasmechelen, Belgium, in 1994.",
        "I joined Brighton from Genk in 2019.",
        "I scored a hat-trick at Anfield in a 3-3 draw in 2022.",
        "I play for Belgium.",
        "I left Brighton for Arsenal in January 2023.",
    ]),
    # v2 (2026-11-23): 40 more Premier League players, checked on Wikipedia the same way.
    ("who-campbell", "Sol Campbell", ["Ledley King", "Martin Keown", "Philippe Senderos"], None, "Sol_Campbell", [
        "I was born in Plaistow, London, in 1974.",
        "I captained Portsmouth to the FA Cup in 2008.",
        "I scored for my club in the 2006 Champions League final.",
        "I was one of Arsenal's Invincibles, unbeaten through the 2003-04 Premier League season.",
        "I left Tottenham, where I was captain, on a free transfer to join their rivals Arsenal in 2001.",
    ]),
    ("who-ashleycole", "Ashley Cole", ["Wayne Bridge", "Gaël Clichy", "Leighton Baines"], None, "Ashley_Cole", [
        "I was born in Stepney, London, in 1980.",
        "I had a loan spell at Crystal Palace early in my career.",
        "I later played for Roma, LA Galaxy and Derby County.",
        "I won the FA Cup seven times, a record for a player.",
        "I'm a left-back who left Arsenal for Chelsea in 2006.",
    ]),
    ("who-vieira", "Patrick Vieira", ["Emmanuel Petit", "Gilberto Silva", "Claude Makélélé"], None, "Patrick_Vieira", [
        "I was born in Dakar, Senegal, in 1976.",
        "I joined my most famous club from AC Milan in 1996.",
        "I later won Serie A titles with Inter Milan.",
        "As a manager I've been in charge of Nice and Crystal Palace.",
        "I captained Arsenal's Invincibles in 2003-04.",
    ]),
    ("who-pires", "Robert Pirès", ["Sylvain Wiltord", "Fredrik Ljungberg", "Thierry Henry"], None, "Robert_Pires", [
        "I was born in Reims, France, in 1973.",
        "I played for Metz and Marseille before moving to England.",
        "I won the World Cup in 1998 and the European Championship in 2000.",
        "I was FWA Footballer of the Year for the 2001-02 season.",
        "I joined Arsenal in 2000, and once tried a two-man penalty with Thierry Henry against Manchester City.",
    ]),
    ("who-torres", "Fernando Torres", ["David Villa", "Fernando Morientes", "Álvaro Morata"], None, "Fernando_Torres", [
        "I was born in Fuenlabrada, Madrid, in 1984.",
        "I was made captain of Atlético Madrid when I was 19.",
        "I scored the only goal of the Euro 2008 final against Germany.",
        "I joined Chelsea for a British record £50 million in January 2011.",
        "I'm 'El Niño', and I joined Liverpool from Atlético Madrid in 2007.",
    ]),
    ("who-alonso", "Xabi Alonso", ["Javier Mascherano", "Luis García", "Cesc Fàbregas"], None, "Xabi_Alonso", [
        "I was born in Tolosa, Spain, in 1981.",
        "I started at Real Sociedad and had a loan spell at Eibar.",
        "As a manager I won the Bundesliga unbeaten with Bayer Leverkusen in 2024.",
        "I scored from inside my own half against Newcastle in 2006.",
        "I scored the rebound from my own saved penalty in the 2005 Champions League final for Liverpool.",
    ]),
    ("who-modric", "Luka Modrić", ["Ivan Rakitić", "Niko Kranjčar", "Mateo Kovačić"], None, "Luka_Modri%C4%87", [
        "I was born in Zadar, Croatia, in 1985.",
        "I played for Dinamo Zagreb, with loans at Zrinjski Mostar and Inter Zaprešić.",
        "I joined AC Milan in 2025.",
        "I won the Ballon d'Or in 2018, after captaining my country to the World Cup final.",
        "I played for Tottenham from 2008 to 2012, then won the Champions League many times with Real Madrid.",
    ]),
    ("who-fabregas", "Cesc Fàbregas", ["Xabi Alonso", "Mikel Arteta", "Santi Cazorla"], None, "Cesc_F%C3%A0bregas", [
        "I was born in Arenys de Mar, Spain, in 1987.",
        "I came through Barcelona's academy, then moved to London at 16.",
        "As a manager I've been in charge of Como in Italy.",
        "I set up Andrés Iniesta's winning goal in the 2010 World Cup final.",
        "I captained Arsenal, then later won the Premier League twice with Chelsea.",
    ]),
    ("who-dsilva", "David Silva", ["Juan Mata", "Santi Cazorla", "Bernardo Silva"], None, "David_Silva", [
        "I was born in Arguineguín, Gran Canaria, in 1986.",
        "I played for Valencia, with loans at Eibar and Celta Vigo.",
        "I finished my playing career at Real Sociedad.",
        "I won the World Cup with Spain in 2010 and two European Championships.",
        "I won four Premier League titles with Manchester City, and there's a statue of me outside the Etihad.",
    ]),
    ("who-mane", "Sadio Mané", ["Naby Keïta", "Ismaïla Sarr", "Mohamed Salah"], None, "Sadio_Man%C3%A9", [
        "I was born in Bambali, Senegal, in 1992.",
        "I played for Metz and Red Bull Salzburg.",
        "I scored the fastest hat-trick in Premier League history, for Southampton in 2015.",
        "I scored the winning penalty in the shoot-out as Senegal won the 2021 Africa Cup of Nations.",
        "I won the Champions League and the Premier League with Liverpool, then joined Bayern Munich.",
    ]),
    ("who-mahrez", "Riyad Mahrez", ["Jamie Vardy", "N'Golo Kanté", "Islam Slimani"], None, "Riyad_Mahrez", [
        "I was born in Clichy, France, in 1991.",
        "I played for Le Havre before moving to England in 2014.",
        "I captained Algeria to the Africa Cup of Nations in 2019.",
        "I was PFA Players' Player of the Year in 2016.",
        "I won the title with Leicester in 2016, then won the treble with Manchester City.",
    ]),
    ("who-saka", "Bukayo Saka", ["Gabriel Martinelli", "Emile Smith Rowe", "Jadon Sancho"], None, "Bukayo_Saka", [
        "I was born in Ealing, London, in 2001, to Nigerian parents.",
        "I played a lot at left-back in my first seasons in the first team.",
        "My penalty was saved in the Euro 2020 final shoot-out.",
        "I was England Men's Player of the Year in 2022 and 2023.",
        "I wear number 7 for Arsenal, and I'm also known as 'Starboy'.",
    ]),
    ("who-odegaard", "Martin Ødegaard", ["Erling Haaland", "Kai Havertz", "Declan Rice"], None, "Martin_%C3%98degaard", [
        "I was born in Drammen, Norway, in 1998.",
        "I became Norway's youngest ever player, aged 15.",
        "I joined Real Madrid as a teenager and went on loan to Heerenveen, Vitesse and Real Sociedad.",
        "I joined Arsenal on loan in 2021, then signed permanently.",
        "I captain both Arsenal and Norway.",
    ]),
    ("who-bruno", "Bruno Fernandes", ["Bernardo Silva", "João Moutinho", "Diogo Jota"], None, "Bruno_Fernandes", [
        "I was born in Maia, Portugal, in 1994.",
        "I started my senior career in Italy, with Novara, Udinese and Sampdoria.",
        "I played for Sporting CP from 2017 until I moved to England in January 2020.",
        "I set a Premier League record with 21 assists in a season.",
        "I captain Manchester United.",
    ]),
    ("who-rashford", "Marcus Rashford", ["Jesse Lingard", "Mason Greenwood", "Anthony Martial"], None, "Marcus_Rashford", [
        "I was born in Manchester in 1997.",
        "I was made an MBE for my campaign for free school meals.",
        "I scored twice on my first-team debut, against Midtjylland in the Europa League.",
        "I went on loan to Aston Villa in 2025, then to Barcelona.",
        "I came through Manchester United's academy and wore their number 10.",
    ]),
    ("who-sterling", "Raheem Sterling", ["Jadon Sancho", "Leroy Sané", "Theo Walcott"], None, "Raheem_Sterling", [
        "I was born in Kingston, Jamaica, in 1994.",
        "I grew up near Wembley and started at QPR's academy.",
        "I was FWA Footballer of the Year in 2019.",
        "I joined Chelsea in 2022 and went on loan to Arsenal in 2024.",
        "I left Liverpool for Manchester City in 2015 and won four Premier League titles there.",
    ]),
    ("who-defoe", "Jermain Defoe", ["Peter Crouch", "Darren Bent", "Robbie Keane"], None, "Jermain_Defoe", [
        "I was born in Beckton, London, in 1982.",
        "On loan at Bournemouth as a teenager, I scored in 10 games in a row.",
        "I later played for Toronto FC and Rangers.",
        "I scored five goals in one Premier League game for Tottenham against Wigan in 2009.",
        "I scored 162 Premier League goals for clubs including West Ham, Spurs and Sunderland.",
    ]),
    ("who-vannistelrooy", "Ruud van Nistelrooy", ["Louis Saha", "Dimitar Berbatov", "Ole Gunnar Solskjær"], None, "Ruud_van_Nistelrooy", [
        "I was born in Oss, Netherlands, in 1976.",
        "I played for Den Bosch, Heerenveen and PSV.",
        "I later played for Real Madrid, Hamburg and Málaga.",
        "I managed PSV, and later Leicester City.",
        "I won the Premier League Golden Boot with Manchester United in 2002-03.",
    ]),
    ("who-berbatov", "Dimitar Berbatov", ["Robbie Keane", "Ruud van Nistelrooy", "Carlos Tevez"], None, "Dimitar_Berbatov", [
        "I was born in Blagoevgrad, Bulgaria, in 1981.",
        "I played for CSKA Sofia and Bayer Leverkusen.",
        "I later played for Fulham and Monaco.",
        "I scored five goals in one Premier League game, against Blackburn in 2010.",
        "I moved from Tottenham to Manchester United in 2008 and shared the 2010-11 Golden Boot.",
    ]),
    ("who-vidic", "Nemanja Vidić", ["Jaap Stam", "Branislav Ivanović", "Rio Ferdinand"], None, "Nemanja_Vidi%C4%87", [
        "I was born in Užice, Yugoslavia, in 1981.",
        "I played for Red Star Belgrade and Spartak Moscow.",
        "I finished my playing career at Inter Milan.",
        "I was Premier League Player of the Season twice.",
        "I joined Manchester United in January 2006 and partnered Rio Ferdinand at centre-back.",
    ]),
    ("who-vandersar", "Edwin van der Sar", ["Tim Howard", "Ben Foster", "Petr Čech"], None, "Edwin_van_der_Sar", [
        "I was born in Voorhout, Netherlands, in 1970.",
        "I won the Champions League with Ajax in 1995.",
        "I played for Juventus, then joined Fulham in 2001.",
        "I set a Premier League record of 1,311 minutes without conceding in 2008-09.",
        "I saved Nicolas Anelka's penalty to win the 2008 Champions League final for Manchester United.",
    ]),
    ("who-makelele", "Claude Makélélé", ["Michael Essien", "Lassana Diarra", "Patrick Vieira"], None, "Claude_Mak%C3%A9l%C3%A9l%C3%A9", [
        "I was born in Kinshasa, Zaire, in 1973.",
        "I played for Nantes, Marseille and Celta Vigo.",
        "I won the Champions League with Real Madrid in 2002.",
        "I finished my playing career at Paris Saint-Germain.",
        "A defensive midfield role is named after me, and I won two Premier League titles with Chelsea.",
    ]),
    ("who-cahill", "Tim Cahill", ["Mile Jedinak", "Harry Kewell", "Marouane Fellaini"], None, "Tim_Cahill", [
        "I was born in Sydney in 1979.",
        "I played for Samoa's under-20 side as a teenager.",
        "I scored the winner in the 2004 FA Cup semi-final for Millwall.",
        "I'm Australia's all-time top goalscorer.",
        "I joined Everton in 2004 and celebrated goals by boxing the corner flag.",
    ]),
    ("who-carragher", "Jamie Carragher", ["Jamie Redknapp", "Sami Hyypiä", "Steven Gerrard"], None, "Jamie_Carragher", [
        "I was born in Bootle in 1978.",
        "I supported Everton as a boy, before joining Liverpool's academy.",
        "I scored two own goals in one game against Manchester United in 1999.",
        "I became a Sky Sports pundit after retiring in 2013.",
        "I'm a one-club man who made 737 appearances for Liverpool.",
    ]),
    ("who-ozil", "Mesut Özil", ["Santi Cazorla", "Toni Kroos", "Henrikh Mkhitaryan"], None, "Mesut_%C3%96zil", [
        "I was born in Gelsenkirchen, Germany, in 1988.",
        "I played for Schalke and Werder Bremen.",
        "I won the World Cup with Germany in 2014.",
        "I finished my career in Turkey, with Fenerbahçe and İstanbul Başakşehir.",
        "I joined Arsenal from Real Madrid in 2013 for a club-record fee.",
    ]),
    ("who-rodri", "Rodri", ["Sergio Busquets", "Fernandinho", "İlkay Gündoğan"], None, "Rodri_(footballer,_born_1996)", [
        "I was born in Madrid in 1996.",
        "I played for Villarreal and Atlético Madrid.",
        "I was player of the tournament as Spain won Euro 2024.",
        "I won the Ballon d'Or in 2024.",
        "I scored the winner for Manchester City in the 2023 Champions League final.",
    ]),
    ("who-foden", "Phil Foden", ["Jack Grealish", "Mason Mount", "Cole Palmer"], None, "Phil_Foden", [
        "I was born in Stockport in 2000.",
        "I was player of the tournament as England won the 2017 Under-17 World Cup.",
        "I won Premier League Young Player of the Season in 2021 and 2022.",
        "I was FWA Footballer of the Year and Premier League Player of the Season in 2024.",
        "I came through Manchester City's academy and won the treble with them in 2023.",
    ]),
    ("who-palmer", "Cole Palmer", ["Conor Gallagher", "Noni Madueke", "Phil Foden"], None, "Cole_Palmer", [
        "I was born in Wythenshawe, Manchester, in 2002.",
        "I came through Manchester City's academy.",
        "I scored for England in the Euro 2024 final.",
        "I scored twice in the 2025 Club World Cup final.",
        "I joined Chelsea in 2023 and celebrate goals by crossing my arms and rubbing my shoulders.",
    ]),
    ("who-trent", "Trent Alexander-Arnold", ["Joe Gomez", "Kyle Walker", "Andrew Robertson"], None, "Trent_Alexander-Arnold", [
        "I was born in West Derby, Liverpool, in 1998.",
        "My professional debut was against Tottenham in the League Cup in October 2016.",
        "My quick corner set up Divock Origi's goal against Barcelona in 2019.",
        "I joined Real Madrid in 2025.",
        "I'm a right-back from Liverpool's academy who won the Champions League and Premier League with them.",
    ]),
    ("who-robertson", "Andrew Robertson", ["Kieran Tierney", "Ben Davies", "Trent Alexander-Arnold"], None, "Andrew_Robertson", [
        "I was born in Glasgow in 1994.",
        "I was released by Celtic as a teenager and played for Queen's Park and Dundee United.",
        "I played for Hull City before my big move in 2017.",
        "I captain Scotland.",
        "I won the Champions League with Liverpool in 2019, then joined Tottenham in 2026.",
    ]),
    ("who-eriksen", "Christian Eriksen", ["Christian Nørgaard", "Pierre-Emile Højbjerg", "Dele Alli"], None, "Christian_Eriksen", [
        "I was born in Middelfart, Denmark, in 1992.",
        "I played for Ajax before moving to England in 2013.",
        "I won Serie A with Inter Milan in 2021.",
        "I suffered a cardiac arrest on the pitch at Euro 2020, and came back to play for Brentford.",
        "I starred for Tottenham, and later played for Manchester United.",
    ]),
    ("who-zaha", "Wilfried Zaha", ["Yannick Bolasie", "Andros Townsend", "Michael Olise"], None, "Wilfried_Zaha", [
        "I was born in Abidjan, Ivory Coast, in 1992, and grew up in Thornton Heath.",
        "I played twice for England before switching to the Ivory Coast.",
        "I joined Manchester United in 2013 but played only a handful of games.",
        "I joined Galatasaray in 2023.",
        "I came through Crystal Palace's academy and I'm one of their greatest ever players.",
    ]),
    ("who-keane", "Robbie Keane", ["Damien Duff", "Shane Long", "Jermain Defoe"], None, "Robbie_Keane", [
        "I was born in Dublin in 1980.",
        "I started at Wolves and also played for Coventry, Inter Milan and Leeds.",
        "I won three MLS Cups with LA Galaxy.",
        "I celebrated goals with a cartwheel and a forward roll.",
        "I'm the Republic of Ireland's all-time top scorer, and spent seven and a half years at Tottenham over two spells.",
    ]),
    ("who-hasselbaink", "Jimmy Floyd Hasselbaink", ["Patrick Kluivert", "Pierre van Hooijdonk", "Gianfranco Zola"], None, "Jimmy_Floyd_Hasselbaink", [
        "I was born in Paramaribo, Suriname, in 1972.",
        "I played for Boavista in Portugal and Atlético Madrid in Spain.",
        "As a manager I've been in charge of Burton Albion and QPR.",
        "I won the Premier League Golden Boot twice, with Leeds and with Chelsea.",
        "I joined Chelsea from Atlético Madrid for a club-record £15 million in 2000.",
    ]),
    ("who-okocha", "Jay-Jay Okocha", ["Nwankwo Kanu", "El Hadji Diouf", "Youri Djorkaeff"], None, "Jay-Jay_Okocha", [
        "I was born in Enugu, Nigeria, in 1973.",
        "I played for Eintracht Frankfurt, Fenerbahçe and Paris Saint-Germain.",
        "I won Olympic gold with Nigeria in 1996.",
        "I later played for Qatar SC and Hull City.",
        "I captained Bolton Wanderers, and fans said I was so good they named me twice.",
    ]),
    ("who-park", "Park Ji-sung", ["Son Heung-min", "Lee Young-pyo", "Ki Sung-yueng"], None, "Park_Ji-sung", [
        "I was born in Seoul in 1981.",
        "I played for Kyoto Purple Sanga in Japan, then PSV Eindhoven.",
        "I scored at three World Cups, in 2002, 2006 and 2010.",
        "I later played for QPR, then went back to PSV on loan.",
        "I won four Premier League titles with Manchester United and was nicknamed 'Three-Lung Park'.",
    ]),
    ("who-solskjaer", "Ole Gunnar Solskjær", ["Andy Cole", "Teddy Sheringham", "Dwight Yorke"], None, "Ole_Gunnar_Solskj%C3%A6r", [
        "I was born in Kristiansund, Norway, in 1973.",
        "I joined my most famous club from Molde in 1996.",
        "As a manager I've been in charge of Molde and Cardiff City.",
        "I came off the bench to score four goals against Nottingham Forest in an 8-1 win in 1999.",
        "I scored the injury-time winner in the 1999 Champions League final, and later managed Manchester United.",
    ]),
    ("who-lukaku", "Romelu Lukaku", ["Christian Benteke", "Michy Batshuayi", "Divock Origi"], None, "Romelu_Lukaku", [
        "I was born in Antwerp in 1993.",
        "I began my senior career at Anderlecht.",
        "I'm Belgium's all-time top goalscorer.",
        "I won Serie A with Inter Milan in 2021, and again with Napoli in 2025.",
        "I scored lots of goals for Everton, played for Manchester United, and had two spells at Chelsea.",
    ]),
    ("who-watkins", "Ollie Watkins", ["Dominic Calvert-Lewin", "Danny Ings", "Ivan Toney"], None, "Ollie_Watkins", [
        "I was born in Torquay in 1995.",
        "I started at Exeter City and had a loan spell at Weston-super-Mare.",
        "I scored a hat-trick against Liverpool in a 7-2 win in 2020.",
        "I scored a late winner against the Netherlands in the Euro 2024 semi-final.",
        "I joined Aston Villa from Brentford in 2020.",
    ]),
    ("who-isak", "Alexander Isak", ["Viktor Gyökeres", "Callum Wilson", "Dejan Kulusevski"], None, "Alexander_Isak", [
        "I was born in Stockholm in 1999 and raised in Solna.",
        "I played for AIK, Borussia Dortmund and Real Sociedad.",
        "I scored 23 Premier League goals in 2024-25.",
        "I scored in the 2025 League Cup final, ending Newcastle's long wait for a major trophy.",
        "I joined Liverpool from Newcastle for a British record fee in 2025.",
    ]),
]

# Extra accepted answers, on top of the full name and the surname (everything
# after the first name). Accents and capitals are ignored when matching.
ALIASES = {
    "who-henry": ["Titi"],
    "who-ronaldo": ["Ronaldo", "CR7", "Cristiano"],
    "who-aguero": ["Kun Aguero", "Kun"],
    "who-salah": ["Mo Salah", "Mo"],
    "who-kane": ["Harry Kane"],
    "who-kante": ["Kante"],
    "who-debruyne": ["KDB"],
    "who-cech": ["Cech"],
    "who-vanpersie": ["RVP", "Persie"],
    "who-son": ["Son", "Sonny", "Heung-min Son", "Son Heungmin"],
    "who-yaya": ["Yaya", "Toure"],
    "who-vandijk": ["VVD", "Dijk"],
    "who-whu-dicanio": ["Canio"],
    "who-whu-soucek": ["Soucek"],
    "who-bha-gross": ["Gross", "Pascal Gross"],
    "who-bha-macallister": ["MacAllister", "Macca"],
    "who-bha-caicedo": ["Moises Caicedo"],
    "who-bha-welbeck": ["Welbz"],
    "who-pires": ["Pires"],
    "who-torres": ["El Nino", "Nando"],
    "who-modric": ["Modric"],
    "who-fabregas": ["Fabregas", "Cesc"],
    "who-dsilva": ["Silva", "Merlin"],
    "who-mane": ["Mane"],
    "who-odegaard": ["Odegaard", "Martin Odegaard"],
    "who-bruno": ["Bruno", "Bruno Fernandes"],
    "who-vannistelrooy": ["RVN", "Van Nistelrooy", "Ruud"],
    "who-vidic": ["Vidic"],
    "who-vandersar": ["VDS", "Van der Sar"],
    "who-makelele": ["Makelele"],
    "who-ozil": ["Ozil"],
    "who-rodri": ["Rodrigo", "Rodrigo Hernandez", "Rodri Hernandez"],
    "who-trent": ["Trent", "TAA", "Alexander-Arnold"],
    "who-robertson": ["Robbo", "Andy Robertson"],
    "who-hasselbaink": ["Jimmy Hasselbaink", "Jimmy Floyd"],
    "who-okocha": ["Jay Jay", "JJ Okocha", "Okocha"],
    "who-park": ["Park", "Ji-sung Park", "Park Jisung"],
    "who-solskjaer": ["Solskjaer", "Ole", "Ole Solskjaer"],
}


def build(path):
    rng = random.Random(42)
    out, ids = [], set()
    known = {sid for sid, *_ in SETS}
    assert set(ALIASES) <= known, set(ALIASES) - known
    for sid, answer, decoys, club, page, clues in SETS:
        assert sid not in ids, sid
        ids.add(sid)
        assert len(clues) == 5, sid
        assert len(decoys) == 3 and answer not in decoys and len(set(decoys)) == 3, sid
        options = decoys + [answer]
        rng.shuffle(options)
        out.append({
            "id": sid, "clues": clues, "options": options, "answer": options.index(answer),
            "name": answer, "aliases": ALIASES.get(sid, []), "club": club, "verified": True, "source": W + page,
        })
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "sets": out}, f, ensure_ascii=False, indent=1)
    clubs = {}
    for s in out:
        clubs[s["club"] or "general"] = clubs.get(s["club"] or "general", 0) + 1
    print(f"{len(out)} sets:", clubs)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "data/whoami.json")
