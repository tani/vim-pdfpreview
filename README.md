# PDF Preview for Vim

This project is a fork of LaTeX Workshop, which is a plugin for VSCode.
Our goal is to create the PDF.js application with SyncTeX.

## Installation

```
Plug 'vim-denops/denops.vim'
Plug 'tani/vim-pdfpreview', { do: './bin/install.sh' }
```

## Commands

- Open PDF file `:PDFPreivew path/to/pdf`
- SyncTeX forward search  `:PDFSearch`
- SyncTeX refresh PDF  `:PDFRefresh`

## Configuration

- Hostname of PDF.js servr `g:pdfpreview#hostname`
- Port number of PDF.js servr `g:pdfpreview#port`
- Web browser for `:PDFPreivew`, `g:pdfpreview#browser`

## License

Copyright 2021 (c) TANIGUCHI Masaya. All Rights Reserved. MIT License
