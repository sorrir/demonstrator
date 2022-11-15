import { AccountData } from "../../types/data";

/**
 * ACS Ports
 */
export enum AcsPort {
  FROM_PMS = "FROM_PMS",
  TO_PMS = "TO_PMS",
  FROM_SEC = "FROM_SEC",
  TO_SEC = "TO_SEC",
  FROM_SXC = "FROM_SXC",
  TO_SXC = "TO_SXC",
}

/**
 * ACS event types
 */
export enum AcsEventType {
  REQUEST_ACCOUNT_DATA_BY_ID = "REQUEST_ACCOUNT_DATA_BY_ID",
  REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE = "REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE",
  ANSWER_TO_ACCOUNT_DATA_REQUEST = "ANSWER_TO_ACCOUNT_DATA_REQUEST",
}

/**
 * ACS Internal State
 */
export type AcsInternalState = {
  accounts: {
    [accountID: string]: AccountData;
  };
};
