/**
 * Discrete State
 */
export enum CmState {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
}

/**
 * Internal state
 */
export type CmStateInternal = {
  answerToRequestID?: string;
};

/**
 * Event type
 */
export enum CmEventType {
  REQUEST_IMAGE = "REQUEST_IMAGE",
  RESOLVE_IMAGE = "RESOLVE_IMAGE",
}

/**
 * Camera module ports
 */
export enum CmPort {
  FROM_SC = "FROM_SC",
  TO_SC = "TO_SC",
  FROM_CS = "FROM_CS",
}
