import { ButtonStyle, ComponentType } from "discord.js";
import type { CountingChannelSchema, GuildDocument } from "../../database/models/Guild";
import type { InteractionReplyOptions, InteractionUpdateOptions, SelectMenuInteraction } from "discord.js";
import type { ChatInputCommand } from ".";
import { components } from "../../handlers/interactions/components";
import config from "../../config";
import modules from "../../constants/modules";

const moduleList = Object.keys(modules) as Array<keyof typeof modules>;

const command: ChatInputCommand = {
  description: "Get a list of modules",
  considerDefaultPermission: false,
  requireSelectedCountingChannel: true,
  execute(interaction, ephemeral, document, [, countingChannel]) {
    return void interaction.reply(modelListOverview(ephemeral, document, countingChannel, interaction.id));
  },
};

export default { ...command } as ChatInputCommand;

function modelListOverview(ephemeral: boolean, document: GuildDocument, countingChannel: CountingChannelSchema, uniqueId: string): InteractionReplyOptions & InteractionUpdateOptions {
  components.set(`${uniqueId}:module`, {
    type: "SELECT_MENU",
    allowedUsers: "creator",
    callback(interaction) {
      return void interaction.update(modelDetails(interaction, ephemeral, document, countingChannel, interaction.id));
    },
  });

  return {
    embeds: [
      {
        title: "Available modules",
        description: [
          "**Get more information about a module by using the dropdown below.**",
          "**Turn a module on with the dropdown by selecting a module and then enabling it.**",
          "",
          ...moduleList.map(name => `${countingChannel.modules.includes(name) ? "🔘" : "⚫"} \`${name}\` *${modules[name].description}*`),
        ].join("\n"),
        color: config.colors.primary,
      },
    ],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.SelectMenu,
            placeholder: "Read more about...",
            minValues: 1,
            maxValues: 1,
            options: moduleList.map(name => ({
              label: name,
              value: name,
              description: modules[name].description,
            })),
            customId: `${uniqueId}:module`,
          },
        ],
      },
    ],
  };
}

function modelDetails(interaction: SelectMenuInteraction, ephemeral: boolean, document: GuildDocument, countingChannel: CountingChannelSchema, uniqueId: string): InteractionReplyOptions & InteractionUpdateOptions {
  const [name] = interaction.values as [keyof typeof modules];
  const { incompatible } = modules[name];

  components.set(`${uniqueId}:enable`, {
    type: "BUTTON",
    allowedUsers: "creator",
    callback(button) {
      if (incompatible?.some(module => countingChannel.modules.includes(module))) {
        return void button.reply({
          content: `❌ The module \`${name}\` is incompatible with the following module(s): ${incompatible.map(module => `\`${module}\``).join(", ")}`,
          ephemeral: true,
        });
      }

      countingChannel.modules.push(name);
      document.safeSave();

      return void button.update(generateModelMenuReply(name, countingChannel, button.id));
    },
  });

  components.set(`${uniqueId}:disable`, {
    type: "BUTTON",
    allowedUsers: "creator",
    callback(button) {
      countingChannel.modules = countingChannel.modules.filter(module => module !== name);
      document.safeSave();

      return void button.update(generateModelMenuReply(name, countingChannel, button.id));
    },
  });

  components.set(`${uniqueId}:back`, {
    type: "BUTTON",
    allowedUsers: "creator",
    callback(button) {
      return void button.update(modelListOverview(ephemeral, document, countingChannel, button.id));
    },
  });

  return generateModelMenuReply(name, countingChannel, uniqueId);
}

function generateModelMenuReply(name: keyof typeof modules, countingChannel: CountingChannelSchema, uniqueId: string): InteractionReplyOptions & InteractionUpdateOptions {
  const { description, image, incompatible } = modules[name];
  return {
    embeds: [
      {
        title: `Module Information • ${name}`,
        description: description + (incompatible ? `\n\n*Incompatible with modules ${incompatible.map(module => `\`${module}\``).join(", ")}*` : ""),
        ...image && { image: { url: image }},
        color: config.colors.primary,
      },
    ],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          countingChannel.modules.includes(name) ?
            {
              type: ComponentType.Button,
              label: "Module is enabled (click to disable)",
              customId: `${uniqueId}:disable`,
              style: ButtonStyle.Primary,
            } :
            {
              type: ComponentType.Button,
              label: "Module is disabled (click to enable)",
              customId: `${uniqueId}:enable`,
              style: ButtonStyle.Secondary,
            },
          {
            type: ComponentType.Button,
            label: "Go back",
            customId: `${uniqueId}:back`,
            style: ButtonStyle.Secondary,
          },
        ],
      },
    ],
  };
}