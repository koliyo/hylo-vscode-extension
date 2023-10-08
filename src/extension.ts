import {
  workspace,
  commands,
  ExtensionContext,
  OutputChannel,
  Range,
  Position,
  DocumentSemanticTokensProvider,
  Hover,
  HoverProvider,
  TextDocument,
  CancellationToken,
  SemanticTokens,
  SemanticTokensLegend,
  SemanticTokensBuilder,
  languages,
  window,
  debug,
  WorkspaceConfiguration,
} from 'vscode'

import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  Executable,
  TransportKind,
  SocketTransport,
  Trace
} from 'vscode-languageclient/node'

import { createOutputChannels, wrappedOutput, setOutputSocket } from './output-channels'
import { updateLspServer } from './download-hylo-lsp'

// import * as fs from 'fs'
// import * as path from 'path'
import * as WebSocket from 'ws'

// https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
let client: LanguageClient

function expandvars_posix(s: string) {
  return s.replace(/\${?(\w+)}?/g, (_, n) => process.env[n]!)
}

function expandvars_windows(s: string) {
  return s.replace(/%([^%]+)%/g, (_, n) => process.env[n]!)
}

function expandvars(s: string) {
  return expandvars_windows(expandvars_posix(s))
}


let hyloLpsConfig: WorkspaceConfiguration
let isDebug = process.env.VSCODE_DEBUG_MODE !== undefined


async function activateBackend(context: ExtensionContext) {

  const disableLsp = hyloLpsConfig.get('disableLsp', false)
  if (disableLsp && !isDebug) {
    wrappedOutput.appendLine("LSP backend is disabled")
    return
  }

  process.chdir(context.extensionPath)

  wrappedOutput.appendLine(`Working directory: ${process.cwd()}, activeDebugSession: ${debug.activeDebugSession}, isDebug: ${isDebug}, __filename: ${__filename}`)

  let serverExe: string

  let hyloRoot = undefined
  let env = process.env;

  if (isDebug) {
    hyloRoot = `${context.extensionPath}/../..`
    serverExe = '/Users/nils/Work/hylo-lsp/.build/arm64-apple-macosx/debug/hylo-lsp-server'
  }
  else {
    await updateLspServer()
    // hyloRoot = hyloLpsConfig.get('rootDirectory')!
    // if (!hyloRoot) {
    //   await window.showErrorMessage(`Must define \`hylo.rootDirectory\` in settings`)
    // }

    // hyloRoot = expandvars(hyloRoot)
    env['HYLO_STDLIB_PATH'] = `${context.extensionPath}/dist/stdlib`
    // serverExe = `${context.extensionPath}/dist/bin/mac/arm64/hylo-lsp-server`
    serverExe = `${context.extensionPath}/dist/bin/hylo-lsp-server`
  }



  wrappedOutput.appendLine(`Hylo root directory: ${hyloRoot}, lsp server executable: ${serverExe}`)

  let transport = TransportKind.pipe

  let executable: Executable = {
    command: serverExe,
    args: [],
    transport: transport,
    options: {
      cwd: hyloRoot,
      env: env
    }
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: executable,
    debug: executable
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      // { scheme: 'file', language: 'hylo' }
      { pattern: '**/*.hylo', }
    ],
    synchronize: {
      // Synchronize the setting section 'languageServerExample' to the server
      configurationSection: 'hylo',
      fileEvents: workspace.createFileSystemWatcher('**/*.hylo')
    },

    outputChannel: wrappedOutput,
    // traceOutputChannel: websocketOutputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Info,
  }

  // Create the language client and start the client.
  let forceDebug = false
  client = new LanguageClient('hylo', 'Hylo LSP Extension', serverOptions, clientOptions, forceDebug)
  client.registerProposedFeatures()
  client.setTrace(Trace.Messages)
  let p = client.start()
  p.catch(reason => {
    wrappedOutput.appendLine(`Client error: ${reason}`)
  })

  p.finally(() => {
    wrappedOutput.appendLine(`Client finally`)
  });
}

export async function activate(context: ExtensionContext) {

  hyloLpsConfig = workspace.getConfiguration('hylo')
  createOutputChannels(isDebug)
  wrappedOutput.appendLine(`Activate LSP client in directory ${context.extensionPath}`)

  registerCommands()

  // await activateSyntax(context)
  await activateBackend(context)
}

function registerCommands() {

  commands.registerCommand('hylo.updateLspServer', async () => {
    await updateLspServer()
  })

  commands.registerCommand('hylo.restartLspServer', async () => {
    await client.restart()
  })

  // commands.registerCommand('hylo.startLspLogStreaming', () => {
  //   const socketPort = workspace.getConfiguration('lspInspector')?.get('port')
  //   // const socketPort = hyloLpsConfig.get('lspLogPort', 7000)
  //   const lspStreamUrl = `ws://localhost:${socketPort}`
  //   wrappedOutput.appendLine(`Begin streaming lsp messages: ${lspStreamUrl}`)
  //   setOutputSocket(new WebSocket(lspStreamUrl))
  // })
}

export function deactivate() {
  if (!client) {
    return undefined
  }

  wrappedOutput.appendLine(`Stop client`)
  return client.stop()
}
