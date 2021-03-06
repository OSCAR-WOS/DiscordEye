const config = require('./config.json');
const functions = require('./functions');
const helper = require('./helper.js');
const { MessageEmbed } = require('discord.js');
const util = require('util');

const Type = {
  MESSAGE_DELETE: 'message_delete',
  MESSAGE_UPDATE: 'message_update',
  MESSAGE_BULK_DELETE: 'message_bulk_delete'
}

module.exports.Type = Type;

module.exports.send = function(guild, data, type) {
  return new Promise(async (resolve, reject) => {
    if (!guild.hasOwnProperty('ready') || guild.db.log.channel == null) return resolve();
    if (!guild.db.log.enabledModules.includes(type)) return resolve();

    try {
      switch (type) {
        case Type.MESSAGE_DELETE: return resolve(await logDelete(guild, data));
        case Type.MESSAGE_UPDATE: return resolve(await logUpdate(guild, data));
        case Type.MESSAGE_BULK_DELETE: return resolve(await logBulkDelete(guild, data));
      }
    } catch (e) { reject(e); }
  })
}

function logDelete(guild, data) {
  return new Promise(async (resolve, reject) => {
    let embed = new MessageEmbed();
    embed.setColor('ORANGE');

    let displayName = data.message.author.tag;
    if (data.message.member && data.message.author.username != data.message.member.displayName) displayName += ` [${data.message.member.displayName}]`;
    embed.setFooter(util.format(helper.translatePhrase('log_message_delete', guild.db.lang), displayName, `#${data.message.channel.name}`));

    if (data.executor) {
      let executor = guild.member(data.executor);

      let executorName = data.executor.tag;
      if (executor && data.executor.username != executor.displayName) executorName += ` [${executor.displayName}]`;
      embed.setFooter(util.format(helper.translatePhrase('log_message_delete_audit', guild.db.lang), displayName, `#${data.message.channel.name}`, executorName));
    }

    let content = '';
    let files = [];

    let string = functions.logLengthCheck(data.message.cleanContent);

    if (string.type == 'text') content += util.format(helper.translatePhrase('log_message', guild.db.lang), data.message.content);
    else if (string.type == 'id') {
      if (config.site.enabled) content += util.format(helper.translatePhrase('log_message_link', guild.db.lang), `${config.site.url}/messages/${string.value}.txt`);
      else {
        content += util.format(helper.translatePhrase('log_message_attachment', guild.db.lang), string.value);
        files.push(`./messages/${string.value}.txt`);
      }
    }

    if (data.message.attachment) {
      let attachment = data.message.attachment;
      if (content.length > 0) content += `\n`;
      
      if (guild.db.log.files != null && attachment.link) content += util.format(helper.translatePhrase('log_attachment_url', guild.db.lang), attachment.link.url, attachment.name);
      else if (!config.discord.log.downloadAttachments) content += util.format(helper.translatePhrase('log_attachment_configure', guild.db.lang), attachment.name, guild.db.prefix);
      else {
        content += util.format(helper.translatePhrase('log_attachment', guild.db.lang), attachment.name);
        files.push(`./attachments/${attachment.channel.id}/${attachment.id}/${attachment.name}`);
      }
    }

    embed.setDescription(content);
    try { return resolve(await send(guild, embed, files)); }
    catch (e) { reject(e); }
  })
}

