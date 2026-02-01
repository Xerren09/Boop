import express from "express";
import { join } from "path";

/**
 * Creates a new Express Router that serves static files, for example for a web-app.
 * @param route The route the app should be served on
 * @param rootPath The root path of the file's conatining directory
 * @param index The path within `rootPath` pointing to the index file
 * @returns {Router}
 */
export function createAppRouter(route: string, rootPath: string, index: string) {
    var router = express.Router();
    // The entry route for this website, requests get tunnelled here
    const indexRoute = `/${route}/`;
    // The route for file serving
    const filesRoute = `/${route}`;
    const indexPath = join(rootPath, index);
    router.use(filesRoute, express.static(rootPath));
    router.get(indexRoute, function (_req, res) {
        res.sendFile(indexPath);
    });
    return router;
}