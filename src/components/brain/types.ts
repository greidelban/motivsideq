export type GameOutcome = {
  score: number;
  variant: string;
  metrics: Record<string, number>;
};

export type GameComponentProps = {
  onFinish: (outcome: GameOutcome) => void;
};
