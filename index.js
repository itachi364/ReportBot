import 'dotenv/config';
import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField
} from 'discord.js';

const {
    DISCORD_TOKEN,
    MOD_CHANNEL_ID,
    MOD_ROLE_ID
} = process.env;

// Emoji que dispara el reporte por reacción (puedes cambiarlo)
// Emoji personalizado que dispara el reporte por reacción
const REPORT_EMOJI_NAME = 'reportar';               // nombre del emoji
const REPORT_EMOJI_ID = '1455371157883584624';     // <-- pon aquí el ID real

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions   // <- necesario para reacciones
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.User,
        Partials.Reaction                           // <- necesario para reacciones parciales
    ]
});

// Memoria temporal de reportes
const reports = new Map();

// Para no crear 50 reportes por el mismo mensaje solo por reacciones
const reportedByReaction = new Set(); // messageId -> ya reportado vía reacción

function generateReportId() {
    return Math.random().toString(36).slice(2, 10);
}

function isEthicsModerator(member) {
    return member.roles.cache.has(MOD_ROLE_ID);
}

client.once(Events.ClientReady, (c) => {
    console.log(`Bot conectado como ${c.user.tag}`);
});

/**
 * Lógica común para crear un reporte (se usa desde contexto y desde reacción)
 * @param {Message} targetMessage  Mensaje que se reporta
 * @param {User} reporterUser      Usuario que reporta
 * @param {Function} notifyFn      Función async para notificar al reportante (ephemeral o DM)
 */
async function createReport(targetMessage, reporterUser, notifyFn) {
    // Notificamos al usuario que reportó
    await notifyFn('Gracias. Tu reporte ha sido enviado al equipo de Moderación de Ética.');

    // Permiso para borrar mensaje
    const canDelete = targetMessage.guild.members.me
        .permissionsIn(targetMessage.channelId)
        .has(PermissionsBitField.Flags.ManageMessages);

    const originalContent = targetMessage.content || '[sin texto]';
    const originalAuthor = targetMessage.author;
    const originalChannel = targetMessage.channel;

    // Guardamos adjuntos (imágenes / archivos) descargando el binario
    const attachments = [];
    for (const att of targetMessage.attachments.values()) {
        try {
            const res = await fetch(att.url);
            const arrayBuffer = await res.arrayBuffer();
            attachments.push({
                name: att.name,
                data: Buffer.from(arrayBuffer)
            });
        } catch (e) {
            console.error('Error descargando adjunto:', e);
        }
    }

    if (canDelete) {
        await targetMessage.delete().catch(e =>
            console.error('Error borrando mensaje original:', e)
        );
    } else {
        console.warn('El bot no tiene permisos para borrar mensajes en este canal.');
    }

    // 🔹 Creamos ID del reporte
    const reportId = generateReportId();

    reports.set(reportId, {
        guildId: targetMessage.guild.id,
        channelId: originalChannel.id,
        authorId: originalAuthor.id,
        content: originalContent,
        attachments      // [{ name, data }]
    });

    // Canal de moderación
    const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);

    const embed = new EmbedBuilder()
        .setTitle('Nuevo reporte de publicación')
        .setColor(0xffcc00)
        .addFields(
            { name: 'ID del reporte', value: reportId, inline: true },
            { name: 'Canal original', value: `<#${originalChannel.id}>`, inline: true },
            { name: 'Autor del mensaje', value: `${originalAuthor.tag} (<@${originalAuthor.id}>)` },
            { name: 'Reportado por', value: `${reporterUser.tag} (<@${reporterUser.id}>)` },
            { name: 'Contenido', value: originalContent.slice(0, 1024) || '[sin texto]' }
        )
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`report-approve-${reportId}`)
            .setLabel('Restaurar publicación')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`report-delete-${reportId}`)
            .setLabel('Eliminar y notificar')
            .setStyle(ButtonStyle.Danger)
    );

    // 1) Embed con info + botones
    await modChannel.send({ embeds: [embed], components: [buttons] });

    // 2) Si hay adjuntos, se envían en un mensaje aparte para que los moderadores los vean
    if (attachments.length) {
        await modChannel.send({
            content: `Archivos/reportes adjuntos para el ID **${reportId}**:`,
            files: attachments.map(a => ({
                attachment: a.data,
                name: a.name || 'archivo'
            }))
        });
    }
}

/**
 * INTERACTION: Comando contextual "Reportar a moderadores"
 */
