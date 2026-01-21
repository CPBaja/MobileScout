import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    samples: 'mobilescout:samples',
    completions: 'mobilescout:completions',
};

export async function saveArray<T>(key: string, arr: T[]) {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
        console.warn('saveArray failed', key, e);
    }
}

export async function loadArray<T>(key: string): Promise<T[]> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('loadArray failed', key, e);
        return [];
    }
}
