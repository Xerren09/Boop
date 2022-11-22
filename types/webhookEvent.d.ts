/**
 * 
 * */
declare global {
    type WebhookEvent = {
        name: string;  // "ping"
        time: {
            unix: number;
            string: string;
        },
        repository: {
            url: string;
            branch: string;
            name: string;
            owner: {
                name: string;
                url: string;
            },
        },
        security: {
            hash: string;
            valid: boolean;
        },
        sender: {
            name: string;
            url: string;
        }
    }
}

export { }