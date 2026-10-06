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

  // Only these stickers are used: sticker name inside the given pack
  var TARGETS = [
    { pack: "cheerful choco", name: "wave" },
    { pack: "robo nelly", name: "wave" },
    { pack: "clyde bot", name: "wave" },
    { pack: "doggo replies", name: "sup" },
    { pack: "wumpus beyond", name: "wave" },
    { pack: "sassy peach", name: "scream" }
  ];

  var findByProps = vendetta.metro.findByProps;
  var FluxDispatcher = vendetta.metro.common.FluxDispatcher;
  var logger = vendetta.logger;

  var MessageActions = findByProps("sendMessage", "receiveMessage");
  var UserStore = findByProps("getCurrentUser", "getUser");

  var USER_JOIN = 7;
  var greeted = new Set();
  var stickerIds = [];

  function lower(s) {
    return String(s == null ? "" : s).toLowerCase().trim();
  }

  // Finds the six stickers by name in Discord's public sticker packs
  function loadStickers() {
    return fetch("https://discord.com/api/v10/sticker-packs")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var packs = data.sticker_packs || [];
        var ids = [];
        TARGETS.forEach(function (t) {
          var found = null;
          packs.forEach(function (pack) {
            (pack.stickers || []).forEach(function (s) {
              if (found || lower(s.name) !== t.name) return;
              var inPack = lower(pack.name).indexOf(t.pack) !== -1;
              var inDesc = lower(s.description).indexOf(t.pack) !== -1;
              if (inPack || inDesc) found = s.id;
            });
          });
          if (found) {
            ids.push(found);
          } else {
            logger.log("[AutoWelcome] sticker not found: " + t.name + " / " + t.pack);
          }
        });
        logger.log("[AutoWelcome] resolved " + ids.length + " of " + TARGETS.length + " stickers");
        if (ids.length) stickerIds = ids;
        return ids;
      })
      .catch(function (e) {
        logger.error("[AutoWelcome] could not load stickers", e);
        return [];
      });
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function sendSticker(message) {
    var stickerId = pick(stickerIds);
    MessageActions.sendMessage(
      message.channel_id,
      { content: "", tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
      undefined,
      {
        stickerIds: [stickerId],
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
        if (stickerIds.length) {
          sendSticker(message);
        } else {
          loadStickers().then(function (ids) {
            if (ids.length) sendSticker(message);
          });
        }
      }, delay);
    } catch (e) {
      logger.error("[AutoWelcome] failed to greet", e);
    }
  }

  module.exports = {
    onLoad: function () {
      loadStickers();
      FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage);
    },
    onUnload: function () {
      FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
      greeted.clear();
    }
  };

  return module.exports;
})();
