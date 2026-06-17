# ReportBot

Bot de Discord desarrollado en Node.js para gestionar reportes de publicaciones dentro de un servidor.

El bot permite que los usuarios reporten mensajes para revisión del equipo de moderación. Cuando se reporta una publicación, el bot envía la información al canal de moderación, elimina el mensaje original si tiene permisos, conserva el contenido y adjuntos en memoria temporal, y permite que los moderadores decidan si restauran la publicación o la eliminan definitivamente notificando al autor.

## Funcionalidades

* Reporte de mensajes mediante comando contextual.
* Reporte de mensajes mediante reacción con emoji personalizado.
* Envío del reporte a un canal privado de moderación.
* Eliminación automática del mensaje reportado si el bot tiene permisos.
* Conservación temporal del contenido original.
* Descarga y reenvío de adjuntos del mensaje reportado.
* Botones de decisión para moderadores:

  * Restaurar publicación.
  * Eliminar y notificar al autor.
* Validación de rol autorizado para tomar decisiones.
* Notificación privada al usuario que realiza el reporte.
* Notificación privada al autor cuando su publicación es eliminada.

## Stack tecnológico

* Node.js 20
* discord.js
* dotenv

## Requisitos

* Node.js 20.
* Aplicación creada en Discord Developer Portal.
* Bot invitado al servidor.
* Canal privado de moderación.
* Rol de moderador configurado.
* Permisos suficientes para borrar mensajes y enviar mensajes en canales.

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
MOD_CHANNEL_ID=ID_CANAL_MODERACION
MOD_ROLE_ID=ID_ROL_MODERADOR
CLIENT_ID=ID_APLICACION_DISCORD
GUILD_ID=ID_SERVIDOR_DISCORD
```

### Descripción de variables

| Variable         |                Obligatoria | Descripción                                                |
| ---------------- | -------------------------: | ---------------------------------------------------------- |
| `DISCORD_TOKEN`  |                         Sí | Token del bot generado desde Discord Developer Portal.     |
| `MOD_CHANNEL_ID` |                         Sí | Canal donde llegarán los reportes.                         |
| `MOD_ROLE_ID`    |                         Sí | Rol autorizado para aprobar o eliminar reportes.           |
| `CLIENT_ID`      | Sí para deploy de comandos | ID de la aplicación Discord.                               |
| `GUILD_ID`       | Sí para deploy de comandos | ID del servidor donde se registrará el comando contextual. |

## Reporte por comando contextual

El bot registra un comando de aplicación llamado:

```text
Reportar a moderadores
```

Este comando aparece al hacer clic derecho sobre un mensaje y entrar en el menú de aplicaciones.

Para registrar el comando:

```bash
npm run deploy-commands
```

Este comando usa las variables:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
```

## Reporte por reacción

El bot también permite reportar mensajes usando un emoji personalizado.

Actualmente el emoji está definido directamente en el código:

```js
const REPORT_EMOJI_NAME = 'reportar';
const REPORT_EMOJI_ID = '1455371157883584624';
```

Si se desea usar otro emoji, se debe cambiar el ID y nombre en el archivo `index.js`.

## Permisos requeridos en Discord

El bot necesita permisos para:

* Ver canales.
* Enviar mensajes.
* Leer historial de mensajes.
* Gestionar mensajes.
* Usar comandos de aplicación.
* Añadir o leer reacciones.
* Adjuntar archivos.
* Enviar mensajes directos cuando Discord lo permita.

En Discord Developer Portal se recomienda habilitar los intents necesarios para:

* Guilds.
* Guild messages.
* Message content.
* Guild message reactions.

## Instalación

Clonar el repositorio:

```bash
git clone https://github.com/itachi364/ReportBot.git
cd ReportBot
```

Instalar dependencias:

```bash
npm install
```

Crear archivo `.env`:

```bash
cp .env.example .env
```

Si no existe `.env.example`, crear manualmente el archivo `.env` con las variables necesarias.

