/**
 * FASE 10.1 — Provider de reseñas generadas.
 *
 * Extraído TAL CUAL de components/site/ProductReviews.tsx (líneas 8-445).
 * No se reescribió la lógica de seededRandom ni generateReviews.
 *
 * Este provider replica exactamente el comportamiento actual: genera
 * reseñas deterministas en el cliente a partir de productId + sessionSeed.
 */

import { getSessionSeed, getReviewStats } from '@/lib/review-utils'
import type { ReviewItem, ReviewsResult, ReviewsConfig } from '../types'


// Nombres colombianos para generar reviews fake
const FIRST_NAMES = [
  'María', 'Juan', 'Carlos', 'Andrea', 'Luis', 'Diana', 'Jorge', 'Camila', 'Andrés', 'Laura',
  'Santiago', 'Valentina', 'Sebastián', 'Daniela', 'Alejandro', 'Paula', 'David', 'Natalia', 'Daniel', 'Carolina',
  'Felipe', 'Juliana', 'Nicolás', 'Marcela', 'Cristian', 'Ángela', 'Diego', 'Paola', 'Fernando', 'Mónica',
  'Sergio', 'Adriana', 'Miguel', 'Sandra', 'Javier', 'Lorena', 'Óscar', 'Tatiana', 'Ricardo', 'Isabel',
  'Gustavo', 'Lina', 'Mauricio', 'Claudia', 'César', 'Viviana', 'Rafael', 'Jennifer', 'Iván', 'Yuliana',
  'Hernán', 'Milena', 'Fabián', 'Gloria', 'Wilmer', 'Esperanza', 'Jhon', 'Leidy', 'Brayan', 'Karol',
  'Estiven', 'Yesenia', 'Harold', 'Mariana', 'Robinson', 'Catalina', 'Yeison', 'Manuela', 'Edwin', 'Luisa',
  'Andrea', 'Stefanía', 'Nelson', 'Claudia', 'Mario', 'Patricia', 'Gabriel', 'Lucía', 'Álvaro', 'Rosa',
  'Édgar', 'Margarita', 'Augusto', 'Pilar', 'Héctor', 'Carmenza', 'Alfonso', 'Beatriz', 'Ramiro', 'Nancy',
  'Orlando', 'Miriam', 'Francisco', 'Socorro', 'Jairo', 'Amparo', 'Rubén', 'Gladys', 'Armando', 'Consuelo',
  'Eduardo', 'Doris', 'Alirio', 'Martha', 'Wilson', 'Eliana', 'Dairo', 'Adriana', 'Hugo', 'Tatiana',
  'Néstor', 'Angélica', 'Gerardo', 'Liliana', 'René', 'Ximena', 'Omar', 'Daniela', 'Fredy', 'Carolina',
  'Jesús', 'Mayerly', 'Alberto', 'Shirley', 'Roberto', 'Kelly', 'Enrique', 'Luz', 'Víctor', 'Nubia'
]

const LAST_NAMES = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez',
  'Romero', 'Ruiz', 'Torres', 'Ramírez', 'Flores', 'Restrepo', 'Ospina', 'Vargas', 'Castaño', 'Giraldo',
  'Ríos', 'Mejía', 'Cardona', 'Sánchez', 'Pérez', 'Gómez', 'Jiménez', 'Castro', 'Ortiz', 'Valencia',
  'Zapata', 'Quintero', 'Duque', 'Parra', 'Henao', 'Marín', 'Bedoya', 'Arango', 'Cárdenas', 'Salazar',
  'Gutiérrez', 'Montoya', 'Vélez', 'Londoño', 'Ochoa', 'Rojas', 'Medina', 'Suárez', 'Herrera', 'Pineda',
  'Acosta', 'Aguilar', 'Arenas', 'Blanco', 'Caballero', 'Calderón', 'Camargo', 'Cano', 'Carvajal', 'Contreras',
  'Cortés', 'Cruz', 'Escobar', 'Espinoza', 'Figueroa', 'Fonseca', 'Fuentes', 'Gallego', 'Gil', 'Guerrero',
  'Guzmán', 'Hoyos', 'Ibarra', 'Jaramillo', 'Lara', 'León', 'Lozano', 'Maldonado', 'Mendoza', 'Miranda',
  'Molina', 'Morales', 'Navarro', 'Nieto', 'Obando', 'Páez', 'Patiño', 'Pava', 'Peláez', 'Pérez',
  'Pulido', 'Ramos', 'Reyes', 'Rivera', 'Rodríguez', 'Salas', 'Sandoval', 'Silva', 'Solís', 'Soto',
  'Tabares', 'Téllez', 'Triana', 'Uribe', 'Velásquez', 'Villa', 'Yate', 'Zambrano', 'Zuluaga', 'Bautista'
]

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales',
  'Santa Marta', 'Ibagué', 'Villavicencio', 'Neiva', 'Armenia', 'Pasto', 'Montería', 'Cúcuta',
  'Valledupar', 'Sincelejo', 'Popayán', 'Tunja', 'Riohacha', 'Florencia', 'Quibdó', 'Yopal',
  'Mocoa', 'Leticia', 'San Andrés', 'Arauca', 'Envigado', 'Bello', 'Itagüí', 'Sabaneta',
  'Rionegro', 'Soacha', 'Chía', 'Zipaquirá', 'Fusagasugá', 'Girardot', 'Tuluá', 'Palmira',
  'Buenaventura', 'Barrancabermeja', 'Sogamoso', 'Duitama', 'Girón', 'Piedecuesta', 'Soledad',
  'Malambo', 'Dosquebradas', 'Apartadó', 'Turbo', 'Lorica', 'Magangué', 'Aguachica', 'Ocaña'
]

