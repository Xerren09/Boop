import express from "express";
import { join } from "path";
import cors from "cors";
import { resolve__dirname } from "../utilities.js";

export const uiRouter = express.Router();
uiRouter.use(cors());
uiRouter.use(express.static(join(resolve__dirname(import.meta.url), 'files')));
uiRouter.use("/{*splat}", (_req, res) => {
    // Frontend uses client side routing
    res.sendFile(join(resolve__dirname(import.meta.url), 'files', 'index.html'))
});