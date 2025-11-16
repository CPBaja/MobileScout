// components/ui/AppHeader.tsx
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

export default function AppHeader() {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        // ✅ Native-safe connectivity
        const sub = NetInfo.addEventListener((s) => {
            setOnline(!!(s.isConnected && s.isInternetReachable));
        });
        return () => sub();
    }, []);

    // (Optional) if you *also* want to reflect browser events in web builds, keep this guarded block.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const onUp = () => setOnline(true);
        const onDown = () => setOnline(false);
        // Guard for SSR/edge
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
