/**
 * Return codes for events
 */
export enum ReturnCode {
  OK = 0,
  GENERIC_ERROR = 1,
  WRONG_PARAMETER_TYPES_ERROR = 2,
}

/**
 * Error type error
 */
export enum ErrorEventType {
  GENERIC_ERROR = "GENERIC_ERROR",
  WRONG_PARAMETER_TYPES_ERROR = "WRONG_PARAMETER_TYPES_ERROR",
}
