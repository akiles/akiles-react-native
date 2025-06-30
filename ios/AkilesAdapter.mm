#import "AkilesAdapter.h"
#import <React/RCTBridge.h>
#import <React/RCTConvert.h>
#import <React/RCTUtils.h>
#import <AkilesSDK/AkilesSDK.h>
#import <AkilesSDK/AkilesSDK-Swift.h>
#import <Foundation/Foundation.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <AkilesSpec/AkilesSpec.h>
#endif

@interface AkilesActionCallback : NSObject <ActionCallback>
@property (nonatomic, strong) NSString *operationId;
@property (nonatomic, weak) AkilesAdapter *akiles;
- (instancetype)initWithOperationId:(NSString *)operationId akiles:(AkilesAdapter *)akiles;
@end

@interface AkilesSyncCallback : NSObject <SyncCallback>
@property (nonatomic, strong) NSString *operationId;
@property (nonatomic, weak) AkilesAdapter *akiles;
- (instancetype)initWithOperationId:(NSString *)operationId akiles:(AkilesAdapter *)akiles;
@end

@interface AkilesAdapter ()
@property (nonatomic, strong) Akiles *akiles;
@property (nonatomic, strong) Card *lastScannedCard;
@property (nonatomic, strong) NSMutableDictionary<NSString *, id<Cancellable>> *cancelTokens;
@end

@implementation AkilesAdapter

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        _akiles = [[Akiles alloc] init];
        _lastScannedCard = nil;
        _cancelTokens = [[NSMutableDictionary alloc] init];
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"scan_discover", @"scan_success", @"scan_error",
             @"scan_card_success", @"scan_card_error",
             @"action_success", @"action_error", @"action_status_internet", @"action_internet_success", @"action_internet_error",
             @"action_status_bluetooth", @"action_bluetooth_status_progress", @"action_bluetooth_success", @"action_bluetooth_error",
             @"sync_status", @"sync_status_progress", @"sync_success", @"sync_error",
             @"operation_canceled"];
}

#pragma mark - Utility Methods

- (NSDictionary *)errorResultFromNSError:(NSError *)error
{
    return @{
        @"error": @{
            @"code": NSStringFromErrorCode((ErrorCode)error.code),
            @"description": error.localizedDescription ?: @"Unknown error"
        }
    };
}

- (NSDictionary *)successResultWithData:(id)data
{
    if (data) {
        return @{ @"data": data };
    } else {
        return @{ @"data": [NSNull null] };
    }
}

- (NSDictionary *)dictionaryFromGadget:(Gadget *)gadget
{
    NSMutableArray *actions = [NSMutableArray array];
    for (Action *action in gadget.actions) {
        [actions addObject:@{
            @"id": action.id,
            @"name": action.name
        }];
    }
    
    return @{
        @"id": gadget.id,
        @"name": gadget.name,
        @"actions": actions
    };
}

- (NSDictionary *)dictionaryFromHardware:(Hardware *)hardware
{
    return @{
        @"id": hardware.id,
        @"name": hardware.name,
        @"productId": hardware.productId,
        @"revisionId": hardware.revisionId,
        @"sessions": hardware.sessions
    };
}

- (NSDictionary *)dictionaryFromCard:(Card *)card
{
    NSData *uidData = [card getUid];
    NSMutableString *uidString = [NSMutableString string];
    const unsigned char *bytes = (const unsigned char *)[uidData bytes];
    for (NSUInteger i = 0; i < [uidData length]; i++) {
        [uidString appendFormat:@"%02X", bytes[i]];
    }
    
    return @{
        @"uid": uidString,
        @"isAkilesCard": @([card isAkilesCard])
    };
}

- (ActionOptions *)actionOptionsFromDictionary:(NSDictionary *)optionsDict
{
    ActionOptions *options = [ActionOptions initWithDefaults];

    if (optionsDict && [optionsDict isKindOfClass:[NSDictionary class]]) {
        if (optionsDict[@"requestBluetoothPermission"] != nil) {
            options.requestBluetoothPermission = [optionsDict[@"requestBluetoothPermission"] boolValue];
        }
        if (optionsDict[@"requestLocationPermission"] != nil) {
            options.requestLocationPermission = [optionsDict[@"requestLocationPermission"] boolValue];
        }
        if (optionsDict[@"useInternet"] != nil) {
            options.useInternet = [optionsDict[@"useInternet"] boolValue];
        }
        if (optionsDict[@"useBluetooth"] != nil) {
            options.useBluetooth = [optionsDict[@"useBluetooth"] boolValue];
        }
    }
    
    return options;
}

