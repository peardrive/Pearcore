import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { createCore } from '../src/core.js';
import { generateFileRecord } from '../src/utils/files.utils.js';
import { createSpace } from '../src/utils/space.utils.js';
import {
    generateRandomFile,
    makeTempDir,
    cleanup,
    buildTestSpacePayload
} from '../tests/general.utils.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


function renderProgress(current, total, label = '') {
    const pct = Math.round((current / total) * 100);
    const barLen = 30;
    const filled = Math.round((current / total) * barLen);
    const bar = '█'.repeat(filled) + '-'.repeat(barLen - filled);
    process.stdout.write(
        `\r  ${label} [${bar}] ${pct}% (${current}/${total})`
    );
}

function buildSizeSequence() {
    const sizes = [];

    // 1, 5, 10
    sizes.push(1, 5, 10);

    // 20, 30, ..., 100 (step 10)
    for (let mb = 20; mb <= 100; mb += 10) {
        sizes.push(mb);
    }

    // 200, 300, ..., 1000 (step 100)
    for (let mb = 200; mb <= 1000; mb += 100) {
        sizes.push(mb);
    }

    // 1024 (1 GB)
    sizes.push(1024);

    // 2*1024, 3*1024, ..., 10*1024 (step 1024)
    for (let mb = 2 * 1024; mb <= 10 * 1024; mb += 1024) {
        sizes.push(mb);
    }

    return sizes;
}


async function runSingleIteration(rootDir, fileSizeMB, iteration, db, spaceId) {
    // Unique temp file for this run
    const tempFile = path.join(rootDir, `bench_${fileSizeMB}mb_${iteration}.dat`);

    const emitter = new EventEmitter();
    let totalSteps = 0;

    emitter.on(tempFile, ({ currentStep, totalSteps: incomingTotal }) => {
        totalSteps = incomingTotal;
        renderProgress(currentStep, totalSteps, `Size ${fileSizeMB}MB #${iteration + 1}`);
    });

    const start = performance.now();

    await generateRandomFile(tempFile, fileSizeMB);
    await generateFileRecord({
        db,
        fileSourcePath: tempFile,
        spacePath: '/home/',
        spaceFilename: path.basename(tempFile, '.dat') + '.mp4',
        spaceId,
        emitter,
    });

    const end = performance.now();

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);

    await cleanup(tempFile)

    return end - start;
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('title', {
            type: 'string',
            describe: 'Benchmark title (used in CSV filename)',
            demandOption: true,
        })
        .help()
        .argv;

    const title = argv.title;
    const N = 5;
    const csvFilename = `benchmark_${title}.csv`;

    const root = await makeTempDir();
    const core = await createCore({ rootPath: root });

    const username = 'benchUser';
    const password = 'benchPass';
    await core.accounts.create(username, password);
    await core.accounts.authenticate(username, password);

    const { db } = core.managers.session.getDatabase();

    const spacePayload = await buildTestSpacePayload({ spaceName: `bench-${title}` });
    const { spaceId } = await createSpace(db, spacePayload);
    console.log(`Space ready: ${spaceId}\n`);

    fs.writeFileSync(csvFilename, 'title,size_mb,run1_ms,run2_ms,run3_ms,run4_ms,run5_ms,average_ms\n');

    const sizes = buildSizeSequence();
    console.log(`Testing ${sizes.length} file sizes, ${N} runs each.\n`);

    for (const sizeMB of sizes) {
        const times = [];

        for (let i = 0; i < N; i++) {
            const elapsed = await runSingleIteration(root, sizeMB, i, db, spaceId);
            times.push(elapsed);
            console.log(`  Run ${i + 1}: ${elapsed.toFixed(2)} ms`);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`  -> Average for ${sizeMB} MB: ${avg.toFixed(2)} ms\n`);

        const row = [title, sizeMB, ...times.map(t => t.toFixed(2)), avg.toFixed(2)].join(',');
        fs.appendFileSync(csvFilename, row + '\n');
    }

    console.log(`All results written to ${csvFilename}`);

    await core.accounts.logout();
    await cleanup(root);
}

main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});