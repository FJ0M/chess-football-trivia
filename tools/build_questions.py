"""Build the question bank JSON. Each entry: (category, difficulty, question, correct, [3 wrong], explanation)."""
import json, random, sys
from collections import Counter

CATS = {
    "titles": "Title races & champions",
    "goals": "Goals & records",
    "players": "Players & legends",
    "transfers": "Transfers",
    "managers": "Managers",
    "moments": "Iconic moments",
    "clubs": "Clubs & grounds",
    "cups": "Cups & Europe",
    "west-ham": "West Ham (bonus round)",
}

Q = [
# ---------- titles ----------
("titles",1,"Which team went the entire 2003-04 Premier League season unbeaten?","Arsenal",["Chelsea","Manchester United","Liverpool"],"Arsenal's 'Invincibles' won 26 and drew 12."),
("titles",1,"Which club won the 2015-16 Premier League as 5,000-1 outsiders?","Leicester City",["Tottenham Hotspur","West Ham United","Southampton"],"Leicester won it by 10 points under Claudio Ranieri."),
("titles",1,"Who did Manchester City beat on the final day of 2011-12 to snatch the title?","Queens Park Rangers",["Sunderland","Bolton Wanderers","Wigan Athletic"],"City beat QPR 3-2 with Agüero's goal at 93:20."),
("titles",1,"In which season did Liverpool win their first Premier League title?","2019-20",["2013-14","2018-19","2021-22"],"Liverpool won it by 18 points under Jürgen Klopp."),
("titles",1,"Which manager won Manchester United's last Premier League title, in 2012-13?","Sir Alex Ferguson",["David Moyes","José Mourinho","Louis van Gaal"],"It was Ferguson's 13th and final league title before retiring."),
("titles",2,"Which club became the first to reach 100 points in a Premier League season?","Manchester City",["Chelsea","Liverpool","Arsenal"],"Pep Guardiola's 'Centurions' got exactly 100 points in 2017-18."),
("titles",2,"How many points did Chelsea get when winning the title in 2004-05?","95",["90","92","98"],"Mourinho's first Chelsea side set a record of 95 points (since beaten by City)."),
("titles",2,"Who managed Chelsea to the 2016-17 Premier League title?","Antonio Conte",["José Mourinho","Carlo Ancelotti","Maurizio Sarri"],"Conte won it in his first season using a back three."),
("titles",2,"Which club became the first to win four English top-flight titles in a row (2020-21 to 2023-24)?","Manchester City",["Manchester United","Liverpool","Chelsea"],"No team had ever won four consecutive top-flight titles before."),
("titles",2,"Who managed Liverpool to the 2024-25 Premier League title in his first season?","Arne Slot",["Jürgen Klopp","Xabi Alonso","Ange Postecoglou"],"Slot took over from Klopp in summer 2024."),
("titles",2,"Who managed Manchester City to their first Premier League title in 2011-12?","Roberto Mancini",["Manuel Pellegrini","Mark Hughes","Pep Guardiola"],"It was City's first top-flight title for 44 years."),
("titles",3,"Who managed Manchester City to the 2013-14 Premier League title?","Manuel Pellegrini",["Roberto Mancini","Pep Guardiola","Mark Hughes"],"Pellegrini won the title and League Cup in his first season."),
("titles",2,"Who managed Chelsea to the league and FA Cup double in 2009-10?","Carlo Ancelotti",["Guus Hiddink","José Mourinho","Avram Grant"],"Chelsea scored 103 league goals that season."),
("titles",3,"Who captained Arsenal's 'Invincibles' in 2003-04?","Patrick Vieira",["Thierry Henry","Tony Adams","Sol Campbell"],"Vieira was captain from 2002 to 2005."),
("titles",3,"How many Premier League titles did Ryan Giggs win?","13",["10","11","15"],"Giggs holds the record for most Premier League titles."),
("titles",2,"Which of these clubs has NEVER won the Premier League?","Tottenham Hotspur",["Blackburn Rovers","Leicester City","Chelsea"],"Spurs' last league title was in 1960-61."),
("titles",3,"How many points did Derby County finish on in 2007-08, the lowest total in Premier League history?","11",["15","17","19"],"Derby won just one league game all season."),

# ---------- goals ----------
("goals",1,"Who is the Premier League's all-time top scorer?","Alan Shearer",["Wayne Rooney","Harry Kane","Thierry Henry"],"Shearer scored 260 Premier League goals."),
("goals",2,"Who is the Premier League's second-highest scorer of all time?","Harry Kane",["Wayne Rooney","Andy Cole","Sergio Agüero"],"Kane scored 213 for Spurs before joining Bayern Munich."),
("goals",2,"Who scored 36 league goals in 2022-23 to set a new single-season Premier League record?","Erling Haaland",["Mohamed Salah","Harry Kane","Sergio Agüero"],"Haaland did it in his first Premier League season."),
("goals",2,"How many league goals did Mohamed Salah score in 2017-18, a 38-game record at the time?","32",["28","30","34"],"Salah broke the 31-goal record shared by Shearer, Ronaldo and Suárez."),
("goals",3,"How many Premier League Golden Boots did Thierry Henry win?","4",["2","3","5"],"Henry won it in 2001-02, 2003-04, 2004-05 and 2005-06."),
("goals",2,"Which Southampton striker scored the fastest Premier League goal ever, after 7.69 seconds?","Shane Long",["Charlie Austin","Danny Ings","Rickie Lambert"],"Long scored it against Watford in April 2019."),
("goals",2,"Who scored the fastest Premier League hat-trick, in 2 minutes 56 seconds?","Sadio Mané",["Robbie Fowler","Sergio Agüero","Jamie Vardy"],"Mané did it for Southampton against Aston Villa in May 2015."),
("goals",2,"Which Tottenham striker scored five goals against Wigan in a 9-1 win in 2009?","Jermain Defoe",["Robbie Keane","Peter Crouch","Dimitar Berbatov"],"It is Tottenham's biggest Premier League win."),
("goals",3,"Jamie Vardy set a record by scoring in how many consecutive Premier League matches in 2015?","11",["9","10","12"],"He broke Ruud van Nistelrooy's record of 10."),
("goals",2,"By what score did Leicester beat Southampton at St Mary's in October 2019?","9-0",["7-0","8-0","6-1"],"It equalled the record Premier League winning margin."),
("goals",3,"Which game holds the record for most goals in a Premier League match (11)?","Portsmouth 7-4 Reading",["Arsenal 7-3 Newcastle","Tottenham 9-1 Wigan","Man Utd 8-2 Arsenal"],"It was played in September 2007."),
("goals",2,"Manchester United beat Arsenal by what score in August 2011?","8-2",["6-1","7-1","5-0"],"Wayne Rooney scored a hat-trick."),
("goals",3,"Chelsea clinched the 2009-10 title with an 8-0 win against which team?","Wigan Athletic",["Stoke City","Aston Villa","Sunderland"],"Didier Drogba's hat-trick won him the Golden Boot."),
("goals",2,"By what score did Aston Villa beat champions Liverpool in October 2020?","7-2",["5-2","6-1","4-0"],"Ollie Watkins scored a hat-trick."),
("goals",1,"Manchester City won 6-1 at Old Trafford in October 2011. Who were they playing?","Manchester United",["Arsenal","Tottenham Hotspur","Liverpool"],"Balotelli celebrated his goal with the 'Why always me?' T-shirt."),
("goals",2,"Which pair shared the 2021-22 Golden Boot with 23 goals each?","Salah and Son Heung-min",["Salah and Kane","Kane and Son Heung-min","Salah and Ronaldo"],"Son scored all 23 without a single penalty."),
("goals",3,"Who holds the record for most headed Premier League goals?","Peter Crouch",["Alan Shearer","Dion Dublin","Duncan Ferguson"],"Crouch scored 53 headers."),
("goals",3,"Which Stoke goalkeeper scored after 13 seconds against Southampton in 2013?","Asmir Begović",["Thomas Sørensen","Jack Butland","Shay Given"],"The wind carried his clearance into the net."),
("goals",3,"Frank Lampard scored how many Premier League goals, a record for a midfielder?","177",["150","165","191"],"He scored 147 of them for Chelsea."),
("goals",3,"Which two players share the record for most assists in a Premier League season (20)?","Thierry Henry and Kevin De Bruyne",["Cesc Fàbregas and Kevin De Bruyne","Thierry Henry and Frank Lampard","Mohamed Salah and Ryan Giggs"],"Henry did it in 2002-03, De Bruyne in 2019-20."),
("goals",2,"Who holds the record for most Premier League assists?","Ryan Giggs",["Frank Lampard","Cesc Fàbregas","Wayne Rooney"],"Giggs made 162 assists."),
("goals",2,"Who scored 29 league goals to win the 2024-25 Golden Boot?","Mohamed Salah",["Erling Haaland","Alexander Isak","Cole Palmer"],"Salah also made 18 assists that season."),

# ---------- players ----------
("players",1,"Who is Manchester United's all-time record goalscorer?","Wayne Rooney",["Bobby Charlton","Cristiano Ronaldo","Ryan Giggs"],"Rooney scored 253 goals, passing Bobby Charlton in 2017."),
("players",1,"Who is Arsenal's all-time record goalscorer?","Thierry Henry",["Ian Wright","Robin van Persie","Dennis Bergkamp"],"Henry scored 228 goals for Arsenal."),
("players",1,"Who is Manchester City's all-time record goalscorer?","Sergio Agüero",["Erling Haaland","Raheem Sterling","Eric Brook"],"Agüero scored 260 goals for City."),
("players",2,"Who is Chelsea's all-time record goalscorer?","Frank Lampard",["Didier Drogba","Bobby Tambling","Kerry Dixon"],"Lampard scored 211 goals for Chelsea."),
("players",2,"Whose record did Harry Kane break to become Tottenham's all-time top scorer in 2023?","Jimmy Greaves",["Bobby Smith","Martin Chivers","Gary Lineker"],"Greaves had held the record with 266 goals."),
("players",1,"Which Arsenal forward was nicknamed 'The Non-Flying Dutchman' because of his fear of flying?","Dennis Bergkamp",["Robin van Persie","Marc Overmars","Giovanni van Bronckhorst"],"Bergkamp often travelled to away games in Europe by car or train."),
("players",2,"Which goalkeeper holds the record for most Premier League clean sheets?","Petr Čech",["David James","Edwin van der Sar","David de Gea"],"Čech kept 202 clean sheets for Chelsea and Arsenal."),
("players",2,"Which club did Jamie Vardy play for before joining Leicester in 2012?","Fleetwood Town",["Halifax Town","Stocksbridge Park Steels","Crawley Town"],"He came through non-league football."),
("players",2,"Which Leicester winger won the PFA Player of the Year award in 2016?","Riyad Mahrez",["Jamie Vardy","N'Golo Kanté","Marc Albrighton"],"Mahrez scored 17 league goals in the title season."),
("players",2,"Cristiano Ronaldo won his first Ballon d'Or in 2008 while playing for which club?","Manchester United",["Real Madrid","Sporting CP","Juventus"],"He scored 31 league goals in 2007-08."),
("players",3,"Ryan Giggs scored in how many consecutive Premier League seasons?","21",["17","19","23"],"He scored in every season from 1992-93 to 2012-13."),
("players",2,"Which Stoke midfielder was famous for his long throw-ins?","Rory Delap",["Glenn Whelan","Matthew Etherington","Ricardo Fuller"],"His throws were treated like corners under Tony Pulis."),
("players",1,"Which Liverpool captain famously never won the Premier League?","Steven Gerrard",["Jordan Henderson","Jamie Carragher","Virgil van Dijk"],"Gerrard came closest in 2008-09 and 2013-14."),
("players",2,"Wayne Rooney's first Premier League goal, aged 16, was a late winner against which team?","Arsenal",["Liverpool","Manchester United","Leeds United"],"It ended Arsenal's 30-game unbeaten run in October 2002."),
("players",2,"Who scored the famous overhead kick winner for Manchester United in the February 2011 derby?","Wayne Rooney",["Dimitar Berbatov","Javier Hernández","Nani"],"It was voted the Premier League's goal of its first 20 seasons."),
("players",3,"Which Chelsea striker scored in four different FA Cup finals?","Didier Drogba",["Frank Lampard","Nicolas Anelka","Fernando Torres"],"He scored in 2007, 2009, 2010 and 2012."),

# ---------- transfers ----------
("transfers",1,"From which club did Liverpool sign Virgil van Dijk in January 2018?","Southampton",["Celtic","Ajax","Feyenoord"],"He cost about £75m, a world record for a defender at the time."),
("transfers",1,"Fernando Torres joined Chelsea in January 2011 from which club?","Liverpool",["Atlético Madrid","Barcelona","AC Milan"],"The fee was a British record of £50m."),
("transfers",1,"Which club did Gareth Bale leave to join Real Madrid in 2013?","Tottenham Hotspur",["Southampton","Arsenal","Manchester United"],"The fee was a world record at the time."),
("transfers",1,"Robin van Persie left Arsenal in 2012 and won the league with which club?","Manchester United",["Manchester City","Chelsea","Juventus"],"He won the Golden Boot with 26 goals that season."),
("transfers",1,"Harry Kane left Tottenham in 2023 to join which club?","Bayern Munich",["Manchester United","Real Madrid","Paris Saint-Germain"],"Kane had spent his whole senior career at Spurs."),
("transfers",1,"From which club did Manchester United sign Wayne Rooney in 2004?","Everton",["Liverpool","Leeds United","Newcastle United"],"He was 18 at the time."),
("transfers",1,"Philippe Coutinho left Liverpool for which club in January 2018?","Barcelona",["Real Madrid","Bayern Munich","Paris Saint-Germain"],"The money helped Liverpool fund Virgil van Dijk and Alisson."),
("transfers",1,"From which club did Manchester City sign Jack Grealish for £100m in 2021?","Aston Villa",["Birmingham City","Leicester City","Everton"],"It was the first £100m transfer by a British club."),
("transfers",2,"From which club did Manchester United sign Cristiano Ronaldo in 2003?","Sporting CP",["Benfica","Porto","Real Madrid"],"He impressed United's players in a friendly against Sporting."),
("transfers",2,"From which club did Chelsea sign Didier Drogba in 2004?","Marseille",["Lyon","Monaco","Paris Saint-Germain"],"He cost about £24m."),
("transfers",2,"From which club did Chelsea sign Eden Hazard in 2012?","Lille",["Anderlecht","Lyon","Standard Liège"],"He won the French league with Lille in 2011."),
("transfers",1,"N'Golo Kanté joined Chelsea in 2016 from which club?","Leicester City",["Caen","Marseille","Southampton"],"He won back-to-back titles with Leicester and Chelsea."),
("transfers",2,"From which club did Manchester City sign Kevin De Bruyne in 2015?","Wolfsburg",["Chelsea","Genk","Werder Bremen"],"He had previously been at Chelsea but played little."),
("transfers",2,"Sol Campbell joined Arsenal on a free transfer in 2001 from which rival?","Tottenham Hotspur",["Chelsea","West Ham United","Aston Villa"],"Spurs fans never forgave him."),
("transfers",2,"Ashley Cole left Arsenal in 2006 to join which club?","Chelsea",["Manchester United","Real Madrid","Liverpool"],"Fans called him 'Cashley' over the move."),
("transfers",2,"Raheem Sterling joined Manchester City in 2015 from which club?","Liverpool",["QPR","Chelsea","Arsenal"],"The fee was about £49m."),
("transfers",2,"Paul Pogba rejoined Manchester United in 2016 from which club?","Juventus",["Real Madrid","Paris Saint-Germain","Bayern Munich"],"The fee of about £89m was a world record at the time."),
("transfers",2,"Romelu Lukaku joined Manchester United in 2017 from which club?","Everton",["Chelsea","West Brom","Inter Milan"],"He later rejoined Chelsea from Inter in 2021."),
("transfers",2,"Moisés Caicedo joined Chelsea in 2023 for a British record fee from which club?","Brighton",["Southampton","Wolves","Crystal Palace"],"The fee was about £115m."),
("transfers",2,"From which club did Arsenal sign Thierry Henry in 1999?","Juventus",["Monaco","Barcelona","Inter Milan"],"Wenger had coached him at Monaco."),

# ---------- managers ----------
("managers",1,"Who replaced Sir Alex Ferguson as Manchester United manager in 2013?","David Moyes",["Louis van Gaal","José Mourinho","Ryan Giggs"],"Moyes moved from Everton but lasted less than a season."),
("managers",1,"Which manager called himself 'a special one' when he arrived at Chelsea in 2004?","José Mourinho",["Claudio Ranieri","Carlo Ancelotti","Rafael Benítez"],"He had just won the Champions League with Porto."),
("managers",1,"Jürgen Klopp joined Liverpool in 2015 after leaving which club?","Borussia Dortmund",["Mainz","Bayern Munich","Schalke"],"He won the Bundesliga twice with Dortmund."),
("managers",1,"Who has managed Arsenal since December 2019?","Mikel Arteta",["Unai Emery","Freddie Ljungberg","Thomas Tuchel"],"Arteta captained Arsenal as a player."),
("managers",2,"Who replaced Arsène Wenger as Arsenal manager in 2018?","Unai Emery",["Mikel Arteta","Patrick Vieira","Carlo Ancelotti"],"Wenger had been in charge for nearly 22 years."),
("managers",2,"Pep Guardiola joined Manchester City in 2016 from which club?","Bayern Munich",["Barcelona","Juventus","Paris Saint-Germain"],"He won three Bundesliga titles at Bayern."),
("managers",2,"How many Premier League titles did Arsène Wenger win with Arsenal?","3",["2","4","5"],"He won in 1997-98, 2001-02 and 2003-04."),
("managers",2,"Who managed Leicester City to the 2015-16 title?","Claudio Ranieri",["Nigel Pearson","Brendan Rodgers","Craig Shakespeare"],"Ranieri was sacked less than a year later."),
("managers",2,"Erik ten Hag joined Manchester United in 2022 from which club?","Ajax",["PSV Eindhoven","Feyenoord","Bayern Munich II"],"He won three Dutch titles with Ajax."),
("managers",2,"Ruben Amorim joined Manchester United in November 2024 from which club?","Sporting CP",["Benfica","Braga","Porto"],"He replaced Erik ten Hag."),
("managers",2,"Graham Potter left which club to become Chelsea manager in 2022?","Brighton",["Swansea City","Östersund","West Ham United"],"He lasted about seven months at Chelsea."),
("managers",2,"Kenny Dalglish returned for a second spell as Liverpool manager in 2011, replacing whom?","Roy Hodgson",["Rafael Benítez","Brendan Rodgers","Gérard Houllier"],"Dalglish won the League Cup in 2012."),
("managers",2,"Which club did Mauricio Pochettino lead to the 2019 Champions League final?","Tottenham Hotspur",["Southampton","Chelsea","Paris Saint-Germain"],"Spurs lost 2-0 to Liverpool in Madrid."),
("managers",3,"Who was manager when Chelsea won the Champions League in 2012?","Roberto Di Matteo",["André Villas-Boas","Guus Hiddink","Rafael Benítez"],"He was only interim manager at the time."),
("managers",3,"Who managed Wigan to their 2013 FA Cup win?","Roberto Martínez",["Paul Jewell","Steve Bruce","Uwe Rösler"],"Wigan were relegated from the Premier League days later."),
("managers",3,"Who managed Middlesbrough to the 2006 UEFA Cup final?","Steve McClaren",["Gareth Southgate","Bryan Robson","Terry Venables"],"He became England manager that summer."),

# ---------- moments ----------
("moments",2,"Which Chelsea defender did Luis Suárez bite in April 2013?","Branislav Ivanović",["John Terry","Gary Cahill","César Azpilicueta"],"Suárez was banned for 10 games."),
("moments",2,"After Steven Gerrard's slip against Chelsea in April 2014, who scored?","Demba Ba",["Fernando Torres","Willian","Eden Hazard"],"Chelsea won 2-0 and the title slipped away from Liverpool."),
("moments",3,"Who provided the assist for Sergio Agüero's title-winning goal against QPR in 2012?","Mario Balotelli",["David Silva","Edin Džeko","Yaya Touré"],"Balotelli slid the ball through from the edge of the box."),
("moments",3,"Arsenal's record unbeaten league run ended at Old Trafford in October 2004. How many games was it?","49",["38","45","52"],"The match became known as 'Pizzagate' or the 'Battle of the Buffet'."),
("moments",2,"Which two captains clashed in the Highbury tunnel before Arsenal v Man Utd in February 2005?","Patrick Vieira and Roy Keane",["Thierry Henry and Gary Neville","Sol Campbell and Rio Ferdinand","Patrick Vieira and Gary Neville"],"United won the match 4-2."),
("moments",2,"Mario Balotelli revealed a T-shirt with which slogan after scoring at Old Trafford in 2011?","Why always me?",["This is Manchester","Calma, calma","Who else?"],"City won the derby 6-1."),
("moments",1,"Which Leicester striker had the chant 'Jamie ___'s having a party'?","Vardy",["Carragher","Redknapp","Mackail-Smith"],"Vardy scored 24 league goals in the title season."),
("moments",2,"What technology was introduced to the Premier League in 2019-20?","VAR",["Goal-line technology","Semi-automated offside","Referee body cams"],"Goal-line technology had arrived in 2013-14."),
("moments",2,"Which team pulled off the 'Great Escape' in 2014-15, winning 7 of their last 9 games to stay up?","Leicester City",["West Brom","Sunderland","Hull City"],"A year later, Leicester were champions."),

# ---------- clubs ----------
("clubs",1,"Arsenal moved to the Emirates Stadium in 2006 from which ground?","Highbury",["White Hart Lane","Craven Cottage","The Valley"],"Highbury was converted into flats."),
("clubs",1,"Which club plays at Craven Cottage?","Fulham",["Brentford","QPR","Crystal Palace"],"It sits on the banks of the Thames."),
("clubs",1,"Which club plays at Turf Moor?","Burnley",["Blackburn Rovers","Bolton Wanderers","Preston North End"],"Burnley have played there since 1883."),
("clubs",2,"Which club played at the Liberty Stadium in the Premier League?","Swansea City",["Cardiff City","Hull City","Stoke City"],"Swansea spent 2011 to 2018 in the Premier League."),
("clubs",2,"Which club plays at the Amex Stadium?","Brighton",["Bournemouth","Southampton","Reading"],"Brighton moved there in 2011."),
("clubs",2,"Manchester City moved to their current stadium in 2003 from which ground?","Maine Road",["Hyde Road","Old Trafford","Boundary Park"],"The new stadium was built for the 2002 Commonwealth Games."),
("clubs",2,"Where did Tottenham play most home games in 2017-18 while their new stadium was built?","Wembley",["London Stadium","Stamford Bridge","Twickenham"],"The Tottenham Hotspur Stadium opened in April 2019."),
("clubs",1,"Which club is nicknamed 'The Toffees'?","Everton",["Liverpool","Blackburn Rovers","Sunderland"],"The name is linked to a local toffee shop."),
("clubs",1,"Which club is nicknamed 'The Black Cats'?","Sunderland",["Newcastle United","Hull City","Middlesbrough"],"Their stadium is the Stadium of Light."),
("clubs",2,"Which club is nicknamed 'The Cherries'?","Bournemouth",["Brentford","Watford","Southampton"],"They first reached the Premier League in 2015."),
("clubs",2,"Which club is nicknamed 'The Potters'?","Stoke City",["Port Vale","Derby County","Wolves"],"It refers to the area's pottery industry."),
("clubs",2,"Which club is nicknamed 'The Baggies'?","West Brom",["Wolves","Birmingham City","Aston Villa"],"West Brom play at The Hawthorns."),
("clubs",2,"Which club is nicknamed 'The Hornets'?","Watford",["Brentford","Wycombe","Norwich City"],"Elton John was once Watford's owner."),
("clubs",3,"Which club finished 5th in the Premier League in 2000-01, their first season after promotion?","Ipswich Town",["Charlton Athletic","Bolton Wanderers","Fulham"],"George Burley was named Manager of the Year."),

# ---------- cups ----------
("cups",1,"Which team did Liverpool beat in the 2005 Champions League final in Istanbul?","AC Milan",["Juventus","Barcelona","Inter Milan"],"Liverpool came back from 3-0 down to win on penalties."),
("cups",1,"Manchester City won the treble in which season?","2022-23",["2018-19","2020-21","2023-24"],"They won the Premier League, FA Cup and Champions League."),
("cups",2,"Who scored the winner as Manchester City beat Inter Milan in the 2023 Champions League final?","Rodri",["Erling Haaland","Kevin De Bruyne","Phil Foden"],"City won 1-0 in Istanbul."),
("cups",2,"Who scored the winner when Chelsea beat Manchester City in the 2021 Champions League final?","Kai Havertz",["Mason Mount","Timo Werner","N'Golo Kanté"],"Chelsea won 1-0 in Porto."),
("cups",2,"Manchester United beat which team on penalties in the 2008 Champions League final in Moscow?","Chelsea",["Barcelona","Liverpool","Bayern Munich"],"John Terry slipped taking what would have been the winning penalty."),
("cups",2,"Which team beat Arsenal in the 2006 Champions League final?","Barcelona",["Real Madrid","AC Milan","Bayern Munich"],"Barcelona won 2-1 in Paris."),
("cups",2,"Portsmouth won the FA Cup in 2008 by beating which team in the final?","Cardiff City",["West Brom","Barnsley","Middlesbrough"],"Kanu scored the only goal."),
("cups",2,"Which team did Wigan beat in the 2013 FA Cup final?","Manchester City",["Arsenal","Chelsea","Millwall"],"Ben Watson headed a late winner."),
("cups",2,"Birmingham City beat which team in the 2011 League Cup final?","Arsenal",["Tottenham Hotspur","Aston Villa","Manchester United"],"Obafemi Martins scored the late winner."),
("cups",2,"Swansea won the 2013 League Cup by beating which team 5-0?","Bradford City",["Chelsea","Aston Villa","Wigan Athletic"],"Bradford were in League Two at the time."),
("cups",2,"Fulham reached the 2010 Europa League final under which manager?","Roy Hodgson",["Mark Hughes","Lawrie Sanchez","Chris Coleman"],"They lost to Atlético Madrid after extra time."),
("cups",2,"Which team did Tottenham beat in the 2025 Europa League final?","Manchester United",["Chelsea","Athletic Bilbao","Roma"],"Brennan Johnson scored the only goal in Bilbao."),
("cups",2,"Crystal Palace won their first major trophy in 2025, beating which team in the FA Cup final?","Manchester City",["Arsenal","Liverpool","Aston Villa"],"Eberechi Eze scored the only goal."),
("cups",2,"Newcastle won the 2025 League Cup final against which team?","Liverpool",["Manchester United","Arsenal","Chelsea"],"It was Newcastle's first major domestic trophy in 70 years."),
("cups",3,"Who scored Liverpool's goals in the 2019 Champions League final win over Tottenham?","Mohamed Salah and Divock Origi",["Sadio Mané and Mohamed Salah","Roberto Firmino and Divock Origi","Jordan Henderson and Sadio Mané"],"Salah scored a penalty in the second minute."),
("cups",3,"Which team knocked Leeds out in the 2001 Champions League semi-final?","Valencia",["Real Madrid","Bayern Munich","AC Milan"],"Leeds lost 3-0 on aggregate."),
("cups",3,"Which team beat Middlesbrough 4-0 in the 2006 UEFA Cup final?","Sevilla",["Steaua Bucharest","Basel","Espanyol"],"The final was in Eindhoven."),

# ---------- west ham ----------
("west-ham",1,"Which stadium did West Ham move to in 2016?","London Stadium",["Wembley","The Valley","Emirates Stadium"],"It was built for the 2012 Olympics."),
("west-ham",1,"What was West Ham's ground before 2016 better known as?","Upton Park",["The Den","Brisbane Road","Loftus Road"],"Its official name was the Boleyn Ground."),
("west-ham",1,"Which song do West Ham fans sing as their anthem?","I'm Forever Blowing Bubbles",["You'll Never Walk Alone","Glory Glory","Blue Moon"],"Bubbles fill the stadium before kick-off."),
("west-ham",1,"Which trophy did West Ham win in 2023?","Europa Conference League",["FA Cup","Europa League","League Cup"],"It was their first major trophy since 1980."),
("west-ham",2,"Who scored the late winner in the 2023 Europa Conference League final?","Jarrod Bowen",["Saïd Benrahma","Michail Antonio","Lucas Paquetá"],"West Ham beat Fiorentina 2-1 in Prague."),
("west-ham",2,"Which team did West Ham beat in the 2023 Europa Conference League final?","Fiorentina",["AZ Alkmaar","Anderlecht","Roma"],"Benrahma scored the first goal from the penalty spot."),
("west-ham",2,"Which manager led West Ham to the 2023 Europa Conference League?","David Moyes",["Slaven Bilić","Manuel Pellegrini","Sam Allardyce"],"It was Moyes's first major trophy as a manager."),
("west-ham",1,"Declan Rice left West Ham in 2023 to join which club?","Arsenal",["Manchester City","Chelsea","Bayern Munich"],"The fee of around £105m was a British record at the time."),
("west-ham",1,"Who is the long-serving West Ham captain known as 'Mr West Ham', who retired in 2022?","Mark Noble",["Kevin Nolan","Carlton Cole","James Collins"],"Noble spent his whole career at West Ham, apart from two short loans."),
("west-ham",2,"West Ham lost the 2006 FA Cup final on penalties to which team?","Liverpool",["Chelsea","Arsenal","Manchester United"],"Steven Gerrard's late screamer made it 3-3."),
("west-ham",2,"Who was West Ham's manager in the 2006 FA Cup final?","Alan Pardew",["Alan Curbishley","Glenn Roeder","Harry Redknapp"],"Pardew also won promotion with West Ham in 2005."),
("west-ham",2,"Carlos Tevez and Javier Mascherano joined West Ham in 2006 from which club?","Corinthians",["Boca Juniors","River Plate","Santos"],"The deal led to a Premier League inquiry."),
("west-ham",2,"Carlos Tevez scored the winner to keep West Ham up on the final day of 2006-07 at which ground?","Old Trafford",["Anfield","Stamford Bridge","Emirates Stadium"],"West Ham beat champions Manchester United 1-0."),
("west-ham",3,"West Ham were relegated in 2002-03 with how many points, a record for a relegated side?","42",["38","40","44"],"They were relegated despite a strong finish under Trevor Brooking."),
("west-ham",2,"Paolo Di Canio scored a famous scissor-kick volley against which team in March 2000?","Wimbledon",["Arsenal","Coventry City","Bradford City"],"It won Goal of the Season."),
("west-ham",3,"In December 2000, Paolo Di Canio caught the ball instead of shooting at an open goal against which team?","Everton",["Leeds United","Southampton","Derby County"],"Everton's keeper Paul Gerrard was lying injured, and Di Canio won a FIFA Fair Play award."),
("west-ham",2,"Rio Ferdinand left West Ham in 2000 for a British record fee to join which club?","Leeds United",["Manchester United","Liverpool","Chelsea"],"He moved on to Manchester United in 2002."),
("west-ham",2,"Which of these players did NOT come through the West Ham academy?","Steven Gerrard",["Frank Lampard","Joe Cole","Michael Carrick"],"Gerrard came through Liverpool's academy."),
("west-ham",3,"Who scored the winner in the 2012 Championship play-off final to send West Ham back up?","Ricardo Vaz Tê",["Kevin Nolan","Carlton Cole","Mark Noble"],"West Ham beat Blackpool 2-1 at Wembley."),
("west-ham",2,"Which former Chelsea forward managed West Ham from 2008 to 2010?","Gianfranco Zola",["Gianluca Vialli","Roberto Di Matteo","Ruud Gullit"],"Steve Clarke was his assistant."),
("west-ham",3,"Under which manager were West Ham relegated in 2010-11?","Avram Grant",["Gianfranco Zola","Alan Curbishley","Sam Allardyce"],"Grant was sacked on the day relegation was confirmed."),
("west-ham",2,"From which club did West Ham sign Dimitri Payet in 2015?","Marseille",["Lille","Lyon","Paris Saint-Germain"],"He went back to Marseille in January 2017."),
("west-ham",2,"Who was the first West Ham manager at the London Stadium?","Slaven Bilić",["Sam Allardyce","David Moyes","Manuel Pellegrini"],"Bilić played for West Ham in the 1990s."),
("west-ham",2,"Which team did West Ham beat 3-2 in their last ever game at Upton Park in May 2016?","Manchester United",["Swansea City","Arsenal","Tottenham Hotspur"],"Winston Reid headed the winner."),
("west-ham",2,"Which former Manchester City manager took charge of West Ham in 2018?","Manuel Pellegrini",["Roberto Mancini","Mark Hughes","Sven-Göran Eriksson"],"He was replaced by David Moyes in December 2019."),
("west-ham",3,"Which team knocked West Ham out in the 2021-22 Europa League semi-final?","Eintracht Frankfurt",["Rangers","Sevilla","Lyon"],"Frankfurt went on to win the tournament."),
("west-ham",3,"Which manager did Graham Potter replace at West Ham in January 2025?","Julen Lopetegui",["David Moyes","Nuno Espírito Santo","Steven Gerrard"],"Lopetegui lasted about half a season."),
("west-ham",2,"Who is West Ham's all-time top Premier League goalscorer?","Michail Antonio",["Jarrod Bowen","Paolo Di Canio","Carlton Cole"],"Antonio joined from Nottingham Forest in 2015."),
("west-ham",2,"West Ham were founded in 1895 under what name?","Thames Ironworks",["Woolwich Arsenal","Millwall Rovers","East London United"],"That's why the club is nicknamed 'The Irons'."),
("west-ham",1,"Which club are West Ham's fiercest traditional rivals?","Millwall",["Charlton Athletic","Leyton Orient","Crystal Palace"],"The rivalry goes back to the docks."),
("west-ham",3,"Which West Ham midfielder was named FWA Footballer of the Year in 2011, despite the club being relegated?","Scott Parker",["Mark Noble","Kevin Nolan","Matthew Upson"],"He joined Tottenham shortly afterwards."),
("west-ham",2,"Who became West Ham's joint owners in January 2010?","David Sullivan and David Gold",["Karren Brady and Alan Sugar","Björgólfur Guðmundsson and Eggert Magnússon","Terence Brown and Alan Pardew"],"They had previously owned Birmingham City."),
("west-ham",2,"From which club did West Ham sign Lucas Paquetá in 2022?","Lyon",["Flamengo","AC Milan","Paris Saint-Germain"],"He became the club's record signing at the time."),
("west-ham",2,"From which club did West Ham sign Jarrod Bowen in 2020?","Hull City",["Burnley","Brentford","Norwich City"],"Hull were in the Championship at the time."),
("west-ham",2,"From which club did West Ham sign Tomáš Souček in 2020?","Slavia Prague",["Sparta Prague","Ajax","Celtic"],"He joined on loan first, then permanently."),
("west-ham",2,"From which club did West Ham sign goalkeeper Łukasz Fabiański in 2018?","Swansea City",["Arsenal","Legia Warsaw","Celtic"],"He had earlier spent seven years at Arsenal."),
("west-ham",2,"Which West Ham academy defender was Roman Abramovich's first Chelsea signing in 2003?","Glen Johnson",["Rio Ferdinand","Anton Ferdinand","James Tomkins"],"West Ham had just been relegated."),
("west-ham",2,"Michael Carrick left West Ham in 2004 to join which club?","Tottenham Hotspur",["Manchester United","Chelsea","Aston Villa"],"He moved on to Manchester United two years later."),
("west-ham",2,"Frank Lampard's uncle managed West Ham until 2001. Who is he?","Harry Redknapp",["Billy Bonds","John Lyall","Glenn Roeder"],"Frank Lampard Sr was Redknapp's assistant."),
("west-ham",3,"Who scored the winner in the 2005 Championship play-off final to take West Ham up?","Bobby Zamora",["Marlon Harewood","Teddy Sheringham","Matthew Etherington"],"West Ham beat Preston 1-0 in Cardiff."),
("west-ham",3,"Which team did West Ham beat in the 2022 Europa League quarter-final?","Lyon",["Sevilla","Rapid Vienna","Genk"],"They had knocked out Sevilla in the last 16."),
("west-ham",2,"Which goalkeeper made a famous World Cup error for England in 2010 while a West Ham player?","Robert Green",["David James","Joe Hart","Ben Foster"],"Clint Dempsey's shot squirmed under him against the USA."),
("west-ham",2,"West Ham signed Sébastien Haller for a club record fee in 2019 from which club?","Eintracht Frankfurt",["Ajax","Utrecht","Borussia Dortmund"],"The fee was around £45m."),
("west-ham",2,"Which captain did Sam Allardyce sign from Newcastle in 2011?","Kevin Nolan",["Joey Barton","Alan Smith","Steven Taylor"],"Nolan had played for Allardyce at Bolton too."),
("west-ham",1,"What is on the West Ham badge along with the castle?","Two crossed hammers",["A lion","A ship","A cannon"],"The hammers come from the Thames Ironworks roots."),
("west-ham",1,"Which West Ham midfielder captained the club when they won the 2023 Europa Conference League?","Declan Rice",["Mark Noble","Jarrod Bowen","Tomáš Souček"],"It was his last game for West Ham before joining Arsenal."),
("west-ham",1,"What are West Ham's traditional colours?","Claret and blue",["Red and white","Blue and white","Black and white"],"Aston Villa and Burnley wear claret and blue too."),
("west-ham",1,"Which West Ham legend captained England to the 1966 World Cup?","Bobby Moore",["Geoff Hurst","Martin Peters","Billy Bonds"],"A statue of him stands outside the London Stadium."),
("west-ham",1,"Which of these is West Ham's nickname?","The Hammers",["The Toffees","The Saints","The Villans"],"They are also called 'The Irons'."),
("west-ham",3,"Who was West Ham's manager for most of the 2002-03 relegation season?","Glenn Roeder",["Alan Pardew","Harry Redknapp","Trevor Brooking"],"Trevor Brooking took over after Roeder fell ill in April 2003."),
("west-ham",2,"From which club did West Ham sign Marko Arnautović in 2017?","Stoke City",["Werder Bremen","Inter Milan","Twente"],"He was West Ham's player of the year in 2017-18."),
("west-ham",3,"Marko Arnautović left West Ham in 2019 to join which club?","Shanghai SIPG",["Bologna","Inter Milan","Guangzhou Evergrande"],"He returned to Europe with Bologna in 2021."),
("west-ham",3,"From which club did West Ham sign Javier Hernández in 2017?","Bayer Leverkusen",["Manchester United","Real Madrid","Sevilla"],"He had previously played for Manchester United."),
("west-ham",3,"Which club knocked West Ham out of Europa League qualifying in 2016, their first season at the London Stadium?","Astra Giurgiu",["Domžale","NK Rijeka","Steaua Bucharest"],"Astra won 1-0 in London after a 1-1 draw in Romania."),
("west-ham",3,"Where did West Ham finish in the 2020-21 Premier League?","6th",["5th","7th","8th"],"It was their highest Premier League points total (65)."),
("west-ham",3,"Which team did West Ham beat in the 2006 FA Cup semi-final?","Middlesbrough",["Chelsea","Bolton Wanderers","Charlton Athletic"],"Marlon Harewood scored the only goal at Villa Park."),
("west-ham",2,"Which veteran striker, the Premier League's oldest scorer at the time, played for West Ham aged 40 in 2006-07?","Teddy Sheringham",["Les Ferdinand","Ian Wright","Paolo Di Canio"],"He had won the treble with Manchester United in 1999."),

# ---------- batch 2 (playtest: more trivia, Nov 2026) ----------
# titles
("titles",1,"Which club won the 2004-05 Premier League, their first league title for 50 years?","Chelsea",["Arsenal","Manchester United","Liverpool"],"José Mourinho won it in his first season."),
("titles",1,"Which club won the Premier League in 2006-07, ending Chelsea's two-year reign?","Manchester United",["Arsenal","Liverpool","Manchester City"],"It was the first of three titles in a row for United."),
("titles",1,"Manchester City pipped Arsenal to the 2023-24 title on the final day. Who won the 2022-23 title?","Manchester City",["Arsenal","Liverpool","Newcastle United"],"Arsenal led for most of 2022-23 but City overtook them in the spring."),
("titles",1,"Manchester City beat Manchester United to the 2011-12 title on what?","Goal difference",["Head-to-head record","Goals scored","A play-off"],"Both clubs finished on 89 points."),
("titles",2,"Which club finished second behind Leicester in 2015-16?","Arsenal",["Tottenham Hotspur","Manchester City","Manchester United"],"Arsenal pipped Spurs to second on the final day."),
("titles",2,"Which club won the most Premier League titles in the 2010s (2010-11 to 2019-20)?","Manchester City",["Manchester United","Chelsea","Liverpool"],"City won four: 2012, 2014, 2018 and 2019."),
("titles",2,"Liverpool got 97 points in 2018-19 but finished second. By how many points did City beat them?","1",["2","3","4"],"City won their last 14 league games to finish on 98."),
("titles",2,"How many Premier League titles did Sir Alex Ferguson win?","13",["11","12","15"],"His last came in 2012-13, his final season."),
("titles",2,"Who managed Chelsea to the 2014-15 title?","José Mourinho",["Antonio Conte","Carlo Ancelotti","Guus Hiddink"],"It was Mourinho's third Premier League title with Chelsea."),
("titles",2,"Which club finished second to Manchester City in 2013-14?","Liverpool",["Chelsea","Arsenal","Everton"],"Liverpool led with three games left but finished two points behind."),
("titles",3,"How many points did Arsenal's 'Invincibles' finish with in 2003-04?","90",["86","88","93"],"They won 26 and drew 12 of their 38 games."),
("titles",3,"Manchester City won the 2017-18 title by how many points?","19",["12","15","22"],"City got 100 points; United were second with 81."),
("titles",3,"Which club finished second behind Chelsea in 2016-17?","Tottenham Hotspur",["Manchester City","Liverpool","Arsenal"],"Spurs got 86 points, their best Premier League total at the time."),
("titles",3,"How many points did Liverpool get when winning the 2019-20 title?","99",["95","97","100"],"They clinched it with seven games still to play."),
("titles",3,"Chelsea conceded how many league goals in 2004-05, a Premier League record low?","15",["12","18","21"],"Petr Čech kept 24 clean sheets that season."),
("titles",3,"Which club finished second behind Arsenal's Invincibles in 2003-04?","Chelsea",["Manchester United","Liverpool","Newcastle United"],"It was Chelsea's first season under Roman Abramovich."),

# goals
("goals",1,"Which Leicester striker scored in 11 Premier League games in a row in 2015?","Jamie Vardy",["Riyad Mahrez","Leonardo Ulloa","Shinji Okazaki"],"He broke Ruud van Nistelrooy's record of 10."),
("goals",1,"Alan Shearer scored his 260 Premier League goals for which two clubs?","Blackburn Rovers and Newcastle United",["Southampton and Newcastle United","Blackburn Rovers and Southampton","Newcastle United and Leeds United"],"He scored 112 for Blackburn and 148 for Newcastle."),
("goals",1,"Which Tottenham striker won back-to-back Golden Boots in 2015-16 and 2016-17?","Harry Kane",["Son Heung-min","Jermain Defoe","Dele Alli"],"Kane won a third Golden Boot in 2020-21."),
("goals",1,"Harry Kane is the all-time record goalscorer for which national team?","England",["Wales","Republic of Ireland","Scotland"],"He passed Wayne Rooney's record of 53 in 2023."),
("goals",1,"Which Liverpool striker scored 31 league goals in 2013-14?","Luis Suárez",["Daniel Sturridge","Raheem Sterling","Steven Gerrard"],"He was named PFA Player of the Year."),
("goals",2,"Which Manchester United striker won the 2002-03 Golden Boot with 25 goals?","Ruud van Nistelrooy",["Wayne Rooney","Louis Saha","Ole Gunnar Solskjær"],"United won the title that season."),
("goals",2,"Robin van Persie won the 2011-12 Golden Boot with 30 goals for which club?","Arsenal",["Manchester United","Feyenoord","Manchester City"],"He joined Manchester United that summer."),
("goals",3,"Which Manchester City striker won the 2014-15 Golden Boot?","Sergio Agüero",["Edin Džeko","Wilfried Bony","Álvaro Negredo"],"He scored 26 league goals."),

# players
("players",1,"Which country did Thierry Henry play for?","France",["Belgium","Ivory Coast","Senegal"],"He won the 1998 World Cup and Euro 2000."),
("players",1,"Which country does Erling Haaland play for?","Norway",["Denmark","Sweden","Iceland"],"His father Alf-Inge also played in the Premier League."),
("players",1,"Mohamed Salah plays international football for which country?","Egypt",["Morocco","Tunisia","Algeria"],"He joined Liverpool from Roma in 2017."),
("players",2,"Which Liverpool defender spent his whole career at the club before retiring in 2013?","Jamie Carragher",["Sami Hyypiä","Daniel Agger","Martin Škrtel"],"He made 737 appearances for Liverpool."),
("players",2,"Which Manchester City captain scored a long-range winner against Leicester in May 2019 that all but won the title?","Vincent Kompany",["Fernandinho","David Silva","Kevin De Bruyne"],"It was his last home game for City."),
("players",2,"Which Chelsea goalkeeper fractured his skull in a game at Reading in October 2006?","Petr Čech",["Carlo Cudicini","Hilário","Ross Turnbull"],"He wore a protective headguard for the rest of his career."),
("players",3,"Which Bolton playmaker was hailed by fans as 'so good they named him twice'?","Jay-Jay Okocha",["Youri Djorkaeff","Iván Campo","El Hadji Diouf"],"He captained Bolton in the 2004 League Cup final."),
("players",3,"Which goalkeeper played 310 Premier League games in a row, a record?","Brad Friedel",["David James","Shay Given","Mark Schwarzer"],"The run covered spells at Blackburn, Aston Villa and Tottenham."),
("players",3,"Kevin De Bruyne won the PFA Player of the Year in 2020 and which other year?","2021",["2018","2019","2023"],"He won it in back-to-back seasons."),
("players",3,"Who won the PFA Player of the Year award for 2023-24?","Phil Foden",["Erling Haaland","Cole Palmer","Bukayo Saka"],"Foden scored 19 league goals as City won a fourth title in a row."),
("players",3,"Who won the PFA Player of the Year award in 2006?","Steven Gerrard",["Thierry Henry","Frank Lampard","John Terry"],"He also scored twice in that year's FA Cup final."),
("players",3,"Which Manchester City midfielder was African Footballer of the Year four years running from 2011 to 2014?","Yaya Touré",["Michael Essien","Didier Drogba","Riyad Mahrez"],"He scored 20 league goals in 2013-14."),

# transfers
("transfers",1,"From which club did Chelsea sign Cole Palmer in 2023?","Manchester City",["Manchester United","Leicester City","Aston Villa"],"He was named PFA Young Player of the Year in his first season."),
("transfers",1,"From which club did Manchester City sign Erling Haaland in 2022?","Borussia Dortmund",["RB Salzburg","Bayern Munich","Molde"],"He scored 52 goals in all competitions in his first City season."),
("transfers",1,"Riyad Mahrez joined Manchester City in 2018 from which club?","Leicester City",["Le Havre","Marseille","Southampton"],"He won the treble with City in 2023."),
("transfers",2,"From which club did Liverpool sign Mohamed Salah in 2017?","Roma",["Chelsea","Fiorentina","Basel"],"He had played little at Chelsea a few years earlier."),
("transfers",2,"From which club did Manchester City sign Sergio Agüero in 2011?","Atlético Madrid",["Independiente","Real Madrid","Boca Juniors"],"A year later his goal won City the title."),
("transfers",2,"From which club did Liverpool sign Luis Suárez in January 2011?","Ajax",["PSV Eindhoven","Groningen","Nacional"],"He arrived on the same day Fernando Torres left for Chelsea."),
("transfers",2,"From which club did Arsenal sign Mesut Özil in 2013?","Real Madrid",["Werder Bremen","Schalke","Bayern Munich"],"He was Arsenal's record signing at the time."),
("transfers",2,"From which club did Arsenal sign Martin Ødegaard?","Real Madrid",["Real Sociedad","Strømsgodset","Ajax"],"He joined on loan in 2021, then permanently."),
("transfers",2,"From which club did Manchester United sign Bruno Fernandes in January 2020?","Sporting CP",["Benfica","Sampdoria","Porto"],"He had played in Italy before moving to Portugal."),
("transfers",2,"From which club did Newcastle sign Alexander Isak in 2022?","Real Sociedad",["Borussia Dortmund","AIK","Ajax"],"He was Newcastle's record signing at the time."),
("transfers",2,"Chelsea broke the British transfer record in January 2023 to sign Enzo Fernández from which club?","Benfica",["River Plate","Porto","Sporting CP"],"He had just won the World Cup with Argentina."),
("transfers",3,"From which club did Arsenal sign Cesc Fàbregas as a teenager in 2003?","Barcelona",["Espanyol","Valencia","Real Madrid"],"He later returned to Barcelona in 2011."),
("transfers",3,"From which club did Chelsea sign goalkeeper Petr Čech in 2004?","Rennes",["Sparta Prague","Lyon","Bordeaux"],"He won four Premier League titles with Chelsea."),
("transfers",3,"From which club did Liverpool sign goalkeeper Alisson Becker in 2018?","Roma",["Internacional","Benfica","Porto"],"He was briefly the world's most expensive goalkeeper."),
("transfers",3,"From which club did Manchester City sign Rodri in 2019?","Atlético Madrid",["Villarreal","Real Madrid","Valencia"],"He won the Ballon d'Or in 2024."),
("transfers",3,"From which club did Tottenham sign Son Heung-min in 2015?","Bayer Leverkusen",["Hamburg","Borussia Dortmund","Wolfsburg"],"He became Spurs captain in 2023."),
("transfers",3,"From which club did Liverpool sign Fernando Torres in 2007?","Atlético Madrid",["Real Madrid","Valencia","Villarreal"],"He scored 24 league goals in his first season."),
("transfers",3,"From which club did Manchester United sign Dimitar Berbatov in 2008?","Tottenham Hotspur",["Bayer Leverkusen","CSKA Sofia","Fulham"],"He shared the 2010-11 Golden Boot with 20 goals."),
("transfers",3,"From which club did Chelsea sign Michael Essien in 2005?","Lyon",["Bastia","Marseille","Monaco"],"He won two Premier League titles at Chelsea."),
("transfers",3,"From which club did Liverpool sign Jordan Henderson in 2011?","Sunderland",["Middlesbrough","Newcastle United","Leeds United"],"He went on to lift the Premier League and Champions League as captain."),

# managers
("managers",1,"Which manager led Manchester City to the treble in 2022-23?","Pep Guardiola",["Roberto Mancini","Manuel Pellegrini","Mikel Arteta"],"City won the league, FA Cup and Champions League."),
("managers",1,"Who managed Arsenal for nearly 22 years until 2018?","Arsène Wenger",["George Graham","Unai Emery","Bruce Rioch"],"He arrived from Nagoya Grampus in 1996."),
("managers",1,"Who managed Newcastle to the 2025 League Cup?","Eddie Howe",["Rafael Benítez","Steve Bruce","Alan Pardew"],"Howe had earlier taken Bournemouth from League Two to the Premier League."),
("managers",2,"Which club did Mauricio Pochettino manage before joining Tottenham in 2014?","Southampton",["Espanyol","Paris Saint-Germain","Chelsea"],"It was his first job in English football."),
("managers",2,"Who won a cup treble of FA Cup, League Cup and UEFA Cup with Liverpool in 2001?","Gérard Houllier",["Rafael Benítez","Roy Evans","Kenny Dalglish"],"Liverpool won all three in a few months."),
("managers",2,"Which German was appointed Manchester United's interim manager in late 2021?","Ralf Rangnick",["Jürgen Klopp","Thomas Tuchel","Julian Nagelsmann"],"He replaced Ole Gunnar Solskjær."),
("managers",3,"André Villas-Boas joined Chelsea in 2011 from which club?","Porto",["Benfica","Académica","Zenit"],"He had just won the Europa League with Porto."),
("managers",3,"Who managed Blackpool in their only Premier League season, 2010-11?","Ian Holloway",["Gary Megson","Simon Grayson","Tony Pulis"],"Blackpool were relegated on the final day."),
("managers",3,"Who managed Bolton to sixth place in the Premier League in 2004-05?","Sam Allardyce",["Gary Megson","Colin Todd","Sammy Lee"],"Bolton qualified for the UEFA Cup."),
("managers",3,"Who managed Leicester during their 'Great Escape' in 2014-15?","Nigel Pearson",["Claudio Ranieri","Craig Shakespeare","Sven-Göran Eriksson"],"He was replaced by Ranieri that summer."),
("managers",3,"Who replaced José Mourinho as Chelsea manager in September 2007?","Avram Grant",["Luiz Felipe Scolari","Guus Hiddink","Carlo Ancelotti"],"Grant took Chelsea to the Champions League final that season."),
("managers",3,"Who was Chelsea's interim manager when they won the 2013 Europa League?","Rafael Benítez",["Roberto Di Matteo","Guus Hiddink","Avram Grant"],"Chelsea beat Benfica 2-1 in Amsterdam."),

# moments
("moments",1,"Who scored Manchester City's title-winning goal against QPR in May 2012?","Sergio Agüero",["Edin Džeko","Mario Balotelli","Carlos Tevez"],"It came 93 minutes and 20 seconds into the game."),
("moments",1,"Which Liverpool captain slipped against Chelsea in April 2014?","Steven Gerrard",["Jordan Henderson","Jamie Carragher","Martin Škrtel"],"Demba Ba ran clear to score."),
("moments",1,"Which Liverpool striker was banned for 10 games for biting Branislav Ivanović in 2013?","Luis Suárez",["Andy Carroll","Daniel Sturridge","Fabio Borini"],"Suárez joined Barcelona the following year."),
("moments",1,"Why was the Premier League paused for about three months in 2020?","The COVID-19 pandemic",["A players' strike","A TV rights dispute","Stadium safety checks"],"Games restarted in June 2020 behind closed doors."),
("moments",1,"Which Liverpool goalkeeper scored a stoppage-time header against West Brom in May 2021?","Alisson Becker",["Caoimhín Kelleher","Adrián","Simon Mignolet"],"The goal helped Liverpool qualify for the Champions League."),
("moments",2,"Which club were docked points twice in 2023-24 for breaking the Premier League's financial rules?","Everton",["Nottingham Forest","Chelsea","Leicester City"],"Forest were also docked points once that season."),
("moments",3,"Who did Arsenal play in their last game at Highbury in May 2006?","Wigan Athletic",["Tottenham Hotspur","Manchester United","Everton"],"Arsenal won 4-2 and Thierry Henry scored a hat-trick."),
("moments",3,"What was the score in the 'Pizzagate' match that ended Arsenal's 49-game unbeaten run?","Manchester United 2-0 Arsenal",["Manchester United 1-0 Arsenal","Manchester United 2-1 Arsenal","Manchester United 3-1 Arsenal"],"Van Nistelrooy and Rooney scored in October 2004."),
("moments",3,"Tottenham led Manchester United 3-0 at half-time in September 2001. What was the final score?","Tottenham 3-5 Manchester United",["Tottenham 3-3 Manchester United","Tottenham 4-3 Manchester United","Tottenham 3-4 Manchester United"],"United scored five times in the second half."),
("moments",3,"Newcastle came from 4-0 down to draw 4-4 with Arsenal in February 2011. Who scored the late volley to make it 4-4?","Cheick Tioté",["Joey Barton","Leon Best","Kevin Nolan"],"It was Tioté's only goal for Newcastle."),

# clubs
("clubs",1,"Which club plays at St James' Park in the Premier League?","Newcastle United",["Sunderland","Middlesbrough","Exeter City"],"Exeter's ground has the same name."),
("clubs",1,"Which club plays at Molineux?","Wolves",["West Brom","Stoke City","Birmingham City"],"Wolves have played there since 1889."),
("clubs",1,"Which club plays at Villa Park?","Aston Villa",["Birmingham City","West Brom","Wolves"],"It has hosted many FA Cup semi-finals."),
("clubs",2,"Which club moved to the Reebok Stadium in 1997?","Bolton Wanderers",["Blackburn Rovers","Wigan Athletic","Preston North End"],"It was later renamed several times."),
("clubs",2,"Which club plays at the Gtech Community Stadium?","Brentford",["Fulham","QPR","Watford"],"Brentford left Griffin Park for it in 2020."),
("clubs",2,"Which club plays at Bramall Lane?","Sheffield United",["Sheffield Wednesday","Barnsley","Rotherham United"],"It is one of the oldest football grounds in the world."),
("clubs",2,"Which club plays at Kenilworth Road?","Luton Town",["Watford","Stevenage","MK Dons"],"Luton spent 2023-24 in the Premier League."),
("clubs",2,"Everton moved to a new stadium in 2025 at which dock?","Bramley-Moore Dock",["Albert Dock","Canning Dock","Salthouse Dock"],"They left Goodison Park after 133 years."),
("clubs",2,"Which club plays at the City Ground?","Nottingham Forest",["Notts County","Derby County","Leicester City"],"It sits on the banks of the River Trent."),
("clubs",3,"Which ground did Southampton leave in 2001?","The Dell",["The Valley","Fratton Park","Dean Court"],"They moved to St Mary's Stadium."),
("clubs",3,"Where did Brighton play from 1999 until they moved to the Amex in 2011?","Withdean Stadium",["Goldstone Ground","Priestfield Stadium","Fratton Park"],"It was an athletics stadium."),
("clubs",3,"Where did Swansea play before moving to the Liberty Stadium in 2005?","Vetch Field",["Ninian Park","Racecourse Ground","St Helen's"],"Swansea had played at the Vetch since 1912."),
("clubs",3,"Which was the first Welsh club to play in the Premier League?","Swansea City",["Cardiff City","Wrexham","Newport County"],"Swansea were promoted in 2011; Cardiff followed in 2013."),
("clubs",3,"Wimbledon FC moved to Milton Keynes and were renamed in 2004. What are they called now?","MK Dons",["AFC Wimbledon","Milton Keynes City","Buckingham Dons"],"Wimbledon fans set up AFC Wimbledon in 2002."),

# cups
("cups",1,"Which Chelsea striker scored the equaliser and the winning penalty in the 2012 Champions League final?","Didier Drogba",["Fernando Torres","Juan Mata","Frank Lampard"],"Chelsea beat Bayern Munich in Munich."),
("cups",1,"Which English club won the 2019 Champions League?","Liverpool",["Tottenham Hotspur","Manchester City","Chelsea"],"They beat Tottenham 2-0 in Madrid."),
("cups",1,"Which club won the 2024 FA Cup by beating Manchester City?","Manchester United",["Chelsea","Arsenal","Coventry City"],"Alejandro Garnacho and Kobbie Mainoo scored."),
("cups",1,"Which club beat Manchester United in the 2009 and 2011 Champions League finals?","Barcelona",["Real Madrid","Bayern Munich","AC Milan"],"Lionel Messi scored in both finals."),
("cups",1,"Which club won the 2008 Champions League?","Manchester United",["Chelsea","Liverpool","Arsenal"],"They beat Chelsea on penalties in Moscow."),
("cups",2,"Chelsea beat which club 4-1 in the 2019 Europa League final?","Arsenal",["Tottenham Hotspur","Eintracht Frankfurt","Valencia"],"The final was played in Baku."),
("cups",2,"Arsenal won the 2005 FA Cup final on penalties against which team?","Manchester United",["Chelsea","Liverpool","Millwall"],"It was the first FA Cup final decided by a shootout."),
("cups",2,"Who scored the winner for Manchester City in the 2011 FA Cup final?","Yaya Touré",["Carlos Tevez","David Silva","Mario Balotelli"],"City beat Stoke 1-0 for their first trophy in 35 years."),
("cups",2,"Leicester won their first FA Cup in 2021 by beating which team?","Chelsea",["Southampton","Manchester United","Arsenal"],"Youri Tielemans scored a long-range winner."),
("cups",2,"Manchester United won the 2017 Europa League by beating which club?","Ajax",["Celta Vigo","Lyon","Anderlecht"],"Paul Pogba and Henrikh Mkhitaryan scored."),
("cups",2,"Arsenal beat which club 5-1 on aggregate in the 2025 Champions League quarter-final?","Real Madrid",["Bayern Munich","Barcelona","Inter Milan"],"Declan Rice scored two free kicks in the first leg."),
("cups",3,"Liverpool beat which club 5-4 in the 2001 UEFA Cup final?","Alavés",["Sevilla","Valencia","Porto"],"It was won by a golden goal own goal in extra time."),
("cups",3,"Who headed Chelsea's late winner in the 2013 Europa League final?","Branislav Ivanović",["Fernando Torres","John Terry","Gary Cahill"],"Chelsea beat Benfica 2-1."),
("cups",3,"Arsenal lost the 2000 UEFA Cup final on penalties to which club?","Galatasaray",["Valencia","Parma","Lazio"],"The final was played in Copenhagen."),
("cups",3,"Middlesbrough won their first major trophy, the 2004 League Cup, by beating which team?","Bolton Wanderers",["Arsenal","Tottenham Hotspur","Aston Villa"],"Boro won 2-1 in Cardiff."),
("cups",3,"Who scored a second-half hat-trick for Tottenham in the 2019 Champions League semi-final in Amsterdam?","Lucas Moura",["Harry Kane","Son Heung-min","Fernando Llorente"],"The winner came in the sixth minute of stoppage time."),
("cups",3,"Which club beat Liverpool in the 2016 Europa League final?","Sevilla",["Villarreal","Atlético Madrid","Dortmund"],"Sevilla won it for the third year in a row."),
("cups",3,"Who scored Leicester's winner in the 2021 FA Cup final?","Youri Tielemans",["Jamie Vardy","James Maddison","Kelechi Iheanacho"],"Leicester beat Chelsea 1-0."),

# west ham
("west-ham",1,"Frank Lampard left West Ham in 2001 to join which club?","Chelsea",["Tottenham Hotspur","Leeds United","Aston Villa"],"He became Chelsea's all-time top scorer."),
("west-ham",1,"Which West Ham legend scored a hat-trick in the 1966 World Cup final?","Geoff Hurst",["Bobby Moore","Martin Peters","Trevor Brooking"],"He remains the only man to score a World Cup final hat-trick for England."),
("west-ham",1,"In which part of London is the London Stadium?","Stratford",["Upton Park","Canning Town","Barking"],"It sits in the Queen Elizabeth Olympic Park."),
("west-ham",1,"Which manager replaced David Moyes at West Ham in 2024?","Julen Lopetegui",["Graham Potter","Nuno Espírito Santo","Rafael Benítez"],"Lopetegui had managed Wolves before."),
("west-ham",2,"How many separate spells has David Moyes had as West Ham manager?","2",["1","3","4"],"His first spell was in 2017-18; he returned in December 2019."),
("west-ham",2,"Which country does Michail Antonio play international football for?","Jamaica",["England","Ghana","Trinidad and Tobago"],"He made his Jamaica debut in 2021."),
("west-ham",2,"Who replaced Alan Pardew as West Ham manager in December 2006?","Alan Curbishley",["Glenn Roeder","Gianfranco Zola","Sam Allardyce"],"Curbishley kept West Ham up that season."),
("west-ham",2,"Who did West Ham appoint as manager after relegation in 2011?","Sam Allardyce",["Steve McClaren","Alan Curbishley","Slaven Bilić"],"He won promotion at the first attempt."),
("west-ham",2,"West Ham won the 2012 Championship play-off final against which club?","Blackpool",["Cardiff City","Birmingham City","Reading"],"The final was at Wembley."),
("west-ham",2,"Who replaced Slaven Bilić as West Ham manager in November 2017?","David Moyes",["Manuel Pellegrini","Sam Allardyce","Rafael Benítez"],"Moyes kept the club up that season."),
("west-ham",2,"From which club did West Ham sign Mohammed Kudus in 2023?","Ajax",["PSV Eindhoven","Nordsjælland","Benfica"],"He was named Hammer of the Year in his first season."),
("west-ham",2,"Mohammed Kudus left West Ham in 2025 to join which club?","Tottenham Hotspur",["Chelsea","Arsenal","Al-Nassr"],"The fee was about £55m."),
("west-ham",2,"From which club did West Ham sign Saïd Benrahma in 2020?","Brentford",["Nice","Angers","Watford"],"He scored the first goal of the 2023 Conference League final."),
("west-ham",2,"From which club did West Ham sign Kurt Zouma in 2021?","Chelsea",["Saint-Étienne","Stoke City","Everton"],"He had won two Premier League titles at Chelsea."),
("west-ham",2,"Which Ecuador striker played for West Ham from 2014 to 2017?","Enner Valencia",["Felipe Caicedo","Antonio Valencia","Michael Estrada"],"He joined from Mexican club Pachuca."),
("west-ham",2,"Joe Cole left West Ham in 2003 to join which club?","Chelsea",["Arsenal","Liverpool","Tottenham Hotspur"],"He was one of Roman Abramovich's first signings."),
("west-ham",2,"Jermain Defoe left West Ham in 2004 to join which club?","Tottenham Hotspur",["Portsmouth","Charlton Athletic","Bournemouth"],"West Ham were in the second tier at the time."),
("west-ham",3,"Who took over from Glenn Roeder as West Ham manager in 2003?","Alan Pardew",["Trevor Brooking","Alan Curbishley","Harry Redknapp"],"Pardew joined from Reading."),
("west-ham",3,"Which team did West Ham beat in the 2023 Europa Conference League semi-final?","AZ Alkmaar",["Gent","Anderlecht","Feyenoord"],"Pablo Fornals scored a late winner in the second leg in the Netherlands."),
("west-ham",3,"Where did West Ham finish in 2015-16, their last season at Upton Park?","7th",["5th","6th","9th"],"They got 62 points."),
("west-ham",3,"From which club did West Ham sign Nayef Aguerd in 2022?","Rennes",["Dijon","FUS Rabat","Marseille"],"He is a Morocco international."),
("west-ham",3,"From which club did West Ham sign Gianluca Scamacca in 2022?","Sassuolo",["Roma","PSV Eindhoven","Genoa"],"He moved to Atalanta a year later."),
("west-ham",3,"Which West Ham striker's career was cut short by an ankle injury he got in England training in 2006?","Dean Ashton",["Bobby Zamora","Marlon Harewood","Carlton Cole"],"He retired in 2009, aged 26."),
("west-ham",3,"Whose looping cross-shot put West Ham 3-2 up in the 2006 FA Cup final?","Paul Konchesky",["Dean Ashton","Marlon Harewood","Yossi Benayoun"],"Steven Gerrard equalised in stoppage time."),
("west-ham",3,"Who was West Ham's goalkeeper in the 2006 FA Cup final?","Shaka Hislop",["Roy Carroll","Robert Green","David James"],"Liverpool's Pepe Reina saved three penalties in the shootout."),
("west-ham",3,"Who replaced Graham Potter as West Ham head coach in September 2025?","Nuno Espírito Santo",["Julen Lopetegui","Sean Dyche","Gary O'Neil"],"Nuno had been sacked by Nottingham Forest earlier that month."),
]

