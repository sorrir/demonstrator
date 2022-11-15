/**
 * Parking Management Service (PMS)
 *
 * The PMS is a high-level abstraction that comprises all functionality
 * for creating, reading and updating business data in the system. This includes
 * information about the filling level of all available parking garages, reservations
 * and user activity. This service also provides users with access to Web- and app-
 * based reservations. In a real implementation the PMS might be decomposed
 * into multiple components, which we will not present here
 *
 * Interaction: SEB, SXB, PSI, PSP, PSS, ACS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  Event,
  RaiseEventCallBack,
  RequestEvent,
  ResolveEvent,
  ErrorEvent,
  StateMachine,
  StateMachineStateGenerator,
  OneWayEvent,
  Internal,
} from "@sorrir/framework";
import { ReturnCode } from "../../types/misc";
import * as _ from "lodash";
import {
  ParkingSpaceLocation,
  column,
  row,
  level,
  ParkingSpaceStatus,
  RoundedDate,
  Reservation,
} from "../../types/data";
import { AcsEventType } from "../accounting-service/types";
import { PssEventType } from "../parking-space-sensor/types";
import { CsEventType } from "../car-simulator/types";
import { PssReportStatusEvent } from "../parking-space-sensor/events";
import {
  PmsEventType,
  PmsInternalState,
  PmsInternalState as PmsStateInternal,
  PmsPort,
  PmsState,
} from "./types";
import {
  PmsCancelReservationEvent,
  PmsCheckForReservationEvent,
  PmsConfirmPaymentEvent,
  PmsConfirmReservationEvent,
  PmsRejectPaymentEvent,
  PmsRequestPaymentEvent,
  PmsRequestReservationEvent,
  PmsResolveReservationEvent,
} from "./events";
import {
  AcsRequestDataByIdEvent,
  AcsResolveDataEvent,
} from "../accounting-service/events";
import { getUniqueID } from "../../util";
import {
  PspRequestPaymentEvent,
  PspResolvePaymentEvent,
} from "../payment-service-provider/events";
import { PspEventType } from "../payment-service-provider/types";

enum PmsEventTypeInternal {
  HANDLE_RESERVATION = "HANDLE_RESERVATION",
  HANDLE_PAYMENT = "HANDLE_PAYMENT",
}
type EventType =
  | PmsEventType
  | PmsEventTypeInternal
  | PspEventType
  | AcsEventType
  | PssEventType
  | CsEventType;

/**
 * internal event to signal that the client
 * wants to reserve a parking space.
 */
type InternalHandleReservationEvent = OneWayEvent<
  PmsEventTypeInternal.HANDLE_RESERVATION,
  any
> & {
  port: typeof Internal;
};

/**
 * internal event to signal that a client wants to
 * pay in order to leave the SPG.
 */
type InternalHandlePaymentEvent = OneWayEvent<
  PmsEventTypeInternal.HANDLE_PAYMENT,
  any
> & {
  port: typeof Internal;
};

/**
 * Helper function to generate an internal event
 *
 * @param type the internal event type
 * @returns the event
 */
function getInternalEvent(type: PmsEventTypeInternal): Omit<
  OneWayEvent<PmsEventTypeInternal, any> & {
    port: typeof Internal;
  },
  "id"
> {
  return {
    eventClass: "oneway",
    port: Internal,
    type: type,
  };
}

/**
 * Iterates through all available parking spaces with optional break condition.
 *
 * @param state current state
 * @param fn function to call. If fn returns true, the iteration is stopped.
 */
function forEachParkingSpace(
  state: PmsStateInternal,
  fn: (location: ParkingSpaceLocation, status: ParkingSpaceStatus) => boolean
) {
  for (let column = 0; column < state.size.columns; column++) {
    for (let row = 0; row < state.size.rows; row++) {
      for (let level = 0; level < state.size.levels; level++) {
        const isEnd = fn(
          { row: row, column: column, level: level },
          state.parkingSpaceStatuses[column][row][level]
        );
        if (isEnd === true) return;
      }
    }
  }
}

