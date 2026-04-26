# Peardrive Documentation

This documentation explains the architecture and components of Peardrive, a peer-to-peer platform for messaging and file sharing within collaborative spaces.

## Quick Navigation

### 1. [Project Structure](./project-architecture/structure.md)
Start here if you want to understand:
- Overall architecture and dependency flow
- How different layers interact (utils → services → RPC → daemon)
- The purpose of each directory and module
- How the system achieves runtime portability through utility isolation

### 2. [Space Service Architecture](./project-architecture/space-service.md)
Read this if you need to understand:
- How P2P spaces are created, joined, and managed
- The four specialized managers and their responsibilities
- Message flow and connection handling
- How the service orchestrates network, storage, messaging, and sockets

### 3. [Command line interface](./cmd.md)
Read this if you need to understand:
- How run daemon service
- How to use command lines

---

*Documentation last updated: 2025/12/14*