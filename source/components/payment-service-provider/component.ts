/**
 * Payment-Service-Provider (PSP)
 *
 * The PSP is responsible to charge a user by using corresponding
 * payment information, e.g., banking or credit- and debit-card data. This service
 * is typically provided by a bank or a similar institution and remotely used by the
 * SPG.
 *
 * Interaction: PMS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  OneWayEvent,
  RaiseEventCallBack,
  RequestEvent,
  ResolveEvent,
  StateMachine,
  StateMachineState,
} from "@sorrir/framework";
import { ReturnCode } from "../../types/misc";
import { LpImageData } from "../../types/data";
import { CsEventType } from "../car-simulator/types";
import { CsFeedImageDataEvent } from "../car-simulator/events";
import { PspEventType, PspPort } from "./types";
import { PspRequestPaymentEvent, PspResolvePaymentEvent } from "./events";

/**
 * Statemachine
 */
const sm: StateMachine<undefined, undefined, PspEventType, PspPort> = {
  transitions: [
    /**
     * Payment request
     */
    {
      sourceState: undefined,
      targetState: undefined,
      event: ["request", PspEventType.REQUEST_PAYMENT, PspPort.FROM_PMS],
      action: (
        state: undefined,
        raiseEvent: RaiseEventCallBack<PspEventType, PspPort>,
        event?: RequestEvent<PspEventType, PspPort>
      ) => {
        // read parameters from request
        const request = event! as PspRequestPaymentEvent<PspPort.FROM_PMS>;
        const { billingInfo, amount } = request.param;

        // real PSP would do something here with the given data
        billingInfo;
        amount;

        // resolve payment event
        const resolve: Omit<PspResolvePaymentEvent<PspPort.TO_PMS>, "id"> = {
          eventClass: "resolve",
          type: PspEventType.RESOLVE_PAYMENT,
          port: PspPort.TO_PMS,
          answerToRequestID: request.id,
          rc: ReturnCode.OK,
          param: {
            amount: amount,
          },
        };
        raiseEvent(resolve);

        return undefined;
      },
    },
  ],
};

/**
 * Component for setup
 */
export const psp: AtomicComponent<PspEventType, PspPort> =
  createStatemachineComponent(
    [
      {
        name: PspPort.FROM_PMS,
        eventTypes: [PspEventType.REQUEST_PAYMENT],
        direction: "in",
      },
      {
        name: PspPort.TO_PMS,
        eventTypes: [PspEventType.RESOLVE_PAYMENT, PspEventType.REJECT_PAYMENT],
        direction: "out",
      },
    ],
    sm,
    "psp"
  );

/**
 * Start state
 */
export const pspStartState: StateMachineState<
  undefined,
  undefined,
  PspEventType,
  PspPort
> = {
  state: {
    fsm: undefined,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
