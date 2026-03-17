import { describe, expect, it, vi } from "vitest";
import {
    publishMediaTreeUpdate,
    subscribeMediaTreeUpdates,
} from "./mediaUpdates";

class DummyChannel {
    static instances: DummyChannel[] = [];
    listener?: (event: MessageEvent) => void;

    constructor() {
        DummyChannel.instances.push(this);
    }

    addEventListener(_: string, handler: (event: MessageEvent) => void) {
        this.listener = handler;
    }

    removeEventListener(_: string, handler: (event: MessageEvent) => void) {
        if (this.listener === handler) {
            this.listener = undefined;
        }
    }

    postMessage(message: unknown) {
        for (const channel of DummyChannel.instances) {
            if (channel !== this && channel.listener) {
                channel.listener({ data: message } as MessageEvent);
            }
        }
    }

    close() {}
}

function setupBroadcastMock() {
    DummyChannel.instances = [];
    global.BroadcastChannel = DummyChannel as unknown as typeof BroadcastChannel;
}

function teardownBroadcastMock() {
    delete global.BroadcastChannel;
}

describe("mediaUpdates", () => {
    afterEach(() => {
        teardownBroadcastMock();
        vi.resetAllMocks();
    });

    it("notifies subscribers when a new update is published", async () => {
        setupBroadcastMock();
        const handler = vi.fn();
        const unsubscribe = subscribeMediaTreeUpdates(handler);

        publishMediaTreeUpdate();
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        publishMediaTreeUpdate();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
