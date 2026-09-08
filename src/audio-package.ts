// ZIP STORE: MP3 is already compressed. UTF-8 names and CRC32 make this
// readable by ordinary archive tools without adding a runtime dependency.
export async function makeAudioZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  if (files.length > 65535) throw new Error('音檔數量超過 ZIP 上限')
  const parts: BlobPart[] = []
  const directory: BlobPart[] = []
  let offset = 0
  let directorySize = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const bytes = new Uint8Array(await file.blob.arrayBuffer())
    if (offset + bytes.length + name.length + 30 > 0xffffffff) throw new Error('音檔包超過 4 GB，請拆分腳本')
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = new Uint8Array(30)
    const h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x800, true)
    h.setUint16(12, 33, true)
    h.setUint32(14, crc, true)
    h.setUint32(18, bytes.length, true)
    h.setUint32(22, bytes.length, true)
    h.setUint16(26, name.length, true)
    parts.push(header, name, file.blob)
    const central = new Uint8Array(46)
    const c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x800, true)
    c.setUint16(14, 33, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, bytes.length, true)
    c.setUint32(24, bytes.length, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    directory.push(central, name)
    directorySize += central.length + name.length
    offset += header.length + name.length + bytes.length
  }
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, files.length, true)
  e.setUint16(10, files.length, true)
  e.setUint32(12, directorySize, true)
  e.setUint32(16, offset, true)
  return new Blob([...parts, ...directory, end], { type: 'application/zip' })
}
