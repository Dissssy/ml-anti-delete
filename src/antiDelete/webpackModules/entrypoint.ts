import Dispatcher from "@moonlight-mod/wp/discord/Dispatcher";
import { MessageStore, UserStore, ChannelStore } from "@moonlight-mod/wp/common_stores"
import * as Diff from "diff";

const cfg = <T>(key: string, defval: T): T => {
    let x = moonlight.getConfigOption<T>("antiDelete", key);
    return (x === undefined) ? defval : x;
};

// ansi color codes for showing diffs on edited messages
const colors = {
    added: "[2;32m",
    removed: "[2;31m",
    reset: "[0m"
}
const logger = moonlight.getLogger("antiDelete/entrypoint");
logger.info("Loading antiDelete module");

Dispatcher.addInterceptor((event) => {
    if (event.type == "MESSAGE_CREATE") {
        if (event.message.embeds.length > 0) {
            logger.info(`Embeds: `, JSON.stringify(event.message.embeds));
            return;
        }
    }
    
    if (event.type == "MESSAGE_DELETE" && isEnabled("Anti Delete Only", cfg<string>("features", "Both"))) {   
        if (event.p51devs_antiUpdate === true || event.p51devs_antiDelete === true) {
            logger.trace(`Event already processed, ignoring: ${JSON.stringify(event)}`);
            // This event was already processed by the antiDelete module and was allowed to pass through previously, might someday somewhere prevent an infinite loop or something idk
            return;
        }

        logger.info(`Message deleted: ${JSON.stringify(event)}`);
        let message = MessageStore.getMessage(event.channelId, event.id);
        if (!message) {
            logger.warn(`Message not found in cache: ${event.id}`);
            return; // still want to ignore this event, just wont be all fancy pants, maybe we can manually inject some color changing text or something?
        }
        if (isBlacklisted(message)) {
            return;
        }
        const currentUser = UserStore.getCurrentUser();
        
        if (message.author.id == currentUser.id) {
            logger.info(`Message was sent by the current user, allowing deletion: ${event.id}`);
            return;
        }
        // check if message flag 64 is set, if so, allow the message to be deleted
        if (message.flags & 64) {
            // logger.info(`Message has flag 64 set, allowing deletion: ${event.id}`);
            return;
        }
        // logger.info(`Message: ${JSON.stringify(message)}`);

        message.flags |= 64;
        
        const newEvent = {
            type: "MESSAGE_UPDATE",
            message: message,
            p51devs_antiDelete: true
        };

        // logger.trace(`Dispatching new event: ${JSON.stringify(newEvent)}`);
        Dispatcher.dispatch(newEvent);

        return true; // we want to prevent the original event from being processed
    }
    if (event.type == "MESSAGE_DELETE_BULK") {
        // logger.info(`Bulk message delete: ${event}`); idk if im gonna do anything here
        return;
    }
    if (event.type == "MESSAGE_UPDATE" && isEnabled("Anti Update Only", cfg<string>("features", "Both"))) {
        if (event.p51devs_antiUpdate === true || event.p51devs_antiDelete === true) {
            logger.trace(`Event already processed, ignoring: ${JSON.stringify(event)}`);
            // This event was already processed by the antiDelete module and was allowed to pass through previously, might someday somewhere prevent an infinite loop or something idk
            return;
        }
        const new_message = event.message;

        // if the message is ephemeral, wipe the embeds and redispatch, this idk prevents discord from overwriting them or something somehow
        if (new_message.flags & 64) {
            new_message.embeds = [];
            event.p51devs_antiUpdate = true;
            event.message = new_message;
            Dispatcher.dispatch(event);
        }

        let message = MessageStore.getMessage(new_message.channel_id, new_message.id);
        if (!message) {
            logger.warn(`Message not found in cache: ${event.id}`);
            return; // still want to ignore this event, just wont be all fancy pants, maybe we can manually inject some color changing text or something?
        }
        const currentUser = UserStore.getCurrentUser();
        if (message.author.id == currentUser.id) {
            logger.info(`Message was sent by the current user, allowing deletion: ${event.id}`);
            return;
        }
        if (isBlacklisted(message)) {
            return;
        }
        if (message.content == new_message.content) {
            return;
        }
        // get the diff between the original message and the updated message
        let diff = Diff.diffChars(message.content, new_message.content);
        // logger.info(`Diff: ${JSON.stringify(diff)}`);
        // let edit_num = 1;
        // if (message.embeds.length > 0) {
        //     // if its an embed from us it'll be styled like "Edit #1" or "Edit #2" etc
        //     let edit_regex = /Edit #(\d+)/;
        //     let match = edit_regex.exec(message.embeds[0].title);
        //     if (match) {
        //         edit_num = parseInt(match[1]) + 1;
        //     }
        // }
        // format the diff string
        let diff_str = "";
        let last_was_colored = false;
        diff.forEach((part: Part) => {
            let color = part.added ? colors.added : part.removed ? colors.removed : colors.reset;
            diff_str += color + part.value + colors.reset;
            last_was_colored = part.added || part.removed;
        });
        if (last_was_colored) {
            diff_str += colors.reset;
        }

        let embed = {
            // title: `Edit #${edit_num}`,
            title: "Last Edit Diff",
            description: `\`\`\`ansi\n${diff_str}\`\`\``,
            content_scan_version: 0,
            type: "rich"
        }

        new_message.embeds.push(embed);
        // this stuff isnt working right and im tired cope
        // let embed_regex = /Edit #\d+/;
        // let embed_count = new_message.embeds.length;
        // for (let i = 0; i < message.embeds.length; i++) {
        //     let match = embed_regex.exec(message.embeds[i].title);
        //     if (match) {
        //         new_message.embeds.push(message.embeds[i]);
        //         embed_count++;
        //     }
        //     if (embed_count >= 10) {
        //         break;
        //     }
        // }
        // new_message.embeds = new_message.embeds.slice(0, 10);
        event.p51devs_antiUpdate = true;
        event.message = new_message;

        Dispatcher.dispatch(event);

        return true;
    }
    return;
})

