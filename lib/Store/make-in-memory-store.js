import * as WAProto_1 from "../../WAProto/index.js";
import * as Defaults_1 from "../Defaults/index.js";
import { LabelAssociationType } from "../Types/LabelAssociation.js";
import * as Utils_1 from "../Utils/index.js";
import * as WABinary_1 from "../WABinary/index.js";
import makeOrderedDictionary from "./make-ordered-dictionary.js";
import { ObjectRepository } from "./object-repository.js";
import KeyedDB from "./keyed-db.js";

const waChatKey = (pin) => ({
    key: (c) =>
        (pin ? (c.pinned ? "1" : "0") : "") +
        (c.archived ? "0" : "1") +
        (c.conversationTimestamp
            ? c.conversationTimestamp.toString(16).padStart(8, "0")
            : "") +
        c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
});

export const waMessageID = (m) => m.key.id || "";

export const waLabelAssociationKey = {
    key: (la) =>
        la.type === LabelAssociationType.Chat
            ? la.chatId + la.labelId
            : la.chatId + la.messageId + la.labelId,
    compare: (k1, k2) => k2.localeCompare(k1)
};

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID);

export default function makeInMemoryStore(config) {
    const socket = config.socket;
    const chatKey = config.chatKey || waChatKey(true);
    const labelAssociationKey = config.labelAssociationKey || waLabelAssociationKey;
    const logger =
        config.logger ||
        Defaults_1.DEFAULT_CONNECTION_CONFIG.logger.child({
            stream: "in-mem-store"
        });

    const chats = new KeyedDB(chatKey.compare, chatKey.key);
    const messages = {};
    const contacts = {};
    const groupMetadata = {};
    const presences = {};
    const state = { connection: "close" };
    const labels = new ObjectRepository();
    const labelAssociations = new KeyedDB(labelAssociationKey.compare, labelAssociationKey.key);

    const assertMessageList = (jid) => {
        if (!messages[jid]) messages[jid] = makeMessagesDictionary();
        return messages[jid];
    };

    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts));
        for (const contact of newContacts) {
            oldContacts.delete(contact.id);
            contacts[contact.id] = { ...(contacts[contact.id] || {}), ...contact };
        }
        return oldContacts;
    };

    const labelsUpsert = (newLabels) => {
        for (const label of newLabels) labels.upsertById(label.id, label);
    };

    const bind = (ev) => {
        ev.on("connection.update", (update) => Object.assign(state, update));

        ev.on("messaging-history.set", ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest, syncType }) => {
            if (syncType === WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND) return;
            if (isLatest) {
                chats.clear();
                for (const id in messages) delete messages[id];
            }
            chats.insertIfAbsent(...newChats);
            const oldContacts = contactsUpsert(newContacts);
            if (isLatest) for (const jid of oldContacts) delete contacts[jid];
            for (const msg of newMessages) {
                const jid = msg.key.remoteJid;
                const list = assertMessageList(jid);
                list.upsert(msg, "prepend");
            }
        });

        ev.on("contacts.upsert", contactsUpsert);

        ev.on("contacts.update", async (updates) => {
            for (const update of updates) {
                const contact = contacts[update.id];
                if (contact) Object.assign(contact, update);
            }
        });

        ev.on("chats.upsert", (newChats) => chats.upsert(...newChats));

        ev.on("chats.update", (updates) => {
            for (let update of updates) {
                chats.update(update.id, (chat) => Object.assign(chat, update));
            }
        });

        ev.on("labels.edit", (label) => {
            if (label.deleted) return labels.deleteById(label.id);
            if (labels.count() < 20) labels.upsertById(label.id, label);
        });

        ev.on("labels.association", ({ type, association }) => {
            if (type === "add") labelAssociations.upsert(association);
            if (type === "remove") labelAssociations.delete(association);
        });

        ev.on("presence.update", ({ id, presences: update }) => {
            presences[id] = presences[id] || {};
            Object.assign(presences[id], update);
        });

        ev.on("chats.delete", (deletions) => {
            for (const item of deletions) chats.deleteById(item);
        });

        ev.on("messages.upsert", ({ messages: newMessages, type }) => {
            if (type !== "append" && type !== "notify") return;
            for (const msg of newMessages) {
                const jid = WABinary_1.jidNormalizedUser(msg.key.remoteJid);
                const list = assertMessageList(jid);
                list.upsert(msg, "append");
                if (type === "notify" && !chats.get(jid))
                    ev.emit("chats.upsert", [
                        {
                            id: jid,
                            conversationTimestamp: Utils_1.toNumber(msg.messageTimestamp),
                            unreadCount: 1
                        }
                    ]);
            }
        });

        ev.on("messages.update", (updates) => {
            for (const { update, key } of updates) {
                const list = assertMessageList(WABinary_1.jidNormalizedUser(key.remoteJid));
                list.updateAssign(key.id, update);
            }
        });

        ev.on("messages.delete", (item) => {
            if ("all" in item) messages[item.jid]?.clear();
            else {
                const jid = item.keys[0].remoteJid;
                const list = messages[jid];
                if (list) {
                    const idSet = new Set(item.keys.map((k) => k.id));
                    list.filter((m) => !idSet.has(m.key.id));
                }
            }
        });
    };

    const toJSON = () => ({
        chats,
        contacts,
        messages,
        labels,
        labelAssociations
    });

    const fromJSON = (json) => {
        chats.upsert(...json.chats);
        labelAssociations.upsert(...(json.labelAssociations || []));
        contactsUpsert(Object.values(json.contacts));
        labelsUpsert(Object.values(json.labels || {}));
        for (const jid in json.messages) {
            const list = assertMessageList(jid);
            for (const msg of json.messages[jid])
                list.upsert(WAProto_1.proto.WebMessageInfo.fromObject(msg), "append");
        }
    };
    const loadMessage = async (jid, id) => {
        return messages[jid]?.get(id)
    }
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        labels,
        labelAssociations,
        bind,
        toJSON,
        fromJSON,
        loadMessage
    };
}