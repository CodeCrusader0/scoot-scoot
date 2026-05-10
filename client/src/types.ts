export type InitPayload = {
  selfId: string;
  world: { width: number; height: number };
  zones: {
    pickup: { x: number; y: number; r: number };
    drop: { x: number; y: number; r: number };
  };
  players: PlayerState[];
  coins: number;
  hasPackage: boolean;
};

export type PlayerState = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  color: string;
  name: string;
  coins?: number;
  hasPackage?: boolean;
};
