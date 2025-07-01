import Akiles from './NativeAkiles';
import { ErrorCode } from './NativeAkiles';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface ActionCallback {
  /** Called when the action operation succeeds. */
  onSuccess(): void;
  /** Called when the operation fails. */
  onError(e: AkilesError): void;
  /** Called when there's a status update for the internet method. */
  onInternetStatus?(status: ActionInternetStatus): void;
  /** Called when the operation succeeds via the internet method. */
  onInternetSuccess?(): void;
  /** Called when the operation fails via the internet method. */
  onInternetError?(e: AkilesError): void;
  /** Called when there's a status update for the bluetooth method. */
  onBluetoothStatus?(status: ActionBluetoothStatus): void;
  /** Called when there's progress for the bluetooth method. */
  onBluetoothStatusProgress?(percent: number): void;
  /** Called when the operation succeeds via the bluetooth method. */
  onBluetoothSuccess?(): void;
  /** Called when the operation fails via the bluetooth method. */
  onBluetoothError?(e: AkilesError): void;
}

export interface ScanCallback {
  /** Called when a hardware is discovered by scanning. */
  onDiscover(hw: Hardware): void;
  /** Called when the operation succeeds. */
  onSuccess(): void;
  /** Called when the operation fails. */
  onError(e: AkilesError): void;
}

export interface SyncCallback {
  /** Called when there's a status update for the bluetooth method. */
  onStatus?(status: SyncStatus): void;
  /** Called when there's progress for the bluetooth method. */
  onStatusProgress?(percent: number): void;
  /** Called when the operation succeeds. */
  onSuccess(): void;
  /** Called when the operation fails. */
  onError(e: AkilesError): void;
}

import type {
  GadgetAction,
  Gadget,
  Hardware,
  ActionInternetStatus,
  ActionBluetoothStatus,
  SyncStatus,
  ActionOptions,
  PermissionDeniedReason,
  Schedule,
  ScheduleWeekday,
  ScheduleRange,
  ErrorInfo,
} from './NativeAkiles';

export type {
  GadgetAction,
  Gadget,
  Hardware,
  ActionInternetStatus,
  ActionBluetoothStatus,
  SyncStatus,
  ErrorCode,
  ActionOptions,
  PermissionDeniedReason,
  Schedule,
  ScheduleWeekday,
  ScheduleRange,
};

export class AkilesError extends Error {
  code: ErrorCode = ErrorCode.INTERNAL;

  /**
   * Reason for permission denied errors. Only present if `code` is `PERMISSION_DENIED`.
   */
  reason?: PermissionDeniedReason;

  /**
   * Member start date, RFC3339 timestamp. Only present if `reason` is `MEMBER_NOT_STARTED`.
   */
  startsAt?: string;

  /**
   * Member end date, RFC3339 timestamp. Only present if `reason` is `MEMBER_ENDED`.
   */
  endsAt?: string;

  /**
   * Member's schedule. Only present if `reason` is `OUT_OF_SCHEDULE`.
   */
  schedule?: Schedule;

  /**
   * Time needed to wait to be in schedule, in seconds. Only present if `reason` is `OUT_OF_SCHEDULE`.
   */
  waitTime?: number;

  /**
   * Timezone the schedule is interpreted in. TZDB name, example `Europe/Madrid`. Only present if `reason` is `OUT_OF_SCHEDULE`.
   */
  timezone?: string;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AkilesError';
    Object.setPrototypeOf(this, AkilesError.prototype);
  }
}

/**
 * Get the IDs for all sessions in the session store.
 *
 * @returns An array with the IDs of all sessions.
 */
export async function getSessionIDs(): Promise<string[]> {
  const { data, error } = await Akiles.getSessionIDs();
  if (error) throw convertError(error);
  if (data === undefined)
    throw new AkilesError(ErrorCode.INTERNAL, 'No data returned');
  return data;
}

/**
 * Add a session to the session store.
 *
 * If the session store already contains the session, this is a noop.
 * This does a network call to the server to check the session token, and to cache the
 * session data into local storage.
 *
 * @param token - The session token.
 * @returns The session ID.
 */
export async function addSession(token: string): Promise<string> {
  const { data, error } = await Akiles.addSession(token);
  if (error) throw convertError(error);
  if (data === undefined)
    throw new AkilesError(ErrorCode.INTERNAL, 'No data returned');
  return data;
}

/**
 * Remove a session from the session store.
 *
 * If there's no session in the store with the given ID, this is a noop.
 *
 * @param id - The session ID to remove.
 */
export async function removeSession(id: string): Promise<void> {
  const { error } = await Akiles.removeSession(id);
  if (error) throw convertError(error);
}

/**
 * Removes all sessions from the session store.
 */
export async function removeAllSessions(): Promise<void> {
  const { error } = await Akiles.removeAllSessions();
  if (error) throw convertError(error);
}

/**
 * Refresh the cached session data.
 *
 * @param id - The session ID.
 */
