"""The 92 clubs in the top four English divisions for 2026-27, with the ids the game uses: (id, full name, short name for card labels).
Source: Wikipedia 2026-27 Premier League / EFL Championship / League One / League Two pages (fetched 2026-11-04)."""
CLUBS = {
 "premier-league": [
  ("arsenal","Arsenal","Arsenal"),("aston-villa","Aston Villa","Aston Villa"),("bournemouth","AFC Bournemouth","Bournemouth"),("brentford","Brentford","Brentford"),
  ("brighton","Brighton & Hove Albion","Brighton"),("chelsea","Chelsea","Chelsea"),("coventry","Coventry City","Coventry"),("crystal-palace","Crystal Palace","Crystal Palace"),
  ("everton","Everton","Everton"),("fulham","Fulham","Fulham"),("hull","Hull City","Hull"),("ipswich","Ipswich Town","Ipswich"),("leeds","Leeds United","Leeds"),
  ("liverpool","Liverpool","Liverpool"),("man-city","Manchester City","Man City"),("man-utd","Manchester United","Man Utd"),("newcastle","Newcastle United","Newcastle"),
  ("nottm-forest","Nottingham Forest","Forest"),("sunderland","Sunderland","Sunderland"),("tottenham","Tottenham Hotspur","Spurs")],
 "championship": [
  ("birmingham","Birmingham City","Birmingham"),("blackburn","Blackburn Rovers","Blackburn"),("bolton","Bolton Wanderers","Bolton"),("bristol-city","Bristol City","Bristol City"),
  ("burnley","Burnley","Burnley"),("cardiff","Cardiff City","Cardiff"),("charlton","Charlton Athletic","Charlton"),("derby","Derby County","Derby"),("lincoln","Lincoln City","Lincoln"),
  ("middlesbrough","Middlesbrough","Middlesbrough"),("millwall","Millwall","Millwall"),("norwich","Norwich City","Norwich"),("portsmouth","Portsmouth","Portsmouth"),
  ("preston","Preston North End","Preston"),("qpr","Queens Park Rangers","QPR"),("sheffield-utd","Sheffield United","Sheffield Utd"),("southampton","Southampton","Southampton"),
  ("stoke","Stoke City","Stoke"),("swansea","Swansea City","Swansea"),("watford","Watford","Watford"),("west-brom","West Bromwich Albion","West Brom"),
  ("west-ham","West Ham United","West Ham"),("wolves","Wolverhampton Wanderers","Wolves"),("wrexham","Wrexham","Wrexham")],
 "league-one": [
  ("afc-wimbledon","AFC Wimbledon","AFC Wimbledon"),("barnsley","Barnsley","Barnsley"),("blackpool","Blackpool","Blackpool"),("bradford","Bradford City","Bradford"),("bromley","Bromley","Bromley"),
  ("burton","Burton Albion","Burton"),("cambridge-utd","Cambridge United","Cambridge"),("doncaster","Doncaster Rovers","Doncaster"),("huddersfield","Huddersfield Town","Huddersfield"),
  ("leicester","Leicester City","Leicester"),("leyton-orient","Leyton Orient","Leyton Orient"),("luton","Luton Town","Luton"),("mansfield","Mansfield Town","Mansfield"),
  ("mk-dons","Milton Keynes Dons","MK Dons"),("notts-county","Notts County","Notts County"),("oxford-utd","Oxford United","Oxford"),("peterborough","Peterborough United","Peterborough"),
  ("plymouth","Plymouth Argyle","Plymouth"),("reading","Reading","Reading"),("sheffield-wed","Sheffield Wednesday","Sheffield Wed"),("stevenage","Stevenage","Stevenage"),
  ("stockport","Stockport County","Stockport"),("wigan","Wigan Athletic","Wigan"),("wycombe","Wycombe Wanderers","Wycombe")],
 "league-two": [
  ("accrington","Accrington Stanley","Accrington"),("barnet","Barnet","Barnet"),("bristol-rovers","Bristol Rovers","Bristol Rovers"),("cheltenham","Cheltenham Town","Cheltenham"),
  ("chesterfield","Chesterfield","Chesterfield"),("colchester","Colchester United","Colchester"),("crawley","Crawley Town","Crawley"),("crewe","Crewe Alexandra","Crewe"),
  ("exeter","Exeter City","Exeter"),("fleetwood","Fleetwood Town","Fleetwood"),("gillingham","Gillingham","Gillingham"),("grimsby","Grimsby Town","Grimsby"),
  ("newport","Newport County","Newport"),("northampton","Northampton Town","Northampton"),("oldham","Oldham Athletic","Oldham"),("port-vale","Port Vale","Port Vale"),
  ("rochdale","Rochdale","Rochdale"),("rotherham","Rotherham United","Rotherham"),("salford","Salford City","Salford City"),("shrewsbury","Shrewsbury Town","Shrewsbury"),
  ("swindon","Swindon Town","Swindon"),("tranmere","Tranmere Rovers","Tranmere"),("walsall","Walsall","Walsall"),("york","York City","York")],
}
ALL = {cid: (name, short, div) for div, cs in CLUBS.items() for cid, name, short in cs}
assert [len(v) for v in CLUBS.values()] == [20, 24, 24, 24] and len(ALL) == 92
