import { startBootstrapServer } from "../../src/services/bootstraper.service.js";

startBootstrapServer()
    .then(({ ipv4, port }) => {
        console.log(`Runnig at: ${ipv4}:${port}`);
    })
    .catch(error => {
        console.error(error)
    })