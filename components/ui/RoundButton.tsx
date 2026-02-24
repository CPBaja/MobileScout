import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type RoundButtonVariant = 'primary' | 'danger' | 'disabled';

type Props = {
    label: string;
    variant: RoundButtonVariant;
    onPress?: () => void;
    style?: ViewStyle;
};

const palette = {
    text: '#ffffff',
    inputBg: '#161b22',
    border: '#30363d',
    success: '#238636',
    danger: '#b91c1c',
};

export default function RoundButton({ label, variant, onPress, style }: Props) {
    const isDisabled = variant === 'disabled' || !onPress;

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            style={({ pressed }) => [
                styles.roundBtn,
                variant === 'primary' && styles.roundBtnPrimary,
                variant === 'danger' && styles.roundBtnDanger,
                isDisabled && styles.roundBtnDisabled,
                pressed && !isDisabled && styles.roundBtnPressed,
                style,
            ]}
        >
            <Text style={styles.roundBtnText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    roundBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
    },
    roundBtnPrimary: {
        borderColor: palette.success,
        backgroundColor: 'rgba(35, 134, 54, 0.25)',
    },
    roundBtnDanger: {
        borderColor: palette.danger,
        backgroundColor: 'rgba(185, 28, 28, 0.22)',
    },
    roundBtnDisabled: { opacity: 0.45 },
    roundBtnPressed: { transform: [{ scale: 0.98 }] },
    roundBtnText: {
        color: palette.text,
        fontWeight: '900',
        fontSize: 24,
        marginTop: -2,
    },
});