// The question bank split by the split-questions plugin in vite.config.ts.
declare module "virtual:questions" {
  import type { Question } from "./game/types";
  /** Every question that isn't about one club. */
  export function loadGeneral(): Promise<Question[]>;
  /** One club's questions (empty for an unknown club). */
  export function loadClub(id: string): Promise<Question[]>;
}