- (NSString *)actionInternetStatusString:(ActionInternetStatus)status
{
    switch (status) {
        case ActionInternetStatusExecutingAction:
            return @"EXECUTING_ACTION";
        case ActionInternetStatusAcquiringLocation:
            return @"ACQUIRING_LOCATION";
        case ActionInternetStatusWaitingForLocationInRadius:
            return @"WAITING_FOR_LOCATION_IN_RADIUS";
        default:
            return @"EXECUTING_ACTION";
    }
}

- (NSString *)actionBluetoothStatusString:(ActionBluetoothStatus)status
{
    switch (status) {
        case ActionBluetoothStatusScanning:
            return @"SCANNING";
        case ActionBluetoothStatusConnecting:
            return @"CONNECTING";
        case ActionBluetoothStatusSyncingDevice:
            return @"SYNCING_DEVICE";
        case ActionBluetoothStatusSyncingServer:
            return @"SYNCING_SERVER";
        case ActionBluetoothStatusExecutingAction:
            return @"EXECUTING_ACTION";
        default:
            return @"SCANNING";
    }
}

- (NSString *)syncStatusString:(SyncStatus)status
{
    switch (status) {
        case SyncStatusScanning:
            return @"SCANNING";
        case SyncStatusConnecting:
            return @"CONNECTING";
        case SyncStatusSyncingDevice:
            return @"SYNCING_DEVICE";
        case SyncStatusSyncingServer:
            return @"SYNCING_SERVER";
        default:
            return @"SCANNING";
    }
}

#pragma mark - React Native Methods

RCT_EXPORT_METHOD(getSessionIDs:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles getSessionIDs:^(NSArray<NSString *> * _Nullable sessionIDs, NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:sessionIDs]);
        }
    }];
}

RCT_EXPORT_METHOD(addSession:(NSString *)token
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles addSession:token completion:^(NSString * _Nullable sessionID, NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:sessionID]);
        }
    }];
}

RCT_EXPORT_METHOD(removeSession:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles removeSession:id completion:^(NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:nil]);
        }
    }];
}

RCT_EXPORT_METHOD(removeAllSessions:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles removeAllSessions:^(NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:nil]);
        }
    }];
}

RCT_EXPORT_METHOD(refreshSession:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles refreshSession:id completion:^(NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:nil]);
        }
    }];
}

RCT_EXPORT_METHOD(refreshAllSessions:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles refreshAllSessions:^(NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:nil]);
        }
    }];
}

RCT_EXPORT_METHOD(getGadgets:(NSString *)sessionID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles getGadgets:sessionID completion:^(NSArray<Gadget *> * _Nullable gadgets, NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            NSMutableArray *gadgetDicts = [NSMutableArray array];
            for (Gadget *gadget in gadgets) {
                [gadgetDicts addObject:[self dictionaryFromGadget:gadget]];
            }
            resolve([self successResultWithData:gadgetDicts]);
        }
    }];
}

RCT_EXPORT_METHOD(getHardwares:(NSString *)sessionID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles getHardwares:sessionID completion:^(NSArray<Hardware *> * _Nullable hardwares, NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            NSMutableArray *hardwareDicts = [NSMutableArray array];
            for (Hardware *hardware in hardwares) {
                [hardwareDicts addObject:[self dictionaryFromHardware:hardware]];
            }
            resolve([self successResultWithData:hardwareDicts]);
        }
    }];
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, scanCard)
{
    NSString *opId = [[NSUUID UUID] UUIDString];
        
    // Use the new scanCard method that returns a Cancellable object
    id<Cancellable> cancellable = [self.akiles scanCard:^(Card * _Nullable card, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            // Check if operation was cancelled
            if (![self.cancelTokens objectForKey:opId]) {
                return;
            }
            [self.cancelTokens removeObjectForKey:opId];
            
            if (error) {
                [self sendEventWithName:@"scan_card_error" body:@{
                    @"opId": opId,
                    @"error": @{
                        @"code": NSStringFromErrorCode((ErrorCode)error.code),
                        @"description": error.localizedDescription ?: @"Unknown error"
                    }
                }];
            } else {
                self.lastScannedCard = card;
                [self sendEventWithName:@"scan_card_success" body:@{
                    @"opId": opId,
                    @"card": [self dictionaryFromCard:card]
                }];
            }
        });
    }];
    
    // Store the cancellable object for proper cancellation
    [self.cancelTokens setObject:cancellable forKey:opId];
  
    return opId;
}

RCT_EXPORT_METHOD(updateCard:(NSString *)uid
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    if (self.lastScannedCard) {
        [self.lastScannedCard update:^(NSError * _Nullable error) {
            if (error) {
                resolve([self errorResultFromNSError:error]);
            } else {
                resolve([self successResultWithData:nil]);
            }
        }];
    } else {
        NSDictionary *errorResult = @{
            @"error": @{
                @"code": @"INVALID_PARAM",
                @"description": @"No card currently scanned"
            }
        };
        resolve(errorResult);
    }
}

