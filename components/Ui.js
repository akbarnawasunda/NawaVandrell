'use client';

/**
 * Primitif form dan tampilan hasil bersama untuk alat-alat Nawa Editor yang baru.
 * Memakai kelas yang sudah ada di globals.css (.label, .input, .textarea, .select, .hint, .feedback)
 * dan kelas tambahan .nv-* dari app/nv-tools.css.
 */

export function Field({ id, label, hint, error, children, className = '' }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`nv-field${className ? ` ${className}` : ''}`}>
      {label ? <label className="label" htmlFor={id}>{label}</label> : null}
      {children({ hintId, errorId, invalid: Boolean(error) })}
      {hint ? <p className="hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="nv-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

export function TextField({ id, label, value, onChange, hint, error, placeholder = '', type = 'text', maxLength, inputMode, autoComplete = 'off', required = false, className = '' }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      {({ hintId, errorId, invalid }) => (
        <input
          id={id}
          className="input"
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function NumberField({ id, label, value, onChange, min = 0, max, suffix, hint, error, className = '' }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      {({ hintId, errorId, invalid }) => (
        <div className="nv-input-affix">
          <input
            id={id}
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            data-min={min}
            data-max={max}
            value={value ?? ''}
            aria-invalid={invalid || undefined}
            aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {suffix ? <span className="nv-affix" aria-hidden="true">{suffix}</span> : null}
        </div>
      )}
    </Field>
  );
}

export function TextAreaField({ id, label, value, onChange, hint, error, rows = 4, placeholder = '', maxLength, className = '' }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      {({ hintId, errorId, invalid }) => (
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          value={value ?? ''}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function SelectField({ id, label, value, onChange, options, hint, error, className = '', disabled = false }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      {({ hintId, errorId, invalid }) => (
        <select
          id={id}
          className="select"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Kotak pemberitahuan. kind: info | ok | warn | bad */
export function Notice({ kind = 'info', title, children, role }) {
  return (
    <div className={`nv-notice is-${kind}`} role={role || (kind === 'bad' ? 'alert' : 'note')}>
      {title ? <strong>{title}</strong> : null}
      {children ? <div className="nv-notice-body">{children}</div> : null}
    </div>
  );
}

/** Daftar pesan validasi. */
export function ErrorList({ errors = [] }) {
  if (!errors.length) return null;
  return (
    <Notice kind="bad" title="Periksa dulu sebelum lanjut">
      <ul className="nv-plain-list">
        {errors.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </Notice>
  );
}

/** Kartu angka hasil hitung. tone: default | strong | danger | warn */
export function Metric({ label, value, tone = 'default', hint }) {
  return (
    <div className={`nv-metric is-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function SectionHead({ id, eyebrow, title, children }) {
  return (
    <div className="nv-section-head">
      {eyebrow ? <p className="nv-eyebrow">{eyebrow}</p> : null}
      <h2 id={id}>{title}</h2>
      {children ? <p className="nv-section-desc">{children}</p> : null}
    </div>
  );
}

/** Pembungkus bagian form. */
export function Section({ labelledBy, children, className = '' }) {
  return (
    <section className={`nv-section${className ? ` ${className}` : ''}`} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
