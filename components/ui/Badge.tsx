import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const styles = StyleSheet.create({
    pill: {
        backgroundColor: '#1f6feb',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    txt: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

/**
 * A badge component that displays text in a pill-shaped container.
 * @param props - The component props
 * @param props.text - The text content to display in the badge
 * @returns A memoized badge component
 */
export default memo(function Badge({ text }: { text: string }) {
    return (
        <View style={styles.pill}>
            <Text style={styles.txt}>{text}</Text>
        </View>
    );
});
