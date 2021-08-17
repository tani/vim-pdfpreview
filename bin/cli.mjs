#!/usr/bin/env node

import launch from "../out/server/index.js"
import { resolve } from "path"

launch(
    resolve(process.argv[process.argv.length - 1]),
    parseInt(process.argv[process.argv.length - 2])
)