const POSITIVE_COMMENTS = [
  'Excelente producto, superó mis expectativas. Lo recomiendo al 100%.',
  'Muy buena calidad, llegó antes de lo esperado. Muy satisfecho con la compra.',
  'Increíble relación calidad-precio. Ya es mi segunda compra aquí.',
  'El producto es exactamente como se ve en las fotos. Muy contento.',
  'Perfecto para lo que necesitaba. El envío fue rapidísimo.',
  'Calidad premium, se nota que es original. Totalmente recomendado.',
  'Me encantó, ya lo recomendé a mis amigos y familia.',
  'Buen producto, buen precio, buen servicio. ¿Qué más se puede pedir?',
  'Llegó en perfectas condiciones. El empaque es muy bueno.',
  'Definitivamente volvería a comprar. Excelente experiencia.',
  'Muy bueno, cumple con lo prometido. Feliz con mi compra.',
  'La mejor compra que he hecho últimamente. Super recomendado.',
  'Producto de primera, no me arrepiento ni un poco.',
  'Todo perfecto, desde el pedido hasta la entrega. 5 estrellas.',
  'Quedé muy satisfecho, la calidad es impresionante.',
  'Muy buena atención al cliente, el producto llegó en tiempo récord.',
  'Es tal cual se describe, excelente acabado y materiales.',
  'Compré para regalo y la persona quedó encantada. Volveré a comprar.',
  'Increíble, no pensé que fuera tan bueno por ese precio.',
  'Llevaba tiempo buscando algo así, por fin lo encontré. Perfecto.',
  'Super cómodo y de excelente calidad. Lo uso todos los días.',
  'El mejor que he probado, sin duda. Vale cada peso.',
  'Rápido, seguro y el producto es de altísima calidad.',
  'Me sorprendió gratamente, mucho mejor de lo que esperaba.',
  'Ya van 3 meses usándolo y sigue como nuevo. Excelente durabilidad.',
  'Lo compré por las buenas opiniones y confirmo que son ciertas.',
  'Producto auténtico, se nota la calidad. Muy recomendado.',
  'Llegó antes de la fecha estimada y en perfectas condiciones.',
  'Excelente compra, mi familia también quiere uno igual.',
  'La calidad es superior a productos similares que he probado.',
  'Muy satisfecho, el producto funciona perfectamente.',
  'Excelente acabado, se nota que es de buena calidad.',
  'Llegó muy rápido, el producto es excelente.',
  'Recomendado 100%, vale la pena.',
  'El producto es genial, lo uso constantemente.',
  'Muy buena compra, superó mis expectativas.',
  'Calidad excelente, envío rápido. Todo perfecto.',
  'Lo compré para mí y me encantó. Excelente.',
  'El mejor producto de su categoría. Muy bueno.',
  'Increíble calidad, superó todas mis expectativas.',
  'Muy bien hecho, los materiales son excelentes.',
  'Llegó en tiempo y forma, producto excelente.',
  'Estoy muy feliz con esta compra. Lo recomiendo.',
  'El producto es de muy buena calidad, duradero.',
  'Excelente servicio y producto de primera.',
  'Muy contento, vale cada centavo pagado.',
  'El diseño es hermoso y la calidad impecable.',
  'Sin dudas, una de mis mejores compras.',
  'Producto excelente, la calidad es inmejorable.',
  'Muy buena experiencia de compra, repetiré seguro.',
  'El producto es increíble, lo amo totalmente.',
  'Llegó rápido y en perfectas condiciones. 10/10.',
  'Calidad superior, se nota que es original.',
  'Muy feliz con mi compra, lo recomiendo mucho.',
  'El producto es perfecto, exactamente lo que quería.',
  'Excelente relación calidad-precio. Muy satisfecho.',
  'Todo fue perfecto, desde el pedido hasta la entrega.',
  'Muy buena calidad, el producto es duradero.',
  'Excelente, cumple con todo lo prometido.',
  'Llegó en perfecto estado, muy buena calidad.',
  'Estoy muy satisfecho, lo recomiendo ampliamente.',
  'El producto es excelente, muy buena inversión.',
  'Calidad premium, se nota en cada detalle.',
  'Muy buen producto, envío rápido y seguro.',
  'Lo recomiendo al 100%, excelente calidad.',
  'Perfecto, justo lo que necesitaba.',
  'Súper recomendado, mis amigos también lo compraron.',
  'Excelente producto, llegó rapidísimo a mi casa.',
  'Muy buena calidad, super contenta con mi compra.',
  'No me arrepiento, vale cada peso que pagué.',
  'Llegó antes de lo esperado, excelente servicio.',
  'El producto es incluso mejor de lo que se ve en la foto.',
  'Compré dos y ambos perfectos, muy buena calidad.',
  'Mi familia quedó encantada, todos quieren uno.',
  'Es exactamente lo que estaba buscando, gracias.',
  'La calidad es impresionante, se nota que es original.',
  'Muy buen empaque, llegó en perfectas condiciones.',
  'Lo recomiendo a todos, excelente relación calidad-precio.',
  'Súper feliz con mi compra, definitivamente volveré.',
  'El mejor producto que he comprado online, sin duda.',
  'Funciona perfecto, lo uso a diario y sin problemas.',
  'Me llegó rapidísimo y en perfecto estado, gracias.',
  'Es de muy buena calidad, se siente duradero.',
  'Compré para regalar y fue un éxito total.',
  'Ya es la tercera vez que compro aquí, siempre excelente.',
  'El producto superó todas mis expectativas, increíble.',
  'Muy contento, la verdad me sorprendió lo bueno que es.',
  'Llegó en tiempo récord, excelente atención.',
  'Lo uso todos los días y sigue como nuevo, muy duradero.',
  'Es justo como lo describen, sin engaños. Recomendado.',
  'La mejor relación calidad-precio que he encontrado.',
  'Súper práctico y de excelente calidad, lo amo.',
  'Me encantó el diseño y la calidad es top.',
  'Excelente, ya lo recomendé a todos mis conocidos.',
  'Muy buena experiencia, el producto es tal cual se describe.',
  'Quedé sorprendida con la calidad, super recomendado.',
  'Llegó rápido, bien empacado y funciona perfecto.',
  'Sin duda la mejor compra del año para mí.',
  'El producto es hermoso y de muy buena calidad.',
  'Muy satisfecha, llegó antes de lo prometido.',
  'Es la segunda vez que lo compro y sigue siendo excelente.',
  'Lo recomiendo totalmente, no se arrepentirán.',
  'Calidad excelente, se nota el cuidado en cada detalle.',
  'Mi mejor compra online hasta ahora, todo perfecto.',
  'Increíble producto, funciona mejor de lo que esperaba.',
  'Muy bien terminado, los materiales son de primera.',
  'Llegó a tiempo y en perfectas condiciones, excelente.',
  'Lo compré con dudas y me llevé una grata sorpresa.',
  'Es justo lo que necesitaba, no puedo estar más feliz.',
  'Superó mis expectativas, la calidad es impresionante.',
  'Muy buena compra, ya quiero pedir otro color.',
  'El servicio fue excelente y el producto increíble.',
  'Lo amo, es perfecto para lo que lo necesitaba.',
  'Muy contento, cumplió con todo lo prometido y más.',
  'Es de excelente calidad, lo noto muy duradero.',
  'Recomendadísimo, mis amigos ya lo quieren comprar también.',
  'Llegó rapidísimo y funciona perfecto, 10/10.',
  'La mejor inversión que he hecho, lo uso a diario.',
  'Excelente producto, no tengo ninguna queja.',
  'Muy feliz, es justo lo que se ve en las fotos.',
  'Se nota que es de calidad, los materiales son excelentes.',
  'Todo llegó perfecto, muy buena atención al cliente.',
  'Es mejor de lo que esperaba, súper recomendado.',
  'Compré para mi mamá y le fascinó, excelente regalo.',
  'Muy buen producto, ya es mi tienda de confianza.',
  'Increíble, la calidad supera al precio. Lo recomiendo.',
  'Llegó en perfecto estado y antes de lo estimado. Top.',
  'Es una maravilla, no sé cómo no lo compré antes.',
  'Súper contento, funciona mejor que otros más caros.',
  'La verdad me sorprendió, excelente relación calidad-precio.',
  'Muy buena compra, sin duda volveré a pedir aquí.',
  'Es perfecto, llegó rápido y en excelente estado.',
  'Lo recomiendo al 1000%, superó mis expectativas.',
  'Muy bien empacado, producto de excelente calidad.',
  'Es la mejor compra que he hecho este año.',
  'Increíble producto, vale cada centavo. Recomendado.',
  'Llegó rapidísimo, todo en perfectas condiciones. Excelente.',
  'Muy satisfecho con la calidad y el servicio. 5 estrellas.',
  'Es justo lo que prometen, no me decepcionó nada.',
  'Súper recomendado, ya lo compré dos veces y siempre bien.',
  'Excelente, mi familia también quiere uno igual ahora.',
  'Muy contenta, el producto es hermoso y funcional.',
  'Lo uso constantemente y sigue perfecto. Muy duradero.',
  'La calidad es excelente, se siente premium al tacto.',
  'Todo perfecto, desde la compra hasta la entrega. Top.',
  'Me fascinó, es mejor de lo que muestra la foto.',
  'Súper práctico, llegó rápido y funciona de maravilla.',
  'Excelente producto, lo recomiendo con los ojos cerrados.',
  'Muy buena calidad, no pensé que fuera tan bueno por el precio.',
  'Es justo lo que buscaba, llegó en tiempo récord. Gracias.',
  'Increíble, la calidad me dejó sin palabras. Recomendado.',
  'Todo llegó perfecto, muy contenta con mi compra.',
  'Súper bien empacado, el producto es de primera calidad.',
  'Lo recomiendo totalmente, es mejor que otros que probé.',
  'Muy feliz, funciona perfecto y se ve hermoso. 10/10.',
  'Excelente, ya es mi segunda compra y siempre todo bien.',
  'La mejor compra online, sin duda volveré. Recomendado.',
  'Súper contento, el producto es tal cual se describe. Top.',
  'Muy buena inversión, la calidad es superior. Lo amo.',
  'Llegó antes de lo esperado y en perfectas condiciones. Genial.',
  'Es increíble, superó mis expectativas. 100% recomendado.',
  'Muy satisfecho, el acabado es impecable. Vale la pena.',
  'Súper recomendado, mis compañeros de trabajo también lo quieren.',
  'Excelente producto, llegó rápido y funciona perfecto. Top.',
  'Lo amo, es justo lo que necesitaba. Muy buena calidad.',
  'Muy contenta, el servicio fue excelente. Volveré a comprar.',
  'Es de lo mejor que he comprado, sin duda lo recomiendo.',
  'Súper bien, la calidad es impresionante. 5 estrellas merecidas.',
  'Increíble, llegó rapidísimo y funciona mejor de lo esperado.',
  'Muy feliz con mi compra, es perfecto. Gracias por todo.',
  'Excelente, todo tal cual se describe. Muy recomendado.',
  'Lo recomiendo al 100%, es una compra que no te arrepentirás.',
  'Súper contento, el producto es de altísima calidad. Top top.',
  'Muy buena experiencia, el envío fue rapidísimo. Excelente.',
  'Es mejor que los de marcas más caras. Súper recomendado.',
  'Llegó en perfecto estado, muy bien empacado. 10/10.',
  'Increíble calidad por ese precio, lo recomiendo totalmente.',
  'Muy satisfecha, es justo lo que quería. Gracias.',
  'Súper feliz, el producto es excelente y llegó rapidísimo.',
  'Todo perfecto, no tengo ninguna queja. 5 estrellas.',
  'Es una compra que vale cada peso. Muy recomendado.',
  'Lo uso a diario y funciona perfecto. Súper duradero.',
  'Muy contento, la calidad es muy superior a lo esperado.',
  'Súper bien, ya lo recomendé a toda mi familia. Excelente.',
  'Increíble, es mejor que el anterior que tenía. Lo amo.',
  'Llegó rápido y en perfectas condiciones. Muy contento.',
  'Muy buena compra, el producto es de primera. Recomendado.',
  'Es justo lo que prometen, sin engaños. Muy bueno.',
  'Súper recomendado, la calidad es excelente. 10/10.',
  'Lo compré con dudas y me encantó. Sin arrepentimientos.',
  'Muy feliz, funciona mejor de lo que esperaba. Top.',
  'Excelente producto, el envío fue rapidísimo. Lo recomiendo.',
  'Súper contenta, es hermoso y de muy buena calidad. Lo amo.',
  'Todo llegó perfecto, muy buena atención. 5 estrellas.',
  'Es la mejor compra que he hecho. Súper recomendado.',
  'Muy bien, superó mis expectativas. Vale cada centavo.',
  'Increíble, la calidad es top. Ya quiero comprar otro.',
  'Súper feliz con mi compra, llegó antes de lo esperado. Top.',
  'Lo recomiendo, es excelente y llegó en perfecto estado.',
  'Muy contento, el producto es duradero y funciona genial.',
  'Es mejor de lo que se ve en la foto. Súper recomendado.',
  'Todo perfecto, desde el pedido hasta la entrega. 10/10.',
  'Súper bien, la relación calidad-precio es increíble. Lo amo.',
  'Muy satisfecha, es justo lo que necesitaba. Excelente.',
  'Increíble producto, lo uso todos los días. Muy duradero.',
  'Lo recomiendo al 100%, llegó rápido y funciona perfecto.',
  'Súper contenta, la calidad supera al precio. 5 estrellas.',
  'Muy buena experiencia, todo tal cual se describe. Top.',
  'Es de excelente calidad, se nota que es original. Lo recomiendo.',
  'Llegó en tiempo récord, muy bien empacado. Súper recomendado.',
  'Todo bien, el producto es increíble. Muy feliz con mi compra.',
  'Súper bueno, ya es mi segunda compra aquí. Siempre excelente.',
  'Muy contento, es mejor que otros más caros. Lo recomiendo.',
  'Es perfecto, justo lo que buscaba. 10/10 sin duda.',
  'Súper recomendado, mis amigos ya lo compraron también. Top.',
  'Muy feliz, el servicio fue excelente y el producto top. Lo amo.',
  'Increíble, superó todas mis expectativas. 100% recomendado.',
  'Lo uso constantemente y sigue como nuevo. Súper duradero.',
  'Súper bien, llegó rapidísimo y en perfectas condiciones. Excelente.',
  'Muy satisfecho, la calidad es impresionante. Vale la pena.',
  'Es la mejor inversión del año. Súper recomendado. 5 estrellas.',
  'Todo perfecto, no podría estar más feliz. Lo recomiendo totalmente.',
  'Súper contenta, es hermoso y funcional. Muy buena calidad. Lo amo.',
  'Muy bueno, cumplió con todo y más. Llegó antes de lo esperado. Top.',
  'Es excelente, se nota el cuidado en cada detalle. 10/10.',
  'Súper feliz, el producto es tal cual se ve. Muy recomendado.',
  'Muy bien, la calidad es superior a otros que probé. Lo recomiendo.',
  'Increíble, funciona mejor de lo que esperaba. Súper contento.',
  'Lo recomiendo con los ojos cerrados, es excelente. 5 estrellas.',
  'Súper bien, llegó rápido y funciona de maravilla. Muy feliz.',
  'Muy contenta, es justo lo que quería. Excelente producto. Lo amo.',
  'Todo llegó en perfecto estado, muy bien empacado. Súper recomendado.',
  'Es mejor que marcas más reconocidas. Muy buena compra. 10/10.',
  'Súper recomendado, la calidad es top. Ya quiero otro. Lo amo.',
  'Muy satisfecha, el servicio fue excelente. Todo perfecto. 5 estrellas.',
  'Increíble, es la mejor compra que he hecho. Súper contento. Top.',
  'Lo uso a diario y sigue perfecto. Muy duradero. Lo recomiendo.',
  'Súper bien, superó mis expectativas. Vale cada centavo. 10/10.',
  'Muy feliz, llegó rapidísimo y en perfectas condiciones. Excelente.',
  'Es justo lo que prometen, sin engaños. Súper recomendado. Lo amo.',
  'Todo perfecto, la calidad es impresionante. 5 estrellas merecidas.',
  'Súper contento, es mejor de lo que esperaba. Muy buena compra. Top.',
  'Muy bien, el producto es de primera calidad. Lo recomiendo totalmente.',
  'Increíble, la relación calidad-precio es excelente. 10/10. Lo amo.',
  'Lo recomiendo al 1000%, es perfecto. Muy feliz con mi compra. Top.',
  'Súper bien, llegó antes de lo esperado. Funciona genial. Excelente.',
  'Muy satisfecha, es hermoso y duradero. 5 estrellas. Lo recomiendo.',
  'Todo excelente, desde la compra hasta la entrega. Súper recomendado.',
  'Es la mejor compra online que he hecho. Muy contento. 10/10. Lo amo.'
]

