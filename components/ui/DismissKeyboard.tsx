import React from 'react';
import { Platform, Keyboard, TouchableWithoutFeedback, View } from 'react-native';

/**
 * A component that dismisses the keyboard on touch for mobile platforms.
 * On web, it renders children without keyboard dismissal functionality.
 * 
 * @param props - The component props
 * @param props.children - The child elements to render within the dismissible area
 * @returns A View component wrapping the children, with keyboard dismissal on press for mobile
 */
export default function DismissKeyboard({ children }: { children: React.ReactNode }) {
    if (Platform.OS === 'web') {
        return <View style={{ flex: 1 }}>{children}</View>;
    }
    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>{children}</View>
        </TouchableWithoutFeedback>
    );
}
