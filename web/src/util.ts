var host: string = window.location.origin;

export function overrideHost(base: string) {
    host = base;
}

export function getApiString() {
    return `${host}/boop/api`;
}

export function getProxyString(projectId: string) {
    return `${host}/${projectId}`;
}