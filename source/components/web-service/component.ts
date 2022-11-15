/**
 * Web-Service (WS)
 *
 * Allows the user to complete off-site reservations.
 *
 * Interaction: PMS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  ResolveEvent,
  ErrorEvent,
  StateMachine,
  StateMachineState,
  RequestEvent,
} from "@sorrir/framework";
import { PmsEventType } from "../parking-management-system/types";
import { WsEventType, WsPort } from "./types";
import { UsEventType } from "../user-simulator/types";
import { PmsConfirmReservationEvent } from "../parking-management-system/events";

type EventType =
  | WsEventType
  | PmsEventType
  | UsEventType.REQUEST_RESERVATION
  | UsEventType.REQUEST_CANCELLATION;

/**
 * Base-Transition to consume incoming events from the PMS.
 */
const baseConsumePmsEventTransition = {
  sourceState: undefined,
  targetState: undefined,
  action: (
    state,
    raiseEvent,
    event: ResolveEvent<EventType, WsPort> | undefined
  ) => {
    console.log(
      `\n${event?.type}: ${JSON.stringify(
        (event as PmsConfirmReservationEvent<WsPort.FROM_PMS>).param
      )}\n`
    );
    return state;
  },
};

/**
 * Base-Transition for forwarding events from user-simulator
 */
const baseForwardUsEventTransition = {
  sourceState: undefined,
  targetState: undefined,
  action: (
    state,
    raiseEvent,
    event: RequestEvent<EventType, WsPort> | undefined
  ) => {
    const eventToForward = {
      ...event,
      id: undefined,
      port: WsPort.TO_PMS,
    };
    raiseEvent(eventToForward as Omit<RequestEvent<EventType, WsPort>, "id">);
    return state;
  },
};

/**
 * Statemachine
 */
const sm: StateMachine<undefined, undefined, EventType, WsPort> = {
  transitions: [
    /**
     * Consume incoming PMS events
     */
    {
      ...baseConsumePmsEventTransition,
      event: ["resolve", PmsEventType.CONFIRM_RESERVATION, WsPort.FROM_PMS],
    },
    {
      ...baseConsumePmsEventTransition,
      event: ["resolve", PmsEventType.REJECT_RESERVATION, WsPort.FROM_PMS],
    },
    {
      ...baseConsumePmsEventTransition,
      event: [
        "error",
        PmsEventType.REJECT_RESERVATION_WITH_ERROR,
        WsPort.FROM_PMS,
      ],
      action: (
        state,
        raiseEvent,
        event: ErrorEvent<EventType, WsPort> | undefined
      ) => {
        console.log(`\n${event?.type}: ${event?.error}\n`);
        return state;
      },
    },
    {
      ...baseConsumePmsEventTransition,
      event: ["resolve", PmsEventType.CONFIRM_CANCELLATION, WsPort.FROM_PMS],
    },
    {
      ...baseConsumePmsEventTransition,
      event: ["resolve", PmsEventType.REJECT_CANCELLATION, WsPort.FROM_PMS],
    },
    /**
     * Forward incoming user-simulator events to PMS
     */
    {
      ...baseForwardUsEventTransition,
      event: ["request", UsEventType.REQUEST_RESERVATION, WsPort.FROM_US],
    },
    {
      ...baseForwardUsEventTransition,
      event: ["request", UsEventType.REQUEST_CANCELLATION, WsPort.FROM_US],
    },
  ],
};

export const ws: AtomicComponent<EventType, WsPort> =
  createStatemachineComponent(
    [
      {
        name: WsPort.FROM_PMS,
        eventTypes: [
          PmsEventType.CONFIRM_RESERVATION,
          PmsEventType.REJECT_RESERVATION,
        ],
        direction: "in",
      },
      {
        name: WsPort.TO_PMS,
        eventTypes: [PmsEventType.REQUEST_RESERVATION],
        direction: "out",
      },
      {
        name: WsPort.FROM_US,
        eventTypes: [
          UsEventType.REQUEST_RESERVATION,
          UsEventType.REQUEST_CANCELLATION,
        ],
        direction: "in",
      },
    ],
    sm,
    "ws"
  );

export const wsStartState: StateMachineState<
  undefined,
  undefined,
  EventType,
  WsPort
> = {
  state: {
    fsm: undefined,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
