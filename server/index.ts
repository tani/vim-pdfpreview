// Copyright (c) 2021 TANIGUCHI Masaya. All Rights Reserved. MIT License
import { App, Request } from '@tinyhttp/app'
import sirv from 'sirv'
import { tinyws, TinyWSRequest } from 'tinyws'
import type WebSocket from 'ws'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { SyncTexJs } from './synctex/index.js'

export default function(pdf: string, port: number) {
   const app = new App<any, Request & TinyWSRequest>()
   const synctex = new SyncTexJs()
   const connsMap: Map<string, WebSocket[]> = new Map()

   app
      .use(tinyws())
      .use('/viewer', sirv(resolve(dirname(fileURLToPath(import.meta.url)) + '/../../viewer')))
      .use('/out', sirv(resolve(dirname(fileURLToPath(import.meta.url)) + '/../../out')))
      .use('/build', sirv(dirname(createRequire(import.meta.url).resolve('pdfjs-dist'))))
      .get('/pdf/*', async (req, res) => {
         const absolutePath = req.path.replace('/pdf', '')
         res.sendFile(absolutePath)
      })
      .get('/refresh', async (req, res) => {
         // localhost:8080/refresh?pdf=/absolute/path/to/pdf
         const pdf = req.query.pdf as any
         if (!pdf) {
            for (const conns of connsMap.values()) {
               conns.forEach(conn => conn.send(JSON.stringify({ type: 'refresh' })))
            }
         } else {
            connsMap.get(pdf)?.forEach(conn => conn.send(JSON.stringify({ type: 'refresh' })))
         }
         res.sendStatus(200)
      })
      .get('/synctex', async (req, res) => {
         // localhost:8080/synctex?line=10&tex=/absolute/path/to/tex&pdf=/absolute/path/to/pdf
         const { line, tex, pdf } = req.query as any
         const data = synctex.syncTexJsForward(parseInt(line), tex, pdf)
         connsMap.get(pdf)?.forEach(conn => conn.send(JSON.stringify({ type: 'synctex', data })))
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
            res.redirect(`/viewer/viewer.html?file=/pdf${pdf}`)
         }
      })
      .listen(port, () => {
         console.log(`Viewer:  http://localhost:${port}/`)
         console.log(`Refresh: http://localhost:${port}/refresh?pdf=${pdf}`)
         console.log(`SyncTeX: http://localhost:${port}/synctex?pdf=${pdf}&line=<numebr>&tex=<string>`)
      })
}
