import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
    value: string;
    onChange: (val: string) => void;
    label?: string;
};

const OPTIONS = ['Acceleration', 'Stability', 'Suspension'];

/**
 * A dropdown selector component for choosing an event.
 * 
 * @component
 * @example
 * const [event, setEvent] = useState('');
 * return <EventSelector value={event} onChange={setEvent} label="Select an event" />
 * 
 * @param {Props} props - The component props
 * @param {string} props.value - The currently selected event value
 * @param {(value: string) => void} props.onChange - Callback fired when the selected event changes
 * @param {string} [props.label='Event name'] - The label displayed above the dropdown. Defaults to 'Event name'
 * @returns {React.ReactElement} A picker component wrapped in a labeled container
 */
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
