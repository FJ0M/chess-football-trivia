// A few real questions so the preview screen has something to answer.
// The game itself will use data/questions.json from the question bank.

export interface PreviewQuestion {
  question: string;
  options: string[];
  answer: number;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  reward: number;
  penalty: number;
}

export const PREVIEW_QUESTIONS: PreviewQuestion[] = [
  { question: "Who scored Man City's title-winning goal against QPR in the 93rd minute in May 2012?", options: ["Edin Džeko", "Mario Balotelli", "Carlos Tevez", "Sergio Agüero"], answer: 3, topic: "Moments", difficulty: "Medium", reward: 2, penalty: 1 },
  { question: "Who scored West Ham's winner in the 2023 Europa Conference League final?", options: ["Said Benrahma", "Michail Antonio", "Jarrod Bowen", "Lucas Paquetá"], answer: 2, topic: "West Ham", difficulty: "Hard", reward: 3, penalty: 2 },
  { question: "Which club won the Premier League in 2015/16, having started the season as 5000-1 outsiders?", options: ["Chelsea", "Leicester City", "Tottenham", "Arsenal"], answer: 1, topic: "General", difficulty: "Medium", reward: 2, penalty: 1 },
  { question: "Arsenal went the whole 2003/04 league season unbeaten. What nickname did that team get?", options: ["The Invincibles", "The Untouchables", "The Immortals", "The Entertainers"], answer: 0, topic: "General", difficulty: "Easy", reward: 1, penalty: 0 },
  { question: "Which ground did West Ham move into in 2016 after leaving the Boleyn Ground?", options: ["Wembley", "London Stadium", "The Valley", "Selhurst Park"], answer: 1, topic: "West Ham", difficulty: "Easy", reward: 1, penalty: 0 },
  { question: "How many Premier League goals did Mohamed Salah score in 2017/18, his first season at Liverpool?", options: ["29", "31", "32", "34"], answer: 2, topic: "Records", difficulty: "Medium", reward: 2, penalty: 1 },
  { question: "Liverpool finished second in 2018/19 despite how many points?", options: ["91", "94", "97", "99"], answer: 2, topic: "Stats", difficulty: "Hard", reward: 3, penalty: 2 },
  { question: "Which goalkeeper holds the record for most Premier League clean sheets?", options: ["David James", "Petr Čech", "Edwin van der Sar", "Mark Schwarzer"], answer: 1, topic: "Records", difficulty: "Hard", reward: 3, penalty: 2 },
];
