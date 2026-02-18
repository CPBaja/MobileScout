import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

type OnlineContextValue = { isOnline: boolean };
const OnlineContext = createContext<OnlineContextValue>({ isOnline: true });

/**
 * Provides online connectivity status to its child components via context.
 * 
 * Monitors the device's network connection and internet reachability using NetInfo,
 * and exposes the connection status through the OnlineContext provider.
 * 
 * @param props - The provider props
 * @param props.children - Child components that will have access to the online context
 * @returns A context provider component that wraps children with online status information
 */
export function OnlineProvider({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const sub = NetInfo.addEventListener((s) => {
            setIsOnline(!!(s.isConnected && s.isInternetReachable));
        });
        return () => sub();
    }, []);

    return (
        <OnlineContext.Provider value={{ isOnline }}>
            {children}
        </OnlineContext.Provider>
    );
}

export function useOnline() {
    return useContext(OnlineContext).isOnline;
}