export async function refreshSession(id: string): Promise<void> {
  const { error } = await Akiles.refreshSession(id);
  if (error) throw convertError(error);
}

/**
 * Refresh the cached session data for all sessions.
 */
export async function refreshAllSessions(): Promise<void> {
  const { error } = await Akiles.refreshAllSessions();
  if (error) throw convertError(error);
}

/**
 * Get the gadgets for a session.
 *
 * @param sessionID - The session ID.
 * @returns An array with all the gadgets in the session.
 */
export async function getGadgets(sessionID: string): Promise<Gadget[]> {
  const { data, error } = await Akiles.getGadgets(sessionID);
  if (error) throw convertError(error);
  if (data === undefined)
    throw new AkilesError(ErrorCode.INTERNAL, 'No data returned');
  return data;
}

/**
 * Get a list of hardware accessible by this session.
 *
 * @param sessionID - The session ID.
 * @returns An array with all the hardware in the session.
 */
export async function getHardwares(sessionID: string): Promise<Hardware[]> {
  const { data, error } = await Akiles.getHardwares(sessionID);
  if (error) throw convertError(error);
  if (data === undefined)
    throw new AkilesError(ErrorCode.INTERNAL, 'No data returned');
  return data;
}

export interface ScanCardCallback {
  onSuccess(card: Card): void;
  onError(e: AkilesError): void;
}

/**
 * Scan a card using NFC.
 *
 * The result will be notified via events:
 * - `scan_card_success`: { card: { uid, isAkilesCard } }
 * - `scan_card_error`: { error: { code, description } }
 *
 * @returns A function that cancels the ongoing scanCard operation.
 */
export function scanCard(callback: ScanCardCallback) {
  const opId = Akiles.scanCard();
  const remove = listenEvents(opId, {
    scan_card_success: ({ card }) => {
      callback.onSuccess(new Card(card.uid, card.isAkilesCard));
      remove();
    },
    scan_card_error: ({ error }) => {
      callback.onError(convertError(error));
      remove();
    },
  });
  return () => Akiles.cancel(opId);
}

// workaround
// https://stackoverflow.com/questions/69538962
const eventEmitter =
  Platform.OS === 'android'
    ? new NativeEventEmitter()
    : new NativeEventEmitter(NativeModules.AkilesAdapter);

function listenEvents(
  opId: string,
  mapping: Record<string, (params: any) => void>
) {
  const subs = Object.entries(mapping).map(([event, handler]) =>
    eventEmitter.addListener(event, (params) => {
      if (params?.opId === opId) handler(params);
    })
  );
  return () => subs.forEach((sub) => sub.remove());
}

/**
 * Do an action on a gadget.
 *
 * This method tries to perform the action with both internet and Bluetooth communication methods,
 * possibly in parallel.
 *
 * The callback provides global success/error status, plus detailed status information for each
 * method. In particular, the sequence of callbacks is guaranteed to be:
 *
 * - For global status: exactly one of `onSuccess` or `onError`.
 * - For internet status: zero or more `onInternetStatus`, then exactly one of `onInternetSuccess` or `onInternetError`.
 * - For Bluetooth status: zero or more `onBluetoothStatus` or `onBluetoothStatusProgress`, then exactly one of `onBluetoothSuccess` or `onBluetoothError`.
 *
 * For Bluetooth, the SDK does some high-priority syncing before the action and some low-priority syncing after, so after the global `onSuccess` or `onError` is called you may still receive Bluetooth status updates. In this case, we recommend you show the success/failure to the user immediately to not make them wait, but still show a Bluetooth icon with a spinning indicator to convey there's still Bluetooth activity.
 *
 * @param sessionID - ID for the session to use.
 * @param gadgetID - Gadget ID, in the format "gad_3vms1xqucnus4ppfnl9h".
 * @param actionID - Action ID.
 * @param options - Options customizing the
 * @param callback - The callback that will be called on success or error.
 * @returns A function that cancels the ongoing action operation.
 */
export function action(
  sessionID: string,
  gadgetID: string,
  actionID: string,
  options: ActionOptions | undefined | null,
  callback: ActionCallback
) {
  const opId = Akiles.action(sessionID, gadgetID, actionID, options);
  let globalDone = false;
  let internetDone = false;
  let bluetoothDone = false;
  const remove = listenEvents(opId, {
    action_success: () => {
      globalDone = true;
      callback.onSuccess();
      maybeRemove();
    },
    action_error: ({ error }) => {
      globalDone = true;
      callback.onError(convertError(error));
      maybeRemove();
    },
    action_status_internet: ({ status }) => callback.onInternetStatus?.(status),
    action_internet_success: () => {
      internetDone = true;
      callback.onInternetSuccess?.();
      maybeRemove();
    },
    action_internet_error: ({ error }) => {
      internetDone = true;
      callback.onInternetError?.(convertError(error));
      maybeRemove();
    },
    action_status_bluetooth: ({ status }) =>
      callback.onBluetoothStatus?.(status),
    action_bluetooth_status_progress: ({ percent }) =>
      callback.onBluetoothStatusProgress?.(percent),
    action_bluetooth_success: () => {
      bluetoothDone = true;
      callback.onBluetoothSuccess?.();
      maybeRemove();
    },
    action_bluetooth_error: ({ error }) => {
      bluetoothDone = true;
      callback.onBluetoothError?.(convertError(error));
      maybeRemove();
    },
  });
  function maybeRemove() {
    if (globalDone && internetDone && bluetoothDone) remove();
  }
  // Return cancel function
  return () => Akiles.cancel(opId);
}

