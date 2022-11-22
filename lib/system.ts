/**
 * Calculates the current uptime
 * @returns 
 */
export function upTime () {
    const processUptime = process.uptime();
    const processUptimeMS = process.uptime()*1000;
    const currDate = Date.now();
    const processStartDate = new Date((currDate-processUptimeMS));
    return {
        string: `${Math.floor(processUptime/86400)} days ${Math.floor(processUptime/3600)%24} hours ${Math.floor(processUptime/60)%60} minutes ${Math.floor(processUptime%60)} seconds`,
        start: processStartDate.toUTCString()
    }
}

/**
 * Compiles basic node info
 * @returns 
 */
export function compile () {
    return {
        uptime: upTime(),
        platform: process.platform,
        nodeVersion: process.version
    }
}