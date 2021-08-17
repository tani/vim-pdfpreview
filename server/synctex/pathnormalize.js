import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
export function normalize(filePath) {
    let normPath = path.normalize(filePath);
    if (os.platform() === 'win32') {
        // Normalize drive letters on Windows.
        normPath = normPath.replace(/^([a-zA-Z]):/, (_m, p1) => p1.toLocaleUpperCase() + ':');
    }
    return normPath;
}
export function isSameRealPath(filePathA, filePathB) {
    const a = normalize(fs.realpathSync(path.normalize(filePathA)));
    const b = normalize(fs.realpathSync(path.normalize(filePathB)));
    return a === b;
}
