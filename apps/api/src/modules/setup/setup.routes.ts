import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { setupController } from './setup.controller.js';

export const setupRouter: Router = Router();

setupRouter.get('/check', asyncHandler(setupController.check));
setupRouter.post('/', asyncHandler(setupController.setup));
