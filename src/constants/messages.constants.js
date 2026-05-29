// Maximum allowed size for handling incomming message from the network
export const MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FREQUENCY_THROTTLE = 100; // throttle after 100th message in on second
export const MAX_QUARANTINE_TIME = 1000; // 1 second
// allow to send back rejection messages if the connected node reached the throttling point
export const ALLOW_THROTTLE_REJECTIONS = false; 

// Predefined rejection messages
export const MESSAGE_RATE_LIMIT_EXCEEDED = 'node is throttled due to excessive message reception';
export const MESSAGE_IS_DUPLICATED = 'The message has already been processed and is considered duplicated';
export const INTERNAL_ERROR_MESSAGE = 'internal error';
export const EXCEED_SIZE_MESSAGE = 'message exceeds the size limit';
export const BAD_JSON_MESSAGE = 'failed to parse json';
export const BAD_SIGNATURE_MESSAGE = 'message has invalid signature';
export const BAD_SPACE_SIGNATURE = 'message has invalid space signature';
export const BAD_PROFILE_SIGNATURE = 'message has invalid profile signature';
export const NO_TYPE_MESSAGE = 'message has no type property (essential for event routing)';
export const NO_HANDLER_MESSAGE = 'found no handler for the message type';
export const NO_RELAY_MESSAGE = 'relay is not allowed for the message type';
export const NOT_SUBSCRIBED_MESSAGE = 'peer is not subscribed for the space';
export const SPACE_NOT_FOUND_MESSAGE = 'space is not found';
export const READ_PERMISSION_NOT_ALLOWED_MESSAGE = 'peer is not allowed to read this space';
export const BROADCAST_PERMISSION_NOT_ALLOWED_MESSAGE = 'peer is not allowed to broadcast in this space';