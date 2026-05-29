import * as EVENTS from '../constants/events.constants.js';
import { SpaceFileActionHandler, SpaceFileRequestHandler } from './files.protocol.js';
import { ProfileProtocolHandler } from './profile.protocol.js';
import { RejectionProtocolHandler } from './rejection.protocol.js';
import { SpaceHashListHandler, SpaceMessageHandler, SpaceSyncHandler } from './space.protocol.js';

export const ProtocolMapFactory = (managers) => [
    {
        type: EVENTS.Reject,
        handler: new RejectionProtocolHandler(managers)
    },
    {
        type: EVENTS.ProfileUpdate,
        handler: new ProfileProtocolHandler(managers)
    },
    {
        type: EVENTS.SpaceHashList,
        handler: new SpaceHashListHandler(managers)
    },
    {
        type: EVENTS.SpaceSync,
        handler: new SpaceSyncHandler(managers)
    },
    {
        type: EVENTS.SpaceMessage,
        handler: new SpaceMessageHandler(managers)
    },
    {
        type: EVENTS.SpaceFileAction,
        handler: new SpaceFileActionHandler(managers)
    },
    {
        type: EVENTS.SpaceFileRequest,
        handler: new SpaceFileRequestHandler(managers)
    }
];