import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import EventSelector from '../ui/EventSelector';

export default function PitLogsScreen() {
    const [carNumber, setCarNumber] = useState('');
    const [eventName, setEventName] = useState(''); // ← controlled by the dropdown

    const handlePitIn = () => {
        // use eventName here; it will only be one of the three options (or "")
        console.log({ carNumber, eventName, action: 'Pit In' });
    };

    const handlePitOut = () => {
        console.log({ carNumber, eventName, action: 'Pit Out' });
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Car Number input (unchanged) */}
            <TextInput
                style={styles.input}
                value={carNumber}
                onChangeText={setCarNumber}
                placeholder="e.g., 42"
                placeholderTextColor="#6b7280"
            />

            {/* Event name dropdown (new) */}
            <EventSelector value={eventName} onChange={setEventName} />

            <View style={styles.row}>
                <Button title="Pit In" onPress={handlePitIn} />
                <View style={{ width: 12 }} />
                <Button title="Pit Out" onPress={handlePitOut} />
            </View>

            {/* rest of your UI... */}
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
