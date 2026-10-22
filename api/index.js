import {createVercelHandler} from '../src/vercel-runtime.js';

export default {fetch: createVercelHandler()};
