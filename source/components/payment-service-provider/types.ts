/**
 * Event type
 */
export enum PspEventType {
  REQUEST_PAYMENT = "REQUEST_PAYMENT",
  RESOLVE_PAYMENT = "RESOLVE_PAYMENT",
  REJECT_PAYMENT = "REJECT_PAYMENT",
}

/**
 * Camera module ports
 */
export enum PspPort {
  FROM_PMS = "FROM_PMS",
  TO_PMS = "TO_PMS",
}
