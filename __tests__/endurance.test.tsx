import React from "react";
import { Keyboard, Text, Pressable } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import EnduranceTab, { fmtDuration, computeOffTrack } from "@/app/(tabs)/endurance";

jest.mock("@/components/ui/AppHeader", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return function MockHeader() {
        return React.createElement(Text, null, "Header");
    };
});

jest.mock("@/components/ui/Card", () => {
    return function MockCard({ children }: any) {
        return <>{children}</>;
    };
});

jest.mock("@/components/ui/PrimaryButton", () => {
    const React = require("react");
    const { Pressable, Text } = require("react-native");
    return function MockPrimaryButton({ title, onPress }: any) {
        return React.createElement(
            Pressable,
            { accessibilityRole: "button", onPress },
            React.createElement(Text, null, title)
        );
    };
});

jest.mock("@/components/ui/DismissKeyboard", () => {
    return function MockDismissKeyboard({ children }: any) {
        return <>{children}</>;
    };
});

// AsyncStorage mock
const mockGetItem = jest.fn(undefined);
const mockSetItem = jest.fn(undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: (...args: any[]) => mockGetItem(...args),
        setItem: (...args: any[]) => mockSetItem(...args),
    },
}));

describe("endurance.tsx - unit tests (pure helpers)", () => {
    test("fmtDuration formats seconds correctly", () => {
        expect(fmtDuration(0)).toBe("0m 00s");
        expect(fmtDuration(5)).toBe("0m 05s");
        expect(fmtDuration(125)).toBe("2m 05s");
        expect(fmtDuration(3661)).toBe("1h 01m 01s");
    });

    test("computeOffTrack marks car OFF TRACK after an 'in' without a matching 'out'", () => {
        const logs: any[] = [
            {
                carNumber: "42",
                direction: "in",
                station: "entry",
                timestamp: "2026-02-01T00:00:00.000Z",
                sessionId: "2026-02-01",
            },
        ];
        const nowMs = new Date("2026-02-01T00:01:00.000Z").getTime();
        const off = computeOffTrack(logs as any, "42", nowMs);
        expect(off.status).toBe("OFF TRACK");
        expect(off.currentOffSeconds).toBeCloseTo(60, 0);
        expect(off.totalOffSeconds).toBeGreaterThan(0);
    });

    test("computeOffTrack returns ON TRACK after matching out event", () => {
        const logs: any[] = [
            {
                carNumber: "42",
                direction: "in",
                station: "entry",
                timestamp: "2026-02-01T00:00:00.000Z",
                sessionId: "2026-02-01",
            },
            {
                carNumber: "42",
                direction: "out",
                station: "exit",
                timestamp: "2026-02-01T00:02:00.000Z",
                sessionId: "2026-02-01",
            },
        ];
        const nowMs = new Date("2026-02-01T00:03:00.000Z").getTime();
        const off = computeOffTrack(logs as any, "42", nowMs);
        expect(off.status).toBe("ON TRACK");
        expect(off.currentOffSeconds).toBe(0);
        expect(off.totalOffSeconds).toBeCloseTo(120, 0);
    });
});

describe("EnduranceTab - component tests (user-centric interactions)", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        jest.spyOn(Keyboard, "dismiss").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("adds pit in entry and shows OFF TRACK for lookup car", async () => {
        const { getByText, getAllByPlaceholderText, findByText } = render(<EnduranceTab />);
        await act(async () => { });

        const [carInput] = getAllByPlaceholderText("e.g., 42");
        fireEvent.changeText(carInput, "42");
        fireEvent.press(getByText("Pit In"));

        expect(await findByText(/Car 42: IN \(entry\)/)).toBeTruthy();
        expect(await findByText(/OFF TRACK/)).toBeTruthy();
    });

    test("pit out closes session and shows ON TRACK", async () => {
        const { getByText, getAllByPlaceholderText, findByText } = render(<EnduranceTab />);
        await act(async () => { });

        const [carInput] = getAllByPlaceholderText("e.g., 42");
        fireEvent.changeText(carInput, "42");
        fireEvent.press(getByText("Pit In"));

        await act(async () => {
            jest.setSystemTime(new Date("2026-02-01T00:01:00.000Z"));
            jest.advanceTimersByTime(1000);
        });

        fireEvent.changeText(carInput, "42");
        fireEvent.press(getByText("Pit Out"));

        expect(await findByText(/Car 42: OUT \(exit\)/)).toBeTruthy();
        expect(await findByText(/ON TRACK/)).toBeTruthy();
    });

    test("pressing a recent log sets lookup car", async () => {
        const { getByText, getAllByPlaceholderText, findByDisplayValue, findByText } = render(<EnduranceTab />);
        await act(async () => { });

        const [carInput] = getAllByPlaceholderText("e.g., 42");
        fireEvent.changeText(carInput, "42");
        fireEvent.press(getByText("Pit In"));

        const row = await findByText(/Car 42: IN \(entry\)/);
        fireEvent.press(row);

        expect(await findByDisplayValue("42")).toBeTruthy();
    });

});