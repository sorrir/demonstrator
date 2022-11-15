/**
 * Camera Module (CM)
 *
 * A camera that collects the data necessary for plate recognition. Corresponds
 * to either a Smart Entry or Smart Exit Console.
 *
 * Interaction: SEC, SXC
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
import { CmEventType, CmPort, CmState, CmStateInternal } from "./types";
import { CmRequestImageEvent, CmResolveImageEvent } from "./events";
import { CsEventType } from "../car-simulator/types";
import { CsFeedImageDataEvent } from "../car-simulator/events";

type EventType = CmEventType | CsEventType.FEED_IMAGE_DATA;

/**
 * Statemachine
 */
const sm: StateMachine<CmState, CmStateInternal, EventType, CmPort> = {
  transitions: [
    /**
     * Request image
     */
    {
      sourceState: CmState.IDLE,
      targetState: CmState.ACTIVE,
      event: ["request", CmEventType.REQUEST_IMAGE, CmPort.FROM_SC],
      action: (
        state: CmStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, CmPort>,
        event?: RequestEvent<EventType, CmPort>
      ) => {
        // cache id
        state.answerToRequestID = (
          event as CmRequestImageEvent<CmPort.FROM_SC>
        ).id;

        // return state
        return state;
      },
    },
    /**
     * Resolve image
     */
    {
      sourceState: CmState.ACTIVE,
      targetState: CmState.IDLE,
      event: ["oneway", CsEventType.FEED_IMAGE_DATA, CmPort.FROM_CS],
      action: (
        state: CmStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, CmPort>,
        event?: OneWayEvent<EventType, CmPort>
      ) => {
        // get image data from event
        const feedImageDataEvent =
          event! as CsFeedImageDataEvent<CmPort.FROM_CS>;
        const { imageData } = feedImageDataEvent.param;

        // send data to sec/sxc
        const resolveImageEvent: Omit<
          CmResolveImageEvent<CmPort.TO_SC>,
          "id"
        > = {
          eventClass: "resolve",
          type: CmEventType.RESOLVE_IMAGE,
          port: CmPort.TO_SC,
          param: {
            imageData: imageData,
          },
          rc: ReturnCode.OK,
          answerToRequestID: state.answerToRequestID!,
        };
        raiseEvent(resolveImageEvent);

        // clear cached id
        state.answerToRequestID = undefined;

        // return state
        return state;
      },
    },
    /**
     * Ignore image data feeds if not active
     */
    {
      sourceState: CmState.IDLE,
      targetState: CmState.IDLE,
      event: ["oneway", CsEventType.FEED_IMAGE_DATA, CmPort.FROM_CS],
    },
  ],
};

/**
 * Component for setup
 */
export const cm: AtomicComponent<EventType, CmPort> =
  createStatemachineComponent(
    [
      {
        name: CmPort.FROM_SC,
        eventTypes: [CmEventType.REQUEST_IMAGE],
        direction: "in",
      },
      {
        name: CmPort.TO_SC,
        eventTypes: [CmEventType.RESOLVE_IMAGE],
        direction: "out",
      },
      {
        name: CmPort.FROM_CS,
        eventTypes: [CsEventType.FEED_IMAGE_DATA],
        direction: "in",
      },
    ],
    sm,
    "cm"
  );

/**
 * Start state
 */
export const cmStartState: StateMachineState<
  CmState,
  CmStateInternal,
  CmEventType,
  CmPort
> = {
  state: {
    fsm: CmState.IDLE,
    my: {},
  },
  events: [],
  tsType: "State",
};
