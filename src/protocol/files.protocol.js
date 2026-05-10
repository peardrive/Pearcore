import { createBaseMessage } from "../utils/protocol.utils.js";
import { BaseProtocolHandler } from "./base.js";

const SpaceFileSync = 'SpaceFileSync';

const fileIndexes = [];
const fileContextes = [];

function createCore() {
    const core = new HyperCore
}

async function createSpaceFileSyncMessage({ topic, payload, publicKey, secretKey }={}) {
    return await createBaseMessage({
        type: SpaceFileSync,
        topic: topic,
        payload: payload,
        publicKey: publicKey,
        secretKey: secretKey
    })
}

/**
 * Level 1: share file feeds with each other.
 */
class SpaceFileSyncProtocol extends BaseProtocolHandler {
    constructor(managers) {
        super(managers);
    }

    async handle(message, socket, info) {

    }
}