(function () {
  "use strict";
  var module = { exports: {} };

  var CONFIG = {
    // Leave empty to greet in every server, or put guild IDs here to limit it
    guildIds: [],
    // Delay before sending, in ms (random between min and max)
    minDelay: 1000,
    maxDelay: 3000
  };

  // Exactly these six stickers are used, nothing else
  var STICKER_IDS = [
    "781291131828699156", // Cheerful Choco - Wave
    "751606379340365864", // Robo Nelly - Wave
    "754108890559283200", // Clyde Bot - Wave
    "816087792291282944", // Doggo Replies - Sup
    "749054660769218631", // Wumpus Beyond - Wave
    "819128604311027752"  // Sassy Peach - Scream
  ];

  var findByProps = vendetta.metro.findByProps;
  var FluxDispatcher = vendetta.metro.common.FluxDispatcher;
  var logger = vendetta.logger;

  var MessageActions = findByProps("sendMessage", "receiveMessage");
  var UserStore = findByProps("getCurrentUser", "getUser");

  var USER_JOIN = 7;
  var greeted = new Set();

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function sendSticker(message) {
    MessageActions.sendMessage(
      message.channel_id,
      { content: "", tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
      undefined,
      {
        stickerIds: [pick(STICKER_IDS)],
        messageReference: {
          guild_id: message.guild_id,
          channel_id: message.channel_id,
          message_id: message.id
        },
        allowedMentions: { parse: ["users"], replied_user: true }
      }
    );
  }

  function onMessage(event) {
    try {
      var message = event && event.message;
      if (!message || event.optimistic || message.type !== USER_JOIN) return;
      if (CONFIG.guildIds.length && CONFIG.guildIds.indexOf(message.guild_id) === -1) return;
      if (greeted.has(message.id)) return;
      greeted.add(message.id);

      var me = UserStore.getCurrentUser();
      var userId = message.author && message.author.id;
      if (!userId || (me && userId === me.id)) return;

      var delay = CONFIG.minDelay + Math.random() * Math.max(0, CONFIG.maxDelay - CONFIG.minDelay);

      setTimeout(function () {
        try {
          sendSticker(message);
        } catch (e) {
          logger.error("[AutoWelcome] failed to send sticker", e);
        }
      }, delay);
    } catch (e) {
      logger.error("[AutoWelcome] failed to greet", e);
    }
  }

  module.exports = {
    onLoad: function () {
      FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage);
    },
    onUnload: function () {
      FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
      greeted.clear();
    }
  };

  return module.exports;
})();
