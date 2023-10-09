import * as decompress from 'decompress'
// import decompress from 'decompress'
import fetch from 'node-fetch'
// import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
// import { mkdir, writeFile, readFile, rm } from 'fs/promises'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import * as os from 'os'

import { wrappedOutput, notifyError } from './output-channels'

function getTargetLspFilename(): string {
  switch (os.type()) {
    case 'Darwin': return 'hylo-lsp-server-mac-x64.zip'
    case 'Linux': return 'hylo-lsp-server-linux-x64.zip'
    case 'Windows_NT': return 'hylo-lsp-server-windows-x64.zip'
    default: throw `Unknown os type: ${os.type()}`
  }
}


async function downloadFile(url: string, directory=".") {
  const res = await fetch(url);
  const fileName = path.basename(url);
  const destination = path.resolve(directory, fileName);
  const size = Number(res.headers.get('Content-Length'))
  // wrappedOutput.appendLine(`Download: ${url}, size: ${size/1024} KB, destination: ${destination}`)
  let from_stream = Readable.from(res.body!);
  // let to_stream   = fs.createWriteStream(fileName, { flags: 'wx' });
  let to_stream = fs.createWriteStream(destination);
  let written = 0;
  let progressPercent = 0;
  from_stream.pipe(to_stream)
  from_stream.on('data', data => {
    written += data.length;
    let newPercent = Math.floor(written / size * 100)
    for (let i = progressPercent; i < newPercent; i++) {
      wrappedOutput.append(i % 10 == 0 ? `${i}%` : '.')
    }
    progressPercent = newPercent
    // wrappedOutput.appendLine(`written ${written/1024} of ${size/1024} KB (${(written/size*100).toFixed(2)}%)`);
  });

  // await finished(Readable.from(res.body).pipe(fileStream));
  await finished(to_stream);
  wrappedOutput.appendLine('100%')
}

class VersionData {
  id: number
  name: string
  publishDate: Date

  constructor(id: number, name: string, publishDate: Date) {
    this.id = id
    this.name = name
    this.publishDate = publishDate
  }

  toString(): string {
    return JSON.stringify(this, null, 2)
  }

  equals(v: VersionData | null) {
    return v !== null &&
      this.id === v.id &&
      this.name === v.name &&
      this.publishDate.getTime() === v.publishDate.getTime()
  }

  static fromJsonData(data: any) {
    return new VersionData(data.id, data.name, new Date(data.published_at))
  }
}


function getInstalledVersion(): VersionData | null {
  try {
    const manifestPath = `dist/manifest.json`

    if (!fs.existsSync(manifestPath)) {
      return null
    }

    const jsonString = fs.readFileSync(manifestPath, 'utf-8');
    const data = JSON.parse(jsonString);

    return VersionData.fromJsonData(data)
  }
  catch (error) {
    wrappedOutput.appendLine(`[getInstalledVersion] Exception: ${error}`)
    return null
  }
}

export async function updateLspServer(): Promise<boolean> {
  try {
    const releaseUrl = 'https://api.github.com/repos/koliyo/hylo-lsp/releases/latest'
    const distDirectory = 'dist'
    const lspDirectory = `${distDirectory}/bin`
    const stdlibDirectory = `${distDirectory}/hylo-stdlib`
    const stdlibAssetFilename = 'hylo-stdlib.zip'
    const manifestPath = `${distDirectory}/manifest.json`

    wrappedOutput.appendLine(`Check for new release: ${releaseUrl}`)

    const response = await fetch(releaseUrl)
    const body = await response.text()
    const data = JSON.parse(body)

    const latestVersion = VersionData.fromJsonData(data)
    const localVersion = getInstalledVersion()
    const target = getTargetLspFilename()

    if (latestVersion.equals(localVersion)) {
      wrappedOutput.appendLine(`Installed version is up-to-date: ${localVersion}, LSP target artifact: ${target}`)
      return true
    }

    wrappedOutput.appendLine(`Installation of new LSP release required\nlocal version: ${localVersion}\nlatest version: ${latestVersion}`)

    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    const lspAsset = data.assets.find((a: any) => a.name === target)

    if (!lspAsset) {
      notifyError(`Could not find matching release asset for target: ${target}`)
      return false
    }

    const stdlibAsset = data.assets.find((a: any) => a.name === stdlibAssetFilename)

    if (!stdlibAsset) {
      notifyError(`Could not find stdlib release asset: ${stdlibAssetFilename}`)
      return true
    }

    const lspUrl = lspAsset.browser_download_url
    const stdlibUrl = stdlibAsset.browser_download_url

    const targetLspFilepath = path.resolve(distDirectory, target);
    const targetStdlibFilepath = path.resolve(distDirectory, stdlibAssetFilename);

    // Download release artifacts
    wrappedOutput.appendLine(`Download LSP server: ${lspUrl}`)
    await downloadFile(lspUrl, distDirectory)

    wrappedOutput.appendLine(`Download stdlib: ${stdlibUrl}`)
    await downloadFile(stdlibUrl, distDirectory)


    // Delete outdated local artifacts
    if (fs.existsSync(stdlibDirectory)) {
      wrappedOutput.appendLine(`Delete outdated stdlib: ${stdlibDirectory}`)
      fs.rmSync(stdlibDirectory, { recursive: true, force: true })
    }

    if (fs.existsSync(lspDirectory)) {
      // NOTE: We delete whole directory to not have to deal with naming and windows extension etc
      wrappedOutput.appendLine(`Delete outdated lsp executable in: ${stdlibDirectory}`)
      fs.rmSync(lspDirectory, { recursive: true, force: true })
    }

    if (!fs.existsSync(lspDirectory)) {
      fs.mkdirSync(lspDirectory, { recursive: true });
    }

    // Extract updated artifacts
    wrappedOutput.appendLine(`Unzip LSP archive: ${targetLspFilepath}`)
    await decompress(targetLspFilepath, lspDirectory, { strip: 1 })

    wrappedOutput.appendLine(`Unzip stdlib archive: ${targetStdlibFilepath}`)
    await decompress(targetStdlibFilepath, distDirectory)

    wrappedOutput.appendLine(`Write manifest: ${path.resolve(manifestPath)}`)
    const indentedManifest = JSON.stringify(data, null, '  ')
    fs.writeFileSync(manifestPath, indentedManifest)

    return true
  } catch (error) {
    notifyError(`[updateLspServer] Exception: ${error}`);
    return false
  }
}
