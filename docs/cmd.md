<h1>PearCore CLI Documentation</h1>

- [Overview](#overview)
- [Common Parameters](#common-parameters)
  - [`--json`](#--json)
  - [`--port`](#--port)
  - [`--host`](#--host)
- [Command Reference](#command-reference)
  - [`pearcore --help`](#pearcore---help)
- [Network Commands](#network-commands)
  - [`pearcore run`](#pearcore-run)
  - [`pearcore network bootstrap`](#pearcore-network-bootstrap)
- [Account Commands](#account-commands)
  - [`pearcore account list`](#pearcore-account-list)
  - [`pearcore account create`](#pearcore-account-create)
  - [`pearcore account login`](#pearcore-account-login)
  - [`pearcore account logout`](#pearcore-account-logout)
  - [`pearcore account state`](#pearcore-account-state)
- [Space Commands](#space-commands)
  - [`pearcore space create`](#pearcore-space-create)
  - [`pearcore space join <shareLink>`](#pearcore-space-join-sharelink)
  - [`pearcore space list`](#pearcore-space-list)
  - [`pearcore space state`](#pearcore-space-state)
- [Usage Workflow](#usage-workflow)
  - [Typical Usage Pattern:](#typical-usage-pattern)
  - [Multiple Daemon Instance Workflow:](#multiple-daemon-instance-workflow)
- [File Structure](#file-structure)
- [Notes](#notes)
- [Troubleshooting](#troubleshooting)


## Overview

This document provides comprehensive documentation for all PearDrive CLI commands and their parameters.

<br>

## Common Parameters

### `--json`
- **Description**: When specified, the command returns raw JSON response from the core RPC interface instead of prettified human-readable output. By default, most commands interpret and format the JSON response for better readability.

### `--port`
- **Description**: Specifies the WebSocket port for connecting to the PearDrive daemon service. The default port is `8787`. Use this parameter when running multiple daemon instances on different ports.
- **Default**: `8787`
- **Usage Example**: When starting a second daemon on port 3030, all subsequent CLI commands targeting that daemon should include `--port 3030`.

### `--host`
- **Description**: Specifies the WebSocket host (IP address) for connecting to the PearDrive daemon service. The default port is `0.0.0.0` (also known as localhost). Use this parameter when running from another device in the network.
- **Default**: `0.0.0.0` (localhost)
- **Usage Example**: When connecting to another device in the network with IP of `192.168.0.7`, all subsequent CLI commands targeting that daemon should include `--host 192.168.0.7`.

<br>

## Command Reference

### `pearcore --help`
**Description**: Displays a complete list of all available commands and their basic descriptions.

```bash
pearcore --help
```

<br>

## Network Commands

### `pearcore run`
**Description**: Starts the PearDrive core daemon service that runs in the background and handles all network operations. This daemon creates a WebSocket server that listens for RPC commands and manages peer-to-peer connections, file synchronization, and network discovery.

**Parameters:**
- `--port` (number, default: `8787`) - WebSocket server port for RPC communication
- `--bootstrap` (string) - Custom bootstrap server address (e.g., `"0.0.0.0:49737"`)

**Examples:**
```bash
# Start daemon on default port
pearcore run

# Start daemon on custom port with custom bootstrap
pearcore run --port 3030 --bootstrap "0.0.0.0:49737"
```

---

### `pearcore network bootstrap`
**Description**: Runs a local HyperDHT bootstrap server node for peer discovery in the PearDrive network. Bootstrap servers help nodes find each other in the decentralized network and are essential for initial peer discovery when joining the network.

**Parameters:**
- `--port` (number, default: `49737`) - Port to bind the DHT bootstrap server
- `--host` (string, default: `0.0.0.0`) - Host/IP address to bind the bootstrap server

**Examples:**
```bash
# Start bootstrap server with default settings
pearcore network bootstrap

# start bootstrap on default port
pearcore network bootstrap

# Start bootstrap server on specific port
pearcore network bootstrap --port 5000
```

---

## Account Commands

### `pearcore account list`
**Description**: Lists all PearDrive accounts stored on the local device. Accounts are stored in platform-specific directories:

- **Windows**: `C:\Users\<user>\prototype-drive`
- **macOS/Linux**: `/home/<user>/prototype-drive`

This command scans the local storage directory and displays all registered accounts along with their basic information.

**Parameters:**
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# List accounts with default settings
pearcore account list

# List accounts with JSON output
pearcore account list --json
```

---

### `pearcore account create`
**Description**: Creates a new user account on the running daemon instance. This command generates cryptographic key pairs, sets up local storage structures, and registers the account with the daemon for subsequent operations.

**Parameters:**
- `--username` (string, required) - Username for the new account
- `--password` (string, required) - Password for the new account
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Create a new account
pearcore account create --username "alice" --password "securepassword123"

# Create account on custom daemon instance
pearcore account create --username "bob" --password "mypassword" --port 3030
```

---

### `pearcore account login`
**Description**: Authenticates with an existing account on the daemon service. This command verifies credentials, loads the account's cryptographic keys, and establishes an authenticated session with the daemon for protected operations.

**Parameters:**
- `--username` (string, required) - Account username
- `--password` (string, required) - Account password
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Login to account
pearcore account login --username "alice" --password "securepassword123"

# Login with JSON response
pearcore account login --username "alice" --password "securepassword123" --json
```

---

### `pearcore account logout`
**Description**: Logs out the currently authenticated account from the daemon service. This command clears the authentication state, removes session tokens, and ensures that subsequent operations require re-authentication.

**Parameters:**
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Logout from current account
pearcore account logout

# Logout from custom daemon instance
pearcore account logout --port 3030
```

---

### `pearcore account state`
**Description**: Retrieves the current authentication state and public information about the logged-in account (if any). This command shows whether you're currently authenticated and displays public account details without revealing sensitive information.

**Parameters:**
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Check current account state
pearcore account state

# Get state information as JSON
pearcore account state --json
```

---

## Space Commands

### `pearcore space create`
**Description**: Creates a new collaborative space on the running daemon instance. Spaces are isolated environments where users can share and synchronize content with specific access controls. Each space has its own cryptographic identity and can be shared via a unique share link.

**Parameters:**
- `--spaceName` (string, required) - Name of the new space
- `--permissionBroadcast` (boolean, default: `true`) - Allow broadcasting messages within the space
- `--permissionRead` (boolean, default: `true`) - Allow reading content from the space
- `--broadcastWhitelist` (array, default: `[]`) - Array of public keys allowed to broadcast in the space
- `--readWhitelist` (array, default: `[]`) - Array of public keys allowed to read from the space
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Create a public space with default permissions
pearcore space create --spaceName "Team Projects"

# Create a restricted space with whitelists
pearcore space create --spaceName "Private Docs" \
  --broadcastWhitelist "pk1,pk2" \
  --readWhitelist "pk1,pk2,pk3"

# Create space and get JSON response
pearcore space create --spaceName "Archive" --json
```

---

### `pearcore space join <shareLink>`
**Description**: Joins an existing collaborative space using a share link. The daemon will attempt to connect to the space's network and establish peer connections with other participants. The space can be joined in foreground (immediate) or background mode depending on daemon configuration.

**Parameters:**
- `shareLink` (string, required) - Encoded share link for the space
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Join a space using its share link
pearcore space join "pearcore://abc123xyz"

# Join with JSON response
pearcore space join "pearcore://def456uvw" --json
```

---

### `pearcore space list`
**Description**: Lists all spaces currently known to the daemon instance. This includes spaces created locally and spaces joined from other participants. The command displays detailed information about each space including permissions, whitelists, and share links.

**Parameters:**
- `--publicKey` (string, optional) - Filter spaces by owner's public key
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# List all spaces with formatted tree view
pearcore space list

# List spaces owned by a specific public key
pearcore space list --publicKey "abc123xyz"

# Get raw space data as JSON
pearcore space list --json
```

---

### `pearcore space state`
**Description**: Provides a comprehensive overview of the daemon's current network state, including connected peers, active topics (spaces), and account status. This command is useful for debugging network connectivity and understanding the current topology of joined spaces. When used with `--live`, it continuously polls and updates the state display.

**Parameters:**
- `--live` (boolean, default: `false`) - Continuously fetch and display state every second
- `--host` (string, default: `127.0.0.1`) - Daemon host address
- `--port` (number, default: `8787`) - Daemon WebSocket port
- `--json` (boolean, default: `false`) - Return raw JSON output

**Examples:**
```bash
# Get a snapshot of current network state
pearcore space state

# Monitor state in real-time (updates every second)
pearcore space state --live

# Get state data as JSON for programmatic use
pearcore space state --json
```

**Output Includes:**
- Current account status (logged in/out with public key)
- Spaces in join queue (pending connections)
- All active topics (spaces) with names, nonces, and owner keys
- Peers organized by topic/space
- Topics organized by connected peer
- Shortened hashes for better readability of cryptographic identifiers


<br>

## Usage Workflow

### Typical Usage Pattern:
1. Start the network client daemon: `pearcore network client`
2. Create or login to an account: `pearcore account create/login`
3. Share files out: `pearcore sync out <path> --public`
4. Download files: `pearcore sync in <shareLink>`
5. Monitor sync status: `pearcore sync state`

### Multiple Daemon Instance Workflow:
```bash
# First daemon instance
pearcore network client --port 8787
pearcore account create --username user1 --password pass1

# Second daemon instance (different terminal)
pearcore network client --port 3030
pearcore account create --username user2 --password pass2 --port 3030
```

<br>

## File Structure
```
prototype-drive/
├── accounts/
│   ├── alice/
│   │   ├── .account/
│   │   │   └── syncbook.sqlite
│   │   └── drive/
│   └── bob/
│       ├── .account/
│       │   └── syncbook.sqlite
│       └── drive/
```
<br>

## Notes
- Most commands require a running daemon instance (`pearcore network client`)
- Account operations are persisted in the platform-specific storage directory
- Sync operations run in the background once initiated
- Use `--json` flag for programmatic integration and debugging
- The SQLite syncbook database tracks all synchronization metadata and state
- Background availability checking ensures files are downloaded when peers come online
- Public keys in whitelists should be in their full encoded format

<br>

## Troubleshooting
- If commands fail, ensure the daemon is running with `pearcore network client`
- Use `--json` flag to get detailed error information from the RPC interface
- Check that ports are not conflicting when running multiple daemons
- Verify file paths exist when using `sync out` command
- Ensure proper network connectivity for bootstrap server connections
