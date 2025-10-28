import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const palette = { bg: '#161b22', border: '#30363d', text: '#fff' };

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
