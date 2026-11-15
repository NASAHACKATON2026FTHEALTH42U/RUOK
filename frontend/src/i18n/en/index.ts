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
}
