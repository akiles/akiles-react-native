import { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Button,
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ak from 'akiles-react-native';
import type { Gadget, GadgetAction, Hardware } from 'akiles-react-native';

export default function App() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | undefined>(
    undefined
  );
  const [gadgets, setGadgets] = useState<Gadget[]>([]);
  const [selectedGadget, setSelectedGadget] = useState<string | undefined>(
    undefined
  );
  const [actions, setActions] = useState<GadgetAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<string | undefined>(
    undefined
  );
  const [internetStatus, setInternetStatus] = useState('');
  const [bluetoothStatus, setBluetoothStatus] = useState('');
  const [scanHardwares, setScanHardwares] = useState<Hardware[]>([]);
  const [selectedHardware, setSelectedHardware] = useState<string | undefined>(
    undefined
  );
  const [cardInfo, setCardInfo] = useState<{
    uid: string;
    isAkilesCard: boolean;
  } | null>(null);
  const [cardUpdateResult, setCardUpdateResult] = useState<string | null>(null);
  const [cancelScanCardFn, setCancelScanCardFn] = useState<(() => void) | null>(
    null
  );
  // Scan state
  const [cancelScanFn, setCancelScanFn] = useState<(() => void) | null>(null);
  // Sync state
  const [cancelSyncFn, setCancelSyncFn] = useState<(() => void) | null>(null);
  // Action state
  const [cancelActionFn, setCancelActionFn] = useState<(() => void) | null>(
    null
  );

  const [bluetoothSupported, setBluetoothSupported] = useState<boolean | null>(
    null
  );
  const [cardEmulationSupported, setCardEmulationSupported] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    setBluetoothSupported(ak.isBluetoothSupported());
    ak.isCardEmulationSupported().then(setCardEmulationSupported);
  }, []);

  useEffect(() => {
    ak.getSessionIDs()
      .then((ids) => {
        setSessions(ids);
        if (ids.length > 0) setSelectedSession(ids[0]);
      })
      .catch((e) => setResult('Error loading sessions: ' + describeError(e)));
  }, []);

  // Fetch gadgets when session changes
  useEffect(() => {
    if (!selectedSession) {
      setGadgets([]);
      setSelectedGadget(undefined);
      setActions([]);
      setSelectedAction(undefined);
      return;
    }
    ak.getGadgets(selectedSession)
      .then((gadgets) => {
        setGadgets(gadgets);
        setSelectedGadget(gadgets[0]?.id);
      })
      .catch((e) => setResult('Error loading gadgets: ' + describeError(e)));
  }, [selectedSession]);

  // Fetch actions when gadget changes
  useEffect(() => {
    const gadget = gadgets.find((g) => g.id === selectedGadget);
    if (gadget) {
      setActions(gadget.actions);
      setSelectedAction(gadget.actions[0]?.id);
    } else {
      setActions([]);
      setSelectedAction(undefined);
    }
  }, [selectedGadget, gadgets]);

  const handleError = (e: any) => {
    console.error('Error:', e);
    setResult('Error: ' + describeError(e));
  };

  const handleAddSession = async () => {
    try {
      const sessionId = await ak.addSession(token);
      setResult('Session added: ' + sessionId);
      // Refresh sessions list
      const ids = await ak.getSessionIDs();
      setSessions(ids);
      setSelectedSession(sessionId); // Select the newly added session by default
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleRefreshSession = async () => {
    if (!selectedSession) return setResult('Select a session to refresh');
    try {
      await ak.refreshSession(selectedSession);
      setResult('Session refreshed: ' + selectedSession);
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleRefreshAllSessions = async () => {
    try {
      await ak.refreshAllSessions();
      setResult('All sessions refreshed');
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return setResult('Select a session to delete');
    try {
      await ak.removeSession(selectedSession);
      setResult('Session deleted: ' + selectedSession);
      const ids = await ak.getSessionIDs();
      setSessions(ids);
      setSelectedSession(undefined);
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleDeleteAllSessions = async () => {
    try {
      await ak.removeAllSessions();
      setResult('All sessions deleted');
      setSessions([]);
      setSelectedSession(undefined);
    } catch (e: any) {
      handleError(e);
    }
  };

  // Scan handler
  const handleScan = () => {
    setScanHardwares([]);
    setSelectedHardware(undefined);
    setResult('Scanning...');
    const cancel = ak.scan({
      onDiscover: (hw) => {
        setScanHardwares((prev) => {
          if (prev.find((h) => h.id === hw.id)) return prev;
          return [...prev, hw];
        });
      },
      onSuccess: () => {
        setCancelScanFn(null);
        setResult('Scan finished');
      },
      onError: (e) => {
        setCancelScanFn(null);
        handleError(e);
      },
    });
    setCancelScanFn(() => cancel);
  };

  const handleCancelScan = () => {
    if (cancelScanFn) {
      cancelScanFn();
      setCancelScanFn(null);
      setResult('Scan canceled');
    }
  };

  // Sync handler
  const handleSync = () => {
    if (!selectedSession || !selectedHardware) {
      setResult('Select session and hardware');
      return;
    }
    setResult('Sync started...');
    const cancel = ak.sync(selectedSession, selectedHardware, {
      onStatus: (status) => setResult('Sync status: ' + status),
      onStatusProgress: (percent) =>
        setResult('Sync progress: ' + Math.round(percent) + '%'),
      onSuccess: () => {
        setCancelSyncFn(null);
        setResult('Sync succeeded');
      },
      onError: (e) => {
        setCancelSyncFn(null);
        handleError(e);
      },
    });
    setCancelSyncFn(() => cancel);
  };

  const handleCancelSync = () => {
    if (cancelSyncFn) {
      cancelSyncFn();
      setCancelSyncFn(null);
      setResult('Sync canceled');
    }
  };

  // Action handler
  const handleDoAction = () => {
    if (!selectedSession || !selectedGadget || !selectedAction) {
      setResult('Select session, gadget, and action');
      return;
    }
    setInternetStatus('');
    setBluetoothStatus('');
    setResult('Action started...');
    const cancel = ak.action(
      selectedSession,
      selectedGadget,
      selectedAction,
      null,
      {
        onSuccess: () => {
          setCancelActionFn(null);
          setResult('Action succeeded');
        },
        onError: (e) => {
          setCancelActionFn(null);
          handleError(e);
        },
        onInternetStatus: (status) => setInternetStatus('Status: ' + status),
        onInternetSuccess: () => setInternetStatus('Success'),
        onInternetError: (e) => setInternetStatus('Error: ' + describeError(e)),
        onBluetoothStatus: (status) => setBluetoothStatus('Status: ' + status),
        onBluetoothStatusProgress: (percent) =>
          setBluetoothStatus('Progress: ' + Math.round(percent) + '%'),
        onBluetoothSuccess: () => setBluetoothStatus('Success'),
        onBluetoothError: (e) =>
          setBluetoothStatus('Error: ' + describeError(e)),
      }
    );
    setCancelActionFn(() => cancel);
  };

  const handleCancelAction = () => {
    if (cancelActionFn) {
      cancelActionFn();
      setCancelActionFn(null);
      setResult('Action canceled');
    }
  };

  const handleScanCard = () => {
    setCardInfo(null);
    setCardUpdateResult(null);
    setResult('Scanning card...');
    const cancel = ak.scanCard({
      onSuccess: (card) => {
        setCancelScanCardFn(null);
        setCardInfo(card);
        setResult(
          'Card scanned: UID ' +
            card.uid +
            ', isAkilesCard: ' +
            card.isAkilesCard
        );
        if (card.isAkilesCard) {
          setCardUpdateResult('Updating card...');
          card
            .update()
            .then(() => setCardUpdateResult('Card updated successfully'))
            .catch((e) =>
              setCardUpdateResult('Update failed: ' + describeError(e))
            )
            .finally(() => card.close());
        } else {
          card.close();
        }
      },
      onError: (e) => {
        setCancelScanCardFn(null);
        handleError(e);
      },
    });
    setCancelScanCardFn(() => cancel);
  };

  const handleCancelScanCard = () => {
    if (cancelScanCardFn) {
      cancelScanCardFn();
      setCancelScanCardFn(null);
      setResult('Card scan canceled');
    }
  };

  const describeError = (e: any) => {
    if (typeof e === 'string') return e;
    if (!e || typeof e !== 'object') return String(e);

    const lines = [e.message];
    for (const [key, value] of Object.entries(e)) {
      if (key == 'name') continue;
      if (value !== undefined && value !== null) {
        const valueStr =
          typeof value === 'object' ? JSON.stringify(value) : String(value);
        lines.push(`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0${key}: ${valueStr}`);
      }
    }
    return lines.join('\n');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        {/* Show Bluetooth and Card Emulation support */}
        <Text style={styles.label}>
          Bluetooth Supported:{' '}
          <Text style={{ color: '#b0bec5' }}>
            {bluetoothSupported === null
              ? '...'
              : bluetoothSupported
                ? 'Yes'
                : 'No'}
          </Text>
        </Text>
        <Text style={styles.label}>
          Card Emulation Supported:{' '}
          <Text style={{ color: '#b0bec5' }}>
            {cardEmulationSupported === null
              ? '...'
              : cardEmulationSupported
                ? 'Yes'
                : 'No'}
          </Text>
        </Text>
        <View
          style={{
            height: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
            placeholder="Enter token"
            placeholderTextColor="#aaa"
            value={token}
            onChangeText={setToken}
          />
          <Button
            title="Add Session"
            onPress={handleAddSession}
            color={styles.button.color}
          />
        </View>
        <Text style={styles.result}>Result: {result}</Text>
        <Text style={styles.title}>Sessions</Text>
        <Picker
          selectedValue={selectedSession}
          style={styles.picker}
          onValueChange={setSelectedSession}
          dropdownIconColor="#fff"
        >
          {sessions.length === 0 ? (
            <Picker.Item label="No sessions" value={undefined} color="#888" />
          ) : (
            sessions.map((id) => (
              <Picker.Item key={id} label={id} value={id} color="#fff" />
            ))
          )}
        </Picker>
        <View style={styles.buttonGrid}>
          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <Button
                title="Refresh Session"
                onPress={handleRefreshSession}
                color={styles.button.color}
              />
            </View>
            <View style={styles.buttonCell}>
              <Button
                title="Refresh All Sessions"
                onPress={handleRefreshAllSessions}
                color={styles.button.color}
              />
            </View>
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <Button
                title="Delete Session"
                onPress={handleDeleteSession}
                color={styles.button.color}
              />
            </View>
            <View style={styles.buttonCell}>
              <Button
                title="Delete All Sessions"
                onPress={handleDeleteAllSessions}
                color={styles.button.color}
              />
            </View>
          </View>
        </View>
        {/* Move gadget and action pickers below the session management buttons */}
        <Text style={styles.title}>Gadgets</Text>
        {gadgets.length > 0 && (
          <>
            <Text style={styles.label}>Gadgets:</Text>
            <Picker
              selectedValue={selectedGadget}
              style={styles.picker}
              onValueChange={setSelectedGadget}
              dropdownIconColor="#fff"
            >
              {gadgets.map((g) => (
                <Picker.Item
                  key={g.id}
                  label={g.name}
                  value={g.id}
                  color="#fff"
                />
              ))}
            </Picker>
          </>
        )}
        {/* Action UI */}
        {actions.length > 0 && (
          <>
            <Text style={styles.label}>Actions:</Text>
            <Picker
              selectedValue={selectedAction}
              style={styles.picker}
              onValueChange={setSelectedAction}
              dropdownIconColor="#fff"
            >
              {actions.map((a) => (
                <Picker.Item
                  key={a.id}
                  label={a.name}
                  value={a.id}
                  color="#fff"
                />
              ))}
            </Picker>
            <Button
              title={cancelActionFn ? 'Doing Action...' : 'Do Action'}
              onPress={handleDoAction}
              color={styles.button.color}
              disabled={!!cancelActionFn}
            />
            {!!cancelActionFn && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ color: '#b0bec5', marginRight: 12 }}>
                  Doing action...
                </Text>
                <View style={{ width: 24, height: 24, marginRight: 12 }}>
                  <ActivityIndicator size="small" color="#1976d2" />
                </View>
                <Button
                  title="Cancel Action"
                  onPress={handleCancelAction}
                  color="#b71c1c"
                />
              </View>
            )}
            <Text style={styles.statusLine}>Internet: {internetStatus}</Text>
            <Text style={styles.statusLine}>Bluetooth: {bluetoothStatus}</Text>
          </>
        )}
        {/* Scan and hardware picker UI */}
        <Text style={styles.title}>Scan and sync</Text>
        <View style={{ width: '100%', maxWidth: 420, marginTop: 24 }}>
          <Button
            title={cancelScanFn ? 'Scanning...' : 'Scan for Hardware'}
            onPress={handleScan}
            color={styles.button.color}
            disabled={!!cancelScanFn}
          />
          {!!cancelScanFn && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Text style={{ color: '#b0bec5', marginRight: 12 }}>
                Scanning...
              </Text>
              <View style={{ width: 24, height: 24, marginRight: 12 }}>
                <ActivityIndicator size="small" color="#1976d2" />
              </View>
              <Button
                title="Cancel Scan"
                onPress={handleCancelScan}
                color="#b71c1c"
              />
            </View>
          )}
          {scanHardwares.length > 0 && (
            <>
              <Text style={styles.label}>Found Hardware:</Text>
              <Picker
                selectedValue={selectedHardware}
                style={styles.picker}
                onValueChange={setSelectedHardware}
                dropdownIconColor="#fff"
              >
                {scanHardwares.map((hw) => (
                  <Picker.Item
                    key={hw.id}
                    label={hw.name}
                    value={hw.id}
                    color="#fff"
                  />
                ))}
              </Picker>
              <Button
                title={cancelSyncFn ? 'Syncing...' : 'Sync Selected Hardware'}
                onPress={handleSync}
                color={styles.button.color}
                disabled={!!cancelSyncFn}
              />
              {!!cancelSyncFn && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: '#b0bec5', marginRight: 12 }}>
                    Syncing...
                  </Text>
                  <View style={{ width: 24, height: 24, marginRight: 12 }}>
                    <ActivityIndicator size="small" color="#1976d2" />
                  </View>
                  <Button
                    title="Cancel Sync"
                    onPress={handleCancelSync}
                    color="#b71c1c"
                  />
                </View>
              )}
            </>
          )}
        </View>
        {/* Scan Card UI */}
        <Text style={styles.title}>Cards</Text>
        <View style={{ width: '100%', maxWidth: 420, marginTop: 24 }}>
          <Button
            title="Scan Card"
            onPress={handleScanCard}
            color={styles.button.color}
            disabled={!!cancelScanCardFn}
          />
          {!!cancelScanCardFn && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Text style={{ color: '#b0bec5', marginRight: 12 }}>
                Scanning card...
              </Text>
              <View style={{ width: 24, height: 24, marginRight: 12 }}>
                <ActivityIndicator size="small" color="#1976d2" />
              </View>
              <Button
                title="Cancel Scan Card"
                onPress={handleCancelScanCard}
                color="#b71c1c"
              />
            </View>
          )}
          {cardInfo && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>
                Card UID:{' '}
                <Text style={{ color: '#b0bec5' }}>{cardInfo.uid}</Text>
              </Text>
              <Text style={styles.label}>
                isAkilesCard:{' '}
                <Text style={{ color: '#b0bec5' }}>
                  {cardInfo.isAkilesCard ? 'Yes' : 'No'}
                </Text>
              </Text>
              {cardUpdateResult && (
                <Text style={styles.label}>
                  Update:{' '}
                  <Text style={{ color: '#b0bec5' }}>{cardUpdateResult}</Text>
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181a20',
    minHeight: '100%',
    paddingBottom: 32,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181a20',
    padding: 24,
    width: '100%',
    maxWidth: 600,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  result: {
    marginTop: 20,
    color: '#90caf9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    width: 200,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#23242a',
    color: '#fff',
    fontSize: 16,
  },
  button: {
    color: '#1976d2',
  },
  buttonGrid: {
    marginTop: 16,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  buttonCell: {
    flex: 1,
    marginHorizontal: 4,
  },
  picker: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#23242a',
    color: '#fff',
    borderRadius: 6,
    marginTop: 4,
  },
  statusLine: {
    color: '#b0bec5',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 0,
    alignSelf: 'flex-start',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 8,
  },
});