/**
 * Checks whether a given parking space is available in the given period of time.
 *
 * @param parkingSpaceStatus
 * @param dateFrom
 * @param dateTo
 */
function isAvailable(
  parkingSpaceStatus: ParkingSpaceStatus,
  dateFrom: RoundedDate,
  dateTo: RoundedDate,
  accessibility?: boolean,
  eCharging?: boolean
) {
  // check if parking space has required properties
  if (accessibility === true && !parkingSpaceStatus.hasAccessibility)
    return false;
  if (eCharging === true && !parkingSpaceStatus.hasECharging) return false;

  // check if given date range already has no overlapping reservation
  return (
    _.find(
      parkingSpaceStatus.reservations,
      (reservation) =>
        (dateTo > reservation.dateFrom && dateFrom < reservation.dateTo) ||
        (dateTo === reservation.dateFrom && dateFrom === reservation.dateTo)
    ) === undefined
  );
}

/**
 * Gets rounded dates from an event
 *
 * @param event
 */
function getRoundedDatesFromEvent(event: PmsRequestReservationEvent<any>): {
  dateFrom: RoundedDate;
  dateTo: RoundedDate;
} {
  return getRoundedDates(
    new Date(event.param.dateFrom),
    new Date(event.param.dateTo)
  );
}

/**
 * Rounds given input dates to match dates in reservations
 *
 * @param dateFrom
 * @param dateTo
 * @returns
 */
function getRoundedDates(
  dateFrom: Date,
  dateTo: Date
): { dateFrom: RoundedDate; dateTo: RoundedDate } {
  // date divided by this will give elapsed time in 15 minute steps
  const div15min = 1000 * 60 * 15;
  const timeDiv15Min = (date: Date, diff = 0) =>
    Math.floor((date.getTime() + diff) / div15min);
  const asRoundedDate = (date: Date) => {
    (<any>date).isRoundedDate = true;
    return date as RoundedDate;
  };
  return {
    dateFrom: asRoundedDate(new Date(timeDiv15Min(dateFrom) * div15min)),
    dateTo: asRoundedDate(new Date((timeDiv15Min(dateTo, -1) + 1) * div15min)),
  };
}

/**
 * Base transition for applying the sensor status
 *
 */
const baseApplySensorStatusTransition = {
  action: (
    currentState: PmsStateInternal,
    raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
    event: Event<EventType, PmsPort> | undefined
  ) => {
    const statusEvent = (event as PssReportStatusEvent<PmsPort.FROM_PSS>)!;
    const location = statusEvent.param.location;
    currentState.parkingSpaceStatuses[location.column][location.row][
      location.level
    ].isOccupied = statusEvent.param.isOccupied;
    return currentState;
  },
};

const baseRequestReservationTransition = {
  sourceState: PmsState.IDLE,
  targetState: PmsState.WAITING_FOR_ACS,
  action: (
    currentState: PmsStateInternal,
    raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
    event: RequestEvent<EventType, PmsPort> | undefined
  ) => {
    // get parameters from request
    const requestReservationEvent =
      event! as PmsRequestReservationEvent<PmsPort.FROM_WS>;
    const { accountID } = requestReservationEvent.param;

    // cache incoming event for usage in subsequent transition
    currentState.cachedRequestReservationEvent = requestReservationEvent;

    // request account data from acs
    const acsRequestDataEvent: Omit<
      AcsRequestDataByIdEvent<PmsPort.TO_ACS>,
      "id"
    > = {
      eventClass: "request",
      type: AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID,
      param: {
        accountID: accountID,
      },
      port: PmsPort.TO_ACS,
    };
    raiseEvent(acsRequestDataEvent);

    // tell the state machine what this account data request is for
    raiseEvent(getInternalEvent(PmsEventTypeInternal.HANDLE_RESERVATION));

    return currentState;
  },
};

/**
 * Creates a transition for the similar events when sxb or seb
 * check for a reservation.
 *
 * @param target sxb or seb
 * @returns the transition
 */
