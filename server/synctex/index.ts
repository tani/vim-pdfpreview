import * as fs from 'https://lib.deno.dev/std@0.x/node/fs.ts'
import * as path from 'https://lib.deno.dev/std@0.x/node/path.ts'
import * as os from 'https://lib.deno.dev/std@0.x/node/os.ts'
import * as zlib from 'https://lib.deno.dev/x/denoflate@1.x/mod.ts'
import { Buffer } from 'https://lib.deno.dev/std@0.x/node/buffer.ts'
import { PdfSyncObject, parseSyncTex, Block, SyncTexJsError } from './synctexjs.ts'

function normalize(filePath: string) {
    let normPath = path.normalize(filePath)
    if (os.platform() === 'win32') {
        // Normalize drive letters on Windows.
        normPath = normPath.replace(/^([a-zA-Z]):/, (_m, p1: string) => p1.toLocaleUpperCase() + ':')
    }
    return normPath
}

function isSameRealPath(filePathA: string, filePathB: string): boolean {
    const a = normalize(fs.realpathSync(path.normalize(filePathA)))
    const b = normalize(fs.realpathSync(path.normalize(filePathB)))
    return a === b
}

const TextDecoderSupportedEncodings =["utf-8","ibm866","iso-8859-2","iso-8859-3","iso-8859-4","iso-8859-5","iso-8859-6","iso-8859-7","iso-8859-8","iso-8859-8i","iso-8859-10","iso-8859-13","iso-8859-14","iso-8859-15","iso-8859-16","koi8-r","koi8-u","macintosh","windows-874","windows-1250","windows-1251","windows-1252","windows-1253","windows-1254","windows-1255","windows-1256","windows-1257","windows-1258","x-mac-cyrillic","gbk","gb18030","hz-gb-2312","big5","euc-jp","iso-2022-jp","shift-jis","euc-kr","iso-2022-kr","utf-16be","utf-16le","x-user-defined","replacement"]

type SyncTeXRecordForward = {
    page: number,
    x: number,
    y: number
}

type SyncTeXRecordBackward = {
    input: string,
    line: number,
    column: number
}

class Rectangle {
    readonly top: number
    readonly bottom: number
    readonly left: number
    readonly right: number

    static coveringRectangle(blocks: Block[]) {
        let cTop = 2e16
        let cBottom = 0
        let cLeft = 2e16
        let cRight = 0

        for (const b of blocks) {
            // Skip a block if they have boxes inside, or their type is kern or rule.
            // See also https://github.com/jlaurens/synctex/blob/2017/synctex_parser.c#L4655 for types.
            if (b.elements !== undefined || b.type === 'k' || b.type === 'r') {
                continue
            }
            cBottom = Math.max(b.bottom, cBottom)
            const top = b.bottom - b.height
            cTop = Math.min(top, cTop)
            cLeft = Math.min(b.left, cLeft)
            if (b.width !== undefined) {
                const right = b.left + b.width
                cRight = Math.max(right, cRight)
            }
        }
        return new Rectangle({ top: cTop, bottom: cBottom, left: cLeft, right: cRight })
    }

    static fromBlock(block: Block): Rectangle {
        const top = block.bottom - block.height
        const bottom = block.bottom
        const left = block.left
        const right = block.width ? block.left + block.width : block.left
        return new Rectangle({top, bottom, left, right})
    }

    constructor( {top, bottom, left, right}: { top: number, bottom: number, left: number, right: number} ) {
        this.top = top
        this.bottom = bottom
        this.left = left
        this.right = right
    }

    include(rect: Rectangle): boolean {
        return this.left <= rect.left && this.right >= rect.right && this.bottom >= rect.bottom && this.top <= rect.top
    }

    distanceY(y: number): number {
        return Math.min( Math.abs(this.bottom - y), Math.abs(this.top - y) )
    }

    distanceXY(x: number, y: number): number {
        return Math.sqrt(Math.pow(Math.min( Math.abs(this.bottom - y), Math.abs(this.top - y) ), 2) + Math.pow(Math.min( Math.abs(this.left - x), Math.abs(this.right - x) ), 2))
    }

