export interface RuntimeTransportHandlers {
  onMessage(message: unknown): void;
  onError(message: string): void;
}

export interface LabRuntimeTransport {
  start(handlers: RuntimeTransportHandlers): void;
  postMessage(message: unknown): void;
  destroy(): void;
}

export type RuntimeTransportFactory = () => LabRuntimeTransport;
