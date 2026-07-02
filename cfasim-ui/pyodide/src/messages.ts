export interface RunMessage {
  id: number;
  type?: "run";
  python: string;
  context?: Record<string, unknown>;
}
export interface CallMessage {
  id: number;
  type: "call";
  module: string;
  fn: string;
  kwargs?: Record<string, unknown>;
}
export interface LoadModuleMessage {
  id: number;
  type: "loadModule";
  module: string;
}
export type WorkerMessage = RunMessage | CallMessage | LoadModuleMessage;
export type OutgoingMessage =
  | Omit<RunMessage, "id">
  | Omit<CallMessage, "id">
  | Omit<LoadModuleMessage, "id">;
