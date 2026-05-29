import { SocketManager } from "./sockets.manager.js";
import { SessionManager } from "./session.manager.js";
import { MessageManager } from "./message.manager.js";
import { StorageManager } from "./storage.manager.js";
import { ProtocolMapFactory } from "../protocol/map.js";
import { ThrottleManager } from "./throttle.manager.js";
import { ConnectionManager } from "./connection.manager.js";
import { MuxManager, FrameTypes } from "./multiplexer.manager.js";
import { SpaceFileListManager, SpaceFileManager } from "./file.manager.js";

export function initializeManagers() {
    const sessionManager = new SessionManager();
    const socketManager = new SocketManager();
    const muxManager = new MuxManager();

    const storageManager = new StorageManager({
        sessionManager
    });

    const spaceFileListManager = new SpaceFileListManager({
        sessionManager,
        storageManager,
    });

    const throttleManager = new ThrottleManager({
        sessionManager,
        storageManager
    });

    const messageManager = new MessageManager({
        socketManager: socketManager,
        storageManager: storageManager,
        sessionManager: sessionManager,
        throttleManager: throttleManager,
        muxManager: muxManager,
        spaceFileListManager: spaceFileListManager,
    });

    const spaceFileManager = new SpaceFileManager({
        storageManager: storageManager,
        sessionManager: sessionManager,
        socketManager: socketManager,
        messageManager: messageManager,
        spaceFileListManager: spaceFileListManager
    });

    const connectionManager = new ConnectionManager({
        sessionManager: sessionManager,
        socketManager: socketManager,
        storageManager: storageManager,
        messageManager: messageManager,
        muxManager: muxManager
    });

    muxManager.setHandlers([
        {
            type: FrameTypes.JSON,
            handler: (socket, data, info) => messageManager.handleIncomingMessage(socket, data, info)
        },
        {
            type: FrameTypes.STREAM,
            handler: (socket, data, info) => spaceFileManager.handleIncomingStream(socket, data, info)
        }
    ]);

    const protocols = ProtocolMapFactory({
        socket: socketManager,
        storage: storageManager,
        session: sessionManager,
        message: messageManager,
        spaceFileList: spaceFileListManager,
        spaceFiles: spaceFileManager,
        mux: muxManager,
    });

    messageManager.setProtocolMap(protocols);

    return {
        session: sessionManager,
        sockets: socketManager,
        storage: storageManager,
        throttle: throttleManager,
        mux: muxManager,
        message: messageManager,
        spaceFileList: spaceFileListManager,
        spaceFiles: spaceFileManager,
        connection: connectionManager,
    };
}