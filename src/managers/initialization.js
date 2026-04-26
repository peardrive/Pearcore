import { SocketManager } from "./sockets.manager.js";
import { SessionManager } from "./session.manager.js";
import { MessageManager } from "./message.manager.js";
import { StorageManager } from "./storage.manager.js";
import { ProtocolMapFactory } from "../protocol/map.js";
import { ThrottleManager } from "./throttle.manager.js";
import { ConnectionManager } from "./connection.manager.js";

export function initializeManagers() {
    const sessionManager = new SessionManager();
    const socketManager = new SocketManager();
    const storageManager = new StorageManager({ sessionManager });
    const throttleManager = new ThrottleManager({ sessionManager, storageManager })
    const messageManager = new MessageManager({
        socketManager: socketManager,
        storageManager: storageManager,
        sessionManager: sessionManager,
        throttleManager: throttleManager
    })

    const protocols = ProtocolMapFactory({
        socket: socketManager,
        storage: storageManager,
        session: sessionManager,
        message: messageManager
    })

    messageManager.setProtocolMap(protocols);

    const connectionManager = new ConnectionManager({
        sessionManager: sessionManager,
        socketManager: socketManager,
        storageManager: storageManager,
        messageManager: messageManager
    })

    return {
        session: sessionManager,
        sockets: socketManager,
        storage: storageManager,
        throttle: throttleManager,
        message: messageManager,
        connection: connectionManager
    }
}