function getCheckForReservationTransition(target: "sxc" | "sec") {
  const sourcePort = target === "sec" ? PmsPort.FROM_SEC : PmsPort.FROM_SXC;
  const targetPort = target === "sec" ? PmsPort.TO_SEC : PmsPort.TO_SXC;
  return {
    sourceState: PmsState.IDLE,
    targetState: PmsState.IDLE,
    event: <any>["request", PmsEventType.CHECK_FOR_RESERVATION, sourcePort],
    action: (
      currentState: PmsStateInternal,
      raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
      event?: RequestEvent<EventType, PmsPort>
    ) => {
      // get license plate from incoming event
      const checkForReservationEvent = event! as PmsCheckForReservationEvent<
        typeof sourcePort
      >;
      const { accountID, timestamp } = checkForReservationEvent.param;
      const date = timestamp !== undefined ? new Date(timestamp) : undefined;

      // find active reservation of account if it exists
      let reservation: Reservation | undefined;
      forEachParkingSpace(currentState, (location, status) => {
        reservation = _.find(
          status.reservations,
          (reservation) =>
            reservation.accountID === accountID &&
            (date === undefined ||
              (reservation.dateFrom <= date && reservation.dateTo >= date))
        );
        return reservation !== undefined;
      });

      // if empty location exists, reserve parking space
      if (reservation !== undefined) {
        // confirm reservation to ext
        const outEvent: Omit<
          PmsResolveReservationEvent<typeof targetPort>,
          "id"
        > = {
          eventClass: "resolve",
          type: PmsEventType.RESOLVE_RESERVATION,
          port: targetPort,
          rc: ReturnCode.OK,
          answerToRequestID: checkForReservationEvent.id,
          param: {
            reservation: reservation,
          },
        };
        raiseEvent(outEvent);
      } else {
        raiseEvent({
          eventClass: "error",
          type: PmsEventType.RESERVATION_DOES_NOT_EXIST,
          port: targetPort,
          rc: ReturnCode.GENERIC_ERROR,
          answerToRequestID: checkForReservationEvent.id,
          error: "No reservation found for give account id.",
          layer: "ApplicationLayer",
        });
      }

      // return state
      return currentState;
    },
  };
}

/**
 * Statemachine
 */