function logUpdate(guild, data) {
  return new Promise(async (resolve, reject) => {
    let embed = new MessageEmbed();
    embed.setColor('YELLOW');

    let displayName = data.new.author.tag;
    if (data.new.author.username != data.new.member.displayName) displayName += ` [${data.new.member.displayName}]`;
    embed.setFooter(util.format(helper.translatePhrase('log_message_edit', guild.db.lang), displayName, `#${data.new.channel.name}`));

    let content = '';
    let files = [];

    let newString = functions.logLengthCheck(data.new.cleanContent);
    let oldString = functions.logLengthCheck(data.old.cleanContent);

    if (oldString.type == 'text') content += util.format(helper.translatePhrase('log_message', guild.db.lang), data.old.content);
    else if (oldString.type == 'id') {
      if (config.site.enabled) content += util.format(helper.translatePhrase('log_message_link', guild.db.lang), `${config.site.url}/messages/${oldString.value}.txt`);
      else {
        content += util.format(helper.translatePhrase('log_message_attachment', guild.db.lang), oldString.value);
        files.push(`./messages/${oldString.value}.txt`);
      }
    }

    content += '\n';

    if (newString.type == 'text') content += util.format(helper.translatePhrase('log_message_new', guild.db.lang), data.new.url, data.new.content);
    else if (newString.type == 'id') {
      if (config.site.enabled) content += util.format(helper.translatePhrase('log_message_link_new', guild.db.lang), data.new.url, `${config.site.url}/messages/${newString.value}.txt`);
      else {
        content += util.format(helper.translatePhrase('log_message_attachment_new', guild.db.lang), data.new.url, newString.value);
        files.push(`./messages/${newString.value}.txt`);
      }
    }

    embed.setDescription(content);
    try { return resolve(await send(guild, embed, files)); }
    catch (e) { reject(e); }
  })
}

function logBulkDelete(guild, data) {
  return new Promise(async (resolve, reject) => {
    let embed = new MessageEmbed();
    embed.setColor('ORANGE');
    embed.setFooter(util.format(helper.translatePhrase('log_message_bulk', guild.db.lang), data.messages.length, `#${data.channel.name}`));

    let string = '';
    let files = [];

    for (let i = data.messages.length - 1; i >= 0; i--) {
      let message = data.messages[i];
      
      let displayName = message.author.tag;
      if (message.author.username != message.member.displayName) displayName += ` [${message.member.displayName}]`;

      if (message.changes) {
        for (let x = 0; x < message.changes.length; x++) {
          let messageEdit = message.changes[x];

          if (messageEdit.length == 0) continue;
          if (string.length > 0) string += '\n';

          string += `${new Date(messageEdit.createdTimestamp)} ${displayName} | ${messageEdit.content}`;
        }
      }

      if (message.cleanContent.length > 0) {
        if (string.length > 0) string += '\n';
        string += `${new Date(message.createdTimestamp)} ${displayName} - ${message.content}`;
      }

      if (message.attachment) {
        let attachment = message.attachment;
        if (string.length > 0) string += '\n';

        if (attachment.link) string += util.format(helper.translatePhrase('log_messages_bulk_attachment', guild.db.lang), attachment.link.url);
        else if (config.discord.log.downloadAttachments) string += util.format(helper.translatePhrase('log_messages_bulk_attachment', guild.db.lang), `/attachments/${attachment.channel.id}/${attachment.id}/${attachment.name}`);
        else string += util.format(helper.translatePhrase('log_messages_bulk_attachment', guild.db.lang), attachment.name);
      }
    }

    let id = functions.writeMessageFile(string);
    let content = '';

    if (config.site.enabled) content = util.format(helper.translatePhrase('log_messages_link', guild.db.lang), `${config.site.url}/messages/${id}.txt`);
    else {
      content = util.format(helper.translatePhrase('log_messages_attachment', guild.db.lang), id);
      files.push(`./messages/${id}.txt`);
    }

    embed.setDescription(content);
    try { return resolve(await send(guild, embed, files)); }
    catch (e) { reject(e); }
  })
}

function send(guild, embed, files) {
  return new Promise(async (resolve, reject) => {
    if (guild.hasOwnProperty('logHook')) {
      try { return resolve(await guild.logHook.send('', { embeds: [ embed ], files: files })); }
      catch { }
    }

    let guildChannel = guild.channels.cache.find(channel => channel.id == guild.db.log.channel);
    try { resolve(await guildChannel.send('', { embed: embed, files: files })); }
    catch (e) { reject(e); }
  })
}