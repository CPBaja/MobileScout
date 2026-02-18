import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    samples: 'mobilescout:samples',
    completions: 'mobilescout:completions',
};

/**
 * Saves an array to persistent storage using AsyncStorage.
 * @template T - The type of elements in the array.
 * @param key - The storage key under which to save the array.
 * @param arr - The array to be saved.
 * @returns A promise that resolves when the array has been saved, or when an error is caught and logged.
 */
export async function saveArray<T>(key: string, arr: T[]) {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
        console.warn('saveArray failed', key, e);
    }
}

/**
 * Loads an array of items from AsyncStorage by key.
 * @template T The type of items in the array.
 * @param key The storage key to retrieve.
 * @returns A promise that resolves to the parsed array, or an empty array if the key doesn't exist or parsing fails.
 * @throws Does not throw, but logs a warning to console if loading or parsing fails.
 */
export async function loadArray<T>(key: string): Promise<T[]> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('loadArray failed', key, e);
        return [];
    }
}
