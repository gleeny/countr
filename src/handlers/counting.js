const { getPermissionLevel, limitFlows, flow: { triggers: allTriggers, actions: allActions }, limitTriggers, limitActions } = require("../constants/index.js");

module.exports = async (message, gdb) => {
  const permissionLevel = getPermissionLevel(message.member);

  if (message.content.startsWith("!") && permissionLevel >= 1) return;

  let { count, user, modules, regex, notifications, flows, users: scores } = gdb.get(), regexMatches = false;
  if (regex.length && permissionLevel == 0)
    for (let r of regex)
      if ((new RegExp(r, 'g')).test(message.content)) {
        regexMatches = true;
        break;
      }
  
  if (
    regexMatches ||
    (!modules.includes("allow-spam") && message.author.id == user) ||
    (!modules.includes("talking") && message.content !== (count + 1).toString()) ||
    message.content.split(" ")[0] !== (count + 1).toString()
  ) return message.delete();

  count++;
  gdb.addToCount(message.member);

  let countingMessage = message;
  if (modules.includes("webhook")) try {
    let webhooks = await message.channel.fetchWebhooks(), webhook = webhooks.find(wh => wh.name == "Countr");
    if (!webhook) webhook = await message.channel.createWebhook("Countr").catch(() => null);

    if (webhook) {
      countingMessage = await webhook.send(message.content, {
        username: message.author.username,
        avatarURL: message.author.displayAvatarURL({ dynamic: true }),
      });
      message.delete();
    }
  } catch(e) {}
  else if (modules.includes("reposting")) try {
    countingMessage = await message.channel.send(`${message.author}: ${message.content}`)
    message.delete();
  } catch(e) {}

  gdb.set("message", countingMessage.id)

  for (const notifID in notifications) {
    const notif = notifications[notifID];
    if (notif && (
      notif.mode == "only" && notif.count == count ||
      notif.mode == "each" && notif.count % count == 0
    )) {
      try {
        const receiver = await message.guild.members.fetch(notif.user);
        if (receiver) receiver.send({
          embed: {
            description: [
              `🎉 **${message.guild} reached ${count} total counts!**`,
              `The user who sent it was ${member}.`,
              "",
              `[**→ Click here to jump to the message!**](${countMessage.url})`,
            ].join("\n"),
            color: config.color,
            timestamp: Date.now(),
            thumbnail: {
              url: member.user.displayAvatarURL({ dynamic: true, size: 512 })
            },
            footer: {
              text: `Notification ID ${nid}`
            }
          }
        })
      } catch(e) {}
      if (notif.mode == "only") {
        delete notifications[notifID];
        gdb.set("notifications", notifications)
      }
    }
  }

  // check flows
  const countData = {
    count,
    score: (scores[message.author.id] || 0) + 1,
    message
  }, flowIDs = Object.keys(flows).slice(0, limitFlows)
  for (const flowID of flowIDs) {
    const flow = flows[flowID]; let success;
    for (const trigger of flow.triggers.slice(0, limitTriggers).filter(t => t)) {
      success = allTriggers[trigger.type].check(countData, trigger.data);
      if (success) break;
    }
    if (success)
      for (const action of flow.actions.slice(0, limitActions).filter(a => a))
        await allActions[action.type].run(countData, action.data)
  }
}