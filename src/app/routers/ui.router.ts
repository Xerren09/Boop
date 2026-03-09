import express from "express";
import { join } from "path";
import cors from "cors";
import { BOOP_BASE_DIR } from "../../constants.js";

export const uiRouter = express.Router();
uiRouter.use(cors());
uiRouter.use(express.static(join(BOOP_BASE_DIR, 'bin', 'web')));
uiRouter.use("/{*splat}", (_req, res) => {
    // Frontend uses client side routing
    res.sendFile(join(BOOP_BASE_DIR, 'bin', 'web', 'index.html'))
});