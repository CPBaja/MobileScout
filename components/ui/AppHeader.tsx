import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AppHeader() {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function check() {
            try {
                const state = await Network.getNetworkStateAsync();
                // Treat "unknown" reachability as online to avoid false negatives.
                const isConnected = !!state?.isConnected;
                const isReachable = state?.isInternetReachable;
                if (mounted) setOnline(isConnected && (isReachable ?? true));
            } catch {
                // If the check fails, don't flip the UI to offline abruptly.
            }
        }

        // Initial check + light polling (works in Expo Go and web)
        check();
        const interval = setInterval(check, 4000);

        // Bonus: on web, listen to browser events for instant updates
        const onWebOnline = () => setOnline(true);
        const onWebOffline = () => setOnline(false);
        if (typeof window !== 'undefined') {
            window.addEventListener('online', onWebOnline);
            window.addEventListener('offline', onWebOffline);
        }

        return () => {
            mounted = false;
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', onWebOnline);
                window.removeEventListener('offline', onWebOffline);
            }
        };
    }, []);

    return (
        <View style={styles.header}>
            <Text style={styles.title}>CPBajaScout</Text>
            <View
                style={[
                    styles.badge,
                    { backgroundColor: online ? '#238636' : '#d4a017' },
                ]}
            >
                <Text style={styles.badgeText}>{online ? 'Online' : 'Offline'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: '#0b0b0c',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomColor: '#30363d',
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: { color: '#fff', fontSize: 20, fontWeight: '700' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
