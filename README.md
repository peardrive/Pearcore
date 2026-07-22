# PearCore: Decentralized Communication Platform

**PearCore** is a modular, peer‑to‑peer framework for building decentralized applications. It provides account management, encrypted spaces (topics), profile broadcasting, message routing, and a powerful multi‑source file download system. Built on top of `hyperdht` and `hyperswarm`, it enables secure, permissioned communication without central servers.

<br>

## 📦 Installation

```bash
npm install pearcore
```

```javascript
import { createCore } from 'pearcore';

const core = await createCore({
  rootPath: './data',          // where accounts and databases are stored
  bootstrap: '127.0.0.1:3000', // optional bootstrap node
});

// create new account
await core.accounts.create('username', 'password');
// setup to account
await core.accounts.authenticate('username', 'password');
```
<br>

## Core Services

The `createCore()` function returns an object containing all services:

| Service      | Accessor          | Description                                    |
|--------------|-------------------|------------------------------------------------|
| **Account**  | `core.accounts`   | Account creation, authentication, logout       |
| **Space**    | `core.space`      | Create/join/leave spaces (channels)            |
| **Profile**  | `core.profile`    | Manage user profile (username, tag, avatar)    |
| **Message**  | `core.messages`   | Send and list messages in spaces               |
| **File**     | `core.files`      | Upload, download, and manage files in spaces   |
| **Managers** | `core.managers`   | Low‑level managers (network, sockets, storage) |

All methods follow the pattern `core.[service].[methodName](...)`.

<br>

## 📚 Usage Examples

### 1. Account Management

```javascript
// List all existing accounts
const accounts = await core.accounts.list();

// Create a new account
await core.accounts.create('alice', 'securePassword123');

// Authenticate (load the account and start the P2P node)
const session = await core.accounts.authenticate('alice', 'securePassword123');
console.log(session.publicKey); // hex string

// Check current state
const state = core.accounts.getCurrentState();
if (state.state === 'authenticated') {
  console.log(`Logged in as ${state.username}`);
}

// Log out
await core.accounts.logout();
```

---

### 2. Space (Channel) Management

```javascript
// Create a public space
const space = await core.space.create({
  spaceName: 'general',
  permissionBroadcast: false, // anyone can broadcast
  permissionRead: false,      // anyone can read
});

console.log(space.sharelink); // e.g., pearcore://ABC..

// Join an existing space via share link
await core.space.join(space.sharelink);

// List all joined spaces
const spaces = await core.space.list();
for (const s of spaces) {
  console.log(s.spaceName, s.topicHash, s.discoverable);
}

// Leave a space
await core.space.leave(space.sharelink);

// Get current network and space state
const state = await core.space.getCurrentState();
console.log(state.spaces.synced); // spaces joined and synced
console.log(state.network);       // connected peers and their topics
```

---

### 3. Profile Management

```javascript
// Update your profile
await core.profile.update({
  username: 'alice',
  tag: '#dev',
  profileURL: 'https://example.com/avatar.png',
});

// Get your own profile
const myProfile = await core.profile.getCurrentProfile();

// List other users' profiles (filter by publicKey, username, etc.)
const profiles = await core.profile.list({
  username: 'bob',
  limit: 10,
  orderBy: 'timestamp',
  orderDirection: 'desc',
});

// Broadcast your profile to all connected peers
await core.profile.broadcast();
```

---

### 4. Messaging

```javascript
// Send a message to a space (must be joined)
const space = { spaceName: 'general', publicKey: '...', nonce: '...' };
await core.messages.send(space, {
  text: 'Hello, world!',
  // any custom payload
});

// Listen for new messages (via emitter)
core.emitter.on(EVENTS.SpaceMessage, ({ info, message }) => {
  console.log(`New message from ${info.publicKey}:`, message.payload);
});

// List messages with filters
const messages = await core.messages.list({
  topic: space.topicHash,
  limit: 50,
  orderBy: 'messageTimestamp',
  orderDirection: 'desc',
});

// Delete old messages
await core.messages.flush({ broadcastTimestamp: { end: Date.now() - 7*24*60*60*1000 } });
```

---

### 5. File Sharing (Upload & Download)

The file system uses **Merkle trees** to verify integrity and supports **multi‑source parallel downloads** with automatic recovery.

#### Upload a file (publish to a space)

```javascript
const registryId = await core.files.localFileRegistry.add({
  spaceId: space.id,                     // database ID of the space
  spacePath: '/docs',                    // virtual directory inside the space
  spaceFilename: 'report.pdf',           // virtual filename
  fileSourcePath: '/home/alice/report.pdf', // absolute local path
});
```

The file is automatically indexed, hashed, and advertised to all peers in the space.

#### Download a file

```javascript
await core.files.download(
  space,                // space object (with .id)
  '/docs/report.pdf',   // space file path
  rootHash,             // Merkle root hash (obtained from space file list)
  '/downloads/report.pdf' // final destination
);
```

The download task will:
- Discover providers for that file.
- Request the Merkle tree from the first responsive provider.
- Split the file into chunks and request slices from multiple providers.
- Adapt to provider speed and reassign failed slices.
- Resume from where it left off if interrupted.

#### Monitor download progress

```javascript
core.emitter.on('DownloadProgress', ({ task, progress }) => {
  console.log(`Downloaded ${progress.downloaded}/${progress.total} leaves`);
});

core.emitter.on('DownloadComplete', ({ task, finalPath }) => {
  console.log(`File saved to ${finalPath}`);
});
```

---

## Advanced Configuration

### 1. Setting a Custom Bootstrap Node

Pass the `bootstrap` option to `createCore`:

```javascript
const core = await createCore({
  bootstrap: '192.168.1.10:3000', // or a domain
});
```

### 2. Changing the Share Link Prefix

```javascript
core.space.setPrefix('myapp');
// Now share links look like: myapp:spaceName:...
```

### 3. Database and Storage

All account data is stored in the `rootPath` directory (default `./data`). Each account gets its own SQLite database. You can access the raw database via `core.managers.session.getDatabase()`.

<br>

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/your-org/pearcore.git
cd pearcore

# Install dependencies
npm install

# Run tests (assuming you have a test suite)
npm test

# Start a local bootstrap node for development
npm run bootstrap
```