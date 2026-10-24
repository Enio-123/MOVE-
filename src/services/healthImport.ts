import { AppleHealthParser, type HealthImport } from '../domain/appleHealth'

/**
 * Abre a exportação do Apple Saúde (export.zip ou export.xml) e lê o XML em fluxo,
 * sem carregar o arquivo inteiro na memória. O .zip é descompactado pelo próprio navegador
 * (DecompressionStream), sem bibliotecas nem envio para servidor.
 */
export async function readAppleHealth(file: File, onProgress?: (fraction: number) => void, sinceDays = 400): Promise<HealthImport> {
  const parser = new AppleHealthParser(Date.now() - sinceDays * 86400000)
  let stream: ReadableStream<Uint8Array>
  let total: number
  if (/\.zip$/i.test(file.name) || (await isZip(file))) {
    const entry = await findZipEntry(file, /(^|\/)export\.xml$/i)
    if (!entry) throw new Error('Não encontrei o export.xml dentro do .zip. Use o arquivo gerado em Saúde > Perfil > Exportar todos os dados de saúde.')
    const raw = file.slice(entry.dataStart, entry.dataStart + entry.compressedSize).stream()
    if (entry.method === 0) stream = raw
    else if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não descompacta arquivos. Extraia o export.xml do .zip e importe o .xml.')
      stream = raw.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
    } else throw new Error('Formato de compressão não suportado. Extraia o export.xml e importe o .xml.')
    total = entry.uncompressedSize || entry.compressedSize * 8
  } else {
    stream = file.stream()
    total = file.size
  }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let read = 0
  let lastReport = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    read += value.byteLength
    parser.feed(decoder.decode(value, { stream: true }))
    if (onProgress && read - lastReport > 2_000_000) {
      lastReport = read
      onProgress(Math.min(0.99, read / total))
      // Cede a vez para a interface atualizar a barra de progresso.
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  parser.feed(decoder.decode())
  onProgress?.(1)
  return parser.result()
}

async function isZip(file: File) {
  const b = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
}

interface ZipEntry {
  method: number
  compressedSize: number
  uncompressedSize: number
  dataStart: number
}

/** Procura uma entrada no diretório central do .zip (inclui ZIP64, comum em exportações grandes). */
async function findZipEntry(file: File, name: RegExp): Promise<ZipEntry | null> {
  const tailSize = Math.min(file.size, 65557 + 20)
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  let cdSize = tail.getUint32(eocd + 12, true)
  let cdOffset = tail.getUint32(eocd + 16, true)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    const loc = eocd - 20
    if (loc >= 0 && tail.getUint32(loc, true) === 0x07064b50) {
      const z64At = Number(tail.getBigUint64(loc + 8, true))
      const z = new DataView(await file.slice(z64At, z64At + 56).arrayBuffer())
      cdSize = Number(z.getBigUint64(40, true))
      cdOffset = Number(z.getBigUint64(48, true))
    }
  }
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer())
  const dec = new TextDecoder()
  let p = 0
  while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
    const method = cd.getUint16(p + 10, true)
    let comp = cd.getUint32(p + 20, true)
    let uncomp = cd.getUint32(p + 24, true)
    const nLen = cd.getUint16(p + 28, true)
    const xLen = cd.getUint16(p + 30, true)
    const cLen = cd.getUint16(p + 32, true)
    let local = cd.getUint32(p + 42, true)
    const fname = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nLen))
    // Campo extra ZIP64 com os tamanhos reais.
    let x = p + 46 + nLen
    const xEnd = x + xLen
    while (x + 4 <= xEnd) {
      const id = cd.getUint16(x, true)
      const size = cd.getUint16(x + 2, true)
      if (id === 0x0001) {
        let q = x + 4
        if (uncomp === 0xffffffff) { uncomp = Number(cd.getBigUint64(q, true)); q += 8 }
        if (comp === 0xffffffff) { comp = Number(cd.getBigUint64(q, true)); q += 8 }
        if (local === 0xffffffff) { local = Number(cd.getBigUint64(q, true)) }
      }
      x += 4 + size
    }
    if (name.test(fname)) {
      const lh = new DataView(await file.slice(local, local + 30).arrayBuffer())
      const dataStart = local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true)
      return { method, compressedSize: comp, uncompressedSize: uncomp, dataStart }
    }
    p += 46 + nLen + xLen + cLen
  }
  return null
}