TOPICS = {"titles":"Title races","goals":"Goals & records","players":"Legends","transfers":"Transfers","managers":"Managers","moments":"Big moments","clubs":"Clubs & grounds","cups":"Cups & Europe"}
DIFF = {1:"easy",2:"medium",3:"hard"}
def topic(cat, q):
    if cat != "west-ham": return TOPICS[cat]
    ql = q.lower()
    if any(w in ql for w in ("manager","managed","owner","uncle")): return "West Ham bosses"
    if any(w in ql for w in ("sign","join","left west ham","leave","academy","from which club")): return "West Ham players"
    return "West Ham moments"

# ---------- club questions (tools/clubs/<division>.py) ----------
# Each division file defines QUESTIONS = {club_id: [(difficulty, kind, question, correct, [3 wrong], explanation, source_url), ...]}
# kind is one of CLUB_KINDS; the card label becomes e.g. "Brighton bosses".
CLUB_KINDS = {"history": "history", "players": "players", "bosses": "bosses", "moments": "big moments", "grounds": "home & identity"}
DIVISIONS = ("premier_league", "championship", "league_one", "league_two")

def club_questions(seen):
    import importlib.util, os
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clubs")
    sys.path.insert(0, here)
    from clubs import ALL
    rng = random.Random(92)
    out = []
    for div in DIVISIONS:
        path = os.path.join(here, div + ".py")
        if not os.path.exists(path):
            continue
        spec = importlib.util.spec_from_file_location(div, path)
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        for cid, qs in mod.QUESTIONS.items():
            assert cid in ALL, f"unknown club id {cid}"
            assert cid != "west-ham", "West Ham questions live in Q above"
            for n, (diff, kind, q, correct, wrong, expl, src) in enumerate(qs, 1):
                assert diff in (1, 2, 3) and kind in CLUB_KINDS, (cid, q)
                assert len(wrong) == 3, q
                opts = [correct] + wrong
                assert len(set(opts)) == 4, q
                assert q not in seen, q
                assert src.startswith("https://"), (cid, q)
                seen.add(q)
                rng.shuffle(opts)
                out.append({
                    "id": f"{cid}-{n:04d}",
                    "question": q,
                    "options": opts,
                    "answer": opts.index(correct),
                    "difficulty": DIFF[diff],
                    "topic": f"{ALL[cid][1]} {CLUB_KINDS[kind]}",
                    "club": cid,
                    "verified": True,
                    "explanation": expl,
                    "source": src,
                })
    return out