const NEUTRAL_COMMENTS = [
  'Buen producto en general, aunque el envío tardó un poco más de lo esperado.',
  'Cumple con lo básico, está bien por el precio que tiene.',
  'Decente, esperaba un poco más pero no está mal.',
  'El producto está bien, el empaque podría mejorar.',
  'Buena relación calidad-precio, aunque hay cosas por mejorar.',
  'Está bien, nada extraordinario pero cumple su función.',
  'El producto es aceptable, la calidad es regular.',
  'Para el precio está bien, pero esperaba mejor acabado.',
  'Cumple lo prometido, aunque no me encantó del todo.',
  'Es un producto normal, ni bueno ni malo.',
  'La calidad es decente, pero el envío pudo ser mejor.',
  'Está bien para uso ocasional, no para uso intensivo.',
  'El producto cumple, pero hay detalles que mejorar.',
  'No es lo mejor que he comprado, pero tampoco lo peor.',
  'Es aceptable, aunque el precio podría ser menor.',
  'Funciona bien, aunque el diseño podría mejorar.',
  'La calidad es regular, pero sirve para lo básico.',
  'Está bien, esperaba más durabilidad.',
  'Cumple su propósito, sin más ni menos.',
  'Es un producto estándar, nada especial.',
  'El producto cumple su función, aunque el diseño es básico.',
  'La calidad es aceptable para el precio que tiene.',
  'Está bien, pero hay productos mejores en el mercado.',
  'Cumple con lo necesario, sin más ni menos.',
  'El envío fue normal, el producto está bien.',
  'Para el precio que tiene, es aceptable.',
  'No es malo, pero tampoco excelente.',
  'El producto funciona, aunque esperaba más.',
  'La calidad es regular, pero sirve.',
]

