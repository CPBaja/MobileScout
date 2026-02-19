import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Displays an overlay informing the user that the application is currently offline.
 * Changes made while offline are saved locally and will automatically sync once connectivity is restored.
 * 
 * @component
 * @returns {JSX.Element} A View component containing an offline notification card with title and message text.
 */
export default function OfflineOverlay() {
    return (
        <View style={styles.root}>
            <View style={styles.card}>
                <Text style={styles.title}>You’re offline</Text>
                <Text style={styles.msg}>
                    Changes are saved locally and will sync when you’re back online.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(11, 11, 12, 0.95)', // dark overlay
        zIndex: 9999, justifyContent: 'center', alignItems: 'center',
    },
    card: {
        backgroundColor: '#11161d', borderColor: '#30363d', borderWidth: 1,
        padding: 20, borderRadius: 12, width: '86%',
    },
    title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    msg: { color: '#c9d1d9', fontSize: 14, lineHeight: 20 },
});
