#!/usr/bin/env node
// Genera src/api/types.gen.ts desde el OpenAPI del backend (FS-03).
//
//   npm run gen:api                         → lee el OpenAPI directamente de FastAPI con uv
//                                             (no hace falta arrancar el servidor)
//   OPENAPI_URL=http://192.168.8.10:8000/openapi.json npm run gen:api
//                                           → lo descarga de un servidor en marcha
//
// La CI (job "Contrato API") ejecuta este mismo script y falla si types.gen.ts no coincide.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = resolve(frontendDir, '../backend')
const output = join(frontendDir, 'src/api/types.gen.ts')
const schemaFile = join(mkdtempSync(join(tmpdir(), 'ruok-openapi-')), 'openapi.json')

async function loadSchema() {
  const url = process.env.OPENAPI_URL
  if (url) {
    console.log(`OpenAPI desde ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
    return await res.text()
  }
  console.log('OpenAPI desde backend/app/main.py (uv run)')
  try {
    return execFileSync(
      'uv',
      [
        'run',
        '--quiet',
        'python',
        '-c',
        'import json; from app.main import app; print(json.dumps(app.openapi()))',
      ],
      { cwd: backendDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    )
  } catch (err) {
    console.error(
      '\n✖ No se pudo leer el OpenAPI con uv. ¿Está instalado uv? (ver README raíz)\n' +
        '  Alternativa: arranca el backend y usa OPENAPI_URL=http://localhost:8000/openapi.json',
    )
    throw err
  }
}

writeFileSync(schemaFile, await loadSchema())
execFileSync(
  join(frontendDir, 'node_modules/.bin/openapi-typescript'),
  [schemaFile, '-o', output],
  {
    stdio: 'inherit',
  },
)
console.log(`✔ ${output}`)
