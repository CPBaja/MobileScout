import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

const palette = {
    card: '#0d1117',
    border: '#30363d',
};

/**
 * A flexible Card component that wraps content in a styled View container.
 * 
 * @param props - The component props
 * @param props.style - Optional custom style overrides for the card
 * @param props.children - The content to render inside the card
 * @param props.rest - Additional View props to pass through
 * @returns A View component with card styling applied
 */
export default function Card({ style, children, ...rest }: PropsWithChildren<ViewProps>) {
    return <View style={[styles.card, style]} {...rest}>{children}</View>;
}
const styles = StyleSheet.create({
    card: {
        backgroundColor: palette.card,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 16,
        overflow: 'visible'
    },
});