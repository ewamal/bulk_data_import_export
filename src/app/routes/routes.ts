import { Router } from 'express';
import tagsController from './tag/tag.controller';
import articlesController from './article/article.controller';
import authController from './auth/auth.controller';
import profileController from './profile/profile.controller';
import importsController from './imports/imports.controller';
import exportsController from './exports/exports.controller';

const api = Router()
  .use(tagsController)
  .use(articlesController)
  .use(profileController)
  .use(authController);

const v1 = Router()
  .use(importsController)
  .use(exportsController);

export default Router()
  .use('/api', api)
  .use('/v1', v1);