const sm: StateMachine<PmsState, PmsStateInternal, EventType, PmsPort> = {
  transitions: [
    /**
     * Begin to Initialize PMS
     *
     * Should send a status request to all parking space sensors.
     * Currently commented out, waiting for additional functionality by
     * framework
     */
    {
      sourceState: PmsState.INIT,
      targetState: PmsState.IDLE,
      action: (
        currentState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>
      ) => {
        /*
        // request state from all parking sensors
        // a single request is enough, since its 1-n port
        raiseEvent({
          eventClass: "request",
          type: PssEventType.REQUEST_STATUS,
          port: PmsPort.TO_PSS,
        });

        // set current timestamp
        currentState.pssRequestTimestamp = new Date().getTime();
        */

        return currentState;
      },
    },
    /**
     * Consume incoming PSS status events for every state besides INIT
     * and for both "resolve" and "oneway" events.
     *
     * This is to avoid being blocked when the PMS is waiting
     * for other services.
     */
    ..._.flatMap(_.without(Object.values(PmsState), PmsState.INIT), (state) =>
      _.map(["oneway", "resolve"], (type) => {
        return {
          ...baseApplySensorStatusTransition,
          sourceState: state,
          targetState: state,
          event: <any>[type, PssEventType.REPORT_STATUS, PmsPort.FROM_PSS],
        };
      })
    ),
    /**
     * Handle reservation requests, both on- and off-site
     *
     * Incoming reservation request is cached while waiting for an outgoing
     * account data request.
     */
    {
      ...baseRequestReservationTransition,
      event: ["request", PmsEventType.REQUEST_RESERVATION, PmsPort.FROM_WS],
    },
    /**
     * Handle on-site reservation request.
     *
     * Incoming reservation request is cached while waiting for an outgoing
     * account data request.
     */
    {
      ...baseRequestReservationTransition,
      event: ["request", PmsEventType.REQUEST_RESERVATION, PmsPort.FROM_SEC],
    },
    /**
     * Receiving requested account data.
     */
    {
      sourceState: PmsState.WAITING_FOR_ACS,
      targetState: PmsState.PROCESS_ACCOUNT_DATA,
      event: [
        "resolve",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        PmsPort.FROM_ACS,
      ],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: ResolveEvent<EventType, PmsPort> | undefined
      ) => {
        // get account data from incoming event
        const acsResolveDataEvent =
          event! as AcsResolveDataEvent<PmsPort.FROM_ACS>;
        const { accountData } = acsResolveDataEvent.param;

        // cache accountData
        internalState.cachedAccountData = accountData;

        // return state
        return internalState;
      },
    },
    /**
     * Consume error for requested account data.
     */
    {
      sourceState: PmsState.WAITING_FOR_ACS,
      targetState: PmsState.PROCESS_ACCOUNT_DATA,
      event: [
        "error",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        PmsPort.FROM_ACS,
      ],
    },
    /**
     * Resolve pending reservation request after receiving account data.
     *
     * Use parking space preferences in account data if none are set in the request.
     */
    {
      sourceState: PmsState.PROCESS_ACCOUNT_DATA,
      targetState: PmsState.CLEAR_CACHE,
      event: [<any>"oneway", PmsEventTypeInternal.HANDLE_RESERVATION, Internal],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: ResolveEvent<EventType, PmsPort> | undefined
      ) => {
        // get account data from cache
        const accountData = internalState.cachedAccountData;

        // return an error if account data does not exist
        if (accountData === undefined) {
          // reject reserveration to ext
          raiseEvent({
            eventClass: "error",
            type: PmsEventType.REJECT_RESERVATION_WITH_ERROR,
            port: PmsPort.TO_WS,
            rc: ReturnCode.GENERIC_ERROR,
            answerToRequestID: internalState.cachedRequestReservationEvent!.id,
            error: "Account with given ID does not exist.",
            layer: "ApplicationLayer",
          });

          // remove cached event from state
          internalState.cachedRequestReservationEvent = undefined;

          // complete transition
          return internalState;
        }

        // get parameters from cached reservation request
        // use account data preferences for accessibility or eCharging if available
        // and none are set in the reservation request itself
        const requestReservationEvent =
          internalState.cachedRequestReservationEvent!;
        const { accessibility, eCharging, accountID } = {
          ...accountData.preferences,
          ...requestReservationEvent.param,
        };

        // round dates to closest 15 minute slots
        const { dateFrom, dateTo } = getRoundedDatesFromEvent(
          requestReservationEvent
        );

        // check if an empty parking space is available and has the required properties
        // also make sure account has no active reservation
        let emptyLocation: ParkingSpaceLocation | undefined;
        let accountHasReservation = false;
        forEachParkingSpace(internalState, (location, status) => {
          if (
            _.some(
              status.reservations,
              (reservation) => reservation.accountID === accountID
            )
          ) {
            accountHasReservation = true;
            return true;
          } else if (
            isAvailable(status, dateFrom, dateTo, accessibility, eCharging)
          ) {
            emptyLocation = location;
            return true;
          }
          return false;
        });

        // determine target port
        const targetPort =
          requestReservationEvent.port === PmsPort.FROM_WS
            ? PmsPort.TO_WS
            : PmsPort.TO_SEC;

        // if empty location exists, reserve parking space
        if (emptyLocation !== undefined && !accountHasReservation) {
          const parkingSpaceStatus =
            internalState.parkingSpaceStatuses[emptyLocation.column][
              emptyLocation.row
            ][emptyLocation.level];

          parkingSpaceStatus.reservations.push({
            id: getUniqueID(),
            accountID: requestReservationEvent.param.accountID,
            dateFrom: dateFrom,
            dateTo: dateTo,
          });

          // confirm reservation to ext
          const outEvent: Omit<
            PmsConfirmReservationEvent<typeof targetPort>,
            "id"
          > = {
            eventClass: "resolve",
            type: PmsEventType.CONFIRM_RESERVATION,
            port: targetPort,
            rc: ReturnCode.OK,
            answerToRequestID: requestReservationEvent.id,
            param: {
              location: emptyLocation,
              dateFrom: dateFrom.toISOString(),
              dateTo: dateTo.toISOString(),
            },
          };
          raiseEvent(outEvent);
        } else {
          // reject reserveration to ext
          raiseEvent({
            eventClass: "resolve",
            type: PmsEventType.REJECT_RESERVATION,
            port: targetPort,
            rc: ReturnCode.OK,
            answerToRequestID: requestReservationEvent.id,
          });
        }

        // return state
        return internalState;
      },
    },
    /**
     * Handle off-site cancellation request
     */
    {
      sourceState: PmsState.IDLE,
      targetState: PmsState.IDLE,
      event: ["request", PmsEventType.REQUEST_CANCELLATION, PmsPort.FROM_WS],
      action: (
        currentState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: RequestEvent<EventType, PmsPort> | undefined
      ) => {
        // get parameters from request
        const requestCancellationEvent =
          event! as PmsCancelReservationEvent<PmsPort.FROM_WS>;
        const { accountID } = requestCancellationEvent.param;

        // check if a reservation exists for the given account and remove it
        let reservationExists = false;
        forEachParkingSpace(currentState, (location, status) => {
          const reservation = _.remove(
            status.reservations,
            (reservation: Reservation) => reservation.accountID === accountID
          ).pop();
          if (reservation !== undefined) {
            reservationExists = true;
            return true;
          }
          return false;
        });

        // if reservation exists, send confirmation for cancellation
        if (reservationExists) {
          raiseEvent({
            eventClass: "resolve",
            type: PmsEventType.CONFIRM_CANCELLATION,
            port: PmsPort.TO_WS,
            rc: ReturnCode.OK,
            answerToRequestID: requestCancellationEvent.id,
          });
        } else {
          // reject cancellation
          raiseEvent({
            eventClass: "resolve",
            type: PmsEventType.REJECT_CANCELLATION,
            port: PmsPort.TO_WS,
            rc: ReturnCode.OK,
            answerToRequestID: requestCancellationEvent.id,
          });
        }
        return currentState;
      },
    },
    /**
     * SEC/SXC asks for existing reservation
     */
    getCheckForReservationTransition("sec"),
    getCheckForReservationTransition("sxc"),
    /**
     * Handle a request for finishing a reservation from SXC
     */
    {
      sourceState: PmsState.IDLE,
      targetState: PmsState.WAITING_FOR_ACS,
      event: ["request", PmsEventType.REQUEST_PAYMENT, PmsPort.FROM_SXC],
      action: (
        currentState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: RequestEvent<EventType, PmsPort> | undefined
      ) => {
        // get parameters from request
        const requestEvent = event! as PmsRequestPaymentEvent<PmsPort.FROM_SXC>;
        const { accountID } = requestEvent.param;

        // cache incoming event for usage in subsequent transition
        currentState.cachedRequestPaymentEvent = requestEvent;

        // request account data from acs
        const acsRequestDataEvent: Omit<
          AcsRequestDataByIdEvent<PmsPort.TO_ACS>,
          "id"
        > = {
          eventClass: "request",
          type: AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID,
          param: {
            accountID: accountID,
          },
          port: PmsPort.TO_ACS,
        };
        raiseEvent(acsRequestDataEvent);

        // tell the state machine what this account data request is for
        raiseEvent(getInternalEvent(PmsEventTypeInternal.HANDLE_PAYMENT));

        return currentState;
      },
    },
    /**
     * Send error if finishing a reservation is not possible because account data
     * is missing.
     */
    {
      sourceState: PmsState.PROCESS_ACCOUNT_DATA,
      targetState: PmsState.CLEAR_CACHE,
      condition: (internalState: PmsStateInternal) =>
        internalState.cachedAccountData === undefined,
      event: [<any>"oneway", PmsEventTypeInternal.HANDLE_PAYMENT, Internal],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: ResolveEvent<EventType, PmsPort> | undefined
      ) => {
        raiseEvent({
          eventClass: "error",
          type: PmsEventType.REJECT_PAYMENT,
          port: PmsPort.TO_SXC,
          rc: ReturnCode.GENERIC_ERROR,
          answerToRequestID: internalState.cachedRequestPaymentEvent!.id,
          error: "Account with given ID does not exist.",
          layer: "ApplicationLayer",
        });
        return internalState;
      },
    },
    /**
     * Prepare payment after receiving account data.
     */
    {
      sourceState: PmsState.PROCESS_ACCOUNT_DATA,
      targetState: PmsState.PREPARE_PAYMENT,
      condition: (internalState: PmsStateInternal) =>
        internalState.cachedAccountData !== undefined,
      event: [<any>"oneway", PmsEventTypeInternal.HANDLE_PAYMENT, Internal],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event: ResolveEvent<EventType, PmsPort> | undefined
      ) => {
        // get parameters from cached finish reservation request
        const finishReservationEvent = internalState.cachedRequestPaymentEvent!;
        const { timestamp, reservationID } = finishReservationEvent.param;

        // TODO: maybe use date as well to filter reservations
        // currently time is not checked
        const date = timestamp !== undefined ? new Date(timestamp) : undefined;

        // find reservation of account if it exists
        let reservation: Reservation | undefined;
        forEachParkingSpace(internalState, (location, status) => {
          reservation = _.find(
            status.reservations,
            (reservation) => reservation.id === reservationID
          );
          return reservation !== undefined;
        });

        // cache reservation
        internalState.cachedReservation = reservation;

        // return internal state
        return internalState;
      },
    },
    /**
     * Send payment request to PSP if a valid reservation exists.
     */
    {
      sourceState: PmsState.PREPARE_PAYMENT,
      targetState: PmsState.WAITING_FOR_PSP,
      condition: (internalState: PmsStateInternal) =>
        internalState.cachedReservation !== undefined &&
        internalState.cachedAccountData?.accountID ===
          internalState.cachedReservation.accountID,
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>
      ) => {
        // get account data from cache
        const reservation = internalState.cachedReservation!;
        const accountData = internalState.cachedAccountData!;

        // calculate price for stay
        // in reality, here would be a formula that calculates the price
        // taking into account arrival date, leave date, overdue fees etc.
        // TODO: maybe enter something that makes more sense here
        const amount = 1;

        // handle payment
        const outEvent: Omit<PspRequestPaymentEvent<PmsPort.TO_PSP>, "id"> = {
          eventClass: "request",
          type: PspEventType.REQUEST_PAYMENT,
          port: PmsPort.TO_PSP,
          param: {
            billingInfo: accountData.billingInfo,
            amount: amount,
          },
        };
        raiseEvent(outEvent);

        return internalState;
      },
    },
    /**
     * Confirm payment to SXC if it is successful.
     */
    {
      sourceState: PmsState.WAITING_FOR_PSP,
      targetState: PmsState.CLEAR_CACHE,
      event: ["resolve", PspEventType.RESOLVE_PAYMENT, PmsPort.FROM_PSP],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>,
        event?: ResolveEvent<any, PmsPort>
      ) => {
        // get actual paid amount from psp
        const resolveEvent = event! as PspResolvePaymentEvent<PmsPort.FROM_PSP>;
        const { amount } = resolveEvent.param;

        // handle payment
        const outEvent: Omit<PmsConfirmPaymentEvent<PmsPort.TO_SXC>, "id"> = {
          eventClass: "resolve",
          type: PmsEventType.CONFIRM_PAYMENT,
          port: PmsPort.TO_SXC,
          answerToRequestID: internalState.cachedRequestPaymentEvent!.id,
          rc: ReturnCode.OK,
          param: {
            amount: amount,
          },
        };
        raiseEvent(outEvent);

        return internalState;
      },
    },
    /**
     * Reject payment to SXC if it is unsuccessful.
     */
    {
      sourceState: PmsState.WAITING_FOR_PSP,
      targetState: PmsState.CLEAR_CACHE,
      event: [<any>"error", PspEventType.REJECT_PAYMENT, PmsPort.FROM_PSP],
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>
      ) => {
        // reject payment
        const outEvent: Omit<PmsRejectPaymentEvent<PmsPort.TO_SXC>, "id"> = {
          eventClass: "error",
          type: PmsEventType.REJECT_PAYMENT,
          port: PmsPort.TO_SXC,
          rc: ReturnCode.GENERIC_ERROR,
          layer: "ApplicationLayer",
          answerToRequestID: internalState.cachedRequestPaymentEvent!.id,
          error:
            "Error with Payment Service Provider. Payment could not be completed.",
        };
        raiseEvent(outEvent);

        return internalState;
      },
    },
    /**
     * Abort payment if no valid reservation was found.
     */
    {
      sourceState: PmsState.PREPARE_PAYMENT,
      targetState: PmsState.CLEAR_CACHE,
      condition: (internalState: PmsStateInternal) =>
        internalState.cachedReservation === undefined,
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>
      ) => {
        raiseEvent({
          eventClass: "error",
          type: PmsEventType.REJECT_PAYMENT,
          port: PmsPort.TO_SXC,
          rc: ReturnCode.GENERIC_ERROR,
          answerToRequestID: internalState.cachedRequestPaymentEvent!.id,
          layer: "ApplicationLayer",
          error: "No reservation found with the given id.",
        });

        return internalState;
      },
    },
    /**
     * Abort payment if reservation does not belong to the same user.
     */
    {
      sourceState: PmsState.PREPARE_PAYMENT,
      targetState: PmsState.CLEAR_CACHE,
      condition: (internalState: PmsStateInternal) =>
        internalState.cachedReservation !== undefined &&
        internalState.cachedAccountData?.accountID !==
          internalState.cachedReservation.accountID,
      action: (
        internalState: PmsStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, PmsPort>
      ) => {
        raiseEvent({
          eventClass: "error",
          type: PmsEventType.REJECT_PAYMENT,
          port: PmsPort.TO_SXC,
          rc: ReturnCode.GENERIC_ERROR,
          answerToRequestID: internalState.cachedRequestPaymentEvent!.id,
          layer: "ApplicationLayer",
          error: "Given reservation id does not belong to the same account.",
        });

        return internalState;
      },
    },
    /**
     * Clear cache and return to idle once all actions are completed.
     */
    {
      sourceState: PmsState.CLEAR_CACHE,
      targetState: PmsState.IDLE,
      action: (internalState: PmsStateInternal) => {
        // clear all fields related to cache
        internalState.cachedRequestPaymentEvent = undefined;
        internalState.cachedAccountData = undefined;
        internalState.cachedRequestReservationEvent = undefined;
        internalState.cachedReservation = undefined;

        // return internal state
        return internalState;
      },
    },
  ],
};

