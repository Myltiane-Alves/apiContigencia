import { Router } from 'express';

import ConsultaNfeController from './ConsultaNFCE/controllers/index.js'

const routes = new Router();

routes.get('/', (req, res) => {
    res.send('Hello World! Myltiane');
});


routes.get('/validarConsulta', ConsultaNfeController.validarConsultar);

export default routes;