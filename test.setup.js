import "@testing-library/jest-native/extend-expect";

jest.mock("react-native/Libraries/Animated/Animated", () =>
    require("react-native/Libraries/Animated/AnimatedMock")
);