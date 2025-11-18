import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    View,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Button,
    NativeSyntheticEvent,
    TextInputKeyPressEventData,
} from 'react-native';
import DismissKeyboard from '@/components/ui/DismissKeyboard'; // ✅ safe wrapper that skips Touchable on web

const P = { bg: '#0b0b0c', txt: '#fff', dim: '#c9d1d9', input: '#161b22', border: '#30363d' };

type Direction = 'in' | 'out';
type Station = 'entry' | 'exit';
type Pit = { carNumber: string; direction: Direction; station: Station; timestamp: string; sessionId: string };

const CAR_INPUT_ACCESSORY = 'carNumberAccessory';

// Lazy “Done” toolbar, imported only on iOS
function DoneAccessory({ nativeID }: { nativeID: string }) {
    if (Platform.OS !== 'ios') return null;
    // Lazy require keeps it out of web bundle
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { InputAccessoryView } = require('react-native');
    return (
        <InputAccessoryView nativeID={nativeID}>
            <View style={styles.accessoryBar}>
                <View style={{ flex: 1 }} />
                <Button title="Done" onPress={Keyboard.dismiss} />
            </View>
        </InputAccessoryView>
    );
}

export default function EnduranceTab() {
    const [car, setCar] = useState('');
    const [logs, setLogs] = useState<Pit[]>([]);

    function add(direction: Direction) {
        if (!car.trim()) return;
        const newEntry: Pit = {
            carNumber: car.trim(),
            direction,
            station: direction === 'in' ? 'entry' : 'exit',
            timestamp: new Date().toISOString(),
            sessionId: new Date().toISOString().slice(0, 10),
        };
        setLogs(prev => [newEntry, ...prev].slice(0, 50));
        setCar('');
        Keyboard.dismiss();
    }

    // allow Enter/Escape to blur in web
    function onWebKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
        if (Platform.OS !== 'web') return;
        const key = e.nativeEvent.key;
        if (key === 'Enter' || key === 'Escape') {
            (e.target as unknown as HTMLInputElement)?.blur?.();
            Keyboard.dismiss();
        }
    }

    const carKeyboardType = Platform.select({
        ios: 'number-pad',
        android: 'numeric',
        web: 'numeric',
    }) as any;

    return (
        <DismissKeyboard>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: P.bg }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.select({ ios: 70, android: 0 })}
            >
                <View style={{ flex: 1, backgroundColor: P.bg, padding: 12 }}>
                    <AppHeader />
                    <Card>
                        <Text style={styles.h2}>Pit Logs</Text>

                        <Text style={styles.label}>Car number</Text>
                        <TextInput
                            value={car}
                            onChangeText={setCar}
                            placeholder="e.g., 42"
                            placeholderTextColor={P.dim}
                            style={styles.input}
                            keyboardType={carKeyboardType}
                            inputMode="numeric"
                            returnKeyType="done"
                            blurOnSubmit
                            onSubmitEditing={Keyboard.dismiss}
                            onKeyPress={onWebKeyPress}
                            inputAccessoryViewID={Platform.OS === 'ios' ? CAR_INPUT_ACCESSORY : undefined}
                        />

                        <DoneAccessory nativeID={CAR_INPUT_ACCESSORY} />

                        <View style={styles.row}>
                            <PrimaryButton title="Pit In" onPress={() => add('in')} />
                            <PrimaryButton title="Pit Out" onPress={() => add('out')} />
                        </View>

                        <View style={styles.row}>
                            <PrimaryButton title="Export PitLogs CSV" onPress={() => { }} />
                        </View>

                        <Text style={styles.h3}>Recent pit events</Text>
                        <FlatList
                            data={logs}
                            keyExtractor={(i, idx) => i.timestamp + idx}
                            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                            keyboardShouldPersistTaps="always"
                            renderItem={({ item }) => (
                                <View style={styles.item}>
                                    <Text style={{ color: P.txt }}>
                                        {new Date(item.timestamp).toLocaleString()} — Car {item.carNumber}:{' '}
                                        {item.direction.toUpperCase()} ({item.station})
                                    </Text>
                                </View>
                            )}
                        />
                    </Card>
                </View>
            </KeyboardAvoidingView>
        </DismissKeyboard>
    );
}

const styles = StyleSheet.create({
    h2: { color: P.txt, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: P.txt, fontSize: 15, fontWeight: '700', marginTop: 10 },
    label: { color: P.dim, marginBottom: 6 },
    input: {
        backgroundColor: P.input,
        color: P.txt,
        borderColor: P.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    item: {
        backgroundColor: '#11161d',
        borderColor: P.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    accessoryBar: {
        backgroundColor: '#11161d',
        borderTopColor: P.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 8,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
});