RCT_EXPORT_METHOD(closeCard:(NSString *)uid)
{
    self.lastScannedCard = nil;
}

RCT_EXPORT_METHOD(cancel:(NSString *)opId)
{
    // Check if we have a cancellable object for this operation
    id<Cancellable> cancellable = [self.cancelTokens objectForKey:opId];
    if (cancellable) {
        // Remove the cancellable object to prevent further callbacks
        [self.cancelTokens removeObjectForKey:opId];
        
        // Call cancel on the Cancellable object to properly cancel the operation
        [cancellable cancel];

        // Send appropriate canceled error event based on operation type
        // Since we don't track operation types, we'll send a generic canceled error
        // The React Native side should handle this appropriately
        dispatch_async(dispatch_get_main_queue(), ^{
            // Create a canceled error
            NSDictionary *canceledError = @{
                @"code": @"CANCELED",
                @"description": @"Operation was canceled"
            };
            
            // Send error events for all possible operation types
            // The React Native side will only listen to the relevant one
            [self sendEventWithName:@"scan_error" body:@{
                @"opId": opId,
                @"error": canceledError
            }];
            [self sendEventWithName:@"scan_card_error" body:@{
                @"opId": opId,
                @"error": canceledError
            }];
            [self sendEventWithName:@"action_error" body:@{
                @"opId": opId,
                @"error": canceledError
            }];
            [self sendEventWithName:@"sync_error" body:@{
                @"opId": opId,
                @"error": canceledError
            }];
        });
    }
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSNumber *, isBluetoothSupported) {
    return @([self.akiles isBluetoothSupported]);
}

RCT_EXPORT_METHOD(isCardEmulationSupported:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles isCardEmulationSupported:^(BOOL supported) {
        resolve(@(supported));
    }];
}

RCT_EXPORT_METHOD(startCardEmulation:(NSString *)language resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self.akiles startCardEmulation:language completion:^(BOOL success, NSError * _Nullable error) {
        if (error) {
            resolve([self errorResultFromNSError:error]);
        } else {
            resolve([self successResultWithData:nil]);
        }
    }];
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, scan)
{
    NSString *opId = [[NSUUID UUID] UUIDString];
        
    // Use the new scan method that returns a Cancellable object

    id<Cancellable> cancellable = [self.akiles scan:^(Hardware * _Nonnull hardware) {
        // Check if operation was cancelled
        if (![self.cancelTokens objectForKey:opId]) {
            return;
        }
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"scan_discover" body:@{
                @"opId": opId,
                @"hardware": [self dictionaryFromHardware:hardware]
            }];
        });
    } completion:^(NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            // Check if operation was cancelled
            if (![self.cancelTokens objectForKey:opId]) {
                return;
            }
            
            [self.cancelTokens removeObjectForKey:opId];
            
            if (error) {
                [self sendEventWithName:@"scan_error" body:@{
                    @"opId": opId,
                    @"error": @{
                        @"code": NSStringFromErrorCode((ErrorCode)error.code),
                        @"description": error.localizedDescription ?: @"Unknown error"
                    }
                }];
            } else {
                [self sendEventWithName:@"scan_success" body:@{
                    @"opId": opId
                }];
            }
        });
    }];
    
    // Store the cancellable object for proper cancellation
    [self.cancelTokens setObject:cancellable forKey:opId];

    return opId;
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, sync:(NSString *)sessionID
                  hardwareID:(NSString *)hardwareID)
{
    NSString *opId = [[NSUUID UUID] UUIDString];
        
    AkilesSyncCallback *callback = [[AkilesSyncCallback alloc] initWithOperationId:opId akiles:self];
    
    // Use the new sync method that returns a Cancellable object
    id<Cancellable> cancellable = [self.akiles sync:sessionID hardwareID:hardwareID callback:callback completion:^(NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            // Check if operation was cancelled and remove token
            if (![self.cancelTokens objectForKey:opId]) {
                return;
            }
            [self.cancelTokens removeObjectForKey:opId];
            
            if (error) {
                [self sendEventWithName:@"sync_error" body:@{
                    @"opId": opId,
                    @"error": @{
                        @"code": NSStringFromErrorCode((ErrorCode)error.code),
                        @"description": error.localizedDescription ?: @"Unknown error"
                    }
                }];
            } else {
                [self sendEventWithName:@"sync_success" body:@{
                    @"opId": opId
                }];
            }
        });
    }];
    
    // Store the cancellable object for proper cancellation
    [self.cancelTokens setObject:cancellable forKey:opId];
  
    return opId;
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, action:(NSString *)sessionID
                  gadgetID:(NSString *)gadgetID
                  actionID:(NSString *)actionID
                  options:(NSDictionary *)optionsDict)
{
    NSString *opId = [[NSUUID UUID] UUIDString];
        
    ActionOptions *options = [self actionOptionsFromDictionary:optionsDict];
    AkilesActionCallback *callback = [[AkilesActionCallback alloc] initWithOperationId:opId akiles:self];
    // Use the new action method that returns a Cancellable object
    id<Cancellable> cancellable = [self.akiles action:sessionID gadgetID:gadgetID actionID:actionID options:options callback:callback completion:^{
        // The completion handler for action is void, actual results come through the callback
        // Remove the cancel token when the action completes
        [self.cancelTokens removeObjectForKey:opId];
    }];
    // Store the cancellable object for proper cancellation
    [self.cancelTokens setObject:cancellable forKey:opId];
    return opId;
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeAkilesSpecJSI>(params);
}
#endif

