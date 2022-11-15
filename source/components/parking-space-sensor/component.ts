/**
 * Parking Space Sensor (PSS)
 *
 * A small car-detecting sensor at each parking space to determine if
 * the parking space is free or occupied.
 *
 * Interaction: PMS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  DistributiveOmit,
  OneWayEvent,
  RaiseEventCallBack,
  RequestEvent,
  ResolveEvent,
  StateMachine,
  StateMachineStateGenerator,
} from "@sorrir/framework";
import { ReturnCode } from "../../types/misc";
import { PssReportStatusEvent } from "./events";
import { PssEventType, PssInternalState, PssPort, PssState } from "./types";

function createOnewayStatusEvent(state: PssInternalState, isOccupied: boolean) {
  const response: DistributiveOmit<
    PssReportStatusEvent<PssPort.TO_PMS>,
    "id"
  > = {
    eventClass: "oneway",
    type: PssEventType.REPORT_STATUS,
    port: PssPort.TO_PMS,
    param: { location: state.location, isOccupied: isOccupied },
  };
  return response;
}

function createResolveStatusEvent(
  state: PssInternalState,
  isOccupied: boolean,
  requestID: string
) {
  const response: DistributiveOmit<
    PssReportStatusEvent<PssPort.TO_PMS>,
    "id"
  > = {
    eventClass: "resolve",
    type: PssEventType.REPORT_STATUS,
    port: PssPort.TO_PMS,
    param: { location: state.location, isOccupied: isOccupied },
    rc: ReturnCode.OK,
    answerToRequestID: requestID,
  };
  return response;
}

/**
 * Statemachine
 */
const sm: StateMachine<PssState, PssInternalState, PssEventType, PssPort> = {
  transitions: [
    /**
     * Set to status externally to mimic sensor functionality
     */
    {
      sourceState: PssState.EMPTY,
      targetState: PssState.OCCUPIED,
      event: ["oneway", PssEventType.SET_OCCUPIED, PssPort.FROM_CS],
      action: (
        currentState: PssInternalState,
        raiseEvent: RaiseEventCallBack<PssEventType, PssPort>
      ) => {
        raiseEvent(createOnewayStatusEvent(currentState, true));
        return currentState;
      },
    },
    {
      sourceState: PssState.OCCUPIED,
      targetState: PssState.EMPTY,
      event: ["oneway", PssEventType.SET_EMPTY, PssPort.FROM_CS],
      action: (
        currentState: PssInternalState,
        raiseEvent: RaiseEventCallBack<PssEventType, PssPort>
      ) => {
        raiseEvent(createOnewayStatusEvent(currentState, false));
        return currentState;
      },
    },
    /**
     * Consume external status events that do not alter the local state
     */
    {
      sourceState: PssState.EMPTY,
      targetState: PssState.EMPTY,
      event: ["oneway", PssEventType.SET_EMPTY, PssPort.FROM_CS],
    },
    {
      sourceState: PssState.OCCUPIED,
      targetState: PssState.OCCUPIED,
      event: ["oneway", PssEventType.SET_OCCUPIED, PssPort.FROM_CS],
    },
    /**
     * Report current occupied-state upon request
     */
    {
      sourceState: PssState.OCCUPIED,
      targetState: PssState.OCCUPIED,
      event: ["request", PssEventType.REQUEST_STATUS, PssPort.FROM_PMS],
      action: (
        currentState: PssInternalState,
        raiseEvent: RaiseEventCallBack<PssEventType, PssPort>,
        event: RequestEvent<PssEventType, PssPort> | undefined
      ) => {
        raiseEvent(createResolveStatusEvent(currentState, true, event!.id));
        return currentState;
      },
    },
    {
      sourceState: PssState.EMPTY,
      targetState: PssState.EMPTY,
      event: ["request", PssEventType.REQUEST_STATUS, PssPort.FROM_PMS],
      action: (
        currentState: PssInternalState,
        raiseEvent: RaiseEventCallBack<PssEventType, PssPort>,
        event: RequestEvent<PssEventType, PssPort> | undefined
      ) => {
        raiseEvent(createResolveStatusEvent(currentState, false, event!.id));
        return currentState;
      },
    },
  ],
};

/**
 * Component for setup
 */
export const pss: AtomicComponent<PssEventType, PssPort> =
  createStatemachineComponent(
    [
      {
        name: PssPort.FROM_PMS,
        eventTypes: [PssEventType.REQUEST_STATUS],
        direction: "in",
      },
      {
        name: PssPort.FROM_CS,
        eventTypes: [PssEventType.SET_OCCUPIED, PssEventType.SET_EMPTY],
        direction: "in",
      },
      {
        name: PssPort.TO_PMS,
        eventTypes: [PssEventType.REPORT_STATUS],
        direction: "out",
      },
    ],
    sm,
    "pss"
  );

/**
 * Generator for start states
 */
export const pssStartStateGenerator: StateMachineStateGenerator<
  PssState,
  PssInternalState,
  PssEventType,
  PssPort
> = {
  tsType: "StateGenerator",
  argTypes: { row: "number", column: "number", level: "number" },
  generate: ({ row, column, level }) => {
    return {
      state: {
        fsm: PssState.EMPTY,
        my: {
          location: {
            row: <number>row,
            column: <number>column,
            level: <number>level,
          },
        },
      },
      events: [],
      tsType: "State",
    };
  },
};
