import { OutputChannel, window } from "vscode"
import * as WebSocket from 'ws'

export let defaultOutput: OutputChannel
export let wrappedOutput: OutputChannel
let outputSocket: WebSocket | null = null

export function setOutputSocket(socket: WebSocket) {
  outputSocket = socket
}

export function createOutputChannels(isDebug: boolean) {
  defaultOutput = window.createOutputChannel('Hylo')


  let log = ''
  wrappedOutput = {
    name: 'wrapped',
    // Only append the logs but send them later
    append(value: string) {
      log += value
      // console.log(value)
      defaultOutput.append(value)
    },
    appendLine(value: string) {
      log += value

      defaultOutput.appendLine(value)

      if (isDebug) {
        console.log(log)
      }

      // Don't send logs until WebSocket initialization
      if (outputSocket && outputSocket.readyState === WebSocket.OPEN) {
        outputSocket.send(log)
      }

      log = ''
    },
    replace(value: string) {
      log = value
      // if (isDebug) {
      //     console.log(value)
      // }
      // defaultOutput.appendLine(value)
    },

    clear() { },
    show() { },
    hide() { },
    dispose() { }
  }

}
