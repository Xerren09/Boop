/**
 * 
 * */
declare global {
    type BoopConfig = {
        /**The git branch we're interested in. */
        branch: string;
        /**The list of build commands before the project can be hosted. */
        build: string[];
        /**The project root that is hosted. Can be a path for static websites, or a command for apps. */
        run: string;
    }
}

export { }