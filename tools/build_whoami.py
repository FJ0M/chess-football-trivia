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
