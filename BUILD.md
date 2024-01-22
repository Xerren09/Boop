# Build instructions

These instructions are for building Boop from scratch from this repo. They should not be used otherwise.

## app

Create a `.env` file to the root of the web folder, and add the following keys:
```env
NODE_ENV=development
SECRET=<hash>
```
Setting `NODE_ENV` to `development` will disable the webhook processor's security check. Setting the `SECRET` here will just make life easier, no need to use the `--secret` flag anymore.

## web

This is built with CRA. Create a `.env` file to the root of the web folder, and add the following keys:
```env
BUILD_PATH='../bin/ui/files'
GENERATE_SOURCEMAP=false
```
This will ensure the output files go to the top level bin folder, and no giant sourcemaps will be generated for npm.