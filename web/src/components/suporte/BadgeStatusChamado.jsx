import { infoStatusChamado } from './statusChamado';

/** Badge de status de chamado - usado pelo lojista (MeusChamados) e pelo Supra Admin (ChamadosSuporte). */
export default function BadgeStatusChamado({ status }) {
  const { rotulo, classes } = infoStatusChamado(status);
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${classes}`}>
      {rotulo}
    </span>
  );
}
