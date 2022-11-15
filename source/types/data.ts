/**
 * Data type for location of a parking space
 */
export type ParkingSpaceLocation = {
  row: row;
  column: column;
  level: level;
};
export type row = number;
export type column = number;
export type level = number;

/**
 * Data type for account data
 */
export type AccountData = {
  accountID: string;
  billingInfo: string;
  licensePlates: string[];
  preferences: {
    accessibility?: boolean;
    eCharging?: boolean;
  };
};

/**
 * Image data for license plate recognition
 *
 * in reality, this would be e.g. a base64 encoded image
 * here, a string with two letter-combinations separated by either a space or "-" is expected
 * followed by a number combination
 * examples: "SO-RR-1", "SOR RI1", ...
 *
 */
export type LpImageData = string;

/**
 * Data rounded to time slots used in reservations
 */
export type RoundedDate = Date & {
  readonly isRoundedDate: true;
};

/**
 * Reservation for a specific parking space
 */
export type Reservation = {
  id: string;
  accountID: string;
  dateFrom: RoundedDate;
  dateTo: RoundedDate;
};

/**
 * Status of a specific parking space
 */
export type ParkingSpaceStatus = {
  isOccupied: boolean;
  reservations: Reservation[];
  readonly hasAccessibility: boolean;
  readonly hasECharging: boolean;
};
