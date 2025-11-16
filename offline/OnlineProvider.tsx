import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

type OnlineContextValue = { isOnline: boolean };
const OnlineContext = createContext<OnlineContextValue>({ isOnline: true });

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
