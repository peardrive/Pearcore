#!/usr/bin/env node
import { runCLI } from "./commands/index.js";

runCLI(process.argv);

/* import Corestore from 'corestore'
import Hyperdrive from 'hyperdrive'
import {
  deletePath,
  movePath,
  copyPath,
  listFiles,
  treeifyList
} from './utils/hyperdrive.utils.js'

let store = new Corestore('./local-storage')
const drive = new Hyperdrive(store)
await drive.ready()

await deletePath(drive, '/movies/inception.mp4')
let tree = await listFiles(drive)
treeifyList(tree)
// Create sample files
await drive.put('/movies/inception.mp4', Buffer.from('fake-data'))
await drive.put('/movies/interstellar.mp4', Buffer.from('fake-data'))
tree = await listFiles(drive)
treeifyList(tree)


// Copy a file inside the same drive
await copyPath(drive, '/movies/inception.mp4', drive, '/shared/inception.mp4')
tree = await listFiles(drive)
treeifyList(tree)


// Move directory
await movePath(drive, '/movies', '/archived/movies')


tree = await listFiles(drive)
treeifyList(tree)

// Delete file
await deletePath(drive, '/shared/inception.mp4')

tree = await listFiles(drive)
treeifyList(tree)
 */