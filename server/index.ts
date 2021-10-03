import * as server from "https://lib.deno.dev/x/oak@v9/mod.ts";
import logger from "https://lib.deno.dev/x/oak_logger@v1/mod.ts";
import * as path from "https://lib.deno.dev/std@v0/node/path.ts";
import * as url from "https://lib.deno.dev/std@v0/node/url.ts";
import { SyncTexJs } from "./synctex/index.ts";

let connections = [] as WebSocket[];

export function synctexForward(line: number, tex: string, pdf: string) {
  const synctex = new SyncTexJs();
  const data = synctex.syncTexJsForward(line, tex, pdf);
  for (const connection of connections) {
    const message = JSON.stringify({ type: "synctex", data });
    console.debug("sending " + message);
    connection.send(message);
  }
}

export function serve(addr: string, pdf: string): Promise<void> {
  const app = new server.Application();
  const router = new server.Router();
  const cwd = path.dirname(url.fileURLToPath(import.meta.url));

  router
    .get("/viewer/(.*)", async (context) => {
      const filePath = path.resolve(
        path.join(cwd, "../", context.request.url.pathname),
      );
      console.debug("sending " + filePath);
      await server.send(context, filePath, { root: "/" });
    })
    .get("/out/(.*)", async (context) => {
      const filePath = path.resolve(
        path.join(cwd, "../", context.request.url.pathname.replace("/out", "")),
      );
      console.debug("sending " + filePath);
      await server.send(context, filePath, { root: "/" });
    })
    .get("/build/(.*)", async (context) => {
      const filePath = path.resolve(
        path.join(cwd, "../pdfjs-dist/", context.request.url.pathname),
      );
      console.debug("sending " + filePath);
      await server.send(context, filePath, { root: "/" });
    })
    .get("/pdf/(.*)", async (context) => {
      const filePath = context.request.url.pathname.replace("/pdf", "");
      console.debug("sending " + filePath);
      await server.send(context, filePath, { root: "/" });
    })
    .get("/start", (context) => {
      context.response.redirect(`/viewer/viewer.html?file=/pdf${pdf}`);
    })
    .get("/", async (context) => {
      const connconnection = await context.upgrade();
      connections.push(connconnection);
      connconnection.onmessage = (data) => {
        console.debug(data);
      };
      connconnection.close = () => {
        connections = connections.filter((c) => c !== connconnection);
      };
    });

  const listener = app
    .use(router.routes())
    .use(router.allowedMethods())
    .use(logger.logger)
    .use(logger.responseTime)
    .listen(addr);
  console.info("listening on " + addr);
  return listener;
}

await serve(
  "localhost:8080",
  path.resolve(
    "/home/masaya/b/lenls2021/main.pdf",
  ),
);
