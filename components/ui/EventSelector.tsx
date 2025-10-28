import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
    value: string;
    onChange: (val: string) => void;
    label?: string;
};

const OPTIONS = ['Acceleration', 'Stability', 'Suspension'];

export default function EventSelector({ value, onChange, label = 'Event name' }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.pickerWrapper}>
                <Picker selectedValue={value} onValueChange={onChange} mode="dropdown">
                    <Picker.Item label="Select event…" value="" />
                    {OPTIONS.map(opt => (
                        <Picker.Item key={opt} label={opt} value={opt} />
                    ))}
                </Picker>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    label: { color: '#cbd5e1', marginBottom: 8, fontSize: 14 },
    pickerWrapper: {
        borderRadius: 10,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#374151',
        overflow: 'hidden',
    },
});
