module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/test.setup.js"],
    transformIgnorePatterns: [
        "node_modules/(?!(jest-)?react-native|@react-native|react-native|expo(nent)?|@expo(nent)?/.*|expo-router|expo-modules-core|react-native-dropdown-picker)/",
    ],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
};