    distanceFromCenter(x: number, y: number): number {
        return Math.sqrt(Math.pow((this.left + this.right) / 2 - x, 2) + Math.pow((this.bottom + this.top) / 2 - y, 2))
    }
}

export class SyncTexJs {
    private parseSyncTexForPdf(pdfFile: string): PdfSyncObject {
        const filename = path.basename(pdfFile, path.extname(pdfFile))
        const dir = path.dirname(pdfFile)
        const synctexFile = path.resolve(dir, filename + '.synctex')
        const synctexFileGz = synctexFile + '.gz'

        try {
            const s = fs.readFileSync(synctexFile, {encoding: 'binary'})
            return parseSyncTex(s.toString())
        } catch (e: unknown) {
            if (fs.existsSync(synctexFile)) {
                console.warn(`[SyncTexJs] parseSyncTex failed with: ${synctexFile}`)
                if (e instanceof Error) {
                    console.error(e)
                }
            }
        }

        try {
            const data = fs.readFileSync(synctexFileGz)
            const b = zlib.gunzip(data)
            const s = b.toString()
            return parseSyncTex(s)
        } catch (e: unknown) {
            if (fs.existsSync(synctexFileGz)) {
                console.warn(`[SyncTexJs] parseSyncTex failed with: ${synctexFileGz}`)
                if (e instanceof Error) {
                    console.error(e)
                }
            }
        }

        if (!fs.existsSync(synctexFile) && !fs.existsSync(synctexFileGz)) {
            console.warn(`[SyncTexJs] .synctex and .synctex.gz file not found: ${JSON.stringify({synctexFile, synctexFileGz})}`)
        }

        throw new SyncTexJsError(`parseSyncTexForPdf failed with: ${pdfFile}`)
    }

    private findInputFilePathForward(filePath: string, pdfSyncObject: PdfSyncObject): string | undefined {
        for (const inputFilePath in pdfSyncObject.blockNumberLine) {
            try {
                if (isSameRealPath(inputFilePath, filePath)) {
                    return inputFilePath
                }
            } catch(e: unknown) {
                console.warn(`[SyncTexJs] isSameRealPath throws error: ${JSON.stringify({inputFilePath, filePath})}`)
                if (e instanceof Error) {
                    console.error(e)
                }
            }
        }
        for (const inputFilePath in pdfSyncObject.blockNumberLine) {
            for (const enc of TextDecoderSupportedEncodings) {
                let convertedInputFilePath = ''
                try {
                    const decoder = new TextDecoder(enc)
                    convertedInputFilePath = decoder.decode(Buffer.from(inputFilePath, 'binary'))
                    if (isSameRealPath(convertedInputFilePath, filePath)) {
                        return inputFilePath
                    }
                } catch (e: unknown) {
                    console.warn(`[SyncTexJs] isSameRealPath throws error: ${JSON.stringify({inputFilePath, convertedInputFilePath, filePath})}`)
                    if (e instanceof Error) {
                        console.error(e)
                    }
                }
            }
        }
        return undefined
    }

    syncTexJsForward(line: number, filePath: string, pdfFile: string): SyncTeXRecordForward {
        console.warn(`[SyncTexJs] Execute syncTexJsForward: ${JSON.stringify({pdfFile, filePath, line})}`)
        const pdfSyncObject = this.parseSyncTexForPdf(pdfFile)
        const inputFilePath = this.findInputFilePathForward(filePath, pdfSyncObject)
        if (inputFilePath === undefined) {
            const inputFiles = Object.keys(pdfSyncObject.blockNumberLine)
            const inputFilesStr = JSON.stringify(inputFiles, null, ' ')
            throw new SyncTexJsError(`[SyncTexJs] No relevant entry of the tex file found in the synctex file: ${JSON.stringify({filePath, pdfFile, line, inputFilesStr})}`)
        }

        const linePageBlocks = pdfSyncObject.blockNumberLine[inputFilePath]
        const lineNums = Object.keys(linePageBlocks).map(x => Number(x)).sort( (a, b) => { return (a - b) } )
        const i = lineNums.findIndex( x => x >= line )
        if (i === 0 || lineNums[i] === line) {
            const l = lineNums[i]
            const blocks = this.getBlocks(linePageBlocks, l)
            const c = Rectangle.coveringRectangle(blocks)
            return { page: blocks[0].page, x: c.left + pdfSyncObject.offset.x, y: c.bottom + pdfSyncObject.offset.y }
        }
        const line0 = lineNums[i - 1]
        const blocks0 = this.getBlocks(linePageBlocks, line0)
        const c0 = Rectangle.coveringRectangle(blocks0)
        const line1 = lineNums[i]
        const blocks1 = this.getBlocks(linePageBlocks, line1)
        const c1 = Rectangle.coveringRectangle(blocks1)
        let bottom: number
        if (c0.bottom < c1.bottom) {
            bottom = c0.bottom * (line1 - line) / (line1 - line0) + c1.bottom * (line - line0) / (line1 - line0)
        } else {
            bottom = c1.bottom
        }
        return { page: blocks1[0].page, x: c1.left + pdfSyncObject.offset.x, y: bottom + pdfSyncObject.offset.y }
    }

