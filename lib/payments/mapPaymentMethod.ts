/**
 * Mapea el método de pago crudo de una pasarela al código válido en payment_methods.
 * Si no se encuentra un mapeo, devuelve 'cash' como fallback seguro.
 */
export function mapToPaymentMethodCode(rawMethod: string | undefined | null, gateway: string): string {
  if (!rawMethod) {
    // Fallback por pasarela si no hay método crudo
    const gatewayFallbacks: Record<string, string> = {
      mercadopago: 'mp',
      paypal: 'paypal',
      stripe: 'stripe',
      payu: 'payu',
      bold: 'bold_qr',
      wompi: 'wompi',
    };
    return gatewayFallbacks[gateway] || 'cash';
  }

  const method = rawMethod.toLowerCase().trim();

  // Mapeo directo (ya son códigos válidos)
  const directMatch: Record<string, string> = {
    cash: 'cash',
    card: 'card',
    transfer: 'transfer',
    credit: 'credit',
    check: 'check',
    nequi: 'nequi',
    daviplata: 'daviplata',
    pse: 'pse',
    wompi: 'wompi',
    'wompi_co': 'wompi',
    paypal: 'paypal',
    payu: 'payu',
    stripe: 'stripe',
    spei: 'spei',
    oxxo: 'oxxo',
    cashapp: 'cashapp',
    venmo: 'venmo',
    zelle: 'zelle',
  };

  if (directMatch[method]) return directMatch[method];

  // Mapeos específicos de pasarelas
  const gatewayMappings: Record<string, Record<string, string>> = {
    mercadopago: {
      mercadopago: 'mp',
      mp: 'mp',
      credit_card: 'card',
      debit_card: 'card',
      bank_transfer: 'transfer',
      ticket: 'cash',
      atm: 'cash',
    },
    wompi: {
      card: 'card',
      nequi: 'nequi',
      pse: 'pse',
      daviplata: 'daviplata',
      bancolombia_transfer: 'transfer',
      bancolombia_collect: 'transfer',
      bancolombia_qr: 'bancolombia_qr',
    },
    bold: {
      card: 'bold_card',
      link: 'bold_link',
      qr: 'bold_qr',
      bold_card: 'bold_card',
      bold_link: 'bold_link',
      bold_qr: 'bold_qr',
    },
    stripe: {
      card: 'card',
      ach: 'transfer',
      bank_transfer: 'transfer',
      cashapp: 'cashapp',
      venmo: 'venmo',
    },
    paypal: {
      paypal: 'paypal',
      card: 'card',
      venmo: 'venmo',
    },
    payu: {
      payu: 'payu',
      card: 'card',
      pse: 'pse',
      bank_transfer: 'transfer',
      efectivo: 'cash',
      cash: 'cash',
    },
  };

  const gatewayMap = gatewayMappings[gateway];
  if (gatewayMap && gatewayMap[method]) return gatewayMap[method];

  // Fallback por pasarela
  const gatewayFallbacks: Record<string, string> = {
    mercadopago: 'mp',
    paypal: 'paypal',
    stripe: 'stripe',
    payu: 'payu',
    bold: 'bold_qr',
    wompi: 'wompi',
  };
  return gatewayFallbacks[gateway] || 'cash';
}
