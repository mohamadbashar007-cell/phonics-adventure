import express from 'express';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 4175);
const pagesPath = '/phonics-adventure';
const distPath = path.resolve('dist');

app.use(pagesPath, express.static(distPath));
app.get('/', (_request, response) => response.redirect(`${pagesPath}/`));

app.listen(port, '127.0.0.1', () => {
  console.log(`GitHub Pages preview available at http://127.0.0.1:${port}${pagesPath}/`);
});
