/**
 * Topic payload when message does not belong to dedicated topic.
 */
export const noTopic = 'noTopic';

/**
 * Nonce payload when constructing recieved message failed.
 */
export const noNonce = 'noNonce';

/**
 * Emitted when a node sends valid message.
 */
export const General = 'General';

/**
 * Emitted when a node explicitly rejects a request from a remote peer.
 * This is typically used to signal failures, invalid state,
 * or unsupported operations.
 */
export const Reject = "Reject";

/**
 * Emitted when a node advertises the list of spaces that it is currently
 * interested in or participating in.
 * This event is commonly used during initial handshake to
 * determine shared spaces and routing relevance.
 */
export const SpaceHashList = "SpaceHashList";

/**
 * Emitted to transmit space metadata to another node.
 * 
 */
export const SpaceSync = "SpaceSync";

/**
 * Generic application-level message event.
 * Used to send arbitrary, custom payloads that do not fit into the
 * predefined protocol events.
 */
export const SpaceMessage = "SpaceMessage";

/**
 * Emitted when a profile is updated or when a peer is requesting to join
 * a space using its profile information.
 * Depending on the sender, this event may represent either a propagated
 * update or an ownership-originated request.
 */
export const ProfileUpdate = "ProfileUpdate";
