import { hex } from '../utils/crypto.utils.js';

export const FrameTypes = {
    JSON: 0x01,
    STREAM: 0x02
};


/**
 * MuxManager helps to simultaneously handle streaming and message data from socket connections.
 * This class calls 'handler' callback for different data types based on the received map.
 * 
 * @example
 * // Create a MuxManager instance
 * const muxManager = new MuxManager();
 *
 * muxManager.setHandlers([
 *   {
 *     type: FrameTypes.JSON,
 *     handler: (socket, data, info) => console.log('Received json data !', data);
 *   },
 *   {
 *     type: FrameTypes.STREAM,
 *     handler: (socket, data, info) => console.log('Received stream bytes !', data);
 *   }
 * ]);
 * 
 * swarmInstance.on('connection', (socket, info) => {
 *   const publicKey = hex(info.publicKey);
 *   const topics = info.topics.map(t => hex(t));
 *
 *   // Route all incoming data through the muxManager
 *   socket.on('data', async buffer => {
 *     await muxManager.route(socket, buffer, info);
 *   });
 *
 *   socket.on('close', () => {
 *     muxManager.cleanup(info); // free accumulated buffers for this peer
 *   });
 *
 *   socket.on('error', (err) => {
 *     muxManager.cleanup(info);
 *   });
 * });
 * 
 * // NOTE: multiplexer expects custom header for each message to process chunk accumulation.
 * // because of this, data should be sent using muxManager's helper function.
 * 
 * // Sending a JSON message
 * async function sendJsonMessage(socket, message) {
 *   const messageStr = JSON.stringify(message);
 *   await muxManager.send(socket, messageStr, FrameTypes.JSON);
 * }
 *
 * // Sending a binary stream
 * async function sendStream(socket, buffer) {
 *   await muxManager.send(socket, buffer, FrameTypes.STREAM);
 */
export class MuxManager {
    constructor() {
        this.routingMap = new Map();
        this._buffers = new Map();
    }

    /**
     * Maps all frame types to indivisual data type handler.
     * @param {Array<Object>} handlers - List of all handlers with their type.
     */
    setHandlers(handlers) {
        for (const record of handlers) {
            this.routingMap.set(record.type, record.handler);
        }
    }

    /**
     * Routes and process all incoming data streams from socket connections.
     * This method will only call the handler once the incoming data in complete (all chunks has been received).
     * @param {Object} socket - The socket object.
     * @param {Buffer|string} data - Incoming buffer.
     * @param {Object} info - Hyperswarm's info object.
     */
    async route(socket, data, info) {
        const publicKey = hex(info.publicKey);
        let buffer = this._buffers.get(publicKey);

        if (!buffer) {
            buffer = Buffer.alloc(0);
            this._buffers.set(publicKey, buffer);
        }

        buffer = Buffer.concat([buffer, data]);
        this._buffers.set(publicKey, buffer);

        let processed = true;
        while (processed && buffer.length >= 5) {
            const type = buffer[0];
            const payloadLength = buffer.readUInt32BE(1);
            const totalFrames = 5 + payloadLength;

            if (buffer.length < totalFrames) {
                processed = false;
                break;
            }

            const payload = buffer.subarray(5, totalFrames);
            buffer = buffer.subarray(totalFrames);
            this._buffers.set(publicKey, buffer);

            const handler = this.routingMap.get(type);
            if (handler) {
                await handler(socket, payload, info);
            }

            else {
                console.error(`No handler registered for frame type ${type} from publicKey: ${publicKey}`);
            }
        }
    }

    /**
     * Clean and reset buffer stack for individual socket connection.
     * @param {Object} info - Hyperswarm's info object.
     */
    cleanup(info) {
        const publicKey = hex(info.publicKey);
        this._buffers.delete(publicKey);
    }

    /**
     * Create frame from type and payload
     * @param {number} type - Data type.
     * @param {Buffer|string} data - Input data.
     * @returns {Buffer}
     */
    createFrame(type, data) {
        const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const header = Buffer.allocUnsafe(5);
        // allocate frame type (1 byte) + content length (4 bytes)
        header[0] = type;
        header.writeUInt32BE(payload.length, 1);

        return Buffer.concat([header, payload]);
    }

    /**
     * Send framed data payload with the corrent type to the socket.
     * @param {Object} socket - The socket object.
     * @param {Buffer|string} data - The data to send for the receiver.
     * @param {number} frameType - The data type of the data.
     * @returns {Promise<void>} - Resolves when the data has successfully sent to the receiver.
     */
    async send(socket, data, frameType) {
        const frame = this.createFrame(frameType, data);
        return socket.write(frame);
    }
}