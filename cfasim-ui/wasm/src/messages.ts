export interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
}
