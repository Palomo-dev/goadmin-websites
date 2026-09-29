interface FreezeRequestFormProps {
  /** Nombre de la organización, para el mensaje. */
  organizationName?: string
}

/**
 * Congelamiento de la membresía desde el portal: DESACTIVADO con mensaje.
 *
 * El congelamiento lo hace el staff en el ERP (`fn_membresia_congelar`, con permiso
 * `memberships.freeze`). La "solicitud" que antes se enviaba desde aquí insertaba en
 * `membership_freezes` un estado que la base ya no admite y fallaba siempre. Mientras no
 * exista la solicitud en la base (ver /api/memberships/freeze), el botón queda desactivado y
 * se le dice al cliente cómo hacerlo.
 */
export function FreezeRequestForm({ organizationName }: FreezeRequestFormProps) {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby="congelamiento-no-disponible"
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border bg-gray-50 text-gray-400 cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">❄️</span>
          <span className="font-medium text-sm">Solicitar congelamiento</span>
        </div>
        <span className="text-xs">No disponible en línea</span>
      </button>
      <p id="congelamiento-no-disponible" className="text-xs text-gray-500 mt-2">
        Para congelar tu membresía comunícate con el equipo{organizationName ? ` de ${organizationName}` : ''}: lo hacen
        por ti y los días congelados se suman al vencimiento.
      </p>
    </div>
  )
}
