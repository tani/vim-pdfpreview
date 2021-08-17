#!/usr/bin/env node

import launch from "../out/server/index.js"
import { Command } from "commander"
import { resolve } from "path"

const program = new Command()
program
    .argument("<pdf>")
    .option("-p, --port <port>", "port number")
    .parse(process.argv)

launch(
    resolve(program.args[0]),
    parseInt(program.opts().port || 8080)
)
