import 'dotenv/config';
import { REST, Routes, ApplicationCommandType } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const commands = [
  {
    name: 'Reportar a moderadores',    // Texto que verán en "Apps"
    type: ApplicationCommandType.Message
  }
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function main() {
  try {
    console.log('Registrando comandos de aplicación (guild)...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Comandos registrados correctamente.');
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
}

main();
