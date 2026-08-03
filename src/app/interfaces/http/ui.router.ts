import express from "express";
import { join } from "path";
import cors from "cors";
import { WEB_INTERFACE_DIR } from "../../../constants.js";

export const uiRouter = express.Router();
uiRouter.use(cors());
uiRouter.use(express.static(WEB_INTERFACE_DIR));
uiRouter.use("/{*splat}", (_req, res) => {
    // Frontend uses client side routing
    res.sendFile(join(WEB_INTERFACE_DIR, 'index.html'))
});