function isEnabled(bothOr: string, value: string): boolean {
    return value == bothOr || value == "Both";
}

function isBlacklisted(msg: any): boolean {
    logger.trace(`Checking blacklists for message`, msg);
    
    const channelId = msg.channel_id;
    const channel = ChannelStore.getChannel(channelId);
    const isDM = channel.type == 1 || channel.type == 3;

    if (isDM && !isEnabled("DMs Only", cfg<string>("locations", "Both"))) {
        logger.trace(`Message not in a guild and DMs disabled, ignoring`);
        return true;
    } else if (!isEnabled("Guilds Only", cfg<string>("locations", "Both"))) {
        logger.trace(`Message in a guild and guilds disabled, ignoring`);
        return true;
    }

    if (!isDM) {
        const guildFilterList = cfg<string[]>("guildFilter", []);
        const guildFilterType = cfg<boolean>("invertGuildFilter", false) ? "whitelist" : "blacklist";
        const guildId = channel.guild_id;

        switch (guildFilterType + guildFilterList.includes(guildId)) {
            case "whitelisttrue":
                logger.trace(`Guild in whitelist, continuing`);
                break;
            case "whitelistfalse":
                logger.trace(`Guild not in whitelist, ignoring`);
                return true;
            case "blacklisttrue":
                logger.trace(`Guild in blacklist, ignoring`);
                return true;
            case "blacklistfalse":
                logger.trace(`Guild not in blacklist, continuing`);
                break;
            default:
                logger.warn(`Invalid guild case: ${guildFilterType + guildFilterList.includes(channelId)}`);
                return true;
        }
    }
    
    const channelFilterList = cfg<string[]>("channelFilter", []);
    const channelFilterType = cfg<boolean>("invertChannelFilter", false) ? "whitelist" : "blacklist";
    // const channelId = channel.id;

    switch (channelFilterType + channelFilterList.includes(channelId)) {
        case "whitelisttrue":
            logger.trace(`Channel in whitelist, continuing`);
            break;
        case "whitelistfalse":
            logger.trace(`Channel not in whitelist, ignoring`);
            return true;
        case "blacklisttrue":
            logger.trace(`Channel in blacklist, ignoring`);
            return true;
        case "blacklistfalse":
            logger.trace(`Channel not in blacklist, continuing`);
            break;
        default:
            logger.warn(`Invalid channel case: ${channelFilterType + channelFilterList.includes(channelId)}`);
            return true;
    }

    const userFilterList = cfg<string[]>("userFilter", []);
    const userFilterType = cfg<boolean>("invertUserFilter", false) ? "whitelist" : "blacklist";
    const userId = msg.author.id;

    switch (userFilterType + userFilterList.includes(userId)) {
        case "whitelisttrue":
            logger.trace(`User in whitelist, continuing`);
            break;
        case "whitelistfalse":
            logger.trace(`User not in whitelist, ignoring`);
            return true;
        case "blacklisttrue":
            logger.trace(`User in blacklist, ignoring`);
            return true;
        case "blacklistfalse":
            logger.trace(`User not in blacklist, continuing`);
            break;
        default:
            logger.warn(`Invalid user case: ${userFilterType + userFilterList.includes(userId)}`);
            return true;
    }

    return false;
}

type Part = {
    count: number,
    value: string,
    added: boolean,
    removed: boolean
}