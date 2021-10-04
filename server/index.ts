import * as server from "https://lib.deno.dev/x/oak@v9/mod.ts";
import logger from "https://lib.deno.dev/x/oak_logger@v1/mod.ts";
import * as path from "https://lib.deno.dev/std@v0/node/path.ts";
import * as url from "https://lib.deno.dev/std@v0/node/url.ts";
import { isSameRealPath, SyncTexJs } from "./synctex.ts";

const cwd = path.dirname(url.fileURLToPath(import.meta.url));

export class Server {
  #connections = new Map<string, WebSocket[]>()

  async #handleViewer(context: server.Context) {
    await server.send(context, context.request.url.pathname, {
      root: path.resolve(path.join(cwd, "../vendor/LaTeX-Workshop/")),
    });
  }

  async #handleBuild(context: server.Context) {
    await server.send(context, context.request.url.pathname, {
      root: path.resolve(path.join(cwd, "../vendor/pdfjs-dist/")),
    });
  }

  async #handlePdf(context: server.Context) {
    const filePath = context.request.url.pathname.replace("/pdf", "");
    await server.send(context, filePath, { root: "/" });
  }

  refresh(pdf: string) {
    for(const [path, connections] of this.#connections) {
      if (isSameRealPath(path, pdf)) {
        for(const connection of connections) {
          const message = JSON.stringify({ type: "refresh" })
          connection.send(message)
        }
      }
    }
  }

  #handleRefresh(context: server.RouterContext) {
    const { pdf } = context.params;
    if (!pdf) {
      context.response.status = 404
      return
    }
    this.refresh(pdf)
    context.response.status = 200;
  }

  search(line: number, tex: string, pdf: string) {
    for (const [path, connections] of this.#connections) {
      if (isSameRealPath(path, pdf)) {
        for (const connection of connections) {
          const synctex = new SyncTexJs();
          const data = synctex.syncTexJsForward(line, tex, pdf);
          const message = JSON.stringify({ type: "synctex", data });
          connection.send(message);
        }
      }
    }
  }

  #handleSearch(context: server.RouterContext) {
    const { line, tex, pdf } = context.params;
    if (!(line && tex && pdf)) {
      context.response.status = 404;
      return;
    }
    this.search(parseInt(line), tex, pdf)
    context.response.status = 200;
  }

  async #handleRoot(context: server.Context) {
    let connection: WebSocket;
    try {
      connection = await context.upgrade();
    } catch {
      context.response.redirect(`/viewer/viewer.html`);
      return;
    }
    connection.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.path) {
        const connections = this.#connections.get(data.path) ?? [];
        this.#connections.set(
          data.path.replace('/pdf', ''),
          connections
            .filter((c) => c !== connection)
            .concat([connection]),
        );
      }
    });
    connection.addEventListener("close", () => {
      for (const [path, conns] of this.#connections) {
        this.#connections.set(
          path,
          conns.filter((c) => c !== connection),
        );
      }
    });
  }

  listen(options: Deno.ListenOptions): Promise<void> {
    const app = new server.Application();
    const router = new server.Router();

    router
      .get("/viewer/(.*)", this.#handleViewer.bind(this))
      .get("/build/(.*)", this.#handleBuild.bind(this))
      .get("/pdf/(.*)", this.#handlePdf.bind(this))
      .get("/search", this.#handleSearch.bind(this))
      .get("/refresh", this.#handleRefresh.bind(this))
      .get("/", this.#handleRoot.bind(this));

    return app
      .use(router.routes())
      .use(router.allowedMethods())
      .use(logger.logger)
      .use(logger.responseTime)
      .listen(options);
  }
}