def main(out):
    rng = random.Random(2000)
    seen, out_qs = set(), []
    per_cat = Counter()
    for cat, diff, q, correct, wrong, expl in Q:
        assert cat in CATS, cat
        assert diff in (1, 2, 3)
        assert len(wrong) == 3, q
        opts = [correct] + wrong
        assert len(set(opts)) == 4, q
        assert q not in seen, q
        seen.add(q)
        rng.shuffle(opts)
        per_cat[cat] += 1
        prefix = "wh" if cat == "west-ham" else cat[:3]
        out_qs.append({
            "id": f"{'whu' if cat=='west-ham' else cat[:3]}-{per_cat[cat]:04d}",
            "question": q,
            "options": opts,
            "answer": opts.index(correct),
            "difficulty": DIFF[diff],
            "topic": topic(cat, q),
            "club": "west-ham" if cat == "west-ham" else None,
            "verified": True,
            "explanation": expl,
        })
    out_qs += club_questions(seen)
    bank = {
        "version": 1,
        "scope": "Premier League, 2000-01 season onwards (some all-time records included), plus club rounds for all 92 clubs in the top four divisions (2026-27)",
        "questions": out_qs,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    print(len(out_qs), "questions")
    print(dict(per_cat))
    print("by difficulty", Counter(x["difficulty"] for x in out_qs))
    print("answer positions", Counter(x["answer"] for x in out_qs))
    gen = [x for x in out_qs if not x["club"] or x["club"] == "west-ham"]
    print("general topic x diff", sorted(Counter((x["topic"],x["difficulty"]) for x in gen).items()))
    per_club = Counter((x["club"], x["difficulty"]) for x in out_qs if x["club"])
    for cid in sorted({c for c, _ in per_club}):
        e, m, h = (per_club[(cid, d)] for d in ("easy", "medium", "hard"))
        print(f"  {cid:16} easy {e:2}  medium {m:2}  hard {h:2}" + ("" if min(e, m, h) >= 10 else "   (below 10 per difficulty)"))

main(sys.argv[1])
