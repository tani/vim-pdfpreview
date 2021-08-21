// Copyright (c) 2021 TANIGUCHI Masaya. All Rights Reserved. MIT License
import { App, Request } from '@tinyhttp/app'
import sirv from 'sirv'
import { tinyws, TinyWSRequest } from 'tinyws'
import type WebSocket from 'ws'
import { watch } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { SyncTexJs } from './synctex/index.js'

export default async function(pdf: string, port: number) {
   const app = new App<any, Request & TinyWSRequest>()
   const synctex = new SyncTexJs()
   let conns = [] as WebSocket[]

   watch(pdf, () => {
      for (const conn of conns) {
         conn.send(JSON.stringify({ type: 'refresh' }))
      }
   })

   app
      .use(tinyws())
      .use('/viewer', sirv(resolve(dirname(fileURLToPath(import.meta.url)) + '/../../viewer')))
      .use('/out', sirv(resolve(dirname(fileURLToPath(import.meta.url)) + '/../../out')))
      .use('/build', sirv(dirname(createRequire(import.meta.url).resolve('pdfjs-dist'))))
      .get('/pdf/*', async (req, res) => {
         const absolutePath = req.path.replace('/pdf', '')
         res.set('Cache-Control', 'no-store')
         res.sendFile(absolutePath)
      })
      .get('/synctex', async (req, res) => {
         // localhost:8080/synctex?line=10&tex=/absolute/path/to/tex&pdf=/absolute/path/to/pdf
         const { line, tex } = req.query as any
         const data = synctex.syncTexJsForward(parseInt(line), tex, pdf)
         for (const conn of conns) {
            conn.send(JSON.stringify({ type: 'synctex', data }))
         }
         res.sendStatus(200)
      })
      .get('/', async (req, res) => {
         if (req.ws) {
            const conn = await req.ws()
            conns.push(conn)
            conn.on('message', function(data: any) {
               console.log(data)
            }).on('close', function() {
               conns = conns.filter(_conn => _conn !== conn)
            })
         } else {
            res.redirect(`/viewer/viewer.html?file=/pdf${pdf}`)
         }
      })
      .listen(port, () => {
         console.log(`Viewer:  http://localhost:${port}/`)
         console.log(`SyncTeX: http://localhost:${port}/synctex?line=<numebr>&tex=<string>`)
      })
}
