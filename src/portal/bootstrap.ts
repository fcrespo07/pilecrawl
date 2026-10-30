// Debe ser el primer import de main.ts: con `await` de nivel superior detiene la carga del resto del juego
// hasta que el SDK del portal ha dado el guardado (ajustes, récords y partida leen localStorage al importarse).
// Fuera de un portal no hace nada y no espera nada.
import { initPortalSave } from './portal';

await initPortalSave();
