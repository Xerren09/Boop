import express from "express";
import { join } from "path";

/**
 * Creates a new Express Router that serves static files, for example a web-app.
 * @param route The route the app should be served on
 * @param rootPath The root path of file's conatining directory
 * @param index The path within `rootPath` pointing to the index file
 * @returns {Router}
 */
export function createAppRouter(route: string, rootPath: string, index: string) {
    var router = express.Router();
    // The entry route for this website, requests get tunnelled here
    const redirectRoute = `/${route}/*`;
    // The route for file serving
    const staticRedirectRoute = `/${route}`;
    const indexPath = join(rootPath, index);
    router.use(staticRedirectRoute, express.static(rootPath));
    router.get(redirectRoute, function (req, res, next) {
        // Unsure if this works as intended? Won't this block other index-like files from resolving?
        res.sendFile(indexPath);
    });
    return router;
}