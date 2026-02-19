import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

const palette = {
    bg: '#0b0b0c',
    text: '#ffffff',
    dim: '#c9d1d9',
    border: '#30363d',
    success: '#1ea44f',
    danger: '#7c2d12',
};

/**
 * AppHeader component that displays the application header with online/offline status.
 * 
 * This component monitors network connectivity using react-native's NetInfo library
 * and displays a badge indicating whether the device is currently online or offline.
 * On web platforms, it also listens to browser online/offline events as a fallback.
 * 
 * The header includes:
 * - Application title "CPBajaScout"
 * - A status badge showing connectivity state with color coding (green for online, red for offline)
 * 
 * @component
 * @returns {JSX.Element} A SafeAreaView containing the header with title and status badge
 * 
 * @example
 * ```tsx
 * <AppHeader />
 * ```
 */
export default function AppHeader() {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        const sub = NetInfo.addEventListener((s) => {
            setOnline(!!(s.isConnected && s.isInternetReachable));
        });
        return () => sub();
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const onUp = () => setOnline(true);
        const onDown = () => setOnline(false);
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('online', onUp);
            window.addEventListener('offline', onDown);
            return () => {
                window.removeEventListener?.('online', onUp);
                window.removeEventListener?.('offline', onDown);
            };
        }
    }, []);

    return (
        <SafeAreaView edges={['top']} style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.title}>CPBajaScout</Text>
                <View style={[styles.badge, { backgroundColor: online ? palette.success : palette.danger }]}>
                    <Text style={styles.badgeText}>{online ? 'Online' : 'Offline'}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { backgroundColor: palette.bg },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
        borderBottomColor: palette.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { color: palette.text, fontSize: 22, fontWeight: '700', paddingTop: 8 },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
