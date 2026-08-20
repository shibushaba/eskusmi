export type NetworkServiceState =
  | "starting"
  | "online"
  | "offline"
  | "degraded";

export interface NetworkStatus {
  state: NetworkServiceState;
  detail?: string | null;
  tcpPort?: number | null;
}
