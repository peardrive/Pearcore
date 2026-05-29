import { describe, it, beforeEach } from "vitest";
import * as EVENTS from '../../src/constants/events.constants.js';
import { CoreFactory } from '../factory.js';
import { generateRandomFile, makeTempDir } from "../general.utils.js";
import path from "path";

describe('SpaceFileActionHandler', () => {
    let root = null;
    let factory = null;
    let primaryCore = null;
    let secondaryCore = null;
    let space = null;

    beforeEach(async () => {
        root = await makeTempDir();
        factory = new CoreFactory();
        await factory.init();

        const cores = await factory.createMultipleCores(2);
        primaryCore = cores[0];
        secondaryCore = cores[1];

        space = await primaryCore.space.create({
            spaceName: 'file space',
        });
    })

    it('should handle SYNC state', async () => {
        const filePath = path.join(root, 'file');
        await generateRandomFile(filePath, 1);

        await secondaryCore.space.join(space.sharelink);
        secondaryCore.managers.message.on(EVENTS.General, (message) => {
            console.log(message)
        })

        await new Promise(resolve => {
            setTimeout(resolve, 1500);
        });
    })
})