Registrar el comando contextual:

```bash
npm run deploy-commands
```

Ejecutar el bot:

```bash
npm start
```

## Ejecución en producción con PM2

Instalar PM2:

```bash
npm install -g pm2
```

Iniciar el bot:

```bash
pm2 start npm --name ReportBot -- start
```

Guardar configuración:

```bash
pm2 save
```

Configurar arranque automático:

```bash
pm2 startup
```

Ver logs:

```bash
pm2 logs ReportBot
```

Reiniciar:

```bash
pm2 restart ReportBot
```

## Flujo de funcionamiento

### 1. Usuario reporta una publicación

El usuario puede reportar una publicación de dos formas:

```text
Clic derecho sobre mensaje → Apps → Reportar a moderadores
```

o reaccionando con el emoji configurado.

### 2. El bot captura la publicación

El bot obtiene:

* Autor original.
* Canal original.
* Contenido del mensaje.
* Usuario que reportó.
* Adjuntos del mensaje.

### 3. El bot elimina el mensaje original

Si tiene permiso `Manage Messages`, el bot elimina la publicación reportada del canal original.

Si no tiene permiso, el bot registra una advertencia.

### 4. El bot envía el caso a moderación

En el canal configurado en `MOD_CHANNEL_ID`, el bot publica un embed con:

* ID del reporte.
* Canal original.
* Autor original.
* Usuario que reportó.
* Contenido reportado.

También agrega botones para que el equipo de moderación decida:

* Restaurar publicación.
* Eliminar y notificar.

### 5. Moderador toma decisión

Solo los usuarios con el rol configurado en `MOD_ROLE_ID` pueden usar los botones de decisión.

Si el moderador aprueba/restaura:

* El bot republica el contenido en el canal original.
* Reenvía adjuntos si existían.
* Marca el reporte como aprobado.

Si el moderador elimina:

* El bot intenta enviar DM al autor original.
* Marca el reporte como eliminado.
* Elimina el reporte de memoria temporal.

## Limitaciones actuales

* Los reportes se almacenan en memoria con `Map`.
* Si el bot se reinicia, los reportes pendientes se pierden.
* El ID del emoji de reporte está quemado en código.
* No existe base de datos para auditoría histórica.
* No hay panel administrativo.
* No hay persistencia de decisiones de moderación.
* No hay soporte multi-servidor parametrizado por base de datos.

## Seguridad y privacidad

El bot puede manejar contenido sensible reportado por usuarios. Se recomienda:

* Mantener privado el canal de moderación.
* No registrar tokens en logs.
* No subir `.env` al repositorio.
* Limitar el rol de moderador a usuarios autorizados.
* Revisar permisos de eliminación de mensajes.
* Evitar almacenar adjuntos más tiempo del necesario.

Ejemplo de `.gitignore`:

```gitignore
node_modules/
.env
npm-debug.log*
```

## Estructura general

```text
ReportBot
├── index.js
├── deploy-commands.js
├── package.json
└── .env
```

## Comandos útiles

Instalar dependencias:

```bash
npm install
```

Registrar comandos:

```bash
npm run deploy-commands
```

Ejecutar localmente:

```bash
npm start
```

Ejecutar con PM2:

```bash
pm2 start npm --name ReportBot -- start
```

Ver logs:

```bash
pm2 logs ReportBot
```

Reiniciar:

```bash
pm2 restart ReportBot
```

## Posibles mejoras futuras

* Persistir reportes en una base de datos.
* Mover configuración del emoji a variables de entorno.
* Agregar historial de decisiones de moderación.
* Agregar comando para consultar estado de un reporte.
* Agregar expiración automática de reportes pendientes.
* Agregar soporte para múltiples servidores.
* Agregar Dockerfile para despliegue en contenedores.
* Agregar GitHub Actions para validación automática.

## Licencia

Proyecto de uso personal/comunitario. Ajustar la licencia según las necesidades del repositorio.
