import express from 'express';
import cors from 'cors';
import corsMiddleware from './middlewares/cors.js'
import routes from './routes.js'

import bodyParser from 'body-parser';
import 'dotenv/config';

import path from 'path';
const __dirname = new URL('.', import.meta.url).pathname;

class App {
    constructor() {
        this.server = express();
        this.middlewares();
        this.routes();
    }
    middlewares() {
        this.server.use(cors({
            origin: ['https://api-validar-contigenciar.vercel.app/', 'https://quality-tau.vercel.app'],
            credentials: true,
            timeout: 50000,
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'Access-Control-Allow-Origin *',
                'Access-Control-Allow-Headers',
                'X-Requested-With',
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Credentials',
                'Origin',
                'Accept'
            ],
            credentials: true,
            preflightContinue: true,
        }));

        this.server.use(express.json());
        this.server.use(corsMiddleware);
        this.server.use(bodyParser.json({ limit: '100mb', extended: true }));
        this.server.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
        this.server.use('/files', express.static(path.resolve(__dirname, '..', 'uploads')));
    }

    routes() {
        this.server.use(routes);
    }
}

export default new App().server;

