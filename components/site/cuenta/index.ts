/** Acceso a la cuenta de la tienda (Figma «16 Sitio web» 2834:68670). */
export { AccesoCuenta, EnlaceAccesoMenu, EnlaceCuenta, formatoAcceso, type FormatoAcceso } from './AccesoCuenta'
export { abrirAccesoCuenta, alTocarEnlaceCuenta, alTocarIngresarCheckout, alTocarIniciarSesion, useAccesoAbierto, EVENTO_ABRIR_ACCESO, EVENTO_ACCESO_ENTRO } from './eventos'
/** Regla única del acceso (modo × pantalla) y el «Iniciar sesión» que vuelve a donde estaba. */
export { CONSULTA_CELULAR, rutaIniciarSesion } from './reglaAcceso'
export { EnlaceIniciarSesion } from './EnlaceIniciarSesion'
/** Avatar de la cabecera con sesión y su menú (Figma «16 Sitio web» 3044:78726). */
export { AvatarCabecera, BotonAvatarCuenta, CuentaConAvatar, type BotonAvatarCuentaProps } from './avatar/BotonAvatarCuenta'
export { MenuAvatar, type MenuAvatarProps } from './avatar/MenuAvatar'
/** «Cuenta» de los menús inferiores con el avatar (Figma «16 Sitio web» 3054:80142). */
export { AvatarMenuInferior, TAM_AVATAR_MENU_INFERIOR, useEtiquetaCuenta, useHojaCuentaMenu } from './avatar/CuentaMenuInferior'
