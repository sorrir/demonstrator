/**
 * Accounting Service (ACS)
 *
 * The ACS holds the account data including billing information of
 * regular users. A user is able to create an account over cloud services or in an
 * SPG directly. Users do not need to create an account in order to use any of the
 * SPGs, but having an account has the benefits of central billing of all parkings,
 * e.g., within a month, of providing preferences and a car recognition based on
 * licence plates.
 *
 * Interaction: PMS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  RaiseEventCallBack,
  RequestEvent,
  StateMachine,
  ErrorEvent,
  StateMachineStateGenerator,
} from "@sorrir/framework";
import _ = require("lodash");
import { AccountData } from "../../types/data";
import { ReturnCode } from "../../types/misc";
import { AcsEventType, AcsInternalState, AcsPort } from "./types";
import {
  AcsRequestDataByIdEvent,
  AcsRequestDataByLicensePlateEvent,
  AcsResolveDataEvent,
} from "./events";

/**
 * Raise an answer event by either resolving given accountData
 * or raising an error if it is undefined.
 *
 * @param raiseEvent the callback
 * @param accountData the accountData
 * @param answerToRequestID the id of the request event
 */
function raiseAnswerEvent(
  raiseEvent: RaiseEventCallBack<AcsEventType, AcsPort>,
  accountData: AccountData | undefined,
  answerToRequestID: string,
  port: AcsPort.TO_PMS | AcsPort.TO_SEC | AcsPort.TO_SXC
) {
  // return account data if given
  if (accountData !== undefined) {
    const resolveEvent: Omit<AcsResolveDataEvent<typeof port>, "id"> = {
      eventClass: "resolve",
      type: AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
      param: {
        accountData: accountData,
      },
      rc: ReturnCode.OK,
      answerToRequestID: answerToRequestID,
      port: port,
    };
    raiseEvent(resolveEvent);
  }
  // raise error otherwise
  else {
    const errorEvent: Omit<ErrorEvent<AcsEventType, AcsPort>, "id"> = {
      eventClass: "error",
      type: AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
      error: "No matching account found.",
      rc: ReturnCode.GENERIC_ERROR,
      answerToRequestID: answerToRequestID,
      layer: "ApplicationLayer",
      port: port,
    };
    raiseEvent(errorEvent);
  }
}

/**
 * Creates the a transition for account data requests by license plate
 * for all given ports.
 *
 * @param ports the ports this transition shall be available for
 * @returns the transitions
 */
function getRequestAccountDataByLicensePlateTransitions(ports: AcsPort[]) {
  return ports.map((port) => {
    return {
      sourceState: undefined,
      targetState: undefined,
      event: <any>[
        "request",
        AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE,
        port,
      ],
      action: (
        state: AcsInternalState,
        raiseEvent: RaiseEventCallBack<AcsEventType, AcsPort>,
        event: RequestEvent<AcsEventType, AcsPort> | undefined
      ) => {
        // get parameters from request
        const requestDataEvent =
          event! as AcsRequestDataByLicensePlateEvent<AcsPort.FROM_PMS>;
        const { licensePlate } = requestDataEvent.param;

        // find account data
        const accountData = _.find(state.accounts, (accountData) =>
          accountData.licensePlates.includes(licensePlate)
        );

        // raise answer
        raiseAnswerEvent(
          raiseEvent,
          accountData,
          requestDataEvent.id,
          <any>port.replace("FROM", "TO")
        );

        // return state
        return state;
      },
    };
  });
}

/**
 * Statemachine
 */
const sm: StateMachine<undefined, AcsInternalState, AcsEventType, AcsPort> = {
  transitions: [
    /**
     * Request account data by id
     */
    {
      sourceState: undefined,
      targetState: undefined,
      event: [
        "request",
        AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID,
        AcsPort.FROM_PMS,
      ],
      action: (
        state: AcsInternalState,
        raiseEvent: RaiseEventCallBack<AcsEventType, AcsPort>,
        event: RequestEvent<AcsEventType, AcsPort> | undefined
      ) => {
        // get parameters from request
        const requestDataEvent =
          event! as AcsRequestDataByIdEvent<AcsPort.FROM_PMS>;
        const { accountID } = requestDataEvent.param;

        // find account data
        const accountData = state.accounts[accountID];

        // raise answer
        raiseAnswerEvent(
          raiseEvent,
          accountData,
          requestDataEvent.id,
          AcsPort.TO_PMS
        );

        // return state
        return state;
      },
    },
    /**
     * Request account data by license plate
     */
    ...getRequestAccountDataByLicensePlateTransitions([
      AcsPort.FROM_SEC,
      AcsPort.FROM_SXC,
    ]),
  ],
};

/**
 * Component for setup
 */
export const acs: AtomicComponent<AcsEventType, AcsPort> =
  createStatemachineComponent(
    [
      {
        name: AcsPort.FROM_PMS,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID],
        direction: "in",
      },
      {
        name: AcsPort.TO_PMS,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "out",
      },
      {
        name: AcsPort.FROM_SEC,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE],
        direction: "in",
      },
      {
        name: AcsPort.TO_SEC,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "out",
      },
      {
        name: AcsPort.FROM_SXC,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE],
        direction: "in",
      },
      {
        name: AcsPort.TO_SXC,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "out",
      },
    ],
    sm,
    "acs"
  );

/**
 * Start state generator
 */
export const acsStartStateGenerator: StateMachineStateGenerator<
  undefined,
  AcsInternalState,
  AcsEventType,
  AcsPort
> = {
  tsType: "StateGenerator",
  argTypes: {
    numAccounts: "number",
  },
  generate: ({ numAccounts }) => {
    return {
      state: {
        fsm: undefined,
        my: {
          accounts: _.reduce(
            Array.from({ length: <number>numAccounts }, (v, id) => `${id + 1}`),
            (accounts, id) => {
              const accountData: AccountData = {
                accountID: "sorrir" + id,
                billingInfo: "",
                licensePlates: ["SO-RR " + id],
                preferences: {},
              };
              accounts[accountData.accountID] = accountData;
              return accounts;
            },
            {}
          ),
        },
      },
      events: [],
      tsType: "State",
    };
  },
};

/**
 * Alternative empty start state
 */
export const acsStartStateEmpty = acsStartStateGenerator.generate({
  numAccounts: 0,
});
