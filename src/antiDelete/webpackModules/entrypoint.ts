import Dispatcher from "@moonlight-mod/wp/discord/Dispatcher";
import { MessageStore } from "@moonlight-mod/wp/common_stores"

const logger = moonlight.getLogger("antiDelete/entrypoint");
logger.info("Loading antiDelete module");

Dispatcher.addInterceptor((event) => {
    if (event.p51devs_antiDelete === true) {
        logger.trace(`Event already processed, ignoring: ${JSON.stringify(event)}`);
        // This event was already processed by the antiDelete module and was allowed to pass through previously, might someday somewhere prevent an infinite loop or something idk
        return;
    }
    
    if (event.type == "MESSAGE_DELETE") {   
        logger.info(`Message deleted: ${JSON.stringify(event)}`);
        const message = MessageStore.getMessage(event.channelId, event.id);
        if (!message) {
            logger.warn(`Message not found in cache: ${event.id}`);
            return true; // still want to ignore this event, just wont be all fancy pants, maybe we can manually inject some color changing text or something?
        }
        // check if message flag 64 is set, if so, allow the message to be deleted
        if (message.flags & 64) {
            logger.info(`Message has flag 64 set, allowing deletion: ${event.id}`);
            return;
        }
        logger.info(`Message: ${JSON.stringify(message)}`);
        
        // Reconstructing the full event from scratch to prevent any possible issues with invalid data being sent through the dispatcher if that ever even would which it might not but shut up
        const newEvent = {
            type: "MESSAGE_UPDATE",
            message: {
                attachments: message.attachments,
                author: {
                    avatar: message.author.avatar,
                    avatar_decoration_data: message.author.avatarDecorationData,
                    clan: message.author.clan,
                    discriminator: message.author.discriminator,
                    global_name: message.author.globalName,
                    id: message.author.id,
                    primary_guild: message.author.primaryGuild,
                    public_flags: message.author.publicFlags,
                    username: message.author.username
                },
                channel_id: message.channel_id,
                channel_type: message.channel_type,
                components: message.components,
                content: message.content,
                // content: "ERM I WAS DELETED 🤓 its morally incorrect to read deleted messages",
                // needs to be current time
                edited_timestamp: new Date().toISOString(),
                embeds: message.embeds,
                flags: message.flags | 64,
                id: message.id,
                mention_everyone: message.mentionEveryone,
                mention_roles: message.mentionRoles,
                mentions: message.mentions,
                pinned: message.pinned,
                timestamp: message.timestamp,
                tts: message.tts,
            },
            // Prevent infinite loops unless something else is processing and re-emitting message delete events lol my bad
            p51devs_antiDelete: true,
        };

        logger.trace(`Dispatching new event: ${JSON.stringify(newEvent)}`);
        Dispatcher.dispatch(newEvent);

        return true;
    }
    if (event.type == "MESSAGE_DELETE_BULK") {
        // logger.info(`Bulk message delete: ${event}`); idk if im gonna do anything here
        return true;
    }
    if (event.type == "MESSAGE_UPDATE") {
        // logger.info(`Message updated: ${JSON.stringify(event)}`);
        // return true; // we could do something fancy with this shit maybe idk it was mostly for testing
    }
    return;
})