import express, { Request, Response, ErrorRequestHandler, Express, NextFunction } from "express";
import cors from "cors";
import apiRoutes from './routes';
import { checkAuth } from "./controllers/healthController";
import morgan from "morgan";

const app: Express = express();

export const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(', ')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS policy violation: Access denied"));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

app.use('/api', checkAuth, apiRoutes)

app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found`});
});

interface HttpError extends Error {
    status?: number;
}

const errorHandler: ErrorRequestHandler = (
    err: HttpError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
}
app.use(errorHandler);

export default app;
