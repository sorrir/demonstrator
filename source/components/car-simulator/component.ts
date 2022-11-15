/**
 * External component that wraps all allowed user API-calls
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  StateMachine,
  StateMachineState,
} from "@sorrir/framework";
import { CsEventType, CsPort } from "./types";
import { PssEventType } from "../parking-space-sensor/types";
import { ScEventType } from "../smart-console/types";
import { CmEventType } from "../camera-module/types";

type EventType =
  | CsEventType
  | PssEventType.SET_OCCUPIED
  | PssEventType.SET_EMPTY
  | ScEventType.CAR_DETECTED
  | ScEventType.CAR_DETECTION_ENDED
  | CsEventType.FEED_IMAGE_DATA;

/**
 * Statemachine
 */
const sm: StateMachine<undefined, undefined, EventType, CsPort> = {
  transitions: [],
};

export const cs: AtomicComponent<EventType, CsPort> =
  createStatemachineComponent(
    [
      {
        name: CsPort.TO_PSS,
        eventTypes: [PssEventType.SET_OCCUPIED],
        direction: "out",
      },
      {
        name: CsPort.TO_SEC,
        eventTypes: [ScEventType.CAR_DETECTED, ScEventType.CAR_DETECTION_ENDED],
        direction: "out",
      },
      {
        name: CsPort.TO_SXC,
        eventTypes: [ScEventType.CAR_DETECTED, ScEventType.CAR_DETECTION_ENDED],
        direction: "out",
      },
      {
        name: CsPort.TO_CM,
        eventTypes: [CsEventType.FEED_IMAGE_DATA],
        direction: "out",
      },
    ],
    sm,
    "cs"
  );

export const csStartState: StateMachineState<
  undefined,
  undefined,
  CsEventType,
  CsPort
> = {
  state: {
    fsm: undefined,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
