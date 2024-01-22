import express from "express";
import { join } from "path";
import cors from "cors";
import { __dirname } from "../utils.js";

export const uiRouter = express.Router();
uiRouter.use(cors());
uiRouter.use(express.static(join(__dirname(import.meta.url), 'files')));
uiRouter.use("*", (req, res, next) => {
    // Let the react app figure out sub-routes
    res.sendFile(join(__dirname(import.meta.url), 'files', 'index.html'))
});