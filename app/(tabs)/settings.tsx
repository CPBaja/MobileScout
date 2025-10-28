import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const P = { bg: '#0b0b0c', txt: '#fff', dim: '#8b949e' };

export default function SettingsTab() {
    const [tz, setTz] = useState<'local' | 'utc'>('local');

    return (
        <View style={{ flex: 1, backgroundColor: P.bg, padding: 12 }}>
            <AppHeader />
             
            <Card>
                <Text style={styles.h2}>Settings</Text>

                <Text style={{ color: P.txt, marginBottom: 8 }}>Timezone display</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <PrimaryButton title={`Local${tz === 'local' ? ' ✓' : ''}`} onPress={() => setTz('local')} />
                    <PrimaryButton title={`UTC${tz === 'utc' ? ' ✓' : ''}`} onPress={() => setTz('utc')} />
                </View>

                <Text style={styles.hint}>
                    Matches the web Settings tab (demo storage/export UI).
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <PrimaryButton title="Export ALL Data" onPress={() => { }} />
                    <PrimaryButton title="Erase All Data" danger onPress={() => { }} />
                </View>
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    h2: { color: P.txt, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    hint: { color: P.dim, fontSize: 14, marginVertical: 12 },
});
