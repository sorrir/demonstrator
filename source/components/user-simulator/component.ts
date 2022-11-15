/**
 * User-Simulator (US)
 *
 * External component that wraps events mimicking user interaction
 * with the application.
 *
 * Interaction: WS, SEB, SXB
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  StateMachine,
  StateMachineState,
} from "@sorrir/framework";
import { UsEventType, UsPort } from "./types";

/**
 * Statemachine
 */
const sm: StateMachine<undefined, undefined, UsEventType, UsPort> = {
  transitions: [],
};

export const us: AtomicComponent<UsEventType, UsPort> =
  createStatemachineComponent(
    [
      {
        name: UsPort.TO_WS,
        eventTypes: [
          UsEventType.REQUEST_RESERVATION,
          UsEventType.REQUEST_CANCELLATION,
        ],
        direction: "out",
      },
      {
        name: UsPort.TO_SEC,
        eventTypes: [UsEventType.REQUEST_RESERVATION],
        direction: "out",
      },
      {
        name: UsPort.TO_SXC,
        eventTypes: [],
        direction: "out",
      },
    ],
    sm,
    "us"
  );

export const usStartState: StateMachineState<
  undefined,
  undefined,
  UsEventType,
  UsPort
> = {
  state: {
    fsm: undefined,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
