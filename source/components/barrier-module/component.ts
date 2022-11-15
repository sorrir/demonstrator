/**
 * Barrier Module (BM)
 *
 * A barrier that can be lowered to prevent cars passing. Corresponds
 * to either a Smart Entry or Smart Exit Console.
 *
 * Interaction: SEC, SXC
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  StateMachine,
  StateMachineState,
} from "@sorrir/framework";
import { BmEventType, BmPort, BmState } from "./types";

/**
 * Statemachine
 */
const sm: StateMachine<BmState, undefined, BmEventType, BmPort> = {
  transitions: [
    /**
     * Open
     */
    {
      sourceState: BmState.CLOSED,
      targetState: BmState.OPEN,
      event: ["oneway", BmEventType.OPEN, BmPort.FROM_SC],
    },
    /**
     * Close
     */
    {
      sourceState: BmState.OPEN,
      targetState: BmState.CLOSED,
      event: ["oneway", BmEventType.CLOSE, BmPort.FROM_SC],
    },
  ],
};

/**
 * Component for setup
 */
export const bm: AtomicComponent<BmEventType, BmPort> =
  createStatemachineComponent(
    [
      {
        name: BmPort.FROM_SC,
        eventTypes: [BmEventType.OPEN, BmEventType.CLOSE],
        direction: "in",
      },
    ],
    sm,
    "bm"
  );

/**
 * Start state
 */
export const bmStartState: StateMachineState<
  BmState,
  undefined,
  BmEventType,
  BmPort
> = {
  state: {
    fsm: BmState.CLOSED,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