client.on(Events.InteractionCreate, async (interaction) => {
    try {

        // 📌 COMANDO CONTEXTUAL (clic derecho -> Apps)
        if (interaction.isMessageContextMenuCommand()) {
            if (interaction.commandName !== 'Reportar a moderadores') return;

            const targetMessage = interaction.targetMessage;

            await createReport(
                targetMessage,
                interaction.user,
                async (msg) => {
                    await interaction.reply({
                        content: msg,
                        ephemeral: true
                    });
                }
            );

            return;
        }

        // 🎛️ BOTONES DE MODERACIÓN
        if (interaction.isButton()) {

            const [prefix, action, reportId] = interaction.customId.split('-');
            if (prefix !== 'report') return;

            const report = reports.get(reportId);
            if (!report) {
                await interaction.reply({
                    content: 'No se encontró la información del reporte (el bot pudo reiniciarse).',
                    ephemeral: true
                });
                return;
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!isEthicsModerator(member)) {
                await interaction.reply({
                    content: 'Solo los Moderadores de Ética pueden tomar decisiones sobre reportes.',
                    ephemeral: true
                });
                return;
            }

            // Deshabilitar botones
            const row = new ActionRowBuilder().addComponents(
                ...interaction.message.components[0].components.map(btn =>
                    ButtonBuilder.from(btn).setDisabled(true)
                )
            );

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);

            // ✅ RESTAURAR MENSAJE
            if (action === 'approve') {

                const channel = await client.channels.fetch(report.channelId);
                const header =
                    `**Mensaje restaurado tras revisión de Moderación de Ética. Autor original:** <@${report.authorId}>`;

                if (report.attachments?.length) {
                    await channel.send({
                        content: `${header}\n\n${report.content || '[sin texto]'}`,
                        files: report.attachments.map(a => ({
                            attachment: a.data,          // Buffer con el binario
                            name: a.name || 'archivo'
                        }))
                    });
                } else {
                    await channel.send(
                        `${header}\n\n${report.content || '[sin texto]'}`
                    );
                }

                embed.setColor(0x00aa00).addFields({
                    name: 'Resultado',
                    value: `Aprobado por ${interaction.user.tag}`
                });

                await interaction.update({ embeds: [embed], components: [row] });
                reports.delete(reportId);
                return;
            }

            // ❌ ELIMINAR Y NOTIFICAR
            if (action === 'delete') {

                try {
                    const author = await client.users.fetch(report.authorId);
                    await author.send(
                        `Hola. Tu publicación en el servidor **${interaction.guild.name}** fue eliminada por un moderador porque no cumplía las reglas.\n\nSi tienes dudas, contacta al equipo de Moderación de Ética.`
                    );
                } catch (e) {
                    console.warn('No se pudo enviar DM al autor:', e.message);
                }

                embed.setColor(0xdd0000).addFields({
                    name: 'Resultado',
                    value: `Eliminado por ${interaction.user.tag} y autor notificado por DM`
                });

                await interaction.update({ embeds: [embed], components: [row] });
                reports.delete(reportId);
                return;
            }
        }

    } catch (error) {
        console.error('Error en InteractionCreate:', error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Ocurrió un error al procesar esta acción.',
                ephemeral: true
            });
        }
    }
});

/**
 * REACTION: cuando alguien reacciona con el emoji definido (REPORT_EMOJI)
 */
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        // Ignorar bots
        if (user.bot) return;

        // Resolver parciales
        if (reaction.partial) {
            reaction = await reaction.fetch();
        }
        const message = reaction.message;
        if (message.partial) {
            await message.fetch();
        }

        // Solo en servidores
        if (!message.guild) return;

        // Solo nuestro emoji personalizado de reporte (:reportar:)
        const emoji = reaction.emoji;

        // Si es un emoji custom, comprobamos por ID (lo más fiable)
        if (emoji.id) {
            if (emoji.id !== REPORT_EMOJI_ID) return;
        } else {
            // Por si acaso algún día usas un emoji estándar con el mismo nombre
            if (emoji.name !== REPORT_EMOJI_NAME) return;
        }

        // Evitar múltiples reportes por reacción del mismo mensaje
        if (reportedByReaction.has(message.id)) return;
        reportedByReaction.add(message.id);

        // Crear reporte; notificamos al usuario por DM
        await createReport(
            message,
            user,
            async (msg) => {
                try {
                    await user.send(msg);
                } catch (e) {
                    console.warn('No se pudo enviar DM al usuario que reporta:', e.message);
                }
            }
        );

    } catch (error) {
        console.error('Error en MessageReactionAdd:', error);
    }
});

client.login(DISCORD_TOKEN);
