import spacepack from "@moonlight-mod/wp/spacepack_spacepack";
import { MessageStore, UserStore, ChannelStore } from "@moonlight-mod/wp/common_stores"

const cfg = <T>(key: string) => moonlight.getConfigOption<T>("messageSignatures", key);

const logger = moonlight.getLogger("messageSignatures/entrypoint");
logger.info("Loading messageSignatures module");

const COOL = "Queueing message to be sent";
const module = spacepack.findByCode(COOL)[0].exports;

let currentUserId: string | null = null;

const originalSend = module.Z.sendMessage;
module.Z.sendMessage = async (...args: any[]) => {
    if (!currentUserId) {
        currentUserId = UserStore.getCurrentUser().id;
    }
    
    if (MessageStore.getLastMessage(args[0]).author.id === currentUserId) {
        logger.trace("Last message was sent by us, ignoring");
        return originalSend.call(module.Z, ...args);
    }

    logger.trace("got sendMessage", args[1]);
    const channel = ChannelStore.getChannel(args[0]);
    const filterList = cfg<[string]>("filterList") ?? [];
    const whitelist = cfg<boolean>("filterType") ?? false;
    let message = args[1];
    let inList = false;
    let ignore = false;
    // attempting to extract what type of channel we're in
    if (channel) {
        // channel type 0 is text channel, 1 is DM, 3 is group DM. otherwise do nothing
        const channelType = channel.type;
        switch (channelType) {
            case 0:
                if (channel.guild_id) {
                    logger.trace("Guild channel");
                    const sendInGuilds = cfg<boolean>("sendInGuilds") ?? true;
                    logger.trace("sendInGuilds", sendInGuilds);
                    if (sendInGuilds) {
                        // check if the guild_id is in the filterList
                        inList = filterList.some((guildId: string) => {
                            return guildId === channel.guild_id;
                        });
                    } else {
                        ignore = true;
                    }
                } else {
                    logger.warn("Unknown channel type", channelType);
                    return originalSend.call(module.Z, ...args);
                }
                break;
            case 1:
                logger.trace("Private DM");
                const sendInDMs = cfg<boolean>("sendInDMs") ?? true;
                logger.trace("sendInDMs", sendInDMs);
                if (sendInDMs) {
                    inList = filterList.some((userId: string) => {
                        return userId === channel.recipients[0];
                    });
                } else {
                    ignore = true;
                }
                break;
            case 3:
                logger.trace("Group DM");
                const sendInGroupDMs = cfg<boolean>("sendInGroupDMs") ?? true;
                logger.trace("sendInGroupDMs", sendInGroupDMs);
                if (sendInGroupDMs) {
                    inList = filterList.some((userId: string) => {
                        return userId === channel.id;
                    });
                } else {
                    ignore = true;
                }
                break;
            default:
                logger.trace("Ignoring non text? channel", channelType);
                break;
        }
    } else {
        logger.warn("Could not find channel", args[0]);
    }

    if (whitelist) {
        inList = !inList;
    }

    if ((!inList) && (!ignore)) {
        logger.trace("Message is in filterList, adding signature");
        message.content += "\n";
        message.content += cfg<string>("signature") ?? "-# Sent from my Samsung Smart Fridge";
        message.content.trim();
        args[1] = message;
        return originalSend.call(module.Z, ...args);
    } else {
        return originalSend.call(module.Z, ...args);
    }
}