export const pms: AtomicComponent<EventType, PmsPort> =
  createStatemachineComponent(
    [
      {
        name: PmsPort.TO_PSS,
        eventTypes: [PssEventType.REQUEST_STATUS],
        direction: "out",
      },
      {
        name: PmsPort.FROM_PSS,
        eventTypes: [PssEventType.REPORT_STATUS],
        direction: "in",
      },
      {
        name: PmsPort.TO_WS,
        eventTypes: [
          PmsEventType.CONFIRM_RESERVATION,
          PmsEventType.REJECT_RESERVATION,
        ],
        direction: "out",
      },
      {
        name: PmsPort.FROM_WS,
        eventTypes: [PmsEventType.REQUEST_RESERVATION],
        direction: "in",
      },
      {
        name: PmsPort.TO_ACS,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID],
        direction: "out",
      },
      {
        name: PmsPort.FROM_ACS,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "in",
      },
      {
        name: PmsPort.FROM_SEC,
        eventTypes: [
          PmsEventType.CHECK_FOR_RESERVATION,
          PmsEventType.REQUEST_RESERVATION,
        ],
        direction: "in",
      },
      {
        name: PmsPort.TO_SEC,
        eventTypes: [
          PmsEventType.RESERVATION_DOES_NOT_EXIST,
          PmsEventType.RESOLVE_RESERVATION,
          PmsEventType.CONFIRM_RESERVATION,
        ],
        direction: "out",
      },
      {
        name: PmsPort.FROM_SXC,
        eventTypes: [PmsEventType.CHECK_FOR_RESERVATION],
        direction: "in",
      },
      {
        name: PmsPort.TO_SXC,
        eventTypes: [
          PmsEventType.RESERVATION_DOES_NOT_EXIST,
          PmsEventType.RESOLVE_RESERVATION,
        ],
        direction: "out",
      },
      {
        name: PmsPort.TO_PSP,
        eventTypes: [PspEventType.REQUEST_PAYMENT],
        direction: "out",
      },
      {
        name: PmsPort.FROM_PSP,
        eventTypes: [PspEventType.RESOLVE_PAYMENT, PspEventType.REJECT_PAYMENT],
        direction: "in",
      },
    ],
    sm,
    "pms"
  );

