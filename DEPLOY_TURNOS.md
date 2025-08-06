# Deploy de la Ruta /turnos

## Descripción
Este branch está configurado específicamente para hacer el deploy de la funcionalidad de turnos en la ruta `/turnos`.

## Comandos de Deploy

### Build de Producción
```bash
npm run build:turnos
```

### Deploy Completo (Build + Preview)
```bash
npm run deploy:turnos
```

### Build de Desarrollo
```bash
npm run build:dev
```

## Estructura de Archivos

- `vite.config.prod.ts` - Configuración optimizada para producción
- `src/pages/Turnos.tsx` - Componente principal de la ruta /turnos
- `src/components/AppointmentSystem.tsx` - Sistema de citas

## Configuración de Producción

La configuración de producción incluye:
- Minificación con Terser
- Chunk splitting optimizado
- Sin sourcemaps para reducir tamaño
- Optimización de bundles

## Rutas Disponibles

- `/` - Página principal
- `/turnos` - Sistema de gestión de turnos
- `/*` - Página 404

## Notas de Deploy

1. Asegúrate de estar en el branch `deploy-turnos`
2. Ejecuta `npm run build:turnos` para generar el build de producción
3. Los archivos se generarán en la carpeta `dist/`
4. Para preview local: `npm run preview` 