import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface ErrorInfo {
  code: ErrorCode;
  description: string;

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

  /**
   * Geolocation restriction of the site. Only present if `code` is `INTERNET_LOCATION_OUT_OF_RADIUS`.
   */
  siteGeo?: SiteGeo;

  /**
   * Actual distance to the site, in meters. Only present if `code` is `INTERNET_LOCATION_OUT_OF_RADIUS`.
   */
  distance?: number;
}

/**
 * Geographic location
 */
export interface Location {
  /**
   * Latitude, in degrees.
   */
  lat: number;

  /**
   * Longitude, in degrees.
   */
  lng: number;
}

/**
 * Geolocation restriction of a site
 */
export interface SiteGeo {
  /**
   * Location.
   */
  location: Location;

  /**
   * Max radius, in meters.
   */
  radius: number;
}

export enum ErrorCode {
  /**
   * Something went wrong internally. This should never happen, if you see it you can contact
   * Akiles for help.
   */
  INTERNAL = 'INTERNAL',

  /**
   * Invalid parameter. The `message` field contains extra information.
   */
  INVALID_PARAM = 'INVALID_PARAM',

  /**
   * The session token is invalid. Possible causes:
   * - The session token has an incorrect format.
   * - The organization administrator has uninstalled the application.
   * - The member has been deleted.
   * - The member token has been deleted.
   */
  INVALID_SESSION = 'INVALID_SESSION',

  /**
   * The current session does not have permission to do the requested action on the device.
   */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /**
   * All communication methods (Internet, Bluetooth) have failed.
   *
   * Check the errors reported in `onInternetError` and `onBluetoothError` for information
   * on why each method failed.
   */
  ALL_COMM_METHODS_FAILED = 'ALL_COMM_METHODS_FAILED',

  /**
   * Phone has no internet access.
   */
  INTERNET_NOT_AVAILABLE = 'INTERNET_NOT_AVAILABLE',

  /**
   * Phone has internet access and could reach the Akiles server, but the Akiles server could
   * not reach the device because it's either offline or turned off.
   */
  INTERNET_DEVICE_OFFLINE = 'INTERNET_DEVICE_OFFLINE',

  /**
   * The organization administrator has enabled geolocation check for this device, and the
   * phone's location services indicate it's outside the maximum radius.
   *
   * This check only applies to actions via internet, since being able to do actions via Bluetooth
   * already guarantees you're near the device without need for geolocation checking.
   */
  INTERNET_LOCATION_OUT_OF_RADIUS = 'INTERNET_LOCATION_OUT_OF_RADIUS',

  /**
   * The organization administrator has configured this device so it doesn't accept actions via
   * the internet communication method. Other methods such as Bluetooth, PINs, cards, NFC might work.
   */
  INTERNET_NOT_PERMITTED = 'INTERNET_NOT_PERMITTED',

  /**
   * The device is not within Bluetooth range, or is turned off.
   */
  BLUETOOTH_DEVICE_NOT_FOUND = 'BLUETOOTH_DEVICE_NOT_FOUND',

  /**
   * The phone has bluetooth turned off, the user should enable it.
   */
  BLUETOOTH_DISABLED = 'BLUETOOTH_DISABLED',

  /**
   * The phone has no bluetooth support.
   */
  BLUETOOTH_NOT_AVAILABLE = 'BLUETOOTH_NOT_AVAILABLE',

  /**
   * The phone has bluetooth support, but the user hasn't granted permission for it to the app.
   */
  BLUETOOTH_PERMISSION_NOT_GRANTED = 'BLUETOOTH_PERMISSION_NOT_GRANTED',

  /**
   * The user hasn't granted Bluetooth permission to the app permanently.
   * You should show some UI directing the user to the "app info" section to grant it.
   */
  BLUETOOTH_PERMISSION_NOT_GRANTED_PERMANENTLY = 'BLUETOOTH_PERMISSION_NOT_GRANTED_PERMANENTLY',

  /**
   * Operation timed out.
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * Operation has been canceled.
   */
  CANCELED = 'CANCELED',

  /**
   * This phone has no NFC support.
   */
  NFC_NOT_AVAILABLE = 'NFC_NOT_AVAILABLE',

  /**
   * NFC read error. The user either moved the card away too soon, or the card is not compatible.
   */
  NFC_READ_ERROR = 'NFC_READ_ERROR',

  /**
   * This NFC card is not compatible with Akiles devices.
   */
  NFC_CARD_NOT_COMPATIBLE = 'NFC_CARD_NOT_COMPATIBLE',

  /**
   * The phone has location turned off, the user should enable it.
   */
  LOCATION_DISABLED = 'LOCATION_DISABLED',

  /**
   * The phone has no location support.
   */
  LOCATION_NOT_AVAILABLE = 'LOCATION_NOT_AVAILABLE',

  /**
   * The phone has location support, but the user hasn't granted permission for it to the app.
   */
  LOCATION_PERMISSION_NOT_GRANTED = 'LOCATION_PERMISSION_NOT_GRANTED',

  /**
   * The user hasn't granted location permission to the app permanently.
   * You should show some UI directing the user to the "app info" section to grant it.
   */
  LOCATION_PERMISSION_NOT_GRANTED_PERMANENTLY = 'LOCATION_PERMISSION_NOT_GRANTED_PERMANENTLY',

  /**
   * The phone failed to acquire a GNSS fix in reasonable time, probably because it has bad coverage (it's indoors, etc).
   */
  LOCATION_FAILED = 'LOCATION_FAILED',
}

export interface GadgetAction {
  id: string;
  name: string;
}

