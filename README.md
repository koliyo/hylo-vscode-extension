# Hylo Visual Studio Code Extension

Support for the [Hylo](https://github.com/hylo-lang/hylo) programming language in Visual Studio Code. The actual language analysis is implemented in the [Hylo LSP](https://github.com/koliyo/hylo-lsp) server, and the extension is a pretty thin wrapper around the LSP.

The extension dynamically downloads the most recent version of the Hylo LSP for the current machine OS/architecture.

See [Hylo LSP](https://github.com/koliyo/hylo-lsp) for list of supported LSP features.

## Installation

The extension is not yet published on the VSCode marketplace. To install:

- Download the `.vsix` file from the latest release
- Run `code --install-extension hylo-lang-$VERSION.vsix`

The LSP/extension does currently not work on Windows, this is work in progress.
