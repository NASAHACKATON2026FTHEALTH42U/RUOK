import { PagePlaceholder } from '../components/ui/PagePlaceholder'
import { capitalize, useVocab } from '../environments/useVocab'

export default function Dashboard() {
  const { member } = useVocab()
  return <PagePlaceholder title={`${capitalize(member)}: tu panel de salud`} issue="FE-07" />
}
