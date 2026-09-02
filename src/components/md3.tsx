import {
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

/* ---------------- Icona ---------------- */

export function Icona({
  nome,
  className = '',
  style,
}: {
  nome: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`material-symbols-rounded ${className}`} style={style} aria-hidden="true">
      {nome}
    </span>
  );
}

/* ---------------- Bottone ---------------- */

type VarianteBottone = 'filled' | 'tonal' | 'elevated' | 'outlined' | 'text' | 'danger';

interface PropsBottone extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBottone;
  icona?: string;
  larghezzaPiena?: boolean;
}

export function Bottone({
  variante = 'filled',
  icona,
  larghezzaPiena,
  children,
  className = '',
  type = 'button',
  ...resto
}: PropsBottone) {
  return (
    <button
      type={type}
      className={`md-button md-button--${variante} ${larghezzaPiena ? 'md-button--full' : ''} ${className}`}
      {...resto}
    >
      {icona && <Icona nome={icona} />}
      {children}
    </button>
  );
}

/* ---------------- Icon button ---------------- */

interface PropsIconBottone extends ButtonHTMLAttributes<HTMLButtonElement> {
  icona: string;
  variante?: 'standard' | 'filled' | 'tonal' | 'error';
  piccolo?: boolean;
  etichetta: string;
}

export function IconBottone({
  icona,
  variante = 'standard',
  piccolo,
  etichetta,
  className = '',
  type = 'button',
  ...resto
}: PropsIconBottone) {
  return (
    <button
      type={type}
      aria-label={etichetta}
      title={etichetta}
      className={`md-icon-button ${variante !== 'standard' ? `md-icon-button--${variante}` : ''} ${
        piccolo ? 'md-icon-button--small' : ''
      } ${className}`}
      {...resto}
    >
      <Icona nome={icona} />
    </button>
  );
}

/* ---------------- Campo di testo ---------------- */

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etichetta: string;
  supporto?: string;
  errore?: string;
  trailing?: ReactNode;
}

export function Campo({ etichetta, supporto, errore, trailing, id, className = '', ...resto }: PropsCampo) {
  const identificativo = id ?? `campo-${etichetta.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={`md-field ${errore ? 'md-field--error' : ''} ${className}`}>
      <input id={identificativo} className="md-field__input" placeholder=" " {...resto} />
      <label className="md-field__label" htmlFor={identificativo}>
        {etichetta}
      </label>
      {trailing && <div className="md-field__trailing">{trailing}</div>}
      {(errore || supporto) && <span className="md-field__supporting">{errore ?? supporto}</span>}
    </div>
  );
}

interface PropsSelezione extends SelectHTMLAttributes<HTMLSelectElement> {
  etichetta: string;
  supporto?: string;
  errore?: string;
}

export function Selezione({ etichetta, supporto, errore, id, children, className = '', ...resto }: PropsSelezione) {
  const identificativo = id ?? `select-${etichetta.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={`md-field ${errore ? 'md-field--error' : ''} ${className}`}>
      <select id={identificativo} className="md-field__select" {...resto}>
        {children}
      </select>
      <label className="md-field__label" htmlFor={identificativo}>
        {etichetta}
      </label>
      {(errore || supporto) && <span className="md-field__supporting">{errore ?? supporto}</span>}
    </div>
  );
}

/* ---------------- Banner d'errore (rosso a due tonalita') ---------------- */

export function BannerErrore({ testo }: { testo: string }) {
  return (
    <div className="md-error-banner" role="alert">
      <Icona nome="error" />
      <span>{testo}</span>
    </div>
  );
}

/* ---------------- Dialog ---------------- */

interface PropsDialog {
  aperto: boolean;
  titolo: string;
  descrizione?: string;
  onChiudi: () => void;
  azioni?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ aperto, titolo, descrizione, onChiudi, azioni, children }: PropsDialog) {
  useEffect(() => {
    if (!aperto) return;
    const allaPressione = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', allaPressione);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', allaPressione);
      document.body.style.overflow = '';
    };
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  return (
    <div
      className="md-scrim"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onChiudi();
      }}
    >
      <div className="md-dialog" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="md-dialog__header">
          <h2 className="md-dialog__headline md-headline-small">{titolo}</h2>
          {descrizione && <p className="md-dialog__supporting md-body-medium">{descrizione}</p>}
        </div>
        <div className="md-dialog__content">{children}</div>
        {azioni && <div className="md-dialog__actions">{azioni}</div>}
      </div>
    </div>
  );
}

/* ---------------- Caricamento ---------------- */

export function Caricamento({ testo = 'Caricamento in corso...' }: { testo?: string }) {
  return (
    <div className="md-center-screen">
      <div className="md-spinner" />
      <p className="md-body-medium">{testo}</p>
    </div>
  );
}

/* ---------------- Stato vuoto ---------------- */

export function StatoVuoto({ icona, titolo, testo }: { icona: string; titolo: string; testo?: string }) {
  return (
    <div className="md-empty">
      <Icona nome={icona} />
      <p className="md-title-small" style={{ margin: 0 }}>
        {titolo}
      </p>
      {testo && <p className="md-body-small" style={{ margin: 0 }}>{testo}</p>}
    </div>
  );
}

/* ---------------- Chip tipologia ---------------- */

export function ChipTipologia({ tipologia }: { tipologia: string }) {
  return <span className={`md-chip md-chip--${tipologia}`}>{tipologia}</span>;
}
