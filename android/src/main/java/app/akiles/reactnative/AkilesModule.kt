package app.akiles.reactnative

import app.akiles.sdk.Akiles
import app.akiles.sdk.Hardware
import app.akiles.sdk.ScanCallback
import app.akiles.sdk.AkilesException
import app.akiles.sdk.Cancel
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.os.Handler
import android.os.Looper
import java.util.UUID
import android.app.Activity
import app.akiles.sdk.PermissionRequester
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import java.util.concurrent.ConcurrentHashMap
import com.facebook.react.bridge.ReadableMap
import app.akiles.sdk.ActionOptions
import app.akiles.sdk.ErrorCode

@ReactModule(name = AkilesModule.NAME)
class AkilesModule(reactContext: ReactApplicationContext) :
  NativeAkilesSpec(reactContext), PermissionListener {

  companion object {
    const val NAME = "AkilesAdapter"
  }

  private val akiles: Akiles
  private var lastScannedCard: app.akiles.sdk.Card? = null

  // Store cancel tokens by opId
  private val cancelTokens = ConcurrentHashMap<String, app.akiles.sdk.Cancel>()

  init {
    // Use the current Activity as context if available, otherwise fallback to application context
    val activity = reactContext.currentActivity
    akiles = if (activity != null) Akiles(activity) else Akiles(reactContext)
    akiles.setPermissionRequester(PermissionRequester { permissions, requestCode ->
      if (activity is PermissionAwareActivity) {
        activity.requestPermissions(permissions, requestCode, this@AkilesModule)
        true
      } else {
        false
      }
    })
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ): Boolean {
    akiles.onRequestPermissionsResult(requestCode, permissions, grantResults)
    return false
  }

  private fun sendEvent(eventName: String, params: WritableMap?) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  // Add override to all methods that are in the NativeAkilesSpec (matching the TypeScript Spec)
  @ReactMethod
  override fun getSessionIDs(promise: Promise) {
    try {
      val ids = akiles.sessionIDs
      val result = Arguments.createMap().apply {
        putArray("data", Arguments.fromList(ids.toList()))
      }
      promise.resolve(result)
    } catch (ex: AkilesException) {
      val result = Arguments.createMap().apply {
        putMap("error", convertError(ex))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun addSession(token: String, promise: Promise) {
    akiles.addSession(token, object : app.akiles.sdk.Callback<String> {
      override fun onSuccess(resultValue: String) {
        val result = Arguments.createMap().apply {
          putString("data", resultValue)
        }
        promise.resolve(result)
      }
      override fun onError(ex: AkilesException) {
        val result = Arguments.createMap().apply {
          putMap("error", convertError(ex))
        }
        promise.resolve(result)
      }
    })
  }

  @ReactMethod
  override fun removeSession(id: String, promise: Promise) {
    try {
      akiles.removeSession(id)
      val result = Arguments.createMap().apply {
        putNull("data")
      }
      promise.resolve(result)
    } catch (ex: AkilesException) {
      val result = Arguments.createMap().apply {
        putMap("error", convertError(ex))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun removeAllSessions(promise: Promise) {
    try {
      akiles.removeAllSessions()
      val result = Arguments.createMap().apply {
        putNull("data")
      }
      promise.resolve(result)
    } catch (ex: AkilesException) {
      val result = Arguments.createMap().apply {
        putMap("error", convertError(ex))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun refreshSession(id: String, promise: Promise) {
    akiles.refreshSession(id, object : app.akiles.sdk.Callback<Void> {
      override fun onSuccess(resultValue: Void?) {
        val result = Arguments.createMap().apply {
          putNull("data")
        }
        promise.resolve(result)
      }
      override fun onError(ex: AkilesException) {
        val result = Arguments.createMap().apply {
          putMap("error", convertError(ex))
        }
        promise.resolve(result)
      }
    })
  }

  @ReactMethod
  override fun refreshAllSessions(promise: Promise) {
    akiles.refreshAllSessions(object : app.akiles.sdk.Callback<Void> {
      override fun onSuccess(resultValue: Void?) {
        val result = Arguments.createMap().apply {
          putNull("data")
        }
        promise.resolve(result)
      }
      override fun onError(ex: AkilesException) {
        val result = Arguments.createMap().apply {
          putMap("error", convertError(ex))
        }
        promise.resolve(result)
      }
    })
  }

  @ReactMethod
  override fun getGadgets(sessionID: String, promise: Promise) {
    try {
      val gadgets = akiles.getGadgets(sessionID)
      val gadgetsArray = Arguments.createArray()
      gadgets.forEach { gadget ->
        val gadgetMap = Arguments.createMap().apply {
          putString("id", gadget.id)
          putString("name", gadget.name)
          val actionsArray = Arguments.createArray()
          gadget.actions.forEach { action ->
            val actionMap = Arguments.createMap().apply {
              putString("id", action.id)
              putString("name", action.name)
            }
            actionsArray.pushMap(actionMap)
          }
          putArray("actions", actionsArray)
        }
        gadgetsArray.pushMap(gadgetMap)
      }
      val result = Arguments.createMap().apply {
        putArray("data", gadgetsArray)
      }
      promise.resolve(result)
    } catch (ex: AkilesException) {
      val result = Arguments.createMap().apply {
        putMap("error", convertError(ex))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun getHardwares(sessionID: String, promise: Promise) {
    try {
      val hardwares = akiles.getHardwares(sessionID)
      val hardwaresArray = Arguments.createArray()
      hardwares.forEach { hw ->
        val sessionsArray = Arguments.createArray()
        hw.sessions?.forEach { sessionsArray.pushString(it) }
        val hwMap = Arguments.createMap().apply {
          putString("id", hw.id)
          putString("name", hw.name)
          putString("productId", hw.productId)
          putString("revisionId", hw.revisionId)
          putArray("sessions", sessionsArray)
        }
        hardwaresArray.pushMap(hwMap)
      }
      val result = Arguments.createMap().apply {
        putArray("data", hardwaresArray)
      }
      promise.resolve(result)
    } catch (ex: AkilesException) {
      val result = Arguments.createMap().apply {
        putMap("error", convertError(ex))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun scanCard(): String {
    val opId = UUID.randomUUID().toString()
    val cancel = akiles.scanCard(object : app.akiles.sdk.Callback<app.akiles.sdk.Card> {
      override fun onSuccess(card: app.akiles.sdk.Card?) {
        if (card == null) {
          val params = Arguments.createMap().apply {
            putString("opId", opId)
            putMap("error", internalError("Card is null"))
          }
          sendEvent("scan_card_error", params)
          cancelTokens.remove(opId)
          return
        }
        lastScannedCard = card
        val cardMap = Arguments.createMap().apply {
          putString("uid", card.getUid()?.joinToString(separator = "") { String.format("%02X", it) })
          putBoolean("isAkilesCard", card.isAkilesCard())
        }
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("card", cardMap)
        }
        sendEvent("scan_card_success", params)
        cancelTokens.remove(opId)
      }
      override fun onError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("scan_card_error", params)
        cancelTokens.remove(opId)
      }
    })
    cancelTokens[opId] = cancel
    return opId
  }

  @ReactMethod
  override fun updateCard(uid: String, promise: Promise) {
    val card = lastScannedCard
    if (card == null) {
      val result = Arguments.createMap().apply {
        putMap("error", internalError("No card has been scanned yet"))
      }
      promise.resolve(result)
      return
    }
    val cardUid = card.getUid()?.joinToString(separator = "") { String.format("%02X", it) }
    if (cardUid.equals(uid, ignoreCase = true)) {
      card.update(object : app.akiles.sdk.Callback<Void> {
        override fun onSuccess(resultValue: Void?) {
          val result = Arguments.createMap().apply {
            putNull("data")
          }
          promise.resolve(result)
        }
        override fun onError(ex: AkilesException) {
          val result = Arguments.createMap().apply {
            putMap("error", convertError(ex))
          }
          promise.resolve(result)
        }
      })
    } else {
      val result = Arguments.createMap().apply {
        putMap("error", internalError("Card with UID $uid does not match last scanned card ($cardUid)"))
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  override fun scan(): String {
    val opId = UUID.randomUUID().toString()
    val cancel = akiles.scan(object : ScanCallback {
      override fun onDiscover(hw: Hardware) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          val hwMap = Arguments.createMap().apply {
            putString("id", hw.id)
            putString("name", hw.name)
            putString("productId", hw.productId)
            putString("revisionId", hw.revisionId)
            putArray("sessions", Arguments.fromList(hw.sessions.toList()))
          }
          putMap("hardware", hwMap)
        }
        sendEvent("scan_discover", params)
      }
      override fun onSuccess() {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
        }
        sendEvent("scan_success", params)
        cancelTokens.remove(opId)
      }
      override fun onError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("scan_error", params)
        cancelTokens.remove(opId)
      }
    })
    cancelTokens[opId] = cancel
    return opId
  }

  @ReactMethod
  override fun sync(sessionID: String, hardwareID: String): String {
    val opId = UUID.randomUUID().toString()
    val cancel = akiles.sync(sessionID, hardwareID, object : app.akiles.sdk.SyncCallback {
      override fun onStatus(status: app.akiles.sdk.SyncStatus) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putString("status", status.name)
        }
        sendEvent("sync_status", params)
      }
      override fun onStatusProgress(percent: Float) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putDouble("percent", percent.toDouble())
        }
        sendEvent("sync_status_progress", params)
      }
      override fun onSuccess() {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
        }
        sendEvent("sync_success", params)
        cancelTokens.remove(opId)
      }
      override fun onError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("sync_error", params)
        cancelTokens.remove(opId)
      }
    })
    cancelTokens[opId] = cancel
    return opId
  }

  @ReactMethod
  override fun action(sessionID: String, gadgetID: String, actionID: String, options: ReadableMap?): String {
    val opId = UUID.randomUUID().toString()
    var globalDone = false
    var internetDone = false
    var bluetoothDone = false

    val actionOptions = ActionOptions().apply {
        options?.let {
            if (it.hasKey("requestBluetoothPermission")) {
                requestBluetoothPermission = it.getBoolean("requestBluetoothPermission")
            }
            if (it.hasKey("requestLocationPermission")) {
                requestLocationPermission = it.getBoolean("requestLocationPermission")
            }
            if (it.hasKey("useInternet")) {
                useInternet = it.getBoolean("useInternet")
            }
            if (it.hasKey("useBluetooth")) {
                useBluetooth = it.getBoolean("useBluetooth")
            }
        }
    }

    fun maybeRemove() {
      if (globalDone && internetDone && bluetoothDone) {
        cancelTokens.remove(opId)
      }
    }

    val cancel = akiles.action(sessionID, gadgetID, actionID, actionOptions, object : app.akiles.sdk.ActionCallback {
      override fun onSuccess() {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
        }
        sendEvent("action_success", params)
        globalDone = true
        maybeRemove()
      }
      override fun onError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("action_error", params)
        globalDone = true
        maybeRemove()
      }
      override fun onInternetStatus(status: app.akiles.sdk.ActionInternetStatus) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putString("status", status.name)
        }
        sendEvent("action_status_internet", params)
      }
      override fun onInternetSuccess() {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
        }
        sendEvent("action_internet_success", params)
        internetDone = true
        maybeRemove()
      }
      override fun onInternetError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("action_internet_error", params)
        internetDone = true
        maybeRemove()
      }
      override fun onBluetoothStatus(status: app.akiles.sdk.ActionBluetoothStatus) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putString("status", status.name)
        }
        sendEvent("action_status_bluetooth", params)
      }
      override fun onBluetoothStatusProgress(percent: Float) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putDouble("percent", percent.toDouble())
        }
        sendEvent("action_bluetooth_status_progress", params)
      }
      override fun onBluetoothSuccess() {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
        }
        sendEvent("action_bluetooth_success", params)
        bluetoothDone = true
        maybeRemove()
      }
      override fun onBluetoothError(ex: AkilesException) {
        val params = Arguments.createMap().apply {
          putString("opId", opId)
          putMap("error", convertError(ex))
        }
        sendEvent("action_bluetooth_error", params)
        bluetoothDone = true
        maybeRemove()
      }
    })
    cancelTokens[opId] = cancel
    return opId
  }

  @ReactMethod
  override fun cancel(opId: String) {
    cancelTokens.remove(opId)?.cancel()
  }

  @ReactMethod
  override fun closeCard(uid: String) {
    val card = lastScannedCard
    if (card == null) return
    val cardUid = card.getUid()?.joinToString(separator = "") { String.format("%02X", it) }
    if (cardUid.equals(uid, ignoreCase = true)) {
      card.close()
      lastScannedCard = null;
    }
    // If uid doesn't match, do nothing
  }

  /**
   * Get whether Bluetooth is supported on this phone.
   *
   * Returns whether Bluetooth is supported on this phone. This checks for the presence of Bluetooth LE hardware and requires Android 10 (API 29) or newer.
   *
   * @returns true if Bluetooth is supported, false otherwise.
   */
  @ReactMethod
  override fun isBluetoothSupported(): Boolean {
    return akiles.isBluetoothSupported()
  }

  /**
   * Get whether card emulation is supported on this phone.
   *
   * Returns whether card emulation is supported on this phone. This checks for the presence of NFC Host Card Emulation hardware.
   *
   * @returns true if card emulation is supported, false otherwise.
   */
  @ReactMethod
  override fun isCardEmulationSupported(promise: Promise) {
    promise.resolve(akiles.isCardEmulationSupported());
  }

  @ReactMethod
  override fun startCardEmulation(promise: Promise) {
    val result = Arguments.createMap().apply {
      putMap("error", Arguments.createMap().apply {
        putString("code", ErrorCode.INVALID_PARAM.name)
        putString("description", "not needed on android")
      })
    }
    promise.resolve(result)
  }

  private fun convertError(ex: AkilesException): WritableMap {
    return Arguments.createMap().apply {
        putString("code", ex.code.name)
        putString("description", ex.description)

        if (ex is AkilesException.PermissionDenied) {
            putString("reason", ex.reason.name)

            if (ex is AkilesException.PermissionDeniedNotStarted) {
                putString("startsAt", ex.startsAt)
            } else if (ex is AkilesException.PermissionDeniedEnded) {
                putString("endsAt", ex.endsAt)
            } else if (ex is AkilesException.PermissionDeniedOutOfSchedule) {
                putMap("schedule", Arguments.createMap().apply {
                    putArray("weekdays", Arguments.createArray().apply {
                        ex.schedule.weekdays.forEach { weekday ->
                            pushMap(Arguments.createMap().apply {
                                putArray("ranges", Arguments.createArray().apply {
                                    weekday.ranges.forEach { range ->
                                        pushMap(Arguments.createMap().apply {
                                            putInt("start", range.start)
                                            putInt("end", range.end)
                                        })
                                    }
                                })
                            })
                        }
                    })
                })
                putInt("waitTime", ex.waitTime)
                putString("timezone", ex.timezone)
            }
        }
    }
  }

  private fun internalError(description: String): WritableMap {
    return Arguments.createMap().apply {
        putString("code", ErrorCode.INTERNAL.name)
        putString("description", description)
    }
  }
}
