import { describe, expect, it, vi } from "vitest";
import {
    publishMediaTreeUpdate,
    subscribeMediaTreeUpdates,
} from "../app/media/mediaUpdates";

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

describe("mediaUpdates channel", () => {
    const globalWithBroadcast = globalThis as typeof globalThis & {
        BroadcastChannel?: typeof BroadcastChannel;
    };

    beforeEach(() => {
        DummyChannel.instances = [];
        globalWithBroadcast.BroadcastChannel = DummyChannel as unknown as typeof BroadcastChannel;
    });

    afterEach(() => {
        delete globalWithBroadcast.BroadcastChannel;
    });

    it("notifies subscribed handler and stops after unsubscribe", () => {
        const handler = vi.fn();
        const unsubscribe = subscribeMediaTreeUpdates(handler);
        publishMediaTreeUpdate();
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        publishMediaTreeUpdate();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