const NEGATIVE_COMMENTS = [
  'El producto está bien pero el envío demoró bastante.',
  'Esperaba un poco más de calidad por el precio, pero cumple.',
  'No cumplió mis expectativas, la calidad es baja.',
  'El producto llegó dañado, muy decepcionado.',
  'El material es de mala calidad, no lo recomiendo.',
  'El envío fue terrible, tardó mucho.',
  'No vale la pena, mejor comprar otra marca.',
  'El producto no dura nada, muy frágil.',
  'La descripción no coincide con lo recibido.',
  'Pésima experiencia, no volvería a comprar.',
  'El producto tiene fallas desde el primer uso.',
  'Mala calidad, se sintió barato al tacto.',
  'El empaque llegó roto y el producto dañado.',
  'No es lo que esperaba, muy decepcionado.',
  'El servicio al cliente fue pésimo.',
  'El producto no funciona como debería.',
  'La calidad es inferior a productos similares.',
  'Llegó tarde y en malas condiciones.',
  'No lo recomiendo, mejor opción en el mercado.',
  'El precio no justifica la calidad del producto.',
  'El producto no funcionó desde el primer día.',
  'Muy mala experiencia, no lo recomiendo para nada.',
  'La calidad es pésima, se rompió rápido.',
  'El envío tardó demasiado y el producto llegó mal.',
  'No es lo que muestra la foto, muy diferente.',
  'El material es de muy baja calidad, decepcionante.',
  'Pésimo servicio al cliente, no resolvieron nada.',
  'El producto tiene defectos de fábrica.',
  'No vale la pena, mejor buscar otra opción.',
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateReviews(productId: number, count: number, targetAvg: number, sessionSeed: number) {
  // Interpolación de distribución de ratings según targetAvg (4.4 a 4.9)
  const t = Math.max(0, Math.min(1, (targetAvg - 4.4) / 0.5))
  const pct5 = 0.60 + t * 0.32
  const pct4 = 0.30 - t * 0.24
  const pct3 = 0.07 - t * 0.055
  const pct2 = 0.02 - t * 0.017
  const reviews = []
  const baseDate = new Date('2024-01-15')

  for (let i = 0; i < count; i++) {
    // Usar múltiples seeds con sessionSeed para variar en cada visita
    const seed1 = productId * 10000 + i + sessionSeed * 7
    const seed2 = productId * 5000 + i * 3 + sessionSeed * 13
    const seed3 = productId * 2000 + i * 7 + sessionSeed * 17
    const seed4 = productId * 1000 + i * 13 + sessionSeed * 23
    const seed5 = productId * 500 + i * 17 + sessionSeed * 29

    const rand = seededRandom(seed1)
    const rand2 = seededRandom(seed2)
    const rand3 = seededRandom(seed3)
    const rand4 = seededRandom(seed4)
    const rand5 = seededRandom(seed5)

    // Rating distribution dinámica según targetAvg
    let rating: number
    const roll = rand
    if (roll < pct5) rating = 5
    else if (roll < pct5 + pct4) rating = 4
    else if (roll < pct5 + pct4 + pct3) rating = 3
    else if (roll < pct5 + pct4 + pct3 + pct2) rating = 2
    else rating = 1

    // Usar combinación de valores aleatorios para más variedad en nombres y ciudades
    const firstNameIndex = Math.floor((rand + rand2 + rand3) / 3 * 1000000) % FIRST_NAMES.length
    const lastNameIndex = Math.floor((rand2 + rand3 + rand4) / 3 * 1000000) % LAST_NAMES.length
    const cityIndex = Math.floor((rand3 + rand4 + rand5) / 3 * 1000000) % CITIES.length

    const firstName = FIRST_NAMES[firstNameIndex]
    const lastName = LAST_NAMES[lastNameIndex]
    const city = CITIES[cityIndex]

    let comment: string
    // Usar combinación de valores aleatorios para más variedad en la selección de comentarios
    const commentIndex = Math.floor((rand + rand2 + rand3 + rand4 + rand5) / 5 * 1000000)
    if (rating >= 4) {
      comment = POSITIVE_COMMENTS[commentIndex % POSITIVE_COMMENTS.length]
    } else if (rating === 3) {
      comment = NEUTRAL_COMMENTS[commentIndex % NEUTRAL_COMMENTS.length]
    } else {
      comment = NEGATIVE_COMMENTS[commentIndex % NEGATIVE_COMMENTS.length]
    }

    // Fecha random en los últimos 18 meses
    const daysAgo = Math.floor(rand5 * 540)
    const reviewDate = new Date(baseDate)
    reviewDate.setDate(reviewDate.getDate() + Math.floor(rand2 * 540))

    const likes = Math.floor(rand3 * 50)
    const verified = rand4 > 0.2 // 80% compra verificada

    reviews.push({
      id: i + 1,
      name: `${firstName} ${lastName}`,
      city,
      rating,
      comment,
      date: reviewDate.toISOString(),
      likes,
      verified,
      avatar: `${firstName.charAt(0)}${lastName.charAt(0)}`
    })
  }

  return reviews
}

/**
 * Wrapper del provider: devuelve ReviewsResult con la misma forma que los
 * demás providers. Usa la lógica original de getReviewStats + generateReviews.
 */
export function getGeneratedReviews(productId: number, sessionSeed: number, config?: ReviewsConfig): ReviewsResult {
  const stats = getReviewStats(productId, sessionSeed)
  const count = config?.generated_count ?? stats.totalReviews
  const reviews = generateReviews(productId, count, stats.targetAvg, sessionSeed)
  return {
    reviews: reviews.map(r => ({ ...r, source: 'generated' as const })),
    totalReviews: reviews.length,
    avgRating: stats.avgRating,
    isReal: false,
  }
}

/** Re-export para que el orquestador pueda usar el mismo sessionSeed. */
export { getSessionSeed, getReviewStats }
