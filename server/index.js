import { App } from '@tinyhttp/app';
import sirv from 'sirv';
import { tinyws } from 'tinyws';
import { SyncTexJs } from './synctex/index.js';
const pdf = process.argv[process.argv.length - 1];
const app = new App();
const synctex = new SyncTexJs();
let conns = [];
app
    .use(tinyws())
    .use('/viewer', sirv('viewer'))
    .use('/latexworkshop', sirv('latexworkshop'))
    .get('/pdf/*', async (req, res) => {
    const absolutePath = req.path.replace('/pdf', '');
    res.sendFile(absolutePath);
})
    .get('/synctex', async (req, res) => {
    // localhost:8080/synctex?line=10&tex=/absolute/path/to/tex&pdf=/absolute/path/to/pdf
    const { line, tex, pdf } = req.query;
    const data = synctex.syncTexJsForward(parseInt(line), tex, pdf);
    conns.forEach(conn => conn.send(JSON.stringify({ type: 'synctex', data })));
    res.sendStatus(200);
})
    .get('/', async (req, res) => {
    if (req.ws) {
        const conn = await req.ws();
        conn.on('message', function (data) {
            console.log(data);
        }).on('close', function () {
            conns = conns.filter(_conn => _conn !== conn);
        });
        conns.push(conn);
    }
    else {
        res.redirect(`/viewer/web/viewer.html?file=/pdf${pdf}`);
    }
})
    .listen(8080);
