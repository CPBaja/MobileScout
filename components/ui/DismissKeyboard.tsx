import React from 'react';
import { Platform, Keyboard, TouchableWithoutFeedback, View } from 'react-native';

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
