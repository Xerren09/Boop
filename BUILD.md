# Building Boop

The project requires at least NodeJS v25.2.1 to be installed.

#### Steps:
1. `npm run setup`
    - Installs both the CLI dependencies and the WebUI project's.
2. `npm run build`
    - Builds Boop with the WebUI installed. 

### Separate components

The core application and the WebUI are not tightly coupled and can be built independently. It is also possible to ignore the WebUI and run Boop without it.

## Core

The main application includes the CLI, webserver (webhook, proxies, API), and project manager.

#### Steps:
1. `npm run build:app`

The program will be built in `.\bin\`.

### Development ENV

Create an `.env` file to the root of `USERHOME/.boop`, and add the following keys:

```env
// Should be the same as the key used to signed the webhook requests so they can be verified.
SECRET=test

// Disables webhook security and allows unsigned webhook requests to be processed.
DEBUG_DISABLE_WEBHOOK_SECURITY=true

// Mainly used for extra logging; all logs are printed to console.
NODE_ENV=development

// Will skip pulling or cloning projects from github during project installation after intial setup.
DEBUG_BYPASS_GIT_PULL=true
```

## Web UI

#### Steps:
1. `npm run build:ui`

The Web UI is built with Vite. Output files will be copied to `.\bin\web`.

Boop can start without the Web UI compiled, but it will display a warning in startup.