/**
 * Generator for start states
 */
export const pmsStartStateGenerator: StateMachineStateGenerator<
  PmsState,
  PmsStateInternal,
  EventType,
  PmsPort
> = {
  tsType: "StateGenerator",
  argTypes: {
    rows: "number",
    columns: "number",
    levels: "number",
    accessibilitySpaces: "number",
    eChargingSpaces: "number",
    accessibilityAndEChargingSpaces: "number",
  },
  generate: (args) => {
    const {
      rows,
      columns,
      levels,
      accessibilitySpaces,
      eChargingSpaces,
      accessibilityAndEChargingSpaces,
    } = args as {
      rows: number;
      columns: number;
      levels: number;
      accessibilitySpaces: number;
      eChargingSpaces: number;
      accessibilityAndEChargingSpaces: number;
    };

    // check validity of args
    if (rows <= 0 || columns <= 0 || levels <= 0) {
      throw Error("'rows', 'columns' or 'levels' need to be greater than 0");
    }
    if (
      accessibilityAndEChargingSpaces + accessibilitySpaces + eChargingSpaces >
      rows * columns * levels
    ) {
      throw Error(
        "Number of special parking spaces exceeds the number of total spaces."
      );
    }

    let accessibilitySpacesRemaining = accessibilitySpaces;
    let echargingSpacesRemaining = eChargingSpaces;
    let accessibilityAndEchargingSpacesRemaining =
      accessibilityAndEChargingSpaces;

    // generate state
    return {
      state: {
        fsm: PmsState.INIT,
        my: {
          size: {
            rows: rows,
            columns: columns,
            levels: levels,
          },
          parkingSpaceStatuses: Array.from({ length: columns }, () =>
            Array.from({ length: rows }, () =>
              Array.from({ length: levels }, () => {
                // distribute special parking spaces among the available ones
                let hasAccessibility = false;
                let hasECharging = false;
                if (accessibilityAndEchargingSpacesRemaining > 0) {
                  accessibilityAndEchargingSpacesRemaining--;
                  hasAccessibility = true;
                  hasECharging = true;
                } else if (echargingSpacesRemaining > 0) {
                  echargingSpacesRemaining--;
                  hasECharging = true;
                } else if (accessibilitySpacesRemaining > 0) {
                  accessibilitySpacesRemaining--;
                  hasAccessibility = true;
                }

                // return initial parking space status
                return {
                  isOccupied: false,
                  reservations: [],
                  hasAccessibility: hasAccessibility,
                  hasECharging: hasECharging,
                  isSensorOnline: false,
                };
              })
            )
          ),
          cachedRequestReservationEvent: undefined,
        },
      },
      events: [],
      tsType: "State",
    };
  },
};
