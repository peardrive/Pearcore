export class BaseProtocolHandler {
    constructor(managers) {
        this.storageManager = managers.storage;
        this.sessionManager = managers.session;
        this.socketManager = managers.socket;
        this.messageManager = managers.message;

        this.emitter = this.messageManager.emitter;
        this.emit = (event, callback) => this.emitter.emit(event, callback);
    }

    get credentials() {
        return this.sessionManager.getCredentials();
    }

    async handle(socket, message, info) {
        throw new Error("Handle method must be implemented by subclass");
    }
}