/**
 * Scan using Bluetooth for nearby Akiles devices.
 *
 * The sequence of callbacks is guaranteed to be zero or more `onDiscover`, then exactly one of `onSuccess` or `onError`.
 *
 * @param callback - The callback that will be called on success or error.
 * @returns A function that cancels the ongoing scan operation.
 */
export function scan(callback: ScanCallback) {
  const opId = Akiles.scan();
  const remove = listenEvents(opId, {
    scan_discover: ({ hardware }) => callback.onDiscover(hardware),
    scan_success: () => {
      callback.onSuccess();
      remove();
    },
    scan_error: ({ error }) => {
      callback.onError(convertError(error));
      remove();
    },
  });

  // Return cancel function
  return () => Akiles.cancel(opId);
}

/**
 * Synchronize state of hardware.
 *
 * The sequence of callbacks is guaranteed to be zero or more `onStatus` or `onStatusProgress`, then exactly one of `onSuccess` or `onError`.
 *
 * @param sessionID - ID for the session to use.
 * @param hardwareID - Hardware ID, in the format "hw_3vms1xqucnus4ppfnl9h".
 * @param callback - The callback that will be called on success or error.
 * @returns A function that cancels the ongoing sync operation.
 */
export function sync(
  sessionID: string,
  hardwareID: string,
  callback: SyncCallback
) {
  const opId = Akiles.sync(sessionID, hardwareID);
  const remove = listenEvents(opId, {
    sync_status: ({ status }) => callback.onStatus?.(status),
    sync_status_progress: ({ percent }) => callback.onStatusProgress?.(percent),
    sync_success: () => {
      callback.onSuccess();
      remove();
    },
    sync_error: ({ error }) => {
      callback.onError(convertError(error));
      remove();
    },
  });
  // Return cancel function
  return () => Akiles.cancel(opId);
}

/**
 * Returns whether Bluetooth is supported on this phone.
 *
 * This checks for the presence of Bluetooth LE hardware and requires Android 10 (API 29) or newer.
 *
 * @returns true if Bluetooth is supported, false otherwise.
 */
export function isBluetoothSupported(): boolean {
  return Akiles.isBluetoothSupported();
}

/**
 * Returns whether card emulation is supported on this phone.
 *
 * This checks for the presence of NFC Host Card Emulation hardware.
 *
 * @returns A promise that resolves to true if card emulation is supported, false otherwise.
 */
export async function isCardEmulationSupported(): Promise<boolean> {
  return await Akiles.isCardEmulationSupported();
}

/**
 * Starts NFC Host Card Emulation.
 *
 * @returns A promise that resolves when the emulation is complete.
 * @throws AkilesError if an error occurs.
 */
export async function startCardEmulation(): Promise<void> {
  const { error } = await Akiles.startCardEmulation();
  if (error) throw convertError(error);
  return;
}

// Card class with uid, isAkilesCard, update, and close methods
export class Card {
  constructor(
    public uid: string,
    public isAkilesCard: boolean
  ) {}

  /**
   * Update the data on the card with the Akiles server.
   *
   * @returns A promise that resolves when the update is complete.
   * @throws AkilesError if an error occurs during the update.
   */
  async update(): Promise<void> {
    const { error } = await Akiles.updateCard(this.uid);
    if (error) throw convertError(error);
  }

  /**
   * Close the connection to the card.
   */
  close(): void {
    Akiles.closeCard(this.uid);
  }
}

/**
 * Convert an e object into an AkilesError instance.
 *
 * @param e - The e object to convert.
 * @returns The corresponding AkilesError instance.
 */
function convertError(e: ErrorInfo): AkilesError {
  const error = new AkilesError(e.code, e.description);

  if (e.reason) {
    error.reason = e.reason;
  }

  if (e.startsAt) {
    error.startsAt = e.startsAt;
  }

  if (e.endsAt) {
    error.endsAt = e.endsAt;
  }

  if (e.schedule) {
    error.schedule = e.schedule;
  }

  if (e.waitTime) {
    error.waitTime = e.waitTime;
  }

  if (e.timezone) {
    error.timezone = e.timezone;
  }

  return error;
}

export default {
  getSessionIDs,
  addSession,
  removeSession,
  removeAllSessions,
  refreshSession,
  refreshAllSessions,
  getGadgets,
  getHardwares,
  scan,
  action,
  sync,
  scanCard,
  isBluetoothSupported,
  isCardEmulationSupported,
};
