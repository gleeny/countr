import { countingLogger } from "../../../utils/logger/counting";
import { inspect } from "util";
import type { Message } from "discord.js";

export default async function repostWithEmbed(message: Message<true>): Promise<Message> {
  try {
    return await message.channel.send({
      embeds: [
        {
          description: `${message.author.toString()}: ${message.content}`,
          color: message.member?.displayColor ?? 3092790,
        },
      ],
    });
  } catch (err) {
    countingLogger.error(inspect(err));
    return message;
  }
}
