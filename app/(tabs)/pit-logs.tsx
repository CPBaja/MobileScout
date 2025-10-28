import EventSelector from '@/components/ui/EventSelector';
import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function PitLogsScreen() {
    const [carNumber, setCarNumber] = useState('');
    const [eventName, setEventName] = useState('');

    const handlePitIn = () => {
        // eventName will be "", "Acceleration", "Stability", or "Suspension"
        console.log({ carNumber, eventName, action: 'Pit In' });
    };

    const handlePitOut = () => {
        console.log({ carNumber, eventName, action: 'Pit Out' });
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <TextInput
                style={styles.input}
                value={carNumber}
                onChangeText={setCarNumber}
                placeholder="e.g., 42"
                placeholderTextColor="#6b7280"
            />

            {/* NEW: dropdown replaces your old text input */}
            <EventSelector value={eventName} onChange={setEventName} />

            <View style={styles.row}>
                <Button title="Pit In" onPress={handlePitIn} />
                <View style={{ width: 12 }} />
                <Button title="Pit Out" onPress={handlePitOut} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: '#0b0f19', flexGrow: 1 },
    input: {
        backgroundColor: '#111827',
        color: '#fff',
        borderColor: '#374151',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
    },
    row: { flexDirection: 'row', marginTop: 8 },
});
