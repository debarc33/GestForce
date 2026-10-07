\
'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * GestForce — Centro de ayuda (icono "?" del Header)
 *
 * Antes era un icono sin ninguna funcion detras. El usuario pidio preguntas
 * y respuestas sobre el uso del software, y menciono el manual de usuario.
 *
 * Esta primera version cubre las preguntas mas frecuentes del dia a dia,
 * escritas a partir del comportamiento real de la app (no son genericas).
 * El manual de usuario completo (Word) es un documento aparte, generado en
 * una sesion anterior (ver claude/manual-usuario-nota.md en el proyecto) —
 * no esta incluido aqui todavia porque adjuntarlo como descarga dentro de
 * la app es un paso adicional (hay que decidir donde vive el archivo).
 *
 * Para agregar o editar preguntas mas adelante, solo hay que tocar el
 * arreglo FAQ de abajo — no hace falta cambiar nada mas del componente.
 */

interface FaqItem {
  q: string
  a: string
}
interface FaqSection {
  title: string
  items: FaqItem[]
}

const FAQ: FaqSection[] = [
  {
    title: 'Primeros pasos',
    items: [
      {
        q: '¿Cómo cambio de empresa activa?',
        a: 'Haz clic en el nombre de la empresa, en la parte superior del menú lateral (o en la barra superior en celular). Si tu usuario tiene acceso a más de una empresa, ahí puedes elegir cuál ver.',
      },
      {
        q: '¿Cómo cambio entre modo claro y oscuro?',
        a: 'Con el ícono de sol/luna de la barra superior, o desde Configuración → Apariencia. Los dos quedan sincronizados.',
      },
    ],
  },
  {
    title: 'Ventas',
    items: [
      {
        q: '¿Cómo convierto una cotización en factura?',
        a: 'Desde la lista de Cotizaciones, abre la cotización aprobada y usa la opción para generar la factura — queda enlazada a la cotización original.',
      },
      {
        q: '¿Cómo envío una cotización o factura por correo?',
        a: 'Con el botón "Enviar" (o "Reenviar") de la lista, o desde el visor del documento. El PDF se adjunta automáticamente, no hace falta descargarlo ni adjuntarlo a mano.',
      },
      {
        q: '¿Qué significan los estados de una factura?',
        a: '"Borrador" es un documento interno sin confirmar; "Emitida" ya se formalizó con el cliente; "Anulada" quedó sin efecto. Solo las emitidas cuentan en la tarjeta de Facturación del Tablero.',
      },
      {
        q: '¿Cómo registro el pago de una factura?',
        a: 'Al emitir una factura se crea automáticamente un recibo sin pagar. Para registrar un abono o el pago completo, ve a Recibos, selecciona el recibo correspondiente y anota cuánto está pagando el cliente — el saldo se actualiza solo.',
      },
    ],
  },
  {
    title: 'Compras e inventario',
    items: [
      {
        q: '¿Las compras actualizan el inventario automáticamente?',
        a: 'Sí — al registrar una compra, el stock de los productos se actualiza solo, sin necesidad de un ajuste manual aparte.',
      },
      {
        q: '¿Qué significa que un producto esté "Para reordenar"?',
        a: 'Que tiene un stock mínimo configurado y las existencias ya llegaron o bajaron de ese número. Es la misma alerta que aparece en la campanita de notificaciones.',
      },
    ],
  },
  {
    title: 'Equipo y usuarios',
    items: [
      {
        q: '¿Cómo invito a alguien nuevo a mi empresa?',
        a: 'En Configuración → Equipo, con el botón de invitar usuario. La empresa debe tener al menos un Admin registrado antes de poder agregar usuarios con otros roles.',
      },
      {
        q: '¿Qué diferencia hay entre los roles de usuario?',
        a: 'Administrador tiene acceso completo; Contador ve lo financiero/contable; Vendedor opera Ventas, Compras e Inventario; Solo lectura puede consultar pero no editar.',
      },
    ],
  },
  {
    title: 'Suscripción y pagos',
    items: [
      {
        q: '¿Dónde cambio mi plan o el período de mi suscripción?',
        a: 'En Configuración → Suscripción, eligiendo el plan según los módulos que necesites y el período (3, 6 o 12 meses).',
      },
      {
        q: '¿Cómo compro facturas electrónicas DIAN?',
        a: 'Desde la misma pantalla de Suscripción, en la sección de facturación electrónica. Es una compra única, aparte de la suscripción, que incluye la habilitación de tu empresa ante la DIAN.',
      },
    ],
  },
]

export function HelpCenter() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Centro de ayuda"
        className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-[620px] gap-0 overflow-hidden rounded-2xl border-[var(--glass-border-strong)] bg-card/85 shadow-[var(--shadow-pop)]">
          <DialogHeader className="px-5 py-4 border-b border-[var(--glass-border)]">
            <DialogTitle>Centro de ayuda</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-6">
            {FAQ.map((section) => (
              <div key={section.title}>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60">
                  {section.title}
                </h3>
                <div className="space-y-3.5">
                  {section.items.map((item) => (
                    <div key={item.q}>
                      <p className="text-[13px] font-medium text-foreground">{item.q}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--glass-border)] bg-background/20 px-5 py-3 text-[11px] text-muted-foreground">
            ¿No encuentras lo que buscas? Escríbele a tu equipo de soporte.
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
