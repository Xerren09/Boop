import winston from "winston";
import { LOG_FILE } from "./app/constants.js";

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: LOG_FILE,
            format: winston.format.combine(
                winston.format.uncolorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                winston.format.metadata(),
                winston.format.errors(),
                winston.format.json()
            )
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.errors(),
                winston.format.simple()
            ),
            level: "info"
        })
    ],
});

export default logger;