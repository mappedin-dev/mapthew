# Shared Package

Code shared between other packages.

## Exporting Code

Avoid barrel files. To export code from a new file, add a new entry point in the package.json.

## Config

`src/config.ts` contains code that instantiates `ioredis`.

Front end packages should avoid importing from this file. Any code needed by front end packages should not be put in this file.
