#!/bin/sh

_ROOT=`dirname $0`/..
ROOT=`realpath $_ROOT`
git -C "$ROOT" submodule update --init
git -C "$ROOT/vendor/LaTeX-Workshop" reset --hard
git -C "$ROOT/vendor/LaTeX-Workshop" apply "$ROOT/patch/latexworkshop.patch"
deno bundle -c "$ROOT/vendor/LaTeX-Workshop/viewer/tsconfig.json" \
  "$ROOT/vendor/LaTeX-Workshop/viewer/latexworkshop.ts" \
  > "$ROOT/vendor/LaTeX-Workshop/viewer/latexworkshop.js"
