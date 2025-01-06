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
        var message = MessageStore.getMessage(event.channelId, event.id);
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

        message.flags |= 64;
        
        const newEvent = {
            type: "MESSAGE_UPDATE",
            message: message,
            p51devs_antiDelete: true
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