@end

#pragma mark - Callback Implementations

@implementation AkilesActionCallback

- (instancetype)initWithOperationId:(NSString *)operationId akiles:(AkilesAdapter *)akiles
{
    self = [super init];
    if (self) {
        _operationId = operationId;
        _akiles = akiles;
    }
    return self;
}

- (void)onSuccess
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        [self.akiles.cancelTokens removeObjectForKey:self.operationId];
        
        [self.akiles sendEventWithName:@"action_success" body:@{
            @"opId": self.operationId
        }];
    });
}

- (void)onError:(NSError *)error
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        [self.akiles.cancelTokens removeObjectForKey:self.operationId];
        
        [self.akiles sendEventWithName:@"action_error" body:@{
            @"opId": self.operationId,
            @"error": @{
                @"code": NSStringFromErrorCode((ErrorCode)error.code),
                @"description": error.localizedDescription ?: @"Unknown error"
            }
        }];
    });
}

- (void)onInternetStatus:(ActionInternetStatus)status
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }

        [self.akiles sendEventWithName:@"action_status_internet" body:@{
            @"opId": self.operationId,
            @"status": [self.akiles actionInternetStatusString:status]
        }];
    });
}

- (void)onInternetSuccess
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        
        [self.akiles sendEventWithName:@"action_internet_success" body:@{
            @"opId": self.operationId
        }];
    });
}

- (void)onInternetError:(NSError *)error
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }

        [self.akiles sendEventWithName:@"action_internet_error" body:@{
            @"opId": self.operationId,
            @"error": @{
                @"code": NSStringFromErrorCode((ErrorCode)error.code),
                @"description": error.localizedDescription ?: @"Unknown error"
            }
        }];
    });
}

- (void)onBluetoothStatus:(ActionBluetoothStatus)status
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }

        [self.akiles sendEventWithName:@"action_status_bluetooth" body:@{
            @"opId": self.operationId,
            @"status": [self.akiles actionBluetoothStatusString:status]
        }];
    });
}

- (void)onBluetoothStatusProgress:(float)percent
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        
        [self.akiles sendEventWithName:@"action_bluetooth_status_progress" body:@{
            @"opId": self.operationId,
            @"percent": @(percent)
        }];
    });
}

- (void)onBluetoothSuccess
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        
        [self.akiles sendEventWithName:@"action_bluetooth_success" body:@{
            @"opId": self.operationId
        }];
    });
}

- (void)onBluetoothError:(NSError *)error
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }

        [self.akiles sendEventWithName:@"action_bluetooth_error" body:@{
            @"opId": self.operationId,
            @"error": @{
                @"code": NSStringFromErrorCode((ErrorCode)error.code),
                @"description": error.localizedDescription ?: @"Unknown error"
            }
        }];
    });
}

@end

@implementation AkilesSyncCallback

- (instancetype)initWithOperationId:(NSString *)operationId akiles:(AkilesAdapter *)akiles
{
    self = [super init];
    if (self) {
        _operationId = operationId;
        _akiles = akiles;
    }
    return self;
}

- (void)onStatus:(SyncStatus)status
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        
        [self.akiles sendEventWithName:@"sync_status" body:@{
            @"opId": self.operationId,
            @"status": [self.akiles syncStatusString:status]
        }];
    });
}

- (void)onStatusProgress:(float)percent
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if operation was cancelled
        if (![self.akiles.cancelTokens objectForKey:self.operationId]) {
            return;
        }
        
        [self.akiles sendEventWithName:@"sync_status_progress" body:@{
            @"opId": self.operationId,
            @"percent": @(percent)
        }];
    });
}

@end
