import { cog_bart } from './cog_bart'
import { cog_digits } from './cog_digits'
import { cog_emotion } from './cog_emotion'
import { cog_line } from './cog_line'
import { cog_matrix } from './cog_matrix'
import { cognition } from './cognition'
import { alerts } from './alerts'
import { behavioral } from './behavioral'
import { control } from './control'
import { dashboard } from './dashboard'
import { game } from './game'
import { measure } from './measure'
import { shell } from './shell'

/**
 * Diccionario español → inglés de la interfaz (FE-38), un fichero por área para poder traducir
 * en paralelo sin pisarse. Si dos áreas traducen el mismo texto, gana la última de esta lista.
 */
export const EN: Record<string, string> = {
  ...shell,
  ...dashboard,
  ...measure,
  ...alerts,
  ...behavioral,
  ...game,
  ...control,
  ...cog_bart,
  ...cog_digits,
  ...cog_emotion,
  ...cog_line,
  ...cog_matrix,
  ...cognition,
}
