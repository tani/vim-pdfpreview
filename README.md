# w3pdf (WWW PDF Viewer)

This project is a fork of LaTeX Workshop, which is a plugin for VSCode.
Our goal is to create the PDF.js server with SyncTeX.

## Installation

```
$ npm install -g tani/w3pdf # or
$ pnpm add -g tani/w3dpfa # or
$ yarn add -g tani/w3pdf
```

## Usage

- Launch server: `w3pdf -p 8080 /path/to/pdf`
- Forward Search with SyncTeX: `curl localhost:8080/synctex?pdf=/path/to/pdf&tex=/path/to/tex&line=89`

## License

Copyright 2021 (c) TANIGUCHI Masaya. All Rights Reserved. MIT License
