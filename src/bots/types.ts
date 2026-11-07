// Shared shapes for the bots. Everything the game passes in is plain data,
// so the bots don't depend on the game's internal state.

export type BotId = "ollie" | "ryan" | "freddie";
export type BotLevel = "low" | "medium" | "hard";
export type Difficulty = "easy" | "medium" | "hard";
export type PromotionRole = "n" | "b" | "r" | "q";

export type TalkMoment =
  | "start"
  | "capture"
  | "lostPiece"
  | "oppWrong"
  | "ownRight"
  | "ownWrong"
  | "powerUp"
  | "hotSpot"
  | "win"
  | "loss";

export type PowerUpId =
  | "tactical-foul"
  | "park-the-bus"
  | "var-review"
  | "counter-attack"
  | "substitution"
  | "golden-boot"
  | "formation-change"
  | "super-sub"
  | "red-card"
  | "extra-time"
  | "fergie-time"
  | "managers-tip"
  | "scout-report"
  | "assistants-flag";

/** How the bot plays chess at one level. */
export interface ChessStrength {
  /** Rough rating this level is tuned to (see docs/bots.md for how it was measured). */
  rating: number;
  /** Stockfish search depth. */
  depth: number;
  /** How many engine lines to look at before choosing. */
  multiPv: number;
  /**
   * Softmax temperature in centipawns. 0 always takes the engine's top line;
   * higher values make the bot happier to play a worse move.
   */
  temperatureCp: number;
  /** Chance per move of ignoring the engine and playing a random legal move. */
  blunderRate: number;
}

export type ChessStyle = "chaotic" | "balanced" | "positional";

export interface TriviaSkill {
  /** Chance of a right answer by difficulty. Puskás goals use `puskas`. */
  accuracy: Record<Difficulty | "puskas", number>;
  /** Accuracy on the bot's own club's questions, any difficulty. */
  ownClubAccuracy: number;
  /** Answer time range in milliseconds. */
  answerMs: [number, number];
  /** Weights for picking easy, medium, hard on a normal deal. */
  cardWeights: Record<Difficulty, number>;
  /** Chance of upgrading a Hard pick to a Puskás when allowed. */
  puskasRate: number;
}

export interface BotProfile {
  id: BotId;
  name: string;
  /** Kebab-case club id, matching `club` in data/questions.json. */
  club: string;
  clubName: string;
  blurb: string;
  style: ChessStyle;
  levels: Record<BotLevel, { chess: ChessStrength; trivia: TriviaSkill }>;
  /** Power-ups in order of preference. */
  favouritePowerUps: PowerUpId[];
  /** Form the bot keeps in reserve before buying anything not on its saving list. */
  saveFor?: { ids: PowerUpId[]; reserve: number };
}

// ---- Inputs from the game ----

export interface MoveRequest {
  fen: string;
  chess960?: boolean;
  /** Legal moves the bot may play (UCI). Pass this when power-ups restrict moves (frozen pieces, Free Kick). */
  allowedMoves?: string[];
  /** The bot bought Manager's Tip this turn: play the engine's top move. */
  managersTip?: boolean;
}

export interface MoveResult {
  /** UCI, castling as king-to-rook (e1h1), which is the chessops convention. */
  uci: string;
  /** Engine eval after the move from the bot's side, in centipawns (mate = +/-100000). */
  evalCp: number;
  /** Suggested pause before showing the move, so the bot feels like it is thinking. */
  thinkMs: number;
}

export interface CardOffer {
  topic: string;
  difficulty: Difficulty;
  club: string | null;
}

export interface CardRequest {
  cards: CardOffer[];
  puskasAllowed: boolean;
  form: number;
  /** Hot Spot round: every card is a club card (normal rewards). */
  bonusRound?: boolean;
  /** Eval from the bot's side in centipawns, if known. Bots play safer when well ahead. */
  evalCp?: number;
}

export interface CardChoice {
  index: number;
  puskas: boolean;
}

export interface QuestionLike {
  options: string[];
  answer: number;
  difficulty: Difficulty;
  club?: string | null;
}

export interface AnswerRequest {
  question: QuestionLike;
  puskas?: boolean;
  /** Indexes already removed by a 50:50, if any. */
  removed?: number[];
}

export interface AnswerResult {
  choice: number;
  delayMs: number;
}

export interface PowerUpOffer {
  id: PowerUpId | string;
  cost: number;
}

export interface PowerUpRequest {
  fen: string;
  /** Side the bot plays. Optional: the side to move in `fen` is used. */
  color?: "white" | "black";
  form: number;
  /** Only power-ups the bot can afford and that are off cooldown. */
  available: PowerUpOffer[];
  inCheck?: boolean;
  /** How much the bot's last move cost it in centipawns (positive = it got worse). */
  lastMoveEvalDrop?: number;
  /** Eval from the bot's side, in centipawns, if known. */
  evalCp?: number;
  timed?: boolean;
  clockMs?: number;
}

export interface PowerUpChoice {
  id: PowerUpId;
  /** Target square for power-ups that need one, e.g. "d5". */
  target?: string;
  /** Second square for Formation Change. */
  target2?: string;
}
