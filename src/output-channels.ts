import { OutputChannel, window } from "vscode"

export let defaultOutput: OutputChannel
export let wrappedOutput: OutputChannel

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

export function notifyError(message: string) {
  wrappedOutput.appendLine(message)
  window.showErrorMessage(message)
}
