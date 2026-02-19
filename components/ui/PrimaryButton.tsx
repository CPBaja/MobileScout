import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const palette = { bg: '#161b22', border: '#30363d', text: '#fff' };

/**
 * A reusable primary button component for user interactions.
 * @param {Object} props - The component props
 * @param {string} props.title - The text label displayed on the button
 * @param {() => void} [props.onPress] - Optional callback function triggered when the button is pressed
 * @param {boolean} [props.danger] - Optional flag to apply danger styling (typically red/warning colors)
 * @param {ViewStyle} [props.style] - Optional custom style overrides for the button container
 * @returns {JSX.Element} A pressable button element with text content
 */
export default function PrimaryButton({
    title,
    onPress,
    danger,
    style,
}: { title: string; onPress?: () => void; danger?: boolean; style?: ViewStyle }) {
    return (
        <Pressable onPress={onPress} style={[styles.btn, danger && styles.danger, style]}>
            <Text style={styles.txt}>{title}</Text>
        </Pressable>
    );
}
const styles = StyleSheet.create({
    btn: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
    },
    danger: { backgroundColor: '#8b0000', borderColor: '#8b0000' },
    txt: { color: palette.text, fontWeight: '600' },
});
