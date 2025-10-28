import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

const P = { bg: '#0b0b0c', txt: '#fff', dim: '#c9d1d9', input: '#161b22', border: '#30363d' };

type Direction = 'in' | 'out';
type Station = 'entry' | 'exit';
type Pit = { carNumber: string; direction: Direction; station: Station; timestamp: string; sessionId: string };

export default function EnduranceTab() {
    const [car, setCar] = useState('');
    const [logs, setLogs] = useState<Pit[]>([]);

    function add(direction: Direction) {
        if (!car.trim()) return;

        setLogs((prev: Pit[]): Pit[] => {
            const newEntry: Pit = {
                carNumber: car.trim(),
                direction,
                station: direction === 'in' ? 'entry' : 'exit',
                timestamp: new Date().toISOString(),
                sessionId: new Date().toISOString().slice(0, 10),
            };
            return [newEntry, ...prev].slice(0, 50);
        });
    }


    return (
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
                    keyboardType="numeric"
                />

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
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                            <Text style={{ color: P.txt }}>
                                {new Date(item.timestamp).toLocaleString()} — Car {item.carNumber}: {item.direction.toUpperCase()} ({item.station})
                            </Text>
                        </View>
                    )}
                />
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    h2: { color: P.txt, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: P.txt, fontSize: 15, fontWeight: '700', marginTop: 10 },
    label: { color: P.dim, marginBottom: 6 },
    input: {
        backgroundColor: P.input, color: P.txt, borderColor: P.border,
        borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10
    },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    item: { backgroundColor: '#11161d', borderColor: P.border, borderWidth: 1, borderRadius: 12, padding: 10 },
});