    private getBlocks(linePageBlocks: { [inputLineNum: number]: { [pageNum: number]: Block[] } }, lineNum: number ): Block[] {
        const pageBlocks = linePageBlocks[lineNum]
        const pageNums = Object.keys(pageBlocks)
        if (pageNums.length === 0) {
            throw new SyncTexJsError('No page number found in the synctex file.')
        }
        const page = pageNums[0]
        return pageBlocks[Number(page)]
    }

    syncTexJsBackward(page: number, x: number, y: number, pdfPath: string): SyncTeXRecordBackward {
        console.warn(`[SyncTexJs] Execute syncTexJsBackward: ${JSON.stringify({pdfPath, page, x, y})}`)
        const pdfSyncObject = this.parseSyncTexForPdf(pdfPath)
        const y0 = y - pdfSyncObject.offset.y
        const x0 = x - pdfSyncObject.offset.x
        const fileNames = Object.keys(pdfSyncObject.blockNumberLine)

        if (fileNames.length === 0) {
            const inputFiles = JSON.stringify(fileNames, null, ' ')
            throw new SyncTexJsError(`No entry of the tex file found in the synctex file. Entries: ${inputFiles}`)
        }

        const record = {
            input: '',
            line: 0,
            distanceXY: 2e16,
            distanceFromCenter: 2e16,
            rect: new Rectangle({top: 0, bottom: 2e16, left: 0, right: 2e16})
        }

        for (const fileName of fileNames) {
            const linePageBlocks = pdfSyncObject.blockNumberLine[fileName]
            for (const lineNum in linePageBlocks) {
                const pageBlocks = linePageBlocks[Number(lineNum)]
                for (const pageNum in pageBlocks) {
                    if (page !== Number(pageNum)) {
                        continue
                    }
                    const blocks = pageBlocks[Number(pageNum)]
                    for (const block of blocks) {
                        // Skip a block if they have boxes inside, or their type is kern or rule.
                        // See also https://github.com/jlaurens/synctex/blob/2017/synctex_parser.c#L4655 for types.
                        if (block.elements !== undefined || block.type === 'k' || block.type === 'r') {
                            continue
                        }
                        const rect = Rectangle.fromBlock(block)
                        const distFromCenter = rect.distanceFromCenter(x0, y0)
                        if ( record.rect.include(rect) || (distFromCenter < record.distanceFromCenter && !rect.include(record.rect)) ) {
                            record.input = fileName
                            record.line = Number(lineNum)
                            record.distanceFromCenter = distFromCenter
                            record.rect = rect
                        }
                    }
                }
            }
        }

        if (record.input === '') {
            throw new SyncTexJsError('Cannot find any line to jump to.')
        }

        return { input: this.convInputFilePath(record.input), line: record.line, column: 0 }
    }

    private convInputFilePath(inputFilePath: string): string {
        if (fs.existsSync(inputFilePath)) {
            return inputFilePath
        }
        for (const enc of TextDecoderSupportedEncodings) {
            try {
                const decoder = new TextDecoder(enc)
                const s = decoder.decode(Buffer.from(inputFilePath, 'binary'))
                if (fs.existsSync(s)) {
                    return s
                }
            } catch {}
        }

        throw new SyncTexJsError(`Input file to jump to does not exist in the file system: ${inputFilePath}`)
    }
}