export interface Gadget {
  id: string;
  name: string;
  actions: GadgetAction[];
}

export interface Hardware {
  id: string;
  name: string;
  productId: string;
  revisionId: string;
  sessions: string[];
}

export interface Card {
  uid: string;
  isAkilesCard: boolean;
}

export enum ActionInternetStatus {
  EXECUTING_ACTION = 'EXECUTING_ACTION',
  ACQUIRING_LOCATION = 'ACQUIRING_LOCATION',
  WAITING_FOR_LOCATION_IN_RADIUS = 'WAITING_FOR_LOCATION_IN_RADIUS',
}

export enum ActionBluetoothStatus {
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  SYNCING_DEVICE = 'SYNCING_DEVICE',
  SYNCING_SERVER = 'SYNCING_SERVER',
  EXECUTING_ACTION = 'EXECUTING_ACTION',
}

export enum SyncStatus {
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  SYNCING_DEVICE = 'SYNCING_DEVICE',
  SYNCING_SERVER = 'SYNCING_SERVER',
}

/**
 * Options used to configure the behavior of the `action` method.
 */
export interface ActionOptions {
  /**
   * Whether to request Bluetooth permission if needed.
   *
   * This controls the behavior when the app hasn't been granted Bluetooth permissions yet:
   * - If false, the Bluetooth communication method immediately errors with `BLUETOOTH_PERMISSION_NOT_GRANTED`.
   * - If true, the SDK will try to request the permission from the user and wait for a response. If granted,
   *   it carries on with the action. If not granted or it couldn't be requested, it errors with `BLUETOOTH_PERMISSION_NOT_GRANTED`.
   *   The permission can't be requested if the user has denied it twice, or if the `PermissionRequester` returns `false`.
   *
   * Default: `true`.
   */
  requestBluetoothPermission?: boolean;

  /**
   * Whether to request location permission if needed.
   *
   * This controls the behavior when the app hasn't been granted location permissions yet:
   * - If false, the internet communication method immediately errors with `LOCATION_PERMISSION_NOT_GRANTED`.
   * - If true, the SDK will try to request the permission from the user and wait for a response. If granted,
   *   it carries on with the action. If not granted or it couldn't be requested, it.errors with `LOCATION_PERMISSION_NOT_GRANTED`.
   *   The permission can't be requested if the user has denied it twice, or if the `PermissionRequester` returns `false`.
   *
   * Default: `true`.
   */
  requestLocationPermission?: boolean;

  /**
   * Whether to try using the internet communication method.
   *
   * If false, it immediately errors with `CANCELED`.
   *
   * Default: `true`.
   */
  useInternet?: boolean;

  /**
   * Whether to try using the Bluetooth communication method.
   *
   * If false, it immediately errors with `CANCELED`.
   *
   * Default: `true`.
   */
  useBluetooth?: boolean;
}

export enum PermissionDeniedReason {
  /**
   * Other reason.
   */
  OTHER = 'OTHER',

  /**
   * Current time is before member's starts_at.
   */
  MEMBER_NOT_STARTED = 'MEMBER_NOT_STARTED',

  /**
   * Current time is after member's ends_at.
   */
  MEMBER_ENDED = 'MEMBER_ENDED',

  /**
   * Current time is not inside the configured schedule.
   */
  OUT_OF_SCHEDULE = 'OUT_OF_SCHEDULE',

  /**
   * The Akiles organization this device belongs to is disabled.
   */
  ORGANIZATION_DISABLED = 'ORGANIZATION_DISABLED',
}

export interface Schedule {
  /**
   * Array of 7 elements, one for each day of the week (Monday=0).
   */
  weekdays: ScheduleWeekday[];
}

export interface ScheduleWeekday {
  /**
   * Array of allowed time ranges for this day, in seconds since midnight.
   */
  ranges: ScheduleRange[];
}

export interface ScheduleRange {
  /**
   * Start of the range, in seconds since midnight (inclusive).
   */
  start: number;

  /**
   * End of the range, in seconds since midnight (exclusive).
   */
  end: number;
}

export interface Spec extends TurboModule {
  getVersion(): string;
  getSessionIDs(): Promise<{ error?: ErrorInfo; data?: string[] }>;
  addSession(token: string): Promise<{ error?: ErrorInfo; data?: string }>;
  removeSession(id: string): Promise<{ error?: ErrorInfo }>;
  removeAllSessions(): Promise<{ error?: ErrorInfo }>;
  refreshSession(id: string): Promise<{ error?: ErrorInfo }>;
  refreshAllSessions(): Promise<{ error?: ErrorInfo }>;
  getGadgets(
    sessionID: string
  ): Promise<{ error?: ErrorInfo; data?: Gadget[] }>;
  getHardwares(
    sessionID: string
  ): Promise<{ error?: ErrorInfo; data?: Hardware[] }>;
  scan(): string; // returns opId
  action(
    sessionID: string,
    gadgetID: string,
    actionID: string,
    options?: ActionOptions | undefined | null
  ): string; // returns opId
  sync(sessionID: string, hardwareID: string): string; // returns opId
  scanCard(): string; // returns opId
  updateCard(uid: string): Promise<{ error?: ErrorInfo }>;
  closeCard(uid: string): void;
  cancel(opId: string): void;
  isBluetoothSupported(): boolean;
  isCardEmulationSupported(): Promise<boolean>;
  startCardEmulation(): Promise<{ error?: ErrorInfo }>; // iOS only
}

export default TurboModuleRegistry.getEnforcing<Spec>('AkilesAdapter');
