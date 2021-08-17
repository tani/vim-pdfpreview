import { App, Request } from '@tinyhttp/app'
import sirv from 'sirv'
import { tinyws, TinyWSRequest } from 'tinyws'
import type WebSocket from 'ws'
import { SyncTexJs } from './synctex/index.js'

const pdf = process.argv[process.argv.length  - 1]
const port = process.argv[process.argv.length  - 2]
const app = new App<any, Request & TinyWSRequest>()
const synctex = new SyncTexJs()

let connsMap: Map<string, WebSocket[]> = new Map()

app
   .use(tinyws())
   .use('/viewer', sirv('viewer'))
   .get('/pdf/*', async (req, res) => {
      const absolutePath = req.path.replace('/pdf', '')
      res.sendFile(absolutePath)
   })
   .get('/refresh', async (req, res) => {
      // localhost:8080/refresh?pdf=/absolute/path/to/pdf
      const pdf = req.query.pdf as any
      connsMap.get(pdf)?.forEach(conn => conn.send(JSON.stringify({type: 'refresh'})))
      res.sendStatus(200)
   })
   .get('/synctex', async (req, res) => {
      // localhost:8080/synctex?line=10&tex=/absolute/path/to/tex&pdf=/absolute/path/to/pdf
      const {line, tex, pdf} = req.query as any
      const data = synctex.syncTexJsForward(parseInt(line), tex, pdf)
      connsMap.get(pdf)?.forEach(conn => conn.send(JSON.stringify({type: 'synctex', data})))
      res.sendStatus(200)
   })
   .get('/', async (req, res) => {
      if (req.ws) {
         const conn = await req.ws()
         conn.on('message', function(data: any) {
            console.log(data)
         }).on('close', function() {
            const conns = connsMap.get(pdf) || []
            connsMap.set(pdf, conns.filter(_conn => _conn !== conn))
         })
         const conns = connsMap.get(pdf) || []
         connsMap.set(pdf, [conn, ...conns])
      } else {
         res.redirect(`/viewer/web/viewer.html?file=/pdf${pdf}`)
      }
   })
   .listen(parseInt(port), () => {
      console.log(`Viewer:  http://localhost:${port}/`)
      console.log(`Refresh: https://localhost:${port}/refresh?pdf=<string>`)
      console.log(`SyncTeX: https://localhost:${port}/synctex?pdf=<string>&line=<numebr>&tex=<string>`)
   })
