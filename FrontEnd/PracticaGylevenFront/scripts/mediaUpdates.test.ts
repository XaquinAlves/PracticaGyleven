import assert from "node:assert/strict";
import {
    publishMediaTreeUpdate,
    subscribeMediaTreeUpdates,
} from "../app/media/mediaUpdates.ts";

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

function setupMock() {
    DummyChannel.instances = [];
    global.BroadcastChannel = DummyChannel as unknown as typeof BroadcastChannel;
}

function teardownMock() {
    delete global.BroadcastChannel;
}

function runTest() {
    setupMock();
    const handler = () => {
        handler.calls = (handler.calls ?? 0) + 1;
    };
    handler.calls = 0;

    const unsubscribe = subscribeMediaTreeUpdates(handler);
    publishMediaTreeUpdate();
    assert.equal(handler.calls, 1, "handler should be called once after publish");

    unsubscribe();
    publishMediaTreeUpdate();
    assert.equal(
        handler.calls,
        1,
        "handler should not be called after unsubscribe",
    );
    teardownMock();
}

try {
    runTest();
    console.log("Media updates test passed");
} catch (error) {
    console.error("Media updates test failed", error);
    process.exit(1);
}
