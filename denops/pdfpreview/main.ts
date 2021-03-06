import { Denops } from "https://lib.deno.dev/x/denops_std@v2/mod.ts";
import * as vars from "https://lib.deno.dev/x/denops_std@v2/variable/mod.ts";
import * as unknown from "https://lib.deno.dev/x/unknownutil@v1/mod.ts";
import { open } from "https://lib.deno.dev/x/open@v0/index.ts";
import { Server } from "../../server/index.ts"

export async function main(denops: Denops) {
  const server = new Server()
  const hostname = await vars.g.get(denops, 'pdfpreview#hostname', 'localhost') ?? 'localhost'
  const port = parseInt(await vars.g.get(denops, 'pdfpreview#port', '8080') ?? '8080')
  server.listen({hostname, port})

  denops.dispatcher = {
    async open(file: unknown): Promise<void> {
      unknown.ensureString(file)
      file = await Deno.realPath(file)
      await vars.b.set(denops, 'pdfpreview_pdf', file)
      const hostname = await vars.g.get(denops, 'pdfpreview#hostname', 'localhost') ?? 'localhost'
      const port = parseInt(await vars.g.get(denops, 'pdfpreview#port', '8080') ?? '8080')
      const url = `http://${hostname}:${port}/viewer/viewer.html?file=/pdf${file}`
      const browser = await vars.g.get<string | string[]>(denops, 'pdfpreview#browser')
      if (browser) {
        await open(url, {app: browser})
      } else {
        await open(url)
      }
    },
    async search(): Promise<void> {
      const [, line]= await denops.eval("getpos('.')") as [number, number]
      const tex = await denops.eval("expand('%:p')") as string
      const pdf = await vars.b.get<string>(denops, 'pdfpreview_pdf')
      if (!pdf) {
        return
      }
      server.search(line, tex, pdf)
    },
    async refresh(): Promise<void> {
      const pdf = await vars.b.get<string>(denops, 'pdfpreview_pdf')
      if (!pdf) {
        return
      }
      server.refresh(pdf)
    },
  }

  await denops.cmd(`command! PDFRefresh call denops#notify('${denops.name}', 'refresh', [])`)
  await denops.cmd(`command! PDFSearch call denops#notify('${denops.name}', 'search', [])`)
  await denops.cmd(`command! -nargs=1 -complete=file PDFPreview call denops#notify('${denops.name}', 'open', [<q-args>])`)
}
